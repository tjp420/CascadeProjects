'use strict';

process.env.SIMPLEBEACON_ENCRYPTION_KEY = process.env.SIMPLEBEACON_ENCRYPTION_KEY
  || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const cryptoUtils = require('../crypto-utils.cjs');

describe('sandbox directory isolation keys', () => {
  test('deriveDirectoryKey is deterministic', () => {
    const a = cryptoUtils.deriveDirectoryKey('org-a', 'customers');
    const b = cryptoUtils.deriveDirectoryKey('org-a', 'customers');
    expect(a).toBeInstanceOf(Buffer);
    expect(a).toHaveLength(32);
    expect(a.equals(b)).toBe(true);
  });

  test('different orgs get different directory keys', () => {
    const a = cryptoUtils.deriveDirectoryKey('org-a', 'customers');
    const b = cryptoUtils.deriveDirectoryKey('org-b', 'customers');
    expect(a.equals(b)).toBe(false);
  });

  test('different directories get different keys for the same org', () => {
    const a = cryptoUtils.deriveDirectoryKey('org-a', 'customers');
    const b = cryptoUtils.deriveDirectoryKey('org-a', 'payments');
    expect(a.equals(b)).toBe(false);
  });

  test('throws on missing or invalid orgId', () => {
    expect(() => cryptoUtils.deriveDirectoryKey('', 'customers')).toThrow(TypeError);
    expect(() => cryptoUtils.deriveDirectoryKey(null, 'customers')).toThrow(TypeError);
    expect(() => cryptoUtils.deriveDirectoryKey(123, 'customers')).toThrow(TypeError);
  });

  test('throws on missing or invalid directory', () => {
    expect(() => cryptoUtils.deriveDirectoryKey('org-a', '')).toThrow(TypeError);
    expect(() => cryptoUtils.deriveDirectoryKey('org-a', null)).toThrow(TypeError);
    expect(() => cryptoUtils.deriveDirectoryKey('org-a', 456)).toThrow(TypeError);
  });

  test('encrypt and decrypt for directory round-trips', () => {
    const plaintext = 'record-payload-123';
    const stored = cryptoUtils.encryptForDirectory(plaintext, 'org-a', 'customers');
    expect(stored).toMatch(/^enc:sb:dir:/);
    expect(cryptoUtils.isDirectoryEncrypted(stored)).toBe(true);

    const recovered = cryptoUtils.decryptForDirectory(stored, 'org-a', 'customers');
    expect(recovered).toBe(plaintext);
  });

  test('decrypt fails for wrong org', () => {
    const stored = cryptoUtils.encryptForDirectory('secret', 'org-a', 'customers');
    const recovered = cryptoUtils.decryptForDirectory(stored, 'org-b', 'customers');
    expect(recovered).toBe('');
  });

  test('decrypt fails for wrong directory', () => {
    const stored = cryptoUtils.encryptForDirectory('secret', 'org-a', 'customers');
    const recovered = cryptoUtils.decryptForDirectory(stored, 'org-a', 'payments');
    expect(recovered).toBe('');
  });

  test('directoryKeyFingerprint is deterministic and does not expose raw key', () => {
    const fp = cryptoUtils.directoryKeyFingerprint('org-a', 'customers');
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
    expect(fp).toBe(cryptoUtils.directoryKeyFingerprint('org-a', 'customers'));
  });

  test('encryptObject and decryptObject with directory transforms', () => {
    const obj = {
      id: 'rec-1',
      note: 'sensitive note',
    };
    const encrypted = cryptoUtils.encryptObject(obj, ['note']);
    expect(encrypted.note).toMatch(/^enc:/);
    const decrypted = cryptoUtils.decryptObject(encrypted, ['note']);
    expect(decrypted.note).toBe('sensitive note');
  });
});
