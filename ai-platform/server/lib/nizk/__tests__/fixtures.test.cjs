const { FIXTURE } = require("../fixtures.cjs");
const { verifyProof } = require("../index.cjs");

describe("NIZK fixtures and provenance", () => {
  test("fixture has provenanceHash and verifyProof accepts it", () => {
    const { policyId, proof_bundle, meta } = FIXTURE;
    const res = verifyProof({ publicInputs: { policyId }, proof_bundle, meta });
    expect(res.is_valid).toBe(true);
  });

  test("tampered fixture fails provenance check", () => {
    const { policyId, proof_bundle, meta } = FIXTURE;
    // tamper meta.engineTimestamp
    const badMeta = Object.assign({}, meta, {
      engineTimestamp: "2026-01-01T00:00:00.000Z",
    });
    const res = verifyProof({
      publicInputs: { policyId },
      proof_bundle,
      meta: badMeta,
    });
    expect(res.is_valid).toBe(false);
    expect(res.error_context).toBe("provenance-hash-mismatch");
  });
});
