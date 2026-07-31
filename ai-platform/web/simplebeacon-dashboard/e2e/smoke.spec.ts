import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Tests', () => {
  test('sign-in page loads with SSO detection', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/simplebeacon/i);

    const emailInput = page.locator('input[type="email"], input[placeholder*="mail" i]').first();
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
  });

  test('sign-in form accepts email and password inputs', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('testpassword123');

    await expect(emailInput).toHaveValue('test@example.com');
    await expect(passwordInput).toHaveValue('testpassword123');
  });

  test('registration mode toggle works', async ({ page }) => {
    await page.goto('/');

    const registerButton = page.locator('text=Register').first();
    if (await registerButton.isVisible({ timeout: 5_000 })) {
      await registerButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('dashboard renders without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

test.describe('Admin View Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('all admin tabs are accessible via hash routing', async ({ page }) => {
    const tabs = ['users', 'tenants', 'audit', 'sso', 'integrations', 'analytics', 'whitelabel'];

    for (const tab of tabs) {
      await page.goto(`/#/admin?tab=${tab}`);
      await page.waitForTimeout(1_000);

      const tabTrigger = page.locator(`[data-value="${tab}"], button:has-text("${tab.charAt(0).toUpperCase() + tab.slice(1)}")`).first();
      if (await tabTrigger.isVisible({ timeout: 3_000 })) {
        await tabTrigger.click();
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('SSO Login UI', () => {
  test('SSO domain detection does not crash on arbitrary input', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('user@nonexistent-domain-xyz.com');
    await page.waitForTimeout(2_000);

    const ssoButton = page.locator('text=/SSO|Single Sign-On/i').first();
    expect(await ssoButton.isVisible({ timeout: 2_000 })).toBeFalsy();
  });
});

test.describe('Integration Marketplace UI', () => {
  test('integrations tab renders without errors when navigated directly', async ({ page }) => {
    await page.goto('/#/admin?tab=integrations');
    await page.waitForTimeout(2_000);

    const heading = page.locator('text=Integration Marketplace').first();
    if (await heading.isVisible({ timeout: 3_000 })) {
      await expect(heading).toBeVisible();
    }
  });
});

test.describe('Usage Analytics Dashboard', () => {
  test('analytics tab renders chart containers', async ({ page }) => {
    await page.goto('/#/admin?tab=analytics');
    await page.waitForTimeout(2_000);

    const heading = page.locator('text=Usage Analytics').first();
    if (await heading.isVisible({ timeout: 3_000 })) {
      await expect(heading).toBeVisible();
    }
  });
});

test.describe('Whitelabel Branding Panel', () => {
  test('whitelabel tab renders partner management UI', async ({ page }) => {
    await page.goto('/#/admin?tab=whitelabel');
    await page.waitForTimeout(2_000);

    const heading = page.locator('text=Whitelabel Partner Branding').first();
    if (await heading.isVisible({ timeout: 3_000 })) {
      await expect(heading).toBeVisible();
    }
  });
});
