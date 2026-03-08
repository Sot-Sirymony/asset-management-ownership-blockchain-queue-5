#!/usr/bin/env bash
# Test transfer: "Monitor MSI 2020" from sirymony to dalen phea.
# Uses admin login. Run from repo root. API on 8081, blockchain must be up.
# Usage: ./test-transfer-asset.sh [asset_name_pattern] [new_owner_name]
# Default: asset "Monitor MSI 2020", new owner "dalen phea" (matched by fullName or username).

set -e
API_URL="${API_URL:-http://localhost:8081}"
ASSET_NAME_PATTERN="${1:-Monitor MSI 2020}"
NEW_OWNER_NAME="${2:-dalen phea}"

echo "Login as admin..."
LOGIN_RESP=$(curl -s -X POST "$API_URL/rest/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpw"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print((d.get('payload') or {}).get('token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "Login failed."
  exit 1
fi

echo "Get all assets..."
ASSETS_JSON=$(curl -s -X GET "$API_URL/api/v1/user/getAllAsset" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
export ASSET_NAME_PATTERN
ASSET_ID=$(echo "$ASSETS_JSON" | python3 -c "
import sys, json, os
pattern = os.environ.get('ASSET_NAME_PATTERN', '').strip()
try:
    d = json.load(sys.stdin)
    payload = d.get('payload') or []
    if not isinstance(payload, list):
        print('', end='')
        exit(0)
    for a in payload:
        name = (a.get('assetName') or '').strip()
        if pattern and pattern in name:
            print(a.get('assetId') or '')
            exit(0)
    print('', end='')
except Exception:
    print('', end='')
" 2>/dev/null)

if [ -z "$ASSET_ID" ]; then
  echo "Asset matching '$ASSET_NAME_PATTERN' not found in getAllAsset."
  echo "Available assets (first 5):"
  echo "$ASSETS_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
p = d.get('payload') or []
for a in (p[:5] if isinstance(p, list) else []):
    print('  -', a.get('assetName'), '| assetId:', a.get('assetId'), '| assignTo:', a.get('assignTo'))
" 2>/dev/null || true
  exit 1
fi
echo "Found asset: $ASSET_ID"

echo "Get all users (find new owner)..."
USERS_JSON=$(curl -s -X GET "$API_URL/api/v1/admin/getAllUser?size=100&page=0" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
export NEW_OWNER_NAME
NEW_OWNER_ID=$(echo "$USERS_JSON" | python3 -c "
import sys, json, os
name_lower = (os.environ.get('NEW_OWNER_NAME') or '').strip().lower()
try:
    d = json.load(sys.stdin)
    payload = d.get('payload')
    if isinstance(payload, dict) and 'content' in payload:
        users = payload.get('content') or []
    elif isinstance(payload, list):
        users = payload
    else:
        users = []
    for u in users:
        full = (u.get('fullName') or '').strip().lower()
        user = (u.get('username') or '').strip().lower()
        uid = u.get('userId') or u.get('user_id')
        if uid is None:
            continue
        if name_lower in full or name_lower in user or full in name_lower or user in name_lower:
            print(uid)
            exit(0)
    print('', end='')
except Exception as e:
    print('', end='')
" 2>/dev/null)

if [ -z "$NEW_OWNER_ID" ]; then
  echo "User matching '$NEW_OWNER_NAME' not found."
  echo "Sample users from getAllUser:"
  echo "$USERS_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
p = d.get('payload')
users = (p.get('content') if isinstance(p, dict) else p) or []
for u in users[:8]:
    print('  -', u.get('fullName'), '|', u.get('username'), '| userId:', u.get('userId'))
" 2>/dev/null || true
  exit 1
fi
echo "New owner userId: $NEW_OWNER_ID"

echo "Transfer asset $ASSET_ID to user $NEW_OWNER_ID..."
HTTP=$(curl -s -o /tmp/transfer_resp.json -w "%{http_code}" -X PUT "$API_URL/api/v1/admin/transferAsset/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"newAssignTo\": $NEW_OWNER_ID}")

if [ "$HTTP" = "200" ]; then
  PAYLOAD=$(python3 -c "import json; print(json.load(open('/tmp/transfer_resp.json')).get('payload'))" 2>/dev/null)
  if [ "$PAYLOAD" = "True" ] || [ "$PAYLOAD" = "true" ]; then
    echo "Transfer successful. Monitor MSI 2020 is now assigned to $NEW_OWNER_NAME (userId $NEW_OWNER_ID)."
  else
    echo "Response 200 but payload: $PAYLOAD"
  fi
else
  echo "HTTP $HTTP"
  cat /tmp/transfer_resp.json 2>/dev/null | python3 -m json.tool 2>/dev/null || cat /tmp/transfer_resp.json
  exit 1
fi
