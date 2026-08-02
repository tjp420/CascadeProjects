# Track 52: Decentralized Multi-Party Zero-Knowledge Access Token Attestation Contracts — Test Plan

## Objective

Elevate platform authorization boundaries into a privacy-preserving, multi-party architecture. External clients can prove access token rights under zero-knowledge constraints without exposing tenant-specific payload metadata or raw user claims. Building on Track 51 PQC identity hubs and Track 46 homomorphic computation.

## Scope

### Core primitives

- **ZkAccessTokenBroker** — processes token issuance claims using homomorphic blind signature weights mapped to multi-party committee signatures.
- **ZkAttestationContractVerifier** — validates succinct zero-knowledge access proofs, ensuring tokens conform to policy-defined expiry and scope filters without disclosing raw attributes.
- **AttestationTelemetry** — emits `ZK_ACCESS_TOKEN_ISSUED` and `ATTESTATION_CONTRACT_VERIFIED` into the Track 29 ZK-rollup accumulator.

### Canonical token receipt and proof payload layout

```
TOKEN:<tokenId>:<scopeHash>:<expiryEpoch>:<committeeSignatures...>:<blindSignatureWeight>:<attestationHash>:<brokerSignature>
```

### Policy schema additions

- `zkTokenAttestation`:
  - `minSignatureQuorum`: 3
  - `maxTokenLifetimeSeconds`: 3600
  - `permittedCurves`: `["P-256", "P-384", "P-521"]`
  - `requireBrokerAttestation`: true
  - `requireVerifierAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banExpiredProofNodes`: true
  - `maxScopesPerToken`: 8
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- Both the issuing broker and validation endpoints must pass `EnclaveAttestationClient.verify()` before an access claim can be signed (Track 41 integration).
- The `ZkAccessTokenBroker` maps blind signature weights to committee signatures, rejecting tokens whose scope count exceeds `maxScopesPerToken`.
- The `ZkAttestationContractVerifier` binds the token id, scope hash, expiry epoch, and committee signatures into a SHA-256 commitment and verifies it matches a regenerated proof.
- Tokens exceeding `maxTokenLifetimeSeconds` are rejected at issuance and verification.
- Nodes broadcasting expired proof contracts are auto-banned when `banExpiredProofNodes` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `ZkAccessTokenBroker` issues a token and emits `ZK_ACCESS_TOKEN_ISSUED`.
- [ ] `ZkAttestationContractVerifier` generates and verifies a valid access proof, emitting `ATTESTATION_CONTRACT_VERIFIED`.
- [ ] `CryptoPolicyEngine` validates a compliant `zkTokenAttestation` configuration.
- [ ] `base-adapter.cjs` emits `ZK_ACCESS_TOKEN_ISSUED` and `ATTESTATION_CONTRACT_VERIFIED`.
- [ ] `ZkRollupAccumulator` ingests `ZK_ACCESS_TOKEN_ISSUED` events.

### Security / edge cases

- [ ] Reject token issuance without `minSignatureQuorum` committee signatures.
- [ ] Reject un-attested broker endpoints.
- [ ] Reject un-attested verifier endpoints.
- [ ] Reject tokens exceeding `maxTokenLifetimeSeconds`.
- [ ] Reject scopes exceeding `maxScopesPerToken`.
- [ ] Reject cryptographic curves not in `permittedCurves`.
- [ ] Reject expired proof contracts and auto-ban nodes when `banExpiredProofNodes` is true.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateZkTokenAttestation` for `operation === 'zkTokenAttestation'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `zk-access-token-attestation` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest zk-access-token-attestation`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-committee token issuance with attested broker and verify the access proof.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/zk-access-token-broker.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-attestation-contract-verifier.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/zk-access-token-attestation.test.cjs` *(new)*

## Approval

Pending Validator review.
