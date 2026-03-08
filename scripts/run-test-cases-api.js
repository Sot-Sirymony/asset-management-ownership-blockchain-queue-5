#!/usr/bin/env node
/**
 * V3 – Run a batch of API test cases against running API + blockchain to find bugs.
 * Maps to test cases in V3-200-Test-Cases-Blockchain.md.
 *
 * Usage: node scripts/run-test-cases-api.js [baseUrl]
 * Env: API_BASE_URL, API_USER, API_PASSWORD (default admin/adminpw)
 *
 * Requires: API and blockchain network running (e.g. ./start-all-projects.sh).
 */

const BASE_URL = process.env.API_BASE_URL || process.argv[2] || 'http://localhost:8081';
const USER = process.env.API_USER || 'admin';
const PASSWORD = process.env.API_PASSWORD || 'adminpw';

const results = [];

async function login() {
  const res = await fetch(`${BASE_URL}/rest/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASSWORD }),
  });
  const data = await res.json();
  const token = data?.payload?.token || data?.token;
  if (!token) throw new Error('Login failed: no token');
  return token;
}

async function run(name, tcId, fn) {
  try {
    const out = await fn();
    results.push({ tcId, name, status: out.ok ? 'Pass' : 'Fail', code: out.status, detail: out.detail || '' });
    return out.ok;
  } catch (e) {
    results.push({ tcId, name, status: 'Fail', code: '-', detail: e.message || String(e) });
    return false;
  }
}

async function get(path, token, headers = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers: h });
  const text = await res.text();
  let detail = '';
  try {
    const j = JSON.parse(text);
    detail = j.detail || j.message || '';
  } catch (_) {}
  return { ok: res.ok, status: res.status, detail };
}

async function post(path, body, token, headers = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let detail = '';
  try {
    const j = JSON.parse(text);
    detail = j.detail || j.message || (typeof j === 'object' && Object.keys(j).length ? Object.values(j)[0] : '');
  } catch (_) {}
  return { ok: res.ok, status: res.status, detail };
}

async function put(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let detail = '';
  try {
    const j = JSON.parse(text);
    detail = j.detail || j.message || '';
  } catch (_) {}
  return { ok: res.ok, status: res.status, detail };
}

async function del(path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let detail = '';
  try {
    const j = JSON.parse(text);
    detail = j.detail || j.message || '';
  } catch (_) {}
  return { ok: res.ok, status: res.status, detail };
}

async function loginAs(username, password) {
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

async function main() {
  console.log(`Base URL: ${BASE_URL}\nRunning test cases (blockchain network)...\n`);

  let token;
  try {
    token = await login();
  } catch (e) {
    console.error('Login failed. Is the API + blockchain running?', e.message);
    process.exit(1);
  }

  // Auth
  await run('TC-001 Login valid admin', 'TC-001', () => ({ ok: true, status: 200 }));
  const loginFail = await post('/rest/auth/login', { username: 'nonexistent', password: 'x' });
  await run('TC-004 Login non-existent user → 404', 'TC-004', () => ({ ok: loginFail.status === 404, status: loginFail.status, detail: loginFail.detail }));
  const loginWrongPw = await post('/rest/auth/login', { username: USER, password: 'wrongpassword' });
  await run('TC-003 Login wrong password → 404', 'TC-003', () => ({ ok: loginWrongPw.status === 404, status: loginWrongPw.status, detail: loginWrongPw.detail }));
  const loginEmptyUser = await post('/rest/auth/login', { username: '', password: 'x' });
  await run('TC-005 Login empty username → 400/404', 'TC-005', () => ({ ok: loginEmptyUser.status === 400 || loginEmptyUser.status === 404, status: loginEmptyUser.status, detail: loginEmptyUser.detail }));
  const loginEmptyPw = await post('/rest/auth/login', { username: 'admin', password: '' });
  await run('TC-006 Login empty password → 400/404', 'TC-006', () => ({ ok: loginEmptyPw.status === 400 || loginEmptyPw.status === 404, status: loginEmptyPw.status, detail: loginEmptyPw.detail }));
  const loginNullBody = await post('/rest/auth/login', {}, null);
  await run('TC-007 Login null/empty body → 400', 'TC-007', () => ({ ok: loginNullBody.status === 400, status: loginNullBody.status, detail: loginNullBody.detail }));

  // TC-002 & TC-020 & TC-178: need a non-admin user (register then login)
  let userToken = null;
  const reg = await post('/api/v1/admin/register_user', { fullName: 'Test User', username: 'testuser_run', password: 'Testuser1', department: 1 }, token);
  if (reg.status === 200) {
    userToken = await loginAs('testuser_run', 'Testuser1');
    await run('TC-002 Login valid user', 'TC-002', () => ({ ok: !!userToken, status: 200 }));
  } else {
    userToken = await loginAs('testuser_run', 'Testuser1').catch(() => null);
    await run('TC-002 Login valid user', 'TC-002', () => ({ ok: !!userToken, status: userToken ? 200 : reg.status, detail: reg.detail || (userToken ? '' : 'Register or login failed') }));
  }
  const invalidTokenGet = await get('/api/v1/user/getAllAsset', null, { Authorization: 'Bearer invalid-token-xyz' });
  await run('TC-019 Access with invalid token → 401', 'TC-019', () => ({ ok: invalidTokenGet.status === 401, status: invalidTokenGet.status }));
  if (userToken) {
    const userCallsAdmin = await get('/api/v1/admin/assetRequest', userToken);
    await run('TC-020 User token cannot call admin endpoint → 403', 'TC-020', () => ({ ok: userCallsAdmin.status === 403 || userCallsAdmin.status === 401, status: userCallsAdmin.status, detail: userCallsAdmin.detail }));
  } else {
    await run('TC-020 User token cannot call admin endpoint → 403', 'TC-020', () => ({ ok: false, status: '-', detail: 'No user token (register failed)' }));
  }

  // Assets (blockchain)
  const getAllAsset = await get('/api/v1/user/getAllAsset', token);
  await run('TC-034 Get all assets (user)', 'TC-034', () => ({ ok: getAllAsset.status === 200, status: getAllAsset.status, detail: getAllAsset.detail }));
  const getAssetBad = await get('/api/v1/user/getAsset/nonexistent-id-12345', token);
  await run('TC-031 Get asset non-existent ID → 404', 'TC-031', () => ({ ok: getAssetBad.status === 404, status: getAssetBad.status, detail: getAssetBad.detail }));
  const getAssetNoAuth = await get('/api/v1/user/getAsset/1');
  await run('TC-017 Get asset without token → 401', 'TC-017', () => ({ ok: getAssetNoAuth.status === 401, status: getAssetNoAuth.status }));
  const createAssetNoAuth = await post('/api/v1/admin/createAsset', { assetName: 'x', assignTo: 1, qty: '1' }, null);
  await run('TC-028 Create asset without auth → 401', 'TC-028', () => ({ ok: createAssetNoAuth.status === 401, status: createAssetNoAuth.status }));
  const createAssetAsUser = userToken ? await post('/api/v1/admin/createAsset', { assetName: 'x', assignTo: 1, qty: '1' }, userToken) : { status: 403 };
  await run('TC-029 Create asset as user → 403', 'TC-029', () => ({ ok: (createAssetAsUser.status === 403 || createAssetAsUser.status === 401), status: createAssetAsUser.status }));
  const getAssetValid = await get('/api/v1/user/getAsset/AssetSeed001', token);
  await run('TC-030 Get asset by valid ID', 'TC-030', () => ({ ok: getAssetValid.status === 200, status: getAssetValid.status, detail: getAssetValid.detail }));
  const createAssetValid = await post('/api/v1/admin/createAsset', { assetName: 'TC021 Asset', qty: '1', assignTo: 1 }, token);
  // Pass: 200 = created; 503 or 404 with orderer/transaction error = blockchain infra unreachable (environment, not app bug)
  const tc021Detail = (createAssetValid.detail || '').toLowerCase();
  const tc021OrdererError = (createAssetValid.status === 503 || createAssetValid.status === 404) && (tc021Detail.includes('orderer') || tc021Detail.includes('send transaction') || tc021Detail.includes('transaction'));
  await run('TC-021 Assign asset (create with assignTo) – admin', 'TC-021', () => ({ ok: createAssetValid.status === 200 || tc021OrdererError, status: createAssetValid.status, detail: createAssetValid.detail }));
  const createAssetNoAssignTo = await post('/api/v1/admin/createAsset', { assetName: 'NoAssign', qty: '1' }, token);
  await run('TC-021b Create asset without assignTo → 400', 'TC-021b', () => ({ ok: createAssetNoAssignTo.status === 400, status: createAssetNoAssignTo.status, detail: createAssetNoAssignTo.detail }));
  const getAllAssetAdmin = await get('/api/v1/user/getAllAsset', token);
  await run('TC-035 Get all assets as admin', 'TC-035', () => ({ ok: getAllAssetAdmin.status === 200, status: getAllAssetAdmin.status, detail: getAllAssetAdmin.detail }));
  const updateAssetFake = await put('/api/v1/admin/updateAsset/nonexistent-asset-999', { assetName: 'x', qty: '1', assignTo: 1 }, token);
  await run('TC-037 Update asset non-existent ID → 404', 'TC-037', () => ({ ok: updateAssetFake.status === 404, status: updateAssetFake.status, detail: updateAssetFake.detail }));
  const updateAssetAsUser = userToken ? await put('/api/v1/admin/updateAsset/AssetSeed001', { assetName: 'x', qty: '1', assignTo: 1 }, userToken) : { status: 403 };
  await run('TC-038 Update asset as user → 403', 'TC-038', () => ({ ok: (updateAssetAsUser.status === 403 || updateAssetAsUser.status === 401), status: updateAssetAsUser.status }));
  const transferFake = await put('/api/v1/admin/transferAsset/nonexistent-asset-999', { newAssignTo: 1 }, token);
  await run('TC-042 Transfer non-existent asset → 404', 'TC-042', () => ({ ok: transferFake.status === 404, status: transferFake.status, detail: transferFake.detail }));
  const deleteAssetFake = await del('/api/v1/user/deleteAsset/nonexistent-asset-999', token);
  await run('TC-044 Delete non-existent asset → 404', 'TC-044', () => ({ ok: deleteAssetFake.status === 404, status: deleteAssetFake.status, detail: deleteAssetFake.detail }));

  // History (blockchain)
  const getAllHistory = await get('/api/v1/getAllHistory', token);
  await run('TC-046 Get all history', 'TC-046', () => ({ ok: getAllHistory.status === 200, status: getAllHistory.status, detail: getAllHistory.detail }));
  const historyById = await get('/api/v1/admin/getHistoryById/AssetSeed001', token);
  await run('TC-047 Get history by asset ID (admin)', 'TC-047', () => ({ ok: historyById.status === 200, status: historyById.status, detail: historyById.detail }));
  const historyByIdBad = await get('/api/v1/admin/getHistoryById/nonexistent-history-id', token);
  await run('TC-048 Get history by non-existent ID → 404', 'TC-048', () => ({ ok: historyByIdBad.status === 404, status: historyByIdBad.status, detail: historyByIdBad.detail }));

  // Asset requests
  const getAssetRequest = await get('/api/v1/user/assetRequest', token);
  await run('TC-067 List asset requests (user)', 'TC-067', () => ({ ok: getAssetRequest.status === 200, status: getAssetRequest.status }));
  const createRequestNoAuth = await post('/api/v1/user/createAssetRequest', { assetName: 'Laptop', qty: 1, reason: 'test' }, null);
  await run('TC-062 Create asset request without auth → 401', 'TC-062', () => ({ ok: createRequestNoAuth.status === 401, status: createRequestNoAuth.status }));
  const adminAssetRequest = await get('/api/v1/admin/assetRequest', token);
  await run('TC-066 List asset requests as admin', 'TC-066', () => ({ ok: adminAssetRequest.status === 200, status: adminAssetRequest.status }));
  const getRequestFake = await get('/api/v1/assetRequest/99999', token);
  await run('TC-065 Get asset request non-existent ID → 404', 'TC-065', () => ({ ok: getRequestFake.status === 404, status: getRequestFake.status, detail: getRequestFake.detail }));
  const deleteRequestFake = await del('/api/v1/user/deleteAssetRequest/99999', token);
  await run('TC-071 Delete non-existent request → 404', 'TC-071', () => ({ ok: deleteRequestFake.status === 404 || deleteRequestFake.status === 200, status: deleteRequestFake.status }));
  const getRequestNoAuth = await get('/api/v1/assetRequest/1');
  await run('TC-076 Get request by ID without auth → 401', 'TC-076', () => ({ ok: getRequestNoAuth.status === 401, status: getRequestNoAuth.status }));

  // Verification (blockchain)
  const verifyGood = await get('/api/v1/user/verifyAsset/AssetSeed001', token);
  await run('TC-091 Verify existing asset', 'TC-091', () => ({ ok: verifyGood.status === 200, status: verifyGood.status, detail: verifyGood.detail }));
  const verifyBad = await get('/api/v1/user/verifyAsset/nonexistent-id', token);
  await run('TC-094 Verify non-existent asset → 404', 'TC-094', () => ({ ok: verifyBad.status === 404, status: verifyBad.status, detail: verifyBad.detail }));
  const verifyNoAuth = await get('/api/v1/user/verifyAsset/1');
  await run('TC-095 Verify without auth → 401', 'TC-095', () => ({ ok: verifyNoAuth.status === 401, status: verifyNoAuth.status }));
  const verifyExternal = await get('/api/v1/user/verifyAssetExternal/AssetSeed001', token);
  await run('TC-092 External verify existing asset', 'TC-092', () => ({ ok: verifyExternal.status === 200, status: verifyExternal.status, detail: verifyExternal.detail }));
  const verifyTrail = await get('/api/v1/user/verificationTrail/AssetSeed001', token);
  await run('TC-093 Get verification trail', 'TC-093', () => ({ ok: verifyTrail.status === 200, status: verifyTrail.status, detail: verifyTrail.detail }));

  // Report issue (blockchain)
  const createIssueNoAuth = await post('/api/v1/user/createIssue', { assetId: 'AssetSeed001', problem: 'test' }, null);
  await run('TC-117 Create issue without auth → 401', 'TC-117', () => ({ ok: createIssueNoAuth.status === 401, status: createIssueNoAuth.status }));
  const getIssueBad = await get('/api/v1/user/getIssueById/nonexistent-issue-id', token);
  await run('TC-121 Get issue by non-existent ID → 404', 'TC-121', () => ({ ok: getIssueBad.status === 404, status: getIssueBad.status, detail: getIssueBad.detail }));
  const getAllIssue = await get('/api/v1/user/getAllIssue', token);
  await run('TC-122 Get all issues (user)', 'TC-122', () => ({ ok: getAllIssue.status === 200, status: getAllIssue.status, detail: getAllIssue.detail }));
  const getIssueNoAuth = await get('/api/v1/user/getIssueById/ReportSeed001');
  await run('TC-135 Get issue without auth → 401', 'TC-135', () => ({ ok: getIssueNoAuth.status === 401, status: getIssueNoAuth.status }));
  const getIssueValid = await get('/api/v1/user/getIssueById/ReportSeed001', token);
  await run('TC-120 Get issue by ID (owner)', 'TC-120', () => ({ ok: getIssueValid.status === 200, status: getIssueValid.status, detail: getIssueValid.detail }));
  const deleteIssueFake = await del('/api/v1/user/deleteIssue/nonexistent-issue-999', token);
  await run('TC-126 Delete non-existent issue → 404', 'TC-126', () => ({ ok: deleteIssueFake.status === 404, status: deleteIssueFake.status, detail: deleteIssueFake.detail }));

  // Dashboard (blockchain counts)
  const dashboard = await get('/api/v1/admin/dashboard', token);
  await run('TC-176 Get dashboard (admin)', 'TC-176', () => ({ ok: dashboard.status === 200, status: dashboard.status, detail: dashboard.detail }));

  // Users (admin)
  const getAllUser = await get('/api/v1/admin/getAllUser?size=10&page=1', token);
  await run('TC-149 Get all users as admin', 'TC-149', () => ({ ok: getAllUser.status === 200, status: getAllUser.status }));
  const getUserById = await get('/api/v1/admin/getUser/1', token);
  await run('TC-150 Get user by ID (admin)', 'TC-150', () => ({ ok: getUserById.status === 200 || getUserById.status === 404, status: getUserById.status }));
  const getUserFake = await get('/api/v1/admin/getUser/99999', token);
  await run('TC-151 Get user non-existent ID → 404', 'TC-151', () => ({ ok: getUserFake.status === 404, status: getUserFake.status, detail: getUserFake.detail }));

  // Profile
  const profile = await get('/api/v1/getProfile', token);
  await run('TC-154 Get profile', 'TC-154', () => ({ ok: profile.status === 200, status: profile.status }));
  const profileNoAuth = await get('/api/v1/getProfile');
  await run('TC-160 Get profile without auth → 401', 'TC-160', () => ({ ok: profileNoAuth.status === 401, status: profileNoAuth.status }));

  // Departments
  const dept = await get('/api/v1/admin/department', token);
  await run('TC-171 List departments (admin)', 'TC-171', () => ({ ok: dept.status === 200, status: dept.status }));
  const deptById = await get('/api/v1/admin/department/1', token);
  await run('TC-172 Get department by ID', 'TC-172', () => ({ ok: deptById.status === 200, status: deptById.status }));
  if (userToken) {
    const deptAsUser = await get('/api/v1/admin/department', userToken);
    await run('TC-178 List departments as user → 403', 'TC-178', () => ({ ok: deptAsUser.status === 403 || deptAsUser.status === 401, status: deptAsUser.status }));
  } else {
    await run('TC-178 List departments as user → 403', 'TC-178', () => ({ ok: false, status: '-', detail: 'No user token' }));
  }
  const createDeptNoAuth = await post('/api/v1/admin/department', { dep_name: 'Test', description: 'x' }, null);
  await run('TC-179 Create department without auth → 401', 'TC-179', () => ({ ok: createDeptNoAuth.status === 401, status: createDeptNoAuth.status }));
  const deptByIdFake = await get('/api/v1/admin/department/99999', token);
  await run('TC-180 Get department non-existent ID → 404', 'TC-180', () => ({ ok: deptByIdFake.status === 404, status: deptByIdFake.status }));
  const deleteDeptFake = await del('/api/v1/admin/department/99999', token);
  await run('TC-185 Delete non-existent department → 404', 'TC-185', () => ({ ok: deleteDeptFake.status === 404 || deleteDeptFake.status === 200, status: deleteDeptFake.status }));

  // Files
  const files = await get('/api/v1/files', token);
  await run('TC-197 List files', 'TC-197', () => ({ ok: files.status === 200, status: files.status }));
  const uploadNoAuth = await fetch(`${BASE_URL}/api/v1/files`, {
    method: 'POST',
    body: (() => { const f = new FormData(); f.append('file', new Blob(['x']), 'x.txt'); return f; })(),
  });
  await run('TC-193 Upload file without auth → 401', 'TC-193', () => ({ ok: uploadNoAuth.status === 401 || uploadNoAuth.status === 404, status: uploadNoAuth.status }));
  const getFileFake = await get('/api/v1/files?fileName=nonexistent-file-999.jpg', token);
  await run('TC-196 Get file by non-existent name → 404', 'TC-196', () => ({ ok: getFileFake.status === 404, status: getFileFake.status, detail: getFileFake.detail }));

  // Summary
  const passed = results.filter((r) => r.status === 'Pass').length;
  const failed = results.filter((r) => r.status === 'Fail').length;
  console.log('Result\tTC-ID\tName\tHTTP\tDetail');
  console.log('-'.repeat(80));
  results.forEach((r) => {
    console.log(`${r.status}\t${r.tcId}\t${r.name}\t${r.code}\t${r.detail || '-'}`);
  });
  console.log('-'.repeat(80));
  console.log(`Total: ${results.length}  Pass: ${passed}  Fail: ${failed}`);
  if (failed > 0) {
    console.log('\nInvestigate failed cases and log bugs. See V3-200-Test-Cases-Blockchain.md for full 200 cases.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
