const Mixnet = require("../mixnet.cjs");

// Simple CI acceptance check for MixNode jitter behavior.
// Exits with non-zero code when jitter samples exceed tolerance.

const NODE_COUNT = 3;
const PACKETS = 50;
const THRESHOLD = 5;
const EPOCH_MS = 200; // small epoch for CI
const JITTER_MS = 100; // configured jitter on nodes

async function runCheck() {
  const m = new Mixnet(NODE_COUNT, {
    seed: "ci-seed",
    threshold: THRESHOLD,
    epochMs: EPOCH_MS,
  });
  // set jitter for nodes explicitly
  for (let i = 0; i < m.nodes.length; i++) {
    m.nodes[i].jitterMs = JITTER_MS;
  }

  // send many packets to trigger multiple flushes
  for (let i = 0; i < PACKETS; i++) {
    const payload = Buffer.concat([Buffer.alloc(4), Buffer.from(`pkt-${i}`)]);
    await m.submitPacket({ id: `pkt-${i}`, payload });
  }

  // flush all
  m.flushAllSync();

  const metrics = m.getMetrics();
  let maxJ = 0;
  let totalSamples = 0;
  for (const n of metrics) {
    const samples = n.metrics.jitterSamples || [];
    if (samples.length === 0) {
      console.log(`node ${n.id} had no jitter samples`);
      continue;
    }
    const localMax = Math.max(...samples);
    maxJ = Math.max(maxJ, localMax);
    totalSamples += samples.length;
    console.log(
      `node ${n.id} samples: count=${samples.length} max=${localMax} avg=${(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2)}`,
    );
  }

  console.log(`global max jitter=${maxJ}ms (configured jitterMs=${JITTER_MS})`);
  const allowed = Number(process.env.MAX_JITTER_MS || JITTER_MS);

  const report = {
    nodeCount: metrics.length,
    totalSamples,
    maxJitterObserved: maxJ,
    allowedJitter: allowed,
    perNode: metrics,
  };
  const outPath = require("path").join(__dirname, "jitter_metrics.json");
  require("fs").writeFileSync(outPath, JSON.stringify(report, null, 2));

  if (maxJ > allowed) {
    console.error(`JITTER VIOLATION: max ${maxJ} > allowed ${allowed}`);
    process.exit(2);
  }
  console.log("jitter check passed");
}

runCheck().catch((err) => {
  console.error(err);
  process.exit(1);
});
