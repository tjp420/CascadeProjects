## Track 26: Threshold Key Generation Networks & Distributed zk-SNARK State Proofs

This PR adds a decentralized, zero-knowledge verification layer to the HSM adapter stack.

### Core primitives

- **DKG node & coordinator** (`dkg-node.cjs`, `dkg-coordinator.cjs`)
  - Joint-Feldman verifiable secret sharing over a prime-order subgroup.
  - Per-node random polynomial generation, share distribution, and commitment verification.
  - Emits `DKG_ROUND_COMPLETED` telemetry.

- **zk-SNARK prover & verifier** (`snark-prover.cjs`, `snark-verifier.cjs`)
  - Lightweight constraint-checking proof simulation.
  - Proves adapter policy compliance without exposing witness values.
  - Emits `ZK_SUCCINCT_PROOF_GENERATED` telemetry.

### Policy integration

- `crypto-policy-schema.json` now defines `threshold.dkg` and `zkp.snark`.
- `crypto-policy-engine.cjs` enforces `_validateDkg` and `_validateSnark`.
- `base-adapter.cjs` adds `emitDkgRoundCompleted` and `emitZkProofGenerated` hooks.

### Verification

```bash
cd ai-platform
npx jest dkg-snark
```

```text
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

```bash
npm run sb:hook:pre-commit
```

```text
Gate: PASS
Critical: 0  High: 0  Medium: 0
```
