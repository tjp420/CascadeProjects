# Test Plan: Track 113 — Compatibility Shim for Classical-Only Peers

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Compatibility shim that negotiates hybrid vs classical mode, emits degraded telemetry, and enforces a deprecation deadline. |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/track113-pqc-ratchet-migration |
| Packages touched | ai-platform/server/lib/crypto/ratchet |

## Scope

### Files in scope

- `ai-platform/server/lib/crypto/ratchet/compatibility-shim.cjs` (new)
- `ai-platform/server/lib/crypto/ratchet/identity-ratchet.cjs` (minor integration)
- `ai-platform/server/lib/crypto/ratchet/__tests__/compatibility-shim.test.cjs` (new)

### Out of scope

- UI/IDE surfaces
- New npm dependencies

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new CJS | `node -c` on new files | [ ] |
| L1-02 | Compatibility tests | `npx jest compatibility-shim` | [ ] |
| L1-03 | No secrets in diff | manual review | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Auto-detect hybrid peer | Pass a hybrid public key to the shim | Mode = `HYBRID`; uses `encapsulateFor` / `decapsulateFrom` | [ ] |
| L2-02 | Auto-detect classical peer | Pass an X25519/Ed25519-only public key | Mode = `CLASSICAL`; uses X25519 ECDH + Ed25519 signatures | [ ] |
| L2-03 | Classical fallback telemetry | Negotiate a classical-only session | Emits `IDENTITY_COMPAT_CLASSICAL_FALLBACK` | [ ] |
| L2-04 | Strict deadline rejection | Set `deprecationEpoch` to a past value and attempt classical | Throws `CLASSICAL_DEPRECATION_DEADLINE` | [ ] |
| L2-05 | Shared secret equivalence | Run hybrid and classical handshakes between compatible peers | Both produce a 32-byte shared secret; classical fallback emits telemetry | [ ] |

## Level 3 — Edge cases & reflection

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Empty public key | Pass `null` or `Buffer.alloc(0)` | Throws `INVALID_PUBLIC_KEY` | [ ] |
| L3-02 | Unknown hybrid version after deadline | Pass unknown version when past deadline | Throws `UNSUPPORTED_HYBRID_KEY_VERSION` | [ ] |
| L3-03 | Deadline not yet reached | Classical peer with future `deprecationEpoch` | Allowed with warning telemetry | [ ] |
| L3-04 | Missing Ed25519 in peer key | Hybrid public key missing `0x01` | Throws `INVALID_HYBRID_KEY_LAYOUT` | [ ] |
| L3-05 | Classical-only deadline grace | Deadline is exactly `now` | Throws `CLASSICAL_DEPRECATION_DEADLINE` | [ ] |
| L3-06 | Hybrid peer ignored by explicit classical mode | Caller requests `CLASSICAL` for hybrid-capable peer | Uses classical mode and emits fallback telemetry | [ ] |

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No raw private keys logged in telemetry | [ ] |
| S-02 | Deprecation deadline checked before classical DH | [ ] |

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
