'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const { incrementCounter } = require('../hsm-adapter/hsm-metrics.cjs');

// Default labels attached to every repair metric
function labelsFor(payload) {
  return {
    tenantId: String(payload.tenantId || 'unknown'),
    shardId: String(payload.shardId || 'unknown'),
    worker: 'RepairWorker'
  };
}

function isSafeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9-_]+$/.test(id);
}

function validateTenantScope(payload) {
  if (!isSafeId(payload.tenantId)) throw new Error('TRACK123_INVALID_TENANT');
  if (!isSafeId(payload.shardId)) throw new Error('TRACK123_INVALID_SHARD');
}

function validateEnvelope(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('TRACK123_MISSING_PAYLOAD');
  if (payload.encrypted) {
    const { cipher, iv, authTag } = payload;
    if (typeof cipher !== 'string' || cipher.length === 0) throw new Error('TRACK123_MISSING_CIPHER');
    if (typeof iv !== 'string' || iv.length === 0) throw new Error('TRACK123_MISSING_IV');
    if (typeof authTag !== 'string' || authTag.length === 0) throw new Error('TRACK123_MISSING_AUTH_TAG');
    // Minimum sanity for AES-256-GCM components (base64 lengths)
    if (Buffer.from(iv, 'base64').length !== 12) throw new Error('TRACK123_INVALID_IV');
    if (Buffer.from(authTag, 'base64').length !== 16) throw new Error('TRACK123_INVALID_AUTH_TAG');
  }
}

class RepairWorker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.emitter = opts.emitter;
    this.repairJitterMs = Number(opts.repairJitterMs ?? 1000);
    this.processingTimeMs = Number(opts.processingTimeMs ?? 50);
    this.store = opts.store; // { fetchState, applyEntries }
    this.activeRepairs = new Map();

    // Testing hooks / observability
    this.scheduledDelays = [];
    this.processed = [];
    this.errors = [];

    if (this.emitter) {
      this.emitter.on('shard:reconciler:reconcile_requested', (p) => this.handle(p));
      this.emitter.on('reconcile:requested', (p) => this.handle(p));
    }
  }

  keyFor(payload) {
    validateTenantScope(payload);
    return `${payload.tenantId}:${payload.shardId}:${payload.rotatedAt || 0}`;
  }

  handle(payload = {}) {
    try {
      validateEnvelope(payload);
      incrementCounter('hsm_shard_reconciler_envelope_validated_total');
      validateTenantScope(payload);
    } catch (err) {
      this.emit('error', err);
      if (err.message.startsWith('TRACK123_MISSING_') || err.message.startsWith('TRACK123_INVALID_')) {
        incrementCounter('hsm_shard_reconciler_envelope_rejected_total');
      }
      incrementCounter('hsm_repair_worker_rejected_total');
      return;
    }

    const key = this.keyFor(payload);
    if (this.activeRepairs.has(key)) {
      this.emit('repair:skipped', { key, payload });
      incrementCounter('hsm_shard_reconciler_repair_skipped_total', 1, labelsFor(payload));
      return;
    }

    this.activeRepairs.set(key, true);

    const jitterMax = Number(payload.repairJitterMs || this.repairJitterMs || 0);
    const delay = jitterMax === 0 ? 0 : Math.floor(Math.random() * (jitterMax + 1));
    this.scheduledDelays.push(delay);

    incrementCounter('hsm_repair_worker_started_total', 1, labelsFor(payload));

    setTimeout(async () => {
      try {
        this.emit('repair:started', { key, payload, delay });
        const result = await this.executeRepair(payload);
        this.processed.push({ key, payload });
        this.emit('repair:completed', { key, payload, result });
        this.emit('shard:reconciler:repair_completed', { key, payload, result });
        incrementCounter('hsm_repair_worker_completed_total', 1, labelsFor(payload));
      } catch (err) {
        this.errors.push({ key, payload, err });
        this.emit('repair:failed', { key, payload, err });
        this.emit('error', err);
        incrementCounter('hsm_repair_worker_failed_total', 1, labelsFor(payload));
      } finally {
        this.activeRepairs.delete(key);
      }
    }, delay);
  }

  async executeRepair(payload) {
    const jitterMax = Number(payload.repairJitterMs || this.repairJitterMs || 0);
    const delay = jitterMax === 0 ? 0 : Math.floor(Math.random() * (jitterMax + 1));
    await new Promise((res) => setTimeout(res, this.processingTimeMs + delay));

    if (!this.store) {
      return { ok: true, applied: 0 };
    }

    const state = await this.store.fetchState({
      tenantId: payload.tenantId,
      shardId: payload.shardId
    });

    const lastSeq = Number(state && state.lastSeq);
    const fromSeq = Number(payload.fromSeq);
    const toSeq = Number(payload.toSeq);

    if (Number.isNaN(fromSeq) || Number.isNaN(toSeq) || fromSeq > toSeq) {
      throw new Error('TRACK123_INVALID_SEQ_RANGE');
    }

    if (fromSeq !== lastSeq + 1) {
      incrementCounter('hsm_shard_reconciler_repair_seq_rejected_total');
      throw new Error('TRACK123_NON_MONOTONIC_SEQ');
    }

    incrementCounter('hsm_shard_reconciler_repair_seq_validated_total');

    const entries = [];
    for (let seq = fromSeq; seq <= toSeq; seq += 1) {
      entries.push({ seq });
    }

    await this.store.applyEntries({
      tenantId: payload.tenantId,
      shardId: payload.shardId
    }, entries, payload);

    return { ok: true, applied: entries.length };
  }
}

module.exports = { RepairWorker, validateEnvelope, validateTenantScope };
