import { expect, test } from '@playwright/test';

test('dashboard app mounts without JavaScript fallback', async ({ page, baseURL }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message || String(error));
  });

  const rootUrl = baseURL || process.env.DASHBOARD_BASE_URL || 'http://127.0.0.1:3003';
  const targetUrl = new URL('/app/', rootUrl).toString();

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('JavaScript Required')).toHaveCount(0);
  await expect(page.locator('#root, #app').first()).toBeAttached();

  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    // Some environments keep open connections; do not fail solely on network idle timeout.
  });

  expect(pageErrors, `Page errors found on ${targetUrl}: ${pageErrors.join('; ')}`).toEqual([]);
});
