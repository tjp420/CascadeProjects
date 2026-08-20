// Integration tests against the Prism mock at http://localhost:4010
// Uses global fetch available in Node 18+ (workflow uses Node 18)

const BASE = process.env.PRISM_BASE || "http://localhost:4010";

describe("NIZK integration (against Prism mock)", () => {
  jest.setTimeout(30000);

  test("generate -> verify -> fetch proof", async () => {
    const genRes = await fetch(`${BASE}/nizk/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy_id: "int-policy-1",
        public_inputs: { x: 1 },
        scheme: "mock",
      }),
    });
    expect(genRes.ok).toBe(true);
    const gen = await genRes.json();
    expect(gen).toHaveProperty("record");
    expect(gen).toHaveProperty("proof");
    expect(gen.record).toHaveProperty("id");

    const proof = gen.proof.proof_bundle;

    const verRes = await fetch(`${BASE}/nizk/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy_id: "int-policy-1",
        public_inputs: { x: 1 },
        proof_bundle: proof,
      }),
    });
    expect(verRes.ok).toBe(true);
    const ver = await verRes.json();
    expect(typeof ver.is_valid).toBe("boolean");
    expect(ver.is_valid).toBe(true);

    const getRes = await fetch(`${BASE}/nizk/proofs/${gen.record.id}`);
    expect(getRes.ok).toBe(true);
    const got = await getRes.json();
    expect(got.id).toBe(gen.record.id);
  });
});
