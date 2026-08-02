# Track 55: Encrypted Storage Deduplication Protocols — Test Plan

## Objective

Introduce secure message-locked encryption primitives (Convergent Encryption) that allow distributed storage nodes to identify and eliminate cross-tenant data duplicates over ciphertext records without decrypting payloads or leaking content attributes to cloud hosts. Building on Track 46 homomorphic computation engines and Track 44 confidential token mint structures.

## Scope

### Core primitives

- **EncryptedStorageDeduplicator** — derives deterministic, message-locked keys and cross-checks cryptographic ciphertext tags across tenant storage boundaries.
- **BlindedConvergenceGuard** — prevents ciphertext tag-spoofing and brute-force dictionary attacks by layering a threshold committee blinding factor over raw data fingerprints before block deduplication.
- **DeduplicationTelemetry** — emits `CIPHERTEXT_TAG_MATCHED` and `DUPLICATE_BLOCK_RECONCILED` into the Track 29 ZK-rollup accumulator.

### Canonical deduplication payload wire layout

```
DEDUP:<chunkId>:<sourceTenantId>:<ciphertextTagHash>:<blindingGroup>:<chunkBitLength>:<crossTenantAllocations>:<attestationHash>:<submitterSignature>
```

### Policy schema additions

- `encryptedDeduplication`:
  - `minChunkBitLength`: 256
  - `maxChunkBitLength`: 4096
  - `maxCrossTenantChunkAllocations`: 16
  - `permittedBlindingGroups`: `["P-256", "P-384", "P-521"]`
  - `requireSubmitterAttestation`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `banMalformedChunkPeers`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- All data-submitting endpoints must pass `EnclaveAttestationClient.verify()` before cross-boundary storage tag comparison can commence (Track 41 integration).
- The `EncryptedStorageDeduplicator` derives deterministic message-locked keys via SHA-256 over the plaintext chunk, then applies a threshold committee blinding factor before producing the final ciphertext tag.
- The `BlindedConvergenceGuard` enforces that raw data fingerprints are never exposed to storage nodes; only blinded ciphertext tags are compared.
- Chunks below `minChunkBitLength` or above `maxChunkBitLength` are rejected.
- Cross-tenant chunk allocations exceeding `maxCrossTenantChunkAllocations` are rejected to prevent storage hotspot abuse.
- Peers broadcasting malformed chunk tokens are automatically banned when `banMalformedChunkPeers` is true.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `EncryptedStorageDeduplicator` derives deterministic ciphertext tags for identical plaintext chunks.
- [ ] `EncryptedStorageDeduplicator` detects and reconciles duplicate blocks across tenants, emitting `CIPHERTEXT_TAG_MATCHED` and `DUPLICATE_BLOCK_RECONCILED`.
- [ ] `BlindedConvergenceGuard` applies threshold committee blinding factor before tag comparison.
- [ ] `CryptoPolicyEngine` validates a compliant `encryptedDeduplication` configuration.
- [ ] `base-adapter.cjs` emits `CIPHERTEXT_TAG_MATCHED` and `DUPLICATE_BLOCK_RECONCILED`.

### Security / edge cases

- [ ] Reject chunks below `minChunkBitLength`.
- [ ] Reject chunks above `maxChunkBitLength`.
- [ ] Reject cross-tenant allocations exceeding `maxCrossTenantChunkAllocations`.
- [ ] Reject un-attested submitter endpoints.
- [ ] Reject attestation authority not in `allowedAttestationAuthorities`.
- [ ] Reject blinding group not in `permittedBlindingGroups`.
- [ ] Automatically ban peers broadcasting malformed chunk tokens.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateEncryptedDeduplication` for `operation === 'encryptedDeduplication'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `encrypted-deduplication` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest encrypted-deduplication`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate cross-tenant chunk submission with attested submitters and verify dedup reconciliation.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/encrypted-storage-deduplicator.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/blinded-convergence-guard.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/encrypted-deduplication.test.cjs` *(new)*

## Approval

Pending Validator review.
