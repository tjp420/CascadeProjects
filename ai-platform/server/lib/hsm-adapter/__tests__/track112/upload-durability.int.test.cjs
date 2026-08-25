"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const UploadManager = require("../../../storage/upload-manager.cjs");
const hsmMetrics = require("../../hsm-metrics.cjs");
const { canonicalize } = require("../../../crypto/jcs-canonicalize.cjs");

describe("Track 396: Multipart upload durability (integration)", () => {
  const base = path.join(process.cwd(), ".data", "test-track396-int");

  beforeEach(() => {
    hsmMetrics.reset();
    if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });
    fs.mkdirSync(base, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });
  });

  it("persists tree-state.json after each chunk write", async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: "t1" });
    const sid = mgr.createSession({ tenant: "t1", maxBytes: 1024 * 1024 });
    await mgr.writeChunkFromBuffer(sid, 0, Buffer.from("chunk-0"));
    await mgr.writeChunkFromBuffer(sid, 4096, Buffer.from("chunk-1"));

    const sessionDir = path.join(base, "t1", sid);
    const statePath = path.join(sessionDir, "tree-state.json");
    assert.ok(
      fs.existsSync(statePath),
      "tree-state.json should exist after chunk writes",
    );

    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.strictEqual(state.leafCount, 2);
    assert.ok(state.leaves.length === 2);
  });

  it("resumes session from checkpoint after simulated crash", async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: "t1" });
    const sid = mgr.createSession({ tenant: "t1", maxBytes: 1024 * 1024 });
    await mgr.writeChunkFromBuffer(sid, 0, Buffer.from("alpha"));
    await mgr.writeChunkFromBuffer(sid, 4096, Buffer.from("beta"));

    // Simulate crash: create a new UploadManager (fresh process)
    const mgr2 = new UploadManager({ baseDir: base, defaultTenant: "t1" });
    const { reassembler, meta } = mgr2.resumeSession(sid);
    assert.strictEqual(reassembler.leafCount, 2);
    assert.ok(meta.sessionId === sid);

    // The root from resumed session should match a fresh computation
    const rootHex = reassembler.finalize();
    const fresh = crypto.createHash("sha256");
    // Merkle root for 2 leaves: H(H(alpha) || H(beta))
    const h1 = crypto
      .createHash("sha256")
      .update(Buffer.from("alpha"))
      .digest();
    const h2 = crypto.createHash("sha256").update(Buffer.from("beta")).digest();
    const expectedRoot = crypto
      .createHash("sha256")
      .update(Buffer.concat([h1, h2]))
      .digest("hex");
    assert.strictEqual(rootHex, expectedRoot);

    // Verify session_resumed counter was incremented
    const metrics = hsmMetrics.getMetrics();
    assert.ok(metrics.hsm_track112_session_resumed_total >= 1);
  });

  it("rebuilds tree from chunk files when tree-state.json is missing (legacy session)", async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: "t1" });
    const sid = mgr.createSession({ tenant: "t1", maxBytes: 1024 * 1024 });
    await mgr.writeChunkFromBuffer(sid, 0, Buffer.from("legacy-0"));
    await mgr.writeChunkFromBuffer(sid, 4096, Buffer.from("legacy-1"));

    // Delete tree-state.json to simulate legacy session without checkpoint
    const sessionDir = path.join(base, "t1", sid);
    fs.unlinkSync(path.join(sessionDir, "tree-state.json"));

    // computeRootHex should still work by rebuilding from chunks
    const { rootHex } = mgr.computeRootHex(sid);
    assert.ok(rootHex);

    // Verify it matches the expected Merkle root
    const h1 = crypto
      .createHash("sha256")
      .update(Buffer.from("legacy-0"))
      .digest();
    const h2 = crypto
      .createHash("sha256")
      .update(Buffer.from("legacy-1"))
      .digest();
    const expectedRoot = crypto
      .createHash("sha256")
      .update(Buffer.concat([h1, h2]))
      .digest("hex");
    assert.strictEqual(rootHex, expectedRoot);
  });

  it("commit produces correct Merkle root and moves to _committed", async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: "t1" });
    const sid = mgr.createSession({ tenant: "t1", maxBytes: 1024 * 1024 });
    await mgr.writeChunkFromBuffer(sid, 0, Buffer.from("data-a"));
    await mgr.writeChunkFromBuffer(sid, 4096, Buffer.from("data-b"));

    // Compute expected Merkle root
    const h1 = crypto
      .createHash("sha256")
      .update(Buffer.from("data-a"))
      .digest();
    const h2 = crypto
      .createHash("sha256")
      .update(Buffer.from("data-b"))
      .digest();
    const expectedRoot = crypto
      .createHash("sha256")
      .update(Buffer.concat([h1, h2]))
      .digest("hex");

    // Sign the JCS canonical commit payload
    const keyPair = crypto.generateKeyPairSync("ed25519");
    const publicKeyPem = keyPair.publicKey.export({
      type: "spki",
      format: "pem",
    });
    const commitPayload = canonicalize({
      root: expectedRoot,
      sessionId: sid,
      tenant: "t1",
    });
    const signature = crypto
      .sign(null, Buffer.from(commitPayload, "utf8"), keyPair.privateKey)
      .toString("base64");

    const result = mgr.verifyAndCommitSession(sid, publicKeyPem, signature);
    assert.ok(result.ok);
    assert.strictEqual(result.root, expectedRoot);

    // Verify session moved to _committed
    const committedDir = path.join(base, "_committed", "t1", sid);
    assert.ok(fs.existsSync(committedDir), "session should be in _committed");
    assert.ok(
      !fs.existsSync(path.join(base, "t1", sid)),
      "session should be removed from active",
    );

    // Verify committed meta
    const committedMeta = JSON.parse(
      fs.readFileSync(path.join(committedDir, "meta.json"), "utf8"),
    );
    assert.ok(committedMeta.committed);
    assert.strictEqual(committedMeta.root, expectedRoot);
  });

  it("incremental tree state matches full rebuild", async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: "t1" });
    const sid = mgr.createSession({ tenant: "t1", maxBytes: 1024 * 1024 });

    // Write 5 chunks incrementally
    const chunks = [];
    for (let i = 0; i < 5; i++) {
      const buf = Buffer.from(`chunk-data-${i}`);
      chunks.push(buf);
      await mgr.writeChunkFromBuffer(sid, i * 4096, buf);
    }

    // Get root via incremental tree (from checkpoint)
    const { rootHex: incrementalRoot } = mgr.computeRootHex(sid);

    // Manually compute Merkle root from scratch
    const leaves = chunks.map((c) =>
      crypto.createHash("sha256").update(c).digest("hex"),
    );
    function computeRoot(level) {
      while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
          if (i + 1 < level.length) {
            const l = Buffer.from(level[i], "hex");
            const r = Buffer.from(level[i + 1], "hex");
            next.push(
              crypto
                .createHash("sha256")
                .update(Buffer.concat([l, r]))
                .digest("hex"),
            );
          } else {
            next.push(level[i]);
          }
        }
        level = next;
      }
      return level[0];
    }
    const expectedRoot = computeRoot(leaves);

    assert.strictEqual(incrementalRoot, expectedRoot);
  });

  it("atomic chunk write does not leave temp files on success", async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: "t1" });
    const sid = mgr.createSession({ tenant: "t1", maxBytes: 1024 * 1024 });
    await mgr.writeChunkFromBuffer(sid, 0, Buffer.from("clean-write"));

    const sessionDir = path.join(base, "t1", sid);
    const files = fs.readdirSync(sessionDir);
    const tempFiles = files.filter((f) => f.includes(".tmp"));
    assert.strictEqual(
      tempFiles.length,
      0,
      "no temp files should remain after successful write",
    );
  });

  it("durability telemetry counters are incremented", async () => {
    const mgr = new UploadManager({ baseDir: base, defaultTenant: "t1" });
    const sid = mgr.createSession({ tenant: "t1", maxBytes: 1024 * 1024 });
    await mgr.writeChunkFromBuffer(sid, 0, Buffer.from("tel-0"));
    await mgr.writeChunkFromBuffer(sid, 4096, Buffer.from("tel-1"));

    const metrics = hsmMetrics.getMetrics();
    assert.ok(
      metrics.hsm_track112_chunk_write_atomic_total >= 2,
      "atomic write counter should be >= 2",
    );
    assert.ok(
      metrics.hsm_track112_merkle_leaf_hashed_total >= 2,
      "merkle leaf hashed counter should be >= 2",
    );
  });
});
