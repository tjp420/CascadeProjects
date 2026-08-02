# Track 44: Fully Decentralized Confidential Token Issuance Protocols — Test Plan

## Objective

Leverage existing Track 26 zk-SNARK prover/verifier structures and Track 37 PSS primitives to execute zero-knowledge asset allocations. Token amounts and tracking metadata remain hidden while the network can still validate ownership claims and minting authority.

## Scope

### Core primitives

- **ConfidentialTokenIssuer** — constructs hidden zero-knowledge asset structures and mints confidential tokens using homomorphic balance commitments.
- **TokenClaimVerifier** — processes zk-SNARK proofs of ownership without exposing asset amounts or tracking metadata.
- **IssuanceTelemetry** — routes consensus milestones to the Track 29 ZK-rollup, emitting `CONFIDENTIAL_TOKEN_MINTED` and `ISSUANCE_PROOF_VALIDATED` audit log entries.

### Policy schema additions

- `confidentialIssuance`:
  - `minTokenBitLength`: 256
  - `allowedBlindingSchemes`: `["pedersen", "hash-to-curve"]`
  - `requireMintingAttestation`: true
  - `allowedMintingAuthorities`: `["mock-authority"]`
  - `requireZkSnarkProof`: true
  - `minProofAgeSeconds`: 0
  - `maxProofAgeSeconds`: 60
  - `allowedCommitmentCurves`: `["secp256k1", "bn254"]`
  - `minIssuanceQuorum`: 2

## Design decisions

- Token balances are committed with Pedersen-style blinding on `secp256k1` or `bn254`.
- Every mint must produce a zk-SNARK proof of correct construction and pass a `TokenClaimVerifier` check.
- The minting node must pass `EnclaveAttestationClient.verify()` before `ConfidentialTokenIssuer.mint()` can proceed (Track 41 integration).
- `TokenClaimVerifier` validates `zk-SNARK` proofs without decrypting balances.
- Telemetry events `CONFIDENTIAL_TOKEN_MINTED` and `ISSUANCE_PROOF_VALIDATED` are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.
- Track 37 PSS deltas can be applied to re-blind token commitments during re-keying.

## Test checklist

### Positive paths

- [ ] `ConfidentialTokenIssuer` mints a token with a valid zk-SNARK proof and attestation.
- [ ] `TokenClaimVerifier` validates a proof of ownership for a committed balance.
- [ ] `CryptoPolicyEngine` validates a compliant `confidentialIssuance` configuration.
- [ ] `base-adapter.cjs` emits `CONFIDENTIAL_TOKEN_MINTED` and `ISSUANCE_PROOF_VALIDATED`.
- [ ] `ZkRollupAccumulator` ingests `CONFIDENTIAL_TOKEN_MINTED` events.

### Security / edge cases

- [ ] Reject mint when `zkSnarkProof` is missing and `requireZkSnarkProof` is true.
- [ ] Reject mint with blinding scheme not in `allowedBlindingSchemes`.
- [ ] Reject mint when token bit length is below `minTokenBitLength`.
- [ ] Reject mint when proof age exceeds `maxProofAgeSeconds`.
- [ ] Reject minting node attestation from an unauthorized authority.
- [ ] Reject claims with invalid zk-SNARK proofs.
- [ ] Reject issuance without `minIssuanceQuorum` approvals.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateConfidentialIssuance` for `operation === 'confidentialIssuance'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `confidential-issuance` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest confidential-issuance`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Mint a token, transfer ownership proof, and verify claim across mock nodes.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/confidential-token-issuer.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/token-claim-verifier.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/confidential-issuance.test.cjs` *(new)*

## Approval

Pending Validator review.
