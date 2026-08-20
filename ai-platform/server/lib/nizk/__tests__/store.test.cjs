const {
  generateAndStore,
  getStoredProof,
  listProofsByPolicy,
  clearStore,
} = require("../index.cjs");

describe("ProofStore integration", () => {
  beforeEach(() => clearStore());

  test("generateAndStore persists a proof and returns record", () => {
    const { record, proof } = generateAndStore({
      policyId: "policy-0001",
      publicInputs: { x: 1 },
      scheme: "mock",
    });
    expect(record).toHaveProperty("id");
    expect(record.policyId).toBe("policy-0001");
    expect(record.proof_bundle).toBe(proof.proof_bundle);
    const fetched = getStoredProof(record.id);
    expect(fetched.id).toBe(record.id);
  });

  test("listProofsByPolicy returns multiple entries", () => {
    generateAndStore({ policyId: "p1", publicInputs: {}, scheme: "a" });
    generateAndStore({ policyId: "p1", publicInputs: {}, scheme: "b" });
    const list = listProofsByPolicy("p1");
    expect(list.length).toBe(2);
  });
});
