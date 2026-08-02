# Test Plan — Firefox Stale File Drag-and-Drop Fix

**Branch:** `fix/firefox-stale-file-drag-drop`
**Date:** 2026-08-02
**Status:** Active

## Objective

Fix `DOMException: An attempt was made to use an object that is not, or is no longer, usable` error during drag-and-drop file traversal in Firefox. The root cause is that `File` objects obtained from `FileSystemEntry.file()` become stale after the drop event yields, causing `worker.postMessage()` to fail during structured clone serialization.

## Root Cause

1. `captureDropEntries()` captures `FileSystemEntry` objects synchronously during the drop event
2. `collectFilesFromDrop()` traverses entries asynchronously, calling `fileEntry.file()` to get `File` objects
3. In Firefox, `File` objects become stale after the drop event's `DataTransfer` is invalidated
4. `worker.postMessage()` tries to serialize stale `File` objects via structured clone → DOMException

## Fix Approach

Pre-read file contents immediately in the `fileEntry.file()` callback (while `File` is still valid), then send text to the worker instead of `File` objects when pre-read text is available.

## Change Set

| File | Change |
|------|--------|
| `coming-soon/public/app/src/services/dropFolderTraversal.ts` | Add `preReadContent` option to `collectFilesFromDrop` |
| `coming-soon/public/app/js-es2018/services/localScanService.js` | Detect Firefox, use pre-read text for drag-and-drop files |
| `coming-soon/public/app/js-es2018/workers/scan-worker.js` | Handle pre-read text in `resolveFile` and `analyzeWithTextPatterns` |
| `coming-soon/public/app/assets/scan-worker.js` | Sync with js-es2018 worker fix |

## Check Items

### Level 1 — Deterministic

- [ ] L1.1 `node -c` on all changed JS files — PASS
- [ ] L1.2 TypeScript compiles without errors
- [ ] L1.3 No new dependencies added
- [ ] L1.4 No secrets committed

### Level 2 — Behavioral

- [ ] L2.01 Firefox drag-and-drop of a single file works (pre-read text sent to worker)
- [ ] L2.02 Firefox drag-and-drop of a folder works (pre-read text for all files)
- [ ] L2.03 Chrome/Edge drag-and-drop still works (File objects sent as before)
- [ ] L2.04 File picker still works in all browsers (not affected by change)
- [ ] L2.05 Worker correctly uses pre-read text when available, falls back to File.text() otherwise

### Level 3 — Self-review / Drift

- [ ] L3.01 No scope creep — only fix files touched
- [ ] L3.02 No ghost files or hallucinated API paths
- [ ] L3.03 Pre-read is opt-in (only for Firefox drag-and-drop), doesn't affect Chrome/Edge
- [ ] L3.04 Error handling for pre-read failures (file too large, binary, etc.)
