'use strict';

/**
 * Track 26: DKG and zk-SNARK verification integration tests.
 */
const { DkgCoordinator } = require('../dkg-coordinator.cjs');
const { DkgNode } = require('../dkg-node.cjs');
const { SnarkProver } = require('../snark-prover.cjs');
const { SnarkVerifier } = require('../snark-verifier.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 26 DKG and zk-SNARK', () => {
  test('3-node DKG group produces consistent public key', () => {
    const events = [];
    const coordinator = new DkgCoordinator({
      nodeCount: 3,
      threshold: 2,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = coordinator.runRound();

    expect(typeof result.publicKey).toBe('bigint');
    expect(result.publicKey > 0n).toBe(true);
    expect(result.groupShares).toHaveLength(3);
    result.groupShares.forEach((s) => expect(typeof s).toBe('bigint'));
    expect(events.some((e) => e.event === 'DKG_ROUND_COMPLETED')).toBe(true);
  });

  test('DKG rejects threshold larger than node count', () => {
    expect(() => new DkgCoordinator({ nodeCount: 3, threshold: 4 }).runRound()).toThrow(HsmAdapterError);
  });

  test('DKG node verifies a peer share and rejects a tampered one', () => {
    const node = new DkgNode({ nodeId: 1, prime: 11n, subgroupOrder: 5n, generator: 3n });
    node.generatePolynomial(1);
    const [share] = node.computeSharesFor([1, 2, 3]);
    const valid = node.verifyShare(share.value, share.recipientId, node.getCommitments());
    expect(valid).toBe(true);

    const invalid = node.verifyShare(share.value + 1n, share.recipientId, node.getCommitments());
    expect(invalid).toBe(false);
  });

  test('snark prover/verifier round-trip succeeds for a compliant configuration', () => {
    const prover = new SnarkProver({
      publicParams: { verificationKey: 'vk-test', field: 'bn254' },
      provingSystem: 'groth16',
    });
    const verifier = new SnarkVerifier({
      publicParams: { verificationKey: 'vk-test', field: 'bn254' },
    });

    const witness = { allowedCurves: ['P-256'], rsaMinBits: 2048 };
    const publicInputs = { tenantId: 't1', operation: 'wrap' };
    const constraints = [
      { name: 'min-rsa-bits', predicate: (w, p) => w.rsaMinBits >= 2048 },
      { name: 'allowed-curve-present', predicate: (w, p) => w.allowedCurves.includes('P-256') },
    ];

    const { proof, publicSignals } = prover.prove(witness, publicInputs, constraints);
    expect(verifier.verify({ proof, publicSignals })).toBe(true);
  });

  test('snark prover rejects a configuration that violates constraints', () => {
    const prover = new SnarkProver({ publicParams: { verificationKey: 'vk-test' } });
    const witness = { allowedCurves: ['P-256'], rsaMinBits: 1024 };
    const publicInputs = { tenantId: 't1', operation: 'wrap' };
    const constraints = [
      { name: 'min-rsa-bits', predicate: (w, p) => w.rsaMinBits >= 2048 },
    ];

    expect(() => prover.prove(witness, publicInputs, constraints)).toThrow(HsmAdapterError);
  });

  test('snark verifier rejects unauthorized proving system', () => {
    const prover = new SnarkProver({
      publicParams: { verificationKey: 'vk-test' },
      provingSystem: 'bulletproofs',
    });
    const verifier = new SnarkVerifier({
      publicParams: { verificationKey: 'vk-test' },
      allowedProvingSystems: ['groth16'],
    });

    const { proof, publicSignals } = prover.prove({}, {}, []);
    expect(() => verifier.verify({ proof, publicSignals })).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates DKG and snark configurations', () => {
    const engine = new CryptoPolicyEngine({ default: {} });

    expect(() => engine.validate('t1', 'dkg', { nodeCount: 5, threshold: 3, polynomialDegree: 2 })).not.toThrow();
    expect(() => engine.validate('t1', 'snark', { provingSystem: 'groth16', constraintCount: 1000, field: 'bn254' })).not.toThrow();
    expect(() => engine.validate('t1', 'dkg', { nodeCount: 22, threshold: 3 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'snark', { provingSystem: 'bulletproofs' })).toThrow(HsmAdapterError);
  });

  test('regression: HsmAdapterError is preserved for invalid DKG node id', () => {
    expect(() => new DkgNode({ nodeId: 0 })).toThrow(HsmAdapterError);
  });
});
