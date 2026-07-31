'use strict';

process.env.SIMPLEBEACON_ENCRYPTION_KEY = 'hsm-test-secret-32-bytes-long!!';

const hsm = require('../hsm-vault.cjs');
const crypto = require('../crypto-utils.cjs');

describe('hsm-vault', () => {
  beforeEach(() => {
    delete process.env.HSM_PROVIDER;
  });

  afterEach(() => {
    delete process.env.HSM_PROVIDER;
  });

  test('handshake returns a stable handle and fingerprint', () => {
    const result = hsm.hsmHandshake('mockhsm', 'mk-1', 'us-east');
    expect(result.provider).toBe('mockhsm');
    expect(result.keyId).toBe('mk-1');
    expect(result.region).toBe('us-east');
    expect(result.handle).toBe('mockhsm:mk-1@us-east');
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.healthy).toBe(true);

    const again = hsm.hsmHandshake('mockhsm', 'mk-1', 'us-east');
    expect(again.fingerprint).toBe(result.fingerprint);
  });

  test('deriveOrgKeyViaHsm returns a 32-byte buffer', () => {
    process.env.HSM_PROVIDER = 'mockhsm';
    const key = hsm.deriveOrgKeyViaHsm('org-a');
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  test('different orgIds produce different derived keys', () => {
    process.env.HSM_PROVIDER = 'mockhsm';
    const a = hsm.deriveOrgKeyViaHsm('org-a');
    const b = hsm.deriveOrgKeyViaHsm('org-b');
    expect(a.toString('hex')).not.toBe(b.toString('hex'));
  });

  test('decryptWithHsm returns the original plaintext', () => {
    process.env.HSM_PROVIDER = 'mockhsm';
    const plaintext = 'sensitive tenant data';
    const encrypted = crypto.encryptForOrg(plaintext, 'org-a');
    expect(encrypted).toContain('enc:sb:');
    const decrypted = hsm.decryptWithHsm('org-a', encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test('crypto-utils deriveOrgKey uses HSM when HSM_PROVIDER is set', () => {
    process.env.HSM_PROVIDER = 'mockhsm';
    const hsmKey = hsm.deriveOrgKeyViaHsm('org-a');
    const utilsKey = crypto.deriveOrgKey('org-a');
    expect(utilsKey.toString('hex')).toBe(hsmKey.toString('hex'));
  });

  test('crypto-utils falls back to local key when HSM_PROVIDER is unset', () => {
    delete process.env.HSM_PROVIDER;
    const local = crypto.deriveOrgKey('org-a');
    expect(Buffer.isBuffer(local)).toBe(true);
    expect(local.length).toBe(32);

    // Same org still decodable because local key is deterministic
    const plaintext = 'local fallback data';
    const encrypted = crypto.encryptForOrg(plaintext, 'org-a');
    expect(crypto.decryptForOrg(encrypted, 'org-a')).toBe(plaintext);
  });

  test('encrypt/decrypt round-trip with HSM enabled', () => {
    process.env.HSM_PROVIDER = 'mockhsm';
    const plaintext = 'round-trip under HSM';
    const encrypted = crypto.encryptForOrg(plaintext, 'org-hsm');
    const decrypted = crypto.decryptForOrg(encrypted, 'org-hsm');
    expect(decrypted).toBe(plaintext);
  });

  test('unsupported provider throws', () => {
    process.env.HSM_PROVIDER = 'not-a-provider';
    expect(() => hsm.deriveOrgKeyViaHsm('org-a')).toThrow(/Unsupported HSM/);
    expect(() => hsm.hsmHandshake('not-a-provider')).toThrow(/Unsupported HSM/);
  });

  test('decryptWithHsm rejects tampered ciphertext', () => {
    process.env.HSM_PROVIDER = 'mockhsm';
    const encrypted = crypto.encryptForOrg('safe data', 'org-a');
    const tampered = encrypted.slice(0, -4) + 'dead';
    expect(hsm.decryptWithHsm('org-a', tampered)).toBe('');
  });

  test('decryptWithHsm returns empty for non-sandbox ciphertext', () => {
    process.env.HSM_PROVIDER = 'mockhsm';
    expect(hsm.decryptWithHsm('org-a', 'not-encrypted')).toBe('');
    expect(hsm.decryptWithHsm('org-a', '')).toBe('');
  });

  test('cloudkms and azurekms handshakes produce distinct fingerprints', () => {
    const cloud = hsm.hsmHandshake('cloudkms', 'ck-1', 'us-central1');
    const azure = hsm.hsmHandshake('azurekms', 'ak-1', 'westus2');
    expect(cloud.fingerprint).not.toBe(azure.fingerprint);
    expect(cloud.handle).toBe('cloudkms:ck-1@us-central1');
    expect(azure.handle).toBe('azurekms:ak-1@westus2');
  });

  test('deriveOrgKeyViaHsm throws on missing orgId', () => {
    process.env.HSM_PROVIDER = 'mockhsm';
    expect(() => hsm.deriveOrgKeyViaHsm('')).toThrow(/non-empty/);
  });
});
