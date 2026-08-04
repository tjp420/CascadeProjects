# test_plan.md

> Option F: Active Prometheus Monitoring Rule Dashboarding
> Add metrics counters for newly integrated primitives (DKG gossip, STEK
> rotation, MuSig2), expand alert rules, and scaffold Grafana dashboards.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Option F: Active Prometheus Monitoring Rule Dashboarding |
| Author (Builder) | Devin (Builder mode) |
| Date | 2026-08-04 |
| Branch | feat/prometheus-dashboarding |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` — add DKG gossip, STEK rotation, and MuSig2 counters/gauges/histograms
- `ai-platform/monitoring/prometheus-mesh-alerts.yml` — add alert rules for DKG stall, STEK rotation failure, MuSig2 verification failure
- `ai-platform/monitoring/grafana-dashboards/track115-mesh-reconciliation.json` — NEW: Grafana dashboard for Track 115 (completes existing spec)
- `ai-platform/monitoring/grafana-dashboards/dkg-operations.json` — NEW: Grafana dashboard for DKG gossip operations
- `ai-platform/monitoring/grafana-dashboards/stek-lifecycle.json` — NEW: Grafana dashboard for STEK rotation lifecycle
- `ai-platform/server/lib/__tests__/hsm-metrics-prometheus.test.cjs` — NEW: test suite for new metrics counters and Prometheus exposition format

### Files NOT in scope

- `ai-platform/server/lib/cluster-keyring-sync.cjs` — READ-ONLY (no instrumentation changes in this milestone; metrics are incremented via existing `recordTelemetry` events consumed by a future bridge)
- `ai-platform/server/lib/mpc/schnorr/protocol.cjs` — READ-ONLY (no instrumentation changes; metrics incremented externally)
- `ai-platform/server/routes/` — no route changes (existing `/api/vault/metrics` endpoint already exposes all hsm-metrics counters)
- `deploy/alertmanager/alertmanager-routing.yml` — READ-ONLY (existing routing is sufficient)

### APIs / routes

- `hsmMetrics.incrementCounter(name, value)` — existing, will be called with new counter names
- `hsmMetrics.observeHistogram(name, durationMs)` — existing, will be called with new histogram names
- `hsmMetrics.renderPrometheus()` — existing, will output new counters in Prometheus text format
- `hsmMetrics.getMetrics()` — existing, will include new counters in flat object
- `hsmMetrics.reset()` — existing, will reset new counters to zero
- `/api/vault/metrics` — existing endpoint, no changes needed (auto-exposes all counters)

### UI / IDE surfaces

- [ ] N/A — Grafana dashboards are JSON files consumed by Grafana, not IDE surfaces

---

## Background

The codebase has a comprehensive in-memory metrics registry (`hsm-metrics.cjs`)
with 300+ counters organized by Track, exposed via Prometheus text format at
`/api/vault/metrics`. However, **three critical gaps exist**:

1. **No metrics for DKG gossip protocol** (landed in PR #391)
   - DKG session initiation/completion
   - DKG message throughput (commits, shares, complaints, disqualify, finalize)
   - DKG disqualification rate
   - DKG session timeout

2. **No metrics for STEK rotation** (existing in cluster-keyring-sync.cjs)
   - STEK rotation count
   - STEK validation count and failures
   - Active/retired STEK counts (gauges)

3. **No metrics for MuSig2 protocol** (landed in PR #398)
   - MuSig2 challenge computation count
   - MuSig2 binding factor computation count
   - MuSig2 signature assembly count
   - MuSig2 verification count and failures
   - MuSig2 signing round duration

4. **No Grafana dashboards exist** — the spec document
   (`prometheus-mesh-alerts-spec.md`) specifies 4 panels for Track 115 but no
   dashboard JSON files have been created.

5. **No alert rules for new primitives** — existing alerts only cover Track 115
   mesh reconciliation. No alerts for DKG stall, STEK rotation failure, or
   MuSig2 verification failure.

This milestone adds the missing metrics counters, alert rules, and Grafana
dashboard JSON files.

---

## New Metrics (added to hsm-metrics.cjs)

### DKG Gossip Counters

| Metric Name | Type | Description |
|-------------|------|-------------|
| `hsm_dkg_session_initiated_total` | Counter | DKG sessions initiated |
| `hsm_dkg_session_completed_total` | Counter | DKG sessions completed |
| `hsm_dkg_session_timeout_total` | Counter | DKG sessions that timed out |
| `hsm_dkg_commit_received_total` | Counter | DKG_COMMIT messages received |
| `hsm_dkg_share_received_total` | Counter | DKG_SHARE messages received |
| `hsm_dkg_share_rejected_total` | Counter | DKG_SHARE messages rejected |
| `hsm_dkg_complaint_filed_total` | Counter | DKG_COMPLAINT messages filed |
| `hsm_dkg_node_disqualified_total` | Counter | Nodes disqualified |
| `hsm_dkg_invalid_message_total` | Counter | Invalid DKG messages rejected |
| `hsm_dkg_isolation_violation_total` | Counter | DKG messages from unknown peers |

### STEK Rotation Counters and Gauges

| Metric Name | Type | Description |
|-------------|------|-------------|
| `hsm_stek_rotation_total` | Counter | STEK rotations performed |
| `hsm_stek_validation_total` | Counter | STEK validations performed |
| `hsm_stek_validation_failed_total` | Counter | STEK validations that failed |
| `hsm_stek_active_count` | Gauge | Number of active STEKs (0 or 1) |
| `hsm_stek_retired_count` | Gauge | Number of retired STEKs in window |

### MuSig2 Counters

| Metric Name | Type | Description |
|-------------|------|-------------|
| `hsm_musig2_challenge_computed_total` | Counter | MuSig2 challenge computations |
| `hsm_musig2_binding_factor_computed_total` | Counter | MuSig2 binding factor computations |
| `hsm_musig2_key_aggregation_total` | Counter | MuSig2 public key aggregations |
| `hsm_musig2_nonce_aggregation_total` | Counter | MuSig2 nonce aggregations |
| `hsm_musig2_signature_assembled_total` | Counter | MuSig2 signatures assembled |
| `hsm_musig2_signature_verified_total` | Counter | MuSig2 signatures verified |
| `hsm_musig2_signature_verification_failed_total` | Counter | MuSig2 verification failures |

---

## New Alert Rules (added to prometheus-mesh-alerts.yml)

### DKG Gossip Alerts

| Alert Name | Severity | Condition | For | Purpose |
|------------|----------|-----------|-----|---------|
| `DkgSessionStall` | critical | `rate(hsm_dkg_session_initiated_total[10m]) > 0 and rate(hsm_dkg_session_completed_total[10m]) == 0` | 5m | DKG sessions are starting but none are completing |
| `DkgHighRejectionRate` | warning | `rate(hsm_dkg_share_rejected_total[5m]) / (rate(hsm_dkg_share_received_total[5m]) + 1) > 0.3` | 2m | >30% of DKG shares are being rejected |
| `DkgHighDisqualificationRate` | warning | `rate(hsm_dkg_node_disqualified_total[5m]) > 5` | 2m | Nodes being disqualified at high rate |
| `DkgSessionTimeoutSpike` | warning | `rate(hsm_dkg_session_timeout_total[5m]) > 2` | 5m | DKG sessions timing out frequently |

### STEK Rotation Alerts

| Alert Name | Severity | Condition | For | Purpose |
|------------|----------|-----------|-----|---------|
| `StekRotationFailure` | critical | `rate(hsm_stek_rotation_total[1h]) == 0 and hsm_stek_active_count == 0` | 10m | No STEK is active and rotations are not happening |
| `StekValidationFailureSpike` | warning | `rate(hsm_stek_validation_failed_total[5m]) > 10` | 2m | STEK validations failing at high rate |

### MuSig2 Alerts

| Alert Name | Severity | Condition | For | Purpose |
|------------|----------|-----------|-----|---------|
| `Musig2VerificationFailureSpike` | warning | `rate(hsm_musig2_signature_verification_failed_total[5m]) > 5` | 2m | MuSig2 signature verifications failing at high rate |
| `Musig2SigningStall` | warning | `rate(hsm_musig2_signature_assembled_total[10m]) == 0 and rate(hsm_musig2_challenge_computed_total[10m]) > 0` | 5m | Challenges are being computed but no signatures are being assembled |

---

## Grafana Dashboards

### Dashboard 1: Track 115 Mesh Reconciliation (completes existing spec)

**File**: `ai-platform/monitoring/grafana-dashboards/track115-mesh-reconciliation.json`

**Panels** (from `prometheus-mesh-alerts-spec.md`):
1. Time series: `rate(hsm_zk_mesh_state_reconciled_total[5m])` and `rate(hsm_meshgate_challenge_issued_total[5m])`
2. Gauge: Drop ratio over last 5 minutes
3. Single-stat: `hsm_epoch_finality_completed_total` over last hour
4. Table: Active alert states

### Dashboard 2: DKG Gossip Operations

**File**: `ai-platform/monitoring/grafana-dashboards/dkg-operations.json`

**Panels**:
1. Time series: DKG session initiation vs completion rates
2. Time series: DKG message throughput by type (commit, share, complaint, disqualify, finalize)
3. Gauge: DKG share rejection rate
4. Single-stat: Total DKG sessions completed
5. Single-stat: Total nodes disqualified
6. Table: DKG isolation violations

### Dashboard 3: STEK Lifecycle

**File**: `ai-platform/monitoring/grafana-dashboards/stek-lifecycle.json`

**Panels**:
1. Time series: STEK rotation rate
2. Gauge: Active STEK count
3. Gauge: Retired STEK count
4. Single-stat: Total STEK rotations
5. Time series: STEK validation failures

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on hsm-metrics.cjs | `node -c ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` | [ ] |
| L1-02 | Syntax on test file | `node -c ai-platform/server/lib/__tests__/hsm-metrics-prometheus.test.cjs` | [ ] |
| L1-03 | YAML lint on alert rules | `node -e "require('js-yaml').load(require('fs').readFileSync('ai-platform/monitoring/prometheus-mesh-alerts.yml','utf8'))"` | [ ] |
| L1-04 | JSON lint on dashboard 1 | `node -e "JSON.parse(require('fs').readFileSync('ai-platform/monitoring/grafana-dashboards/track115-mesh-reconciliation.json','utf8'))"` | [ ] |
| L1-05 | JSON lint on dashboard 2 | `node -e "JSON.parse(require('fs').readFileSync('ai-platform/monitoring/grafana-dashboards/dkg-operations.json','utf8'))"` | [ ] |
| L1-06 | JSON lint on dashboard 3 | `node -e "JSON.parse(require('fs').readFileSync('ai-platform/monitoring/grafana-dashboards/stek-lifecycle.json','utf8'))"` | [ ] |
| L1-07 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-08 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [ ] |
| L1-09 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-10 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral (Metrics correctness)

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | DKG counters increment correctly | Call `incrementCounter('hsm_dkg_session_initiated_total')` 3 times; verify `getMetrics()` returns 3 | Counter value is 3 | [ ] |
| L2-02 | STEK counters increment correctly | Call `incrementCounter('hsm_stek_rotation_total')` 5 times; verify `getMetrics()` returns 5 | Counter value is 5 | [ ] |
| L2-03 | MuSig2 counters increment correctly | Call `incrementCounter('hsm_musig2_challenge_computed_total')` 10 times; verify | Counter value is 10 | [ ] |
| L2-04 | STEK gauges set correctly | Call `incrementCounter('hsm_stek_active_count', 1)`; verify gauge value is 1 | Gauge value is 1 | [ ] |
| L2-05 | STEK retired count gauge | Call `incrementCounter('hsm_stek_retired_count', 3)`; verify | Gauge value is 3 | [ ] |
| L2-06 | renderPrometheus includes DKG counters | Increment DKG counters; call `renderPrometheus()`; verify output contains `hsm_dkg_session_initiated_total` | Output contains new counter names | [ ] |
| L2-07 | renderPrometheus includes STEK counters | Increment STEK counters; call `renderPrometheus()`; verify output contains `hsm_stek_rotation_total` | Output contains new counter names | [ ] |
| L2-08 | renderPrometheus includes MuSig2 counters | Increment MuSig2 counters; call `renderPrometheus()`; verify output contains `hsm_musig2_challenge_computed_total` | Output contains new counter names | [ ] |
| L2-09 | reset() clears all new counters | Increment new counters; call `reset()`; verify all new counters are 0 | All new counters reset to 0 | [ ] |
| L2-10 | Histogram observation works for DKG | Call `observeHistogram('hsm_dkg_round_duration_ms', 150)`; verify histogram count and sum | Histogram count=1, sum=150 | [ ] |
| L2-11 | Existing counters remain unaffected | Increment existing counters; verify they still work alongside new counters | Existing counters work | [ ] |
| L2-12 | Prometheus exposition format is valid | Call `renderPrometheus()`; verify format matches `# TYPE <name> counter` + `<name> <value>` | Valid Prometheus text format | [ ] |

---

## Level 3 — Edge cases & validation

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Increment unknown counter — no crash | Call `incrementCounter('unknown_metric')`; verify no error thrown | No error, unknown counter ignored | [ ] |
| L3-02 | Observe histogram with unknown name — no crash | Call `observeHistogram('unknown_histogram', 100)`; verify no error | No error, unknown histogram ignored | [ ] |
| L3-03 | Negative increment value — no crash | Call `incrementCounter('hsm_dkg_session_initiated_total', -1)`; verify behavior | No crash (counter may go negative or clamp) | [ ] |
| L3-04 | All new counter names follow `hsm_` prefix convention | Verify all new counter names start with `hsm_` | All names follow convention | [ ] |
| L3-05 | Alert rules YAML is valid Prometheus rule format | Parse YAML and verify `groups` structure with `rules` array | Valid Prometheus rule format | [ ] |
| L3-06 | Grafana dashboard JSON has required fields | Verify each dashboard JSON has `title`, `panels`, `schemaVersion` | Required fields present | [ ] |
| L3-07 | No regression in existing metrics tests | All existing hsm-metrics tests still pass | No regressions | [ ] |
| L3-08 | No regression in parallel orchestrator | 103/103 suites still pass | No regressions | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in dashboard JSON or alert rules | [ ] |
| S-02 | No real cluster node IPs in Grafana datasource configs | [ ] |
| S-03 | Alert runbook URLs point to internal repo, not external | [ ] |
| S-04 | Dashboard JSON does not contain hardcoded credentials | [ ] |

---

## Implementation notes

### hsm-metrics.cjs changes (Broom strategy — extend existing file)

Add new counters to the existing `counters` object:

```javascript
// DKG Gossip Protocol counters (PR #391)
hsm_dkg_session_initiated_total: 0,
hsm_dkg_session_completed_total: 0,
hsm_dkg_session_timeout_total: 0,
hsm_dkg_commit_received_total: 0,
hsm_dkg_share_received_total: 0,
hsm_dkg_share_rejected_total: 0,
hsm_dkg_complaint_filed_total: 0,
hsm_dkg_node_disqualified_total: 0,
hsm_dkg_invalid_message_total: 0,
hsm_dkg_isolation_violation_total: 0,
// STEK Rotation counters and gauges
hsm_stek_rotation_total: 0,
hsm_stek_validation_total: 0,
hsm_stek_validation_failed_total: 0,
hsm_stek_active_count: 0,
hsm_stek_retired_count: 0,
// MuSig2 Protocol counters (PR #398)
hsm_musig2_challenge_computed_total: 0,
hsm_musig2_binding_factor_computed_total: 0,
hsm_musig2_key_aggregation_total: 0,
hsm_musig2_nonce_aggregation_total: 0,
hsm_musig2_signature_assembled_total: 0,
hsm_musig2_signature_verified_total: 0,
hsm_musig2_signature_verification_failed_total: 0,
```

Add new histogram:

```javascript
hsm_dkg_round_duration_ms: { buckets: [100, 500, 1000, 5000, 10000, 30000, 60000], sum: 0, count: 0 }
```

### Alert rules (extend existing YAML file)

Add two new groups to `prometheus-mesh-alerts.yml`:
- `dkg_gossip_alerts` — 4 alert rules
- `stek_rotation_alerts` — 2 alert rules
- `musig2_protocol_alerts` — 2 alert rules

### Grafana dashboards (new JSON files)

Create 3 Grafana dashboard JSON files in `ai-platform/monitoring/grafana-dashboards/`:
- Each dashboard follows Grafana's JSON model (schemaVersion, panels, templating)
- Datasource: Prometheus (configured via Grafana provisioning)
- Panels use PromQL queries matching the new metrics

### Test strategy

- New test file `hsm-metrics-prometheus.test.cjs` validates:
  - All new counters increment correctly
  - `renderPrometheus()` includes new counters in valid format
  - `reset()` clears all new counters
  - Histograms observe values correctly
  - No regression in existing counter behavior

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
