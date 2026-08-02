# Track 23: Cross-Tenant Key Escrow Auditing & Provable Multiparty Declassification

> Phase 1 spec. Do not implement feature code until this plan is reviewed and approved.
> Copy source: `templates/qa/test_plan.template.md`

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Cross-tenant key escrow, provable declassification, and dual-authorization audit |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | `feature/track23-groundwork` |
| Packages touched | `ai-platform` |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/escrow-broker.cjs` *(new)* — dual-consent orchestration and active-escrow registry
- `ai-platform/server/lib/hsm-adapter/declassification-proof.cjs` *(new)* — multiparty signed declassification token
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` — escrow policy schema and `_validateEscrow`
- `ai-platform/server/lib/hsm-adapter/base-adapter.cjs` — unwrap-path `ESCROW_CONSENT_MISSING` checkpoint
- `ai-platform/server/lib/hsm-adapter/software-adapter.cjs` — `unwrap` integration
- `ai-platform/server/lib/hsm-adapter/__tests__/key-escrow.test.cjs` *(new)* — functional and regression tests

### APIs / routes

No new HTTP routes for Track 23. The API is the existing `BaseHsmAdapter` lifecycle surface:

- `BaseHsmAdapter#unwrap(tenantId, kekId, wrapped, declassificationToken?)`
- `EscrowBroker#initiateEscrow(sourceTenantId, destTenantId, wrappedKeyRef)`
- `EscrowBroker#consentToEscrow(escrowId, tenantId, signedConsent)`
- `EscrowBroker#finalizeEscrow(escrowId)`

### UI / IDE surfaces

- [ ] n/a — backend-only track

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/hsm-adapter/escrow-broker.cjs` | [ ] |
| L1-02 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/hsm-adapter/declassification-proof.cjs` | [ ] |
| L1-03 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs` | [ ] |
| L1-04 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/hsm-adapter/base-adapter.cjs` | [ ] |
| L1-05 | ai-platform tests | `cd ai-platform && $env:NODE_PATH='..\node_modules'; npx jest key-escrow` | [ ] |
| L1-06 | SimpleBeacon pre-commit gate | `cd ai-platform && npm run sb:hook:pre-commit` | [ ] |
| L1-07 | No secrets in diff | `npx simplebeacon scan --path . --gate` (or manual review) | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Happy path: approved cross-tenant escrow | Source initiates, both tenants sign consent, broker finalizes, token is returned | `unwrap` in destination tenant succeeds with valid token | [ ] |
| L2-02 | Missing destination consent | Source consents only; broker finalization attempted | `ESCROW_CONSENT_MISSING` / `ORACLE_QUORUM_FAILED` thrown before any key material is transferred | [ ] |
| L2-03 | Expired declassification token | Token created with short `tokenExpiryMs`; `unwrap` called after expiry | `ESCROW_CONSENT_MISSING` thrown with `expired` reason | [ ] |
| L2-04 | Cross-tenant unwrap without token | Destination calls `unwrap` on an escrowed key and omits token | `ESCROW_CONSENT_MISSING` thrown | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Same source and destination tenant | `_validateEscrow` / `initiateEscrow` rejects `sourceTenantId === destTenantId` | [ ] |
| L3-02 | Tampered consent payload | Signature verification over the canonical payload fails | `INVALID_ESCROW_SIGNATURE` or `ORACLE_SIGNATURE_INVALID` style error | [ ] |
| L3-03 | Replay of finalized escrow | Reuse the same `escrowId` or same consent signature | `ESCROW_ALREADY_FINALIZED` or signature-replay error | [ ] |
| L3-04 | Unauthorized destination | A third tenant provides a consent signature for an escrow they are not party to | `UNAUTHORIZED_KEY_ACCESS` | [ ] |
| L3-05 | Regression: existing wrap/unwrap without escrow | `SoftwareHsmAdapter` with no `escrowBroker` and no token | Works exactly as in Track 10/13 | [ ] |

---

## Multiparty signature structure

```js
{
  version: 1,
  escrowId: '<uuid>',
  sourceTenantId: '...',
  destTenantId: '...',
  keyRef: '<kekId or wrappedKeyHash>',
  timestamp: 1234567890,
  expiry: 1234570890,
  signatures: [
    { tenantId: 'source', role: 'source', signature: 'base64', publicKeyFingerprint: 'sha256-of-public-key' },
    { tenantId: 'dest',   role: 'dest',   signature: 'base64', publicKeyFingerprint: 'sha256-of-public-key' }
  ]
}
```

- Canonical signing payload: `version|escrowId|sourceTenantId|destTenantId|keyRef|timestamp|expiry`
- Each party signs the canonical payload with their tenant signing key.
- `DeclassificationProof` wraps the payload with the broker attestation signature and an anchored `EpochFrame` timestamp.

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw key material or private keys in logs or commits | [ ] |
| S-02 | Consent payload and declassification token are never persisted unencrypted | [ ] |
| S-03 | Cross-tenant policy is enforced before any `unwrap` | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
