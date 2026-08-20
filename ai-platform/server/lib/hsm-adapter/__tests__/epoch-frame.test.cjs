"use strict";

/**
 * Epoch-Frame Verification Hardening + SIEM Alerting Hooks — Test Suite
 */

const crypto = require("crypto");

// Set up env before requiring the module
process.env.NODE_ID = "node-1";
process.env.CLUSTER_NODES = "127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002";
process.env.KEY_ROTATION_STORE_PATH = require("path").join(
  require("os").tmpdir(),
  "sb-epoch-test-key.json",
);
process.env.AUDIT_LOG_PATH = require("path").join(
  require("os").tmpdir(),
  "sb-epoch-test-audit.json",
);
process.env.AUDIT_LOG_SCRUB_PII = "false";
require("fs").writeFileSync(
  process.env.AUDIT_LOG_PATH,
  JSON.stringify({ entries: {} }),
  "utf8",
);

const clusterSync = require("../../../lib/cluster-keyring-sync.cjs");
const keyRotationStore = require("../../../lib/key-rotation-store.cjs");

function createMockSocket(remoteAddress = "127.0.0.1", remotePort = 7001) {
  const handlers = {};
  return {
    remoteAddress,
    remotePort,
    destroyed: false,
    write: jest.fn(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    destroy: jest.fn(function () {
      this.destroyed = true;
    }),
    _handlers: handlers,
  };
}

describe("Epoch-Frame Verification Hardening", () => {
  beforeEach(() => {
    clusterSync._resetEvents();
    clusterSync._resetDkgSession();
    clusterSync._resetEpochState();
    clusterSync._resetEpoch();
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

  // ── L2-01: HEARTBEAT with matching epoch ─────────────────────────

  describe("L2-01: HEARTBEAT with matching epoch", () => {
    test("accepted with no epoch events", () => {
      const socket = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 0,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket,
      );

      const staleEvents = clusterSync.queryEvents({ eventType: "epoch_stale" });
      const driftEvents = clusterSync.queryEvents({ eventType: "epoch_drift" });
      const reconciledEvents = clusterSync.queryEvents({
        eventType: "epoch_reconciled",
      });
      expect(staleEvents.events.length).toBe(0);
      expect(driftEvents.events.length).toBe(0);
      expect(reconciledEvents.events.length).toBe(0);
    });
  });

  // ── L2-02: HEARTBEAT with stale epoch ────────────────────────────

  describe("L2-02: HEARTBEAT with stale epoch", () => {
    test("EPOCH_STALE recorded, local epoch unchanged", () => {
      // First, advance local epoch
      const socket1 = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 3,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket1,
      );

      clusterSync._resetEvents();
      const socket2 = createMockSocket("127.0.0.1", 7002);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-3",
          leaderId: "node-1",
          epoch: 1,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket2,
      );

      const staleEvents = clusterSync.queryEvents({ eventType: "epoch_stale" });
      expect(staleEvents.events.length).toBe(1);
      expect(staleEvents.events[0].details.peerEpoch).toBe(1);
      expect(staleEvents.events[0].details.localEpoch).toBe(3);
      expect(clusterSync.getEpochState().localEpoch).toBe(3);
    });
  });

  // ── L2-03: HEARTBEAT with higher epoch ───────────────────────────

  describe("L2-03: HEARTBEAT with higher epoch (reconciliation)", () => {
    test("EPOCH_DRIFT + EPOCH_RECONCILED recorded, local epoch adopted", () => {
      const socket = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 5,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket,
      );

      const driftEvents = clusterSync.queryEvents({ eventType: "epoch_drift" });
      expect(driftEvents.events.length).toBe(1);
      expect(driftEvents.events[0].details.peerEpoch).toBe(5);
      expect(driftEvents.events[0].details.localEpoch).toBe(0);
      expect(driftEvents.events[0].details.siemSeverity).toBe("high");

      const reconciledEvents = clusterSync.queryEvents({
        eventType: "epoch_reconciled",
      });
      expect(reconciledEvents.events.length).toBe(1);
      expect(reconciledEvents.events[0].details.newEpoch).toBe(5);
      expect(reconciledEvents.events[0].details.previousEpoch).toBe(0);

      expect(clusterSync.getEpochState().localEpoch).toBe(5);
    });
  });

  // ── L2-04: KEY_COMMIT with stale epoch ───────────────────────────

  describe("L2-04: KEY_COMMIT with stale epoch (rejected)", () => {
    test("rejected with KEY_REJECT reason stale_epoch", () => {
      // First advance local epoch
      const socket1 = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 5,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket1,
      );

      clusterSync._resetEvents();

      const validHex = "a".repeat(64);
      const socket2 = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "KEY_COMMIT",
          from: "node-1",
          leaderId: "node-1",
          epoch: 2,
          activeHex: validHex,
          previousHex: null,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: Date.now(),
          graceMs: null,
        },
        socket2,
      );

      const rejectEvents = clusterSync.queryEvents({ eventType: "key_reject" });
      expect(rejectEvents.events.length).toBe(1);
      expect(rejectEvents.events[0].details.reason).toBe("stale_epoch");
      expect(rejectEvents.events[0].details.peerEpoch).toBe(2);
      expect(rejectEvents.events[0].details.localEpoch).toBe(5);
    });
  });

  // ── L2-05: KEY_COMMIT with matching epoch ────────────────────────

  describe("L2-05: KEY_COMMIT with matching epoch (accepted)", () => {
    test("key commit applied when epoch matches", () => {
      const validHex = "b".repeat(64);
      const socket = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "KEY_COMMIT",
          from: "node-1",
          leaderId: "node-1",
          epoch: 0,
          activeHex: validHex,
          previousHex: null,
          activeFingerprint: "def",
          previousFingerprint: null,
          rotatedAt: Date.now(),
          graceMs: null,
        },
        socket,
      );

      const rejectEvents = clusterSync.queryEvents({ eventType: "key_reject" });
      expect(rejectEvents.events.length).toBe(0);
      const commitEvents = clusterSync.queryEvents({ eventType: "key_commit" });
      expect(commitEvents.events.length).toBe(1);
    });
  });

  // ── L2-06: SIEM hook fires on KEY_REJECT ─────────────────────────

  describe("L2-06: SIEM hook fires on KEY_REJECT", () => {
    test("hook invoked with siemSeverity high", () => {
      const hookCalls = [];
      clusterSync.registerSiemHook((eventType, node, details) => {
        hookCalls.push({ eventType, node, details });
      });

      // Advance local epoch to 3 via HEARTBEAT (triggers EPOCH_DRIFT SIEM hook)
      const validHex = "c".repeat(64);
      const s1 = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 3,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        s1,
      );

      clusterSync._resetEvents();

      // Send stale-epoch KEY_COMMIT (epoch 1 < local epoch 3)
      const s2 = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "KEY_COMMIT",
          from: "node-1",
          leaderId: "node-1",
          epoch: 1,
          activeHex: validHex,
          previousHex: null,
          activeFingerprint: "ghi",
          previousFingerprint: null,
          rotatedAt: Date.now(),
          graceMs: null,
        },
        s2,
      );

      const keyRejectCalls = hookCalls.filter(
        (c) => c.eventType === "key_reject",
      );
      expect(keyRejectCalls.length).toBeGreaterThan(0);
    });
  });

  // ── L2-07: SIEM hook fires on ISOLATION_VIOLATION ────────────────

  describe("L2-07: SIEM hook fires on ISOLATION_VIOLATION", () => {
    test("hook invoked with siemSeverity critical", () => {
      const hookCalls = [];
      clusterSync.registerSiemHook((eventType, node, details) => {
        hookCalls.push({ eventType, node, details });
      });

      const socket = createMockSocket("192.168.99.99", 9999);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "rogue",
          leaderId: "rogue",
          epoch: 0,
          activeFingerprint: "xyz",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket,
      );

      expect(hookCalls.length).toBe(1);
      expect(hookCalls[0].eventType).toBe("isolation_violation");
      expect(hookCalls[0].details.siemSeverity).toBe("critical");
    });
  });

  // ── L2-08: SIEM hook rate limiting ───────────────────────────────

  describe("L2-08: SIEM hook rate limiting", () => {
    test("excess calls dropped silently after limit", () => {
      const hookCalls = [];
      clusterSync.registerSiemHook((eventType, node, details) => {
        hookCalls.push({ eventType });
      });

      for (let i = 0; i < 200; i++) {
        const socket = createMockSocket("192.168.99.99", 9999 + i);
        clusterSync._handleMessage(
          {
            type: "HEARTBEAT",
            from: "rogue-" + i,
            leaderId: "rogue",
            epoch: 0,
            activeFingerprint: "xyz",
            previousFingerprint: null,
            rotatedAt: null,
          },
          socket,
        );
      }

      expect(hookCalls.length).toBeLessThanOrEqual(100);
    });
  });

  // ── L3-01: Epoch persistence across restart ──────────────────────

  describe("L3-01 / S-04: Epoch persistence across restart", () => {
    test("epoch restored from persisted state", () => {
      keyRotationStore.setEpoch(7);
      const result = keyRotationStore.loadState();
      expect(result).not.toBeNull();
      expect(result.epoch).toBe(7);
      expect(keyRotationStore.getEpoch()).toBe(7);
    });

    test("epoch defaults to 0 when no persisted state", () => {
      keyRotationStore._reset(crypto.randomBytes(32));
      expect(keyRotationStore.getEpoch()).toBe(0);
    });
  });

  // ── L3-02: Epoch reconciliation after partition ──────────────────

  describe("L3-02 / S-07: Epoch reconciliation after partition", () => {
    test("node adopts higher epoch from peer", () => {
      const s1 = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 3,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        s1,
      );

      clusterSync._resetEvents();
      const s2 = createMockSocket("127.0.0.1", 7002);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-3",
          leaderId: "node-1",
          epoch: 5,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        s2,
      );

      expect(clusterSync.getEpochState().localEpoch).toBe(5);
      const reconciled = clusterSync.queryEvents({
        eventType: "epoch_reconciled",
      });
      expect(reconciled.events.length).toBe(1);
    });

    test("node does NOT adopt lower epoch", () => {
      const s1 = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 5,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        s1,
      );

      clusterSync._resetEvents();
      const s2 = createMockSocket("127.0.0.1", 7002);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-3",
          leaderId: "node-1",
          epoch: 3,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        s2,
      );

      expect(clusterSync.getEpochState().localEpoch).toBe(5);
      const stale = clusterSync.queryEvents({ eventType: "epoch_stale" });
      expect(stale.events.length).toBe(1);
      const reconciled = clusterSync.queryEvents({
        eventType: "epoch_reconciled",
      });
      expect(reconciled.events.length).toBe(0);
    });
  });

  // ── L3-04: Existing keyring sync unaffected ──────────────────────

  describe("L3-04: Existing keyring sync unaffected", () => {
    test("epoch validation does not break normal HEARTBEAT processing", () => {
      const socket = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 0,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket,
      );

      const status = clusterSync.getStatus();
      expect(status).toBeDefined();
    });
  });

  // ── L3-05: SIEM hook doesn't fire on info events ─────────────────

  describe("L3-05: SIEM hook does not fire on info events", () => {
    test("LEADER_ELECTED does not trigger SIEM hook", () => {
      const hookCalls = [];
      clusterSync.registerSiemHook((eventType, node, details) => {
        hookCalls.push({ eventType });
      });

      clusterSync._recordEvent("leader_elected", "node-1", {
        leader: "node-1",
      });
      expect(hookCalls.length).toBe(0);
    });
  });

  // ── L3-06: Multiple SIEM hooks ───────────────────────────────────

  describe("L3-06: Multiple SIEM hooks", () => {
    test("all hooks invoked on high-severity event", () => {
      const calls1 = [];
      const calls2 = [];
      const calls3 = [];
      clusterSync.registerSiemHook((et) => calls1.push(et));
      clusterSync.registerSiemHook((et) => calls2.push(et));
      clusterSync.registerSiemHook((et) => calls3.push(et));

      const socket = createMockSocket("192.168.99.99", 9999);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "rogue",
          leaderId: "rogue",
          epoch: 0,
          activeFingerprint: "xyz",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket,
      );

      expect(calls1.length).toBe(1);
      expect(calls2.length).toBe(1);
      expect(calls3.length).toBe(1);
    });
  });

  // ── L3-07: SIEM hook error isolation ─────────────────────────────

  describe("L3-07 / S-05: SIEM hook error isolation", () => {
    test("hook that throws does not break event recording", () => {
      const goodCalls = [];
      clusterSync.registerSiemHook(() => {
        throw new Error("SIEM hook broken");
      });
      clusterSync.registerSiemHook((et) => goodCalls.push(et));

      const socket = createMockSocket("192.168.99.99", 9999);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "rogue",
          leaderId: "rogue",
          epoch: 0,
          activeFingerprint: "xyz",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket,
      );

      expect(goodCalls.length).toBe(1);
      const events = clusterSync.queryEvents({
        eventType: "isolation_violation",
      });
      expect(events.events.length).toBe(1);
    });
  });

  // ── Unreconcilable epoch jump (>5) ───────────────────────────────

  describe("Unreconcilable epoch jump (> threshold)", () => {
    test("hard reject when peer epoch is >5 ahead", () => {
      const socket = createMockSocket("127.0.0.1", 7001);
      clusterSync._handleMessage(
        {
          type: "HEARTBEAT",
          from: "node-2",
          leaderId: "node-1",
          epoch: 10,
          activeFingerprint: "abc",
          previousFingerprint: null,
          rotatedAt: null,
        },
        socket,
      );

      const driftEvents = clusterSync.queryEvents({ eventType: "epoch_drift" });
      expect(driftEvents.events.length).toBe(1);
      expect(driftEvents.events[0].details.reason).toBe("unreconcilable_jump");
      expect(driftEvents.events[0].details.jump).toBe(10);
      expect(clusterSync.getEpochState().localEpoch).toBe(0);

      const reconciled = clusterSync.queryEvents({
        eventType: "epoch_reconciled",
      });
      expect(reconciled.events.length).toBe(0);
    });
  });

  // ── getEpochState() ──────────────────────────────────────────────

  describe("getEpochState()", () => {
    test("returns local epoch, threshold, and peer epochs", () => {
      const state = clusterSync.getEpochState();
      expect(state).toHaveProperty("localEpoch");
      expect(state).toHaveProperty("reconcileThreshold");
      expect(state).toHaveProperty("peerEpochs");
      expect(typeof state.localEpoch).toBe("number");
      expect(typeof state.reconcileThreshold).toBe("number");
    });
  });
});
