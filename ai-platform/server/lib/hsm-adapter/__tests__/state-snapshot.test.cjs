'use strict';

/**
 * State Snapshot Checkpoint Utility — Test Suite
 *
 * Tests createStateSnapshot, restoreStateSnapshot, getSnapshotHistory,
 * clearSnapshotHistory, and the EPOCH_DRIFT/EPOCH_RECONCILED auto-trigger wiring.
 */

const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Set up env before requiring the module
process.env.NODE_ID = 'node-1';
process.env.CLUSTER_NODES = '127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002';
process.env.KEY_ROTATION_STORE_PATH = path.join(os.tmpdir(), 'sb-snapshot-test-key.json');
process.env.AUDIT_LOG_PATH = path.join(os.tmpdir(), 'sb-snapshot-test-audit.json');
process.env.AUDIT_LOG_SCRUB_PII = 'false';
fs.writeFileSync(process.env.AUDIT_LOG_PATH, JSON.stringify({ entries: {} }), 'utf8');

const clusterSync = require('../../../lib/cluster-keyring-sync.cjs');
const keyRotationStore = require('../../../lib/key-rotation-store.cjs');

function createMockSocket(remoteAddress = '127.0.0.1', remotePort = 7001) {
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

describe('State Snapshot Checkpoint Utility', () => {

  beforeEach(() => {
    clusterSync._resetEvents();
    clusterSync._resetDkgSession();
    clusterSync._resetEpochState();
    clusterSync._resetEpoch();
    clusterSync._resetStek();
    keyRotationStore._reset(crypto.randomBytes(32));
  });

  afterEach(() => {
    clusterSync._resetDkgSession();
    clusterSync._resetEpochState();
    clusterSync._resetEvents();
  });

  afterAll(() => {
    clusterSync._resetDkgSession();
    clusterSync._resetEpochState();
    clusterSync._resetEvents();
  });

  // ── L2-01: Snapshot captures full state ───────────────────────────

  describe('L2-01: Snapshot captures full state', () => {
    test('snapshot contains _state, _peerState, _peerEpochs, stek, dkgSession', () => {
      // Set up some state
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        epoch: 5,
        leaderId: 'node-1',
        activeFingerprint: 'abc123',
        previousFingerprint: 'def456',
        rotatedAt: Date.now(),
      }, createMockSocket('127.0.0.1', 7001));

      const snapshot = clusterSync.createStateSnapshot('manual');

      expect(snapshot.snapshotId).toMatch(/^snap-\d+-[0-9a-f]+$/);
      expect(typeof snapshot.timestamp).toBe('number');
      expect(snapshot.reason).toBe('manual');
      expect(snapshot.state).toBeDefined();
      expect(snapshot.state.nodeId).toBe('node-1');
      expect(snapshot.state.epoch).toBe(5);
      expect(snapshot.peerState).toBeDefined();
      expect(typeof snapshot.peerState).toBe('object');
      expect(snapshot.peerEpochs).toBeDefined();
      expect(snapshot.stek).toBeDefined();
      expect(snapshot.stek.stekId).toBeNull(); // no STEK set
      // dkgSession is null when no active session
      expect(snapshot.dkgSession).toBeNull();
    });
  });

  // ── L2-02: Restore recovers state ─────────────────────────────────

  describe('L2-02: Restore recovers state', () => {
    test('state matches original after restore', () => {
      // Set up initial state — use epoch 3 (within reconcile threshold of 5)
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        epoch: 3,
        leaderId: 'node-1',
        activeFingerprint: 'aaa111',
        previousFingerprint: 'bbb222',
        rotatedAt: 1000000,
      }, createMockSocket('127.0.0.1', 7001));

      const snapshot = clusterSync.createStateSnapshot('manual');

      // Mutate state
      clusterSync._resetEpoch();
      clusterSync._resetEpochState();

      // Verify state was cleared
      const statusBefore = clusterSync.getStatus();
      expect(statusBefore.epoch).toBe(0);

      // Restore
      const result = clusterSync.restoreStateSnapshot(snapshot);
      expect(result.restored).toBe(true);
      expect(result.snapshotId).toBe(snapshot.snapshotId);

      // Verify state was restored
      const statusAfter = clusterSync.getStatus();
      expect(statusAfter.epoch).toBe(3);
    });
  });

  // ── L2-03: Snapshot triggered on EPOCH_DRIFT ──────────────────────

  describe('L2-03: Snapshot triggered on EPOCH_DRIFT', () => {
    test('STATE_SNAPSHOT event recorded with reason epoch_drift', () => {
      // Set local epoch to 1
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        epoch: 1,
        leaderId: 'node-1',
        activeFingerprint: 'abc',
        previousFingerprint: null,
        rotatedAt: Date.now(),
      }, createMockSocket('127.0.0.1', 7001));

      // Trigger unreconcilable jump (epoch 1 -> 100, threshold is 5)
      const socket = createMockSocket('127.0.0.1', 7002);
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-3',
        epoch: 100,
        leaderId: 'node-3',
        activeFingerprint: 'xyz',
        previousFingerprint: null,
        rotatedAt: Date.now(),
      }, socket);

      const snapshotEvents = clusterSync.queryEvents({ eventType: 'state_snapshot' });
      expect(snapshotEvents.events.length).toBeGreaterThanOrEqual(1);
      const driftSnapshot = snapshotEvents.events.find(
        (e) => e.details.reason === 'epoch_drift'
      );
      expect(driftSnapshot).toBeDefined();
    });
  });

  // ── L2-04: Snapshot triggered on EPOCH_RECONCILED ─────────────────

  describe('L2-04: Snapshot triggered on EPOCH_RECONCILED', () => {
    test('STATE_SNAPSHOT event recorded with reason epoch_reconciled', () => {
      // Set local epoch to 1
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        epoch: 1,
        leaderId: 'node-1',
        activeFingerprint: 'abc',
        previousFingerprint: null,
        rotatedAt: Date.now(),
      }, createMockSocket('127.0.0.1', 7001));

      // Trigger reconcilable adoption (epoch 1 -> 3, within threshold of 5)
      const socket = createMockSocket('127.0.0.1', 7002);
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-3',
        epoch: 3,
        leaderId: 'node-1',
        activeFingerprint: 'def',
        previousFingerprint: null,
        rotatedAt: Date.now(),
      }, socket);

      const snapshotEvents = clusterSync.queryEvents({ eventType: 'state_snapshot' });
      const reconciledSnapshot = snapshotEvents.events.find(
        (e) => e.details.reason === 'epoch_reconciled'
      );
      expect(reconciledSnapshot).toBeDefined();
    });
  });

  // ── L2-05: Snapshot history tracks metadata ───────────────────────

  describe('L2-05: Snapshot history tracks metadata', () => {
    test('returns 3 entries with snapshotId, timestamp, reason — no sensitive data', () => {
      clusterSync.createStateSnapshot('manual');
      clusterSync.createStateSnapshot('epoch_drift');
      clusterSync.createStateSnapshot('epoch_reconciled');

      const history = clusterSync.getSnapshotHistory();
      expect(history.length).toBe(3);

      for (const entry of history) {
        expect(typeof entry.snapshotId).toBe('string');
        expect(entry.snapshotId).toMatch(/^snap-/);
        expect(typeof entry.timestamp).toBe('number');
        expect(typeof entry.reason).toBe('string');
        // No sensitive key material in history entries
        expect(entry.state).toBeUndefined();
        expect(entry.peerState).toBeUndefined();
        expect(entry.peerEpochs).toBeUndefined();
        expect(entry.stek).toBeUndefined();
        expect(entry.dkgSession).toBeUndefined();
      }
    });
  });

  // ── L2-06: DKG session included in snapshot ───────────────────────

  describe('L2-06: DKG session included in snapshot', () => {
    test('snapshot contains DKG phase, sessionId, nodeId, finalized flag', () => {
      const dkgEngine = {
        generateContribution: () => ({ commitments: [BigInt(1), BigInt(2)], shares: new Map() }),
        verifyShare: () => true,
        fileComplaint: () => {},
        captureStateForPersistence: () => ({}),
      };
      clusterSync.initDkgSession({ dkgEngine, nodeId: 'node-1' });

      const snapshot = clusterSync.createStateSnapshot('manual');
      expect(snapshot.dkgSession).not.toBeNull();
      expect(snapshot.dkgSession.phase).toBe('commit');
      expect(typeof snapshot.dkgSession.sessionId).toBe('string');
      expect(snapshot.dkgSession.nodeId).toBe('node-1');
      expect(snapshot.dkgSession.finalized).toBe(false);
      expect(typeof snapshot.dkgSession.contributionCount).toBe('number');
    });
  });

  // ── L2-07: STEK state included in snapshot ────────────────────────

  describe('L2-07: STEK state included in snapshot', () => {
    test('snapshot contains stekId and retiredCount (not raw STEK bytes)', () => {
      // Rotate STEK to set it
      clusterSync.rotateStek();

      const snapshot = clusterSync.createStateSnapshot('manual');
      expect(snapshot.stek).toBeDefined();
      expect(typeof snapshot.stek.stekId).toBe('string');
      expect(snapshot.stek.stekId).toMatch(/^[0-9a-f]+$/);
      expect(typeof snapshot.stek.retiredCount).toBe('number');
      // No raw STEK bytes
      expect(snapshot.stek.stek).toBeUndefined();
    });
  });

  // ── L3-01: Snapshot with no active DKG session ────────────────────

  describe('L3-01: Snapshot with no active DKG session', () => {
    test('dkgSession field is null', () => {
      const snapshot = clusterSync.createStateSnapshot('manual');
      expect(snapshot.dkgSession).toBeNull();
    });
  });

  // ── L3-02: Snapshot with no STEK ──────────────────────────────────

  describe('L3-02: Snapshot with no STEK', () => {
    test('stek field shows stekId null', () => {
      const snapshot = clusterSync.createStateSnapshot('manual');
      expect(snapshot.stek.stekId).toBeNull();
      expect(snapshot.stek.retiredCount).toBe(0);
    });
  });

  // ── L3-03: Restore with corrupted snapshot ────────────────────────

  describe('L3-03: Restore with corrupted snapshot (missing fields)', () => {
    test('throws error, does not partially mutate state', () => {
      const initialState = clusterSync.getStatus();

      // Corrupted snapshot — missing peerState and peerEpochs
      const corrupted = {
        snapshotId: 'snap-1234-abcdef',
        timestamp: Date.now(),
        reason: 'manual',
        state: { nodeId: 'node-1', epoch: 99 },
        // peerState missing
        // peerEpochs missing
        stek: { stekId: null, retiredCount: 0 },
        dkgSession: null,
      };

      expect(() => clusterSync.restoreStateSnapshot(corrupted)).toThrow('STATE_SNAPSHOT_INVALID');

      // State should not have been mutated
      const stateAfter = clusterSync.getStatus();
      expect(stateAfter.epoch).toBe(initialState.epoch);
    });
  });

  // ── L3-04: Restore with wrong snapshotId format ───────────────────

  describe('L3-04: Restore with wrong snapshotId format', () => {
    test('throws validation error', () => {
      const badSnapshot = {
        snapshotId: 'bad-id',
        timestamp: Date.now(),
        reason: 'manual',
        state: { nodeId: 'node-1', epoch: 1 },
        peerState: {},
        peerEpochs: {},
        stek: { stekId: null, retiredCount: 0 },
        dkgSession: null,
      };

      expect(() => clusterSync.restoreStateSnapshot(badSnapshot)).toThrow('STATE_SNAPSHOT_INVALID');
    });
  });

  // ── L3-05: Snapshot excludes raw key material ─────────────────────

  describe('L3-05: Snapshot excludes raw key material', () => {
    test('snapshot does not contain _keyRing.active or _keyRing.previous Buffer values', () => {
      const snapshot = clusterSync.createStateSnapshot('manual');
      const snapshotJson = JSON.stringify(snapshot);
      // No Buffer-like data in the snapshot
      expect(snapshotJson).not.toMatch(/"type":"Buffer"/);
      // state only has fingerprints, not raw keys
      expect(snapshot.state.activeFingerprint).toBeDefined();
      // No 'active' or 'previous' raw key fields
      expect(snapshot.state.active).toBeUndefined();
      expect(snapshot.state.previous).toBeUndefined();
    });
  });

  // ── L3-06: Snapshot history capped at MAX_SNAPSHOTS=5 ─────────────

  describe('L3-06: Snapshot history capped at MAX_SNAPSHOTS', () => {
    test('creating 15 snapshots results in 5 in history', () => {
      for (let i = 0; i < 15; i++) {
        clusterSync.createStateSnapshot('manual-' + i);
      }
      const history = clusterSync.getSnapshotHistory();
      expect(history.length).toBe(5);
      // Should be the last 5 (ring buffer)
      expect(history[0].reason).toBe('manual-10');
      expect(history[4].reason).toBe('manual-14');
    });
  });

  // ── L3-07: Clear snapshot history ─────────────────────────────────

  describe('L3-07: Clear snapshot history', () => {
    test('getSnapshotHistory returns empty after clearSnapshotHistory', () => {
      clusterSync.createStateSnapshot('manual');
      clusterSync.createStateSnapshot('manual');
      expect(clusterSync.getSnapshotHistory().length).toBe(2);

      clusterSync.clearSnapshotHistory();
      expect(clusterSync.getSnapshotHistory().length).toBe(0);
    });
  });

  // ── L3-08: Existing cluster sync behavior unaffected ──────────────

  describe('L3-08: Existing cluster sync behavior unaffected', () => {
    test('HEARTBEAT processing still works normally', () => {
      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        epoch: 1,
        leaderId: 'node-1',
        activeFingerprint: 'abc',
        previousFingerprint: null,
        rotatedAt: Date.now(),
      }, socket);

      const status = clusterSync.getStatus();
      expect(status.nodeId).toBe('node-1');
      expect(status.epoch).toBe(1);
    });
  });

  // ── S-01: No raw key material in snapshots ────────────────────────

  describe('S-01: No raw key material in snapshots (only fingerprints)', () => {
    test('snapshot state contains fingerprints, not raw keys', () => {
      const snapshot = clusterSync.createStateSnapshot('manual');
      expect(snapshot.state.activeFingerprint).toBeDefined();
      expect(snapshot.state.previousFingerprint).toBeDefined();
      expect(snapshot.state.active).toBeUndefined();
      expect(snapshot.state.previous).toBeUndefined();
    });
  });

  // ── S-02: No raw STEK bytes in snapshots ──────────────────────────

  describe('S-02: No raw STEK bytes in snapshots (only stekId)', () => {
    test('snapshot stek contains stekId, not raw STEK', () => {
      clusterSync.rotateStek();
      const snapshot = clusterSync.createStateSnapshot('manual');
      expect(snapshot.stek.stekId).toBeDefined();
      expect(snapshot.stek.stek).toBeUndefined();
      expect(snapshot.stek.rawStek).toBeUndefined();
    });
  });

  // ── S-03: No DKG private shares in snapshots ──────────────────────

  describe('S-03: No DKG private shares in snapshots (only public commitments)', () => {
    test('snapshot dkgSession contains counts, not share data', () => {
      const dkgEngine = {
        generateContribution: () => ({ commitments: [BigInt(1), BigInt(2)], shares: new Map() }),
        verifyShare: () => true,
        fileComplaint: () => {},
        captureStateForPersistence: () => ({}),
      };
      clusterSync.initDkgSession({ dkgEngine, nodeId: 'node-1' });

      const snapshot = clusterSync.createStateSnapshot('manual');
      expect(snapshot.dkgSession.contributionCount).toBeDefined();
      expect(snapshot.dkgSession.sharesReceivedCount).toBeDefined();
      // No actual share data
      expect(snapshot.dkgSession.contributions).toBeUndefined();
      expect(snapshot.dkgSession.sharesReceived).toBeUndefined();
    });
  });

  // ── S-04: Snapshot restore validates schema before applying ───────

  describe('S-04: Snapshot restore validates schema before applying', () => {
    test('null snapshot throws validation error', () => {
      expect(() => clusterSync.restoreStateSnapshot(null)).toThrow('STATE_SNAPSHOT_INVALID');
    });

    test('non-object snapshot throws validation error', () => {
      expect(() => clusterSync.restoreStateSnapshot('not-an-object')).toThrow('STATE_SNAPSHOT_INVALID');
    });

    test('snapshot with invalid timestamp throws validation error', () => {
      const badSnapshot = {
        snapshotId: 'snap-1234-abcdef',
        timestamp: -1,
        reason: 'manual',
        state: { nodeId: 'node-1', epoch: 1 },
        peerState: {},
        peerEpochs: {},
        stek: { stekId: null, retiredCount: 0 },
        dkgSession: null,
      };
      expect(() => clusterSync.restoreStateSnapshot(badSnapshot)).toThrow('STATE_SNAPSHOT_INVALID');
    });
  });

  // ── S-05: Snapshot events recorded in event timeline for audit ────

  describe('S-05: Snapshot events recorded in event timeline for audit', () => {
    test('STATE_SNAPSHOT event is queryable', () => {
      clusterSync.createStateSnapshot('manual');
      const events = clusterSync.queryEvents({ eventType: 'state_snapshot' });
      expect(events.events.length).toBe(1);
      expect(events.events[0].details.snapshotId).toMatch(/^snap-/);
      expect(events.events[0].details.reason).toBe('manual');
    });

    test('STATE_RESTORED event is queryable after restore', () => {
      const snapshot = clusterSync.createStateSnapshot('manual');
      clusterSync.restoreStateSnapshot(snapshot);
      const events = clusterSync.queryEvents({ eventType: 'state_restored' });
      expect(events.events.length).toBe(1);
      expect(events.events[0].details.snapshotId).toBe(snapshot.snapshotId);
    });
  });

  // ── Failed restore triggers CRITICAL SIEM ─────────────────────────

  describe('Failed restore triggers CRITICAL SIEM escalation', () => {
    test('SIEM hook fires with critical severity on validation failure', () => {
      const siemCalls = [];
      clusterSync.registerSiemHook((eventType, details) => {
        siemCalls.push({ eventType, details });
      });

      const corrupted = {
        snapshotId: 'snap-1234-abcdef',
        timestamp: Date.now(),
        reason: 'manual',
        state: { nodeId: 'node-1', epoch: 1 },
        // peerState missing — will fail validation
      };

      expect(() => clusterSync.restoreStateSnapshot(corrupted)).toThrow();

      // SIEM hook should have been called with critical severity
      const criticalCall = siemCalls.find(
        (c) => c.details.siemSeverity === 'critical'
      );
      expect(criticalCall).toBeDefined();
      expect(criticalCall.details.siemCategory).toBe('state_corruption');
    });
  });
});
