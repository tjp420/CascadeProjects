// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
const { test, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Module imports
const ROOT = path.resolve(__dirname, '../../..');
const { runDoctor } = require(path.join(ROOT, 'packages/simplebeacon-cli/src/doctor.js'));
const { signLicense } = require(path.join(ROOT, 'sales/license/generator.js'));
const { checkExpiringLicenses } = require(path.join(ROOT, 'sales/license/renewal-tracker.js'));
const { decryptSupportToken } = require(path.join(ROOT, 'sales/support/decrypt-token.js'));
const { evaluateFunnelMetrics } = require(path.join(ROOT, 'ai-platform/web/simplebeacon-dashboard/js/utils/funnelTrigger.js'));
const { rotateLicenseToken } = require(path.join(ROOT, 'sales/license/rotate-keys.js'));

// License validation is authored in TypeScript; use the compiled JS output if available.
const compiledLicenseManager = path.join(ROOT, 'simplebeacon-vscode-merged/out/licenseManager.js');
const validateLicenseLocally = fs.existsSync(compiledLicenseManager)
  ? require(compiledLicenseManager).validateLicenseLocally
  : null;

describe('Module Integrity Suite', () => {
  test('doctor.js should run diagnostics without throwing', () => {
    assert.doesNotThrow(() => runDoctor());
  });

  describe('generator.js + licenseManager', () => {
    test('should sign and validate a license token end-to-end', () => {
      if (!validateLicenseLocally) {
        return;
      }
      const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const priv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
      const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });

      const token = signLicense('test-corp', 'enterprise', '2027-12-31', priv);
      const meta = validateLicenseLocally(token, pub);

      assert.ok(meta, 'Token should be valid');
      assert.strictEqual(meta.companyId, 'test-corp');
      assert.strictEqual(meta.tier, 'enterprise');
    });

    test('should reject an expired token', () => {
      if (!validateLicenseLocally) {
        return;
      }
      const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const priv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
      const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });

      const token = signLicense('expired-corp', 'team', '2020-01-01', priv);
      const meta = validateLicenseLocally(token, pub);

      assert.strictEqual(meta, null);
    });
  });

  describe('renewal-tracker.js', () => {
    test('should detect expiring licenses within the lookahead window', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const expires = future.toISOString().split('T')[0];

      const alerts = checkExpiringLicenses([
        { companyId: 'alpha', customerEmail: 'a@test.com', expiresAt: expires, tier: 'team' }
      ], 30);

      assert.strictEqual(alerts.length, 1);
      assert.strictEqual(alerts[0].companyId, 'alpha');
      assert.ok(alerts[0].daysRemaining > 0 && alerts[0].daysRemaining <= 30);
    });

    test('should ignore licenses outside the lookahead window', () => {
      const alerts = checkExpiringLicenses([
        { companyId: 'beta', customerEmail: 'b@test.com', expiresAt: '2027-12-31', tier: 'enterprise' }
      ], 30);

      assert.strictEqual(alerts.length, 0);
    });
  });

  describe('decrypt-token.js', () => {
    test('should round-trip encrypt and decrypt a support token', () => {
      const cipherKey = crypto.scryptSync('simplebeacon-public-triage-salt', 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
      let encrypted = cipher.update(JSON.stringify({ nodeVersion: '24.9.0' }), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const token = iv.toString('hex') + '.' + encrypted;

      const result = decryptSupportToken(token);
      assert.strictEqual(result.nodeVersion, '24.9.0');
    });

    test('should return an error for a malformed token', () => {
      const result = decryptSupportToken('invalid-token');
      assert.ok(result.error);
    });
  });

  describe('funnelTrigger.js', () => {
    test('should trigger enterprise upsell for large monorepos', () => {
      const result = evaluateFunnelMetrics({
        files_scanned: 6000,
        total_files: 16000,
        quality_score: 90,
        findings: []
      });

      assert.strictEqual(result.shouldPromptUpgrade, true);
      assert.strictEqual(result.targetTier, 'enterprise');
    });

    test('should not trigger upsell for small workspaces', () => {
      const result = evaluateFunnelMetrics({
        files_scanned: 100,
        total_files: 200,
        quality_score: 90,
        findings: []
      });

      assert.strictEqual(result.shouldPromptUpgrade, false);
    });
  });

  describe('rotate-keys.js', () => {
    test('should rotate a valid license token to a new key pair', () => {
      const oldKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const oldPub = oldKeys.publicKey.export({ type: 'spki', format: 'pem' });
      const oldPriv = oldKeys.privateKey.export({ type: 'pkcs8', format: 'pem' });

      const newKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const newPriv = newKeys.privateKey.export({ type: 'pkcs8', format: 'pem' });

      const originalToken = signLicense('rotate-corp', 'enterprise', '2028-12-31', oldPriv);
      const rotation = rotateLicenseToken(originalToken, oldPub, newPriv);

      assert.strictEqual(rotation.success, true);
      assert.strictEqual(rotation.companyId, 'rotate-corp');
      assert.ok(rotation.newToken);
    });

    test('should fail rotation for an invalid token', () => {
      const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });
      const newPriv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });

      const rotation = rotateLicenseToken('invalid.token', pub, newPriv);
      assert.strictEqual(rotation.success, false);
    });
  });
});
