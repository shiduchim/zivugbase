import { defineConfig } from '@playwright/test';

const port = 4173;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}/`,
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    serviceWorkers: 'allow',
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {})
  },
  webServer: {
    command: `npx vite build && npx vite preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
