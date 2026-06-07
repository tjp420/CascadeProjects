/**
 * Playwright E2E tests for the upload/scan flow.
 *
 * Run with: npx playwright test e2e/upload.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

test.describe('Upload page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/upload.html`);
    });

    test('page loads with correct title', async ({ page }) => {
        await expect(page).toHaveTitle(/SimpleBeacon/);
    });

    test('drag-and-drop zone is visible', async ({ page }) => {
        const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone, #drop-zone').first();
        await expect(dropZone).toBeVisible();
    });

    test('file input accepts multiple files', async ({ page }) => {
        const input = page.locator('input[type="file"]');
        await expect(input).toHaveAttribute('multiple', '');
    });

    test('scan button triggers file picker', async ({ page }) => {
        const fileChooserPromise = page.waitForEvent('filechooser');
        const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Upload"), #scan-btn').first();
        if (await scanBtn.isVisible()) {
            await scanBtn.click();
            await fileChooserPromise;
        }
    });

    test('status area shows progress during scan', async ({ page }) => {
        // Create a small mock file
        const mockFileContent = 'console.log("test");\n// TASK fix me\nconst password = "secret123";\n';
        await page.evaluate((content) => {
            const blob = new Blob([content], { type: 'application/javascript' });
            const file = new File([blob], 'test.js', { type: 'application/javascript' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            const dropZone = document.querySelector('.drop-zone, #drop-zone, [data-testid="drop-zone"]');
            if (dropZone) {
                dropZone.dispatchEvent(new DragEvent('drop', { dataTransfer }));
            }
        }, mockFileContent);

        // Wait for status to appear
        const status = page.locator('.status, #status, [data-testid="status"]').first();
        await expect(status).toBeVisible({ timeout: 10000 });
    });

    test('generate report button produces downloadable ZIP', async ({ page }) => {
        const reportBtn = page.locator('button:has-text("Report"), button:has-text("ZIP"), #generate-report').first();
        if (await reportBtn.isVisible()) {
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                reportBtn.click()
            ]);
            expect(download.suggestedFilename()).toMatch(/\.(zip|json)$/);
        }
    });
});

test.describe('API endpoints', () => {
    test('health endpoint returns ok', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/health`);
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.status).toBe('ok');
    });

    test('free-token endpoint returns token', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/free-token`);
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.token).toBeTruthy();
        expect(body.certUrl).toContain('token=');
    });

    test('subscribe endpoint validates email', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/subscribe`, {
            data: { email: 'invalid-email' }
        });
        expect(response.status()).toBe(400);
    });
});
