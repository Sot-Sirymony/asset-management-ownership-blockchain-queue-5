# Orderer 503 / "Blockchain orderer unreachable"

## What’s going on

The API **can** reach the orderer (e.g. `grpcs://localhost:7050`), but the orderer responds with **503 SERVICE_UNAVAILABLE**. So the problem is on the orderer side, not “host unreachable”.

## What we changed

1. **Multiple orderers in the connection profile**  
   The API now has three orderers (ports 7050, 8050, 9050). If the first returns 503, the SDK will try the next.

2. **Restart script**  
   `./restart-api-for-blockchain.sh` sets `FABRIC_ORDERER_URL=grpcs://localhost:7050` and starts the API so it uses the right Fabric env.

## What you should do

### 1. Restart the API with Fabric env

From repo root:

```bash
./restart-api-for-blockchain.sh
```

Then try **Assign asset** again. With the new profile, the API will try 7050, then 8050, then 9050.

### 2. If 503 continues: check network and channel

Ensure the network is up and the channel is joined:

```bash
cd ownership-network-master
./net.sh status
docker exec cli peer channel getinfo -c channel-org
```

If the channel is not found or the orderers are not running, bring the network up and (re)create the channel:

```bash
./net.sh up
# if channel is missing:
./net.sh channel
./net.sh deploy-cc
```

### 3. Use /etc/hosts (TLS cert match)

If 127.0.0.1 still fails, make Fabric hostnames resolve to 127.0.0.1 so TLS certs match:

```bash
./setup-hosts-for-blockchain.sh
# Then run the one-liner it prints (sudo), then:
export FABRIC_USE_HOSTS=true
./restart-api-for-blockchain.sh
```

### 4. Try a specific orderer

To force the **first** orderer to be orderer2 (8050):

```bash
export FABRIC_ORDERER_URL=grpcs://127.0.0.1:8050
./restart-api-for-blockchain.sh
```

(Or `grpcs://127.0.0.1:9050` for orderer3.)

### 5. Check orderer logs

```bash
cd ownership-network-master
docker compose logs orderer.ownify.com --tail 100
docker compose logs orderer2.ownify.com --tail 100
```

Look for errors about the channel, Raft, or TLS.

## Summary

| Symptom | Meaning | Action |
|--------|--------|--------|
| "Blockchain orderer unreachable" | API got 503 from orderer | Restart API with `./restart-api-for-blockchain.sh`; API will try 7050 → 8050 → 9050 |
| 503 persists | Orderer is up but refusing the request | Check channel join, orderer logs; try `FABRIC_ORDERER_URL=grpcs://127.0.0.1:8050` or use `/etc/hosts` + `FABRIC_USE_HOSTS=true` |
