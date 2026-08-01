'use strict';

/**
 * Track 14: CryptoPolicyEngine unit tests.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CryptoPolicyEngine, DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('CryptoPolicyEngine', () => {
  test('default policy allows AES 256-bit KEK creation', () => {
    const engine = new CryptoPolicyEngine();
    expect(engine.validate('t1', 'createKEK', { algorithm: 'aes-kw', kekBits: 256 })).toBe(true);
  });

  test('default policy allows RSA-OAEP 2048-bit key creation', () => {
    const engine = new CryptoPolicyEngine();
    expect(engine.validate('t1', 'createKEK', { algorithm: 'rsa-oaep', keySize: 2048 })).toBe(true);
  });

  test('default policy allows ECDH P-256 key creation', () => {
    const engine = new CryptoPolicyEngine();
    expect(engine.validate('t1', 'createKEK', { algorithm: 'ecdh', keySize: 256 })).toBe(true);
  });

  test('blocks AES kekBits below minimum', () => {
    const engine = new CryptoPolicyEngine();
    expect(() => engine.validate('t1', 'createKEK', { algorithm: 'aes-kw', kekBits: 64 })).toThrow(HsmAdapterError);
    try {
      engine.validate('t1', 'createKEK', { algorithm: 'aes-kw', kekBits: 64 });
    } catch (e) {
      expect(e.code).toBe('POLICY_VIOLATION_BLOCKED');
    }
  });

  test('blocks disallowed AES bit length', () => {
    const engine = new CryptoPolicyEngine({
      default: {
        allowedAlgorithms: { aes: { kw: true, kwp: true, bits: [256] } },
      },
    });
    expect(() => engine.validate('t1', 'createKEK', { algorithm: 'aes-kw', kekBits: 128 })).toThrow(HsmAdapterError);
  });

  test('blocks unknown algorithm', () => {
    const engine = new CryptoPolicyEngine();
    expect(() => engine.validate('t1', 'createKEK', { algorithm: 'rsa-pkcs1' })).toThrow(HsmAdapterError);
    try {
      engine.validate('t1', 'createKEK', { algorithm: 'rsa-pkcs1' });
    } catch (e) {
      expect(e.code).toBe('POLICY_VIOLATION_BLOCKED');
    }
  });

  test('tenant-specific policy overrides default', () => {
    const engine = new CryptoPolicyEngine({
      default: { minimumKekBits: 256 },
      tenants: { 'tenant-a': { minimumKekBits: 128 } },
    });
    expect(engine.validate('tenant-a', 'createKEK', { algorithm: 'aes-kw', kekBits: 128 })).toBe(true);
    expect(() => engine.validate('tenant-b', 'createKEK', { algorithm: 'aes-kw', kekBits: 128 })).toThrow(HsmAdapterError);
  });

  test('unknown tenant falls back to default', () => {
    const engine = new CryptoPolicyEngine({
      default: { minimumKekBits: 256 },
    });
    expect(engine.validate('unknown', 'createKEK', { algorithm: 'aes-kw', kekBits: 256 })).toBe(true);
  });

  test('throws POLICY_DEPRECATED_WARNING for deprecated algorithm', () => {
    const engine = new CryptoPolicyEngine({
      default: {
        deprecatedAlgorithms: [{ algorithm: 'rsa-oaep', reason: 'migrating to PQC' }],
      },
    });
    expect(() => engine.validate('t1', 'createKEK', { algorithm: 'rsa-oaep', keySize: 2048 })).toThrow(HsmAdapterError);
    try {
      engine.validate('t1', 'createKEK', { algorithm: 'rsa-oaep', keySize: 2048 });
    } catch (e) {
      expect(e.code).toBe('POLICY_DEPRECATED_WARNING');
    }
  });

  test('throws POLICY_DEPRECATED_WARNING for expired key', () => {
    const engine = new CryptoPolicyEngine({
      default: { keyExpirationDays: 1 },
    });
    const oldCreatedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
    expect(() => engine.validate('t1', 'wrap', { algorithm: 'aes-kw', kekBits: 256, createdAt: oldCreatedAt })).toThrow(HsmAdapterError);
    try {
      engine.validate('t1', 'wrap', { algorithm: 'aes-kw', kekBits: 256, createdAt: oldCreatedAt });
    } catch (e) {
      expect(e.code).toBe('POLICY_DEPRECATED_WARNING');
    }
  });

  test('allows RSA-OAEP with keySize equal to minimum', () => {
    const engine = new CryptoPolicyEngine({
      default: { allowedAlgorithms: { rsa: { oaep: true, minBits: 2048 } } },
    });
    expect(engine.validate('t1', 'createKEK', { algorithm: 'rsa-oaep', keySize: 2048 })).toBe(true);
  });

  test('blocks RSA-OAEP below minimum bits', () => {
    const engine = new CryptoPolicyEngine({
      default: { allowedAlgorithms: { rsa: { oaep: true, minBits: 4096 } } },
    });
    expect(() => engine.validate('t1', 'createKEK', { algorithm: 'rsa-oaep', keySize: 2048 })).toThrow(HsmAdapterError);
  });

  test('blocks disabled ECDH curve', () => {
    const engine = new CryptoPolicyEngine({
      default: { allowedAlgorithms: { ecdh: { curves: ['P-256'] } } },
    });
    expect(() => engine.validate('t1', 'createKEK', { algorithm: 'ecdh', keySize: 384 })).toThrow(HsmAdapterError);
  });

  test('loads and reloads policy from file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-'));
    const file = path.join(tmp, 'policy.json');
    fs.writeFileSync(file, JSON.stringify({
      default: { minimumKekBits: 128 },
      tenants: { 'tenant-a': { minimumKekBits: 256 } },
    }));
    const engine = CryptoPolicyEngine.load(file);
    expect(engine.validate('tenant-a', 'createKEK', { algorithm: 'aes-kw', kekBits: 256 })).toBe(true);
    expect(() => engine.validate('tenant-a', 'createKEK', { algorithm: 'aes-kw', kekBits: 128 })).toThrow(HsmAdapterError);

    fs.writeFileSync(file, JSON.stringify({
      default: { minimumKekBits: 128 },
      tenants: { 'tenant-a': { minimumKekBits: 128 } },
    }));
    engine.reload();
    expect(engine.validate('tenant-a', 'createKEK', { algorithm: 'aes-kw', kekBits: 128 })).toBe(true);

    fs.unlinkSync(file);
    fs.rmdirSync(tmp);
  });

  test('reload without path throws', () => {
    const engine = new CryptoPolicyEngine();
    expect(() => engine.reload()).toThrow(HsmAdapterError);
  });

  test('non-strict mode disables blocking', () => {
    const engine = new CryptoPolicyEngine(DEFAULT_POLICY, { strict: false });
    expect(engine.validate('t1', 'createKEK', { algorithm: 'aes-kw', kekBits: 64 })).toBe(true);
  });
});
