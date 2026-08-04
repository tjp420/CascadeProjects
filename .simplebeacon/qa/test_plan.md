# Test Plan: File Merger Reduction Scanner Worker Crash

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Stabilize `file-merger-reduction-scanner` Jest worker under parallel load |
| Author (Builder) | Devin |
| Date | 2026-08-03 |
| Branch | `fix/file-merger-reduction-scanner-crash` |
| Packages touched | ai-platform |

## Scope

### Files in scope

- `ai-platform/server/lib/__tests__/file-merger-reduction-scanner.test.cjs`
- `ai-platform/server/lib/recoverable-io.cjs` (fix for read-stream handle leak)

### APIs / routes

N/A — test runner infrastructure only.

### UI / IDE surfaces

None.

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/__tests__/file-merger-reduction-scanner.test.cjs` | [x] |
| L1-02 | Syntax on changed JS/CJS | `node -c ai-platform/server/lib/recoverable-io.cjs` | [x] |
| L1-03 | Isolated suite, no open handles | `cd ai-platform && npx jest file-merger-reduction-scanner --detectOpenHandles` | [x] |
| L1-04 | Parallel orchestrator | `cd ai-platform && npm run test:parallel` | [x] |
| L1-05 | Full SimpleBeacon gate | `node packages/simplebeacon-cli/bin/simplebeacon.js scan --gate` | [x] |
| L1-06 | No secrets in diff | `git diff` + gate token rules | [x] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Parallel test orchestrator includes the suite | `npm run test:parallel` | Suite passes within 103-suite run | [x] |
| L2-02 | Local temp directories are cleaned | Run isolated test | `os.tmpdir` mock directory removed | [x] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Missing temp dir edge case | Test handles `collectRepositoryFiles` with missing input | No unhandled rejection / crash | [x] |
| L3-02 | Bad fixture permutations | Malformed JSON or deep metadata inside scan paths does not crash worker | Clean caught error | [x] |
| L3-03 | No new modules introduced | Fix is confined to existing test and scanner file | No new files created | [x] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [x] |
| S-02 | No new dependencies required | [x] |

---

## Approval

- [x] User approved this plan (or task included approved scope)
- Approved by: user  Date: 2026-08-03
