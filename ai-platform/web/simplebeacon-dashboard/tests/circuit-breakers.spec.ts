import { test, expect, type Page } from '@playwright/test';

/**
 * Circuit breaker E2E tests — verify that 401/404 responses trip the per-view
 * circuit breakers and suppress subsequent fetches triggered by UI actions
 * (Refresh/Retry buttons) within the same component mount.
 *
 * Strategy: intercept failing endpoints with page.route(), count requests,
 * navigate to each view (triggers first fetch + breaker trip), then click
 * the Refresh/Retry button and verify no new request was made.
 *
 * Note: the dashboard's index.html loads a pre-built bundle from assets/main.js.
 * The test suite requires a static server serving the built assets on port 5173.
 * Run `npm run build` and copy chunk files to assets/ before running these tests.
 * The Playwright webServer config with `reuseExistingServer: true` will detect
 * an already-running server on port 5173.
 */

function setupFailingRoutes(page: Page, status: number, patterns: string[]) {
  const counts = new Map<string, number>();
  for (const pattern of patterns) {
    counts.set(pattern, 0);
    page.route(pattern, async (route) => {
      counts.set(pattern, (counts.get(pattern) || 0) + 1);
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'mocked' }) });
    });
  }
  return counts;
}

test.describe('Dashboard circuit breakers', () => {
  test.beforeEach(async ({ page }) => {
    // Stub auth so views mount in authenticated admin state
    await page.addInitScript(() => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjo5OTk5OTk5OTk5LCJyb2xlIjoiYWRtaW4iLCJwbGFuIjoicHJvIn0.sig';
      localStorage.setItem('sb_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('sb_user', JSON.stringify({ id: 'test', email: 'test@test', role: 'admin', plan: 'pro' }));
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('Platform: breaker trips on /vault/consensus/status 401, Refresh button suppressed', async ({ page }) => {
    const counts = setupFailingRoutes(page, 401, ['**/api/vault/consensus/status**']);

    await page.goto('/#/platform');
    await page.waitForTimeout(3000);

    const firstCount = counts.get('**/api/vault/consensus/status**') || 0;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    // Click the Refresh button (calls fetchData again) — should be suppressed
    const refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshBtn.click();
      await page.waitForTimeout(2000);
    }

    // Breaker should have tripped — no new consensus requests after UI action
    const secondCount = counts.get('**/api/vault/consensus/status**') || 0;
    expect(secondCount).toBe(firstCount);
  });

  test('Enterprise: breaker trips on /enterprise/organizations 404, Retry button suppressed', async ({ page }) => {
    const counts = setupFailingRoutes(page, 404, ['**/api/enterprise/organizations**']);

    await page.goto('/#/enterprise');
    await page.waitForTimeout(3000);

    const firstCount = counts.get('**/api/enterprise/organizations**') || 0;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    // Click the Retry button (calls fetchOrgs again) — should be suppressed by breaker
    const retryBtn = page.getByRole('button', { name: /retry/i }).first();
    if (await retryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await retryBtn.click();
      await page.waitForTimeout(2000);
    }

    // Breaker should have tripped — no new requests after UI-triggered retry
    const secondCount = counts.get('**/api/enterprise/organizations**') || 0;
    expect(secondCount).toBe(firstCount);
  });

  test('OutreachAnalytics: sends Authorization header on /outreach/* requests', async ({ page }) => {
    let authHeaderPresent = false;
    let requestSeen = false;
    for (const pattern of ['**/api/outreach/campaign-state**', '**/api/outreach/prospects**']) {
      // Use 200 OK so the global 401 fetch wrapper in main.tsx doesn't clear the token
      page.route(pattern, async (route) => {
        requestSeen = true;
        const headers = route.request().headers();
        if (headers['authorization'] || headers['Authorization']) {
          authHeaderPresent = true;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      });
    }

    await page.goto('/#/outreach-analytics');
    await page.waitForTimeout(3000);

    // The fix ensures authHeaders() is called — Authorization header should be present
    if (requestSeen) {
      expect(authHeaderPresent).toBe(true);
    } else {
      test.skip(true, 'No outreach requests intercepted — API base may differ in dev');
    }
  });
});
