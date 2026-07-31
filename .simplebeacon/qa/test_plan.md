# Test Plan: Frontend Code Audit Phase 1 — Security Fix + Legacy Cleanup

**Date:** 2026-07-31
**Branch:** main
**Feature:** Fix `escapeHtml` security issue (missing backtick/equals escaping)
and delete legacy staging/patch files that are no longer referenced.

## Context

A comprehensive audit of `js-es2018/` found 27 duplicate functions across 40+
files. Phase 1 focuses on the highest-impact, lowest-risk fixes:

1. **Security**: 3 files have local `escapeHtml` copies missing backtick (`)
   and equals (=) escaping — XSS vector for attribute injection
2. **Legacy files**: 3 staging files (`_new-helpers.js`, `_path-helpers.js`,
   `_format-helpers.js`) are never imported and duplicate utils-lib functions
3. **Patch files**: 7 `.patch-fix` files are temporary artifacts never referenced

## Files to Change

| File | Action |
|------|--------|
| `lib/analyzePathAllowlist.js` | Replace local `escapeHtml` with import from `../utils.js` |
| `components/DownloadCredentialsModal.js` | Replace local `escapeHtml` with import from `../utils.js` |
| `views/SignInView.js` | Add `escapeHtml` to existing import from `../utils.js`, remove local copy |
| `_new-helpers.js` | Delete (never imported, all functions in utils-lib) |
| `_path-helpers.js` | Delete (never imported, all functions in utils-lib/vscode.js) |
| `_format-helpers.js` | Delete (never imported, roundTo in utils-lib/number.js) |
| `utils-format.js.patch-fix` | Delete (temporary artifact) |
| `utils-lib/format.js.patch-fix` | Delete (temporary artifact) |
| `utils/snippetDiagnostic.js.patch-fix` | Delete (temporary artifact) |
| `views/AboutView.js.patch-fix` | Delete (temporary artifact) |
| `views/AnalyzeView.js.patch-fix` | Delete (temporary artifact) |
| `views/ChatbotView.js.patch-fix` | Delete (temporary artifact) |
| `views/SettingsView.js.patch-fix` | Delete (temporary artifact) |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on all 3 edited JS files | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` | PASS (exit 0) |
| L1.3 | WebSocket integration test still passes | 16/16 pass |
| L1.4 | No imports reference deleted files | grep returns 0 matches |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | `escapeHtml` in all 3 files now escapes backtick and equals | 7 replaces, not 5 |
| L2.2 | `analyzePathAllowlist.js` still renders allowlist warnings | No import errors |
| L2.3 | `DownloadCredentialsModal.js` still renders modal content | No import errors |
| L2.4 | `SignInView.js` still renders sign-in form | No import errors |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No new files created | Only edits + deletions |
| L3.2 | No new dependencies | Uses existing utils.js import |
| L3.3 | Deleted files are truly unreferenced | Verified by grep |
| L3.4 | escapeHtml import path matches existing import convention | `?v=` cache param matches |
| L3.5 | Patch files were temporary (not tracked in git) | git ls-files returns 0 |
