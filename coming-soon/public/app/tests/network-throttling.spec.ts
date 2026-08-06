import { test, expect } from '@playwright/test';

test.describe('Dashboard Loading Resiliency & Spinner Lifecycle', () => {
  test('should display loading spinner while processing on Slow 3G profile and complete gracefully', async ({ page }) => {
    // Attach to CDP to emulate network conditions
    const client = await page.context().newCDPSession(page);

    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: Math.floor((400 * 1024) / 8),
      uploadThroughput: Math.floor((200 * 1024) / 8),
      latency: 400,
    });

    // Navigate directly to the results route (uses baseURL in playwright.config.ts)
    await page.goto('/#/results');

    // Locator: accept data-testid, common class, or aria-busy indicator
    const spinner = page.locator('[data-testid="loading-spinner"], .loading-spinner, [aria-busy="true"]');

    // On slow networks the spinner should appear
    await expect(spinner).toBeVisible({ timeout: 5000 });

    // Ensure spinner eventually hides once the delayed payload arrives (increase timeout for CI)
    await expect(spinner).toBeHidden({ timeout: 30_000 });

    // Verify the summary overview appears after hydration
    const overviewCard = page.getByText('Scan Report');
    await expect(overviewCard).toBeVisible({ timeout: 5000 });
  });
});
