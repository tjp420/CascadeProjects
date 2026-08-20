"use strict";

/**
 * Track 22: Distributed time anchor engine.
 *
 * Provides Byzantine-fault-tolerant consensus over signed time pulses from
 * N independent oracles. Outliers beyond a configured drift window are
 * rejected and a median timestamp is returned once a minimum quorum is met.
 *
 * @module hsm-adapter/time-anchor-engine
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

function _canonical(epochNumber, timestamp, oracleId) {
  return `${epochNumber}:${timestamp}:${oracleId}`;
}

class TimeAnchorEngine {
  /**
   * @param {object} options
   * @param {object} options.oracles - map of oracleId to { publicKey (PEM/Buffer) }
   * @param {number} options.minQuorum
   * @param {number} options.maxDriftMs
   * @param {object} [options.logger]
   */
  constructor(options = {}) {
    this._oracles = options.oracles || {};
    this._minQuorum = options.minQuorum || 3;
    this._maxDriftMs = options.maxDriftMs || 60000;
    this._logger = options.logger || null;
    this._pulses = [];
    this._lastConsensus = 0;
    this._lastEpoch = 0;
  }

  get minQuorum() {
    return this._minQuorum;
  }

  get maxDriftMs() {
    return this._maxDriftMs;
  }

  _audit(event, extra = {}) {
    if (!this._logger || !this._logger.info) return;
    this._logger.info(event, {
      sub: "hsm-adapter",
      provider: "time-anchor",
      ...extra,
    });
  }

  /**
   * Submit a signed time pulse from an oracle.
   * @param {string} oracleId
   * @param {number} timestamp
   * @param {string} signature - base64 signature
   * @param {number} [epochNumber=0]
   */
  submitPulse(oracleId, timestamp, signature, epochNumber = 0) {
    const oracle = this._oracles[oracleId];
    if (!oracle) {
      throw new HsmAdapterError(
        "ORACLE_QUORUM_FAILED",
        `unknown oracle ${oracleId}`,
      );
    }

    if (epochNumber < this._lastEpoch) {
      throw new HsmAdapterError(
        "MONOTONIC_TIME_VIOLATION",
        `epoch ${epochNumber} is older than last epoch ${this._lastEpoch}`,
      );
    }
    if (timestamp < this._lastConsensus) {
      throw new HsmAdapterError(
        "MONOTONIC_TIME_VIOLATION",
        `timestamp ${timestamp} is older than last consensus ${this._lastConsensus}`,
      );
    }

    const payload = _canonical(epochNumber, timestamp, oracleId);
    const verifier = crypto.createVerify("sha256");
    verifier.update(payload);
    const ok = verifier.verify(oracle.publicKey, signature, "base64");
    if (!ok) {
      throw new HsmAdapterError(
        "ORACLE_SIGNATURE_INVALID",
        `invalid signature from oracle ${oracleId}`,
      );
    }

    this._pulses.push({ oracleId, timestamp, epochNumber, signature });
  }

  /**
   * Compute and return the consensus timestamp.
   * @param {number} [epochNumber]
   * @returns {number}
   */
  consensusTimestamp(epochNumber) {
    if (this._pulses.length < this._minQuorum) {
      if (this._lastConsensus > 0) return this._lastConsensus;
      throw new HsmAdapterError(
        "ORACLE_QUORUM_FAILED",
        `only ${this._pulses.length} valid pulses, need ${this._minQuorum}`,
      );
    }

    const sorted = this._pulses.map((p) => p.timestamp).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const inliers = this._pulses.filter(
      (p) => Math.abs(p.timestamp - median) <= this._maxDriftMs,
    );

    if (inliers.length < this._minQuorum) {
      throw new HsmAdapterError(
        "ORACLE_QUORUM_FAILED",
        `only ${inliers.length} inlier pulses, need ${this._minQuorum}`,
      );
    }

    const inlierTimestamps = inliers
      .map((p) => p.timestamp)
      .sort((a, b) => a - b);
    const consensus = inlierTimestamps[Math.floor(inlierTimestamps.length / 2)];

    if (consensus < this._lastConsensus) {
      throw new HsmAdapterError(
        "MONOTONIC_TIME_VIOLATION",
        `consensus ${consensus} is older than last consensus ${this._lastConsensus}`,
      );
    }

    this._lastConsensus = consensus;
    this._lastEpoch = epochNumber !== undefined ? epochNumber : this._lastEpoch;
    this._pulses = [];

    this._audit("TIME_CONSENSUS_REACHED", {
      consensus,
      inliers: inliers.length,
      epochNumber: this._lastEpoch,
    });
    return consensus;
  }

  /**
   * Return the current anchored time.
   * @returns {number}
   */
  currentEpoch() {
    return this._lastConsensus;
  }
}

module.exports = {
  TimeAnchorEngine,
};
