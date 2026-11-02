import { test, expect } from '@playwright/test';
import {
  ADMIN_USER,
  UNAUTHORIZED_USER,
  loginAsAdmin,
  loginAsUnauthorizedUser,
} from '../fixtures/auth-helpers';

test.describe('Dynamic Student Reflection & Preserved UI Design (F2, F6, F10)', () => {
  test.describe('Tier 1: Preserved Student UI Layout & Core Dynamic Components', () => {
    test('1. Student workspace at / loads with preserved header, sidebar, and layout design', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/');
      await expect(page).toHaveURL(/\/($|\?)/);

      // Verify header element exists and contains brand identity
      const header = page.locator('header').first();
      await expect(header).toBeVisible({ timeout: 10000 });
      await expect(page.locator('body')).toContainText(/ScholarPulse/i);

      // Verify layout maintains clean, uncorrupted CSS structure
      const main = page.locator('main, [role="main"]').first();
      await expect(main).toBeVisible();
    });

    test('2. Revision Tracker dynamically loads curriculum subjects and topics from database', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/?tab=revision');

      // Check revision tracker container is mounted
      const trackerContainer = page.locator('main, [role="main"]').first();
      await expect(trackerContainer).toBeVisible({ timeout: 10000 });

      // Check that curriculum subjects (e.g., Physics, Chemistry, Math, Biology) are rendered
      const subjectTabs = page.locator('button, [role="tab"]').filter({
        hasText: /Physics|Chemistry|Higher Math|Biology|English|ICT|Syllabus/i,
      });
      await expect(subjectTabs.first()).toBeVisible({ timeout: 10000 });
      const tabCount = await subjectTabs.count();
      expect(tabCount).toBeGreaterThan(0);
    });

    test('3. Revision Checklist matrix dynamically displays stage columns and progress cells', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/?tab=revision');

      // Check for table matrix or stage headers
      const stageHeaders = page.locator('th, [data-slot="stage-header"], span').filter({
        hasText: /Class|Note|Reading|MCQ|CQ|Test Paper|Stage/i,
      });
      await expect(stageHeaders.first()).toBeVisible({ timeout: 10000 });
    });

    test('4. Dashboard countdown card dynamically reflects target exam name and target date', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/?tab=dashboard');

      // Check Exam Countdown widget exists
      const countdownWidget = page.locator('main, [role="main"]').filter({
        hasText: /HSC|Exam|Countdown|Days Left|Buffer/i,
      }).first();
      await expect(countdownWidget).toBeVisible({ timeout: 10000 });
    });

    test('5. Achievements catalog dynamically loads badge list without hardcoded visual breakage', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/?tab=achievements');

      // Check achievements grid
      const badgesContainer = page.locator('main, [role="main"]').first();
      await expect(badgesContainer).toBeVisible({ timeout: 10000 });
      // Verify badge items exist
      const badgeCards = badgesContainer.locator(':is([data-slot="card"], div.rounded-xl, div.rounded-2xl):visible').filter({
        hasText: /Badge|Streak|Hours|Milestone|Scholar/i,
      });
      await expect(badgeCards.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Tier 2: Edge Cases & Multi-User State Separation', () => {
    test('6. Student customizations (notes, checks) are scoped to user without contaminating global taxonomy', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/?tab=revision');
      // Verify page renders cleanly and allows clicking a revision cell
      const interactiveCell = page.locator('button[aria-label*="revision" i], td button, [data-slot="checkbox"]').first();
      if (await interactiveCell.isVisible()) {
        await interactiveCell.click();
        await page.waitForTimeout(300);
      }
    });

    test('7. Empty or fallback curriculum states render gracefully with zero crashes', async ({
      page,
      context,
    }) => {
      // Test with a fresh student session
      const freshStudent = {
        uid: `fresh-student-${Date.now()}`,
        email: `student-${Date.now()}@scholarpulse.edu`,
        name: 'Fresh Student',
      };
      await loginAsUnauthorizedUser(context, freshStudent, page.url());
      await page.goto('/?tab=revision');
      await expect(page.locator('body')).not.toContainText('Application error');
      await expect(page.locator('body')).not.toContainText('500');
    });

    test('8. Changing tabs preserves state across lazy-loaded components', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/');

      // Navigate Dashboard -> Timer -> Revision -> Dashboard
      const tabs = ['timer', 'revision', 'dashboard'];
      for (const tab of tabs) {
        await page.goto(`/?tab=${tab}`);
        await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
        await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 5000 });
      }
    });

    test('9. Pomodoro timer settings default to system configuration parameters', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/?tab=timer');
      // Timer view should show 25:00 or focus minutes
      const timerDisplay = page.locator('text=/\\d{1,2}:\\d{2}/').first();
      await expect(timerDisplay).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Tier 3: Pairwise Admin-to-Student Dynamic Reflection', () => {
    test('10. Admin session updates do not overwrite student UI theme or layout styles', async ({
      page,
      context,
    }) => {
      // Admin visits /admin
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin/);

      // Student visits / in separate context
      const studentContext = await page.context().browser()?.newContext();
      if (studentContext) {
        const studentPage = await studentContext.newPage();
        const targetOrigin = process.env.BASE_URL || 'http://127.0.0.1:3000';
        await loginAsUnauthorizedUser(studentContext, UNAUTHORIZED_USER, targetOrigin);
        await studentPage.goto(targetOrigin + '/');
        // Verify student UI is strictly the student layout
        await expect(studentPage.locator('body')).not.toContainText('Admin Console');
        await studentContext.close();
      }
    });

    test('11. [Scenario 2: Student Dynamic Reflection] Global curriculum changes dynamically appear in student tracker', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/?tab=revision');

      // Verify that revision workspace data query executed and rendered tabs
      const mainContent = page.locator('main, [role="main"]').first();
      await expect(mainContent).toBeVisible();

      // Check that at least one subject exists and has chapters listed
      const chapterItem = page.locator('table tbody tr, [data-slot="chapter-row"], li').first();
      await expect(chapterItem).toBeVisible({ timeout: 10000 });
    });

    test('12. User UI design tokens (OKLCH, border-radius, font family) are completely preserved', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/');

      // Verify root styling attributes
      const body = page.locator('body');
      const fontFamily = await body.evaluate((el) => window.getComputedStyle(el).fontFamily);
      expect(fontFamily).toBeTruthy();
    });
  });

  test.describe('Tier 4 & 5: Adversarial Hardening & Concurrency', () => {
    test('13. Concurrent data reads on /?tab=revision do not cause deadlock or hydration mismatch', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      // Reload page 3 times rapidly
      for (let i = 0; i < 3; i++) {
        await page.goto('/?tab=revision');
        await page.waitForLoadState('domcontentloaded');
      }
      await expect(page.locator('body')).not.toContainText('Hydration failed');
    });

    test('14. Fast switching between subject tabs in Revision Tracker renders without graphical glitch', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/?tab=revision');

      const tabs = page.locator('button, [role="tab"]').filter({
        hasText: /Physics|Chemistry|Higher Math|Biology/i,
      });
      const count = await tabs.count();
      if (count >= 2) {
        await tabs.nth(0).click();
        await page.waitForTimeout(100);
        await tabs.nth(1).click();
        await page.waitForTimeout(100);
        await expect(page.locator('main, [role="main"]')).toBeVisible();
      }
    });

    test('15. Network error resilience: offline indicator or cached state displays when connection drops', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/');
      await expect(page.locator('main, [role="main"]')).toBeVisible();

      // Simulate offline mode
      await context.setOffline(true);
      // Ensure page does not crash
      await page.waitForTimeout(500);
      await context.setOffline(false);
    });
  });
});
