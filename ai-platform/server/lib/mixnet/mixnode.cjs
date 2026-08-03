const { createDRBG } = require('./drbg.cjs');
const crypto = require('crypto');
const { unwrapLayer } = require('./crypto.cjs');
const { nativeShuffle, _hasNative } = require('./native/index.cjs');

let _nativeWarningEmitted = false;

class MixNode {
  constructor(opts = {}) {
    this.id = opts.id || 'node-0';
    this.threshold = Number.isInteger(opts.threshold) && opts.threshold > 0 ? opts.threshold : 10;
    this.epochMs = Number.isInteger(opts.epochMs) && opts.epochMs >= 100 ? opts.epochMs : 5000;
    this.jitterMs = Number.isInteger(opts.jitterMs) && opts.jitterMs >= 0 ? opts.jitterMs : 200;
    if (this.jitterMs > this.epochMs) this.jitterMs = Math.min(this.jitterMs, this.epochMs);
    this.buffer = [];
    this.drbg = createDRBG(opts.seed || `mixnode-${this.id}`);
    this.next = opts.next || null; // callback or next MixNode
    this.timer = null;
    this.epochStart = null;
    // metrics for timed-pool behavior
    this.metrics = {
      flushCount: 0,
      totalPackets: 0,
      jitterSamples: [],
      lastFlushAt: null
    };
    // long-term symmetric node key derived from seed (simulate private key)
    const seed = opts.seed || this.id;
    this.nodeKey = crypto.createHash('sha256').update(String(seed)).digest(); // 32 bytes
  }

  submitPacket(pkt) {
    // pkt is expected to be an object {id, payload}
    this.buffer.push(pkt);
    this.metrics.totalPackets += 1;
    if (this.buffer.length >= this.threshold) return this.flush();
    if (!this.timer) this._startTimer();
    return Promise.resolve();
  }

  _startTimer() {
    this.epochStart = Date.now();
    this.timer = setTimeout(() => this.flush(), this.epochMs);
  }

  async flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.buffer.length === 0) return [];
    // swap buffer
    const batch = this.buffer.splice(0, this.buffer.length);
    // deterministic shuffle using DRBG-driven seed + native zero-copy shuffle when available
    const shuffled = this._shuffleBatch(batch);

    // perform real layer unwrap
    const processed = shuffled.map(pkt => {
      const peeled = this._peelLayer(pkt.payload);
      if (peeled && peeled.error) {
        // uniform rejection: create a dummy to pass downstream
        return { id: pkt.id, payload: Buffer.alloc(0), dropped: true };
      }
      // peeled.payload is Buffer of inner layer; next token tells route
      return { id: pkt.id, payload: peeled.payload, next: peeled.next };
    });

    // simulate jittered release: choose jitter in [0, jitterMs]
    const jitter = this.jitterMs > 0 ? this.drbg.randomInt(this.jitterMs + 1) : 0;
    this.metrics.jitterSamples.push(jitter);
    // record flush event
    this.metrics.flushCount += 1;
    this.metrics.lastFlushAt = Date.now();

    if (jitter > 0) {
      await new Promise(resolve => setTimeout(resolve, jitter));
    }

    // forward to next if provided
    if (this.next) {
      if (typeof this.next.submitBatch === 'function') {
        await this.next.submitBatch(processed);
      } else if (typeof this.next === 'function') {
        await this.next(processed);
      } else if (Array.isArray(this.next.buffer)) {
        for (const p of processed) this.next.buffer.push(p);
      }
    }
    return processed;
  }

  // synchronous flush helper used in tests
  flushSync() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.buffer.length === 0) return [];
    const batch = this.buffer.splice(0, this.buffer.length);
    const shuffled = this._shuffleBatch(batch);
    const processed = shuffled.map(pkt => {
      const peeled = this._peelLayer(pkt.payload);
      if (peeled && peeled.error) return { id: pkt.id, payload: Buffer.alloc(0), dropped: true };
      return { id: pkt.id, payload: peeled.payload, next: peeled.next };
    });

    // forward synchronously to next node if present
    if (this.next) {
      if (Array.isArray(this.next.buffer)) {
        for (const p of processed) this.next.buffer.push(p);
      } else if (typeof this.next === 'function') {
        this.next(processed);
      }
    }

    return processed;
  }

  async submitBatch(batch) {
    // accept an incoming batch (already partially decrypted), re-buffer and flush downstream
    for (const p of batch) this.buffer.push(p);
    if (this.buffer.length >= this.threshold) return this.flush();
    if (!this.timer) this._startTimer();
    return Promise.resolve();
  }

  _peelLayer(payloadBuf) {
    // payloadBuf is a Buffer containing one onion layer produced by wrapOnionPayload
    // Ensure unwrapLayer runs with uniform timing via its internal dummy workload.
    try {
      const res = unwrapLayer(payloadBuf, this.nodeKey);
      if (!res.ok) {
        // uniform rejection — return a special marker
        return { error: true, reason: 'auth_failed' };
      }
      // res contains { next, payload }
      return { error: false, next: res.next, payload: res.payload };
    } catch (err) {
      // unwrapLayer already performs dummy work on error paths; maintain contract.
      return { error: true, reason: 'parse_error' };
    }
  }

  _shuffleBatch(batch) {
    const n = batch.length;
    if (n <= 1) return batch.slice();

    // build an indices Uint32Array zero-copy view
    const indices = new Uint32Array(n);
    for (let i = 0; i < n; i++) indices[i] = i;

    // derive a seed from DRBG for deterministic behavior
    let seed = 0;
    try { seed = this.drbg.randomInt(0xFFFFFFFF); } catch (e) { seed = Date.now(); }

    try {
      if (!_hasNative && !_nativeWarningEmitted) {
        // warn once that native addon isn't present
        console.warn('mixnet: native shuffle addon not available; using JS fallback');
        _nativeWarningEmitted = true;
      }
      // nativeShuffle will perform fallback JS shuffle if native addon not present
      nativeShuffle(indices, seed);
    } catch (err) {
      // fallback: simple Fisher-Yates on indices
      let s = seed >>> 0;
      function rnd() {
        // xorshift32
        s ^= s << 13;
        s = s >>> 0;
        s ^= s >>> 17;
        s ^= s << 5;
        return s >>> 0;
      }
      for (let i = n - 1; i > 0; --i) {
        const j = rnd() % (i + 1);
        const tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
      }
    }

    // apply permutation to produce a new shuffled array of packet refs
    const out = new Array(n);
    for (let k = 0; k < n; k++) out[k] = batch[indices[k]];
    return out;
  }
}

module.exports = MixNode;
