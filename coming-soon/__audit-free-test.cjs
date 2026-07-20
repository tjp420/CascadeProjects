const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  const errors = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:3005/audit');
  await page.waitForTimeout(1500);

  // Click "Start Scanning" to generate a sandbox token
  await page.click('#startSandboxBtn');
  await page.waitForTimeout(1000);

  // Verify token input and hidden select reflect gate-only
  const tokenValue = await page.evaluate(() => document.getElementById('licenseToken').value);
  const profileValue = await page.evaluate(() => document.getElementById('browserScanProfile').value);
  const firstSelected = await page.evaluate(() => {
    const first = document.querySelector('#analyzerCardGrid .analyzer-card.selected');
    return first ? first.dataset.value : null;
  });
  const lockedCount = await page.evaluate(() => document.querySelectorAll('#analyzerCardGrid .analyzer-card.locked').length);

  // Run a tiny synthetic scan with a file that should trigger a credential hit
  const scanReport = await page.evaluate(async () => {
    const file = new File(['const apiKey = "sk_live_abcdefghijklmnopqrstuvwxyz";'], 'app.js', { type: 'text/javascript' });
    // simulate webkitRelativePath
    Object.defineProperty(file, 'webkitRelativePath', { value: 'project/src/app.js', configurable: true });
    await window.processLocalCLIScan([file]);
    return reportData;
  });

  const profileLabel = scanReport?.scanProfileLabel;
  const reportKeys = Object.keys(scanReport || {});

  console.log('token present:', !!tokenValue);
  console.log('profile select value:', profileValue);
  console.log('first selected module:', firstSelected);
  console.log('locked module count:', lockedCount);
  console.log('scan profile label:', profileLabel);
  console.log('report keys:', reportKeys.join(','));

  // Expect gate-only: shared metadata, gate/gateReport, summary and aiContext are okay.
  // No complete-scan section objects like codebase/consolidation/mockDataCategories/etc.
  const restrictedSections = new Set([
    'consolidation', 'mockDataCategories', 'roadmap', 'codebase', 'fileReduction',
    'dataQuality', 'cleanup', 'npmAudit', 'compliance', 'euAiActSummary',
    'dependencyAudit', 'buildReadiness', 'aiIndicators', 'governance', 'junkFiles',
    'aiResidue', 'performance', 'typeSafety', 'documentation', 'testCoverage',
    'accessibility', 'i18n', 'sensitiveData', 'configDrift', 'securityHeaders',
    'databasePatterns', 'frameworkPractices', 'workspaceHealth', 'unusedDeps',
    'apiContract', 'complexity', 'llmSlop', 'tokenBleed', 'productionLeak',
    'fictionKpi', 'architectureDrift', 'syncIo', 'fixPreview', 'fileNaming',
    'removableFiles'
  ]);

  const unexpected = reportKeys.filter(k => restrictedSections.has(k));

  console.log('unexpected sections:', unexpected.join(',') || 'none');

  let failed = false;
  if (!tokenValue) { console.error('FAIL: no token generated'); failed = true; }
  if (profileValue !== 'gate') { console.error('FAIL: profile select should be gate, got', profileValue); failed = true; }
  if (firstSelected !== 'gate') { console.error('FAIL: first selected module should be gate, got', firstSelected); failed = true; }
  if (lockedCount === 0) { console.error('FAIL: no modules locked for free tier'); failed = true; }
  if (scanReport?.gate?.blockingCount === 0) { console.error('FAIL: expected at least one blocking credential finding'); failed = true; }
  if (unexpected.length) { console.error('FAIL: unexpected report sections:', unexpected.join(', ')); failed = true; }

  if (failed || errors.length) {
    console.log('page errors:', JSON.stringify(errors, null, 2));
    console.log('console logs:', JSON.stringify(logs.slice(0, 40), null, 2));
    process.exitCode = 1;
  } else {
    console.log('PASS: free-tier audit is gate-only and detects credential pattern');
  }

  await browser.close();
})();
