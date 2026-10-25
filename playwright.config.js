// Browser tests (npm test): they start the dev server and play in Chromium.
// A Chromium installed elsewhere can be named with PW_CHROMIUM=/path/to/chrome.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5199/',
    viewport: { width: 900, height: 450 },
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
  },
  webServer: { command: 'npx vite --port 5199 --strictPort', url: 'http://localhost:5199/', reuseExistingServer: true },
});
