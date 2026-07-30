import { test, expect } from '@playwright/test';

test.describe('Dashboard Bundle & Runtime Error Sweep', () => {
  test('Should execute /app/ without throwing unhandled console or compiler errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const unhandledExceptions: Error[] = [];

    // Capture explicit browser console errors (e.g., failed to load resource, CSP violations)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error]: ${msg.text()} at ${msg.location().url}`);
      }
    });

    // Capture uncaught client-side runtime script crashes
    page.on('pageerror', (exception) => {
      unhandledExceptions.push(exception);
    });

    // Navigate to your live or local production-built dashboard path
    const targetUrl = process.env.TEST_TARGET_URL || 'http://localhost:3000/app/';
    const response = await page.goto(targetUrl);

    // 1. Confirm the page successfully returns a valid response
    expect(response?.status()).toBe(200);

    // 2. Assert that the browser is not forced to render the <noscript> safety text
    const fallbackText = page.locator('noscript, [id*="noscript"]');
    await expect(fallbackText).not.toBeVisible();

    // 3. Core DOM validation: Verify that the mounting container successfully populated
    const rootLayout = page.locator('#root, #app, #app-main');
    await expect(rootLayout).toBeAttached();

    // 4. Zero Uncaught Exceptions Gate
    if (unhandledExceptions.length > 0) {
      console.error('Uncaught client-side runtime errors detected:', unhandledExceptions);
    }
    expect(unhandledExceptions).toHaveLength(0);

    // 5. Zero Critical Console Errors Gate
    if (consoleErrors.length > 0) {
      console.warn('Console errors flagged during load:', consoleErrors);
    }
    expect(consoleErrors).toHaveLength(0);
  });
});
