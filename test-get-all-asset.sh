#!/usr/bin/env bash
# Test GET /api/v1/user/getAllAsset: login then call the endpoint.
# Usage: ./test-get-all-asset.sh [username] [password]
# Default: admin / adminpw. Ensure API is running on 8081 and (for real data) blockchain is up.

set -e
API_URL="${API_URL:-http://localhost:8081}"
USER="${1:-admin}"
PASS="${2:-adminpw}"

echo "Login as $USER..."
LOGIN_RESP=$(curl -s -X POST "$API_URL/rest/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}")

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print((d.get('payload') or {}).get('token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "Login failed. Response: $LOGIN_RESP"
  exit 1
fi

echo "Token obtained. Calling GET /api/v1/user/getAllAsset ..."
echo ""
RESP=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/v1/user/getAllAsset" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "HTTP 200 OK"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('payload'); print(len(p) if isinstance(p,list) else 0)" 2>/dev/null)
  if [ -n "$COUNT" ] && [ "$COUNT" -ge 0 ]; then
    echo ""
    echo "--- Total assets: $COUNT ---"
  fi
else
  echo "HTTP $HTTP_CODE"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  exit 1
fi
