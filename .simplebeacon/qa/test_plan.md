# Test Plan: Track 113 — SIEM Telemetry for Optimized Broker Queues

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Add SIEM queue depth, token bucket, and flush metrics to the broker and exporter. |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/track113-pqc-ratchet-migration |
| Packages touched | ai-platform/server/lib/siem, ai-platform/server/lib/siem-exporter.cjs |

## Scope

### Files in scope

- `ai-platform/server/lib/siem/siem-broker.cjs`
- `ai-platform/server/lib/siem-exporter.cjs`
- `ai-platform/server/lib/__tests__/siem-broker.test.cjs`
- `ai-platform/server/lib/__tests__/siem-exporter.test.cjs`
- `ai-platform/scripts/perf-siem-profile.cjs`

### Out of scope

- Track 113 hybrid KEM / signature implementation (separate design review)
- UI/IDE surfaces
- New dependencies

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed CJS | `node -c ai-platform/server/lib/siem/siem-broker.cjs` and `node -c ai-platform/server/lib/siem-exporter.cjs` | [ ] |
| L1-02 | Broker + exporter unit tests | `npx jest siem-broker siem-exporter` | [ ] |
| L1-03 | SIEM perf profile | `node ai-platform/scripts/perf-siem-profile.cjs` (no unhandled errors) | [ ] |
| L1-04 | No secrets in diff | manual review of changed files | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Token bucket metrics visible | Create broker with maxTokens=5; call `getMetrics()` | `siem_tokens_available` ≤ 5 and `siem_tokens_consumed_total` = events processed | [ ] |
| L2-02 | Refill counter increments | Drain tokens and wait one refill interval | `siem_tokens_refilled_total` increments after refill | [ ] |
| L2-03 | Queue depth metric | Enqueue 10 events with batch size 5; call `getMetrics()` | `siem_queue_depth_current` = 10 before flush, < 10 after flush | [ ] |
| L2-04 | Queue overflow counter | Push > max queue depth in one burst | `siem_queue_dropped_total` > 0 | [ ] |

## Level 3 — Edge cases & reflection

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Token bucket refill does not over-cap | Wait multiple refill intervals | `siem_tokens_available` never exceeds `maxTokens` | [ ] |
| L3-02 | Metrics survive `resetQueue` | Reset queue and read metrics | `siem_queue_dropped_total` preserved; `siem_queue_depth_current` = 0 | [ ] |
| L3-03 | No perf regression | `perf-siem-profile.cjs` | Queue drain still O(1) and throughput ≥ 200k ops/s | [ ] |

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Metrics do not expose raw chain keys or tokens | [ ] |

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
