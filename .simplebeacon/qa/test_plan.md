# Test Plan: Team Metrics Dashboard UI

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Team Metrics Dashboard — interactive telemetry charting with Recharts |
| Author (Builder) | Devin |
| Date | 2026-07-30 |
| Branch | main |
| Packages touched | ai-platform (web/simplebeacon-dashboard) |

## Scope

### In Scope
- **New view**: `src/views/TeamMetricsView.tsx` — React component with Recharts visualizations for scan history telemetry
- **Sidebar nav item**: Add "Team Metrics" to the Operations group in `Sidebar.tsx`
- **App.tsx registration**: Register `team-metrics` view in `viewMap` and `VIEW_TITLES`
- **Recharts dependency**: Add `recharts` to `package.json` dependencies
- **Data source**: Read scan history from `localStorage.getItem('sb_scan_history')` with fallback to `GET /api/simplebeacon/history` API (same pattern as ProfileView.tsx)
- **Charts**: 
  - Quality Score trend (LineChart) over scan history
  - Issue count trend (AreaChart) over scan history
  - Severity breakdown (BarChart) — latest scan's critical/high/medium/low counts
  - Gate pass/fail rate (PieChart) across all history entries
- **Summary stat cards**: Total scans, average quality score, gate pass rate, total issues — using existing Card/MetricCard patterns

### Out of Scope
- Server-side team metrics aggregation API (the CLI's `team-metrics.js` stores data in `~/.simplebeacon/` which is not browser-accessible; we use the existing scan history data instead)
- Multi-project cross-repo aggregation (single-project scan history only — the dashboard is scoped to the current project)
- Real-time websocket updates (static load on mount, refresh button for manual reload)
- Database schema changes

### Files in scope

- `ai-platform/web/simplebeacon-dashboard/src/views/TeamMetricsView.tsx` (new)
- `ai-platform/web/simplebeacon-dashboard/src/layout/Sidebar.tsx` (modify — add nav item)
- `ai-platform/web/simplebeacon-dashboard/src/App.tsx` (modify — register view)
- `ai-platform/web/simplebeacon-dashboard/package.json` (modify — add recharts dep)

### APIs / routes

- `GET /api/simplebeacon/history` — existing endpoint, returns array of scan history entries with `{ scanId, date, issueCount, qualityScore, gatePass, severityCounts, fictionPatternsFound, totalFilesScanned }`
- `localStorage.getItem('sb_scan_history')` — same data shape, cached locally

### UI / IDE surfaces

- [x] Main dashboard (React app at /app/ and /dashboard/)
- [ ] Sidebar webview
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | TeamMetricsView.tsx compiles | `cd ai-platform/web/simplebeacon-dashboard && npx tsc --noEmit` | [ ] |
| L1-02 | Sidebar.tsx compiles | `cd ai-platform/web/simplebeacon-dashboard && npx tsc --noEmit` | [ ] |
| L1-03 | App.tsx compiles | `cd ai-platform/web/simplebeacon-dashboard && npx tsc --noEmit` | [ ] |
| L1-04 | Vite build succeeds | `cd ai-platform/web/simplebeacon-dashboard && npm run build` | [ ] |
| L1-05 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-06 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-07 | npm audit (recharts dep added) | `cd ai-platform/web/simplebeacon-dashboard && npm audit` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Team Metrics view renders | Navigate to `#/team-metrics` | Page loads with title "Team Metrics", summary cards, and 4 chart sections | [ ] |
| L2-02 | Empty state when no history | Clear localStorage `sb_scan_history`, navigate to view | Shows "No scan history yet" message with link to Analyze view | [ ] |
| L2-03 | Charts populate from localStorage | Set `sb_scan_history` with 3+ mock entries, navigate to view | Quality score line chart shows 3 data points, issue area chart renders, severity bar chart shows latest counts, gate pie chart shows pass/fail ratio | [ ] |
| L2-04 | Fallback to API when localStorage empty | Clear `sb_scan_history`, mock `/api/simplebeacon/history` response, navigate to view | Charts populate from API data | [ ] |
| L2-05 | Refresh button reloads data | Click refresh button | Data reloads from localStorage/API, charts update | [ ] |
| L2-06 | Sidebar nav item present | Check sidebar Operations group | "Team Metrics" item with TrendingUp icon visible | [ ] |
| L2-07 | Sidebar nav active state | Navigate to team-metrics | "Team Metrics" nav item highlighted as active | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Single scan entry | Charts render with 1 data point without crashing | [ ] |
| L3-02 | Malformed localStorage data | View catches JSON parse error, shows empty state instead of crashing | [ ] |
| L3-03 | History entries missing optional fields | Charts use 0 defaults for missing `qualityScore`, `issueCount`, etc. | [ ] |
| L3-04 | Large history (30 entries) | Charts render without performance issues | [ ] |
| L3-05 | SPA route change | Navigating away and back to team-metrics preserves data | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Scan history data is anonymized aggregate only (no file paths, no source code) | [ ] |

---

## Implementation Notes

### Data shape (from `appendHistory` in `simplebeacon-api.cjs`):
```typescript
interface ScanHistoryEntry {
  scanId: string;
  date: string;              // ISO 8601
  issueCount: number;
  qualityScore: number;      // 0-100
  gatePass: boolean;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info?: number;
  };
  fictionPatternsFound: number;
  totalFilesScanned: number;
}
```

### Chart mapping:
- **LineChart**: X=date, Y=qualityScore → quality trend over time
- **AreaChart**: X=date, Y=issueCount → issue volume trend
- **BarChart**: X=severity label, Y=count → latest scan severity breakdown
- **PieChart**: pass vs fail count across all history entries

### Existing patterns to follow:
- Card/CardContent/CardHeader from `@/components/ui/card`
- Badge from `@/components/ui/badge`
- Button from `@/components/ui/button`
- `navigate()` from `@/router/HashRouter`
- `apiUrl()`, `authHeaders()` from `@/config`
- localStorage read pattern with try/catch from ProfileView.tsx

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
