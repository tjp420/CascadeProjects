# Track 46: Fully Homomorphic Zero-Knowledge Data Masking & Computation Contracts — Test Plan

## Objective

Allow third-party worker nodes to execute basic operational logic over encrypted tenant parameters without ever decrypting the underlying raw data. Build on Track 36/44 Pedersen commitments to support homomorphic addition and scalar multiplication, plus non-interactive zero-knowledge range proofs that confirm an encrypted value sits within policy-defined bounds.

## Scope

### Core primitives

- **HomomorphicContractEngine** — accepts multi-layered Pedersen commitments and executes addition and scalar multiplication directly over encrypted weights.
- **ZkRangeProofProcessor** — generates and verifies non-interactive zero-knowledge proofs that an encrypted data point lies strictly within `min < encrypted_value < max`.
- **ComputationTelemetry** — emits `HOMOMORPHIC_CONTRACT_EXECUTED` and `ZK_RANGE_PROOF_VERIFIED` into the Track 29 ZK-rollup accumulator.

### Canonical verification proof object structure

```json
{
  "contractId": "contract-123",
  "workerNodeId": "worker-1",
  "encryptedValueCommitment": "C-...",
  "operation": "add" | "scalarMul",
  "minBound": 0,
  "maxBound": 1000,
  "rangeProof": "<sha256-based-simulated-proof>",
  "timestamp": 1234567890,
  "attestationAuthority": "mock-authority"
}
```

### Policy schema additions

- `homomorphicComputation`:
  - `allowedOperations`: `["add", "scalarMul"]`
  - `maxRangeBitWidth`: 64
  - `requireWorkerAttestation`: true
  - `allowedWorkerAuthorities`: `["mock-authority"]`
  - `maxContractVerificationWindowSeconds`: 60
  - `requireZkRangeProof`: true
  - `minRangeBits`: 8
  - `maxRangeBits`: 4096

## Design decisions

- The `HomomorphicContractEngine` uses Pedersen-style commitments over a large safe prime field.
- Allowed operations are limited to `add` and `scalarMul`; no division or multiplication of two encrypted values to prevent plaintext exposure.
- The `ZkRangeProofProcessor` simulates non-interactive ZK range proofs by binding the value, blinding, min, and max into a SHA-256 commitment. It verifies the recomputed proof matches and that the hidden value is within the claimed bounds (the worker attests to the bounds; in a full system this would be a real ZK proof).
- Worker nodes must pass `EnclaveAttestationClient.verify()` before `HomomorphicContractEngine.execute()` can proceed (Track 41 integration).
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `HomomorphicContractEngine` executes a homomorphic `add` over two encrypted commitments.
- [ ] `HomomorphicContractEngine` executes a homomorphic `scalarMul` of an encrypted commitment.
- [ ] `ZkRangeProofProcessor` generates a valid range proof and verifies it.
- [ ] `CryptoPolicyEngine` validates a compliant `homomorphicComputation` configuration.
- [ ] `base-adapter.cjs` emits `HOMOMORPHIC_CONTRACT_EXECUTED` and `ZK_RANGE_PROOF_VERIFIED`.
- [ ] `ZkRollupAccumulator` ingests `HOMOMORPHIC_CONTRACT_EXECUTED` events.

### Security / edge cases

- [ ] Reject operations not in `allowedOperations`.
- [ ] Reject worker execution when attestation is missing or invalid.
- [ ] Reject a contract whose verification window exceeds `maxContractVerificationWindowSeconds`.
- [ ] Reject a range proof when `zkRangeProof` is missing and `requireZkRangeProof` is true.
- [ ] Reject a range proof with out-of-bounds bit width (`< minRangeBits` or `> maxRangeBits`).
- [ ] Reject an unauthorized worker attestation authority.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateHomomorphicComputation` for `operation === 'homomorphicComputation'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `homomorphic-computation` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest homomorphic-computation`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Execute a contract over two hidden values and verify the range proof in the ZK-rollup log.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/homomorphic-contract-engine.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-range-proof-processor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/homomorphic-computation.test.cjs` *(new)*

## Approval

Pending Validator review.
