#!/usr/bin/env bash
# Add Fabric hostnames to /etc/hosts so the API can connect to orderer/peer using
# TLS (cert names match). Run once, then use FABRIC_USE_HOSTS=true when starting the API.
# Requires sudo to edit /etc/hosts.

set -e
HOSTS_LINE="127.0.0.1 orderer.ownify.com orderer2.ownify.com orderer3.ownify.com peer0.org1.ownify.com"

if grep -q "orderer.ownify.com" /etc/hosts 2>/dev/null; then
    echo "Fabric hostnames already in /etc/hosts."
    grep "orderer.ownify.com" /etc/hosts
    echo ""
    echo "To use them: export FABRIC_USE_HOSTS=true then ./restart-api-for-blockchain.sh"
    exit 0
fi

echo "Add this line to /etc/hosts (run with sudo):"
echo ""
echo "  $HOSTS_LINE"
echo ""
echo "One-liner (paste and run):"
echo "  echo '$HOSTS_LINE' | sudo tee -a /etc/hosts"
echo ""
echo "Then: export FABRIC_USE_HOSTS=true && ./restart-api-for-blockchain.sh"
