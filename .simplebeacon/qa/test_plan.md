# Test Plan: Track 113 — Ratchet Telemetry Counters and Handshake Latency

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Add `identity_handshake_duration_ms` histogram and `identity_handshake_failed_total` counter to the compatibility shim. |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/track113-pqc-ratchet-migration |
| Packages touched | ai-platform/server/lib/crypto/ratchet |

## Scope

### Files in scope

- `ai-platform/server/lib/crypto/ratchet/compatibility-shim.cjs`
- `ai-platform/server/lib/crypto/ratchet/__tests__/compatibility-shim.test.cjs`

### Out of scope

- UI/IDE surfaces
- New npm dependencies

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax | `node -c` on changed file | [ ] |
| L1-02 | Shim tests | `npx jest compatibility-shim` | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Hybrid duration recorded | Complete hybrid handshake | `identity_handshake_duration_ms` has one observation with `mode=hybrid` | [ ] |
| L2-02 | Classical duration recorded | Complete classical handshake | `identity_handshake_duration_ms` has one observation with `mode=classical` | [ ] |
| L2-03 | Failure counter | Trigger an invalid signature rejection | `identity_handshake_failed_total` with `reason=signature_invalid` increments | [ ] |
| L2-04 | Deprecation failure counter | Trigger past deadline | `identity_handshake_failed_total` with `reason=expired_deadline` increments | [ ] |

## Level 3 — Edge cases & reflection

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | No double counting | Same handshake succeeds | Exactly one duration observation, zero failure counters | [ ] |
| L3-02 | Histogram buckets | Record durations | Buckets include p50/p95/p99-ish counts | [ ] |

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Metrics do not include raw public keys or shared secrets | [ ] |

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
