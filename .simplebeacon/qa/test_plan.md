# Test Plan: Track 125 — Wire wrapWithTenantGovernance into production call sites

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Immutable tenant policy facade, SIEM isolation events, governed validator factory, lookup hub wiring |
| Author (Builder) | Cursor agent |
| Date | 2026-08-05 |
| Branch | feat/track125-zk-verification-isolation |
| Packages touched | ai-platform/server/lib/hsm-adapter |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/zk-tenant-governance.cjs`
- `ai-platform/server/lib/hsm-adapter/pqc-homomorphic-lookup-gating-hub.cjs`
- `ai-platform/server/lib/__tests__/zk-tenant-governance.test.cjs`
- `ai-platform/server/lib/__tests__/zk-validator-isolation.test.cjs`

### Out of scope

- OpenAPI / stash@{0} route documentation
- Rewriting all 40+ ZK claim validators

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax | `node -c` on changed cjs | [ ] |
| L1-02 | Track 125 suites | jest zk-tenant-governance + zk-validator-isolation | [ ] |
| L1-03 | Track 31 lookup hub | jest track31-lookup-gating.test.cjs | [ ] |

## Level 2 — Behavioral

| ID | Check | Pass |
|----|-------|------|
| L2-01 | Lookup hub default path rejects invalid tenant via validateTenant | [ ] |
| L2-02 | skipTenantGovernance preserves bare validator | [ ] |
| L2-03 | Concurrent validateTenant leaves shared this.policy untouched | [ ] |
| L2-04 | Isolation breach emits SIEM CRITICAL zk_isolation_violation | [ ] |

## Level 3 — Reflection

| ID | Check | Pass |
|----|-------|------|
| L3-01 | No ALS dependency; Proxy facade is enough for this.policy readers | [ ] |
| L3-02 | Existing validate(claim) not clobbered when already present | [ ] |
| L3-03 | Energy/biometric hubs still construct validators in tests via factory optionally | [ ] |
