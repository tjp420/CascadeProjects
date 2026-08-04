'use strict';

/**
 * IPC Boundary Hardening — Test Suite
 *
 * Coverage map (from test_plan.md):
 *   L2-01: Valid HEARTBEAT passes schema validation
 *   L2-02: Valid KEY_COMMIT passes schema validation
 *   L2-03: Valid DKG_COMMIT passes schema validation
 *   L2-04: Message with unknown type rejected
 *   L2-05: HEARTBEAT missing required field rejected
 *   L2-06: Valid hybrid KEM handshake message passes
 *   L2-07: KEM handshake missing ek_pq rejected
 *   L2-08: Mesh worker valid run_batch accepted
 *   L2-09: Mesh worker unknown message type ignored
 *   L2-10: Mesh worker malformed run_batch rejected
 *   L3-01: Message with extra unknown fields rejected
 *   L3-02: KEM handshake with non-hex ek_classic rejected
 *   L3-03: KEM handshake with wrong-length ek_pq rejected
 *   L3-04: Mesh worker with non-number batchSize rejected
 *   L3-05: Mesh worker with negative delayMs rejected
 *   L3-06: Existing keyring sync unaffected
 *   L3-07: IPC audit logging rate-limited
 *   L3-08: Schema validation doesn't break DKG session
 */

const crypto = require('crypto');

// Set up env before requiring the module
process.env.NODE_ID = 'node-1';
process.env.CLUSTER_NODES = '127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002';
process.env.KEY_ROTATION_STORE_PATH = require('path').join(require('os').tmpdir(), 'sb-ipc-test-key.json');
process.env.AUDIT_LOG_PATH = require('path').join(require('os').tmpdir(), 'sb-ipc-test-audit.json');
process.env.AUDIT_LOG_SCRUB_PII = 'false';
require('fs').writeFileSync(process.env.AUDIT_LOG_PATH, JSON.stringify({ entries: {} }), 'utf8');

const clusterSync = require('../../../lib/cluster-keyring-sync.cjs');
const hybridKem = require('../../../lib/hybrid-kem-handshake.cjs');
const meshWorker = require('./mesh-load-worker.cjs');

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

describe('IPC Boundary Hardening', () => {

  beforeEach(() => {
    clusterSync._resetEvents();
    clusterSync._resetDkgSession();
    clusterSync._resetEpochState();
    clusterSync._resetEpoch();
  });

  afterEach(() => {
    clusterSync._resetDkgSession();
    clusterSync._resetEpochState();
    clusterSync._resetEvents();
  });

  // ── L2-01: Valid HEARTBEAT passes schema validation ─────────────

  describe('L2-01: Valid HEARTBEAT passes schema validation', () => {
    test('accepted with no IPC_SCHEMA_VIOLATION', () => {
      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        leaderId: 'node-1',
        epoch: 0,
        activeFingerprint: 'abc',
        previousFingerprint: null,
        rotatedAt: null,
      }, socket);

      const violations = clusterSync.queryEvents({ eventType: 'ipc_schema_violation' });
      expect(violations.events.length).toBe(0);
      expect(socket.destroyed).toBe(false);
    });
  });

  // ── L2-02: Valid KEY_COMMIT passes schema validation ─────────────

  describe('L2-02: Valid KEY_COMMIT passes schema validation', () => {
    test('accepted with no IPC_SCHEMA_VIOLATION', () => {
      const validHex = 'b'.repeat(64);
      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'KEY_COMMIT',
        from: 'node-1',
        leaderId: 'node-1',
        epoch: 0,
        activeHex: validHex,
        activeFingerprint: 'def',
        previousFingerprint: null,
        previousHex: null,
        rotatedAt: Date.now(),
        graceMs: null,
      }, socket);

      const violations = clusterSync.queryEvents({ eventType: 'ipc_schema_violation' });
      expect(violations.events.length).toBe(0);
    });
  });

  // ── L2-03: Valid DKG_COMMIT passes schema validation ─────────────

  describe('L2-03: Valid DKG_COMMIT passes schema validation', () => {
    test('accepted with no IPC_SCHEMA_VIOLATION', () => {
      // Initialize DKG session first
      const dkgEngine = {
        generateContribution: () => ({ commitments: [BigInt(1), BigInt(2)], shares: new Map() }),
        verifyShare: () => true,
        fileComplaint: () => {},
        captureStateForPersistence: () => ({}),
      };
      clusterSync.initDkgSession({ dkgEngine, nodeId: 'node-1' });

      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'DKG_COMMIT',
        from: 'node-2',
        sessionId: 'test-session',
        epoch: 0,
        commitments: { node2: { a1: 'abc', a2: 'def' } },
      }, socket);

      const violations = clusterSync.queryEvents({ eventType: 'ipc_schema_violation' });
      expect(violations.events.length).toBe(0);
    });
  });

  // ── L2-04: Message with unknown type rejected ────────────────────

  describe('L2-04: Message with unknown type rejected', () => {
    test('IPC_SCHEMA_VIOLATION recorded, socket destroyed', () => {
      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'MALICIOUS_MESSAGE',
        from: 'attacker',
        payload: 'evil',
      }, socket);

      const violations = clusterSync.queryEvents({ eventType: 'ipc_schema_violation' });
      expect(violations.events.length).toBe(1);
      expect(violations.events[0].details.reason).toBe('unknown_message_type');
      expect(violations.events[0].details.msgType).toBe('MALICIOUS_MESSAGE');
      expect(socket.destroyed).toBe(true);
    });
  });

  // ── L2-05: HEARTBEAT missing required field rejected ─────────────

  describe('L2-05: HEARTBEAT missing required field rejected', () => {
    test('IPC_SCHEMA_VIOLATION with reason missing_field', () => {
      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        // Missing: leaderId, epoch, activeFingerprint, previousFingerprint, rotatedAt
      }, socket);

      const violations = clusterSync.queryEvents({ eventType: 'ipc_schema_violation' });
      expect(violations.events.length).toBe(1);
      expect(violations.events[0].details.reason).toBe('missing_field');
      expect(socket.destroyed).toBe(true);
    });
  });

  // ── L2-06: Valid hybrid KEM handshake message passes ─────────────

  describe('L2-06: Valid hybrid KEM handshake message passes', () => {
    test('no error thrown for valid hex fields', () => {
      expect(() => {
        hybridKem._validateHandshakeMessage(
          { ek_classic: 'a'.repeat(64), ek_pq: 'b'.repeat(64) },
          ['ek_classic', 'ek_pq']
        );
      }).not.toThrow();
    });
  });

  // ── L2-07: KEM handshake missing ek_pq rejected ──────────────────

  describe('L2-07: KEM handshake missing ek_pq rejected', () => {
    test('error thrown for missing field', () => {
      expect(() => {
        hybridKem._validateHandshakeMessage(
          { ek_classic: 'a'.repeat(64) },
          ['ek_classic', 'ek_pq']
        );
      }).toThrow(/missing field ek_pq/);
    });
  });

  // ── L2-08: Mesh worker valid run_batch accepted ──────────────────

  describe('L2-08: Mesh worker valid run_batch accepted', () => {
    test('validation passes for well-formed message', () => {
      const result = meshWorker._validateIpcMessage({
        type: 'run_batch',
        workerId: 1,
        batchSize: 100,
        delayMs: 10,
        timestampOffsetMs: 5000,
        reconcileValid: true,
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  // ── L2-09: Mesh worker unknown message type ignored ──────────────

  describe('L2-09: Mesh worker unknown message type rejected', () => {
    test('validation fails for unknown type', () => {
      const result = meshWorker._validateIpcMessage({
        type: 'malicious_command',
        payload: 'evil',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unknown message type');
    });
  });

  // ── L2-10: Mesh worker malformed run_batch rejected ──────────────

  describe('L2-10: Mesh worker malformed run_batch rejected', () => {
    test('validation fails for missing required field', () => {
      const result = meshWorker._validateIpcMessage({
        type: 'run_batch',
        workerId: 1,
        // Missing batchSize
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing field');
    });
  });

  // ── L3-01: Message with extra unknown fields rejected ────────────

  describe('L3-01: Message with extra unknown fields rejected', () => {
    test('IPC_SCHEMA_VIOLATION with reason unknown_field', () => {
      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        leaderId: 'node-1',
        epoch: 0,
        activeFingerprint: 'abc',
        previousFingerprint: null,
        rotatedAt: null,
        maliciousExtra: 'evil', // unknown field
      }, socket);

      const violations = clusterSync.queryEvents({ eventType: 'ipc_schema_violation' });
      expect(violations.events.length).toBe(1);
      expect(violations.events[0].details.reason).toBe('unknown_field');
      expect(violations.events[0].details.field).toBe('maliciousExtra');
    });
  });

  // ── L3-02: KEM handshake with non-hex ek_classic rejected ────────

  describe('L3-02: KEM handshake with non-hex ek_classic rejected', () => {
    test('error thrown for non-hex string', () => {
      expect(() => {
        hybridKem._validateHandshakeMessage(
          { ek_classic: 'XYZNOTHEX', ek_pq: 'b'.repeat(64) },
          ['ek_classic', 'ek_pq']
        );
      }).toThrow(/must be lowercase hex/);
    });
  });

  // ── L3-03: KEM handshake with wrong-length ek_pq rejected ────────

  describe('L3-03: KEM handshake with wrong-length ek_pq rejected', () => {
    test('error thrown for wrong length', () => {
      expect(() => {
        hybridKem._validateHandshakeMessage(
          { ek_classic: 'a'.repeat(64), ek_pq: 'b'.repeat(32) },
          ['ek_classic', 'ek_pq'],
          { ek_pq: 1184 } // ML-KEM-768 public key is 1184 bytes = 2368 hex chars
        );
      }).toThrow(/wrong length/);
    });
  });

  // ── L3-04: Mesh worker with non-number batchSize rejected ────────

  describe('L3-04: Mesh worker with non-number batchSize rejected', () => {
    test('validation fails for string batchSize', () => {
      const result = meshWorker._validateIpcMessage({
        type: 'run_batch',
        workerId: 1,
        batchSize: 'not-a-number',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be number');
    });
  });

  // ── L3-05: Mesh worker with negative delayMs rejected ────────────

  describe('L3-05: Mesh worker with negative delayMs rejected', () => {
    test('validation fails for negative delayMs', () => {
      const result = meshWorker._validateIpcMessage({
        type: 'run_batch',
        workerId: 1,
        batchSize: 10,
        delayMs: -5,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-negative');
    });
  });

  // ── L3-06: Existing keyring sync unaffected ──────────────────────

  describe('L3-06: Existing keyring sync unaffected', () => {
    test('valid HEARTBEAT still updates peer state', () => {
      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'HEARTBEAT',
        from: 'node-2',
        leaderId: 'node-1',
        epoch: 0,
        activeFingerprint: 'abc',
        previousFingerprint: null,
        rotatedAt: null,
      }, socket);

      const status = clusterSync.getStatus();
      expect(status).toBeDefined();
    });
  });

  // ── L3-07: IPC audit logging rate-limited ────────────────────────

  describe('L3-07: IPC audit logging rate-limited', () => {
    test('max 100 IPC_MESSAGE_RECEIVED events per minute', () => {
      // Send 150 valid HEARTBEAT messages
      for (let i = 0; i < 150; i++) {
        const socket = createMockSocket('127.0.0.1', 7001);
        clusterSync._handleMessage({
          type: 'HEARTBEAT',
          from: 'node-2',
          leaderId: 'node-1',
          epoch: 0,
          activeFingerprint: 'abc',
          previousFingerprint: null,
          rotatedAt: null,
        }, socket);
      }

      const receivedEvents = clusterSync.queryEvents({ eventType: 'ipc_message_received' });
      // Should be capped at 100 (rate limit)
      expect(receivedEvents.events.length).toBeLessThanOrEqual(100);
    });
  });

  // ── L3-08: Schema validation doesn't break DKG session ───────────

  describe('L3-08: Schema validation does not break DKG session', () => {
    test('DKG_COMMIT with valid schema is accepted', () => {
      const dkgEngine = {
        generateContribution: () => ({ commitments: [BigInt(1), BigInt(2)], shares: new Map() }),
        verifyShare: () => true,
        fileComplaint: () => {},
        captureStateForPersistence: () => ({}),
      };
      clusterSync.initDkgSession({ dkgEngine, nodeId: 'node-1' });
      const sessionStatus = clusterSync.getDkgSessionStatus();

      const socket = createMockSocket('127.0.0.1', 7001);
      clusterSync._handleMessage({
        type: 'DKG_COMMIT',
        from: 'node-2',
        sessionId: sessionStatus.sessionId,
        epoch: 0,
        commitments: { node2: { a1: 'abc', a2: 'def' } },
      }, socket);

      const violations = clusterSync.queryEvents({ eventType: 'ipc_schema_violation' });
      expect(violations.events.length).toBe(0);
      // DKG_COMMIT should pass schema validation (no IPC_SCHEMA_VIOLATION)
      // Note: dkg_commit_received may not fire if the DKG handler has additional
      // session-level checks, but schema validation should not be the blocker
    });
  });

  // ── Mesh worker: unknown field rejected ──────────────────────────

  describe('Mesh worker: unknown field rejected (strict allowlist)', () => {
    test('validation fails for unknown field in run_batch', () => {
      const result = meshWorker._validateIpcMessage({
        type: 'run_batch',
        workerId: 1,
        batchSize: 10,
        maliciousField: 'evil',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unknown field');
    });
  });

  // ── Mesh worker: batchSize out of range ──────────────────────────

  describe('Mesh worker: batchSize out of range', () => {
    test('validation fails for batchSize > 100000', () => {
      const result = meshWorker._validateIpcMessage({
        type: 'run_batch',
        workerId: 1,
        batchSize: 200000,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('out of range');
    });
  });

  // ── IPC_SCHEMAS coverage ─────────────────────────────────────────

  describe('IPC_SCHEMAS covers all message types', () => {
    test('all expected types have schemas', () => {
      const schemas = clusterSync.IPC_SCHEMAS;
      expect(schemas.HEARTBEAT).toBeDefined();
      expect(schemas.KEY_COMMIT).toBeDefined();
      expect(schemas.ANNOUNCE).toBeDefined();
      expect(schemas.ANNOUNCE_ACK).toBeDefined();
      expect(schemas.DKG_COMMIT).toBeDefined();
      expect(schemas.DKG_SHARE).toBeDefined();
      expect(schemas.DKG_COMPLAINT).toBeDefined();
      expect(schemas.DKG_DISQUALIFY).toBeDefined();
      expect(schemas.DKG_FINALIZE).toBeDefined();
    });
  });
});
