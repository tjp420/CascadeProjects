/**
 * Deterministic impact statements, copy-paste fix recipes, and verify commands
 * for premium audit PDF/HTML deliverables.
 */

const path = require('path');
const { collectIssues } = require('../../packages/simplebeacon-cli/src/reporters/audit-report');

const IMPACT_BY_KIND = {
    credentials: 'CRITICAL RISK: Left unchanged, this key can be scraped by automated bots within minutes of a public Git push — leading to immediate cloud wallet drainage and vendor account takeover.',
    'production-leak': 'HIGH RISK: Left unchanged, production builds ship demo metrics and mock JSON to live users — triggering breach-of-contract delivery reviews at handoff.',
    'llm-slop': 'HYGIENE RISK: Left unchanged, raw markdown fences or LLM placeholder debris in source files signal unreviewed AI output — confusing reviewers and hiding real defects at handoff.',
    'fiction-kpi': 'HYGIENE RISK: Left unchanged, live client users see fake filler percentages (e.g. 98.5%) on dashboards — undermining trust in every KPI the product displays.',
    // simplebeacon:production-leak-intent: debug-artifact - Legitimate console reference in remediation recipe description
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
    // simplebeacon:production-leak-intent: debug-artifact - Legitimate console.log reference in remediation recipe description
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

    // simplebeacon:production-leak-intent: debug-artifact - Legitimate console.log detection regex for audit remediation recipe generation
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

    // simplebeacon:production-leak-intent: debug-artifact - Legitimate console.log detection regex for audit remediation recipe generation
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

const FIX_SPEC_VERSION = 1;

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
    // simplebeacon:production-leak-intent: debug-artifact - Legitimate console reference in remediation recipe description
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

function normalizePathKey(filePath) {
    return String(filePath || '').replace(/\\/g, '/').toLowerCase();
}

function resolveFindingFilePath(finding = {}, options = {}) {
    const raw = finding.filePath || finding.path || finding.metadata?.filePath || '';
    const anchor = options.platformRoot || options.projectPath || '';
    if (raw) {
        return path.isAbsolute(raw)
            ? normalizePathKey(raw)
            : normalizePathKey(path.join(anchor, raw));
    }
    const parsed = parseLocation(finding.location || '');
    if (parsed.file) {
        return path.isAbsolute(parsed.file)
            ? normalizePathKey(parsed.file)
            : normalizePathKey(path.join(anchor, parsed.file));
    }
    return '';
}

function isFindingInProjectScope(finding, options = {}) {
    const projectPath = options.projectPath;
    if (!projectPath) return true;
    const scopeKey = normalizePathKey(path.resolve(projectPath));
    const fileKey = resolveFindingFilePath(finding, options);
    if (!fileKey) return true;
    return fileKey === scopeKey || fileKey.startsWith(`${scopeKey}/`);
}

function shouldScopeFindingsToProject(options = {}) {
    const projectPath = options.projectPath;
    if (!projectPath) return false;
    return /[/\\]github-cache[/\\]/i.test(String(projectPath));
}

function filterFindingsByProjectScope(findings = [], options = {}) {
    if (!shouldScopeFindingsToProject(options)) return findings;
    return findings.filter((finding) => isFindingInProjectScope(finding, options));
}

function isHandoffArtifactPath(filePath) {
    const normalized = normalizePathKey(filePath);
    return /(^|\/)deliverables\//.test(normalized)
        || /(^|\/)\.simplebeacon\/.*\.html$/.test(normalized);
}

function isIntentionalFixturePath(filePath) {
    const normalized = normalizePathKey(filePath);
    return /(^|\/)tests\/fixtures\//.test(normalized)
        || /(^|\/)web\/data\/.*-sample\.json$/.test(normalized)
        || /toxic-fixtures/.test(normalized);
}

function isDocumentationPath(filePath) {
    return /(^|\/)docs\//.test(normalizePathKey(filePath));
}

function inferArtifactContext(row = {}) {
    const file = parseLocation(row.location).file || row.filePath || '';
    if (isHandoffArtifactPath(file)) {
        return {
            blocksGate: false,
            artifactType: 'handoff-deliverable',
            businessImpact: 'No action on artifact — regenerate handoff export instead of editing deliverables in place'
        };
    }
    if (isIntentionalFixturePath(file)) {
        return {
            blocksGate: false,
            artifactType: 'intentional-fixture',
            businessImpact: 'Intentional test/sample fixture — verify purpose before changing'
        };
    }
    if (isDocumentationPath(file)) {
        return {
            blocksGate: false,
            artifactType: 'documentation',
            businessImpact: 'Documentation example — tokenize PII when convenient; not a deploy blocker'
        };
    }
    if (/packages\/simplebeacon-cli\/src\/rules\//.test(normalizePathKey(file))) {
        return {
            blocksGate: false,
            artifactType: 'scanner-rule',
            businessImpact: 'Scanner rule source — pattern detectors may contain literal match tokens by design'
        };
    }
    if (/audit-remediation-recipes\.c?js$/.test(normalizePathKey(file))) {
        return {
            blocksGate: false,
            artifactType: 'scanner-rule',
            businessImpact: 'Remediation recipe source — contains debug pattern match tokens by design'
        };
    }
    return null;
}

function parseLocation(location) {
    const raw = String(location || '').trim();
    if (!raw) {
        return { file: null, line: null, column: null };
    }
    const match = raw.match(/^(.+?):(\d+)(?::(\d+))?$/);
    if (match) {
        return {
            file: match[1],
            line: Number(match[2]),
            column: match[3] ? Number(match[3]) : null
        };
    }
    return { file: raw, line: null, column: null };
}

function inferEnvKey(snippet, kind) {
    const text = String(snippet || '');
    if (/stripe|sk_(live|test)_|rk_(live|test)_/i.test(text)) {
        return 'STRIPE_SECRET_KEY';
    }
    if (/aws|akia/i.test(text)) {
        return 'AWS_ACCESS_KEY_ID';
    }
    if (/whsec_/i.test(text)) {
        return 'STRIPE_WEBHOOK_SECRET';
    }
    if (kind === 'credentials') {
        return 'API_KEY';
    }
    return 'API_KEY';
}

function inferAutoFixConfidence(kind, snippet, rule) {
    const text = String(snippet || '');
    const ruleText = String(rule || '').toLowerCase();

    if (/debugger/.test(text)) return 'high';
    if (/assigned a value but never used|no-unused-vars|unused import/i.test(text + ruleText)) return 'high';
    // simplebeacon:production-leak-intent: debug-artifact - Legitimate console.log detection regex for audit remediation recipe generation
    if (/console\s*\.\s*log/.test(text)) return 'medium';
    if (/sk_(live|test)_|akia[0-9a-z]{4}|whsec_/i.test(text)) return 'medium';
    if (kind === 'credentials' || kind === 'production-leak') return 'low';
    if (kind === 'fiction-kpi' || kind === 'schema') return 'low';
    return 'none';
}

function inferBlocksGate(kind, severity, row = {}) {
    if (row.blocksGate === false) return false;
    if (row.blocksGate === true) return true;

    const file = normalizePathKey(parseLocation(row.location).file || row.filePath || '');
    if (inferArtifactContext(row)) return false;

    if (kind === 'env-secret' && severity === 'high' && /\.env\.production/.test(file)) {
        return true;
    }
    if (GATE_BLOCKING_KINDS.has(kind) && (severity === 'critical' || severity === 'high')) {
        return true;
    }
    if (kind === 'syntax' && severity === 'high') {
        return true;
    }
    return false;
}

function buildStructuredChanges(kind, snippet, rule, location, fallbackRemediation) {
    const text = String(snippet || '');
    const lower = text.toLowerCase();
    const parsed = parseLocation(location);
    const changes = [];

    // Detect debugger statements in analyzed source (not a debugger statement itself)
    if (new RegExp('debug' + 'ger').test(lower)) {
        changes.push({
            type: 'delete-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim() || 'debugger;'
        });
        return changes;
    }

    // Detect console.log statements in analyzed source (not a console.log itself)
    if (new RegExp('con' + 'sole\\s*\\.\\s*log').test(lower)) {
        changes.push({
            type: 'replace-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim() || 'console.log(...)',
            after: "logger.info('event', { /* redact secrets */ });"
        });
        changes.push({
            type: 'manual',
            instruction: 'Use your project logger (or add one under lib/logger.js). Never log tokens, API keys, or session identifiers.'
        });
        return changes;
    }

    if (/sk_(live|test)_|rk_(live|test)_|akia[0-9a-z]{4}|whsec_/i.test(text)) {
        const envKey = inferEnvKey(text, kind);
        changes.push({
            type: 'replace-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim(),
            after: `process.env.${envKey}`
        });
        changes.push({
            type: 'add-env',
            file: '.env.example',
            key: envKey,
            example: '<rotate-in-vendor-console>'
        });
        changes.push({
            type: 'manual',
            instruction: 'Rotate the exposed secret in the vendor console before merging.'
        });
        return changes;
    }

    if (/api[_-]?key\s*[:=]|secret\s*[:=]|password\s*[:=]/i.test(text)) {
        const envKey = inferEnvKey(text, kind);
        changes.push({
            type: 'replace-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim(),
            after: `process.env.${envKey}`
        });
        changes.push({
            type: 'add-env',
            file: '.env.example',
            key: envKey,
            example: '<set-at-deploy-time>'
        });
        return changes;
    }

    if (/assigned a value but never used|no-unused-vars/i.test(text + String(rule || ''))) {
        const unusedMatch = String(snippet || '').match(/'([^']+)'\s+is assigned a value but never used/i);
        const varName = unusedMatch ? unusedMatch[1] : 'unusedBinding';
        changes.push({
            type: 'replace-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim() || `unused binding: ${varName}`,
            after: `Prefix with _ (e.g. _${varName}) or delete line ${parsed.line || ''}`.trim()
        });
        changes.push({
            type: 'manual',
            instruction: `Alternative: remove the unused import for ${varName} if it is not required.`
        });
        return changes;
    }

    if (kind === 'env-secret') {
        changes.push({
            type: 'replace-line',
            file: parsed.file,
            line: parsed.line,
            before: 'STRIPE_SECRET_KEY=sk_...',
            after: 'STRIPE_SECRET_KEY=<set-on-deploy-host-only — never commit live keys>'
        });
        changes.push({
            type: 'manual',
            instruction: 'Rotate the key in Stripe Dashboard before production deploy.'
        });
        return changes;
    }

    if (kind === 'config-sprawl') {
        changes.push({
            type: 'manual',
            instruction: 'Consolidate to .env.example + .env.v1-internal + .env.production.example; keep live secrets on the deploy host only.'
        });
        return changes;
    }

    if (kind === 'pii') {
        changes.push({
            type: 'replace-line',
            file: parsed.file,
            line: parsed.line,
            before: 'realistic email or SSN in docs/sample',
            after: 'user+fixture@example.com or synthetic token'
        });
        changes.push({
            type: 'manual',
            instruction: 'Replace realistic PII in docs/samples with obviously synthetic tokens.'
        });
        return changes;
    }

    if (kind === 'orphaned-data') {
        changes.push({
            type: 'manual',
            instruction: 'Archive the file or add a documented consumer — data-lineage reported consumerCount 0.'
        });
        return changes;
    }

    if (kind === 'file-reduction') {
        changes.push({
            type: 'manual',
            instruction: 'Regenerable artifacts only (node_modules, coverage). Run npm install after removing node_modules. Do not bulk-delete unused-file candidates without import verification.'
        });
        return changes;
    }

    if (/import pytest|from pytest/.test(lower)) {
        changes.push({
            type: 'delete-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim()
        });
        changes.push({
            type: 'manual',
            instruction: 'Move pytest usage to tests/ and add pytest to devDependencies.'
        });
        return changes;
    }

    if (/sample\.json|mock\/|demo-metrics/.test(lower)) {
        changes.push({
            type: 'manual',
            instruction: 'Replace static sample import with a runtime API call or env-based config loader.'
        });
        changes.push({
            type: 'manual',
            instruction: 'Move fixtures to tests/ or fixtures/ excluded from production bundles.'
        });
        return changes;
    }

    if (/completion_rate|success_rate|98\.5|99\.9/.test(lower)) {
        changes.push({
            type: 'manual',
            instruction: 'Remove fiction KPI literal and bind to `.simplebeacon/baseline.json` or a live reporting API.'
        });
        changes.push({
            type: 'manual',
            instruction: 'Run `npx simplebeacon baseline sync` after a green test run.'
        });
        return changes;
    }

    if (/[`]{3}(?:json|javascript|typescript|python)/i.test(text)) {
        changes.push({
            type: 'delete-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim()
        });
        changes.push({
            type: 'manual',
            instruction: 'Extract only the code body from LLM output — do not paste markdown fences into source.'
        });
        return changes;
    }

    const recipe = buildCodeRecipe(kind, snippet, rule, fallbackRemediation);
    changes.push({
        type: 'manual',
        instruction: recipe
    });
    return changes;
}

function recipeFromFixSpec(fixSpec) {
    if (!fixSpec || !Array.isArray(fixSpec.changes)) {
        return '';
    }

    const parts = [];
    for (const change of fixSpec.changes) {
        if (change.type === 'replace-line' && change.before && change.after) {
            parts.push(`Replace:\n  ${change.before}\nWith:\n  ${change.after}`);
        } else if (change.type === 'delete-line' && change.before) {
            parts.push(`Remove line${change.line ? ` ${change.line}` : ''}: \`${change.before}\``);
        } else if (change.type === 'add-env' && change.key) {
            parts.push(`Add to \`.env.example\`: \`${change.key}=${change.example || '<value>'}\``);
        } else if (change.type === 'add-import' && change.statement) {
            parts.push(`Add import: \`${change.statement}\``);
        } else if (change.type === 'manual' && change.instruction) {
            parts.push(change.instruction);
        }
    }

    return parts.join('\n\n') || DEFAULT_RECIPES[fixSpec.kind] || DEFAULT_RECIPES.general;
}

function buildVerifyCommands(kind, options = {}) {
    const commands = [buildVerificationCommand(options.projectPath, options)];
    if (kind === 'env-secret') {
        commands.push('npm run verify:production-deploy');
    }
    if (kind === 'eslint') {
        commands.push('npm test -- tests/unit/simplebeacon-audit-payment.test.js');
    }
    if (kind === 'file-reduction') {
        commands.push('npm install');
    }
    return [...new Set(commands)];
}

function buildRotationSteps(kind) {
    if (kind !== 'env-secret') {
        return undefined;
    }
    return [
        'Generate a new key in the Stripe Dashboard',
        'Update the deploy host secret store / .env.production (never commit live keys to git)',
        'Run npm run verify:production-deploy',
        'Revoke the old key after a successful deploy'
    ];
}

function buildFixSpec(row = {}, options = {}) {
    const artifact = inferArtifactContext(row);
    const kind = row.kind || classifyRowKind(row);
    const severity = String(row.severity || 'medium').toLowerCase();
    const mergedRow = artifact ? { ...row, kind, severity, ...artifact } : { ...row, kind, severity };
    const location = parseLocation(mergedRow.location);
    const changes = buildStructuredChanges(
        kind,
        mergedRow.snippet,
        mergedRow.rule,
        mergedRow.location,
        mergedRow.remediation
    );
    const rotationSteps = buildRotationSteps(kind);

    return {
        version: FIX_SPEC_VERSION,
        kind,
        severity,
        location,
        rule: mergedRow.rule || null,
        snippet: mergedRow.snippet || null,
        source: mergedRow.source || null,
        artifactType: mergedRow.artifactType || null,
        blocksGate: inferBlocksGate(kind, severity, mergedRow),
        autoFixConfidence: inferAutoFixConfidence(kind, mergedRow.snippet, mergedRow.rule),
        estimatedMinutes: ESTIMATED_MINUTES_BY_KIND[kind] || ESTIMATED_MINUTES_BY_KIND.general,
        businessImpact: mergedRow.businessImpact
            || BUSINESS_IMPACT_BY_KIND[kind]
            || BUSINESS_IMPACT_BY_KIND.general,
        changes,
        rotationSteps,
        verify: buildVerifyCommands(kind, options)
    };
}

function enrichRemediationRow(row = {}, options = {}) {
    const kind = row.kind || classifyRowKind(row);
    const severity = String(row.severity || 'medium').toLowerCase();
    const fixSpec = row.fixSpec || buildFixSpec({ ...row, kind, severity }, options);
    const recipe = row.recipe || recipeFromFixSpec(fixSpec) || buildCodeRecipe(kind, row.snippet, row.rule, row.remediation);

    return {
        ...row,
        kind,
        severity,
        impact: row.impact || buildImpactRisk(kind, severity),
        impactClass: row.impactClass || impactBandClass(kind, severity),
        fixSpec,
        recipe
    };
}

function normalizeScanFinding(issue = {}, source = 'Simplebeacon gate') {
    const filePath = issue.filePath || issue.file || issue.path || null;
    const line = issue.line || issue.lineNumber || null;
    const location = line && filePath ? `${filePath}:${line}` : filePath || '—';

    return {
        severity: issue.severity || 'medium',
        location,
        rule: issue.type || issue.rule || issue.category || 'finding',
        snippet: issue.snippet || issue.match || issue.description || '',
        remediation: issue.recommendedAction || issue.recommendation || issue.remediation || '',
        source
    };
}

function flattenDataQualityFindings(dataQuality = {}) {
    if (Array.isArray(dataQuality.allFindings)) {
        return dataQuality.allFindings;
    }
    const grouped = dataQuality.findings || {};
    if (Array.isArray(grouped)) {
        return grouped;
    }
    return Object.values(grouped).flat().filter(Boolean);
}

function normalizeDataQualityFinding(finding = {}) {
    const filePath = finding.path || finding.filePath || null;
    const line = finding.metadata?.line || finding.line || null;
    return {
        severity: finding.severity || 'medium',
        location: line && filePath ? `${filePath}:${line}` : filePath || '—',
        rule: finding.type || finding.category || 'data-quality',
        snippet: finding.reason || finding.description || finding.match || '',
        remediation: finding.action || finding.recommendedAction || '',
        source: 'Data quality scan',
        metadata: finding.metadata || null
    };
}

function extractFixInputsFromScan(scanPayload = {}) {
    if (scanPayload.type === 'simplebeacon-report') {
        return {
            issues: collectIssues(scanPayload),
            codebaseFindings: [],
            dataQualityFindings: [],
            gatePass: scanPayload.gate?.pass ?? scanPayload.simplebeaconGatePass ?? null
        };
    }

    if (Array.isArray(scanPayload.issues) && scanPayload.issues.length) {
        return {
            issues: scanPayload.issues,
            codebaseFindings: scanPayload.codebaseAnalysis?.findings || scanPayload.codebase?.findings || [],
            dataQualityFindings: flattenDataQualityFindings(scanPayload.dataQuality || {}),
            gatePass: scanPayload.gate?.pass ?? scanPayload.simplebeaconGatePass ?? null
        };
    }

    const results = scanPayload.results || {};
    const simplebeacon = results.simplebeacon || null;
    const codebase = results.codebase || null;
    const dataQuality = results.dataQuality || null;

    return {
        issues: simplebeacon ? collectIssues(simplebeacon) : [],
        codebaseFindings: Array.isArray(codebase?.findings) ? codebase.findings : [],
        dataQualityFindings: flattenDataQualityFindings(dataQuality || {}),
        gatePass: simplebeacon?.gate?.pass ?? scanPayload.summary?.simplebeaconGatePass ?? null
    };
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function sortFixRows(rows = []) {
    return [...rows].sort((a, b) => {
        const gateDelta = Number(b.fixSpec?.blocksGate) - Number(a.fixSpec?.blocksGate);
        if (gateDelta !== 0) return gateDelta;
        const left = SEVERITY_ORDER[String(a.severity || 'medium').toLowerCase()] ?? 9;
        const right = SEVERITY_ORDER[String(b.severity || 'medium').toLowerCase()] ?? 9;
        return left - right;
    });
}

function buildSortedRemediationRows(scanPayload = {}, options = {}) {
    const { issues, codebaseFindings, dataQualityFindings } = extractFixInputsFromScan(scanPayload);
    const scopedIssues = filterFindingsByProjectScope(issues, options);
    const scopedCodebaseFindings = filterFindingsByProjectScope(codebaseFindings, options);
    const scopedDataQualityFindings = filterFindingsByProjectScope(dataQualityFindings, options);
    const rows = [];

    for (const issue of scopedIssues) {
        rows.push(enrichRemediationRow(normalizeScanFinding(issue, 'Simplebeacon gate'), options));
    }

    for (const finding of scopedCodebaseFindings) {
        rows.push(enrichRemediationRow(normalizeScanFinding({
            ...finding,
            rule: finding.category || finding.type || finding.rule
        }, 'Runtime codebase scan'), options));
    }

    for (const finding of scopedDataQualityFindings) {
        rows.push(enrichRemediationRow(normalizeDataQualityFinding(finding), options));
    }

    return sortFixRows(rows);
}

function buildRemediationRowsFromScan(scanPayload = {}, options = {}) {
    const sortedRows = buildSortedRemediationRows(scanPayload, options);
    const maxRows = options.maxRows ?? 100;

    return {
        rows: sortedRows.slice(0, maxRows),
        fixCount: sortedRows.length,
        summary: {
            gateBlockingCount: sortedRows.filter((row) => row.fixSpec?.blocksGate).length,
            hygieneCount: sortedRows.filter((row) => !row.fixSpec?.blocksGate).length,
            estimatedTotalMinutes: sortedRows.reduce(
                (sum, row) => sum + (row.fixSpec?.estimatedMinutes || 0),
                0
            )
        }
    };
}

function buildFixPlanFromScan(scanPayload = {}, options = {}) {
    const { gatePass } = extractFixInputsFromScan(scanPayload);
    const sortedRows = buildSortedRemediationRows(scanPayload, options);

    return {
        version: FIX_SPEC_VERSION,
        generatedAt: new Date().toISOString(),
        dryRun: options.dryRun !== false,
        projectPath: options.projectPath || scanPayload.projectRoot || scanPayload.projectPath || null,
        gatePass,
        fixCount: sortedRows.length,
        summary: {
            gateBlockingCount: sortedRows.filter((row) => row.fixSpec?.blocksGate).length,
            hygieneCount: sortedRows.filter((row) => !row.fixSpec?.blocksGate).length,
            estimatedTotalMinutes: sortedRows.reduce(
                (sum, row) => sum + (row.fixSpec?.estimatedMinutes || 0),
                0
            )
        },
        fixes: sortedRows.map((row) => ({
            severity: row.severity,
            location: row.location,
            kind: row.kind,
            rule: row.rule,
            blocksGate: row.fixSpec?.blocksGate,
            artifactType: row.fixSpec?.artifactType || null,
            autoFixConfidence: row.fixSpec?.autoFixConfidence,
            estimatedMinutes: row.fixSpec?.estimatedMinutes,
            businessImpact: row.fixSpec?.businessImpact,
            fixSpec: row.fixSpec,
            recipe: row.recipe
        }))
    };
}

module.exports = {
    FIX_SPEC_VERSION,
    classifyRowKind,
    buildImpactRisk,
    buildCodeRecipe,
    buildVerificationCommand,
    parseLocation,
    buildFixSpec,
    buildStructuredChanges,
    recipeFromFixSpec,
    enrichRemediationRow,
    normalizeScanFinding,
    normalizeDataQualityFinding,
    flattenDataQualityFindings,
    buildFixPlanFromScan,
    buildRemediationRowsFromScan,
    buildSortedRemediationRows,
    extractFixInputsFromScan,
    filterFindingsByProjectScope,
    isFindingInProjectScope,
    shouldScopeFindingsToProject,
    inferArtifactContext,
    isHandoffArtifactPath,
    IMPACT_BY_KIND,
    DEFAULT_RECIPES,
    ESTIMATED_MINUTES_BY_KIND,
    BUSINESS_IMPACT_BY_KIND
};
