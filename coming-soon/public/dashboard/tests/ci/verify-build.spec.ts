import { test, expect } from '@playwright/test';

test.describe('Vite Production Asset Export Integrity check', () => {
  const fatalErrors: string[] = [];

  test.beforeEach(({ page }) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        msg.type() === 'error' &&
        (text.includes('does not provide an export') || text.includes('TypeError') || text.includes('ReferenceError'))
      ) {
        fatalErrors.push(`[Console Error] ${text}`);
      }
    });

    page.on('pageerror', (err) => {
      fatalErrors.push(`[Page Error] ${err.stack || err.message}`);
    });
  });

  test('should boot the landing dashboard without missing bundle exports', async ({ page }) => {
    await page.goto('/');

    // Allow a short window for dynamic chunk imports to settle
    await page.waitForTimeout(2000);

    expect(fatalErrors).toEqual([]);
  });
});
