# SimpleBeacon Scan Remediation Plan

Generated: 2026-06-01
Scan scope: `C:\Users\Trevor\CascadeProjects` (workspace-wide)
Total findings: 11

---

## 1. Executive Summary

| Priority | Category | Count | Status |
|----------|----------|-------|--------|
| Critical | Credential exposure | 3 | False positives — negative test fixtures |
| High | Missing environment keys | 2 | To be resolved |
| Medium | Unused environment keys | 5-6 | Cleanup required |
| Low | Dependency version drift | 1 | Sync required |

**Goal:** Eliminate false-positive credential noise, harden environment-variable hygiene, and eliminate package-version drift so the next scan shows **zero Critical/High** flags.

---

## 2. Critical Findings — Credential Exposures (3)

### 2.1 Affected files

| File | Line | Pattern | Risk |
|------|------|---------|------|
| `simplebeacon-rule-tests/negative-test-1/server/lib/mock-snapshot-seeds.cjs` | 24 | `database-url` | Review required |
| `simplebeacon-rule-tests/negative-test-1/server/lib/mock-snapshot-seeds.cjs` | 25 | `generic-api-key` | Review required |
| `simplebeacon-rule-tests/negative-test-2/server/lib/fixtures/leaked-credentials.js` | 11 | `stripe-key` | Review required |

### 2.2 Root cause

These files are **intentional negative test cases** for SimpleBeacon rule validation. Each file contains the explicit marker `simplebeacon:production-leak-intent: test-negative-case`, but the scanner still flags them because:

1. **Root `.simplebeacon/config.json`** does **not** include `simplebeacon-rule-tests` in `fullDirectoryScanSkipDirs` (the `ai-platform/.simplebeacon/config.json` does, but the workspace-level config is the one driving the scan).
2. **`production-leak-intent.js`** has no suppression logic for `test-negative-case` markers — it handles `repository-audit`, `scanner-meta`, `demo-tool-sample`, etc., but not the test-fixture intent.

### 2.3 Remediation steps

**Option A — Skip the directory in config (quickest)**

Edit `.simplebeacon/config.json` (workspace root) and add `simplebeacon-rule-tests` to `fullDirectoryScanSkipDirs`:

```json
"fullDirectoryScanSkipDirs": [
  ".git",
  ".github-sync",
  "github-cache",
  "node_modules",
  "simplebeacon-rule-tests"
]
```

Also add it to the `ignore` array so source-code scanners skip it:

```json
"ignore": [
  "node_modules/**",
  "coverage/**",
  "dist/**",
  "build/**",
  "**/*.test.js",
  "**/*.spec.js",
  "**/*.test.ts",
  "**/*.spec.ts",
  "tests/**",
  "test/**",
  "packages/simplebeacon-cli/**",
  "simplebeacon-rule-tests/**"
]
```

**Option B — Teach the intent classifier to suppress `test-negative-case`**

Add the following guard in `ai-platform/.github-sync/simplebeacon/src/lib/production-leak-intent.js` (and mirror to `ai-platform/packages/simplebeacon-cli/src/lib/production-leak-intent.js`):

```js
// Near the top of classifyProductionLeakMatch()
if (/simplebeacon:production-leak-intent:\s*test-negative-case/.test(content || '')) {
  return {
    intent: 'test-negative-case',
    suppress: true,
    reason: 'Intentional negative test fixture — fake credentials used for scanner validation'
  };
}
```

**Recommended:** Apply **both** options. Skipping the directory removes noise immediately; teaching the classifier makes the tool smarter for future scans.

### 2.4 Verification

```bash
npx simplebeacon --gate
# Confirm zero critical credential findings remain
```

---

## 3. High Findings — Missing Environment Keys (2)

### 3.1 Description

Two code references to `process.env.*` lack a matching definition in the scanned `.env` files.

### 3.2 Remediation steps

1. Identify the exact keys:
   ```bash
   cd ai-platform
   node -e "
     const { execSync } = require('child_process');
     const used = [...execSync('grep -rohP \"process.env.\\K[A-Z_]+\" . --include=*.js --include=*.cjs --include=*.ts 2>/dev/null').toString().split('\\n')].filter(Boolean);
     const defined = [...execSync('grep -rohP \"^[A-Z_]+(?==)\" .env.example .env 2>/dev/null').toString().split('\\n')].filter(Boolean);
     const missing = [...new Set(used.filter(k => !defined.includes(k)))];
     console.log('Missing keys:', missing.join(', ') || 'None');
   "
   ```
2. Add each missing key to the appropriate `.env` file:
   - Production secrets → `.env` (gitignored, never committed)
   - Documentation / placeholders → `.env.example`
3. If a key is dead code, remove the `process.env` reference instead.

### 3.3 Verification

Re-run the environment scanner and confirm `missingEnvKeys === 0`.

---

## 4. Medium Findings — Unused Environment Keys (5-6)

### 4.1 Affected keys

Confirmed unused in `ai-platform/.env.example` (from `env-audit.json`):

| Key | Action |
|-----|--------|
| `UPLOAD_TEST_URL` | Remove or document |
| `STRIPE_PRICE_ID_AUDIT` | Remove or document |
| `STRIPE_PRICE_ID_AGENCY_PROJECT_PACK` | Remove or document |
| `STRIPE_PRICE_ID_AGENCY_GROWTH_PACK` | Remove or document |
| `STRIPE_PRICE_ID_WARRANTY_RESCAN` | Remove or document |
| `STRIPE_CHECKOUT_MODE_TEAMS_ANNUAL` | Remove or document |

### 4.2 Remediation steps

1. Audit each key against the product roadmap:
   - If it was planned but never shipped → delete from `.env.example`.
   - If it is used by an external integration (CI, Docker, deployment platform) → add a comment block in `.env.example` documenting the consumer.
2. Commit the cleanup.

### 4.3 Verification

```bash
cd ai-platform
npx simplebeacon --profile data-cleanup
# Confirm unused-env-key count == 0
```

---

## 5. Low Finding — Dependency Version Drift (1)

### 5.1 Description

`@simplebeacon/intelligence` is pinned to two different versions across sibling `package.json` files:

| File | Version |
|------|---------|
| `ai-platform/packages/simplebeacon-cli/package.json` | `1.0.0` |
| `ai-platform/.github-sync/simplebeacon/package.json` | `0.1.0` |

Additionally, the root mirror `packages/simplebeacon-cli/package.json` is missing the `dependencies` and `optionalDependencies` blocks entirely.

### 5.2 Remediation steps

1. Decide the canonical version (likely `1.0.0`, matching the active package).
2. Update `ai-platform/.github-sync/simplebeacon/package.json`:
   ```json
   "optionalDependencies": {
     "@simplebeacon/intelligence": "1.0.0"
   }
   ```
3. Align `packages/simplebeacon-cli/package.json` (root mirror) with the same dependency blocks.
4. Consider adding a CI check or pre-commit hook that diffs `package.json` files across mirrors to prevent future drift.

### 5.3 Verification

```bash
grep -r "@simplebeacon/intelligence" ai-platform/packages/simplebeacon-cli/package.json ai-platform/.github-sync/simplebeacon/package.json packages/simplebeacon-cli/package.json
# All three should show the same version
```

---

## 6. Prevention Checklist

- [ ] Add `simplebeacon-rule-tests/**` to root `.simplebeacon/config.json` `ignore` and `fullDirectoryScanSkipDirs`.
- [ ] Add `test-negative-case` suppression logic to `production-leak-intent.js`.
- [ ] Maintain `.env.example` with a monthly hygiene pass (remove dead keys, add new ones).
- [ ] Keep `.github-sync` mirrors in sync with source packages (automated diff check in CI).
- [ ] Run `npx simplebeacon --gate` before every merge to catch regressions.

---

## 7. Rescan Command

After applying fixes, run:

```bash
npx simplebeacon --gate --profile audit
```

**Success criteria:**
- `severityCounts.critical === 0`
- `severityCounts.high === 0`
- `workspace.missingEnvKeys === 0`
- `workspace.unusedEnvKeys === 0`
- `workspace.versionDrift === 0`

---

*Plan generated based on SimpleBeacon scan summary dated 2026-06-01.*
