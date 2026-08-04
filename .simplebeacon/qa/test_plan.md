# Test Plan: Track 32 Prometheus Alert Configuration & Routing

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Track 32 ring-gating Prometheus alerts and Alertmanager routing |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `feat/track32-telemetry-alerting` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/monitoring/prometheus-mesh-alerts.yml` *(add Track 32 alert rules)*
- `ai-platform/monitoring/__tests__/alertmanager-routing.test.cjs` *(add Track 32 routing test)*

### Alerts

| Alert | Severity | Description |
|-------|----------|-------------|
| `Track32RingSignatureReconciliationStall` | critical | Pools initialized but no accreditations in 5m |
| `Track32HighValidationFailureRate` | warning | >15% validation failure ratio in 5m |

---

## Level 1 — Deterministic

| ID | Check | Command | Pass |
|----|-------|---------|------|
| L1-01 | YAML syntax | `cd ai-platform && npx jest alertmanager-routing --coverage=false` | [ ] |
| L1-02 | Parallel suite | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-03 | SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Track 32 alerts route to hsm-crypto-ops-pager | Test with track:32 labels | Contains `hsm-crypto-ops-pager` | [ ] |
| L2-02 | Alert rules present in YAML | Grep for `Track32RingSignatureReconciliationStall` | Found | [ ] |
| L2-03 | Labels include component and tier | Inspect YAML | `component: hsm-mesh-vault`, `tier: post-quantum-crypto` | [ ] |

---

## Approval

- [x] User approved this plan
- Approved by: user  Date: 2026-08-03
