# test_plan.md

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | PolicySyncer.tsx dashboard UI card |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | main |
| Packages touched | ai-platform/web/simplebeacon-dashboard |

## Scope

### Files in scope

- `ai-platform/web/simplebeacon-dashboard/src/components/PolicySyncer.tsx`
- `ai-platform/web/simplebeacon-dashboard/src/views/SecurityView.tsx`

### APIs / routes

- `GET /api/audit/retention/config` (fallback/mirror used for data shaping)
- Future: `GET /api/audit/pii/policies/:orgId` (optional live counter)

### UI / IDE surfaces

- [x] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed TSX | `npx tsc --noEmit` in `ai-platform/web/simplebeacon-dashboard` or build | [ ] |
| L1-02 | Dashboard build (if touched) | `cd ai-platform/web/simplebeacon-dashboard && npm run build` | [ ] |
| L1-03 | ai-platform tests (if routes touched) | `cd ai-platform && npm test` | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Card renders in SecurityView | Open Security panel | PolicySyncer card with org ID, version, status, rules grid | [ ] |
| L2-02 | Refresh button reloads | Click refresh | Loading state, policy data re-fetched | [ ] |
| L2-03 | Error state | Block API / simulate 500 | Red alert banner with error text | [ ] |
| L2-04 | Live violation counter | If enabled, view counter | Shows blocked request count since startup | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | No policy data | Empty state message | "No policy blueprints currently mapped." |
| L3-02 | Long remediation text | Table cell wraps without overflow | [ ] |
| L3-03 | DENY rule badge styling | Red badge shown for `DENY` effect | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Remediation text renders as text, not HTML | [ ] |

---

## Approval

- [x] User approved this plan via question selections
