# Test Plan: Cross-Model Fine-Tuning Telemetry Collector

> A backend service that extracts, labels, filters, and formats high-quality multi-turn conversation logs from the session audit store into clean datasets for training localized small language models.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Cross-Model Fine-Tuning Telemetry Collector |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | feat/agentic-orchestration |
| Packages touched | ai-platform |

## Scope

### Files in scope

| File | Purpose |
|------|---------|
| `ai-platform/server/lib/fine-tuning-telemetry-store.cjs` | Core collector: reads audit logs, filters conversations, scores quality, formats records |
| `ai-platform/server/lib/fine-tuning-formatter.cjs` | Output formatters for `jsonl`, `alpaca`, and `chatml` training schemas |
| `ai-platform/server/lib/fine-tuning-telemetry-routes.cjs` | REST endpoints for collection and export |
| `ai-platform/server/lib/__tests__/fine-tuning-telemetry.test.cjs` | Jest tests for collection, filtering, scoring, and format export |
| `ai-platform/server/index.cjs` | Mount `/api/telemetry` router |

### APIs / routes

- `GET /api/telemetry/collect?orgId=<orgId>&minTurns=<int>&minRating=<int>&startDate=<ISO>&endDate=<ISO>` — return candidate conversations with quality score
- `POST /api/telemetry/export` — body `{ orgId, format: 'jsonl' | 'alpaca' | 'chatml', filters }`, returns a downloadable dataset artifact
- `POST /api/telemetry/label` — body `{ auditEntryId, label: 'include' | 'exclude' | 'needs_review' }` — human-in-the-loop rating
- `GET /api/telemetry/datasets?orgId=<orgId>` — list generated datasets for the org

### Data sources

- Primary: `ai-platform/server/lib/enterprise-audit-store.cjs` (or the configured audit log store) `ai-inference-audit-logger.cjs` events with `operation` of `chat`, `inference`, or `analysis`.
- Expected fields: `orgId`, `userId`, `operation`, `timestamp`, `input` (prompt), `output` (response), `model`, `metadata.rating`, `metadata.turns`.

### Output schemas

- `jsonl` (default): `{ messages: [{ role, content }] }` per line
- `alpaca`: `{ instruction, input, output }` per line
- `chatml`: OpenAI ChatML JSONL with `role` / `content`

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new `.cjs` files | `node -c ai-platform/server/lib/fine-tuning-telemetry-store.cjs`, `node -c ai-platform/server/lib/fine-tuning-formatter.cjs`, `node -c ai-platform/server/lib/fine-tuning-telemetry-routes.cjs`, `node -c ai-platform/server/index.cjs` | [ ] |
| L1-02 | ai-platform tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-04 | npm audit (no package.json changes expected) | `npm audit` in touched package roots | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Collect multi-turn conversations | `GET /api/telemetry/collect?orgId=demo&minTurns=2` | Returns array of conversations with `score` and `turns` ≥ 2 | [ ] |
| L2-02 | Filter by rating threshold | `GET ...&minRating=3` | Only conversations with `qualityScore >= 3` returned | [ ] |
| L2-03 | Export to JSONL | `POST /api/telemetry/export` with `format: 'jsonl'` | Response is JSONL with `messages` array, no raw PII, one object per line | [ ] |
| L2-04 | Export to Alpaca | `POST ...format: 'alpaca'` | Each line has `instruction`, `input`, `output` | [ ] |
| L2-05 | Human labeling | `POST /api/telemetry/label` an entry as `exclude` | Re-running collect does not include the excluded entry | [ ] |
| L2-06 | List datasets | `GET /api/telemetry/datasets?orgId=demo` | Returns filenames, row counts, formats, and timestamps | [ ] |

---

## Level 3 — Edge cases & security

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Audit log missing turns/rating | Score falls back to heuristic (length + question count) | [ ] |
| L3-02 | Empty result set | Returns empty array / 200, not 500 | [ ] |
| L3-03 | PII / secrets in prompts | Output redacts values matching token-bleed or credential patterns | [ ] |
| L3-04 | Unauthorized org access | Returns 403 or only data for the caller's own `orgId` | [ ] |
| L3-05 | Large exports | Streamed / chunked response, no in-memory buffering of entire dataset | [ ] |
| L3-06 | Idempotent re-export | Same filters produce identical SHA-256 fingerprint of dataset | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No secret values or PII written to exported training files | [ ] |
| S-02 | Telemetry endpoints require authenticated admin or `telemetry:read` permission | [ ] |
| S-03 | File-based exports land in a scoped, org-prefixed output directory | [ ] |
| S-04 | Labels cannot overwrite another org's data | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
