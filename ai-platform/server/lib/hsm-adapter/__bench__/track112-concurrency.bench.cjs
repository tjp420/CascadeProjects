"use strict";

const WorkerPool = require("../track112/worker-pool.cjs");
const PoRepVerifier = require("../track112/poRep-verifier.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");
const crypto = require("crypto");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest();
}
function buildMerkleRoot(leaves) {
  let level = leaves.map((l) => sha256(Buffer.from(l)));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : Buffer.alloc(32, 0);
      next.push(sha256(Buffer.concat([a, b])));
    }
    level = next;
  }
  return level[0].toString("hex");
}

async function runBench({ concurrency = 4, jobs = 500 } = {}) {
  hsmMetrics.reset();
  const pool = new WorkerPool({ concurrency, queueSize: 1024 });
  const verifier = new PoRepVerifier();
  const leaves = Array.from({ length: 8 }).map((_, i) => `leaf-${i}`);
  const root = buildMerkleRoot(leaves);
  const index = 3;
  let level = leaves.map((l) => sha256(Buffer.from(l)));
  const path = [];
  let idx = index;
  while (level.length > 1) {
    const siblingIndex = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling =
      siblingIndex < level.length ? level[siblingIndex] : Buffer.alloc(32, 0);
    path.push(sibling.toString("hex"));
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : Buffer.alloc(32, 0);
      next.push(sha256(Buffer.concat([a, b])));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }

  const proof = {
    root,
    challenges: [
      { index, leaf: Buffer.from(leaves[index]).toString("hex"), path },
    ],
  };

  const latencies = new Array(jobs);
  const start = Date.now();
  let completed = 0;

  return new Promise((resolve) => {
    for (let i = 0; i < jobs; i++) {
      const submittedAt = Date.now();
      pool.submit(async () => {
        await verifier.verify(proof);
        const t1 = Date.now();
        latencies[i] = t1 - submittedAt;
        completed += 1;
        if (completed === jobs) {
          const totalMs = Date.now() - start;
          const throughput = (jobs / (totalMs / 1000)).toFixed(2);
          latencies.sort((a, b) => a - b);
          const p50 =
            latencies[Math.floor(jobs * 0.5) - 1] ||
            latencies[latencies.length - 1];
          const p95 =
            latencies[Math.floor(jobs * 0.95) - 1] ||
            latencies[latencies.length - 1];
          const p99 =
            latencies[Math.floor(jobs * 0.99) - 1] ||
            latencies[latencies.length - 1];
          const metrics = hsmMetrics.getMetrics();
          const workerH = metrics.hsm_track112_worker_duration_ms_count || 0;
          const proofH = metrics.hsm_track112_proof_duration_ms_count || 0;
          console.log(
            JSON.stringify({
              jobs,
              concurrency,
              totalMs,
              throughput: Number(throughput),
              p50,
              p95,
              p99,
              worker_completed:
                metrics.hsm_track112_worker_task_done_total || 0,
              worker_duration_count: workerH,
              proof_verified: metrics.hsm_track112_proofs_verified_total || 0,
              proof_duration_count: proofH,
            }),
          );
          pool.stop();
          resolve({ totalMs, throughput, p95, latencies });
        }
      });
    }
  });
}

(async function main() {
  console.log("Starting Track112 concurrency bench...");
  await runBench({ concurrency: 4, jobs: 500 });
})();
