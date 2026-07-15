# test_plan.md — SimpleBeacon IDE dashboard & extension bridge

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | IDE address bar, embed params, extension data-server bridge, extension-host perf |
| Date | 2026-07-14 |
| Packages touched | simplebeacon-vscode-merged, ai-platform/web/simplebeacon-dashboard |

## Scope

### Files in scope

- `simplebeacon-vscode-merged/src/sidebarMessenger.ts`
- `simplebeacon-vscode-merged/media/dashboard-wrapper.js`
- `simplebeacon-vscode-merged/src/welcomeDashboard.ts`
- `simplebeacon-vscode-merged/src/dataServer.ts`
- `ai-platform/web/simplebeacon-dashboard/js-es2018/services/localAgentService.js`
- `ai-platform/web/simplebeacon-dashboard/js-es2018/utils-lib/url.js`
- `ai-platform/web/simplebeacon-dashboard/js-es2018/views/AnalyzeView.js`

### UI / IDE surfaces

- [x] Main dashboard iframe / address bar
- [x] Analyze local path scan
- [x] Sign-in route (website mode)
- [x] Welcome / main window panel (pane batch updates)

---

## Level 1 — Deterministic

| ID | Check | Pass |
|----|-------|------|
| L1-03 | `cd simplebeacon-vscode-merged && npm run compile` | [ ] |
| L1-04 | `npx simplebeacon scan --full --gate` | [ ] |

## Level 2 — Behavioral

| ID | Scenario | Expected | Pass |
|----|----------|----------|------|
| L2-01 | Address bar → google.com | Opens in Simple Browser, no external prompt | [ ] |
| L2-02 | Address bar → simplebeacon.ai/roadmap | Loads in iframe | [ ] |
| L2-03 | Analyze + local path in IDE | Uses `sb_api_base` data server, not :4000 | [ ] |
| L2-04 | Website mode sign-in | URL includes `sb_api_base` + `sb_notify_base` | [ ] |
| L2-05 | Reload extension | Extension host stays responsive; no pane spam | [ ] |

## Level 3 — Regression

| ID | Case | Pass |
|----|------|------|
| L3-01 | SPA navigation preserves embed query params | [ ] |
| L3-02 | External link button opens system browser (stripped embed params) | [ ] |
| L3-03 | Theme poll ≤ 30s interval on data server pages | [ ] |

## Approval

- [x] Scope approved via implementation task (2026-07-14)
