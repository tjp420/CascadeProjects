import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.CI
      ? "http://localhost:3000/dashboard"
      : "http://localhost:61455/dashboard",
    // Capture screenshots on failure, keep traces if failure, and record video on first retry
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "on-first-retry",
  },

  webServer: !process.env.CI
    ? {
        command: "npm run dev",
        url: "http://localhost:61455/dashboard/",
        reuseExistingServer: true,
        timeout: 60_000,
      }
    : undefined,

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
