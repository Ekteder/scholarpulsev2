import { test, expect, Page } from '@playwright/test';
import { UNAUTHORIZED_USER, loginAsUnauthorizedUser } from '../fixtures/auth-helpers';
import { seedActiveTimerForUser, clearActiveTimerForUser } from '../fixtures/db-timer-helpers';

const MOBILE_VIEWPORTS = [
  { name: 'Compact 320px (iPhone SE 1st gen)', width: 320, height: 568 },
  { name: 'Standard 375px (iPhone 8 / SE 2nd)', width: 375, height: 667 },
  { name: 'Modern 390px (iPhone 14)', width: 390, height: 844 },
  { name: 'Large 430px (iPhone 14 Pro Max)', width: 430, height: 932 },
];

/**
 * Asserts strictly zero horizontal overflow on the document.
 */
async function assertZeroHorizontalOverflow(page: Page, contextMsg: string) {
  const overflowMetrics = await page.evaluate(() => ({
    windowWidth: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body ? document.body.scrollWidth : 0,
  }));

  const maxAllowedWidth = overflowMetrics.windowWidth + 1;
  expect(
    overflowMetrics.docScrollWidth,
    `[Horizontal Overflow] document.scrollWidth (${overflowMetrics.docScrollWidth}px) exceeds window.innerWidth (${overflowMetrics.windowWidth}px) during: ${contextMsg}`
  ).toBeLessThanOrEqual(maxAllowedWidth);

  if (overflowMetrics.bodyScrollWidth > 0) {
    expect(
      overflowMetrics.bodyScrollWidth,
      `[Horizontal Overflow] body.scrollWidth (${overflowMetrics.bodyScrollWidth}px) exceeds window.innerWidth (${overflowMetrics.windowWidth}px) during: ${contextMsg}`
    ).toBeLessThanOrEqual(maxAllowedWidth);
  }
}

test.describe('FloatingMiniTimer Mobile Layout & Icon-Only Noise Toggle (HH:MM:SS format)', () => {
  test.afterAll(async () => {
    await clearActiveTimerForUser(UNAUTHORIZED_USER.uid);
  });

  for (const vp of MOBILE_VIEWPORTS) {
    test(`1. Active 1+ hour timer (01:24:44) on ${vp.name}: icon-only noise button, clean spacing, zero overlap`, async ({
      page,
      context,
    }) => {
      // 1 hour 24 minutes 44 seconds = 5084 seconds
      const elapsed = 5084;
      await seedActiveTimerForUser(UNAUTHORIZED_USER.uid, elapsed);
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/?tab=dashboard');
      await page.waitForLoadState('domcontentloaded');

      // 1. Mini-timer container must be visible
      const miniTimer = page.locator('[data-testid="floating-mini-timer"]');
      await expect(miniTimer).toBeVisible({ timeout: 10000 });

      // 2. Timer digits must show hours format HH:MM:SS (e.g. 01:24:44)
      const timerDigits = page.locator('[data-testid="floating-timer-digits"]');
      await expect(timerDigits).toBeVisible();
      const digitsText = await timerDigits.textContent();
      expect(digitsText).toMatch(/01:\d{2}:\d{2}/);

      // 3. Noise toggle button must be icon-only: NO 'Noise Off' or 'Noise On' text
      const noiseToggle = page.locator('[data-testid="floating-noise-toggle"]');
      await expect(noiseToggle).toBeVisible();
      const noiseToggleText = (await noiseToggle.innerText()).trim();
      expect(noiseToggleText).toBe(''); // Strictly no visible text inside button
      expect(await noiseToggle.textContent()).not.toContain('Noise Off');
      expect(await noiseToggle.textContent()).not.toContain('Noise On');

      // 4. Noise toggle must have appropriate accessible label & title
      const noiseAria = await noiseToggle.getAttribute('aria-label');
      const noiseTitle = await noiseToggle.getAttribute('title');
      expect(noiseAria).toMatch(/Ambient Noise/i);
      expect(noiseTitle).toMatch(/Ambient Noise/i);

      // 5. Sound sliders mixer button must be present
      const noiseSliders = page.locator('[data-testid="floating-noise-sliders"]');
      await expect(noiseSliders).toBeVisible();

      // 6. Action buttons (Pause, Finish, Expand) must be visible
      const pauseBtn = page.locator('[data-testid="floating-timer-pause"]');
      const finishBtn = page.locator('[data-testid="floating-timer-finish"]');
      const expandBtn = page.locator('[data-testid="floating-timer-expand"]');

      await expect(pauseBtn).toBeVisible();
      await expect(finishBtn).toBeVisible();
      await expect(expandBtn).toBeVisible();

      // 7. Non-overlapping Bounding Box Verification:
      // Verify that adjacent control buttons have strictly distinct, non-overlapping horizontal spans
      const buttons = [noiseToggle, noiseSliders, pauseBtn, finishBtn, expandBtn];
      const boxes = [];
      for (const btn of buttons) {
        const box = await btn.boundingBox();
        expect(box, 'Button must have valid bounding box').not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(20);
        expect(box!.height).toBeGreaterThanOrEqual(20);
        boxes.push(box!);
      }

      for (let i = 0; i < boxes.length - 1; i++) {
        const current = boxes[i];
        const next = boxes[i + 1];
        expect(
          current.x + current.width,
          `Button ${i} right edge (${current.x + current.width}px) overlaps Button ${i + 1} left edge (${next.x}px)`
        ).toBeLessThanOrEqual(next.x + 1); // 1px tolerance for sub-pixel rendering
      }

      // 8. Digits must not overlap control buttons
      const digitsBox = await timerDigits.boundingBox();
      expect(digitsBox).not.toBeNull();
      const firstButtonBox = boxes[0];
      expect(
        digitsBox!.x + digitsBox!.width,
        `Timer digits right edge (${digitsBox!.x + digitsBox!.width}px) overlaps first control button left edge (${firstButtonBox.x}px)`
      ).toBeLessThanOrEqual(firstButtonBox.x + 1);

      // 9. Subject and Phase labels must not overlap control buttons
      const subjectLabel = page.locator('[data-testid="floating-timer-subject"]');
      const phaseLabel = page.locator('[data-testid="floating-timer-phase"]');
      if (await subjectLabel.isVisible()) {
        const subBox = await subjectLabel.boundingBox();
        if (subBox) {
          expect(
            subBox.x + subBox.width,
            `Subject label right edge overlaps first button`
          ).toBeLessThanOrEqual(firstButtonBox.x + 1);
        }
      }
      if (await phaseLabel.isVisible()) {
        const phaseBox = await phaseLabel.boundingBox();
        if (phaseBox) {
          expect(
            phaseBox.x + phaseBox.width,
            `Phase label right edge overlaps first button`
          ).toBeLessThanOrEqual(firstButtonBox.x + 1);
        }
      }

      // 10. Floating mini timer fits fully within viewport
      const miniTimerBox = await miniTimer.boundingBox();
      expect(miniTimerBox).not.toBeNull();
      expect(miniTimerBox!.x).toBeGreaterThanOrEqual(0);
      expect(miniTimerBox!.x + miniTimerBox!.width).toBeLessThanOrEqual(vp.width + 1);

      // 11. Zero horizontal window overflow
      await assertZeroHorizontalOverflow(page, `Mini timer 1h on ${vp.name}`);
    });

    test(`2. Multi-hour timer (10:00:00) on ${vp.name}: fits cleanly with zero overlap and zero overflow`, async ({
      page,
      context,
    }) => {
      // 10 hours = 36000 seconds
      const elapsed = 36000;
      await seedActiveTimerForUser(UNAUTHORIZED_USER.uid, elapsed);
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/?tab=revision');
      await page.waitForLoadState('domcontentloaded');

      const miniTimer = page.locator('[data-testid="floating-mini-timer"]');
      await expect(miniTimer).toBeVisible({ timeout: 10000 });

      const timerDigits = page.locator('[data-testid="floating-timer-digits"]');
      await expect(timerDigits).toBeVisible();
      const digitsText = await timerDigits.textContent();
      expect(digitsText).toMatch(/10:00:\d{2}/);

      // Verify noise toggle is icon-only
      const noiseToggle = page.locator('[data-testid="floating-noise-toggle"]');
      await expect(noiseToggle).toBeVisible();
      expect((await noiseToggle.innerText()).trim()).toBe('');

      // Verify digits do not overlap noise toggle button
      const digitsBox = await timerDigits.boundingBox();
      const toggleBox = await noiseToggle.boundingBox();
      expect(digitsBox).not.toBeNull();
      expect(toggleBox).not.toBeNull();
      expect(
        digitsBox!.x + digitsBox!.width,
        `10h digits overlap noise toggle button`
      ).toBeLessThanOrEqual(toggleBox!.x + 1);

      // Verify zero overflow
      await assertZeroHorizontalOverflow(page, `Multi-hour mini timer 10h on ${vp.name}`);
    });
  }

  test('3. Compact noise mixer popover stays strictly within viewport width on 320px and dismisses properly', async ({
    page,
    context,
  }) => {
    await seedActiveTimerForUser(UNAUTHORIZED_USER.uid, 4500);
    await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());

    // Test on 320px compact viewport
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/?tab=dashboard');
    await page.waitForLoadState('domcontentloaded');

    const slidersBtn = page.locator('[data-testid="floating-noise-sliders"]');
    await expect(slidersBtn).toBeVisible({ timeout: 10000 });
    await slidersBtn.click();

    // Popover must be visible
    const popover = page.locator('[data-testid="compact-mixer-popover"]');
    await expect(popover).toBeVisible();

    // Popover must fit strictly inside the 320px viewport (no left or right clipping)
    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x, `Popover left edge (${box!.x}px) clipped offscreen`).toBeGreaterThanOrEqual(0);
    expect(
      box!.x + box!.width,
      `Popover right edge (${box!.x + box!.width}px) exceeds 320px viewport`
    ).toBeLessThanOrEqual(321);

    await assertZeroHorizontalOverflow(page, 'Compact mixer popover on 320px');

    // Test dismiss via close button
    const closeBtn = page.locator('[data-testid="compact-mixer-close"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(popover).toBeHidden();

    // Test dismiss via Escape key
    await slidersBtn.click();
    await expect(popover).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
  });

  test('4. Noise toggle button toggles state on click without adding text', async ({
    page,
    context,
  }) => {
    await seedActiveTimerForUser(UNAUTHORIZED_USER.uid, 5000);
    await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/?tab=dashboard');
    await page.waitForLoadState('domcontentloaded');

    const noiseToggle = page.locator('[data-testid="floating-noise-toggle"]');
    await expect(noiseToggle).toBeVisible({ timeout: 10000 });

    // Initial state: not playing
    expect(await noiseToggle.getAttribute('aria-label')).toBe('Play Ambient Noise');
    expect((await noiseToggle.innerText()).trim()).toBe('');

    // Click to play
    await noiseToggle.click();
    await expect(noiseToggle).toHaveAttribute('aria-label', 'Mute Ambient Noise');
    expect((await noiseToggle.innerText()).trim()).toBe('');

    // Click to mute
    await noiseToggle.click();
    await expect(noiseToggle).toHaveAttribute('aria-label', 'Play Ambient Noise');
    expect((await noiseToggle.innerText()).trim()).toBe('');
  });

  test('5. Edge Case: Long Subject Name with Pomodoro Long Break on 320px compact viewport', async ({
    page,
    context,
  }) => {
    await seedActiveTimerForUser(UNAUTHORIZED_USER.uid, 120, {
      phase: 'long_break',
      mode: 'pomodoro',
      subjectName: 'Advanced Quantum Electrodynamics',
    });
    await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());

    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/?tab=dashboard');
    await page.waitForLoadState('domcontentloaded');

    const miniTimer = page.locator('[data-testid="floating-mini-timer"]');
    await expect(miniTimer).toBeVisible({ timeout: 10000 });

    // Verify phase label displays 'Long Break'
    const phaseLabel = page.locator('[data-testid="floating-timer-phase"]');
    await expect(phaseLabel).toBeVisible();
    expect(await phaseLabel.textContent()).toBe('Long Break');

    // Verify subject label is present and truncated
    const subjectLabel = page.locator('[data-testid="floating-timer-subject"]');
    await expect(subjectLabel).toBeVisible();

    // Verify subject + phase labels do NOT overlap control buttons
    const noiseToggle = page.locator('[data-testid="floating-noise-toggle"]');
    const toggleBox = await noiseToggle.boundingBox();
    const phaseBox = await phaseLabel.boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(phaseBox).not.toBeNull();
    expect(
      phaseBox!.x + phaseBox!.width,
      `Phase label overlaps noise toggle button on 320px with long break`
    ).toBeLessThanOrEqual(toggleBox!.x + 1);

    // Verify timer digits do not overlap noise toggle button
    const timerDigits = page.locator('[data-testid="floating-timer-digits"]');
    const digitsBox = await timerDigits.boundingBox();
    expect(digitsBox).not.toBeNull();
    expect(
      digitsBox!.x + digitsBox!.width,
      `Digits overlap noise toggle button on 320px with long break`
    ).toBeLessThanOrEqual(toggleBox!.x + 1);

    await assertZeroHorizontalOverflow(page, 'Long subject + long break on 320px');
  });
});
