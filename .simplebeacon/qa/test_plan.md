# Test Plan: Track 112 — Telemetry & Endpoint Expansion

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Add Prometheus-style counters and request/response trace IDs for Track 112 upload and PoRep verification endpoints. |
| Author (Builder) | Devin |
| Date | 2026-08-05 |
| Branch | feat/track112-telemetry-endpoint-expansion |
| Packages touched | ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs, ai-platform/server/routes/track112-upload-routes.cjs, ai-platform/server/lib/storage/upload-manager.cjs, ai-platform/server/lib/hsm-adapter/track112/poRep-verifier.cjs, ai-platform/server/lib/hsm-adapter/track112/ingest-queue.cjs, ai-platform/server/lib/hsm-adapter/track112/worker-pool.cjs, ai-platform/server/lib/hsm-adapter/__tests__/track112/upload-routes.int.test.cjs |

## Scope

### Files in scope

- `ai-platform/server/lib/hsm-adapter/hsm-metrics.cjs` — add Track 112 counters
- `ai-platform/server/routes/track112-upload-routes.cjs` — instrument create/chunk/commit and trace IDs
- `ai-platform/server/lib/storage/upload-manager.cjs` — propagate trace IDs and log worker processing
- `ai-platform/server/lib/hsm-adapter/track112/poRep-verifier.cjs` — use `hsmMetrics` counters robustly
- `ai-platform/server/lib/hsm-adapter/track112/ingest-queue.cjs` — correlate trace ID through worker pool
- `ai-platform/server/lib/hsm-adapter/__tests__/track112/upload-routes.int.test.cjs` — expand integration tests

### Out of scope

- UI/IDE surfaces
- New npm dependencies

---

## Level 1 — Deterministic

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed CJS | `node -c` on each changed file | [ ] |
| L1-02 | Integration tests | `npx jest upload-routes` | [ ] |
| L1-03 | Upload manager tests | `npx jest upload-manager` | [ ] |
| L1-04 | Full gate scan | `npx simplebeacon scan --full --gate` | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Create upload increments counter | POST `/api/track112/uploads` | `hsm_track112_upload_create_total` increments | [ ] |
| L2-02 | Chunk upload increments counter | POST `/api/track112/uploads/:id/chunk` | `hsm_track112_upload_chunk_total` increments | [ ] |
| L2-03 | Commit success increments counter | POST `/api/track112/uploads/:id/commit` with valid sig | `hsm_track112_upload_commit_total` increments | [ ] |
| L2-04 | Commit signature failure | POST commit with invalid signature | `hsm_track112_upload_commit_failed_total` with `reason=invalid_signature` increments | [ ] |
| L2-05 | PoRep verification success | Call `PoRepVerifier.verify` with valid proof | `hsm_track112_proofs_verified_total` increments | [ ] |
| L2-06 | PoRep verification failure | Call verify with malformed/mismatch proof | `hsm_track112_proofs_failed_total` increments by reason | [ ] |
| L2-07 | Trace ID propagation | POST with `x-track112-trace-id` header | Response echoes the same trace ID; worker logs include it | [ ] |

## Level 3 — Edge cases & reflection

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Missing trace ID | Request without header | Server generates a new `x-track112-trace-id` and returns it | [ ] |
| L3-02 | Worker pool rejection | Submit over queue limit | `hsm_track112_worker_rejected_total` increments | [ ] |
| L3-03 | Ingest backpressure | Submit over backpressure threshold | `hsm_track112_ingest_backpressure_total` increments | [ ] |

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Metrics do not include session data or raw proofs | [ ] |
| S-02 | Trace IDs are not predictable (UUID or cryptographically random) | [ ] |

## Approval

- [ ] User approved this plan
- Approved by: __________  Date: __________
