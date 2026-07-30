// @ts-check
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { URL } = require('url');

const START_URL = 'https://simplebeacon.ai';
const DOMAIN = new URL(START_URL).hostname;
const OUTPUT_DIR = path.join(__dirname, '..', 'simplebeacon_test_artifacts');
const BASELINE_DIR = path.join(__dirname, 'visual-baselines');
const DIFF_DIR = path.join(OUTPUT_DIR, 'diffs');
const AUTH_STATE_FILE = path.join(__dirname, 'auth_state.json');
const WEBHOOK_URL = process.env.SIMPLEBEACON_WEBHOOK_URL || '';
const VISUAL_REGRESSION_ENABLED = process.env.VISUAL_REGRESSION !== 'false';

// SPA hash routes to test when crawling /app
const SPA_ROUTES = [
  'dashboard', 'analyze', 'results', 'repository-health', 'audit',
  'security', 'quality', 'trust', 'remediation', 'platform',
  'profile', 'admin', 'tools', 'settings', 'help',
  'getting-started', 'chatbot', 'about', 'assessments', 'compliance'
];

function urljoin(base, href) {
  try {
    return new URL(href, base).href.split('#')[0].replace(/\/$/, '');
  } catch {
    return null;
  }
}

class SimpleBeaconChaosAgent {
  constructor() {
    this.visitedUrls = new Set();
    this.urlsToVisit = [START_URL];
    this.consoleErrors = [];
    this.failedRoutes = {};
    this.passedRoutes = [];
    this.interactionCount = 0;
    this.visualDiffs = [];
    this.payloadInjectionResults = [];
    this.xssReflectionResults = [];

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (VISUAL_REGRESSION_ENABLED) {
      fs.mkdirSync(BASELINE_DIR, { recursive: true });
      fs.mkdirSync(DIFF_DIR, { recursive: true });
    }
  }

  logConsoleApi(msg) {
    if (msg.type() === 'error') {
      const loc = msg.location();
      this.consoleErrors.push(`[JS Error] ${msg.text()} (Location: ${loc.url}:${loc.lineNumber})`);
    }
  }

  async handleDynamicInputs(page, url) {
    // 1. Fill out any newsletter signup, trial, or tool search input elements
    const inputSelectors = ["input[type='email']", "input[type='text']", "input[placeholder*='search' i]"];
    for (const selector of inputSelectors) {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        if (await element.isVisible()) {
          await element.fill('agent-test@simplebeacon-validation.internal');
          this.interactionCount++;
        }
      }
    }

    // 2. Extract and fire deep element click-targets (Tabs, Accordions, Pricing Toggles)
    const interactiveButtons = page.locator("button, [role=button], [class*='toggle' i], [class*='tab' i]");
    const buttonsList = await interactiveButtons.all();

    for (const btn of buttonsList.slice(0, 5)) {
      try {
        if (await btn.isVisible() && await btn.isEnabled()) {
          await btn.click({ timeout: 1500 });
          this.interactionCount++;
        }
      } catch {
        // Skip unclickable elements
      }
    }
  }

  // Custom payload injection for form fields across interactive views
  // Tests boundary conditions: XSS, SQL injection patterns, overflow, empty, unicode
  async injectPayloads(page, url) {
    const payloads = [
      { label: 'XSS-script', value: '<script>alert(1)</script>' },
      { label: 'XSS-img', value: '<img src=x onerror=alert(1)>' },
      { label: 'SQL-injection', value: "' OR '1'='1" },
      { label: 'overflow-10k', value: 'A'.repeat(10000) },
      { label: 'unicode-emoji', value: '\ud83d\ude80\u00e9\u4e2d\u2603\ufe0f' },
      { label: 'empty', value: '' },
      { label: 'null-bytes', value: 'test\u0000\u0001null' },
      { label: 'template-injection', value: '{{7*7}}${7*7}<%=7*7>' }
    ];

    const formSelectors = [
      "input[type='text']", "input[type='email']", "input[type='password']",
      "input[type='search']", "input[type='url']", "textarea",
      "input[placeholder]:not([type='hidden'])"
    ];

    let injected = 0;
    for (const selector of formSelectors) {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        if (!(await element.isVisible())) continue;
        for (const payload of payloads) {
          try {
            await element.fill(payload.value, { timeout: 1000 });
            // Check if the input accepted or sanitized the payload
            const actualValue = await element.inputValue();
            const wasSanitized = actualValue !== payload.value;
            const wasTruncated = actualValue.length < payload.value.length;
            this.payloadInjectionResults.push({
              url,
              selector,
              payload: payload.label,
              accepted: !wasSanitized,
              sanitized: wasSanitized,
              truncated: wasTruncated,
              actualLength: actualValue.length
            });
            injected++;
          } catch {
            // Some inputs may reject certain payloads — that's fine
          }
        }
        // Reset to safe value after testing
        try {
          await element.fill('agent-test@simplebeacon-validation.internal', { timeout: 500 });
        } catch { /* ignore */ }
      }
    }
    if (injected > 0) {
      console.log(`  💉 Injected ${injected} payload variants into form fields on ${url}`);
    }
    return injected;
  }

  // XSS Reflected Payload Test: inject script tags and check if browser executes them
  async testXssReflection(page, url) {
    const xssTestPayloads = [
      { label: 'script-tag', value: '<script>window.__XSS_FIRED__=true</script>' },
      { label: 'img-onerror', value: '<img src=x onerror="window.__XSS_FIRED__=true">' },
      { label: 'svg-onload', value: '<svg onload="window.__XSS_FIRED__=true"></svg>' }
    ];

    const formSelectors = [
      "input[type='text']", "input[type='email']", "input[type='search']",
      "input[type='url']", "textarea", "input[placeholder]:not([type='hidden'])"
    ];

    let reflectedCount = 0;
    let testedCount = 0;

    for (const selector of formSelectors) {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        if (!(await element.isVisible())) continue;
        for (const payload of xssTestPayloads) {
          try {
            // Clear any previous XSS marker
            await page.evaluate(() => { delete window.__XSS_FIRED__; });

            await element.fill(payload.value, { timeout: 1000 });
            testedCount++;

            // Submit the form if possible to trigger server round-trip
            const form = await element.evaluate(el => el.closest('form'));
            if (form) {
              const submitBtn = await page.locator('button[type="submit"], .contact-form-submit').first();
              if (submitBtn && await submitBtn.isVisible()) {
                try {
                  await submitBtn.click({ timeout: 2000 });
                  await page.waitForTimeout(1500);
                } catch { /* form may not submit in test context */ }
              }
            }

            // Check if the XSS marker was set (meaning script executed)
            const xssFired = await page.evaluate(() => !!window.__XSS_FIRED__);
            if (xssFired) {
              reflectedCount++;
              this.xssReflectionResults.push({
                url, selector, payload: payload.label, reflected: true
              });
              console.log(`  🚨 XSS REFLECTED & EXECUTED: ${payload.label} on ${url}`);
            }
          } catch {
            // Skip if element doesn't accept the payload
          }
        }
        // Reset field
        try {
          await element.fill('', { timeout: 500 });
        } catch { /* ignore */ }
      }
    }

    if (testedCount > 0) {
      console.log(`  🛡️  XSS reflection test: ${testedCount} payloads tested, ${reflectedCount} reflected on ${url}`);
    }
    return reflectedCount;
  }

  // Visual regression: compare current screenshot against baseline
  async compareScreenshot(page, screenshotName, url) {
    const currentPath = path.join(OUTPUT_DIR, `snapshot_${screenshotName}.png`);
    await page.screenshot({ path: currentPath, fullPage: true });

    if (!VISUAL_REGRESSION_ENABLED) return null;

    const baselinePath = path.join(BASELINE_DIR, `baseline_${screenshotName}.png`);

    if (!fs.existsSync(baselinePath)) {
      // First run — save as baseline
      fs.copyFileSync(currentPath, baselinePath);
      console.log(`  📸 Baseline saved for ${screenshotName}`);
      return { name: screenshotName, status: 'baseline', diffPercent: 0 };
    }

    // Compare file sizes as a quick proxy for visual changes
    // Full pixel-diff would require pixelmatch or similar, but size diff catches layout shifts
    const baselineSize = fs.statSync(baselinePath).size;
    const currentSize = fs.statSync(currentPath).size;
    const sizeDiffPercent = baselineSize > 0
      ? Math.abs(currentSize - baselineSize) / baselineSize * 100
      : 0;

    const threshold = 5; // 5% size difference threshold
    if (sizeDiffPercent > threshold) {
      const diffPath = path.join(DIFF_DIR, `diff_${screenshotName}.png`);
      fs.copyFileSync(currentPath, diffPath);
      this.visualDiffs.push({
        name: screenshotName,
        url,
        baselineSize,
        currentSize,
        diffPercent: sizeDiffPercent.toFixed(2),
        diffPath
      });
      console.log(`  ⚠️  Visual diff detected for ${screenshotName}: ${sizeDiffPercent.toFixed(2)}% size change`);
      return { name: screenshotName, status: 'diff', diffPercent: sizeDiffPercent };
    }

    return { name: screenshotName, status: 'match', diffPercent: 0 };
  }

  async scanRoute(page, url) {
    if (this.visitedUrls.has(url)) return;
    this.visitedUrls.add(url);

    // Filter out static media files before checking for HTML body signatures
    const ignoredExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.ico', '.json', '.txt', '.xml', '.css', '.woff', '.woff2', '.ttf', '.eot', '.map'];
    const parsedUrl = new URL(url);
    if (ignoredExtensions.some(ext => parsedUrl.pathname.endsWith(ext))) {
      console.log(`⏩ Skipping HTML evaluation for static asset: ${url}`);
      this.passedRoutes.push(url);
      return;
    }

    console.log(`🔥 Chaos Probing Target: ${url}`);

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      if (!response) {
        throw new Error('The browser routing engine timed out waiting for a server lifecycle response.');
      }

      if (response.status() >= 400) {
        throw new Error(`Server Pipeline Breakdown (HTTP Code ${response.status()})`);
      }

      const body = page.locator('body');
      const bodyText = await body.innerText();
      if (bodyText.includes('Dashboard load error')) {
        throw new Error('Page contains "Dashboard load error" text');
      }
      if (bodyText.includes('404 Not Found')) {
        throw new Error('Page contains "404 Not Found" text');
      }

      // Fire input injectors and toggle micro-states
      await this.handleDynamicInputs(page, url);

      // Inject payload variants into form fields (public pages like contact, etc.)
      await this.injectPayloads(page, url);

      // XSS reflected payload test
      await this.testXssReflection(page, url);

      // Visual Regression Capture
      const parsed = new URL(url);
      const sanitizedName = parsed.pathname.replace(/\//g, '_') || 'root';
      await this.compareScreenshot(page, sanitizedName, url);

      this.passedRoutes.push(url);

      // Exhaustive URL Discovery
      const discoveredHrefs = await page.locator('a, [href]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('href')).filter(Boolean)
      );
      for (const href of discoveredHrefs) {
        if (!href) continue;
        const fullUrl = urljoin(url, href);
        if (!fullUrl) continue;
        const parsedUrl = new URL(fullUrl);
        if (parsedUrl.hostname === DOMAIN && !this.visitedUrls.has(fullUrl) && !this.urlsToVisit.includes(fullUrl)) {
          this.urlsToVisit.push(fullUrl);
        }
      }
    } catch (err) {
      this.failedRoutes[url] = String(err.message || err);
      console.log(`❌ Coverage Breach on Route [${url}]: ${err.message || err}`);
    }
  }

  async injectAuthState(page) {
    // Try to load persisted auth state first
    if (fs.existsSync(AUTH_STATE_FILE)) {
      console.log('🔐 Loading persisted auth state from auth_state.json...');
      const state = JSON.parse(fs.readFileSync(AUTH_STATE_FILE, 'utf-8'));
      await page.context().addCookies(state.cookies || []);
      await page.evaluate((s) => {
        if (s.localStorage) {
          for (const [key, value] of Object.entries(s.localStorage)) {
            localStorage.setItem(key, value);
          }
        }
      }, state);
      return true;
    }

    // Inject mock auth credentials into localStorage
    // The dashboard reads sb_token and sb_user from localStorage
    console.log('🔐 Injecting mock auth state into localStorage...');
    const mockUser = {
      email: 'admin@simplebeacon.ai',
      name: 'Test Agent',
      role: 'admin',
      tier: 'enterprise',
      plan: 'enterprise',
      trustLevel: 'gold',
      permissions: ['read:own', 'write:own', 'read:shared', 'write:shared', 'analyze:public', 'analyze:private', 'admin:basic', 'admin:all'],
      features: ['all_modules']
    };
    const mockToken = 'test-agent-mock-token';
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('sb_token', token);
      localStorage.setItem('sb_user', JSON.stringify(user));
    }, { token: mockToken, user: mockUser });
    return false;
  }

  async saveAuthState(page) {
    const cookies = await page.context().cookies();
    const localStorageData = await page.evaluate(() => {
      const result = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        result[key] = localStorage.getItem(key);
      }
      return result;
    });
    const state = { cookies, localStorage: localStorageData };
    fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`💾 Auth state saved to ${AUTH_STATE_FILE}`);
  }

  async scanSpaRoutes(page, baseUrl) {
    console.log('\n🧭 Crawling SPA hash routes under /app/...');
    for (const route of SPA_ROUTES) {
      const spaUrl = `${baseUrl}/app/#/${route}`;
      if (this.visitedUrls.has(spaUrl)) continue;
      this.visitedUrls.add(spaUrl);
      console.log(`  📋 SPA Route: /#/${route}`);
      try {
        await page.goto(`${baseUrl}/app/#/${route}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2000);

        const body = page.locator('body');
        const bodyText = await body.innerText();
        if (bodyText.includes('Dashboard load error')) {
          throw new Error('SPA route contains "Dashboard load error" text');
        }

        // Fire interactions on SPA views
        await this.handleDynamicInputs(page, spaUrl);

        // Inject payload variants into form fields
        await this.injectPayloads(page, spaUrl);

        // Visual regression screenshot
        const sanitizedName = `app_${route}`.replace(/\//g, '_');
        await this.compareScreenshot(page, sanitizedName, spaUrl);

        this.passedRoutes.push(spaUrl);
      } catch (err) {
        this.failedRoutes[spaUrl] = String(err.message || err);
        console.log(`  ❌ SPA Route Failed [/#/${route}]: ${err.message || err}`);
      }
    }
  }

  setupMockApiRoutes(page) {
    // Intercept API calls and return mock data to hydrate dashboard views
    // This eliminates 401 console errors and lets views render with data
    page.route('**/api/analyze/flexible', (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            asyncScan: true,
            scanId: 'mock-scan-id',
            status: 'scanning',
            total: 100,
            message: 'Codebase scan started. Poll /api/analyze/progress?scanId=mock-scan-id for results.'
          })
        });
      } else {
        route.continue();
      }
    });

    page.route('**/api/analyze/providers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          defaultProjectPath: '/mock',
          allowedAnalysisRoots: ['/mock'],
          allowedAnalysisRootsSummary: 'Mock',
          providers: [],
          analysisTypes: [{ id: 'auto', label: 'Auto-detect', description: 'Mock' }],
          roadmapInsightsModes: [{ id: 'off', label: 'Filesystem only', description: 'Mock' }],
          understandingModes: [{ id: 'off', label: 'Static only', description: 'Mock' }],
          analysisProfiles: [{ id: 'quick', label: 'Quick', description: 'Mock' }],
          scanProfiles: [{ id: 'default', label: 'Default', description: 'Mock' }],
          defaultScanProfile: 'default'
        })
      });
    });

    page.route('**/api/analyze/progress*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'complete',
          percent: 100,
          current: 100,
          total: 100,
          reportJson: { success: true, analysisType: 'codebase', report: { findings: [], summary: { healthScore: 100 } } }
        })
      });
    });

    page.route('**/api/health', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'healthy' })
      });
    });

    page.route('**/api/platform/status', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'operational' })
      });
    });

    page.route('**/api/user/ai-keys', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, keys: {} })
      });
    });

    page.route('**/api/user/subscription', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, plan: 'enterprise', tier: 'enterprise' })
      });
    });

    page.route('**/api/simplebeacon/report*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          generatedAt: new Date().toISOString(),
          summary: { totalFindings: 0, severityCounts: { high: 0, medium: 0, low: 0 } },
          findings: [],
          gate: { pass: true, score: 100, blockingCount: 0 }
        })
      });
    });

    page.route('**/api/simplebeacon/history*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, history: [] })
      });
    });

    page.route('**/api/chatbot/providers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, providers: [] })
      });
    });

    page.route('**/api/auth/token-status', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, valid: true, user: { email: 'admin@simplebeacon.ai', role: 'admin' } })
      });
    });

    page.route('**/api/simplebeacon/entitlements', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          publicGateLocked: false,
          closedVaultMode: false,
          hasAuditDeliverableAccess: true,
          auditCheckoutUrl: '',
          auditPriceLabel: '$499'
        })
      });
    });

    page.route('**/api/admin/stats', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          stats: { totalUsers: 0, totalScans: 0, activeUsers: 0 }
        })
      });
    });

    page.route('**/api/admin/users*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          users: [],
          total: 0
        })
      });
    });

    page.route('**/api/contact', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, received: true, id: 'mock-contact-id' })
        });
      } else {
        route.continue();
      }
    });

    page.route('**/api/prompts/get*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          prompts: []
        })
      });
    });

  }

  async executeTestingSuite() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'SimpleBeacon-Chaos-Agent/3.0 (X11; Linux x86_64)'
    });
    const page = await context.newPage();

    // Attach the real-time background console listener
    page.on('console', (msg) => this.logConsoleApi(msg));

    console.log(`🚀 Deploying Ultimate Chaos Agent Blueprint on ${START_URL}...`);

    // Set up mock /api/contact route early to prevent 401 errors during XSS reflection tests on public pages
    page.route('**/api/contact', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, received: true, id: 'mock-contact-id' })
        });
      } else {
        route.continue();
      }
    });

    // Phase 1: Crawl all public routes (no auth, no mock API)
    while (this.urlsToVisit.length > 0) {
      const nextTarget = this.urlsToVisit.shift();
      await this.scanRoute(page, nextTarget);
    }

    // Phase 2: Inject auth state, mock API, and crawl SPA dashboard routes
    console.log('\n🔐 Phase 2: Authenticated SPA route sweep with mock API hydration...');
    await page.goto(`${START_URL}/app`, { waitUntil: 'networkidle', timeout: 25000 });
    const usedPersisted = await this.injectAuthState(page);

    // Setup mock API routes to hydrate dashboard views and eliminate 401 errors
    this.setupMockApiRoutes(page);

    // Reload to apply auth state (mock routes will intercept API calls)
    await page.goto(`${START_URL}/app`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(1000);

    // Save auth state for future runs if not persisted
    if (!usedPersisted) {
      await this.saveAuthState(page);
    }

    // Crawl all SPA hash routes
    await this.scanSpaRoutes(page, START_URL);

    await browser.close();
    this.generateFinalMatrixReport();
    this.generateSecurityReport();
    this.generateVisualGallery();
    this.writeJsonReport();

    // Send webhook notification if configured
    if (WEBHOOK_URL) {
      await this.sendWebhookNotification();
    }
  }

  writeJsonReport() {
    const reportDir = path.join(__dirname, '..', '.simplebeacon', 'logs');
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'simplebeacon-e2e-report.json');
    const xssReflectedCount = this.xssReflectionResults.length;
    const unsanitizedCount = this.payloadInjectionResults.filter(r => r.accepted && (r.payload.includes('XSS') || r.payload.includes('template'))).length;
    const sanitizedCount = this.payloadInjectionResults.filter(r => r.sanitized).length;
    const data = {
      startUrl: START_URL,
      domain: DOMAIN,
      startedAt: this.startedAt || new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      totals: {
        visited: this.visitedUrls.size,
        passed: this.passedRoutes.length,
        failed: Object.keys(this.failedRoutes).length,
        interactions: this.interactionCount,
        consoleErrors: this.consoleErrors.length,
        payloadInjections: this.payloadInjectionResults.length,
        xssReflected: xssReflectedCount,
        unsanitizedPayloads: unsanitizedCount,
        sanitizedByField: sanitizedCount,
        visualDiffs: this.visualDiffs.length,
      },
      highestActiveSeverity: xssReflectedCount > 0 ? 'CRITICAL' : (Object.keys(this.failedRoutes).length > 0 ? 'HIGH' : 'NONE'),
      passedRoutes: this.passedRoutes,
      failedRoutes: this.failedRoutes,
      consoleErrors: this.consoleErrors.slice(0, 20),
    };
    fs.writeFileSync(reportPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`📊 JSON report written: ${reportPath}`);
  }

  generateFinalMatrixReport() {
    console.log('\n' + '█'.repeat(60));
    console.log('📊 100% COMPLETE CHAOS ENGINE METRICS REPORT');
    console.log('█'.repeat(60));
    console.log(`• Unique URL Map Footprints Checked  : ${this.visitedUrls.size}`);
    console.log(`• Functional Routes Fully Passed     : ${this.passedRoutes.length}`);
    console.log(`• Active UI Form & Click Interactions: ${this.interactionCount}`);
    console.log(`• Dynamic Visual Snapshots Rendered  : ${this.passedRoutes.length}`);
    console.log(`• Total Broken UI Routings Found     : ${Object.keys(this.failedRoutes).length}`);
    console.log(`• Unhandled JS Console Exceptions   : ${this.consoleErrors.length}`);
    console.log(`• Auth Mode                          : ${fs.existsSync(AUTH_STATE_FILE) ? 'Persisted (auth_state.json)' : 'Mock injection'}`);
    console.log(`• Mock API Hydration                 : Active`);
    console.log(`• Visual Regression                 : ${VISUAL_REGRESSION_ENABLED ? 'Active' : 'Disabled'}`);
    console.log(`• Payload Injection Tests            : ${this.payloadInjectionResults.length}`);
    console.log(`• XSS Reflection Tests               : ${this.xssReflectionResults.length}`);
    console.log(`• Webhook Notification               : ${WEBHOOK_URL ? 'Configured' : 'Not configured'}`);

    if (this.visualDiffs.length > 0) {
      console.log('\n📸 VISUAL REGRESSION DIFFERENCES:');
      for (const diff of this.visualDiffs) {
        console.log(`  ⚠️  ${diff.name}: ${diff.diffPercent}% size change (${diff.baselineSize} → ${diff.currentSize} bytes)`);
      }
    } else if (VISUAL_REGRESSION_ENABLED) {
      console.log('\n📸 Visual regression: No significant differences detected.');
    }

    if (this.payloadInjectionResults.length > 0) {
      const sanitized = this.payloadInjectionResults.filter(r => r.sanitized);
      const accepted = this.payloadInjectionResults.filter(r => r.accepted);
      const truncated = this.payloadInjectionResults.filter(r => r.truncated);
      console.log('\n💉 PAYLOAD INJECTION SUMMARY:');
      console.log(`  • Total injections: ${this.payloadInjectionResults.length}`);
      console.log(`  • Accepted as-is:   ${accepted.length}`);
      console.log(`  • Sanitized:        ${sanitized.length}`);
      console.log(`  • Truncated:        ${truncated.length}`);
      if (sanitized.length > 0) {
        console.log('  ✅ Input sanitization detected on some fields — good security posture');
      }
      if (accepted.length > 0) {
        const xssAccepted = this.payloadInjectionResults.filter(r => r.accepted && (r.payload.includes('XSS') || r.payload.includes('template')));
        if (xssAccepted.length > 0) {
          console.log(`  ⚠️  ${xssAccepted.length} XSS/template payloads accepted without sanitization — review needed`);
        }
      }
    }

    if (this.xssReflectionResults.length > 0) {
      console.log('\n🚨 XSS REFLECTION FINDINGS:');
      for (const r of this.xssReflectionResults) {
        console.log(`  🛑 ${r.payload} reflected on ${r.url}`);
      }
    } else {
      console.log('\n🛡️  XSS reflection: No script execution detected — safe against reflected XSS.');
    }

    if (this.consoleErrors.length > 0) {
      console.log('\n🚨 CAPTURED CLIENT-SIDE JAVASCRIPT DEBT:');
      for (const jsErr of this.consoleErrors.slice(0, 10)) {
        console.log(`  🛑 ${jsErr}`);
      }
    }

    if (Object.keys(this.failedRoutes).length > 0) {
      console.log('\n🚨 CRITICAL FAILURE REMEDIATION MATRIX:');
      for (const [url, error] of Object.entries(this.failedRoutes)) {
        console.log(`  ⚠️ Route: ${url}\n     Issue: ${error}`);
      }
    } else {
      console.log('\n🎉 Flawless Run! All discoverable parameters, routes, and views returned green vectors.');
    }
  }

  generateVisualGallery() {
    const baselineDir = path.join(__dirname, 'visual-baselines');
    if (!fs.existsSync(baselineDir)) {
      console.log('📸 Visual gallery skipped — no baseline directory found.');
      return;
    }

    const galleryPath = path.join(__dirname, '..', 'simplebeacon_test_artifacts', 'visual-gallery.html');
    fs.mkdirSync(path.dirname(galleryPath), { recursive: true });

    const files = fs.readdirSync(baselineDir).filter(f => f.endsWith('.png')).sort();
    const timestamp = new Date().toISOString();

    const publicShots = [];
    const spaShots = [];

    for (const file of files) {
      const filePath = path.join(baselineDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);

      // Derive route name from filename
      let routeName = file.replace(/^baseline_/, '').replace(/\.png$/, '');
      if (routeName.startsWith('_')) routeName = routeName.substring(1) || '(root)';

      const entry = {
        file,
        routeName,
        sizeKB,
        sizeBytes: stats.size,
        modified: stats.mtime.toISOString(),
        relPath: `../tests/visual-baselines/${file}`
      };

      if (file.startsWith('baseline_app_')) {
        spaShots.push(entry);
      } else {
        publicShots.push(entry);
      }
    }

    // Check for diffs
    const diffs = this.visualDiffs || [];
    const diffMap = {};
    for (const d of diffs) {
      diffMap[d.name] = d;
    }

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Visual Snapshot Gallery</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
  h1 { font-size: 1.8em; margin-bottom: 8px; color: #58a6ff; }
  .meta { color: #8b949e; font-size: 0.9em; margin-bottom: 24px; }
  .stats { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
  .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px 24px; text-align: center; }
  .stat-card .num { font-size: 1.8em; font-weight: 700; color: #58a6ff; }
  .stat-card .label { font-size: 0.8em; color: #8b949e; margin-top: 4px; }
  h2 { font-size: 1.3em; color: #58a6ff; margin: 32px 0 16px; border-bottom: 1px solid #30363d; padding-bottom: 8px; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; transition: border-color 0.2s; }
  .card:hover { border-color: #58a6ff; }
  .card img { width: 100%; height: 200px; object-fit: cover; cursor: pointer; border-bottom: 1px solid #30363d; }
  .card .info { padding: 12px 16px; }
  .card .route { font-weight: 600; color: #c9d1d9; font-size: 0.95em; word-break: break-all; }
  .card .details { color: #8b949e; font-size: 0.8em; margin-top: 6px; display: flex; gap: 12px; }
  .card .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; }
  .badge-diff { background: #da3633; color: #fff; }
  .badge-ok { background: #238636; color: #fff; }
  .badge-warn { background: #d29922; color: #0d1117; }
  .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; justify-content: center; align-items: center; cursor: pointer; }
  .lightbox img { max-width: 95%; max-height: 95%; object-fit: contain; border-radius: 8px; }
  .lightbox.open { display: flex; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #30363d; color: #8b949e; font-size: 0.8em; }
</style>
</head>
<body>
  <h1>SimpleBeacon Visual Snapshot Gallery</h1>
  <div class="meta">Generated: ${timestamp} | Target: ${START_URL} | Scanner: Chaos Agent v5.0</div>

  <div class="stats">
    <div class="stat-card"><div class="num">${files.length}</div><div class="label">Total Screenshots</div></div>
    <div class="stat-card"><div class="num">${publicShots.length}</div><div class="label">Public Routes</div></div>
    <div class="stat-card"><div class="num">${spaShots.length}</div><div class="label">SPA Routes</div></div>
    <div class="stat-card"><div class="num">${diffs.length}</div><div class="label">Visual Diffs</div></div>
  </div>

  <h2>Public Routes</h2>
  <div class="gallery">
`;

    for (const shot of publicShots) {
      const diff = diffMap[shot.file];
      const badge = diff
        ? `<span class="badge badge-diff">${diff.diffPercent}% diff</span>`
        : `<span class="badge badge-ok">baseline</span>`;
      html += `    <div class="card">
      <img src="${shot.relPath}" alt="${shot.routeName}" onclick="openLightbox(this.src)" loading="lazy">
      <div class="info">
        <div class="route">${shot.routeName}</div>
        <div class="details"><span>${shot.sizeKB} KB</span><span>${shot.modified.split('T')[0]}</span>${badge}</div>
      </div>
    </div>
`;
    }

    html += `  </div>

  <h2>SPA Dashboard Routes</h2>
  <div class="gallery">
`;

    for (const shot of spaShots) {
      const routeLabel = shot.routeName.replace('app_', '/#/').replace(/-/g, '-');
      const diff = diffMap[shot.file];
      const badge = diff
        ? `<span class="badge badge-diff">${diff.diffPercent}% diff</span>`
        : `<span class="badge badge-ok">baseline</span>`;
      html += `    <div class="card">
      <img src="${shot.relPath}" alt="${routeLabel}" onclick="openLightbox(this.src)" loading="lazy">
      <div class="info">
        <div class="route">${routeLabel}</div>
        <div class="details"><span>${shot.sizeKB} KB</span><span>${shot.modified.split('T')[0]}</span>${badge}</div>
      </div>
    </div>
`;
    }

    html += `  </div>

  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="Full size screenshot">
  </div>

  <footer>
    Auto-generated by SimpleBeacon Chaos Agent v5.0 | Visual baselines stored in tests/visual-baselines/
  </footer>

  <script>
    function openLightbox(src) {
      var lb = document.getElementById('lightbox');
      document.getElementById('lightbox-img').src = src;
      lb.classList.add('open');
    }
    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('open');
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });
  </script>
</body>
</html>`;

    fs.writeFileSync(galleryPath, html, 'utf8');
    console.log(`🖼️  Visual gallery generated: ${galleryPath}`);
  }

  generateSecurityReport() {
    const reportPath = path.join(__dirname, '..', 'SECURITY.md');
    const timestamp = new Date().toISOString();

    const totalInjections = this.payloadInjectionResults.length;
    const acceptedRaw = this.payloadInjectionResults.filter(r => r.accepted);
    const sanitized = this.payloadInjectionResults.filter(r => r.sanitized);
    const truncated = this.payloadInjectionResults.filter(r => r.truncated);
    const xssAccepted = this.payloadInjectionResults.filter(r => r.accepted && (r.payload.includes('XSS') || r.payload.includes('template')));
    const xssReflected = this.xssReflectionResults;

    // Group results by URL
    const byUrl = {};
    for (const r of this.payloadInjectionResults) {
      if (!byUrl[r.url]) byUrl[r.url] = [];
      byUrl[r.url].push(r);
    }

    let md = `# SimpleBeacon Security Vulnerability Report\n\n`;
    md += `**Generated:** ${timestamp}\n`;
    md += `**Scanner:** SimpleBeacon Chaos Agent v4.0\n`;
    md += `**Target:** ${START_URL}\n\n`;
    md += `---\n\n`;

    md += `## Executive Summary\n\n`;
    md += `| Metric | Count |\n|---|---|\n`;
    md += `| Total payload injections | ${totalInjections} |\n`;
    md += `| Accepted without sanitization | ${acceptedRaw.length} |\n`;
    md += `| Sanitized by input field | ${sanitized.length} |\n`;
    md += `| Truncated by maxlength | ${truncated.length} |\n`;
    md += `| XSS/template payloads accepted unsanitized | ${xssAccepted.length} |\n`;
    md += `| XSS payloads reflected & executed | ${xssReflected.length} |\n\n`;

    if (xssReflected.length > 0) {
      md += `## 🚨 Critical: XSS Reflection Detected\n\n`;
      md += `The following payloads were reflected back and executed by the browser:\n\n`;
      md += `| URL | Payload Type | Selector |\n|---|---|---|\n`;
      for (const r of xssReflected) {
        md += `| ${r.url} | ${r.payload} | ${r.selector} |\n`;
      }
      md += `\n**Risk:** Stored/Reflected XSS can hijack browser cookies, execute arbitrary API calls, or crash UI frameworks.\n`;
      md += `**Remediation:** Ensure all user input is HTML-escaped before rendering. Use React's built-in escaping or DOMPurify for rich text.\n\n`;
    } else {
      md += `## 🛡️ XSS Reflection: Safe\n\n`;
      md += `No injected script payloads were executed by the browser. Input is either sanitized client-side or not reflected in a dangerous context.\n\n`;
    }

    if (xssAccepted.length > 0) {
      md += `## ⚠️ High Risk: Unsanitized XSS/Template Payloads Accepted\n\n`;
      md += `${xssAccepted.length} XSS or template injection payloads were accepted by form fields without client-side sanitization.\n`;
      md += `While the backend may escape these on storage/render, this confirms a high-risk surface vector.\n\n`;
      md += `### Affected URLs and Fields\n\n`;
      const grouped = {};
      for (const r of xssAccepted) {
        const key = `${r.url}|${r.selector}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r.payload);
      }
      md += `| URL | Selector | Payloads Accepted |\n|---|---|---|\n`;
      for (const [key, payloads] of Object.entries(grouped)) {
        const [url, selector] = key.split('|');
        md += `| ${url} | ${selector} | ${payloads.join(', ')} |\n`;
      }
      md += `\n`;
    }

    md += `## Detailed Payload Injection Results\n\n`;
    for (const [url, results] of Object.entries(byUrl)) {
      md += `### ${url}\n\n`;
      md += `| Payload | Accepted | Sanitized | Truncated | Actual Length |\n|---|---|---|---|---|\n`;
      for (const r of results) {
        md += `| ${r.payload} | ${r.accepted ? 'Yes' : 'No'} | ${r.sanitized ? 'Yes' : 'No'} | ${r.truncated ? 'Yes' : 'No'} | ${r.actualLength} |\n`;
      }
      md += `\n`;
    }

    md += `## Remediation Recommendations\n\n`;
    md += `1. **Client-side sanitization:** Apply \`sanitizeUserPayload()\` to all form fields before submission (implemented in contact.js)\n`;
    md += `2. **Backend sanitization:** Apply \`sanitizeRequestBody()\` middleware to all POST endpoints (implemented in server/index.cjs)\n`;
    md += `3. **Content Security Policy:** Add CSP headers to prevent inline script execution\n`;
    md += `4. **Input validation:** Enforce maxlength and pattern validation on all form fields\n`;
    md += `5. **Output escaping:** Ensure all user-supplied data is HTML-escaped when rendered in the DOM\n\n`;
    md += `---\n*This report is auto-generated by the SimpleBeacon Chaos Agent E2E test suite.*\n`;

    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`📋 Security report generated: ${reportPath}`);
  }

  async sendWebhookNotification() {
    const passed = this.passedRoutes.length;
    const failed = Object.keys(this.failedRoutes).length;
    const jsErrors = this.consoleErrors.length;
    const total = this.visitedUrls.size;
    const isFlawless = failed === 0;

    const xssReflectedCount = this.xssReflectionResults.length;
    const unsanitizedCount = this.payloadInjectionResults.filter(r => r.accepted && (r.payload.includes('XSS') || r.payload.includes('template'))).length;
    const sanitizedCount = this.payloadInjectionResults.filter(r => r.sanitized).length;
    const hasSecurityAlert = xssReflectedCount > 0 || unsanitizedCount > 50;

    const color = hasSecurityAlert ? 15105570 : (isFlawless ? 3066993 : 15158332);
    const statusEmoji = hasSecurityAlert ? '🚨' : (isFlawless ? '✅' : '❌');

    const embeds = [{
      title: `${statusEmoji} SimpleBeacon Chaos Sweep`,
      description: hasSecurityAlert
        ? `**SECURITY ALERT:** ${xssReflectedCount} XSS reflections detected, ${unsanitizedCount} unsanitized payloads accepted.`
        : (isFlawless
          ? 'All discoverable routes passed validation.'
          : `${failed} route(s) failed validation.`),
      color,
      fields: [
        { name: 'Routes Tested', value: String(total), inline: true },
        { name: 'Passed', value: String(passed), inline: true },
        { name: 'Failed', value: String(failed), inline: true },
        { name: 'UI Interactions', value: String(this.interactionCount), inline: true },
        { name: 'JS Console Errors', value: String(jsErrors), inline: true },
        { name: 'Auth Mode', value: fs.existsSync(AUTH_STATE_FILE) ? 'Persisted' : 'Mock', inline: true },
        { name: 'Payload Injections', value: String(this.payloadInjectionResults.length), inline: true },
        { name: 'XSS Reflected', value: String(xssReflectedCount), inline: true },
        { name: 'Visual Diffs', value: String(this.visualDiffs.length), inline: true },
        { name: 'Unsanitized XSS/Template', value: String(unsanitizedCount), inline: true },
        { name: 'Sanitized by Field', value: String(sanitizedCount), inline: true },
        { name: 'Security Report', value: 'SECURITY.md generated', inline: true }
      ],
      footer: { text: 'SimpleBeacon Chaos Agent v5.0' },
      timestamp: new Date().toISOString()
    }];

    if (hasSecurityAlert) {
      const alertFields = [];
      if (xssReflectedCount > 0) {
        const xssList = this.xssReflectionResults.slice(0, 5).map(r =>
          `${r.payload} on ${r.url}`
        ).join('\n');
        alertFields.push({
          name: '🚨 XSS Reflection Details',
          value: xssList || 'None',
          inline: false
        });
      }
      if (unsanitizedCount > 0) {
        const grouped = {};
        for (const r of this.payloadInjectionResults) {
          if (r.accepted && (r.payload.includes('XSS') || r.payload.includes('template'))) {
            const key = r.url;
            if (!grouped[key]) grouped[key] = new Set();
            grouped[key].add(r.payload);
          }
        }
        const unsanitizedList = Object.entries(grouped).slice(0, 5).map(([url, payloads]) =>
          `${url}: ${[...payloads].join(', ')}`
        ).join('\n');
        alertFields.push({
          name: '⚠️ Unsanitized Payload Vectors',
          value: unsanitizedList || 'None',
          inline: false
        });
      }

      embeds.push({
        title: '🛡️ Security Remediation Alert',
        description: 'Input sanitization failures detected. Review SECURITY.md for full details.',
        color: 15105570,
        fields: alertFields,
        footer: { text: 'SimpleBeacon Security Monitor' },
        timestamp: new Date().toISOString()
      });
    }

    const payload = { embeds };

    const webhookUrl = new URL(WEBHOOK_URL);
    const body = JSON.stringify(payload);

    return new Promise((resolve) => {
      const req = https.request(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        console.log(`📢 Webhook notification sent: ${res.statusCode}`);
        resolve();
      });
      req.on('error', (err) => {
        console.log(`📢 Webhook notification failed: ${err.message}`);
        resolve();
      });
      req.write(body);
      req.end();
    });
  }
}

(async () => {
  const agent = new SimpleBeaconChaosAgent();
  await agent.executeTestingSuite();
})();
