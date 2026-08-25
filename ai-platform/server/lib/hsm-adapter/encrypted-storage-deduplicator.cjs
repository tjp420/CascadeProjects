"use strict";

/**
 * Track 55: Encrypted storage deduplicator.
 *
 * Implements convergent encryption primitives to derive deterministic
 * message-locked keys and cross-check cryptographic ciphertext tags
 * across tenant storage boundaries without decrypting payloads.
 *
 * @module hsm-adapter/encrypted-storage-deduplicator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class EncryptedStorageDeduplicator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {BlindedConvergenceGuard} [options.convergenceGuard]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._convergenceGuard = options.convergenceGuard || null;
    this._audit = options.audit || null;
    this._store = new Map();
    this._bannedPeers = new Set();
  }

  /**
   * Submit a chunk for dedup-aware storage.
   * @param {object} request
   * @returns {object}
   */
  submit(request) {
    _validateRequest(this.policy, request);
    if (this._bannedPeers.has(request.submitterPeerId)) {
      throw new HsmAdapterError(
        "DEDUP_PEER_BANNED",
        `peer ${request.submitterPeerId} is banned`,
      );
    }
    if (this.policy.requireSubmitterAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(
          request.submitterAttestation,
        );
        if (!result.verified) {
          throw new HsmAdapterError(
            "DEDUP_SUBMITTER_UNATTESTED",
            "submitter attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "DEDUP_SUBMITTER_UNATTESTED",
          "submitter attestation invalid",
        );
      }
    }
    const chunkBitLength = request.chunkBitLength || request.chunk.length * 8;
    if (chunkBitLength < (this.policy.minChunkBitLength || 256)) {
      throw new HsmAdapterError(
        "DEDUP_CHUNK_TOO_SMALL",
        `chunk bit length ${chunkBitLength} below minimum ${this.policy.minChunkBitLength}`,
      );
    }
    if (chunkBitLength > (this.policy.maxChunkBitLength || 4096)) {
      throw new HsmAdapterError(
        "DEDUP_CHUNK_TOO_LARGE",
        `chunk bit length ${chunkBitLength} exceeds maximum ${this.policy.maxChunkBitLength}`,
      );
    }
    if (
      typeof request.crossTenantAllocations === "number" &&
      request.crossTenantAllocations >
        (this.policy.maxCrossTenantChunkAllocations || 16)
    ) {
      throw new HsmAdapterError(
        "DEDUP_ALLOCATIONS_EXCEEDED",
        `cross-tenant allocations ${request.crossTenantAllocations} exceeds maximum ${this.policy.maxCrossTenantChunkAllocations}`,
      );
    }
    if (
      typeof request.blindingGroup === "string" &&
      !this.policy.permittedBlindingGroups.includes(request.blindingGroup)
    ) {
      throw new HsmAdapterError(
        "DEDUP_BLINDING_GROUP_BLOCKED",
        `blinding group ${request.blindingGroup} is not permitted; allowed: ${this.policy.permittedBlindingGroups.join(", ")}`,
      );
    }
    let ciphertextTagHash = crypto
      .createHash("sha256")
      .update(request.chunk)
      .digest("hex");
    if (this._convergenceGuard) {
      ciphertextTagHash = this._convergenceGuard.blind(
        ciphertextTagHash,
        request.blindingGroup || "P-256",
      );
    }
    const chunkId = `chunk-${crypto.randomBytes(4).toString("hex")}`;
    const existing = this._findDuplicate(ciphertextTagHash);
    if (existing) {
      if (this._audit) {
        this._audit("CIPHERTEXT_TAG_MATCHED", {
          chunkId,
          existingChunkId: existing.chunkId,
          ciphertextTagHash,
          sourceTenantId: request.sourceTenantId,
          existingTenantId: existing.sourceTenantId,
        });
        this._audit("DUPLICATE_BLOCK_RECONCILED", {
          chunkId,
          ciphertextTagHash,
          sourceTenantId: request.sourceTenantId,
          reconciledAt: Math.floor(Date.now() / 1000),
        });
      }
      return {
        deduplicated: true,
        chunkId,
        existingChunkId: existing.chunkId,
        ciphertextTagHash,
      };
    }
    const record = {
      chunkId,
      sourceTenantId: request.sourceTenantId,
      ciphertextTagHash,
      chunkBitLength,
      blindingGroup: request.blindingGroup || "P-256",
      crossTenantAllocations: request.crossTenantAllocations || 0,
      storedAt: Math.floor(Date.now() / 1000),
    };
    this._store.set(chunkId, record);
    return { deduplicated: false, chunkId, ciphertextTagHash };
  }

  /**
   * Find an existing record with the same ciphertext tag hash.
   * @param {string} ciphertextTagHash
   * @returns {object|null}
   */
  _findDuplicate(ciphertextTagHash) {
    for (const record of this._store.values()) {
      if (record.ciphertextTagHash === ciphertextTagHash) {
        return record;
      }
    }
    return null;
  }

  /**
   * Ban a peer for malformed chunk tokens.
   * @param {string} peerId
   */
  banPeer(peerId) {
    this._bannedPeers.add(peerId);
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  /**
   * Get a stored record by chunk id.
   * @param {string} chunkId
   * @returns {object|null}
   */
  getRecord(chunkId) {
    return this._store.get(chunkId) || null;
  }
}

function _validateRequest(policy, request) {
  if (!request.sourceTenantId || !request.chunk) {
    throw new HsmAdapterError(
      "DEDUP_FIELDS_MISSING",
      "sourceTenantId and chunk are required",
    );
  }
  if (policy.requireSubmitterAttestation && !request.submitterAttestation) {
    throw new HsmAdapterError(
      "DEDUP_ATTESTATION_MISSING",
      "submitter attestation is required",
    );
  }
}

module.exports = { EncryptedStorageDeduplicator };
