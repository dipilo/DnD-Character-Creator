import { defineConfig, devices } from '@playwright/test';

// Portrait runs out of width and landscape runs out of height, so checking one proves nothing
// about the other (docs/rules/ui.md). Both are projects, and every spec runs under both.
const PHONE_PORTRAIT = { width: 390, height: 844 };
const PHONE_LANDSCAPE = { width: 844, height: 390 };
const DESKTOP = { width: 1440, height: 900 };

export default defineConfig({
  testDir: './app/e2e',
  // The dice surface never settles without a composited frame (docs/rules/sheet.md), so nothing
  // here may depend on a 3D roll; the specs use the instant path.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : [['list']],
  // The app loads its content library as a lazy chunk, and several workers share one preview
  // server; 5s was enough alone and not under load. A real failure still fails, only later.
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: DESKTOP } },
    { name: 'phone-portrait', use: { ...devices['Desktop Chrome'], viewport: PHONE_PORTRAIT, hasTouch: true, isMobile: false } },
    { name: 'phone-landscape', use: { ...devices['Desktop Chrome'], viewport: PHONE_LANDSCAPE, hasTouch: true, isMobile: false } },
  ],
  // The preview server, not the dev server: a production build is what the rules are checked
  // against, and `base: '/'` plus the SPA rewrite only behave correctly there.
  webServer: {
    command: 'npm run preview --workspace app -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
