/**
 * Run all Simplebeacon pricing tiers and email certificates
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const constants = require('../server/config/constants.cjs');
const TARGET_EMAIL = process.env.SIMPLEBEACON_OWNER_EMAIL;
const SCAN_DIR = process.env.SIMPLEBEACON_SCAN_DIR || process.cwd();
const PORT = process.env.PORT || constants.DASHBOARD_PORT;
const PLATFORM_ROOT = path.resolve(__dirname, '..');

const SUBSCRIPTION_STORE = path.join(PLATFORM_ROOT, '.simplebeacon', 'subscriptions.json');

function log(step, msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}]  ${step.padEnd(24)}  ${msg}`);
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(SUBSCRIPTION_STORE, 'utf8'));
  } catch {
    return { subscriptions: {}, byApiToken: {} };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(SUBSCRIPTION_STORE), { recursive: true });
  fs.writeFileSync(SUBSCRIPTION_STORE, JSON.stringify(store, null, 2));
}

function seedSubscription(tier) {
  const store = readStore();
  const licenseToken = `sb_${tier.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  store.subscriptions[TARGET_EMAIL] = {
    email: TARGET_EMAIL,
    subscriptionActive: true,
    stripeCustomerId: `cus_${tier.id}_001`,
    subscriptionId: `sub_${tier.id}_001`,
    product: tier.id,
    apiToken: `sb_${require('crypto').randomBytes(24).toString('hex')}`,
    apiCallsThisPeriod: 0,
    periodStart: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    licenseToken,
    licenseTier: tier.licenseTier,
    complianceCertsThisPeriod: 0,
    complianceCertLimit: tier.certLimit,
    certClientName: tier.clientName,
    certProjectName: tier.projectName,
    certMilestone: 'release',
    certOrgId: tier.orgId
  };
  store.byApiToken[store.subscriptions[TARGET_EMAIL].apiToken] = TARGET_EMAIL;
  writeStore(store);
  return licenseToken;
}

function generateWebsiteSecurityReport() {
  return {
    type: 'website-security-report',
    generatedAt: new Date().toISOString(),
    targetUrl: 'https://example.com',
    reportId: `wsr_${Date.now()}`,
    overallGrade: 'B+',
    overallScore: 87,
    sections: {
      ssl: { pass: true, grade: 'A', details: 'Valid Let\'s Encrypt cert, TLS 1.3, expires 2026-09-15' },
      securityHeaders: { pass: false, grade: 'C', details: 'HSTS present, X-Frame-Options OK. Missing: CSP, X-Content-Type-Options' },
      seo: { pass: true, grade: 'B', details: 'Title and description present. Missing: canonical URL, incomplete Open Graph' },
      mobile: { pass: true, grade: 'A-', details: 'Viewport OK, no overflow. Warning: 3 tap targets < 48px' },
      speed: { pass: true, grade: 'B', details: 'FCP 0.8s, TTI 2.1s. Warning: LCP 2.9s, TBT 450ms' },
      accessibility: { pass: true, grade: 'A', details: 'Alt text on all images, color contrast OK. Missing: 2 form labels, 1 skipped heading level' }
    },
    summary: '6 categories scanned · 4 passed · 2 partial · 0 critical failures'
  };
}

function runScan(tier) {
  if (tier.isWebsiteReport) {
    log('SCAN', `[${tier.name}] Generating website security report...`);
    return generateWebsiteSecurityReport();
  }
  const reportPath = path.join(PLATFORM_ROOT, '.simplebeacon', `scan-${tier.id}.json`);
  const cmd = `node packages/simplebeacon-cli/bin/simplebeacon.js scan --path "${SCAN_DIR}" --format json --output "${reportPath}" ${tier.cliFlags}`;
  log('SCAN', `[${tier.name}] ${cmd}`);
  try {
    execSync(cmd, { cwd: PLATFORM_ROOT, stdio: 'pipe', timeout: tier.timeout || 300000 });
  } catch (execErr) {
    if (!fs.existsSync(reportPath)) throw execErr;
  }
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function uploadReport(report, licenseToken) {
  const payloadPath = path.join(PLATFORM_ROOT, '.simplebeacon', 'tmp-upload-payload.json');
  fs.writeFileSync(payloadPath, JSON.stringify({ reportJson: report, licenseToken }));
  try {
    const output = execSync(
      `curl -s -X POST http://127.0.0.1:${PORT}/api/reports/upload -H "Content-Type: application/json" -d @"${payloadPath}"`,
      { cwd: PLATFORM_ROOT, encoding: 'utf8', timeout: constants.TIMEOUT_1M }
    );
    return JSON.parse(output);
  } finally {
    try { fs.unlinkSync(payloadPath); } catch { /* ignore cleanup errors */ }
  }
}

function checkServer() {
  try {
    execSync(`curl -s http://127.0.0.1:${PORT}/api/health`, { timeout: constants.TIMEOUT_5S });
    return true;
  } catch {
    return false;
  }
}

const TIERS = [
  {
    id: 'moneyPrinter19',
    name: 'Instant Website Security Report',
    price: '$19',
    cliFlags: '--gate --offline',
    licenseTier: 'community',
    certLimit: 0,
    clientName: 'Website Owner',
    projectName: 'example.com Security Audit',
    orgId: 'website-audit',
    timeout: constants.TIMEOUT_2M,
    isWebsiteReport: true
  },
  {
    id: 'community',
    name: 'Community',
    price: '$0',
    cliFlags: '--gate --offline',
    licenseTier: 'community',
    certLimit: 0,
    clientName: 'Community User',
    projectName: 'Open Source Evaluation',
    orgId: 'community',
    timeout: constants.TIMEOUT_2M
  },
  {
    id: 'clearance499',
    name: 'Executive Clearance PDF',
    price: '$499',
    cliFlags: '--gate --offline',
    licenseTier: 'executive',
    certLimit: 1,
    clientName: 'Acme Corp',
    projectName: 'Executive Audit',
    orgId: 'acme-corp',
    timeout: constants.TIMEOUT_2M
  },
  {
    id: 'agency999',
    name: 'Agency Project Pack',
    price: '$999',
    cliFlags: '--full --offline',
    licenseTier: 'agency',
    certLimit: 3,
    clientName: 'Pixel Studios',
    projectName: 'Agency Client Portal',
    orgId: 'pixel-studios',
    timeout: 300000
  },
  {
    id: 'agency1499',
    name: 'Agency Growth Pack',
    price: '$1,499',
    cliFlags: '--full --offline',
    licenseTier: 'agency',
    certLimit: 5,
    clientName: 'Nova Digital',
    projectName: 'Enterprise Platform',
    orgId: 'nova-digital',
    timeout: 300000
  },
  {
    id: 'euai2499',
    name: 'EU AI Act Readiness Sprint',
    price: '$2,499',
    cliFlags: '--full --offline --config .simplebeacon/config-full-coverage.json',
    licenseTier: 'executive',
    certLimit: 10,
    clientName: 'Aether Dynamics',
    projectName: 'PropTech Compliance Suite',
    orgId: 'aether-dynamics',
    timeout: 300000
  },
  {
    id: 'warranty199',
    name: 'Post-handoff Re-scan',
    price: '$199',
    cliFlags: '--gate --offline',
    licenseTier: 'executive',
    certLimit: 1,
    clientName: 'Zenith Systems',
    projectName: 'Warranty Re-scan',
    orgId: 'zenith-systems',
    timeout: constants.TIMEOUT_2M
  }
];

async function main() {
  console.log('\n=== Simplebeacon Tier Scan Suite ===');
  console.log(`Customer: ${TARGET_EMAIL}\n`);

  if (!checkServer()) {
    console.error('ERROR: Server not running on port', PORT);
    process.exit(1);
  }
  log('SERVER', `Responding on port ${PORT}`);

  for (const tier of TIERS) {
    console.log(`\n--- ${tier.name} (${tier.price}) ---`);

    // 1. Run scan
    log('SCAN', `Running ${tier.name} scan...`);
    const report = runScan(tier);
    log('SCAN', `Done. Files: ${report.repositoryFilesTotal ?? '—'}, Issues: ${report.issueCount ?? 0}`);

    // 2. Seed subscription
    log('BILLING', `Creating ${tier.name} subscription...`);
    const licenseToken = seedSubscription(tier);
    log('BILLING', `License: ${licenseToken}`);

    // 3. Upload + email
    log('DELIVERY', 'Uploading report...');
    const uploadRes = uploadReport(report, licenseToken);
    if (uploadRes.success) {
      log('DELIVERY', `Certificate: ${uploadRes.deliveryId}`);
      log('DELIVERY', `Email sent: ${uploadRes.emailSent}`);
    } else {
      log('DELIVERY', `FAILED: ${uploadRes.error}`);
    }
  }

  console.log('\n=== All tiers complete ===');
  console.log(`Check your inbox: ${TARGET_EMAIL}\n`);
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
