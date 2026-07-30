/**
 * Optional Go AST sidecar — spawns simplebeacon_go_scan.py, merges into rawIssues shape.
 * Detects algorithmic redundancy in Go microservices.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { globMatch } = require('../rules/production-leak');
const { isExcludedPath, isUnderProductionPaths } = require('../rules/ai-runtime-scan-common');
const constants = require('./constants');

const SCRIPT_REL = path.join('python', 'simplebeacon_go_scan.py');
const SCAN_TIMEOUT_MS = 120000;

const GO_AST_RULE_CATALOG = [
    {
        id: 'SB-GO-FICTION-001',
        category: 'ai-fiction',
        type: 'AI Slop / Mock Leak',
        severity: 'medium',
        description: 'Hardcoded placeholder or mock-path string in Go source (AST)'
    },
    {
        id: 'SB-GO-FICTION-002',
        category: 'ai-fiction',
        type: 'Dead / Mock Function',
        severity: 'medium',
        description: 'Go function returns nil/zero immediately or panics — likely AI stub (AST)'
    },
    {
        id: 'SB-GO-TB-001',
        category: 'token-bleed',
        type: 'Token Bleed',
        severity: 'medium',
        description: 'Go LLM call without MaxTokens parameter (AST)'
    },
    {
        id: 'SB-GO-EU-001',
        category: 'eu-ai-act',
        type: 'EU AI Act — High-Risk Indicator',
        severity: 'high',
        description: 'Go identifier or string matches Annex III high-risk term (AST)'
    },
    {
        id: 'SB-GO-REDUNDANCY-001',
        category: 'algorithmic-redundancy',
        type: 'Duplicate Function Body',
        severity: 'medium',
        description: 'Multiple Go functions share identical bodies — possible copy-paste or AI generation'
    },
    {
        id: 'SB-GO-REDUNDANCY-002',
        category: 'algorithmic-redundancy',
        type: 'Identical Error Handlers',
        severity: 'low',
        description: 'Multiple if err != nil blocks share identical handler bodies — possible boilerplate'
    },
    {
        id: 'SB-GO-REDUNDANCY-003',
        category: 'algorithmic-redundancy',
        type: 'Deep Nesting / High Complexity',
        severity: 'medium',
        description: 'Go function with nesting depth >= 6 — consider refactoring with guard clauses'
    },
    {
        id: 'SB-GO-REDUNDANCY-004',
        category: 'algorithmic-redundancy',
        type: 'Deeply Nested If-Blocks',
        severity: 'medium',
        description: 'Go function with deeply nested if-blocks — extract guard clauses for early returns'
    }
];

const RECOMMENDATIONS = {
    'SB-GO-FICTION-001': 'Replace mock/sample strings with runtime config or test-scoped fixtures.',
    'SB-GO-FICTION-002': 'Implement the function or remove the AI-generated stub before merge.',
    'SB-GO-TB-001': 'Pass MaxTokens or max_tokens on LLM client calls.',
    'SB-GO-EU-001': 'Document Annex III classification, transparency, and human oversight for this flow.',
    'SB-GO-REDUNDANCY-001': 'Extract shared logic into a single function or use a Go generic to eliminate duplicate bodies.',
    'SB-GO-REDUNDANCY-002': 'Wrap repeated error handling in a helper function or use errors.Wrap from a shared package.',
    'SB-GO-REDUNDANCY-003': 'Refactor deeply nested logic using early returns, guard clauses, or helper functions to reduce cyclomatic complexity.',
    'SB-GO-REDUNDANCY-004': 'Extract guard clauses from deeply nested if-blocks using early returns to flatten the control flow.'
};

function resolvePackageRoot() {
    return path.resolve(__dirname, '..', '..');
}

function resolveAstScriptPath() {
    const candidate = path.join(resolvePackageRoot(), SCRIPT_REL);
    if (fs.existsSync(candidate)) return candidate;
    return null;
}

function resolvePythonExecutable() {
    const preferred = process.env.SIMPLEBEACON_PYTHON;
    if (preferred) return preferred;
    const candidates = process.platform === 'win32'
        ? ['py', 'python', 'python3']
        : ['python3', 'python'];
    for (const bin of candidates) {
        try {
            const probe = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: constants.TIMEOUT_5S });
            if (probe.status === 0) return bin;
        } catch {
            /* try next */
        }
    }
    return null;
}

function normalizeGoFinding(raw, projectRoot, severityDefault = 'medium') {
    const rel = String(raw.file || '').replace(/\\/g, '/');
    const pattern = raw.pattern || 'SB-GO-UNKNOWN';
    const severity = raw.severity || severityDefault;
    const line = raw.line ?? 1;
    const details = raw.details || raw.issue || 'Go AST finding';

    return {
        id: `go-ast-${pattern}-${rel}-${line}`,
        severity,
        severityBand: severity,
        type: raw.type || 'Go AST',
        category: raw.category || 'go-ast',
        filePath: rel,
        file: rel,
        line,
        pattern,
        count: 1,
        description: `${rel}:${line} — ${details}`,
        recommendation: RECOMMENDATIONS[pattern] || 'Review Go AST finding before merge.',
        recommendedAction: RECOMMENDATIONS[pattern] || 'Review Go AST finding before merge.',
        affectedFiles: [path.basename(rel)],
        metadata: {
            patternId: pattern,
            category: raw.category || 'go-ast',
            engine: 'go-ast',
            match: details.slice(0, 120)
        }
    };
}

function runGoAstScan(projectRoot, options = {}) {
    const scriptPath = resolveAstScriptPath();
    const pythonBin = resolvePythonExecutable();
    if (!scriptPath || !pythonBin) {
        return {
            ok: false,
            scanned: 0,
            findings: 0,
            issues: [],
            patterns: GO_AST_RULE_CATALOG.map((r) => r.id),
            error: !scriptPath
                ? 'Go AST script not found in simplebeacon-cli package'
                : 'Python executable not found (set SIMPLEBEACON_PYTHON)'
        };
    }

    const productionPaths = options.productionPaths || ['server/', 'src/', 'app/', 'cmd/', 'internal/'];
    const args = [
        scriptPath,
        '--root', path.resolve(projectRoot),
        '--production-paths', productionPaths.join(',')
    ];

    if (Array.isArray(options.files) && options.files.length) {
        args.push('--files', options.files.map((f) => path.resolve(f)).join(','));
    }

    const spawnArgs = pythonBin === 'py'
        ? ['-3', ...args]
        : args;

    const result = spawnSync(pythonBin, spawnArgs, {
        encoding: 'utf8',
        timeout: options.timeoutMs || SCAN_TIMEOUT_MS,
        maxBuffer: 16 * constants.BYTES_PER_KB * 1024
    });

    if (result.error || result.status !== 0) {
        const stderr = (result.stderr || '').trim();
        return {
            ok: false,
            scanned: 0,
            findings: 0,
            issues: [],
            patterns: GO_AST_RULE_CATALOG.map((r) => r.id),
            error: stderr || result.error?.message || `Go AST scan exited ${result.status}`
        };
    }

    let payload;
    try {
        payload = JSON.parse(result.stdout || '{}');
    } catch (error) {
        return {
            ok: false,
            scanned: 0,
            findings: 0,
            issues: [],
            patterns: GO_AST_RULE_CATALOG.map((r) => r.id),
            error: `Invalid JSON from Go AST scan: ${error.message}`
        };
    }

    const severityDefault = options.severity || 'medium';
    const issues = (payload.findings || []).map((raw) => normalizeGoFinding(raw, projectRoot, severityDefault));

    return {
        ok: true,
        scanned: payload.scanned ?? 0,
        filesVisited: payload.filesVisited ?? 0,
        findings: issues.length,
        issues,
        patterns: GO_AST_RULE_CATALOG.map((r) => r.id),
        errors: payload.errors || []
    };
}

async function scanGoAstPatterns(baseDir, options = {}) {
    const ignoreGlobs = options.ignoreGlobs || [];
    const result = runGoAstScan(baseDir, options);
    if (!result.ok) return result;

    const filtered = result.issues.filter((issue) => {
        const rel = issue.filePath || '';
        if (isExcludedPath(rel)) return false;
        if (ignoreGlobs.some((g) => globMatch(rel, g))) return false;
        if (!isUnderProductionPaths(rel, options.productionPaths || ['server/', 'src/', 'app/', 'cmd/', 'internal/'])) {
            return false;
        }
        return true;
    });

    return {
        ok: true,
        scanned: result.scanned,
        filesVisited: result.filesVisited,
        findings: filtered.length,
        issues: filtered,
        patterns: result.patterns,
        errors: result.errors
    };
}

module.exports = {
    scanGoAstPatterns,
    runGoAstScan,
    GO_AST_RULE_CATALOG
};
