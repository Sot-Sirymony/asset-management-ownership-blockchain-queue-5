#!/usr/bin/env bash
# Fix "Failed to send transaction to the orderer" / Assign asset 503.
# 1) Start blockchain network if not running.
# 2) Restart API on 8081 with FABRIC_ORDERER_URL and FABRIC_CRYPTO_PATH so it can reach the orderer.
# Run from repo root: ./fix-blockchain.sh

set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETWORK_DIR="$ROOT_DIR/ownership-network-master"
API_DIR="$ROOT_DIR/ownership-api-master"
API_HEALTH_URL="http://localhost:8081/v3/api-docs"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔧 Fix blockchain connectivity (orderer + API)"
echo "=============================================="

# Docker required
if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Start Docker Desktop and run this script again.${NC}"
  exit 1
fi

# Step 1: Start blockchain network if needed
echo ""
echo "📦 Step 1: Blockchain network"
cd "$NETWORK_DIR"
if [ ! -f "net.sh" ]; then
  echo -e "${RED}❌ net.sh not found in $NETWORK_DIR${NC}"
  exit 1
fi
chmod +x net.sh

if docker ps 2>/dev/null | grep -q "orderer.ownify.com"; then
  echo -e "${GREEN}✅ Orderer already running${NC}"
  echo "Ensuring channel-org and chaincode are ready..."
  ./net.sh channel 2>/dev/null || true
  ./net.sh deploy-cc 2>/dev/null || true
else
  echo "Starting blockchain network (this may take a few minutes)..."
  ./net.sh up || {
    echo -e "${RED}❌ Failed to start blockchain network. Check: docker ps -a; ./net.sh logs${NC}"
    exit 1
  }
  echo -e "${GREEN}✅ Blockchain network started${NC}"
  sleep 5
fi

# Ensure channel-org exists and chaincode is committed (fixes orderer 503)
if docker ps 2>/dev/null | grep -q '^cli$'; then
  if ! docker exec cli peer channel getinfo -c channel-org >/dev/null 2>&1; then
    echo "Creating/joining channel-org..."
    ./net.sh channel || {
      echo -e "${YELLOW}⚠️  Channel setup had issues. If create asset still fails, try: cd ownership-network-master && ./net.sh reset && ./net.sh up${NC}"
    }
  fi
  if ! docker exec cli peer lifecycle chaincode querycommitted -C channel-org 2>/dev/null | grep -q "Name: basic,"; then
    echo "Deploying chaincode 'basic' on channel-org..."
    ./net.sh deploy-cc || {
      echo -e "${YELLOW}⚠️  Chaincode deploy had issues. If create asset still fails, try: cd ownership-network-master && ./net.sh deploy-cc${NC}"
    }
  fi
  sleep 2
else
  if docker ps 2>/dev/null | grep -q "orderer.ownify.com"; then
    echo -e "${YELLOW}⚠️  CLI container not running. Channel/chaincode may be missing. Run: cd ownership-network-master && ./net.sh up${NC}"
  fi
fi

# Step 2: Stop API so we can start it with Fabric env
echo ""
echo "🔌 Step 2: Restart API with FABRIC_ORDERER_URL"
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Stopping API on port 8081..."
  lsof -ti :8081 | xargs kill 2>/dev/null || true
  sleep 3
  echo -e "${GREEN}✅ API stopped${NC}"
else
  echo "No process on 8081."
fi

# Step 3: Start API with Fabric env (same as start-all-projects.sh)
cd "$API_DIR"
export FABRIC_CRYPTO_PATH="${FABRIC_CRYPTO_PATH:-$NETWORK_DIR/channel}"
export FABRIC_PEER_URL="${FABRIC_PEER_URL:-grpcs://localhost:7051}"
export FABRIC_ORDERER_URL="${FABRIC_ORDERER_URL:-grpcs://localhost:7050}"
export FABRIC_CHANNEL="${FABRIC_CHANNEL:-channel-org}"
export FABRIC_DISCOVERY="${FABRIC_DISCOVERY:-false}"
export WALLET_PATH="${WALLET_PATH:-$API_DIR/wallet}"
export SPRING_DATASOURCE_URL="${SPRING_DATASOURCE_URL:-jdbc:postgresql://localhost:55432/asset_holder_db}"
export SPRING_DATASOURCE_USERNAME="${SPRING_DATASOURCE_USERNAME:-postgres}"
export SPRING_DATASOURCE_PASSWORD="${SPRING_DATASOURCE_PASSWORD:-postgres}"
export OTEL_METRICS_EXPORTER=none

if [ -f "$NETWORK_DIR/channel/crypto-config/peerOrganizations/org1.ownify.com/users/Admin@org1.ownify.com/tls/ca.crt" ]; then
  export FABRIC_CA_PEM_FILE="$NETWORK_DIR/channel/crypto-config/peerOrganizations/org1.ownify.com/users/Admin@org1.ownify.com/tls/ca.crt"
fi

echo "Starting API with FABRIC_ORDERER_URL=$FABRIC_ORDERER_URL ..."
mvn spring-boot:run -q > api.log 2>&1 &
API_PID=$!

echo "Waiting for API to be ready..."
for i in $(seq 1 45); do
  if curl -s -o /dev/null -w "%{http_code}" "$API_HEALTH_URL" 2>/dev/null | grep -q "200"; then
    sleep 2
    if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
      echo -e "${GREEN}✅ API started (PID $API_PID)${NC}"
      echo ""
      echo "Assign asset should now work. Try: node scripts/test-assign-asset-to-user.js sirymony.sot"
      exit 0
    fi
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo -e "${RED}❌ API process exited. Check $API_DIR/api.log${NC}"
    tail -50 "$API_DIR/api.log"
    exit 1
  fi
  sleep 2
done

echo -e "${RED}❌ API did not become ready in time. Check $API_DIR/api.log${NC}"
tail -30 "$API_DIR/api.log"
exit 1
