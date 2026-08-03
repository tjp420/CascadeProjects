'use strict';

/**
 * Track 26: DKG & zk-SNARKs — Joint-Feldman VSS test suite.
 *
 * Validates the full DKG protocol: polynomial generation, share distribution,
 * commitment verification, complaint management, node disqualification,
 * master public key derivation, zk-SNARK parameter validation, and
 * group secret reconstruction via Lagrange interpolation.
 *
 * @module hsm-adapter/__tests__/dkg-snark.test
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DkgSnarkEngine,
  DkgNodeContribution,
  PRIME,
  FIELD_PRIME,
  GROUP_PRIME,
  GENERATOR,
} = require('../dkg-snark-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('DkgSnarkEngine — Track 26 DKG & zk-SNARKs', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  // ── L1: Constructor validation ──────────────────────────────────

  describe('constructor validation', () => {
    test('rejects totalNodes < 2', () => {
      expect(() => new DkgSnarkEngine({ totalNodes: 1, threshold: 1, nodeIds: ['a'] }))
        .toThrow(HsmAdapterError);
    });

    test('rejects threshold < 1', () => {
      expect(() => new DkgSnarkEngine({ totalNodes: 3, threshold: 0, nodeIds: ['a', 'b', 'c'] }))
        .toThrow(HsmAdapterError);
    });

    test('rejects threshold > totalNodes', () => {
      expect(() => new DkgSnarkEngine({ totalNodes: 3, threshold: 4, nodeIds: ['a', 'b', 'c'] }))
        .toThrow(HsmAdapterError);
    });

    test('rejects mismatched nodeIds length', () => {
      expect(() => new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds: ['a', 'b'] }))
        .toThrow(HsmAdapterError);
    });

    test('accepts valid parameters', () => {
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds: ['a', 'b', 'c'] });
      expect(engine.totalNodes).toBe(3);
      expect(engine.threshold).toBe(2);
      expect(engine.nodeIds).toEqual(['a', 'b', 'c']);
    });
  });

  // ── L2.01: Full happy-path DKG round-trip (N=3, t=2) ────────────

  describe('L2.01: happy-path DKG round-trip (N=3, t=2)', () => {
    test('all nodes contribute, verify shares, compute master public key', () => {
      const nodeIds = ['node-a', 'node-b', 'node-c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      // Phase 1: Each node generates a contribution
      for (const nodeId of nodeIds) {
        const contribution = engine.generateContribution(nodeId);
        expect(contribution.nodeId).toBe(nodeId);
        expect(contribution.polynomial.length).toBe(2); // degree t-1 = 1
        expect(contribution.commitments.length).toBe(2);
        expect(contribution.shares.size).toBe(3);
      }

      // Phase 2: Each node verifies shares from all other nodes
      for (const broadcaster of nodeIds) {
        for (const recipient of nodeIds) {
          const contribution = engine._contributions.get(broadcaster);
          const share = contribution.shares.get(recipient);
          const valid = engine.verifyShare(broadcaster, recipient, share);
          expect(valid).toBe(true);
        }
      }

      // Phase 3: No complaints — process complaints (should be empty)
      const disqualified = engine.processComplaints();
      expect(disqualified).toEqual([]);
      expect(engine.qualifiedNodes).toEqual(nodeIds);

      // Phase 4: Compute master public key
      const masterKey = engine.computeMasterPublicKey();
      expect(typeof masterKey).toBe('bigint');
      expect(masterKey).toBeGreaterThan(1n);
      expect(masterKey).toBeLessThan(GROUP_PRIME);

      // Verify: Y = prod g^{a_{i,0}} = prod C_{i,0}
      let expectedY = 1n;
      for (const nodeId of nodeIds) {
        const contribution = engine._contributions.get(nodeId);
        expectedY = (expectedY * contribution.commitments[0]) % GROUP_PRIME;
      }
      expect(masterKey).toBe(expectedY);
    });
  });

  // ── L2.04: Larger quorum (N=5, t=3) ─────────────────────────────

  describe('L2.04: larger quorum (N=5, t=3)', () => {
    test('5-node, 3-threshold DKG round-trip', () => {
      const nodeIds = ['n1', 'n2', 'n3', 'n4', 'n5'];
      const engine = new DkgSnarkEngine({ totalNodes: 5, threshold: 3, nodeIds });

      for (const nodeId of nodeIds) {
        const contribution = engine.generateContribution(nodeId);
        expect(contribution.polynomial.length).toBe(3); // degree t-1 = 2
        expect(contribution.commitments.length).toBe(3);
      }

      // Verify all shares
      let verifiedCount = 0;
      for (const broadcaster of nodeIds) {
        for (const recipient of nodeIds) {
          const contribution = engine._contributions.get(broadcaster);
          const share = contribution.shares.get(recipient);
          expect(engine.verifyShare(broadcaster, recipient, share)).toBe(true);
          verifiedCount++;
        }
      }
      expect(verifiedCount).toBe(25);

      engine.processComplaints();
      const masterKey = engine.computeMasterPublicKey();
      expect(masterKey).toBeGreaterThan(1n);
    });
  });

  // ── L2.02: Complaint management ─────────────────────────────────

  describe('L2.02: complaint management — invalid share detection', () => {
    test('invalid share is detected, complaint filed, node disqualified', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      // All nodes contribute
      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      // Tamper with node-a's share to node-b (make it invalid)
      const contribution = engine._contributions.get('a');
      const originalShare = contribution.shares.get('b');
      const tamperedShare = (originalShare + 1n) % FIELD_PRIME;
      contribution.shares.set('b', tamperedShare);

      // Node-b tries to verify the share from node-a — should fail
      const valid = engine.verifyShare('a', 'b', tamperedShare);
      expect(valid).toBe(false);

      // File a complaint
      engine.fileComplaint('b', 'a', 'share verification failed');

      // Process complaints — node-a should be disqualified
      const disqualified = engine.processComplaints();
      expect(disqualified).toContain('a');
      expect(engine.disqualified.has('a')).toBe(true);
      expect(engine.qualifiedNodes).not.toContain('a');

      // Master public key should still be computable from remaining nodes
      const masterKey = engine.computeMasterPublicKey();
      expect(typeof masterKey).toBe('bigint');
      expect(masterKey).toBeGreaterThan(1n);
    });

    test('objective complaint evidence model disqualifies broadcaster on verified invalid share', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({
        totalNodes: 3,
        threshold: 2,
        nodeIds,
        requireComplaintEvidence: true,
      });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      const contribution = engine._contributions.get('a');
      const originalShare = contribution.shares.get('b');
      const tamperedShare = (originalShare + 1n) % FIELD_PRIME;
      contribution.shares.set('b', tamperedShare);

      engine.fileComplaint('b', 'a', 'share verification failed', {
        recipientId: 'b',
        share: tamperedShare,
        commitmentIndex: 0,
        expectedCommitmentHex: contribution.commitments[0].toString(16),
        reasonCode: 'VSS_COMMITMENT_MISMATCH',
      });

      const disqualified = engine.processComplaints();
      expect(disqualified).toContain('a');
    });

    test('objective evidence recipient mismatch throws DKG_COMPLAINT_EVIDENCE_INVALID', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({
        totalNodes: 3,
        threshold: 2,
        nodeIds,
        requireComplaintEvidence: true,
      });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      const contribution = engine._contributions.get('a');
      const share = contribution.shares.get('b');
      expect(() => engine.fileComplaint('b', 'a', 'bad evidence', {
        recipientId: 'c',
        share,
        commitmentIndex: 0,
        expectedCommitmentHex: contribution.commitments[0].toString(16),
      })).toThrow(HsmAdapterError);

      try {
        engine.fileComplaint('b', 'a', 'bad evidence', {
          recipientId: 'c',
          share,
          commitmentIndex: 0,
          expectedCommitmentHex: contribution.commitments[0].toString(16),
        });
      } catch (e) {
        expect(e.code).toBe('DKG_COMPLAINT_EVIDENCE_INVALID');
      }
    });

    test('per-sender complaint spam is rate-limited', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({
        totalNodes: 3,
        threshold: 2,
        nodeIds,
        complaintRateLimitCount: 2,
        complaintRateLimitWindowMs: 10000,
      });

      const t0 = Date.now();
      engine.fileComplaint('b', 'a', 'c1', undefined, t0);
      engine.fileComplaint('b', 'a', 'c2', undefined, t0 + 1);

      expect(() => engine.fileComplaint('b', 'a', 'c3', undefined, t0 + 2)).toThrow(HsmAdapterError);
      try {
        engine.fileComplaint('b', 'a', 'c3', undefined, t0 + 2);
      } catch (e) {
        expect(e.code).toBe('DKG_COMPLAINT_RATE_LIMIT');
      }
    });
  });

  // ── L2.03: Quorum starvation ────────────────────────────────────

  describe('L2.03: quorum starvation', () => {
    test('reconstruction with fewer than t shares throws DKG_QUORUM_STARVATION', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      // Try to reconstruct with only 1 share (need 2)
      expect(() => engine.reconstructGroupSecret([
        { nodeId: 'a', share: engine.getAggregatedShare('a') },
      ])).toThrow(HsmAdapterError);
      try {
        engine.reconstructGroupSecret([
          { nodeId: 'a', share: engine.getAggregatedShare('a') },
        ]);
      } catch (e) {
        expect(e.code).toBe('DKG_QUORUM_STARVATION');
      }
    });

    test('master key computation with too few qualified nodes throws', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 3, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      // Disqualify 2 of 3 nodes, leaving only 1 (need 3)
      engine._disqualified.add('a');
      engine._disqualified.add('b');
      engine._qualifiedNodes = ['c'];

      expect(() => engine.computeMasterPublicKey())
        .toThrow(HsmAdapterError);
      try {
        engine.computeMasterPublicKey();
      } catch (e) {
        expect(e.code).toBe('DKG_QUORUM_STARVATION');
      }
    });
  });

  // ── L2.07: Group secret reconstruction ──────────────────────────

  describe('L2.07: Lagrange interpolation reconstructs group secret', () => {
    test('reconstructed secret matches sum of individual a_0 coefficients', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      // Compute the expected group secret: F(0) = sum_i a_{i,0} mod q
      let expectedSecret = 0n;
      for (const nodeId of nodeIds) {
        const contribution = engine._contributions.get(nodeId);
        expectedSecret = (expectedSecret + contribution.polynomial[0]) % FIELD_PRIME;
      }

      // Get aggregated shares from 2 nodes (threshold)
      const shareInputs = [
        { nodeId: 'a', share: engine.getAggregatedShare('a') },
        { nodeId: 'b', share: engine.getAggregatedShare('b') },
      ];

      const reconstructed = engine.reconstructGroupSecret(shareInputs);
      expect(reconstructed).toBe(expectedSecret);
    });

    test('any t shares produce the same secret', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      let expectedSecret = 0n;
      for (const nodeId of nodeIds) {
        const contribution = engine._contributions.get(nodeId);
        expectedSecret = (expectedSecret + contribution.polynomial[0]) % FIELD_PRIME;
      }

      // Reconstruct with different pairs
      const pairs = [['a', 'b'], ['a', 'c'], ['b', 'c']];
      for (const [n1, n2] of pairs) {
        const shares = [
          { nodeId: n1, share: engine.getAggregatedShare(n1) },
          { nodeId: n2, share: engine.getAggregatedShare(n2) },
        ];
        expect(engine.reconstructGroupSecret(shares)).toBe(expectedSecret);
      }
    });
  });

  // ── L3.01: zk-SNARK forgery detection ───────────────────────────

  describe('L3.01: zk-SNARK forgery detection', () => {
    test('valid zk-SNARK parameters pass verification', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }
      engine.processComplaints();
      engine.computeMasterPublicKey();

      const params = engine.generateZkSnarkParameters();
      expect(engine.verifyZkSnarkParameters(params)).toBe(true);
    });

    test('forged gs=0 throws DKG_ZK_PROOF_INVALID', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      expect(() => engine.verifyZkSnarkParameters({
        gs: 0n,
        gs2: 5n,
        proof: 7n,
      })).toThrow(HsmAdapterError);
      try {
        engine.verifyZkSnarkParameters({ gs: 0n, gs2: 5n, proof: 7n });
      } catch (e) {
        expect(e.code).toBe('DKG_ZK_PROOF_INVALID');
      }
    });

    test('forged gs2=1 (trivial) throws DKG_ZK_PROOF_INVALID', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      expect(() => engine.verifyZkSnarkParameters({
        gs: 5n,
        gs2: 1n,
        proof: 7n,
      })).toThrow(HsmAdapterError);
      try {
        engine.verifyZkSnarkParameters({ gs: 5n, gs2: 1n, proof: 7n });
      } catch (e) {
        expect(e.code).toBe('DKG_ZK_PROOF_INVALID');
      }
    });

    test('forged gs >= prime throws DKG_ZK_PROOF_INVALID', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      expect(() => engine.verifyZkSnarkParameters({
        gs: GROUP_PRIME,
        gs2: 5n,
        proof: 7n,
      })).toThrow(HsmAdapterError);
      try {
        engine.verifyZkSnarkParameters({ gs: GROUP_PRIME, gs2: 5n, proof: 7n });
      } catch (e) {
        expect(e.code).toBe('DKG_ZK_PROOF_INVALID');
      }
    });

    test('missing parameters throws DKG_ZK_PROOF_INVALID', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      expect(() => engine.verifyZkSnarkParameters(null))
        .toThrow(HsmAdapterError);
      expect(() => engine.verifyZkSnarkParameters({}))
        .toThrow(HsmAdapterError);
    });
  });

  // ── L3.02: Memory sanitization ──────────────────────────────────

  describe('L3.02: memory sanitization', () => {
    test('zeroizeAllEphemeralData clears all polynomial coefficients', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      // Verify coefficients are non-zero before zeroization
      for (const contribution of engine._contributions.values()) {
        expect(contribution.polynomial.some((c) => c !== 0n)).toBe(true);
        expect(contribution.isZeroized()).toBe(false);
      }

      engine.zeroizeAllEphemeralData();

      // Verify all coefficients and shares are zero
      for (const contribution of engine._contributions.values()) {
        expect(contribution.polynomial.every((c) => c === 0n)).toBe(true);
        expect(contribution.isZeroized()).toBe(true);
        for (const share of contribution.shares.values()) {
          expect(share).toBe(0n);
        }
      }
    });

    test('DkgNodeContribution.zeroize marks as zeroized', () => {
      const poly = [123n, 456n];
      const commitments = [789n, 1011n];
      const shares = new Map([['a', 1n], ['b', 2n]]);
      const contribution = new DkgNodeContribution('test', poly, commitments, shares);

      expect(contribution.isZeroized()).toBe(false);
      contribution.zeroize();
      expect(contribution.isZeroized()).toBe(true);
      expect(poly[0]).toBe(0n);
      expect(poly[1]).toBe(0n);
      // Commitments should NOT be zeroized (they're public)
      expect(commitments[0]).toBe(789n);
    });

    test('invokes pluggable zeroization hook before software zeroization', () => {
      const nodeIds = ['a', 'b', 'c'];
      const calls = [];
      const engine = new DkgSnarkEngine({
        totalNodes: 3,
        threshold: 2,
        nodeIds,
        zeroizationHook: (ctx) => {
          calls.push({
            nodeId: ctx.nodeId,
            phase: ctx.phase,
            polynomialBytes: ctx.polynomialBuffer.length,
            shareBytes: ctx.shareBuffer.length,
            polyAllZero: ctx.polynomialBuffer.every((b) => b === 0),
            shareAllZero: ctx.shareBuffer.every((b) => b === 0),
          });
        },
      });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      engine.zeroizeAllEphemeralData();

      expect(calls.length).toBe(nodeIds.length);
      expect(calls.every((c) => c.phase === 'dkg_ephemeral_cleanup')).toBe(true);
      expect(calls.every((c) => c.polynomialBytes > 0)).toBe(true);
      expect(calls.every((c) => c.shareBytes > 0)).toBe(true);
      expect(calls.every((c) => c.polyAllZero === false)).toBe(true);
      expect(calls.every((c) => c.shareAllZero === false)).toBe(true);

      for (const contribution of engine._contributions.values()) {
        expect(contribution.polynomial.every((c) => c === 0n)).toBe(true);
        expect([...contribution.shares.values()].every((s) => s === 0n)).toBe(true);
      }

      const state = engine.getState();
      expect(state.zeroizationHookEnabled).toBe(true);
      expect(state.requireZeroizationHook).toBe(false);
    });

    test('falls back to software zeroization when hook throws in best-effort mode', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({
        totalNodes: 3,
        threshold: 2,
        nodeIds,
        zeroizationHook: () => {
          throw new Error('simulated enclave failure');
        },
      });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      expect(() => engine.zeroizeAllEphemeralData()).not.toThrow();
      for (const contribution of engine._contributions.values()) {
        expect(contribution.polynomial.every((c) => c === 0n)).toBe(true);
        expect([...contribution.shares.values()].every((s) => s === 0n)).toBe(true);
      }
    });

    test('throws DKG_ZEROIZATION_HOOK_FAILED when hook is required and fails', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({
        totalNodes: 3,
        threshold: 2,
        nodeIds,
        zeroizationHook: () => {
          throw new Error('simulated required-hook failure');
        },
        requireZeroizationHook: true,
      });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      expect(() => engine.zeroizeAllEphemeralData()).toThrow(HsmAdapterError);
      try {
        engine.zeroizeAllEphemeralData();
      } catch (e) {
        expect(e.code).toBe('DKG_ZEROIZATION_HOOK_FAILED');
      }
      const state = engine.getState();
      expect(state.requireZeroizationHook).toBe(true);
    });
  });

  // ── L2.08/L2.09: Policy validation ──────────────────────────────

  describe('L2.08/L2.09: policy validation', () => {
    test('CryptoPolicyEngine includes dkg block in default policy', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.dkg).toBeDefined();
      expect(policy.dkg.minQuorumThreshold).toBe(3);
      expect(policy.dkg.maxNodes).toBe(10);
      expect(policy.dkg.commitmentGroup).toBe('P-256');
      expect(policy.dkg.requireZkValidation).toBe(true);
    });

    test('tenant policy can override dkg settings', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: {
          'tenant-a': {
            dkg: {
              minQuorumThreshold: 5,
              maxNodes: 20,
            },
          },
        },
      });
      const policy = engine.getPolicy('tenant-a');
      expect(policy.dkg.minQuorumThreshold).toBe(5);
      expect(policy.dkg.maxNodes).toBe(20);
      // Non-overridden fields retain defaults
      expect(policy.dkg.commitmentGroup).toBe('P-256');
      expect(policy.dkg.requireZkValidation).toBe(true);
    });
  });

  // ── Metrics counters ────────────────────────────────────────────

  describe('metrics counters', () => {
    test('hsm-metrics includes DKG counters', () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty('hsm_dkg_rounds_started_total', 0);
      expect(metrics).toHaveProperty('hsm_dkg_rounds_completed_total', 0);
      expect(metrics).toHaveProperty('hsm_dkg_shares_verified_total', 0);
      expect(metrics).toHaveProperty('hsm_dkg_shares_rejected_total', 0);
      expect(metrics).toHaveProperty('hsm_dkg_complaints_filed_total', 0);
      expect(metrics).toHaveProperty('hsm_dkg_nodes_disqualified_total', 0);
      expect(metrics).toHaveProperty('hsm_dkg_zk_proofs_generated_total', 0);
      expect(metrics).toHaveProperty('hsm_dkg_zk_proofs_invalid_total', 0);
    });

    test('incrementCounter works for DKG counters', () => {
      hsmMetrics.incrementCounter('hsm_dkg_rounds_started_total', 1);
      hsmMetrics.incrementCounter('hsm_dkg_shares_verified_total', 5);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_dkg_rounds_started_total).toBe(1);
      expect(metrics.hsm_dkg_shares_verified_total).toBe(5);
    });

    test('Prometheus output includes DKG metrics', () => {
      hsmMetrics.incrementCounter('hsm_dkg_rounds_completed_total', 3);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain('# HELP hsm_dkg_rounds_completed_total');
      expect(output).toContain('# TYPE hsm_dkg_rounds_completed_total counter');
      expect(output).toContain('hsm_dkg_rounds_completed_total 3');
    });
  });

  // ── getState telemetry ──────────────────────────────────────────

  describe('getState telemetry', () => {
    test('returns correct protocol state', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      engine.generateContribution('a');
      engine.generateContribution('b');

      const state = engine.getState();
      expect(state.totalNodes).toBe(3);
      expect(state.threshold).toBe(2);
      expect(state.contributionsReceived).toBe(2);
      expect(state.complaints).toBe(0);
      expect(state.disqualified).toEqual([]);
      expect(state.requireZkValidation).toBe(true);
    });
  });

  // ── Duplicate contribution guard ────────────────────────────────

  describe('duplicate contribution guard', () => {
    test('rejects duplicate contribution from same node', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      engine.generateContribution('a');
      expect(() => engine.generateContribution('a'))
        .toThrow(HsmAdapterError);
    });
  });

  // ── Unknown node guard ──────────────────────────────────────────

  describe('unknown node guard', () => {
    test('rejects contribution from unknown node', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      expect(() => engine.generateContribution('unknown'))
        .toThrow(HsmAdapterError);
    });

    test('rejects complaint from unknown node', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      expect(() => engine.fileComplaint('unknown', 'a', 'test'))
        .toThrow(HsmAdapterError);
    });

    test('rejects complaint against unknown node', () => {
      const nodeIds = ['a', 'b', 'c'];
      const engine = new DkgSnarkEngine({ totalNodes: 3, threshold: 2, nodeIds });

      expect(() => engine.fileComplaint('a', 'unknown', 'test'))
        .toThrow(HsmAdapterError);
    });
  });

  // ── L3.11: durable signed transcript export ────────────────────

  describe('L3.11: durable signed transcript export', () => {
    test('exports complaint lifecycle transcript into .audit-compatible path with verifiable HMAC', () => {
      const nodeIds = ['a', 'b', 'c'];
      const auditDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dkg-audit-'));
      const secret = 'test-transcript-secret';
      const engine = new DkgSnarkEngine({
        totalNodes: 3,
        threshold: 2,
        nodeIds,
        auditDirectory: auditDir,
        transcriptSigningSecret: secret,
      });

      for (const nodeId of nodeIds) {
        engine.generateContribution(nodeId);
      }

      const contribution = engine._contributions.get('a');
      const originalShare = contribution.shares.get('b');
      const tamperedShare = (originalShare + 1n) % FIELD_PRIME;
      contribution.shares.set('b', tamperedShare);
      engine.fileComplaint('b', 'a', 'share verification failed');
      engine.processComplaints();
      engine.zeroizeAllEphemeralData();

      const exported = engine.exportSignedTranscript();
      expect(exported.signatureType).toBe('hmac-sha256');
      expect(fs.existsSync(exported.filePath)).toBe(true);

      const raw = fs.readFileSync(exported.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      expect(parsed.meta.signatureType).toBe('hmac-sha256');
      expect(parsed.meta.digestHex).toBe(exported.digestHex);
      expect(Array.isArray(parsed.payload.events)).toBe(true);
      expect(parsed.payload.events.some((e) => e.eventType === 'complaint_filed')).toBe(true);
      expect(parsed.payload.events.some((e) => e.eventType === 'complaints_processed')).toBe(true);

      const canonical = engine._canonicalizeJson(parsed.payload);
      const expectedHmac = crypto
        .createHmac('sha256', secret)
        .update(Buffer.from(canonical, 'utf8'))
        .digest('base64');
      expect(parsed.signature).toBe(expectedHmac);

      fs.rmSync(auditDir, { recursive: true, force: true });
    });
  });
});
