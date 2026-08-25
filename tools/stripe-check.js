const { chromium } = require('playwright');
(async () => {
  const url = 'https://checkout.stripe.com/g/pay/cs_live_a1odySNdcM8loGCWWQhXl8dT9PVzvZvjyqzU6ZKNMg2hHVhR9HJ69KnGSL#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSdicGRmZGhqaWBTZHdsZGtxJz8ncXdgZHFoYGtxWjcnKSdicGRmZGhqaWBMa2xxVXdgY2BxZm1TZHdsZGtxJz8nZmprcXdqaScpJ2JwZGZkaGppYElqZGFsa2JWZndgYGtTZHdsZGtxJz8nZmprcXdqaScpJ2R1bE5gfCc%2FJ3VuWmlsc2BaMDRRVWd%2FdERUNWA3NW5%2FTD1vfEg1cU1hV0E0d39UMGRqZ0tXRENfNEp2QUt0am1cdUJNXE9fYjFqdzYwS2hpMDFwV1NsPG9JTmIxZ2hLSndCTk5PV2B9bF81NW5AYHNJbHcxJyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJmNjY2NjYycpJ2lkfGpwcVF8dWAnPyd2bGtiaWBabHFgaCcpJ2BrZGdpYFVpZGZgbWppYWB3dic%2FcXdwYHgl';
  const out = { console: [], requests: [], responses: [] };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', msg => {
    try { out.console.push({ type: msg.type(), text: msg.text() }); } catch (e) { console.error('stripe-check.js error:', e); }
  });
  page.on('requestfailed', req => {
    const f = req.failure ? req.failure() : null;
    out.requests.push({ url: req.url(), method: req.method(), status: 'failed', error: f ? f.errorText : 'unknown' });
  });
  page.on('request', req => {
    out.requests.push({ url: req.url(), method: req.method(), status: 'pending' });
  });
  page.on('response', async res => {
    try {
      const headers = res.headers();
      const ct = headers['content-type'] || headers['Content-Type'] || '';
      const status = res.status();
      let body = '';
      try { if (ct && ct.indexOf('application/json') >= 0) { body = await res.text(); if (body && body.length>10000) body = body.slice(0,10000)+'...'; } }
      catch (e) { body = '<body-read-failed>'; }
      out.responses.push({ url: res.url(), status, headers, bodySnippet: typeof body === 'string' ? body.slice(0,200) : '' });
    } catch (e) { console.error('stripe-check.js error:', e); }
  });

  // Navigate and wait for network to be idle or 30s timeout
  let navError = null;
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => { navError = String(e); return null; });
    if (navError) out.nav = { error: navError };
    else out.nav = { status: response ? response.status() : null, url: response ? response.url() : null };
  } catch (e) {
    out.nav = { error: String(e) };
  }

  // wait an extra 5 seconds to capture late requests
  await page.waitForTimeout(5000);

  // Save a screenshot
  try { await page.screenshot({ path: 'C:/Users/user/CascadeProjects.worktrees/sidebar-button-signin-screen-fix/tools/stripe-check-screenshot.png', fullPage: true }); out.screenshot = 'stripe-check-screenshot.png'; } catch (e) { out.screenshot = 'screenshot-failed'; }

  console.log('---PLAYWRIGHT-RESULT-START---');
  console.log(JSON.stringify(out, null, 2));
  console.log('---PLAYWRIGHT-RESULT-END---');
  await browser.close();
})();
