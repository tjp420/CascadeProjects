"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const MerkleReassembler = require("../../track112/merkle-reassembler.cjs");

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function combineHex(leftHex, rightHex) {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  return sha256Hex(Buffer.concat([left, right]));
}

describe("MerkleReassembler (Track 396)", () => {
  describe("basic tree construction", () => {
    it("produces SHA-256 of empty data for zero leaves", () => {
      const r = new MerkleReassembler();
      const root = r.finalize();
      assert.strictEqual(root, sha256Hex(Buffer.alloc(0)));
    });

    it("produces leaf hash for a single chunk", () => {
      const r = new MerkleReassembler();
      const data = Buffer.from("hello");
      r.append(0, data);
      const root = r.finalize();
      assert.strictEqual(root, sha256Hex(data));
    });

    it("combines two leaves correctly", () => {
      const r = new MerkleReassembler();
      const a = Buffer.from("aaa");
      const b = Buffer.from("bbb");
      r.append(0, a);
      r.append(4096, b);
      const root = r.finalize();
      const expected = combineHex(sha256Hex(a), sha256Hex(b));
      assert.strictEqual(root, expected);
    });

    it("handles power-of-two leaf counts (4 leaves)", () => {
      const r = new MerkleReassembler();
      const chunks = [
        Buffer.from("a"),
        Buffer.from("b"),
        Buffer.from("c"),
        Buffer.from("d"),
      ];
      chunks.forEach((c, i) => r.append(i * 4096, c));
      const root = r.finalize();
      const h1 = sha256Hex(Buffer.from("a"));
      const h2 = sha256Hex(Buffer.from("b"));
      const h3 = sha256Hex(Buffer.from("c"));
      const h4 = sha256Hex(Buffer.from("d"));
      const l1 = combineHex(h1, h2);
      const l2 = combineHex(h3, h4);
      const expected = combineHex(l1, l2);
      assert.strictEqual(root, expected);
    });

    it("handles odd leaf count by promoting last node (3 leaves)", () => {
      const r = new MerkleReassembler();
      const chunks = [Buffer.from("x"), Buffer.from("y"), Buffer.from("z")];
      chunks.forEach((c, i) => r.append(i * 4096, c));
      const root = r.finalize();
      const h1 = sha256Hex(Buffer.from("x"));
      const h2 = sha256Hex(Buffer.from("y"));
      const h3 = sha256Hex(Buffer.from("z"));
      const l1 = combineHex(h1, h2);
      // h3 is promoted to compete with l1
      const expected = combineHex(l1, h3);
      assert.strictEqual(root, expected);
    });
  });

  describe("incremental properties", () => {
    it("getRoot returns current root without finalizing", () => {
      const r = new MerkleReassembler();
      r.append(0, Buffer.from("data"));
      const currentRoot = r.getRoot();
      assert.ok(currentRoot, "getRoot should return a non-null root");
      assert.strictEqual(r.isFinalized, false);
      // Can still append more
      r.append(4096, Buffer.from("more"));
      assert.ok(true, "append after getRoot should not throw");
    });

    it("throws when appending after finalize", () => {
      const r = new MerkleReassembler();
      r.append(0, Buffer.from("data"));
      r.finalize();
      assert.throws(
        () => r.append(4096, Buffer.from("more")),
        /tree_already_finalized/,
      );
    });

    it("finalize is idempotent", () => {
      const r = new MerkleReassembler();
      r.append(0, Buffer.from("data"));
      const root1 = r.finalize();
      const root2 = r.finalize();
      assert.strictEqual(root1, root2);
    });

    it("leafCount tracks appended chunks", () => {
      const r = new MerkleReassembler();
      assert.strictEqual(r.leafCount, 0);
      r.append(0, Buffer.from("a"));
      assert.strictEqual(r.leafCount, 1);
      r.append(4096, Buffer.from("b"));
      assert.strictEqual(r.leafCount, 2);
    });
  });

  describe("offset alignment", () => {
    it("throws on non-aligned offset", () => {
      const r = new MerkleReassembler({ leafSize: 4096 });
      assert.throws(() => r.append(1, Buffer.from("x")), /offset_not_aligned/);
    });

    it("accepts custom leafSize", () => {
      const r = new MerkleReassembler({ leafSize: 1024 });
      r.append(0, Buffer.from("a"));
      r.append(1024, Buffer.from("b"));
      assert.strictEqual(r.leafCount, 2);
    });
  });

  describe("checkpoint persistence", () => {
    it("persists and restores tree state from disk", () => {
      const tmpDir = path.join(
        process.cwd(),
        ".data",
        "test-merkle-checkpoint",
      );
      if (fs.existsSync(tmpDir))
        fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });

      // Write 3 chunks
      const r1 = new MerkleReassembler({ stateDir: tmpDir });
      r1.append(0, Buffer.from("a"));
      r1.append(4096, Buffer.from("b"));
      r1.append(8192, Buffer.from("c"));
      const root1 = r1.finalize();

      // Simulate crash: create a new instance pointing at the same dir
      const r2 = new MerkleReassembler({ stateDir: tmpDir });
      assert.strictEqual(r2.leafCount, 3);
      assert.strictEqual(r2.isFinalized, true);
      const root2 = r2.getRoot();
      assert.strictEqual(root1, root2);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("rebuilds from chunk files when no checkpoint exists", () => {
      const tmpDir = path.join(process.cwd(), ".data", "test-merkle-rebuild");
      if (fs.existsSync(tmpDir))
        fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });

      // Write chunk files directly (simulating chunks without tree-state.json)
      fs.writeFileSync(path.join(tmpDir, "0.chunk"), Buffer.from("alpha"));
      fs.writeFileSync(path.join(tmpDir, "4096.chunk"), Buffer.from("beta"));

      // Create reassembler — no checkpoint, so leafCount starts at 0
      const r = new MerkleReassembler({ stateDir: tmpDir });
      assert.strictEqual(r.leafCount, 0);

      // Manually rebuild (as upload-manager.resumeSession does)
      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".chunk"));
      const offsets = files
        .map((f) => Number(f.replace(".chunk", "")))
        .sort((a, b) => a - b);
      for (const o of offsets) {
        r.append(o, fs.readFileSync(path.join(tmpDir, `${o}.chunk`)));
      }
      const root = r.finalize();
      assert.ok(root);

      // Verify the root matches a fresh computation
      const fresh = new MerkleReassembler();
      fresh.append(0, Buffer.from("alpha"));
      fresh.append(4096, Buffer.from("beta"));
      assert.strictEqual(root, fresh.finalize());

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("getState and loadState round-trip", () => {
      const r1 = new MerkleReassembler();
      r1.append(0, Buffer.from("x"));
      r1.append(4096, Buffer.from("y"));
      const state = r1.getState();
      assert.strictEqual(state.leafCount, 2);
      assert.strictEqual(state.leaves.length, 2);

      const r2 = new MerkleReassembler();
      r2.loadState(state);
      assert.strictEqual(r2.leafCount, 2);
      assert.strictEqual(r2.getRoot(), r1.getRoot());
    });
  });

  describe("determinism", () => {
    it("same chunks in same order produce same root", () => {
      const r1 = new MerkleReassembler();
      const r2 = new MerkleReassembler();
      for (let i = 0; i < 8; i++) {
        const buf = Buffer.from(`chunk-${i}`);
        r1.append(i * 4096, buf);
        r2.append(i * 4096, buf);
      }
      assert.strictEqual(r1.finalize(), r2.finalize());
    });

    it("different chunk order produces different root", () => {
      const r1 = new MerkleReassembler();
      const r2 = new MerkleReassembler();
      r1.append(0, Buffer.from("a"));
      r1.append(4096, Buffer.from("b"));
      // Reverse order
      r2.append(0, Buffer.from("b"));
      r2.append(4096, Buffer.from("a"));
      assert.notStrictEqual(r1.finalize(), r2.finalize());
    });
  });
});
