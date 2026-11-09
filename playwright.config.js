// Browser tests (npm test): they start the dev server and play in Chromium.
// A Chromium installed elsewhere can be named with PW_CHROMIUM=/path/to/chrome.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  fullyParallel: true,
  // on GitHub a test that fails under load gets one more try; it is then reported as "flaky"
  // (in the summary of the run), not hidden
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5199/',
    viewport: { width: 900, height: 450 },
    // the tests put helper scripts into the page (addScriptTag); the game's CSP forbids that
    bypassCSP: true,
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
  },
  webServer: { command: 'npx vite --port 5199 --strictPort', url: 'http://localhost:5199/', reuseExistingServer: true },
});
