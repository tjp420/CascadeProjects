// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
const crypto = require('crypto');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

const { runDoctor } = require(path.join(ROOT, 'packages/simplebeacon-cli/src/doctor.js'));
const { signLicense } = require(path.join(ROOT, 'sales/license/generator.js'));
const { validateLicenseLocally } = require(path.join(ROOT, 'simplebeacon-vscode-merged/src/licenseManager.ts'));
const { checkExpiringLicenses } = require(path.join(ROOT, 'sales/license/renewal-tracker.js'));
const { decryptSupportToken } = require(path.join(ROOT, 'sales/support/decrypt-token.js'));
const { evaluateFunnelMetrics } = require(path.join(ROOT, 'ai-platform/web/simplebeacon-dashboard/js/utils/funnelTrigger.js'));

let pass = 0;
let fail = 0;

function step(name, fn) {
  process.stdout.write(`[STEP] ${name}\n`);
  try {
    fn();
    process.stdout.write('  PASS\n\n');
    pass++;
  } catch (err) {
    process.stdout.write(`  FAIL: ${err.message}\n\n`);
    fail++;
  }
}

console.log('========================================');
console.log(' SimpleBeacon E2E Lifecycle Simulation');
console.log('========================================\n');

// 1. Doctor Triage
step('Doctor Triage', () => {
  runDoctor();
});

// 2. Crypto License Loop
step('Crypto License Loop', () => {
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const priv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });

  const token = signLicense('sim-corp', 'enterprise', '2027-12-31', priv);
  const meta = validateLicenseLocally(token, pub);

  if (!meta || meta.companyId !== 'sim-corp' || meta.tier !== 'enterprise') {
    throw new Error('License validation failed');
  }
});

// 3. Renewal Tracker
step('Renewal Tracker', () => {
  const now = new Date();
  const future = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const expires = future.toISOString().split('T')[0];
  const alerts = checkExpiringLicenses([
    { companyId: 'test-corp', customerEmail: 'a@test.com', expiresAt: expires, tier: 'team' }
  ], 30);
  if (alerts.length !== 1 || alerts[0].companyId !== 'test-corp') {
    throw new Error('Renewal tracker returned unexpected results');
  }
});

// 4. Funnel Trigger
step('Funnel Trigger', () => {
  const large = evaluateFunnelMetrics({ files_scanned: 6000, total_files: 16000, quality_score: 90, findings: [] });
  const small = evaluateFunnelMetrics({ files_scanned: 100, total_files: 200, quality_score: 90, findings: [] });
  if (!large.shouldPromptUpgrade || large.targetTier !== 'enterprise') {
    throw new Error('Large repo did not trigger enterprise upsell');
  }
  if (small.shouldPromptUpgrade) {
    throw new Error('Small repo incorrectly triggered upsell');
  }
});

// 5. Token Decryptor Round-Trip
step('Token Decryptor', () => {
  const cipherKey = crypto.scryptSync('simplebeacon-public-triage-salt', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
  let encrypted = cipher.update(JSON.stringify({ test: true }), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const token = iv.toString('hex') + '.' + encrypted;

  const result = decryptSupportToken(token);
  if (result.test !== true) {
    throw new Error('Decryption round-trip failed');
  }
});

console.log('========================================');
console.log(` Results: ${pass} passed, ${fail} failed`);
console.log('========================================');

if (fail > 0) {
  process.exit(1);
}
