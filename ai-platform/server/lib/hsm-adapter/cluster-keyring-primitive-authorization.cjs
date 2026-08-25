"use strict";

/**
 * Cluster Keyring Sync Integration Layer for primitive gates (Tracks 91-110).
 *
 * Bridges the 18 non-signature primitive gating hubs with the existing
 * cluster keyring sync infrastructure. Authorizes accredited pools for
 * distributed node-to-node secret sharing, enforces attestation gating,
 * ratchets share material via HKDF-SHA256, and disperses to cluster nodes.
 *
 * Authorization trigger: primitive gate pool status === 'accredited'.
 * Only accredited pools are cleared for cluster-wide distribution.
 *
 * @module hsm-adapter/cluster-keyring-primitive-authorization
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class ClusterKeyringPrimitiveAuthorization {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {object} [options.attestationClient]  - EnclaveAttestationClient (isNodeVerified)
   * @param {object} [options.shardDisperser]     - HomomorphicKeyShardDisperser (disperse)
   * @param {object} [options.ratchet]            - EphemeralShareRatchet (evolveShare)
   * @param {object} [options.stateSync]           - CrossEnclaveStateSync (syncState)
   * @param {object} [options.reconciler]          - ClusterKeyReconciliationEngine (detectDivergence)
   * @param {object} [options.keyringSync]         - cluster-keyring-sync.cjs (recordTelemetry)
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._shardDisperser = options.shardDisperser || null;
    this._ratchet = options.ratchet || null;
    this._stateSync = options.stateSync || null;
    this._reconciler = options.reconciler || null;
    this._keyringSync = options.keyringSync || null;
    this._audit = options.audit || null;
    this._gateRegistries = new Map(); // trackType → { hub, validator }
    this._authorizedPools = new Map(); // poolId → authorization record
  }

  /**
   * Register a primitive gate hub + validator pair for a track type.
   * @param {string} trackType
   * @param {object} hub        - Pqc[Xxx]GatingHub instance
   * @param {object} [validator] - Zk[Xxx]ClaimValidator instance
   */
  registerGate(trackType, hub, validator) {
    if (!trackType || typeof trackType !== "string") {
      throw new HsmAdapterError(
        "GATE_NOT_REGISTERED",
        "trackType must be a non-empty string",
      );
    }
    if (!hub || typeof hub.getPool !== "function") {
      throw new HsmAdapterError(
        "GATE_NOT_REGISTERED",
        `hub for trackType ${trackType} is invalid`,
      );
    }
    this._gateRegistries.set(trackType, { hub, validator: validator || null });
  }

  /**
   * Authorize an accredited pool for cluster-wide node-to-node secret sharing.
   * @param {string} trackType
   * @param {string} poolId
   * @param {object} request
   * @returns {object} authorization record
   */
  authorizeAccreditedPool(trackType, poolId, request = {}) {
    _validateAuthorizeRequest(this.policy, trackType, poolId, request);
    const reg = this._gateRegistries.get(trackType);
    if (!reg) {
      throw new HsmAdapterError(
        "GATE_NOT_REGISTERED",
        `trackType ${trackType} has no registered gate`,
      );
    }
    const pool = reg.hub.getPool(poolId);
    if (!pool) {
      throw new HsmAdapterError(
        "POOL_NOT_FOUND",
        `pool ${poolId} not found in trackType ${trackType}`,
      );
    }
    if (
      this.policy.requireAccreditedPoolStatus &&
      pool.status !== "accredited"
    ) {
      throw new HsmAdapterError(
        "POOL_NOT_ACCREDITED",
        `pool ${poolId} status is ${pool.status}, not accredited`,
      );
    }
    if (this._authorizedPools.has(poolId)) {
      throw new HsmAdapterError(
        "DUPLICATE_AUTHORIZATION",
        `pool ${poolId} is already authorized`,
      );
    }
    if (this.policy.requireNodeAttestation && this._attestationClient) {
      const nodeId =
        request.nodeId ||
        pool.sourceOpticalNodeId ||
        pool.sourceVolumetricSectorId ||
        pool.sourceTenantId;
      let verified = false;
      if (typeof this._attestationClient.isNodeVerified === "function") {
        verified = this._attestationClient.isNodeVerified(nodeId);
      } else if (typeof this._attestationClient.isVerified === "function") {
        verified = this._attestationClient.isVerified(nodeId);
      }
      if (!verified) {
        throw new HsmAdapterError(
          "NODE_UNATTESTED",
          `node ${nodeId} has not been attested`,
        );
      }
    }
    if (
      typeof request.pqcSignatureScheme === "string" &&
      !this.policy.allowedPqcSignatureSchemes.includes(
        request.pqcSignatureScheme,
      )
    ) {
      throw new HsmAdapterError(
        "POLICY_VIOLATION_BLOCKED",
        `PQC signature scheme ${request.pqcSignatureScheme} is not permitted`,
      );
    }
    if (
      typeof request.attestationAuthority === "string" &&
      !this.policy.allowedAttestationAuthorities.includes(
        request.attestationAuthority,
      )
    ) {
      throw new HsmAdapterError(
        "POLICY_VIOLATION_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed`,
      );
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minAuthorizationQuorum || 3)) {
      throw new HsmAdapterError(
        "QUORUM_INSUFFICIENT",
        `authorization quorum ${signatures.length} below minimum ${this.policy.minAuthorizationQuorum}`,
      );
    }
    if (
      typeof request.tenantId === "string" &&
      pool.sourceTenantId &&
      request.tenantId !== pool.sourceTenantId
    ) {
      throw new HsmAdapterError(
        "CROSS_TENANT_VIOLATION",
        `request tenant ${request.tenantId} does not match pool tenant ${pool.sourceTenantId}`,
      );
    }

    // Ratchet share material if ratchet is available
    let ratchetedShare = null;
    if (this._ratchet && typeof this._ratchet.evolveShare === "function") {
      try {
        const token = {
          nodeIndex: 1,
          value: BigInt("0x" + crypto.randomBytes(8).toString("hex")),
          sequence: 0,
        };
        ratchetedShare = this._ratchet.evolveShare(
          token,
          `auth-${poolId}-${Date.now()}`,
        );
      } catch (e) {
        if (this._audit)
          this._audit("AUTHORIZATION_RATCHET_FAILED", {
            poolId,
            err: String(e),
          });
      }
    }

    // Disperse to cluster nodes if disperser is available
    let dispersalResult = null;
    if (
      this._shardDisperser &&
      typeof this._shardDisperser.disperse === "function"
    ) {
      try {
        dispersalResult = this._shardDisperser.disperse({
          sourcePlatformId: pool.sourceTenantId,
          destinations: request.destinations || [],
          localNodeAttestation: request.localNodeAttestation || null,
          kemAlgorithm: request.kemAlgorithm || "ML-KEM-768",
          shardDepth: request.shardDepth || 1,
        });
      } catch (e) {
        if (this._audit)
          this._audit("AUTHORIZATION_DISPERSE_FAILED", {
            poolId,
            err: String(e),
          });
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const authorizationId = `auth-${crypto.randomBytes(4).toString("hex")}`;
    const record = {
      authorizationId,
      trackType,
      poolId,
      tenantId: pool.sourceTenantId,
      nodeId: request.nodeId || null,
      pqcSignatureScheme: request.pqcSignatureScheme || null,
      ratcheted: ratchetedShare !== null,
      dispersed: dispersalResult !== null,
      dispersedCount: dispersalResult ? dispersalResult.dispersed : 0,
      authorizedAt: now,
      expiresAt: now + (this.policy.maxAuthorizedPoolRetentionSeconds || 86400),
      status: "active",
    };
    this._authorizedPools.set(poolId, record);

    if (
      this._keyringSync &&
      typeof this._keyringSync.recordTelemetry === "function"
    ) {
      try {
        this._keyringSync.recordTelemetry(
          "primitive_pool_authorized",
          record.nodeId || "unknown",
          {
            authorizationId,
            trackType,
            poolId,
            tenantId: record.tenantId,
          },
        );
      } catch (e) {
        console.error(
          "cluster-keyring-primitive-authorization.cjs error:",
          e,
        ); /* best-effort telemetry */
      }
    }
    if (this._audit) {
      this._audit("PRIMITIVE_POOL_AUTHORIZED", { ...record });
    }
    return record;
  }

  /**
   * Check if a pool is authorized for node-to-node sharing.
   * @param {string} poolId
   * @returns {boolean}
   */
  isPoolAuthorized(poolId) {
    const rec = this._authorizedPools.get(poolId);
    if (!rec) return false;
    if (rec.status !== "active") return false;
    const now = Math.floor(Date.now() / 1000);
    if (now > rec.expiresAt) {
      rec.status = "expired";
      return false;
    }
    return true;
  }

  /**
   * Revoke authorization for a pool.
   * @param {string} poolId
   * @param {string} reason
   * @returns {object} updated record
   */
  revokeAuthorization(poolId, reason = "manual") {
    const rec = this._authorizedPools.get(poolId);
    if (!rec) {
      throw new HsmAdapterError(
        "AUTHORIZATION_REVOKED",
        `pool ${poolId} has no authorization record`,
      );
    }
    rec.status = "revoked";
    rec.revokedAt = Math.floor(Date.now() / 1000);
    rec.revokeReason = reason;
    if (
      this._keyringSync &&
      typeof this._keyringSync.recordTelemetry === "function"
    ) {
      try {
        this._keyringSync.recordTelemetry(
          "primitive_authorization_revoked",
          rec.nodeId || "unknown",
          {
            authorizationId: rec.authorizationId,
            poolId,
            reason,
          },
        );
      } catch (e) {
        console.error(
          "cluster-keyring-primitive-authorization.cjs error:",
          e,
        ); /* best-effort */
      }
    }
    if (this._audit) {
      this._audit("PRIMITIVE_AUTHORIZATION_REVOKED", { ...rec });
    }
    return rec;
  }

  /**
   * Sync an authorized pool's state to a target enclave.
   * @param {string} poolId
   * @param {string} targetEnclaveId
   * @returns {object} sync result
   */
  syncAuthorizedPool(poolId, targetEnclaveId) {
    if (!this.isPoolAuthorized(poolId)) {
      throw new HsmAdapterError(
        "AUTHORIZATION_REVOKED",
        `pool ${poolId} is not authorized or has expired`,
      );
    }
    const rec = this._authorizedPools.get(poolId);
    const now = Math.floor(Date.now() / 1000);
    if (now - rec.authorizedAt > (this.policy.maxSyncWindowSeconds || 300)) {
      throw new HsmAdapterError(
        "SYNC_WINDOW_EXCEEDED",
        `sync window exceeded for pool ${poolId}`,
      );
    }
    let syncResult = null;
    if (this._stateSync && typeof this._stateSync.syncState === "function") {
      try {
        const shardId = `primitive-pool-${poolId}`;
        syncResult = this._stateSync.syncState(shardId, targetEnclaveId);
      } catch (e) {
        if (this._audit)
          this._audit("PRIMITIVE_POOL_SYNC_FAILED", { poolId, err: String(e) });
      }
    }
    if (
      this._keyringSync &&
      typeof this._keyringSync.recordTelemetry === "function"
    ) {
      try {
        this._keyringSync.recordTelemetry(
          "primitive_pool_synced",
          rec.nodeId || "unknown",
          {
            authorizationId: rec.authorizationId,
            poolId,
            targetEnclaveId,
          },
        );
      } catch (e) {
        console.error(
          "cluster-keyring-primitive-authorization.cjs error:",
          e,
        ); /* best-effort */
      }
    }
    const result = {
      poolId,
      targetEnclaveId,
      syncedAt: now,
      syncResult,
    };
    if (this._audit) {
      this._audit("PRIMITIVE_POOL_SYNCED", { ...result });
    }
    return result;
  }

  /**
   * Detect divergence in authorized pool shares across nodes.
   * @param {string} poolId
   * @returns {object} divergence report
   */
  detectShareDivergence(poolId) {
    if (!this.isPoolAuthorized(poolId)) {
      throw new HsmAdapterError(
        "AUTHORIZATION_REVOKED",
        `pool ${poolId} is not authorized`,
      );
    }
    if (
      this._reconciler &&
      typeof this._reconciler.detectDivergence === "function"
    ) {
      try {
        return this._reconciler.detectDivergence(`primitive-pool-${poolId}`);
      } catch (e) {
        return {
          keyId: `primitive-pool-${poolId}`,
          severity: "none",
          error: String(e),
        };
      }
    }
    return {
      keyId: `primitive-pool-${poolId}`,
      severity: "none",
      divergentNodes: [],
      quorumEpoch: null,
    };
  }

  /**
   * Get authorization summary for monitoring.
   * @returns {object}
   */
  getAuthorizationSummary() {
    const records = Array.from(this._authorizedPools.values());
    return {
      registeredGateCount: this._gateRegistries.size,
      authorizedPoolCount: records.filter((r) => r.status === "active").length,
      revokedPoolCount: records.filter((r) => r.status === "revoked").length,
      expiredPoolCount: records.filter((r) => r.status === "expired").length,
      totalAuthorizations: records.length,
    };
  }

  /**
   * Get the authorization record for a pool.
   * @param {string} poolId
   * @returns {object|null}
   */
  getAuthorization(poolId) {
    return this._authorizedPools.get(poolId) || null;
  }
}

function _validateAuthorizeRequest(policy, trackType, poolId, request) {
  if (!trackType)
    throw new HsmAdapterError("GATE_NOT_REGISTERED", "trackType is required");
  if (!poolId)
    throw new HsmAdapterError("POOL_NOT_FOUND", "poolId is required");
  if (policy.banUnauthorizedShareDispersal === false) {
    throw new HsmAdapterError(
      "POLICY_VIOLATION_BLOCKED",
      "unauthorized share dispersal must remain banned",
    );
  }
  if (policy.requireCanonicalPayloadLayout === false) {
    throw new HsmAdapterError(
      "POLICY_VIOLATION_BLOCKED",
      "canonical payload layout is required",
    );
  }
}

module.exports = { ClusterKeyringPrimitiveAuthorization };
