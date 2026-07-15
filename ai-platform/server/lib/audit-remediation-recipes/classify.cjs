// simplebeacon-ignore: Scanner pattern definitions, and dashboard code — all findings are false positives, debugArtifacts, test fixtures
/**
 * Classification, impact risk, and recipe lookup functions.
 */

const { IMPACT_BY_KIND, DEFAULT_RECIPES } = require('./data.cjs');

function classifyRowKind(row = {}) {
    const rule = String(row.rule || '').toLowerCase();
    const snippet = String(row.snippet || '').toLowerCase();
    const haystack = `${rule} ${snippet}`;

    if (/debug|console_or_debugger|console\.log|debugger/.test(rule) || (/console\s*\.\s*log|debugger/.test(snippet) && !/api[_-]?key|sk_|akia/.test(snippet))) {
        return 'debug-artifact';
    }
    if (/env-secret|rotate-and-move-to-secret-store|env secret/.test(haystack)) {
        return 'env-secret';
    }
    if (/config-sprawl|review-config-sprawl/.test(haystack)) {
        return 'config-sprawl';
    }
    if (/data-privacy|pii|realistic-email|ssn-pattern|remove-or-tokenize-pii/.test(haystack)) {
        return 'pii';
    }
    if (/orphaned-data|archive-or-wire-consumer/.test(haystack)) {
        return 'orphaned-data';
    }
    if (/build-artifact|safe-to-delete|file-reduction|unused-file|consolidate-duplicates/.test(haystack)) {
        return 'file-reduction';
    }
    if (/credential|aws|stripe|secret|api[-_]?key|token|akia|sk_|rk_|whsec_/.test(haystack)) {
        return 'credentials';
    }
    if (/production.leak|mock|sample\.json|demo-metrics|fixtures\//.test(haystack)) {
        return 'production-leak';
    }
    if (/llm\s*slop|sb-fiction|markdown fence|```/.test(haystack)) {
        return 'llm-slop';
    }
    if (/fiction|kpi|completion_rate|success_rate|98\.5|meaningless|placeholder metric/.test(haystack)) {
        return 'fiction-kpi';
    }
    if (/pytest|jest|mocha|vitest|devdepend/.test(haystack)) {
        return 'dev-dependency';
    }
    if (/schema|page.spec/.test(haystack)) {
        return 'schema';
    }
    if (/eslint|no-unused-vars|assigned a value but never used/.test(haystack)) {
        return 'eslint';
    }
    if (/broken|parse|syntax/.test(haystack)) {
        return 'syntax';
    }
    if (/todo|fixme|stub|tech.debt|deprecated|not implemented/.test(haystack)) {
        return 'tech-debt';
    }
    return 'general';
}

function impactBandClass(kind, severity) {
    if (kind === 'credentials' || severity === 'critical') return 'impact-critical';
    if (kind === 'production-leak' || severity === 'high') return 'impact-high';
    if (kind === 'fiction-kpi' || kind === 'debug-artifact' || kind === 'tech-debt' || kind === 'llm-slop') return 'impact-hygiene';
    return 'impact-review';
}

function buildImpactRisk(kind, severity) {
    const base = IMPACT_BY_KIND[kind] || IMPACT_BY_KIND.general;
    const prefix = kind === 'credentials' || severity === 'critical'
        ? 'CRITICAL'
        : kind === 'production-leak' || severity === 'high'
            ? 'HIGH'
            : kind === 'fiction-kpi' || kind === 'debug-artifact' || kind === 'llm-slop'
                ? 'HYGIENE'
                : 'REVIEW';
    if (base.startsWith(prefix.split(' ')[0])) return base;
    return base;
}

function buildCodeRecipe(kind, snippet, rule, fallbackRemediation) {
    const text = String(snippet || '').toLowerCase();

    if (/console\s*\.\s*log/.test(text)) {
        return 'Remove the statement or replace with structured logging behind a non-production guard. Never log tokens, API keys, or session identifiers.';
    }
    if (/debugger/.test(text)) {
        return 'Delete the `debugger` statement before merge. Use breakpoints locally only — never commit debugger traps to production branches.';
    }
    if (/sk_(live|test)_|rk_(live|test)_|akia[0-9a-z]{4}/i.test(String(snippet || ''))) {
        return 'Remove the literal secret. Inject via environment: `process.env.STRIPE_SECRET_KEY` (Node) or your platform secret store. Rotate the key in the vendor console immediately.';
    }
    if (/api[_-]?key\s*[:=]|secret\s*[:=]|password\s*[:=]/i.test(String(snippet || ''))) {
        return 'Remove the hardcoded assignment. Load from environment parameters: `process.env.<YOUR_API_KEY>` with values supplied at deploy time — never committed to git.';
    }
    if (/import pytest|from pytest/.test(text)) {
        return 'Move the test import out of production modules. Add `pytest` to devDependencies and keep test suites under `tests/` or CI-only staging profiles.';
    }
    if (/sample\.json|mock\/|demo-metrics/.test(text)) {
        return 'Replace the static import with a runtime API/database call. Restrict sample JSON to test fixtures excluded from production webpack/esbuild bundles.';
    }
    if (/completion_rate|success_rate|98\.5|99\.9/.test(text)) {
        return 'Delete the fiction KPI literal. Bind the UI to measured data from your reporting API or `.simplebeacon/baseline.json` after a green test run.';
    }
    if (/[`]{3}(?:json|javascript|typescript|python)/i.test(String(snippet || ''))) {
        return 'Remove accidental markdown code fences from source. Do not paste LLM responses directly into `.js` files — extract only the code body.';
    }

    if (fallbackRemediation && String(fallbackRemediation).trim()) {
        return String(fallbackRemediation).trim();
    }
    return DEFAULT_RECIPES[kind] || DEFAULT_RECIPES.general;
}

function buildVerificationCommand(projectPath, options = {}) {
    const platformRoot = options.platformRoot || projectPath;
    const normalized = String(platformRoot || projectPath || '').replace(/\\/g, '/').trim();
    if (!normalized) {
        return 'npx simplebeacon scan --gate';
    }
    const baseName = normalized.split('/').filter(Boolean).pop() || 'src';
    if (baseName === 'ai-platform') {
        return 'npx simplebeacon scan --path ./ai-platform --gate';
    }
    if (/^[a-z]:\//i.test(normalized) || normalized.startsWith('/')) {
        return `npx simplebeacon scan --path "${normalized}" --gate`;
    }
    return `npx simplebeacon scan --path ./${baseName} --gate`;
}

module.exports = {
    classifyRowKind,
    impactBandClass,
    buildImpactRisk,
    buildCodeRecipe,
    buildVerificationCommand
};
