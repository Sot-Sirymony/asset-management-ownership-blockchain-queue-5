# Redeploy Chaincode

Use this after changing the chaincode (e.g. adding `UpdatedAt` for History assign/reassign dates). The network and channel must already be up.

## Option 1: One command (recommended)

From the **ownership-network-master** directory:

```bash
cd ownership-network-master
./net.sh redeploy-cc
```

This runs `redeploy-chaincode.sh` (version 2, sequence 2) in a Fabric tools container: package → install → approve → commit → init.

**Time:** About 1–2 minutes.

---

## Option 2: First-time deploy (version 1)

If the chaincode has never been deployed on this network:

```bash
cd ownership-network-master
./net.sh deploy-cc
```

---

## Option 3: Full network restart (includes deploy)

To bring down the network and bring it back up with chaincode deploy:

```bash
cd ownership-network-master
./net.sh down
./net.sh up
```

`up` runs channel creation, join, and `deploy-cc` (version 1). For the **updated** chaincode (e.g. with `UpdatedAt`), use **Option 1** after the network is already up.

---

## After redeploy

1. **Restart the API** so it uses the new chaincode (e.g. `./restart-api-for-blockchain.sh` from repo root).
2. New **transfers** will get a distinct `updated_at`; History will show different Assigned Date vs Reassign Date for those events.

---

## Summary

| Goal                    | Command              |
|-------------------------|----------------------|
| Redeploy new chaincode  | `./net.sh redeploy-cc` |
| First deploy            | `./net.sh deploy-cc`   |
| Full network + deploy   | `./net.sh up`          |
