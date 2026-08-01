# test_plan.md

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Multi-Tenant HSM Virtualization & Tokenization |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/key-rotation-store.cjs` (extend with tenant derivation)
- `ai-platform/server/lib/hsm-vault.cjs` or `hsm-providers.cjs` (use tenant key if HSM enabled)
- `ai-platform/server/lib/cluster-keyring-sync.cjs` (record isolation events)
- `ai-platform/server/lib/__tests__/tenant-hsm-isolation.test.cjs` (new)
- `.github/workflows/security-regression-tests.yml` (add test to pattern if needed)

### APIs / routes

- No new public route required; isolation is an internal API change.
- Optional: `GET /api/audit/hsm/tenant/:orgId/fingerprint` for admin visibility (future).

### UI / IDE surfaces

- [ ] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed `.cjs` files | `node -c <file>` | [ ] |
| L1-02 | New tenant HSM tests pass | `cd ai-platform && npx jest --config jest.config.cjs tenant-hsm` | [ ] |
| L1-03 | Existing key-rotation and HSM tests pass | `cd ai-platform && npx jest --config jest.config.cjs key-rotation && npx jest --config jest.config.cjs hsm-vault` | [ ] |
| L1-04 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Same master key, different orgIds produce different tenant keys | Call `deriveTenantKey(orgA)` and `deriveTenantKey(orgB)` | Outputs are different 32-byte hex values | [ ] |
| L2-02 | Tenant key is deterministic and stable | Call `deriveTenantKey(orgA)` twice | Same output both times | [ ] |
| L2-03 | HSM timeout fails closed | Simulate `HSM_TIMEOUT=1` env / stub | Any tokenization throws `hsm_timeout` | [ ] |
| L2-04 | Tenant isolation violation recorded | Attempt to access key for orgB as orgA | `clusterSync._recordEvent('isolation_violation', ...)` is called | [ ] |
| L2-05 | Cluster timeline captures HSM timeout | Trigger HSM timeout | Event `hsm_timeout` in `queryEvents` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | orgId is empty string | Throws `missing_org_id` | [ ] |
| L3-02 | orgId contains special characters | Normalized before HKDF, still produces stable key | [ ] |
| L3-03 | HSM unavailable, no fallback | No in-memory key generated; operation fails | [ ] |
| L3-03 | Rotation preserves tenant isolation | After master rotation, tenant keys change and remain isolated | [ ] |
| L3-05 | Existing key-rotation tests unaffected | `key-rotation-store` defaults keep working | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Tenant keys never stored raw; only derived on demand | [ ] |
| S-02 | No orgA can derive/validate orgB's key | [ ] |
| S-03 | HSM timeout does not fall back to local random key | [ ] |
| S-04 | Cluster events for violations do not include raw key material | [ ] |

---

## Approval

- [x] User approved via question selections
