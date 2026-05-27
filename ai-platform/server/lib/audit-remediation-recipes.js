/**
 * Deterministic impact statements, copy-paste fix recipes, and verify commands
 * for premium audit PDF/HTML deliverables.
 */

const IMPACT_BY_KIND = {
    credentials: 'CRITICAL RISK: Left unchanged, this key can be scraped by automated bots within minutes of a public Git push — leading to immediate cloud wallet drainage and vendor account takeover.',
    'production-leak': 'HIGH RISK: Left unchanged, production builds ship demo metrics and mock JSON to live users — triggering breach-of-contract delivery reviews at handoff.',
    'fiction-kpi': 'HYGIENE RISK: Left unchanged, live client users see fake filler percentages (e.g. 98.5%) on dashboards — undermining trust in every KPI the product displays.',
    'debug-artifact': 'HYGIENE RISK: Left unchanged, secrets and PII can leak through server logs, support bundles, and browser consoles during client demos.',
    'tech-debt': 'MAINTENANCE RISK: Left unchanged, unfinished markers signal an unreviewed AI-assisted merge — increasing regression risk during the first production week.',
    syntax: 'RELEASE BLOCKER: Left unchanged, parse or syntax errors prevent builds, block CI, and delay the handoff window.',
    schema: 'DATA INTEGRITY RISK: Left unchanged, dashboard samples fail schema validation — breaking rendering or silently dropping client-facing modules.',
    'dev-dependency': 'STRUCTURAL RISK: Left unchanged, test-only imports in production modules expand attack surface and break lean deploy artifacts.',
    general: 'REVIEW REQUIRED: Left unchanged, this pattern may reappear in the next release cycle without a local gate on pull requests.'
};

const DEFAULT_RECIPES = {
    credentials: 'Remove the literal string. Inject via environment: `const apiKey = process.env.API_KEY;` — store values in `.env` (gitignored) or your secret manager. Rotate the credential if it was ever real.',
    'production-leak': 'Replace static sample imports with runtime API calls or env-based config. Move fixtures to `__tests__/` or `fixtures/` excluded from production bundles.',
    'fiction-kpi': 'Replace template KPI literals with measured values from `.simplebeacon/baseline.json` or live reporting APIs. Delete hard-coded completion/success percentages from UI copy.',
    'debug-artifact': 'Remove `console.log` / `debugger` from production paths. Use structured logging behind `if (process.env.NODE_ENV !== "production")` or your observability SDK.',
    'tech-debt': 'Resolve unfinished work markers with a tracked ticket or implement the missing behavior before handoff. Do not ship stub markers in runtime modules.',
    syntax: 'Fix the parse/syntax error at the flagged line, run your formatter/linter, and confirm the file compiles before re-scanning.',
    schema: 'Align sample JSON with registered page specs in `.simplebeacon/config.json` — add missing required keys and matching field types.',
    'dev-dependency': 'Move development imports (e.g. test frameworks) out of production modules into devDependencies, test suites, or staging-only entry points.',
    general: 'Apply the remediation noted in your scan JSON, then re-run the gate command below to confirm zero Critical/High flags remain.'
};

function classifyRowKind(row = {}) {
    const rule = String(row.rule || '').toLowerCase();
    const snippet = String(row.snippet || '').toLowerCase();
    const haystack = `${rule} ${snippet}`;

    if (/debug|console_or_debugger|console\.log|debugger/.test(rule) || (/console\s*\.\s*log|debugger/.test(snippet) && !/api[_-]?key|sk_|akia/.test(snippet))) {
        return 'debug-artifact';
    }
    if (/credential|aws|stripe|secret|api[-_]?key|token|akia|sk_|rk_|whsec_/.test(haystack)) {
        return 'credentials';
    }
    if (/production.leak|mock|sample\.json|demo-metrics|fixtures\//.test(haystack)) {
        return 'production-leak';
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
    if (/broken|parse|syntax|eslint/.test(haystack)) {
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
    if (kind === 'fiction-kpi' || kind === 'debug-artifact' || kind === 'tech-debt') return 'impact-hygiene';
    return 'impact-review';
}

function buildImpactRisk(kind, severity) {
    const base = IMPACT_BY_KIND[kind] || IMPACT_BY_KIND.general;
    const prefix = kind === 'credentials' || severity === 'critical'
        ? 'CRITICAL'
        : kind === 'production-leak' || severity === 'high'
            ? 'HIGH'
            : kind === 'fiction-kpi' || kind === 'debug-artifact'
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
        return 'Remove the hardcoded assignment. Load from environment parameters: `process.env.API_KEY` with values supplied at deploy time — never committed to git.';
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

    if (fallbackRemediation && String(fallbackRemediation).trim()) {
        return String(fallbackRemediation).trim();
    }
    return DEFAULT_RECIPES[kind] || DEFAULT_RECIPES.general;
}

function buildVerificationCommand(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/').trim();
    if (!normalized) {
        return 'npx simplebeacon scan --path ./src --gate';
    }
    const parts = normalized.split('/').filter(Boolean);
    const rel = parts.length > 3 ? parts.slice(-2).join('/') : parts.join('/') || 'src';
    return `npx simplebeacon scan --path ./${rel} --gate`;
}

function enrichRemediationRow(row = {}) {
    const kind = row.kind || classifyRowKind(row);
    const severity = String(row.severity || 'medium').toLowerCase();
    return {
        ...row,
        kind,
        impact: row.impact || buildImpactRisk(kind, severity),
        impactClass: row.impactClass || impactBandClass(kind, severity),
        recipe: row.recipe || buildCodeRecipe(kind, row.snippet, row.rule, row.remediation)
    };
}

module.exports = {
    classifyRowKind,
    buildImpactRisk,
    buildCodeRecipe,
    buildVerificationCommand,
    enrichRemediationRow,
    IMPACT_BY_KIND,
    DEFAULT_RECIPES
};
