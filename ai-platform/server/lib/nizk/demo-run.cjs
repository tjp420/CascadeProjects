const { generateProof, verifyProof } = require("./index.cjs");

function demo() {
  const publicInputs = { policyId: "policy-0001", round: 1 };
  const proof = generateProof({ publicInputs, scheme: "mock-scheme" });
  console.log("Generated proof:", proof);
  const ok = verifyProof({ publicInputs, proof_bundle: proof.proof_bundle });
  console.log("Verification result:", ok);
}

if (require.main === module) demo();
