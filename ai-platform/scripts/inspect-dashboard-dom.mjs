import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => console.log('[console]', m.type(), m.text()));
  try {
    await page.goto('http://localhost:5173/dashboard/', { timeout: 20000 });
    await page.waitForTimeout(4000);
    const title = await page.title();
    console.log('page.url=', await page.url());
    const rootHTML = await page.$eval('#root', el => el.innerHTML).catch(() => null);
    const emailExists = await page.$('input[type="email"]').then(n => !!n);
    console.log('page.title=', JSON.stringify(title));
    console.log('#root inner length=', rootHTML ? rootHTML.length : 'null');
    console.log('email input present=', emailExists);
    if (rootHTML) console.log('root snippet:', rootHTML.slice(0,500));
  } catch (e) {
    console.error('inspect error', e.stack || e);
  } finally {
    await browser.close();
  }
})();
