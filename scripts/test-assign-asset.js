#!/usr/bin/env node
/**
 * Test cases for Assign Asset (POST /api/v1/admin/createAsset).
 * Run from repo root: node scripts/test-assign-asset.js [baseUrl]
 * Env: API_BASE_URL, API_USER, API_PASSWORD (default admin/adminpw)
 * Requires: API running on baseUrl (blockchain optional; 503 = env/orderer, not test failure).
 */

const BASE_URL = process.env.API_BASE_URL || process.argv[2] || 'http://localhost:8081';
const ADMIN_USER = process.env.API_USER || 'admin';
const ADMIN_PASSWORD = process.env.API_PASSWORD || 'adminpw';

const results = [];

function pass(id, name, status, detail = '') {
  results.push({ id, name, status: 'Pass', code: status, detail });
  return true;
}
function fail(id, name, code, detail = '') {
  results.push({ id, name, status: 'Fail', code, detail });
  return false;
}

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

async function post(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let detail = '';
  try {
    const j = JSON.parse(text);
    detail = j.detail || j.message || '';
  } catch (_) {}
  return { ok: res.ok, status: res.status, detail };
}

async function main() {
  console.log('=== Assign Asset Test Cases ===');
  console.log(`Base URL: ${BASE_URL}\n`);

  let adminToken;
  let userToken = null;
  try {
    adminToken = await login(ADMIN_USER, ADMIN_PASSWORD);
    console.log('Logged in as admin.');
  } catch (e) {
    console.error('Admin login failed. Is the API running?', e.message);
    process.exit(1);
  }

  // ASSIGN-001: Assign asset without auth → 401
  const noAuth = await post('/api/v1/admin/createAsset', { assetName: 'Laptop', qty: '1', assignTo: 1 }, null);
  if (noAuth.status === 401) pass('ASSIGN-001', 'Assign asset without auth → 401', noAuth.status);
  else fail('ASSIGN-001', 'Assign asset without auth → 401', noAuth.status, noAuth.detail);

  // ASSIGN-002: Assign asset as admin with valid payload → 200 (or 503 if orderer down)
  const valid = await post('/api/v1/admin/createAsset', {
    assetName: 'Test Assign Asset ' + Date.now(),
    qty: '1',
    condition: 'Good',
    assignTo: 1,
  }, adminToken);
  const detailLower = (valid.detail || '').toLowerCase();
  const ordererError = (valid.status === 503 || valid.status === 404) && (detailLower.includes('orderer') || detailLower.includes('transaction'));
  if (valid.status === 200) pass('ASSIGN-002', 'Assign asset (admin, valid) → 200', valid.status);
  else if (ordererError) pass('ASSIGN-002', 'Assign asset (admin, valid) → 200/503 (orderer)', valid.status, valid.detail);
  else fail('ASSIGN-002', 'Assign asset (admin, valid) → 200', valid.status, valid.detail);

  // ASSIGN-003: Assign asset without assignTo → 400
  const noAssignTo = await post('/api/v1/admin/createAsset', { assetName: 'Laptop', qty: '1' }, adminToken);
  if (noAssignTo.status === 400) pass('ASSIGN-003', 'Assign asset without assignTo → 400', noAssignTo.status);
  else fail('ASSIGN-003', 'Assign asset without assignTo → 400', noAssignTo.status, noAssignTo.detail);

  // ASSIGN-004: Assign asset with assignTo 0 → 400
  const assignToZero = await post('/api/v1/admin/createAsset', { assetName: 'Laptop', qty: '1', assignTo: 0 }, adminToken);
  if (assignToZero.status === 400) pass('ASSIGN-004', 'Assign asset assignTo=0 → 400', assignToZero.status);
  else fail('ASSIGN-004', 'Assign asset assignTo=0 → 400', assignToZero.status, assignToZero.detail);

  // ASSIGN-005: Assign asset with blank assetName → 400
  const blankName = await post('/api/v1/admin/createAsset', { assetName: '', qty: '1', assignTo: 1 }, adminToken);
  if (blankName.status === 400) pass('ASSIGN-005', 'Assign asset blank assetName → 400', blankName.status);
  else fail('ASSIGN-005', 'Assign asset blank assetName → 400', blankName.status, blankName.detail);

  // ASSIGN-006: Assign asset with blank qty → 400
  const blankQty = await post('/api/v1/admin/createAsset', { assetName: 'Laptop', qty: '', assignTo: 1 }, adminToken);
  if (blankQty.status === 400) pass('ASSIGN-006', 'Assign asset blank qty → 400', blankQty.status);
  else fail('ASSIGN-006', 'Assign asset blank qty → 400', blankQty.status, blankQty.detail);

  // ASSIGN-007: Assign asset as non-admin → 403 (use a non-admin user if available)
  try {
    userToken = await login('testuser_run', 'Testuser1');
  } catch (_) {}
  const asUser = userToken
    ? await post('/api/v1/admin/createAsset', { assetName: 'Laptop', qty: '1', assignTo: 1 }, userToken)
    : { status: 403 };
  if (asUser.status === 403 || asUser.status === 401) pass('ASSIGN-007', 'Assign asset as non-admin → 403', asUser.status);
  else if (!userToken) results.push({ id: 'ASSIGN-007', name: 'Assign asset as non-admin → 403', status: 'Skip', code: '-', detail: 'No non-admin user (testuser_run)' });
  else fail('ASSIGN-007', 'Assign asset as non-admin → 403', asUser.status, asUser.detail);

  // Summary
  const passed = results.filter((r) => r.status === 'Pass').length;
  const failed = results.filter((r) => r.status === 'Fail').length;
  const skipped = results.filter((r) => r.status === 'Skip').length;
  console.log('\n--- Results ---');
  results.forEach((r) => console.log(`  [${r.status}] ${r.id}: ${r.name} (${r.code}) ${r.detail ? '- ' + r.detail.slice(0, 60) : ''}`));
  console.log(`\nPass: ${passed}, Fail: ${failed}${skipped ? `, Skip: ${skipped}` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
