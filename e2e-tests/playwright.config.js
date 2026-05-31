const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
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
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 90000,
      env: {
        BROWSER: 'none',
      },
    },
  ],
});
