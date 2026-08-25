const { defineConfig, devices } = require('@playwright/test');

// Override when port 3000 is already taken: E2E_FRONTEND_PORT=3001 npx playwright test
// The backend's CORS defaults allow both 3000 and 3001.
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT || '3000';
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm start',
      cwd: '../backend',
      url: 'http://localhost:5000/api/ready',
      reuseExistingServer: true,
      timeout: 60000,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npm start',
      cwd: '../frontend',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 90000,
      env: {
        BROWSER: 'none',
        PORT: FRONTEND_PORT,
      },
    },
  ],
});
