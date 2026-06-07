module.exports = {
    testDir: './e2e',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: process.env.TEST_BASE_URL || 'http://localhost:3001',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } }
    ],
    webServer: {
        command: 'node server.cjs',
        url: 'http://localhost:3001',
        reuseExistingServer: !process.env.CI
    }
};
