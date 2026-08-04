# Test Plan: Option 3 — Team Score Aggregation Telemetry

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Anonymized team/org dashboard aggregation — gate pass rates, quality distributions, macro compliance trends |
| Author (Builder) | Builder |
| Date | 2026-08-04 |
| Branch | feat/team-score-aggregation-telemetry |
| Packages touched | `packages/simplebeacon-cli`, `ai-platform/server`, `ai-platform/web/simplebeacon-dashboard`, `simplebeacon-vscode-merged` |

---

## Implementation sequence

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | Payload builder + server allowlist validation | ✅ ([Phase 1](e03da76c-fd8e-4c8f-bdb2-e5c082967f6c)) |
| Phase 2 | Org rollup + trend/distribution API routes | ✅ ([Phase 2 rollup APIs](2b205b35-3aa6-4bb4-93ab-951306973581)) |
| Phase 3 | CLI post-scan hook | ✅ ([Phase 3 CLI hook](1ee7c3e4-53b3-459b-a322-2adb5ecac88c)) |
| Phase 4 | Dashboard team panel (trend + percentile strip) | ✅ ([Phase 4 dashboard](6948dfd4-357c-462d-8b17-455a546d969a)) |
| Phase 5 | IDE opt-in telemetry hook | Pending |

### Phase 4 deliverables

- `scanService.js` — `fetchTeamTelemetryTrend`, `fetchTeamQualityDistribution`
- `TeamGatePassTrendChart.js` — canvas gate-pass trend
- `DashboardView.js` — expanded `#ci-team-metrics-slot` panel
- `css/components.css` — team telemetry styles
- Build: `npm run build` in `simplebeacon-dashboard` — PASS

**Note:** `ai-platform/web/dashboard/` (IDE embed mirror) not synced in Phase 4 — sync if embed users need the panel.

---

## Level 1 — Deterministic

| ID | Check | Pass |
|----|-------|------|
| L1-01 | `node -c` on changed server/CLI files | [x] Phases 1–3 |
| L1-02 | `node --test server/lib/__tests__/ci-telemetry-store.test.cjs` | [x] 12/12 |
| L1-03 | `node --test packages/simplebeacon-cli/tests/ci-telemetry*.test.js` | [x] 14/14 |
| L1-04 | `cd ai-platform && npm test` | [ ] |
| L1-05 | Extension compile (Phase 5) | [ ] |
| L1-06 | `cd ai-platform/web/simplebeacon-dashboard && npm run build` | [x] Phase 4 |
| L1-07 | `npx simplebeacon scan --gate --offline` | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Pass |
|----|----------|------|
| L2-01 | CI scan posts team event (`scan_source=ci`) | [x] hook wired; live verify needs server |
| L2-02 | Air-gapped skip | [x] |
| L2-03 | Summary API backward compat | [x] |
| L2-04 | Quality distribution API | [x] |
| L2-05 | k-anonymity redaction | [x] |
| L2-06 | Dashboard team panel visible (team user) | [x] wired; manual verify |
| L2-07 | IDE opt-in telemetry | [ ] Phase 5 |
| L2-08 | Community tier skip | [x] |

---

## Level 3 — Edge cases

| ID | Case | Pass |
|----|------|------|
| L3-01 | Forbidden field stripped/rejected | [x] Phase 1 |
| L3-02 | 90-day retention purge | [x] Phase 1 |
| L3-04 | Missing quality_score excluded from distribution | [x] Phase 2 |
| L3-05 | Dashboard CORS / team API from hosted pages | [ ] |
| L3-06 | Extension syncToCloud independent of team telemetry | [ ] Phase 5 |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No paths/snippets in telemetry store/API | [x] |
| S-02 | Team routes require team/compliance license | [x] |
| S-03 | k-anonymity before workspace breakdown | [x] |

---

## Approval

- [x] User approved Option 3 plan
- [x] Phases 1–4 complete
- [ ] Phase 5 approved (IDE opt-in telemetry)
- Approved by: User  Date: 2026-08-04
