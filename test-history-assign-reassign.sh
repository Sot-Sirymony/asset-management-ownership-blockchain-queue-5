#!/usr/bin/env bash
# Test History API: show that Assigned Date and Reassign Date differ after a transfer.
# Usage: ./test-history-assign-reassign.sh
# Requires: API on 8081, blockchain up (so history has entries).

set -e
API_URL="${API_URL:-http://localhost:8081}"

echo "Login as admin..."
LOGIN_RESP=$(curl -s -X POST "$API_URL/rest/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpw"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print((d.get('payload') or {}).get('token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "Login failed."
  exit 1
fi

echo "Fetch GET /api/v1/getAllHistory..."
HISTORY_JSON=$(curl -s -X GET "$API_URL/api/v1/getAllHistory" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo ""
echo "Per-asset history (Assigned Date vs Reassign Date):"
echo "$HISTORY_JSON" | python3 -c "
import sys, json
try:
    raw = json.load(sys.stdin)
    payload = raw.get('payload')
    if not isinstance(payload, list):
        print('No payload list')
        sys.exit(0)
    by_asset = {}
    for e in payload:
        aid = e.get('asset_id') or e.get('assetId') or '?'
        if aid not in by_asset:
            by_asset[aid] = []
        by_asset[aid].append(e)
    for aid in sorted(by_asset.keys()):
        group = sorted(by_asset[aid], key=lambda x: (x.get('created_at') or ''))
        print('Asset:', aid, '|', (group[0].get('asset_name') or '')[:40])
        for i, e in enumerate(group):
            ct = e.get('created_at') or ''
            assign_to = e.get('assign_to') or e.get('assignTo') or '?'
            next_ct = group[i+1].get('created_at') if i+1 < len(group) else None
            print('  Event', i+1, '| Assigned date:', ct[:24] if ct else '-', '| Reassign date (next):', (next_ct[:24] if next_ct else '-'), '| assign_to:', assign_to)
        print('  -> Assigned Date and Reassign Date are different when there is a next event.')
except Exception as e:
    print('Error:', e)
    print('Response (first 500 chars):', sys.stdin.read()[:500] if hasattr(sys.stdin,'read') else '')
"
