# Track 26: Threshold Key Generation Networks & Distributed zk-SNARK State Proofs — Test Plan

## Objective

Evolve the standalone cryptographic architecture into a decentralized, zero-knowledge verification network by implementing:

1. **Distributed Key Generation (DKG)**: Joint-Feldman verifiable secret sharing to generate tenant master keys collectively across N nodes without any single node reconstructing the complete private key.
2. **zk-SNARK Proving**: A lightweight proving system to generate succinct proofs that the adapter executed policy constraints without revealing policy details or key metadata.
3. **Decentralized Audit Telemetry**: DKG round completion and zk-SNARK proof generation telemetry logs integrated into the existing audit pipeline.

## Scope

### Core primitives

- `DkgNode` — participant in the DKG protocol.
- `DkgCoordinator` — orchestrates N-of-N joint-Feldman generation and share distribution.
- `FeldmanCommitment` — public commitments to polynomial coefficients: `C_i = g^{a_i} mod p`.
- `SnarkProver` — generates succinct proofs of policy execution.
- `SnarkVerifier` — verifies proofs against a public verification key.
- `DkgTelemetry` and `ZkSnarkTelemetry` — emit `DKG_ROUND_COMPLETED` and `ZK_SUCCINCT_PROOF_GENERATED` events.

### Policy schema additions

- `threshold.dkg` — node quorum, polynomial degree, honest node threshold, commitment scheme, allowed elliptic curves.
- `zkp.snark` — allowed proving systems, maximum constraint count, proving key hash, trusted-setup requirement, allowed finite fields.

## Test checklist

### Positive paths

- [ ] DKG completes for a 3-of-5 configuration and reconstructs the same public key.
- [ ] Feldmann commitments verify for all published shares.
- [ ] Lagrange interpolation reconstructs a test secret from a qualifying subset.
- [ ] `SnarkProver` generates a valid proof for a known policy constraint.
- [ ] `SnarkVerifier` accepts a valid proof on the correct verification key.
- [ ] `DKG_ROUND_COMPLETED` and `ZK_SUCCINCT_PROOF_GENERATED` telemetry events are emitted and SHA-256 chained.
- [ ] `CryptoPolicyEngine` validates `threshold.dkg` and `zkp.snark` configurations.

### Security / edge cases

- [ ] A single node cannot reconstruct the secret from its own share.
- [ ] Reconstruction with fewer than `requiredHonest` shares fails.
- [ ] Invalid Feldmann commitment (e.g., mismatched coefficient) is rejected.
- [ ] `SnarkVerifier` rejects a proof generated with an unauthorized proving system or field.
- [ ] `CryptoPolicyEngine` blocks DKG with `polynomialDegree` that exceeds `maxNodes - 1`.
- [ ] `SnarkProver` refuses to prove policies exceeding `maxConstraintCount`.

### Integration

- [ ] DKG-derived KEKs integrate with existing `BaseHsmAdapter._createKEK` flow.
- [ ] zk-SNARK proof verification integrates with `BaseHsmAdapter` policy audit events.
- [ ] Telemetry logs append correctly to the `RobustnessTelemetryAgent` chain from Track 25.

## Level mapping

- **L1 Deterministic**: `node -c` on all new `.cjs` files, `npx jest dkg snark` target suite, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: End-to-end DKG with 5 local node processes, proof generation/verification round-trip.
- **L3 Reflection**: Spec drift review against Track 14 policy engine, no ghost modules, minimal file count.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/dkg-node.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/dkg-coordinator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/feldman-commitment.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/snark-prover.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/snark-verifier.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/robustness-telemetry-agent.cjs`

## Approval

Pending Validator review.
