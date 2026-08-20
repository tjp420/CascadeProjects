"use strict";

/**
 * Track 34: Cross-Cluster Migration.
 *
 * Engineers secure multi-region state transitions between source and
 * destination clusters. Coordinates shard state transfer with BFT-gated
 * commit, attested migration manifests, rollback safety, and replay
 * protection.
 *
 * Components:
 *   - MigrationManifest: signed manifest with shard IDs, vector-clock
 *     snapshots, and entry counts
 *   - MigrationState machine: INITIATED → ATTESTED → TRANSFERRING →
 *     VERIFYING → COMMITTED (with ROLLED_BACK terminal)
 *   - BFT commit gating: destination quorum required before commit
 *   - Attestation: manifest must be attested by allowed authorities
 *   - Rollback: verification or quorum failure rolls back safely
 *   - Replay protection: unique monotonic migration IDs
 *
 * @module hsm-adapter/cross-cluster-migration-engine
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");
const {
  validateTenantContext,
  TENANT_FIELD,
  DEFAULT_TENANT,
} = require("../replication-tenant-context.cjs");

// ── Migration states ─────────────────────────────────────────────
const MIGRATION_STATE = {
  INITIATED: "initiated",
  ATTESTED: "attested",
  TRANSFERRING: "transferring",
  VERIFYING: "verifying",
  COMMITTED: "committed",
  ROLLED_BACK: "rolled_back",
};

// ── Valid state transitions ──────────────────────────────────────
const VALID_TRANSITIONS = {
  [MIGRATION_STATE.INITIATED]: [
    MIGRATION_STATE.ATTESTED,
    MIGRATION_STATE.ROLLED_BACK,
  ],
  [MIGRATION_STATE.ATTESTED]: [
    MIGRATION_STATE.TRANSFERRING,
    MIGRATION_STATE.ROLLED_BACK,
  ],
  [MIGRATION_STATE.TRANSFERRING]: [
    MIGRATION_STATE.VERIFYING,
    MIGRATION_STATE.ROLLED_BACK,
  ],
  [MIGRATION_STATE.VERIFYING]: [
    MIGRATION_STATE.COMMITTED,
    MIGRATION_STATE.ROLLED_BACK,
  ],
  [MIGRATION_STATE.COMMITTED]: [],
  [MIGRATION_STATE.ROLLED_BACK]: [],
};

/**
 * MigrationManifest — cryptographic manifest for a cross-cluster migration.
 *
 * Contains shard IDs, vector-clock snapshots, entry counts, and a
 * quorum signature from the source cluster.
 */
class MigrationManifest {
  /**
   * @param {object} options
   * @param {string} options.migrationId
   * @param {string} options.sourceCluster
   * @param {string} options.destinationCluster
   * @param {object[]} options.shards — [{ shardId, entryCount, vectorClockSnapshot }]
   * @param {number} options.timestamp
   */
  constructor(options) {
    this.migrationId = options.migrationId;
    this.sourceCluster = options.sourceCluster;
    this.destinationCluster = options.destinationCluster;
    this.shards = options.shards;
    this.timestamp = options.timestamp || Date.now();
    this.attestation = null;
    this.quorumSignature = null;

    // Compute manifest hash for integrity verification
    const payload = JSON.stringify({
      migrationId: this.migrationId,
      sourceCluster: this.sourceCluster,
      destinationCluster: this.destinationCluster,
      shards: this.shards,
      timestamp: this.timestamp,
    });
    this.hash = crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Set the quorum signature from the source cluster.
   * @param {string} signature
   */
  setQuorumSignature(signature) {
    this.quorumSignature = signature;
  }

  /**
   * Attach an attestation from an allowed authority.
   * @param {string} authority
   * @param {string} token
   */
  attest(authority, token) {
    this.attestation = { authority, token, timestamp: Date.now() };
  }

  /**
   * Verify the manifest hash integrity.
   * @returns {boolean}
   */
  verifyIntegrity() {
    const payload = JSON.stringify({
      migrationId: this.migrationId,
      sourceCluster: this.sourceCluster,
      destinationCluster: this.destinationCluster,
      shards: this.shards,
      timestamp: this.timestamp,
    });
    const computedHash = crypto
      .createHash("sha256")
      .update(payload)
      .digest("hex");
    return computedHash === this.hash;
  }

  /**
   * Get total entry count across all shards.
   * @returns {number}
   */
  totalEntryCount() {
    return this.shards.reduce((sum, s) => sum + s.entryCount, 0);
  }

  /**
   * Get all shard IDs in this migration.
   * @returns {string[]}
   */
  shardIds() {
    return this.shards.map((s) => s.shardId);
  }
}

/**
 * CrossClusterMigrationEngine.
 *
 * Manages the full lifecycle of cross-cluster shard migrations with
 * BFT-gated commit, attestation, rollback, and replay protection.
 */
class CrossClusterMigrationEngine {
  /**
   * @param {object} options
   * @param {string[]} options.destinationNodes
   * @param {number} [options.minQuorumNodes] — t-of-N quorum for commit
   * @param {string[]} [options.allowedAttestationAuthorities]
   * @param {boolean} [options.requireAttestation]
   * @param {number} [options.maxConcurrentMigrations]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    if (
      !Array.isArray(options.destinationNodes) ||
      options.destinationNodes.length === 0
    ) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "destinationNodes must be a non-empty array",
      );
    }
    this.destinationNodes = new Set(options.destinationNodes);
    this.minQuorumNodes =
      options.minQuorumNodes ||
      Math.floor(options.destinationNodes.length / 2) + 1;
    this.allowedAttestationAuthorities =
      options.allowedAttestationAuthorities || ["mock-authority"];
    this.requireAttestation = options.requireAttestation !== false;
    this.maxConcurrentMigrations = options.maxConcurrentMigrations || 16;
    this._audit = options.audit || null;

    this._migrations = new Map(); // migrationId -> { manifest, state, acks, verificationResult }
    this._nextMigrationSeq = 1;
    this._activeMigrationCount = 0;
  }

  /**
   * Initiate a new cross-cluster migration.
   * @param {object} manifestOptions
   * @returns {MigrationManifest}
   */
  initiate(manifestOptions) {
    if (this._activeMigrationCount >= this.maxConcurrentMigrations) {
      throw new HsmAdapterError(
        "MIGRATION_CONCURRENCY_LIMIT",
        `max concurrent migrations (${this.maxConcurrentMigrations}) reached`,
      );
    }

    const migrationId = `migration-${this._nextMigrationSeq}`;
    this._nextMigrationSeq++;

    const manifest = new MigrationManifest({
      ...manifestOptions,
      migrationId,
    });

    this._migrations.set(migrationId, {
      manifest,
      state: MIGRATION_STATE.INITIATED,
      acks: new Set(),
      verificationResult: null,
    });
    this._activeMigrationCount++;

    this._emitAudit("MIGRATION_INITIATED", {
      migrationId,
      sourceCluster: manifest.sourceCluster,
      destinationCluster: manifest.destinationCluster,
      shardCount: manifest.shards.length,
    });

    return manifest;
  }

  /**
   * Attest a migration manifest.
   * @param {string} migrationId
   * @param {string} authority
   * @param {string} token
   */
  attest(migrationId, authority, token) {
    const record = this._getMigration(migrationId);
    this._transition(migrationId, MIGRATION_STATE.ATTESTED);

    if (
      this.requireAttestation &&
      !this.allowedAttestationAuthorities.includes(authority)
    ) {
      this._transition(migrationId, MIGRATION_STATE.ROLLED_BACK);
      throw new HsmAdapterError(
        "MIGRATION_ATTESTATION_REJECTED",
        `attestation authority ${authority} is not allowed`,
      );
    }

    record.manifest.attest(authority, token);
    this._emitAudit("MIGRATION_ATTESTED", { migrationId, authority });

    return record.manifest;
  }

  /**
   * Begin transferring shard data to the destination cluster.
   * @param {string} migrationId
   */
  beginTransfer(migrationId) {
    const record = this._getMigration(migrationId);

    if (this.requireAttestation && !record.manifest.attestation) {
      throw new HsmAdapterError(
        "MIGRATION_NOT_ATTESTED",
        `migration ${migrationId} requires attestation before transfer`,
      );
    }

    this._transition(migrationId, MIGRATION_STATE.TRANSFERRING);
    this._emitAudit("MIGRATION_TRANSFER_STARTED", {
      migrationId,
      shardCount: record.manifest.shards.length,
      totalEntries: record.manifest.totalEntryCount(),
    });

    return { migrationId, status: MIGRATION_STATE.TRANSFERRING };
  }

  /**
   * Begin verification of transferred data on the destination cluster.
   * @param {string} migrationId
   * @param {boolean} verified
   */
  verify(migrationId, verified) {
    const record = this._getMigration(migrationId);
    this._transition(migrationId, MIGRATION_STATE.VERIFYING);

    record.verificationResult = verified;

    if (!verified) {
      this._transition(migrationId, MIGRATION_STATE.ROLLED_BACK);
      this._activeMigrationCount--;
      this._emitAudit("MIGRATION_VERIFICATION_FAILED", { migrationId });
      return {
        migrationId,
        status: MIGRATION_STATE.ROLLED_BACK,
        reason: "verification failed",
      };
    }

    this._emitAudit("MIGRATION_VERIFIED", { migrationId });
    return { migrationId, status: MIGRATION_STATE.VERIFYING };
  }

  /**
   * Acknowledge a migration by a destination node.
   * @param {string} migrationId
   * @param {string} nodeId
   */
  acknowledge(migrationId, nodeId) {
    this._validateNode(nodeId);
    const record = this._getMigration(migrationId);

    if (record.state !== MIGRATION_STATE.VERIFYING) {
      throw new HsmAdapterError(
        "MIGRATION_NOT_VERIFIABLE",
        `migration ${migrationId} is in state ${record.state}, cannot acknowledge`,
      );
    }

    record.acks.add(nodeId);
    this._emitAudit("MIGRATION_ACKED", {
      migrationId,
      nodeId,
      acks: record.acks.size,
    });

    // Check if quorum reached
    if (record.acks.size >= this.minQuorumNodes) {
      this._commit(migrationId);
    }

    return {
      migrationId,
      nodeId,
      acks: record.acks.size,
      committed: record.state === MIGRATION_STATE.COMMITTED,
    };
  }

  /**
   * Commit a migration after quorum is reached.
   * @param {string} migrationId
   */
  _commit(migrationId) {
    const record = this._getMigration(migrationId);
    this._transition(migrationId, MIGRATION_STATE.COMMITTED);
    this._activeMigrationCount--;
    this._emitAudit("MIGRATION_COMMITTED", {
      migrationId,
      acks: record.acks.size,
      quorum: this.minQuorumNodes,
    });
  }

  /**
   * Force a rollback of a migration.
   * @param {string} migrationId
   * @param {string} [reason]
   */
  rollback(migrationId, reason = "manual") {
    const record = this._getMigration(migrationId);
    if (record.state === MIGRATION_STATE.COMMITTED) {
      throw new HsmAdapterError(
        "MIGRATION_ALREADY_COMMITTED",
        `cannot rollback committed migration ${migrationId}`,
      );
    }
    if (record.state === MIGRATION_STATE.ROLLED_BACK) {
      throw new HsmAdapterError(
        "MIGRATION_ALREADY_ROLLED_BACK",
        `migration ${migrationId} already rolled back`,
      );
    }
    this._transition(migrationId, MIGRATION_STATE.ROLLED_BACK);
    this._activeMigrationCount--;
    this._emitAudit("MIGRATION_ROLLED_BACK", { migrationId, reason });
    return { migrationId, status: MIGRATION_STATE.ROLLED_BACK, reason };
  }

  /**
   * Get the current state of a migration.
   * @param {string} migrationId
   * @returns {object}
   */
  getMigrationState(migrationId) {
    const record = this._getMigration(migrationId);
    return {
      migrationId,
      state: record.state,
      acks: record.acks.size,
      quorumRequired: this.minQuorumNodes,
      verificationResult: record.verificationResult,
      manifest: {
        migrationId: record.manifest.migrationId,
        sourceCluster: record.manifest.sourceCluster,
        destinationCluster: record.manifest.destinationCluster,
        shardIds: record.manifest.shardIds(),
        totalEntryCount: record.manifest.totalEntryCount(),
        hash: record.manifest.hash,
        attested: !!record.manifest.attestation,
      },
    };
  }

  /**
   * Get a migration manifest.
   * @param {string} migrationId
   * @returns {MigrationManifest}
   */
  getManifest(migrationId) {
    return this._getMigration(migrationId).manifest;
  }

  /**
   * Get engine telemetry.
   * @returns {object}
   */
  getEngineState() {
    return {
      totalMigrations: this._migrations.size,
      activeMigrations: this._activeMigrationCount,
      destinationClusterSize: this.destinationNodes.size,
      minQuorumNodes: this.minQuorumNodes,
      allowedAttestationAuthorities: this.allowedAttestationAuthorities,
    };
  }

  /**
   * Get a migration record or throw.
   * @param {string} migrationId
   * @returns {object}
   */
  _getMigration(migrationId) {
    const record = this._migrations.get(migrationId);
    if (!record) {
      throw new HsmAdapterError(
        "MIGRATION_NOT_FOUND",
        `migration ${migrationId} not found`,
      );
    }
    return record;
  }

  /**
   * Validate that a node is part of the destination cluster.
   * @param {string} nodeId
   */
  _validateNode(nodeId) {
    if (!this.destinationNodes.has(nodeId)) {
      throw new HsmAdapterError(
        "MIGRATION_NODE_UNKNOWN",
        `node ${nodeId} not in destination cluster`,
      );
    }
  }

  /**
   * Transition a migration to a new state, enforcing valid transitions.
   * @param {string} migrationId
   * @param {string} newState
   */
  _transition(migrationId, newState) {
    const record = this._getMigration(migrationId);
    const allowed = VALID_TRANSITIONS[record.state] || [];
    if (!allowed.includes(newState)) {
      throw new HsmAdapterError(
        "MIGRATION_INVALID_TRANSITION",
        `cannot transition from ${record.state} to ${newState}`,
      );
    }
    record.state = newState;
  }

  _emitAudit(event, data) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...data });
  }
}

module.exports = {
  CrossClusterMigrationEngine,
  MigrationManifest,
  MIGRATION_STATE,
  VALID_TRANSITIONS,
};
