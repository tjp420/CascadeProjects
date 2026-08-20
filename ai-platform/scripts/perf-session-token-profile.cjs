#!/usr/bin/env node
"use strict";

/**
 * Session Token Replication Load Profile (Option A)
 *
 * Stress-tests the distributed session-token state machine under four
 * catastrophic infrastructure vectors:
 *   1. Concurrent login burst storm
 *   2. Asymmetric network partition during revoke storm
 *   3. Quorum node death + delta bootstrap recovery
 *   4. Actionable deployment sizing manifest
 *
 * Usage:
 *   node ai-platform/scripts/perf-session-token-profile.cjs
 *
 * Tweak scale with env vars:
 *   LOGIN_BURST_COUNT=1000 REVOKE_BURST_COUNT=1000 node perf-session-token-profile.cjs
 */

process.env.LOG_LEVEL = "error";

const crypto = require("crypto");
const os = require("os");
const path = require("path");
const fs = require("fs");
const v8 = require("v8");

// Mirror the Jest harness environment so cluster-keyring-sync loads cleanly
process.env.NODE_ID = "node-1";
process.env.CLUSTER_NODES = "127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002";
process.env.KEY_ROTATION_STORE_PATH = path.join(
  os.tmpdir(),
  "sb-session-token-key-state.json",
);
process.env.AUDIT_LOG_PATH = path.join(
  os.tmpdir(),
  "sb-session-token-audit.json",
);
process.env.AUDIT_LOG_SCRUB_PII = "false";
fs.writeFileSync(
  process.env.AUDIT_LOG_PATH,
  JSON.stringify({ entries: {} }),
  "utf8",
);

const replicator = require("../server/lib/session-token-replicator.cjs");
const tokenStore = require("../server/lib/token-store-adapter.cjs");

// ── Configurable scale knobs ────────────────────────────────────────────────
const LOGIN_BURST_COUNT = parseInt(process.env.LOGIN_BURST_COUNT || "1000", 10);
const REVOKE_BURST_COUNT = parseInt(
  process.env.REVOKE_BURST_COUNT || "1000",
  10,
);
const DELTA_TOKEN_COUNT = parseInt(process.env.DELTA_TOKEN_COUNT || "200", 10);
const TENANT = "perf-tenant";
const ACCOUNT = "perf-account";

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

async function resetRegistry() {
  // Re-initialize a clean token registry for each phase
  const dbPath = path.join(
    __dirname,
    "..",
    "server",
    "db",
    "token-registry.json",
  );
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(
    dbPath,
    JSON.stringify(
      {
        accounts: [],
        access_tokens: [],
        session_tokens: [],
        refresh_tokens: [],
        device_keys: [],
        recovery_factors: [],
        recovery_attempts: [],
        token_blocklist: [],
        license_tokens: [],
        audit_log: [],
      },
      null,
      2,
    ),
  );

  const store = await tokenStore.getStore();
  if (store.client && typeof store.client.flushdb === "function") {
    await store.client.flushdb();
  }
}

// ── Phase 1: Concurrent Login Burst Storm ───────────────────────────────────

async function phase1LoginBurst() {
  await resetRegistry();
  replicator.setBroadcast(() => {});
  const latencies = [];
  const memBefore = snapshotMemory();
  const explicitGc = tryGc();
  const start = now();

  // Fire all logins as fast as the file queue will accept them.
  const promises = [];
  for (let i = 0; i < LOGIN_BURST_COUNT; i++) {
    const tokenHash = crypto.randomUUID();
    const t0 = now();
    promises.push(
      replicator
        .issueToken({
          tokenHash,
          accountId: ACCOUNT,
          tenantId: TENANT,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        })
        .then((r) => {
          const t1 = now();
          latencies.push(ms(t0, t1));
          return r;
        }),
    );
  }
  await Promise.all(promises);

  const end = now();
  const memAfter = snapshotMemory();

  latencies.sort((a, b) => a - b);
  const totalMs = ms(start, end);
  const accepted = (
    await (await tokenStore.getStore()).findSessionTokensByTenant(TENANT)
  ).length;

  report("Phase 1: Concurrent Login Burst Storm", {
    requested: LOGIN_BURST_COUNT,
    accepted,
    totalMs,
    throughputOpsPerSec: ((LOGIN_BURST_COUNT / totalMs) * 1000).toFixed(2),
    p50LatMs: percentile(latencies, 50).toFixed(3),
    p95LatMs: percentile(latencies, 95).toFixed(3),
    p99LatMs: percentile(latencies, 99).toFixed(3),
    maxLatMs: latencies[latencies.length - 1].toFixed(3),
    explicitGcEnabled: explicitGc,
    rssDeltaMb: ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2),
  });

  return { totalMs, throughput: (LOGIN_BURST_COUNT / totalMs) * 1000 };
}

// ── Phase 2: Asymmetric Network Partition & Revoke Storm ────────────────────

async function phase2PartitionedRevoke() {
  await resetRegistry();
  replicator.setBroadcast(() => {});

  // Seed tokens
  const tokenHashes = [];
  for (let i = 0; i < REVOKE_BURST_COUNT; i++) {
    const tokenHash = crypto.randomUUID();
    tokenHashes.push(tokenHash);
    await replicator.issueToken({
      tokenHash,
      accountId: ACCOUNT,
      tenantId: TENANT,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
  }

  // Simulate a broadcast fabric where 30% of "sockets" are dead
  const broadcastLog = [];
  const failures = [];
  replicator.setBroadcast((msg) => {
    broadcastLog.push(msg);
    if (Math.random() < 0.3) {
      failures.push({ msg, error: "ECONNREFUSED" });
      throw new Error("partitioned socket");
    }
  });

  const latencies = [];
  const memBefore = snapshotMemory();
  const start = now();

  for (let i = 0; i < REVOKE_BURST_COUNT; i++) {
    const t0 = now();
    await replicator
      .revokeToken({ tokenHash: tokenHashes[i], tenantId: TENANT })
      .catch(() => {});
    const t1 = now();
    latencies.push(ms(t0, t1));
  }

  const end = now();
  const memAfter = snapshotMemory();

  latencies.sort((a, b) => a - b);
  const totalMs = ms(start, end);

  report("Phase 2: Asymmetric Network Partition & Revoke Storm", {
    requested: REVOKE_BURST_COUNT,
    broadcasted: broadcastLog.length,
    failures: failures.length,
    totalMs,
    throughputOpsPerSec: ((REVOKE_BURST_COUNT / totalMs) * 1000).toFixed(2),
    p50LatMs: percentile(latencies, 50).toFixed(3),
    p95LatMs: percentile(latencies, 95).toFixed(3),
    p99LatMs: percentile(latencies, 99).toFixed(3),
    maxLatMs: latencies[latencies.length - 1].toFixed(3),
    rssDeltaMb: ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2),
  });

  return { totalMs, throughput: (REVOKE_BURST_COUNT / totalMs) * 1000 };
}

// ── Phase 3: Quorum Node Death & Delta Bootstrap Recovery ───────────────────

async function phase3DeltaRecovery() {
  await resetRegistry();
  replicator.setBroadcast(() => {});

  // Populate a "peer" node with tokens
  for (let i = 0; i < DELTA_TOKEN_COUNT; i++) {
    await replicator.issueToken({
      tokenHash: crypto.randomUUID(),
      accountId: ACCOUNT,
      tenantId: TENANT,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
  }

  // Capture the authoritative peer delta before node death
  const peerTokens = (
    await (await tokenStore.getStore()).findSessionTokensByTenant(TENANT)
  ).map((t) => ({ ...t }));

  // Simulate node death: reset the local registry
  await resetRegistry();

  // Catch the broadcasted state request
  let capturedRequest = null;
  replicator.setBroadcast((msg) => {
    capturedRequest = msg;
  });

  const memBefore = snapshotMemory();
  const start = now();

  replicator.requestStateSync({ lastKnownSequence: 0, tenantId: TENANT });
  // Wait a tick for the (synchronous) broadcast
  await new Promise((resolve) => setImmediate(resolve));

  // A peer responds with the pre-captured delta
  const socket = { tenantId: TENANT, write: () => true };
  const response = await replicator.handleSessionTokenMessage(
    {
      type: "SESSION_STATE_RESPONSE",
      from: "peer-node",
      tenantId: TENANT,
      tokens: peerTokens,
    },
    socket,
  );

  const end = now();
  const memAfter = snapshotMemory();

  const recovered = (
    await (await tokenStore.getStore()).findSessionTokensByTenant(TENANT)
  ).length;

  report("Phase 3: Quorum Node Death & Delta Bootstrap Recovery", {
    peerTokens: DELTA_TOKEN_COUNT,
    responseTokens: peerTokens.length,
    accepted: response.accepted,
    consumed: Array.isArray(response.results) ? response.results.length : 0,
    recovered,
    totalMs: ms(start, end).toFixed(2),
    rssDeltaMb: ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2),
  });

  return { recovered };
}

// ── Phase 4: Actionable Sizing Manifest ─────────────────────────────────────

function phase4Manifest(p1, p2, p3) {
  console.log("\n" + "#".repeat(60));
  console.log("Phase 4: Actionable Sizing Manifest");
  console.log("#".repeat(60));
  console.log(
    `  Login burst throughput:      ${p1.throughput.toFixed(2)} ops/s`,
  );
  console.log(
    `  Revoke storm throughput:     ${p2.throughput.toFixed(2)} ops/s`,
  );
  console.log(`  Delta recovery tokens:       ${p3.recovered}`);

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
    `    - Token replication is file-DB queued; scale vertically for write throughput`,
  );
  console.log(
    `    - GC pressure: ${heap.used_heap_size / heap.heap_size_limit < 0.5 ? "LOW" : "MODERATE"}`,
  );
  console.log(
    "    - For >1,000 logins/s, replace token-db JSON queue with a real DB or in-memory cache",
  );
}

// ── Main driver ─────────────────────────────────────────────────────────────

async function main() {
  console.log("Session Token Replication Load Profile");
  console.log(
    `PID: ${process.pid} | Node: ${process.version} | Platform: ${process.platform}`,
  );
  console.log(
    `LOGIN_BURST_COUNT=${LOGIN_BURST_COUNT} REVOKE_BURST_COUNT=${REVOKE_BURST_COUNT} DELTA_TOKEN_COUNT=${DELTA_TOKEN_COUNT}`,
  );

  const p1 = await phase1LoginBurst();
  const p2 = await phase2PartitionedRevoke();
  const p3 = await phase3DeltaRecovery();
  phase4Manifest(p1, p2, p3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
