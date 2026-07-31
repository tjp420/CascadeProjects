'use strict';

/**
 * Tests for the software-simulated HSM Vault Provider (hsm-vault.cjs).
 *
 * Verifies:
 *   1. deriveKey() produces deterministic 32-byte keys
 *   2. Different orgIds/contexts produce unique keys (no cross-tenant collision)
 *   3. deriveOrgKeyViaHsm() matches the hook signature in crypto-utils.cjs
 *   4. HSM root key is not exposed via module exports
 *   5. Integration: HSM_PROVIDER=mock routes deriveOrgKey() through HSM
 *   6. Integration: HSM-derived key differs from local fallback key
 *   7. Fail-open: HSM unavailable → crypto-utils falls back to local key
 *   8. Fail-open: HSM throws → crypto-utils catches and falls back
 *   9. HSM-derived keys work for encrypt/decrypt round-trip
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HSM_PATH = path.resolve(process.cwd(), 'server', 'lib', 'hsm-vault.cjs');
const CRYPTO_UTILS_PATH = path.resolve(process.cwd(), 'server', 'lib', 'crypto-utils.cjs');

function reloadModule(modulePath) {
  const cached = require.cache[modulePath];
  if (cached && cached.exports && typeof cached.exports.close === 'function') {
    cached.exports.close();
  }
  if (typeof jest !== 'undefined' && jest.resetModules) {
    jest.resetModules();
  } else {
    delete require.cache[modulePath];
  }
  return require(modulePath);
}

describe('HSM Vault Provider (Software-Simulated Mock)', () => {
  let _tempDir;
  let _tempLogPath;
  let _tempPolicyPath;

  before(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-hsm-vault-'));
    _tempLogPath = path.join(_tempDir, 'audit-log.json');
    _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');
    process.env.AUDIT_LOG_PATH = _tempLogPath;
    process.env.PII_POLICY_PATH = _tempPolicyPath;
    process.env.AUDIT_LOG_SCRUB_PII = 'false';
    fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), 'utf8');
    fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), 'utf8');
  });

  after(() => {
    try {
      delete process.env.HSM_PROVIDER;
      delete process.env.HSM_MOCK_ROOT_KEY;
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── deriveKey (generic) ────────────────────────────────────────────────────

  describe('deriveKey', () => {
    let hsm;

    beforeEach(() => {
      delete process.env.HSM_MOCK_ROOT_KEY;
      hsm = reloadModule(HSM_PATH);
    });

    it('should return a 32-byte Buffer', () => {
      const key = hsm.deriveKey('org-a', 'test-context');
      assert.ok(Buffer.isBuffer(key), 'Should return a Buffer');
      assert.strictEqual(key.length, 32, 'Should be 32 bytes (256-bit)');
    });

    it('should be deterministic for same orgId + context', () => {
      const key1 = hsm.deriveKey('org-a', 'ctx-1');
      const key2 = hsm.deriveKey('org-a', 'ctx-1');
      assert.deepStrictEqual(key1, key2, 'Same org+context must yield identical keys');
    });

    it('should produce unique keys for different orgIds', () => {
      const keyA = hsm.deriveKey('org-a', 'ctx');
      const keyB = hsm.deriveKey('org-b', 'ctx');
      assert.notDeepStrictEqual(keyA, keyB, 'Different orgs must yield unique keys');
    });

    it('should produce unique keys for different contexts (same orgId)', () => {
      const key1 = hsm.deriveKey('org-a', 'ctx-1');
      const key2 = hsm.deriveKey('org-a', 'ctx-2');
      assert.notDeepStrictEqual(key1, key2, 'Different contexts must yield unique keys');
    });

    it('should use default context when context is null/undefined', () => {
      const keyNull = hsm.deriveKey('org-a', null);
      const keyUndefined = hsm.deriveKey('org-a', undefined);
      const keyDefault = hsm.deriveKey('org-a', 'default');
      assert.deepStrictEqual(keyNull, keyDefault, 'null context should use "default"');
      assert.deepStrictEqual(keyUndefined, keyDefault, 'undefined context should use "default"');
    });

    it('should throw TypeError for empty orgId', () => {
      assert.throws(
        () => hsm.deriveKey('', 'ctx'),
        { name: 'TypeError', message: /organization identifier/ }
      );
    });

    it('should throw TypeError for null orgId', () => {
      assert.throws(
        () => hsm.deriveKey(null, 'ctx'),
        { name: 'TypeError', message: /organization identifier/ }
      );
    });

    it('should throw TypeError for non-string orgId', () => {
      assert.throws(
        () => hsm.deriveKey(123, 'ctx'),
        { name: 'TypeError', message: /organization identifier/ }
      );
    });
  });

  // ── deriveOrgKeyViaHsm (hook-compatible) ───────────────────────────────────

  describe('deriveOrgKeyViaHsm', () => {
    let hsm;

    beforeEach(() => {
      delete process.env.HSM_MOCK_ROOT_KEY;
      hsm = reloadModule(HSM_PATH);
    });

    it('should return a 32-byte Buffer', () => {
      const key = hsm.deriveOrgKeyViaHsm('org-a');
      assert.ok(Buffer.isBuffer(key));
      assert.strictEqual(key.length, 32);
    });

    it('should be deterministic for same orgId', () => {
      const key1 = hsm.deriveOrgKeyViaHsm('org-a');
      const key2 = hsm.deriveOrgKeyViaHsm('org-a');
      assert.deepStrictEqual(key1, key2);
    });

    it('should produce unique keys for different orgIds', () => {
      const keyA = hsm.deriveOrgKeyViaHsm('org-a');
      const keyB = hsm.deriveOrgKeyViaHsm('org-b');
      assert.notDeepStrictEqual(keyA, keyB);
    });

    it('should throw TypeError for invalid orgId', () => {
      assert.throws(
        () => hsm.deriveOrgKeyViaHsm(''),
        { name: 'TypeError' }
      );
    });

    it('should be consistent with deriveKey using "org-key" context', () => {
      const keyViaHsm = hsm.deriveOrgKeyViaHsm('org-a');
      const keyViaGeneric = hsm.deriveKey('org-a', 'org-key');
      assert.deepStrictEqual(keyViaHsm, keyViaGeneric);
    });
  });

  // ── HSM Root Key Isolation ─────────────────────────────────────────────────

  describe('HSM root key isolation', () => {
    it('should not expose the root key via module exports', () => {
      const hsm = reloadModule(HSM_PATH);
      assert.strictEqual(typeof hsm.deriveKey, 'function');
      assert.strictEqual(typeof hsm.deriveOrgKeyViaHsm, 'function');
      // Root key should not be accessible
      assert.strictEqual(hsm._HSM_ROOT_KEY, undefined);
      assert.strictEqual(hsm.rootKey, undefined);
      assert.strictEqual(hsm.HSM_ROOT_KEY, undefined);
    });

    it('should use HSM_MOCK_ROOT_KEY env var when provided', () => {
      process.env.HSM_MOCK_ROOT_KEY = 'a'.repeat(64); // 32 bytes in hex
      const hsm = reloadModule(HSM_PATH);
      const key = hsm.deriveKey('org-a', 'ctx');
      // Verify the key was derived from the known root key
      const expectedKey = crypto.createHmac('sha256', Buffer.from('a'.repeat(64), 'hex'))
        .update('org-a::ctx')
        .digest();
      assert.deepStrictEqual(key, expectedKey);
      delete process.env.HSM_MOCK_ROOT_KEY;
    });

    it('should produce different keys with different root keys', () => {
      process.env.HSM_MOCK_ROOT_KEY = 'a'.repeat(64);
      const hsm1 = reloadModule(HSM_PATH);
      const key1 = hsm1.deriveKey('org-a', 'ctx');

      process.env.HSM_MOCK_ROOT_KEY = 'b'.repeat(64);
      const hsm2 = reloadModule(HSM_PATH);
      const key2 = hsm2.deriveKey('org-a', 'ctx');

      assert.notDeepStrictEqual(key1, key2, 'Different root keys must yield different derived keys');
      delete process.env.HSM_MOCK_ROOT_KEY;
    });
  });

  // ── Integration with crypto-utils.cjs ──────────────────────────────────────

  describe('integration with crypto-utils.cjs', () => {
    afterEach(() => {
      delete process.env.HSM_PROVIDER;
      delete process.env.HSM_MOCK_ROOT_KEY;
      jest.resetModules();
    });

    it('should route deriveOrgKey() through HSM when HSM_PROVIDER is set', () => {
      process.env.HSM_PROVIDER = 'mock';
      process.env.HSM_MOCK_ROOT_KEY = 'c'.repeat(64);
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-encryption-key';

      jest.resetModules();
      const cryptoUtils = reloadModule(CRYPTO_UTILS_PATH);

      const hsmKey = cryptoUtils.deriveOrgKey('org-integration-test');

      // Verify the key matches what the HSM would produce
      const expectedHsmKey = crypto.createHmac('sha256', Buffer.from('c'.repeat(64), 'hex'))
        .update('org-integration-test::org-key')
        .digest();

      assert.deepStrictEqual(hsmKey, expectedHsmKey, 'deriveOrgKey should route through HSM');
    });

    it('should produce a different key than local fallback when HSM is active', () => {
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-encryption-key';

      // Local key (no HSM)
      delete process.env.HSM_PROVIDER;
      jest.resetModules();
      const cryptoUtilsLocal = reloadModule(CRYPTO_UTILS_PATH);
      const localKey = cryptoUtilsLocal.deriveOrgKey('org-compare');

      // HSM key
      process.env.HSM_PROVIDER = 'mock';
      process.env.HSM_MOCK_ROOT_KEY = 'd'.repeat(64);
      jest.resetModules();
      const cryptoUtilsHsm = reloadModule(CRYPTO_UTILS_PATH);
      const hsmKey = cryptoUtilsHsm.deriveOrgKey('org-compare');

      assert.notDeepStrictEqual(localKey, hsmKey, 'HSM key must differ from local fallback key');
    });

    it('should fall back to local key when HSM_PROVIDER is not set', () => {
      delete process.env.HSM_PROVIDER;
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-encryption-key';

      jest.resetModules();
      const cryptoUtils = reloadModule(CRYPTO_UTILS_PATH);
      const key = cryptoUtils.deriveOrgKey('org-fallback-test');

      // Should match local HMAC derivation (ENCRYPTION_KEY = SHA-256 hash of env key)
      const encryptionKey = crypto.createHash('sha256').update('test-encryption-key').digest();
      const expectedLocalKey = crypto.createHmac('sha256', encryptionKey)
        .update(Buffer.from('sb:org:org-fallback-test', 'utf8'))
        .digest();

      assert.deepStrictEqual(key, expectedLocalKey, 'Should use local key derivation when HSM_PROVIDER not set');
    });

    it('should fall back to local key when HSM module fails to load', () => {
      process.env.HSM_PROVIDER = 'mock';
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-encryption-key';

      // Temporarily make hsm-vault.cjs unrequireable by renaming it
      const hsmPath = path.resolve(process.cwd(), 'server', 'lib', 'hsm-vault.cjs');
      const hsmBackupPath = hsmPath + '.bak';
      if (fs.existsSync(hsmPath)) {
        fs.renameSync(hsmPath, hsmBackupPath);
      }
      try {
        jest.resetModules();
        const cryptoUtils = reloadModule(CRYPTO_UTILS_PATH);
        const key = cryptoUtils.deriveOrgKey('org-load-fail');

        // Should fall back to local key (ENCRYPTION_KEY = SHA-256 hash of env key)
        const encryptionKey = crypto.createHash('sha256').update('test-encryption-key').digest();
        const expectedLocalKey = crypto.createHmac('sha256', encryptionKey)
          .update(Buffer.from('sb:org:org-load-fail', 'utf8'))
          .digest();
        assert.deepStrictEqual(key, expectedLocalKey, 'Should fall back to local key when HSM module missing');
      } finally {
        // Restore the file
        if (fs.existsSync(hsmBackupPath)) {
          fs.renameSync(hsmBackupPath, hsmPath);
        }
      }
    });

    it('should fall back to local key when HSM throws during derivation', () => {
      process.env.HSM_PROVIDER = 'mock';
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-encryption-key';

      // Create a broken HSM module that throws
      const hsmPath = path.resolve(process.cwd(), 'server', 'lib', 'hsm-vault.cjs');
      const hsmBackupPath = hsmPath + '.bak';
      const brokenHsmPath = hsmPath;
      const brokenHsmContent = `
'use strict';
function deriveOrgKeyViaHsm(orgId) {
  throw new Error('HSM hardware failure simulated');
}
module.exports = { deriveOrgKeyViaHsm };
`;
      if (fs.existsSync(hsmPath)) {
        fs.renameSync(hsmPath, hsmBackupPath);
      }
      fs.writeFileSync(brokenHsmPath, brokenHsmContent, 'utf8');

      try {
        jest.resetModules();
        const cryptoUtils = reloadModule(CRYPTO_UTILS_PATH);
        const key = cryptoUtils.deriveOrgKey('org-throw-fail');

        // Should fall back to local key (ENCRYPTION_KEY = SHA-256 hash of env key)
        const encryptionKey = crypto.createHash('sha256').update('test-encryption-key').digest();
        const expectedLocalKey = crypto.createHmac('sha256', encryptionKey)
          .update(Buffer.from('sb:org:org-throw-fail', 'utf8'))
          .digest();
        assert.deepStrictEqual(key, expectedLocalKey, 'Should fall back to local key when HSM throws');
      } finally {
        // Restore the original file
        try { fs.unlinkSync(brokenHsmPath); } catch {}
        if (fs.existsSync(hsmBackupPath)) {
          fs.renameSync(hsmBackupPath, hsmPath);
        }
        jest.resetModules();
      }
    });

    it('should support encrypt/decrypt round-trip with HSM-derived key', () => {
      process.env.HSM_PROVIDER = 'mock';
      process.env.HSM_MOCK_ROOT_KEY = 'e'.repeat(64);
      process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-encryption-key';

      jest.resetModules();
      const cryptoUtils = reloadModule(CRYPTO_UTILS_PATH);

      // deriveOrgKey returns a Buffer that should work as an AES-256 key
      const key = cryptoUtils.deriveOrgKey('org-encrypt-test');
      assert.strictEqual(key.length, 32);

      // Use the key directly for AES-256-GCM encryption
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const plaintext = 'secret data for HSM test';
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = decipher.update(encrypted, null, 'utf8') + decipher.final('utf8');

      assert.strictEqual(decrypted, plaintext, 'HSM-derived key should support AES-256-GCM round-trip');
    });
  });
});
