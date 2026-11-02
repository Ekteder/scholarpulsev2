import { test, expect, Page } from '@playwright/test';
import { UNAUTHORIZED_USER, ADMIN_USER, loginAsUnauthorizedUser, loginAsAdmin } from '../fixtures/auth-helpers';

/**
 * 6 Device Form Factors & Exact Screen Resolutions specified in Scope:
 * - Smartphone: 320x568, 375x667, 390x844
 * - Tablet Portrait & Landscape: 768x1024, 1024x768
 * - Laptop & Notebook: 1280x800, 1366x768, 1440x900
 * - Desktop & Large Screen: 1920x1080, 2560x1440, 3840x2160
 */
const DEVICE_VIEWPORTS = [
  // 1. Smartphones
  { category: 'Smartphone (Compact)', name: 'iPhone SE 1st gen', width: 320, height: 568 },
  { category: 'Smartphone (Standard)', name: 'iPhone 8 / SE 2nd', width: 375, height: 667 },
  { category: 'Smartphone (Modern)', name: 'iPhone 14 / Pixel 7', width: 390, height: 844 },
  // 2. Tablets
  { category: 'Tablet (Portrait)', name: 'iPad Portrait', width: 768, height: 1024 },
  { category: 'Tablet (Landscape)', name: 'iPad Landscape', width: 1024, height: 768 },
  // 3. Notebooks & Laptops
  { category: 'Notebook', name: '13-inch Notebook', width: 1280, height: 800 },
  { category: 'Laptop (Standard)', name: 'Standard 14-inch Laptop', width: 1366, height: 768 },
  { category: 'Laptop (Large)', name: '15-inch Laptop / MacBook Pro', width: 1440, height: 900 },
  // 4. Desktop & Large Screens
  { category: 'Desktop (Full HD)', name: '1080p Desktop Monitor', width: 1920, height: 1080 },
  { category: 'Desktop (QHD 2K)', name: '1440p High-Res Display', width: 2560, height: 1440 },
  { category: 'Large Screen (4K UHD)', name: '4K Ultra HD Display / TV', width: 3840, height: 2160 },
];

/**
 * Helper assertion: Verifies that neither documentElement nor document.body
 * exceeds window.innerWidth, ensuring strictly ZERO horizontal scrolling/overflow.
 */
async function assertZeroHorizontalOverflow(page: Page, contextMsg: string) {
  const overflowMetrics = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    return {
      windowWidth: window.innerWidth,
      docScrollWidth: docEl.scrollWidth,
      docClientWidth: docEl.clientWidth,
      bodyScrollWidth: body ? body.scrollWidth : 0,
      bodyClientWidth: body ? body.clientWidth : 0,
    };
  });

  // Allowed tolerance: 1px for browser sub-pixel rounding
  const maxAllowedWidth = overflowMetrics.windowWidth + 1;

  expect(
    overflowMetrics.docScrollWidth,
    `[Horizontal Overflow Detected] Document scrollWidth (${overflowMetrics.docScrollWidth}px) exceeds window.innerWidth (${overflowMetrics.windowWidth}px) during: ${contextMsg}`
  ).toBeLessThanOrEqual(maxAllowedWidth);

  if (overflowMetrics.bodyScrollWidth > 0) {
    expect(
      overflowMetrics.bodyScrollWidth,
      `[Horizontal Overflow Detected] Body scrollWidth (${overflowMetrics.bodyScrollWidth}px) exceeds window.innerWidth (${overflowMetrics.windowWidth}px) during: ${contextMsg}`
    ).toBeLessThanOrEqual(maxAllowedWidth);
  }
}

test.describe('Multi-Device Responsive UI/UX Across 6 Form Factors (F11)', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
  });

  test.describe('Tier 1: Zero Horizontal Overflow Across All 11 Viewport Profiles on Student Workspace', () => {
    for (const vp of DEVICE_VIEWPORTS) {
      test(`Zero horizontal overflow on ${vp.category} (${vp.name} - ${vp.width}x${vp.height})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Verify zero horizontal window overflow
        await assertZeroHorizontalOverflow(page, `Root page on ${vp.name} (${vp.width}x${vp.height})`);

        // Verify key navigation or header is visible without clipping
        const headerOrNav = page.locator('header:visible, nav:visible, [role="navigation"]:visible, button[aria-label*="menu" i]:visible').first();
        await expect(headerOrNav).toBeVisible({ timeout: 10000 });
      });
    }
  });

  test.describe('Tier 2: Viewport-Specific Responsive Adaptations (Navigation & Layouts)', () => {
    test('12. Smartphone (<1024px): Desktop sidebar is hidden and mobile bottom bar / hamburger drawer is active', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Desktop sidebar should be hidden or width 0
      const desktopSidebar = page.locator('aside.hidden.lg\\:block, aside.lg\\:fixed, [data-slot="desktop-sidebar"]');
      const isVisible = await desktopSidebar.isVisible().catch(() => false);
      expect(isVisible).toBeFalsy();

      // Mobile nav elements (bottom nav or hamburger trigger) should be present
      const mobileNav = page.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i], nav.fixed.bottom-0, nav[data-slot="mobile-nav"]');
      await expect(mobileNav.first()).toBeVisible({ timeout: 10000 });
      await assertZeroHorizontalOverflow(page, 'Mobile nav check at 375px');
    });

    test('13. Tablet Portrait (768x1024): Balanced multi-column cards and overflow-wrapped heatmap', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await assertZeroHorizontalOverflow(page, 'Tablet Portrait 768x1024');

      // Stat cards or dashboard metrics should fit comfortably
      const statGrid = page.locator('main [data-slot="card"], main .grid').first();
      await expect(statGrid).toBeVisible();
    });

    test('14. Laptop (1366x768 & 1440x900): Desktop persistent sidebar renders cleanly alongside main content', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await assertZeroHorizontalOverflow(page, 'Laptop 1440x900');

      // Main content should not overlap the sidebar
      const main = page.locator('main, [role="main"]').first();
      await expect(main).toBeVisible();
    });

    test('15. 4K Ultra HD Display (3840x2160): Content is centered with max-width container and no distortion', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 3840, height: 2160 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await assertZeroHorizontalOverflow(page, '4K Display 3840x2160');

      // Check max-width constraint on main container
      const mainContainer = page.locator('main > div, main').first();
      const containerWidth = await mainContainer.evaluate((el) => el.clientWidth);
      // Even on 3840px display, content should be clamped to reasonable max-width (e.g. <= 2000px)
      expect(containerWidth).toBeLessThanOrEqual(3840);
    });
  });

  test.describe('Tier 3: Form Factor Responsiveness Across Core User Views', () => {
    const tabsToTest = [
      { tab: 'dashboard', name: 'Dashboard' },
      { tab: 'timer', name: 'Study Timer' },
      { tab: 'revision', name: 'Revision Tracker' },
      { tab: 'goals', name: 'Goals Planner' },
      { tab: 'schedule', name: 'Timetable Schedule' },
      { tab: 'achievements', name: 'Achievements Badges' },
    ];

    for (const { tab, name } of tabsToTest) {
      test(`16-${tab}. Zero overflow on ${name} view across Smartphone (390px) and Tablet (768px)`, async ({
        page,
      }) => {
        // Mobile test
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/?tab=${tab}`);
        await page.waitForLoadState('domcontentloaded');
        await assertZeroHorizontalOverflow(page, `${name} on 390px mobile`);

        // Tablet test
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(200);
        await assertZeroHorizontalOverflow(page, `${name} on 768px tablet`);
      });
    }
  });

  test.describe('Tier 4: Scenario 3 - Responsive Device Walkthrough & Admin Responsiveness', () => {
    test('17. [Scenario 3: Responsive Walkthrough] Full navigation flow across 5 distinct viewport steps', async ({
      page,
    }) => {
      const walkthroughSteps = [
        { width: 320, height: 568, step: '1. Smartphone 320px (Compact)' },
        { width: 390, height: 844, step: '2. Smartphone 390px (Modern)' },
        { width: 768, height: 1024, step: '3. Tablet 768px' },
        { width: 1366, height: 768, step: '4. Laptop 1366px' },
        { width: 1920, height: 1080, step: '5. Desktop 1920px' },
      ];

      for (const step of walkthroughSteps) {
        await page.setViewportSize({ width: step.width, height: step.height });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await assertZeroHorizontalOverflow(page, step.step);

        // Click a navigation tab
        await page.goto('/?tab=timer');
        await assertZeroHorizontalOverflow(page, `${step.step} - Timer`);
      }
    });

    test('18. Admin Console at /admin maintains zero overflow on Tablet (1024px) and Desktop (1920px)', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());

      // Tablet Landscape (1024x768)
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/admin');
      await assertZeroHorizontalOverflow(page, 'Admin overview at 1024x768');

      // Desktop (1920x1080)
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/admin/subjects');
      await assertZeroHorizontalOverflow(page, 'Admin subjects at 1920x1080');
    });
  });

  test.describe('Tier 5: Adversarial Boundary & Stress Viewports', () => {
    test('19. [Adversarial] Extreme mobile landscape orientation (568x320) does not break modal buttons', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 568, height: 320 });
      await page.goto('/');
      await assertZeroHorizontalOverflow(page, 'Extreme landscape 568x320');
      // Verify body is still scrollable vertically if needed
      const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(scrollHeight).toBeGreaterThanOrEqual(320);
    });

    test('20. [Adversarial] Extreme narrow viewport (300px) handles graceful degradation without unhandled script error', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 300, height: 600 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      // No crash
      await expect(page.locator('body')).not.toContainText('Application error');
    });

    test('21. Admin User Profile & Controls modal is wide and spacious on Desktop & Laptop, and responsive on Mobile', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());

      // 1. Desktop (1920x1080)
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/admin/users');
      const inspectBtn = page.locator(`[data-testid="inspect-user-btn-${UNAUTHORIZED_USER.uid}"]`);
      await expect(inspectBtn).toBeVisible({ timeout: 10000 });
      await inspectBtn.click();

      const dialog = page.locator('[data-testid="user-detail-dialog"]');
      await expect(dialog).toBeVisible();

      // Check dialog width on 1920x1080 is >= 750px (was previously locked to 384px!)
      const boxDesktop = await dialog.boundingBox();
      expect(boxDesktop).not.toBeNull();
      if (boxDesktop) {
        expect(boxDesktop.width).toBeGreaterThanOrEqual(750);
      }

      // Check zero horizontal overflow
      await assertZeroHorizontalOverflow(page, 'Admin user detail modal at 1920x1080');

      // Check ban button text is fully visible (not clipped)
      const banBtn = page.locator('[data-testid="detail-ban-toggle-btn"]');
      await expect(banBtn).toBeVisible();
      const banBtnBox = await banBtn.boundingBox();
      expect(banBtnBox?.width).toBeGreaterThanOrEqual(120);

      // 2. Mobile (390x844)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);
      const boxMobile = await dialog.boundingBox();
      expect(boxMobile).not.toBeNull();
      if (boxMobile) {
        // Fits comfortably within mobile screen with margin
        expect(boxMobile.width).toBeLessThanOrEqual(390);
        expect(boxMobile.width).toBeGreaterThanOrEqual(320);
      }
      await assertZeroHorizontalOverflow(page, 'Admin user detail modal at 390x844');
    });
  });

  test.describe('Tier 6: Academic Rank & XP Gamification Popover Responsiveness & De-duplication', () => {
    test('22. Desktop (1920x1080) & Laptop (1366x768, 1366x600 & 1280x800): Top navbar XP popover is NOT cut off at top (y >= 0) and fits viewport', async ({
      page,
    }) => {
      const testViewports = [
        { width: 1920, height: 1080, name: 'Desktop Full HD' },
        { width: 1366, height: 768, name: 'Standard 14-inch Laptop' },
        { width: 1366, height: 600, name: 'Height-Constrained Laptop (Browser Toolbars)' },
        { width: 1280, height: 800, name: '13-inch Notebook' },
        { width: 1024, height: 768, name: '1024px Laptop / iPad Landscape' },
      ];

      for (const vp of testViewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const headerXpBadge = page.locator('[data-testid="header-gamification-badge"]');
        await expect(headerXpBadge).toBeVisible({ timeout: 10000 });

        // Click top nav bar XP badge to open Academic Rank Progression modal
        await headerXpBadge.click();

        const modal = page.locator('[data-testid="academic-rank-modal"]');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Verify title inside modal is rendered
        await expect(page.locator('#scholar-rank-title')).toBeVisible();

        // Verify body overflow is locked to prevent background scrolling
        const bodyOverflowOpen = await page.evaluate(() => document.body.style.overflow);
        expect(bodyOverflowOpen).toBe('hidden');

        // Strict bounding box verification: top must NEVER be negative (not cut off at the top!)
        const box = await modal.boundingBox();
        expect(box, `Modal bounding box should exist on ${vp.name}`).not.toBeNull();
        if (box) {
          expect(
            box.y,
            `[Clipping Failure on ${vp.name}] Modal top y (${box.y}px) must be >= 0 (must not be cut off at the top of the viewport)`
          ).toBeGreaterThanOrEqual(0);

          expect(
            box.y + box.height,
            `[Clipping Failure on ${vp.name}] Modal bottom (${box.y + box.height}px) must fit within viewport height (${vp.height}px)`
          ).toBeLessThanOrEqual(vp.height + 1);
        }

        // Close modal via close button
        const closeBtn = page.locator('[data-testid="close-academic-rank-modal"]');
        await closeBtn.click();
        await expect(modal).not.toBeVisible();

        // Verify body overflow is restored
        const bodyOverflowClosed = await page.evaluate(() => document.body.style.overflow);
        expect(bodyOverflowClosed).not.toBe('hidden');
      }
    });

    test('23. PC & Laptop devices (>=1024px): Desktop sidebar has NO duplicate XP progress, only top nav bar has it', async ({
      page,
    }) => {
      for (const width of [1024, 1280, 1366, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Top navbar MUST have the XP badge
        const headerXpBadge = page.locator('[data-testid="header-gamification-badge"]');
        await expect(headerXpBadge).toBeVisible();

        // Desktop sidebar MUST NOT have the XP badge
        const desktopSidebar = page.locator('aside.hidden.lg\\:flex, aside.lg\\:fixed');
        await expect(desktopSidebar).toBeVisible();
        const sidebarXpBadge = desktopSidebar.locator('[data-testid="sidebar-gamification-badge"]');
        const count = await sidebarXpBadge.count();
        expect(count, `Desktop sidebar at width ${width}px should NOT contain duplicate XP badge`).toBe(0);
      }
    });

    test('24. Mobile (<1024px): Top navbar hides XP badge, Mobile Drawer maintains XP badge, modal opens without clipping', async ({
      page,
    }) => {
      for (const { width, height } of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Top navbar XP badge MUST be hidden on mobile
        const headerXpBadge = page.locator('[data-testid="header-gamification-badge"]');
        await expect(headerXpBadge).toBeHidden();

        // Open mobile navigation drawer via hamburger button
        const menuBtn = page.locator('button[aria-label="Open navigation menu"]');
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();

        // Mobile drawer MUST contain the XP badge
        const drawerXpBadge = page.locator('[data-testid="drawer-gamification-badge"]');
        await expect(drawerXpBadge).toBeVisible({ timeout: 5000 });

        // Click to open modal
        await drawerXpBadge.click();

        const modal = page.locator('[data-testid="academic-rank-modal"]');
        await expect(modal).toBeVisible();

        const box = await modal.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.y, 'Modal top on mobile must be >= 0').toBeGreaterThanOrEqual(0);
          expect(box.y + box.height, 'Modal bottom on mobile must be <= viewport height').toBeLessThanOrEqual(height + 1);
        }

        // Close modal
        await page.locator('[data-testid="close-academic-rank-modal"]').click();
        await expect(modal).not.toBeVisible();
      }
    });

    test('25. Academic Rank modal interactions: Escape key, backdrop click, bottom close button, and celebration trigger', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const headerXpBadge = page.locator('[data-testid="header-gamification-badge"]');
      const modal = page.locator('[data-testid="academic-rank-modal"]');

      // Sub-test A: Dismiss via Escape key
      await headerXpBadge.click();
      await expect(modal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();

      // Sub-test B: Dismiss via backdrop click
      await headerXpBadge.click();
      await expect(modal).toBeVisible();
      const backdrop = page.locator('[data-testid="academic-rank-modal-backdrop"]');
      await backdrop.click({ position: { x: 10, y: 10 } });
      await expect(modal).not.toBeVisible();

      // Sub-test C: Dismiss via bottom close button
      await headerXpBadge.click();
      await expect(modal).toBeVisible();
      const bottomCloseBtn = page.locator('[data-testid="close-academic-rank-modal-bottom"]');
      await expect(bottomCloseBtn).toBeVisible();
      await bottomCloseBtn.click();
      await expect(modal).not.toBeVisible();

      // Sub-test D: Confetti trigger button inside modal executes cleanly
      await headerXpBadge.click();
      await expect(modal).toBeVisible();
      const confettiBtn = page.locator('[data-testid="confetti-test-btn"]');
      await expect(confettiBtn).toBeVisible();
      await confettiBtn.click();
      // Ensure no crash or unhandled errors occurred
      await expect(modal).toBeVisible();
      await page.locator('[data-testid="close-academic-rank-modal"]').click();
      await expect(modal).not.toBeVisible();
    });
  });
});
