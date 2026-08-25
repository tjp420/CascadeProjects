// Lightweight NIZK proof stub for development and testing
// Exports deterministic `generateProof` and `verifyProof` stubs.

const ProofStore = require("./store.cjs");
const { sha256HexFromObject } = require("./utils.cjs");
const store = new ProofStore();

function generateProof({
  publicInputs = {},
  secretInputs = {},
  scheme = "mock-scheme",
  version = "1.0.0",
} = {}) {
  // deterministic mock proof bundle (includes canonicalized publicInputs)
  const payload = JSON.stringify(publicInputs);
  const proof = Buffer.from(`mock-proof:${scheme}:${payload}`).toString(
    "base64",
  );

  // provenance metadata
  const meta = {
    scheme,
    version,
    engineTimestamp: new Date().toISOString(),
  };

  // assign monotonic sequence from the store
  try {
    const seq = store.nextSequence();
    meta.sequence = seq;
  } catch (e) {
    console.error("index.cjs error:", e);
    // defensive: if store sequencing is not available, leave sequence undefined
  }

  // compute provenance checksum deterministically over selected fields
  const provenanceHash = sha256HexFromObject({
    policyId: publicInputs.policyId || null,
    proof_bundle: proof,
    meta,
  });

  return {
    proof_bundle: proof,
    proof_size: proof.length,
    meta: Object.assign({}, meta, { provenanceHash }),
  };
}

function verifyProof({ publicInputs = {}, proof_bundle, meta = {} }) {
  try {
    const decoded = Buffer.from(proof_bundle || "", "base64").toString("utf8");
    const okPrefix = decoded.startsWith("mock-proof:");

    // if provenanceHash present, validate it
    if (meta && meta.provenanceHash) {
      const expected = sha256HexFromObject({
        policyId: publicInputs.policyId || null,
        proof_bundle,
        meta: {
          scheme: meta.scheme,
          version: meta.version,
          engineTimestamp: meta.engineTimestamp,
        },
      });
      if (expected !== meta.provenanceHash) {
        return { is_valid: false, error_context: "provenance-hash-mismatch" };
      }
    }

    return {
      is_valid: okPrefix,
      error_context: okPrefix ? null : "invalid-mock-proof",
    };
  } catch (e) {
    return { is_valid: false, error_context: "decode-error" };
  }
}

function generateAndStore({
  policyId,
  publicInputs = {},
  secretInputs = {},
  scheme = "mock-scheme",
} = {}) {
  const res = generateProof({ publicInputs, secretInputs, scheme });
  const rec = store.saveProof({
    policyId: policyId || "unknown",
    proof_bundle: res.proof_bundle,
    meta: res.meta,
  });
  return { record: rec, proof: res };
}

function getStoredProof(id) {
  return store.getProof(id);
}

function listProofsByPolicy(policyId) {
  return store.listByPolicy(policyId);
}

function clearStore() {
  store.clear();
}

module.exports = {
  generateProof,
  verifyProof,
  generateAndStore,
  getStoredProof,
  listProofsByPolicy,
  clearStore,
};
