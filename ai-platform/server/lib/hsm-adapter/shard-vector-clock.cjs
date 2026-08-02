'use strict';

/**
 * Track 32: Monotonic shard vector clock.
 *
 * Tracks a logical sequence per shard and rejects stale or
 * rollback synchronization packets. Sequences are strictly
 * monotonically increasing.
 *
 * @module hsm-adapter/shard-vector-clock
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

class ShardVectorClock {
  /**
   * @param {object} options
   * @param {number} [options.initial=0]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this._sequences = new Map();
    this._initial = options.initial || 0;
    this._audit = options.audit || null;
  }

  /**
   * Initialize or reset a shard's clock.
   * @param {string} shardId
   * @param {number} [sequence]
   */
  init(shardId, sequence = this._initial) {
    this._sequences.set(shardId, sequence);
  }

  /**
   * Validate an incoming sequence for a shard.
   * @param {string} shardId
   * @param {number} incoming
   * @returns {boolean}
   */
  validate(shardId, incoming) {
    if (typeof incoming !== 'number' || !Number.isInteger(incoming) || incoming < 0) {
      throw new HsmAdapterError('INVALID_INPUT', 'sequence must be a non-negative integer');
    }
    const current = this._sequences.get(shardId) || this._initial;
    if (incoming <= current) {
      throw new HsmAdapterError('SHARD_SYNC_ROLLBACK', `incoming ${incoming} <= local ${current} for shard ${shardId}`);
    }
    return true;
  }

  /**
   * Advance a shard's clock to a new sequence.
   * @param {string} shardId
   * @param {number} sequence
   * @returns {number}
   */
  advance(shardId, sequence) {
    this.validate(shardId, sequence);
    this._sequences.set(shardId, sequence);

    this._emitAudit('SHARD_CLOCK_ADVANCED', { shardId, sequence });

    return sequence;
  }

  /**
   * Get the current sequence for a shard.
   * @param {string} shardId
   * @returns {number}
   */
  get(shardId) {
    return this._sequences.get(shardId) || this._initial;
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { ShardVectorClock };
