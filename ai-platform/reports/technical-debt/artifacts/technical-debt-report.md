# Technical Debt Report

## Executive Summary
- Scan generated: 2026-05-25T10:00:11.641Z
- Dependency vulnerabilities: 0
- ESLint issues: 11167 errors, 148 warnings across 448 files
- Code duplication: 86132 duplicated lines (7.22% duplication, 2847 clones)
- Large JS files (>500 lines): 182
- Dead-code signals: knip issue files 923, unresolved imports 2
- Circular dependencies: requires manual follow-up

## Category Breakdown

### Dependency Debt
- Total dependencies: 962
- Outdated packages: 13
- Depcheck unused deps: 2
- Depcheck unused dev deps: 2
- Depcheck missing deps: 26

### Code Quality Debt
- ESLint errors: 11167
- ESLint warnings: 148
- Duplicated lines: 86132
- Duplication rate: 7.22%
- Large JS files (>500 lines): 182

### Architecture Debt
- Modules analyzed: 535
- Circular dependencies: unknown

### Testing Debt
- Coverage summary source: tests/fixtures/jest-coverage-summary.json
- Note: Full coverage data generated during test run; fixture summary available in repository.

### Documentation Debt
- TODO/FIXME/HACK markers: 225

### Security Debt
- npm audit vulnerabilities: 0 total

### Performance Debt
- console.log occurrences: 3552
- sync fs operations: 85

### Configuration Debt
- process.env references: 160

## Prioritized Findings
- P0: Massive lint error load (11k+) and high duplication indicate elevated change risk across production paths.
- P1: 182 large JS files (>500 lines) and many thousand debug logs/sync IO patterns increase maintainability/performance risk.
- P1: Dead-code/unresolved-import findings (knip/unimported) suggest architecture drift and orphaned modules.
- P2: 13 outdated dependencies and 26 missing dependency declarations need dependency hygiene sprint.
- P2: 225 TODO/FIXME/HACK markers indicate unresolved implementation debt and unclear ownership.

## Recommended Remediation Roadmap
1. Stabilize CI quality gate (reduce ESLint errors in production paths first).
2. Run focused refactors on top 20 largest files and top clone clusters from jscpd.
3. Resolve knip/unimported unresolved imports and remove orphaned modules.
4. Execute dependency refresh plan with compatibility testing (major versions in branches).
5. Add ownership + SLA to TODO/FIXME backlog and retire stale entries.