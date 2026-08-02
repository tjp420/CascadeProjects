# Track 71: Post-Quantum Zero-Knowledge Cross-Chain Decentralized Sovereign Identity Gating Matrix — Test Plan

## Objective

Establish a privacy-preserving decentralized sovereign identity and attestation proof gating layer that scales cross-chain. Track 71 enforces non-repudiable identity validation boundaries across shared networks while completely preventing credential profiling and user tracking loops. Builds directly upon the Track 57 Identity Accumulator Trees and Track 61 Revocation Registry Networks, enabling corporate and sovereign tenants to initialize attestation engines across independent networks. This architecture allows entities to prove multi-attribute claims anonymously using non-interactive zero-knowledge range and compliance gating proofs without exposing raw identity vectors or credential tracking indices.

## Scope

### Core primitives

- **PqcIdentityGatingHub** — interlocking attestation coordinator that instantiates multi-party claim verification pools using homomorphically split Pedersen commitments over raw credentials, attribute metrics, and identity hashes.
- **ZkIdentityGatingValidator** — succinct gating verifier that processes non-interactive zero-knowledge range and threshold validation proofs, ensuring an entity's hidden claim status strictly satisfies the policy-defined criteria without disclosing individual parameter attributes.
- **Gating Matrix Lifecycle Telemetry** — emits `IDENTITY_GATING_POOL_INITIALIZED`, `ZK_ATTRIBUTE_CLAIM_VERIFIED`, and `SOVEREIGN_IDENTITY_GATING_COMPLETED` into the Track 29 ZK-rollup accumulator.

### Canonical identity gating pool initialization payload wire layout

```
IDGATE:<poolId>:<sourceTenantId>:<targetChainId>:<blindedRawCredentialCommitment>:<blindedAttributeMetricCommitment>:<blindedIdentityHashCommitment>:<attestationContractLifetimeSeconds>:<credentialDepth>:<pqcSignatureScheme>:<identityInitializerAttestationHash>:<committeeSignature>
```

### Canonical attribute claim verification payload wire layout

```
ATTRCLAIM:<claimId>:<poolId>:<blindedAttributeMetricCommitment>:<blindedClaimValueCommitment>:<zkAttributeRangeProofHash>:<clearingCommitteeAttestationHash>:<partialSignature>
```

### Canonical sovereign identity gating completion payload wire layout

```
IDGATECOMPLETE:<completionId>:<poolId>:<claimSignatureCount>:<pqcSignatureScheme>:<committeeSignatures>
```

### Policy schema additions

- `pqIdentityGating`:
  - `minAttestationQuorum`: 3
  - `maxAttestationContractLifetimeSeconds`: 31536000
  - `maxCredentialDepth`: 16
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requireIdentityInitializerAttestation`: true
  - `requireClearingCommitteeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedOrOutOfOrderIdentityClaims`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All decentralized identity gating criteria—including minimum attestation quorums, maximum attestation contract lifetime profiles, allowed credential depth parameters, and post-quantum curve structures—are managed dynamically via the dedicated `pqIdentityGating` stanza in the active `CryptoPolicyEngine` schema.
- Both the identity-initializing endpoint and the processing clearing committee relays must pass `EnclaveAttestationClient.verify()` before a state transition can be signed (Track 41 integration).
- The `PqcIdentityGatingHub` instantiates multi-party claim verification pools using homomorphically split Pedersen commitments over raw credentials, attribute metrics, and identity hashes, preventing credential profiling and user tracking loops.
- The `ZkIdentityGatingValidator` processes non-interactive zero-knowledge range and threshold validation proofs, ensuring an entity's hidden claim status strictly satisfies the policy-defined criteria without disclosing individual parameter attributes.
- Peers broadcasting malformed or out-of-order identity claims are automatically banned when `banMalformedOrOutOfOrderIdentityClaims` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcIdentityGatingHub` initializes an identity gating pool and emits `IDENTITY_GATING_POOL_INITIALIZED`.
- [ ] `ZkIdentityGatingValidator` verifies an attribute claim and emits `ZK_ATTRIBUTE_CLAIM_VERIFIED`.
- [ ] `PqcIdentityGatingHub` completes sovereign identity gating after quorum and emits `SOVEREIGN_IDENTITY_GATING_COMPLETED`.
- [ ] `CryptoPolicyEngine` validates a compliant `pqIdentityGating` configuration.

### Security / edge cases

- [ ] Reject attestation quorum below `minAttestationQuorum`.
- [ ] Reject attestation contract lifetime seconds exceeding `maxAttestationContractLifetimeSeconds`.
- [ ] Reject credential depth exceeding `maxCredentialDepth`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested identity initializer.
- [ ] Reject un-attested clearing committee.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject attribute claims exceeding the contract lifetime window.
- [ ] Reject malformed attribute claims (missing zkAttributeRangeProofHash, missing partialSignature).
- [ ] Reject duplicate pool initializations.
- [ ] Reject sovereign identity gating completion before attribute claim verification.
- [ ] Reject sovereign identity gating completion with insufficient quorum.
- [ ] Automatically ban peers broadcasting malformed or out-of-order identity claims.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqIdentityGating` for `operation === 'pqIdentityGating'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-identity-gating` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-identity-gating`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-signer attestation quorum with attested identity initializer and clearing committee relay, verify attribute claim authentication and sovereign identity gating completion after quorum.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-identity-gating-hub.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-identity-gating-validator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-identity-gating.test.cjs` *(new)*

## Approval

Pending Validator review.
