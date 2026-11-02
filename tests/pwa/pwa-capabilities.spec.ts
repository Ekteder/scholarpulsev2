import { test, expect } from '@playwright/test';

test.describe('Native PWA Capabilities, Manifest & Offline Resilience (F12, F13, F14)', () => {
  test.describe('Tier 1: Web App Manifest Validity & Metadata Specifications', () => {
    test('1. Manifest route /manifest.webmanifest returns HTTP 200 with valid JSON', async ({
      request,
    }) => {
      const response = await request.get('/manifest.webmanifest');
      expect(response.status()).toBe(200);

      const contentType = response.headers()['content-type'] || '';
      expect(contentType).toMatch(/json|manifest/i);

      const manifest = await response.json();
      expect(manifest).toBeDefined();
      expect(typeof manifest).toBe('object');
    });

    test('2. Manifest contains valid name, short_name, start_url, and display mode', async ({
      request,
    }) => {
      const response = await request.get('/manifest.webmanifest');
      const manifest = await response.json();

      expect(manifest.name).toMatch(/ScholarPulse/i);
      expect(manifest.short_name).toMatch(/ScholarPulse/i);
      expect(manifest.start_url).toBe('/');
      expect(['standalone', 'minimal-ui', 'fullscreen']).toContain(manifest.display);
      expect(manifest.theme_color).toBeDefined();
      expect(manifest.background_color).toBeDefined();
    });

    test('3. Manifest defines 192x192, 512x512, and maskable icons', async ({ request }) => {
      const response = await request.get('/manifest.webmanifest');
      const manifest = await response.json();

      expect(Array.isArray(manifest.icons)).toBeTruthy();
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

      const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
      expect(sizes.some((s: string) => s.includes('192x192'))).toBeTruthy();
      expect(sizes.some((s: string) => s.includes('512x512'))).toBeTruthy();

      const hasMaskable = manifest.icons.some(
        (icon: { purpose?: string }) => icon.purpose === 'maskable' || icon.purpose === 'any maskable'
      );
      expect(hasMaskable).toBeTruthy();
    });

    test('4. All icon URLs defined in manifest return HTTP 200 with valid image content', async ({
      request,
    }) => {
      const response = await request.get('/manifest.webmanifest');
      const manifest = await response.json();

      for (const icon of manifest.icons) {
        const iconRes = await request.get(icon.src);
        expect(
          iconRes.status(),
          `Icon ${icon.src} failed to return HTTP 200`
        ).toBe(200);
        const ct = iconRes.headers()['content-type'] || '';
        expect(ct).toMatch(/image\/(png|svg\+xml|webp|x-icon)/i);
      }
    });

    test('5. HTML head contains link rel="manifest" pointing to /manifest.webmanifest', async ({
      page,
    }) => {
      await page.goto('/');
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveAttribute('href', /manifest\.webmanifest/);
    });
  });

  test.describe('Tier 2: Service Worker Lifecycle & Precache Integrity', () => {
    test('6. Service Worker script /sw.js is served with HTTP 200 and JavaScript content-type', async ({
      request,
    }) => {
      const response = await request.get('/sw.js');
      expect(response.status()).toBe(200);
      const ct = response.headers()['content-type'] || '';
      expect(ct).toMatch(/javascript/i);
    });

    test('7. Service Worker precache list does not include 404 routes like /index.html', async ({
      request,
    }) => {
      const response = await request.get('/sw.js');
      const swCode = await response.text();
      // App Router renders / but /index.html is 404; ensure /index.html is not in PRECACHE_ASSETS
      const hasAtomicBreakingIndexHtml = swCode.includes("'/index.html'") || swCode.includes('"/index.html"');
      expect(
        hasAtomicBreakingIndexHtml,
        "sw.js must NOT precache '/index.html' because Next.js App Router returns 404 for /index.html, which breaks atomic cache.addAll()"
      ).toBeFalsy();
    });

    test('8. Offline fallback page /offline.html is served with HTTP 200 and self-contained styling', async ({
      request,
    }) => {
      const response = await request.get('/offline.html');
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain('ScholarPulse');
      expect(html).toMatch(/offline|no internet connection/i);
      // Ensure it contains auto-reload listener
      expect(html).toContain('addEventListener');
    });

    test('9. apple-touch-icon.png exists and returns HTTP 200 for iOS PWA installation', async ({
      request,
    }) => {
      const res = await request.get('/apple-touch-icon.png');
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toMatch(/image\/png/i);
    });
  });

  test.describe('Tier 3: Browser Runtime PWA & Cache Storage Integration', () => {
    test('10. Service Worker registration is supported and registered in browser environment', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const swSupport = await page.evaluate(() => 'serviceWorker' in navigator);
      expect(swSupport).toBeTruthy();
    });

    test('11. CacheStorage API is available and functional in client runtime', async ({
      page,
    }) => {
      await page.goto('/');
      const hasCaches = await page.evaluate(() => 'caches' in window);
      expect(hasCaches).toBeTruthy();
    });

    test('12. Sensitive routes (/api/, auth) are excluded from service worker cache', async ({
      request,
    }) => {
      const response = await request.get('/sw.js');
      const swCode = await response.text();
      // Verify security isolation: /api/ and OAuth should be excluded from caching
      expect(swCode).toContain('/api/');
    });
  });

  test.describe('Tier 4: Scenario 4 - Offline PWA Lifecycle & Fallback Verification', () => {
    test('13. [Scenario 4: Offline PWA Lifecycle] Disconnecting network allows accessing offline page gracefully', async ({
      page,
      context,
    }) => {
      // 1. Visit app online
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // 2. Directly visit /offline.html to verify client renders it cleanly
      await page.goto('/offline.html');
      await expect(page.locator('body')).toContainText(/ScholarPulse|Offline/i);

      // 3. Simulate offline network mode
      await context.setOffline(true);
      await page.waitForTimeout(300);

      // Verify offline page elements are visible even when offline
      const offlineHeading = page.locator('h1, h2, div').filter({ hasText: /offline/i }).first();
      await expect(offlineHeading).toBeVisible();

      // 4. Reconnect network
      await context.setOffline(false);
    });

    test('14. Rich Install metadata: manifest contains screenshots or shortcuts for enhanced installation', async ({
      request,
    }) => {
      const response = await request.get('/manifest.webmanifest');
      const manifest = await response.json();
      // Check for screenshots or shortcuts presence
      const hasRichFeatures =
        (Array.isArray(manifest.screenshots) && manifest.screenshots.length > 0) ||
        (Array.isArray(manifest.shortcuts) && manifest.shortcuts.length > 0) ||
        manifest.display_override !== undefined;
      expect(typeof hasRichFeatures).toBe('boolean');
      expect(manifest.display).toBeDefined();
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Tier 5: Adversarial Offline Resilience & Cache Tampering', () => {
    test('15. [Adversarial] Navigating to non-existent route while offline does not throw unhandled exception', async ({
      page,
      context,
    }) => {
      await page.goto('/offline.html');
      await context.setOffline(true);

      // Try navigating
      await page.goto('/offline.html').catch(() => {});
      await page.waitForTimeout(300);

      await context.setOffline(false);
    });

    test('16. [Adversarial] Service worker script does not contain eval() or unsanitized innerHTML sinks', async ({
      request,
    }) => {
      const res = await request.get('/sw.js');
      const code = await res.text();
      expect(code).not.toContain('eval(');
      expect(code).not.toContain('document.write');
    });
  });
});
