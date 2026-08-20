const crypto = require("crypto");
const { PartialShareProofManager } = require("../proofs.cjs");

describe("PartialShareProofManager", () => {
  let mgr;
  let publicKeyPem;
  let privateKeyPem;

  beforeAll(() => {
    mgr = new PartialShareProofManager();
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicExponent: 0x10001,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });
    publicKeyPem = publicKey;
    privateKeyPem = privateKey;
  });

  test("creates and verifies a valid proof", () => {
    const envelope = {
      reporter_id: "node-A",
      offender_id: "node-B",
      quorum: ["node-A", "node-B", "node-C"],
      round_number: 3,
      partial_index: 1,
      partial_share: BigInt("0x" + BigInt(123456789).toString(16)),
    };

    const proof = mgr.createPartialShareProof(envelope, privateKeyPem);
    expect(proof).toHaveProperty("envelope");
    expect(proof).toHaveProperty("proof_material");
    expect(proof.proof_material.evidence_id).toHaveLength(64);

    const res = mgr.verifyPartialShareProof(proof, publicKeyPem);
    expect(res && res.ok === true).toBe(true);
  });

  test("detects tampering with the envelope", () => {
    const envelope = {
      reporter_id: "node-X",
      offender_id: "node-Y",
      quorum: ["node-X", "node-Y"],
      round_number: 1,
      partial_index: 0,
      partial_share: BigInt(42),
    };

    const proof = mgr.createPartialShareProof(envelope, privateKeyPem);
    // Mutate the stored envelope (as would happen if an attacker altered stored evidence)
    proof.envelope.partial_share = (BigInt(42) + BigInt(1)).toString(16);

    const res = mgr.verifyPartialShareProof(proof, publicKeyPem);
    expect(res && res.ok === false).toBe(true);
  });
});
