# test_plan.md

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Dashboard HAR Export — client-side network log export utility |
| Author (Builder) | Devin |
| Date | 2026-08-07 |
| Branch | feature/har-export |
| Packages touched | ai-platform (web dashboard) |

## Scope

### Goal

Add a client-side HAR (HTTP Archive) export utility to the dashboard so users
and internal testers can download a `.har` file capturing all network requests
during their session. This makes future production bug report capture friction-free.

### Architecture

- **HarExporter class** (`js-es2018/utils-lib/har-exporter.js`) — captures network
  requests via fetch interception + PerformanceObserver, builds HAR 1.2 spec JSON
- **DashboardView integration** — "Export HAR" button in header actions, triggers
  export via existing `downloadBlob()` utility
- **Security**: Authorization headers redacted in HAR output, request bodies for
  auth endpoints excluded

### Files in scope

- `ai-platform/web/simplebeacon-dashboard/js-es2018/utils-lib/har-exporter.js` (NEW)
- `ai-platform/web/simplebeacon-dashboard/js-es2018/utils.js` (re-export)
- `ai-platform/web/simplebeacon-dashboard/js-es2018/views/DashboardView.js` (button + handler)

### APIs / routes

- N/A — purely client-side, no new API endpoints

### UI / IDE surfaces

- [x] Main dashboard iframe / address bar — "Export HAR" button in header
- N/A — Sidebar webview, Welcome panel, Simple Browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on har-exporter.js | `node -c ai-platform/web/simplebeacon-dashboard/js-es2018/utils-lib/har-exporter.js` | [ ] |
| L1-02 | Syntax on utils.js | `node -c ai-platform/web/simplebeacon-dashboard/js-es2018/utils.js` | [ ] |
| L1-03 | Syntax on DashboardView.js | `node -c ai-platform/web/simplebeacon-dashboard/js-es2018/views/DashboardView.js` | [ ] |
| L1-04 | SimpleBeacon gate (staged files) | Pre-commit hook | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | HAR export button appears in header | Load dashboard | "Export HAR" button visible in header actions next to "Advanced analyze" | [ ] |
| L2-02 | Export produces valid HAR JSON | Click "Export HAR", open downloaded file | Valid JSON with `log.version === "1.2"`, `log.creator.name` set, `log.entries` array | [ ] |
| L2-03 | Captured entries include request URLs | Make some API calls, export HAR | Entries contain request URLs matching the API calls made | [ ] |
| L2-04 | Authorization headers are redacted | Export HAR, inspect headers | Authorization header values show `[REDACTED]` not actual tokens | [ ] |
| L2-05 | Toast notification on success | Click "Export HAR" | showToast with "HAR exported successfully" (success type) | [ ] |
| L2-06 | Toast notification on failure | Trigger export with no entries | showToast with error message | [ ] |
| L2-07 | Empty HAR has zero entries | Export immediately after page load (no API calls) | `log.entries` is empty array `[]` | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Existing fetch calls still work | Navigate dashboard, make API calls | No errors, all API calls succeed (fetch interception is transparent) | [ ] |
| L3-02 | XHR requests captured | If any XHR calls are made, they appear in HAR | XHR entries in `log.entries` | [ ] |
| L3-03 | Large number of requests (50+) | Make many API calls, export | HAR file generates without freezing UI | [ ] |
| L3-04 | Export filename includes date | Check downloaded filename | Format: `simplebeacon-har-YYYY-MM-DD.har` | [ ] |
| L3-05 | PerformanceObserver not available | Run in browser without PerformanceObserver | Falls back to fetch-only capture, no crash | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | Authorization headers redacted in HAR output | [ ] |
| S-02 | No request bodies captured for auth endpoints (/api/auth/login, /api/v2/auth) | [ ] |
| S-03 | No cookies captured in HAR output | [ ] |
| S-04 | HAR file downloaded via existing downloadBlob (no new download mechanism) | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
