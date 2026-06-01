/**
 * Fast single-buffer scan using existing rule engines (credentials, production leak,
 * fiction KPI, LLM slop). Used by MCP tools and proxy paths.
 */

const fs = require('fs');
const path = require('path');
const { scanTextContent } = require('./credential-pattern-scanner');
const { scanFileContent: scanProductionLeakContent } = require('../rules/production-leak');
const { buildPatternsFromBaseline, scanFileContent: scanFictionFileContent } = require('../rules/fiction-kpi-patterns');
const { scanTextPatterns, scanSuspiciousDependencies } = require('../rules/llm-slop-patterns');
const { scanTextPatterns: scanTokenBleedText } = require('../rules/token-bleed-patterns');
const { scanTextPatterns: scanArchitectureDriftText } = require('../rules/architecture-drift-patterns');
const { scanEnterpriseGuardrailContent } = require('../rules/enterprise-guardrail-patterns');
const { loadSimplebeaconConfig, isRuleEnabled, getRuleOptions, isIntelligenceEnabled, getIntelligenceOptions } = require('../config');
const { scanIntelligenceLayer } = require('./intelligence-bridge');
const { scanPythonAstSnippet } = require('./python-ast-scanner');
const { scanJavascriptAstSnippet } = require('./javascript-ast-scanner');
const { evaluateGate } = require('../gate');
const { isPathWithinRoot, resolveCliProjectRoot } = require('./path-utils');
const { sanitizeFilePath } = require('./input-sanitizer');

function fileExtension(filePath) {
    const ext = path.extname(String(filePath || '')).toLowerCase();
    return ext || '.txt';
}

function normalizeFinding(issue) {
    return {
        id: issue.id || null,
        severity: issue.severityBand || issue.severity || 'medium',
        type: issue.type || 'Finding',
        description: issue.description || '',
        filePath: issue.filePath || issue.file || null,
        line: issue.line ?? null,
        pattern: issue.pattern || issue.metadata?.patternId || issue.metadata?.ruleId || null,
        recommendedAction: issue.recommendedAction || issue.recommendation || null,
        match: issue.metadata?.match || null
    };
}

function loadProjectConfig(projectRoot) {
    try {
        return loadSimplebeaconConfig(projectRoot);
    } catch {
        return { baseline: {}, gate: { failOn: ['high'] } };
    }
}

function scanSnippetContent(content, options = {}) {
    if (typeof content !== 'string' || !content.length) {
        return { filePath: options.filePath || 'snippet.txt', findingCount: 0, blockingCount: 0, findings: [] };
    }

    const filePath = String(options.filePath || 'snippet.txt').replace(/\\/g, '/');
    const ext = fileExtension(filePath);
    const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : process.cwd();
    const config = loadProjectConfig(projectRoot);
    const fictionPatterns = buildPatternsFromBaseline(config.baseline || {});

    const findings = [];

    for (const hit of scanTextContent(path.basename(filePath), content, filePath)) {
        findings.push(normalizeFinding({
            ...hit,
            type: hit.type || 'Credential Pattern',
            filePath,
            severity: hit.severityBand || hit.severity
        }));
    }

    const leakResult = scanProductionLeakContent(filePath, content, {
        severityBand: 'high',
        intentClassification: options.intentClassification !== false
    });
    findings.push(...leakResult.findings.map(normalizeFinding));

    if (fictionPatterns.length) {
        findings.push(...scanFictionFileContent(filePath, content, fictionPatterns, ext).map(normalizeFinding));
    }

    findings.push(...scanTextPatterns(filePath, content, ext).map(normalizeFinding));

    if (path.basename(filePath) === 'package.json') {
        findings.push(...scanSuspiciousDependencies(filePath, content).map(normalizeFinding));
    }

    const productionPaths = config.productionPaths || ['server/', 'src/', 'app/', 'lib/'];
    if (isRuleEnabled(config, 'token-bleed-patterns')) {
        findings.push(...scanTokenBleedText(filePath, content, ext, {
            productionPathsOnly: true,
            productionPaths
        }).map(normalizeFinding));
    }
    if (isRuleEnabled(config, 'architecture-drift-patterns')) {
        findings.push(...scanArchitectureDriftText(filePath, content, ext, {
            productionPathsOnly: true,
            productionPaths
        }).map(normalizeFinding));
    }

    if (isRuleEnabled(config, 'enterprise-guardrail-patterns')) {
        const entOpts = getRuleOptions(config, 'enterprise-guardrail-patterns');
        findings.push(...scanEnterpriseGuardrailContent(filePath, content, {
            extraLeakTokens: entOpts.extraLeakTokens || []
        }).map(normalizeFinding));
    }

    if (isRuleEnabled(config, 'python-ast-patterns') && ext === '.py') {
        let absSnippet = options.absolutePath
            || (options.projectRoot ? path.resolve(projectRoot, filePath) : null);
        let tempSnippetPath = null;
        if (!absSnippet || !fs.existsSync(absSnippet)) {
            const snippetDir = path.join(projectRoot, '.simplebeacon', 'snippet-cache');
            fs.mkdirSync(snippetDir, { recursive: true });
            tempSnippetPath = path.join(snippetDir, `ast-${Date.now()}.py`);
            fs.writeFileSync(tempSnippetPath, content, 'utf8');
            absSnippet = tempSnippetPath;
        }
        try {
            const pyOpts = getRuleOptions(config, 'python-ast-patterns');
            const py = scanPythonAstSnippet(projectRoot, filePath, absSnippet, {
                productionPaths,
                severity: pyOpts.severity || 'medium',
                timeoutMs: pyOpts.timeoutMs
            });
            if (py.ok) {
                findings.push(...py.issues.map(normalizeFinding));
            }
        } finally {
            if (tempSnippetPath) {
                try {
                    fs.unlinkSync(tempSnippetPath);
                } catch {
                    /* ignore */
                }
            }
        }
    }

    if (isRuleEnabled(config, 'javascript-ast-patterns') && ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) {
        const jsOpts = getRuleOptions(config, 'javascript-ast-patterns');
        const js = scanJavascriptAstSnippet(projectRoot, filePath, content, {
            productionPaths,
            severity: jsOpts.severity || 'medium'
        });
        if (js.ok) {
            findings.push(...js.issues.map(normalizeFinding));
        }
    }

    let intelligenceConfig = getIntelligenceOptions(config);
    if (options.intelligence === true) {
        intelligenceConfig = { ...intelligenceConfig, enabled: true };
    } else if (options.intelligence && typeof options.intelligence === 'object') {
        intelligenceConfig = { ...intelligenceConfig, ...options.intelligence };
    }
    const intelligenceEnabled = intelligenceConfig.enabled === true;
    const intelligenceResult = scanIntelligenceLayer(content, {
        filePath,
        enabled: intelligenceEnabled,
        intelligence: intelligenceConfig
    });
    if (intelligenceResult.findings?.length) {
        findings.push(...intelligenceResult.findings.map(normalizeFinding));
    }

    const blockingCount = findings.filter(
        (f) => f.severity === 'high' || f.severity === 'critical'
    ).length;

    return {
        filePath,
        findingCount: findings.length,
        blockingCount,
        findings,
        intelligence: intelligenceEnabled ? {
            enabled: true,
            available: intelligenceResult.available !== false,
            engine: intelligenceResult.engine || null,
            findingCount: intelligenceResult.findingCount || 0
        } : { enabled: false }
    };
}

function scanFileOnDisk(projectRoot, relativeOrAbsolutePath, options = {}) {
    const root = resolveCliProjectRoot(projectRoot || process.cwd());
    const requested = sanitizeFilePath(relativeOrAbsolutePath);
    if (!requested) {
        throw new Error('Invalid file path');
    }

    const absolutePath = path.isAbsolute(requested)
        ? path.resolve(requested)
        : path.resolve(root, requested);

    if (!isPathWithinRoot(absolutePath, root)) {
        throw new Error('File path must stay within project root');
    }

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${relativeOrAbsolutePath}`);
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
        throw new Error('Path is not a file');
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const relativePath = path.relative(root, absolutePath).replace(/\\/g, '/');

    return scanSnippetContent(content, {
        ...options,
        projectRoot: root,
        filePath: relativePath
    });
}

function readGateStatus(projectRoot, options = {}) {
    const root = resolveCliProjectRoot(projectRoot || process.cwd());
    const reportPath = options.reportPath
        ? path.resolve(root, options.reportPath)
        : path.join(root, '.simplebeacon', 'report.json');

    if (!fs.existsSync(reportPath)) {
        return {
            ok: false,
            error: 'No report found — run: simplebeacon scan --format json --output .simplebeacon/report.json',
            reportPath: path.relative(root, reportPath).replace(/\\/g, '/')
        };
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const config = loadProjectConfig(root);
    const gate = evaluateGate(report, config.gate || {});

    const rawIssues = report.rawIssues || report.detectedIssues || [];
    const topBlocking = gate.blockingIssues.slice(0, options.limit || 12).map(normalizeFinding);

    return {
        ok: true,
        reportPath: path.relative(root, reportPath).replace(/\\/g, '/'),
        generatedAt: report.generatedAt || null,
        gatePass: gate.pass,
        issueGroups: report.issueCount ?? rawIssues.length,
        blockingCount: gate.blockingIssues.length,
        warningCount: gate.warningIssues.length,
        failOn: gate.failOn,
        topBlocking,
        hint: gate.pass
            ? 'Gate passed — no blocking severities in latest report.'
            : 'Fix blocking issues or tune allowlists in .simplebeacon/config.json'
    };
}

module.exports = {
    scanSnippetContent,
    scanFileOnDisk,
    readGateStatus,
    normalizeFinding
};
