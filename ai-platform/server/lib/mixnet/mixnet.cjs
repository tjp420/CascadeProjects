const MixNode = require('./mixnode.cjs');

class Mixnet {
  constructor(count = 3, opts = {}) {
    this.nodes = [];
    for (let i = 0; i < count; i++) {
      this.nodes.push(new MixNode({ id: `node-${i}`, seed: `${opts.seed || 'mixnet-seed'}-${i}`, threshold: opts.threshold || 8, epochMs: opts.epochMs || 2000 }));
    }
    // wire nodes sequentially
    for (let i = 0; i < this.nodes.length - 1; i++) {
      this.nodes[i].next = this.nodes[i + 1];
    }
    // final sink: collect output
    this.sink = [];
    this.nodes[this.nodes.length - 1].next = async (batch) => {
      // final deliver
      for (const p of batch) this.sink.push(p);
    };
    // aggregate metrics
    this.metrics = {
      getNodeMetrics: () => this.nodes.map(n => ({ id: n.id, metrics: n.metrics }))
    };
  }

  async submitPacket(pkt) {
    return this.nodes[0].submitPacket(pkt);
  }

  // convenience to flush all nodes synchronously (test/inspection)
  flushAllSync() {
    // Call each node's flushSync. flushSync forwards synchronously to next.
    for (const n of this.nodes) n.flushSync();
    return this.sink.slice();
  }

  resetSink() { this.sink = []; }

  getMetrics() {
    return this.nodes.map(n => ({ id: n.id, metrics: n.metrics }));
  }
}

module.exports = Mixnet;
