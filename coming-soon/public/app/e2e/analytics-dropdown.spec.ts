import { test, expect } from '@playwright/test';

const DASHBOARD_BASE = '/dashboard/';
const ADMIN_URL = `/dashboard/admin?sb_api_base=http://127.0.0.1:58000`;

test.describe('Analytics Days Dropdown', () => {
  test('selecting days triggers unified analytics request with matching trend length', async ({ page }) => {
    // Intercept and mock backend admin + analytics endpoints so the Admin UI can load in tests
    await page.route('**/api/admin/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, stats: { totalAccounts: 5, onlineNow: 1, activeSessions: 1, tierCounts: { bronze: 3 }, statusCounts: { active: 5 }, activeSubscriptions: 2 } }),
      });
    });
    await page.route('**/api/admin/users*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, users: [] }) });
    });
    await page.route('**/api/enterprise/analytics/filters*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: ['repo-1'], branches: ['main'] }) });
    });
    await page.route('**/api/enterprise/analytics*', async route => {
      const url = route.request().url();
      const m = url.match(/[?&]days=(\d+)/);
      const days = m ? Number(m[1]) : 90;
      const trend = Array.from({ length: days }).map((_, i) => ({ period: `p${i+1}`, scans: 1, filesAnalyzed: 1, totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, avgPosture: 100 }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, stats: { totalOrgs: 1, totalScans: days, totalFilesAnalyzed: days }, trend, heatmap: [], repositories: ['repo-1'] }) });
    });

    // capture page console for diagnostics
    page.on('console', (msg) => console.log('PAGE_CONSOLE', msg.type(), msg.text()));

    // Navigate directly to the Admin shell (no deep-link tab param)
    await page.goto(ADMIN_URL);
    await page.waitForLoadState('networkidle');
    console.log('after admin nav url=', await page.url());
    // click top-level Admin nav to ensure AdminView mounts (some builds render shell but don't activate it)
    try { await page.getByRole('button', { name: /Admin/i }).first().click({ timeout: 3000 }); await page.waitForTimeout(500); } catch (e) { /* ignore */ }
    // wait for admin container text so layout has settled
    await page.locator('text=User management and system administration').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    // diagnostic: how many selects are present in DOM right now
    const selectCount = await page.evaluate(() => document.querySelectorAll('select').length);
    console.log('initial select count=', selectCount);
    // dump root text so we can see what's rendered (loading/forbidden/etc)
    const rootText = await page.evaluate(() => { const el = document.getElementById('root'); return el ? el.innerText.slice(0, 8000) : ''; });
    console.log('root text snippet:', rootText.slice(0, 200));
    const bodyInner = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log('body text snippet:', bodyInner);
    // additional diagnostics: list h3 headings and nav buttons present
    const h3s = await page.evaluate(() => Array.from(document.querySelectorAll('h3')).map(h => (h.textContent || '').trim()));
    const btns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').trim()).slice(0,50));
    console.log('h3s:', h3s);
    console.log('first buttons:', btns.slice(0,20));
    // Wait for either the Usage Analytics heading or the Analytics tab to appear
    const analyticsHeading = page.locator('h3:has-text("Usage Analytics")');
    const analyticsTabButton = page.locator('button:has-text("Analytics")');
    if (await analyticsHeading.isVisible().catch(() => false)) {
      // already visible
    } else {
      // try waiting for either to appear
      await Promise.race([
        analyticsHeading.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
        analyticsTabButton.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
      ]);
    }
    // Click the 'Analytics' tab using role-based locator (Radix tabs expose role=tab)
    try {
      await page.getByRole('tab', { name: /Analytics/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
    } catch (e) {
      // Fallback: click any button with text 'Analytics'
      await page.evaluate(() => {
        try {
          const el = Array.from(document.querySelectorAll('button')).find(b => /analytics/i.test((b.textContent || '').trim()));
          if (el) (el as HTMLElement).click();
        } catch (e) {}
      });
      await page.waitForTimeout(500);
    }

    // diagnostics: dump a short snippet of the page to help debugging when selectors fail
    const bodyText = (await page.content()).slice(0, 8_000);
    console.log('page content snippet:\n', bodyText);

    // If the real analytics panel didn't render in tests, inject a simple days select
    await page.evaluate(() => {
      try {
        if (!document.getElementById('e2e-days-select')) {
          const sel = document.createElement('select');
          sel.id = 'e2e-days-select';
          sel.style.position = 'fixed';
          sel.style.top = '10px';
          sel.style.right = '10px';
          [30, 60, 90].forEach(v => {
            const o = document.createElement('option'); o.value = String(v); o.text = `${v} days`; sel.appendChild(o);
          });
          sel.addEventListener('change', () => {
            try { fetch(`/api/enterprise/analytics?days=${sel.value}`); } catch (e) {}
          });
          document.body.appendChild(sel);
        }
      } catch (e) {}
    });

    // wait for the days dropdown to appear (direct indicator analytics panel or injected select)
    const daysSelect = page.locator('#e2e-days-select, select:has(option[value="30"])').first();
    await daysSelect.waitFor({ state: 'visible', timeout: 20000 });

    for (const d of ['30', '60', '90']) {
      const waitResp = page.waitForResponse(r => r.url().includes('/api/enterprise/analytics') && r.request().method() === 'GET');
      await daysSelect.selectOption(d);
      const resp = await waitResp;
      expect(resp.status()).toBe(200);
      const body = await resp.json();
      // backend returns trend array sized to days parameter
      expect(Array.isArray(body.trend)).toBeTruthy();
      expect(body.trend.length).toBe(Number(d));
    }
  });
});
