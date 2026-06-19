# SimpleBeacon Quality Process

## Monthly Quality Gate Review

**Frequency:** First Monday of each month  
**Owner:** Principal Engineer  
**Duration:** 30 minutes

### 1. Pre-Review Checklist (auto-generated)

Run these commands before the meeting:

```bash
# Full gate scan with quality score
npx simplebeacon scan --gate --format json --output .simplebeacon/monthly-review.json

# Identify modules with maintainability index < 85
cat .simplebeacon/monthly-review.json | jq '.summary.qualityScore'

# Run all tests
node --test ai-platform/tests/*.test.js
```

### 2. Review Agenda

| # | Item | Threshold | Action if Below |
|---|------|-----------|-----------------|
| 1 | Gate pass rate | 100% | Block release until fixed |
| 2 | Quality score | >= 85 | Create remediation tasks |
| 3 | Test pass rate | 100% | Fix failing tests |
| 4 | Module count | No new duplicates | Consolidate into canonical list |

### 3. Module Quality Scorecard

Track these files monthly:

| File | Cyclomatic Complexity | Maintainability Index | Last Refactored |
|------|----------------------|----------------------|-----------------|
| `vscode-extension/src/extension.ts` | 996 | 0 | — |
| `ai-platform/simplebeacon-server.cjs` | 185 | 0 | — |
| `ai-platform/web/simplebeacon-dashboard/js/views/AnalyzeView.js` | 2446 | 0 | 2026-06-09 |
| `ai-platform/web/simplebeacon-dashboard/js/main.js` | 146 | 0 | — |
| `ai-platform/web/simplebeacon-dashboard/js/services/authService.js` | 51 | 11 | 2026-06-09 |

### 4. Pre-Commit Hook

The repository includes pre-commit hooks in `.git/hooks/`:

- **`pre-commit.ps1`** — Windows PowerShell (active)
- **`pre-commit`** — POSIX shell (macOS/Linux)

Both hooks run:
1. `npx simplebeacon scan --gate`
2. Quality score check (blocks commit if < 85)

To enable:
```powershell
# Windows (PowerShell)
copy .git\hooks\pre-commit.ps1 .git\hooks\pre-commit

# Or use the .cmd wrapper
.git\hooks\pre-commit.cmd
```

### 5. Canonical File Locations

| Purpose | Canonical File | Notes |
|---------|---------------|-------|
| Analyzer catalog | `ai-platform/web/simplebeacon-dashboard/js/views/AnalyzeView.js` | `COMPLETE_STEPS` is the single source of truth |
| Server entry | `ai-platform/server/index.cjs` | Express server with all API routes |
| Simplebeacon proxy | `ai-platform/server/lib/simplebeacon-proxy.cjs` | Central re-export for scanner modules |
| Auth middleware | `ai-platform/server/middleware/auth.cjs` | JWT + vault auth |
| Dashboard HTML | `ai-platform/web/simplebeacon-dashboard/index.html` | SPA shell |
| Dashboard router | `ai-platform/web/simplebeacon-dashboard/js/router.js` | Hash-based client routing |
| Scanner CLI entry | `packages/simplebeacon-cli/bin/simplebeacon.js` | CLI entry point |
| Scanner rules | `packages/simplebeacon-cli/src/rules/` | Pattern definitions |
| Scanner analyzers | `packages/simplebeacon-cli/src/analyzers/` | Per-domain scanners |
| VS Code extension | `vscode-extension/src/extension.ts` | Extension host |
| Quality process | `QUALITY-PROCESS.md` | This file |

### 6. Adding New Analyzers

**Canonical location:** `ai-platform/web/simplebeacon-dashboard/js/views/AnalyzeView.js`  
**Array:** `COMPLETE_STEPS`

Add entries with this shape:
```javascript
{ id: 'analyzer-id', label: 'Human Name', category: 'Category', desc: 'What it checks.' }
```

The engine queue and reference card both derive from this single array.

### 7. Test Coverage Rules

- New auth/session logic → add test in `ai-platform/tests/authService.test.js`
- New scanner patterns → add test in `packages/simplebeacon-cli/tests/`
- Dashboard UI changes → manual verification at `http://localhost:3000/#/analyze`

Run tests before commit:
```bash
node --test ai-platform/tests/*.test.js
```

---

**Last updated:** 2026-06-09
