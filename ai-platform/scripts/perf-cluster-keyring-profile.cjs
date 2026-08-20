#!/usr/bin/env node
"use strict";

/**
 * Cluster Keyring Sync Load Profile Simulation (Option E)
 *
 * Stress-tests the cluster keyring mesh under four core saturation vectors:
 *   1. DKG message saturation — high-frequency _handleDkgMessage throughput
 *   2. Concurrent epoch drift — staggered _validateIncomingEpoch validation
 *   3. Threshold signature load — repeated aggregateVerifiedPartialShares cycles
 *   4. Output manifest — operational latency and memory/heap telemetry
 *
 * Run with:
 *   node ai-platform/scripts/perf-cluster-keyring-profile.cjs
 *
 * Optional: enable explicit GC for Phase 3 heap telemetry:
 *   node --expose-gc ai-platform/scripts/perf-cluster-keyring-profile.cjs
 */

// Suppress cluster-keyring info/warn chatter during profiling
process.env.LOG_LEVEL = "error";

const crypto = require("crypto");
const os = require("os");
const path = require("path");
const fs = require("fs");
const v8 = require("v8");

// ── Environment setup (mirrors the Jest load test harness) ──────────────────
process.env.NODE_ID = "node-1";
process.env.CLUSTER_NODES = "127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002";
process.env.KEY_ROTATION_STORE_PATH = path.join(
  os.tmpdir(),
  "sb-perf-key-state.json",
);
process.env.AUDIT_LOG_PATH = path.join(os.tmpdir(), "sb-perf-audit.json");
process.env.AUDIT_LOG_SCRUB_PII = "false";
fs.writeFileSync(
  process.env.AUDIT_LOG_PATH,
  JSON.stringify({ entries: {} }),
  "utf8",
);

const clusterSync = require("../server/lib/cluster-keyring-sync.cjs");
const {
  createPrng,
  prngHex,
  createMockSocketPool,
  createMockDkgEngine,
  createDkgMessageFactory,
} = require("../server/lib/__tests__/cluster-keyring-sync-load-harness.cjs");

const {
  SchnorrThresholdAggregator,
} = require("../server/lib/mpc/schnorr/protocol.cjs");
const {
  SchnorrShareEvaluator,
} = require("../server/lib/mpc/schnorr/signature_share.cjs");

// ── Lightweight helpers ─────────────────────────────────────────────────────

function now() {
  return process.hrtime.bigint();
}

function ms(start, end) {
  return Number((end - start) / 1000000n);
}

function percentile(sorted, p) {
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function snapshotMemory() {
  return process.memoryUsage();
}

function snapshotHeap() {
  return v8.getHeapStatistics();
}

function tryGc() {
  if (typeof global.gc === "function") {
    global.gc();
    return true;
  }
  return false;
}

function makeSocket(remoteAddress = "127.0.0.1", remotePort = 7001) {
  return {
    remoteAddress,
    remotePort,
    destroyed: false,
    write: () => true,
    on: () => {},
    destroy: function () {
      this.destroyed = true;
    },
  };
}

function resetAll() {
  clusterSync._resetEvents();
  clusterSync._resetDkgSession();
  clusterSync._resetEpochState();
  clusterSync._resetEpoch();
}

function report(name, stats) {
  console.log("\n" + "=".repeat(60));
  console.log(name);
  console.log("=".repeat(60));
  for (const [k, v] of Object.entries(stats)) {
    if (typeof v === "number" && !Number.isInteger(v)) {
      console.log(`  ${k}: ${v.toFixed(3)}`);
    } else if (typeof v === "object" && v !== null) {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    } else {
      console.log(`  ${k}: ${v}`);
    }
  }
}

// ── Phase 1: DKG Message Saturation ─────────────────────────────────────────

function phase1DkgSaturation() {
  resetAll();

  const nodeIds = ["node-1", "node-2", "node-3"];
  const dkgEngine = createMockDkgEngine(nodeIds, 2, "perf-dkg-seed");
  const session = clusterSync.initDkgSession({
    dkgEngine,
    nodeId: "node-1",
    onLeaderBroadcast: () => {},
    onShareToPeer: () => {},
  });

  const prng = createPrng("perf-dkg-flood-seed");
  const factory = createDkgMessageFactory(prng, session.sessionId, nodeIds);
  const iterations = 5000;
  const latencies = [];

  // rotate across peer ports to avoid unknown-peer rejections
  const ports = [7000, 7001, 7002];

  const memBefore = snapshotMemory();
  const start = now();

  for (let i = 0; i < iterations; i++) {
    const typeIdx = Number(prng() % 3n);
    let msg;
    if (typeIdx === 0) msg = factory.commit("node-1");
    else if (typeIdx === 1) msg = factory.share("node-1", "node-2");
    else msg = factory.complaint("node-1", "node-2");
    msg.epoch = i % 10;

    const socket = makeSocket("127.0.0.1", ports[i % ports.length]);
    const t0 = now();
    clusterSync._handleDkgMessage(msg, socket);
    const t1 = now();
    latencies.push(ms(t0, t1));
  }

  const end = now();
  const memAfter = snapshotMemory();

  latencies.sort((a, b) => a - b);
  const totalMs = ms(start, end);

  report("Phase 1: DKG Message Saturation", {
    iterations,
    totalMs,
    throughputOpsPerSec: ((iterations / totalMs) * 1000).toFixed(2),
    p50LatMs: percentile(latencies, 50).toFixed(3),
    p95LatMs: percentile(latencies, 95).toFixed(3),
    p99LatMs: percentile(latencies, 99).toFixed(3),
    maxLatMs: latencies[latencies.length - 1].toFixed(3),
    rssDeltaMb: ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2),
    heapTotalDeltaMb: (
      (memAfter.heapTotal - memBefore.heapTotal) /
      1024 /
      1024
    ).toFixed(2),
  });

  return { totalMs, throughput: (iterations / totalMs) * 1000 };
}

// ── Phase 2: Concurrent Epoch Drift Simulation ──────────────────────────────

function phase2EpochDrift() {
  resetAll();

  const iterations = 10000;
  const peerPorts = 10;
  const baseEpoch = 100;
  const latencies = [];
  const accepted = { true: 0, false: 0 };

  const memBefore = snapshotMemory();
  const start = now();

  for (let i = 0; i < iterations; i++) {
    const peer = `127.0.0.1:${7000 + (i % peerPorts)}`;
    const drift = i % 7; // 0..6 staggered drift
    const msg = {
      type: "HEARTBEAT",
      from: "node-1",
      epoch: baseEpoch + drift,
      leaderId: "node-1",
      activeFingerprint: "a",
      previousFingerprint: "b",
      rotatedAt: Date.now(),
    };
    const t0 = now();
    const ok = clusterSync._validateIncomingEpoch(msg, peer);
    const t1 = now();
    latencies.push(ms(t0, t1));
    accepted[ok] = (accepted[ok] || 0) + 1;
  }

  const end = now();
  const memAfter = snapshotMemory();

  latencies.sort((a, b) => a - b);
  const totalMs = ms(start, end);

  report("Phase 2: Concurrent Epoch Drift Simulation", {
    iterations,
    accepted,
    totalMs,
    throughputOpsPerSec: ((iterations / totalMs) * 1000).toFixed(2),
    p50LatMs: percentile(latencies, 50).toFixed(3),
    p95LatMs: percentile(latencies, 95).toFixed(3),
    p99LatMs: percentile(latencies, 99).toFixed(3),
    maxLatMs: latencies[latencies.length - 1].toFixed(3),
    rssDeltaMb: ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2),
  });

  return { totalMs, throughput: (iterations / totalMs) * 1000 };
}

// ── Phase 3: Threshold Signature Load Matrix ────────────────────────────────

function phase3ThresholdSignature() {
  // Small prime subgroup (p=23, q=11, g=2) from the schnorr test suite
  const p = 23n;
  const q = 11n;
  const g = 2n;
  const aggregator = new SchnorrThresholdAggregator(p, q, g);
  const evaluator = new SchnorrShareEvaluator(p, q);

  const challenge = 2n;
  const binding = 3n;
  const nodeCount = 6;
  const keyShares = Array.from(
    { length: nodeCount },
    (_, i) => BigInt(i + 1) % q,
  );
  const k1s = Array.from({ length: nodeCount }, (_, i) => BigInt(i + 2) % q);
  const k2s = Array.from({ length: nodeCount }, (_, i) => BigInt(i + 3) % q);
  const pubKeys = keyShares.map((x) =>
    aggregator.field.exp(aggregator.generator, x),
  );
  const publicNonce1s = k1s.map((k) =>
    aggregator.field.exp(aggregator.generator, k),
  );
  const publicNonce2s = k2s.map((k) =>
    aggregator.field.exp(aggregator.generator, k),
  );

  const partialShares = keyShares.map((x, i) =>
    evaluator.evaluatePartialShare({
      challenge,
      secretKeyShare: x,
      lagrangeWeight: 1n,
      secretNonces: { k1: k1s[i], k2: k2s[i] },
      bindingFactor: binding,
    }),
  );

  const iterations = 2000;
  const latencies = [];
  const gcBefore = snapshotHeap();
  const memBefore = snapshotMemory();

  const explicitGc = tryGc();
  const start = now();

  for (let i = 0; i < iterations; i++) {
    const t0 = now();
    aggregator.aggregateVerifiedPartialShares({
      tenantId: "perf-tenant",
      sessionId: "perf-session",
      partialShares,
      threshold: 2,
      publicKeys: pubKeys,
      publicNonce1s,
      publicNonce2s,
      challenges: partialShares.map(() => challenge),
      lagrangeWeights: partialShares.map(() => 1n),
      bindingFactors: partialShares.map(() => binding),
    });
    const t1 = now();
    latencies.push(ms(t0, t1));

    // periodic explicit GC to measure churn
    if (explicitGc && i % 500 === 0 && i > 0) {
      global.gc();
    }
  }

  const end = now();
  const gcAfter = snapshotHeap();
  const memAfter = snapshotMemory();

  latencies.sort((a, b) => a - b);
  const totalMs = ms(start, end);

  report("Phase 3: Threshold Signature Load Matrix", {
    iterations,
    totalMs,
    throughputOpsPerSec: ((iterations / totalMs) * 1000).toFixed(2),
    p50LatMs: percentile(latencies, 50).toFixed(3),
    p95LatMs: percentile(latencies, 95).toFixed(3),
    p99LatMs: percentile(latencies, 99).toFixed(3),
    maxLatMs: latencies[latencies.length - 1].toFixed(3),
    explicitGcEnabled: explicitGc,
    heapUsedBeforeMb: (gcBefore.used_heap_size / 1024 / 1024).toFixed(2),
    heapUsedAfterMb: (gcAfter.used_heap_size / 1024 / 1024).toFixed(2),
    rssDeltaMb: ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2),
  });

  return { totalMs, throughput: (iterations / totalMs) * 1000 };
}

// ── Phase 4: Actionable Output Manifest ─────────────────────────────────────

function phase4Manifest(p1, p2, p3) {
  console.log("\n" + "#".repeat(60));
  console.log("Phase 4: Actionable Output Manifest");
  console.log("#".repeat(60));
  console.log(
    `  DKG saturation throughput:        ${p1.throughput.toFixed(2)} ops/s`,
  );
  console.log(
    `  Epoch drift throughput:           ${p2.throughput.toFixed(2)} ops/s`,
  );
  console.log(
    `  Threshold signature throughput:   ${p3.throughput.toFixed(2)} ops/s`,
  );

  const mem = snapshotMemory();
  const heap = snapshotHeap();
  console.log("\n  Memory / heap snapshot (post-run):");
  console.log(`    rss:          ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `    heapUsed:     ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(
    `    heapTotal:    ${(heap.total_heap_size / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(
    `    heapLimit:    ${(heap.heap_size_limit / 1024 / 1024).toFixed(2)} MB`,
  );

  console.log("\n  Deployment sizing recommendations:");
  console.log(
    `    - Memory ceiling observed: ~${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(
    `    - Thread/worker allocation: proportional to DKG throughput target`,
  );
  console.log(
    `    - GC pressure: ${heap.used_heap_size / heap.heap_size_limit < 0.5 ? "LOW" : "MODERATE"}`,
  );
  console.log(
    "    - Threshold signing is CPU-bound by PrimeField.exp; consider worker pool for >1 kops/s",
  );
}

// ── Main driver ─────────────────────────────────────────────────────────────

function main() {
  console.log("Cluster Keyring Sync Load Profile Simulation");
  console.log(
    `PID: ${process.pid} | Node: ${process.version} | Platform: ${process.platform}`,
  );

  const p1 = phase1DkgSaturation();
  const p2 = phase2EpochDrift();
  const p3 = phase3ThresholdSignature();
  phase4Manifest(p1, p2, p3);
}

main();
