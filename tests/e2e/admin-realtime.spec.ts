import { test, expect, Page } from '@playwright/test';
import {
  ADMIN_USER,
  UNAUTHORIZED_USER,
  loginAsAdmin,
  loginAsUnauthorizedUser,
} from '../fixtures/auth-helpers';
import { updateAdminUserDetailAction } from '../../src/actions/admin';

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

    // Verify admin SSE receives connected event with isAdmin: true and baseline lastSeenId
    const adminConnectedData = await page.evaluate(() => {
      return new Promise<{ status?: string; isAdmin?: boolean; lastSeenId?: number }>((resolve) => {
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
    expect(typeof adminConnectedData.lastSeenId).toBe('number');

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

    // Ensure student SSE stream is connected FIRST
    await studentPage.evaluate(() => {
      return new Promise<void>((resolve) => {
        (window as any).__receivedAdminEvents = [];
        const es = new EventSource('/api/realtime');
        (window as any).__testEs = es;

        es.addEventListener('admin:user:banned', () => {
          (window as any).__receivedAdminEvents.push('admin:user:banned');
        });
        es.addEventListener('admin:user:unbanned', () => {
          (window as any).__receivedAdminEvents.push('admin:user:unbanned');
        });
        es.addEventListener('admin:user:change', () => {
          (window as any).__receivedAdminEvents.push('admin:user:change');
        });
        es.addEventListener('admin:announcement:dispatched', () => {
          (window as any).__receivedAdminEvents.push('admin:announcement:dispatched');
        });

        es.addEventListener('connected', () => {
          resolve();
        });
      });
    });

    // In parallel, admin navigates to /admin/users and executes ban mutation
    await loginAsAdmin(context, ADMIN_USER, page.url());
    await page.goto('/admin/users');
    await expect(page.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

    const banBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    await expect(banBtn).toBeVisible({ timeout: 10000 });
    await banBtn.click();
    await expect(banBtn).toHaveText(/Unban/i, { timeout: 10000 });

    // Wait 2 seconds to confirm no events arrived on student connection
    await page.waitForTimeout(2000);

    const receivedEvents = await studentPage.evaluate(() => {
      if ((window as any).__testEs) {
        (window as any).__testEs.close();
      }
      return (window as any).__receivedAdminEvents || [];
    });

    expect(receivedEvents).toEqual([]);

    // Restore unban state
    const studentBanBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    const btnText = await studentBanBtn.innerText();
    if (btnText.includes('Unban')) {
      await studentBanBtn.click();
      await expect(studentBanBtn).toContainText('Ban User', { timeout: 10000 });
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
    await expect(pageA.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

    // Context B (Admin 2 / second session)
    const contextB = await browser.newContext();
    await loginAsAdmin(contextB, ADMIN_USER);
    const pageB = await contextB.newPage();
    await pageB.goto('/admin/users');
    await expect(pageB.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

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
    await expect(pageA.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

    // Context B (Admin 2) - Opens the detail dialog
    const contextB = await browser.newContext();
    await loginAsAdmin(contextB, ADMIN_USER);
    const pageB = await contextB.newPage();
    await pageB.goto('/admin/users');
    await expect(pageB.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

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

  test('5. Multi-session live propagation: profile changes propagate across open admin sessions without reload', async ({
    page: pageA,
    context: contextA,
    browser,
  }) => {
    await loginAsAdmin(contextA, ADMIN_USER, pageA.url());
    await pageA.goto('/admin/users');
    await expect(pageA.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

    const contextB = await browser.newContext();
    await loginAsAdmin(contextB, ADMIN_USER);
    const pageB = await contextB.newPage();
    await pageB.goto('/admin/users');
    await expect(pageB.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

    const studentRowB = pageB.locator(`[data-testid="user-row-${UNAUTHORIZED_USER.uid}"]`);
    await expect(studentRowB).toBeVisible({ timeout: 10000 });

    const updatedName = `Live Student ${Date.now() % 10000}`;

    // Admin 1 opens detail dialog and modifies student's full name
    const inspectBtnA = pageA.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
    await inspectBtnA.click();

    const nameInputA = pageA.locator('[data-testid="edit-user-fullname"]');
    await expect(nameInputA).toBeVisible({ timeout: 10000 });
    await nameInputA.fill(updatedName);

    const saveBtnA = pageA.locator('[data-testid="save-user-changes-btn"]');
    await saveBtnA.click();
    await expect(pageA.locator('text=User profile changes have been persisted successfully!')).toBeVisible({ timeout: 10000 });

    // Page B reflects the updated name in the table LIVE via SSE without page reload
    await expect(studentRowB).toContainText(updatedName, { timeout: 10000 });

    // Restore original name
    await nameInputA.fill(UNAUTHORIZED_USER.name);
    await saveBtnA.click();
    await expect(pageA.locator('text=User profile changes have been persisted successfully!')).toBeVisible({ timeout: 10000 });
    await expect(studentRowB).toContainText(UNAUTHORIZED_USER.name, { timeout: 10000 });

    await contextB.close();
  });

  test('6. Targeted announcement propagation: updates open inspection dialog live across sessions', async ({
    page: pageA,
    context: contextA,
    browser,
  }) => {
    await loginAsAdmin(contextA, ADMIN_USER, pageA.url());
    await pageA.goto('/admin/users');
    await expect(pageA.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

    const contextB = await browser.newContext();
    await loginAsAdmin(contextB, ADMIN_USER);
    const pageB = await contextB.newPage();
    await pageB.goto('/admin/users');
    await expect(pageB.locator('[data-testid="admin-realtime-status"]')).toHaveText(/Live Realtime Sync/, {
      timeout: 15000,
    });

    // Page B opens the student's detail dialog
    const inspectBtnB = pageB.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
    await inspectBtnB.click();
    const dialogB = pageB.locator('[data-testid="user-detail-dialog"]');
    await expect(dialogB).toBeVisible({ timeout: 10000 });

    // Admin 1 opens student detail on Page A and dispatches an announcement
    const inspectBtnA = pageA.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
    await inspectBtnA.click();

    const uniqueMsg = `Realtime Broadcast Notice #${Date.now() % 10000}`;
    const announcementInputA = pageA.locator('[data-testid="targeted-announcement-input"]');
    await expect(announcementInputA).toBeVisible({ timeout: 10000 });
    await announcementInputA.fill(uniqueMsg);

    const sendBtnA = pageA.locator('[data-testid="send-announcement-btn"]');
    await sendBtnA.click();

    // Verify Page B's OPEN dialog automatically receives and populates the announcement live
    const announcementInputB = dialogB.locator('[data-testid="targeted-announcement-input"]');
    await expect(announcementInputB).toHaveValue(uniqueMsg, { timeout: 10000 });

    // Clear announcement from Page A
    const clearBtnA = pageA.locator('[data-testid="clear-announcement-btn"]');
    if (await clearBtnA.isVisible({ timeout: 3000 })) {
      await clearBtnA.click();
    }

    await contextB.close();
  });

  test('7. Baseline cursor catchup: missed administrative events are recovered on reconnect via lastEventId', async ({
    page,
    context,
  }) => {
    await loginAsAdmin(context, ADMIN_USER, page.url());
    await page.goto('/admin/users');

    // Step A: Capture the initial latest baseline sync event ID
    const initialCursor = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const es = new EventSource('/api/realtime');
        es.addEventListener('connected', (ev: MessageEvent) => {
          es.close();
          try {
            const parsed = JSON.parse(ev.data);
            resolve(parsed.lastSeenId || 0);
          } catch {
            resolve(0);
          }
        });
        setTimeout(() => {
          es.close();
          resolve(0);
        }, 8000);
      });
    });

    expect(typeof initialCursor).toBe('number');

    // Step B: Disconnect (simulate offline gap). In the background, trigger an admin ban mutation
    const banBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    await banBtn.click();
    await expect(banBtn).toHaveText(/Unban/i, { timeout: 10000 });

    // Step C: Reconnect specifying ?lastEventId=<initialCursor> to request missed events
    const catchupEvents = await page.evaluate((cursor) => {
      return new Promise<{ receivedTypes: string[]; eventIds: number[] }>((resolve) => {
        const receivedTypes: string[] = [];
        const eventIds: number[] = [];
        const es = new EventSource(`/api/realtime?lastEventId=${cursor}`);

        es.addEventListener('admin:user:banned', (ev: MessageEvent) => {
          receivedTypes.push('admin:user:banned');
          if (ev.lastEventId) {
            eventIds.push(parseInt(ev.lastEventId, 10));
          }
        });

        // Check for 4 seconds
        setTimeout(() => {
          es.close();
          resolve({ receivedTypes, eventIds });
        }, 4000);
      });
    }, initialCursor);

    // Verify the missed event was recovered during cursor catchup
    expect(catchupEvents.receivedTypes).toContain('admin:user:banned');
    if (catchupEvents.eventIds.length > 0) {
      expect(catchupEvents.eventIds[0]).toBeGreaterThan(initialCursor);
    }

    // Restore unbanned state
    const studentBanBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
    const btnText = await studentBanBtn.innerText();
    if (btnText.includes('Unban')) {
      await studentBanBtn.click();
      await expect(studentBanBtn).toContainText('Ban User', { timeout: 10000 });
    }
  });
});
