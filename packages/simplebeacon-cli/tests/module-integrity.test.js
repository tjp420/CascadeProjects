const assert = require('assert');
const crypto = require('crypto');
const path = require('path');

// Module imports
const ROOT = path.resolve(__dirname, '../../../..');
const { runDoctor } = require(path.join(ROOT, 'packages/simplebeacon-cli/src/doctor.js'));
const { signLicense } = require(path.join(ROOT, 'sales/license/generator.js'));
const { validateLicenseLocally } = require(path.join(ROOT, 'simplebeacon-vscode-merged/src/licenseManager.ts'));
const { checkExpiringLicenses } = require(path.join(ROOT, 'sales/license/renewal-tracker.js'));
const { decryptSupportToken } = require(path.join(ROOT, 'sales/support/decrypt-token.js'));
const { evaluateFunnelMetrics } = require(path.join(ROOT, 'ai-platform/web/simplebeacon-dashboard/js/utils/funnelTrigger.js'));
const { rotateLicenseToken } = require(path.join(ROOT, 'sales/license/rotate-keys.js'));

describe('Module Integrity Suite', () => {
  describe('doctor.js', () => {
    it('should run diagnostics without throwing', () => {
      assert.doesNotThrow(() => runDoctor());
    });
  });

  describe('generator.js + licenseManager.ts', () => {
    it('should sign and validate a license token end-to-end', () => {
      const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const priv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
      const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });

      const token = signLicense('test-corp', 'enterprise', '2027-12-31', priv);
      const meta = validateLicenseLocally(token, pub);

      assert.ok(meta, 'Token should be valid');
      assert.strictEqual(meta.companyId, 'test-corp');
      assert.strictEqual(meta.tier, 'enterprise');
    });

    it('should reject an expired token', () => {
      const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const priv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
      const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });

      const token = signLicense('expired-corp', 'team', '2020-01-01', priv);
      const meta = validateLicenseLocally(token, pub);

      assert.strictEqual(meta, null);
    });
  });

  describe('renewal-tracker.js', () => {
    it('should detect expiring licenses within the lookahead window', () => {
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

    it('should ignore licenses outside the lookahead window', () => {
      const alerts = checkExpiringLicenses([
        { companyId: 'beta', customerEmail: 'b@test.com', expiresAt: '2027-12-31', tier: 'enterprise' }
      ], 30);

      assert.strictEqual(alerts.length, 0);
    });
  });

  describe('decrypt-token.js', () => {
    it('should round-trip encrypt and decrypt a support token', () => {
      const cipherKey = crypto.scryptSync('simplebeacon-public-triage-salt', 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
      let encrypted = cipher.update(JSON.stringify({ nodeVersion: '24.9.0' }), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const token = iv.toString('hex') + '.' + encrypted;

      const result = decryptSupportToken(token);
      assert.strictEqual(result.nodeVersion, '24.9.0');
    });

    it('should return an error for a malformed token', () => {
      const result = decryptSupportToken('invalid-token');
      assert.ok(result.error);
    });
  });

  describe('funnelTrigger.js', () => {
    it('should trigger enterprise upsell for large monorepos', () => {
      const result = evaluateFunnelMetrics({
        files_scanned: 6000,
        total_files: 16000,
        quality_score: 90,
        findings: []
      });

      assert.strictEqual(result.shouldPromptUpgrade, true);
      assert.strictEqual(result.targetTier, 'enterprise');
    });

    it('should not trigger upsell for small workspaces', () => {
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
    it('should rotate a valid license token to a new key pair', () => {
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

    it('should fail rotation for an invalid token', () => {
      const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });
      const newPriv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });

      const rotation = rotateLicenseToken('invalid.token', pub, newPriv);
      assert.strictEqual(rotation.success, false);
    });
  });
});
