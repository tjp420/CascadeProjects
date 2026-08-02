'use strict';

const {
  MultipartyReKeyingEngine,
  ShareResharing,
  REKEY_STATE,
  VALID_TRANSITIONS,
  FIELD_PRIME,
  _evaluatePolynomial,
  _randomFieldElement,
} = require('../multiparty-rekeying-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('MultipartyReKeyingEngine — Track 37 Multiparty Re-Keying', () => {
  beforeEach(() => { hsmMetrics.reset(); });

  const SHAREHOLDERS = ['sh-1', 'sh-2', 'sh-3', 'sh-4', 'sh-5'];
  const THRESHOLD = 3;

  /**
   * Generate a valid resharing for a shareholder.
   * Polynomial: [0, a_1, ..., a_{t-1}] (constant term = 0)
   * Sub-shares: evaluate polynomial at each new shareholder index.
   */
  function _generateResharing(shareholderId, newShareholders, threshold) {
    const polynomial = [0n]; // constant term must be 0
    for (let i = 1; i < threshold; i++) {
      polynomial.push(_randomFieldElement());
    }
    const subShares = new Map();
    newShareholders.forEach((shId, idx) => {
      const x = BigInt(idx + 1);
      subShares.set(shId, _evaluatePolynomial(polynomial, x));
    });
    return { shareholderId, polynomial, subShares };
  }

  // ── L2.01: Full happy-path ──
  describe('L2.01: happy-path re-keying lifecycle', () => {
    test('propose → reshave → verify → ack (quorum) → commit', () => {
      const engine = new MultipartyReKeyingEngine({
        shareholders: SHAREHOLDERS,
        threshold: THRESHOLD,
      });

      const proposal = engine.proposeReKeying();
      expect(proposal.state).toBe(REKEY_STATE.PROPOSING);
      expect(proposal.epoch).toBe(1);

      // Submit resharings from all shareholders
      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, proposal.newShareholders, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      expect(engine.getReKeyingState().state).toBe(REKEY_STATE.RESHARING);

      const verified = engine.verifyResharings();
      expect(verified.verified).toBe(true);
      expect(engine.getReKeyingState().state).toBe(REKEY_STATE.VERIFIED);

      // Quorum acks (3 of 5)
      const ack1 = engine.acknowledge('sh-1');
      expect(ack1.quorumReached).toBe(false);
      engine.acknowledge('sh-2');
      const ack3 = engine.acknowledge('sh-3');
      expect(ack3.quorumReached).toBe(true);
      expect(engine.getReKeyingState().state).toBe(REKEY_STATE.COMMITTED);

      // Epoch advanced
      expect(engine.getCurrentEpoch()).toBe(1);
    });
  });

  // ── L2.02: Re-keying epoch is monotonic ──
  describe('L2.02: monotonic epoch', () => {
    test('epoch auto-increments', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      expect(engine.getCurrentEpoch()).toBe(0);
      const p = engine.proposeReKeying();
      expect(p.epoch).toBe(1);
    });

    test('explicit epoch must be greater than current', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      expect(() => engine.proposeReKeying({ targetEpoch: 0 })).toThrow(HsmAdapterError);
    });
  });

  // ── L2.03: BFT quorum acknowledgments ──
  describe('L2.03: quorum acknowledgments', () => {
    test('commit not reached until quorum', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: 4 });
      engine.proposeReKeying();
      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, SHAREHOLDERS, 4);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();

      engine.acknowledge('sh-1');
      engine.acknowledge('sh-2');
      engine.acknowledge('sh-3');
      expect(engine.getReKeyingState().state).toBe(REKEY_STATE.VERIFIED); // 3 < 4

      engine.acknowledge('sh-4');
      expect(engine.getReKeyingState().state).toBe(REKEY_STATE.COMMITTED); // 4 >= 4
    });
  });

  // ── L2.04: Shareholder addition/removal ──
  describe('L2.04: shareholder committee changes', () => {
    test('add new shareholder during re-keying', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      const newCommittee = [...SHAREHOLDERS, 'sh-6'];
      const proposal = engine.proposeReKeying({ newShareholders: newCommittee });
      expect(proposal.newShareholders).toContain('sh-6');

      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, newCommittee, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();
      engine.acknowledge('sh-1');
      engine.acknowledge('sh-2');
      engine.acknowledge('sh-3');

      expect(engine.getShareholders()).toContain('sh-6');
      expect(engine.getShareholders().length).toBe(6);
    });

    test('remove shareholder during re-keying', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      const newCommittee = ['sh-1', 'sh-2', 'sh-3', 'sh-4']; // remove sh-5
      const proposal = engine.proposeReKeying({ newShareholders: newCommittee });
      expect(proposal.newShareholders).not.toContain('sh-5');

      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, newCommittee, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();
      engine.acknowledge('sh-1');
      engine.acknowledge('sh-2');
      engine.acknowledge('sh-3');

      expect(engine.getShareholders()).not.toContain('sh-5');
    });
  });

  // ── L2.05: Threshold adjustment ──
  describe('L2.05: threshold adjustment', () => {
    test('change threshold during re-keying', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      const proposal = engine.proposeReKeying({ newThreshold: 4 });
      expect(proposal.newThreshold).toBe(4);

      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, SHAREHOLDERS, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();
      // Need 3 acks (old threshold) to commit
      engine.acknowledge('sh-1');
      engine.acknowledge('sh-2');
      engine.acknowledge('sh-3');

      expect(engine.getThreshold()).toBe(4);
    });
  });

  // ── L2.06: State machine ──
  describe('L2.06: state machine transitions', () => {
    test('cannot submit resharing without proposal', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      const r = _generateResharing('sh-1', SHAREHOLDERS, THRESHOLD);
      expect(() => engine.submitResharing(r.shareholderId, r.polynomial, r.subShares)).toThrow(HsmAdapterError);
    });

    test('cannot verify without resharings', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      expect(() => engine.verifyResharings()).toThrow(HsmAdapterError);
    });

    test('cannot acknowledge without verification', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, SHAREHOLDERS, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      expect(() => engine.acknowledge('sh-1')).toThrow(HsmAdapterError);
    });

    test('committed state is terminal', () => {
      expect(VALID_TRANSITIONS[REKEY_STATE.COMMITTED]).toEqual([]);
    });

    test('aborted state is terminal', () => {
      expect(VALID_TRANSITIONS[REKEY_STATE.ABORTED]).toEqual([]);
    });
  });

  // ── L2.07: Policy validation ──
  describe('L2.07: policy validation', () => {
    test('CryptoPolicyEngine includes multipartyReKeying block', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.multipartyReKeying).toBeDefined();
      expect(policy.multipartyReKeying.minQuorumNodes).toBe(3);
      expect(policy.multipartyReKeying.requireAntiRollback).toBe(true);
      expect(policy.multipartyReKeying.requireShareZeroization).toBe(true);
    });

    test('tenant policy can override multipartyReKeying settings', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: { 'tenant-a': { multipartyReKeying: { minQuorumNodes: 5 } } },
      });
      const policy = engine.getPolicy('tenant-a');
      expect(policy.multipartyReKeying.minQuorumNodes).toBe(5);
    });
  });

  // ── L2.08: Old shares zeroized ──
  describe('L2.08: old shares zeroized', () => {
    test('resharings are zeroized after commit', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, SHAREHOLDERS, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();
      engine.acknowledge('sh-1');
      engine.acknowledge('sh-2');
      engine.acknowledge('sh-3');

      expect(engine.getReKeyingState().activeReKeying.oldSharesZeroized).toBe(true);
    });
  });

  // ── L3.01: Anti-rollback ──
  describe('L3.01: anti-rollback', () => {
    test('epoch cannot decrease', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      engine.abort('test');
      engine.reset();
      // Now epoch is 0, try to propose with epoch 0 (should fail)
      expect(() => engine.proposeReKeying({ targetEpoch: 0 })).toThrow(HsmAdapterError);
    });

    test('rollback to lower epoch after commit rejected', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      // First re-keying round
      engine.proposeReKeying();
      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, SHAREHOLDERS, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();
      engine.acknowledge('sh-1');
      engine.acknowledge('sh-2');
      engine.acknowledge('sh-3');
      expect(engine.getCurrentEpoch()).toBe(1);

      engine.reset();

      // Try to propose with epoch 1 (same as current) — should fail
      expect(() => engine.proposeReKeying({ targetEpoch: 1 })).toThrow(HsmAdapterError);
      // Epoch 2 should work
      const p = engine.proposeReKeying({ targetEpoch: 2 });
      expect(p.epoch).toBe(2);
    });
  });

  // ── L3.02: Cannot commit without quorum ──
  describe('L3.02: cannot commit without quorum', () => {
    test('insufficient acks leaves in verified state', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: 4 });
      engine.proposeReKeying();
      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, SHAREHOLDERS, 4);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();
      engine.acknowledge('sh-1');
      engine.acknowledge('sh-2');
      expect(engine.getReKeyingState().state).toBe(REKEY_STATE.VERIFIED);
    });
  });

  // ── L3.03: Cannot reshave without proposal ──
  describe('L3.03: cannot reshave without proposal', () => {
    test('submitResharing throws in IDLE state', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      const r = _generateResharing('sh-1', SHAREHOLDERS, THRESHOLD);
      expect(() => engine.submitResharing(r.shareholderId, r.polynomial, r.subShares)).toThrow(HsmAdapterError);
    });
  });

  // ── L3.04: Verification rejects invalid shares ──
  describe('L3.04: verification rejects invalid shares', () => {
    test('polynomial with non-zero constant term rejected', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      const badPolynomial = [123n, _randomFieldElement(), _randomFieldElement()]; // non-zero constant
      const subShares = new Map();
      SHAREHOLDERS.forEach((shId, idx) => {
        subShares.set(shId, _evaluatePolynomial(badPolynomial, BigInt(idx + 1)));
      });
      expect(() => engine.submitResharing('sh-1', badPolynomial, subShares)).toThrow(HsmAdapterError);
    });

    test('polynomial with wrong degree rejected', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      const badPolynomial = [0n]; // degree 0, should be degree 2 (threshold-1)
      const subShares = new Map();
      SHAREHOLDERS.forEach((shId) => subShares.set(shId, 1n));
      expect(() => engine.submitResharing('sh-1', badPolynomial, subShares)).toThrow(HsmAdapterError);
    });

    test('sub-share for unknown target rejected', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      const polynomial = [0n, _randomFieldElement(), _randomFieldElement()];
      const subShares = new Map();
      subShares.set('unknown-shareholder', 1n);
      expect(() => engine.submitResharing('sh-1', polynomial, subShares)).toThrow(HsmAdapterError);
    });

    test('insufficient resharings rejected at verify', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: 4 });
      engine.proposeReKeying();
      // Only submit 2 resharings (need 4)
      for (let i = 0; i < 2; i++) {
        const r = _generateResharing(SHAREHOLDERS[i], SHAREHOLDERS, 4);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      expect(() => engine.verifyResharings()).toThrow(HsmAdapterError);
    });
  });

  // ── L3.05: Aborted is terminal ──
  describe('L3.05: aborted is terminal', () => {
    test('cannot abort committed re-keying', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, SHAREHOLDERS, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();
      engine.acknowledge('sh-1');
      engine.acknowledge('sh-2');
      engine.acknowledge('sh-3');
      expect(() => engine.abort()).toThrow(HsmAdapterError);
    });

    test('cannot abort already aborted', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      engine.abort('test');
      expect(() => engine.abort()).toThrow(HsmAdapterError);
    });

    test('cannot abort from IDLE', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      expect(() => engine.abort()).toThrow(HsmAdapterError);
    });

    test('reset after abort returns to IDLE', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      engine.abort('test');
      const result = engine.reset();
      expect(result.state).toBe(REKEY_STATE.IDLE);
    });
  });

  // ── Metrics ──
  describe('metrics counters', () => {
    test('hsm-metrics includes rekey counters', () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty('hsm_rekey_proposed_total', 0);
      expect(metrics).toHaveProperty('hsm_rekey_resharing_submitted_total', 0);
      expect(metrics).toHaveProperty('hsm_rekey_verified_total', 0);
      expect(metrics).toHaveProperty('hsm_rekey_committed_total', 0);
      expect(metrics).toHaveProperty('hsm_rekey_aborted_total', 0);
      expect(metrics).toHaveProperty('hsm_rekey_rollback_blocked_total', 0);
      expect(metrics).toHaveProperty('hsm_rekey_active', 0);
    });

    test('incrementCounter works for rekey counters', () => {
      hsmMetrics.incrementCounter('hsm_rekey_proposed_total', 3);
      hsmMetrics.incrementCounter('hsm_rekey_committed_total', 2);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_rekey_proposed_total).toBe(3);
      expect(metrics.hsm_rekey_committed_total).toBe(2);
    });

    test('Prometheus output includes rekey metrics', () => {
      hsmMetrics.incrementCounter('hsm_rekey_proposed_total', 1);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain('# HELP hsm_rekey_proposed_total');
      expect(output).toContain('# TYPE hsm_rekey_proposed_total counter');
      expect(output).toContain('hsm_rekey_proposed_total 1');
    });
  });

  // ── Engine state telemetry ──
  describe('getReKeyingState telemetry', () => {
    test('returns correct initial state', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      const state = engine.getReKeyingState();
      expect(state.state).toBe(REKEY_STATE.IDLE);
      expect(state.currentEpoch).toBe(0);
      expect(state.shareholders).toEqual(SHAREHOLDERS);
      expect(state.threshold).toBe(THRESHOLD);
      expect(state.activeReKeying).toBeNull();
    });

    test('returns active re-keying info during proposal', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      const state = engine.getReKeyingState();
      expect(state.state).toBe(REKEY_STATE.PROPOSING);
      expect(state.activeReKeying).not.toBeNull();
      expect(state.activeReKeying.epoch).toBe(1);
    });
  });

  // ── Error cases ──
  describe('error cases', () => {
    test('constructor throws for empty shareholders', () => {
      expect(() => new MultipartyReKeyingEngine({ shareholders: [], threshold: 1 })).toThrow(HsmAdapterError);
    });

    test('constructor throws for threshold > shareholders', () => {
      expect(() => new MultipartyReKeyingEngine({ shareholders: ['sh-1'], threshold: 2 })).toThrow(HsmAdapterError);
    });

    test('submitResharing throws for unknown shareholder', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      const r = _generateResharing('unknown', SHAREHOLDERS, THRESHOLD);
      expect(() => engine.submitResharing(r.shareholderId, r.polynomial, r.subShares)).toThrow(HsmAdapterError);
    });

    test('acknowledge throws for unknown shareholder', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      for (const shId of SHAREHOLDERS) {
        const r = _generateResharing(shId, SHAREHOLDERS, THRESHOLD);
        engine.submitResharing(r.shareholderId, r.polynomial, r.subShares);
      }
      engine.verifyResharings();
      expect(() => engine.acknowledge('unknown')).toThrow(HsmAdapterError);
    });

    test('proposeReKeying throws while re-keying in progress', () => {
      const engine = new MultipartyReKeyingEngine({ shareholders: SHAREHOLDERS, threshold: THRESHOLD });
      engine.proposeReKeying();
      expect(() => engine.proposeReKeying()).toThrow(HsmAdapterError);
    });
  });
});
