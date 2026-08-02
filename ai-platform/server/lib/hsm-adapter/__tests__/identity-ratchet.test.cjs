'use strict';

/**
 * Track 30: Quantum-resistant identity ratchet tests.
 */
const crypto = require('crypto');
const { PqcIdentityRatchet } = require('../pqc-identity-ratchet.cjs');
const { MfaBindingGuard } = require('../mfa-binding-guard.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 30 identity ratchet', () => {
  test('ratchet steps forward cleanly', () => {
    const events = [];
    const ratchet = new PqcIdentityRatchet({
      deviceId: 'dev-1',
      kemLevel: 768,
      scheme: 'ml-kem-768',
      audit: (event, info) => events.push({ event, info }),
    });
    const s1 = crypto.randomBytes(32);
    const r1 = ratchet.step(s1);
    expect(r1.skipped).toBe(1);
    expect(r1.chainKey.length).toBe(32);

    const s2 = crypto.randomBytes(32);
    const r2 = ratchet.step(s2);
    expect(r2.skipped).toBe(2);
    expect(r2.chainKey.toString('hex')).not.toBe(r1.chainKey.toString('hex'));
    expect(events.some((e) => e.event === 'IDENTITY_RATCHET_STEPPED')).toBe(true);
  });

  test('ratchet rejects disallowed KEM level', () => {
    const ratchet = new PqcIdentityRatchet({ deviceId: 'dev-1', kemLevel: 256, scheme: 'ml-kem-768' });
    expect(() => ratchet.step(crypto.randomBytes(32))).toThrow(HsmAdapterError);
  });

  test('ratchet rejects maxSkipped exhaustion', () => {
    const ratchet = new PqcIdentityRatchet({ deviceId: 'dev-1', maxSkipped: 1 });
    ratchet.step(crypto.randomBytes(32));
    expect(() => ratchet.step(crypto.randomBytes(32))).toThrow(HsmAdapterError);
  });

  test('MFA guard validates sufficient unique signatures', () => {
    const events = [];
    const guard = new MfaBindingGuard({
      minMfaSignatures: 2,
      mfaTokenExpiryMs: 60000,
      allowedSigners: ['alice', 'bob'],
      audit: (event, info) => events.push({ event, info }),
    });
    const payloadHash = 'payload-123';
    const now = Date.now();
    const sign = (signer) => crypto.createHash('sha256').update(`${payloadHash}:${signer}`).digest('hex');
    const request = {
      timestamp: now,
      payloadHash,
      signatures: [
        { signer: 'alice', signature: sign('alice') },
        { signer: 'bob', signature: sign('bob') },
      ],
    };
    expect(guard.validate(request)).toBe(true);
    expect(events.some((e) => e.event === 'MFA_TOKEN_AUTHENTICATED')).toBe(true);
  });

  test('MFA guard rejects expired token', () => {
    const guard = new MfaBindingGuard({ mfaTokenExpiryMs: 100 });
    const request = {
      timestamp: Date.now() - 200,
      payloadHash: 'x',
      signatures: [{ signer: 'a', signature: 'b' }],
    };
    expect(() => guard.validate(request)).toThrow(HsmAdapterError);
  });

  test('MFA guard rejects duplicate signers', () => {
    const guard = new MfaBindingGuard({ minMfaSignatures: 2 });
    const request = {
      timestamp: Date.now(),
      payloadHash: 'x',
      signatures: [
        { signer: 'a', signature: 's1' },
        { signer: 'a', signature: 's2' },
      ],
    };
    expect(() => guard.validate(request)).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates identity configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'identity', {
      kemLevel: 768,
      scheme: 'ml-kem-768',
      skipped: 100,
      mfaBinding: true,
      mfaSignatures: 2,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'identity', {
      kemLevel: 256,
    })).toThrow(HsmAdapterError);

    expect(() => engine.validate('t1', 'identity', {
      kemLevel: 768,
      mfaBinding: false,
    })).toThrow(HsmAdapterError);

    expect(() => engine.validate('t1', 'identity', {
      skipped: 2000,
    })).toThrow(HsmAdapterError);
  });
});
