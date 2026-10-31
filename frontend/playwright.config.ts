import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The journey test drives the real application in a real browser against the
 * MSW mock backend, which is the same request path the production backend
 * will serve.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://127.0.0.1:5173',
    // Uses the browser already installed on the machine, so no download is
    // required. Set PLAYWRIGHT_CHANNEL=chromium to use a managed browser.
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /journey-17-mobile/,
    },
    // Journey 17 only: a real phone viewport, where the responsive layout
    // decides which panel behaviour the student gets.
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /journey-17-mobile/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
