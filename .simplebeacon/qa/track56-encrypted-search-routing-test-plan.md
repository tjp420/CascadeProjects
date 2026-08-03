# Track 56: Multi-Party Encrypted Index Search Routing Matrix — Test Plan

## Objective

Construct an advanced multi-party routing protocol that allows nodes to securely check keyword matching parameters directly over encrypted search index matrices across multiple tenant data cells without revealing raw query terms or underlying target documents. Building on Track 46 homomorphic computation, Track 49 homomorphic DB lookup, and Track 54 MPC gated decryption.

## Scope

### Core primitives

- **EncryptedSearchRouter** — accepts structured ciphertext tokens and processes encrypted matrix dot-product operations over blind keyword indicators.
- **MpcSearchMatchVerifier** — aggregates partial evaluation keys across an administrative committee to safely verify lookups without intermediate state visibility.
- **SearchInteroperabilityTelemetry** — emits `ENCRYPTED_SEARCH_ROUTED` and `MPC_INDEX_MATCH_VERIFIED` into the Track 29 ZK-rollup accumulator.

### Canonical encrypted search payload wire layout

```
SEARCH:<queryId>:<sourceTenantId>:<keywordTokenHash>:<blindingCurve>:<indexNodeIds...>:<traversalDepth>:<matchProofHash>:<attestationHash>:<committeeSignature>
```

### Policy schema additions

- `encryptedSearchRouting`:
  - `maxKeywordsPerQuery`: 32
  - `maxIndexTraversalDepth`: 16
  - `allowedBlindingCurves`: `["P-256", "P-384", "P-521"]`
  - `requireSubmitterAttestation`: true
  - `requireIndexNodeAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `minVerificationQuorum`: 3
  - `isolateLowQuorumIndexNodes`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- Both the query-submitting endpoint and the directory indexing nodes must pass `EnclaveAttestationClient.verify()` before a private lookup can be routed (Track 41 integration).
- The `EncryptedSearchRouter` processes encrypted matrix dot-product operations over blind keyword indicators without decrypting query terms or target documents.
- The `MpcSearchMatchVerifier` aggregates partial evaluation keys across an administrative committee, requiring `minVerificationQuorum` nodes to confirm a match.
- Index nodes that drop below `minVerificationQuorum` are automatically isolated when `isolateLowQuorumIndexNodes` is true.
- Queries exceeding `maxKeywordsPerQuery` or `maxIndexTraversalDepth` are rejected.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `EncryptedSearchRouter` routes an encrypted search query and emits `ENCRYPTED_SEARCH_ROUTED`.
- [ ] `MpcSearchMatchVerifier` aggregates committee evaluations and emits `MPC_INDEX_MATCH_VERIFIED`.
- [ ] `CryptoPolicyEngine` validates a compliant `encryptedSearchRouting` configuration.
- [ ] `base-adapter.cjs` emits `ENCRYPTED_SEARCH_ROUTED` and `MPC_INDEX_MATCH_VERIFIED`.

### Security / edge cases

- [ ] Reject queries exceeding `maxKeywordsPerQuery`.
- [ ] Reject index traversal exceeding `maxIndexTraversalDepth`.
- [ ] Reject un-attested submitter endpoints.
- [ ] Reject un-attested index nodes.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject blinding curve not in `allowedBlindingCurves`.
- [ ] Reject verification quorum below `minVerificationQuorum`.
- [ ] Automatically isolate index nodes below quorum threshold.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateEncryptedSearchRouting` for `operation === 'encryptedSearchRouting'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `encrypted-search-routing` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest encrypted-search-routing`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a three-node committee search query with attested submitters and index nodes, verify match confirmation.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/encrypted-search-router.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/mpc-search-match-verifier.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/encrypted-search-routing.test.cjs` *(new)*

## Approval

Pending Validator review.
