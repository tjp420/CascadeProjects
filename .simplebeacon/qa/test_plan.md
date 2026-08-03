# test_plan.md

> High-throughput cross-enclave simulation for Track 115.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | High-Throughput Cross-Enclave Mesh Saturation Simulation |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | main (post Track 115 convergence @ bab8d644c) |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/__tests__/mesh-saturation-simulation.cjs` (new)
- `ai-platform/server/lib/hsm-adapter/__tests__/mesh-load-worker.cjs` (new)

### APIs / routes

- `PqcMultiEnclaveConfidentialMeshStateReconciliationGatingHub.initializePool`
- `PqcMultiEnclaveConfidentialMeshStateReconciliationGatingHub.reconcileMeshState`
- `ZkMeshReconciliationClaimValidator.validateClaim`
- `hsm-metrics.cjs` counters:
  - `hsm_meshgate_pool_initialized_total`
  - `hsm_zk_mesh_state_reconciled_total`
  - `hsm_epoch_finality_completed_total`
  - `hsm_meshgate_challenge_issued_total`

### UI / IDE surfaces

- [ ] Sidebar webview
- [ ] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new JS/CJS | `node -c __tests__/mesh-saturation-simulation.cjs` | [ ] |
| L1-02 | Syntax on new worker | `node -c __tests__/mesh-load-worker.cjs` | [ ] |
| L1-03 | ai-platform tests unchanged | `cd ai-platform && npx jest pq-multi-enclave...` | [ ] |
| L1-04 | No production files modified | `git diff --name-only` must only show test files | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| SIM-L2-01 | Baseline throughput | Run Stage 1: 1,000 sequential pool init + validation ops | Throughput > 500 ops/sec | [ ] |
| SIM-L2-02 | Telemetry path separation | Run Stage 2: 5,000 concurrent reconcile ops | `hsm_zk_mesh_state_reconciled_total` and `hsm_meshgate_challenge_issued_total` reflect valid vs dropped claims | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| SIM-L3-01 | Concurrency stress | Stage 2 with `os.cpus().length` workers; process exits cleanly | No unhandled handles, no crash | [ ] |
| SIM-L3-02 | Memory reclaim | Measure pre/post RSS under Stage 2 burst | Memory returns to baseline after worker termination | [ ] |
| SIM-L3-03 | Boundary drift | Stage 3 with `Date.now() - timestampMs` of 9,500ms, 10,000ms, and 10,001ms | 9,500/10,000 pass; 10,001+ throws `MESHCLAIM_EPOCH_FINALITY_WINDOW_EXCEEDED` | [ ] |
| SIM-L3-04 | Timestamp isolation | Late valid item in a batch does not inherit timeout of timed-out predecessor | Each claim evaluated independently | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in simulation or logs | [ ] |
| S-02 | No modifications to production security controls | [ ] |

---

## Approval

- [x] User approved this plan (task explicitly included an approved scope)
- Approved by: user  Date: 2026-08-03
