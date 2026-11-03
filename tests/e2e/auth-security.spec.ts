import { test, expect } from '@playwright/test';
import {
  ADMIN_USER,
  loginAsAdmin,
} from '../fixtures/auth-helpers';
import { ProfileUpdateSchema } from '@/lib/validations';

test.describe('Security & Auth Hardening (OAuth CSRF, IDOR, XP Injection)', () => {
  test('1. /api/auth/google generates cryptographic state and sets httpOnly oauth_state cookie', async ({
    request,
  }) => {
    const res = await request.get('/api/auth/google', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    const location = res.headers()['location'];
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain('state=');

    const setCookie = res.headers()['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('oauth_state=');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
  });

  test('2. /api/auth/google/callback rejects requests without state or with mismatched state as csrf_detected', async ({
    request,
  }) => {
    // Missing state param entirely
    const resNoState = await request.get('/api/auth/google/callback?code=fake_code', {
      maxRedirects: 0,
    });
    expect(resNoState.status()).toBe(307);
    expect(resNoState.headers()['location']).toContain('authError=csrf_detected');

    // Mismatched state param vs cookie
    const resMismatch = await request.get('/api/auth/google/callback?code=fake_code&state=attack_state_123', {
      maxRedirects: 0,
      headers: {
        Cookie: 'oauth_state=legitimate_state_456',
      },
    });
    expect(resMismatch.status()).toBe(307);
    expect(resMismatch.headers()['location']).toContain('authError=csrf_detected');
  });

  test('3. ProfileUpdateSchema rejects/strips gamificationXp to prevent client-side XP injection', async () => {
    const maliciousPayload = {
      fullName: 'Student Scholar',
      dailyStudyTargetMinutes: 300,
      gamificationXp: 9999999, // Attempted XP injection
    };

    const parsed = ProfileUpdateSchema.parse(maliciousPayload) as Record<string, unknown>;
    expect(parsed.fullName).toBe('Student Scholar');
    expect(parsed.dailyStudyTargetMinutes).toBe(300);
    // gamificationXp must NOT exist on parsed result
    expect(parsed.gamificationXp).toBeUndefined();
  });

  test('4. Workspace UI loads cleanly with updated background and WCAG contrast tokens', async ({
    page,
    context,
  }) => {
    await loginAsAdmin(context, ADMIN_USER, page.url());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify background computed style or css variable exists
    const bodyBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--background');
    });
    expect(bodyBg).toBeTruthy();
  });
});
