#!/usr/bin/env bash
# Clean reset of the blockchain network then full bring-up.
# Use when you see: "Channel exists but orderer cannot serve channel-org" or
# after regenerating crypto (orderer/peers have stale state).
# Run from repo root: ./reset-blockchain-and-up.sh

set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETWORK_DIR="$ROOT_DIR/ownership-network-master"

echo "🔄 Reset blockchain and bring up (clean state)"
echo "==============================================="

if [ ! -f "$NETWORK_DIR/net.sh" ]; then
  echo "❌ $NETWORK_DIR/net.sh not found."
  exit 1
fi

cd "$NETWORK_DIR"
chmod +x net.sh

echo "Stopping and wiping network (volumes + crypto + channel-artifacts)..."
./net.sh reset

echo ""
echo "Bringing up CA, crypto, orderers, peers, channel, chaincode..."
./net.sh up

echo ""
echo "✅ Done. Restart the API with Fabric env so it can reach the orderer:"
echo "   From repo root: ./fix-blockchain.sh"
echo ""
echo "Then test assign asset (from repo root):"
echo "   node scripts/test-assign-asset-to-user.js sirymony.sot"
