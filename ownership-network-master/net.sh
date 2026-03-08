#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
NET_NAME="test"

#ensure_network() {
#  docker network ls | grep -q " ${NET_NAME}$" || docker network create "${NET_NAME}"
#}
ensure_network() {
  if ! docker network inspect "$NET_NAME" >/dev/null 2>&1; then
    docker network create "$NET_NAME"
  fi
}

wait_for_ca_ready() {
  local name="$1"
  local ready_marker="$2"

  echo "⏳ Waiting for ${name} to become ready..."
  for _ in $(seq 1 60); do
    local logs
    logs="$(docker logs "$name" 2>&1 || true)"
    if [[ "$logs" == *"$ready_marker"* ]]; then
      echo "✅ ${name} is ready"
      return 0
    fi
    sleep 1
  done

  echo "❌ ${name} did not become ready in time"
  docker logs --tail=80 "$name" || true
  return 1
}

wait_for_container_running() {
  local name="$1"
  echo "⏳ Waiting for container ${name} to be running..."
  for _ in $(seq 1 60); do
    local state
    state="$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || true)"
    if [[ "$state" == "true" ]]; then
      echo "✅ ${name} is running"
      return 0
    fi
    sleep 1
  done
  echo "❌ ${name} is not running"
  docker ps -a --format "table {{.Names}}\t{{.Status}}" | sed -n '1,40p'
  return 1
}

wait_for_couchdb_ready() {
  local port="$1"
  echo "⏳ Waiting for CouchDB on port ${port}..."
  for _ in $(seq 1 60); do
    local code
    code="$(curl -s -u admin:password -o /dev/null -w '%{http_code}' "http://localhost:${port}/" || true)"
    if [[ "$code" == "200" ]]; then
      echo "✅ CouchDB:${port} is ready"
      return 0
    fi
    sleep 1
  done
  echo "❌ CouchDB:${port} not ready in time"
  return 1
}

status() {
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

#up_ca() {
#  ensure_network
#  docker compose -f "$ROOT_DIR/create-certificate-with-ca/docker-compose.yaml" up -d ca_orderer ca_org1
#}
up_ca() {
  echo "🛑 Cleaning old CA containers..."
  docker rm -f ca_orderer ca.org1.ownify.com 2>/dev/null || true

  echo "🚀 Starting Certificate Authorities..."
  docker compose -f "$ROOT_DIR/create-certificate-with-ca/docker-compose.yaml" up -d
}

gen_crypto() {
  ensure_network

  docker run --rm -t --network "$NET_NAME" \
    -v "$ROOT_DIR":/work -w /work/create-certificate-with-ca/orderer \
    hyperledger/fabric-ca:1.5 \
    bash -lc "chmod +x ./start-orderers-v3.sh && ./start-orderers-v3.sh"

  docker run --rm -t --network "$NET_NAME" \
    -v "$ROOT_DIR":/work -w /work/create-certificate-with-ca/org1 \
    hyperledger/fabric-ca:1.5 \
    bash -lc "chmod +x ./start-orgs.sh && ./start-orgs.sh"
}

up_fabric() {
  ensure_network
  # Start non-CA Fabric services only; CAs are started in up_ca.
  docker compose -f "$ROOT_DIR/docker-compose.yaml" up -d \
    couchdb0 couchdb1 couchdb2 \
    orderer.ownify.com orderer2.ownify.com orderer3.ownify.com

  wait_for_couchdb_ready 5984
  wait_for_couchdb_ready 5985
  wait_for_couchdb_ready 5986

  docker compose -f "$ROOT_DIR/docker-compose.yaml" up -d \
    peer0.org1.ownify.com peer1.org1.ownify.com cli
}

generate_channel_artifacts() {
  ensure_network

  # Generate channel artifacts with configtxgen before booting orderers.
  docker run --rm -t --network "$NET_NAME" \
    -v "$ROOT_DIR":/work -w /work/channel \
    hyperledger/fabric-tools:2.5 \
    bash -lc '
      set -e
      chmod +x *.sh
      ./1.create-genesis-block.sh
      ./2.create-channelTx.sh
      ./3.create-anchor-peer.sh
    '
}

channel_and_join() {
  ensure_network

  # Create channel, join peers, and update anchor peer using the cli container
  docker exec cli bash -lc '
    set -e
    export FABRIC_CFG_PATH=/etc/hyperledger/fabric/config
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/crypto-config/peerOrganizations/org1.ownify.com/users/Admin@org1.ownify.com/msp
    export CORE_PEER_ADDRESS=peer0.org1.ownify.com:7051
    export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/crypto-config/peerOrganizations/org1.ownify.com/peers/peer0.org1.ownify.com/tls/ca.crt
    export ORDERER_CA=/etc/hyperledger/fabric/crypto-config/ordererOrganizations/ownify.com/orderers/orderer.ownify.com/tls/ca.crt

    already_exists() {
      echo "$1" | grep -Eqi "already exists|exists with state \\[ACTIVE\\]"
    }

    join_peer_if_needed() {
      local peer_addr="$1"
      local tls_root="$2"
      local join_output
      local join_status

      export CORE_PEER_ADDRESS="$peer_addr"
      export CORE_PEER_TLS_ROOTCERT_FILE="$tls_root"

      set +e
      join_output="$(peer channel join -b /etc/hyperledger/fabric/channel-artifacts/channel-org.block 2>&1)"
      join_status=$?
      set -e

      if [ "$join_status" -eq 0 ]; then
        echo "$join_output"
      elif already_exists "$join_output"; then
        echo "Peer $peer_addr already joined channel-org; skipping."
      else
        echo "$join_output"
        exit "$join_status"
      fi
    }

    create_output=""
    set +e
    create_output="$(peer channel create -o orderer.ownify.com:7050 \
      -c channel-org \
      -f /etc/hyperledger/fabric/channel-artifacts/channel-org.tx \
      --outputBlock /etc/hyperledger/fabric/channel-artifacts/channel-org.block \
      --tls --cafile "$ORDERER_CA" 2>&1)"
    create_status=$?
    set -e

    if [ "$create_status" -eq 0 ]; then
      echo "$create_output"
    elif already_exists "$create_output" || echo "$create_output" | grep -Fq "error applying config update to existing channel"; then
      echo "Channel channel-org already exists; fetching latest block..."
      fetch_status=1
      for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
        set +e
        fetch_output="$(peer channel fetch 0 /etc/hyperledger/fabric/channel-artifacts/channel-org.block \
          -o orderer.ownify.com:7050 \
          -c channel-org \
          --tls --cafile "$ORDERER_CA" 2>&1)"
        fetch_status=$?
        set -e
        if [ "$fetch_status" -eq 0 ]; then
          echo "$fetch_output"
          break
        fi
        if echo "$fetch_output" | grep -Fq "SERVICE_UNAVAILABLE"; then
          echo "Orderer not ready (attempt $attempt/12); waiting 10s..."
          sleep 10
        else
          echo "$fetch_output"
          exit "$fetch_status"
        fi
      done
      if [ "$fetch_status" -ne 0 ]; then
        echo "$fetch_output"
        echo "Channel exists but orderer cannot serve channel-org after retries."
        echo "Try a clean rebuild: ./net.sh reset && ./net.sh up"
        exit "$fetch_status"
      fi
    else
      echo "$create_output"
      exit "$create_status"
    fi

    join_peer_if_needed "peer0.org1.ownify.com:7051" \
      "/etc/hyperledger/fabric/crypto-config/peerOrganizations/org1.ownify.com/peers/peer0.org1.ownify.com/tls/ca.crt"

    join_peer_if_needed "peer1.org1.ownify.com:8051" \
      "/etc/hyperledger/fabric/crypto-config/peerOrganizations/org1.ownify.com/peers/peer1.org1.ownify.com/tls/ca.crt"

    export CORE_PEER_ADDRESS=peer0.org1.ownify.com:7051
    export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/crypto-config/peerOrganizations/org1.ownify.com/peers/peer0.org1.ownify.com/tls/ca.crt

    set +e
    anchor_output="$(peer channel update -o orderer.ownify.com:7050 \
      --ordererTLSHostnameOverride orderer.ownify.com \
      -c channel-org \
      -f /etc/hyperledger/fabric/channel-artifacts/Org1MSPanchors.tx \
      --tls --cafile "$ORDERER_CA" 2>&1)"
    anchor_status=$?
    set -e

    if [ "$anchor_status" -eq 0 ]; then
      echo "$anchor_output"
    elif echo "$anchor_output" | grep -Fq "proposed update requires that key [Group]  /Channel/Application be at version 0"; then
      echo "Anchor peer update already applied; skipping."
    elif already_exists "$anchor_output"; then
      echo "Anchor peer update already exists; skipping."
    else
      echo "$anchor_output"
      exit "$anchor_status"
    fi
  '
}

deploy_cc() {
  ensure_network
  docker run --rm -t --network "$NET_NAME" \
    -v "$ROOT_DIR":/work -w /work \
    hyperledger/fabric-tools:2.5 \
    bash -lc '
      set -e
      cd /work/channel/src/go
      [ -f go.mod ] || go mod init chaincode
      go mod tidy
      cd /work/channel/deploy-chaincode
      chmod +x *.sh
      ./deploy-chaincode.sh
    '
}

# Redeploy chaincode with new version (e.g. after chaincode changes like UpdatedAt)
redeploy_cc() {
  ensure_network
  docker run --rm -t --network "$NET_NAME" \
    -v "$ROOT_DIR":/work -w /work \
    hyperledger/fabric-tools:2.5 \
    bash -lc '
      set -e
      cd /work/channel/src/go
      [ -f go.mod ] || go mod init chaincode
      go mod tidy
      cd /work/channel/deploy-chaincode
      chmod +x *.sh
      ./redeploy-chaincode.sh
    '
}

up_explorer() {
  ensure_network
  (cd "$ROOT_DIR/channel/explorer" && docker compose up -d)
  echo "Explorer: http://localhost:8080  (exploreradmin / exploreradminpw / first-network)"
}

down() {
  (cd "$ROOT_DIR/channel/explorer" && docker compose down || true)
  (cd "$ROOT_DIR/channel" && docker compose down || true)
  docker compose -f "$ROOT_DIR/create-certificate-with-ca/docker-compose.yaml" down || true
}

reset() {
  down
  docker compose -f "$ROOT_DIR/docker-compose.yaml" down -v || true
  rm -rf "$ROOT_DIR/create-certificate-with-ca/fabric-ca/org1/"*
  rm -rf "$ROOT_DIR/create-certificate-with-ca/fabric-ca/ordererOrg/"*
  (cd "$ROOT_DIR/channel/explorer" && docker compose down -v || true)
  rm -rf "$ROOT_DIR/channel/crypto-config"
  rm -rf "$ROOT_DIR/channel/channel-artifacts"/*
  echo "✅ Reset done."
}

wait_for_ca () {
  local name="$1"
  local url="$2"

  echo "⏳ Waiting for $name to be ready: $url"
  for i in $(seq 1 40); do
    if docker exec -i cli bash -lc "curl -k -s --connect-timeout 2 '$url' >/dev/null"; then
      echo "✅ $name is ready"
      return 0
    fi
    sleep 1
  done

  echo "❌ $name not ready after timeout"
  docker logs --tail=80 "$name" || true
  return 1
}


logs() {
  local what="${1:-}"
  case "$what" in
    explorer) (cd "$ROOT_DIR/channel/explorer" && docker compose logs -f explorer.mynetwork.com) ;;
    explorerdb) (cd "$ROOT_DIR/channel/explorer" && docker compose logs -f explorerdb.mynetwork.com) ;;
    ca) docker compose -f "$ROOT_DIR/create-certificate-with-ca/docker-compose.yaml" logs -f ;;
    *) status ;;
  esac
}

cmd="${1:-}"
case "$cmd" in
  up)
    up_ca
    wait_for_ca_ready "ca_orderer" "Listening on https://0.0.0.0:9054"
    wait_for_ca_ready "ca.org1.ownify.com" "Listening on https://0.0.0.0:7054"
    gen_crypto
    generate_channel_artifacts
    up_fabric
    wait_for_container_running "orderer.ownify.com"
    wait_for_container_running "peer0.org1.ownify.com"
    wait_for_container_running "peer1.org1.ownify.com"
    wait_for_container_running "cli"
    echo "⏳ Giving orderer time to be ready for channel operations..."
    sleep 30
    channel_and_join
    deploy_cc
    up_explorer
    ;;
  up-ca) up_ca ;;
  gen-crypto) gen_crypto ;;
  up-fabric) up_fabric ;;
  channel) channel_and_join ;;
  deploy-cc) deploy_cc ;;
  redeploy-cc) redeploy_cc ;;
  up-explorer) up_explorer ;;
  down) down ;;
  reset) reset ;;
  status) status ;;
  logs) shift; logs "${1:-}" ;;
  *)
    echo "Usage: $0 {up|up-ca|gen-crypto|up-fabric|channel|deploy-cc|redeploy-cc|up-explorer|down|reset|status|logs explorer|logs ca}"
    exit 1
    ;;
esac
