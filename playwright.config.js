import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5174/',
    viewport: { width: 1280, height: 720 },
    locale: 'de-DE',
    // local runs can point to an existing Chromium; CI installs its own
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174/',
    reuseExistingServer: !process.env.CI,
  },
});
