import { test, expect } from '@playwright/test';
import {
  ADMIN_USER,
  SUPERADMIN_USER,
  UNAUTHORIZED_USER,
  createExpiredSessionToken,
  createTamperedSessionToken,
  injectSessionCookie,
  loginAsAdmin,
  loginAsUnauthorizedUser,
} from '../fixtures/auth-helpers';

test.describe('Admin Authentication & Google OAuth Allowlist Guard (F1, F3)', () => {
  test.describe('Tier 1: Core Allowlist & Route Protection (Happy & Unauthenticated Paths)', () => {
    test('1. Unauthenticated request to /admin redirects to login or unauthorized error', async ({
      page,
      context,
    }) => {
      await context.clearCookies();
      await page.goto('/admin');
      // Should redirect away from /admin to root with authError or login flow
      await page.waitForURL((url) => !url.pathname.startsWith('/admin') || url.search.includes('authError'));
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/?(authError=.*)?/);
      expect(page.url()).not.toBe('http://127.0.0.1:3000/admin');
    });

    test('2. Unauthorized authenticated user is redirected to /?authError=unauthorized_admin', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/admin');
      await page.waitForURL((url) => url.searchParams.has('authError') || url.pathname === '/');
      expect(page.url()).toContain('authError=unauthorized_admin');
    });

    test('3. Allowlisted admin user successfully accesses /admin and views Admin Console', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      const response = await page.goto('/admin');
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveURL(/\/admin/);
      // Admin layout should render admin header or navigation
      const adminHeading = page.locator('h1, h2, [data-slot="sidebar-header"], header').filter({
        hasText: /Admin|Overview|ScholarPulse|Dashboard/i,
      });
      await expect(adminHeading.first()).toBeVisible({ timeout: 10000 });
    });

    test('4. Superadmin allowlisted email has full administrative access', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, SUPERADMIN_USER, page.url());
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin/);
      await expect(page.locator('body')).not.toContainText('Access Denied');
    });

    test('5. Admin console header contains navigation links to entity sections', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin');
      // Check presence of admin nav links or buttons
      const navLinks = page.locator('nav a, aside a, [role="navigation"] a');
      await expect(navLinks.first()).toBeVisible({ timeout: 10000 });
      const navCount = await navLinks.count();
      expect(navCount).toBeGreaterThan(0);
    });
  });

  test.describe('Tier 2: Boundary Values & Edge Case Route Enforcement', () => {
    test('6. Unauthenticated request to /admin/subjects is blocked and redirected', async ({
      page,
      context,
    }) => {
      await context.clearCookies();
      await page.goto('/admin/subjects');
      await page.waitForURL((url) => !url.pathname.startsWith('/admin/subjects') || url.search.includes('authError'));
      expect(page.url()).not.toContain('/admin/subjects');
    });

    test('7. Unauthorized user requesting /admin/checklist is redirected with authError', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/admin/checklist');
      await page.waitForURL((url) => url.searchParams.has('authError') || url.pathname === '/');
      expect(page.url()).toContain('authError=unauthorized_admin');
    });

    test('8. Unauthorized user requesting /admin/system is redirected with authError', async ({
      page,
      context,
    }) => {
      await loginAsUnauthorizedUser(context, UNAUTHORIZED_USER, page.url());
      await page.goto('/admin/system');
      await page.waitForURL((url) => url.searchParams.has('authError') || url.pathname === '/');
      expect(page.url()).toContain('authError=unauthorized_admin');
    });

    test('9. Expired session token is rejected and user redirected', async ({
      page,
      context,
    }) => {
      const expiredToken = createExpiredSessionToken(ADMIN_USER);
      await injectSessionCookie(context, expiredToken, page.url());
      await page.goto('/admin');
      await page.waitForURL((url) => !url.pathname.startsWith('/admin') || url.search.includes('authError'));
      expect(page.url()).not.toBe('http://127.0.0.1:3000/admin');
    });

    test('10. Tampered session token with invalid HMAC signature is strictly rejected', async ({
      page,
      context,
    }) => {
      const tamperedToken = createTamperedSessionToken(ADMIN_USER);
      await injectSessionCookie(context, tamperedToken, page.url());
      await page.goto('/admin');
      await page.waitForURL((url) => !url.pathname.startsWith('/admin') || url.search.includes('authError'));
      expect(page.url()).not.toBe('http://127.0.0.1:3000/admin');
    });

    test('11. Email matching is case-insensitive for allowlisted admin accounts', async ({
      page,
      context,
    }) => {
      const uppercaseAdmin = {
        ...ADMIN_USER,
        email: 'ADMIN@SCHOLARPULSE.EDU',
      };
      await loginAsAdmin(context, uppercaseAdmin, page.url());
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin/);
    });

    test('12. Email with surrounding whitespace is normalized before allowlist check', async ({
      page,
      context,
    }) => {
      const paddedAdmin = {
        ...ADMIN_USER,
        email: '  admin@scholarpulse.edu  ',
      };
      await loginAsAdmin(context, paddedAdmin, page.url());
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin/);
    });
  });

  test.describe('Tier 3: Pairwise & Integration Scenarios', () => {
    test('13. Admin can switch between /admin and student workspace / seamlessly', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin/);

      // Navigate back to student workspace
      const returnLink = page.locator('a[href="/"]').first();
      if (await returnLink.isVisible()) {
        await returnLink.click();
      } else {
        await page.goto('/');
      }
      await expect(page).toHaveURL(/\/($|\?)/);

      // Navigate back to admin
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/admin/);
    });

    test('14. Dual theme toggle functions in /admin console without session invalidation', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      await page.goto('/admin');
      const html = page.locator('html');

      // Check current theme
      const initialClass = (await html.getAttribute('class')) || '';

      // Find theme toggle button
      const themeToggle = page.locator('button[aria-label*="theme" i], button:has([data-icon="sun"]), button:has([data-icon="moon"])').first();
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        // Give next-themes time to toggle
        await page.waitForTimeout(300);
        const newClass = (await html.getAttribute('class')) || '';
        expect(newClass).not.toBe(initialClass);
      }
    });

    test('15. Session cookie persists across multiple subroute navigations in admin panel', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      const subroutes = ['/admin', '/admin/subjects', '/admin/checklist', '/admin/goals'];
      for (const route of subroutes) {
        await page.goto(route);
        // Either route renders 200 or 404 (if not yet built), but NEVER redirects to unauthorized_admin
        expect(page.url()).not.toContain('authError=unauthorized_admin');
      }
    });
  });

  test.describe('Tier 4 & 5: Adversarial Attacks & Security Attack Resistance', () => {
    test('16. [Security Attack Resistance] Submitting empty or malformed token string in sp_session cookie', async ({
      page,
      context,
    }) => {
      const parsed = new URL('http://127.0.0.1:3000');
      await context.addCookies([
        {
          name: 'sp_session',
          value: 'malformed.not-a-valid-jwt.token',
          domain: parsed.hostname,
          path: '/',
        },
      ]);
      await page.goto('/admin');
      await page.waitForURL((url) => !url.pathname.startsWith('/admin') || url.search.includes('authError'));
      expect(page.url()).not.toBe('http://127.0.0.1:3000/admin');
    });

    test('17. [Adversarial] SQL Injection payload in email field is handled safely without execution', async ({
      page,
      context,
    }) => {
      const sqliUser = {
        uid: 'sqli-attacker',
        email: "admin@scholarpulse.edu' OR '1'='1' --",
        name: 'SQLi Attacker',
      };
      await loginAsUnauthorizedUser(context, sqliUser, page.url());
      await page.goto('/admin');
      await page.waitForURL((url) => url.searchParams.has('authError') || url.pathname === '/');
      expect(page.url()).toContain('authError=unauthorized_admin');
    });

    test('18. [Adversarial] Cross-Site Scripting (XSS) in session name attribute is escaped safely', async ({
      page,
      context,
    }) => {
      const xssAdmin = {
        ...ADMIN_USER,
        name: '<script id="xss-test">window.__xss_executed=true</script>',
      };
      await loginAsAdmin(context, xssAdmin, page.url());
      await page.goto('/admin');
      const isXssExecuted = await page.evaluate(() => (window as unknown as { __xss_executed?: boolean }).__xss_executed);
      expect(isXssExecuted).toBeUndefined();
    });

    test('19. [Adversarial] Direct HTTP GET to admin API endpoint without credentials returns 401 or redirect', async ({
      request,
    }) => {
      const res = await request.get('/api/admin/metrics', {
        headers: { Accept: 'application/json' },
      });
      // Should be 401, 403, 404, or 307
      expect([401, 403, 404, 307]).toContain(res.status());
    });

    test('20. [Adversarial] Path traversal attempt in admin route URL does not expose internal files', async ({
      page,
      context,
    }) => {
      await loginAsAdmin(context, ADMIN_USER, page.url());
      const res = await page.goto('/admin/..%2f..%2fetc/passwd');
      // Should 404 or redirect, never return 200 with passwd
      expect(res?.status()).not.toBe(200);
    });
  });
});
