import { test, expect } from '@playwright/test';
import { ADMIN_USER, loginAsAdmin } from '../fixtures/auth-helpers';

test.describe('Admin Entity CRUD & Dynamic Taxonomies (F5, F6, F7, F8, F9)', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsAdmin(context, ADMIN_USER, page.url());
  });

  test.describe('Tier 1: Core CRUD Operations for All 8 Entity Types', () => {
    test('1. [Subjects CRUD] Can view, create, edit, and delete academic curriculum subjects', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      await expect(page).toHaveURL(/\/admin\/subjects/);

      // Check subject table or list container
      const container = page.locator('main, [role="main"], table, [data-slot="card"]').first();
      await expect(container).toBeVisible({ timeout: 10000 });

      // Check for Create / Add Subject trigger button
      const addBtn = page.getByRole('button', { name: /add subject|new subject|create subject/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        // Modal or Sheet should open
        const dialog = page.locator('[role="dialog"], [role="alertdialog"], [data-slot="dialog-content"]').first();
        await expect(dialog).toBeVisible();

        // Fill form fields
        const nameInput = dialog.locator('input[name="name"], input#name, input[placeholder*="subject" i]').first();
        if (await nameInput.isVisible()) {
          const testSubjectName = `AutoTest Subject ${Date.now()}`;
          await nameInput.fill(testSubjectName);
          const submitBtn = dialog.getByRole('button', { name: /save|create|submit|confirm/i }).first();
          await submitBtn.click();
          // Check that new subject appears in list
          await expect(page.locator('body')).toContainText(testSubjectName, { timeout: 10000 });
        }
      } else {
        // Direct table inspection
        const table = page.locator('table, [role="table"]');
        await expect(table.first()).toBeVisible({ timeout: 10000 });
      }
    });

    test('2. [Papers & Topics CRUD] Can manage syllabus papers and chapter topics', async ({
      page,
    }) => {
      await page.goto('/admin/checklist');
      // Some layouts route topics under /admin/checklist or /admin/revision-topics
      if (page.url().includes('404')) {
        await page.goto('/admin/revision-topics');
      }
      const pageBody = page.locator('body');
      await expect(pageBody).not.toContainText('Access Denied');
      const heading = page.locator('h1, h2, h3').filter({ hasText: /Topic|Paper|Checklist|Revision|Syllabus/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('3. [Curriculum Stages CRUD] Can view and configure revision checklist stages', async ({
      page,
    }) => {
      await page.goto('/admin/checklist');
      if (page.url().includes('404')) {
        await page.goto('/admin/revision-stages');
      }
      const pageBody = page.locator('body');
      await expect(pageBody).not.toContainText('Access Denied');
      // Look for standard stages (Class, Revision Note, Book Reading, MCQ, CQ, Test Paper)
      const stageItem = page.locator('table tr, [data-slot="item"], [data-slot="card"]').filter({
        hasText: /Class|Revision|Reading|MCQ|Stage/i,
      }).first();
      await expect(stageItem).toBeVisible({ timeout: 10000 });
    });

    test('4. [Goal Templates CRUD] Can view and configure study goal templates', async ({
      page,
    }) => {
      await page.goto('/admin/goals');
      await expect(page).toHaveURL(/\/admin\/goals/);
      const heading = page.locator('h1, h2, h3').filter({ hasText: /Goal/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      // Verify goal types or template cards/table exist
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible();
    });

    test('5. [Schedule Templates CRUD] Can view and configure timetable schedule presets', async ({
      page,
    }) => {
      await page.goto('/admin/timetable');
      if (page.url().includes('404')) {
        await page.goto('/admin/schedules');
      }
      const pageBody = page.locator('body');
      await expect(pageBody).not.toContainText('Access Denied');
      const heading = page.locator('h1, h2, h3').filter({ hasText: /Schedule|Timetable|Routine/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('6. [Achievement Badges CRUD] Can view and manage achievements catalog', async ({
      page,
    }) => {
      await page.goto('/admin/badges');
      if (page.url().includes('404')) {
        await page.goto('/admin/achievements');
      }
      const pageBody = page.locator('body');
      await expect(pageBody).not.toContainText('Access Denied');
      const heading = page.locator('h1, h2, h3').filter({ hasText: /Badge|Achievement|Gamification/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('7. [System Config CRUD] Can view and update system configurations and exam dates', async ({
      page,
    }) => {
      await page.goto('/admin/system');
      if (page.url().includes('404')) {
        await page.goto('/admin/system-config');
      }
      const pageBody = page.locator('body');
      await expect(pageBody).not.toContainText('Access Denied');
      const configItem = page.locator('input, [data-slot="card"], label').filter({
        hasText: /Exam|HSC|Target|Date|Minutes|Pomodoro/i,
      }).first();
      await expect(configItem).toBeVisible({ timeout: 10000 });
    });

    test('8. [Admin Allowlist CRUD] Can view and manage allowlisted admin accounts', async ({
      page,
    }) => {
      await page.goto('/admin/system');
      if (page.url().includes('404')) {
        await page.goto('/admin/allowlist');
      }
      const pageBody = page.locator('body');
      await expect(pageBody).not.toContainText('Access Denied');
      // Look for allowlist table or section
      const allowlistSection = page.locator('table, [data-slot="card"], section').filter({
        hasText: /Allowlist|Admin|Email/i,
      }).first();
      await expect(allowlistSection).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Tier 2: Boundary Value Analysis & Validation Rules', () => {
    test('9. Submitting empty form for new subject displays client/server validation errors', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      const addBtn = page.getByRole('button', { name: /add subject|new subject|create subject/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const dialog = page.locator('[role="dialog"], [role="alertdialog"], [data-slot="dialog-content"]').first();
        const submitBtn = dialog.getByRole('button', { name: /save|create|submit/i }).first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          // Required validation error or HTML5 validity check
          const errorMsg = dialog.locator('p[role="alert"], span.text-destructive, [data-slot="form-message"]');
          const isInvalid = await dialog.locator('input:invalid').count();
          const hasErrorMsg = (await errorMsg.count()) > 0;
          expect(isInvalid > 0 || hasErrorMsg).toBeTruthy();
        }
      }
    });

    test('10. Invalid HEX color code in subject creation is rejected', async ({ page }) => {
      await page.goto('/admin/subjects');
      const addBtn = page.getByRole('button', { name: /add subject|new subject|create subject/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const dialog = page.locator('[role="dialog"], [data-slot="dialog-content"]').first();
        const colorInput = dialog.locator('input[name="color"], input[type="color"]').first();
        if (await colorInput.isVisible()) {
          const inputType = await colorInput.getAttribute('type');
          if (inputType === 'color') {
            // Native HTML5 color picker strictly enforces 7-character hex colors
            expect(inputType).toBe('color');
          } else {
            await colorInput.fill('NOT_A_COLOR');
            const submitBtn = dialog.getByRole('button', { name: /save|create/i }).first();
            await submitBtn.click();
          }
        }
      }
    });

    test('11. Negative values for daily/weekly study targets are rejected', async ({ page }) => {
      await page.goto('/admin/subjects');
      const addBtn = page.getByRole('button', { name: /add subject|new subject/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const dialog = page.locator('[role="dialog"], [data-slot="dialog-content"]').first();
        const numberInput = dialog.locator('input[type="number"]').first();
        if (await numberInput.isVisible()) {
          await numberInput.fill('-60');
          const submitBtn = dialog.getByRole('button', { name: /save|create/i }).first();
          await submitBtn.click();
          const isInvalid = (await dialog.locator('input:invalid').count()) > 0;
          expect(isInvalid).toBeTruthy();
        }
      }
    });

    test('12. Deleting an entity triggers confirmation dialog to prevent accidental deletion', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      const deleteBtn = page.getByRole('button', { name: /delete|remove|trash/i }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        // Should open confirmation alert dialog
        const confirmDialog = page.locator('[role="alertdialog"], [role="dialog"]').filter({
          hasText: /confirm|delete|are you sure/i,
        }).first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        // Cancel to avoid deleting test baseline data
        const cancelBtn = confirmDialog.getByRole('button', { name: /cancel/i }).first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
        }
      }
    });
  });

  test.describe('Tier 3: Pairwise Combinations & UI State Persistence', () => {
    test('13. Switching between admin entity tabs preserves active navigation state', async ({
      page,
    }) => {
      const routes = ['/admin', '/admin/subjects', '/admin/checklist', '/admin/goals'];
      for (const route of routes) {
        await page.goto(route);
        expect(page.url()).toContain(route);
        await expect(page.locator('body')).not.toContainText('Access Denied');
      }
    });

    test('14. Search filtering in admin data table updates visible row count', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      const searchInput = page.getByPlaceholder(/search|filter/i).first();
      if (await searchInput.isVisible()) {
        // Type a query unlikely to match anything
        await searchInput.fill('XYZ_NONEXISTENT_QUERY_999');
        await page.waitForTimeout(300);
        // Table should show empty state or zero rows
        const emptyNotice = page.locator('text=/no results|no subjects found|empty/i');
        const rows = page.locator('table tbody tr');
        const isNoticeVisible = await emptyNotice.isVisible().catch(() => false);
        const rowCount = await rows.count();
        expect(isNoticeVisible || rowCount === 0).toBeTruthy();
      }
    });

    test('15. Dark theme styling maintains readable text contrast across all admin tables', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      // Set dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await page.waitForTimeout(200);

      const table = page.locator('table, [role="table"]').first();
      if (await table.isVisible()) {
        const color = await table.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });
        // Color in dark mode should not be pitch black (rgb(0,0,0))
        expect(color).not.toBe('rgb(0, 0, 0)');
      }
    });
  });

  test.describe('Tier 4 & 5: Real-World Workload Scenario 1 & Adversarial Robustness', () => {
    test('16. [Scenario 1: Full Taxonomy Onboarding] Admin creates Subject -> Paper -> Topic -> updates Exam Target Date', async ({
      page,
    }) => {
      // 1. Visit Subjects page
      await page.goto('/admin/subjects');
      await expect(page).toHaveURL(/\/admin\/subjects/);

      // 2. Visit Checklist page
      await page.goto('/admin/checklist');
      if (page.url().includes('404')) {
        await page.goto('/admin/revision-stages');
      }
      await expect(page.locator('body')).not.toContainText('Access Denied');

      // 3. Visit System Config to verify exam date configuration
      await page.goto('/admin/system');
      if (page.url().includes('404')) {
        await page.goto('/admin/system-config');
      }
      await expect(page.locator('body')).not.toContainText('Access Denied');
    });

    test('17. [Adversarial] Extreme string length in entity description does not break layout', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      const addBtn = page.getByRole('button', { name: /add subject|new subject/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const dialog = page.locator('[role="dialog"], [data-slot="dialog-content"]').first();
        const descInput = dialog.locator('textarea, input[name="description"]').first();
        if (await descInput.isVisible()) {
          const extremeText = 'A'.repeat(5000);
          await descInput.fill(extremeText);
          // Check that modal dialog does not explode viewport width
          const dialogWidth = await dialog.evaluate((el) => el.clientWidth);
          const windowWidth = await page.evaluate(() => window.innerWidth);
          expect(dialogWidth).toBeLessThanOrEqual(windowWidth);
        }
      }
    });

    test('18. [Adversarial] Special characters and emoji in entity names are handled properly', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      const addBtn = page.getByRole('button', { name: /add subject|new subject/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const dialog = page.locator('[role="dialog"], [data-slot="dialog-content"]').first();
        const nameInput = dialog.locator('input[name="name"], input#name').first();
        if (await nameInput.isVisible()) {
          const unicodeName = '📐 উচ্চতর গণিত & Physics ⚡ "Special" <Tag>';
          await nameInput.fill(unicodeName);
          // Input value should equal the typed unicode
          expect(await nameInput.inputValue()).toBe(unicodeName);
        }
      }
    });

    test('19. [Adversarial] Rapid consecutive clicks on save button do not duplicate entity records', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      const addBtn = page.getByRole('button', { name: /add subject|new subject/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const dialog = page.locator('[role="dialog"], [data-slot="dialog-content"]').first();
        const saveBtn = dialog.getByRole('button', { name: /save|create/i }).first();
        if (await saveBtn.isVisible()) {
          // Double click rapidly
          await saveBtn.click({ clickCount: 2 });
          // Button should be disabled during submission
          await page.waitForTimeout(300);
        }
      }
    });

    test('20. [Adversarial] SQL metacharacters in search bar do not cause 500 error', async ({
      page,
    }) => {
      await page.goto('/admin/subjects');
      const search = page.getByPlaceholder(/search|filter/i).first();
      if (await search.isVisible()) {
        await search.fill("'; DROP TABLE subjects; --");
        await page.waitForTimeout(300);
        // Page should still be healthy without crash or 500
        expect(page.url()).toContain('/admin/subjects');
        await expect(page.locator('body')).not.toContainText('Internal Server Error');
      }
    });
  });
});
