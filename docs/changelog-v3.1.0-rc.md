# v3.1.0 Release Candidate — Changelog

**Milestone:** v3.1.0 — Core engine upgrades, upload durability, workerpool improvements, telemetry expansion
**Target date:** 2026-10-31
**PRs:** 9 coordinated pull requests (#547–#555)

## Executive Summary

This release delivers 4 roadmap issues across cryptographic compliance, upload telemetry, worker pool performance, and multipart upload durability. All 4 v3.1.0 milestone issues are addressed and ready for review.

## Roadmap Issues Addressed

| Issue | Title                                        | PR       | Status           |
| ----- | -------------------------------------------- | -------- | ---------------- |
| #394  | RFC 8785 JCS canonicalizer                   | #550     | Ready for review |
| #395  | Track112 telemetry & endpoint expansion      | #555     | Ready for review |
| #396  | Multipart upload: persistent session storage | (merged) | Complete         |
| #397  | WorkerPool & IngestQueue                     | #548     | Ready for review |

## Pull Request Matrix

### Cryptographic Compliance

**PR #550 — `bugfix/rfc8785-jcs-compliance`**
Fixes three RFC 8785 compliance gaps in the JCS canonicalizer that would cause cross-node state divergence:

- Key sorting: UTF-16 code units → Unicode codepoints (§3.2.3)
- Number formatting: `1e+21` → `1e21` (§3.2.2)
- Unicode normalization: Added NFC for keys and string values (§3.2.3.2)
- 11 new RFC 8785 test vectors (17/17 pass)

### Performance

**PR #548 — `perf/ring-buffer-worker-pool`**
Upgrades WorkerPool internal queue from O(n) `Array.shift()` to O(1) ring buffer:

- Inlined `RingBuffer` class with wraparound, full/empty detection
- 5 new RingBuffer tests (FIFO, wraparound, full/empty queue)
- Benchmark confirms performance improvement

### Telemetry & Tracing

**PR #555 — `feat/track112-trace-logging`**
Closes the remaining #395 gap — trace IDs now appear in request logs:

- `res.on('finish')` log hook: `[track112] METHOD PATH STATUS DURms traceId=...`
- 2 new failure case tests (missing params, non-existent session)
- 5/5 integration tests pass

### Scanner Infrastructure

**PR #547 — `config/clean-simplebeacon-ignore`**
Restores static scan gate from FAIL (234 blocking) to PASS (0 blocking):

- 120 skipDirs added to `config.json` for worktree duplicate pruning
- 31 patterns added to `.simplebeaconignore` for scan artifact filtering
- File count: 70,113 → 6,650

**PR #549 — `chore/scan-scripts-package-json`**
Wraps CLI configurations into `package.json` scripts:

- `scan:full`, `scan:gate`, `quality:monthly`, `sb:hook:pre-commit`
- 8GB heap allocation via `NODE_OPTIONS`
- Fixed pre-commit hook failures

**PR #551 — `feat/scanner-resource-guards`**
Prevents OOM kills during unlimited full-directory scans:

- Pre-flight memory check (`preflightOrThrow()`)
- Periodic resource sampling every 1000 files
- Worker thread `maxOldGenerationSizeMb` (default 4GB)

### Dashboard

**PR #552 — `feat/dashboard-indexeddb-storage`**
IndexedDB fallback for large scan reports that exceed localStorage quota:

- `setLargeItem`/`getLargeItem`/`removeLargeItem` IndexedDB helpers
- Async fallback chain: IndexedDB → localStorage → compact localStorage
- Unlimited browser scan mode (`MAX_FILES <= 0` = Infinity)
- E2E test infrastructure (spinner `data-testid` tagging, `SimpleBeaconStorage` window helper)

### E2E Test Infrastructure

**PR #553 — `feat/e2e-test-infrastructure`**
Playwright pipeline upgrades:

- Port isolation (5173 → 61455) with `VITE_API_PORT` env config
- Slack/Teams failure broadcast with 200-line log snippet
- Artifact retention: `test-results/` + `e2e-output.txt`
- Network throttling test support

### API Server

**PR #554 — `feat/api-server-hardening`**
Production hardening of standalone API server:

- Security headers: HSTS, X-Frame-Options DENY, nosniff, X-XSS-Protection
- CORS: Cloudflare Pages origin allowlist + wildcard subdomain match
- Graceful shutdown on SIGTERM/SIGINT with 10s force timeout
- Request logging middleware with duration
- Version bump: 1.0.0 → 3.2.0

## Merge Order

1. #547 (config) — unblocks scanner and pre-commit hook
2. #549 (scan scripts) — depends on #547
3. #548 (ring buffer) — independent
4. #550 (JCS compliance) — independent
5. #551 (scanner resource guards) — independent
6. #554 (API server hardening) — independent
7. #552 (dashboard IndexedDB) — independent, larger
8. #553 (E2E tests) — depends on #552

## Test Verification Summary

| Test suite                            | Result     |
| ------------------------------------- | ---------- |
| JCS canonicalize (17 tests)           | 17/17 pass |
| WorkerPool + RingBuffer (12 tests)    | 12/12 pass |
| Track112 upload routes (5 tests)      | 5/5 pass   |
| PoRep verifier (8 tests)              | 8/8 pass   |
| Upload manager + durability (9 tests) | 9/9 pass   |
| Track 113 ratchet (18 tests)          | 18/18 pass |
| Syntax checks (all modified files)    | pass       |
