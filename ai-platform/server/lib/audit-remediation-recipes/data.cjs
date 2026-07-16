// simplebeacon-ignore: Scanner pattern definitions, dashboard code, security — all findings are false positives, debugArtifacts, test fixtures
/**
 * Static lookup tables for audit remediation recipes.
 * Separated from the main module to reduce bundle size and improve cacheability.
 */

const IMPACT_BY_KIND = {
    credentials: 'CRITICAL RISK: Left unchanged, this key can be scraped by automated bots within minutes of a public Git push — leading to immediate cloud wallet drainage and vendor account takeover.',
    'production-leak': 'HIGH RISK: Left unchanged, production builds ship demo metrics and mock JSON to live users — triggering breach-of-contract delivery reviews at handoff.',
    'llm-slop': 'HYGIENE RISK: Left unchanged, raw markdown fences or LLM placeholder debris in source files signal unreviewed AI output — confusing reviewers and hiding real defects at handoff.',
    'fiction-kpi': 'HYGIENE RISK: Left unchanged, live client users see fake filler percentages (e.g. 98.5%) on dashboards — undermining trust in every KPI the product displays.',
    'debug-artifact': 'HYGIENE RISK: Left unchanged, secrets and PII can leak through server logs, support bundles, and browser consoles during client demos.',
    'tech-debt': 'MAINTENANCE RISK: Left unchanged, unfinished markers signal an unreviewed AI-assisted merge — increasing regression risk during the first production week.',
    syntax: 'RELEASE BLOCKER: Left unchanged, parse or syntax errors prevent builds, block CI, and delay the handoff window.',
    schema: 'DATA INTEGRITY RISK: Left unchanged, dashboard samples fail schema validation — breaking rendering or silently dropping client-facing modules.',
    'dev-dependency': 'STRUCTURAL RISK: Left unchanged, test-only imports in production modules expand attack surface and break lean deploy artifacts.',
    general: 'REVIEW REQUIRED: Left unchanged, this pattern may reappear in the next release cycle without a local gate on pull requests.'
};

const DEFAULT_RECIPES = {
    credentials: 'Remove the literal string. Inject via environment: `const apiKey = process.env.<YOUR_API_KEY>;` — store values in `.env` (gitignored) or your secret manager. Rotate the credential if it was ever real.',
    'production-leak': 'Replace static sample imports with runtime API calls or env-based config. Move fixtures to `__tests__/` or `fixtures/` excluded from production bundles.',
    'llm-slop': 'Remove pasted markdown fences (```) from source files. If the line is a regex/parser that detects fences, add an allowlist entry or relocate detector patterns to test fixtures.',
    'fiction-kpi': 'Replace template KPI literals with measured values from `.simplebeacon/baseline.json` or live reporting APIs. Delete hard-coded completion/success percentages from UI copy.',
    'debug-artifact': 'Remove `console.log` / `debugger` from production paths. Use structured logging behind `if (process.env.NODE_ENV !== "production")` or your observability SDK.',
    'tech-debt': 'Resolve unfinished work markers with a tracked ticket or implement the missing behavior before handoff. Do not ship stub markers in runtime modules.',
    syntax: 'Fix the parse/syntax error at the flagged line, run your formatter/linter, and confirm the file compiles before re-scanning.',
    schema: 'Align sample JSON with registered page specs in `.simplebeacon/config.json` — add missing required keys and matching field types.',
    'dev-dependency': 'Move development imports (e.g. test frameworks) out of production modules into devDependencies, test suites, or staging-only entry points.',
    general: 'Apply the remediation noted in your scan JSON, then re-run the gate command below to confirm zero Critical/High flags remain.'
};

const ESTIMATED_MINUTES_BY_KIND = {
    credentials: 15,
    'env-secret': 15,
    'production-leak': 45,
    'llm-slop': 10,
    'fiction-kpi': 20,
    'debug-artifact': 5,
    'tech-debt': 30,
    syntax: 10,
    eslint: 2,
    schema: 25,
    'dev-dependency': 20,
    'config-sprawl': 30,
    pii: 10,
    'orphaned-data': 5,
    'file-reduction': 5,
    general: 15
};

const BUSINESS_IMPACT_BY_KIND = {
    credentials: 'Immediate credential exposure — rotate keys before any deploy',
    'env-secret': 'Blocks production deploy — rotate Stripe/env secrets on the host',
    'production-leak': 'Blocks client handoff — demo data may ship to production',
    'llm-slop': 'Review credibility — unreviewed AI debris in source',
    'fiction-kpi': 'Dashboard trust — fake metrics visible to stakeholders',
    'debug-artifact': 'Data leakage — secrets or PII in logs and consoles',
    'tech-debt': 'Regression risk — unfinished markers in runtime paths',
    syntax: 'Blocks CI and handoff — parse or lint errors',
    eslint: 'Code hygiene — no Simplebeacon gate impact',
    schema: 'Broken dashboards — sample JSON fails validation',
    'dev-dependency': 'Bloated deploy — test imports in production modules',
    'config-sprawl': 'Operational hygiene — consolidate env files when convenient',
    pii: 'Privacy hygiene — tokenize docs/samples; not a production-path blocker',
    'orphaned-data': 'Housekeeping — archive or wire consumers before deletion',
    'file-reduction': 'Disk hygiene — safe artifact cleanup; verify before delete',
    general: 'Review required — may recur without a local gate'
};

const GATE_BLOCKING_KINDS = new Set(['credentials', 'production-leak']);
const FIX_SPEC_VERSION = 1;
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

module.exports = {
    IMPACT_BY_KIND,
    DEFAULT_RECIPES,
    ESTIMATED_MINUTES_BY_KIND,
    BUSINESS_IMPACT_BY_KIND,
    GATE_BLOCKING_KINDS,
    FIX_SPEC_VERSION,
    SEVERITY_ORDER
};
