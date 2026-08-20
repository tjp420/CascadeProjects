# SimpleBeacon Certificate Remediation Plan

**Project:** ai-agent Workspace  
**Certificate Date:** 2026-06-07  
**Quality Score:** 93/100 (Grade B)  
**Gate Status:** PASS (0 blocking)  
**Files Analyzed:** 30,674  
**Lines of Code:** 4,408,818

---

## Executive Summary

The ai-agent workspace scan reveals a **PASSing gate** with manageable technical debt. The primary concern is **EU AI Act compliance** (high-risk posture due to 3 AI system indicators). All other findings are hygiene-level issues that can be addressed incrementally.

**Priority Matrix:**

| Priority | Category                | Count        | Impact           |
| -------- | ----------------------- | ------------ | ---------------- |
| P0       | EU AI Act Compliance    | 4 controls   | Legal/Regulatory |
| P1       | AI Residue              | 226 hits     | Code Quality     |
| P1       | Sensitive Data Exposure | 22 hits      | Security         |
| P2       | Config Drift            | 83 instances | Maintainability  |
| P2       | Documentation Gaps      | 347 files    | Maintainability  |
| P2       | Unused Dependencies     | 59 flags     | Performance      |
| P3       | i18n Issues             | 58 files     | UX/Accessibility |
| P3       | Type Safety Gaps        | 15 files     | Code Quality     |
| P3       | API Contract Drifts     | 10 endpoints | Reliability      |

---

## Phase 1: EU AI Act Compliance (P0 — Immediate)

**Deadline:** August 2, 2026 (56 days remaining)

### 1.1 EU-AIA-ART-5: Prohibited AI Practices Audit

- **Status:** WARN (Critical)
- **Evidence:** 3 files with AI SDK imports detected
- **Action:**
    - [ ] Conduct legal review documenting AI system does NOT perform prohibited practices (Art 5.1)
    - [ ] Verify no social scoring, biometric identification, or subliminal techniques
    - [ ] Document lawful use case in `AI-SYSTEM.md`
    - [ ] If prohibited use case found: stop development immediately

### 1.2 EU-AIA-ART-6: AI System Classification (Annex III)

- **Status:** REVIEW (Medium)
- **Evidence:** 3 AI indicators; 22 governance docs present
- **Action:**
    - [ ] Review existing `risk-assessment.md` for explicit Annex III classification
    - [ ] Verify classification is documented (high-risk vs. limited-risk vs. minimal-risk)
    - [ ] Update `model-card.md` with classification justification
    - [ ] Do not assume presence of docs equals correct classification

### 1.3 EU-AIA-ART-50: Transparency Obligations

- **Status:** WARN (Medium)
- **Evidence:** 3 AI indicators detected
- **Action:**
    - [ ] Verify UI/UX includes AI disclosure notices ("This is an AI-assisted feature")
    - [ ] If generating images/video/audio: implement synthetic media watermarking
    - [ ] Add transparency badges to dashboard components
    - [ ] Document transparency measures in `AI-SYSTEM.md`

### 1.4 EU-AIA-ART-9: Risk Management System

- **Status:** REVIEW (Medium)
- **Evidence:** 22 docs present — verify risk management coverage
- **Action:**
    - [ ] Verify `risk-assessment.md` covers: identified risks, likelihood/severity, mitigations
    - [ ] Ensure residual risk acceptance criteria are documented
    - [ ] Schedule quarterly risk assessment review
    - [ ] Confirm risk management coverage across all AI features

### 1.5 Documentation Checklist

- [x] Risk Assessment / FRIA (`risk-assessment.md` exists)
- [x] Technical Documentation (`technical-documentation.md` exists)
- [x] Conformity Declaration (`conformity-declaration.md` exists)
- [ ] Model Card (verify completeness)
- [ ] EU AI Act Reference (verify current)

---

## Phase 2: Security & Data Hygiene (P1 — Week 1-2)

### 2.1 Sensitive Data Exposure (22 hits)

**Affected files:**

- `ai-platform/tools/generate-license-token.cjs`
- `ai-platform/tools/generate-test-token.cjs`
- `ai-platform/tools/get-test-token.cjs`
- `ai-platform/tools/run-all-tier-scans.cjs`
- `ai-platform/tools/run-paid-scan-for-trevor.cjs`

**Actions:**

- [ ] Audit all `/tools/*.cjs` files for hardcoded tokens/secrets
- [ ] Move all secrets to environment variables
- [ ] Add `.env` to `.gitignore` (already present — verify no committed `.env` files)
- [ ] Implement secret scanning in CI/CD pipeline
- [ ] Rotate any exposed tokens immediately

### 2.2 Config Drift (83 instances)

**Affected files:**

- `ai-agent/orchestrator.js`
- `ai-platform/auto-processor.js`
- `ai-platform/packages/simplebeacon-cli/src/commands.js`
- `ai-platform/packages/simplebeacon-cli/src/compliance-checklist.js`
- `ai-platform/packages/simplebeacon-cli/src/fix-dry-run.js`

**Actions:**

- [ ] Audit all config files for hardcoded values
- [ ] Move URLs, API keys, and secrets to `.env`
- [ ] Implement config validation at startup
- [ ] Add `config.js` schema validation using Joi or Zod
- [ ] Document all environment variables in `.env.example`

### 2.3 Security Headers (4 missing)

**Affected files:**

- `ai-platform/tools/run-all-tier-scans.cjs`
- `coming-soon/js/dashboard/certificate-module.js`
- `coming-soon/js/dashboard/main.js`
- `coming-soon/js/dashboard/ui-renderer.js`

**Actions:**

- [ ] Add Helmet.js middleware for Express server
- [ ] Configure CSP, X-Frame-Options, HSTS, Referrer-Policy
- [ ] Add security headers to all server responses
- [ ] Verify headers with `npx security-headers-check`

---

## Phase 3: Code Quality & AI Residue (P1 — Week 2-3)

### 3.1 AI Residue Cleanup (226 hits)

**Categories:**

- Stubs: `simplebeacon_ast_scan.py`
- Deprecated patterns: `add-modules.js`, `auto-processor.js`
- Dead code: `jest.config.js`

**Actions:**

- [ ] Replace stub implementations with real logic OR remove if unused
- [ ] Migrate deprecated APIs to current versions
- [ ] Remove dead code blocks (commented code, unreachable branches)
- [ ] Add lint rule: `no-dead-code`
- [ ] Run `npx depcheck` to find unused imports

### 3.2 Type Safety Gaps (15 files)

**Actions:**

- [ ] Replace `any` types with specific interfaces
- [ ] Add PropTypes to React components (if applicable)
- [ ] Reduce excessive function parameters (max 5 recommended)
- [ ] Enable strict TypeScript mode (`strict: true` in `tsconfig.json`)
- [ ] Run `tsc --noEmit` to catch type errors

### 3.3 Test Coverage (1 gap)

**Actions:**

- [ ] Implement skipped tests in `tests/dashboard.test.js`
- [ ] Remove empty test placeholders
- [ ] Target 80% coverage for critical paths
- [ ] Add test for `decodeJwtPayload` edge cases
- [ ] Add test for EU AI Act control builder

---

## Phase 4: Maintainability (P2 — Week 3-4)

### 4.1 Documentation Gaps (347 files)

**Actions:**

- [ ] Add JSDoc to all exported functions in `ai-platform/`
- [ ] Document public APIs in `API_CONTRACT_AUDIT.md`
- [ ] Keep README in sync with code changes
- [ ] Add inline comments for complex regex patterns
- [ ] Document scanner engine exclusion rules

### 4.2 Unused Dependencies (59 flags)

**Actions:**

- [ ] Run `npx depcheck` across all `package.json` files
- [ ] Remove packages with no imports
- [ ] Verify CLI-only dependencies are in `devDependencies`
- [ ] Consolidate duplicate dependencies across monorepo
- [ ] Document dependency update policy

### 4.3 Duplicate File Cleanup (245 groups)

**Actions:**

- [ ] Review `.simplebeacon/report-deliveries/` — delete old deliveries
- [ ] Deduplicate `.husky/_/` hook files (all identical)
- [ ] Consolidate `.simplebeacon/baseline.json` copies
- [ ] Clean up `github-cache/` benchmark clones
- [ ] Add CI step to prevent duplicate file accumulation

---

## Phase 5: UX & Accessibility (P3 — Week 4-5)

### 5.1 i18n Readiness (58 issues)

**Actions:**

- [ ] Wrap UI strings with `t()` / `i18n()` functions
- [ ] Extract all strings to locale files (`en.json`, `es.json`)
- [ ] Use locale-aware date/number formatting
- [ ] Verify no hardcoded English in error messages

### 5.2 Accessibility Gaps (4 files)

**Actions:**

- [ ] Add `alt` text to all images
- [ ] Add `aria-label` to icon-only buttons
- [ ] Associate form labels with inputs (`for` attribute)
- [ ] Verify keyboard navigation for all interactive elements
- [ ] Run `axe-core` in CI

### 5.3 API Contract Drifts (10 endpoints)

**Actions:**

- [ ] Verify all REST endpoints have frontend consumers
- [ ] Update OpenAPI spec to match implementation
- [ ] Add contract tests with `pact-js`
- [ ] Document breaking changes in `CHANGELOG.md`

---

## Phase 6: Consolidation & Cleanup (P3 — Week 5-6)

### 6.1 Monorepo Health

- [ ] 1 monorepo marker detected — verify `lerna.json` or `nx.json` is current
- [ ] Review workspace boundaries (ai-platform, coming-soon, packages)
- [ ] Consolidate shared code into common packages
- [ ] Remove circular dependencies

### 6.2 Database Patterns (2 anti-patterns)

- [ ] Review raw SQL for injection vulnerabilities
- [ ] Add parameterized queries or ORM usage
- [ ] Verify connection pooling configuration

### 6.3 Complexity Metrics (3 high patterns)

- [ ] Extract helper functions from complex methods
- [ ] Reduce nesting with early returns
- [ ] Break files >500 lines into modules

---

## Verification Commands

```bash
# Re-run gate scan
npx simplebeacon scan --gate --format json --output .simplebeacon/report.json

# Check for remaining debug artifacts
grep -r "console\.log\|debugger" src/ --include="*.js" --include="*.ts"

# Check for unused dependencies
npx depcheck

# Type check
npx tsc --noEmit

# Security audit
npm audit

# Lint check
npm run lint
```

---

## Success Criteria

| Metric              | Current | Target |
| ------------------- | ------- | ------ |
| Quality Score       | 93      | 95+    |
| Gate Status         | PASS    | PASS   |
| EU AI Act Risk      | High    | Low    |
| AI Residue          | 226     | <50    |
| Sensitive Data      | 22      | 0      |
| Config Drift        | 83      | <20    |
| Documentation Gaps  | 347     | <100   |
| Unused Dependencies | 59      | <10    |

---

_Plan generated from SimpleBeacon Certificate SB-3118723731  
Certificate Integrity: 7c00c775060d33f2de0f2178b9c7357cd1dd4723aa64eff3c4c4a5318be072a8_
