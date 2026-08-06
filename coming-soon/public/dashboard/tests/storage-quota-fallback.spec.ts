import { test, expect } from '@playwright/test';

test.describe('Storage Quota Fallback Loop', () => {
  test.beforeEach(async ({ page }) => {
    // Adjust base URL if your app serves at a subpath in CI
    await page.goto('/');
  });

  test('should gracefully fall back to IndexedDB when localStorage hits quota limits', async ({ page }) => {
    // 1. Artificially fill localStorage to force a QuotaExceededError boundary
    await page.evaluate(() => {
      try {
        // Attempt to allocate a few MB in localStorage to push browsers toward quota
        const dummy = 'X'.repeat(5 * 1024 * 1024);
        localStorage.setItem('quota_blocker', dummy);
      } catch (e) {
        // ignore — some browsers limit setItem size differently
        // console.info('localStorage saturation simulated', e);
      }
    });

    // 2. Navigate to the Analyze page (assumes a navigation label exists)
    await page.click('text=Analyze');

    // 3. Inject a synthetic large scan report and trigger the app's actual storage pipeline via the test helper.
    await page.evaluate(async () => {
      const mockReport = {
        scanId: 'test-70k-payload',
        repositoryFilesTotal: 72000,
        summary: { totalFiles: 72000, violations: 412 },
        findings: Array.from({ length: 1000 }, (_, i) => ({ id: i, path: `/src/file-${i}.ts`, severity: 'high' })),
      };

      // Call the real app hook exposed for tests. Require its presence to ensure the real code path runs.
      // @ts-ignore
      if (window.SimpleBeaconStorage && typeof window.SimpleBeaconStorage.saveReport === 'function') {
        // @ts-ignore
        await window.SimpleBeaconStorage.saveReport('test-70k-payload', mockReport);
      } else {
        // Fail the test early — the dev/test helper should be available when running E2E.
        throw new Error('SimpleBeaconStorage test helper not found on window');
      }
    });

    // 4. Navigate to Results view and assert that the badge shows IndexedDB (Quota-Safe)
    await page.click('text=Results');

    const badge = page.getByText('IndexedDB (Quota-Safe)');
    await expect(badge).toBeVisible({ timeout: 5000 });

    // 5. Ensure the total files metric is displayed (72,000) — formatting tolerant
    const filesText = page.locator('text=72,000').first();
    const filesAlt = page.locator('text=72000').first();
    await expect(filesText.or(filesAlt)).toBeVisible({ timeout: 5000 });
  });
});
