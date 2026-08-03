'use strict';

const {
  PqcThresholdSignatureEngine,
  PartialSignature,
  SUPPORTED_SIG_ALGORITHMS,
} = require('../pqc-threshold-signature-engine.cjs');
const { DkgSnarkEngine } = require('../dkg-snark-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('PqcThresholdSignatureEngine — Track 27 PQC Threshold Signatures', () => {
  beforeEach(() => { hsmMetrics.reset(); });

  function _setupEngine(total, threshold, sigAlg = 'ml-dsa-65') {
    const nodeIds = Array.from({ length: total }, (_, i) => `node-${i + 1}`);
    const dkg = new DkgSnarkEngine({ totalNodes: total, threshold, nodeIds });
    for (const nodeId of nodeIds) dkg.generateContribution(nodeId);
    dkg.processComplaints();
    const engine = new PqcThresholdSignatureEngine({ dkgEngine: dkg, sigAlgorithm: sigAlg });
    engine.initialize();
    return { dkg, engine, nodeIds };
  }

  describe('constructor validation', () => {
    test('rejects missing dkgEngine', () => {
      expect(() => new PqcThresholdSignatureEngine({ sigAlgorithm: 'ml-dsa-65' })).toThrow(HsmAdapterError);
    });
    test('rejects non-DkgSnarkEngine dkgEngine', () => {
      expect(() => new PqcThresholdSignatureEngine({ dkgEngine: {}, sigAlgorithm: 'ml-dsa-65' })).toThrow(HsmAdapterError);
    });
    test('rejects unsupported sigAlgorithm', () => {
      const dkg = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds: ['a', 'b', 'c'] });
      expect(() => new PqcThresholdSignatureEngine({ dkgEngine: dkg, sigAlgorithm: 'rsa-2048' })).toThrow(HsmAdapterError);
    });
    test('accepts all supported ML-DSA algorithms', () => {
      const dkg = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds: ['a', 'b', 'c'] });
      for (const alg of SUPPORTED_SIG_ALGORITHMS) {
        const engine = new PqcThresholdSignatureEngine({ dkgEngine: dkg, sigAlgorithm: alg });
        expect(engine.sigAlgorithm).toBe(alg);
      }
    });
  });

  describe('L2.01: happy-path threshold sign + verify (N=3, t=2)', () => {
    test('DKG round then threshold sign and verify', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('Hello, post-quantum world!');
      const partials = [];
      for (const nodeId of nodeIds) {
        const partial = engine.signPartial(nodeId, message);
        expect(partial.nodeId).toBe(nodeId);
        expect(typeof partial.sigma).toBe('bigint');
        partials.push(partial);
      }
      const signature = engine.aggregate(partials.slice(0, 2), message);
      expect(typeof signature).toBe('bigint');
      expect(engine.verify(signature, message)).toBe(true);
    });
  });

  describe('L2.02: partial signature generation', () => {
    test('each node produces a valid partial signature', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('test message');
      for (const nodeId of nodeIds) {
        const partial = engine.signPartial(nodeId, message);
        expect(engine.verifyPartial(partial, message)).toBe(true);
      }
    });
    test('partial signature is deterministic for same message + share', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('deterministic test');
      const p1 = engine.signPartial(nodeIds[0], message);
      const p2 = engine.signPartial(nodeIds[0], message);
      expect(p1.sigma).toBe(p2.sigma);
    });
  });

  describe('L2.03: signature aggregation', () => {
    test('t partial signatures combine into valid threshold signature', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('aggregation test');
      const partials = nodeIds.slice(0, 2).map((id) => engine.signPartial(id, message));
      const signature = engine.aggregate(partials, message);
      expect(engine.verify(signature, message)).toBe(true);
    });
    test('any t-of-N partials produce a valid signature', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('combinatorial test');
      const pairs = [[0, 1], [0, 2], [1, 2]];
      for (const [i, j] of pairs) {
        const partials = [engine.signPartial(nodeIds[i], message), engine.signPartial(nodeIds[j], message)];
        const sig = engine.aggregate(partials, message);
        expect(engine.verify(sig, message)).toBe(true);
      }
    });
  });

  describe('L2.04: signature verification against master public key', () => {
    test('valid signature passes verification', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('verify me');
      const partials = nodeIds.slice(0, 2).map((id) => engine.signPartial(id, message));
      const sig = engine.aggregate(partials, message);
      expect(engine.verify(sig, message)).toBe(true);
    });
    test('signature on different message fails verification', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('original message');
      const wrongMessage = Buffer.from('wrong message');
      const partials = nodeIds.slice(0, 2).map((id) => engine.signPartial(id, message));
      const sig = engine.aggregate(partials, message);
      expect(engine.verify(sig, wrongMessage)).toBe(false);
    });
  });

  describe('L2.05: quorum starvation', () => {
    test('fewer than t partials throws DKG_QUORUM_STARVATION', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('starvation test');
      const partial = engine.signPartial(nodeIds[0], message);
      expect(() => engine.aggregate([partial], message)).toThrow(HsmAdapterError);
      try { engine.aggregate([partial], message); } catch (e) { expect(e.code).toBe('DKG_QUORUM_STARVATION'); }
    });
  });

  describe('L2.06: larger quorum (N=5, t=3)', () => {
    test('5-node, 3-threshold sign + verify', () => {
      const { engine, nodeIds } = _setupEngine(5, 3);
      const message = Buffer.from('larger quorum test');
      const partials = nodeIds.slice(0, 3).map((id) => engine.signPartial(id, message));
      const sig = engine.aggregate(partials, message);
      expect(engine.verify(sig, message)).toBe(true);
    });
    test('any 3-of-5 partials produce a valid signature', () => {
      const { engine, nodeIds } = _setupEngine(5, 3);
      const message = Buffer.from('5-of-3 combinatorial');
      const triples = [[0, 1, 2], [0, 1, 3], [0, 1, 4], [1, 2, 3], [2, 3, 4]];
      for (const indices of triples) {
        const partials = indices.map((i) => engine.signPartial(nodeIds[i], message));
        const sig = engine.aggregate(partials, message);
        expect(engine.verify(sig, message)).toBe(true);
      }
    });
  });

  describe('L3.01: invalid partial signature detection', () => {
    test('tampered partial sigma is rejected during aggregation', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('tamper test');
      const p1 = engine.signPartial(nodeIds[0], message);
      const p2 = engine.signPartial(nodeIds[1], message);
      const tampered = new PartialSignature(p2.nodeId, (p2.sigma + 1n), p2.share);
      expect(() => engine.aggregate([p1, tampered], message)).toThrow(HsmAdapterError);
      try { engine.aggregate([p1, tampered], message); } catch (e) { expect(e.code).toBe('PQC_SIGNATURE_INVALID'); }
    });
    test('verifyPartial returns false for tampered sigma', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('partial tamper');
      const partial = engine.signPartial(nodeIds[0], message);
      const tampered = new PartialSignature(partial.nodeId, (partial.sigma + 1n), partial.share);
      expect(engine.verifyPartial(tampered, message)).toBe(false);
    });
  });

  describe('L3.02: non-qualified node cannot sign', () => {
    test('disqualified node throws NODE_DISQUALIFIED', () => {
      const nodeIds = ['a', 'b', 'c'];
      const dkg = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });
      for (const nodeId of nodeIds) dkg.generateContribution(nodeId);
      const contribution = dkg._contributions.get('a');
      contribution.shares.set('b', (contribution.shares.get('b') + 1n));
      dkg.fileComplaint('b', 'a', 'share verification failed');
      dkg.processComplaints();
      expect(dkg.disqualified.has('a')).toBe(true);
      const engine = new PqcThresholdSignatureEngine({ dkgEngine: dkg, sigAlgorithm: 'ml-dsa-65' });
      engine.initialize();
      const message = Buffer.from('disqualified test');
      expect(() => engine.signPartial('a', message)).toThrow(HsmAdapterError);
      try { engine.signPartial('a', message); } catch (e) { expect(e.code).toBe('NODE_DISQUALIFIED'); }
    });
  });

  describe('L3.03: memory sanitization', () => {
    test('zeroize clears all partial signatures', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      const message = Buffer.from('zeroize test');
      for (const nodeId of nodeIds) engine.signPartial(nodeId, message);
      expect(engine.getState().partialSignatures).toBe(3);
      engine.zeroize();
      expect(engine.getState().partialSignatures).toBe(0);
    });
    test('PartialSignature.zeroize marks as zeroized', () => {
      const partial = new PartialSignature('test', 123n, 456n);
      expect(partial.isZeroized()).toBe(false);
      partial.zeroize();
      expect(partial.isZeroized()).toBe(true);
      expect(partial.sigma).toBe(0n);
      expect(partial.share).toBe(0n);
    });
  });

  describe('L2.07/L2.08: policy validation', () => {
    test('CryptoPolicyEngine includes pqcThreshold block in default policy', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.pqcThreshold).toBeDefined();
      expect(policy.pqcThreshold.minQuorumThreshold).toBe(2);
      expect(policy.pqcThreshold.maxNodes).toBe(10);
      expect(policy.pqcThreshold.allowedSigAlgorithms).toContain('ml-dsa-65');
      expect(policy.pqcThreshold.requireDkgValidation).toBe(true);
    });
    test('tenant policy can override pqcThreshold settings', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: { 'tenant-a': { pqcThreshold: { minQuorumThreshold: 3, maxNodes: 20 } } },
      });
      const policy = engine.getPolicy('tenant-a');
      expect(policy.pqcThreshold.minQuorumThreshold).toBe(3);
      expect(policy.pqcThreshold.maxNodes).toBe(20);
      expect(policy.pqcThreshold.allowedSigAlgorithms).toContain('ml-dsa-65');
    });
  });

  describe('metrics counters', () => {
    test('hsm-metrics includes PQC threshold counters', () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty('hsm_pqc_threshold_sign_total', 0);
      expect(metrics).toHaveProperty('hsm_pqc_threshold_sign_failures_total', 0);
      expect(metrics).toHaveProperty('hsm_pqc_threshold_partial_sign_total', 0);
      expect(metrics).toHaveProperty('hsm_pqc_threshold_partial_verified_total', 0);
      expect(metrics).toHaveProperty('hsm_pqc_threshold_partial_rejected_total', 0);
      expect(metrics).toHaveProperty('hsm_pqc_threshold_verify_total', 0);
      expect(metrics).toHaveProperty('hsm_pqc_threshold_verify_failures_total', 0);
    });
    test('incrementCounter works for PQC threshold counters', () => {
      hsmMetrics.incrementCounter('hsm_pqc_threshold_sign_total', 1);
      hsmMetrics.incrementCounter('hsm_pqc_threshold_partial_sign_total', 3);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_pqc_threshold_sign_total).toBe(1);
      expect(metrics.hsm_pqc_threshold_partial_sign_total).toBe(3);
    });
    test('Prometheus output includes PQC threshold metrics', () => {
      hsmMetrics.incrementCounter('hsm_pqc_threshold_verify_total', 2);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain('# HELP hsm_pqc_threshold_verify_total');
      expect(output).toContain('# TYPE hsm_pqc_threshold_verify_total counter');
      expect(output).toContain('hsm_pqc_threshold_verify_total 2');
    });
  });

  describe('getState telemetry', () => {
    test('returns correct engine state', () => {
      const { engine, nodeIds } = _setupEngine(3, 2);
      engine.signPartial(nodeIds[0], Buffer.from('state test'));
      const state = engine.getState();
      expect(state.sigAlgorithm).toBe('ml-dsa-65');
      expect(state.threshold).toBe(2);
      expect(state.totalNodes).toBe(3);
      expect(state.qualifiedNodes).toBe(3);
      expect(state.partialSignatures).toBe(1);
      expect(state.requireZkValidation).toBe(true);
      expect(state.masterPublicKey).not.toBeNull();
    });
  });

  describe('initialize guard', () => {
    test('signPartial throws if not initialized', () => {
      const nodeIds = ['a', 'b', 'c'];
      const dkg = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });
      for (const nodeId of nodeIds) dkg.generateContribution(nodeId);
      dkg.processComplaints();
      const engine = new PqcThresholdSignatureEngine({ dkgEngine: dkg, sigAlgorithm: 'ml-dsa-65' });
      expect(() => engine.signPartial('a', Buffer.from('test'))).toThrow(HsmAdapterError);
    });
    test('verify throws if not initialized', () => {
      const nodeIds = ['a', 'b', 'c'];
      const dkg = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });
      for (const nodeId of nodeIds) dkg.generateContribution(nodeId);
      const engine = new PqcThresholdSignatureEngine({ dkgEngine: dkg, sigAlgorithm: 'ml-dsa-65' });
      expect(() => engine.verify(123n, Buffer.from('test'))).toThrow(HsmAdapterError);
    });
  });
});
