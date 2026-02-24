# V3 Performance Improvement Recommendations

This document recommends **concrete improvements** to make the stack faster: **UI → API → Blockchain**. It is based on the current codebase (ownership-ui-master, ownership-api-master, Fabric integration).

---

## 1. Where the slowness comes from

| Layer | Current behavior | Impact |
|-------|------------------|--------|
| **API ↔ Blockchain** | New Fabric **Gateway connection** on **every** request (`try (Gateway gateway = GatewayHelperV1.connect(username))`). Each call: load wallet, TLS handshake, gRPC to peer. | **High latency per request** (hundreds of ms to seconds). |
| **API** | No caching of **read** results (e.g. `QueryAsset`, `QueryAllAssets`). Every read hits the ledger. | Repeated reads are slow and add load to the peer. |
| **API** | Some flows do heavy work in one request (e.g. Report Issue: `QueryAllAssets` then loop in Java to find asset by name). | Unnecessary blockchain round-trips and CPU. |
| **UI** | Dashboard runs **3 API calls sequentially** (`fetchDepartments`, `fetchDashboard`, `fetchReport`) in one `useEffect`. | Dashboard load time = sum of 3 latencies. |
| **UI** | No **client-side cache** (e.g. SWR/React Query). Same data refetched on every mount/navigation. | Repeated navigations feel slow. |
| **UI** | No **request deduplication**; multiple components can trigger the same API call. | Extra load and slower perceived performance. |

Improvements below target these areas in order of impact.

---

## 2. API + Blockchain improvements

### 2.1 (High impact) Gateway connection pool / reuse

**Problem:** Every API call opens and closes a Fabric Gateway. Connection setup dominates latency.

**Recommendation:** Reuse Gateways per user (or per request scope) instead of creating a new one per call.

**Options:**

- **A. Per-user Gateway cache (in-process)**  
  - Maintain a bounded cache: `username → Gateway` (e.g. Caffeine or ConcurrentHashMap with TTL and max size).  
  - On API request: get or create Gateway for that user, use it, do **not** close after the request.  
  - Evict after idle (e.g. 5–10 min) or on max size to avoid leaking connections.  
  - **Caution:** Fabric Gateway is not guaranteed thread-safe for concurrent submitTransaction; use one Gateway per user and serialize writes for that user, or use a pool of Gateways per user.

- **B. Gateway pool (small pool per identity)**  
  - Create a small pool of Gateways (e.g. 2–5) per identity, get/return from pool for each request.  
  - Reduces connection churn while limiting concurrent use.

**Where to change:**  
- Add a `GatewayPool` or `GatewayCache` (e.g. in a new package `com.up.asset_holder_api.gateway`).  
- In `AssetServiceImp`, `ReportIssueServiceImp`, `DepartmentServiceImp`, etc., replace `try (Gateway gateway = GatewayHelperV1.connect(...))` with “get from pool/cache → use → return to pool” (and only close on eviction).

**Expected effect:** Large reduction in latency for all blockchain-backed endpoints (often 50–70% of request time can be connection setup).

---

### 2.2 (High impact) Cache read-only blockchain queries

**Problem:** Every `getAssetById`, `getAllAsset`, dashboard counts, etc., hit the ledger. Reads are repeatable and do not need to go to Fabric on every request.

**Recommendation:** Add a **short-TTL cache** for read-only chaincode results (e.g. `QueryAsset`, `QueryAllAssets`, and any endpoint that only calls `evaluateTransaction`).

**Implementation:**

- Use **Spring Cache** (e.g. Caffeine) with a short TTL (e.g. 10–30 seconds).  
- Cache key: e.g. `"asset:" + assetId` or `"allAssets:" + username`.  
- Invalidate or use a short TTL so that after a write (create/update/transfer/delete asset) the cache does not serve stale data for long.  
- Only cache **evaluateTransaction** (read) results, never **submitTransaction** (write).

**Where to change:**  
- Add `@EnableCaching` and a Caffeine cache manager.  
- In `AssetServiceImp.getAssetById`, `getAllAssets`, and in any service that only reads from the chain, add `@Cacheable` (or manual cache get/put) with the chosen key and TTL.  
- After create/update/transfer/delete, use `@CacheEvict` or evict by key/pattern.

**Expected effect:** Repeat reads (e.g. list views, detail views, dashboard) become much faster when served from cache; first request after TTL still hits Fabric.

---

### 2.3 (Medium impact) Avoid redundant blockchain calls in one request

**Problem:** Example: in Report Issue flow, the API calls `QueryAllAssets` and then finds an asset by name in Java. That is one heavy read per report.

**Recommendation:**

- Prefer **chaincode-level** “get asset by name” (or by indexed field) if you can add or extend chaincode, so the peer returns one asset instead of all.  
- If you cannot change chaincode: at least **cache** `QueryAllAssets` (or the “asset list” query) with a short TTL (as in 2.2) so repeated report-issue or similar flows do not hit the ledger every time.

---

### 2.4 (Medium impact) Async / non-blocking for writes

**Problem:** `submitTransaction` blocks the API thread until the transaction is ordered and committed. During that time the thread is waiting.

**Recommendation:**

- For **write** operations (create/update/transfer asset, etc.), consider returning **202 Accepted** and a “transaction ID” or “request ID” immediately, then process Fabric submission asynchronously (e.g. `@Async` or a message queue).  
- The UI can poll a status endpoint or use WebSocket/SSE to get the result.  
- This makes the API respond quickly and avoids thread blocking on Fabric; it does not reduce Fabric latency itself but improves API responsiveness and scalability.

**Where to change:**  
- Add an async layer (e.g. `CompletableFuture` or message queue) for write operations.  
- Controllers return 202 + job/transaction id; background job updates status and notifies.

---

### 2.5 (Lower impact) CouchDB / index for rich queries

**Problem:** If you use CouchDB as state database and run rich queries (e.g. by asset name, date), missing indexes can slow queries.

**Recommendation:**

- Add **CouchDB indexes** for any query pattern used by chaincode (e.g. by `asset_name`, `assign_date`).  
- Reduces query time and load on the peer.

---

## 3. UI improvements

### 3.1 (High impact) Parallel dashboard requests

**Problem:** Dashboard runs three calls one after another:

```js
useEffect(() => {
  fetchDepartments();   // await 1
  fetchDashboard();     // await 2
  fetchReport();        // await 3
}, [token]);
```

**Recommendation:** Run them in **parallel** and wait for all:

```js
useEffect(() => {
  if (!token) return;
  const load = async () => {
    setLoading(true);
    try {
      const [assetRequestRes, countRes, reportRes] = await Promise.all([
        getAllAssetRequest(token),
        getDashboardCount(token),
        getAllReport(token),
      ]);
      // set state from results
    } finally {
      setLoading(false);
    }
  };
  load();
}, [token]);
```

**Where to change:** `ownership-ui-master/src/app/components/client/DashboardClient.jsx`.

**Expected effect:** Dashboard load time ≈ **max** of the three calls instead of **sum**, often 2–3x faster.

---

### 3.2 (High impact) Client-side cache and request deduplication (SWR or React Query)

**Problem:** Every visit to asset list, dashboard, or report list refetches from the API. No shared cache or deduplication.

**Recommendation:** Introduce **SWR** or **React Query** (TanStack Query) for API data.

- **Deduplication:** Multiple components asking for “all assets” get one request and shared data.  
- **Caching:** Navigate away and back without refetch (configurable stale time).  
- **Background revalidation:** Data can refresh in the background after a short interval.

**Example (SWR):**

```js
// e.g. useAssets.js
import useSWR from 'swr';
const fetcher = (url, token) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
export function useAssets(token) {
  const { data, error, mutate } = useSWR(
    token ? ['/api/v1/user/getAllAsset', token] : null,
    ([url, t]) => fetcher(`${process.env.NEXT_PUBLIC_API_URL}${url}`, t),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );
  return { assets: data?.payload ?? [], error, mutate };
}
```

Use the same pattern for dashboard counts, asset requests, reports, etc.

**Where to change:**  
- Add SWR (or React Query) and create small hooks per resource (assets, dashboard count, asset requests, reports).  
- Replace direct `getAllAsset(token)` / `getDashboardCount(token)` etc. in components with these hooks.

**Expected effect:** Faster navigation, fewer redundant requests, better perceived performance.

---

### 3.3 (Medium impact) Optimistic UI for writes

**Problem:** After create/update/delete, the UI waits for the API (and thus blockchain) before updating the screen.

**Recommendation:** For creates/updates/deletes, update the **local cache/state immediately** (optimistic), then revert on error. With SWR: `mutate(optimisticData, false)` then revalidate.

**Expected effect:** Buttons and lists feel instant; only errors trigger a rollback.

---

### 3.4 (Medium impact) Loading and skeleton states

**Problem:** Blank screen or spinner until all data is back.

**Recommendation:** Show **skeleton** placeholders (e.g. table rows, cards) as soon as the layout is known. Use the same parallel loading (3.1) and cache (3.2) so data appears as soon as it’s available.

**Expected effect:** Perceived performance improves even if backend time is unchanged.

---

### 3.5 (Lower impact) Reduce payload size and round-trips

- Prefer **list endpoints that return only needed fields** (e.g. id, name, status) for list views, and full detail only for detail view.  
- Ensure **pagination** is used for large lists (e.g. assets, history) so the UI does not load thousands of rows at once.

---

## 4. Prioritized roadmap

| Priority | Item | Layer | Effort | Impact |
|----------|------|--------|--------|--------|
| 1 | Gateway connection pool/reuse | API | Medium | High |
| 2 | Cache read-only Fabric queries (short TTL) | API | Medium | High |
| 3 | Dashboard: parallel `Promise.all` | UI | Low | High |
| 4 | SWR or React Query for assets, dashboard, reports | UI | Medium | High |
| 5 | Async write handling (202 + job id) | API | Medium | Medium |
| 6 | Report Issue: avoid redundant QueryAllAssets (cache or chaincode) | API | Low–Medium | Medium |
| 7 | Optimistic UI for writes | UI | Low | Medium |
| 8 | CouchDB indexes for chaincode queries | Blockchain | Low | Medium |
| 9 | Skeleton loaders | UI | Low | Perceived |

---

## 5. Quick wins you can do first

1. **Dashboard parallel load** – Change `DashboardClient.jsx` to use `Promise.all([getAllAssetRequest(token), getDashboardCount(token), getAllReport(token)])` and set state once.  
2. **Cache in API** – Add Caffeine (or Spring Cache) with a 15–30 s TTL for `getAssetById` and list endpoints that only read from Fabric.  
3. **Gateway reuse** – Implement a small, bounded Gateway cache/pool per user and use it in `AssetServiceImp` and other services instead of opening a new Gateway per request.

These three give the largest benefit for the effort and unblock further improvements (e.g. async writes and richer UI cache).

---

## 6. References in this repo

- API Fabric usage: `ownership-api-master/src/main/java/com/up/asset_holder_api/helper/GatewayHelperV1.java`, `AssetServiceImp.java`, `ReportIssueServiceImp.java`, `DepartmentServiceImp.java`.  
- UI dashboard: `ownership-ui-master/src/app/components/client/DashboardClient.jsx`.  
- UI asset fetch: `ownership-ui-master/src/app/components/service/asset.service.js`, `AssetListClient.jsx`, `user/asset/page.jsx`.  
- Performance script: `scripts/api-perf-measure.js` (for baseline and regression).

If you tell me which part you want to implement first (e.g. “Gateway pool in the API” or “Dashboard Promise.all in the UI”), I can outline the exact code changes step by step.
