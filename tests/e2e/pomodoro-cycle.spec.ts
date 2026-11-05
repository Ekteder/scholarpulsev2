import { test, expect } from '@playwright/test';
import { ADMIN_USER, loginAsAdmin } from '../fixtures/auth-helpers';
import { seedActiveTimerForUser, clearActiveTimerForUser } from '../fixtures/db-timer-helpers';
import { neon } from '@neondatabase/serverless';

function getDbSql() {
  const connStr = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!connStr) throw new Error('No DATABASE_URL found for test db helper');
  return neon(connStr);
}

test.describe('Pomodoro Break & Focus Session Consolidation', () => {
  test.beforeEach(async () => {
    await clearActiveTimerForUser(ADMIN_USER.uid);
  });

  test.afterEach(async () => {
    await clearActiveTimerForUser(ADMIN_USER.uid);
  });

  test('1. Finishing during break saves completed focus time (25m) without error and excludes break time', async ({
    page,
    context,
  }) => {
    const topicName = `PomoBreakTest_${Date.now()}`;
    const sql = getDbSql();

    // Clean any prior study sessions with this topic
    await sql`DELETE FROM study_sessions WHERE user_id = ${ADMIN_USER.uid} AND topic LIKE 'PomoBreakTest_%'`;

    // Seed active timer in short_break with 1500s (25m) total focus and 15s elapsed in break
    await seedActiveTimerForUser(ADMIN_USER.uid, 15, {
      phase: 'short_break',
      mode: 'pomodoro',
      topic: topicName,
      totalFocusSeconds: 1500,
    });

    await loginAsAdmin(context, ADMIN_USER, page.url());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Floating mini timer should be visible for active session; expand to full timer
    const miniTimer = page.locator('[data-testid="floating-mini-timer"]');
    await expect(miniTimer).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="floating-timer-expand"]').click();
    await page.waitForTimeout(500);

    // Verify timer shows break interval and correct focus elapsed time (25m 0s)
    await expect(page.locator('text=Break interval')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Elapsed Focus Time: 25m 0s')).toBeVisible();

    // Click Finish & Save
    await page.locator('button:has-text("Finish & Save")').click();

    // The finish modal opens
    const modal = page.locator('h3:has-text("Session Summary")');
    await expect(modal.first()).toBeVisible();

    // Confirm save in modal
    await page.locator('button:has-text("Save Completed Session")').click();

    // Should NOT show "< 30 seconds" error toast
    await expect(page.locator('text=Sessions shorter than 30 seconds are not saved')).not.toBeVisible({ timeout: 3000 });

    // Success toast should appear indicating ~25 minutes saved
    await expect(page.locator('text=Study Session Saved')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Recorded 25 minutes of study')).toBeVisible();

    // Query database to verify recorded durationSeconds is 1500 (25m) and break was NOT saved as separate session
    const savedSessions = await sql`
      SELECT id, duration_seconds, topic, session_type
      FROM study_sessions
      WHERE user_id = ${ADMIN_USER.uid} AND topic = ${topicName}
    `;

    expect(savedSessions.length).toBe(1);
    expect(savedSessions[0].duration_seconds).toBe(1500);

    // Clean up
    await sql`DELETE FROM study_sessions WHERE user_id = ${ADMIN_USER.uid} AND topic = ${topicName}`;
  });

  test('2. Multi-cycle Pomodoro consolidates total focus time (35m) into ONE single study session', async ({
    page,
    context,
  }) => {
    const topicName = `PomoMultiCycleTest_${Date.now()}`;
    const sql = getDbSql();

    await sql`DELETE FROM study_sessions WHERE user_id = ${ADMIN_USER.uid} AND topic LIKE 'PomoMultiCycleTest_%'`;

    // Seed active timer in focus cycle 2: completed 1 pomodoro (1500s) + 600s into 2nd focus = 2100s (35m)
    await seedActiveTimerForUser(ADMIN_USER.uid, 600, {
      phase: 'focus',
      mode: 'pomodoro',
      topic: topicName,
      totalFocusSeconds: 1500,
    });

    await loginAsAdmin(context, ADMIN_USER, page.url());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Expand to full Study Timer view via floating mini-timer
    const miniTimer = page.locator('[data-testid="floating-mini-timer"]');
    await expect(miniTimer).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="floating-timer-expand"]').click();
    await page.waitForTimeout(500);

    // Verify Elapsed Focus Time reflects 25m + 10m (35m)
    await expect(page.locator('text=/Elapsed Focus Time: 35m \\d+s/')).toBeVisible({ timeout: 10000 });

    // Click Finish & Save
    await page.locator('button:has-text("Finish & Save")').click();
    await page.locator('button:has-text("Save Completed Session")').click();

    await expect(page.locator('text=Study Session Saved')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Recorded 35 minutes of study/')).toBeVisible();

    // Verify exactly 1 session exists with at least 2100 seconds (35m)
    const savedSessions = await sql`
      SELECT id, duration_seconds, topic
      FROM study_sessions
      WHERE user_id = ${ADMIN_USER.uid} AND topic = ${topicName}
    `;

    expect(savedSessions.length).toBe(1);
    expect(savedSessions[0].duration_seconds).toBeGreaterThanOrEqual(2100);

    await sql`DELETE FROM study_sessions WHERE user_id = ${ADMIN_USER.uid} AND topic = ${topicName}`;
  });

  test('3. Discards session if total focus time across cycle is under 30 seconds', async ({
    page,
    context,
  }) => {
    const topicName = `PomoShortDiscard_${Date.now()}`;
    const sql = getDbSql();

    await seedActiveTimerForUser(ADMIN_USER.uid, 15, {
      phase: 'focus',
      mode: 'pomodoro',
      topic: topicName,
      totalFocusSeconds: 0,
    });

    await loginAsAdmin(context, ADMIN_USER, page.url());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Finish directly from floating mini-timer
    const finishBtn = page.locator('[data-testid="floating-timer-finish"]');
    await expect(finishBtn).toBeVisible({ timeout: 10000 });
    await finishBtn.click();

    // Should discard with message
    await expect(page.locator('text=Sessions shorter than 30 seconds are not saved')).toBeVisible({ timeout: 10000 });

    // Verify no study session was inserted in DB
    const savedSessions = await sql`
      SELECT id FROM study_sessions WHERE user_id = ${ADMIN_USER.uid} AND topic = ${topicName}
    `;
    expect(savedSessions.length).toBe(0);
  });
});
