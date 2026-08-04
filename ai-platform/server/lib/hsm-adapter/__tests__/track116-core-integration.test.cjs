'use strict';

/**
 * Track 116 Core Integration — Policy enforcement + telemetry counter wiring
 *
 * Verifies that cluster-keyring-sync.cjs correctly:
 * - Increments hsm_isolation_violation_total on unknown peer rejection
 * - Increments hsm_key_reject_total on non-leader KEY_COMMIT rejection
 * - Increments hsm_isolation_violation_total on DKG unknown peer rejection
 * - Policy-gates DKG non-leader rejection via allowDkgNonLeaderMessages
 * - Returns strict defaults from _getIsolationPolicy()
 * - Counter increments are independent (no cross-contamination)
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Set up env before requiring the module
process.env.NODE_ID = 'node-1';
process.env.CLUSTER_NODES = '127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002';
process.env.KEY_ROTATION_STORE_PATH = path.join(require('os').tmpdir(), 'sb-track116-core-key.json');
process.env.AUDIT_LOG_PATH = path.join(require('os').tmpdir(), 'sb-track116-core-audit.json');
process.env.AUDIT_LOG_SCRUB_PII = 'false';
fs.writeFileSync(process.env.AUDIT_LOG_PATH, JSON.stringify({ entries: {} }), 'utf8');

const clusterSync = require('../../../lib/cluster-keyring-sync.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');
const { counters } = hsmMetrics;

function createMockSocket(remoteAddress, remotePort) {
  const handlers = {};
  return {
    remoteAddress,
    remotePort,
    destroyed: false,
    write: jest.fn(),
    on: jest.fn((event, handler) => { handlers[event] = handler; }),
    destroy: jest.fn(function() { this.destroyed = true; }),
    _handlers: handlers,
  };
}

/**
 * Establish leader by sending heartbeats from 2 known peers (majority of 3),
 * then calling isLeader() to trigger _electLeader().
 */
function establishLeader() {
  // Send HEARTBEAT from peer 1 (127.0.0.1:7001)
  const s1 = createMockSocket('127.0.0.1', 7001);
  clusterSync._handleMessage({
    type: 'HEARTBEAT', from: 'node-2', leaderId: 'node-1', epoch: 1,
    activeFingerprint: 'abc', previousFingerprint: null, rotatedAt: null,
  }, s1);

  // Send HEARTBEAT from peer 2 (127.0.0.1:7002)
  const s2 = createMockSocket('127.0.0.1', 7002);
  clusterSync._handleMessage({
    type: 'HEARTBEAT', from: 'node-3', leaderId: 'node-1', epoch: 1,
    activeFingerprint: 'def', previousFingerprint: null, rotatedAt: null,
  }, s2);

  // Trigger leader election
  clusterSync.isLeader();
  return clusterSync.getStatus();
}

describe('Track 116 core integration', () => {
  beforeEach(() => {
    clusterSync._resetEvents();
    clusterSync._resetDkgSession();
    clusterSync._resetEpochState();
    clusterSync._resetEpoch();
    // Reset _state.leaderId manually since _resetEpoch doesn't clear it
    // We do this by establishing leader in each test that needs it
    hsmMetrics.reset();
  });

  test('CORE-116-01: unknown peer triggers ISOLATION_VIOLATION and increments hsm_isolation_violation_total', () => {
    const before = counters.hsm_isolation_violation_total;
    const socket = createMockSocket('192.168.99.99', 9999);
    let thrown = null;
    try {
      clusterSync._handleMessage({
        type: 'HEARTBEAT', from: 'rogue', leaderId: 'rogue', epoch: 0,
        activeFingerprint: 'xyz', previousFingerprint: null, rotatedAt: null,
      }, socket);
    } catch (e) { thrown = e; }

    const events = clusterSync.queryEvents({ eventType: clusterSync.EVENT_TYPES.ISOLATION_VIOLATION });
    expect(events.events.length).toBe(1);
    expect(events.events[0].details.reason).toBe('unknown_cluster_peer');
    const after = counters.hsm_isolation_violation_total;
    // Diagnostic: check if incrementCounter and counters share the same module
    const hsmMetrics2 = require('../hsm-metrics.cjs');
    const sameRef = hsmMetrics2.counters === counters;
    // Try calling incrementCounter directly
    const beforeDirect = counters.hsm_isolation_violation_total;
    hsmMetrics2.incrementCounter('hsm_isolation_violation_total');
    const afterDirect = counters.hsm_isolation_violation_total;
    process.stderr.write('DIAG: sameRef=' + sameRef + ' before=' + before + ' after=' + after + ' hsmMetrics2.counters.iso=' + hsmMetrics2.counters.hsm_isolation_violation_total + ' directBefore=' + beforeDirect + ' directAfter=' + afterDirect + ' thrown=' + (thrown ? thrown.message : 'null') + '\n');
    expect(after).toBe(before + 1);
  });

  test('CORE-116-02: non-leader KEY_COMMIT triggers KEY_REJECT and increments hsm_key_reject_total', () => {
    const status = establishLeader();
    expect(status.leaderId).toBeTruthy();
    const leaderId = status.leaderId;
    const nonLeader = leaderId === 'node-1' ? 'node-2' : 'node-1';

    clusterSync._resetEvents();
    const before = counters.hsm_key_reject_total;

    // Send KEY_COMMIT from non-leader via known peer
    const validHex = 'a'.repeat(64);
    const s = createMockSocket('127.0.0.1', 7001);
    clusterSync._handleMessage({
      type: 'KEY_COMMIT', from: nonLeader, leaderId: leaderId, epoch: status.epoch,
      activeHex: validHex, previousHex: null,
      activeFingerprint: 'def', previousFingerprint: null,
      rotatedAt: Date.now(), graceMs: null,
    }, s);

    const rejectEvents = clusterSync.queryEvents({ eventType: clusterSync.EVENT_TYPES.KEY_REJECT });
    expect(rejectEvents.events.length).toBe(1);
    expect(rejectEvents.events[0].details.reason).toBe('not_leader');
    const after = counters.hsm_key_reject_total;
    expect(after).toBe(before + 1);
  });

  test('CORE-116-03: DKG unknown peer triggers ISOLATION_VIOLATION and increments hsm_isolation_violation_total', () => {
    const before = counters.hsm_isolation_violation_total;
    const socket = createMockSocket('192.168.99.99', 9999);
    clusterSync._handleDkgMessage({
      type: 'DKG_COMMIT', from: 'rogue', sessionId: 'test-session',
      commitHash: 'abc123',
    }, socket);

    const events = clusterSync.queryEvents({ eventType: clusterSync.EVENT_TYPES.ISOLATION_VIOLATION });
    expect(events.events.length).toBe(1);
    expect(events.events[0].details.reason).toBe('unknown_cluster_peer');
    const after = counters.hsm_isolation_violation_total;
    expect(after).toBe(before + 1);
  });

  test('CORE-116-04: DKG non-leader rejected when allowDkgNonLeaderMessages is false (default)', () => {
    const status = establishLeader();
    expect(status.leaderId).toBeTruthy();
    const leaderId = status.leaderId;
    const nonLeader = leaderId === 'node-1' ? 'node-2' : 'node-1';

    clusterSync._resetEvents();
    const before = counters.hsm_key_reject_total;

    // Send DKG_FINALIZE from non-leader via known peer
    const s = createMockSocket('127.0.0.1', 7001);
    clusterSync._handleDkgMessage({
      type: 'DKG_FINALIZE', from: nonLeader, sessionId: 'test-session',
      masterPublicKey: 'a'.repeat(64),
    }, s);

    const dkgEvents = clusterSync.queryEvents({ eventType: clusterSync.EVENT_TYPES.DKG_INVALID_MESSAGE });
    const notLeaderEvents = dkgEvents.events.filter(e => e.details.reason === 'not_leader');
    expect(notLeaderEvents.length).toBe(1);
    const after = counters.hsm_key_reject_total;
    expect(after).toBe(before + 1);
  });

  test('CORE-116-05: _getIsolationPolicy returns strict defaults', () => {
    const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
    const engine = new CryptoPolicyEngine({});
    const policy = engine.getPolicy().clusterIsolationHardening;
    expect(policy).toBeDefined();
    expect(policy.requireKnownPeerValidation).toBe(true);
    expect(policy.rejectNonLeaderKeyCommits).toBe(true);
    expect(policy.allowDkgNonLeaderMessages).toBe(false);
    expect(policy.maxIsolationViolationThreshold).toBe(100);
  });

  test('CORE-116-06: counter increments are independent (no cross-contamination)', () => {
    const beforeIso = counters.hsm_isolation_violation_total;
    const beforeKey = counters.hsm_key_reject_total;

    // Trigger 1 isolation violation (unknown peer)
    const s1 = createMockSocket('192.168.99.99', 8888);
    clusterSync._handleMessage({
      type: 'HEARTBEAT', from: 'rogue', leaderId: 'rogue', epoch: 0,
      activeFingerprint: 'xyz', previousFingerprint: null, rotatedAt: null,
    }, s1);

    // Trigger 1 key reject (non-leader KEY_COMMIT)
    const status = establishLeader();
    const leaderId = status.leaderId;
    const nonLeader = leaderId === 'node-1' ? 'node-2' : 'node-1';

    clusterSync._resetEvents();
    const validHex = 'b'.repeat(64);
    const s3 = createMockSocket('127.0.0.1', 7001);
    clusterSync._handleMessage({
      type: 'KEY_COMMIT', from: nonLeader, leaderId: leaderId, epoch: status.epoch,
      activeHex: validHex, previousHex: null,
      activeFingerprint: 'def', previousFingerprint: null,
      rotatedAt: Date.now(), graceMs: null,
    }, s3);

    const afterIso = counters.hsm_isolation_violation_total;
    const afterKey = counters.hsm_key_reject_total;

    expect(afterIso).toBe(beforeIso + 1);
    expect(afterKey).toBe(beforeKey + 1);
  });
});
