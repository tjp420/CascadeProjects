/**
 * Simple code suggestions — short, actionable hints from gate findings and trim analysis.
 * Deterministic: pattern catalog + AST remediator dry-run, no LLM inference.
 */

const { explainFinding, RULE_CATALOG } = require('../mcp/rule-catalog');
const { remediateFinding, getSupportedPatterns } = require('./ast-remediator');

const AUTO_FIX_PATTERNS = new Set(getSupportedPatterns());

const CATEGORY_TITLES = {
    'llm-slop': 'Remove AI placeholder',
    'production-leak': 'Fix production data path',
    'credentials': 'Remove hardcoded secret',
    'fiction-kpi': 'Replace fiction metric',
    'dead-code': 'Trim unused export',
    'hygiene': 'Fix hygiene issue'
};

const SIMPLE_CODE_HINTS = {
    'sample-json': {
        before: "import metrics from './data/kpi-sample.json'",
        after: "const metrics = await loadMetricsFromApi()"
    },
    'web-data-sample': {
        before: "require('../web/data/foo-sample.json')",
        after: "await fetchProductionConfig('foo')"
    },
    'mock-path': {
        before: "path.join(__dirname, 'mock/users.json')",
        after: "path.join(__dirname, '__tests__/fixtures/users.json')"
    },
    'dead-export': {
        before: 'export function unusedHelper() { ... }',
        after: 'function unusedHelper() { ... }  // or delete if unreachable'
    },
    'orphaned-export': {
        before: 'export const internalOnly = 1',
        after: 'const internalOnly = 1  // used locally only'
    },
    'SB-FICTION-001': {
        before: '// TODO: Handle this later',
        after: '// Implement auth redirect (ticket SB-123)'
    },
    'SB-FICTION-002': {
        before: '```javascript\nconst x = 1;\n```',
        after: 'const x = 1;  // remove markdown fences from source'
    },
    'SB-JS-TB-001': {
        before: 'openai.chat.completions.create({ model, messages })',
        after: 'openai.chat.completions.create({ model, messages, max_tokens: 4096 })'
    },
    'SB-PY-TB-001': {
        before: 'client.chat.completions.create(model="gpt-4", messages=[...])',
        after: 'client.chat.completions.create(model="gpt-4", messages=[...], max_tokens=4096)'
    }
};

function normalizeSeverity(value) {
    return String(value || 'medium').toLowerCase();
}

function effortFromSeverity(severity) {
    if (severity === 'critical' || severity === 'high') return 'medium';
    if (severity === 'low') return 'easy';
    return 'easy';
}

function dedupeIssues(issues = []) {
    const seen = new Set();
    const out = [];
    for (const issue of issues) {
        if (!issue || typeof issue !== 'object') continue;
        const file = issue.filePath || issue.file || issue.path || '';
        const pattern = issue.pattern || issue.rule || issue.id || issue.type || '';
        const line = issue.line || '';
        const key = `${pattern}|${file}|${line}|${String(issue.description || issue.message || '').slice(0, 80)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(issue);
    }
    return out;
}

function collectReportIssues(report) {
    if (!report || typeof report !== 'object') return [];
    const buckets = [
        report.rawIssues,
        report.detectedIssues,
        report.issues,
        report.findings
    ];
    const fromGate = [];
    for (const entry of report.gate?.blockingIssues || []) {
        fromGate.push({ ...entry, severity: entry.severity || 'high' });
    }
    for (const entry of report.gate?.warningIssues || []) {
        fromGate.push({ ...entry, severity: entry.severity || 'medium' });
    }
    const merged = [];
    for (const bucket of buckets) {
        if (Array.isArray(bucket)) merged.push(...bucket);
    }
    merged.push(...fromGate);
    return dedupeIssues(merged);
}

function lookupLlmSuggestion(patternId) {
    const rule = RULE_CATALOG.find((r) => r.id === patternId);
    return rule?.suggestion || rule?.message || null;
}

function buildTitle(issue, explained, patternId) {
    const category = explained.found ? explained.category : null;
    if (category && CATEGORY_TITLES[category]) return CATEGORY_TITLES[category];
    const type = String(issue.type || '').replace(/-/g, ' ');
    if (type) return type.charAt(0).toUpperCase() + type.slice(1);
    if (patternId) return `Fix ${patternId}`;
    return 'Review finding';
}

function buildSuggestionFromIssue(issue, priority) {
    const patternId = String(issue.pattern || issue.rule || issue.id || '').trim() || null;
    const explained = patternId ? explainFinding(patternId, { type: issue.type }) : { found: false };
    const severity = normalizeSeverity(issue.severity || issue.severityBand);
    const filePath = issue.filePath || issue.file || issue.path || null;
    const line = issue.line || issue.metadata?.line || null;

    let codeHint = patternId && SIMPLE_CODE_HINTS[patternId]
        ? { ...SIMPLE_CODE_HINTS[patternId] }
        : (issue.type && SIMPLE_CODE_HINTS[issue.type] ? { ...SIMPLE_CODE_HINTS[issue.type] } : null);

    let autoFixable = patternId ? AUTO_FIX_PATTERNS.has(patternId) : false;
    let replacePreview = null;

    if (autoFixable && filePath) {
        const fix = remediateFinding({
            pattern: patternId,
            filePath,
            line,
            type: issue.type,
            metadata: issue.metadata
        }, { dryRun: true });
        if (fix.search && fix.replace) {
            codeHint = { before: fix.search.trim(), after: fix.replace.trim() };
            replacePreview = fix.replace.trim();
        } else {
            autoFixable = false;
        }
    }

    const suggestion = issue.fix
        || issue.recommendedAction
        || issue.recommendation
        || issue.remediation
        || lookupLlmSuggestion(patternId)
        || (explained.found ? explained.tuning : null)
        || issue.description
        || issue.message
        || 'Review manually and re-run gate scan';

    return {
        priority,
        severity,
        effort: autoFixable ? 'easy' : effortFromSeverity(severity),
        category: explained.found ? explained.category : (issue.type || 'hygiene'),
        patternId,
        filePath,
        line,
        title: buildTitle(issue, explained, patternId),
        suggestion: String(suggestion).trim(),
        codeHint,
        autoFixable,
        replacePreview,
        proposeFix: autoFixable && patternId
            ? { tool: 'propose_fix', patternId, filePath, line }
            : (patternId ? { tool: 'explain_finding', patternId } : null)
    };
}

function buildTrimCodeSuggestions(trim) {
    if (!trim || !Array.isArray(trim.topActions)) return [];
    return trim.topActions
        .filter((action) => action.codeChange === true)
        .map((action, idx) => ({
            priority: idx + 1,
            severity: 'low',
            effort: 'easy',
            category: 'dead-code',
            patternId: action.phase === 'removeDeadExport' ? 'dead-export' : 'orphaned-export',
            filePath: action.path,
            line: null,
            symbol: action.symbol || null,
            title: action.phase === 'removeDeadExport' ? 'Remove dead export' : 'Drop unnecessary export',
            suggestion: action.reason || 'Symbol is not imported elsewhere — remove export or delete symbol',
            codeHint: action.symbol
                ? {
                    before: `export ${action.symbol}`,
                    after: action.phase === 'removeDeadExport'
                        ? `// delete ${action.symbol} or remove export keyword`
                        : `const ${action.symbol}  // internal use only`
                }
                : SIMPLE_CODE_HINTS['dead-export'],
            autoFixable: false,
            replacePreview: null,
            proposeFix: null,
            source: 'trim-analysis'
        }));
}

/**
 * Build prioritized simple code suggestions from a gate or cleanup report.
 * @param {object} report
 * @param {object} [options]
 * @returns {object}
 */
function buildCodeSuggestions(report, options = {}) {
    const maxSuggestions = options.maxSuggestions ?? 20;
    const issues = collectReportIssues(report)
        .filter((issue) => {
            const sev = normalizeSeverity(issue.severity || issue.severityBand);
            return sev === 'critical' || sev === 'high' || sev === 'medium';
        })
        .sort((a, b) => {
            const rank = { critical: 4, high: 3, medium: 2, low: 1 };
            return (rank[normalizeSeverity(b.severity)] || 0) - (rank[normalizeSeverity(a.severity)] || 0);
        });

    const gateSuggestions = issues.map((issue, idx) => buildSuggestionFromIssue(issue, idx + 1));
    const trim = report.trimSuggestions || report.fileReductionPlan?.trimSuggestions;
    const trimSuggestions = buildTrimCodeSuggestions(trim);

    const merged = [...gateSuggestions, ...trimSuggestions]
        .slice(0, maxSuggestions)
        .map((entry, idx) => ({ ...entry, priority: idx + 1 }));

    const quickWins = merged.filter((s) => s.effort === 'easy' || s.autoFixable).slice(0, 6);
    const autoFixCount = merged.filter((s) => s.autoFixable).length;

    return {
        schemaVersion: '1.0',
        generatedAt: report.generatedAt || new Date().toISOString(),
        methodology: 'Deterministic pattern catalog + AST remediator hints — no LLM inference',
        totalCandidates: issues.length + trimSuggestions.length,
        autoFixCount,
        quickWinCount: quickWins.length,
        suggestions: merged,
        quickWins,
        agentPrompt: buildCodeSuggestionsAgentPrompt(merged, quickWins, autoFixCount)
    };
}

function buildCodeSuggestionsAgentPrompt(suggestions, quickWins, autoFixCount) {
    const lines = [
        'Apply simple code suggestions one file at a time. Run tests after each batch.',
        '',
        `Quick wins: ${quickWins.length} · Auto-fixable (propose_fix): ${autoFixCount}`,
        '',
        'Order: critical/high gate blockers → auto-fixable patterns → dead export trims.',
        ''
    ];
    if (quickWins.length) {
        lines.push('Start here:');
        for (const item of quickWins.slice(0, 5)) {
            const loc = item.filePath ? `${item.filePath}${item.line ? `:${item.line}` : ''}` : '—';
            lines.push(`- [${item.severity}] ${item.title} @ ${loc}`);
            lines.push(`  ${item.suggestion}`);
            if (item.autoFixable && item.patternId) {
                lines.push(`  → propose_fix patternId=${item.patternId}`);
            }
        }
        lines.push('');
    }
    lines.push('Verify: `npx simplebeacon scan --gate` then gate_status.');
    return lines.join('\n');
}

function formatCodeSuggestionsMarkdown(payload) {
    if (!payload || typeof payload !== 'object') return '';
    const lines = [
        '# SimpleBeacon code suggestions',
        '',
        payload.methodology || '',
        '',
        `- **Candidates:** ${payload.totalCandidates ?? '—'}`,
        `- **Listed:** ${(payload.suggestions || []).length}`,
        `- **Quick wins:** ${payload.quickWinCount ?? 0}`,
        `- **Auto-fixable:** ${payload.autoFixCount ?? 0}`,
        ''
    ];

    for (const item of payload.suggestions || []) {
        const loc = item.filePath
            ? `\`${item.filePath}\`${item.line ? `:${item.line}` : ''}${item.symbol ? ` → \`${item.symbol}\`` : ''}`
            : '—';
        lines.push(`## ${item.priority}. ${item.title}`);
        lines.push('');
        lines.push(`- **Severity:** ${item.severity} · **Effort:** ${item.effort}`);
        lines.push(`- **Location:** ${loc}`);
        if (item.patternId) lines.push(`- **Pattern:** \`${item.patternId}\``);
        lines.push(`- **Suggestion:** ${item.suggestion}`);
        if (item.codeHint?.before && item.codeHint?.after) {
            lines.push('');
            lines.push('```diff');
            lines.push(`- ${item.codeHint.before}`);
            lines.push(`+ ${item.codeHint.after}`);
            lines.push('```');
        }
        if (item.autoFixable) {
            lines.push('');
            lines.push(`> Auto-fix: \`propose_fix\` with pattern \`${item.patternId}\``);
        }
        lines.push('');
    }

    if (payload.agentPrompt) {
        lines.push('## Agent prompt');
        lines.push('');
        lines.push(payload.agentPrompt);
        lines.push('');
    }
    return lines.join('\n');
}

function attachCodeSuggestions(report, options = {}) {
    if (!report || typeof report !== 'object') return report;
    if (report.error || report.type === 'data-cleanup-report') {
        report.codeSuggestions = buildCodeSuggestions(report, options);
        return report;
    }
    if (report.type && report.type !== 'simplebeacon-report') {
        return report;
    }
    report.codeSuggestions = buildCodeSuggestions(report, options);
    return report;
}

function writeCodeSuggestionArtifacts(projectRoot, report, options = {}) {
    const fs = require('fs');
    const path = require('path');
    if (!projectRoot || !report) return null;
    const root = path.resolve(projectRoot);
    const payload = report.codeSuggestions || buildCodeSuggestions(report, options);
    const dir = path.join(root, '.simplebeacon');
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch {
        return null;
    }
    const jsonPath = path.join(dir, 'code-suggestions.json');
    const mdPath = path.join(dir, 'code-suggestions.md');
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(mdPath, formatCodeSuggestionsMarkdown(payload), 'utf8');
    return { jsonPath, mdPath, payload };
}

module.exports = {
    buildCodeSuggestions,
    formatCodeSuggestionsMarkdown,
    attachCodeSuggestions,
    writeCodeSuggestionArtifacts,
    buildCodeSuggestionsAgentPrompt,
    collectReportIssues
};
