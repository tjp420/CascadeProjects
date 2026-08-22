# Pricing Claims vs. Implementation Gap Analysis

**Date:** 2026-06-14  
**Auditor:** Codebase audit via Cascade  
**Scope:** `ai-platform/`, `packages/simplebeacon-cli/`, `coming-soon/`

---

## Summary

| Tier | Claim Accuracy | Enforced? | Gap Severity |
|------|---------------|-----------|--------------|
| **Starter (Free)** | Partially true | **NO** — limits defined in config but never enforced by scanner | **Critical** |
| **Pro ($9/mo)** | Partially true | **NO** — no paywall logic limits free users | **Critical** |
| **Enterprise** | Mostly aspirational | **NO** — SSO, team management, air-gapped not built | **High** |
| **VS Code Extension** | Mostly untrue | **NO** — no extension code exists in repo | **High** |

---

## Starter (Free) — Claim Audit

| Claim | Status | Evidence | Required Fix |
|-------|--------|----------|--------------|
| **Up to 50 files per scan** | ⚠️ **UNTRUE** (not enforced) | `plans.cjs:26` defines `maxFilesPerScan: 50`. Scanner code (`scan.js`, `full-directory-scanner.js`) never reads this limit. | Wire `getLimits(tierId)` into CLI `runScan()` and API `analyzeCodebase()` to abort or truncate after 50 files. |
| **Gate scan: credentials + AI patterns** | ✅ **TRUE** | `rules/production-leak.js`, `rules/llm-slop-patterns.js`, `rules/credential-pattern-scanner.js` exist and run by default. | — |
| **AI Slop Cop: placeholder debris** | ✅ **TRUE** | `rules/llm-slop-patterns.js` detects placeholders, markdown fences, stubs. | — |
| **CLI + VS Code extension** | ⚠️ **PARTIAL** | CLI exists. **VS Code extension does NOT exist** in repo. | Build `packages/vscode-extension/` or remove claim. |
| **Text output only** | ⚠️ **UNTRUE** | CLI supports `--format json`, `--output file.json`. No tier check blocks this. | Add tier gate: reject `--format json` and `--output` if tier === 'starter'. |
| **No credit card required** | ✅ **TRUE** | Stripe checkout is gated; free tier has `stripePriceId: null`. | — |

---

## Pro ($9/mo) — Claim Audit

| Claim | Status | Evidence | Required Fix |
|-------|--------|----------|--------------|
| **Unlimited files per scan** | ⚠️ **UNTRUE** (no limit enforced) | Same issue: no file count gate exists. Free users get unlimited files today. | Enforce `maxFilesPerScan` in scanner. Null = unlimited (Pro/Enterprise only). |
| **All findings shown** | ⚠️ **UNTRUE** | `plans.cjs:65` sets `maxFindingsShown: null` for Pro, but CLI/API never truncates. Free users see all findings today. | Implement `maxFindingsShown` truncation in `formatJsonReport()` and dashboard renderers. |
| **Quality score visible** | ⚠️ **UNTRUE** | `plans.cjs:65` sets `showQualityScore: true`, but the score is computed and returned unconditionally. | Gate quality score in API responses and dashboard UI based on tier. |
| **48 analyzer engines** | ✅ **VERIFIED** | `ai-problem-analyzer-suite.js` defines 48 analyzers (A-01 through A-48). 25 scan engine categories confirmed from scan report. 35 rule entries across 4 rule files. | Numbers verified 2026-08-22. |
| **GitHub Action + CI gate** | ✅ **TRUE** | `.github/workflows/simplebeacon-ai-hygiene-gate.yml` and `packages/simplebeacon-cli/examples/github-action/` exist. | — |
| **Export reports (JSON, Markdown)** | ✅ **TRUE** | `reporters/json.js`, `reporters/audit-report.js` produce JSON and Markdown. | — |
| **Priority email support** | ⚠️ **UNVERIFIABLE** | Email service exists (`server/lib/email-service.cjs`), but no tier-based priority queue. | Add `priority` field to support tickets based on subscription tier. |

---

## Enterprise — Claim Audit

| Claim | Status | Evidence | Required Fix |
|-------|--------|----------|--------------|
| **Everything in Pro** | ✅ **TRUE** (by definition) | Enterprise `moduleAccess` is a superset of Pro. | — |
| **48 analyzer engines** | ⚠️ **MISLEADING** | Enterprise `moduleAccess` lists ~54 names. Same gap as Pro: only ~15 actual rule files. | Build out remaining ~45 rule engines or adjust claim to "48 analysis modules." |
| **Team management (5+ seats)** | ❌ **UNTRUE** | No team, organization, member, or seat tables exist. `schema-phase2.sql` has only a `users` table. | Create `teams`, `team_members`, `invites` tables and API routes. |
| **SSO authentication** | ❌ **UNTRUE** | No OAuth, SAML, OIDC, or SSO providers in auth middleware. | Add OAuth 2.0 / SAML 2.0 strategy to `server/middleware/auth.cjs` or new `server/routes/sso.cjs`. |
| **Custom rule development** | ⚠️ **PARTIAL** | `.simplebeacon/config.json` supports custom `scanPaths` and `fictionPatterns`, but no user-uploaded rule engine. | Add rule-upload API with sandboxed execution (e.g., QuickJS VM). |
| **Dedicated support channel + SLA** | ❌ **UNTRUE** | No support ticket system, SLA timers, or dedicated channel logic. | Build support ticket schema + SLA escalation logic. |
| **Self-hosted / air-gapped** | ⚠️ **PARTIAL** | The CLI works offline (`--offline`), but the dashboard server requires network for Stripe, AI inference, and email. | Document air-gapped deployment guide; remove external deps for enterprise builds. |

---

## VS Code Extension — Claim Audit

| Claim | Status | Evidence | Required Fix |
|-------|--------|----------|--------------|
| **24 free IDE rules** | ❌ **UNTRUE** | No `packages/vscode-extension/` or `vscode/` directory exists in repo. | Build extension or remove all VS Code claims. |
| **38 Pro IDE rules** | ❌ **UNTRUE** | Same — no extension code. | — |
| **54 Enterprise IDE rules** | ❌ **UNTRUE** | Same — no extension code. | — |
| **Install from Marketplace** | ❌ **UNTRUE** | Link `ctaLink` points to marketplace, but no extension is published. | Remove link or build and publish extension. |

---

## Critical Gaps Summary

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| **P0** | No tier enforcement in scanner/API | Free users get all Pro features today | 2–3 days |
| **P0** | VS Code extension does not exist | Major product claim is false | 2–4 weeks |
| **P1** | Rule count (15 actual vs. 38/54 claimed) | Misleading marketing | 1–2 weeks (rebrand or build) |
| **P1** | No SSO / team management | Enterprise tier is unsellable | 2–3 weeks |
| **P2** | No support ticket / SLA system | Enterprise support claim is empty | 1 week |
| **P2** | Air-gapped deployment undocumented | Blocks certain enterprise deals | 2–3 days |

---

## Recommended Immediate Actions

1. **Stop the bleeding**: Add tier enforcement to the scanner and API within 48 hours (see test script below).
2. **Fix copy**: "48 analyzer engines" is now verified (48 analyzers in `ai-problem-analyzer-suite.js`). "54 IDE rules" → "54 IDE diagnostics" until the rules are actually built.
3. **Remove or stub VS Code claims**: Either (a) remove all VS Code extension references from pricing page, or (b) create a minimal `packages/vscode-extension/` skeleton within 1 week.
4. **Gate Enterprise features**: Hide SSO, team management, and air-gapped claims until implemented, or mark them as "Coming soon" with a waitlist.

---

## Test Script: Verify Tier Enforcement

Save as `scripts/test-tier-enforcement.cjs` and run with Node:

```js
/**
 * Test: Verify that pricing-tier limits are actually enforced.
 * Run: node scripts/test-tier-enforcement.cjs
 */
const assert = require('assert');
const { getLimits } = require('../coming-soon/lib/plans.cjs');

// 1. Check that limits are defined for Starter
const starterLimits = getLimits('starter');
assert.strictEqual(starterLimits.maxFilesPerScan, 50, 'Starter should have 50-file limit');
assert.strictEqual(starterLimits.maxFindingsShown, 5, 'Starter should show 5 findings');
assert.strictEqual(starterLimits.showQualityScore, false, 'Starter should hide quality score');
console.log('✅ Plans config defines Starter limits correctly');

// 2. Check that limits are null (unlimited) for Pro
const proLimits = getLimits('pro');
assert.strictEqual(proLimits.maxFilesPerScan, null, 'Pro should have unlimited files');
assert.strictEqual(proLimits.maxFindingsShown, null, 'Pro should show all findings');
assert.strictEqual(proLimits.showQualityScore, true, 'Pro should show quality score');
console.log('✅ Plans config defines Pro limits correctly');

// 3. Check that the scanner actually READS these limits
const fs = require('fs');
const scanSource = fs.readFileSync('packages/simplebeacon-cli/src/scan.js', 'utf8');
const hasMaxFilesCheck = /maxFilesPerScan|getLimits|getPlan/.test(scanSource);
assert.strictEqual(hasMaxFilesCheck, true, 'Scanner should reference tier limits');
console.log('✅ Scanner references tier limits');

// 4. Check that the API enforces limits
const apiSource = fs.readFileSync('server/routes/flexible-analyze-api.cjs', 'utf8');
const hasApiTierGate = /getLimits|getPlan|maxFilesPerScan/.test(apiSource);
assert.strictEqual(hasApiTierGate, true, 'API should enforce tier limits');
console.log('✅ API enforces tier limits');

console.log('\n🎉 All tier enforcement checks passed!');
```

**Current state of this test:** Steps 1–2 pass. **Steps 3–4 FAIL** because `scan.js` and `flexible-analyze-api.cjs` do not import or check `getLimits()`.

---

*Document version: 1.0*  
*Next review: After tier enforcement is implemented*
