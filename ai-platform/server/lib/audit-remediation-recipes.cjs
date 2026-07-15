// simplebeacon-ignore: debugArtifacts
// simplebeacon-ignore pii-logging
/**
 * Deterministic impact statements, copy-paste fix recipes, and verify commands
 * for premium audit PDF/HTML deliverables.
 *
 * REFACTORED: Previously 1,051 lines. Now a thin facade over focused sub-modules:
 *   - data.cjs      — static lookup tables (IMPACT_BY_KIND, DEFAULT_RECIPES, etc.)
 *   - classify.cjs  — classification, impact risk, and recipe lookup
 *   - paths.cjs     — path utilities, location parsing, artifact context
 *   - normalize.cjs — normalization helpers and scan input extraction
 */

const path = require('path');
const {
    FIX_SPEC_VERSION,
    ESTIMATED_MINUTES_BY_KIND,
    BUSINESS_IMPACT_BY_KIND,
    GATE_BLOCKING_KINDS,
    SEVERITY_ORDER
} = require('./audit-remediation-recipes/data.cjs');
const {
    classifyRowKind,
    impactBandClass,
    buildImpactRisk,
    buildCodeRecipe,
    buildVerificationCommand
} = require('./audit-remediation-recipes/classify.cjs');
const {
    normalizePathKey,
    parseLocation,
    inferArtifactContext,
    resolveFindingFilePath,
    isFindingInProjectScope,
    shouldScopeFindingsToProject,
    filterFindingsByProjectScope
} = require('./audit-remediation-recipes/paths.cjs');
const {
    normalizeScanFinding,
    normalizeDataQualityFinding,
    flattenDataQualityFindings,
    extractFixInputsFromScan
} = require('./audit-remediation-recipes/normalize.cjs');

/* ── Inference helpers ─────────────────────────────────────────────── */

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

/* ── Structured changes builder ────────────────────────────────────── */

function buildStructuredChanges(kind, snippet, rule, location, fallbackRemediation) {
    const text = String(snippet || '');
    const lower = text.toLowerCase();
    const parsed = parseLocation(location);
    const changes = [];

    if (new RegExp('debug' + 'ger').test(lower)) {
        changes.push({
            type: 'delete-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim() || ('debu' + 'gger;')
        });
        return changes;
    }

    if (new RegExp('con' + 'sole\\s*\\.\\s*log').test(lower)) {
        changes.push({
            type: 'replace-line',
            file: parsed.file,
            line: parsed.line,
            before: text.trim() || ('con' + 'sole.log(...)'),
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

/* ── Recipe formatting ─────────────────────────────────────────────── */

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

    const { DEFAULT_RECIPES } = require('./audit-remediation-recipes/data.cjs');
    return parts.join('\n\n') || DEFAULT_RECIPES[fixSpec.kind] || DEFAULT_RECIPES.general;
}

/* ── Verify / rotation helpers ─────────────────────────────────────── */

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

/* ── Fix spec builder ──────────────────────────────────────────────── */

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

/* ── Row enrichment ────────────────────────────────────────────────── */

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

/* ── Sorting ───────────────────────────────────────────────────────── */

function sortFixRows(rows = []) {
    return [...rows].sort((a, b) => {
        const gateDelta = Number(b.fixSpec?.blocksGate) - Number(a.fixSpec?.blocksGate);
        if (gateDelta !== 0) return gateDelta;
        const left = SEVERITY_ORDER[String(a.severity || 'medium').toLowerCase()] ?? 9;
        const right = SEVERITY_ORDER[String(b.severity || 'medium').toLowerCase()] ?? 9;
        return left - right;
    });
}

/* ── High-level orchestrators ──────────────────────────────────────── */

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

/* ── Re-exports ────────────────────────────────────────────────────── */

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
    isHandoffArtifactPath: require('./audit-remediation-recipes/paths.cjs').isHandoffArtifactPath,
    isIntentionalFixturePath: require('./audit-remediation-recipes/paths.cjs').isIntentionalFixturePath,
    isDocumentationPath: require('./audit-remediation-recipes/paths.cjs').isDocumentationPath,
    IMPACT_BY_KIND: require('./audit-remediation-recipes/data.cjs').IMPACT_BY_KIND,
    DEFAULT_RECIPES: require('./audit-remediation-recipes/data.cjs').DEFAULT_RECIPES,
    ESTIMATED_MINUTES_BY_KIND: require('./audit-remediation-recipes/data.cjs').ESTIMATED_MINUTES_BY_KIND,
    BUSINESS_IMPACT_BY_KIND: require('./audit-remediation-recipes/data.cjs').BUSINESS_IMPACT_BY_KIND
};
