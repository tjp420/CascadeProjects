'use strict';

/**
 * Tests for per-directory sandbox isolation keys in crypto-utils.cjs.
 *
 * Verifies that directory-scoped encryption keys are:
 *   - Deterministic for the same orgId + directory pair
 *   - Unique across different directories and orgs
 *   - Usable for authenticated encryption (AES-256-GCM)
 *   - Cross-directory decryption fails (returns empty string)
 *   - isDirectoryEncrypted() correctly identifies ciphertext envelopes
 *
 * Functions under test:
 *   - deriveDirectoryKey(orgId, directory) → Buffer (32 bytes)
 *   - directoryKeyFingerprint(orgId, directory) → hex string
 *   - encryptForDirectory(plaintext, orgId, directory) → 'enc:sb:dir:...' string
 *   - decryptForDirectory(stored, orgId, directory) → plaintext or ''
 *   - isDirectoryEncrypted(value) → boolean
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Directory Sandbox Crypto Suite', () => {
  let cryptoUtils;
  let _tempDir;

  const ORG_A = 'org-tenant-a';
  const ORG_B = 'org-tenant-b';
  const DIR_A = '/var/data/sandbox/tenant-a';
  const DIR_B = '/var/data/sandbox/tenant-b';

  before(() => {
    _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-dir-crypto-'));
    process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'test-master-key-for-directory-crypto';
    jest.resetModules();
    cryptoUtils = require('../crypto-utils.cjs');
  });

  after(() => {
    try {
      jest.resetModules();
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ── deriveDirectoryKey ─────────────────────────────────────────────────────

  describe('deriveDirectoryKey', () => {
    it('should return a 32-byte Buffer (256-bit AES key)', () => {
      const key = cryptoUtils.deriveDirectoryKey(ORG_A, DIR_A);
      assert.ok(Buffer.isBuffer(key), 'Should return a Buffer');
      assert.strictEqual(key.length, 32, 'Should be 32 bytes (256-bit)');
    });

    it('should be deterministic for same orgId + directory', () => {
      const key1 = cryptoUtils.deriveDirectoryKey(ORG_A, DIR_A);
      const key2 = cryptoUtils.deriveDirectoryKey(ORG_A, DIR_A);
      assert.deepStrictEqual(key1, key2, 'Same org+dir must yield identical keys');
    });

    it('should produce unique keys for different directories within same org', () => {
      const keyA = cryptoUtils.deriveDirectoryKey(ORG_A, DIR_A);
      const keyB = cryptoUtils.deriveDirectoryKey(ORG_A, DIR_B);
      assert.notDeepStrictEqual(keyA, keyB, 'Different directories must yield unique keys');
    });

    it('should produce unique keys for same directory across different orgs', () => {
      const keyOrgA = cryptoUtils.deriveDirectoryKey(ORG_A, DIR_A);
      const keyOrgB = cryptoUtils.deriveDirectoryKey(ORG_B, DIR_A);
      assert.notDeepStrictEqual(keyOrgA, keyOrgB, 'Different orgs must yield unique keys');
    });

    it('should throw TypeError for empty orgId', () => {
      assert.throws(
        () => cryptoUtils.deriveDirectoryKey('', DIR_A),
        { name: 'TypeError', message: /orgId/ }
      );
    });

    it('should throw TypeError for non-string orgId', () => {
      assert.throws(
        () => cryptoUtils.deriveDirectoryKey(null, DIR_A),
        { name: 'TypeError', message: /orgId/ }
      );
    });

    it('should throw TypeError for empty directory', () => {
      assert.throws(
        () => cryptoUtils.deriveDirectoryKey(ORG_A, ''),
        { name: 'TypeError', message: /directory/ }
      );
    });

    it('should throw TypeError for non-string directory', () => {
      assert.throws(
        () => cryptoUtils.deriveDirectoryKey(ORG_A, null),
        { name: 'TypeError', message: /directory/ }
      );
    });
  });

  // ── directoryKeyFingerprint ────────────────────────────────────────────────

  describe('directoryKeyFingerprint', () => {
    it('should return a 64-character hex string (SHA-256)', () => {
      const fp = cryptoUtils.directoryKeyFingerprint(ORG_A, DIR_A);
      assert.strictEqual(typeof fp, 'string');
      assert.match(fp, /^[a-f0-9]{64}$/, 'Should be a 64-char lowercase hex string');
    });

    it('should be deterministic for same orgId + directory', () => {
      const fp1 = cryptoUtils.directoryKeyFingerprint(ORG_A, DIR_A);
      const fp2 = cryptoUtils.directoryKeyFingerprint(ORG_A, DIR_A);
      assert.strictEqual(fp1, fp2, 'Same org+dir must yield identical fingerprints');
    });

    it('should produce unique fingerprints for different directories', () => {
      const fpA = cryptoUtils.directoryKeyFingerprint(ORG_A, DIR_A);
      const fpB = cryptoUtils.directoryKeyFingerprint(ORG_A, DIR_B);
      assert.notStrictEqual(fpA, fpB, 'Different directories must yield unique fingerprints');
    });

    it('should produce unique fingerprints for different orgs', () => {
      const fpOrgA = cryptoUtils.directoryKeyFingerprint(ORG_A, DIR_A);
      const fpOrgB = cryptoUtils.directoryKeyFingerprint(ORG_B, DIR_A);
      assert.notStrictEqual(fpOrgA, fpOrgB, 'Different orgs must yield unique fingerprints');
    });

    it('should match the SHA-256 hash of the derived key', () => {
      const key = cryptoUtils.deriveDirectoryKey(ORG_A, DIR_A);
      const expectedFp = crypto.createHash('sha256').update(key).digest('hex');
      const actualFp = cryptoUtils.directoryKeyFingerprint(ORG_A, DIR_A);
      assert.strictEqual(actualFp, expectedFp, 'Fingerprint should be SHA-256 of derived key');
    });
  });

  // ── encryptForDirectory / decryptForDirectory ──────────────────────────────

  describe('encryptForDirectory / decryptForDirectory', () => {
    it('should encrypt and decrypt successfully with correct org + directory', () => {
      const plaintext = 'Confidential sandbox data';
      const ciphertext = cryptoUtils.encryptForDirectory(plaintext, ORG_A, DIR_A);
      assert.ok(ciphertext, 'Ciphertext should be non-empty');
      assert.notStrictEqual(ciphertext, plaintext, 'Ciphertext must differ from plaintext');

      const decrypted = cryptoUtils.decryptForDirectory(ciphertext, ORG_A, DIR_A);
      assert.strictEqual(decrypted, plaintext, 'Decrypted text must match original');
    });

    it('should produce ciphertext with the directory prefix', () => {
      const ciphertext = cryptoUtils.encryptForDirectory('test', ORG_A, DIR_A);
      assert.ok(ciphertext.startsWith('enc:sb:dir:'), 'Ciphertext must have enc:sb:dir: prefix');
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same secret';
      const ct1 = cryptoUtils.encryptForDirectory(plaintext, ORG_A, DIR_A);
      const ct2 = cryptoUtils.encryptForDirectory(plaintext, ORG_A, DIR_A);
      assert.notStrictEqual(ct1, ct2, 'Random IV should produce different ciphertexts');
      // Both should decrypt to the same plaintext
      assert.strictEqual(cryptoUtils.decryptForDirectory(ct1, ORG_A, DIR_A), plaintext);
      assert.strictEqual(cryptoUtils.decryptForDirectory(ct2, ORG_A, DIR_A), plaintext);
    });

    it('should fail to decrypt with wrong directory (cross-directory isolation)', () => {
      const plaintext = 'tenant-a secret';
      const ciphertext = cryptoUtils.encryptForDirectory(plaintext, ORG_A, DIR_A);
      const decrypted = cryptoUtils.decryptForDirectory(ciphertext, ORG_A, DIR_B);
      assert.strictEqual(decrypted, '', 'Cross-directory decryption must return empty string');
    });

    it('should fail to decrypt with wrong org (cross-tenant isolation)', () => {
      const plaintext = 'org-a secret';
      const ciphertext = cryptoUtils.encryptForDirectory(plaintext, ORG_A, DIR_A);
      const decrypted = cryptoUtils.decryptForDirectory(ciphertext, ORG_B, DIR_A);
      assert.strictEqual(decrypted, '', 'Cross-tenant decryption must return empty string');
    });

    it('should handle empty plaintext', () => {
      const ciphertext = cryptoUtils.encryptForDirectory('', ORG_A, DIR_A);
      assert.strictEqual(ciphertext, '', 'Empty plaintext should return empty string');
    });

    it('should handle non-string plaintext by converting to string', () => {
      const ciphertext = cryptoUtils.encryptForDirectory(12345, ORG_A, DIR_A);
      assert.ok(ciphertext.startsWith('enc:sb:dir:'), 'Numeric plaintext should be converted and encrypted');
      const decrypted = cryptoUtils.decryptForDirectory(ciphertext, ORG_A, DIR_A);
      assert.strictEqual(decrypted, '12345', 'Decrypted text should be string representation of number');
    });

    it('should return empty string for null stored value', () => {
      const result = cryptoUtils.decryptForDirectory(null, ORG_A, DIR_A);
      assert.strictEqual(result, '', 'Null stored value should return empty string');
    });

    it('should return empty string for non-directory-encrypted value', () => {
      const result = cryptoUtils.decryptForDirectory('plain text', ORG_A, DIR_A);
      assert.strictEqual(result, '', 'Non-encrypted value should return empty string');
    });

    it('should return empty string for malformed ciphertext (wrong number of parts)', () => {
      const malformed = 'enc:sb:dir:abc:def'; // only 2 parts after prefix, need 3
      const result = cryptoUtils.decryptForDirectory(malformed, ORG_A, DIR_A);
      assert.strictEqual(result, '', 'Malformed ciphertext should return empty string');
    });

    it('should return empty string for tampered ciphertext', () => {
      const ciphertext = cryptoUtils.encryptForDirectory('secret', ORG_A, DIR_A);
      // Tamper with the encrypted data portion
      const tampered = ciphertext.slice(0, -4) + '0000';
      const result = cryptoUtils.decryptForDirectory(tampered, ORG_A, DIR_A);
      assert.strictEqual(result, '', 'Tampered ciphertext should fail AES-GCM auth and return empty string');
    });

    it('should handle unicode plaintext correctly', () => {
      const plaintext = '日本語テスト 🎉 café';
      const ciphertext = cryptoUtils.encryptForDirectory(plaintext, ORG_A, DIR_A);
      const decrypted = cryptoUtils.decryptForDirectory(ciphertext, ORG_A, DIR_A);
      assert.strictEqual(decrypted, plaintext, 'Unicode plaintext should round-trip correctly');
    });

    it('should handle long plaintext correctly', () => {
      const plaintext = 'A'.repeat(10000);
      const ciphertext = cryptoUtils.encryptForDirectory(plaintext, ORG_A, DIR_A);
      const decrypted = cryptoUtils.decryptForDirectory(ciphertext, ORG_A, DIR_A);
      assert.strictEqual(decrypted, plaintext, 'Long plaintext should round-trip correctly');
    });
  });

  // ── isDirectoryEncrypted ───────────────────────────────────────────────────

  describe('isDirectoryEncrypted', () => {
    it('should return true for valid directory-encrypted ciphertext', () => {
      const ciphertext = cryptoUtils.encryptForDirectory('test', ORG_A, DIR_A);
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted(ciphertext), true);
    });

    it('should return false for plain text string', () => {
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted('plain text string'), false);
    });

    it('should return false for empty string', () => {
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted(''), false);
    });

    it('should return false for null', () => {
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted(null), false);
    });

    it('should return false for non-string value', () => {
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted(12345), false);
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted({}), false);
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted(undefined), false);
    });

    it('should NOT match org-level encrypted values (enc:sb: prefix)', () => {
      // Org-level encryption uses 'enc:sb:' prefix, not 'enc:sb:dir:'
      const orgEncrypted = 'enc:sb:some-org-data';
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted(orgEncrypted), false);
    });

    it('should NOT match standard encrypted values (enc: prefix)', () => {
      const standardEncrypted = 'enc:some-data';
      assert.strictEqual(cryptoUtils.isDirectoryEncrypted(standardEncrypted), false);
    });
  });

  // ── Cross-Function Integration ─────────────────────────────────────────────

  describe('cross-function integration', () => {
    it('should maintain isolation across multiple encrypt/decrypt cycles', () => {
      const dataA = 'data for dir A';
      const dataB = 'data for dir B';

      const ctA = cryptoUtils.encryptForDirectory(dataA, ORG_A, DIR_A);
      const ctB = cryptoUtils.encryptForDirectory(dataB, ORG_A, DIR_B);

      // Each directory should only decrypt with its own key
      assert.strictEqual(cryptoUtils.decryptForDirectory(ctA, ORG_A, DIR_A), dataA);
      assert.strictEqual(cryptoUtils.decryptForDirectory(ctB, ORG_A, DIR_B), dataB);
      assert.strictEqual(cryptoUtils.decryptForDirectory(ctA, ORG_A, DIR_B), '');
      assert.strictEqual(cryptoUtils.decryptForDirectory(ctB, ORG_A, DIR_A), '');
    });

    it('should produce fingerprints that match derived keys used for encryption', () => {
      // The fingerprint is a hash of the derived key, and encryption uses
      // the same derived key. Verify they're consistent.
      const fp = cryptoUtils.directoryKeyFingerprint(ORG_A, DIR_A);
      const key = cryptoUtils.deriveDirectoryKey(ORG_A, DIR_A);
      const expectedFp = crypto.createHash('sha256').update(key).digest('hex');
      assert.strictEqual(fp, expectedFp);

      // Verify encryption works with this key
      const plaintext = 'consistency test';
      const ciphertext = cryptoUtils.encryptForDirectory(plaintext, ORG_A, DIR_A);
      assert.strictEqual(cryptoUtils.decryptForDirectory(ciphertext, ORG_A, DIR_A), plaintext);
    });
  });
});
