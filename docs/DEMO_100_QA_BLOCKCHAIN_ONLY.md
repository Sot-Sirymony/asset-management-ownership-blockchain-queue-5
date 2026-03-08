# 100 More Q&A – Blockchain Only (Used in This Project)

**Use with:** DEMO_100_QA_BLOCKCHAIN.md. This document has 100 *additional* questions (Q101–Q200) focused **only on blockchain** concepts as used in this project. Topics from the first 100 are not repeated here.

---

## Part 1: Ledger and state (Q101–Q120)

**Q101. What are the two parts of the Fabric ledger?**  
The blockchain (append-only sequence of blocks, each containing transactions) and the world state (current key–value snapshot derived from applying all transactions). Our asset data lives in world state; the full history is in the chain and via GetHistoryForKey.

**Q102. How does the world state get updated when a block is committed?**  
Each peer replays the transactions in the block in order. For each transaction, the read set and write set (from endorsement) are applied: keys in the write set are updated in the state database (CouchDB in our project). So the world state is the result of all committed transactions.

**Q103. What is read set and write set in Fabric?**  
During endorsement, the chaincode runs and the peer records which keys were read (read set) and which keys and values were written (write set). At commit, the peer checks that the read set has not changed (to detect conflicts) and then applies the write set to the state.

**Q104. What is the key used to store an asset in our chaincode?**  
The asset ID (e.g. "asset-&lt;uuid&gt;"). We use PutState(ctx, assetID, asset). The key is unique per asset and is the primary way to read/update/delete that asset (GetState, PutState, DelState, GetHistoryForKey all use this key).

**Q105. Can two different assets have the same key on the ledger?**  
No. In Fabric world state, each key appears at most once. Our chaincode uses assetID as the key, so each asset must have a unique ID. CreateAsset checks AssetExists(assetID) and fails if the asset already exists.

**Q106. What happens to the blockchain when we call DelState(assetID)?**  
The key is removed from the world state (the asset no longer appears in QueryAsset or QueryAllAssets). The blockchain is not rewritten; the delete is recorded as a new transaction (with a tx_id). GetHistoryForKey still returns past values and a final “deleted” entry.

**Q107. What is the genesis block in our project?**  
Block 0 of the channel. It is created by configtxgen (from configtx.yaml) and contains the channel configuration (organizations, orderers, etc.). All orderers and peers load it to bootstrap channel-org. It is stored under channel-artifacts/genesis.block.

**Q108. Does the chaincode run inside the peer process?**  
No. Chaincode runs in a separate container (chaincode container). The peer communicates with it over gRPC. When we deploy “basic”, Fabric builds and starts a container that runs our Go code.

**Q109. What is the state database in our Fabric network?**  
CouchDB. Each peer has its own CouchDB instance (couchdb0 for peer0, couchdb1 for peer1). The world state is stored there as JSON documents, keyed by asset ID (and report issue keys if used).

**Q110. Why use CouchDB instead of LevelDB for this project?**  
CouchDB supports JSON and rich queries (e.g. by attribute). Our asset is a JSON-like struct; CouchDB fits that model. LevelDB is key–value only. We use GetStateByRange for “all assets”; with CouchDB we could also do indexed queries if we added indexes.

**Q111. What is the relationship between a block and a transaction?**  
A block is an ordered list of transactions plus metadata (block number, previous hash, etc.). One CreateAsset or TransferAsset invocation produces one transaction. Many transactions from different clients are batched into one block by the orderer.

**Q112. Who creates blocks in Fabric?**  
The orderer. It collects endorsed transactions, orders them (using Raft in our setup), and assembles them into blocks. It then delivers blocks to all peers on the channel. Peers do not create blocks; they only validate and commit them.

**Q113. What is finality in Fabric?**  
Once a transaction is committed in a block on a peer, it is final: the state change is applied and will not be reverted by Fabric. There is no “reorg” like in some public chains. So after commit, the asset create or transfer is permanently on the ledger.

**Q114. Can we change a past transaction or block?**  
No. The ledger is immutable. To “correct” something we submit a new transaction (e.g. UpdateAsset or TransferAsset). History (GetHistoryForKey) always shows the original and all later changes, each with its own tx_id.

**Q115. What is the “channel” in terms of data?**  
A channel is an independent ledger: its own sequence of blocks and its own world state. channel-org has its own genesis block and state. Data on one channel is not visible to peers that are not on that channel.

**Q116. How many organizations are in our Fabric network?**  
One application org: Org1 (Org1MSP). We also have an orderer org (ownify.com) for the orderers. So one org for peers (Org1) and one for orderers in this project.

**Q117. What is the system channel?**  
A special channel used only for ordering service membership (which orderers exist). Application channels (like channel-org) are separate. configtxgen can generate both the system genesis block and the application channel transaction.

**Q118. What is configtxgen?**  
A Fabric tool that reads configtx.yaml and generates channel artifacts: the genesis block for the orderer system channel, the channel creation transaction for channel-org, and the anchor peer update for Org1. We run it inside a fabric-tools container in net.sh.

**Q119. What is the anchor peer used for?**  
For cross-organization gossip: peers in one org discover peers in another org via the anchor peer. In our project we have only Org1, but we still run the anchor peer update (Org1MSPanchors.tx) so the channel config is complete; it is required for the channel.

**Q120. Where is the ledger physically stored for a peer?**  
The block data and the state are stored in the peer’s local storage (and in CouchDB for state). In our Docker setup, orderer and peer data are in Docker volumes (e.g. orderer.ownify.com-data). The actual block files and CouchDB data live there.

---

## Part 2: Transaction flow and endorsement (Q121–Q140)

**Q121. What is a transaction proposal in Fabric?**  
A request from the client (our API via the SDK) to a peer to run chaincode. The proposal includes the chaincode name, function name, and arguments. The peer runs the chaincode and returns a proposal response (read set, write set, and signature).

**Q122. Why does the peer sign the proposal response?**  
So the client and other peers can verify that a specific peer executed the chaincode and produced that result. The signature is part of the endorsement. The orderer and committing peers do not re-run the chaincode; they trust the endorsed result.

**Q123. What is simulation in Fabric?**  
Execution of the chaincode during endorsement. The peer “simulates” the transaction: it runs the chaincode and records reads and writes without yet committing. The result is the read set and write set used later at commit.

**Q124. Does the orderer execute chaincode?**  
No. The orderer only orders transactions (by consensus) and packages them into blocks. It does not run chaincode or see the world state. Execution happens only on peers (at endorsement and implicitly at commit when applying the write set).

**Q125. How many peers endorse a transaction in our project?**  
With the default endorsement policy for one org, typically one peer from Org1 is enough. Our API sends the proposal to the peer(s) in the connection profile; we have peer0 (and peer1). The SDK collects enough endorsements per the channel’s policy.

**Q126. What happens if two transactions modify the same asset at the same time?**  
Fabric uses multiversion concurrency control (MVCC). At commit, the peer checks that the read set has not changed since endorsement. If another transaction already updated the same key, the read set would differ and the transaction is marked invalid and not applied. One of the two would need to be resubmitted.

**Q127. What is the role of gRPC in Fabric?**  
Fabric uses gRPC for all communication: client-to-peer (proposals), client-to-orderer (broadcast), and orderer-to-peer (deliver blocks). Our connection profile uses grpcs (gRPC over TLS) for peer and orderer URLs.

**Q128. What port does the orderer use in our project?**  
Orderer 1: 7050, orderer 2: 8050, orderer 3: 9050 (host-mapped). The API uses FABRIC_ORDERER_URL (e.g. grpcs://127.0.0.1:7050) to send transactions to the orderer.

**Q129. What port does the peer use in our project?**  
peer0: 7051, peer1: 8051 (host-mapped). The API uses FABRIC_PEER_URL (e.g. grpcs://127.0.0.1:7051) for proposals and queries.

**Q130. What is the lifecycle of a transaction from the peer’s perspective?**  
Peer receives proposal → runs chaincode (simulation) → produces read set and write set → signs proposal response → sends back to client. Later, peer receives block from orderer → validates block and transactions → for each transaction, checks read set and applies write set → updates world state and appends block to the blockchain.

**Q131. Can a read-only invocation (e.g. QueryAsset) create a block?**  
No. evaluateTransaction (query) does not produce a transaction that is sent to the orderer. Only submitTransaction produces an endorsed transaction that is ordered and committed, so only writes create blocks.

**Q132. What is the chaincode definition in Fabric 2.x?**  
The metadata that describes the chaincode for a channel: name, version, sequence, endorsement policy, and package ID. It is approved by each org and then committed to the channel. Our “basic” chaincode is deployed this way (install → approve → commit).

**Q133. What is the sequence number in chaincode lifecycle?**  
A number that increases each time the chaincode definition is updated (e.g. when we upgrade the chaincode). It ensures all orgs agree on the same definition. redeploy-chaincode.sh bumps both version and sequence.

**Q134. What is the package ID of chaincode?**  
A hash of the chaincode package (the .tar we create with peer lifecycle chaincode package). When we install the package on a peer, the peer stores it under that package ID. Approve and commit reference the package ID so all peers use the same code.

**Q135. Why do we need to “approve” chaincode for each organization?**  
So each org explicitly agrees to run that chaincode version on the channel. In our project we have one org (Org1); we still approve once. With multiple orgs, each would approve with their own identity.

**Q136. What is the difference between Fabric 1.x and 2.x chaincode deployment?**  
In 1.x, chaincode was installed and instantiated (one step per channel). In 2.x, we use the new lifecycle: package, install on each peer, approve for the channel (per org), then commit. This allows multiple orgs to agree on the same definition and version.

**Q137. What is the stub in chaincode?**  
The stub (e.g. ctx.GetStub()) is the interface the chaincode uses to access the ledger: GetState, PutState, DelState, GetStateByRange, GetHistoryForKey, etc. It is provided by the Fabric runtime and is specific to the current transaction context.

**Q138. What is TransactionContextInterface in our Go chaincode?**  
The parameter passed to every chaincode function (ctx). It provides GetStub() to access the ledger and GetClientIdentity() for the caller’s identity. We use it to read/write state and to get tx_id and timestamp in GetAssetHistory.

**Q139. Does our chaincode use GetClientIdentity() to check the caller?**  
We do not use it in the asset functions. Authorization (who can create or transfer) is enforced in the API. The chaincode only validates input (e.g. asset exists, newAssignTo ≠ current AssignTo) and updates state.

**Q140. What is an endorsement policy in practice?**  
A rule like “require 1 signature from Org1” or “majority of orgs.” When the client submits a transaction, the SDK collects enough proposal responses to satisfy this policy before sending to the orderer. Our default is effectively “one peer from Org1.”

---

## Part 3: Chaincode logic in this project (Q141–Q165)

**Q141. What fields does the Asset struct have in our chaincode?**  
AssetID, AssetName, Quantity, Unit, Condition, Attachment, AssignTo, Username, CreatedAt, UpdatedAt, DepName. They are stored as JSON in the ledger (with snake_case keys like asset_id, assign_to, created_at for compatibility).

**Q142. Why do we have both AssignTo and Username in the Asset struct?**  
AssignTo is the user ID (owner). Username can hold the same or a display name. In our API we often set both from the same value. They allow the chaincode to store who the asset is assigned to and an optional label.

**Q143. Why set CreatedAt and UpdatedAt in chaincode?**  
So every create and update has a timestamp on the ledger. GetAssetHistory returns these (and the Fabric tx timestamp) so we have an audit trail: when the asset was created and when it was last updated or transferred.

**Q144. What does AssetExists do in our chaincode?**  
It calls GetState(ctx, assetID). If data is not nil, the asset exists. We use it in CreateAsset to reject duplicate asset IDs.

**Q145. What validation does CreateAsset perform?**  
It checks that the asset does not already exist (AssetExists). It does not validate assetName or assignTo format in chaincode; the API validates the payload before calling. Chaincode ensures uniqueness of the key (assetID).

**Q146. What validation does TransferAsset perform?**  
AssetID and newAssignTo must not be empty. The asset must exist (QueryAsset). The newAssignTo must be different from the current AssignTo (no self-transfer). All of this is in the Go chaincode.

**Q147. What does UpdateAsset do in our chaincode?**  
It loads the existing asset (QueryAsset), updates all mutable fields (AssetName, Quantity, Unit, Condition, Attachment, AssignTo, Username, DepName, UpdatedAt), then PutState to save. It does not change the key (assetID).

**Q148. Why does DeleteAsset only take assetID?**  
Because the key is the asset ID. DelState(assetID) removes that key from the world state. No need for a full asset object; the chaincode only needs to know which key to delete.

**Q149. What does GetHistoryForKey return for each entry?**  
For each historical change: the value (asset JSON or nil if deleted), the transaction ID (TxID), the timestamp, and whether it was a delete (IsDelete). Our chaincode maps this to AssetHistoryEntry (Asset, TxID, Timestamp).

**Q150. In what order does GetHistoryForKey return history?**  
Typically from most recent to oldest (newest first). Our code appends to a slice and returns it; the UI or API can reverse if they want chronological order (oldest first).

**Q151. What is AssetHistoryEntry in our chaincode?**  
A struct that embeds Asset and adds TxID and Timestamp. It represents one point in the asset’s history: the state after that transaction and the transaction ID and time for verification.

**Q152. Why does QueryAllAssets use GetStateByRange("", "~")?**  
Empty string is the first possible key and "~" is the last in lexicographic order. So we iterate over all keys in the world state. We then unmarshal each value as an Asset and skip invalid or empty records.

**Q153. Does our chaincode use composite keys?**  
No. We use a single key per asset (assetID). Composite keys (e.g. key by owner + assetID) would allow querying “all assets for user X” in chaincode; we do that filtering in the API after QueryAllAssets.

**Q154. Does our chaincode emit events?**  
We do not use SetEvent in the asset code shown. Fabric supports chaincode events; the client can listen for them. Our project relies on the API reading state and history instead.

**Q155. What is the namespace of the keys in our chaincode?**  
All asset keys are in the same namespace (the chaincode’s state). We do not use a key prefix like "asset_" because the asset ID already has the form "asset-&lt;uuid&gt;". So the full key is just the asset ID.

**Q156. Can the same chaincode be deployed on multiple channels?**  
Yes. “basic” could be deployed on channel-org and another channel. Each channel would have its own state; the same chaincode logic would run on different ledgers. In our project we use one channel.

**Q157. What happens if we call TransferAsset with the same owner as current?**  
The chaincode returns an error: “asset is already assigned to user &lt;id&gt;.” So we prevent a no-op transfer and force the client to only transfer to a different user.

**Q158. What happens if we call CreateAsset with an existing assetID?**  
AssetExists returns true, so CreateAsset returns an error: “asset &lt;id&gt; already exists.” The transaction is not committed.

**Q159. Who generates the asset ID: chaincode or API?**  
The API. AssetIdGenerator.generateAssetId() creates "asset-" + UUID. The chaincode only receives the assetID as an argument and uses it as the key. So ID generation is off-chain.

**Q160. Why store quantity (qty) as an int in chaincode?**  
So we can do numeric checks or updates in chaincode if needed (e.g. “transfer 2 of 5 units”). In our current logic we store it and return it; the API and UI display it. Using int avoids string parsing in chaincode.

**Q161. What is the purpose of defer resultsIterator.Close() in GetAssetHistory?**  
To release resources when the function returns. The iterator is opened with GetHistoryForKey; defer ensures it is closed even if we return early or panic, which is good practice in Go.

**Q162. What does UnmarshalAsset do in our chaincode?**  
It deserializes the byte array from GetState (or from history response) into an Asset struct. The ledger stores JSON (or gob); UnmarshalAsset converts it so we can work with fields in Go.

**Q163. What does PutState(ctx, assetID, asset) do under the hood?**  
It serializes the Asset to bytes (JSON or similar) and adds (assetID, value) to the write set for the current transaction. The actual write to CouchDB happens at commit when the peer applies the write set.

**Q164. Can chaincode call another chaincode in our project?**  
Fabric supports cross-chaincode invocation (invoke another chaincode’s function). We do not use it; our “basic” chaincode only uses GetState, PutState, DelState, GetHistoryForKey, GetStateByRange within the same chaincode.

**Q165. Why is the chaincode written in Go?**  
Fabric supports Go, Node, and Java chaincode. Go is well supported, fast, and easy to deploy in containers. Our project uses Go with the fabric-contract-api-go library, which provides the contract interface and TransactionContextInterface.

---

## Part 4: Consensus, orderer, and network (Q166–Q185)

**Q166. What is Raft leader in our orderer setup?**  
Among the 3 orderers, one is elected as the Raft leader. It receives transactions from clients, orders them, and replicates blocks to follower orderers. If the leader fails, Raft elects a new leader automatically.

**Q167. What is a Raft term?**  
A period during which one leader is active. When the leader fails or network partitions, a new election starts and the term number increases. Raft uses terms to ensure at most one leader per term.

**Q168. Why three orderers for Raft?**  
Raft can tolerate f failures with 2f+1 nodes. With 3 nodes we tolerate 1 failure. So one orderer can be down and the channel can still order transactions.

**Q169. Does the client (API) always send transactions to the same orderer?**  
Not necessarily. The connection profile lists multiple orderers. The SDK can try another if one is unreachable (e.g. 7050 then 8050). So we get resilience without changing config.

**Q170. What is the system channel used for in Fabric 2.x?**  
It defines the set of orderers and their consenters (e.g. Raft cluster). The genesis block we generate (genesis.block) is for the system channel. Application channels like channel-org are created later and use the same orderers.

**Q171. What is an application channel?**  
A channel used for application transactions (e.g. asset transfers). channel-org is an application channel. It has its own genesis (first block created by the channel create transaction) and its own ledger and state.

**Q172. How does a peer join a channel?**  
The admin fetches the genesis block (or the channel’s first block) and runs “peer channel join -b &lt;block&gt;”. The peer then receives blocks from the orderer for that channel and maintains the ledger. Our net.sh does this for peer0 and peer1.

**Q173. What is gossip in Fabric?**  
A protocol by which peers exchange ledger and state information with each other (e.g. missing blocks, state updates). It helps all peers eventually have the same ledger. Within one org we have multiple peers; gossip keeps them in sync.

**Q174. Why have two peers (peer0 and peer1) in Org1?**  
For redundancy and load distribution. Both hold the same ledger; if one fails, the other can serve read and endorse. The API can connect to either (we typically use peer0 in the connection profile).

**Q175. What is the role of the orderer org (ownify.com) in our project?**  
It runs the orderer nodes (orderer.ownify.com, orderer2, orderer3). The orderer org has its own CA (ca_orderer) and MSP. It does not have application peers; it only provides ordering service to the application channel.

**Q176. What is the channel creation transaction (channel-org.tx)?**  
A config transaction that defines the new channel: which orgs are members, their MSPs, and anchor peers. configtxgen generates it. The first orderer (or admin) uses it to create the channel; the output is the genesis block for that channel (channel-org.block).

**Q177. What is the difference between genesis.block and channel-org.block?**  
genesis.block is for the *system* channel (orderer bootstrap). channel-org.block is the *first block* of the application channel “channel-org”. When we “create channel,” we get channel-org.block; peers join using that block.

**Q178. How does the peer get new blocks after joining?**  
The peer connects to the orderer (and optionally other peers via gossip) and pulls blocks. As the orderer creates new blocks, it delivers them to all peers on the channel. Each peer appends blocks and updates its world state.

**Q179. What is the batch timeout in the orderer?**  
The orderer waits up to this time to fill a block. If not enough transactions arrive, it cuts a block anyway so transactions do not wait forever. This is configurable in the orderer config.

**Q180. Can we have more than one channel in this project?**  
Yes, technically. We would run another channel create and join peers to it. Our application (API and UI) is built for one channel (channel-org) and one chaincode (basic). Adding another channel would require API and chaincode changes to use it.

**Q181. What is the MSP ID for the orderer org in our project?**  
The orderer org is typically named something like “OrdererOrg” or “ownify” in configtx; its MSP ID is in the config. Our peer org is Org1MSP. The API only talks to peers (Org1); it does not need the orderer org’s MSP ID for normal invocations.

**Q182. What is CORE_PEER_LOCALMSPID?**  
The MSP ID of the peer’s organization. For our peers it is Org1MSP. The peer uses it to identify itself and to validate that transactions and channel config match its org.

**Q183. What is the TLS certificate used for in peer/orderer?**  
Server TLS: the peer/orderer presents a certificate so the client (API or CLI) can verify it is the right node and encrypt the connection. We use grpcs and tlsCACerts in the connection profile so the client trusts the server.

**Q184. What is the orderer’s bootstrap file?**  
ORDERER_GENERAL_BOOTSTRAPFILE points to the genesis block (e.g. /var/hyperledger/orderer/genesis.block). The orderer reads it at startup to know the system channel and its Raft configuration. All three orderers use the same genesis block.

**Q185. Why do we mount channel-artifacts and crypto-config into the CLI container?**  
So the CLI can read the channel creation transaction, genesis block, and crypto (MSP, TLS) to run peer channel create, peer channel join, and peer lifecycle chaincode commands. The CLI needs the same artifacts and identity as the rest of the network.

---

## Part 5: Identity, crypto, and Fabric CA (Q186–Q200)

**Q186. What does “enroll” mean in Fabric CA?**  
Enrollment is the process of obtaining a certificate and private key from the CA. The client sends a request with credentials (e.g. admin:adminpw); the CA issues an X.509 cert and key. We store them in the wallet (or in crypto-config for network nodes).

**Q187. What does “register” mean in Fabric CA?**  
Before a user can enroll, they must be registered with the CA. An admin (with an enrolled identity) calls fabric-ca-client register to add a new identity (e.g. user1, orderer) with attributes. That identity can then enroll to get its cert and key.

**Q188. What is the crypto-config directory structure in our project?**  
Under channel/crypto-config we have ordererOrganizations/ownify.com (orderer MSPs and TLS) and peerOrganizations/org1.ownify.com (peer and user MSPs and TLS). Each node has msp/ (identity) and tls/ (TLS certs). The API uses these paths in the connection profile.

**Q189. What is an X.509 certificate in Fabric?**  
The standard format for identities. The CA signs the certificate; it contains the public key and identity name. The peer and orderer use it to authenticate. The corresponding private key is used to sign transactions (e.g. by the API when using the wallet identity).

**Q190. What is the difference between MSP and TLS certs?**  
MSP certs are for identity (who you are in the network; used for signing and verification in transactions). TLS certs are for transport security (encryption and server authentication for gRPC). A node has both: msp/signcerts and tls/signcerts.

**Q191. Why does the API need the wallet when submitting a transaction?**  
The SDK must sign the transaction proposal with the identity that will be used for endorsement. The wallet holds that identity’s certificate and private key. Without it, the peer would reject the proposal (invalid or missing signature).

**Q192. What is the “admin” identity in our project?**  
An identity enrolled from the org CA (e.g. org1admin or Admin@org1.ownify.com). We use it in the CLI for channel and chaincode operations, and typically in the API wallet so that create/update/transfer are signed as the org admin.

**Q193. Can the same certificate be used for multiple channels?**  
Yes. The certificate identifies the org and user; it is not channel-specific. The same admin cert in the wallet can sign transactions on any channel the org is a member of. Our API uses one identity (e.g. admin) for channel-org.

**Q194. What is the purpose of hostnameOverride in connection.yaml?**  
When we connect to 127.0.0.1, the TLS server (peer/orderer) presents a cert for its real hostname (e.g. peer0.org1.ownify.com). The client would reject it. hostnameOverride (with ssl-target-name-override) tells the client to use that hostname for TLS verification so the cert matches.

**Q195. What is the Fabric CA server port in our project?**  
ca.org1.ownify.com: 7054. ca_orderer: 9054. They are mapped to the host so we can run fabric-ca-client from the host or from containers that need to enroll (e.g. during net.sh gen_crypto).

**Q196. What is the “apiregistrar” identity used for?**  
In our scripts we may register an identity called apiregistrar so the API can enroll and get its own cert/key for the wallet. That way the API does not reuse the org admin cert; it has a dedicated identity for backend operations. (Exact use depends on your enrollment scripts.)

**Q197. Why is the private key never sent over the network?**  
The private key stays on the client (API or peer). Signing is done locally. Only the signature and the certificate (public key) are sent. So even if someone intercepts the traffic, they cannot forge transactions without the private key.

**Q198. What is the Certificate Revocation List (CRL) in Fabric?**  
A list of revoked certificates. If a key is compromised, the CA can revoke the cert; peers and orderers can check the CRL and reject transactions from revoked identities. Our project may not configure CRL for dev; in production it is recommended.

**Q199. What is Node OU (Organization Unit) in Fabric MSP?**  
A way to encode roles (e.g. admin, peer, orderer) in the certificate’s OU field. The MSP can then restrict which OUs can perform certain actions. Our CA scripts “enable Node OUs” so that certs have the right OU for Fabric to recognize the node type.

**Q200. In this project, where is the blockchain data actually stored on disk?**  
For peers: the ledger (block files) and the state (CouchDB data) are in Docker volumes (e.g. peer0.org1.ownify.com’s volume and couchdb0’s volume). For orderers: the ledger is in orderer.ownify.com-data (and similarly for orderer2/3). The crypto is in channel/crypto-config (and in the wallet under ownership-api-master/wallet). So “blockchain” = those volumes and CouchDB; “identity” = crypto-config and wallet.

---

*This document (Q101–Q200) is for blockchain-only depth. Use it together with DEMO_100_QA_BLOCKCHAIN.md (Q1–Q100) for full demo preparation.*
