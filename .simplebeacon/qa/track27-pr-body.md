## Track 27: Post-Quantum Threshold Signatures & Quantum-Resistant Group Consensus

This PR adds a quantum-safe threshold signing layer that builds on Track 26's DKG group shares.

### Core primitives

- **PqcThresholdSigner** (`pqc-threshold-signer.cjs`)
  - Produces verifiable partial signatures bound to the message, node id, and public commitment.
  - Verifies partial signatures with a Schnorr-like relation: `g^response == commitment^challenge`.

- **SignatureShareAggregator** (`signature-share-aggregator.cjs`)
  - Collects partial signatures, rejects duplicates and tampered shares.
  - Enforces the threshold bound before aggregating a final group signature.
  - Emits `PQC_SIGNATURE_SHARE_VERIFIED` and `PQC_GROUP_SIGNATURE_FINALIZED` audit events.

### Policy integration

- `crypto-policy-schema.json` now defines `pqc.thresholdSignature`.
- `crypto-policy-engine.cjs` enforces `_validatePqcThresholdSignature` for the `pqc-threshold` operation.
- `base-adapter.cjs` adds `emitPqcSignatureShareVerified` and `emitPqcGroupSignatureFinalized` hooks.

### Verification

```bash
cd ai-platform
npx jest pqc-threshold
```

```text
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

```bash
npm run sb:hook:pre-commit
```

```text
Gate: PASS
Critical: 0  High: 0  Medium: 0  Low: 5
```
