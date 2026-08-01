# test_plan.md

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Cold Archive Streaming Search & Forensic Parser |
| Author (Builder) | Devin |
| Date | 2026-08-01 |
| Branch | main |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/cold-archive-search.cjs` (new)
- `ai-platform/server/routes/audit-routes.cjs` (add route)
- `ai-platform/server/lib/__tests__/cold-archive-search.test.cjs` (new)

### APIs / routes

- `GET /api/audit/archive/search` — paginated search over gzipped NDJSON cold archive
  - Query params: `startDate`, `endDate`, `action`, `orgId`, `limit`, `offset`

### UI / IDE surfaces

- [x] Main dashboard iframe / address bar
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on new `.cjs` | `node -c ai-platform/server/lib/cold-archive-search.cjs` | [ ] |
| L1-02 | New search tests pass | `cd ai-platform && npx jest --config jest.config.cjs cold-archive-search` | [ ] |
| L1-03 | Existing key tests still pass | `cd ai-platform && npx jest --config jest.config.cjs key-rotation` | [ ] |
| L1-04 | SimpleBeacon full gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | `git diff --cached` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Search by timestamp range | Request `?startDate=...&endDate=...` | Returns only entries in range | [ ] |
| L2-02 | Filter by action and orgId | Request `?action=login&orgId=org-a` | Returns matching entries | [ ] |
| L2-03 | Pagination with limit/offset | Request `?limit=10&offset=20` | Returns up to 10 entries, hasMore flag | [ ] |
| L2-04 | Large archive memory bounded | Search 50 MB `.json.gz` | Peak memory stable, no full-file load | [ ] |
| L2-05 | REST endpoint requires admin | `GET /api/audit/archive/search` as non-admin | 403 Forbidden | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Empty archive directory | Returns empty results, hasMore false | [ ] |
| L3-02 | Corrupt gzip file | Logs warning, continues to next file | [ ] |
| L3-03 | Invalid JSON line | Skips line, continues | [ ] |
| L3-04 | No date filters | Returns all entries paginated | [ ] |
| L3-05 | Start date after end date | Returns empty with 400 error | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Path traversal prevented — archive directory cannot escape root | [ ] |
| S-02 | Only `admin:all` can query cold archive | [ ] |
| S-03 | No decompressed data persists to disk; streamed through memory | [ ] |

---

## Approval

- [x] User approved via question selections
