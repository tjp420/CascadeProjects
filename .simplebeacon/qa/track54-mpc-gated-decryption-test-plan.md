# Track 54: Confidential Multi-Party Compute (MPC) Gated Decryption Engines — Test Plan

## Objective

Anchor high-value key unsealing operations behind a distributed, privacy-preserving arithmetic constraint validation matrix. N independent nodes collectively compute an operational gate (e.g., verifying a business constraint over multi-tenant metadata) before a secret key share can be unsealed inside the hardware enclave, entirely eliminating single-node decryption override threats. Building on Track 41 hardware enclave attestation and Track 46 homomorphic computation.

## Scope

### Core primitives

- **MpcCircuitProcessor** — executes secret-shared input evaluations across an administrative committee using Shamir-blinded addition and multiplication triplets.
- **MpcGatedDecryptor** — blocks the Track 41 `HardwareEnclaveAdapter` unsealing loop unless a valid, committee-verified circuit satisfaction proof is presented.
- **MPCExecutionTelemetry** — emits `MPC_CIRCUIT_EVALUATION_INITIATED` and `MPC_DECRYPTION_GATE_UNLOCKED` into the Track 29 ZK-rollup accumulator.

### Canonical MPC circuit proof payload layout

```
MPC:<circuitId>:<gateType>:<nodeIds...>:<tripletHash>:<evaluationEpoch>:<satisfactionProofHash>:<attestationHash>:<committeeSignature>
```

### Policy schema additions

- `mpcGatedDecryption`:
  - `minCircuitNodes`: 3
  - `maxMultiplicationGateDepth`: 8
  - `transactionTimeoutSeconds`: 300
  - `requireEnclaveAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `requireCircuitSatisfactionProof`: true
  - `requireCanonicalPayloadLayout`: true

### PQC threshold policy cleanup (from local edit)

- `pqcThreshold`:
  - `minSignatureThreshold`: 3
  - `maxCommitteeSize`: 10
  - `signatureAlgorithm`: `ML-DSA-65`
  - `requireHybridMode`: true
  - `allowedCurves`: `["P-256", "P-384", "P-521"]`
  - `maxSignatureAgeSeconds`: 300
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All committee nodes must pass `EnclaveAttestationClient.verify()` before participating in circuit evaluation (Track 41 integration).
- The `MpcCircuitProcessor` supports addition gates and multiplication gates, enforcing `maxMultiplicationGateDepth` on multiplication chains.
- The `MpcGatedDecryptor` blocks enclave unsealing unless a valid `circuitSatisfactionProof` is presented from a quorum-reaching circuit evaluation.
- Transactions older than `transactionTimeoutSeconds` are rejected at the decryptor gate.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- The `pqcThreshold` stanza formalizes Track 27 PQC threshold signature policy parameters alongside the new Track 54 stanza.

## Test checklist

### Positive paths

- [ ] `MpcCircuitProcessor` initiates a circuit evaluation and emits `MPC_CIRCUIT_EVALUATION_INITIATED`.
- [ ] `MpcGatedDecryptor` unlocks decryption after a valid circuit satisfaction proof and emits `MPC_DECRYPTION_GATE_UNLOCKED`.
- [ ] `CryptoPolicyEngine` validates a compliant `mpcGatedDecryption` configuration.
- [ ] `CryptoPolicyEngine` validates a compliant `pqcThreshold` configuration.
- [ ] `base-adapter.cjs` emits `MPC_CIRCUIT_EVALUATION_INITIATED` and `MPC_DECRYPTION_GATE_UNLOCKED`.
- [ ] `ZkRollupAccumulator` ingests `MPC_CIRCUIT_EVALUATION_INITIATED` events.

### Security / edge cases

- [ ] Reject circuit evaluation without `minCircuitNodes` participants.
- [ ] Reject un-attested committee nodes.
- [ ] Reject multiplication gate depth exceeding `maxMultiplicationGateDepth`.
- [ ] Reject decryption without a valid circuit satisfaction proof.
- [ ] Reject transactions exceeding `transactionTimeoutSeconds`.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateMpcGatedDecryption` for `operation === 'mpcGatedDecryption'`.
- [ ] `CryptoPolicyEngine` has `_validatePqcThreshold` for `operation === 'pqcThreshold'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `mpc-gated-decryption` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest mpc-gated-decryption`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node committee circuit evaluation with attested nodes and verify the decryption gate unlocks.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/mpc-circuit-processor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/mpc-gated-decryptor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/mpc-gated-decryption.test.cjs` *(new)*

## Approval

Pending Validator review.
