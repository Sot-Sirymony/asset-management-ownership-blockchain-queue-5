# Asset Request Flow – Example: User sirymony.sot Requests an Asset

This document describes what happens when a **user** (e.g. **sirymony.sot**) requests an asset and what **other roles** (e.g. **Admin**) do.

---

## 1. User (sirymony.sot) – Submits the Request

| Step | Where | What happens |
|------|--------|----------------|
| 1.1 | **UI** | Sirymony.sot logs in and goes to **User → Asset Request** (e.g. `/user/asset-request`). |
| 1.2 | **UI** | Clicks **Create** and fills the form: **Asset Name**, **Qty**, **Unit**, **Reason**, **Attachment** (optional). |
| 1.3 | **Frontend** | `CreateAssetRequest.jsx` → `addAssetRequest(token, newAssetRequest)` → `assetRequest.service.js` **createRequest**. |
| 1.4 | **API** | **POST** `/api/v1/user/createAssetRequest` (body: assetName, qty, unit, reason, attachment). |
| 1.5 | **Backend** | `AssetRequestServiceImp.createUserAssetRequest()` gets current user ID from JWT (sirymony.sot → e.g. `userId = 4`), then `AssetRequestRepository.insertUserAssetRequest()` **inserts a row** into the **PostgreSQL** table `asset_request` (user_id, asset_name, qty, unit, reason, attachment). |
| 1.6 | **Result** | Request is **saved in the database only** (not on the blockchain yet). User sees success and can see the request in their list. |

So: **User creates a request → stored in DB with their `user_id`.**

---

## 2. User (sirymony.sot) – After Submitting

| Step | Where | What happens |
|------|--------|----------------|
| 2.1 | **UI** | **User → Asset Request** page loads **their own** requests. |
| 2.2 | **API** | **GET** `/api/v1/user/assetRequest` → `AssetRequestServiceImp.getUserAssetRequest()` → `findUserAssetRequest(userId)` → only rows where `user_id = 4` (sirymony.sot). |
| 2.3 | **User** | Can **View** details, **Update** (PUT `/api/v1/user/updateAssetRequest/{id}`), or **Delete** (DELETE `/api/v1/user/deleteAssetRequest/{id}`) their own requests. |

So: **User can only see and manage their own requests.**

---

## 3. Admin – Sees All Requests

| Step | Where | What happens |
|------|--------|----------------|
| 3.1 | **UI** | Admin logs in and goes to **Admin → Asset Request** (e.g. `/admin/asset-request`). |
| 3.2 | **API** | **GET** `/api/v1/admin/assetRequest` → `AssetRequestServiceImp.getAllUserAssetRequest()` → `findAllUserAssetRequest()` → **all rows** from `asset_request` (with user info joined). |
| 3.3 | **UI** | Admin sees a **table** of all requests: asset name, qty, reason, **who requested** (e.g. sirymony.sot / fullName), department, request date. Admin can **search**, **filter** (by user, date, etc.), and click **View** to open request details. |

So: **Admin sees every user’s asset requests in one list.**

---

## 4. Admin – Viewing a Request (e.g. sirymony.sot’s Request)

| Step | Where | What happens |
|------|--------|----------------|
| 4.1 | **UI** | Admin clicks **View** (eye icon) on a row → **ViewRequestAsset** modal opens. |
| 4.2 | **Modal** | Shows: requester name/email/avatar, **Asset Name**, **Qty**, **Unit**, **Reason**, **Attachment** (read-only). |
| 4.3 | **Note** | The modal has **Approve** and **Reject** buttons in the code, but they are **not wired** to any API yet (they only `console.log`). So in the **current** system, Admin **does not** approve/reject from this screen. |

So: **Admin can only view details; no approve/reject action yet.**

---

## 5. Admin – How the Request Is “Fulfilled” (Current Behavior)

There is **no** automatic “Approve request → create asset on blockchain” in the app. To give sirymony.sot an asset that was requested:

| Step | Where | What happens |
|------|--------|----------------|
| 5.1 | **UI** | Admin goes to **Admin → Asset** (e.g. `/admin/asset`) and clicks **Create Asset**. |
| 5.2 | **UI** | Fills the create-asset form and in **Assign To** selects **sirymony.sot** (or the user who made the request). |
| 5.3 | **API** | **POST** `/api/v1/admin/createAsset` with e.g. `assignTo: 4` (sirymony.sot’s userId). |
| 5.4 | **Backend** | `AssetServiceImp.createAsset()` uses Fabric gateway (admin identity) and calls chaincode **CreateAsset** (asset_id, asset_name, unit, condition, attachment, **assign_to**, …). |
| 5.5 | **Result** | Asset is **created on the blockchain** and assigned to sirymony.sot. Sirymony.sot will then see it under **User → Asset** (because of the `assign_to` filter we fixed). |

So: **Admin fulfills a request by manually creating an asset and assigning it to the requesting user.** The asset request in the DB remains as a record unless the user deletes it; there is no automatic link “request approved → asset created” in the current code.

---

## 6. End-to-End Flow Summary (Example: sirymony.sot)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. USER (sirymony.sot)                                                       │
│    • Logs in → User → Asset Request → Create                                 │
│    • Fills: Asset Name, Qty, Unit, Reason, Attachment                        │
│    • Submit → POST /user/createAssetRequest → row in DB (asset_request)    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. USER (sirymony.sot)                                                       │
│    • User → Asset Request: sees own list (GET /user/assetRequest)             │
│    • Can View / Update / Delete own request                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. ADMIN                                                                     │
│    • Admin → Asset Request: sees ALL requests (GET /admin/assetRequest)      │
│    • Can search, filter, View details (no Approve/Reject API yet)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. ADMIN (fulfill request)                                                   │
│    • Admin → Asset → Create Asset                                            │
│    • Fills form and sets “Assign To” = sirymony.sot                          │
│    • Submit → POST /admin/createAsset → CreateAsset on blockchain           │
│    • Asset appears for sirymony.sot under User → Asset                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. USER (sirymony.sot)                                                       │
│    • User → Asset: sees the new asset (GET /user/getAllAsset → filtered)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Roles and Permissions (API)

| Role  | Create request | See own requests | See all requests | Update/Delete own request | Create asset (blockchain) |
|-------|----------------|------------------|-------------------|----------------------------|----------------------------|
| User  | ✅ POST /user/createAssetRequest | ✅ GET /user/assetRequest | ❌ | ✅ PUT/DELETE own | ❌ |
| Admin | ❌ (uses same if needed) | ✅ (via user list) | ✅ GET /admin/assetRequest | ❌ (user only) | ✅ POST /admin/createAsset |

---

## 8. Status Tracking (Implemented)

- **Request status**: Each request has a **status**: `PENDING`, `ASSIGNED`, or `REJECTED`.
- **DB**: Table `asset_request` has columns `status` (default `PENDING`), `assigned_asset_id` (blockchain asset ID when assigned), and `resolved_at` (timestamp when set to ASSIGNED/REJECTED).
- **User (sirymony.sot)**: On **User → Asset Request**, the list shows a **Status** column (Pending / Assigned / Rejected) so the user can see when their request was assigned or rejected.
- **Admin**: On **Admin → Asset Request**, the list shows **Status**. In **View / Edit** details, admin can:
  - **Approve & Create Asset (blockchain)** – creates a **new asset on the blockchain** with `assign_to` = requester (e.g. sirymony.sot), then sets the request status to `ASSIGNED`. **Use this so the user sees the asset in User → Asset (Get all asset).**
  - **Mark as Assigned only** – only updates the **DB**: sets status to `ASSIGNED` and optionally an `assigned_asset_id`. It does **not** create or change any asset on the blockchain. The user will **not** see a new asset in **User → Asset** if you only use this.
  - **Reject** – sets status to `REJECTED`.
  - When a request is **Assigned** and has an asset ID, a link **"View this asset in Asset section →"** opens **Admin → Asset →** that asset.
- **Admin → Asset**: Admin sees **all** assets (including every assigned asset) in the Asset list; the same API filters only for non-admin users.
- **API**: **PUT** `/api/v1/admin/assetRequest/{id}/status` with body `{ "status": "ASSIGNED" | "REJECTED", "assignedAssetId": "optional" }`. **POST** `/api/v1/admin/assetRequest/{id}/approveAndCreateAsset` creates the asset on chain and sets the request ASSIGNED.

### Why doesn’t the user see the asset in “Get all asset”?

- **Get all asset** (User → Asset) reads from the **blockchain**. If admin only clicks **“Mark as Assigned only”**, the request is updated in the database but **no asset is created on the blockchain**, so the user’s asset list stays empty.
- For the user (e.g. sirymony.sot) to see the new asset in **User → Asset**, admin must use **“Approve & Create Asset (blockchain)”**. That creates the asset on chain with `assign_to` set to the requester, so it appears in their list.

**Applying the DB change (existing DBs):** Run the migration so the new columns exist.

---

## 9. Remarks / Notes

- **Migration (existing DBs):** Use one of these from the repo root:
  - **Docker (Postgres in container):**  
    `docker exec -i ownership-postgres psql -U postgres -d asset_holder_db < ownership-api-master/db-init/02-asset-request-status.sql`  
    If the output is **`DO`**, the migration ran successfully.
  - **Local psql (e.g. port 55432):**  
    `PGPASSWORD=postgres psql -U postgres -d asset_holder_db -h localhost -p 55432 -f ownership-api-master/db-init/02-asset-request-status.sql`
- **After migration:** Restart the API so it uses the updated schema; no UI rebuild needed.
- **New installs:** `01-schema.sql` already includes the status columns; `02-asset-request-status.sql` is only for DBs created before that change.
