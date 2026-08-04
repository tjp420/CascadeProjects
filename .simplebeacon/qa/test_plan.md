# Test Plan: Track 113 Prometheus Alert Configuration & Routing

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Add Track 113 PromQL alert rules and verify Alertmanager routing |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track113-telemetry-alerting` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/monitoring/prometheus-mesh-alerts.yml` *(append Track 113 rules)*
- `ai-platform/monitoring/__tests__/alertmanager-routing.test.cjs` *(extend routing assertion)*

### APIs / routes

N/A — alerting config only.

### UI / IDE surfaces

None.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Prometheus YAML syntax | `node -c ai-platform/monitoring/__tests__/alertmanager-routing.test.cjs` (the parser is exercised by the test) | [ ] |
| L1-02 | Alertmanager routing tests | `cd ai-platform && npx jest alertmanager-routing --coverage=false` | [ ] |
| L1-03 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-04 | Full SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Track 113 handshake stall critical | Parse `prometheus-mesh-alerts.yml` for `Track113PqcHandshakeStall` | Rule present with 5m duration | [ ] |
| L2-02 | Track 113 high decryption failure warning | Parse for `Track113HighDecryptionFailureRate` | Rule present with 2m duration | [ ] |
| L2-03 | Label mapping | Check labels on Track 113 group | `component: hsm-mesh-vault`, `tier: post-quantum-crypto`, `service: hsm-vault-handshake` | [ ] |
| L2-04 | Receiver binding | Run routing test | Track 113 alerts route to `hsm-crypto-ops-pager` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | No regression on Track 31 alerts | Track 31 rules still parse and route | [ ] |
| L3-02 | No new dependencies | PromQL and Alertmanager only | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials in alert annotations | [ ] |

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-03
