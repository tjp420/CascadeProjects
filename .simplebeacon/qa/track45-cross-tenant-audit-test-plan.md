# Track 45: Decentralized Cross-Tenant Access Auditing & Zero-Trust Accountability Loggers — Test Plan

## Objective

Guarantee non-repudiable, cryptographically signed accountability for every cross-tenant key escrow or blinded PIR query. Build an ironclad cross-tenant verification topology where both the requesting and resource-owning tenants must exchange signed approvals and the resulting dual-linked proof is compressed into the ZK-rollup audit log.

## Scope

### Core primitives

- **CrossTenantAccessAuditor** — intercepts cross-boundary key use, forces both tenants to sign an access proof, and verifies attestation on both endpoints.
- **AccessProofReceipt** — a twin-signature receipt containing both tenant identities, operation type, resource id, timestamps, and dual-linked cryptographic leaf.
- **AuditTelemetry** — emits `CROSS_TENANT_ACCESS_RECOGNIZED` and `AUDIT_RECEIPT_CHAINED` into the Track 29 ZK-rollup accumulator.

### Canonical audit receipt string layout

```
AUDIT:<requestingTenant>:<resourceOwnerTenant>:<operation>:<resourceId>:<timestamp>:<requesterSignature>:<ownerSignature>:<leafHash>
```

### Policy schema additions

- `crossTenantAudit`:
  - `requireAttestationForBothEndpoints`: true
  - `allowedAttestationAuthorities`: `["mock-authority"]`
  - `minSignatureQuorumPerTenant`: 2
  - `maxVerificationWindowSeconds`: 60
  - `allowedOperations`: `["key-escrow", "blind-pir", "identity-lookup"]`
  - `requireDualLinkedProof`: true
  - `requireCanonicalReceiptLayout`: true

## Design decisions

- Both the requesting node and the resource-owner node must pass `EnclaveAttestationClient.verify()` before the access proof is generated (Track 41 integration).
- Each tenant must collect at least `minSignatureQuorumPerTenant` internal approvals.
- The `CrossTenantAccessAuditor` enforces the canonical receipt string layout and rejects non-conforming receipts.
- `AccessProofReceipt` computes a dual-linked leaf hash from the requesting and owning tenant signatures, the operation, the resource id, and a timestamp.
- The auditor rejects any request whose `verificationWindowSeconds` exceeds `maxVerificationWindowSeconds`.
- Telemetry events are routed through `base-adapter.cjs` and into the `ZkRollupAccumulator`.

## Test checklist

### Positive paths

- [ ] `CrossTenantAccessAuditor` recognizes a cross-tenant access and emits `CROSS_TENANT_ACCESS_RECOGNIZED`.
- [ ] `CrossTenantAccessAuditor` generates a dual-linked `AccessProofReceipt` with both signatures and a valid leaf hash.
- [ ] `AccessProofReceipt` serializes into the canonical layout and verifies.
- [ ] `CryptoPolicyEngine` validates a compliant `crossTenantAudit` configuration.
- [ ] `base-adapter.cjs` emits `CROSS_TENANT_ACCESS_RECOGNIZED` and `AUDIT_RECEIPT_CHAINED`.
- [ ] `ZkRollupAccumulator` ingests `CROSS_TENANT_ACCESS_RECOGNIZED` events.

### Security / edge cases

- [ ] Reject access when one or both endpoints are not attested.
- [ ] Reject access when signature quorum is below `minSignatureQuorumPerTenant` for either tenant.
- [ ] Reject access with an operation not in `allowedOperations`.
- [ ] Reject access when verification window exceeds `maxVerificationWindowSeconds`.
- [ ] Reject a receipt that does not follow the canonical layout.
- [ ] Reject a receipt with mismatched signatures or leaf hash.
- [ ] Reject access when `requireDualLinkedProof` is disabled.

### Integration

- [ ] `CryptoPolicyEngine` has `_validateCrossTenantAudit` for `operation === 'crossTenantAudit'`.
- [ ] `base-adapter.cjs` includes the new telemetry hooks without breaking existing ones.
- [ ] Master track runner passes `cross-tenant-audit` test suite.

## Level mapping

- **L1 Deterministic**: `node -c`, `npx jest cross-tenant-audit`, `npx simplebeacon scan --full --gate`.
- **L2 Behavioral**: Simulate a blind-PIR query across two tenants and verify the receipt chain.
- **L3 Reflection**: Spec alignment, minimal file count, no ghost modules.

## Files expected to change

- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/cross-tenant-access-auditor.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/access-proof-receipt.cjs` *(new)*
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/cross-tenant-audit.test.cjs` *(new)*

## Approval

Pending Validator review.
