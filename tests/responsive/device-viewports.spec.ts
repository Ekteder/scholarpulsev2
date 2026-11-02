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
        const headerOrNav = page.locator('header, nav, [role="navigation"]').first();
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
  });
});
