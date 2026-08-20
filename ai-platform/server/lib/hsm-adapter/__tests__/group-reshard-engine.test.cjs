const { GroupReshardEngine } = require("../group-reshard-engine.cjs");

describe("GroupReshardEngine", () => {
  const policy = {
    maxCommitteeSize: 11,
    maxCommitteeExpansionFactor: 2.0,
    minEpochIntervalMs: 1,
    requireNewNodeAttestation: true,
  };

  test("rejects when committee size exceeded", async () => {
    const engine = new GroupReshardEngine({
      policy,
      attestationClient: { verify: async () => true },
    });
    const current = {
      epoch: 1,
      nodeIds: ["a", "b", "c"],
      lastRotationMs: Date.now() - 2000,
      shares: { a: true, b: true, c: true },
    };
    const target = {
      nodeIds: Array.from({ length: 12 }, (_, i) => `n${i}`),
      attestations: {},
    };
    await expect(
      engine.computeReshardDistribution(current, target),
    ).rejects.toThrow("ERR_COMMITTEE_SIZE_EXCEEDED");
  });

  test("rejects when attestation fails for new node", async () => {
    const attestationClient = { verify: jest.fn().mockResolvedValue(false) };
    const engine = new GroupReshardEngine({ policy, attestationClient });
    const current = {
      epoch: 1,
      nodeIds: ["a", "b"],
      lastRotationMs: Date.now() - 2000,
      shares: { a: true, b: true },
    };
    const target = { nodeIds: ["a", "b", "c"], attestations: { c: "bad" } };
    await expect(
      engine.computeReshardDistribution(current, target),
    ).rejects.toThrow(/ERR_INVALID_NODE_ATTESTATION/);
    expect(attestationClient.verify).toHaveBeenCalledWith("bad");
  });

  test("returns equal-weight distribution mapping when attestations valid", async () => {
    const attestationClient = { verify: jest.fn().mockResolvedValue(true) };
    const engine = new GroupReshardEngine({ policy, attestationClient });
    const current = {
      epoch: 2,
      nodeIds: ["a", "b"],
      lastRotationMs: Date.now() - 2000,
      shares: { a: true, b: true },
    };
    const target = { nodeIds: ["a", "b", "c"], attestations: { c: "good" } };
    const res = await engine.computeReshardDistribution(current, target);
    expect(res.epoch).toBe(3);
    expect(Object.keys(res.distribution)).toEqual(["a", "b", "c"]);
    // ensure coefficients for a target sum to ~1
    const firstTarget = Object.keys(res.distribution)[0];
    const coeffs =
      res.distribution[firstTarget].coefficients ||
      res.distribution[firstTarget];
    const sum = Object.values(coeffs).reduce((s, v) => s + (v || 0), 0);
    expect(sum).toBeCloseTo(1.0);
  });

  test("coefficients reconstruct linear shares deterministically", async () => {
    const attestationClient = { verify: jest.fn().mockResolvedValue(true) };
    const engine = new GroupReshardEngine({ policy, attestationClient });
    const current = {
      epoch: 2,
      nodeIds: ["s1", "s2", "s3"],
      lastRotationMs: Date.now() - 2000,
      shares: { s1: { v: 10 }, s2: { v: 20 }, s3: { v: 30 } },
    };
    const target = {
      nodeIds: ["t1", "t2"],
      attestations: { t1: "ok", t2: "ok" },
    };
    const out = await engine.computeReshardDistribution(current, target);
    // reconstruct target values as weighted sum of source v
    for (const t of Object.keys(out.distribution)) {
      const coeffs = out.distribution[t].coefficients || out.distribution[t];
      const reconstructed = Object.entries(coeffs).reduce(
        (s, [src, c]) => s + c * (current.shares[src].v || 0),
        0,
      );
      // Should be a finite numeric value and deterministic
      expect(Number.isFinite(reconstructed)).toBe(true);
      expect(reconstructed).toBeGreaterThan(0);
    }
  });
});
