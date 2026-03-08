# History transaction tracking (decentralized)

Each history row is tied to a **transaction** on the blockchain. You can track the chain: **first transaction → previous transaction → this transaction**.

## Fields (from blockchain / API)

| Field | Meaning |
|-------|--------|
| **tx_id** | This event’s transaction ID (unique per row). |
| **previous_tx_id** | Transaction that produced the *previous* state (empty for the first event). |
| **creation_tx_id** | Transaction that created the asset (same for all rows of that asset). |

All are derived from the ledger: no central server assigns them. Anyone can verify by querying asset history.

## How it works

1. **Chaincode**  
   `GetAssetHistory` returns each state with **tx_id** and **timestamp** (from Fabric’s `GetHistoryForKey`).

2. **API**  
   For each asset’s history (newest first), the API adds:
   - **previous_tx_id** = next entry’s `tx_id` (the transaction that wrote the previous state).
   - **creation_tx_id** = oldest entry’s `tx_id` (the creation transaction).

3. **UI**  
   History table shows a **Tx ID** column (short id). Tooltip shows full **This**, **Previous**, and **Creation** tx IDs for that row.

## Redeploy

After changing the chaincode (e.g. returning `tx_id` / `AssetHistoryEntry`), redeploy and restart the API:

```bash
cd ownership-network-master
./net.sh redeploy-cc
# then from repo root:
./restart-api-for-blockchain.sh
```
