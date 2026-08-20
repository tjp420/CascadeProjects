"use strict";

/**
 * Track 57: Post-Quantum Identity Accumulator.
 *
 * Asynchronous tree-state processor that hashes post-quantum public
 * keys into an immutable cryptographic root using sorted SHA-256
 * leaves. Supports real-time membership additions and state updates
 * while respecting the maxTreeDepth policy constraint.
 *
 * @module hsm-adapter/pq-identity-accumulator
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

class PqIdentityAccumulator {
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
    this._members = new Map();
    this._rootHash = null;
    this._treeDepth = 0;
    this._lastUpdateEpoch = 0;
    this._rootUpdateId = 0;
  }

  /**
   * Add a post-quantum public key to the accumulator.
   * @param {object} request
   * @returns {object}
   */
  addMember(request) {
    _validateAddRequest(this.policy, request);
    if (this.policy.requireRootUpdateAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.attestation);
        if (!result.verified) {
          throw new HsmAdapterError(
            "ACCUM_ROOT_UPDATE_UNATTESTED",
            "root update attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "ACCUM_ROOT_UPDATE_UNATTESTED",
          "root update attestation invalid",
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
        "ACCUM_ATTESTATION_AUTHORITY_BLOCKED",
        `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(", ")}`,
      );
    }
    const publicKeyHash = crypto
      .createHash("sha256")
      .update(request.publicKey)
      .digest("hex");
    if (this._members.has(publicKeyHash)) {
      throw new HsmAdapterError(
        "ACCUM_MEMBER_DUPLICATE",
        `member ${publicKeyHash} already exists in accumulator`,
      );
    }
    this._members.set(publicKeyHash, {
      publicKeyHash,
      sourceTenantId: request.sourceTenantId,
      addedAt: Math.floor(Date.now() / 1000),
    });
    return this._recomputeRoot(request.sourceTenantId);
  }

  /**
   * Remove a post-quantum public key from the accumulator.
   * @param {object} request
   * @returns {object}
   */
  removeMember(request) {
    _validateRemoveRequest(this.policy, request);
    if (this.policy.requireRootUpdateAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.attestation);
        if (!result.verified) {
          throw new HsmAdapterError(
            "ACCUM_ROOT_UPDATE_UNATTESTED",
            "root update attestation invalid",
          );
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError(
          "ACCUM_ROOT_UPDATE_UNATTESTED",
          "root update attestation invalid",
        );
      }
    }
    const publicKeyHash = crypto
      .createHash("sha256")
      .update(request.publicKey)
      .digest("hex");
    if (!this._members.has(publicKeyHash)) {
      throw new HsmAdapterError(
        "ACCUM_MEMBER_NOT_FOUND",
        `member ${publicKeyHash} not found in accumulator`,
      );
    }
    this._members.delete(publicKeyHash);
    return this._recomputeRoot(request.sourceTenantId);
  }

  /**
   * Recompute the accumulator root hash from sorted leaves.
   * @param {string} sourceTenantId
   * @returns {object}
   * @private
   */
  _recomputeRoot(sourceTenantId) {
    const memberCount = this._members.size;
    if (memberCount === 0) {
      this._rootHash = null;
      this._treeDepth = 0;
      this._lastUpdateEpoch = Math.floor(Date.now() / 1000);
      this._rootUpdateId += 1;
      const result = {
        rootUpdateId: `accum-${this._rootUpdateId}`,
        rootHash: null,
        treeDepth: 0,
        memberCount: 0,
        epochSeconds: this._lastUpdateEpoch,
        status: "updated",
      };
      if (this._audit) {
        this._audit("IDENTITY_ACCUMULATOR_UPDATED", {
          ...result,
          sourceTenantId,
        });
      }
      return result;
    }
    const sortedHashes = Array.from(this._members.keys()).sort();
    const treeDepth = Math.ceil(Math.log2(memberCount));
    if (treeDepth > (this.policy.maxTreeDepth || 20)) {
      throw new HsmAdapterError(
        "ACCUM_TREE_DEPTH_EXCEEDED",
        `tree depth ${treeDepth} exceeds maximum ${this.policy.maxTreeDepth}`,
      );
    }
    this._treeDepth = treeDepth;
    this._rootHash = _computeMerkleRoot(sortedHashes);
    this._lastUpdateEpoch = Math.floor(Date.now() / 1000);
    this._rootUpdateId += 1;
    const result = {
      rootUpdateId: `accum-${this._rootUpdateId}`,
      rootHash: this._rootHash,
      treeDepth,
      memberCount,
      epochSeconds: this._lastUpdateEpoch,
      status: "updated",
    };
    if (this._audit) {
      this._audit("IDENTITY_ACCUMULATOR_UPDATED", {
        ...result,
        sourceTenantId,
      });
    }
    return result;
  }

  /**
   * Get the current accumulator state.
   * @returns {object}
   */
  getState() {
    return {
      rootHash: this._rootHash,
      treeDepth: this._treeDepth,
      memberCount: this._members.size,
      lastUpdateEpoch: this._lastUpdateEpoch,
    };
  }

  /**
   * Check if a public key is a member of the accumulator.
   * @param {string} publicKey
   * @returns {boolean}
   */
  isMember(publicKey) {
    const publicKeyHash = crypto
      .createHash("sha256")
      .update(publicKey)
      .digest("hex");
    return this._members.has(publicKeyHash);
  }

  /**
   * Get the membership witness for a public key.
   * @param {string} publicKey
   * @returns {object}
   */
  getMembershipWitness(publicKey) {
    const publicKeyHash = crypto
      .createHash("sha256")
      .update(publicKey)
      .digest("hex");
    if (!this._members.has(publicKeyHash)) {
      throw new HsmAdapterError(
        "ACCUM_MEMBER_NOT_FOUND",
        `member ${publicKeyHash} not found in accumulator`,
      );
    }
    const sortedHashes = Array.from(this._members.keys()).sort();
    const index = sortedHashes.indexOf(publicKeyHash);
    return {
      leaf: publicKeyHash,
      index,
      rootHash: this._rootHash,
      siblings: _computeMerkleSiblings(sortedHashes, index),
    };
  }
}

function _computeMerkleRoot(leaves) {
  if (leaves.length === 0) return null;
  let level = leaves.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(
        crypto.createHash("sha256").update(`${left}:${right}`).digest("hex"),
      );
    }
    level = next;
  }
  return level[0];
}

function _computeMerkleSiblings(leaves, index) {
  const siblings = [];
  let level = leaves.slice();
  let idx = index;
  while (level.length > 1) {
    const next = [];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (siblingIdx < level.length) {
      siblings.push(level[siblingIdx]);
    } else {
      siblings.push(level[idx]);
    }
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(
        crypto.createHash("sha256").update(`${left}:${right}`).digest("hex"),
      );
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return siblings;
}

function _validateAddRequest(policy, request) {
  if (!request.publicKey || !request.sourceTenantId) {
    throw new HsmAdapterError(
      "ACCUM_FIELDS_MISSING",
      "publicKey and sourceTenantId are required",
    );
  }
  if (policy.requireRootUpdateAttestation && !request.attestation) {
    throw new HsmAdapterError(
      "ACCUM_ATTESTATION_MISSING",
      "root update attestation is required",
    );
  }
}

function _validateRemoveRequest(policy, request) {
  if (!request.publicKey || !request.sourceTenantId) {
    throw new HsmAdapterError(
      "ACCUM_FIELDS_MISSING",
      "publicKey and sourceTenantId are required",
    );
  }
  if (policy.requireRootUpdateAttestation && !request.attestation) {
    throw new HsmAdapterError(
      "ACCUM_ATTESTATION_MISSING",
      "root update attestation is required",
    );
  }
}

module.exports = { PqIdentityAccumulator };
