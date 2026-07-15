// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Optional Python AST sidecar — spawns local simplebeacon_ast_scan.py, merges into rawIssues shape.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { globMatch } = require('../rules/production-leak');
const { isExcludedPath, isUnderProductionPaths } = require('../rules/ai-runtime-scan-common');
const constants = require('./constants');

const SCRIPT_REL = path.join('python', 'simplebeacon_ast_scan.py');
const SCAN_TIMEOUT_MS = 120000;

const PYTHON_AST_RULE_CATALOG = [
    {
        id: 'SB-PY-FICTION-001',
        category: 'ai-fiction',
        type: 'AI Slop / Mock Leak',
        severity: 'medium',
        description: 'Hardcoded placeholder or mock-path string in Python source (AST)'
    },
    {
        id: 'SB-PY-FICTION-002',
        category: 'ai-fiction',
        type: 'Dead / Mock Function',
        severity: 'medium',
        description: 'Python function returns None immediately — likely AI stub (AST)'
    },
    {
        id: 'SB-PY-TB-001',
        category: 'token-bleed',
        type: 'Token Bleed',
        severity: 'medium',
        description: 'Python LLM call without max_tokens / max_completion_tokens (AST)'
    },
    {
        id: 'SB-PY-EU-001',
        category: 'eu-ai-act',
        type: 'EU AI Act — High-Risk Indicator',
        severity: 'high',
        description: 'Python identifier or string matches Annex III high-risk term (AST)'
    }
];

const RECOMMENDATIONS = {
    'SB-PY-FICTION-001': 'Replace mock/sample strings with runtime config or test-scoped fixtures.',
    'SB-PY-FICTION-002': 'Implement the function or remove the AI-generated stub before merge.',
    'SB-PY-TB-001': 'Pass max_tokens or max_completion_tokens on LLM client calls.',
    'SB-PY-EU-001': 'Document Annex III classification, transparency, and human oversight for this flow.'
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

function normalizePythonFinding(raw, projectRoot, severityDefault = 'medium') {
    const rel = String(raw.file || '').replace(/\\/g, '/');
    const pattern = raw.pattern || 'SB-PY-UNKNOWN';
    const severity = raw.severity || severityDefault;
    const line = raw.line ?? 1;
    const details = raw.details || raw.issue || 'Python AST finding';

    return {
        id: `python-ast-${pattern}-${rel}-${line}`,
        severity,
        severityBand: severity,
        type: raw.type || 'Python AST',
        category: raw.category || 'python-ast',
        filePath: rel,
        file: rel,
        line,
        pattern,
        count: 1,
        description: `${rel}:${line} — ${details}`,
        recommendation: RECOMMENDATIONS[pattern] || 'Review Python AST finding before merge.',
        recommendedAction: RECOMMENDATIONS[pattern] || 'Review Python AST finding before merge.',
        affectedFiles: [path.basename(rel)],
        metadata: {
            patternId: pattern,
            category: raw.category || 'python-ast',
            engine: 'python-ast',
            match: details.slice(0, 120)
        }
    };
}

function runPythonAstScan(projectRoot, options = {}) {
    const scriptPath = resolveAstScriptPath();
    const pythonBin = resolvePythonExecutable();
    if (!scriptPath || !pythonBin) {
        return {
            ok: false,
            scanned: 0,
            findings: 0,
            issues: [],
            patterns: PYTHON_AST_RULE_CATALOG.map((r) => r.id),
            error: !scriptPath
                ? 'Python AST script not found in simplebeacon-cli package'
                : 'Python executable not found (set SIMPLEBEACON_PYTHON)'
        };
    }

    const productionPaths = options.productionPaths || ['server/', 'src/', 'app/', 'lib/'];
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
            patterns: PYTHON_AST_RULE_CATALOG.map((r) => r.id),
            error: stderr || result.error?.message || `Python AST scan exited ${result.status}`
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
            patterns: PYTHON_AST_RULE_CATALOG.map((r) => r.id),
            error: `Invalid JSON from Python AST scan: ${error.message}`
        };
    }

    const severityDefault = options.severity || 'medium';
    const issues = (payload.findings || []).map((raw) => normalizePythonFinding(raw, projectRoot, severityDefault));

    return {
        ok: true,
        scanned: payload.scanned ?? 0,
        filesVisited: payload.filesVisited ?? 0,
        findings: issues.length,
        issues,
        patterns: PYTHON_AST_RULE_CATALOG.map((r) => r.id),
        errors: payload.errors || []
    };
}

async function scanPythonAstPatterns(baseDir, options = {}) {
    const ignoreGlobs = options.ignoreGlobs || [];
    const result = runPythonAstScan(baseDir, options);
    if (!result.ok) return result;

    const filtered = result.issues.filter((issue) => {
        const rel = issue.filePath || '';
        if (isExcludedPath(rel)) return false;
        if (ignoreGlobs.some((g) => globMatch(rel, g))) return false;
        if (!isUnderProductionPaths(rel, options.productionPaths || ['server/', 'src/', 'app/', 'lib/'])) {
            return false;
        }
        return true;
    });

    return {
        ...result,
        issues: filtered,
        findings: filtered.length
    };
}

function scanPythonAstSnippet(projectRoot, relativePath, absolutePath, options = {}) {
    if (!relativePath.endsWith('.py')) {
        return { ok: true, findings: 0, issues: [] };
    }
    if (isExcludedPath(relativePath)) {
        return { ok: true, findings: 0, issues: [] };
    }
    if (!isUnderProductionPaths(relativePath, options.productionPaths || ['server/', 'src/', 'app/', 'lib/'])) {
        return { ok: true, findings: 0, issues: [] };
    }
    return runPythonAstScan(projectRoot, {
        ...options,
        files: [absolutePath]
    });
}

module.exports = {
    PYTHON_AST_RULE_CATALOG,
    runPythonAstScan,
    scanPythonAstPatterns,
    scanPythonAstSnippet,
    resolvePythonExecutable,
    resolveAstScriptPath
};
