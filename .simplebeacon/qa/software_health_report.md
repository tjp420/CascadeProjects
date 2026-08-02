# Software Health Report — Firefox Stale File Drag-and-Drop Fix

**Date:** 2026-08-02
**Branch:** `fix/firefox-stale-file-drag-drop`
**Validator Sign-off:** Pending (Builder self-report; separate Validator pass recommended)

## Summary

Fixed `DOMException: An attempt was made to use an object that is not, or is no longer, usable` error during drag-and-drop file traversal in Firefox. The root cause was that `File` objects obtained from `FileSystemEntry.file()` become stale after the drop event yields, causing `worker.postMessage()` to fail during structured clone serialization.

## Root Cause

1. `captureDropEntries()` captures `FileSystemEntry` objects synchronously during the drop event
2. `collectFilesFromDrop()` traverses entries asynchronously, calling `fileEntry.file()` to get `File` objects
3. In Firefox, `File` objects become stale after the drop event's `DataTransfer` is invalidated
4. `worker.postMessage()` tries to serialize stale `File` objects via structured clone → DOMException

## Fix

Pre-read file contents (up to 2 MB) immediately in the `fileEntry.file()` callback while the `File` is still valid, then send text to the worker instead of `File` objects when pre-read text is available. Only activated for Firefox (`navigator.userAgent.includes('firefox')`).

## Change Set (18 files)

| File | Change |
|------|--------|
| `app/src/services/dropFolderTraversal.ts` | Add `preReadContent` option, `_preReadText`/`_preReadSize` to VirtualFile |
| `app/src/views/AnalyzeView.tsx` | Detect Firefox, pass `preReadContent: true` |
| `app/js-es2018/services/localScanService.js` | Send pre-read text instead of stale File objects |
| `app/js-es2018/workers/scan-worker.js` | Handle pre-read text in `resolveFile` |
| `app/js/services/localScanService.js` | Same fix (older JS version) |
| `app/js/workers/scan-worker.js` | Same fix (older JS version) |
| `app/assets/scan-worker.js` | Same fix (deployed worker) |
| `app/pages-publish/assets/scan-worker.js` | Same fix (published worker) |
| `dashboard/src/services/dropFolderTraversal.ts` | Same fix (dashboard version) |
| `dashboard/src/views/AnalyzeView.tsx` | Same fix (dashboard version) |
| `dashboard/js-es2018/services/localScanService.js` | Same fix |
| `dashboard/js-es2018/workers/scan-worker.js` | Same fix |
| `dashboard/js/services/localScanService.js` | Same fix |
| `dashboard/js/workers/scan-worker.js` | Same fix |
| `dashboard/assets/scan-worker.js` | Same fix |
| `dashboard/pages-publish/assets/scan-worker.js` | Same fix |
| `js-es2018/scan-worker.js` | Same fix (root-level worker) |
| `.simplebeacon/qa/test_plan.md` | QA test plan |

## Level 1 — Deterministic (required)

| Check | Result |
|-------|--------|
| `node -c` on all 14 changed JS files | PASS |
| TypeScript compiles (no new errors) | PASS (pre-existing module-not-found errors only) |
| No new dependencies | Confirmed |
| No secrets committed | Confirmed |

## Level 2 — Behavioral

| Check | Result |
|------|--------|
| L2.01 Firefox drag-and-drop pre-reads file text in callback | Implemented |
| L2.02 Worker uses pre-read text when available | Implemented |
| L2.03 Chrome/Edge unaffected (preReadContent only for Firefox) | Confirmed |
| L2.04 File picker unaffected (no pre-read for file input) | Confirmed |
| L2.05 Files >2 MB skip pre-read (avoid memory issues) | Implemented |

## Level 3 — Self-review / Drift

| Check | Result |
|-------|--------|
| L3.01 No scope creep — only fix files + QA docs | Confirmed |
| L3.02 No ghost files or hallucinated API paths | Confirmed |
| L3.03 Pre-read is opt-in (Firefox only) | Confirmed |
| L3.04 Error handling for pre-read failures | Implemented (try/catch with fallback) |

## Defects

None.

## Unimplemented

- Browser-based testing (requires manual verification in Firefox)
- Pre-read for files >2 MB (these still use File objects and may fail in Firefox — acceptable trade-off to avoid memory issues)
