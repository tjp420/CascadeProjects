/**
 * Scan a cloned GitHub repo and email results via the billing API
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const constants = require('../server/config/constants.cjs');
const TARGET_EMAIL = process.env.SIMPLEBEACON_OWNER_EMAIL;
const REPO_PATH = process.env.SIMPLEBEACON_REPO_PATH || process.cwd();
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

function seedSubscription(repoName) {
  const store = readStore();
  const licenseToken = `sb_github_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; // simplebeacon-ignore credential — programmatically generated random token
  store.subscriptions[TARGET_EMAIL] = {
    email: TARGET_EMAIL,
    subscriptionActive: true,
    stripeCustomerId: `cus_github_001`,
    subscriptionId: `sub_github_001`,
    product: 'euai2499',
    apiToken: `sb_${require('crypto').randomBytes(24).toString('hex')}`, // simplebeacon-ignore credential — programmatically generated random token
    apiCallsThisPeriod: 0,
    periodStart: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    licenseToken,
    licenseTier: 'executive',
    complianceCertsThisPeriod: 0,
    complianceCertLimit: 10,
    certClientName: 'GitHub Analysis',
    certProjectName: repoName,
    certMilestone: 'release',
    certOrgId: 'github'
  };
  store.byApiToken[store.subscriptions[TARGET_EMAIL].apiToken] = TARGET_EMAIL;
  writeStore(store);
  return licenseToken;
}

function runScan(repoPath) {
  const reportPath = path.join(PLATFORM_ROOT, '.simplebeacon', 'scan-github-repo.json');
  const cmd = `node packages/simplebeacon-cli/bin/simplebeacon.js scan --path "${repoPath}" --full --offline --format json --output "${reportPath}"`;
  log('SCAN', cmd);
  try {
    execSync(cmd, { cwd: PLATFORM_ROOT, stdio: 'pipe', timeout: 300000 });
  } catch (execErr) {
    if (!fs.existsSync(reportPath)) throw execErr;
  }
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function uploadReport(report, licenseToken) {
  const payloadPath = path.join(PLATFORM_ROOT, '.simplebeacon', 'tmp-github-upload.json');
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

async function main() {
  const repoName = path.basename(REPO_PATH);
  console.log(`\n=== GitHub Repo Scan: ${repoName} ===`);
  console.log(`Path:  ${REPO_PATH}`);
  console.log('Customer: configured\n');

  if (!checkServer()) {
    console.error('ERROR: Server not running on port', PORT);
    process.exit(1);
  }
  log('SERVER', `Responding on port ${PORT}`);

  log('SCAN', `Running full scan on ${repoName}...`);
  const report = runScan(REPO_PATH);
  log('SCAN', `Done. Files: ${report.repositoryFilesTotal ?? '—'}, Issues: ${report.issueCount ?? 0}, Quality: ${report.qualityScore ?? '—'}%`);

  log('BILLING', `Creating subscription for GitHub Analysis / ${repoName}...`);
  const licenseToken = seedSubscription(repoName);
  log('BILLING', `License created for ${repoName}`);

  log('DELIVERY', 'Uploading report...');
  const uploadRes = uploadReport(report, licenseToken);
  if (uploadRes.success) {
    log('DELIVERY', `Certificate: ${uploadRes.deliveryId}`);
    log('DELIVERY', 'Email delivery processed'); // simplebeacon-ignore pii-logging — delivery status log, no user data
  } else {
    log('DELIVERY', `FAILED: ${uploadRes.error}`);
  }

  console.log('\n=== Complete ===');
  console.log('Check your inbox for results\n');
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
