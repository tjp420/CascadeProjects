# Software Health Report: Scan Worker Progress Fix

**Date:** 2026-07-31
**Branch:** main
**Validator:** Devin (acting as Validator)
**Issue:** Local scan appears stuck on projects with many binary files (e.g., 7,754 files in a Games project)

## Gate Status

| Check | Result |
|-------|--------|
| SimpleBeacon gate scan | PASS (exit 0) |
| scan-worker.js syntax | PASS (`node -c` exit 0) |
| localScanService.js syntax | PASS (`node -c` exit 0) |

## Level 1 — Deterministic (all required)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L1.1 | scan-worker.js syntax | PASS | `node -c` exit 0 |
| L1.2 | localScanService.js syntax | PASS | `node -c` exit 0 |
| L1.3 | Gate scan | PASS | Exit 0 |

## Level 2 — Behavioral

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L2.1 | Progress posted for binary files | PASS | `postProgress(file.path)` called in `isBinary` skip path (line ~320) |
| L2.2 | Progress posted for skipped files | PASS | `postProgress(file.path)` called in `shouldSkipFile` path (line ~300) |
| L2.3 | Progress posted for error files | PASS | `postProgress(file.path)` called in catch block (line ~395) |
| L2.4 | Progress posted for large vendor files | PASS | `postProgress(file.path)` called in vendor skip path (line ~340) |
| L2.5 | Progress posted for invalid file objects | PASS | `postProgress(file.path)` called after `textErrors++` (line ~315) |
| L2.6 | Progress posted for chunk analyzer timeout | PASS | `postProgress(file.path)` called in chunk catch (line ~355) |
| L2.7 | batch-started message sent | PASS | Worker posts `batch-started` before `scanFiles` call (line ~460) |
| L2.8 | batch-started handled in main thread | PASS | `onmessage` handler logs batch number and calls `onProgress` |
| L2.9 | Overall scan timeout exists | PASS | 30-min `overallTimer` in `runBatchedWorkerScan` |
| L2.10 | No duplicate onmessage | PASS | Dead first assignment removed; single `worker.onmessage` |

## Level 3 — Self-review / drift

| # | Item | Result | Evidence |
|---|------|--------|----------|
| L3.1 | No new files created | PASS | Only edited existing scan-worker.js and localScanService.js |
| L3.2 | No new dependencies | PASS | package.json not touched |
| L3.3 | Progress frequency unchanged | PASS | Still every 25 files via `processed % 25 === 0` check |
| L3.4 | Existing text analysis preserved | PASS | Text analysis path unchanged — only added `postProgress` call |
| L3.5 | postProgress uses same message format | PASS | Same `{ type: 'progress', processed, total, ... }` shape |
| L3.6 | overallTimer cleared on cleanup | PASS | `cleanup()` clears `overallTimer` |
| L3.7 | total variable not redeclared | PASS | Moved `const total` out of loop to top of `scanFiles` |

## Defects

None.

## Root Cause Analysis

The scan appeared stuck because `scanFiles()` in `scan-worker.js` had five code paths
that increment `processed`, but only ONE path (full text analysis) posted progress
messages. For binary-heavy projects (Games, media, etc.), 90%+ of files hit the
binary/skipped paths, which processed files quickly but sent zero progress updates
to the main thread. The UI showed "Worker started" then nothing for minutes until
a `batch-complete` message arrived.

## Fix Summary

### scan-worker.js
1. Extracted `postProgress(currentFile)` helper that posts `{ type: 'progress', processed, total, ... }` every 25 files
2. Called `postProgress` from ALL six code paths: shouldSkipFile, invalid fileObj, isBinary, vendor skip, chunk timeout, text analysis, error catch
3. Added `batch-started` message before each batch's `scanFiles` call
4. Moved `const total` to top of function (was redeclared inside loop)

### localScanService.js
1. Removed dead duplicate `worker.onmessage` assignment (was overwritten by second assignment)
2. Added `batch-started` handler that logs batch number and calls `onProgress`
3. Added 30-minute overall scan timeout (`SCAN_OVERALL_TIMEOUT_MS`) with descriptive error message
4. `cleanup()` now clears `overallTimer`

## Enhancements (future)

1. **Progress throttling**: For very fast binary scanning, 25-file intervals may still flood the main thread. Consider time-based throttling (e.g., max 1 progress message per 100ms).
2. **Per-file-type counters in progress**: Show "X binary, Y analyzed, Z skipped" in the UI progress label.
3. **Resumable scans**: Persist scan state to localStorage so interrupted scans can resume.
4. **Web Worker transferable objects**: Use `Transferable` for `postMessage` data to reduce cloning overhead.

## Validator Sign-off

- [x] All Level 1 checks pass
- [x] All Level 2 checks pass
- [x] All Level 3 checks pass
- [x] Gate scan passes
- [x] No defects found
- [x] Ready for commit
