'use strict';

const { CryptoPolicyEngine, DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('Track 116 primitive groundwork', () => {
  test('GROUND-116-01: schema validation rejects malformed clusterIsolationHardening config', () => {
    const engine = new CryptoPolicyEngine();
    // Disabling requireKnownPeerValidation when policy enforces it should throw
    try {
      engine.validate('t1', 'clusterIsolationHardening', {
        requireKnownPeerValidation: false,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('POLICY_VIOLATION_BLOCKED');
    }
    // Disabling rejectNonLeaderKeyCommits when policy enforces it should throw
    try {
      engine.validate('t1', 'clusterIsolationHardening', {
        rejectNonLeaderKeyCommits: false,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('POLICY_VIOLATION_BLOCKED');
    }
    // Exceeding maxIsolationViolationThreshold should throw
    try {
      engine.validate('t1', 'clusterIsolationHardening', {
        maxIsolationViolationThreshold: 500,
      });
      throw new Error('expected validation to throw');
    } catch (e) {
      expect(e.code).toBe('POLICY_VIOLATION_BLOCKED');
    }
  });

  test('GROUND-116-02: DEFAULT_POLICY merges cleanly with tenant overrides without property contamination', () => {
    const engine = new CryptoPolicyEngine({
      default: DEFAULT_POLICY,
      tenants: {
        t1: {
          clusterIsolationHardening: {
            maxIsolationViolationThreshold: 50,
          },
        },
      },
    });
    const policy = engine.getPolicy('t1');
    expect(policy.clusterIsolationHardening).toBeDefined();
    // Overridden attribute
    expect(policy.clusterIsolationHardening.maxIsolationViolationThreshold).toBe(50);
    // Non-overridden attributes retain defaults
    expect(policy.clusterIsolationHardening.requireKnownPeerValidation).toBe(true);
    expect(policy.clusterIsolationHardening.rejectNonLeaderKeyCommits).toBe(true);
    expect(policy.clusterIsolationHardening.allowDkgNonLeaderMessages).toBe(false);
    // Verify no contamination into other policy blocks
    expect(policy.latticeVfhssGating).toBeDefined();
    expect(policy.latticeVfhssGating.minVfhssShares).toBe(7);
  });

  test('GROUND-116-03: both new telemetry counters register and are exposed on the metrics registry', () => {
    const all = hsmMetrics.getMetrics();
    expect(typeof all.hsm_isolation_violation_total).toBe('number');
    expect(all.hsm_isolation_violation_total).toBe(0);
    expect(typeof all.hsm_key_reject_total).toBe('number');
    expect(all.hsm_key_reject_total).toBe(0);
    // Verify increment works
    hsmMetrics.incrementCounter('hsm_isolation_violation_total', 1);
    hsmMetrics.incrementCounter('hsm_key_reject_total', 1);
    const updated = hsmMetrics.getMetrics();
    expect(updated.hsm_isolation_violation_total).toBe(1);
    expect(updated.hsm_key_reject_total).toBe(1);
  });

  test('GROUND-116-04: all modified files pass node -c syntax check', () => {
    // This test is a placeholder — the actual syntax check is run as part of L1
    // verification. We verify here that the modules load without error.
    const pe = require('../crypto-policy-engine.cjs');
    const hm = require('../hsm-metrics.cjs');
    expect(typeof pe.CryptoPolicyEngine).toBe('function');
    expect(typeof pe.DEFAULT_POLICY).toBe('object');
    expect(typeof hm.getMetrics).toBe('function');
    expect(typeof hm.incrementCounter).toBe('function');
  });

  test('GROUND-116-05: clusterIsolationHardening defaults to strict production hardening limits', () => {
    const p = DEFAULT_POLICY.clusterIsolationHardening;
    expect(p).toBeDefined();
    expect(p.requireKnownPeerValidation).toBe(true);
    expect(p.rejectNonLeaderKeyCommits).toBe(true);
    expect(p.allowDkgNonLeaderMessages).toBe(false);
    expect(p.maxIsolationViolationThreshold).toBe(100);
  });
});
