"use strict";

const PoRepVerifier = require("../../track112/poRep-verifier.cjs");
const crypto = require("crypto");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest();
}

function buildMerkle(leaves) {
  let level = leaves.map((l) => sha256(Buffer.from(l)));
  const layers = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : Buffer.alloc(32, 0);
      next.push(sha256(Buffer.concat([a, b])));
    }
    level = next;
    layers.push(level);
  }
  return layers;
}

function proofForIndex(layers, index) {
  const path = [];
  let idx = index;
  for (let level = 0; level < layers.length - 1; level++) {
    const siblingIndex = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling =
      siblingIndex < layers[level].length
        ? layers[level][siblingIndex]
        : Buffer.alloc(32, 0);
    path.push(sibling.toString("hex"));
    idx = Math.floor(idx / 2);
  }
  return path;
}

describe("PoRep Merkle verification", () => {
  test("verifier accepts correct proof and rejects tampered leaf", async () => {
    const leaves = ["leaf0", "leaf1", "leaf2", "leaf3"];
    const layers = buildMerkle(leaves);
    const root = layers[layers.length - 1][0].toString("hex");
    const idx = 2;
    const path = proofForIndex(layers, idx);
    const proof = {
      root,
      challenges: [
        { index: idx, leaf: Buffer.from(leaves[idx]).toString("hex"), path },
      ],
    };

    const v = new PoRepVerifier();
    const ok = await v.verify(proof);
    expect(ok.valid).toBe(true);

    // Tamper leaf
    const badProof = {
      root,
      challenges: [
        { index: idx, leaf: Buffer.from("corrupt").toString("hex"), path },
      ],
    };
    const bad = await v.verify(badProof);
    expect(bad.valid).toBe(false);
  });
});
