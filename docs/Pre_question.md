# Pre-questions and answers

## Reference: Asset struct (chaincode)

```go
type Asset struct {
	AssetID    string `json:"asset_id"`
	AssetName  string `json:"asset_name"`
	Quantity   int    `json:"qty"`
	Unit       string `json:"unit"`
	Condition  string `json:"condition"`
	Attachment string `json:"attachment"`
	AssignTo   string `json:"assign_to"`
	Username   string `json:"username"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"` // Set on transfer/update so history shows distinct assign vs reassign times
	DepName    string `json:"dep_name"`
}
```

**Note:** `Asset` is the only type stored as an asset on the ledger (key = `AssetID`). Identity is not stored as an asset; `AssignTo` and `Username` are plain strings referencing users (identity is off-chain: Fabric CA + API wallet).

---

## Smart contract in this project

In this project, the **smart contract** is the **chaincode** deployed on the Fabric network. In Hyperledger Fabric, “smart contract” means the program that runs on the ledger and defines how state is read and updated; that program is implemented as **chaincode**. Here it is written in **Go**, packaged as the chaincode named **`basic`**, and deployed on channel **`channel-org`**.

### Where it lives

- **Location:** `ownership-network-master/channel/src/go/`
- **Entry:** `smart_contract.go` defines the `SmartContract` struct (embedding `contractapi.Contract`) and `main()` that starts the chaincode. All transaction functions are methods on `SmartContract`.
- **Modules:** `asset.go` (asset lifecycle), `report_issue.go` (report-issue lifecycle), `helpers.go` (PutState, GetState, Marshal, UnmarshalAsset, UnmarshalReportIssue).

### What it manages (ledger state)

1. **Assets**  
   - **Key:** `asset_id` (string).  
   - **Value:** JSON of the `Asset` struct (asset_id, asset_name, qty, unit, condition, attachment, assign_to, username, created_at, updated_at, dep_name).  
   - Used for equipment/items and their ownership (assign_to) and metadata.

2. **Report issues**  
   - **Key:** `report_id` (string).  
   - **Value:** JSON of the `ReportIssue` struct (report_id, full_name, asset_name, problem, attachment, user_id, username, created_at).  
   - Tied to an existing asset (CreateReportIssue checks that the asset exists and that asset_name matches).

### Transaction functions (what the API invokes)

**Asset functions:**

| Function | Purpose |
|----------|---------|
| `AssetExists(assetID)` | Returns whether an asset with that ID exists (read-only). |
| `CreateAsset(assetID, assetName, unit, condition, attachment, assignTo, username, depName, qty)` | Creates a new asset; fails if assetID already exists. |
| `QueryAsset(assetID)` | Returns the current asset by ID (read-only). |
| `QueryAllAssets()` | Returns all assets in world state (read-only). |
| `UpdateAsset(assetID, ...)` | Updates an existing asset’s fields; asset must exist. |
| `TransferAsset(assetID, newAssignTo)` | Changes ownership: sets assign_to to newAssignTo and updated_at; fails if asset does not exist or newAssignTo is empty or same as current. |
| `DeleteAsset(assetID)` | Removes the asset from world state (key deleted). |
| `GetAssetHistory(assetID)` | Returns history of changes for that key (each entry has Asset, tx_id, timestamp). |

**Report-issue functions:**

| Function | Purpose |
|----------|---------|
| `CreateReportIssue(reportID, assetID, assetName, problem, attachment, userID, username)` | Creates a report; asset must exist and assetName must match the asset. |
| `QueryReportIssue(reportID)` | Returns the report issue by ID (read-only). |
| `QueryAllReportIssues()` | Returns all report issues (read-only). |
| `UpdateReportIssue(reportID, assetName, problem, attachment, userID, username)` | Updates an existing report. |
| `DeleteReportIssue(reportID)` | Removes the report from world state. |
| `GetReportIssueHistory(reportID)` | Returns history of changes for that report key. |

### How it is used

- The **API** (Java) gets a Fabric Gateway and Contract for chaincode `basic` on `channel-org`, then calls:
  - **Reads:** `contract.evaluateTransaction("QueryAsset", id)`, `evaluateTransaction("QueryAllAssets")`, `evaluateTransaction("GetAssetHistory", id)`, and the report-issue query/history functions.
  - **Writes:** `contract.submitTransaction("CreateAsset", ...)`, `submitTransaction("TransferAsset", id, newAssignTo)`, `submitTransaction("UpdateAsset", ...)`, `submitTransaction("DeleteAsset", id)`, and the report-issue create/update/delete functions.
- **Authorization** (e.g. “only current owner or admin can transfer”) is enforced in the **API**; the smart contract enforces **business rules** (asset exists, valid new owner, no self-transfer, report linked to existing asset).

### Summary

The smart contract in this project is the **Go chaincode `basic`**: it defines and enforces the rules for **assets** (create, read, update, transfer, delete, history) and **report issues** (create, read, update, delete, history) on the shared ledger. It does not store identity as an asset; it only references usernames as strings. All changes are recorded on the blockchain with a transaction ID and timestamp for auditability.

---

## Flow of current blockchain

### 1. Identity and connection (one-time / per user)

- **Fabric CA** issues identities; users (including admin) **enroll** and get X.509 certs.
- The API stores identities in a **wallet** (file system). To talk to the chain, the API loads the identity for the logged-in **username**.
- The API reads the **connection profile** (`connection.yaml`) to know **peers**, **orderers**, **channel** (`channel-org`), and TLS paths. It builds a **Gateway** (cached per user in `FabricGatewayCache`) and gets a **Contract** for chaincode `basic` on that channel.

### 2. Request path: UI → API → blockchain

- **UI** (ownership-ui) calls **API** (ownership-api) over HTTP (e.g. create asset, transfer, query).
- The API resolves the **current user**, gets a **Gateway** for that user (from cache or new connection), then gets **Network** (channel) and **Contract** (chaincode).
- **Reads:** API calls `contract.evaluateTransaction(chaincodeFunction, ...)`. The request goes to the **peer**; the peer runs the chaincode and reads **world state** (e.g. `QueryAsset`, `QueryAllAssets`, `GetAssetHistory`). Result is returned to the API and then to the UI. No orderer involved.
- **Writes:** API calls `contract.submitTransaction(chaincodeFunction, ...)`. The **peer** endorses the transaction (runs chaincode, returns endorsement). The **orderer** receives the transaction, orders it, and delivers blocks to peers. Peers **commit** the block and update **world state** and **ledger**. Then the API (and UI) gets the success/failure.

### 3. Asset lifecycle on the chain

| Action | API (service) | Chaincode function | Effect on ledger |
|--------|----------------|--------------------|------------------|
| Create asset | `AssetServiceImp.createAsset()` | `CreateAsset` | New state key = `asset_id` (auto-generated by API), value = `Asset` |
| Read asset | `getAssetById(id)` | `QueryAsset` | Read world state by key |
| Read all | `getAllAssets()` | `QueryAllAssets` | Range over world state |
| Update asset | `updateAsset(id, asset)` | `UpdateAsset` | Overwrite state for same key |
| Transfer | `transferAsset(id, request)` | `TransferAsset` | Update `AssignTo` (and `UpdatedAt`) for same key |
| Delete asset | `deleteAsset(id)` | `DeleteAsset` | Remove key from state |
| Asset history | `getAssetHistory(id)` | `GetAssetHistory` | History by key (each entry has `tx_id`, timestamp) |

### 4. Report issue flow

- User reports an issue for an asset (by asset name). API finds the matching **asset_id** via `QueryAllAssets`, then calls chaincode **CreateReportIssue** (writes a **ReportIssue** record to the ledger). Other operations: **QueryReportIssue**, **QueryAllReportIssues**, **UpdateReportIssue**, **DeleteReportIssue**.

### 5. Summary

- **Identity:** Off-chain (Fabric CA + wallet). Chaincode only sees **usernames** as strings on `Asset` / `ReportIssue`.
- **Ledger:** Channel `channel-org`, chaincode `basic`. State is key–value; key for assets = `asset_id`, for report issues = `report_id`. Each write is a **transaction** with a unique **transaction_id**; history is per key.
- **API:** Single point that holds wallet, connection profile, and Gateway cache; translates REST calls into `evaluateTransaction` (read) or `submitTransaction` (write) to the Fabric network.

---

## Why are assets decentralized with blockchain in this project?

In this project, asset data is put on a **permissioned blockchain** (Hyperledger Fabric) instead of only in a central database so that ownership and history are **trustworthy and auditable** without relying on a single authority.

1. **Immutability**  
   Once a create, update, or transfer is committed to the ledger, it is not changed or deleted in place. Corrections are done by new transactions (e.g. another transfer). The past stays intact, so no one can silently alter who owned an asset or when.

2. **Shared, agreed record**  
   The ledger is replicated and agreed by **peers** (and ordered by the **orderer**). No single party (including the API or one admin) can unilaterally rewrite history. That gives a **single source of truth** for which assets exist and who they are assigned to.

3. **Audit trail and verifiability**  
   Every change is a **transaction** with a unique **transaction_id** and timestamp. The chaincode exposes **GetAssetHistory**, so anyone with access can see the full lifecycle of an asset (create, updates, transfers) and verify it using `tx_id`. That supports **compliance and dispute resolution**.

4. **Trust without a single central DB**  
   A central database can be altered by whoever controls it. Here, asset state and history live on the blockchain; multiple parties (org, auditors, or other apps) can rely on the same record. Identity and app data stay off-chain (Fabric CA, API DB); only asset (and report-issue) state and history are decentralized on the ledger.

5. **Fit for asset ownership**  
   The use case is **asset ownership and transfer** (create, assign, transfer, update, report issue). Blockchain provides a clear, tamper-evident record of who owned what and when, which is why assets are decentralized with blockchain in this project.

---

## In this use case, why can asset management with blockchain be trusted to establish ownership?

In this project, **ownership** is “who is assigned to the asset” — the `AssignTo` field on the ledger. The system can be **trusted** to establish and prove ownership for these reasons:

1. **Single source of truth on the ledger**  
   The current owner is whatever is stored in the ledger state for that `asset_id` (the `assign_to` field). That state is the same on every peer that has committed the block. There is no separate, editable database that could say something different. So **ownership = what the ledger says**.

2. **Consensus: everyone agrees on the same record**  
   A transfer is only applied after the **orderer** orders the transaction and **peers** validate and commit the block. All participants see the same sequence of blocks and the same world state. No single party (not the API, not one admin) can force a different history. So the **ownership record is agreed**, not decided by one server.

3. **Immutability: past ownership cannot be rewritten**  
   Once a create or transfer is committed, it is not changed in place. To “change” ownership you must submit a new **TransferAsset** transaction, which adds a new entry to the history. Nobody can go back and erase or alter a previous owner. So **history of ownership is tamper-evident**.

4. **Identity and authorization**  
   Only users with an **enrolled identity** (in the wallet) can submit transactions. Each transaction is **signed** by that identity; Fabric validates it. The API enforces who may do what (e.g. only current owner or admin can transfer). So **ownership changes are authorized and attributable**, not anonymous or arbitrary.

5. **Verifiable audit trail**  
   **GetAssetHistory** returns every change for an asset, each with a **transaction_id** and timestamp. Anyone with access can see: created by whom, then transferred to whom, when. That **chain of ownership** can be checked and proven for disputes or compliance. So **ownership is not only current state but provable over time**.

6. **Permissioned and controlled**  
   The network is **permissioned** (only known orgs/peers). The ledger is not public; only participants in the channel see it. So trust is “we all run the same rules and see the same data,” not “anyone on the internet can write.” That fits **organizational asset management** where ownership must be clear and auditable within the org.

**Summary:** Asset ownership is trusted because (1) the ledger is the only source of truth for who is assigned, (2) consensus and immutability prevent one party from changing history, (3) identity and chaincode rules ensure only authorized transfers, and (4) the full history with `tx_id` gives a verifiable chain of ownership.

### What “identity and chaincode rules ensure only authorized transfers” means

- **Identity**  
  To submit any transaction to the blockchain, the caller must have an **enrolled identity** in the wallet (Fabric CA + cert + private key). The API uses the **logged-in user’s username** to get a Gateway and to call `submitTransaction("TransferAsset", ...)`. So the transaction is **signed** by that user’s identity; Fabric accepts only valid, signed transactions. That means only **known, registered users** can cause a transfer to be written on the ledger — not anonymous or arbitrary actors. Identity thus ensures that every transfer is **attributable** to a specific user and that only users the organization has enrolled can submit.

- **Chaincode rules**  
  The chaincode function **TransferAsset** enforces **business rules on the ledger**: (1) the asset must exist, (2) `newAssignTo` must not be empty, and (3) the asset must not already be assigned to that user (no no-op transfer). If any of these fail, the chaincode returns an error and the transaction is not committed. So even if a request reaches the chaincode, invalid or nonsensical transfers are rejected. The **chaincode does not** check “is the caller the current owner?” — that is enforced in the **API** (see below).

- **Who can actually transfer (authorization)**  
  The **API** (e.g. `AssetServiceImp.trasfterAsset`) decides who is allowed to initiate a transfer. Before calling `contract.submitTransaction("TransferAsset", ...)`, it checks: if the user is **not** an admin, then the asset’s `assign_to` (current owner) must equal the current user’s ID; otherwise it returns “You do not have permission to transfer this asset. Only the current owner can transfer it.” So in practice, **only the current owner or an admin** can trigger a transfer. Identity (who is calling) + this API rule = only authorized transfers.

- **Together**  
  **Identity** = only enrolled users can submit; every transfer is signed and attributable. **Chaincode rules** = only valid state changes (asset exists, valid new owner, no self-transfer) are committed. **API** = only current owner or admin may call the transfer endpoint. So “identity and chaincode rules” (plus the API’s authorization) ensure that only authorized transfers are written to the ledger and that they are valid and auditable.

---

## Psychology step-by-step way to implement the blockchain network in this project

A mental-model progression: build trust and identity first, then ordering and peers, then the shared ledger, then business logic. Each step depends on the previous one.

| Step | Mindset | What you do in this project |
|------|--------|------------------------------|
| **1. Who can participate? (Identity)** | “No anonymous writes.” Decide who is allowed to be part of the network and sign transactions. | Start **Certificate Authorities (CA)**. Run `./net.sh up-ca`. Enroll admin, register and enroll orderers and org identities. Generate **crypto** with `./net.sh gen-crypto`. Outcome: certs and keys under `channel/crypto-config` so every node and user has a known identity. |
| **2. Who agrees on order? (Ordering)** | “We need a single agreed order of transactions.” One or more nodes must collect and order transactions into blocks. | **Channel artifacts**: genesis block and channel config (`./net.sh` runs `generate_channel_artifacts`). Start **orderers** (e.g. orderer.ownify.com) via `./net.sh up-fabric`. Orderers don’t hold application state; they only order and deliver blocks. |
| **3. Who holds the ledger? (Peers)** | “Someone must store and execute the ledger and smart contracts.” Peers hold the copy of the ledger and run chaincode. | Start **peers** and **CouchDB** (state DB) in `up-fabric`. Peers need TLS and MSP from step 1. **CLI** container uses the same crypto to run `peer` commands. |
| **4. Which shared ledger? (Channel)** | “Not everyone sees everything.” A channel is a private ledger for a subset of the network. | **Create** the application channel (e.g. `channel-org`) and **join** peers to it (`./net.sh channel`). Update anchor peers. Now peers on that channel share the same ledger and blocks. |
| **5. What rules run on the ledger? (Chaincode)** | “The rules are code everyone agrees on.” Chaincode defines how state (e.g. assets) is read and updated. | **Package** the Go chaincode, **install** on peer(s), **approve** for the org, **commit** on the channel (`./net.sh deploy-cc`). After this, the network can execute CreateAsset, TransferAsset, QueryAsset, GetAssetHistory, etc. |
| **6. Verify and operate** | “Does it work end-to-end?” | Use **explorer** (optional) or **CLI** to query/invoke. Later, the **API** uses the same channel and chaincode with identity from the wallet. |

**Why this order helps (psychology)**  
- **Identity first** reduces confusion: you never “run a peer” without knowing whose certs it uses.  
- **Ordering before peers** matches Fabric’s design: peers receive blocks from the orderer, so the orderer must exist and be configured first.  
- **Channel before chaincode** because chaincode is committed *on* a channel; the shared ledger must exist.  
- **Chaincode last** is the “application” layer: once the trust and topology are in place, you add the business logic (assets, ownership, history).

**One command that does it all**  
In this project, `./net.sh up` (from `ownership-network-master`) runs the steps in this order: up-ca → gen-crypto → channel artifacts → up-fabric → channel_and_join → deploy_cc → up-explorer. If you forget the psychology, remember: **identity → order → peers → channel → chaincode → verify**.

---

## 1. Does the chaincode currently store identity as an asset?

**No.** The chaincode does **not** store identity as an asset.

- The chaincode stores only **Asset** (in `asset.go`) and **ReportIssue** (in `report_issue.go`) on the ledger.
- There is no separate "Identity" asset type. User identity (X.509 certificates, enrollment) is handled by **Fabric CA** and the **API wallet** (off-chain).
- The chaincode only references users as **strings** on assets: `AssignTo` and `Username` on the `Asset` struct. Those are usernames, not identity objects stored as assets.

---

## 2. Are asset_id and transaction_id the same?

**No.** They are different:

| | **asset_id** | **transaction_id (tx_id)** |
|--|----------------|----------------------------|
| **Meaning** | Identifier of the **asset** (e.g. one device/item). | Identifier of **one ledger transaction** (one state change). |
| **Who sets it** | Your app/API (e.g. when creating the asset). | Fabric (each submitted transaction gets a unique TxID). |
| **Scope** | One value per asset; used as the **ledger key** for that asset. | One value **per transaction** (create, update, transfer, etc.). |

- **asset_id** = which asset we’re talking about (same for the whole life of that asset).
- **transaction_id** = which specific change event we’re talking about (different for each change).

So **one asset_id** can have **many transaction_ids** (one per event in the asset’s history). They are not the same and are not interchangeable.

---

## 3. How does the API connect to the blockchain?

The API (Java Spring Boot) connects to **Hyperledger Fabric** using the **Fabric Java Gateway SDK**. The flow is: **identity (wallet) → connection profile → Gateway → Network → Contract → chaincode**.

1. **Identity (wallet)**  
   Each user that can submit transactions must have an identity in the **wallet** (default path: `wallet/`). Identities are created by enrolling with **Fabric CA** and stored in the wallet. When connecting, the API loads the identity for a **username** from this wallet.

2. **Connection profile (`connection.yaml`)**  
   The API loads the Fabric network layout from a connection profile (e.g. `src/main/resources/connection.yaml` or path from `CONNECTION_PROFILE`). The profile defines **peers** (e.g. `peer0.org1.ownify.com` with gRPC URL and TLS CA path), **orderers**, and **channels** (e.g. `channel-org`).

3. **Building the Gateway**  
   In `GatewayHelperV1.connect(username)`, the API: loads the **wallet** and gets the identity for `username`; resolves the **network config** from the connection profile (with env overrides for crypto path and peer/orderer URLs); then calls **`Gateway.createBuilder().identity(wallet, username).networkConfig(networkConfigPath).discovery(...).connect()`**. The returned **Gateway** is the API’s connection to the Fabric network.

4. **Gateway cache**  
   To avoid opening a new Gateway on every request, the API caches one **Gateway per user** in `FabricGatewayCache`. Services call `gatewayCache.getOrCreate(username)` (or `runWithWriteLock` for writes); that uses `GatewayHelperV1.connect(username)` when a Gateway for that user does not exist yet.

5. **From Gateway to chaincode**  
   Services get the **channel** from env `FABRIC_CHANNEL` (default `channel-org`) and the **chaincode** name from `FABRIC_CHAINCODE` (default `basic`). They get `Network` = `gateway.getNetwork(channel)` and `Contract` = `network.getContract(chaincode)`, then call **`contract.evaluateTransaction(...)`** for reads and **`contract.submitTransaction(...)`** for writes.

**Key env vars:** `FABRIC_CRYPTO_PATH`, `FABRIC_PEER_URL`, `FABRIC_ORDERER_URL`, `FABRIC_CHANNEL`, `FABRIC_CHAINCODE`, `FABRIC_DISCOVERY`, `WALLET_PATH`, `CONNECTION_PROFILE`. When running on the host (not Docker), the API typically replaces profile hostnames with `127.0.0.1` and the crypto path with the local `ownership-network-master/channel` path.
