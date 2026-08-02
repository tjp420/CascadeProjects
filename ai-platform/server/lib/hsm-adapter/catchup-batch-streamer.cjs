'use strict';

/**
 * Track 33: Catch-up batch streamer.
 *
 * Sliding-window chunk delivery engine. Computes batch ranges and
 * drives the coordinator's ack/retry loop with exponential back-off.
 *
 * @module hsm-adapter/catchup-batch-streamer
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

class CatchUpBatchStreamer {
  /**
   * @param {object} options
   * @param {Function} [options.deliver] - async (from, to, session) => boolean
   * @param {boolean} [options.requireBftCatchUpAck]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.deliver = options.deliver || null;
    this.requireBftCatchUpAck = options.requireBftCatchUpAck !== false;
    this._audit = options.audit || null;
  }

  /**
   * Drive a recovery session to completion.
   * @param {object} session
   * @param {ClusterRecoveryCoordinator} coordinator
   * @returns {Promise<object>}
   */
  async stream(session, coordinator) {
    if (!coordinator) {
      throw new HsmAdapterError('INVALID_INPUT', 'coordinator is required');
    }

    while (!session.completed) {
      const { from, to, size } = coordinator.nextBatchRange(session.sessionId);
      if (size <= 0) {
        coordinator.ackBatch(session.sessionId, 0);
        break;
      }

      this._emitAudit('CATCH_UP_BATCH_STREAMED', {
        sessionId: session.sessionId,
        nodeId: session.nodeId,
        shardId: session.shardId,
        from,
        to,
        size,
      });

      let delivered = false;
      if (this.deliver) {
        try {
          delivered = await this.deliver(from, to, session);
        } catch (err) {
          delivered = false;
        }
      } else {
        delivered = true;
      }

      if (delivered) {
        if (this.requireBftCatchUpAck) {
          // Simulate BFT ack quorum check before advancing.
          const ack = this._simulateBftAck(session, from, to);
          if (!ack) {
            coordinator.failBatch(session.sessionId);
            await this._sleep(session.nextBackOffMs);
            continue;
          }
        }
        coordinator.ackBatch(session.sessionId, size);
      } else {
        coordinator.failBatch(session.sessionId);
        await this._sleep(session.nextBackOffMs);
      }
    }

    return session;
  }

  _simulateBftAck(session, from, to) {
    // Deterministic placeholder: ack succeeds unless mocked to fail.
    return true;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { CatchUpBatchStreamer };
