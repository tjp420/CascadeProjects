# Track 49: Fully Homomorphic Cross-Tenant Database Lookup Protocol — Test Plan

## Objective

Allow tenants to query a cross-tenant data registry to confirm existence or metadata attributes over encrypted columns without decrypting or exposing underlying database fields. Build on Track 46 homomorphic computation engines.

## Scope

### Core primitives

- **HomomorphicDbLookupEngine** — accepts encrypted search filters and executes matching dot-product computations directly across ciphertext columns.
- **ZkMatchAttestation** — generates zero-knowledge attestations confirming matching database records without leaking private data properties.
- **DatabaseLookupTelemetry** — emits `HOMOMORPHIC_DB_QUERY_INITIATED` and `ZK_LOOKUP_MATCH_VERIFIED` into the Track 29 ZK-rollup accumulator.

### Canonical lookup query payload layout

```
LOOKUP:<tenantId>:<tableAlias>:<encryptedFilterHash>:<requestedColumns>:<queryEpoch>:<queryAttestationSignature>
```

### Policy schema additions

- `homomorphicDbLookup`:
  - `maxEncryptedColumnsPerQuery`: 8
  - `allowedBlindingTypes`: `["pedersen", "exponential-elgamal"]`
  - `requireQueryAttestation`: true
  - `allowedQueryAuthorities`: `["mock-authority"]`
  - `maxQueryAgeSeconds`: 60
  - `requireZkMatchAttestation`: true
  - `allowCrossTenantTables`: true
  - `requireCanonicalPayloadLayout`: true

## Design decisions

- The `HomomorphicDbLookupEngine` extends the Pedersen-style commitment math from Track 46 to perform dot products between encrypted filter vectors and ciphertext columns.
- The query-originating endpoint must pass `EnclaveAttestationClient.verify()` before processing (Track 41 integration).
- `ZkMatchAttestation` binds the encrypted filter, result columns, tenant id, and query epoch into a SHA-256 commitment and verifies it matches a regenerated proof.
- Cross-tenant table access is permitted only when `allowCrossTenantTables` is true and the tenant matches an allowlist.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `HomomorphicDbLookupEngine` executes an encrypted dot-product lookup and returns a match vector.
- [ ] `ZkMatchAttestation` generates and verifies a match attestation for a found record.
- [ ] `CryptoPolicyEngine` validates a compliant `homomorphicDbLookup` configuration.
- [ ] `base-adapter.cjs` emits `HOMOMORPHIC_DB_QUERY_INITIATED` and `ZK_LOOKUP_MATCH_VERIFIED`.
- [ ] `ZkRollupAccumulator` ingests `HOMOMORPHIC_DB_QUERY_INITIATED` events.

### Security / edge cases

- [ ] Reject queries exceeding `maxEncryptedColumnsPerQuery`.
- [ ] Reject un-attested query originators.
- [ ] Reject queries older than `maxQueryAgeSeconds`.
- [ ] Reject blinding types not in `allowedBlindingTypes`.
- [ ] Reject cross-tenant lookups when `allowCrossTenantTables` is disabled.
- [ ] Reject a missing `zkMatchAttestation` when `requireZkMatchAttestation` is true.
- [ ] Reject a payload that does not follow the canonical layout.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateHomomorphicDbLookup` for `operation === 'homomorphicDbLookup'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `homomorphic-db-lookup` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest homomorphic-db-lookup`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate an encrypted cross-tenant lookup and verify the match attestation.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/homomorphic-db-lookup-engine.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/zk-match-attestation.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/homomorphic-db-lookup.test.cjs` *(new)*

## Approval

Pending Validator review.
