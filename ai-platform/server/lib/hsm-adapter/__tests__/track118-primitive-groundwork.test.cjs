'use strict';

/**
 * Track 118 Primitive Groundwork — Distributed Consensus Coordinator
 *
 * Verifies that the _validateDistributedConsensusCoordinator method:
 * - Rejects numeric bound violations with POLICY_VIOLATION_BLOCKED
 * - Enforces boolean locks (quorum, dynamic group, cross-group routing)
 * - Merges partial tenant declarations with defaults cleanly
 * - Confirms all 10 telemetry counters are registered
 * - Accepts empty config against strict production defaults
 */

const { CryptoPolicyEngine, DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const fs = require('fs');
const path = require('path');

const METRICS_CJS = path.join(__dirname, '..', 'hsm-metrics.cjs');

describe('Track 118 primitive groundwork — distributedConsensusCoordinator', () => {
  test('GROUND-118-01: numeric bound violations throw POLICY_VIOLATION_BLOCKED', () => {
    const engine = new CryptoPolicyEngine({ default: {} });

    function expectViolation(config) {
      try {
        engine.validate('t1', 'distributedConsensusCoordinator', config);
        throw new Error('expected validation to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe('POLICY_VIOLATION_BLOCKED');
      }
    }

    // maxGroups above maximum (default 64)
    expectViolation({ maxGroups: 999 });

    // faultTimeoutMs below minimum (default 3000)
    expectViolation({ faultTimeoutMs: 100 });

    // faultCheckIntervalMs above maximum (default 1000)
    expectViolation({ faultCheckIntervalMs: 9999 });

    // viewChangeTimeoutMs below minimum (default 5000)
    expectViolation({ viewChangeTimeoutMs: 100 });
  });

  test('GROUND-118-02: boolean enforcement locks prevent disabling/re-enabling', () => {
    function expectViolation(engine, config) {
      try {
        engine.validate('t1', 'distributedConsensusCoordinator', config);
        throw new Error('expected validation to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(HsmAdapterError);
        expect(e.code).toBe('POLICY_VIOLATION_BLOCKED');
      }
    }

    // requireQuorumForProposals cannot be disabled when policy enforces it (default true)
    const engine = new CryptoPolicyEngine({ default: {} });
    expectViolation(engine, { requireQuorumForProposals: false });

    // allowDynamicGroupCreation cannot be enabled when policy restricts it
    const restrictiveEngine = new CryptoPolicyEngine({
      default: {},
      tenants: { t1: { distributedConsensusCoordinator: { allowDynamicGroupCreation: false } } },
    });
    expectViolation(restrictiveEngine, { allowDynamicGroupCreation: true });

    // allowCrossGroupRouting cannot be enabled when policy restricts it
    const restrictiveEngine2 = new CryptoPolicyEngine({
      default: {},
      tenants: { t1: { distributedConsensusCoordinator: { allowCrossGroupRouting: false } } },
    });
    expectViolation(restrictiveEngine2, { allowCrossGroupRouting: true });
  });

  test('GROUND-118-03: partial tenant merge preserves defaults', () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: { t1: { distributedConsensusCoordinator: { maxGroups: 32 } } },
    });
    const resolved = engine.getPolicy('t1');
    expect(resolved.distributedConsensusCoordinator.maxGroups).toBe(32);
    expect(resolved.distributedConsensusCoordinator.faultTimeoutMs).toBe(3000);
    expect(resolved.distributedConsensusCoordinator.faultCheckIntervalMs).toBe(1000);
    expect(resolved.distributedConsensusCoordinator.viewChangeTimeoutMs).toBe(5000);
    expect(resolved.distributedConsensusCoordinator.requireQuorumForProposals).toBe(true);
    expect(resolved.distributedConsensusCoordinator.allowDynamicGroupCreation).toBe(true);
    expect(resolved.distributedConsensusCoordinator.allowCrossGroupRouting).toBe(true);
  });

  test('GROUND-118-04: all 10 telemetry counters registered in hsm-metrics.cjs', () => {
    const metricsContent = fs.readFileSync(METRICS_CJS, 'utf8');
    const requiredCounters = [
      'hsm_consensus_coord_groups_created_total',
      'hsm_consensus_coord_groups_destroyed_total',
      'hsm_consensus_coord_proposals_routed_total',
      'hsm_consensus_coord_proposals_rejected_total',
      'hsm_consensus_coord_faults_detected_total',
      'hsm_consensus_coord_view_change_started_total',
      'hsm_consensus_coord_view_change_completed_total',
      'hsm_consensus_coord_view_change_aborted_total',
      'hsm_consensus_coord_quorum_verified_total',
      'hsm_consensus_coord_quorum_denied_total',
    ];
    for (const counter of requiredCounters) {
      expect(metricsContent).toContain(counter);
    }
  });

  test('GROUND-118-05: empty config defaults to strict production hardening bounds', () => {
    const defaults = DEFAULT_POLICY.distributedConsensusCoordinator;
    expect(defaults).toBeDefined();
    expect(defaults.maxGroups).toBe(64);
    expect(defaults.faultTimeoutMs).toBe(3000);
    expect(defaults.faultCheckIntervalMs).toBe(1000);
    expect(defaults.viewChangeTimeoutMs).toBe(5000);
    expect(defaults.requireQuorumForProposals).toBe(true);
    expect(defaults.allowDynamicGroupCreation).toBe(true);
    expect(defaults.allowCrossGroupRouting).toBe(true);

    // Verify validate() with empty config passes (uses defaults)
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(engine.validate('t1', 'distributedConsensusCoordinator', {})).toBe(true);

    // Verify validate() with valid config within bounds passes
    expect(engine.validate('t1', 'distributedConsensusCoordinator', {
      maxGroups: 32,
      faultTimeoutMs: 5000,
      faultCheckIntervalMs: 500,
      viewChangeTimeoutMs: 10000,
      requireQuorumForProposals: true,
      allowDynamicGroupCreation: true,
      allowCrossGroupRouting: true,
    })).toBe(true);
  });
});
