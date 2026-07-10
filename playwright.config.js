const { defineConfig, devices } = require('@playwright/test');

const WEBKIT_DEV_PORT = 41234;
const usePreviewServer = process.env.PLAYWRIGHT_SERVER === 'preview';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${WEBKIT_DEV_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: usePreviewServer
      ? `npm run preview -- --host 127.0.0.1 --port ${WEBKIT_DEV_PORT}`
      : `npm run dev -- --host 127.0.0.1 --port ${WEBKIT_DEV_PORT}`,
    url: `http://127.0.0.1:${WEBKIT_DEV_PORT}`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30_000,
  },
  projects: [
    {
      name: 'webkit',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
      },
    },
  ],
});
