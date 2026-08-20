"use strict";

/**
 * Track 62: PQC Time-Locked Matrix Router.
 *
 * Time-locked payload manager that encapsulates encrypted data arrays
 * behind verifiable delay functions (VDF) and post-quantum ML-KEM
 * encapsulation envelopes. Parses TIMELOCK packets, enforces
 * maxPayloadBytes, and applies the minCommitteeQuorum criteria.
 *
 * Extended with lattice-based time-lock difficulty, ML-KEM key
 * encapsulation, matrix routing across time-lock nodes, and
 * committee signature aggregation.
 *
 * @module hsm-adapter/pqc-time-locked-matrix-router
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const MATRIX_STATUS = {
  LOCKED: "locked",
  ROUTING: "routing",
  RELEASED: "released",
  EXPIRED: "expired",
  FAILED: "failed",
};

const LATTICE_PARAMS = {
  // Simulated lattice parameters for LWE-based time locks
  // In production, these would be NIST-standardized parameter sets
  dimension: 256,
  modulus: (1n << 32n) - 5n,
  errorBound: 8,
};

class PqcTimeLockedMatrixRouter {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._matrices = new Map();
    this._routingNodes = new Map(); // nodeId -> routing node
    this._maxRoutingNodes = options.maxRoutingNodes || 50;
    this._maxMatrices = options.maxMatrices || 1000;
    this._latticeKeys = new Map(); // keyId -> lattice key pair
  }

  /**
   * Initialize a time-locked matrix.
   * @param {object} request
   * @returns {object}
   */
  initializeMatrix(request) {
    _validateInitRequest(this.policy, request);
    if (this._matrices.size >= this._maxMatrices) {
      throw new HsmAdapterError(
        "TIMELOCK_MAX_MATRICES",
        `maximum ${this._maxMatrices} matrices reached`,
      );
    }
    if (this.policy.requireSubmitterAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.submitterAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "TIMELOCK_SUBMITTER_UNATTESTED",
            "submitter attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "TIMELOCK_SUBMITTER_UNATTESTED",
          "submitter attestation invalid",
        );
      }
    }
    if (
      typeof request.attestationAuthority === "string" &&
      !this.policy.allowedAttestationAuthorities.includes(
        request.attestationAuthority,
      )
    ) {
      throw new HsmAdapterError(
        "TIMELOCK_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    if (
      typeof request.pqcSignatureScheme === "string" &&
      !this.policy.allowedPqcSignatureSchemes.includes(
        request.pqcSignatureScheme,
      )
    ) {
      throw new HsmAdapterError(
        "TIMELOCK_PQC_SCHEME_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(", ")}`,
      );
    }
    const payloadBytes =
      request.payloadBytes ||
      (request.encryptedPayload
        ? Buffer.byteLength(request.encryptedPayload, "utf8")
        : 0);
    if (payloadBytes > (this.policy.maxPayloadBytes || 1048576)) {
      throw new HsmAdapterError(
        "TIMELOCK_PAYLOAD_EXCEEDED",
        `payload bytes ${payloadBytes} exceeds maximum ${this.policy.maxPayloadBytes}`,
      );
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minCommitteeQuorum || 3)) {
      throw new HsmAdapterError(
        "TIMELOCK_QUORUM_INSUFFICIENT",
        `committee signatures ${signatures.length} below minimum ${this.policy.minCommitteeQuorum}`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const timeDelay = request.timeDelaySeconds || 0;
    if (timeDelay < (this.policy.minTimeDelaySeconds || 3600)) {
      throw new HsmAdapterError(
        "TIMELOCK_DELAY_INSUFFICIENT",
        `time delay ${timeDelay}s below minimum ${this.policy.minTimeDelaySeconds}s`,
      );
    }
    const matrixId =
      request.matrixId || `matrix-${crypto.randomBytes(4).toString("hex")}`;
    if (this._matrices.has(matrixId)) {
      throw new HsmAdapterError(
        "TIMELOCK_DUPLICATE",
        `matrix ${matrixId} already exists`,
      );
    }
    const releaseTimestamp = request.releaseTimestamp || now + timeDelay;
    const encryptedPayloadHash =
      request.encryptedPayloadHash ||
      crypto
        .createHash("sha256")
        .update(request.encryptedPayload || "")
        .digest("hex");
    // Generate lattice-based time-lock parameters
    const latticeTimeLock = this._generateLatticeTimeLock(
      request.vdfDifficulty || 1,
    );
    // Generate ML-KEM encapsulation envelope
    const mlKemEnvelope = this._generateMlKemEnvelope(
      request.encryptedPayload || "",
    );
    const matrix = {
      matrixId,
      sourceTenantId: request.sourceTenantId,
      encryptedPayloadHash,
      vdfDifficulty: request.vdfDifficulty || 1,
      releaseTimestamp,
      timeDelaySeconds: timeDelay,
      pqcSignatureScheme: request.pqcSignatureScheme,
      committeeSignatureCount: signatures.length,
      committeeSignatures: signatures,
      initializedAt: now,
      payloadBytes,
      status: MATRIX_STATUS.LOCKED,
      latticeTimeLock,
      mlKemEnvelope,
      routingPath: null,
      routedAt: null,
    };
    this._matrices.set(matrixId, matrix);
    if (this._audit) {
      this._audit("TIME_LOCK_MATRIX_INITIALIZED", { ...matrix });
    }
    return matrix;
  }

  /**
   * Register a routing node for matrix routing.
   * @param {object} config
   * @param {string} config.nodeId
   * @param {string} config.enclaveId
   * @param {string} [config.region]
   * @returns {object}
   */
  registerRoutingNode(config) {
    if (!config || !config.nodeId || typeof config.nodeId !== "string") {
      throw new HsmAdapterError(
        "TIMELOCK_NODE_ID_INVALID",
        "nodeId must be a non-empty string",
      );
    }
    if (this._routingNodes.has(config.nodeId)) {
      throw new HsmAdapterError(
        "TIMELOCK_NODE_EXISTS",
        `node ${config.nodeId} already exists`,
      );
    }
    if (this._routingNodes.size >= this._maxRoutingNodes) {
      throw new HsmAdapterError(
        "TIMELOCK_MAX_NODES",
        `maximum ${this._maxRoutingNodes} routing nodes reached`,
      );
    }
    if (!config.enclaveId || typeof config.enclaveId !== "string") {
      throw new HsmAdapterError(
        "TIMELOCK_ENCLAVE_ID_INVALID",
        "enclaveId must be a non-empty string",
      );
    }
    const node = {
      nodeId: config.nodeId,
      enclaveId: config.enclaveId,
      region: config.region || "default",
      registeredAt: Date.now(),
      relayedMatrices: 0,
      status: "active",
    };
    this._routingNodes.set(config.nodeId, node);
    if (this._audit) {
      this._audit("TIMELOCK_NODE_REGISTERED", {
        nodeId: config.nodeId,
        enclaveId: config.enclaveId,
      });
    }
    return {
      nodeId: node.nodeId,
      enclaveId: node.enclaveId,
      region: node.region,
      status: node.status,
    };
  }

  /**
   * Route a matrix through time-lock nodes.
   * @param {string} matrixId
   * @param {string[]} [nodeIds] - Optional explicit routing path
   * @returns {object}
   */
  routeMatrix(matrixId, nodeIds) {
    const matrix = this._matrices.get(matrixId);
    if (!matrix) {
      throw new HsmAdapterError(
        "TIMELOCK_NOT_FOUND",
        `matrix ${matrixId} not found`,
      );
    }
    if (matrix.status !== MATRIX_STATUS.LOCKED) {
      throw new HsmAdapterError(
        "TIMELOCK_NOT_LOCKED",
        `matrix ${matrixId} status is ${matrix.status}, expected locked`,
      );
    }
    const activeNodes = Array.from(this._routingNodes.values()).filter(
      (n) => n.status === "active",
    );
    if (activeNodes.length < 2) {
      throw new HsmAdapterError(
        "TIMELOCK_INSUFFICIENT_NODES",
        `${activeNodes.length} active nodes available, need at least 2`,
      );
    }
    let path;
    if (nodeIds && Array.isArray(nodeIds) && nodeIds.length >= 2) {
      // Validate explicit path
      for (const nid of nodeIds) {
        const node = this._routingNodes.get(nid);
        if (!node || node.status !== "active") {
          throw new HsmAdapterError(
            "TIMELOCK_NODE_UNAVAILABLE",
            `node ${nid} is not available for routing`,
          );
        }
      }
      path = nodeIds;
    } else {
      // Auto-select routing path (pick 3 random active nodes)
      const shuffled = _shuffleArray(activeNodes);
      path = shuffled
        .slice(0, Math.min(3, shuffled.length))
        .map((n) => n.nodeId);
    }
    matrix.routingPath = path;
    matrix.routedAt = Math.floor(Date.now() / 1000);
    matrix.status = MATRIX_STATUS.ROUTING;
    // Increment relay count for each node
    for (const nid of path) {
      const node = this._routingNodes.get(nid);
      node.relayedMatrices++;
    }
    if (this._audit) {
      this._audit("TIMELOCK_MATRIX_ROUTED", { matrixId, path });
    }
    return { matrixId, routingPath: path, status: matrix.status };
  }

  /**
   * Aggregate committee signatures for a matrix.
   * @param {string} matrixId
   * @param {string[]} partialSignatures
   * @returns {object}
   */
  aggregateCommitteeSignatures(matrixId, partialSignatures) {
    const matrix = this._matrices.get(matrixId);
    if (!matrix) {
      throw new HsmAdapterError(
        "TIMELOCK_NOT_FOUND",
        `matrix ${matrixId} not found`,
      );
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError(
        "TIMELOCK_NO_SIGNATURES",
        "partialSignatures array is required",
      );
    }
    if (partialSignatures.length < (this.policy.minCommitteeQuorum || 3)) {
      throw new HsmAdapterError(
        "TIMELOCK_QUORUM_INSUFFICIENT",
        `${partialSignatures.length} signatures below minimum ${this.policy.minCommitteeQuorum || 3}`,
      );
    }
    // Simulate BLS-style signature aggregation
    const aggregatedSig = crypto
      .createHash("sha256")
      .update(partialSignatures.join(":"))
      .digest("hex");
    matrix.committeeSignatures = partialSignatures;
    matrix.committeeSignatureCount = partialSignatures.length;
    matrix.aggregatedSignature = aggregatedSig;
    if (this._audit) {
      this._audit("TIMELOCK_SIGNATURES_AGGREGATED", {
        matrixId,
        count: partialSignatures.length,
      });
    }
    return {
      matrixId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: aggregatedSig,
    };
  }

  /**
   * Generate a lattice key pair for ML-KEM operations.
   * @param {string} [keyId]
   * @returns {object}
   */
  generateLatticeKeyPair(keyId) {
    const id = keyId || `lattice-key-${crypto.randomBytes(4).toString("hex")}`;
    if (this._latticeKeys.has(id)) {
      throw new HsmAdapterError(
        "TIMELOCK_KEY_EXISTS",
        `lattice key ${id} already exists`,
      );
    }
    // Simulated lattice key pair (in production, use ML-KEM-768/1024)
    const secretKey = crypto.randomBytes(32);
    const publicKey = crypto.createHash("sha256").update(secretKey).digest();
    const keyPair = {
      keyId: id,
      publicKey: publicKey.toString("hex"),
      secretKey,
      generatedAt: Date.now(),
    };
    this._latticeKeys.set(id, keyPair);
    if (this._audit) {
      this._audit("TIMELOCK_LATTICE_KEY_GENERATED", { keyId: id });
    }
    return { keyId: id, publicKey: keyPair.publicKey };
  }

  /**
   * Get a matrix by id.
   * @param {string} matrixId
   * @returns {object|null}
   */
  getMatrix(matrixId) {
    return this._matrices.get(matrixId) || null;
  }

  /**
   * Check if a matrix is ready for decryption.
   * @param {string} matrixId
   * @param {number} currentTimestamp
   * @returns {boolean}
   */
  isReadyForDecryption(matrixId, currentTimestamp) {
    const matrix = this._matrices.get(matrixId);
    if (!matrix) return false;
    const now = currentTimestamp || Math.floor(Date.now() / 1000);
    return now >= matrix.releaseTimestamp;
  }

  /**
   * Mark a matrix as released.
   * @param {string} matrixId
   * @returns {object}
   */
  markReleased(matrixId) {
    const matrix = this._matrices.get(matrixId);
    if (!matrix) {
      throw new HsmAdapterError(
        "TIMELOCK_NOT_FOUND",
        `matrix ${matrixId} not found`,
      );
    }
    matrix.status = MATRIX_STATUS.RELEASED;
    return matrix;
  }

  /**
   * Expire a matrix.
   * @param {string} matrixId
   * @returns {object}
   */
  expireMatrix(matrixId) {
    const matrix = this._matrices.get(matrixId);
    if (!matrix) {
      throw new HsmAdapterError(
        "TIMELOCK_NOT_FOUND",
        `matrix ${matrixId} not found`,
      );
    }
    if (matrix.status === MATRIX_STATUS.EXPIRED) {
      throw new HsmAdapterError(
        "TIMELOCK_ALREADY_EXPIRED",
        `matrix ${matrixId} is already expired`,
      );
    }
    matrix.status = MATRIX_STATUS.EXPIRED;
    if (this._audit) {
      this._audit("TIMELOCK_MATRIX_EXPIRED", { matrixId });
    }
    return { matrixId, expired: true };
  }

  /**
   * Get all routing nodes.
   * @returns {object[]}
   */
  getRoutingNodes() {
    return Array.from(this._routingNodes.values()).map((n) => ({
      nodeId: n.nodeId,
      enclaveId: n.enclaveId,
      region: n.region,
      status: n.status,
      relayedMatrices: n.relayedMatrices,
    }));
  }

  /**
   * Get routing node info.
   * @param {string} nodeId
   * @returns {object|null}
   */
  getRoutingNode(nodeId) {
    const node = this._routingNodes.get(nodeId);
    if (!node) return null;
    return {
      nodeId: node.nodeId,
      enclaveId: node.enclaveId,
      region: node.region,
      status: node.status,
      relayedMatrices: node.relayedMatrices,
    };
  }

  /**
   * Get all matrices (metadata only).
   * @returns {object[]}
   */
  getMatrices() {
    return Array.from(this._matrices.values()).map((m) => ({
      matrixId: m.matrixId,
      sourceTenantId: m.sourceTenantId,
      status: m.status,
      releaseTimestamp: m.releaseTimestamp,
      vdfDifficulty: m.vdfDifficulty,
    }));
  }

  /**
   * Get the current matrix count.
   * @returns {number}
   */
  getMatrixCount() {
    return this._matrices.size;
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const matricesByStatus = {};
    for (const m of this._matrices.values()) {
      matricesByStatus[m.status] = (matricesByStatus[m.status] || 0) + 1;
    }
    return {
      totalMatrices: this._matrices.size,
      totalRoutingNodes: this._routingNodes.size,
      totalLatticeKeys: this._latticeKeys.size,
      matricesByStatus,
    };
  }

  /**
   * Generate lattice-based time-lock parameters.
   * @private
   */
  _generateLatticeTimeLock(difficulty) {
    // Simulated LWE-based time-lock: generates a lattice problem
    // whose solution requires at least `difficulty` sequential steps
    const seed = crypto.randomBytes(32);
    const latticeMatrix = crypto
      .createHash("sha256")
      .update(`lattice:${seed.toString("hex")}:${difficulty}`)
      .digest("hex");
    return {
      dimension: LATTICE_PARAMS.dimension,
      modulus: LATTICE_PARAMS.modulus.toString(16),
      errorBound: LATTICE_PARAMS.errorBound,
      difficulty,
      seed: seed.toString("hex"),
      latticeHash: latticeMatrix,
    };
  }

  /**
   * Generate ML-KEM encapsulation envelope.
   * @private
   */
  _generateMlKemEnvelope(payload) {
    // Simulated ML-KEM key encapsulation
    const encapsulatedKey = crypto.randomBytes(32);
    const ciphertext = payload
      ? crypto.createHash("sha256").update(payload).digest("hex")
      : null;
    return {
      kemAlgorithm: "ML-KEM-768",
      encapsulatedKey: encapsulatedKey.toString("hex"),
      ciphertext,
      encapsulatedAt: Date.now(),
    };
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId) {
    throw new HsmAdapterError(
      "TIMELOCK_FIELDS_MISSING",
      "sourceTenantId is required",
    );
  }
  if (!request.encryptedPayload && !request.encryptedPayloadHash) {
    throw new HsmAdapterError(
      "TIMELOCK_FIELDS_MISSING",
      "encryptedPayload or encryptedPayloadHash is required",
    );
  }
  if (policy.requireSubmitterAttestation && !request.submitterAttestation) {
    throw new HsmAdapterError(
      "TIMELOCK_SUBMITTER_ATTESTATION_MISSING",
      "submitter attestation is required",
    );
  }
}

/**
 * Fisher-Yates shuffle for routing path selection.
 * @param {Array} arr
 * @returns {Array}
 * @private
 */
function _shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  PqcTimeLockedMatrixRouter,
  MATRIX_STATUS,
  LATTICE_PARAMS,
};
