# Run UI tests & resolve issues after

---

## Run UI e2e tests (correct order)

The e2e tests need the **UI on port 3000** and **API on port 8081**. If you run `npm run test:e2e` without starting them, you’ll see **ERR_CONNECTION_REFUSED** and all tests will fail.

**1. Start API and UI** (from repo root):

```bash
./start-api-frontend.sh
```

**2. Run e2e tests** (in another terminal, from repo root or `ownership-ui-master`):

```bash
cd ownership-ui-master && npm run test:e2e
```

If the UI isn’t running, the test run will now **exit immediately** with a short message telling you to start the app first.

---

## Resolve issues after running tests

Use the following when something is wrong **after** you run e2e tests or UI validation.

---

## Quick fix (recommended)

From the **repo root** (`All In One Source`) or from **`ownership-ui-master`** run:

```bash
./after-test.sh
```

This frees **ports 3000** (UI) and **8081** (API) and prints whether each port was freed or already free. No error if nothing was using the ports.

**If you also started Docker for the API/Postgres:**

```bash
./after-test.sh --docker
```

**If you want to remove Playwright test artifacts** (e.g. `test-results/`, `playwright-report/`):

```bash
./after-test.sh --artifacts
```

**Do both:**

```bash
./after-test.sh --all
```

---

## Issues you might see after tests

| Issue | Cause | Fix |
|-------|--------|-----|
| **Port 3000 in use** / "EADDRINUSE 3000" | UI dev server still running | `./after-test.sh` or see [Manual port kill](#manual-port-kill) below |
| **Port 8081 in use** / "Address already in use" | API still running | Same as above |
| **Cannot start UI or API** | Previous run left processes on 3000/8081 | `./after-test.sh` |
| **Docker containers still up** | API/Postgres started via `start-api-frontend.sh` or compose | `./after-test.sh --docker` or `./stop-all-projects.sh` |
| **Leftover test output** (screenshots, traces) | Playwright wrote to `test-results/` or `playwright-report/` | `./after-test.sh --artifacts` |
| **"Blockchain orderer unreachable"** / **"Failed to send transaction to the orderer"** (Create Asset) | API was started without `FABRIC_ORDERER_URL` (e.g. from IDE) or orderer not running | From repo root: `./restart-api-for-blockchain.sh` — stops API on 8081, then runs `./start-all-projects.sh` so the API starts with the orderer. Ensure the blockchain network is up first (script starts it). |

---

## Manual port kill

If you prefer not to use the script:

**Both ports (one-liner):**
```bash
for port in 8081 3000; do pids=$(lsof -ti :$port 2>/dev/null); [ -n "$pids" ] && kill $pids; done
```

**With feedback:**
```bash
for port in 8081 3000; do pids=$(lsof -ti :$port 2>/dev/null); if [ -n "$pids" ]; then kill $pids && echo "Freed port $port"; else echo "Port $port was already free"; fi; done
```

**Force-kill** (if normal `kill` doesn’t free the port): use `kill -9 $pids` instead of `kill $pids` in the commands above.

---

## Full stop (everything)

To stop UI, API, Docker API/Postgres, and blockchain network:

```bash
./stop-all-projects.sh
```

To also reset blockchain and clean build caches:

```bash
./reset-all.sh
```



lsof -ti :8081 | xargs kill
