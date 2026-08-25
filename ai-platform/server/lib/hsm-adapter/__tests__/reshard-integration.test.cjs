"use strict";
const { GroupReshardEngine } = require("../group-reshard-engine.cjs");

describe("Reshard integration with EphemeralShareRatchet", () => {
  test("end-to-end ratchet, purge, and unmask reconstructs new shares", () => {
    // Setup initial numeric additive shares (simple model)
    const nodes = [
      { id: "n1", share: 100n },
      { id: "n2", share: 200n },
      { id: "n3", share: 300n },
    ];
    const policy = { ratchetSeed: "integration-test-seed", maxSequence: 100 };
    const engine = new GroupReshardEngine({ policy, nodes });

    // Derive new shares (pre-ratchet) for expansion
    const preNew = engine._interpolateShares(2, nodes.length, 2, 4);
    expect(preNew.length).toBe(4);

    // Ratchet each new share using the engine ratchet
    const epochId = "integration-epoch-1";
    const ratcheted = [];
    for (const s of preNew) {
      const token = { nodeIndex: s.index, value: BigInt(s.value), sequence: 0 };
      const r = engine._ratchet.evolveShare(token, epochId);
      ratcheted.push({ index: s.index, value: r.value });
    }

    // Purge old shares (simulate what reshard would do)
    engine._purgeOldShares();
    for (const n of engine.nodes) {
      expect(n.share === 0 || n.share === 0n || n.share === null).toBeTruthy();
    }

    // Recompute masks and unmask ratcheted values to recover preNew values
    const crypto = require("crypto");
    const seed = Buffer.from(String(policy.ratchetSeed));
    const unmasked = [];
    for (const r of ratcheted) {
      const salt = Buffer.from(String(r.index));
      const info = Buffer.from(epochId + "::0");
      const maskRaw = crypto.hkdfSync("sha256", seed, salt, info, 32);
      const maskBuf = Buffer.isBuffer(maskRaw) ? maskRaw : Buffer.from(maskRaw);
      const maskBig = BigInt("0x" + maskBuf.toString("hex"));
      const un = (BigInt(r.value) - maskBig) % engine._prime;
      unmasked.push(un < 0n ? un + engine._prime : un);
    }

    // Compare unmasked values to preNew values (mod prime)
    for (let i = 0; i < preNew.length; i++) {
      const pre = BigInt(preNew[i].value) % engine._prime;
      const u = unmasked[i] % engine._prime;
      expect(u).toEqual(pre);
    }
  });
});
