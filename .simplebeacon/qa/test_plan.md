# Test Plan: Scan Worker Progress Fix for Large File Counts

**Date:** 2026-07-31
**Branch:** main
**Issue:** Local scan appears stuck on projects with many binary files (e.g., 7,754 files in a Games project). Worker processes files but sends no progress messages for binary/skipped/error paths, causing the UI to show no updates.

## Root Cause

In `scan-worker.js`, `scanFiles()` has five code paths that increment `processed`:
1. `shouldSkipFile` (ignored dirs/patterns) — no progress message
2. `isBinary` (binary files) — no progress message
3. Large vendor file skip — no progress message
4. `file.text()` error catch — no progress message
5. Full text analysis — sends progress every 25 files (the ONLY path that does)

For binary-heavy projects (Games, media, etc.), 90%+ of files hit paths 1-4, so zero
progress messages are sent within a batch. The user sees the worker "started" then nothing.

## Fix

1. **scan-worker.js**: Extract a `postProgress()` helper and call it from ALL paths
   that increment `processed`. Post every 25 files regardless of file type.
2. **localScanService.js**: Remove dead duplicate `worker.onmessage` assignment.
   Add batch-level diagnostic logging. Add overall scan timeout (30 min).
3. **scan-worker.js**: Add `batch-started` message so main thread knows when each
   batch begins processing (not just when it completes).

## Objective Check-Items

### Level 1 — Deterministic (required)

| # | Item | Command | Pass Criteria |
|---|------|---------|---------------|
| L1.1 | scan-worker.js syntax | `node -c scan-worker.js` | No errors |
| L1.2 | localScanService.js syntax | `node -c localScanService.js` | No errors |
| L1.3 | Gate scan passes | `npx simplebeacon scan --gate` | Exit 0 |

### Level 2 — Behavioral

| # | Item | Method | Pass Criteria |
|---|------|--------|---------------|
| L2.1 | Progress posted for binary files | Code review | `postProgress` called in binary skip path |
| L2.2 | Progress posted for skipped files | Code review | `postProgress` called in shouldSkipFile path |
| L2.3 | Progress posted for error files | Code review | `postProgress` called in catch block |
| L2.4 | Progress posted for large vendor files | Code review | `postProgress` called in vendor skip path |
| L2.5 | Batch-started message sent | Code review | Worker posts `batch-started` before processing |
| L2.6 | Overall scan timeout exists | Code review | 30-min timeout terminates worker |
| L2.7 | No duplicate onmessage | Code review | Only one `worker.onmessage` assignment |

### Level 3 — Self-review / drift

| # | Item | Pass Criteria |
|---|------|---------------|
| L3.1 | No new files created | Broom strategy — edit existing files only |
| L3.2 | No new dependencies | package.json unchanged |
| L3.3 | Progress frequency unchanged | Still every 25 files (not flooding main thread) |
| L3.4 | Existing behavior preserved | Text analysis path still works as before |

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `ai-platform/web/simplebeacon-dashboard/js-es2018/workers/scan-worker.js` | MODIFIED | Add `postProgress` helper, call from all paths, add `batch-started` message |
| `ai-platform/web/simplebeacon-dashboard/js-es2018/services/localScanService.js` | MODIFIED | Remove dead onmessage, add batch diagnostics, add overall timeout |
