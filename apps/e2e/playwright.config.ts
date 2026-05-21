import { defineConfig, devices } from '@playwright/test';

/**
 * Antagna E2E tests.
 *
 *  - Runs against the live preview/prod URL by default (E2E_BASE_URL).
 *    Override via env var to point at a Vercel preview deploy or localhost.
 *  - Auth: a one-time `setup` project creates a Supabase test user via the
 *    Admin API and persists the signed-in storage state under .auth/.
 *    Every other project reuses that state, so individual tests don't
 *    re-authenticate.
 *  - The "admin" project promotes the test user to system_admin via DB
 *    write, so admin pages are exercisable.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://antagna-v2.vercel.app';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // tests touch shared DB state — keep serial for now
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off', // ffmpeg not available on ubuntu26 — Playwright traces cover us
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts$/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'admin',
      dependencies: ['setup'],
      testMatch: /.*\.admin\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: '.auth/admin.json',
      },
    },
    {
      name: 'user',
      dependencies: ['setup'],
      testMatch: /.*\.spec\.ts$/,
      testIgnore: /.*\.admin\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: '.auth/admin.json',
      },
    },
  ],
});
