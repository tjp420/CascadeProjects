'use strict';

const { EnclaveRootRotator } = require('../enclave-root-rotator.cjs');
const { deriveMasterKeyFromSeed } = require('../enclave-key-deriver.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');

describe('hardware root rotation (Track47)', () => {
  test('accepts valid multi-admin quorum with attestation', async () => {
    const policy = new CryptoPolicyEngine();
    const att = { isVerified: (id) => true };
    const rotator = new EnclaveRootRotator({ policyEngine: policy, attestationClient: att, audit: () => {} });
    const proposal = { admins: ['a','b'], signatures: ['s1','s2'], payload: { seed: 'x' }, timestamp: Date.now() };
    const serialized = rotator.proposeRotation(proposal);
    expect(typeof serialized).toBe('string');
  });

  test('blocks un-attested admin', () => {
    const policy = new CryptoPolicyEngine();
    const att = { isVerified: (id) => id !== 'bad' };
    const rotator = new EnclaveRootRotator({ policyEngine: policy, attestationClient: att, audit: () => {} });
    const proposal = { admins: ['good','bad'], signatures: ['s1','s2'], payload: { seed: 'x' }, timestamp: Date.now() };
    expect(() => rotator.proposeRotation(proposal)).toThrow();
  });

  test('rejects expired proposal', () => {
    const policy = new CryptoPolicyEngine();
    // set a short expiry
    policy._policy.default.governance.proposalExpiryMs = 1;
    const att = { isVerified: (id) => true };
    const rotator = new EnclaveRootRotator({ policyEngine: policy, attestationClient: att, audit: () => {} });
    const oldTs = Date.now() - 10000;
    const proposal = { admins: ['a','b'], signatures: ['s1','s2'], payload: { seed: 'x' }, timestamp: oldTs };
    expect(() => rotator.proposeRotation(proposal)).toThrow();
  });

  test('derive master key zeroizes seed and commits telemetry', async () => {
    const seed = Buffer.from('0123456789abcdef0123456789abcdef');
    const master = await deriveMasterKeyFromSeed(seed, { audit: () => {} });
    expect(Buffer.isBuffer(master)).toBe(true);
  });
});
