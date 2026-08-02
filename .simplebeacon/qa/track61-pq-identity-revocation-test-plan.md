# Track 61: Post-Quantum Decentralized Identity Revocation Proof Registry Networks — Test Plan

## Objective

Establish a privacy-preserving revocation engine that allows nodes to verify if an identity has been revoked without revealing the specific identity or exposing cross-cluster tracking metadata. Track 61 enforces immediate, zero-knowledge revocation tracking across separate network topologies using post-quantum cryptographic assertions. Building on Track 57 Identity Accumulator Trees and Track 60 Cross-Network Identity Bridge.

## Scope

### Core primitives

- **PqcIdentityRevocationRegistry** — cross-network revocation manager that tracks blacklisted identities via blinded cryptographic accumulation hashes.
- **ZkRevocationProofVerifier** — succinct verification engine that processes non-membership zero-knowledge proofs, allowing nodes to confidently demonstrate their un-revoked status without exposing their raw node attributes or identifier hashes.
- **Revocation Telemetry** — emits `IDENTITY_REVOCATION_PUBLISHED` and `ZK_REVOCATION_PROOF_AUTHENTICATED` into the Track 29 ZK-rollup accumulator.

### Canonical identity revocation publication payload wire layout

```
REVOKPUB:<revocationId>:<sourceTenantId>:<blindedIdentityHash>:<accumulatorRootHash>:<pqcSignatureScheme>:<publisherAttestationHash>:<committeeSignature>
```

### Canonical ZK non-membership proof payload wire layout

```
REVOKPROOF:<proofId>:<revocationId>:<entityBlindedHash>:<nonMembershipWitnessHash>:<verifierAttestationHash>:<zkProofHash>:<partialSignature>
```

### Policy schema additions

- `pqIdentityRevocation`:
  - `minRevocationCommitteeQuorum`: 3
  - `maxRevocationListCapacity`: 100000
  - `maxProofExpirationSeconds`: 3600
  - `allowedPqcSignatureSchemes`: `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`
  - `requirePublisherAttestation`: true
  - `requireVerifierAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedNonMembershipProofs`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All identity revocation threshold criteria—including minimum revocation committee signature quorums, maximum revocation list capacities, and proof expiration tolerances—are managed dynamically via the dedicated `pqIdentityRevocation` stanza in the active `CryptoPolicyEngine` schema.
- Any endpoint publishing a revocation or verifying a non-membership claim must pass `EnclaveAttestationClient.verify()` before the operation can be staged (Track 41 integration).
- The `PqcIdentityRevocationRegistry` tracks blacklisted identities via blinded cryptographic accumulation hashes, preventing cross-cluster tracking metadata exposure.
- The `ZkRevocationProofVerifier` processes non-membership zero-knowledge proofs, allowing nodes to demonstrate un-revoked status without exposing raw node attributes or identifier hashes.
- Peers broadcasting malformed zero-knowledge non-membership proofs are automatically banned when `banMalformedNonMembershipProofs` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `PqcIdentityRevocationRegistry` publishes a revocation and emits `IDENTITY_REVOCATION_PUBLISHED`.
- [ ] `ZkRevocationProofVerifier` processes a valid non-membership proof and emits `ZK_REVOCATION_PROOF_AUTHENTICATED`.
- [ ] `ZkRevocationProofVerifier` correctly identifies a non-revoked identity.
- [ ] `CryptoPolicyEngine` validates a compliant `pqIdentityRevocation` configuration.

### Security / edge cases

- [ ] Reject revocation committee quorum below `minRevocationCommitteeQuorum`.
- [ ] Reject revocation list capacity exceeding `maxRevocationListCapacity`.
- [ ] Reject proof expiration exceeding `maxProofExpirationSeconds`.
- [ ] Reject PQC signature scheme not in `allowedPqcSignatureSchemes`.
- [ ] Reject un-attested publisher.
- [ ] Reject un-attested verifier.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject non-membership proof for a revoked identity.
- [ ] Reject expired proofs.
- [ ] Automatically ban peers broadcasting malformed non-membership proofs.
- [ ] Reject a payload that does not follow the canonical layout.
- [ ] Reject duplicate revocation publications for the same identity.

### Integration

- [ ] `CryptoPolicyEngine` has `_validatePqIdentityRevocation` for `operation === 'pqIdentityRevocation'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `pq-identity-revocation` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest pq-identity-revocation`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node revocation committee with attested publisher and verifier, verify non-membership proof authentication.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-identity-revocation-registry.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-revocation-proof-verifier.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/pq-identity-revocation.test.cjs` *(new)*

## Approval

Pending Validator review.
