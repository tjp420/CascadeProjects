# Complexity Refactoring Plan

**Scan Date:** 2026-06-13
**Total Findings:** 3,035
**Files Affected:** 395
**Severity:** Low (code quality / maintainability)

---

## Finding Types Breakdown

| Type | Description | Strategy |
|------|-------------|----------|
| `long-function` | Functions exceeding length threshold | Extract helpers, early returns |
| `deep-nesting` | Nested `if`/`for` beyond 3-4 levels | Guard clauses, flatten loops |

---

## Phase 1: Priority Triage (Highest Impact)

Focus on files with the **highest density of findings** that are also **most actively maintained**.

### Tier A: Server Core (Start Here)
These modules have the most findings AND are central to the application:

1. `ai-platform/server/index.cjs` — main server entry, ~15 findings
2. `ai-platform/server/lib/code-roadmap-generator.cjs` — massive generator, ~25+ findings
3. `ai-platform/server/lib/analyze-export-bundle.cjs` — export logic, ~20+ findings
4. `ai-platform/server/lib/audit-remediation-recipes.cjs` — remediation engine, ~25+ findings

### Tier B: Bootstrap & Config
5. `ai-platform/server/bootstrap/phase2-integration.cjs`
6. `ai-platform/server/bootstrap/public-api-routes.cjs`
7. `ai-platform/server/config/database.cjs`
8. `ai-platform/server/config/redis.cjs`

### Tier C: Intelligence Package
9. `ai-platform/packages/simplebeacon-intelligence/src/structural-intent-scanner.js`
10. `ai-platform/packages/simplebeacon-intelligence/src/tree-sitter-queries.js`
11. `ai-platform/packages/simplebeacon-intelligence/src/vector-cache.js`

### Tier D: Supporting Libs
12. `ai-platform/server/lib/ai-analyst.cjs`
13. `ai-platform/server/lib/assessment-retention.cjs`
14. `ai-platform/server/lib/audit-booking-route.cjs`
15. `ai-platform/server/lib/audit-export-tier.cjs`

---

## Phase 2: Refactoring Patterns

### Pattern A: Extract Helper Functions
**Before:**
```js
function bigFunction(data) {
  // 50 lines of validation
  // 30 lines of transformation
  // 40 lines of output formatting
}
```

**After:**
```js
function validateInput(data) { /* ... */ }
function transformData(data) { /* ... */ }
function formatOutput(data) { /* ... */ }

function bigFunction(data) {
  validateInput(data);
  const transformed = transformData(data);
  return formatOutput(transformed);
}
```

### Pattern B: Replace Deep Nesting with Guard Clauses
**Before:**
```js
function process(data) {
  if (data) {
    if (data.items) {
      for (const item of data.items) {
        if (item.active) {
          // do work
        }
      }
    }
  }
}
```

**After:**
```js
function process(data) {
  if (!data?.items?.length) return;
  for (const item of data.items) {
    if (!item.active) continue;
    // do work
  }
}
```

### Pattern C: Extract Configuration/Constants
Long functions often contain inline arrays/objects. Move them to module-level constants.

### Pattern D: Strategy Pattern for Long Condition Chains
Replace long `if/else if` chains with lookup maps or strategy objects.

---

## Phase 3: Execution Workflow

1. **Run the prioritization script** (`scripts/prioritize-complexity.js`) to get the ordered list
2. **Pick one file** from Tier A
3. **Read the file**, identify the longest function (or most nested block)
4. **Extract one helper** at a time — test after each extraction
5. **Commit** after each file is cleaned
6. **Re-run the analyzer** to verify findings decreased

---

## Phase 4: Automation Targets

Create a CI gate to prevent regression:

```yaml
# .github/workflows/complexity-gate.yml
- name: Complexity Check
  run: node scripts/complexity-gate.js
```

The gate should fail if:
- Any new function exceeds 60 lines
- Any new function has nesting depth > 3

---

## Estimation

| Phase | Files | Hours (est.) |
|-------|-------|--------------|
| Tier A | 4 | 4-6 |
| Tier B | 4 | 3-4 |
| Tier C | 4 | 3-4 |
| Tier D | 12+ | 6-8 |
| **Total** | **~30** | **16-22** |

---

## Success Metrics

- [ ] Reduce total findings from 3,035 to < 1,500
- [ ] Zero findings in `server/index.cjs`
- [ ] All functions in Tier A files under 50 lines
- [ ] CI complexity gate passing
