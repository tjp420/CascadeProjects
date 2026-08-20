import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? 'html' : 'list',
    timeout: 30_000,
    expect: { timeout: 10_000 },

    use: {
        baseURL: process.env.CI ? 'http://localhost:3000/dashboard' : 'http://localhost:5173/dashboard',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },

    webServer: !process.env.CI
        ? {
              command: 'npm run dev',
              url: 'http://localhost:5173/dashboard/',
              reuseExistingServer: true,
              timeout: 60_000
          }
        : undefined,

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] }
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] }
        }
    ]
});
