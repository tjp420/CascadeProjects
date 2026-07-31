# Test Plan: Fine-Tuning Curation Panel

> Dashboard management interface for the fine-tuning-telemetry-store, allowing compliance officers to filter conversation datasets by quality scores, adjust user/model dialogue labelings, and trigger exports.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Fine-Tuning Curation Panel |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | feat/agentic-orchestration |
| Packages touched | ai-platform (backend), web/simplebeacon-dashboard (frontend) |

## Scope

### Files in scope

| File | Purpose |
|------|---------|
| `ai-platform/web/simplebeacon-dashboard/src/views/FineTuningCurationView.tsx` | New top-level view for the curation panel |
| `ai-platform/web/simplebeacon-dashboard/src/components/FineTuningCurationPanel.tsx` | Curation UI: table, filters, label editor, export trigger |
| `ai-platform/web/simplebeacon-dashboard/src/App.tsx` | Register `fine-tuning` route and view map |
| `ai-platform/web/simplebeacon-dashboard/src/layout/Sidebar.tsx` | Add navigation link |
| `ai-platform/server/lib/fine-tuning-telemetry-store.cjs` | No backend changes expected; use existing `/api/telemetry/*` routes |

### Existing APIs used

- `GET /api/telemetry/collect?orgId=...&minRating=...&minTurns=...&label=...&operation=...&startDate=...&endDate=...&q=...&page=...&limit=...`
- `POST /api/telemetry/label` body `{ eventId, label }`
- `POST /api/telemetry/export` body `{ format, filters }`
- `GET /api/telemetry/datasets?orgId=...`

### Backend enhancements

- Extend `fine-tuning-telemetry-store.cjs` `listEntries` to support `q` (case-insensitive search across `input`, `output`, `model`, `userId`, `eventId`) and `page`/`limit` pagination.
- Extend `fine-tuning-telemetry-routes.cjs` `GET /collect` to pass `q`, `page`, `limit` through `normalizeFilters` and return `page`, `limit`, `total`, `count`, `entries`.

### User flow

1. Compliance officer opens **Fine-Tuning** panel from sidebar.
2. View loads entries for the active org, filtered by default to `minRating=0` and no `label=exclude`.
3. Officer sets filters (min score, min turns, label, operation, date range).
4. Officer selects rows and applies a label (`include`, `exclude`, `review`, `golden`).
5. Officer clicks **Export** to generate a `jsonl`/`alpaca`/`chatml` dataset and sees the generated file in the datasets list.
6. Datasets list updates after export.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | TypeScript compile of dashboard | `cd ai-platform/web/simplebeacon-dashboard && npm run build` (or `npm run compile` if available) | [ ] |
| L1-02 | ai-platform backend tests | `cd ai-platform && npm test` | [ ] |
| L1-03 | SimpleBeacon full gate | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-04 | No new dependencies or `npm audit` changes | `npm audit` in touched package roots | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | View loads and lists entries | Open `#/fine-tuning` in dashboard | Table renders with telemetry entries and scores | [ ] |
| L2-02 | Filters change visible rows | Set `minRating` to `7` and `label` to `pending` | Only matching rows shown | [ ] |
| L2-03 | Search filters entries | Type a keyword in the search box | Only entries with matching input/output/model/userId/eventId shown | [ ] |
| L2-04 | Pagination works | Click page 2 or change limit | Different page of results loaded | [ ] |
| L2-05 | Label an entry | Select an entry, choose label, click **Apply** | Entry row updates to new label, toast confirms | [ ] |
| L2-06 | Export a dataset | Choose `jsonl` format, click **Export** | Modal/toast shows filename and row count; datasets list updates | [ ] |
| L2-07 | Sidebar link works | Click **Fine-Tuning** in sidebar | URL changes to `#/fine-tuning` and view renders | [ ] |

---

## Level 3 — Edge cases & security

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Empty store | Empty table with helpful message, no crash | [ ] |
| L3-02 | Backend returns 500 | Error toast shown, table loading state cleared | [ ] |
| L3-03 | Unauthorized (non-admin) | `authorize('admin:all')` on backend rejects; dashboard hides or disables link | [ ] |
| L3-04 | Invalid export format | Frontend restricts to `jsonl/alpaca/chatml`; malformed request not sent | [ ] |
| L3-05 | Select-all and label bulk | If time permits, multi-select with bulk label apply | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | All API calls include `Authorization` header from `authHeaders()` | [ ] |
| S-02 | No raw PII from `input`/`output` displayed in full without a toggle | [ ] |
| S-03 | Export endpoint remains `admin:all` gated | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
