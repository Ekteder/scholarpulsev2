import { test, expect } from '@playwright/test';
import {
  ADMIN_USER,
  UNAUTHORIZED_USER,
  loginAsAdmin,
  loginAsUnauthorizedUser,
} from '../fixtures/auth-helpers';

test.describe('Admin User Management & Targeted Announcements (R1, R2, R3, R4)', () => {
  test.describe('R1: Admin User List Section & Lazy Loading', () => {
    test('1. Navigating to /admin/users displays all users with name, email, and ban/unban action', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');
      await expect(page).toHaveURL(/\/admin\/users/);

      // Verify page title and header
      const heading = page.locator('h1').filter({ hasText: /User Management/i });
      await expect(heading).toBeVisible({ timeout: 10000 });

      // Verify table rows exist
      const userRows = page.locator('table tbody tr');
      await expect(userRows.first()).toBeVisible({ timeout: 10000 });
      const rowCount = await userRows.count();
      expect(rowCount).toBeGreaterThan(0);

      // Verify at least one row displays name, email, and ban/unban action
      const studentRow = page.locator(`[data-testid="user-row-${UNAUTHORIZED_USER.uid}"]`);
      await expect(studentRow).toBeVisible();
      await expect(studentRow).toContainText(UNAUTHORIZED_USER.email);

      // Verify ban/unban action button is visible in list row
      const banBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
      await expect(banBtn).toBeVisible();
    });

    test('2. User list view does not load detailed study data upfront until user is clicked', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');
      await expect(page).toHaveURL(/\/admin\/users/);

      // The detailed inspection dialog must NOT be visible upfront
      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).not.toBeVisible();

      // Detailed settings fields like timezone select or pomodoro inputs should not be present in main table
      const timezoneSelect = page.locator('main table select');
      await expect(timezoneSelect).toHaveCount(0);
    });

    test('3. Search filter quickly narrows user list by email or name', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const searchInput = page.locator('[data-testid="search-users-input"]');
      await expect(searchInput).toBeVisible();

      // Filter by unauthorized student's email
      await searchInput.fill(UNAUTHORIZED_USER.email);
      await page.waitForTimeout(300);

      const filteredRow = page.locator(`[data-testid="user-row-${UNAUTHORIZED_USER.uid}"]`);
      await expect(filteredRow).toBeVisible();

      // Search for nonexistent query
      await searchInput.fill('nonexistent-student-query-xyz999@domain.test');
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toContainText(/No users matching/i);
    });
  });

  test.describe('R2: User Detail Inspection & Editing', () => {
    test('4. Clicking a user lazily loads their full record into formatted inspection view', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      // Click on student user row or inspect button
      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await expect(inspectBtn).toBeVisible({ timeout: 10000 });
      await inspectBtn.click();

      // Detail dialog opens
      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible({ timeout: 10000 });

      // Verifies formatted view shows user ID, full name, email, study parameters
      await expect(detailDialog).toContainText(UNAUTHORIZED_USER.uid);
      await expect(detailDialog).toContainText(UNAUTHORIZED_USER.email);

      const nameInput = page.locator('[data-testid="edit-user-fullname"]');
      await expect(nameInput).toBeVisible();
    });

    test('5. Admin can edit user data fields and persist changes successfully', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await inspectBtn.click();

      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible();

      const nameInput = page.locator('[data-testid="edit-user-fullname"]');
      const updatedName = `Regular Student Edited ${Date.now()}`;
      await nameInput.fill(updatedName);

      const saveBtn = page.locator('[data-testid="save-user-changes-btn"]');
      await saveBtn.click();

      // Check success feedback
      await expect(detailDialog).toContainText(/persisted successfully/i, { timeout: 10000 });

      // Close dialog and check that user row in list displays updated name
      const closeBtn = detailDialog.getByRole('button', { name: /close/i }).first();
      await closeBtn.click();

      const studentRow = page.locator(`[data-testid="user-row-${UNAUTHORIZED_USER.uid}"]`);
      await expect(studentRow).toContainText(updatedName);
    });
  });

  test.describe('R3: Ban & Unban Enforcement (Lockout & Restoration)', () => {
    test('6. Banning a user locks them out of authenticated features with Account Suspended screen', async ({
      page,
      context,
      browser,
    }) => {
      // 1. Admin bans the user
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const studentBanBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
      await expect(studentBanBtn).toBeVisible({ timeout: 10000 });

      const buttonText = await studentBanBtn.innerText();
      if (!buttonText.includes('Unban')) {
        await studentBanBtn.click();
        await page.waitForTimeout(500);
      }
      await expect(studentBanBtn).toContainText('Unban');

      // 2. Student visits the website in a separate context
      const studentContext = await browser.newContext();
      await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
      const studentPage = await studentContext.newPage();
      await studentPage.goto('/');

      // Verify the student sees the Account Suspended lockout screen
      const lockoutScreen = studentPage.locator('[data-testid="banned-lockout-screen"]');
      await expect(lockoutScreen).toBeVisible({ timeout: 10000 });
      await expect(lockoutScreen).toContainText('Account Suspended');
      await expect(lockoutScreen).toContainText(/suspended by an administrator/i);

      // Verify authenticated workspace features (tabs, timer, subjects) are NOT accessible
      const mainTabs = studentPage.locator('[role="tab"], [role="navigation"] button');
      await expect(mainTabs).toHaveCount(0);

      await studentContext.close();
    });

    test('7. Unbanning a user restores their access to the website and workspace', async ({
      page,
      context,
      browser,
    }) => {
      // 1. Admin unbans the student user
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const studentBanBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
      await expect(studentBanBtn).toBeVisible({ timeout: 10000 });

      const buttonText = await studentBanBtn.innerText();
      if (buttonText.includes('Unban')) {
        await studentBanBtn.click();
        await page.waitForTimeout(500);
      }
      await expect(studentBanBtn).toContainText('Ban User');

      // 2. Student visits the website
      const studentContext = await browser.newContext();
      await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
      const studentPage = await studentContext.newPage();
      await studentPage.goto('/');

      // Verify lockout screen is NOT visible
      const lockoutScreen = studentPage.locator('[data-testid="banned-lockout-screen"]');
      await expect(lockoutScreen).not.toBeVisible({ timeout: 10000 });

      // Student app loads
      await expect(studentPage.locator('body')).not.toContainText('Account Suspended');

      await studentContext.close();
    });
  });

  test.describe('R4: Targeted Unclosable Announcements', () => {
    const testAnnouncementMsg = `Special Notice: Mandatory exam review session at 8 PM (${Date.now()})`;

    test('8. Admin creates a targeted announcement for an individual user', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await inspectBtn.click();

      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible({ timeout: 10000 });

      // Fill targeted announcement input
      const announcementInput = page.locator('[data-testid="targeted-announcement-input"]');
      await expect(announcementInput).toBeVisible();
      await announcementInput.fill(testAnnouncementMsg);

      const sendBtn = page.locator('[data-testid="send-announcement-btn"]');
      await sendBtn.click();

      // Check success feedback
      await expect(detailDialog).toContainText(/Targeted announcement dispatched/i, { timeout: 10000 });
    });

    test('9. Targeted announcement is visible to the targeted user and strictly unclosable / non-dismissible', async ({
      browser,
    }) => {
      const studentContext = await browser.newContext();
      await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
      const studentPage = await studentContext.newPage();
      await studentPage.goto('/');

      // Check that targeted announcement banner appears
      const banner = studentPage.locator('[data-testid="targeted-announcement-banner"]');
      await expect(banner).toBeVisible({ timeout: 10000 });
      await expect(banner).toContainText(testAnnouncementMsg);

      // Verify that there is NO close / dismiss button inside the targeted announcement banner
      const dismissBtn = banner.locator('button, [aria-label*="dismiss" i], [aria-label*="close" i]');
      await expect(dismissBtn).toHaveCount(0);

      await studentContext.close();
    });

    test('10. Other users cannot see the targeted announcement meant for another user', async ({
      browser,
    }) => {
      // Admin visits student app workspace
      const otherContext = await browser.newContext();
      await loginAsAdmin(otherContext, ADMIN_USER);
      const otherPage = await otherContext.newPage();
      await otherPage.goto('/');

      // Verify the targeted announcement banner does NOT display the student's message
      const banner = otherPage.locator('[data-testid="targeted-announcement-banner"]');
      if (await banner.isVisible()) {
        await expect(banner).not.toContainText(testAnnouncementMsg);
      } else {
        await expect(banner).not.toBeVisible();
      }

      await otherContext.close();
    });

    test('11. Admin can clear the targeted announcement when finished', async ({
      page,
      context,
      browser,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await inspectBtn.click();

      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible();

      const clearBtn = page.locator('[data-testid="clear-announcement-btn"]');
      await expect(clearBtn).toBeVisible({ timeout: 10000 });
      await clearBtn.click();

      await expect(detailDialog).toContainText(/Targeted announcement dispatched|None Active/i, { timeout: 10000 });

      // Verify student no longer sees it
      const studentContext = await browser.newContext();
      await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
      const studentPage = await studentContext.newPage();
      await studentPage.goto('/');

      const banner = studentPage.locator('[data-testid="targeted-announcement-banner"]');
      await expect(banner).not.toBeVisible({ timeout: 8000 });

      await studentContext.close();
    });

    test('12. Admin cannot ban their own account and receives an explicit error message', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      // Locate admin's own ban button if visible in the list
      const adminBanBtn = page.locator(`[data-testid="ban-toggle-btn-${ADMIN_USER.uid}"]`);
      if (await adminBanBtn.isVisible()) {
        await adminBanBtn.click();
        const alert = page.locator('[role="alert"]');
        await expect(alert).toBeVisible({ timeout: 5000 });
        await expect(alert).toContainText(/cannot ban.*own account/i);
      }
    });

    test('13. Submitting invalid user fields displays validation error directly inside inspection dialog', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await inspectBtn.click();

      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible({ timeout: 10000 });

      const emailInput = page.locator('[data-testid="edit-user-email"]');
      await emailInput.fill('not-a-valid-email');

      const saveBtn = page.locator('[data-testid="save-user-changes-btn"]');
      await saveBtn.click();

      // Check that error alert is visible directly inside detailDialog
      const dialogAlert = detailDialog.locator('[role="alert"]');
      await expect(dialogAlert).toBeVisible({ timeout: 5000 });
      await expect(dialogAlert).toContainText(/Invalid email/i);
    });

    test('14. Banned user is rejected from opening real-time SSE stream (/api/realtime)', async ({
      page,
      context,
    }) => {
      // 1. Admin bans the user
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const studentBanBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
      const buttonText = await studentBanBtn.innerText();
      if (!buttonText.includes('Unban')) {
        await studentBanBtn.click();
        await page.waitForTimeout(500);
      }
      await expect(studentBanBtn).toContainText('Unban');

      // 2. Student attempts to fetch /api/realtime
      const studentContext = await page.context().browser()!.newContext();
      await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
      const studentPage = await studentContext.newPage();

      const response = await studentPage.request.get('/api/realtime');
      expect(response.status()).toBe(403);

      await studentContext.close();

      // 3. Admin unbans the student for subsequent tests
      await studentBanBtn.click();
      await expect(studentBanBtn).toContainText('Ban User');
    });

    test('15. Multi-line targeted announcement preserves whitespace and paragraph breaks', async ({
      page,
      context,
      browser,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await inspectBtn.click();

      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible({ timeout: 10000 });

      const multilineMsg = `Paragraph 1: Welcome to the final review.\n\nParagraph 2: Please check your schedule.`;
      const announcementInput = page.locator('[data-testid="targeted-announcement-input"]');
      await announcementInput.fill(multilineMsg);

      const sendBtn = page.locator('[data-testid="send-announcement-btn"]');
      await sendBtn.click();

      await expect(detailDialog).toContainText(/Targeted announcement dispatched/i, { timeout: 10000 });

      // Student visits workspace
      const studentContext = await browser.newContext();
      await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
      const studentPage = await studentContext.newPage();
      await studentPage.goto('/');

      const banner = studentPage.locator('[data-testid="targeted-announcement-banner"]');
      await expect(banner).toBeVisible({ timeout: 10000 });
      await expect(banner).toContainText('Paragraph 1: Welcome to the final review.');
      await expect(banner).toContainText('Paragraph 2: Please check your schedule.');

      // Check computed whitespace style is pre-wrap
      const bannerText = banner.locator('p');
      const whiteSpace = await bannerText.evaluate((el) => window.getComputedStyle(el).whiteSpace);
      expect(whiteSpace).toBe('pre-wrap');

      await studentContext.close();

      // Clean up announcement
      const clearBtn = page.locator('[data-testid="clear-announcement-btn"]');
      await clearBtn.click();
      await page.waitForTimeout(500);
    });

    test('16. Ban reason input field resets cleanly upon unbanning user', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await inspectBtn.click();

      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible({ timeout: 10000 });

      const banReasonInput = page.locator('[data-testid="ban-reason-input"]');
      const banBtn = page.locator('[data-testid="detail-ban-toggle-btn"]');
      const isCurrentlyBanned = (await banBtn.innerText()).includes('Unban');

      if (!isCurrentlyBanned) {
        // Ban the user with a custom reason
        await banReasonInput.fill('Violation of academic integrity');
        await banBtn.click();
        await expect(banBtn).toContainText('Unban User', { timeout: 10000 });
      }

      // Now unban the user
      await banBtn.click();
      await expect(banBtn).toContainText('Ban User', { timeout: 10000 });

      // Verify the ban reason input is cleared
      await expect(banReasonInput).toHaveValue('');
    });

    test('17. Whitespace-only announcement is disabled and cannot be dispatched', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await inspectBtn.click();

      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible({ timeout: 10000 });

      const announcementInput = page.locator('[data-testid="targeted-announcement-input"]');
      const sendBtn = page.locator('[data-testid="send-announcement-btn"]');

      // Fill with only spaces
      await announcementInput.fill('     ');
      await expect(sendBtn).toBeDisabled();
    });

    test('18. Banned user visiting root directly receives Account Suspended lockout screen without workspace loading errors', async ({
      page,
      context,
      browser,
    }) => {
      // 1. Ensure student is banned
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      const banBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
      const btnText = await banBtn.innerText();
      if (!btnText.includes('Unban')) {
        await banBtn.click();
        await expect(banBtn).toContainText('Unban', { timeout: 10000 });
      }

      // 2. Open new context for student
      const studentContext = await browser.newContext();
      await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER);
      const studentPage = await studentContext.newPage();
      await studentPage.goto('/');

      // 3. Verify Account Suspended is displayed and NO generic Could Not Load Workspace box
      const lockoutScreen = studentPage.locator('[data-testid="banned-lockout-screen"]');
      await expect(lockoutScreen).toBeVisible({ timeout: 10000 });
      await expect(studentPage.locator('body')).not.toContainText('Could Not Load Workspace');
      await expect(studentPage.locator('button', { hasText: 'Retry Connection' })).toHaveCount(0);

      await studentContext.close();

      // Clean up: unban student
      await banBtn.click();
      await expect(banBtn).toContainText('Ban User', { timeout: 10000 });
    });

    test('19. Ban reason is isolated and does not leak when banning a user directly from table row', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin/users');

      // 1. Open student dialog and draft a reason
      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await inspectBtn.click();

      const detailDialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(detailDialog).toBeVisible({ timeout: 10000 });

      const banReasonInput = page.locator('[data-testid="ban-reason-input"]');
      await banReasonInput.fill('Confidential draft note that should not leak');

      // 2. Close the dialog without banning
      const closeBtn = detailDialog.getByRole('button', { name: /close/i }).first();
      await closeBtn.click();
      await expect(detailDialog).not.toBeVisible();

      // 3. Toggle ban directly from table row
      const banBtn = page.locator(`[data-testid="ban-toggle-btn-${UNAUTHORIZED_USER.uid}"]`);
      const btnText = await banBtn.innerText();
      if (!btnText.includes('Unban')) {
        await banBtn.click();
        await expect(banBtn).toContainText('Unban', { timeout: 10000 });
      }

      // 4. Re-open inspection dialog and verify the active ban reason does not contain the leaked draft
      await inspectBtn.click();
      await expect(detailDialog).toBeVisible({ timeout: 10000 });

      // Active Ban Reason text should be the default, not the unsubmitted draft note
      await expect(detailDialog).not.toContainText('Confidential draft note that should not leak');

      // 5. Clean up: unban
      const detailBanBtn = page.locator('[data-testid="detail-ban-toggle-btn"]');
      await detailBanBtn.click();
      await expect(detailBanBtn).toContainText('Ban User', { timeout: 10000 });
    });
  });
});

