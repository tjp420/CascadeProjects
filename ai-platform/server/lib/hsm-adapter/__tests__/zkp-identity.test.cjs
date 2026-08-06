'use strict';

/**
 * Track 21: Zero-knowledge identity and ephemeral hardware token tests.
 */
const crypto = require('crypto');
const { ZkIdentityVerifier } = require('../zk-identity-verifier.cjs');
const { EphemeralHardwareTokenSplitter } = require('../ephemeral-hardware-token-splitter.cjs');
const { SoftwareHsmAdapter } = require('../software-adapter.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const SMALL_PRIME = 23n;
const SMALL_GEN = 2n;
// Proper safe prime generated via crypto.generatePrimeSync(128, { safe: true }).
// p is prime and q = (p-1)/2 is prime by construction.
// NOTE: 2^61-1 (Mersenne) is prime but (p-1)/2 = 2^60-1 is NOT prime — it factors
// as (2^30-1)(2^30+1) with small divisors [3,3,5,5,7,11,13,31,41,61], causing
// intermittent false-positive Schnorr verifications under concurrent test load.
const LARGE_SAFE_PRIME = 287923746496521074231446155346183523207n;
const LARGE_GEN = 2n;

describe('ZkIdentityVerifier', () => {
  test('creates and verifies a valid Schnorr proof', () => {
    const verifier = new ZkIdentityVerifier({ prime: SMALL_PRIME, generator: SMALL_GEN, safe: true });
    const { privateKey, publicKey } = verifier.generateProverKeys();
    const proof = verifier.createProof(privateKey, 'context-1');
    expect(verifier.verifyProof(publicKey, proof, 'context-1')).toBe(true);
  });

  test('fails with a different challenge context', () => {
    // Use large prime to avoid hash collisions in challenge derivation
    const verifier = new ZkIdentityVerifier({ prime: LARGE_SAFE_PRIME, generator: LARGE_GEN, safe: true });
    const { privateKey, publicKey } = verifier.generateProverKeys();
    const proof = verifier.createProof(privateKey, 'context-1');
    expect(verifier.verifyProof(publicKey, proof, 'context-2')).toBe(false);
  });

  test('fails with a tampered response', () => {
    const verifier = new ZkIdentityVerifier({ prime: LARGE_SAFE_PRIME, generator: LARGE_GEN, safe: true });
    const { privateKey, publicKey } = verifier.generateProverKeys();
    const proof = verifier.createProof(privateKey, 'context-1');
    proof.s = Buffer.alloc(32, 0);
    expect(verifier.verifyProof(publicKey, proof, 'context-1')).toBe(false);
  });

  test('emits IDENTITY_PROOF_GENERATED and ZERO_KNOWLEDGE_VERIFIED audit events', () => {
    const logger = { info: jest.fn() };
    const verifier = new ZkIdentityVerifier({ prime: SMALL_PRIME, generator: SMALL_GEN, safe: true, logger });
    const { privateKey, publicKey } = verifier.generateProverKeys();
    const proof = verifier.createProof(privateKey);
    verifier.verifyProof(publicKey, proof);
    expect(logger.info).toHaveBeenCalledWith(
      'IDENTITY_PROOF_GENERATED',
      expect.objectContaining({ sub: 'hsm-adapter', provider: 'zkp' })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'ZERO_KNOWLEDGE_VERIFIED',
      expect.objectContaining({ sub: 'hsm-adapter', provider: 'zkp', result: true })
    );
  });

  test('verifyProofOrThrow throws ZKP_VERIFICATION_FAILED on invalid proof', () => {
    const verifier = new ZkIdentityVerifier({ prime: LARGE_SAFE_PRIME, generator: LARGE_GEN, safe: true });
    const { privateKey, publicKey } = verifier.generateProverKeys();
    const proof = verifier.createProof(privateKey, 'context-1');
    // Tamper with the proof
    proof.s = Buffer.alloc(32, 0);
    let threw = false;
    try {
      verifier.verifyProofOrThrow(publicKey, proof, 'context-1');
    } catch (e) {
      threw = true;
      expect(e).toBeInstanceOf(HsmAdapterError);
      expect(e.code).toBe('ZKP_VERIFICATION_FAILED');
    }
    expect(threw).toBe(true);
  });

  test('verifyProofOrThrow does not throw on valid proof', () => {
    const verifier = new ZkIdentityVerifier({ prime: LARGE_SAFE_PRIME, generator: LARGE_GEN, safe: true });
    const { privateKey, publicKey } = verifier.generateProverKeys();
    const proof = verifier.createProof(privateKey, 'context-1');
    expect(() => verifier.verifyProofOrThrow(publicKey, proof, 'context-1')).not.toThrow();
  });

  test('verifyProofOrThrow throws on wrong context', () => {
    const verifier = new ZkIdentityVerifier({ prime: LARGE_SAFE_PRIME, generator: LARGE_GEN, safe: true });
    const { privateKey, publicKey } = verifier.generateProverKeys();
    const proof = verifier.createProof(privateKey, 'context-1');
    let threw = false;
    try {
      verifier.verifyProofOrThrow(publicKey, proof, 'context-2');
    } catch (e) {
      threw = true;
      expect(e).toBeInstanceOf(HsmAdapterError);
      expect(e.code).toBe('ZKP_VERIFICATION_FAILED');
    }
    expect(threw).toBe(true);
  });
});

describe('EphemeralHardwareTokenSplitter', () => {
  test('issues and verifies a token within the expiry window', () => {
    const root = crypto.randomBytes(32);
    const splitter = new EphemeralHardwareTokenSplitter(root, { tokenExpiryMs: 10000 });
    const token = splitter.issue('t1');
    expect(Buffer.isBuffer(token.value)).toBe(true);
    expect(token.value.length).toBe(16);
    expect(splitter.verify(token, 't1')).toBe(true);
  });

  test('rejects an expired token', async () => {
    const root = crypto.randomBytes(32);
    const splitter = new EphemeralHardwareTokenSplitter(root, { tokenExpiryMs: 1, clockSkewMs: 0 });
    const token = splitter.issue('t1');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(() => splitter.verify(token, 't1')).toThrow(HsmAdapterError);
  });

  test('rejects a token bound to a different tenant', () => {
    const root = crypto.randomBytes(32);
    const splitter = new EphemeralHardwareTokenSplitter(root, { tokenExpiryMs: 10000 });
    const token = splitter.issue('t1');
    expect(() => splitter.verify(token, 't2')).toThrow(HsmAdapterError);
  });

  test('enforces proof limits', () => {
    const root = crypto.randomBytes(32);
    const splitter = new EphemeralHardwareTokenSplitter(root);
    splitter.recordProof('t1', 2);
    splitter.recordProof('t1', 2);
    expect(() => splitter.recordProof('t1', 2)).toThrow(HsmAdapterError);
  });
});

describe('Policy and adapter integration', () => {
  test('CryptoPolicyEngine rejects excessive ZKP token expiry', () => {
    const policy = new CryptoPolicyEngine({
      default: { zkp: { tokenExpiryMs: 1000 } },
    });
    expect(() => policy.validate('t1', 'zkp', { tokenExpiryMs: 1001 })).toThrow(HsmAdapterError);
  });

  test('L3-02: CryptoPolicyEngine enforces allowedPrimes list when non-empty', () => {
    const knownPrime = '0x17'; // 23 in hex
    const policy = new CryptoPolicyEngine({
      default: { zkp: { tokenExpiryMs: 300000, maxProofs: 100, allowedPrimes: [knownPrime] } },
    });
    // Valid prime (in allowed list)
    expect(() => policy.validate('t1', 'zkp', { primeHex: knownPrime })).not.toThrow();
    // Invalid prime (not in allowed list)
    expect(() => policy.validate('t1', 'zkp', { primeHex: '0x1f' })).toThrow(HsmAdapterError);
  });

  test('L3-02: CryptoPolicyEngine allows any prime when allowedPrimes is empty', () => {
    const policy = new CryptoPolicyEngine({
      default: { zkp: { tokenExpiryMs: 300000, maxProofs: 100, allowedPrimes: [] } },
    });
    expect(() => policy.validate('t1', 'zkp', { primeHex: '0x17' })).not.toThrow();
    expect(() => policy.validate('t1', 'zkp', { primeHex: '0x1f' })).not.toThrow();
  });

  test('CryptoPolicyEngine rejects excessive maxProofs', () => {
    const policy = new CryptoPolicyEngine({
      default: { zkp: { maxProofs: 50 } },
    });
    expect(() => policy.validate('t1', 'zkp', { maxProofs: 51 })).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine default zkp policy is applied when tenant omits zkp section', () => {
    // This tests the bug fix: DEFAULT_POLICY.zkp must exist
    const policy = new CryptoPolicyEngine({
      default: {}, // no zkp section — should fall back to DEFAULT_POLICY.zkp
    });
    // Should not throw — uses default tokenExpiryMs=300000
    expect(() => policy.validate('t1', 'zkp', { tokenExpiryMs: 100000 })).not.toThrow();
    // Should throw — exceeds default maxProofs=100
    expect(() => policy.validate('t1', 'zkp', { maxProofs: 101 })).toThrow(HsmAdapterError);
  });

  test('BaseHsmAdapter creates ZKP verifier and token splitter', async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();
    const verifier = adapter.createZkpVerifier('t1', { prime: SMALL_PRIME, generator: SMALL_GEN, safe: true });
    expect(verifier).toBeInstanceOf(ZkIdentityVerifier);
    const root = crypto.randomBytes(32);
    const splitter = adapter.createHardwareTokenSplitter('t1', root, { tokenExpiryMs: 1000 });
    expect(splitter).toBeInstanceOf(EphemeralHardwareTokenSplitter);
  });

  test('regression: wrap/unwrap still works after adapter changes', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK('t1');
    const plaintext = Buffer.alloc(16, 0x11);
    const wrapped = await adapter.wrap('t1', kekId, plaintext);
    const unwrapped = await adapter.unwrap('t1', kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });
});
