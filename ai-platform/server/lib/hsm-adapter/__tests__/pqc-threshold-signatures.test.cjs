'use strict';

/**
 * Track 27: Post-Quantum Threshold Signatures integration tests.
 */
const { PqcThresholdSigner } = require('../pqc-threshold-signer.cjs');
const { SignatureShareAggregator } = require('../signature-share-aggregator.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 27 PQC threshold signatures', () => {
  test('3-node group produces and aggregates a valid group signature', () => {
    const events = [];
    const threshold = 2;
    const message = 'tenant-data-policy-update';
    const scheme = 'ml-dsa-65';
    const groupPublicKey = 3n;

    // Simulated DKG group shares over the small subgroup q=5
    const secretShares = [2n, 3n, 4n];
    const signers = secretShares.map((share, idx) => new PqcThresholdSigner({
      nodeId: idx + 1,
      scheme,
      secretShare: share,
    }));

    const aggregator = new SignatureShareAggregator({
      threshold,
      scheme,
      groupPublicKey,
      audit: (event, info) => events.push({ event, info }),
    });

    for (const signer of signers) {
      const partial = signer.sign(message);
      expect(PqcThresholdSigner.verifyPartial(partial, message)).toBe(true);
      aggregator.submitPartial(partial, message);
    }

    const groupSig = aggregator.aggregate(message);
    expect(typeof groupSig.signature).toBe('string');
    expect(groupSig.signature.length).toBeGreaterThan(0);
    expect(groupSig.threshold).toBe(threshold);
    expect(groupSig.partialNodeIds).toHaveLength(3);
    expect(events.some((e) => e.event === 'PQC_SIGNATURE_SHARE_VERIFIED')).toBe(true);
    expect(events.some((e) => e.event === 'PQC_GROUP_SIGNATURE_FINALIZED')).toBe(true);
  });

  test('aggregator rejects fewer partials than threshold', () => {
    const aggregator = new SignatureShareAggregator({ threshold: 3, scheme: 'ml-dsa-65' });
    const signer = new PqcThresholdSigner({ nodeId: 1, scheme: 'ml-dsa-65', secretShare: 2n });
    aggregator.submitPartial(signer.sign('msg'), 'msg');
    expect(() => aggregator.aggregate('msg')).toThrow(HsmAdapterError);
  });

  test('aggregator rejects tampered partial signature', () => {
    const aggregator = new SignatureShareAggregator({ threshold: 2, scheme: 'ml-dsa-65' });
    const signer = new PqcThresholdSigner({ nodeId: 1, scheme: 'ml-dsa-65', secretShare: 2n });
    const partial = signer.sign('msg');
    partial.response = (partial.response + 1n) % 5n;
    expect(() => aggregator.submitPartial(partial, 'msg')).toThrow(HsmAdapterError);
  });

  test('aggregator rejects duplicate node submissions', () => {
    const aggregator = new SignatureShareAggregator({ threshold: 2, scheme: 'ml-dsa-65' });
    const signer = new PqcThresholdSigner({ nodeId: 1, scheme: 'ml-dsa-65', secretShare: 2n });
    aggregator.submitPartial(signer.sign('msg'), 'msg');
    expect(() => aggregator.submitPartial(signer.sign('msg'), 'msg')).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates pqc-threshold configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqc-threshold', {
      scheme: 'ml-dsa-65',
      threshold: 2,
      partialCount: 3,
      groupPublicKeyAttestation: 'attest-xyz',
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqc-threshold', {
      scheme: 'unsupported',
      threshold: 2,
    })).toThrow(HsmAdapterError);

    expect(() => engine.validate('t1', 'pqc-threshold', {
      scheme: 'ml-dsa-65',
      threshold: 1,
      groupPublicKeyAttestation: 'attest-xyz',
    })).toThrow(HsmAdapterError);
  });

  test('regression: PqcThresholdSigner requires a message', () => {
    const signer = new PqcThresholdSigner({ nodeId: 1, scheme: 'ml-dsa-65', secretShare: 2n });
    expect(() => signer.sign('')).toThrow(HsmAdapterError);
  });
});
