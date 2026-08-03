# test_plan.md

> Post-Mortem Broom Strategy Review & Boundary Verification

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Post-mortem Broom Strategy review for Tracks 91-115 PQC upgrade |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | main |
| Packages touched | ai-platform (analytical pass only) |

## Scope

### Files in scope

- All Track 91-115 source components under `ai-platform/server/lib/hsm-adapter/`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-schema.json`
- `ai-platform/server/lib/hsm-adapter/crypto-policy-engine.cjs`
- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs`
- `ai-platform/server/routes/hsm-vault-routes.cjs`
- `ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs`

### APIs / routes

- `/api/vault/*/policy`
- `/api/vault/*/policy/validate`
- `/api/vault/*/telemetry`

### UI / IDE surfaces

- [ ] Sidebar webview
- [ ] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Working tree clean | `git status --short` | [ ] |
| L1-02 | Stash containment | `git stash list` | [ ] |
| L1-03 | No `console.log` in new gating hubs | `grep -R "console\." ai-platform/server/lib/hsm-adapter/pqc-*.cjs` | [ ] |
| L1-04 | Master test matrix green | `node run-all-tracks.cjs --all` | [ ] |
| L1-05 | SimpleBeacon gate | `npx simplebeacon scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | No legacy coupling in GroupReshardEngine | `grep GroupReshardEngine` in gating hubs | No references | [ ] |
| L2-02 | All 115 tracks registered in runner | Count `pq-` / `zk-` / `hsm-` entries in `run-all-tracks.cjs` | >= 115 | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | No ghost schemas in `crypto-policy-schema.json` | Every top-level `pq*Gating` key has a matching validator in `crypto-policy-engine.cjs` | [ ] |
| L3-02 | No cross-track state contamination | Each hub uses isolated `Map`/`Set` and unique error prefixes | [ ] |
| L3-03 | No experimental `fix-*.cjs` files committed | `git ls-files "ai-platform/fix-*.cjs"` returns empty | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in runbook or ledger | [ ] |
| S-02 | No modifications to security controls during review | [ ] |

---

## Approval

- [x] User approved this plan (task explicitly included an approved scope)
- Approved by: user  Date: 2026-08-03
