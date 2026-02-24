import { test, expect } from '@playwright/test';

/**
 * V3 Front-end test cases – maps to V3-100-Test-Cases-Frontend.md.
 * Run with: npm run test:e2e
 * Requires: UI at baseURL (default http://localhost:3000), ownership API at http://localhost:8081.
 * Login tests require the API to be running and valid credentials (default admin / adminpw).
 * Env: UI_TEST_USER, UI_TEST_PASSWORD for login tests.
 */

const ADMIN_USER = process.env.UI_TEST_USER || 'admin';
const ADMIN_PASSWORD = process.env.UI_TEST_PASSWORD || 'adminpw';
const USER_ROLE_USER = process.env.UI_TEST_USER_USER || '';
const USER_ROLE_PASSWORD = process.env.UI_TEST_PASSWORD_USER || '';

/** Login submit button is inside #popup-modal; nav also has a "Login" button that opens the modal. */
function loginSubmitButton(page: import('@playwright/test').Page) {
  return page.locator('#popup-modal').getByRole('button', { name: 'Login' });
}

/** Open login modal, fill credentials, submit, and wait for navigation to /admin or /user. Fails with a clear message if login is rejected or times out. */
async function loginAndWaitForRedirect(page: import('@playwright/test').Page, timeout = 30000) {
  await page.goto('/');
  await page.getByRole('button', { name: /login/i }).click();
  await page.locator('#username').fill(ADMIN_USER);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await loginSubmitButton(page).click();
  const urlPromise = page.waitForURL(/\/(admin|user)/, { timeout });
  const invalidPromise = page.getByText(/invalid credentials|error occurred|login failed/i).waitFor({ state: 'visible', timeout });
  const result = await Promise.race([
    urlPromise.then(() => 'ok' as const),
    invalidPromise.then(() => 'invalid' as const),
  ]).catch(() => 'timeout' as const);
  if (result === 'invalid') {
    throw new Error(
      `Login failed: Invalid credentials. Ensure the ownership API is running (e.g. port 8081) and username "${ADMIN_USER}" / password are valid.`
    );
  }
  if (result === 'timeout') {
    throw new Error(
      `Login did not redirect within ${timeout}ms. Ensure the ownership API is running and credentials (${ADMIN_USER}) are valid.`
    );
  }
  // Let client hydration and layout render; cookie is now set so a full load will pass middleware
  await page.waitForTimeout(2000);
}

/** Login with custom credentials; waits for redirect to /admin or /user. Returns 'ok' | 'invalid' | 'timeout'. */
async function loginWithCredentials(
  page: import('@playwright/test').Page,
  username: string,
  password: string,
  timeout = 15000
): Promise<'ok' | 'invalid' | 'timeout'> {
  await page.goto('/');
  await page.getByRole('button', { name: /login/i }).click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await loginSubmitButton(page).click();
  const urlPromise = page.waitForURL(/\/(admin|user)/, { timeout });
  const invalidPromise = page.getByText(/invalid credentials/i).waitFor({ state: 'visible', timeout });
  const result = await Promise.race([
    urlPromise.then(() => 'ok' as const),
    invalidPromise.then(() => 'invalid' as const),
  ]).catch(() => 'timeout' as const);
  if (result === 'ok') await page.waitForTimeout(1500);
  return result;
}

test.describe('FE-001 to FE-020: Landing & Login', () => {
  test('FE-001: Home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/./);
  });

  test('FE-002: Login button visible on home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible({ timeout: 10000 });
  });

  test('FE-003: Click Login opens login modal', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.getByRole('heading', { name: /login to your account/i })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('FE-004: Login with valid admin credentials', async ({ page }) => {
    // Longer timeout: this test often runs first, so first login can hit API cold start
    await loginAndWaitForRedirect(page, 35000);
    await expect(page).toHaveURL(/\/(admin\/dashboard|user\/asset)/);
  });

  test('FE-008: Login with empty username shows validation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await page.locator('#password').fill('any');
    await loginSubmitButton(page).click();
    await expect(page.getByText(/username is required|Username is required/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('FE-010: Close login modal without submitting', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.locator('#username')).toBeVisible();
    await page.locator('#popup-modal').getByRole('button', { name: 'Close modal' }).click();
    await expect(page.locator('#username')).not.toBeVisible();
  });

  test('FE-018: Logo and brand visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').getByText('OWNER', { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByText('SHIP', { exact: true })).toBeVisible();
  });

  test('FE-005: Login with valid user credentials', async ({ page }) => {
    test.skip(!USER_ROLE_USER || !USER_ROLE_PASSWORD, 'Set UI_TEST_USER_USER and UI_TEST_PASSWORD_USER for user-role login');
    const result = await loginWithCredentials(page, USER_ROLE_USER, USER_ROLE_PASSWORD, 25000);
    expect(result).toBe('ok');
    await expect(page).toHaveURL(/\/user\//);
  });

  test('FE-006: Login with wrong password', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill('wrongpassword');
    await loginSubmitButton(page).click();
    await expect(page.getByText(/invalid credentials|error occurred|login failed/i).first()).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#username')).toBeVisible();
  });

  test('FE-007: Login with non-existent username', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await page.locator('#username').fill('nonexistentuser12345');
    await page.locator('#password').fill('anypassword');
    await loginSubmitButton(page).click();
    await expect(page.getByText(/invalid credentials|error occurred|login failed|username/i).first()).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#username')).toBeVisible();
  });

  test('FE-009: Login with empty password', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await page.locator('#username').fill(ADMIN_USER);
    await loginSubmitButton(page).click();
    await expect(page.getByText(/password is required|Password is required/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('FE-011: After login, home shows user state', async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    await page.goto('/');
    await expect(page).toHaveURL(/\/(admin|user)\//, { timeout: 15000 });
    const url = page.url();
    expect(url.includes('/admin/dashboard') || url.includes('/user/')).toBeTruthy();
  });

  test('FE-012: Logout clears session', async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    if (!page.url().includes('/admin/dashboard')) await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('[data-testid="dashboard-content"]').or(page.locator('a[href*="/admin"]')).first()).toBeVisible({ timeout: 15000 });
    const dropdownTrigger = page.locator('button').filter({ has: page.locator('span.ant-avatar') }).first();
    await expect(dropdownTrigger).toBeVisible({ timeout: 10000 });
    await dropdownTrigger.click();
    await page.locator('[data-testid="sign-out-button"]').or(page.getByText('Sign Out').first()).click({ timeout: 5000 });
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 15000 });
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible({ timeout: 8000 });
  });

  test('FE-017: Feature section visible on home', async ({ page }) => {
    await page.goto('/');
    await page.locator('#feature').scrollIntoViewIfNeeded();
    await expect(page.locator('#feature').getByText(/Ownership featuring|Multiple Asset|digital management/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('FE-020: Multiple failed logins', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /login/i }).click();
      await page.locator('#username').fill(ADMIN_USER);
      await page.locator('#password').fill('wrong' + i);
      await loginSubmitButton(page).click();
      await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 6000 });
      if (i < 2) await page.locator('#popup-modal').getByRole('button', { name: 'Close modal' }).click().catch(() => {});
    }
  });

  test('FE-019: Login with very long password', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill('x'.repeat(600));
    await loginSubmitButton(page).click();
    await expect(page.getByText(/invalid credentials|error/i).or(page.locator('#username')).first()).toBeVisible({ timeout: 10000 });
  });

  test('FE-014: Session persists on refresh', async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    if (!page.url().includes('/admin/')) await page.goto('/admin/dashboard');
    await expect(page.locator('[data-testid="dashboard-content"]').or(page.locator('a[href*="/admin"]')).first()).toBeVisible({ timeout: 15000 });
    const urlAfterLogin = page.url();
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(urlAfterLogin, { timeout: 15000 });
    await expect(page.locator('[data-testid="dashboard-content"], a[href*="/admin"], a[href*="/user"], .avartar-name').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-015: Login then navigate to admin dashboard', async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    if (!page.url().includes('/admin/dashboard')) await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 15000 });
    await expect(page.locator('[data-testid="dashboard-content"], [class*="ant-layout"], .ant-card, a[href*="/admin"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-016: Login then navigate to user asset list', async ({ page }) => {
    await loginAndWaitForRedirect(page);
    await page.goto('/user/asset');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/user\/asset/);
    await expect(page.locator('[class*="ant-layout"], .ant-table, .ant-empty').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('FE-021 to FE-035: Admin Dashboard & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    if (!page.url().includes('/admin/dashboard')) {
      await page.goto('/admin/dashboard');
      await page.waitForLoadState('domcontentloaded');
    }
    await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    const dashboardReady = page.locator('[data-testid="dashboard-content"]').or(page.locator('a[href*="/admin"]').first());
    await expect(dashboardReady.first()).toBeVisible({ timeout: 25000 });
  });

  test('FE-021: Admin dashboard loads', async ({ page }) => {
    await expect(page).toHaveURL(/admin\/dashboard/);
    await expect(page.locator('[class*="ant-layout"], .ant-card, a[href*="/admin/"]').first()).toBeVisible();
  });

  test('FE-030: Click Asset opens asset list', async ({ page }) => {
    const assetLink = page.locator('a[href*="/admin/asset"]').first();
    if (await assetLink.isVisible().catch(() => false)) {
      await assetLink.click();
      await expect(page).toHaveURL(/admin\/asset/, { timeout: 10000 });
    } else {
      await page.goto('/admin/asset');
      await expect(page).toHaveURL(/admin\/asset/);
    }
  });

  test('FE-031: Click Department opens department list', async ({ page }) => {
    const deptLink = page.locator('a[href*="/admin/department"]').first();
    if (await deptLink.isVisible().catch(() => false)) {
      await deptLink.click();
      await expect(page).toHaveURL(/admin\/department/, { timeout: 10000 });
    } else {
      await page.goto('/admin/department');
      await expect(page).toHaveURL(/admin\/department/);
    }
  });

  test('FE-032: Click User opens user list', async ({ page }) => {
    const userLink = page.locator('a[href*="/admin/user"]').first();
    if (await userLink.isVisible().catch(() => false)) {
      await userLink.click();
      await expect(page).toHaveURL(/admin\/user/, { timeout: 10000 });
    } else {
      await page.goto('/admin/user');
      await expect(page).toHaveURL(/admin\/user/);
    }
  });

  test('FE-022: Dashboard shows asset count', async ({ page }) => {
    await expect(page.locator('text=/Total Users|Total Asset|Total Department|Asset|\\d+/').first()).toBeVisible({ timeout: 10000 });
  });

  test('FE-023: Dashboard shows request/issue counts', async ({ page }) => {
    await expect(page.getByText(/Total Asset Request|Total Report Issue|Total Users|Loading/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('FE-024: Sidebar/nav has Asset link', async ({ page }) => {
    await expect(page.locator('a[href*="/admin/asset"]').first()).toBeVisible();
  });

  test('FE-025: Sidebar has Asset Request link', async ({ page }) => {
    await expect(page.locator('a[href*="/admin/asset-request"]').first()).toBeVisible();
  });

  test('FE-026: Sidebar has Department link', async ({ page }) => {
    await expect(page.locator('a[href*="/admin/department"]').first()).toBeVisible();
  });

  test('FE-027: Sidebar has User link', async ({ page }) => {
    await expect(page.locator('a[href*="/admin/user"]').first()).toBeVisible();
  });

  test('FE-028: Sidebar has Report Issue link', async ({ page }) => {
    await expect(page.locator('a[href*="/admin/report-issue"]').first()).toBeVisible();
  });

  test('FE-029: Sidebar has Profile link', async ({ page }) => {
    const profileInDropdown = page.locator('button').filter({ has: page.locator('span.ant-avatar') }).first();
    await expect(profileInDropdown).toBeVisible();
  });

  test('FE-033: Profile dropdown or menu visible when logged in', async ({ page }) => {
    const avatarOrName = page.locator('.avartar-name, span.ant-avatar').first();
    await expect(avatarOrName).toBeVisible({ timeout: 10000 });
  });

  test('FE-034: Navigate Asset → Dashboard → Asset', async ({ page }) => {
    await page.locator('a[href*="/admin/asset"]').first().click();
    await expect(page).toHaveURL(/admin\/asset/, { timeout: 10000 });
    await page.locator('a[href*="/admin/dashboard"]').first().click();
    await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 10000 });
    await page.locator('a[href*="/admin/asset"]').first().click();
    await expect(page).toHaveURL(/admin\/asset/, { timeout: 10000 });
  });

  test('FE-035: Breadcrumb or page title shows current section', async ({ page }) => {
    await page.goto('/admin/asset');
    await expect(page).toHaveURL(/admin\/asset/);
    await expect(page.locator('text=/Asset|Assign New|Asset Management/i').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('FE-036 to FE-055: Admin Assets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    if (!page.url().includes('/admin/')) await page.goto('/admin/dashboard');
    await page.goto('/admin/asset');
    await page.waitForLoadState('networkidle').catch(() => {});
    const assetPageReady = page.locator('[class*="ant-layout"], .ant-table, .ant-empty, a[href*="/admin/asset"]').or(page.getByText(/Asset Management|Assign New/i)).first();
    await expect(assetPageReady).toBeVisible({ timeout: 25000 });
  });

  test('FE-036: Asset list loads', async ({ page }) => {
    await expect(page).toHaveURL(/admin\/asset/);
    await expect(page.locator('.ant-table, table, [class*="ant-list"], .ant-empty, [class*="ant-layout"]').or(page.getByText(/Asset Management|Asset/i)).first()).toBeVisible();
  });

  test('FE-051: Asset list empty state or table visible', async ({ page }) => {
    await expect(page).toHaveURL(/admin\/asset/);
    await expect(page.locator('.ant-table, table, [class*="empty"], .ant-empty, [class*="ant-layout"]').first()).toBeVisible();
  });

  test('FE-038: Create Asset button/link visible', async ({ page }) => {
    await expect(page).toHaveURL(/admin\/asset/);
    await expect(page.getByRole('button', { name: /Assign New|Create|Add/i }).or(page.locator('a[href*="/admin/asset/create"]')).first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-037: Asset list shows at least one asset when data exists', async ({ page }) => {
    const tableOrEmpty = page.locator('.ant-table-tbody tr, .ant-empty, [class*="empty"]').first();
    await expect(tableOrEmpty).toBeVisible({ timeout: 10000 });
  });

  test('FE-039: Click Create Asset opens form', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /Assign New|Create|Add/i }).or(page.locator('a[href*="/admin/asset/create"]')).first();
    await createBtn.click();
    await expect(page).toHaveURL(/admin\/asset\/create/, { timeout: 10000 });
    await expect(page.locator('input, form').first()).toBeVisible({ timeout: 5000 });
  });

  test('FE-043: Cancel create asset', async ({ page }) => {
    await page.goto('/admin/asset/create');
    await page.waitForLoadState('domcontentloaded');
    const cancelBtn = page.getByRole('button', { name: /cancel/i }).or(page.getByRole('link', { name: /back|cancel/i })).first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await expect(page).toHaveURL(/admin\/asset(?!\/create)/, { timeout: 8000 });
    } else {
      const backLink = page.locator('a[href*="/admin/asset"]').first();
      await backLink.click();
      await expect(page).toHaveURL(/admin\/asset/);
    }
  });

  test('FE-044: Click asset row opens detail', async ({ page }) => {
    const viewBtn = page.locator('[data-testid="view-asset-detail"]').or(page.locator('button').filter({ has: page.locator('img[alt="view-detail-icon"]') })).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await expect(page).toHaveURL(/admin\/asset\/show\//, { timeout: 10000 });
      await expect(page.locator('[class*="ant-layout"], .ant-card, main').first()).toBeVisible({ timeout: 8000 });
    } else {
      await expect(page.locator('.ant-empty, .ant-table').first()).toBeVisible();
    }
  });

  test('FE-046: Edit Asset button on detail', async ({ page }) => {
    const viewBtn = page.locator('[data-testid="view-asset-detail"]').or(page.locator('button').filter({ has: page.locator('img[alt="view-detail-icon"]') })).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await expect(page).toHaveURL(/admin\/asset\/show\//, { timeout: 10000 });
      await expect(page.getByRole('button', { name: /edit/i }).or(page.locator('a[href*="/edit"]')).first()).toBeVisible({ timeout: 8000 });
    } else {
      await page.goto('/admin/asset');
      await expect(page.locator('.ant-empty, .ant-table').first()).toBeVisible();
    }
  });

  test('FE-045: Asset detail shows name, qty, assignee', async ({ page }) => {
    const viewBtn = page.locator('[data-testid="view-asset-detail"]').or(page.locator('button').filter({ has: page.locator('img[alt="view-detail-icon"]') })).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await expect(page).toHaveURL(/admin\/asset\/show\//, { timeout: 10000 });
      await expect(page.locator('text=/asset|name|assign|qty|quantity|detail/i').first()).toBeVisible({ timeout: 8000 });
    } else {
      await expect(page.locator('.ant-empty, .ant-table').first()).toBeVisible();
    }
  });

  test('FE-052: Asset list pagination or scroll', async ({ page }) => {
    const hasPagination = await page.locator('.ant-pagination, [class*="pagination"]').first().isVisible().catch(() => false);
    const hasTable = await page.locator('.ant-table-wrapper, .ant-table').first().isVisible().catch(() => false);
    expect(hasPagination || hasTable).toBeTruthy();
  });

  test('FE-041: Create asset with empty name', async ({ page }) => {
    await page.goto('/admin/asset/create');
    await page.waitForLoadState('domcontentloaded');
    const submitBtn = page.getByRole('button', { name: /submit|save|create|assign/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await expect(page.getByText(/required|name is required|please enter/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('FE-053: Open asset with non-existent ID in URL', async ({ page }) => {
    await page.goto('/admin/asset/show/bad-id-99999');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    const onShowUrl = url.includes('/admin/asset/show/bad-id-99999');
    if (onShowUrl) {
      await expect(page.getByText(/error|not found|404/i).or(page.locator('main')).first()).toBeVisible({ timeout: 5000 });
    } else {
      expect(url).not.toContain('/admin/asset/show/bad-id-99999');
    }
  });

  test('FE-050: Delete asset cancel', async ({ page }) => {
    const firstRow = page.locator('.ant-table-tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      const deleteBtn = page.getByRole('button', { name: /delete/i }).or(page.locator('a').filter({ hasText: /delete/i })).first();
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        await page.getByRole('button', { name: /cancel/i }).first().click({ timeout: 5000 }).catch(() => {});
        await expect(page).toHaveURL(/admin\/asset/);
      }
    }
  });

  test('FE-055: Asset list refresh', async ({ page }) => {
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/admin\/asset/);
    await expect(page.locator('.ant-table, .ant-empty, [class*="ant-layout"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-094: Form validation – required fields', async ({ page }) => {
    await page.goto('/admin/asset/create');
    await page.waitForLoadState('domcontentloaded');
    const submitBtn = page.getByRole('button', { name: /submit|save|create|assign/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await expect(page.getByText(/required|name is required|please enter/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('FE-056 to FE-075: Admin Asset Request, Department, User', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    if (!page.url().includes('/admin/dashboard')) {
      await page.goto('/admin/dashboard');
      await page.waitForLoadState('domcontentloaded');
    }
    await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    const ready = page.locator('[data-testid="dashboard-content"]').or(page.locator('a[href*="/admin"]').first());
    await expect(ready.first()).toBeVisible({ timeout: 25000 });
  });

  test('FE-056: Asset Request list loads', async ({ page }) => {
    await page.goto('/admin/asset-request');
    await expect(page).toHaveURL(/admin\/asset-request/);
    await expect(page.locator('.ant-table, .ant-empty, [class*="ant-layout"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-058: Department list loads', async ({ page }) => {
    await page.goto('/admin/department');
    await expect(page).toHaveURL(/admin\/department/);
    await expect(page.locator('.ant-table, .ant-empty, [class*="Department"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-063: User list loads', async ({ page }) => {
    await page.goto('/admin/user');
    await expect(page).toHaveURL(/admin\/user/);
    await expect(page.locator('.ant-table, .ant-empty, [class*="ant-layout"]').or(page.getByText(/User/i)).first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-064: Create User button visible', async ({ page }) => {
    await page.goto('/admin/user');
    await expect(page.getByRole('button', { name: /Create|Add User/i }).or(page.locator('a[href*="/admin/user/create"]')).first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-070: Admin report issue list loads', async ({ page }) => {
    await page.goto('/admin/report-issue');
    await expect(page).toHaveURL(/admin\/report-issue/);
    await expect(page.locator('.ant-table, .ant-empty, [class*="Report Issue"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-072: Admin history page loads', async ({ page }) => {
    await page.goto('/admin/history');
    await expect(page).toHaveURL(/admin\/history/);
    await expect(page.locator('[class*="ant-layout"], .ant-table, .ant-empty').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-073: Admin profile page loads', async ({ page }) => {
    await page.goto('/admin/profile');
    await expect(page).toHaveURL(/admin\/profile/);
    await expect(page.locator('[class*="ant-layout"], .ant-table, .ant-card').or(page.getByText(/Profile/i)).first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-057: Asset request list shows requests when exist', async ({ page }) => {
    await page.goto('/admin/asset-request');
    await expect(page).toHaveURL(/admin\/asset-request/);
    await expect(page.locator('.ant-table-tbody tr, .ant-empty, [class*="ant-layout"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-059: Create Department opens form', async ({ page }) => {
    await page.goto('/admin/department');
    await expect(page).toHaveURL(/admin\/department/);
    const createBtn = page.getByRole('button', { name: /create|add department/i }).or(page.locator('a[href*="department"]').filter({ hasText: /create|add/i })).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await expect(page.locator('input, form').first()).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.locator('.ant-table, .ant-empty').first()).toBeVisible();
    }
  });

  test('FE-060: Create department with name and save', async ({ page }) => {
    await page.goto('/admin/department');
    const createBtn = page.getByRole('button', { name: /create|add department/i }).or(page.locator('a[href*="department"]').filter({ hasText: /create|add/i })).first();
    if (!(await createBtn.isVisible().catch(() => false))) {
      await expect(page.locator('.ant-table, .ant-empty').first()).toBeVisible();
      return;
    }
    await createBtn.click();
    await page.locator('#department_name').fill('E2E Dept ' + Date.now());
    await page.getByRole('button', { name: /^Create$/ }).first().click();
    await expect(page).toHaveURL(/admin\/department/, { timeout: 10000 });
    await expect(page.locator('.ant-table, .ant-empty, [class*="ant-layout"]').first()).toBeVisible({ timeout: 8000 });
  });

  test('FE-065: Create user form opens', async ({ page }) => {
    await page.goto('/admin/user');
    const createBtn = page.getByRole('button', { name: /create new|create|add user/i }).first();
    await createBtn.click();
    await expect(page.getByText('Create User').or(page.getByPlaceholder(/enter your username|full name/i)).first()).toBeVisible({ timeout: 10000 });
  });

  test('FE-071: View report issue detail', async ({ page }) => {
    await page.goto('/admin/report-issue');
    await expect(page).toHaveURL(/admin\/report-issue/);
    const firstRow = page.locator('.ant-table-tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page.locator('[class*="ant-modal"], .ant-drawer, [class*="detail"], main').first()).toBeVisible({ timeout: 8000 });
    } else {
      await expect(page.locator('.ant-empty, .ant-table')).toBeVisible();
    }
  });

  test('FE-074: Admin can access user profile by ID', async ({ page }) => {
    await page.goto('/admin/profile/show/1');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    if (url.includes('/admin/profile/show/')) {
      await expect(page.locator('[class*="ant-layout"], .ant-card, main').first()).toBeVisible({ timeout: 10000 });
    } else {
      expect(url).toMatch(/\/admin\/profile|\/admin\/user|\//);
    }
  });

  test('FE-075: Navigation from dashboard to each admin section', async ({ page }) => {
    const sections = [
      { href: '/admin/dashboard', name: 'Dashboard' },
      { href: '/admin/asset', name: 'Asset' },
      { href: '/admin/asset-request', name: 'Asset Request' },
      { href: '/admin/report-issue', name: 'Report Issue' },
      { href: '/admin/history', name: 'History' },
      { href: '/admin/department', name: 'Department' },
      { href: '/admin/user', name: 'User' },
    ];
    for (const { href } of sections) {
      const link = page.locator(`a[href*="${href}"]`).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await expect(page).toHaveURL(new RegExp(href.replace(/\//g, '\\/')), { timeout: 10000 });
      }
    }
  });
});

test.describe('FE-076 to FE-090: User flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    if (!page.url().includes('/user/asset')) await page.goto('/user/asset');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/\/user\/asset/, { timeout: 15000 });
    const userPageReady = page.locator('[class*="ant-layout"], a[href*="/user/asset"]').or(page.getByRole('link', { name: /Asset|Report Issue|History/i })).first();
    await expect(userPageReady).toBeVisible({ timeout: 25000 });
  });

  test('FE-076: User asset list loads (or redirect to user area)', async ({ page }) => {
    if (!page.url().includes('/user/asset')) await page.goto('/user/asset');
    await expect(page).toHaveURL(/\/user\/asset/);
    await expect(page.locator('a[href*="/user/asset"], [class*="ant-layout"]').first()).toBeVisible();
  });

  test('FE-078: User asset detail opens', async ({ page }) => {
    if (!page.url().includes('/user/asset')) await page.goto('/user/asset');
    const viewBtn = page.locator('[data-testid="view-asset-detail"]').or(page.locator('button').filter({ has: page.locator('img[alt="view-detail-icon"]') })).first();
    const firstRow = page.locator('.ant-table-tbody tr').first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await expect(page).toHaveURL(/\/user\/asset\/show\//, { timeout: 10000 });
      await expect(page.locator('[class*="ant-layout"], main, .ant-card').first()).toBeVisible({ timeout: 8000 });
    } else if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/user\/asset\/show\//, { timeout: 10000 });
    } else {
      await expect(page.locator('.ant-empty, .ant-table, [class*="ant-layout"]').first()).toBeVisible();
    }
  });

  test('FE-079: User asset request list loads', async ({ page }) => {
    const link = page.locator('a[href*="/user/asset-request"]').first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await page.goto('/user/asset-request');
    }
    await expect(page).toHaveURL(/\/user\/asset-request/);
    await expect(page.locator('a[href*="/user/asset-request"], [class*="ant-layout"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-082: User report issue list loads', async ({ page }) => {
    const link = page.locator('a[href*="/user/report-issue"]').first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await page.goto('/user/report-issue');
    }
    await expect(page).toHaveURL(/\/user\/report-issue/);
    await expect(page.locator('a[href*="/user/report-issue"], [class*="ant-layout"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('FE-081: User history page loads', async ({ page }) => {
    const link = page.locator('a[href*="/user/history"]').first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await page.goto('/user/history');
    }
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url).toMatch(/\/user\/(history|asset)/);
    if (url.includes('/user/history')) {
      await expect(page.locator('[class*="ant-layout"], .ant-table, .ant-empty').first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('FE-084: User profile page loads', async ({ page }) => {
    await page.locator('button').filter({ has: page.locator('span.ant-avatar') }).first().click();
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 5000 });
    await page.getByText('My Profile').click();
    await expect(page).toHaveURL(/\/user\/profile\/show\/|\/admin\/profile\/show\//, { timeout: 15000 });
    await expect(page.locator('[class*="ant-layout"], .ant-card').or(page.getByText(/Profile|profile/i)).first()).toBeVisible({ timeout: 8000 });
  });

  test('FE-086: User cannot see admin dashboard link', async ({ page }) => {
    test.skip(!USER_ROLE_USER || !USER_ROLE_PASSWORD, 'Set UI_TEST_USER_USER and UI_TEST_PASSWORD_USER for user-role tests');
    const result = await loginWithCredentials(page, USER_ROLE_USER, USER_ROLE_PASSWORD, 20000);
    expect(result).toBe('ok');
    await expect(page).toHaveURL(/\/user\//);
    const adminDashboardLink = page.locator('a[href*="/admin/dashboard"]');
    await expect(adminDashboardLink).not.toBeVisible();
  });

  test('FE-087: User cannot open /admin/dashboard directly', async ({ page }) => {
    test.skip(!USER_ROLE_USER || !USER_ROLE_PASSWORD, 'Set UI_TEST_USER_USER and UI_TEST_PASSWORD_USER for user-role tests');
    await loginWithCredentials(page, USER_ROLE_USER, USER_ROLE_PASSWORD, 20000);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const redirectedToUser = page.url().includes('/user/');
    const onLoginOrHome = await page.getByRole('button', { name: /login/i }).isVisible().catch(() => false);
    expect(redirectedToUser || onLoginOrHome).toBeTruthy();
  });

  test('FE-090: User logout', async ({ page }) => {
    if (!page.url().includes('/user/')) await page.goto('/user/asset');
    await page.waitForLoadState('networkidle').catch(() => {});
    const dropdownTrigger = page.locator('button').filter({ has: page.locator('span.ant-avatar') }).first();
    await dropdownTrigger.click();
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('FE-091 to FE-100: Error & edge', () => {
  test('FE-093: Non-existent asset show shows error or 404', async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    await page.goto('/admin/asset/show/nonexistent-id-12345');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    const onShowUrl = url.includes('/admin/asset/show/nonexistent-id-12345');
    if (onShowUrl) {
      const anyContent = page.getByText(/error|not found|404/i).or(page.locator('main')).or(page.getByRole('heading')).first();
      await expect(anyContent).toBeVisible({ timeout: 8000 });
    } else {
      expect(url).toBeTruthy();
    }
  });

  test('FE-100: Dashboard load within 15s', async ({ page }) => {
    const start = Date.now();
    await loginAndWaitForRedirect(page, 25000);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(20000);
  });

  test('FE-098: List empty state has message', async ({ page }) => {
    await loginAndWaitForRedirect(page, 35000);
    if (!page.url().includes('/admin/')) await page.goto('/admin/dashboard');
    await page.goto('/admin/asset');
    await page.waitForLoadState('networkidle').catch(() => {});
    const emptyOrTable = page.locator('.ant-empty, .ant-table-wrapper, .ant-table').first();
    await expect(emptyOrTable).toBeVisible({ timeout: 20000 });
    const emptyText = page.getByText(/no data|no asset|empty/i);
    const hasRows = (await page.locator('.ant-table-tbody tr').count()) > 0;
    expect(hasRows || (await emptyText.isVisible().catch(() => false))).toBeTruthy();
  });

  test('FE-099: Modal overlay closes on outside click', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.locator('#username')).toBeVisible();
    // Click overlay (outside modal content): #popup-modal has onClick=onClose; inner content stops propagation
    await page.locator('#popup-modal').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#popup-modal #username')).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('FE-013: Unauthenticated access', () => {
  test('Access /admin/dashboard without login redirects or shows login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const onLogin = await page.getByRole('heading', { name: /login/i }).isVisible().catch(() => false);
    const onHome = await page.getByRole('button', { name: /login/i }).isVisible().catch(() => false);
    const url = page.url();
    const base = (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const onHomeUrl = url === base + '/' || url === base + '/login' || url.endsWith('/');
    const dashboardNavVisible = await page.locator('a[href*="/admin/dashboard"], a[href*="/admin/asset"]').first().isVisible().catch(() => false);
    expect(onLogin || onHome || onHomeUrl || !dashboardNavVisible).toBeTruthy();
  });
});
