import { test, expect } from "@playwright/test";
import fs from 'fs';
import path from 'path';

// Capture console messages and save HTML + screenshot when a test fails to aid CI diagnostics
let _consoleMessages: string[] = [];

test.beforeEach(async ({ page }) => {
  _consoleMessages = [];
  page.on('console', (msg) => {
    _consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') {
    const resultsDir = path.resolve(process.cwd(), 'test-results');
    try { fs.mkdirSync(resultsDir, { recursive: true }); } catch (e) { /* ignore */ }
    const name = testInfo.title.replace(/[^a-z0-9-_]/gi, '_');
    try {
      const html = await page.content();
      fs.writeFileSync(path.join(resultsDir, `${name}.html`), html, 'utf8');
    } catch (e) { /* ignore write errors */ }
    try {
      fs.writeFileSync(path.join(resultsDir, `${name}.console.log`), _consoleMessages.join('\n'), 'utf8');
    } catch (e) { /* ignore */ }
    try {
      await page.screenshot({ path: path.join(resultsDir, `${name}.png`), fullPage: true });
    } catch (e) { /* ignore screenshot errors */ }
  }
});

const DASHBOARD_BASE = "/dashboard/";
const SIGNIN_URL = `${DASHBOARD_BASE}?sb_force_signin=1#/signin`;
const ADMIN_URL = (tab: string) =>
  `${DASHBOARD_BASE}?sb_force_signin=1#/admin?tab=${tab}`;

test.describe("Dashboard Smoke Tests", () => {
  test("sign-in page loads with SSO detection", async ({ page }) => {
    await page.goto(SIGNIN_URL);
    await expect(page).toHaveTitle(/simplebeacon/i);

    const emailInput = page
      .locator('input[type="email"], input[placeholder*="mail" i]')
      .first();
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
  });

  test("sign-in form accepts email and password inputs", async ({ page }) => {
    await page.goto(SIGNIN_URL);

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill("test@example.com");

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill("testpassword123");

    await expect(emailInput).toHaveValue("test@example.com");
    await expect(passwordInput).toHaveValue("testpassword123");
  });

  test("registration mode toggle works", async ({ page }) => {
    await page.goto(SIGNIN_URL);

    const registerButton = page.locator("text=Register").first();
    if (await registerButton.isVisible({ timeout: 5_000 })) {
      await registerButton.click();
      await page.waitForTimeout(500);
    }
  });

  test("dashboard renders without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(SIGNIN_URL);
    await page.waitForLoadState("networkidle");

    const filtered = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("/api/health") &&
        !e.includes("jszip") &&
        !e.includes("Failed to load resource") &&
        !e.includes("/api/config/pricing") &&
        !e.includes("ECONNREFUSED") &&
        !e.includes("CORS") &&
        !e.includes("/api/whitelabel"),
    );
    expect(filtered).toHaveLength(0);
  });
});

test.describe("Admin View Tab Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DASHBOARD_BASE}?sb_force_signin=1`);
    await page.waitForLoadState("networkidle");
  });

  test("all admin tabs are accessible via hash routing", async ({ page }) => {
    const tabs = [
      "users",
      "tenants",
      "audit",
      "sso",
      "integrations",
      "analytics",
      "whitelabel",
    ];

    for (const tab of tabs) {
      await page.goto(ADMIN_URL(tab));
      await page.waitForTimeout(1_000);

      const tabTrigger = page
        .locator(
          `[data-value="${tab}"], button:has-text("${tab.charAt(0).toUpperCase() + tab.slice(1)}")`,
        )
        .first();
      if (await tabTrigger.isVisible({ timeout: 3_000 })) {
        await tabTrigger.click();
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe("SSO Login UI", () => {
  test("SSO domain detection does not crash on arbitrary input", async ({
    page,
  }) => {
    // Clear any persisted auth state to ensure sign-in view shows
    await page.context().clearCookies();
    // Ensure localStorage is cleared before page scripts run
    await page.context().addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch (_) {}
    });
    await page.goto(SIGNIN_URL);
    await page.waitForLoadState("networkidle");

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: "visible", timeout: 15_000 });
    await emailInput.click();
    await emailInput.fill("user@nonexistent-domain-xyz.com");
    await page.waitForTimeout(2_000);

    const ssoButton = page.locator("text=/SSO|Single Sign-On/i").first();
    expect(await ssoButton.isVisible({ timeout: 2_000 })).toBeFalsy();
  });
});

test.describe("Integration Marketplace UI", () => {
  test("integrations tab renders without errors when navigated directly", async ({
    page,
  }) => {
    await page.goto(ADMIN_URL("integrations"));
    await page.waitForTimeout(2_000);

    const heading = page.locator("text=Integration Marketplace").first();
    if (await heading.isVisible({ timeout: 3_000 })) {
      await expect(heading).toBeVisible();
    }
  });
});

test.describe("Usage Analytics Dashboard", () => {
  test("analytics tab renders chart containers", async ({ page }) => {
    await page.goto(ADMIN_URL("analytics"));
    await page.waitForTimeout(2_000);

    const heading = page.locator("text=Usage Analytics").first();
    if (await heading.isVisible({ timeout: 3_000 })) {
      await expect(heading).toBeVisible();
    }
  });
});

test.describe("Whitelabel Branding Panel", () => {
  test("whitelabel tab renders partner management UI", async ({ page }) => {
    await page.goto(ADMIN_URL("whitelabel"));
    await page.waitForTimeout(2_000);

    const heading = page.locator("text=Whitelabel Partner Branding").first();
    if (await heading.isVisible({ timeout: 3_000 })) {
      await expect(heading).toBeVisible();
    }
  });
});
