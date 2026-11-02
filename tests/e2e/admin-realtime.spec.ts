import { test, expect, Page } from '@playwright/test';
import {
  ADMIN_USER,
  UNAUTHORIZED_USER,
  loginAsAdmin,
  loginAsUnauthorizedUser,
} from '../fixtures/auth-helpers';

async function ensureStudentUnbanned(page: Page) {
  await page.goto('/admin/users');
  const studentBanBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
  await expect(studentBanBtn).toBeVisible({ timeout: 10000 });
  const buttonText = await studentBanBtn.innerText();
  if (buttonText.includes('Unban')) {
    await studentBanBtn.click();
    await expect(studentBanBtn).toContainText('Ban User', { timeout: 10000 });
  }
}

test.describe('Real-Time Admin SSE Sync (admin:events & SYSTEM_ADMIN_BROADCAST)', () => {
  test.beforeEach(async ({ page, context }) => {
    await loginAsAdmin(context, ADMIN_USER, page.url());
    await ensureStudentUnbanned(page);
  });

  test.afterEach(async ({ page, context }) => {
    try {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await ensureStudentUnbanned(page);
    } catch {}
  });

  test('1. Admin SSE connection receives isAdmin: true while regular student receives isAdmin: false', async ({
    page,
    context,
    browser,
  }) => {
    // 1. Admin context
    await loginAsAdmin(context, ADMIN_USER, page.url());
    await page.goto('/admin/users');

    // Verify admin SSE connected indicator is visible
    const realtimeStatus = page.locator('[data-testid="admin-realtime-status"]');
    await expect(realtimeStatus).toBeVisible({ timeout: 10000 });
    await expect(realtimeStatus).toContainText(/Live Realtime Sync|Connecting/i);

    // Verify admin SSE receives connected event with isAdmin: true
    const adminConnectedData = await page.evaluate(() => {
      return new Promise<{ status?: string; isAdmin?: boolean }>((resolve) => {
        const es = new EventSource('/api/realtime');
        es.addEventListener('connected', (ev: MessageEvent) => {
          es.close();
          try {
            resolve(JSON.parse(ev.data));
          } catch {
            resolve({});
          }
        });
        setTimeout(() => {
          es.close();
          resolve({});
        }, 8000);
      });
    });

    expect(adminConnectedData.status).toBe('connected');
    expect(adminConnectedData.isAdmin).toBe(true);

    // 2. Student context
    const studentContext = await browser.newContext();
    await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/');

    const studentConnectedData = await studentPage.evaluate(() => {
      return new Promise<{ status?: string; isAdmin?: boolean }>((resolve) => {
        const es = new EventSource('/api/realtime');
        es.addEventListener('connected', (ev: MessageEvent) => {
          es.close();
          try {
            resolve(JSON.parse(ev.data));
          } catch {
            resolve({});
          }
        });
        setTimeout(() => {
          es.close();
          resolve({});
        }, 8000);
      });
    });

    expect(studentConnectedData.status).toBe('connected');
    expect(studentConnectedData.isAdmin).toBe(false);
    await studentContext.close();
  });

  test('2. Regular students NEVER receive admin broadcast events', async ({
    page,
    context,
    browser,
  }) => {
    // Setup regular student context listening to SSE
    const studentContext = await browser.newContext();
    await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/');

    // Start listening on student page for any admin:* events
    const studentListenPromise = studentPage.evaluate(() => {
      return new Promise<{ receivedAdminEvents: string[] }>((resolve) => {
        const received: string[] = [];
        const es = new EventSource('/api/realtime');

        es.addEventListener('admin:user:banned', () => {
          received.push('admin:user:banned');
        });
        es.addEventListener('admin:user:unbanned', () => {
          received.push('admin:user:unbanned');
        });
        es.addEventListener('admin:user:change', () => {
          received.push('admin:user:change');
        });
        es.addEventListener('admin:announcement:dispatched', () => {
          received.push('admin:announcement:dispatched');
        });

        // Listen for 5 seconds
        setTimeout(() => {
          es.close();
          resolve({ receivedAdminEvents: received });
        }, 5000);
      });
    });

    // In parallel, admin executes a ban toggle action
    await loginAsAdmin(context, ADMIN_USER, page.url());
    await page.goto('/admin/users');

    const banBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    await expect(banBtn).toBeVisible({ timeout: 10000 });
    await banBtn.click();
    await page.waitForTimeout(1500);

    const studentResult = await studentListenPromise;
    expect(studentResult.receivedAdminEvents).toEqual([]);

    // Restore unban state
    const unbanBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`).filter({ hasText: /Unban/i });
    if (await unbanBtn.isVisible({ timeout: 5000 })) {
      await unbanBtn.click();
      await page.waitForTimeout(1000);
    }

    await studentContext.close();
  });

  test('3. Multi-session live propagation: ban toggle propagates across two independent admin browser contexts without page refresh', async ({
    page: pageA,
    context: contextA,
    browser,
  }) => {
    // Context A (Admin 1)
    await loginAsAdmin(contextA, ADMIN_USER, pageA.url());
    await pageA.goto('/admin/users');
    await expect(pageA.locator('[data-testid="admin-realtime-status"]')).toBeVisible({ timeout: 10000 });

    // Context B (Admin 2 / second session)
    const contextB = await browser.newContext();
    await loginAsAdmin(contextB, ADMIN_USER);
    const pageB = await contextB.newPage();
    await pageB.goto('/admin/users');
    await expect(pageB.locator('[data-testid="admin-realtime-status"]')).toBeVisible({ timeout: 10000 });

    // Verify both pages see student as Active initially
    const rowA = pageA.locator(`[data-testid="user-row-${UNAUTHORIZED_USER.uid}"]`);
    const rowB = pageB.locator(`[data-testid="user-row-${UNAUTHORIZED_USER.uid}"]`);
    await expect(rowA).toBeVisible({ timeout: 10000 });
    await expect(rowB).toBeVisible({ timeout: 10000 });

    // Step A: Ban the user from Page A
    const banBtnA = pageA.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    await expect(banBtnA).toHaveText(/Ban User/i);
    await banBtnA.click();

    // Verify Page A reflects Banned state
    await expect(pageA.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`)).toHaveText(/Unban/i, {
      timeout: 10000,
    });

    // Verify Page B reflects Banned state LIVE via SSE WITHOUT REFRESHING OR RELOADING
    await expect(pageB.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`)).toHaveText(/Unban/i, {
      timeout: 10000,
    });
    await expect(rowB.locator('[data-slot="badge"]').filter({ hasText: 'Banned' })).toBeVisible({ timeout: 10000 });

    // Step B: Unban the user from Page A
    const unbanBtnA = pageA.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    await unbanBtnA.click();

    // Verify Page A reflects Active state
    await expect(pageA.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`)).toHaveText(/Ban User/i, {
      timeout: 10000,
    });

    // Verify Page B reflects Active state LIVE via SSE WITHOUT REFRESHING
    await expect(pageB.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`)).toHaveText(/Ban User/i, {
      timeout: 10000,
    });
    await expect(rowB.locator('[data-slot="badge"]').filter({ hasText: 'Active' })).toBeVisible({ timeout: 10000 });

    await contextB.close();
  });

  test('4. Open user inspection dialog reflects live real-time updates dispatched from another session', async ({
    page: pageA,
    context: contextA,
    browser,
  }) => {
    // Context A (Admin 1)
    await loginAsAdmin(contextA, ADMIN_USER, pageA.url());
    await pageA.goto('/admin/users');

    // Context B (Admin 2) - Opens the detail dialog
    const contextB = await browser.newContext();
    await loginAsAdmin(contextB, ADMIN_USER);
    const pageB = await contextB.newPage();
    await pageB.goto('/admin/users');

    const inspectBtnB = pageB.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
    await expect(inspectBtnB).toBeVisible({ timeout: 10000 });
    await inspectBtnB.click();

    const dialogB = pageB.locator('[data-testid="user-detail-dialog"]');
    await expect(dialogB).toBeVisible({ timeout: 10000 });

    // Admin 1 toggles ban on Page A
    const banBtnA = pageA.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    await expect(banBtnA).toBeVisible({ timeout: 10000 });
    await banBtnA.click();

    // Verify Page B's OPEN DIALOG reflects "Account Suspended" and "Unban User" LIVE without closing
    const dialogBanBadge = dialogB.locator('[data-slot="badge"]').filter({ hasText: /Account Suspended/i });
    await expect(dialogBanBadge).toBeVisible({ timeout: 10000 });

    const dialogUnbanBtn = dialogB.locator('[data-testid="detail-ban-toggle-btn"]');
    await expect(dialogUnbanBtn).toContainText(/Unban User/i, { timeout: 10000 });

    // Admin 1 restores access
    const unbanBtnA = pageA.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    await unbanBtnA.click();

    // Verify Page B's open dialog reflects access restored live
    await expect(dialogUnbanBtn).toContainText(/Ban User/i, { timeout: 10000 });

    await contextB.close();
  });
});
