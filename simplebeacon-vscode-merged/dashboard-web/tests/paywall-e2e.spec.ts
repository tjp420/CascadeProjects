/**
 * E2E tests for the SimpleBeacon scan paywall system.
 *
 * Verifies that free-tier users are blocked after 3 scans/month and shown
 * the ScanPaywall overlay, while developer-tier users have unlimited access.
 * Also covers CI gate and EU AI Act feature paywalls.
 *
 * Run with:  npx playwright test tests/paywall-e2e.spec.ts
 *
 * Approach:
 *   - page.addInitScript() injects localStorage (auth token, user plan, scan
 *     count) before the SPA boots so the correct tier/capabilities are resolved.
 *   - page.route() stubs backend API endpoints so no running server is needed.
 *   - Navigation uses hash-based routes relative to the Playwright baseURL
 *     (e.g. "/#/analyze"), matching the existing test patterns in this project.
 */

import { test, expect, Page } from '@playwright/test';

// ─── Route constants (relative to Playwright `baseURL`) ──────────────────────

const ANALYZE_URL = '/#/analyze';
const ASSESSMENT_URL = '/#/assessments';

// ─── Mock data ───────────────────────────────────────────────────────────────

/**
 * Minimal valid response for `POST /analyze/flexible`.
 * The AnalyzeView parses `data.report.summary` and `data.report.gate` into a
 * ScanResult, which in turn drives the results tabs (Summary, Export, etc.).
 */
const MOCK_SCAN_RESPONSE = {
  success: true,
  report: {
    summary: {
      repositoryFilesTotal: 10,
      findingsTotal: 2,
      severityCounts: { critical: 0, high: 1, medium: 1, low: 0, info: 0 },
      healthScore: 85,
    },
    gate: { pass: true, blockingCount: 0, warningCount: 0 },
    projectRoot: '/test/project',
  },
};

/**
 * Scan result shape stored in `sb_last_scan_full`.
 * AssessmentView reads this from localStorage on mount and uses it to render
 * compliance checklists (including the EU AI Act section).
 */
const MOCK_SCAN_RESULT = {
  totalFiles: 10,
  issueCount: 2,
  severityCounts: { critical: 0, high: 1, medium: 1, low: 0, info: 0 },
  gate: { pass: true, blockingCount: 0, warningCount: 0 },
  qualityScore: 85,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface InjectOptions {
  /** Pricing plan — determines tier capabilities via useFeatureAccess. */
  plan: 'free' | 'developer';
  /** Number of scans already used this month (free tier cap is 3). */
  scanCount?: number;
  /** If provided, stored as `sb_last_scan_full` for AssessmentView. */
  scanResult?: object;
}

/**
 * Inject localStorage values via `page.addInitScript()` *before* the SPA loads.
 *
 * Sets:
 *   - `sb_token`  — a non-expired JWT so `isTokenExpired()` returns false.
 *   - `sb_user`   — the user object with `plan` and `role` fields.
 *   - `sb_scan_count` / `sb_scan_month` — the free-tier scan counter.
 *   - `sb_last_scan_full` — optional pre-existing scan result for AssessmentView.
 *
 * The JWT is constructed inside the init script (where `btoa` is available)
 * with `exp` far in the future so auth checks pass.
 */
async function injectAuth(page: Page, opts: InjectOptions) {
  await page.addInitScript((args: InjectOptions) => {
    // Build a non-expired JWT (header.payload.signature).
    // exp is in seconds — 99999999999 is ~year 5138.
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ exp: 99999999999, email: 'test@simplebeacon.ai' }));
    const token = `${header}.${payload}.dummy-signature`;

    localStorage.setItem('sb_token', token);
    localStorage.setItem('sb_user', JSON.stringify({
      plan: args.plan,
      role: 'user',
      email: 'test@simplebeacon.ai',
    }));

    if (args.scanCount !== undefined) {
      localStorage.setItem('sb_scan_count', String(args.scanCount));
      // Set month timestamp to now so the 30-day reset doesn't fire.
      localStorage.setItem('sb_scan_month', String(Date.now()));
    }

    if (args.scanResult) {
      localStorage.setItem('sb_last_scan_full', JSON.stringify(args.scanResult));
    }
  }, opts);
}

/**
 * Stub backend API endpoints via `page.route()` so tests don't need a server.
 *
 * Endpoints mocked:
 *   - `GET  /api/scans/count`         — returns the injected scan count.
 *   - `POST /api/scans/increment`     — no-op, returns count + 1.
 *   - `GET  /api/analyze/providers`   — empty response (no server default path).
 *   - `POST /api/analyze/flexible`    — returns a mock scan result.
 */
async function mockApiEndpoints(page: Page, scanCount = 0) {
  // Scan counter sync — return the injected count so localStorage isn't overridden.
  await page.route('**/api/scans/count', (route) => {
    route.fulfill({ status: 200, json: { count: scanCount } });
  });

  // Scan increment — best-effort no-op.
  await page.route('**/api/scans/increment', (route) => {
    route.fulfill({ status: 200, json: { count: scanCount + 1 } });
  });

  // Analyze providers — return empty so serverDefaultPath stays null.
  await page.route('**/api/analyze/providers', (route) => {
    route.fulfill({ status: 200, json: {} });
  });

  // Analyze flexible — return a mock scan result so the results tabs appear.
  await page.route('**/api/analyze/flexible', (route) => {
    route.fulfill({ status: 200, json: MOCK_SCAN_RESPONSE });
  });
}

/**
 * Fill the path input, click "Start Scan", and wait for the results section
 * (with the Export tab) to appear.
 *
 * Uses an absolute path (`/test/project`) to skip the relative-path server
 * resolution logic, which would otherwise make additional API calls.
 */
async function runScanAndWaitForResults(page: Page) {
  // The "local" mode tab (default on localhost) has a path input with a
  // placeholder containing "my-project".
  const pathInput = page.locator('input[placeholder*="my-project"]').first();
  await pathInput.fill('/test/project');

  // Click the Start Scan button (visible when limitReached is false).
  const scanButton = page.getByRole('button', { name: 'Start Scan' });
  await scanButton.click();

  // Wait for the results tabs to render — the "Export" tab only exists
  // inside ScanResults, which mounts when scanState === 'complete'.
  await page.getByRole('tab', { name: 'Export' }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });
}

// ─── Tests: Free-tier scan paywall (criteria 1–4) ────────────────────────────

test.describe('Free-tier scan paywall', () => {
  test('1. Free-tier user with 0 scans sees the Start Scan button (not paywalled)', async ({ page }) => {
    await injectAuth(page, { plan: 'free', scanCount: 0 });
    await mockApiEndpoints(page, 0);
    await page.goto(ANALYZE_URL);

    // The Start Scan button should be visible (limit not reached).
    const scanButton = page.getByRole('button', { name: 'Start Scan' });
    await expect(scanButton).toBeVisible();

    // The paywall overlay should NOT be visible.
    await expect(page.getByText('Free Scan Limit Reached')).not.toBeVisible();
  });

  test('2. Free-tier user with 2 scans sees "1 of 3 free scans remaining this month"', async ({ page }) => {
    await injectAuth(page, { plan: 'free', scanCount: 2 });
    await mockApiEndpoints(page, 2);
    await page.goto(ANALYZE_URL);

    // remaining = maxScans(3) - scanCount(2) = 1
    // The counter text is: "{remaining} of {maxScans} free scans remaining this month"
    await expect(page.getByText('1 of 3 free scans remaining this month')).toBeVisible();
  });

  test('3. Free-tier user with 3 scans (limit reached) sees the "Free Scan Limit Reached" paywall overlay', async ({ page }) => {
    await injectAuth(page, { plan: 'free', scanCount: 3 });
    await mockApiEndpoints(page, 3);
    await page.goto(ANALYZE_URL);

    // The Start Scan button should be replaced by the paywall — not in DOM.
    await expect(page.getByRole('button', { name: 'Start Scan' })).not.toBeVisible();

    // The paywall overlay title should be visible.
    await expect(page.getByText('Free Scan Limit Reached')).toBeVisible();
  });

  test('4. The paywall overlay contains "Upgrade to Developer — $49/mo" CTA', async ({ page }) => {
    await injectAuth(page, { plan: 'free', scanCount: 3 });
    await mockApiEndpoints(page, 3);
    await page.goto(ANALYZE_URL);

    // The upgrade CTA button should be visible inside the paywall card.
    // The button text includes a Sparkles icon + the CTA string.
    await expect(
      page.getByRole('button', { name: /Upgrade to Developer.*\$49\/mo/ })
    ).toBeVisible();
  });
});

// ─── Tests: Free-tier feature paywalls (criteria 5–6) ────────────────────────

test.describe('Free-tier feature paywalls', () => {
  test('5. Export tab shows CI gate paywall for free-tier users', async ({ page }) => {
    // Use 0 scans so the Start Scan button is available (limit not reached).
    await injectAuth(page, { plan: 'free', scanCount: 0 });
    await mockApiEndpoints(page, 0);
    await page.goto(ANALYZE_URL);

    // Complete a scan to reveal the results tabs (Summary, Inventory, …, Export).
    await runScanAndWaitForResults(page);

    // Click the Export tab.
    await page.getByRole('tab', { name: 'Export' }).click();

    // The CI gate paywall should be visible (canUseCiGate is false for free tier).
    await expect(page.getByText('CI/CD Integration is a Developer Feature')).toBeVisible();
  });

  test('6. Assessment page EU AI Act section shows "EU AI Act Mapping is a Team Pro Feature" for free users', async ({ page }) => {
    // Inject a pre-existing scan result so AssessmentView renders checklists
    // (otherwise it shows "No assessment data available").
    await injectAuth(page, { plan: 'free', scanResult: MOCK_SCAN_RESULT });
    await mockApiEndpoints(page, 0);
    await page.goto(ASSESSMENT_URL);

    // The EU AI Act paywall should be visible (canMapEuAiAct is false for free tier).
    await expect(page.getByText('EU AI Act Mapping is a Team Pro Feature')).toBeVisible();
  });
});

// ─── Tests: Developer-tier access (criteria 7–8) ─────────────────────────────

test.describe('Developer-tier access', () => {
  test('7. Developer-tier user does NOT see the scan limit counter (unlimited)', async ({ page }) => {
    await injectAuth(page, { plan: 'developer' });
    await mockApiEndpoints(page, 0);
    await page.goto(ANALYZE_URL);

    // The Start Scan button should be visible.
    await expect(page.getByRole('button', { name: 'Start Scan' })).toBeVisible();

    // The free scan counter text should NOT be visible.
    // Developer tier has maxScans = Infinity, so the counter paragraph is
    // conditionally rendered only when maxScans !== Infinity.
    await expect(page.getByText(/free scans remaining this month/)).not.toBeVisible();
  });

  test('8. Developer-tier user CAN see the Export tab content (no CI gate paywall)', async ({ page }) => {
    await injectAuth(page, { plan: 'developer' });
    await mockApiEndpoints(page, 0);
    await page.goto(ANALYZE_URL);

    // Complete a scan to reveal the results tabs.
    await runScanAndWaitForResults(page);

    // Click the Export tab.
    await page.getByRole('tab', { name: 'Export' }).click();

    // The CI gate paywall should NOT be visible (canUseCiGate is true for developer).
    await expect(page.getByText('CI/CD Integration is a Developer Feature')).not.toBeVisible();

    // The export content should be visible — the "JSON Report" button is
    // rendered inside the Export tab when canUseCiGate is true.
    await expect(page.getByRole('button', { name: 'JSON Report' })).toBeVisible();
  });
});
