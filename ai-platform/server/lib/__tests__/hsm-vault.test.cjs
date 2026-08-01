'use strict';

process.env.HSM_MOCK_ROOT_KEY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

const crypto = require('crypto');
const hsm = require('../hsm-vault.cjs');

describe('hsm-vault', () => {
  beforeEach(() => {
    hsm._resetHsmVersions();
    delete process.env.HSM_PROVIDER;
    delete process.env.HSM_KEY_ID;
    delete process.env.HSM_REGION;
    delete process.env.HSM_FAILOVER_REGIONS;
  });

  afterEach(() => {
    delete process.env.HSM_PROVIDER;
    delete process.env.HSM_KEY_ID;
    delete process.env.HSM_REGION;
    delete process.env.HSM_FAILOVER_REGIONS;
  });

  test('hsmHandshake returns a stable handle and fingerprint', () => {
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
    const key = hsm.deriveOrgKeyViaHsm('org-a');
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  test('different orgIds produce different derived keys', () => {
    const a = hsm.deriveOrgKeyViaHsm('org-a');
    const b = hsm.deriveOrgKeyViaHsm('org-b');
    expect(a.toString('hex')).not.toBe(b.toString('hex'));
  });

  test('decryptWithHsm returns the original plaintext', () => {
    const plaintext = 'sensitive tenant data';
    const key = hsm.deriveOrgKeyViaHsm('org-a');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const stored = `enc:sb:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;

    const decrypted = hsm.decryptWithHsm('org-a', stored);
    expect(decrypted).toBe(plaintext);
  });

  test('deriveWithFailover uses primary region', async () => {
    process.env.HSM_REGION = 'us-east';
    process.env.HSM_FAILOVER_REGIONS = 'us-west,eu-west';
    const key = await hsm.deriveWithFailover('org-a');
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  test('hsmRotate records new version and returns handle', () => {
    const result = hsm.hsmRotate('new-key', 'eu-west-1');
    expect(result.success).toBe(true);
    expect(result.keyId).toBe('new-key');
    expect(result.region).toBe('eu-west-1');
    expect(result.previousVersions).toEqual([]);
  });

  test('hsmRotate keeps previous version history', () => {
    hsm.hsmHandshake('mockhsm', 'first-key', 'us-east');
    const second = hsm.hsmRotate('second-key', 'us-west');
    expect(second.previousVersions.length).toBeGreaterThanOrEqual(1);
  });

  test('decryptWithHsm returns empty for non-sandbox ciphertext', () => {
    expect(hsm.decryptWithHsm('org-a', 'not-encrypted')).toBe('');
    expect(hsm.decryptWithHsm('org-a', '')).toBe('');
  });

  test('decryptWithHsm rejects tampered ciphertext', () => {
    const key = hsm.deriveOrgKeyViaHsm('org-a');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update('safe data', 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const stored = `enc:sb:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    const tampered = stored.slice(0, -4) + 'dead';
    expect(hsm.decryptWithHsm('org-a', tampered)).toBe('');
  });

  test('deriveOrgKeyViaHsm throws on missing orgId', () => {
    expect(() => hsm.deriveOrgKeyViaHsm('')).toThrow(/valid organization/);
  });
});
