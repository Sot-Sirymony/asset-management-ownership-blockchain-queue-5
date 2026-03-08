# Test: Transfer "Monitor MSI 2020" from sirymony to dalen phea

## Option 1: Via UI (Admin)

1. **Start** the app (blockchain + API + UI) e.g. `./start-all-projects.sh`.
2. **Log in as admin** (e.g. admin / adminpw).
3. Go to **Admin → Asset**.
4. Find the row **Monitor MSI 2020** (Assign To should show sirymony).
5. Click the **transfer** icon on that row.
6. In the popup, **search or scroll** to **dalen phea** and **click** to select.
7. Click **Transfer**.
8. You should see **"Transfer user success!!!"** and the list will refresh; the asset should now show **dalen phea** as Assign To.

**Note:** Transfer is done as **admin** (only admin can open Admin → Asset and use the transfer button). The asset is moved on the blockchain from sirymony to dalen phea.

---

## Option 2: Via script (API)

From the repo root, with API running on 8081 and blockchain up:

```bash
./test-transfer-asset.sh
```

Default: finds asset whose name contains **"Monitor MSI 2020"** and transfers it to a user whose fullName/username matches **"dalen phea"**.

Custom asset name or new owner:

```bash
./test-transfer-asset.sh "Monitor MSI 2020" "dalen phea"
./test-transfer-asset.sh "Monitor" "dalen"
```

The script: logs in as admin → gets all assets → finds the asset → gets all users → finds dalen phea’s userId → calls `PUT /api/v1/admin/transferAsset/{assetId}` with `{"newAssignTo": <userId>}`.

---

## Verify after transfer

- **Admin → Asset**: Monitor MSI 2020 should show **Assign To: dalen phea**.
- **User dalen phea**: Log in as dalen phea → **User → Asset**; the asset should appear in the list.
- **User sirymony**: Log in as sirymony → **User → Asset**; the asset should no longer appear.
