const {
  clearStore,
  generateAndStore,
  getStoredProof,
  listProofsByPolicy,
} = require("../index.cjs");
const ProofStore = require("../store.cjs");

describe("NIZK monotonic sequencing", () => {
  beforeEach(() => {
    clearStore();
  });

  test("generateAndStore assigns consecutive sequence numbers", () => {
    const p1 = generateAndStore({
      policyId: "p1",
      publicInputs: { policyId: "p1", value: 1 },
    });
    const p2 = generateAndStore({
      policyId: "p1",
      publicInputs: { policyId: "p1", value: 2 },
    });

    expect(p1.record.meta.sequence).toBe(1);
    expect(p2.record.meta.sequence).toBe(2);

    const list = listProofsByPolicy("p1");
    const seqs = list.map((r) => r.meta.sequence);
    expect(seqs).toEqual([1, 2]);
  });

  test("saving an imported proof with too-small sequence is rejected", () => {
    const store = new ProofStore();
    // simulate existing sequence at 2
    store.nextSequence();
    store.nextSequence();

    expect(() => {
      store.saveProof({
        policyId: "x",
        proof_bundle: "b64",
        meta: { sequence: 1 },
      });
    }).toThrow(/sequence-too-small/);

    // but allow if force=true
    expect(() => {
      store.saveProof({
        policyId: "x",
        proof_bundle: "b64",
        meta: { sequence: 1 },
        force: true,
      });
    }).not.toThrow();
  });
});
