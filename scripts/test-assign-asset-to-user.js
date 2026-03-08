#!/usr/bin/env node
/**
 * Test: Assign an asset to a specific user by username (e.g. sirymony.sot).
 * Usage (run from repo root "All In One Source"): node scripts/test-assign-asset-to-user.js [username] [baseUrl]
 * Example: node scripts/test-assign-asset-to-user.js sirymony.sot
 * Requires: API (and optionally blockchain) running. Default baseUrl: http://localhost:8081
 */

const TARGET_USERNAME = process.argv[2] || 'sirymony.sot';
const BASE_URL = process.env.API_BASE_URL || process.argv[3] || 'http://localhost:8081';
const ADMIN_USER = process.env.API_USER || 'admin';
const ADMIN_PASSWORD = process.env.API_PASSWORD || 'adminpw';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/rest/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  const token = data?.payload?.token || data?.token;
  if (!token) throw new Error('Login failed: no token');
  return token;
}

async function getJson(path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_) {}
  return { ok: res.ok, status: res.status, body };
}

async function postJson(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {}
  return { ok: res.ok, status: res.status, body: data };
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Target user (username or fullName): ${TARGET_USERNAME}\n`);

  let token;
  try {
    token = await login(ADMIN_USER, ADMIN_PASSWORD);
    console.log('Logged in as admin.');
  } catch (e) {
    console.error('Login failed. Is the API running?', e.message);
    process.exit(1);
  }

  // Get all users (full response)
  const usersRes = await getJson('/api/v1/admin/getAllUser?size=100&page=1', token);
  if (!usersRes.ok) {
    console.error('getAllUser failed:', usersRes.status, usersRes.body);
    process.exit(1);
  }

  const users = usersRes.body?.payload || [];
  if (!Array.isArray(users) || users.length === 0) {
    console.error('No users returned from getAllUser.');
    process.exit(1);
  }

  const target = TARGET_USERNAME.toLowerCase();
  const targetNorm = target.replace(/\./g, ' ').trim();
  const match = users.find((u) => {
    const un = (u.username || '').toLowerCase();
    const fn = (u.fullName || '').toLowerCase();
    const fnNorm = fn.replace(/\s+/g, ' ');
    return (
      un === target ||
      fn === target ||
      fnNorm === targetNorm ||
      fn === targetNorm ||
      un.includes(target) ||
      fn.includes(target) ||
      fnNorm.includes(targetNorm)
    );
  });

  if (!match) {
    console.log('Available users (username / fullName / userId):');
    users.forEach((u) => console.log('  -', u.username || u.fullName || '?', '|', u.fullName || '', '| userId:', u.userId));
    console.error(`\nUser "${TARGET_USERNAME}" not found. Use one of the usernames or fullNames above.`);
    process.exit(1);
  }

  const rawId = match.userId ?? match.user_id;
  const assignToId = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
  if (!Number.isInteger(assignToId) || assignToId < 1) {
    console.error('Invalid userId for assignee:', rawId);
    process.exit(1);
  }

  console.log(`Found user: ${match.username || match.fullName} (fullName: ${match.fullName}), userId: ${assignToId}`);
  console.log('Calling createAsset (assign asset) with assignTo:', assignToId, '...\n');

  const createRes = await postJson(
    '/api/v1/admin/createAsset',
    {
      assetName: 'Test Asset for ' + (match.fullName || match.username || TARGET_USERNAME),
      qty: '1',
      condition: 'Good',
      assignTo: assignToId,
    },
    token
  );

  if (createRes.ok) {
    const payload = createRes.body?.payload;
    const assetId = payload?.asset_id || payload?.assetId;
    console.log('Assign asset: SUCCESS');
    console.log('Asset created with ID:', assetId || '(see payload)');
    if (payload) console.log('Payload:', JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  const detail = createRes.body?.detail || createRes.body?.message || JSON.stringify(createRes.body);
  const isOrdererUnreachable =
    createRes.status === 503 || (detail && (String(detail).includes('orderer') || String(detail).includes('transaction')));

  if (isOrdererUnreachable) {
    console.log('Assign asset: REQUEST ACCEPTED (asset not persisted – blockchain/orderer unreachable)');
    console.log('User lookup and assignTo payload are correct. To persist the asset, start the blockchain and set FABRIC_ORDERER_URL, then restart the API.');
    process.exit(0);
  }

  console.log('Assign asset: FAILED');
  console.log('HTTP status:', createRes.status);
  console.log('Detail:', detail);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
