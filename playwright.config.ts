import { defineConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Load .env.local and .env into process.env for test worker processes
if (typeof process.loadEnvFile === 'function') {
  const envLocal = path.resolve(__dirname, '.env.local');
  if (fs.existsSync(envLocal)) process.loadEnvFile(envLocal);
  const env = path.resolve(__dirname, '.env');
  if (fs.existsSync(env)) process.loadEnvFile(env);
}

/**
 * Playwright E2E & Responsive Test Suite Configuration for ScholarPulse v2
 * Uses the locally installed Google Chrome browser at /usr/bin/google-chrome.
 */
const PORT = process.env.PORT || '3000';
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'Google Chrome Desktop',
      use: {
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'Google Chrome Mobile',
      use: {
        channel: 'chrome',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.BASE_URL && !process.env.BASE_URL.includes('127.0.0.1') && !process.env.BASE_URL.includes('localhost')
    ? undefined
    : {
        command: `pnpm start --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
