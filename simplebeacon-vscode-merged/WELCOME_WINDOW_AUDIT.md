# Welcome Window Page Audit & Roadmap

## Executive Summary

| Status | Count |
|--------|-------|
| Working | 16 |
| Fixed (was broken) | 6 |
| Commands (not pages) | 8 |
| **Total** | **30** |

---

## Page Audit

### Working Pages (route exists + view exists)

| Button | Route | View | Status |
|--------|-------|------|--------|
| Dashboard | `#/dashboard` | DashboardView | OK |
| Analyze | `#/analyze` | AnalyzeView | OK |
| Report | `#/results` | ResultsView | OK |
| Settings | `#/settings` | SettingsView | OK |
| Certificate | `/certificate-upload.html` | external HTML | OK |
| Roadmap | `#/remediation` | RemediationRoadmapView | OK |
| Upload | `#/upload` | UploadView | OK |
| Audit | `#/audit` | AuditView | OK |
| Security | `#/security` | SecurityView | OK |
| Trust | `#/trust` | TrustView | OK |
| Quality | `#/quality` | QualityView | OK |
| Assessments | `#/assessments` | AssessmentView | OK |
| Platform | `#/platform` | PlatformView | OK |
| Profile | `#/profile` | ProfileView | OK |
| Preview | relay server | special | OK |
| Repo Health | `#/repository-health` | RepositoryHealthView | OK |

### Fixed Pages (were broken, now have placeholder views)

| Button | Was | Now | Status |
|--------|-----|-----|--------|
| Code Map | `#/codeMap` (404) | `#/code-map` | Placeholder |
| AI Context | `#/aiContext` (404) | `#/ai-context` | Placeholder |
| Compliance | `#/compliance` (404) | `#/compliance` | Placeholder |
| Analytics | `#/analytics` (404) | `#/analytics` | Placeholder |
| Team | `#/team` (404) | `#/team` | Placeholder |

### Commands (not pages — send messages to VS Code:)

| Button | Action |
|--------|--------|
| Clear | `simplebeacon.clearResults` |
| Toggle AI Slop Monitor | `simplebeacon.toggleRealtimeMonitoring` |
| Send Scan to AI Agent | `simplebeacon.sendToAi` |
| Open Browser | `simplebeacon.openBrowser` |
| Enhanced Analysis | `simplebeacon.enhancedAnalysis` |
| Real-time Analysis | `simplebeacon.realtimeAnalysis` |
| Pattern Detection | `simplebeacon.patternDetection` |
| Model Health | `simplebeacon.modelHealth` |

---

## Fixes Applied

### 1. Route Mismatches

| Issue | Fix |
|-------|-----|
| `repositoryHealth` → `#/repositoryHealth` (404) | Changed to `#/repository-health` |
| `codeMap` → `#/codeMap` (404) | Changed to `#/code-map` |
| `aiContext` → `#/aiContext` (404) | Changed to `#/ai-context` |

**Files:** `media/panel.js`, `media/sidebar.js`

### 2. Missing Routes Added

Added to `router.js` ROUTES array:
- `code-map`
- `ai-context`
- `compliance`
- `analytics`
- `team`

### 3. Placeholder Views Created

Added to `main.js`:
- `CodeMap` placeholder
- `AIContext` placeholder
- `Compliance` placeholder
- `Analytics` placeholder
- `Team` placeholder

---

## Roadmap: Full Page Implementation

### Phase 1 — Code Map (`#/code-map`)

**Goal:** Interactive codebase visualization

**Features:**
- File tree with directory structure
- Language breakdown by extension
- Size heatmap (larger files = warmer colors)
- Issue markers on files
- Click to open file in VS Code:

**Files to create:**
- `js/views/CodeMapView.js`
- `js/services/codeMapService.js`

---

### Phase 2 — AI Context (`#/ai-context`)

**Goal:** Show AI-generated analysis context and session history

**Features:**
- AI session history
- Files modified by AI
- Prompts used
- Model selection and configuration
- Token usage stats

**Files to create:**
- `js/views/AIContextView.js`
- `js/services/aiContextService.js`

---

### Phase 3 — Compliance (`#/compliance`)

**Goal:** Regulatory compliance tracking

**Features:**
- EU AI Act checklist
- SOC 2 controls
- GDPR compliance status
- Export compliance report
- Framework mapping

**Files to create:**
- `js/views/ComplianceView.js`
- `js/services/complianceService.js`

---

### Phase 4 — Analytics (`#/analytics`)

**Goal:** Historical trend analysis

**Features:**
- Scan history over time
- Quality score trends
- Issue severity trends
- File count growth
- Compare scans

**Files to create:**
- `js/views/AnalyticsView.js`
- `js/services/analyticsService.js`

---

### Phase 5 — Team (`#/team`)

**Goal:** Team collaboration dashboard

**Features:**
- Team member list
- Shared scan history
- Role management
- Organization settings
- Billing overview

**Files to create:**
- `js/views/TeamView.js`
- `js/services/teamService.js`

---

## Install

1. Uninstall old SimpleBeacon extension
2. Install from VSIX: `simplebeacon-3.0.79.vsix`
3. Reload window
4. All welcome window buttons now load pages (some are placeholders)
