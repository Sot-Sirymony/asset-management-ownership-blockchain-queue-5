#!/usr/bin/env bash
# Restart the API so it picks up FABRIC_ORDERER_URL and can reach the orderer.
# Run from repo root when you see: "Blockchain orderer unreachable" or "Failed to send transaction to the orderer".

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
NETWORK_DIR="$ROOT_DIR/ownership-network-master"
API_DIR="$ROOT_DIR/ownership-api-master"
API_HEALTH_URL="http://localhost:8081/v3/api-docs"
FABRIC_LOCAL_CA_CERT="$NETWORK_DIR/channel/crypto-config/peerOrganizations/org1.ownify.com/users/Admin@org1.ownify.com/tls/ca.crt"

echo "Stopping API on port 8081..."
if lsof -ti :8081 >/dev/null 2>&1; then
    lsof -ti :8081 | xargs kill 2>/dev/null || true
    sleep 2
    echo "API stopped."
else
    echo "No process on 8081."
fi

# Use 127.0.0.1 (not localhost) so IPv4 is used and TLS works reliably on Mac.
# API will try orderers 7050 → 8050 → 9050 if one returns 503.
export FABRIC_ORDERER_URL="${FABRIC_ORDERER_URL:-grpcs://127.0.0.1:7050}"
export FABRIC_PEER_URL="${FABRIC_PEER_URL:-grpcs://127.0.0.1:7051}"
# Absolute path so API finds crypto no matter where it runs from
CHANNEL_DIR="$NETWORK_DIR/channel"
export FABRIC_CRYPTO_PATH="$(cd "$ROOT_DIR" && cd "$CHANNEL_DIR" && pwd)"
export FABRIC_CHANNEL="${FABRIC_CHANNEL:-channel-org}"
export FABRIC_DISCOVERY="${FABRIC_DISCOVERY:-false}"
export COUCHDB_BASE_URL="${COUCHDB_BASE_URL:-http://localhost:5984}"
export WALLET_PATH="${WALLET_PATH:-$API_DIR/wallet}"
export SPRING_DATASOURCE_URL="${SPRING_DATASOURCE_URL:-jdbc:postgresql://localhost:55432/asset_holder_db}"
export SPRING_DATASOURCE_USERNAME="${SPRING_DATASOURCE_USERNAME:-postgres}"
export SPRING_DATASOURCE_PASSWORD="${SPRING_DATASOURCE_PASSWORD:-postgres}"
[ -f "$FABRIC_LOCAL_CA_CERT" ] && export FABRIC_CA_PEM_FILE="$FABRIC_LOCAL_CA_CERT"
export OTEL_METRICS_EXPORTER=none

echo "Starting API with FABRIC_ORDERER_URL=$FABRIC_ORDERER_URL (127.0.0.1 for IPv4)..."
cd "$API_DIR"
mvn spring-boot:run > api.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"

echo "Waiting for API to start..."
for i in {1..30}; do
    if curl -s "$API_HEALTH_URL" >/dev/null 2>&1; then
        sleep 2
        if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "API started successfully. Assign asset again."
            exit 0
        fi
    fi
    if ! kill -0 "$API_PID" >/dev/null 2>&1; then
        echo "API process exited. Check ownership-api-master/api.log"
        exit 1
    fi
    sleep 2
    [ $i -eq 30 ] && echo "API did not become ready in time. Check api.log" && exit 1
done
