"use strict";

/**
 * Cluster Keyring Sync Load Profile — Test Harness
 *
 * Deterministic, process-isolated stress harness for DKG transcript gossip
 * protocols inside cluster-keyring-sync.cjs. Provides:
 *   - SHA-256 hash-chain PRNG for reproducible message generation
 *   - Mock socket pool with lifecycle tracking
 *   - Mock DKG engine with deterministic contribution generation
 *   - PRNG-driven DKG message factory (commit, share, complaint, malformed)
 *
 * This harness is READ-ONLY with respect to production code — it only
 * exercises the exported test helpers from cluster-keyring-sync.cjs.
 */

const crypto = require("crypto");

// ── PRNG: SHA-256 hash-chain for deterministic message generation ─────────

/**
 * Create a deterministic PRNG using a SHA-256 hash-chain.
 * @param {string} seed - Initial seed value.
 * @returns {function(): bigint} Function that returns the next random BigInt.
 */
function createPrng(seed) {
  let state = String(seed);
  return function next() {
    state = crypto.createHash("sha256").update(state).digest("hex");
    return BigInt("0x" + state);
  };
}

/**
 * Generate a deterministic hex string of the given byte length.
 * @param {function(): bigint} prng - PRNG function.
 * @param {number} bytes - Number of bytes (hex length = bytes * 2).
 * @returns {string} Lowercase hex string.
 */
function prngHex(prng, bytes = 32) {
  const val = prng();
  const hex = val.toString(16);
  // Pad or trim to exact length
  if (hex.length > bytes * 2) {
    return hex.slice(0, bytes * 2);
  }
  return hex.padStart(bytes * 2, "0");
}

// ── Mock socket pool ──────────────────────────────────────────────────────

/**
 * Create a mock socket pool that tracks all created sockets for cleanup.
 * @returns {{create: function, cleanup: function, size: function}} Socket pool.
 */
function createMockSocketPool() {
  const sockets = [];

  function create(remoteAddress = "127.0.0.1", remotePort = 7001) {
    const handlers = {};
    const socket = {
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
    sockets.push(socket);
    return socket;
  }

  function cleanup() {
    for (const s of sockets) {
      if (!s.destroyed) {
        s.destroyed = true;
      }
    }
    sockets.length = 0;
  }

  function size() {
    return sockets.length;
  }

  function allDestroyed() {
    return sockets.every((s) => s.destroyed);
  }

  return { create, cleanup, size, allDestroyed, _sockets: sockets };
}

// ── Mock DKG engine ───────────────────────────────────────────────────────

/**
 * Create a mock DKG engine with deterministic contribution generation.
 * This avoids the computational cost of the real DkgSnarkEngine for load testing.
 * @param {string[]} nodeIds - Array of node identifiers.
 * @param {number} threshold - Threshold for the DKG scheme.
 * @param {string} [seed] - PRNG seed for deterministic contributions.
 * @returns {object} Mock DKG engine.
 */
function createMockDkgEngine(
  nodeIds = ["node-1", "node-2", "node-3"],
  threshold = 2,
  seed = "mock-dkg-seed",
) {
  const prng = createPrng(seed);
  const contributions = new Map();
  const shares = new Map();

  // Pre-generate deterministic contributions and shares for each node
  for (const nodeId of nodeIds) {
    const commitments = [];
    for (let i = 0; i < threshold; i++) {
      commitments.push(prng());
    }

    // Generate shares for each recipient (as Map, matching DkgSnarkEngine)
    const nodeShares = new Map();
    for (const recipientId of nodeIds) {
      if (recipientId !== nodeId) {
        nodeShares.set(recipientId, prng());
      }
    }
    contributions.set(nodeId, { commitments, shares: nodeShares });
    shares.set(nodeId, nodeShares);
  }

  return {
    totalNodes: nodeIds.length,
    threshold,
    nodeIds,

    generateContribution(nodeId) {
      const contrib = contributions.get(nodeId);
      if (!contrib) {
        // Generate on-the-fly for unknown nodes
        const newCommitments = [];
        for (let i = 0; i < threshold; i++) {
          newCommitments.push(prng());
        }
        const newShares = new Map();
        for (const recipientId of nodeIds) {
          if (recipientId !== nodeId) {
            newShares.set(recipientId, prng());
          }
        }
        const newContrib = { commitments: newCommitments, shares: newShares };
        contributions.set(nodeId, newContrib);
        return newContrib;
      }
      return contrib;
    },

    getShare(broadcasterId, recipientId) {
      const nodeShares = shares.get(broadcasterId);
      if (!nodeShares) return undefined;
      return nodeShares.get(recipientId);
    },

    verifyShare(broadcasterId, recipientId, share) {
      const expected = this.getShare(broadcasterId, recipientId);
      if (expected === undefined) return false;
      try {
        return BigInt(share) === expected;
      } catch (e) {
        return false;
      }
    },

    fileComplaint() {
      // No-op for mock
    },

    // Helper to get serialized commitments
    getSerializedCommitments(nodeId, serializeFn) {
      const contrib =
        contributions.get(nodeId) || this.generateContribution(nodeId);
      return contrib.commitments.map((c) => serializeFn(c));
    },
  };
}

// ── DKG message factory ───────────────────────────────────────────────────

/**
 * Create a PRNG-driven DKG message factory.
 * @param {function(): bigint} prng - PRNG function.
 * @param {string} sessionId - Active DKG session ID.
 * @param {string[]} nodeIds - Array of valid node IDs.
 * @returns {object} Message factory with commit, share, complaint, malformed methods.
 */
function createDkgMessageFactory(
  prng,
  sessionId,
  nodeIds = ["node-1", "node-2", "node-3"],
) {
  const validHexRegex = /^[0-9a-f]+$/;

  function commit(nodeId) {
    const numCommitments = 2 + Number(prng() % 3n); // 2-4 commitments
    const commitments = [];
    for (let i = 0; i < numCommitments; i++) {
      commitments.push(prngHex(prng, 32));
    }
    return {
      type: "DKG_COMMIT",
      from: nodeId,
      sessionId,
      nodeId,
      commitments,
    };
  }

  function share(from, to) {
    return {
      type: "DKG_SHARE",
      from,
      sessionId,
      broadcasterId: from,
      recipientId: to,
      share: prngHex(prng, 32),
    };
  }

  function complaint(from, against) {
    return {
      type: "DKG_COMPLAINT",
      from,
      sessionId,
      fromNodeId: from,
      againstNodeId: against,
    };
  }

  function malformed() {
    const types = ["DKG_COMMIT", "DKG_SHARE", "DKG_COMPLAINT"];
    const msgType = types[Number(prng() % BigInt(types.length))];
    const base = {
      type: msgType,
      from: nodeIds[Number(prng() % BigInt(nodeIds.length))],
      sessionId,
    };
    // Inject random malformation
    const malformations = [
      () => {
        delete base.commitments;
      }, // missing commitments
      () => {
        base.commitments = ["NOT_HEX"];
      }, // invalid hex
      () => {
        base.sessionId = "dkg-wrong";
      }, // wrong session
      () => {
        base.nodeId = undefined;
      }, // missing nodeId
      () => {
        base.commitments = [12345];
      }, // non-string commitments
    ];
    malformations[Number(prng() % BigInt(malformations.length))]();
    return base;
  }

  function oversizeCommitment(nodeId, commitmentCount = 500) {
    const commitments = [];
    for (let i = 0; i < commitmentCount; i++) {
      commitments.push(prngHex(prng, 32));
    }
    return {
      type: "DKG_COMMIT",
      from: nodeId,
      sessionId,
      nodeId,
      commitments,
    };
  }

  return { commit, share, complaint, malformed, oversizeCommitment };
}

// ── Event timeline saturation helper ──────────────────────────────────────

/**
 * Record N events rapidly to test the MAX_EVENTS cap.
 * @param {object} clusterSync - The cluster-keyring-sync module.
 * @param {number} count - Number of events to record.
 * @param {string} eventType - Event type string.
 * @param {string} node - Node ID for events.
 */
function saturateEvents(
  clusterSync,
  count,
  eventType = "test_load_event",
  node = "node-load",
) {
  for (let i = 0; i < count; i++) {
    clusterSync._recordEvent(eventType, node, {
      index: i,
      batch: "load-saturation",
    });
  }
}

// ── STEK rotation helper ──────────────────────────────────────────────────

/**
 * Perform N rapid STEK rotations and return the state.
 * @param {object} clusterSync - The cluster-keyring-sync module.
 * @param {number} count - Number of rotations.
 * @returns {object} Final STEK state.
 */
function rapidStekRotation(clusterSync, count) {
  const states = [];
  for (let i = 0; i < count; i++) {
    clusterSync.rotateStek();
    states.push(clusterSync.getStekState());
  }
  return states[states.length - 1];
}

module.exports = {
  createPrng,
  prngHex,
  createMockSocketPool,
  createMockDkgEngine,
  createDkgMessageFactory,
  saturateEvents,
  rapidStekRotation,
};
