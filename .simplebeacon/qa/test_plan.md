# test_plan.md

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Fix 4 production dashboard network issues from network trace analysis |
| Author (Builder) | Devin |
| Date | 2026-08-07 |
| Branch | fix/dashboard-network-issues |
| Packages touched | ai-platform (server + web) |

## Scope

### Issues Being Fixed

1. **POST /api/analyze/flexible → 400 after 31s** — `fetchWebsiteToTemp` has a hardcoded 30s timeout with a generic "Request timeout" error message. Make timeout configurable via env var and improve error message.
2. **Repeated /api/chatbot/providers + /api/prompts/get polling** — `ChatbotView.destroy()` is empty, leaving `simplebeacon:ai-keys-updated` event listeners accumulated on `window`. Fix: clean up listeners in destroy(), add guard flag, cache prompt loads.
3. **302 redirects on dashboard JS assets** — `express.static` middleware uses default `redirect: true`, causing redirect hop for dynamically imported chunks. Fix: add `redirect: false` to static middleware.
4. **Cloudflare Insights SRI hash mismatch** — Edge-injected beacon has SRI attribute that doesn't match when privacy blockers return empty content. Fix: improve neutralization script to catch edge-injected scripts earlier.

### Files in scope

- `ai-platform/server/lib/flexible-analyze-utils.cjs` (Fix 1 — configurable timeout)
- `ai-platform/web/simplebeacon-dashboard/js-es2018/views/ChatbotView.js` (Fix 2 — listener cleanup)
- `ai-platform/server/index.cjs` (Fix 3 — redirect: false on static middleware)
- `ai-platform/web/simplebeacon-dashboard/index.html` (Fix 4 — SRI neutralization improvement)

### APIs / routes

- `POST /api/analyze/flexible` — improved timeout error handling
- `GET /api/chatbot/providers` — reduced redundant calls
- `GET /api/prompts/get` — reduced redundant calls
- Static asset serving — no more 302 redirects

### UI / IDE surfaces

- [x] Main dashboard iframe / address bar
- N/A — Sidebar webview, Welcome panel, Simple Browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on flexible-analyze-utils.cjs | `node -c ai-platform/server/lib/flexible-analyze-utils.cjs` | [ ] |
| L1-02 | Syntax on ChatbotView.js | `node -c ai-platform/web/simplebeacon-dashboard/js-es2018/views/ChatbotView.js` | [ ] |
| L1-03 | Syntax on index.cjs | `node -c ai-platform/server/index.cjs` | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Website fetch timeout is configurable | Set `SIMPLEBEACON_WEBSITE_FETCH_TIMEOUT_MS=5000`, trigger analyze/flexible with a slow URL | Timeout fires at 5s, not 30s | [ ] |
| L2-02 | Timeout error message is descriptive | Trigger a timeout, inspect error payload | Error includes URL and timeout duration | [ ] |
| L2-03 | ChatbotView.destroy() removes listeners | Mount chatbot view, navigate away, mount again, trigger ai-keys-updated event | Only one fetch to /api/chatbot/providers | [ ] |
| L2-04 | Prompt loading cached after first mount | Mount chatbot view, navigate away, mount again | /api/prompts/get called only once | [ ] |
| L2-05 | Static assets served without 302 | Request /dashboard/TeamMetricsView-*.js directly | HTTP 200, no 302 redirect | [ ] |
| L2-06 | SRI neutralization catches edge-injected scripts | Load dashboard with Cloudflare auto-injection enabled | No SRI hash mismatch console error | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Default timeout when env var not set | Timeout defaults to 30000ms | [ ] |
| L3-02 | Invalid timeout env var (non-numeric) | Falls back to 30000ms default | [ ] |
| L3-03 | ChatbotView mount/destroy cycle repeated 10x | No more than 1 active listener after all cycles | [ ] |
| L3-04 | Static middleware redirect:false doesn't break directory index | Request /dashboard/ still serves index.html | [ ] |
| L3-05 | Existing /dashboard/assets/ routes still work | Request /dashboard/assets/main.js → 200 | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | No new env vars expose secrets | [ ] |
| S-03 | SRI neutralization doesn't weaken security for other scripts | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
