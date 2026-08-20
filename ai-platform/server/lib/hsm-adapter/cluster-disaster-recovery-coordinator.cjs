"use strict";

/**
 * Track 43B: Cluster disaster recovery coordinator.
 *
 * Tracks cross-region heartbeats and triggers BFT-vote failover
 * when a region's latency exceeds the policy threshold.
 *
 * @module hsm-adapter/cluster-disaster-recovery-coordinator
 */

const { HsmAdapterError } = require("./base-adapter.cjs");

class ClusterDisasterRecoveryCoordinator {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {object[]} [options.regions]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.regions = new Map((options.regions || []).map((r) => [r.id, r]));
    this._audit = options.audit || null;
    this._heartbeatLog = new Map();
    this._failoverVotes = new Map();
    this._failedRegions = new Set();
  }

  /**
   * Record a heartbeat from a region.
   * @param {string} regionId
   * @param {number} timestamp
   * @param {number} latencyMs
   * @returns {object}
   */
  heartbeat(regionId, timestamp, latencyMs) {
    if (!this.regions.has(regionId)) {
      throw new HsmAdapterError(
        "DR_UNKNOWN_REGION",
        `region ${regionId} is not registered`,
      );
    }
    this._heartbeatLog.set(regionId, {
      timestamp,
      latencyMs,
      receivedAt: Date.now(),
    });
    return { ok: true, regionId, latencyMs };
  }

  /**
   * Cast a BFT failover vote from a monitoring node.
   * @param {string} regionId
   * @param {string} voterId
   * @returns {object}
   */
  voteFailover(regionId, voterId) {
    if (this._failedRegions.has(regionId)) {
      return { voted: false, reason: "region already marked failed" };
    }
    const last = this._heartbeatLog.get(regionId);
    const maxLatency = this.policy.maxCrossRegionHeartbeatLatencyMs || 5000;
    if (last && last.latencyMs <= maxLatency) {
      return { voted: false, reason: "region is healthy" };
    }
    if (!this._failoverVotes.has(regionId))
      this._failoverVotes.set(regionId, new Set());
    this._failoverVotes.get(regionId).add(voterId);
    const votes = this._failoverVotes.get(regionId).size;
    const quorum = this.policy.minFailoverQuorumNodes || 3;
    if (votes >= quorum) {
      this._failedRegions.add(regionId);
      if (this._audit) {
        this._audit("REGIONAL_FAILOVER_INITIATED", {
          regionId,
          votes,
          quorum,
          voters: [...this._failoverVotes.get(regionId)],
        });
      }
      return { initiated: true, regionId, votes };
    }
    return { voted: true, regionId, votes, needed: quorum };
  }

  /**
   * Initiate an operator-override failover.
   * @param {string} regionId
   * @param {string} operatorToken
   * @returns {object}
   */
  operatorOverride(regionId, operatorToken) {
    const allowedModes = this.policy.allowedFailoverModes || [];
    if (!allowedModes.includes("operator-override")) {
      throw new HsmAdapterError(
        "DR_MODE_BLOCKED",
        "operator-override failover is not allowed",
      );
    }
    if (operatorToken !== "valid-operator-token") {
      throw new HsmAdapterError(
        "DR_UNAUTHORIZED",
        "operator override token is invalid",
      );
    }
    this._failedRegions.add(regionId);
    if (this._audit) {
      this._audit("REGIONAL_FAILOVER_INITIATED", {
        regionId,
        mode: "operator-override",
      });
    }
    return { initiated: true, regionId, mode: "operator-override" };
  }

  /**
   * Get the current status of all regions.
   * @returns {object[]}
   */
  getRegionStatus() {
    return [...this.regions.keys()].map((id) => ({
      regionId: id,
      healthy: !this._failedRegions.has(id),
      lastHeartbeat: this._heartbeatLog.get(id) || null,
      votes: this._failoverVotes.get(id)?.size || 0,
    }));
  }

  /**
   * Check if a region has failed.
   * @param {string} regionId
   * @returns {boolean}
   */
  isFailed(regionId) {
    return this._failedRegions.has(regionId);
  }
}

module.exports = { ClusterDisasterRecoveryCoordinator };
