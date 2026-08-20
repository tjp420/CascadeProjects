const { createDRBG } = require("./drbg.cjs");
const crypto = require("crypto");
const { unwrapLayer } = require("./crypto.cjs");

class MixNode {
  constructor(opts = {}) {
    this.id = opts.id || "node-0";
    this.threshold =
      Number.isInteger(opts.threshold) && opts.threshold > 0
        ? opts.threshold
        : 10;
    this.epochMs =
      Number.isInteger(opts.epochMs) && opts.epochMs >= 100
        ? opts.epochMs
        : 5000;
    this.jitterMs =
      Number.isInteger(opts.jitterMs) && opts.jitterMs >= 0
        ? opts.jitterMs
        : 200;
    if (this.jitterMs > this.epochMs)
      this.jitterMs = Math.min(this.jitterMs, this.epochMs);
    this.buffer = [];
    this._pendingBatches = []; // tracks in-flight async flush batches
    this.drbg = createDRBG(opts.seed || `mixnode-${this.id}`);
    this.next = opts.next || null; // callback or next MixNode
    this.timer = null;
    this.epochStart = null;
    // metrics for timed-pool behavior
    this.metrics = {
      flushCount: 0,
      totalPackets: 0,
      jitterSamples: [],
      lastFlushAt: null,
    };
    // long-term symmetric node key derived from seed (simulate private key)
    const seed = opts.seed || this.id;
    this.nodeKey = crypto.createHash("sha256").update(String(seed)).digest(); // 32 bytes
  }

  submitPacket(pkt) {
    // pkt is expected to be an object {id, payload}
    this.buffer.push(pkt);
    this.metrics.totalPackets += 1;
    if (this.buffer.length >= this.threshold) {
      // Schedule flush asynchronously so submitPacket stays low-latency
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      setImmediate(() => {
        this.flush().catch((err) =>
          console.error("mixnode: async flush error", err),
        );
      });
      return Promise.resolve();
    }
    if (!this.timer) this._startTimer();
    return Promise.resolve();
  }

  _startTimer() {
    this.epochStart = Date.now();
    this.timer = setTimeout(() => this.flush(), this.epochMs);
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) return [];
    // swap buffer
    const batch = this.buffer.splice(0, this.buffer.length);
    // deterministic shuffle using DRBG
    this.drbg.shuffle(batch);

    // perform real layer unwrap
    const processed = batch.map((pkt) => {
      const peeled = this._peelLayer(pkt.payload);
      if (peeled && peeled.error) {
        // uniform rejection: create a dummy to pass downstream
        return { id: pkt.id, payload: Buffer.alloc(0), dropped: true };
      }
      // peeled.payload is Buffer of inner layer; next token tells route
      return { id: pkt.id, payload: peeled.payload, next: peeled.next };
    });

    // simulate jittered release: choose jitter in [0, jitterMs]
    const jitter =
      this.jitterMs > 0 ? this.drbg.randomInt(this.jitterMs + 1) : 0;
    this.metrics.jitterSamples.push(jitter);
    // record flush event
    this.metrics.flushCount += 1;
    this.metrics.lastFlushAt = Date.now();

    // track in-flight batch so flushSync can drain it if called before jitter completes
    this._pendingBatches.push(processed);

    if (jitter > 0) {
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }

    // forward to next if provided
    if (this.next) {
      // Forward to next node asynchronously to avoid synchronous cascade
      // that blocks the submitter. Use setImmediate to schedule forwarding
      // on the next event-loop tick and surface errors to console.
      const next = this.next;
      setImmediate(() => {
        try {
          if (typeof next.submitBatch === "function") {
            // fire-and-forget promise
            const r = next.submitBatch(processed);
            if (r && typeof r.catch === "function")
              r.catch((err) =>
                console.error("mixnode: forward submitBatch error", err),
              );
          } else if (typeof next === "function") {
            const r = next(processed);
            if (r && typeof r.catch === "function")
              r.catch((err) =>
                console.error("mixnode: forward function error", err),
              );
          } else if (Array.isArray(next.buffer)) {
            for (const p of processed) next.buffer.push(p);
          }
        } catch (err) {
          console.error("mixnode: forward error", err);
        }
      });
    }
    const idx = this._pendingBatches.indexOf(processed);
    if (idx >= 0) this._pendingBatches.splice(idx, 1);
    return processed;
  }

  // synchronous flush helper used in tests
  flushSync() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // drain any in-flight async flush batches so packets are not lost
    if (this._pendingBatches.length > 0) {
      const pending = this._pendingBatches.splice(
        0,
        this._pendingBatches.length,
      );
      for (const batch of pending) {
        if (this.next) {
          if (Array.isArray(this.next.buffer)) {
            for (const p of batch) this.next.buffer.push(p);
          } else if (typeof this.next === "function") {
            this.next(batch);
          }
        }
      }
    }

    if (this.buffer.length === 0) return [];
    const batch = this.buffer.splice(0, this.buffer.length);
    this.drbg.shuffle(batch);
    const processed = batch.map((pkt) => {
      const peeled = this._peelLayer(pkt.payload);
      if (peeled && peeled.error)
        return { id: pkt.id, payload: Buffer.alloc(0), dropped: true };
      return { id: pkt.id, payload: peeled.payload, next: peeled.next };
    });

    // forward synchronously to next node if present
    if (this.next) {
      if (Array.isArray(this.next.buffer)) {
        for (const p of processed) this.next.buffer.push(p);
      } else if (typeof this.next === "function") {
        this.next(processed);
      }
    }

    return processed;
  }

  async submitBatch(batch) {
    // accept an incoming batch (already partially decrypted), re-buffer and flush downstream
    for (const p of batch) this.buffer.push(p);
    if (this.buffer.length >= this.threshold) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      setImmediate(() => {
        this.flush().catch((err) =>
          console.error("mixnode: async flush error", err),
        );
      });
      return Promise.resolve();
    }
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
        return { error: true, reason: "auth_failed" };
      }
      // res contains { next, payload }
      return { error: false, next: res.next, payload: res.payload };
    } catch (err) {
      // unwrapLayer already performs dummy work on error paths; maintain contract.
      return { error: true, reason: "parse_error" };
    }
  }
}

module.exports = MixNode;
