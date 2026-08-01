'use strict';

const path = require('path');
const {
  loadCanaryConfig,
  enrollmentScore,
  shouldEnableHybrid,
  checkRollback,
  resolveDeprecationState,
} = require('../quantum-hybrid-rollout.cjs');

describe('quantum-hybrid-rollout', () => {
  const config = loadCanaryConfig(path.join(__dirname, '..', '..', 'config', 'quantum-hybrid-canary.json'));

  afterEach(() => {
    delete process.env.CLUSTER_QUANTUM_HYBRID_PERCENT;
    delete process.env.CLUSTER_QUANTUM_HYBRID_NODE_LIST;
    delete process.env.CLUSTER_QUANTUM_HYBRID_DEFAULT;
  });

  test('L2-01: enrollmentScore is deterministic for the same NODE_ID', () => {
    const score1 = enrollmentScore('node-canary-01', config.canary_parameters.salt);
    const score2 = enrollmentScore('node-canary-01', config.canary_parameters.salt);
    expect(score1).toBe(score2);
    expect(score1).toBeGreaterThanOrEqual(0);
    expect(score1).toBeLessThan(100);
  });

  test('L2-01: enrollmentScore differs for different NODE_IDs', () => {
    const s1 = enrollmentScore('node-canary-01', config.canary_parameters.salt);
    const s2 = enrollmentScore('node-canary-02', config.canary_parameters.salt);
    expect(s1).not.toBe(s2);
  });

  test('L2-02: allowlist overrides percentage', () => {
    const cfg = JSON.parse(JSON.stringify(config));
    cfg.canary_parameters.default_enabled = true;
    cfg.canary_parameters.stages = [0];
    cfg.canary_parameters.node_allowlist = ['always-on-node'];
    expect(shouldEnableHybrid('always-on-node', cfg)).toBe(true);
    expect(shouldEnableHybrid('other-node', cfg)).toBe(false);
  });

  test('L2-03: JSON config loads with expected threshold shape', () => {
    expect(config.canary_parameters.salt).toBeDefined();
    expect(Array.isArray(config.canary_parameters.stages)).toBe(true);
    expect(config.canary_parameters.stage_duration_min).toBeGreaterThan(0);
    expect(config.rollback_thresholds.connection_drop_rate_spike_pct).toBeGreaterThan(0);
    expect(config.rollback_thresholds.handshake_failure_rate_pct).toBeGreaterThan(0);
  });

  test('L2-04: connection drop spike triggers rollback', () => {
    const metrics = {
      connectionDropRatePct: 8.0,
      baselineConnectionDropRatePct: 1.5,
    };
    const result = checkRollback(metrics, config);
    expect(result.shouldRollback).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toMatch(/connection_drop_spike/);
  });

  test('L2-05: 12% handshake failure rate triggers rollback', () => {
    const metrics = {
      handshakeFailureRatePct: 12.0,
    };
    const result = checkRollback(metrics, config);
    expect(result.shouldRollback).toBe(true);
    expect(result.reasons[0]).toMatch(/handshake_failure_rate/);
  });

  test('L2-06: rollback can be recorded with quantum_hybrid_rollback event', () => {
    const { shouldRollback, reasons } = checkRollback({ handshakeFailureRatePct: 15.0 }, config);
    expect(shouldRollback).toBe(true);
    expect(reasons.length).toBeGreaterThan(0);
  });

  test('L3-01: deprecation window active within 14 days', () => {
    const start = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(resolveDeprecationState(start, 14)).toBe(true);
  });

  test('L3-02: deprecation window expired after 15 days', () => {
    const start = Date.now() - 15 * 24 * 60 * 60 * 1000;
    expect(resolveDeprecationState(start, 14)).toBe(false);
  });

  test('L3-03: zero percent disables canary for non-allowlisted nodes', () => {
    const cfg = JSON.parse(JSON.stringify(config));
    cfg.canary_parameters.default_enabled = true;
    cfg.canary_parameters.stages = [0];
    cfg.canary_parameters.node_allowlist = [];
    expect(shouldEnableHybrid('any-node', cfg)).toBe(false);
  });

  test('S-02: single noisy node above 50% triggers rollback', () => {
    const metrics = {
      perNodeHandshakeFailurePct: {
        'noisy-node-A': 75.0,
        'stable-node-B': 2.0,
      },
    };
    const result = checkRollback(metrics, config);
    expect(result.shouldRollback).toBe(true);
    expect(result.reasons[0]).toMatch(/single_node_failure/);
  });
});
