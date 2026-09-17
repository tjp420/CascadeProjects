const { test, expect } = require('@playwright/test');

test('CertificateModal accessibility and generate flow (visibility + escape)', async ({ page }) => {
  // diagnostic captures
  const debugArtifacts = [];
  const consoleMsgs = [];
  page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));

  async function captureDebug(name) {
    try {
      const dir = 'tests/_debug_artifacts';
      const fs = await import('fs');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const stamp = Date.now();
      const screenshotPath = `${dir}/${name}-${stamp}.png`;
      const htmlPath = `${dir}/${name}-${stamp}.html`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const content = await page.content();
      await fs.promises.writeFile(htmlPath, content, 'utf8');
      await fs.promises.writeFile(`${dir}/${name}-${stamp}.console.log.txt`, consoleMsgs.join('\n'), 'utf8');
      debugArtifacts.push(screenshotPath, htmlPath);
    } catch (er) {
      /* ignore debug failures */
    }
  }

  await page.addInitScript(() => {
    try {
      localStorage.setItem('sb_executive_clearance', '1');
      localStorage.setItem('sb_user', JSON.stringify({ email: 'dev@local', plan: 'executive_clearance' }));
      localStorage.setItem('sb_exec_session', JSON.stringify({ sessionId: 'test-session', canExportCertificates: true, expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString() }));
      // Seed a minimal last-scan payload so ResultsView shows a report
      localStorage.setItem('sb_last_scan_full', JSON.stringify({
        repositoryFilesTotal: 10,
        issueCount: 0,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        gate: { pass: true, blockingCount: 0 },
        qualityScore: 95,
        projectPath: 'local-scan',
        scanScope: { profile: 'standard', resultsViewScope: 'browser-local', codeFilesAnalyzed: 10 }
      }));
      localStorage.setItem('sb_force_show_cert_button', '1');
    } catch {}
  });

  // Navigate directly to the Results view (hash route) where the Certificate button is rendered
  // The preview server serves assets under /dashboard/assets/ — navigate to the full assets path
  // Try loading the app index under the assets path, then set the hash route
  // In dev mode the app is served from /dashboard/ (Vite dev server resolves modules),
  // so load the dashboard root and then set the hash route.
  await page.goto('/dashboard/', { waitUntil: 'domcontentloaded' });
  // set the hash to navigate the SPA router
  await page.evaluate(() => { location.hash = '#/results'; });
  // log URL for debugging
  // eslint-disable-next-line no-console
  console.log('URL after goto:', await page.url());

  // allow the app time to hydrate and apply localStorage-driven feature flags
  await page.waitForTimeout(5000);

  let genTrigger = page.getByRole('button', { name: /Generate \/ Download Certificate/i });
  try {
    await expect(genTrigger).toBeVisible({ timeout: 20000 });
    await genTrigger.click();
  } catch (e) {
    // capture debug artifacts then retry fallback locator
    await captureDebug('generate-button-missing');
    genTrigger = page.getByText(/Generate/i);
    await expect(genTrigger).toBeVisible({ timeout: 30000 });
    await genTrigger.click();
  }

  const dialog = page.getByRole('dialog', { name: /Certificate generation dialog/i });
  await expect(dialog).toBeVisible();

  const generateButton = dialog.getByRole('button', { name: /^Generate$/i });
  await expect(generateButton).toBeVisible();

  await generateButton.click();
  await expect(dialog.getByText(/Generating…/i)).toBeVisible();

  try {
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  } catch (e) {
    await captureDebug('escape-failure');
    throw e;
  }
});
