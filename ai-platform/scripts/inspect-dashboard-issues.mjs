import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleMsgs = [];
  const requests = [];
  page.on('console', (msg) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() });
    console.log(`[console:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    consoleMsgs.push({ type: 'pageerror', text: err.stack || String(err) });
    console.error('[pageerror]', err.stack || err);
  });
  page.on('requestfailed', (req) => {
    requests.push({ url: req.url(), failure: req.failure()?.errorText || 'failed' });
    console.error('[requestfailed]', req.url(), req.failure()?.errorText);
  });

  try {
    console.log('navigating to http://localhost:5173/dashboard/');
    const resp = await page.goto('http://localhost:5173/dashboard/', { timeout: 20000 });
    console.log('response status', resp && resp.status());
    await page.waitForTimeout(5000);

    console.log('\n--- Console messages ---');
    consoleMsgs.forEach((m) => console.log(m.type, m.text));
    console.log('\n--- Failed requests ---');
    requests.forEach((r) => console.log(r.url, r.failure));
  } catch (e) {
    console.error('script error', e);
  } finally {
    await browser.close();
  }
})();
