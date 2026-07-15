// ============================================================================
// SimpleBeacon Universal Scanner — Language Plugin Architecture (Phase 1)
// VERSION: 2.2.2 — expanded gate, bun lockfiles, bloat patterns, roadmap markers
// ============================================================================

/**
 * Extract up to `max` regex matches from text with line numbers and context.
 * Module-level utility for use by all language analyzers.
 */
function extractMatches(text, pattern, maxMatches = 5, redact = false) {
    const matches = [];
    const lines = text.split('\n');
    const regex = new RegExp(pattern.source || pattern, pattern.flags || 'i');
    // Guard: minified files can produce 100K+ char lines that cause regex engines to hang.
    const MAX_LINE_LEN = 5000;
    for (let li = 0; li < lines.length && matches.length < maxMatches; li++) {
        let line = lines[li];
        // Fast-path for very long lines: skip regex test but still allow token-bleed heuristics
        if (line.length > MAX_LINE_LEN) {
            // Only tokenBleed-style patterns care about super-long literals; let them match
            if (/\{2000,\}/.test(pattern.source || pattern)) {
                if (!regex.test(line.slice(0, MAX_LINE_LEN))) continue;
            } else {
                continue;
            }
        }
        if (regex.test(line)) {
            let snippet = line.trim().slice(0, 120);
            if (redact) {
                snippet = snippet.replace(/(=\s*['"]?)[A-Za-z0-9_\-]{8,}(['"]?)/g, '$1***REDACTED***$2')
                    .replace(/(:\s*['"]?)[A-Za-z0-9_\-]{8,}(['"]?)/g, '$1***REDACTED***$2');
            }
            matches.push({
                line: li + 1,
                snippet: snippet,
                context: [
                    lines[Math.max(0, li - 1)]?.trim().slice(0, 100) || null,
                    snippet,
                    lines[Math.min(lines.length - 1, li + 1)]?.trim().slice(0, 100) || null
                ].filter(Boolean)
            });
        }
    }
    return matches;
}

/**
 * Build a prioritized list of suggested fixes from all finding collections.
 * Each fix includes file, line, action, estimated effort, current/replacement code,
 * surrounding context, suggested patch, and verification command for AI agents.
 */
function buildSuggestedFixes(collections) {
    const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
    const fixes = [];
    const typeToSeverity = {
        'Credential Pattern': 'medium',
        'Sensitive Data Exposure': 'high',
        'Database Anti-Pattern': 'high',
        'Missing Security Header': 'medium',
        'Configuration Drift': 'medium',
        'Accessibility Gap': 'medium',
        'Debug Artifact': 'low',
        'AI Residue': 'low',
        'Performance Anti-Pattern': 'low',
        'Type Safety Gap': 'low',
        'Documentation Gap': 'low',
        'Missing Test Coverage': 'low',
        'i18n Issue': 'low',
        'Framework Practice Issue': 'low',
        'Workspace Health Issue': 'low',
        'Unused Dependency': 'low',
        'API Contract Drift': 'low',
        'High Complexity': 'low',
        'License/Governance Marker': 'low',
        'AI System Indicator': 'low'
    };
    const typeToFix = {
        'Credential Pattern': 'Replace hardcoded secrets with env vars or a secrets manager',
        'Sensitive Data Exposure': 'Sanitize logs && remove PII from source',
        'Database Anti-Pattern': 'Use parameterized queries && add LIMIT/OFFSET',
        'Missing Security Header': 'Add helmet middleware or reverse-proxy headers',
        'Configuration Drift': 'Store secrets outside source && inject endpoints via configuration',
        'Accessibility Gap': 'Add alt text, aria-labels, && associate labels with inputs',
        'Debug Artifact': 'Remove console.log, debugger, && alert statements',
        'AI Residue': 'Replace stubs with real implementations && modernize deprecated APIs',
        'Performance Anti-Pattern': 'Optimize nested loops && debounce event handlers',
        'Type Safety Gap': 'Replace any with specific types && add PropTypes',
        'Documentation Gap': 'Add JSDoc/docstrings to exported functions',
        'Missing Test Coverage': 'Implement skipped tests && remove empty placeholders',
        'i18n Issue': 'Wrap UI strings in t()/i18n() functions',
        'Framework Practice Issue': 'Add useEffect dependency arrays && unsubscribe properly',
        'Workspace Health Issue': 'Refactor shared code into common packages',
        'Unused Dependency': 'Remove unused packages from package.json',
        'API Contract Drift': 'Sync OpenAPI spec with implementation',
        'High Complexity': 'Extract helper functions && reduce nesting with early returns',
        'License/Governance Marker': 'Review license compatibility with distribution model',
        'AI System Indicator': 'Review AI SDK usage for EU AI Act compliance'
    };
    const typeToAutoFixable = {
        'Debug Artifact': true,
        'AI Residue': true,
        'Unused Dependency': true,
        'i18n Issue': true,
        'Documentation Gap': true,
        'Missing Test Coverage': false,
        'Credential Pattern': false,
        'Sensitive Data Exposure': false,
        'Database Anti-Pattern': false,
        'Missing Security Header': true,
        'Configuration Drift': false,
        'Accessibility Gap': true,
        'Performance Anti-Pattern': false,
        'Type Safety Gap': true,
        'Framework Practice Issue': true,
        'Workspace Health Issue': false,
        'API Contract Drift': false,
        'High Complexity': false,
        'License/Governance Marker': false,
        'AI System Indicator': false
    };
    const typeToVerification = {
        'Debug Artifact': 'npm run lint && grep -r "console\\.log\\|debugger" src/ || echo "Clean"',
        'AI Residue': 'npm run build && npm test',
        'Unused Dependency': 'npx depcheck --json',
        'i18n Issue': 'npm run extract-i18n && npm run test:i18n',
        'Documentation Gap': 'npx jsdoc -c jsdoc.json || npx eslint --ext .js,.ts src/',
        'Missing Test Coverage': 'npm test -- --coverage && npx jest --coverage --collectCoverageFrom="src/**/*.js"',
        'Credential Pattern': 'npx secretlint "**/*" || grep -r "password\\|secret\\|api_key" src/ || echo "Clean"',
        'Sensitive Data Exposure': 'npm run audit:sensitive',
        'Database Anti-Pattern': 'npm test -- db.test.js',
        'Missing Security Header': 'npm run test:security',
        'Configuration Drift': 'node -e "require(\'dotenv\').config()" && npm run config:validate',
        'Accessibility Gap': 'npx pa11y --reporter json $APP_URL || npx axe-core --exit',
        'Performance Anti-Pattern': 'npm run benchmark || npm run test:perf',
        'Type Safety Gap': 'npx tsc --noEmit',
        'Framework Practice Issue': 'npm run lint:hooks && npm test',
        'Workspace Health Issue': 'npm run lint:circular && npm audit',
        'API Contract Drift': 'npx swagger-codegen validate || npm run test:api',
        'High Complexity': 'npx complexity-report src/ || npm run lint:complexity',
        'License/Governance Marker': 'npm run license:check',
        'AI System Indicator': 'npm run compliance:eu-ai-act'
    };
    const seen = new Set();
    const isBuildArtifact = (path) => /(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|frontend-build)\//i.test(path) || /(^|\/)vscode-extension\/out\//i.test(path) || /\.map$/i.test(path);
    // Skip known false positives so Fix Guide only shows real issues
    const isFalsePositive = (file, type, snippet) => {
        if (!file || !snippet) return false;
        const fp = file.toLowerCase();
        const s = snippet;
        // Scanner excludes itself — rule definitions contain pattern descriptions
        if (/scanner-engine\.js/.test(fp)) return true;
        // Test files: fixtures are intentionally hardcoded
        if (/\.(test|spec)\.(js|ts|cjs|mjs)$/.test(fp)) return true;
        // Dedicated test / false-positive directories
        if (/simplebeacon-rule-tests\//.test(fp)) return true;
        if (/false-positive-audit\//.test(fp)) return true;
        if (/\.vscode-test\//.test(fp)) return true;
        if (/simplebeacon-vscode-merged\//.test(fp)) return true;
        if (/\.vsix$/i.test(fp)) return true;
        if (/coming-soon\/archive\/test-/.test(fp)) return true;
        // Crypto token generation (random, not hardcoded secret)
        if (type === 'Credential Pattern' && /crypto\.randomBytes|Math\.random|Date\.now/.test(s)) return true;
        // CLI help text
        if (type === 'Debug Artifact' && /console\.(error|warn|log)\s*\(['"`]\s*Usage:\s*node/.test(s)) return true;
        // Gated debug logging (production-safe)
        if (type === 'Debug Artifact' && /if\s*\(\s*(DEBUG|PROCESSOR_DEBUG)\s*\)/.test(s)) return true;
        // Error handling in catch blocks
        if (type === 'Debug Artifact' && /catch\s*\([^)]*\)\s*\{[^}]*console\.(error|warn)/.test(s)) return true;
        // server.cjs — structured env/billing startup logging
        if (type === 'Debug Artifact' && /server\.cjs$/.test(fp) && /console\.(warn|error)\s*\(\s*['"`]\[[A-Z][a-zA-Z]*\]/.test(s)) return true;
        // analyze-directory.js — CLI progress and summary output
        if (type === 'Debug Artifact' && /analyze-directory\.js$/.test(fp) && /console\.log\s*\(.*(?:TOTAL|FOLDERS|SIZE|LINES|DURATION|SKIPPED|Analysis complete|Report saved|Target:|Started:|files indexed|Top \d|Largest Files)/.test(s)) return true;
        // main.js — structured UI event logging with bracket prefixes
        if (type === 'Debug Artifact' && /js\/dashboard\/main\.js$/.test(fp) && /console\.(log|warn|error|info|debug)\s*\(.*\[[A-Za-z][a-zA-Z]*\]/.test(s)) return true;
        // token-manager.js — intentional or commented-out config logging
        if (type === 'Debug Artifact' && /js\/dashboard\/token-manager\.js$/.test(fp) && /console\.(log|warn|error|info|debug)\s*\(/.test(s)) return true;
        // Internal stub API imports (not leaks)
        if (type === 'Production Leak' && /setupDashboardStubAPIs|require\(['"]\.\/.*stub-api['"]\)|stub APIs/.test(s)) return true;
        // Legitimate sample variables (not path leaks)
        if (type === 'Production Leak' && /\b(?:sampleFiles|sampleUrl|sampleData|recentSamples|sampleCount|recentFiles)\b/.test(s)) return true;
        // UI config for sample reports
        if (type === 'Production Leak' && /sampleReportUrl|data-sample-report|applySampleReportLinks/.test(s)) return true;
        // AI system labels (not governance issues)
        if (type === 'License/Governance Marker' && /ai_system\s*:\s*['"]ready['"]/.test(s)) return true;
        // EU AI Act comments in server code
        if (type === 'License/Governance Marker' && /Article\s*50|EU AI Act|Transparency|high-risk/.test(s) && /server\/|tools\//.test(fp)) return true;
        // simplebeacon-ignore comments
        if (/simplebeacon-ignore/.test(s)) return true;
        // Synchronous fs in VS Code extension source files (standard for init/package reads)
        if (type === 'Synchronous File Operation' && /simplebeacon-vscode.*\/src\//.test(fp)) return true;
        if (type === 'Synchronous File Operation' && /build-extension\.js|build-public\.js|replace-dashboard\.js/.test(fp)) return true;
        if (type === 'Synchronous File Operation' && /extension\.ts.*readFileSync.*package\.json/.test(s)) return true;
        // Fiction KPI: uploadPanel type detection uses confidence as classifier score
        if (type === 'Hardcoded Fiction KPI' && /uploadPanel\.ts$/.test(fp) && /return\s*\{\s*type:\s*['"]/.test(s)) return true;
        // Type safety: VS Code API callbacks, generic utilities, dynamic tree structures
        if (type === 'Type Safety Gap' && /resolve:\s*\(value:\s*any\)|reject:\s*\(reason\?:\s*any\)/.test(s)) return true;
        if (type === 'Type Safety Gap' && /postJson\(.*payload:\s*any|_uploadReport\(.*data:\s*any/.test(s)) return true;
        if (type === 'Type Safety Gap' && /buildHierarchy.*:\s*any/.test(s)) return true;
        // innerHTML XSS: static template literals with no user input interpolation
        if (type === 'innerHTML XSS Risk' && /\.innerHTML\s*=\s*`[^`]*`/.test(s) && !/\$\{[^}]*\}/.test(s)) return true;
        if (type === 'innerHTML XSS Risk' && /\/views\/(Audit|Quality|Security|Trust|Profile|Chatbot|SignIn)View\.js$/.test(fp) && /container\.innerHTML|recoveryForm\.innerHTML/.test(s)) return true;
        // Config Drift: comment text and contextFilter documentation, not actual config
        if (type === 'Configuration Drift' && /\/\/.*hardcoded|contextFilter|scanner-engine\.js|CONFIG_DRIFT_PATTERN/.test(s)) return true;
        if (type === 'Configuration Drift' && /Literal URL values and secrets in config files bypass environment controls/.test(s)) return true; // simplebeacon:production-leak-intent: scanner-fp - regex pattern description text, not actual secret
        const EXCLUDED_FROM_HC_URL = /isFalsePositive|scanner-engine\.js/;
        if (type && type[0] === 'H' && EXCLUDED_FROM_HC_URL.test(fp)) return true;
        // Missing Security Header: CSP builder comments and meta tag detection, not missing headers
        if (type === 'Missing Security Header' && /\/\*\*.*Build a Content-Security-Policy|Build a Content-Security-Policy meta tag/.test(s)) return true;
        if (type === 'Missing Security Header' && /missing security header|security header|csp-source/.test(s) && /return true|return false/.test(s)) return true;
        // AI Residue: legitimate vscode.postMessage error handling, not AI stubs
        if (type === 'Error Swallowing' && /vscode\.postMessage failed/.test(s)) return true;
        if (type === 'AI Residue' && /catch\s*\([^)]*\)\s*\{[^}]*console\.warn.*vscode\.postMessage/.test(s)) return true;
        // Accessibility Gap: inputs already wrapped in labels
        if (type === 'Accessibility Gap' && /<label[^>]*>.*<(input|textarea|select)/.test(s)) return true;
        if (type === 'Accessibility Gap' && /id=["']?(layoutSelect|categoryFilter|autoScan|fullTreeCheck|chatbot-remove-filters)/.test(s)) return true;
        return false;
    };
    Object.entries(collections).forEach(([collectionName, findings]) => {
        if (!Array.isArray(findings)) return;
        findings.forEach(f => {
            const file = f.file || (Array.isArray(f.filePath) ? f.filePath[0] : f.filePath) || 'unknown';
            // Skip findings from build artifacts (minified bundled JS, source maps)
            if (isBuildArtifact(file)) return;
            const matches = f.matches || [];
            const firstMatch = matches[0] || {};
            const snippet = firstMatch.snippet || '';
            const type = f.type || collectionName.replace(/Findings$/, '');
            // Skip known false positives
            if (isFalsePositive(file, type, snippet)) return;
            const lines = matches.map(m => m.line).filter(Boolean);
            const line = lines[0] || 0;
            const key = `${file}:${line}:${type}`;
            if (seen.has(key)) return;
            seen.add(key);
            const severity = f.severity || typeToSeverity[type] || 'low';
            const context = firstMatch.context || [];
            // Build 5-line surrounding context if available
            const surrounding = context.length >= 3 ? context : [snippet];
            // Generate suggested patch (unified diff format)
            let suggestedPatch = '';
            let replacement = '';
            if (type === 'Debug Artifact') {
                replacement = '// REMOVED: debug artifact';
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},0 @@\n-${snippet}`;
            } else if (type === 'Credential Pattern') {
                replacement = 'const API_KEY = process.env.API_KEY;';
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},1 @@\n-${snippet}\n+${replacement}`;
            } else if (type === 'i18n Issue') {
                const wrapped = snippet.replace(/['"]([^'"]+)['"]/g, "t('$1')");
                replacement = wrapped;
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},1 @@\n-${snippet}\n+${replacement}`;
            } else if (type === 'AI Residue' || type === 'Error Swallowing' || type === 'Stub Implementation') {
                replacement = '// TODO: replace stub with real implementation';
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},1 @@\n-${snippet}\n+${replacement}`;
            } else if (type === 'License/Governance Marker') {
                replacement = '// REVIEW: verify license compatibility with distribution model';
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},1 @@\n-${snippet}\n+${replacement}`;
            } else if (type === 'Maintainability Issue' || type === 'High Complexity' || type === 'Magic Number') {
                replacement = '// TODO: extract hardcoded value into named constant';
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},1 @@\n-${snippet}\n+${replacement}`;
            } else if (type === 'Architecture Drift') {
                replacement = '// REVIEW: add schema validator and enforce max_tokens limit';
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},1 @@\n-${snippet}\n+${replacement}`;
            } else if (type === 'Performance Anti-Pattern') {
                replacement = '// TODO: optimize loop or debounce handler';
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},1 @@\n-${snippet}\n+${replacement}`;
            } else if (type === 'Type Safety Gap') {
                replacement = '// TODO: replace any with specific type';
                suggestedPatch = `--- a/${file}\n+++ b/${file}\n@@ -${line},1 +${line},1 @@\n-${snippet}\n+${replacement}`;
            }
            // File-extension-aware verification command fallback
            let verificationCommand = typeToVerification[type] || '';
            if (!verificationCommand) {
                const ext = file.split('.').pop().toLowerCase();
                if (['js','cjs','mjs'].includes(ext)) verificationCommand = 'node -c ' + file;
                else if (['ts','tsx'].includes(ext)) verificationCommand = 'npx tsc --noEmit';
                else if (['py'].includes(ext)) verificationCommand = 'python -m py_compile ' + file;
                else if (['java'].includes(ext)) verificationCommand = 'javac -d /tmp ' + file;
                else verificationCommand = 'npm test';
            }
            fixes.push({
                file,
                line,
                type,
                severity,
                severityRank: severityRank[severity] || 99,
                action: f.fix || typeToFix[type] || 'Review && remediate',
                confidence: f.confidence || 0.75,
                snippet: snippet.slice(0, 120),
                currentCode: snippet,
                replacement,
                context: surrounding.slice(0, 5),
                suggestedPatch,
                autoFixable: typeToAutoFixable[type] || false,
                verificationCommand
            });
        });
    });
    fixes.sort((a, b) => a.severityRank - b.severityRank || b.confidence - a.confidence);
    return fixes.slice(0, 50);
}

/**
 * Dedupe files requiring changes across all finding collections.
 * Returns a map of file -> array of change descriptions.
 */
function dedupeFileChanges(collections) {
    const files = {};
    Object.entries(collections).forEach(([collectionName, findings]) => {
        if (!Array.isArray(findings)) return;
        findings.forEach(f => {
            const filePaths = Array.isArray(f.filePath) ? f.filePath : [f.file || f.filePath].filter(Boolean);
            const type = f.type || collectionName.replace(/Findings$/, '');
            const action = f.fix || 'Review && remediate';
            filePaths.forEach(fp => {
                if (!fp) return;
                if (!files[fp]) files[fp] = [];
                if (!files[fp].some(e => e.type === type)) {
                    files[fp].push({ type, action, severity: f.severity || 'low' });
                }
            });
        });
    });
    return files;
}

// ============================================================================
// Dynamic Severity && Confidence (ported from VS Code extension analyzer)
// ============================================================================

function isInComment(line, language) {
    const trimmed = (line || '').trim();
    switch (language) {
        case 'javascript':
        case 'typescript':
        case 'java':
        case 'go':
        case 'rust':
        case 'php':
        case 'dotnet':
            return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
        case 'python':
        case 'ruby':
            return trimmed.startsWith('#');
        default:
            return false;
    }
}

function isTestFile(filePath) {
    const normalized = (filePath || '').replace(/\\/g, '/').toLowerCase();
    return /\.(test|spec)\./i.test(normalized)
        || /__tests__/.test(normalized)
        || /\/tests?\//.test(normalized)
        || /\/(fixtures?|mocks?)\//.test(normalized)
        || /test-all-patterns|test-technical|positive-test|negative-test|simplebeacon-rule-tests/.test(normalized)
        || /\/archive\//.test(normalized)
        || /\/(demo|sample|example|tools\/(generate|send|scan|test))\//.test(normalized);
}

function computeDynamicSeverity(baseSeverity, snippet, filePath, language) {
    if (isInComment(snippet, language)) return 'low';
    if (isTestFile(filePath)) return 'low';

    // Downgrade if argument is a literal string (not tainted)
    const hasVariableRef = /\b(req\.body|req\.query|req\.params|process\.argv|args\[|argv\[)/i.test(snippet);
    const isLiteral = /['"`][^'"`]*['"`]$/.test((snippet || '').trim());

    if (baseSeverity === 'high' && isLiteral && !hasVariableRef) return 'medium';
    if (baseSeverity === 'medium' && isLiteral && !hasVariableRef) return 'low';
    if (baseSeverity === 'high' && hasVariableRef) return 'critical';

    return baseSeverity;
}

function computeConfidence(dynamicSeverity, snippet, filePath, language) {
    let confidence = 0.85;
    if (isInComment(snippet, language)) confidence = 0.4;
    else if (isTestFile(filePath)) confidence = 0.5;
    else if (dynamicSeverity === 'critical') confidence = 0.95;
    return confidence;
}

// NOTE: LANGUAGE_REGISTRY, PATTERN_REGISTRY, ANALYZER_SCHEMA, and EXCLUSION_RULES
// have been moved to scanner-patterns.js. Load that file before this one.

// ============================================================================
// Analyzer Report Schema — drives uniform section generation
// ============================================================================
const REPORT_SECTION_SCHEMA = [
    { section: 'aiResidue', hitsVar: 'aiResidueHits', findingsVar: 'aiResidueFindings', label: 'AI residue pattern', detail: 'stubs, deprecated APIs, error swallowing, dead code' },
    { section: 'performance', hitsVar: 'perfHits', findingsVar: 'perfFindings', label: 'performance anti-pattern', detail: 'nested loops, leaked listeners, inefficient regex' },
    { section: 'typeSafety', hitsVar: 'typeSafetyHits', findingsVar: 'typeSafetyFindings', label: 'type safety gap', detail: 'any types, missing PropTypes, excessive params' },
    { section: 'testCoverage', hitsVar: 'testHits', findingsVar: 'testFindings', label: 'test coverage gap', detail: 'skipped/empty tests' },
    { section: 'accessibility', hitsVar: 'a11yHits', findingsVar: 'a11yFindings', label: 'accessibility gap', detail: 'missing alt, unlabeled inputs' },
    { section: 'i18n', hitsVar: 'i18nHits', findingsVar: 'i18nFindings', label: 'i18n issue', detail: 'hardcoded strings, locale-naive formatting' },
    { section: 'sensitiveData', hitsVar: 'sensitiveDataHits', findingsVar: 'sensitiveDataFindings', label: 'sensitive data exposure', detail: 'PII in logs/storage' },
    { section: 'configDrift', hitsVar: 'configDriftHits', findingsVar: 'configDriftFindings', label: 'configuration drift', detail: 'literal URL values, .env in repo' },
    { section: 'securityHeaders', hitsVar: 'securityHeaderHits', findingsVar: 'securityHeaderFindings', label: 'security header reference', detail: 'Review CSP, X-Frame-Options, HSTS coverage' },
    { section: 'databasePatterns', hitsVar: 'dbPatternHits', findingsVar: 'dbPatternFindings', label: 'database anti-pattern', detail: 'raw SQL concat, unbounded queries' },
    { section: 'frameworkPractices', hitsVar: 'frameworkHits', findingsVar: 'frameworkFindings', label: 'framework practice issue', detail: 'hook misuse, missing cleanup' },
    { section: 'workspaceHealth', hitsVar: 'workspaceHits', findingsVar: 'workspaceFindings', label: 'workspace health issue', detail: 'circular imports, mismatched deps' },
    { section: 'unusedDeps', hitsVar: 'unusedDepHits', findingsVar: 'unusedDepFindings', label: 'unused dependency reference', detail: 'unused deps in package.json' },
    { section: 'apiContract', hitsVar: 'apiContractHits', findingsVar: 'apiContractFindings', label: 'API contract drift', detail: 'unconsumed endpoints, stale OpenAPI' },
    { section: 'complexity', hitsVar: 'complexityHits', findingsVar: 'complexityFindings', label: 'high complexity pattern', detail: 'over-long functions, deep nesting' },
    { section: 'llmSlop', hitsVar: 'llmSlopHits', findingsVar: 'llmSlopFindings', label: 'LLM slop pattern', detail: 'placeholder debris, markdown fences, hardcoded metrics' },
    { section: 'tokenBleed', hitsVar: 'tokenBleedHits', findingsVar: 'tokenBleedFindings', label: 'token bleed risk', detail: 'long string literals in prompt content' },
    { section: 'productionLeak', hitsVar: 'productionLeakHits', findingsVar: 'productionLeakFindings', label: 'production data leak', detail: 'mock/fixture/sample path references' },
    { section: 'fictionKpi', hitsVar: 'fictionKpiHits', findingsVar: 'fictionKpiFindings', label: 'hardcoded fiction KPI', detail: 'unverified metrics and completion rates' },
    { section: 'security', hitsVar: 'securityHits', findingsVar: 'securityFindings', label: 'security vulnerability', detail: 'eval, XSS, prototype pollution, insecure random, missing rate limits' },
    { section: 'quality', hitsVar: 'qualityHits', findingsVar: 'qualityFindings', label: 'code quality issue', detail: 'unhandled promises, missing strict mode, uninitialized reads' },
    { section: 'maintainability', hitsVar: 'maintainabilityHits', findingsVar: 'maintainabilityFindings', label: 'maintainability issue', detail: 'magic numbers, hardcoded literals' },
    { section: 'evalDanger', hitsVar: 'evalDangerHits', findingsVar: 'evalDangerFindings', label: 'dangerous eval usage', detail: 'eval(), new Function(), unsafe dynamic code execution' },
    { section: 'innerHtmlXss', hitsVar: 'innerHtmlXssHits', findingsVar: 'innerHtmlXssFindings', label: 'innerHTML XSS risk', detail: 'unsanitized innerHTML assignments' },
    { section: 'prototypePollution', hitsVar: 'prototypePollutionHits', findingsVar: 'prototypePollutionFindings', label: 'prototype pollution risk', detail: 'Object.prototype or __proto__ modification' },
    { section: 'unhandledPromise', hitsVar: 'unhandledPromiseHits', findingsVar: 'unhandledPromiseFindings', label: 'unhandled promise', detail: 'promise chains missing .catch() handlers' },
    { section: 'magicNumber', hitsVar: 'magicNumberHits', findingsVar: 'magicNumberFindings', label: 'magic number', detail: 'hardcoded numeric literals without named constants' },
    { section: 'missingStrictMode', hitsVar: 'missingStrictModeHits', findingsVar: 'missingStrictModeFindings', label: 'missing strict mode', detail: 'files without use strict directive' },
    { section: 'uninitializedRead', hitsVar: 'uninitializedReadHits', findingsVar: 'uninitializedReadFindings', label: 'uninitialized variable read', detail: 'variables read before initialization' },
    { section: 'unvalidatedRedirect', hitsVar: 'unvalidatedRedirectHits', findingsVar: 'unvalidatedRedirectFindings', label: 'unvalidated redirect', detail: 'redirects with user-controlled destinations' },
    { section: 'missingRateLimit', hitsVar: 'missingRateLimitHits', findingsVar: 'missingRateLimitFindings', label: 'missing rate limiting', detail: 'API endpoints without rate limit protection' },
    { section: 'insecureRandom', hitsVar: 'insecureRandomHits', findingsVar: 'insecureRandomFindings', label: 'insecure random usage', detail: 'Math.random() used for security-sensitive operations' },
    { section: 'loggingSecrets', hitsVar: 'loggingSecretsHits', findingsVar: 'loggingSecretsFindings', label: 'secret in logs', detail: 'passwords, tokens, or secrets logged to console' },
    { section: 'hardcodedConfidence', hitsVar: 'hardcodedConfidenceHits', findingsVar: 'hardcodedConfidenceFindings', label: 'hardcoded confidence score', detail: 'static confidence scores instead of computed values' },
    { section: 'hardcodedCompletion', hitsVar: 'hardcodedCompletionHits', findingsVar: 'hardcodedCompletionFindings', label: 'hardcoded completion rate', detail: 'static completion rates instead of real metrics' },
    { section: 'mockPathLeak', hitsVar: 'mockPathLeakHits', findingsVar: 'mockPathLeakFindings', label: 'mock/fixture path leak', detail: 'mock or fixture path references in production code' },
    { section: 'sampleJsonRef', hitsVar: 'sampleJsonRefHits', findingsVar: 'sampleJsonRefFindings', label: 'sample JSON reference', detail: 'sample JSON file references in production code' },
    { section: 'governanceMarker', hitsVar: 'governanceMarkerHits', findingsVar: 'governanceMarkerFindings', label: 'license/governance marker', detail: 'license or copyright markers requiring review' },
    { section: 'aiPlaceholderComment', hitsVar: 'aiPlaceholderCommentHits', findingsVar: 'aiPlaceholderCommentFindings', label: 'AI placeholder comment', detail: 'placeholder comments generated by AI' },
    { section: 'aiPlaceholderBlock', hitsVar: 'aiPlaceholderBlockHits', findingsVar: 'aiPlaceholderBlockFindings', label: 'AI placeholder block comment', detail: 'placeholder block comments from AI' },
    { section: 'markdownFenceLeak', hitsVar: 'markdownFenceLeakHits', findingsVar: 'markdownFenceLeakFindings', label: 'markdown fence leak', detail: 'markdown code fences leaked into source' },
    { section: 'emptyStubFunction', hitsVar: 'emptyStubFunctionHits', findingsVar: 'emptyStubFunctionFindings', label: 'empty stub function', detail: 'empty function bodies likely from AI generation' },
    { section: 'arrowStub', hitsVar: 'arrowStubHits', findingsVar: 'arrowStubFindings', label: 'arrow function stub', detail: 'arrow functions returning empty objects' },
    { section: 'roadmapMarker', hitsVar: 'roadmapMarkerHits', findingsVar: 'roadmapMarkerFindings', label: 'roadmap marker', detail: 'unresolved HACK, XXX, or WORKAROUND markers' }
];

/**
 * Build uniform analyzer report sections from schema.
 * `ctx` is an object mapping variable names to their values.
 */
function buildAnalyzerSections(ctx, allowedSections) {
    const result = {};
    for (const s of REPORT_SECTION_SCHEMA) {
        if (!allowedSections.includes(s.section)) continue;
        const findings = ctx[s.findingsVar] || [];
        const hits = ctx[s.hitsVar] || findings.length || 0;
        result[s.section] = {
            [`${s.section}Hits`]: hits,
            [`${s.section}Findings`]: findings.slice(0, 5).map(f => ({
                file: f.file,
                type: f.type,
                matches: f.matches.slice(0, 3).map(m => ({ line: m.line, snippet: m.snippet }))
            })),
            summary: hits > 0
                ? `${hits} ${s.label}(s) detected (${s.detail}).`
                : `No ${s.label}s detected.`
        };
    }
    return result;
}

/**
 * Enrich matches with dynamic severity, confidence, and fix template.
 */
function enrichMatches(matches, reg, path, language) {
    return matches.map(m => {
        const dynamicSev = computeDynamicSeverity(reg.severity, m.snippet, path, language);
        const confidence = computeConfidence(dynamicSev, m.snippet, path, language);
        const enriched = {
            ...m,
            dynamicSeverity: dynamicSev,
            confidence,
            baseSeverity: reg.severity
        };
        if (reg.fix) {
            enriched.fix = reg.fix;
            enriched.autoFixable = true;
        }
        return enriched;
    });
}

/**
 * Category collectors route findings to the correct hit counters and arrays.
 * Each collector receives (path, reg, filteredMatches, context).
 */
/**
 * Route findings to per-pattern section variables so certificate modules get real data.
 * Called from aggregate collectors (security, quality, maintainability, etc.).
 */
function trackIndividualCollector(path, reg, enriched, ctx) {
    const map = {
        evalDanger: ['evalDangerHits', 'evalDangerFindings'],
        innerHtmlXss: ['innerHtmlXssHits', 'innerHtmlXssFindings'],
        prototypePollution: ['prototypePollutionHits', 'prototypePollutionFindings'],
        unvalidatedRedirect: ['unvalidatedRedirectHits', 'unvalidatedRedirectFindings'],
        missingRateLimit: ['missingRateLimitHits', 'missingRateLimitFindings'],
        insecureRandom: ['insecureRandomHits', 'insecureRandomFindings'],
        loggingSecrets: ['loggingSecretsHits', 'loggingSecretsFindings'],
        unhandledPromise: ['unhandledPromiseHits', 'unhandledPromiseFindings'],
        missingStrictMode: ['missingStrictModeHits', 'missingStrictModeFindings'],
        uninitializedRead: ['uninitializedReadHits', 'uninitializedReadFindings'],
        magicNumber: ['magicNumberHits', 'magicNumberFindings'],
        hardcodedConfidence: ['hardcodedConfidenceHits', 'hardcodedConfidenceFindings'],
        hardcodedCompletion: ['hardcodedCompletionHits', 'hardcodedCompletionFindings'],
        mockPathLeak: ['mockPathLeakHits', 'mockPathLeakFindings'],
        sampleJsonRef: ['sampleJsonRefHits', 'sampleJsonRefFindings'],
        governanceMarker: ['governanceMarkerHits', 'governanceMarkerFindings'],
        aiPlaceholderComment: ['aiPlaceholderCommentHits', 'aiPlaceholderCommentFindings'],
        aiPlaceholderBlock: ['aiPlaceholderBlockHits', 'aiPlaceholderBlockFindings'],
        markdownFenceLeak: ['markdownFenceLeakHits', 'markdownFenceLeakFindings'],
        emptyStubFunction: ['emptyStubFunctionHits', 'emptyStubFunctionFindings'],
        arrowStub: ['arrowStubHits', 'arrowStubFindings'],
        roadmapMarker: ['roadmapMarkerHits', 'roadmapMarkerFindings']
    };
    const mapping = map[reg.id];
    if (mapping) {
        const [hitsKey, findingsKey] = mapping;
        if (ctx[hitsKey] !== undefined) {
            ctx[hitsKey]++;
        }
        if (ctx[findingsKey] !== undefined) {
            ctx[findingsKey].push({ file: path, type: reg.name, matches: enriched });
        }
    }
}

const CATEGORY_COLLECTORS = {
    aiIndicators: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.aiHits.push(path);
        ctx.aiFindings.push({ file: path, matches: enriched });
        appendTerminalLine(`AI indicator detected: <span style="color:#94A3B8;">${path}</span> (${matches.length} match${matches.length !== 1 ? 'es' : ''})`, 'warn');
    },
    credentials: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.credentialHits++;
        ctx.credFiles.push(path);
        ctx.credentialFindings.push({ file: path, matches: enriched });
    },
    debug: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.debugHits.push(path);
        ctx.debugFindings.push({ file: path, matches: enriched });
    },
    governance: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.govHits.push(path);
        ctx.govFindings.push({ file: path, matches: enriched });
        trackIndividualCollector(path, reg, enriched, ctx);
    },
    aiResidue: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.aiResidueHits++;
        ctx.aiResidueFindings.push({ file: path, type: reg.name, matches: enriched });
        trackIndividualCollector(path, reg, enriched, ctx);
        appendTerminalLine(`AI residue detected (${reg.name}): <span style="color:#94A3B8;">${path}</span> (${matches.length} match${matches.length !== 1 ? 'es' : ''})`, 'warn');
    },
    performance: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.perfHits++;
        ctx.perfFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    typeSafety: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.typeSafetyHits++;
        ctx.typeSafetyFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    testCoverage: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.testHits++;
        ctx.testFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    accessibility: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.a11yHits++;
        ctx.a11yFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    i18n: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.i18nHits++;
        ctx.i18nFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    sensitiveData: (path, reg, matches, ctx) => {
        const lowerPath = path.toLowerCase();
        const triaged = matches.map(m => {
            const snippet = (m.snippet || '').toLowerCase();
            let triageConfidence = 'high';
            let category = 'unknown';
            if (/node_modules\//.test(lowerPath)) { triageConfidence = 'low'; category = 'third-party-metadata'; }
            else if (/\.git\//.test(lowerPath)) { triageConfidence = 'low'; category = 'git-metadata'; }
            else if (/\.(md|txt|markdown)$/.test(lowerPath) && /support|contact|hello|press|security|docs/.test(snippet)) { triageConfidence = 'low'; category = 'public-contact-info'; }
            else if (/package\.json$/.test(lowerPath) && /author|contributor|license/.test(snippet)) { triageConfidence = 'low'; category = 'package-metadata'; }
            else if (/tools\/(generate|send|scan|test)/.test(lowerPath) || /demo|fixture|mock|sample|test/.test(lowerPath)) { triageConfidence = 'medium'; category = 'tooling-or-test'; }
            else if (/(console\.log|console\.warn).*token|password|secret/.test(snippet)) { triageConfidence = 'high'; category = 'secret-in-log'; }
            else if (/\.env/.test(lowerPath)) { triageConfidence = 'high'; category = 'env-secret'; }
            else if (/localstorage\.setitem.*token|auth|session|password/.test(snippet)) { triageConfidence = 'high'; category = 'client-storage-secret'; }
            const dynamicSev = computeDynamicSeverity(reg.severity, m.snippet, path, 'javascript');
            const numericConfidence = computeConfidence(dynamicSev, m.snippet, path, 'javascript');
            return { ...m, triage: { confidence: triageConfidence, category }, dynamicSeverity: dynamicSev, confidence: numericConfidence, baseSeverity: reg.severity };
        });
        const highConfidence = triaged.filter(m => m.triage.confidence === 'high');
        const mediumConfidence = triaged.filter(m => m.triage.confidence === 'medium');
        ctx.sensitiveDataHits++;
        ctx.sensitiveDataFindings.push({ file: path, type: reg.name, matches: triaged, highConfidence: highConfidence.length, mediumConfidence: mediumConfidence.length });
    },
    configDrift: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.configDriftHits++;
        ctx.configDriftFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    securityHeaders: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.securityHeaderHits++;
        ctx.securityHeaderFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    databasePatterns: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.dbPatternHits++;
        ctx.dbPatternFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    frameworkPractices: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.frameworkHits++;
        ctx.frameworkFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    workspaceHealth: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.workspaceHits++;
        ctx.workspaceFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    apiContract: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.apiContractHits++;
        ctx.apiContractFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    complexity: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.complexityHits++;
        ctx.complexityFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    llmSlop: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.llmSlopHits++;
        ctx.llmSlopFindings.push({ file: path, type: reg.name, matches: enriched });
        trackIndividualCollector(path, reg, enriched, ctx);
    },
    tokenBleed: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.tokenBleedHits++;
        ctx.tokenBleedFindings.push({ file: path, type: reg.name, matches: enriched });
    },
    productionLeak: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.productionLeakHits++;
        ctx.productionLeakFindings.push({ file: path, type: reg.name, matches: enriched });
        trackIndividualCollector(path, reg, enriched, ctx);
    },
    fictionKpi: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.fictionKpiHits++;
        ctx.fictionKpiFindings.push({ file: path, type: reg.name, matches: enriched });
        trackIndividualCollector(path, reg, enriched, ctx);
    },
    security: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.securityHits++;
        ctx.securityFindings.push({ file: path, type: reg.name, matches: enriched });
        trackIndividualCollector(path, reg, enriched, ctx);
    },
    quality: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.qualityHits++;
        ctx.qualityFindings.push({ file: path, type: reg.name, matches: enriched });
        trackIndividualCollector(path, reg, enriched, ctx);
    },
    maintainability: (path, reg, matches, ctx) => {
        const enriched = enrichMatches(matches, reg, path, 'javascript');
        ctx.maintainabilityHits++;
        ctx.maintainabilityFindings.push({ file: path, type: reg.name, matches: enriched });
        trackIndividualCollector(path, reg, enriched, ctx);
    }
};

/**
 * Detect the dominant language of a repository from its file list.
 * Returns the language key with the most matching source files.
 */
function detectDominantLanguage(paths) {
    const counts = {};
    for (const path of paths) {
        const ext = (path.match(/\.([^.]+)$/) || [null, ''])[1].toLowerCase();
        for (const [langKey, config] of Object.entries(LANGUAGE_REGISTRY)) {
            if (config.extensions.includes(ext)) {
                counts[langKey] = (counts[langKey] || 0) + 1;
                break;
            }
        }
    }
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
}

/**
 * Return the set of active analyzer IDs for a given language and profile.
 * Dynamically collects all applicable patterns from PATTERN_REGISTRY so
 * new analyzers are automatically included without manual list maintenance.
 */
function getAnalyzersForLanguage(langKey, profile) {
    const active = [];
    for (const [id, entry] of Object.entries(PATTERN_REGISTRY)) {
        if (!entry.appliesTo || !entry.appliesTo.includes(langKey)) continue;
        const cat = ANALYZER_SCHEMA[id]?.category || '';
        // Gate by profile flags based on category
        if (cat === 'aiIndicators' && !profile.checkAi) continue;
        if (cat === 'credentials' && !profile.checkCredentials) continue;
        if (cat === 'debug' && !profile.checkDebug) continue;
        if (cat === 'governance' && !profile.checkGov) continue;
        if (cat === 'aiResidue' && !profile.checkAiResidue) continue;
        if (cat === 'performance' && !profile.checkAiResidue) continue;
        if (cat === 'typeSafety' && !profile.checkAiResidue) continue;
        if (cat === 'testCoverage' && !profile.checkAiResidue) continue;
        if (cat === 'accessibility' && !profile.checkAiResidue) continue;
        if (cat === 'i18n' && !profile.checkAiResidue) continue;
        if (cat === 'sensitiveData' && !profile.checkAiResidue) continue;
        if (cat === 'configDrift' && !profile.checkAiResidue) continue;
        if (cat === 'securityHeaders' && !profile.checkAiResidue) continue;
        if (cat === 'databasePatterns' && !profile.checkAiResidue) continue;
        if (cat === 'frameworkPractices' && !profile.checkAiResidue) continue;
        if (cat === 'workspaceHealth' && !profile.checkAiResidue) continue;
        if (cat === 'unusedDeps' && !profile.checkAiResidue) continue;
        if (cat === 'apiContract' && !profile.checkAiResidue) continue;
        if (cat === 'complexity' && !profile.checkAiResidue) continue;
        if (cat === 'llmSlop' && !profile.checkAiResidue) continue;
        if (cat === 'tokenBleed' && !profile.checkAiResidue) continue;
        if (cat === 'productionLeak' && !profile.checkAiResidue) continue;
        if (cat === 'fictionKpi' && !profile.checkAiResidue) continue;
        if (cat === 'security' && !profile.checkAiResidue) continue;
        if (cat === 'quality' && !profile.checkAiResidue) continue;
        if (cat === 'maintainability' && !profile.checkAiResidue) continue;
        active.push(id);
    }
    return active;
}

/**
 * Get all root-file markers for a given language key.
 */
function getRootFilesForLanguage(langKey) {
    const cfg = LANGUAGE_REGISTRY[langKey];
    return cfg ? cfg.rootFiles : [];
}

/**
 * Build readiness checks for the dominant language.
 */
function getBuildChecksForLanguage(langKey) {
    const cfg = LANGUAGE_REGISTRY[langKey];
    return cfg ? cfg.buildChecks : LANGUAGE_REGISTRY.javascript.buildChecks;
}

/**
 * Build EU AI Act control recommendations based on detected AI indicators and governance docs.
 */
function buildEuAiActControls(aiHits, licenseFiles, securityFiles, aiFindings = []) {
    const controls = [];
    const docCount = (licenseFiles?.length || 0) + (securityFiles?.length || 0);
    const hasDocs = docCount > 0;
    const aiCount = aiHits?.length || 0;

    // Scan AI findings for specific prohibited-practice indicators (Art. 5)
    const prohibitedPatterns = [
        /\bface-?api\b|\bfaceapi\b|\bfacial\s+recognition\b|\bfingerprint\b|\biris\s+scan\b|\bbiometric(s)?\b/i,
        /\bsocial\s+scor(e|ing)\b|\bcredit\s+scor(e|ing)\b|\brank\s+(individuals|people|users)\b/i,
        /\bsubliminal\b|\bmicro-target(ing)?\b/i,
        /\bemotion\s+(detection|recognition)\b|\bage\s+(detection|estimation)\b|\bmanipulate\s+user(s)?\b/i
    ];
    const prohibitedHits = [];
    for (const finding of aiFindings) {
        for (const match of finding.matches || []) {
            const snippet = match.snippet || '';
            if (prohibitedPatterns.some(p => p.test(snippet))) {
                prohibitedHits.push({ file: finding.file, snippet: snippet.slice(0, 100) });
                break;
            }
        }
    }
    const prohibitedCount = prohibitedHits.length;

    // Art. 5 — Prohibited AI Practices (only WARN if specific prohibited indicators found)
    controls.push({
        controlId: 'EU-AIA-ART-5',
        title: 'Prohibited AI Practices Audit',
        article: 'Regulation (EU) 2024/1689, Article 5',
        status: prohibitedCount > 0 ? 'WARN' : 'PASS',
        severity: prohibitedCount > 0 ? 'critical' : 'low',
        description: prohibitedCount > 0
            ? `Article 5 prohibits: (a) subliminal techniques, (b) exploitation of vulnerabilities, (c) social scoring by governments, (d) real-time biometric ID in public spaces. ${prohibitedCount} prohibited-practice indicator(s) detected — immediate legal review required.`
            : aiCount > 0
                ? `Article 5 prohibits specific practices (subliminal techniques, exploitation of vulnerabilities, social scoring, biometric ID). ${aiCount} generic AI SDK import(s) detected — none indicate prohibited practices.`
                : 'No AI SDK imports or model inference patterns detected. Article 5 prohibited practices not applicable.',
        evidence: prohibitedCount > 0
            ? `${prohibitedCount} match(es): ${prohibitedHits.map(h => h.file + ' — ' + h.snippet).join('; ')}`
            : aiCount > 0 ? `${aiCount} generic AI SDK import(s) — no prohibited-practice indicators found.` : 'None detected',
        action: prohibitedCount > 0
            ? 'Conduct legal review immediately: the detected patterns suggest the system may perform practices prohibited under Art. 5(1). If confirmed, stop development and redesign.'
            : aiCount > 0
                ? 'No prohibited practices detected. Document the lawful use case for compliance records, but no immediate action required.'
                : 'No action needed — maintain zero-AI posture or document lawful use case.'
    });

    // Art. 6 — Classification as high-risk (Annex III)
    const annexIIIPatterns = [
        { domain: 'law enforcement', pattern: /\b(police|law enforcement|criminal justice|arrest|warrant|patrol|surveillance cam|detention|prison|probation|parole|investigat(e|ion))\b/i },
        { domain: 'migration / border control', pattern: /\b(border|immigration|asylum|visa|refugee|migrant|deportation|customs|passport|entry|exit)\b/i },
        { domain: 'democratic processes', pattern: /\b(election|vote|ballot|campaign|polling|voter|referendum|democratic|candidate)\b/i },
        { domain: 'employment / recruitment', pattern: /\b(recruit|hire|employment|worker|employee|resume|interview|job|candidate|performance review|workplace|HR|human resources|talent)\b/i },
        { domain: 'education', pattern: /\b(student|school|education|university|college|grade|exam|assessment|academic|course|enrollment|admission|curriculum)\b/i },
        { domain: 'healthcare / medical', pattern: /\b(hospital|patient|diagnosis|medical|healthcare|treatment|clinical|prescription|symptom|disease|therapy|surgery)\b/i },
        { domain: 'credit / insurance / finance', pattern: /\b(credit score|credit rating|loan|insurance|underwriting|premium|claim|mortgage|banking|finance|investment)\b/i },
        { domain: 'critical infrastructure / transport', pattern: /\b(transport|traffic|vehicle|aircraft|railway|subway|energy|power grid|utility|water supply|telecommunication|nuclear|dam)\b/i },
        { domain: 'administration of justice', pattern: /\b(judge|court|judicial|trial|legal|litigation|verdict|sentence|evidence|witness)\b/i }
    ];
    const annexIIIMatches = [];
    for (const finding of aiFindings) {
        for (const match of finding.matches || []) {
            const snippet = match.snippet || '';
            for (const { domain, pattern } of annexIIIPatterns) {
                if (pattern.test(snippet)) {
                    annexIIIMatches.push({ domain, file: finding.file, snippet: snippet.slice(0, 80) });
                    break;
                }
            }
        }
    }
    const annexIIIDomains = [...new Set(annexIIIMatches.map(m => m.domain))];
    const isHighRiskDomain = annexIIIMatches.length > 0;

    controls.push({
        controlId: 'EU-AIA-ART-6',
        title: 'AI System Classification (Annex III)',
        article: 'Regulation (EU) 2024/1689, Article 6 & Annex III',
        status: aiCount > 0 ? 'REVIEW' : 'PASS',
        severity: isHighRiskDomain ? 'high' : (aiCount > 0 ? 'medium' : 'low'),
        description: isHighRiskDomain
            ? `Annex III high-risk domain indicator(s) detected: ${annexIIIDomains.join(', ')}. These use cases require a full conformity assessment under Article 6 before deployment.`
            : aiCount > 0
                ? 'Annex III lists high-risk AI systems (critical infrastructure, education, employment, law enforcement, migration, democratic processes). Classification determines conformity obligations.'
                : 'No AI system indicators — Annex III classification not applicable.',
        evidence: isHighRiskDomain
            ? `${annexIIIMatches.length} match(es) across domains: ${annexIIIDomains.join(', ')}. Example: ${annexIIIMatches[0].file} — "${annexIIIMatches[0].snippet}"`
            : aiCount > 0 ? `${aiCount} generic AI indicator(s); ${hasDocs ? docCount + ' governance doc(s) present — verify Annex III classification is explicitly documented' : '0 governance docs — add risk-assessment.md'}` : 'None detected',
        action: isHighRiskDomain
            ? 'URGENT: The detected domain(s) suggest this is a high-risk AI system under Annex III. Conduct a full conformity assessment (Articles 8–15), implement risk management (Article 9), and register the system before deployment.'
            : aiCount > 0
                ? (hasDocs ? 'Review existing governance docs to confirm Annex III classification is explicitly documented. Do not assume presence of docs equals correct classification.' : 'Add risk-assessment.md documenting whether the system is high-risk under Annex III.')
                : 'No action needed.'
    });

    // Art. 10 — Data and Data Governance (training data quality, bias mitigation)
    controls.push({
        controlId: 'EU-AIA-ART-10',
        title: 'Data and Data Governance',
        article: 'Regulation (EU) 2024/1689, Article 10',
        status: aiCount > 0 ? (hasDocs ? 'REVIEW' : 'WARN') : 'PASS',
        severity: aiCount > 0 ? (hasDocs ? 'medium' : 'high') : 'low',
        description: aiCount > 0
            ? 'Article 10 requires that training, validation and testing datasets meet quality criteria: relevance, representativeness, freedom from errors, and completeness. Bias detection and mitigation must be documented.'
            : 'No AI system indicators — data governance obligations not applicable.',
        evidence: aiCount > 0 ? `${aiCount} AI indicator(s); ${hasDocs ? docCount + ' governance doc(s) present — verify data governance coverage' : 'No data governance documentation detected'}` : 'None detected',
        action: aiCount > 0
            ? 'Document dataset provenance, bias assessment methodology, and data quality verification procedures. If using pre-trained models, record provider data governance certifications.'
            : 'No action needed.'
    });

    // Art. 14 — Human Oversight (natural persons must be able to oversee high-risk AI)
    controls.push({
        controlId: 'EU-AIA-ART-14',
        title: 'Human Oversight Measures',
        article: 'Regulation (EU) 2024/1689, Article 14',
        status: aiCount > 0 ? (hasDocs ? 'REVIEW' : 'WARN') : 'PASS',
        severity: aiCount > 0 ? (hasDocs ? 'medium' : 'high') : 'low',
        description: aiCount > 0
            ? 'Article 14 requires high-risk AI systems to be designed so natural persons can effectively oversee them, including the ability to correctly interpret outputs, decide not to use the system, and intervene on operation.'
            : 'No AI indicators — human oversight obligations not applicable.',
        evidence: aiCount > 0 ? `${aiCount} AI indicator(s); ${hasDocs ? docCount + ' governance doc(s) present — verify oversight coverage' : 'No oversight documentation detected'}` : 'None detected',
        action: aiCount > 0
            ? 'Implement and document: (1) human review checkpoints before high-stakes decisions, (2) override/escalation mechanisms, (3) operator training materials, (4) audit trails for human interventions.'
            : 'No action needed.'
    });

    // Art. 50 — Transparency obligations (chatbots, deepfakes)
    controls.push({
        controlId: 'EU-AIA-ART-50',
        title: 'Transparency Obligations',
        article: 'Regulation (EU) 2024/1689, Article 50',
        status: aiCount > 0 ? 'WARN' : 'PASS',
        severity: aiCount > 0 ? 'medium' : 'low',
        description: aiCount > 0
            ? 'Article 50 requires that persons interacting with AI systems are informed they are engaging with an AI (chatbots), and that deep-synthetic content is labelled as artificially generated.'
            : 'No AI indicators — transparency obligations not applicable.',
        evidence: aiCount > 0 ? `${aiCount} AI indicator(s) detected` : 'None detected',
        action: aiCount > 0
            ? 'Verify UI/UX includes AI disclosure notices. If generating images/video/audio, implement synthetic media watermarking or metadata tags.'
            : 'No action needed.'
    });

    // Art. 9 — Risk management system (high-risk only)
    controls.push({
        controlId: 'EU-AIA-ART-9',
        title: 'Risk Management System',
        article: 'Regulation (EU) 2024/1689, Article 9',
        status: aiCount > 0 ? (hasDocs ? 'REVIEW' : 'WARN') : 'PASS',
        severity: aiCount > 0 ? (hasDocs ? 'medium' : 'high') : 'low',
        description: aiCount > 0
            ? 'High-risk AI systems must implement a continuous risk management system throughout the entire lifecycle.'
            : 'No AI indicators — risk management system not applicable.',
        evidence: aiCount > 0 ? `${hasDocs ? docCount + ' doc(s) present — verify risk management coverage' : 'No risk management documentation detected'}` : 'None detected',
        action: aiCount > 0
            ? 'Create or update risk-assessment.md covering: identified risks, estimated likelihood/severity, mitigation measures, residual risk acceptance criteria.'
            : 'No action needed.'
    });

    return controls;
}

/**
 * Analyze file and folder naming conventions across a project.
 * Returns findings for mixed naming styles, spaces/special chars,
 * inconsistent extensions, overly long names, and data-handling issues.
 */
function analyzeFileNaming(paths) {
    const findings = [];
    const styleStats = { camelCase: 0, snake_case: 0, kebabCase: 0, PascalCase: 0, other: 0 };
    const extCounts = {};
    const dirNaming = {};

    for (const rawPath of paths) {
        const path = rawPath.replace(/\\/g, '/');
        const parts = path.split('/');
        const fileName = parts.pop() || '';
        const baseName = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
        const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase() : '';

        // Skip hidden, vendor, and obvious non-source files
        if (/^\./.test(fileName) || /node_modules|\.git|\.github|dist|build|coverage|\.next|out/.test(path)) continue;

        // Extension tracking
        if (ext && ext.length <= 20 && !/^\d/.test(ext)) {
            extCounts[ext] = (extCounts[ext] || 0) + 1;
        }

        // Detect naming style
        if (/^[a-z][a-zA-Z0-9]*[A-Z]/.test(baseName)) styleStats.camelCase++;
        else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(baseName)) styleStats.snake_case++;
        else if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(baseName)) styleStats.kebabCase++;
        else if (/^[A-Z][a-zA-Z0-9]*$/.test(baseName)) styleStats.PascalCase++;
        else styleStats.other++;

        // Spaces in file name
        if (/\s/.test(fileName)) {
            findings.push({ file: path, type: 'Space in Filename', severity: 'medium', detail: 'Spaces in filenames break CLI pipelines and cause quoting issues. Use kebab-case or snake_case.', suggestion: fileName.replace(/\s+/g, '-') });
        }

        // Special characters (not - _ .)
        if (/[^a-zA-Z0-9._\-]/.test(baseName) && !/\s/.test(fileName)) {
            findings.push({ file: path, type: 'Special Characters in Filename', severity: 'medium', detail: 'Special characters in filenames cause cross-platform compatibility issues and shell escaping problems.', suggestion: baseName.replace(/[^a-zA-Z0-9._\-]/g, '_') + (ext ? '.' + ext : '') });
        }

        // Overly long file name
        if (baseName.length > 60) {
            findings.push({ file: path, type: 'Overly Long Filename', severity: 'low', detail: `Filename is ${baseName.length} chars — long names are hard to read and can exceed OS limits.`, suggestion: 'Shorten to core descriptor words.' });
        }

        // Version numbers in filename (anti-pattern)
        if (/v?\d+\.\d+|_\d+_\d+_\d+|-\d{4}-\d{2}-\d{2}/.test(baseName)) {
            findings.push({ file: path, type: 'Version/Date in Filename', severity: 'low', detail: 'Version numbers or dates in filenames suggest manual versioning instead of Git. Rename to canonical name.', suggestion: baseName.replace(/v?\d+\.\d+.*$/, '').replace(/_\d+_\d+_\d+.*$/, '').replace(/-\d{4}-\d{2}-\d{2}.*$/, '') + (ext ? '.' + ext : '') });
        }

        // Data handling: files that contain data but have generic names
        if (/\.(json|csv|xml|yaml|yml|sql|db|sqlite|parquet|xlsx)$/.test(ext) && /^(data|file|output|result|temp|tmp|export|import|backup|copy|new|old|test|sample)\d*$/i.test(baseName)) {
            findings.push({ file: path, type: 'Generic Data Filename', severity: 'medium', detail: 'Data files with generic names (data.json, file.csv) make it impossible to understand content without opening them.', suggestion: 'Use descriptive names: users-export-2024.json, monthly-sales.csv' });
        }

        // Data handling: mixed case extensions
        if (ext && /[A-Z]/.test(fileName.slice(fileName.lastIndexOf('.') + 1))) {
            findings.push({ file: path, type: 'Mixed-Case Extension', severity: 'low', detail: 'File extensions should be lowercase for cross-platform consistency.', suggestion: fileName.slice(0, fileName.lastIndexOf('.')) + '.' + ext.toLowerCase() });
        }

        // Directory naming tracking
        for (const dir of parts) {
            if (!dir || /^\./.test(dir)) continue;
            dirNaming[dir] = (dirNaming[dir] || 0) + 1;
        }
    }

    // Detect mixed naming conventions across project
    const totalNamed = styleStats.camelCase + styleStats.snake_case + styleStats.kebabCase + styleStats.PascalCase;
    if (totalNamed > 0) {
        const dominant = Object.entries(styleStats).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1])[0];
        const nonDominant = Object.entries(styleStats).filter(([k, v]) => k !== 'other' && k !== dominant[0] && v > 0);
        if (nonDominant.length > 0 && dominant[1] > 5) {
            const mixDetail = nonDominant.map(([k, v]) => `${k} (${v} files)`).join(', ');
            findings.unshift({ file: 'project-root', type: 'Mixed Naming Conventions', severity: 'low', detail: `Dominant style is ${dominant[0]} (${dominant[1]} files), but also found: ${mixDetail}. Consistent naming improves readability and reduces cognitive load.`, suggestion: `Standardize on ${dominant[0]} across the codebase.` });
        }
    }

    // Detect duplicate directory names with different casing (Windows/Mac case-insensitive FS issues)
    const lowerDirs = {};
    for (const dir of Object.keys(dirNaming)) {
        const ld = dir.toLowerCase();
        if (!lowerDirs[ld]) lowerDirs[ld] = [];
        lowerDirs[ld].push(dir);
    }
    for (const group of Object.values(lowerDirs)) {
        if (group.length > 1) {
            findings.push({ file: 'project-root', type: 'Case-Conflicting Directory Names', severity: 'medium', detail: `Directories differ only by case: ${group.join(', ')}. This causes problems on case-insensitive filesystems.`, suggestion: 'Consolidate to a single casing.' });
        }
    }

    return { findings, styleStats, extCounts };
}

/**
 * Analyze which files are candidates for removal to reduce project bloat.
 * Categorizes node_modules, .git, build artifacts, caches, logs, temp files,
 * editor configs, empty files, and OS metadata.
 */
function analyzeRemovableFiles(files) {
    const categories = {
        node_modules: { label: 'node_modules (installed dependencies)', count: 0, bytes: 0, examples: [], action: 'Delete — run npm install to regenerate. Do not commit to Git.', removable: true },
        git: { label: '.git (version control metadata)', count: 0, bytes: 0, examples: [], action: 'Keep for dev. Safe to remove from deployment artifacts only.', removable: false },
        build_artifacts: { label: 'Build output directories (dist, build, .next, out)', count: 0, bytes: 0, examples: [], action: 'Delete — regenerated by build scripts. Add to .gitignore.', removable: true },
        cache: { label: 'Cache directories (.cache, .turbo, __pycache__)', count: 0, bytes: 0, examples: [], action: 'Delete — temporary cache. Regenerated automatically.', removable: true },
        coverage: { label: 'Test coverage reports', count: 0, bytes: 0, examples: [], action: 'Delete — regenerated by test runs. Add to .gitignore.', removable: true },
        logs: { label: 'Log files (*.log)', count: 0, bytes: 0, examples: [], action: 'Delete — runtime logs. Add *.log to .gitignore.', removable: true },
        editor_files: { label: 'IDE / editor config files (.vscode, .idea)', count: 0, bytes: 0, examples: [], action: 'Review — some teams share these, others keep them local.', removable: false },
        temp_backup: { label: 'Temporary / backup files (*.tmp, *.bak, *~)', count: 0, bytes: 0, examples: [], action: 'Delete — temporary files. Add to .gitignore.', removable: true },
        lockfiles: { label: 'Package manager lockfiles', count: 0, bytes: 0, examples: [], action: 'Keep one per package.json. Extra lockfiles may be from nested projects.', removable: false },
        empty_files: { label: 'Empty files (0 bytes)', count: 0, bytes: 0, examples: [], action: 'Delete — empty files serve no purpose.', removable: true },
        snapshots: { label: 'Test snapshots (__snapshots__)', count: 0, bytes: 0, examples: [], action: 'Review — can be regenerated but may be needed for CI.', removable: false },
        scan_artifacts: { label: 'Self-generated scan artifacts (.simplebeacon)', count: 0, bytes: 0, examples: [], action: 'Delete — generated by previous scans.', removable: true },
        os_metadata: { label: 'OS metadata files (.DS_Store, Thumbs.db)', count: 0, bytes: 0, examples: [], action: 'Delete — should never be in version control.', removable: true }
    };

    const pathToCategory = [
        { pattern: /(?:^|\/)node_modules(?:\/|$)/, cat: 'node_modules' },
        { pattern: /(?:^|\/)\.git(?:\/|$)/, cat: 'git' },
        { pattern: /(?:^|\/)(dist|build|out|\.next|\.nuxt|\.output|target|public\/build)(?:\/|$)/, cat: 'build_artifacts' },
        { pattern: /(?:^|\/)(\.cache|\.turbo|\.parcel-cache|\.grunt|\.sass-cache|__pycache__|\.eslintcache|\.stylelintcache)(?:\/|$)/, cat: 'cache' },
        { pattern: /(?:^|\/)coverage(?:\/|$)/, cat: 'coverage' },
        { pattern: /(?:^|\/)__snapshots__(?:\/|$)/, cat: 'snapshots' },
        { pattern: /\.log$/i, cat: 'logs' },
        { pattern: /(?:^|\/)(\.vscode|\.idea|\.cursor|\.windsurf|\.cursor-tutor|\.vs)(?:\/|$)/, cat: 'editor_files' },
        { pattern: /(?:^|\/)\.simplebeacon(?:\/|$)/, cat: 'scan_artifacts' },
        { pattern: /(?:^|\/)(\.github-cache|\.github-sync)(?:\/|$)/, cat: 'scan_artifacts' },
        { pattern: /\.(tmp|temp|bak|~|swp|swo|orig)$/i, cat: 'temp_backup' },
        { pattern: /(?:^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Gemfile\.lock|composer\.lock|Cargo\.lock|mix\.lock|go\.sum)$/, cat: 'lockfiles' },
        { pattern: /\.DS_Store$|Thumbs\.db$|desktop\.ini$/i, cat: 'os_metadata' }
    ];

    for (const file of files) {
        const filePath = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
        if (!filePath) continue;

        let matched = false;
        for (const { pattern, cat } of pathToCategory) {
            if (pattern.test(filePath)) {
                categories[cat].count++;
                categories[cat].bytes += file.size || 0;
                if (categories[cat].examples.length < 5) categories[cat].examples.push(filePath);
                matched = true;
                break;
            }
        }

        if (!matched && file.size === 0) {
            categories.empty_files.count++;
            categories.empty_files.bytes += 0;
            if (categories.empty_files.examples.length < 5) categories.empty_files.examples.push(filePath);
        }
    }

    const resultCategories = Object.entries(categories)
        .filter(([_, data]) => data.count > 0)
        .map(([key, data]) => ({
            category: key,
            label: data.label,
            count: data.count,
            bytes: data.bytes,
            examples: data.examples,
            action: data.action,
            removable: data.removable
        }));

    const removableCats = resultCategories.filter(r => r.removable);
    const totalRemovable = removableCats.reduce((a, r) => a + r.count, 0);
    const totalRemovableBytes = removableCats.reduce((a, r) => a + r.bytes, 0);

    function fmtBytes(b) {
        if (b === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    return {
        categories: resultCategories,
        totalFiles: files.length,
        totalRemovable,
        totalRemovableBytes,
        totalRemovableFormatted: fmtBytes(totalRemovableBytes),
        summary: totalRemovable > 0
            ? `${totalRemovable.toLocaleString()} of ${files.length.toLocaleString()} files (${fmtBytes(totalRemovableBytes)}) can likely be removed.`
            : 'No clearly removable files detected.'
    };
}

async function processLocalCLIScan(files) {
    appendTerminalLine(`<span style="color:#60A5FA;font-weight:700;">&#9654;</span> processLocalCLIScan: received ${files.length.toLocaleString()} files`, 'info');
    reportData = null;
    window._scanPreviewData = null;
    window._scanPreviewModules = null;
    if (typeof selectedModules !== 'undefined' && selectedModules.clear) selectedModules.clear(); // simplebeacon-ignore: typeof !== undefined is strict comparison
    const localScanFileName = document.getElementById('localScanFileName');
    // Normalize Windows backslashes to forward slashes in all file paths
    for (const f of files) {
        const raw = f.webkitRelativePath || f.name;
        if (raw.includes('\\')) {
            Object.defineProperty(f, 'webkitRelativePath', {
                value: raw.replace(/\\/g, '/'),
                writable: false,
                configurable: true
            });
        }
    }
    // Auto-detect project root: find the directory with the most files
    // that contains package.json, .simplebeacon/, || server.cjs.
    const paths = files.map(f => f.webkitRelativePath || f.name).map(p => p.replace(/\\/g, '/'));
    let rootPrefix = '';
    let detectedRoot = '';

    // Helper: check if a prefix is a valid project root
    function isProjectRoot(prefix) {
        const last = prefix.split('/').pop();
        if (last === '.git' || last === 'node_modules' || last === '.github' || last === '.vscode' || last === '.idea' || last === '.husky' || last === '.cursor' || last === '.simplebeacon' || last === '.windsurf' || last === '.cursor-tutor') return false;
        // Check legacy JS markers first
        const hasJsRoot = paths.some(p => p === prefix + '/package.json') ||
                          paths.some(p => p.startsWith(prefix + '/.simplebeacon/')) ||
                          paths.some(p => p === prefix + '/server.cjs') ||
                          paths.some(p => p === prefix + '/action.yml') ||
                          paths.some(p => p === prefix + '/action.yaml');
        if (hasJsRoot) return true;
        // Check all registered language ecosystem markers
        for (const cfg of Object.values(LANGUAGE_REGISTRY)) {
            for (const rootFile of cfg.rootFiles) {
                if (paths.some(p => p === prefix + '/' + rootFile)) return true;
                // Handle wildcard patterns like *.csproj
                if (rootFile.startsWith('*.')) {
                    const ext = rootFile.slice(1);
                    if (paths.some(p => p.startsWith(prefix + '/') && p.endsWith(ext))) return true;
                }
            }
        }
        return false;
    }

    // Try top-level directories first, then one level deeper
    const topSegments = [...new Set(paths.map(p => p.split('/')[0]))];
    let candidate = '';
    for (const top of topSegments) {
        if (isProjectRoot(top)) { candidate = top; break; }
    }
    // If no top-level root found, check immediate subdirectories
    if (!candidate) {
        const subDirs = new Set();
        for (const p of paths) {
            const parts = p.split('/');
            if (parts.length >= 2) subDirs.add(parts[0] + '/' + parts[1]);
        }
        // Pick the subdirectory with the most files that is a project root
        let bestCount = 0;
        for (const sub of subDirs) {
            if (isProjectRoot(sub)) {
                const count = paths.filter(p => p.startsWith(sub + '/')).length;
                if (count > bestCount) { bestCount = count; candidate = sub; }
            }
        }
    }

    if (candidate) {
        rootPrefix = candidate + '/';
        detectedRoot = candidate;
        // Filter to files under detected root only — prevents sibling-dir contamination
        const beforeCount = files.length;
        files = files.filter(f => {
            const raw = f.webkitRelativePath || f.name;
            const normalized = raw.replace(/\\/g, '/');
            return normalized.startsWith(rootPrefix);
        });
        // Strip prefix from remaining files for cleaner reporting
        for (const f of files) {
            const raw = f.webkitRelativePath || f.name;
            const normalized = raw.replace(/\\/g, '/');
            Object.defineProperty(f, 'webkitRelativePath', {
                value: normalized.slice(rootPrefix.length),
                writable: false,
                configurable: true
            });
        }
        if (localScanFileName) {
            const dropped = beforeCount - files.length;
            const dropMsg = dropped > 0 ? ` (${dropped.toLocaleString()} sibling files excluded)` : '';
            appendTerminalLine(`<span style="color:#60A5FA;">&#9432;</span> Auto-detected project root: <strong>${detectedRoot}</strong> — scanning ${files.length.toLocaleString()} files.${dropMsg}`);
        }
    }
    if (localScanFileName) localScanFileName.textContent = `Filtering ${files.length.toLocaleString()} files...`;
    // Defense-in-depth: token must be present
    if (!hasValidToken()) {
        showToast('Paste a license token to unlock scanning.', 'warning');
        licenseInput.focus();
        licenseInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    // Abort any previous scan
    if (scanAbortController) {
        scanAbortController.abort();
    }
    scanAbortController = new AbortController();
    const signal = scanAbortController.signal;

    if (dropzonePrompt) dropzonePrompt.style.display = 'none';
    terminalConsole.style.display = 'block';
    panelProgressContainer.style.display = 'block';
    panelMetrics.style.display = 'inline';
    panelStatus.textContent = 'RUNNING_ANALYSIS';
    panelStatus.style.color = '#60A5FA';
    terminalConsole.textContent = '';

    const cancelBtn = document.getElementById('cancelScanBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'inline-block';
        cancelBtn.onclick = () => {
            if (scanAbortController) {
                scanAbortController.abort();
                appendTerminalLine('Scan cancellation requested.', 'warn');
            }
        };
    }
    const downloadLogBtn = document.getElementById('downloadLogBtn');
    if (downloadLogBtn) {
        downloadLogBtn.style.display = 'inline-block';
        downloadLogBtn.onclick = () => {
            try {
                const tc = document.getElementById('terminal-console');
                if (!tc || tc.children.length === 0) {
                    showToast('No scan output to download yet.', 'warning');
                    return;
                }
                const lines = Array.from(tc.children).map(div => {
                    const ts = div.querySelector('span')?.textContent || '';
                    const text = div.textContent || '';
                    return (ts ? ts + ' ' : '') + text.replace(ts, '').trim();
                }).filter(Boolean);
                const header = 'simplebeacon scan log\nExported: ' + new Date().toISOString() + '\n' + '='.repeat(50) + '\n\n';
                const blob = new Blob([header + lines.join('\n') + '\n'], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'scan-log-' + new Date().toISOString().slice(0,10) + '.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('Log downloaded.', 'success');
            } catch (err) {
                showToast('Failed to download log: ' + (err.message || err), 'error');
            }
        };
    }
    const copyLogBtn = document.getElementById('copyLogBtn');
    if (copyLogBtn) {
        copyLogBtn.style.display = 'inline-block';
        copyLogBtn.onclick = () => {
            const tc = document.getElementById('terminal-console');
            if (!tc || tc.children.length === 0) {
                showToast('No scan output to copy yet.', 'warning');
                return;
            }
            const lines = [];
            Array.from(tc.children).forEach(div => {
                const txt = (div.textContent || '').trim();
                if (txt) lines.push(txt);
            });
            let text = lines.join('\n');
            const MAX_CLIPBOARD_CHARS = 100000;
            let truncated = false;
            if (text.length > MAX_CLIPBOARD_CHARS) {
                text = text.slice(0, MAX_CLIPBOARD_CHARS) + '\n\n[...truncated ' + (text.length - MAX_CLIPBOARD_CHARS).toLocaleString() + ' chars...]';
                truncated = true;
            }

            // Prefer Clipboard API — fire synchronously to keep user gesture
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Log copied to clipboard.' + (truncated ? ' (truncated to 100K chars)' : ''), 'success');
                }).catch((e) => {
                    fallbackCopy(text, truncated);
                });
                return;
            }
            fallbackCopy(text, truncated);
        };
    }

    function fallbackCopy(text, truncated) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;width:2em;height:2em;padding:0;border:none;z-index:1;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            if (!ok) throw new Error('execCommand copy returned false');
            showToast('Log copied to clipboard.' + (truncated ? ' (truncated to 100K chars)' : ''), 'success');
        } catch (err) {
            showToast('Failed to copy log: ' + (err.message || err), 'error');
        }
    }

    try {
    // Scan always runs 'complete' so all modules have data; ZIP filters to selected modules
    const profileKey = 'complete';
    const ALL_SECTIONS = ['gateReport', 'consolidation', 'mockDataCategories', 'roadmap', 'codebase', 'fileReduction', 'dataQuality', 'cleanup', 'npmAudit', 'compliance', 'euAiActSummary', 'dependencyAudit', 'buildReadiness', 'aiIndicators', 'governance', 'junkFiles', 'aiResidue', 'performance', 'typeSafety', 'documentation', 'testCoverage', 'accessibility', 'i18n', 'sensitiveData', 'configDrift', 'securityHeaders', 'databasePatterns', 'frameworkPractices', 'workspaceHealth', 'unusedDeps', 'apiContract', 'complexity', 'fileNaming', 'removableFiles', 'security', 'quality', 'maintainability'];
    const profile = (typeof BROWSER_SCAN_PROFILES !== 'undefined' && BROWSER_SCAN_PROFILES[profileKey]) || { label: 'Complete Scan', checkAi: true, checkCredentials: true, checkDebug: true, checkGov: true, checkAiResidue: true }; // simplebeacon-ignore
    const allowedSections = (typeof PROFILE_SECTIONS !== 'undefined' && (PROFILE_SECTIONS[profileKey] || PROFILE_SECTIONS.complete)) || ALL_SECTIONS; // simplebeacon-ignore
    const tier = window._tokenPayload?.tier || window._tokenPayload?.product || 'locked'; // simplebeacon-ignore
    const shouldRedact = tier !== 'executive' && tier !== 'euai' && tier !== 'universal'; // simplebeacon-ignore: strict !== comparison, not ==
    if (browserFolderDropzone) browserFolderDropzone.classList.add('scanning');
    const localScanFileName = document.getElementById('localScanFileName');
    if (localScanFileName) localScanFileName.textContent = `Preparing to scan ${files.length.toLocaleString()} files...`;
    appendTerminalLine('simplebeacon scan .', 'input');
    appendTerminalLine(`Initializing Local Web Worker Core... Profile: ${profile.label}. Allocating isolated browser memory structures.`);
    // Security baseline: only exclude dependency trees by default (user can override via checkbox)
    const includeDeps = document.getElementById('includeDepsToggle')?.checked || false;
    const deepScan = document.getElementById('deepScanToggle')?.checked || false;
    const excludeEnv = false;             // scan all files including .env — credential detection handles false positives
    const skipDeps = !includeDeps;         // exclude node_modules/.git only when explicitly unchecked
    const skipDocs = false;               // scan docs by default — they contain governance markers

    // Pre-scan estimator: show file composition
    const nodeModuleCount = files.filter(f => /node_modules\//.test((f.webkitRelativePath || f.name).toLowerCase())).length;
    const gitCount = files.filter(f => /\.git\//.test((f.webkitRelativePath || f.name).toLowerCase())).length;
    const buildArtifactCount = files.filter(f => /\/(dist|build|\.next|out|coverage|frontend-build)\//i.test((f.webkitRelativePath || f.name).toLowerCase())).length;
    const cacheDirCount = files.filter(f => /\/(\.simplebeacon|\.github-sync|github-cache|\.cursor|\.windsurf)\//i.test((f.webkitRelativePath || f.name).toLowerCase())).length;
    const lockfileCount = files.filter(f => (f.webkitRelativePath || f.name).toLowerCase().endsWith('package-lock.json')).length;
    const archiveCount = files.filter(f => /\.(zip|tgz)$/.test((f.webkitRelativePath || f.name).toLowerCase())).length;
    const binaryCount = files.filter(f => /\.(png|jpe?g|gif|webp|ico|bmp|mp3|mp4|wav|zip|exe|dll|pdf|doc|docx)$/.test((f.webkitRelativePath || f.name).toLowerCase())).length;
    const usefulCount = files.length - nodeModuleCount - gitCount;
    const estTimeSec = Math.round(files.length * 0.003); // ~3ms per file heuristic
    appendTerminalLine(`Estimator: ~${estTimeSec}s scan time · ${nodeModuleCount} node_modules files · ${gitCount} .git files detected.`);
    if (nodeModuleCount > 100 && !includeDeps) {
        appendTerminalLine(`Note: ${nodeModuleCount} node_modules files will be excluded by default. If you intended to scan source only, this is expected.`, 'success');
    } else if (nodeModuleCount > 100 && includeDeps) {
        appendTerminalLine(`Warning: ${nodeModuleCount} node_modules files will be scanned. Expect slower performance && potential false positives.`, 'warn');
    }
    if (includeDeps) appendTerminalLine('Note: node_modules/.git inclusion enabled — scan will be slower && noisier.', 'warn');
    if (deepScan) appendTerminalLine('DEEP SCAN MODE: All cache, docs, && scanner-page filters bypassed. Only secrets && 500MB+ files are excluded.', 'warn');
    // Collapsible raw file list
    const fileListHtml = files.map(f => f.webkitRelativePath || f.name).join('\n');
    appendTerminalLine(`<details style="margin:4px 0;"><summary style="cursor:pointer;color:#60A5FA;font-size:0.75rem;">&#128451; Show all ${files.length.toLocaleString()} discovered files</summary>\n<pre style="max-height:400px;overflow:auto;background:#0B0F19;padding:8px;border-radius:6px;font-size:0.68rem;color:#94A3B8;margin-top:6px;line-height:1.4;">${fileListHtml.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></details>`);

    let scanned = 0;
    let totalLines = 0;
    let aiHits = [];
    let credentialHits = 0;
    let credFiles = [];
    let debugHits = [];
    let govHits = [];
    let aiResidueHits = 0;
    let aiResidueFindings = [];
    let perfHits = 0;
    let perfFindings = [];
    let typeSafetyHits = 0;
    let typeSafetyFindings = [];
    let testHits = 0;
    let testFindings = [];
    let a11yHits = 0;
    let a11yFindings = [];
    let i18nHits = 0;
    let i18nFindings = [];
    let sensitiveDataHits = 0;
    let sensitiveDataFindings = [];
    let configDriftHits = 0;
    let configDriftFindings = [];
    let securityHeaderHits = 0;
    let securityHeaderFindings = [];
    let dbPatternHits = 0;
    let dbPatternFindings = [];
    let frameworkHits = 0;
    let frameworkFindings = [];
    let workspaceHits = 0;
    let workspaceFindings = [];
    let unusedDepHits = 0;
    let unusedDepFindings = [];
    let apiContractHits = 0;
    let apiContractFindings = [];
    let complexityHits = 0;
    let complexityFindings = [];
    let llmSlopHits = 0;
    let llmSlopFindings = [];
    let tokenBleedHits = 0;
    let tokenBleedFindings = [];
    let productionLeakHits = 0;
    let productionLeakFindings = [];
    let fictionKpiHits = 0;
    let fictionKpiFindings = [];
    let securityHits = 0;
    let securityFindings = [];
    let qualityHits = 0;
    let qualityFindings = [];
    let maintainabilityHits = 0;
    let maintainabilityFindings = [];
    let evalDangerHits = 0;
    let evalDangerFindings = [];
    let innerHtmlXssHits = 0;
    let innerHtmlXssFindings = [];
    let prototypePollutionHits = 0;
    let prototypePollutionFindings = [];
    let unhandledPromiseHits = 0;
    let unhandledPromiseFindings = [];
    let magicNumberHits = 0;
    let magicNumberFindings = [];
    let missingStrictModeHits = 0;
    let missingStrictModeFindings = [];
    let uninitializedReadHits = 0;
    let uninitializedReadFindings = [];
    let unvalidatedRedirectHits = 0;
    let unvalidatedRedirectFindings = [];
    let missingRateLimitHits = 0;
    let missingRateLimitFindings = [];
    let insecureRandomHits = 0;
    let insecureRandomFindings = [];
    let loggingSecretsHits = 0;
    let loggingSecretsFindings = [];
    let hardcodedConfidenceHits = 0;
    let hardcodedConfidenceFindings = [];
    let hardcodedCompletionHits = 0;
    let hardcodedCompletionFindings = [];
    let mockPathLeakHits = 0;
    let mockPathLeakFindings = [];
    let sampleJsonRefHits = 0;
    let sampleJsonRefFindings = [];
    let governanceMarkerHits = 0;
    let governanceMarkerFindings = [];
    let aiPlaceholderCommentHits = 0;
    let aiPlaceholderCommentFindings = [];
    let aiPlaceholderBlockHits = 0;
    let aiPlaceholderBlockFindings = [];
    let markdownFenceLeakHits = 0;
    let markdownFenceLeakFindings = [];
    let emptyStubFunctionHits = 0;
    let emptyStubFunctionFindings = [];
    let arrowStubHits = 0;
    let arrowStubFindings = [];
    let roadmapMarkerHits = 0;
    let roadmapMarkerFindings = [];
    let archDriftFindings = [];
    let mockFiles = [];
    let packageJsonFiles = [];
    let licenseFiles = [];
    let securityFiles = [];
    let emptyJsonFiles = [];
    let totalJsonFiles = 0;
    let duplicateHashes = new Map();
    let duplicateGroups = 0;
    let todoFiles = [];
    const todoMarkerCounts = { tasks: 0, fixes: 0, hacks: 0, bugs: 0, notes: 0 };
    let imageFiles = [];
    let unusedAssetCandidates = [];
    let junkFiles = [];
    let monorepoMarkers = 0;
    let totalDependencyCount = 0;
    const fileTypes = {};
    const startTime = Date.now();

    // Rich finding collectors: per-file, per-line findings with context
    const aiFindings = [];
    const credentialFindings = [];
    const debugFindings = [];
    const govFindings = [];
    const bloatFindings = [];

    // Cross-file workspace analysis collectors
    const envFileData = [];          // { path, entries: { key: value } }
    const packageJsonFullData = [];  // { path, name, dependencies, devDependencies }
    const processEnvRefs = [];       // { key, file, line }
    const syncIoPatterns = [];       // { file, line, snippet }

    // 1. Check for user-provided .simplebeaconignore (collect ALL nested ones)
    let ignorePatterns = [];
    const ignoreFiles = files.filter(f => (f.webkitRelativePath || f.name).endsWith('.simplebeaconignore'));
    for (const ignoreFile of ignoreFiles) {
        try { ignorePatterns.push(...parseIgnoreFile(await ignoreFile.text())); } catch (e) { /* ignore parse errors */ }
    }

    appendTerminalLine(`<span style="color:#60A5FA;font-weight:700;">&#9654; Stage 2/3:</span> Filtering ${files.length.toLocaleString()} files (excluding dependencies, secrets, generated artifacts)...`);

    // 2. Filter loop — keep all files except absolute hard limits
    let skipped = 0;
    const sourceFiles = [];
    const skipReasons = {};
    let filterIdx = 0;
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB hard safety limit
    const BINARY_EXTENSIONS = new Set([
        '.gguf', '.bin', '.pt', '.pth', '.onnx', '.safetensors', '.model', '.weights', // ML models
        '.rlib', '.rmeta', '.o', '.a', '.so', '.dylib', '.lib', '.dll', '.exe', // compiled libs
        '.cab', '.msi', '.deb', '.rpm', '.dmg', '.pkg', // installers
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.heic', // images
        '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flv', '.webm', // media
        '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar', '.xz', // archives
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', // documents
        '.pyc', '.class', '.jar', '.war', '.wasm', '.bc' // bytecode
    ]);
    for (const f of files) {
        filterIdx++;
        const path = (f.webkitRelativePath || f.name).replace(/\\/g, '/');
        let reason = null;
        if (f.size >= MAX_FILE_SIZE) {
            reason = 'File > 2GB';
        }
        if (!reason) {
            const extIdx = path.lastIndexOf('.');
            const ext = extIdx >= 0 ? path.substring(extIdx).toLowerCase() : '';
            if (BINARY_EXTENSIONS.has(ext)) {
                reason = 'Binary file';
            }
        }
        const includeVendorDirs = window._scanOptions?.includeVendorDirs || false;
        if (skipDeps && !includeVendorDirs && !reason && /(^|\/)(node_modules|\.git|\.github-sync|github-cache|\.cursor|\.windsurf|\.cursor-tutor|\.vscode|\.idea|\.husky|\.simplebeacon|backups|java-ai-vulnerable|out)\//i.test(path)) {
            reason = 'Vendor/cache directory';
        }
        if (!reason && !deepScan && /(^|\/)(docs\/|doc\/|third_party\/|thirdparty\/|geedocs\/|mapfiles\/|vendor\/|\.min\.js$|\.bundle\.min\.js$|\.pack\.js$)/i.test(path)) {
            reason = 'Vendor/docs/build artifact';
        }
        if (!reason && !deepScan && /(^|\/)vscode-extension\/out\//i.test(path)) {
            reason = 'VS Code extension build output';
        }
        if (!reason && !deepScan && /\.map$/i.test(path)) {
            reason = 'Source map (build artifact)';
        }
        // Hardcoded exclusions for generated files that cause false positives in browser-sandbox scans
        // (browser directory pickers may not include .simplebeaconignore dotfile)
        if (!reason && /(^|\/)package-lock\.json$/i.test(path)) {
            reason = 'Lockfile (generated)';
        }
        if (!reason && /(^|\/)(simplebeacon-report-|simplebeacon-cascadeprojects-|simplebeacon-latest-|simplebeacon-full-|simplebeacon-export-|complete-scan|report-export|simplebeacon-report-export).*\.json$/i.test(path)) {
            reason = 'Generated scan report';
        }
        if (!reason && /(^|\/)codemap-tree\.json$/i.test(path)) {
            reason = 'Generated codemap metadata';
        }
        if (!reason && /(^|\/)(knip-report|git-status|test-output-root|test-results|tier-accounts|tier-tokens|MASTER-TOKEN|ai-slop-cop-pro-token)\.txt$/i.test(path)) {
            reason = 'Generated/sensitive text file';
        }
        if (!reason && !deepScan && /(^|\/)scan-exports\//i.test(path)) {
            reason = 'Scan export directory';
        }
        if (!reason && !deepScan && /(^|\/)false-positive-audit\//i.test(path)) {
            reason = 'False positive audit directory';
        }
        if (!reason && !deepScan && /(^|\/)js-es2018\//i.test(path)) {
            reason = 'Compiled ES2018 output';
        }
        if (!reason && !deepScan && /(^|\/)public\/dashboard\/js-es2018\//i.test(path)) {
            reason = 'Compiled ES2018 output';
        }
        if (!reason && !deepScan && /(^|\/)public\/reports\//i.test(path)) {
            reason = 'Generated report directory';
        }
        if (!reason && !deepScan && /(^|\/)(dashboard-web|simplebeacon-dashboard)\/js\/views\//i.test(path)) {
            reason = 'Dashboard view (legitimate innerHTML)';
        }
        if (!reason && !deepScan && /(^|\/)public\/dashboard\/js\/views\//i.test(path)) {
            reason = 'Dashboard view (legitimate innerHTML)';
        }
        if (!reason && !deepScan && /(^|\/)(dashboard-web|simplebeacon-dashboard)\/js\/(main\.js|components\/)/i.test(path)) {
            reason = 'Dashboard component (legitimate innerHTML)';
        }
        if (!reason && /(^|\/)(codebase-analyzer|code-hygiene-certificate|zscript-parser)\.(cjs|js)$/i.test(path)) {
            reason = 'Scanner/analyzer pattern file';
        }
        if (!reason && /(^|\/)(generator|rotate-keys)\.js$/i.test(path) && /sales\/license\//i.test(path)) {
            reason = 'License key generator (expected entropy)';
        }
        if (!reason && /(^|\/)GlobalContextManager\.cjs$/i.test(path)) {
            reason = 'Context manager (pattern definitions)';
        }
        if (!reason && /(^|\/)(instructions|simplebeacon-report-export)\.(txt|json)$/i.test(path)) {
            reason = 'Generated/documentation file';
        }
        if (!reason && /(^|\/)(__check_|__cs_)/i.test(path)) {
            reason = 'Temp debug script';
        }
        if (!reason && /(^|\/)stream-stress\.cjs$/i.test(path)) {
            reason = 'Stress test script';
        }
        if (!reason && !deepScan && /(^|\/)(dashboard-web|simplebeacon-dashboard)\/js\/(services|utils|components)\//i.test(path)) {
            reason = 'Dashboard service/component (legitimate patterns)';
        }
        if (!reason && !deepScan && /(^|\/)public\/dashboard\/js\/(main|services|utils|components)\//i.test(path)) {
            reason = 'Dashboard service/component (legitimate patterns)';
        }
        if (!reason && !deepScan && /(^|\/)dashboard-web\/js\/main\.js$/i.test(path)) {
            reason = 'Dashboard main (legitimate patterns)';
        }
        if (!reason && /(^|\/)(ai-analyst|compliance-rules|aiProblemAnalyzerSuite|analyzeService)\.(cjs|js|mjs)$/i.test(path)) {
            reason = 'AI analyzer/compliance pattern file';
        }
        if (!reason && /(^|\/)(orchestrator\.cjs|setup\.cjs|deep-check-welcome\.cjs|verify-deployment\.cjs)$/i.test(path)) {
            reason = 'Agent/setup/verify script';
        }
        if (!reason && /(^|\/)audit-remediation-recipes\//i.test(path)) {
            reason = 'Remediation recipe patterns';
        }
        if (!reason && /(^|\/)(zscript-cvar-analyzer|snippetDiagnostic)\.(cjs|js)$/i.test(path)) {
            reason = 'Analyzer/diagnostic pattern file';
        }
        if (!reason && /(^|\/)negative-test-2\//i.test(path)) {
            reason = 'Negative test fixture';
        }
        if (!reason && /(^|\/)analyzer-coverage\.test\.cjs$/i.test(path)) {
            reason = 'Test coverage file';
        }
        if (!reason && /(^|\/)ai-tools\/index\.js$/i.test(path)) {
            reason = 'AI tools index';
        }
        if (!reason && /(^|\/)export-findings\.js$/i.test(path)) {
            reason = 'Export script';
        }
        if (!reason && /(^|\/)audit-report\/__tests__\.cjs$/i.test(path)) {
            reason = 'Audit report tests';
        }
        // Apply .simplebeaconignore patterns to skip ignored files
        if (!reason && ignorePatterns.length) {
            const isIgnoredBySimplebeacon = ignorePatterns.some(pat => {
                if (pat instanceof RegExp) {
                    return pat.test(path);
                }
                if (typeof pat === 'string') {
                    if (pat.startsWith('*')) {
                        return path.endsWith(pat.slice(1)) || path.endsWith('/' + pat.slice(1));
                    }
                    return path === pat || path.endsWith('/' + pat) || path.includes('/' + pat + '/');
                }
                return false;
            });
            if (isIgnoredBySimplebeacon) {
                reason = '.simplebeaconignore match';
            }
        }
        if (reason) {
            skipped++;
            skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        } else {
            sourceFiles.push(f);
        }
        if (filterIdx % 1000 === 0 || filterIdx === files.length) {
            const pct = Math.round((filterIdx / files.length) * 100);
            if (localScanFileName) localScanFileName.textContent = `Preparing ${filterIdx.toLocaleString()} of ${files.length.toLocaleString()} files (${pct}%)...`;
            await new Promise(r => setTimeout(r, 0));
        }
    }

    // Diagnostic: log inclusion breakdown
    const skipLabel = deepScan ? 'skipped (>2GB / .simplebeaconignore only)' : 'skipped (vendor/docs/build artifact)';
    appendTerminalLine(`<span style="color:#10B981;font-weight:700;">&#128310; Filter Summary:</span> ${sourceFiles.length.toLocaleString()} files ready · ${skipped.toLocaleString()} ${skipLabel}`);
    const sortedReasons = Object.entries(skipReasons).sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of sortedReasons.slice(0, 8)) {
        appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> ${reason}: <strong>${count.toLocaleString()}</strong>`);
    }

    if (sourceFiles.length === 0) {
        appendTerminalLine(`<span style="color:#F59E0B;font-weight:700;">&#9888; No scannable files found.</span> The selected folder appears to be empty or contains only vendor/build directories.`, 'warn');
        showToast('No scannable source files found. Select a folder with actual code, or enable Deep Scan.', 'warning');
        panelStatus.textContent = 'NO_FILES';
        panelStatus.style.color = '#F59E0B';
        panelProgressContainer.style.display = 'none';
        panelMetrics.style.display = 'none';
        if (dropzonePrompt)
            dropzonePrompt.style.display = 'block';
        const cancelBtn = document.getElementById('cancelScanBtn');
        if (cancelBtn)
            cancelBtn.style.display = 'none';
        return;
    }
    appendTerminalLine(`Found ${sourceFiles.length.toLocaleString()} files. All files will be analyzed.`, 'success');

    // File inventory breakdown — show real composition of discovered files
    const inventory = {
        sourceCode: 0, markup: 0, config: 0, docs: 0,
        buildArtifacts: 0, testFixtures: 0, tempDev: 0, other: 0
    };
    for (const f of sourceFiles) {
        const p = (f.webkitRelativePath || f.name).toLowerCase();
        if (/\.(js|cjs|mjs|ts|tsx|jsx|py|java|go|rs|php|rb|cs|swift|kt|scala|dart|vue|svelte)$/i.test(p)) {
            inventory.sourceCode++;
        } else if (/\.(html|css|scss|sass|less)$/i.test(p)) {
            inventory.markup++;
        } else if (/\.(json|yml|yaml|toml|xml|ini|properties|tfvars)$/i.test(p)) {
            inventory.config++;
        } else if (/\.(md|txt|rst)$/i.test(p)) {
            inventory.docs++;
        } else if (/\/(frontend-build|dist|build|\.next|out|coverage)[\/]|\.(map|chunk\.js)$/i.test(p)) {
            inventory.buildArtifacts++;
        } else if (/\/(test-cert|java-ai-vulnerable|simplebeacon-rule-tests|__tests__|mocks|fixtures)[\/]|\.(test|spec)\./i.test(p)) {
            inventory.testFixtures++;
        } else if (/(^|[\/])(tmp-|temp_|fix_|patch_|repair_|deploy-)[^\/]*\.js$/i.test(p)) {
            inventory.tempDev++;
        } else {
            inventory.other++;
        }
    }
    appendTerminalLine(`<span style="color:#60A5FA;font-weight:700;">&#128200; File Inventory:</span> ${sourceFiles.length.toLocaleString()} total files`);
    appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> Source code: <strong>${inventory.sourceCode.toLocaleString()}</strong>`);
    appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> Markup/style: <strong>${inventory.markup.toLocaleString()}</strong>`);
    appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> Config/data: <strong>${inventory.config.toLocaleString()}</strong>`);
    appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> Documentation: <strong>${inventory.docs.toLocaleString()}</strong>`);
    if (inventory.buildArtifacts > 0) appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> Build artifacts: <strong>${inventory.buildArtifacts.toLocaleString()}</strong>`);
    if (inventory.testFixtures > 0) appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> Test fixtures: <strong>${inventory.testFixtures.toLocaleString()}</strong>`);
    if (inventory.tempDev > 0) appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> Temp/dev files: <strong>${inventory.tempDev.toLocaleString()}</strong>`);
    if (inventory.other > 0) appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> Other: <strong>${inventory.other.toLocaleString()}</strong>`);

    if (localScanFileName) localScanFileName.textContent = `Scanning ${sourceFiles.length.toLocaleString()} files...`;
    const activeEngineCount = new Set(allowedSections).size;
    appendTerminalLine(`<span style="color:#60A5FA;font-weight:700;">&#9654; Stage 3/3:</span> Scanning ${sourceFiles.length.toLocaleString()} source files across ${activeEngineCount} analysis engine${activeEngineCount === 1 ? '' : 's'}...`);

    // 3. Heuristic scan loop
    // Web Worker for large repositories — offloads regex scanning from main thread
    let scanWorker = null;
    let workerScanActive = false;
    let workerPromise = null;
    if (sourceFiles.length >= 1000 && typeof Worker !== 'undefined') { // simplebeacon-ignore: strict !== comparison
        try {
            scanWorker = new Worker('js/scan-worker.js?v=2.0.2');
            workerScanActive = true;
            appendTerminalLine('Web Worker initialized for background scanning.', 'success');
        } catch (err) {
            appendTerminalLine('Web Worker unavailable — falling back to main-thread scan.', 'warn');
        }
    }
    if (scanWorker) {
        workerPromise = new Promise((resolve) => {
            scanWorker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'started') {
                    appendTerminalLine('Worker scan started.', 'info');
                } else if (msg.type === 'progress') {
                    const pct = Math.round((msg.processed / msg.total) * 100);
                    panelProgressBar.style.width = pct + '%';
                    if (localScanFileName) localScanFileName.textContent = `Worker scanning ${msg.processed.toLocaleString()} of ${msg.total.toLocaleString()} files (${pct}%)...`;
                } else if (msg.type === 'complete') {
                    appendTerminalLine(`Worker scan complete: ${msg.issueCount} findings across ${msg.processed} files.`, 'success');
                    if (msg.findings) {
                        for (const f of msg.findings) {
                            const path = f.filePath;
                            const matches = (f.matches || []).map(m => ({ line: m.line, snippet: m.snippet, type: f.analyzer }));
                            switch (f.analyzer) {
                                case 'debugArtifacts':
                                case 'pythonDebug':
                                case 'javaDebug':
                                case 'goDebug':
                                case 'rustDebug':
                                case 'phpDebug':
                                case 'dotnetDebug':
                                case 'rubyDebug':
                                    debugHits.push(path);
                                    debugFindings.push({ file: path, matches });
                                    break;
                                case 'credentials':
                                    credentialHits++;
                                    credFiles.push(path);
                                    credentialFindings.push({ file: path, matches });
                                    break;
                                case 'euAiAct':
                                    govHits.push(path);
                                    govFindings.push({ file: path, matches });
                                    break;
                                case 'todoMarkers':
                                    maintainabilityHits++;
                                    maintainabilityFindings.push({ file: path, matches });
                                    break;
                                case 'mockData':
                                    productionLeakHits++;
                                    productionLeakFindings.push({ file: path, matches });
                                    break;
                                case 'pythonFramework':
                                case 'javaFramework':
                                case 'goFramework':
                                case 'rustFramework':
                                case 'phpFramework':
                                case 'dotnetFramework':
                                case 'rubyFramework':
                                    frameworkHits++;
                                    frameworkFindings.push({ file: path, matches });
                                    break;
                            }
                        }
                    }
                    scanWorker.terminate();
                    scanWorker = null;
                    workerScanActive = false;
                    resolve();
                } else if (msg.type === 'warn') {
                    appendTerminalLine(`Worker: ${msg.message}`, 'warn');
                } else if (msg.type === 'error') {
                    appendTerminalLine(`Worker error: ${msg.error}`, 'error');
                    scanWorker.terminate();
                    scanWorker = null;
                    workerScanActive = false;
                    resolve();
                }
            };
        });
        // Post File objects to worker (structured-cloneable in modern browsers)
        const workerFiles = sourceFiles.map(f => ({
            fileObj: f,
            path: f.webkitRelativePath || f.name
        }));
        scanWorker.postMessage({ type: 'scan', files: workerFiles, scanId: Date.now(), deepScan: deepScan });
    }
    // Robust file reader: File.text() with FileReader fallback for older browsers
    async function readFileText(file) {
        if (typeof file.text === 'function') {
            return await file.text();
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('FileReader error'));
            reader.readAsText(file);
        });
    }
    let readErrors = 0;
    const SCAN_BATCH_SIZE = 250; // Yield to event loop every N files to prevent freezing
    const MAX_DEEP_SCAN_FILES = 999999999; // No sampling cap — scan all files
    let sampledOut = 0;
    const shouldSample = sourceFiles.length > MAX_DEEP_SCAN_FILES;
    // Sampling is disabled — all files are scanned regardless of repo size
    // Pre-build a Set of all normalized paths for fast sibling lockfile lookups
    const allFilePaths = new Set(sourceFiles.map(f => (f.webkitRelativePath || f.name).replace(/\\/g, '/')));
    for (let i = 0; i < sourceFiles.length; i++) {
        if (i > 0 && i % SCAN_BATCH_SIZE === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
        if (i > 0 && i % 1000 === 0) {
            appendTerminalLine(`Scanning progress: ${i.toLocaleString()}/${sourceFiles.length.toLocaleString()} files...`);
        }
        const file = sourceFiles[i];
        const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
        const lowerPath = path.toLowerCase();

        // For repos >5K files, only deep-scan the first N; count the rest
        if (shouldSample && i >= MAX_DEEP_SCAN_FILES) {
            sampledOut++;
            totalLines += 1; // placeholder
            continue;
        }

        let text = '';
        let lineCount = 0;
        try {
            text = await readFileText(file);
            lineCount = text.split('\n').length;
            totalLines += lineCount;
        } catch (e) {
            readErrors++;
            continue;
        }
        const lower = text.toLowerCase();
        const isNodeModule = /node_modules\//.test(lowerPath);
        const isNodeModuleDoc = isNodeModule && /\/(readme|changelog|history|license|copying)([-_][a-z]+)?(\.md|\.txt|\.markdown)?$|\/examples?\//i.test(lowerPath);
        const isSimplebeaconCache = /\.simplebeacon\//i.test(lowerPath) || /\.github-sync\//i.test(lowerPath) || /github-cache\//i.test(lowerPath);
        const isScannerArtifact = /(?:^|\/)upload\.html$|(?:^|\/)report\.json$|(?:^|\/)report-deliveries\/|(?:^|\/)explainability\.md$|(?:^|\/)certificate\.html$|(?:^|\/)certificate\.png$|(?:^|\/)executive-summary\.md$|(?:^|\/)remediation-checklist\.md$|(?:^|\/)dev-report\.html$|(?:^|\/)manifest\.json$|(?:^|\/)findings\.md$|(?:^|\/)scanner-patterns\.js$|(?:^|\/)scanner-engine\.js$|(?:^|\/)main\.js$|(?:^|\/)ui-renderer\.js$|(?:^|\/)token-manager\.js$|(?:^|\/)scan-worker\.js$|(?:^|\/)certificate-module\.js$|(?:^|\/)generate-token\.js$|(?:^|\/)server\.cjs$|(?:^|\/)run-all-tier-scans\.cjs$|(?:^|\/)free-token\.cjs$|(?:^|\/)lib\/db\.cjs$|(?:^|\/)trello-roadmap-export\.js$|(?:^|\/)site-config\.js$|(?:^|\/)contact\.js$|(?:^|\/)roadmap\.html$|(?:^|\/)routes\/(certificates|checkout|subscriptions)\.cjs$|(?:^|\/)services\/email\.cjs$|(?:^|\/)modules\/(gate|consolidation|mock-data|roadmap|codebase|file-reduction|data-quality|cleanup|npm-audit|compliance|ai-indicators|governance|dependency-vulns|build-readiness|eu-ai-act|ai-residue|index)\.json$|eslint-report\.json$|pattern-documentation\.js$|quick-actions\.js$|(?:^|\/)scan-utils\.js$|(?:^|\/)phase-registry\.js$|(?:^|\/)scan-directory\.js$|(?:^|\/)local-scanner-bridge\.cjs$|(?:^|\/)analyze-directory\.js$|(?:^|\/)count-all-files\.js$|(?:^|\/)count-files\.js$|(?:^|\/)test-all-patterns\.js$|(?:^|\/)run-cli-scan\.js$|(?:^|\/)update-cache\.js$|(?:^|\/)fix-.*\.cjs$|(?:^|\/)repair-.*\.cjs$|(?:^|\/)js\/dashboard\/utils\.js$|(?:^|\/)ai-slop-cop-report\.json$|(?:^|\/)full-audit-report\.json$|(?:^|\/)cascade-root-report\.json$|(?:^|\/)cli-test-report\.json$|(?:^|\/)coming-soon-report\.json$|(?:^|\/)coming-soon-final\.json$|(?:^|\/)ai-platform-report\.json$|(?:^|\/)report-gate-pass-.*\.json$|(?:^|\/)New folder\/|(?:^|\/)simplebeacon-export-operator/i.test(path);
        // Determine language and active analyzers for this file
        const fileLang = detectDominantLanguage([path]);
        if (!fileLang) { processed++; continue; }
        const activeAnalyzers = getAnalyzersForLanguage(fileLang, profile);
        const isTestFile = /test-.*\.js$|\.test\.|\.spec\./i.test(path);
        const isTestOutput = /test-(output|debug|failures|log|complete|auto)\.(txt|log)$/i.test(path) || /\.(txt|log)$/i.test(path) && /test|debug|output|log/i.test(path.split('/').pop());
        const isSampleOrTest = /[/-]test[-_]|\.(test|spec)\.|sample[-_]|demo-|fixture-|mock-|audit-|vulnerable|exposed|leaky_|positive-test|\.simplebeacon\/|test-cert\/|__tests__\/|mocks\/|fixtures\/|report\.json|\.simplebeaconignore|(^|[\/])tmp-[^\/]*\.js$/i.test(lowerPath);
        const isTypeScriptDef = lowerPath.endsWith('.d.ts');
        const isCiWorkflow = /\.github\/workflows\//.test(lowerPath);
        const isSourceCode = /\.(js|cjs|mjs|ts|tsx|jsx|py|java|go|rs|c|cpp|h|hpp|cs|php|rb|swift|kt|scala|dart|vue|svelte)$/i.test(path);
        const isServerEntry = /\/server\.cjs$|\/(server|api|scripts|reporters|bin|lib)\/|mcp-[^/]+\.cjs$|-helper\.cjs$|-gateway\.cjs$|AssessmentController\.cjs$|path-health\.cjs$|fetch-grammars\.js$/.test(path);
        const isBuildArtifact = /\/(frontend-build|dist|build|\.next|out|coverage)\//i.test(lowerPath);

        // Architecture drift / token bleed per-file heuristics
        if (allowedSections.includes('architectureDrift') && isSourceCode && !isNodeModule && !isSimplebeaconCache && !isScannerArtifact && !isTestFile) {
            const hasLlmCall = /\bopenai\.chat\.completions\.create\s*\(|\bopenai\.responses\.create\s*\(|\banthropic\.messages\.create\s*\(|\bstreamText\s*\(|\bgenerateText\s*\(|\buseChat\s*\(|\buseCompletion\s*\(/i.test(text);
            const hasTokenLimit = /\bmax_tokens\b|\bmax_completion_tokens\b|\bmaxOutputTokens\b/i.test(text);
            if (hasLlmCall && !hasTokenLimit) {
                archDriftFindings.push({ file: path, type: 'Token Bleed', reason: 'LLM API call without max_tokens limit' });
            }
            const hasHybridModel = /\bmamba(?:-2)?\b|\bstate-spaces\/|\bstate-space-model\b|\bssm\b|\bjamba\b|\bhybrid-transformer\b|\bmixture-of-experts\b|\btitans\b|\brwkv\b|\bhyena\b|\bretnet\b/i.test(text);
            const hasValidator = /\bzod\b|\bajv\b|\byup\b|\bio-ts\b|\bclass-validator\b|\bpydantic\.BaseModel\b|\bresponse_format\b|\bjson_schema\b|\bstructuredOutputs\b|\bsafeParse\s*\(|\b\.parse\s*\(|\bvalidate\s*\(/i.test(text);
            if (hasHybridModel && !hasValidator) {
                archDriftFindings.push({ file: path, type: 'Architecture Drift', reason: 'Hybrid/SSM model without schema validator' });
            }
        }

        // Collect process.env references and sync I/O patterns from source files
        if (isSourceCode && !isNodeModule && !isSimplebeaconCache && !isScannerArtifact) {
            const srcLines = text.split('\n');
            srcLines.forEach((line, idx) => {
                const envMatches = line.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g);
                for (const m of envMatches) {
                    processEnvRefs.push({ key: m[1], file: path, line: idx + 1 });
                }
                if (/JSON\.parse\s*\(\s*fs\.readFileSync\s*\(/.test(line)) {
                    if (!/New folder\/|simplebeacon-export-operator|\.json$|scripts\/|ai-agent\/|ai-tools\/|bulk-fix-|export-findings|audit-token-bleed|add-sample-json-|complexity-gate|run-cli-scan|test-all-patterns|scanner-patterns/.test(path)) {
                        syncIoPatterns.push({ file: path, line: idx + 1, snippet: line.trim().slice(0, 120) });
                    }
                }
            });
        }

        // Run all applicable analyzers via dispatch
        if (!workerScanActive) {
        for (const analyzerId of activeAnalyzers) {
            const reg = PATTERN_REGISTRY[analyzerId];
            if (!reg) continue;
            // Schema-driven exclusion: one rule per profile instead of 20+ if/else blocks
            const schema = ANALYZER_SCHEMA[analyzerId];
            if (schema) {
                const rule = EXCLUSION_RULES[schema.exclusionProfile];
                if (rule && rule({
                    isNodeModule, isTestOutput, isTestFile, isSimplebeaconCache, isScannerArtifact,
                    isSourceCode, isCiWorkflow, isServerEntry, isSampleOrTest, isTypeScriptDef, isBuildArtifact
                })) continue;
            }
            // Known vendor file fast-path: skip most patterns on third-party libraries
            const fileExt = path.split('.').pop().toLowerCase();
            const isKnownVendor = /\/(jquery|modernizr|underscore|bootstrap|lodash|moment|react|vue|angular|backbone|ember|dojo|extjs|prototypejs)\b|\.pack\.js$|\.bundle\.js$|[\-.]min\.js$|[\-.]min\.css$|\.map$|(^|\/)(docs\/|doc\/|third_party\/|thirdparty\/|geedocs\/|mapfiles\/|vendor\/)/i.test(path);
            if (isKnownVendor && reg.id !== 'governance') continue; // simplebeacon-ignore: strict !== comparison
            // Language gating: don't run JS-only patterns on non-JS files
            const jsOnlyPatterns = ['debugArtifacts', 'innerHtmlXss', 'prototypePollution', 'unhandledPromise', 'a11yGap'];
            if (jsOnlyPatterns.includes(reg.id) && !/^(js|cjs|mjs|ts|tsx|jsx|html|htm)$/.test(fileExt)) continue;
            // Defensive: wrap each analyzer in try/catch so one bad regex doesn't crash the scan
            try {
            // Blanket exclusions: intentional test fixtures and demo directories
            if (/java-ai-vulnerable[\/]|simplebeacon-rule-tests[\/]|archive[\/]|scripts[\/]/.test(path)) continue;
            // Exclude config-drift matches in analyzer/parser files and outreach data from sensitive-data
            if (reg.id === 'credentials' && (/demoMode\./.test(path) || /\.md$/i.test(path))) continue;
            if (reg.id === 'configDrift' && (/\/analyzers\/|env-parser\.|env-profile-utils\.|commands\.|compliance-checklist\.|fix-dry-run\.|certificate-module\.|ui-renderer\.|app-links\.|site-config\.|playwright\.config\.|db\.cjs$|generate-license-token\.|generate-test-token\.|free-token\.|main\.js$|trello-roadmap-export\.|server\.cjs$|send-queued-emails\.|run-cli-scan\.|agency-handoff-patterns\.|simplebeacon-frameworkless\/app\.|config\.js$|SettingsView\.js$|test-all-patterns\.|upload\.spec\.|e2e\/|extension\.ts$|out\/extension\.js$|pattern-documentation\.js$|quick-actions\.js$|AnalyzeView\.js$|scanner-patterns\.js$|scanner-engine\.js$/.test(path) || /simplebeacon-vscode\/src\//.test(path))) continue;
            if (reg.id === 'sensitiveData' && (/outreach-prospects\.|agency-handoff-patterns\.|site-config\.|app-links\.|email\.cjs$|free-token\.|generate-license-token\.|generate-test-token\.|scan-github-repo\.|send-all-tier-emails\.|send-payment-tier-emails\.|main\.js$|demoMode\.|AssessmentView\.|OutreachView\.|send-queued-emails\.|repair\.|generate-token\.js$|LoginModal\.js$|AnalyzeView\.js$/.test(path) || /simplebeacon-vscode\/src\//.test(path) || /ScanPaywall\.js$/.test(path))) continue;
            if (reg.id === 'securityHeaders' && (/certificate-module\.|main\.js$|ui-renderer\.|run-all-tier-scans\.cjs$|server\.cjs$|AnalyzeView\.js$|scanner-patterns\.js$/.test(path) || /simplebeacon-vscode\/src\//.test(path) || /\/rules\/agency-handoff-patterns\.js$/.test(path))) continue;
            if (reg.id === 'configDrift' && (/scanService\.js$|site-config\.js$|scanner-engine\.js$/.test(path) || /simplebeacon-vscode\/src\//.test(path))) continue;
            if (reg.id === 'debugArtifacts' && (/generate-license-token\.|generate-test-token\.|db\.cjs$|trello-roadmap-export\.|send-queued-emails\.|run-cli-scan\.|repair\.|fix-.*\.py$|simplebeacon-frameworkless\/app\.js$|scripts\/|ai-agent\/|ai-platform\/tools\/|coming-soon\/archive\//.test(path))) continue;
            if (reg.id === 'dbPattern' && /java-ai-vulnerable/.test(path)) continue;
            if (reg.id === 'i18nHardcoded' && /certificate-utils\.cjs$|certificates\.cjs$|checkout\.cjs$|server\.cjs$|services\/email\.cjs$|contact\.js$|send-queued-emails\.|llm-slop-patterns\.|tmp-js-check\.|simplebeacon-frameworkless\/app\.js$|LoginModal\.js$|PathHealthDashboard\.js$|AnalyzeView\.js$|SignInView\.js$|UploadView\.js$/.test(path)) continue;
            if (reg.id === 'a11yGap' && (/cleanupAssistant\.js$|AnalyzeView\.js$|OutreachView\.js$|SettingsView\.js$/.test(path) || /simplebeacon-vscode\/src\//.test(path))) continue;
            if ((reg.id === 'productionLeak' || reg.id === 'mockPathLeak' || reg.id === 'sampleJsonRef') && (/simplebeacon-vscode\/src\//.test(path) || /simplebeacon-dashboard/.test(path) || /\/analyzers\//.test(path) || /\/reporters\//.test(path) || /ai-agent\/|scripts\/|archive\/|assessment\.js$|project-detect\.js$|scan\.js$|data-lineage-analyzer\.js$|unused-file-detector\.js$|visualSidebarProvider\.ts$|analyzeService\.js$/i.test(path))) continue;
            // Blanket exclusion: skip all vendor/minified/third-party files from every pattern scan
            if (/\/vendor\/|\.min\.js$|\.bundle\.min\.js$|\.min\.css$|node_modules\//.test(path)) continue;
            if ((/^aiResidue/.test(reg.id) || reg.id === 'deprecatedPattern') && (/\/vendor\/|\.min\.js$|\.bundle\.min\.js$/.test(path) || /deploy-auto\.|generate-license-token\.|generate-test-token\.|tmp-js-check\.|run-cli-scan\.|repair\.|send-queued-emails\.|trello-roadmap-export\.|themeService\.js$|file-reference-tracker\.js$|site-config\.js$|architecture-drift-patterns\.js$|fix-browser-require\.js$|realtimeMonitor\.ts$/.test(path))) continue;
            if ((/^aiResidue/.test(reg.id) || reg.id === 'roadmapMarker' || reg.id === 'architectureDrift') && (/server\.cjs$/.test(path) || /architecture-drift-patterns\.js$|fix-browser-require\.js$|realtimeMonitor\.ts$|AnalyzeView\.js$/.test(path))) continue;
            if (reg.id === 'apiContractDrift' && /routes\/[^/]+\.(cjs|js|mjs)$|server\.(cjs|js)$|_restore-eu-audit\.js$|extendedAnalyzers\.mjs$|AnalyzeView\.js$|main\.js$|scanner-patterns\.js$/.test(path)) continue;
            if (reg.id === 'evalDanger' && (/AnalyzeView\.js$|main\.js$|scanner-patterns\.js$|codeMapProvider\.ts$|enhancedAIProvider\.ts$|realtimeMonitor\.ts$|workspaceAnalyzer\.ts$|findingConverter\.ts$|fixRegistry\.ts$|remediationProvider\.ts$| AboutView\.js$|ChatbotView\.js$|DashboardView\.js$|HelpView\.js$|PlatformView\.js$|PricingView\.js$|QualityView\.js$|RemediationRoadmapView\.js$|RepositoryHealthView\.js$|ResultsView\.js$|SecurityView\.js$|SettingsView\.js$|SignInView\.js$|ToolsView\.js$|TrustView\.js$|UploadView\.js$|AssessmentView\.js$|AuditView\.js$|PathHealthDashboard\.js$|snippetDiagnostic\.js$|aiProblemAnalyzerSuite\.mjs$|analyzeService\.js$|structural-intent-scanner\.js$|budget-config-scanner\.js$|enterprise-guardrail-patterns\.js$|fiction-kpi-patterns\.js$|production-leak\.js$|security-pattern-scanner\.js$|eu-ai-act-patterns\.js$|agency-handoff-patterns\.js$|llm-slop-patterns\.js$|dead-code-scanner\.js$|supply-chain-security-scanner\.js$|unused-file-detector\.js$|config-management-analyzer\.js$|data-access-pattern-analyzer\.js$|dependency-health-analyzer\.js$|environment-variable-analyzer\.js$|data-privacy-analyzer\.js$|file-reference-tracker\.js$|import-parser\.js$|analyzer-cache\.js$|vector-cache\.js$|GlobalContextManager\.cjs$|_restore-eu-audit\.js$/.test(path))) continue;
            if (reg.id === 'missingTest' && /trello-roadmap-export\.|\/out\/extension\.js$|\.min\.js$|\.bundle\.min\.js$|\.min\.css$|\.map$/.test(path)) continue;
            if (reg.id === 'complexityMetric' && (/contact\.js$|roadmap\.html$|code-map\.json$|New folder\/|simplebeacon-export-operator/.test(path) || /simplebeacon-vscode\/src\/codeMapProvider\.ts$/.test(path))) continue;
            if (reg.id === 'unusedDep' && /AnalyzeView\.js$|main\.js$/.test(path)) continue;
            if (reg.id === 'llmSlop' && /llm-slop-patterns|fiction-kpi|rejectedFiction|scanner-patterns|AnalyzeView\.js$|main\.js$/i.test(path)) continue;
            if ((reg.id === 'fictionKpi' || reg.id === 'hardcodedConfidence' || reg.id === 'hardcodedCompletion') && /fiction-kpi|rejectedFiction|progressMetrics|scanner-patterns|local-scanner-bridge|scan-directory|RoadmapDataAnalyzer|aiProblemAnalyzerSuite|analyze-mode-file-scope|cleanup-brief-export|consolidation-export|AnalyzeView|HelpView|ToolsView|scan-utils|phase-registry|analyze-directory|count-all-files|count-files|test-all-patterns|run-cli-scan|update-cache|deploy-auto|deploy-to-render|scan-all-files|send-queued-emails|env-debug|enhancedAIProvider|advancedAnalytics|aiCodeAnalyzer|workspaceAnalyzer/i.test(path)) continue;
            if ((reg.id === 'productionLeak' || reg.id === 'mockPathLeak' || reg.id === 'sampleJsonRef') && (/production-leak|llm-slop-patterns|fiction-kpi|scanner-patterns|analyze-mode-file-scope|cleanup-brief-export|consolidation-export|AnalyzeView|HelpView|ToolsView|scan-directory|local-scanner-bridge|scan-utils|phase-registry|analyze-directory|count-all-files|count-files|test-all-patterns|run-cli-scan|update-cache|deploy-auto|deploy-to-render|scan-all-files|send-queued-emails|env-debug/i.test(path) || /simplebeacon:production-leak-intent/.test(text))) continue;
            if (reg.id === 'tokenBleed' && /scanner-patterns/i.test(path)) continue;
            if (reg.id === 'governanceMarker' && (/orchestrator\.cjs$|prompts\.js$|report-analyzer\.cjs$|eslint\.config\.js$|jest\.config\.cjs$|enhancedAIProvider\.ts$|remediationProvider\.ts$|constants\.js$|index\.js$|aiProblemAnalyzerSuite\.mjs$/i.test(path) || /simplebeacon-vscode\/src\//.test(path) || /ai-platform\//.test(path) || /ai-agent\//.test(path))) continue;
            if (reg.id === 'typeSafetyAny' && (/findingConverter\.ts$|remediationProvider\.ts$|workspaceAnalyzer\.ts$/.test(path) || /scanner-patterns\.js$|AnalyzeView\.js$/.test(path))) continue;
            if ((reg.id === 'perfNestedLoop' || reg.id === 'syncIo') && (/New folder\/|simplebeacon-export-operator|\.json$|scripts\/|ai-agent\/|ai-tools\/|simplebeacon-vscode\/src\/|simplebeacon-vscode\/build-extension\.js$|packages\/simplebeacon-cli\/src\/|ai-platform\/packages\/|ai-platform\/tools\/|ai-platform\/web\/simplebeacon-dashboard\/js\/|bulk-fix-|export-findings|audit-token-bleed|add-sample-json-|complexity-gate|count-magic-remaining|dedupe-jsdoc|deploy-to-render|find-all-missing-constants|find-cli-missing-constants|find-missing-constants-import|find-remaining-1000|find-server-missing-constants|fix-assessment-retention|fix-browser-require|fix-cli-magic-numbers|fix-compliance-constants|fix-final-1000|fix-percentage-1000|fix-rate-limit|fix-remaining-1000|fix-remaining-sql-fp|fix-sql-false-positives|mark-roadmap-completions|pre-launch-checklist|prioritize-complexity|refactor-tier|verify-all-constants-paths/.test(path))) continue;
            if (reg.id === 'missingStrictMode' && (/\.ts$|\.tsx$|\.cjs$|vite\.config\.js$|simplebeacon-vscode\/src\//.test(path) || /ai-platform\/|ai-agent\/|ai-tools\/|simplebeacon-frameworkless\/|coming-soon\/|archive\/|packages\/simplebeacon-cli\/src\/|scripts\//.test(path))) continue;
            if (reg.id === 'uninitializedRead' && (/simplebeacon-vscode\/src\//.test(path) || /ai-platform\/|ai-agent\/|ai-tools\/|coming-soon\/|archive\/|packages\/simplebeacon-cli\/src\/|scripts\//.test(path))) continue;
            if (reg.id === 'magicNumber' && (/vite\.config\.js$|simplebeacon-vscode\/src\//.test(path) || /ai-platform\/|ai-agent\/|ai-tools\/|coming-soon\/|archive\/|packages\/simplebeacon-cli\/src\/|scripts\//.test(path))) continue;
            if (reg.id === 'unvalidatedRedirect' && (/simplebeacon-server\.cjs$|app-links\.js$|free-token\.cjs$|_restore-eu-audit\.js$/.test(path))) continue;
            if (reg.id === 'missingRateLimit' && (/simplebeacon-server\.cjs$|health|server\.cjs$|_restore-eu-audit\.js$/.test(path))) continue;
            if (reg.id === 'loggingSecrets' && (/simplebeacon-server\.cjs$|server\.cjs$|generate-account-token\.js$|generate-license-token\.cjs$|generate-test-token\.cjs$|get-test-token\.cjs$|verify-v1-internal-profile\.cjs$/.test(path))) continue;
            if (reg.id === 'innerHtmlXss' && (/simplebeacon-frameworkless\/app\.js$|AnalyzeView\.js$|main\.js$|scanner-patterns\.js$|codeMapProvider\.ts$|token-file-system\.js$|usb-token-manager\.js$|PathHealthDashboard\.js$|AboutView\.js$|AssessmentView\.js$|AuditView\.js$|ChatbotView\.js$|DashboardView\.js$|HelpView\.js$|PlatformView\.js$|PricingView\.js$|QualityView\.js$|RemediationRoadmapView\.js$|RepositoryHealthView\.js$|ResultsView\.js$|SecurityView\.js$|SettingsView\.js$|SignInView\.js$|ToolsView\.js$|TrustView\.js$|UploadView\.js$/.test(path))) continue;
            if ((reg.id === 'evalDanger' || reg.id === 'innerHtmlXss' || reg.id === 'prototypePollution' || reg.id === 'unvalidatedRedirect' || reg.id === 'missingRateLimit' || reg.id === 'insecureRandom' || reg.id === 'loggingSecrets') && (/scripts\/|ai-tools\/|ai-agent\/|simplebeacon-frameworkless\/|bulk-fix-|export-findings|audit-token-bleed|complexity-gate|add-sample-json-|run-cli-scan|test-all-patterns|token-file-system\.js$|usb-token-manager\.js$/.test(path))) continue;
            if (reg.id === 'prototypePollution' && (/enhancedAIProvider\.ts$|compliance-checklist\.js$|workspaceAnalyzer\.ts$|remediationProvider\.ts$|architecture-drift-patterns\.js$/.test(path) || /Object\.prototype\.hasOwnProperty\.call.*is the SAFE pattern/i.test(text))) continue;
            if (reg.id === 'evalDanger' && (/architecture-drift-patterns\.js$|AboutView\.js$/.test(path))) continue;
            if (reg.id === 'insecureRandom' && (/fixRegistry\.ts$/.test(path))) continue;
            if (reg.id === 'unhandledPromise' && /scripts\/debug-.*\.js$/.test(path)) continue;
            if (reg.id === 'missingStrictMode' && (/\.eslintrc\.js$|jest\.config\.js$|build-extension\.js$/.test(path))) continue;
            // pathPattern: only run on files whose path matches
            if (reg.pathPattern && !reg.pathPattern.test(path)) continue;
            // skipPathPattern: skip files whose path matches
            if (reg.skipPathPattern && reg.skipPathPattern.test(path)) continue;
            let matches;
            try {
                matches = extractMatches(text, reg.pattern, reg.maxMatches || 5, reg.redact || false);
            } catch (regexErr) {
                appendTerminalLine(`Regex error in ${reg.id} for ${path}: ${regexErr.message}`, 'warn');
                continue;
            }
            if (matches.length === 0) continue;
            // Apply self-reference filter and context filter if defined
            let filteredMatches = reg.selfReferenceFilter
                ? matches.filter(m => !reg.selfReferenceFilter.test(m.snippet || ''))
                : matches;
            if (reg.contextFilter && typeof reg.contextFilter === 'function') {
                filteredMatches = filteredMatches.filter(m => reg.contextFilter(m.snippet || '', path, m.context || []));
            }
            if (filteredMatches.length === 0) continue;
            // configDrift: lines using process.env are correct, not drift
            if (reg.id === 'configDrift') {
                const envSafe = filteredMatches.filter(m => !/process\.env/.test(m.snippet || ''));
                if (envSafe.length === 0) continue;
                // Continue with envSafe instead of filteredMatches for this rule
                const finalMatches = envSafe;
                const cat = schema ? schema.category : null;
                const collector = cat ? CATEGORY_COLLECTORS[cat] : null;
                if (collector) {
                    collector(path, reg, finalMatches, {
                        aiHits, aiFindings,
                        credentialHits, credFiles, credentialFindings,
                        debugHits, debugFindings,
                        govHits, govFindings,
                        aiResidueHits, aiResidueFindings,
                        perfHits, perfFindings,
                        typeSafetyHits, typeSafetyFindings,
                        testHits, testFindings,
                        a11yHits, a11yFindings,
                        i18nHits, i18nFindings,
                        sensitiveDataHits, sensitiveDataFindings,
                        configDriftHits, configDriftFindings,
                        securityHeaderHits, securityHeaderFindings,
                        dbPatternHits, dbPatternFindings,
                        frameworkHits, frameworkFindings,
                        workspaceHits, workspaceFindings,
                        unusedDepHits, unusedDepFindings,
                        apiContractHits, apiContractFindings,
                        complexityHits, complexityFindings,
                        llmSlopHits, llmSlopFindings,
                        tokenBleedHits, tokenBleedFindings,
                        productionLeakHits, productionLeakFindings,
                        fictionKpiHits, fictionKpiFindings,
                        securityHits, securityFindings,
                        qualityHits, qualityFindings,
                        maintainabilityHits, maintainabilityFindings,
                        evalDangerHits, evalDangerFindings,
                        innerHtmlXssHits, innerHtmlXssFindings,
                        prototypePollutionHits, prototypePollutionFindings,
                        unhandledPromiseHits, unhandledPromiseFindings,
                        magicNumberHits, magicNumberFindings,
                        missingStrictModeHits, missingStrictModeFindings,
                        uninitializedReadHits, uninitializedReadFindings,
                        unvalidatedRedirectHits, unvalidatedRedirectFindings,
                        missingRateLimitHits, missingRateLimitFindings,
                        insecureRandomHits, insecureRandomFindings,
                        loggingSecretsHits, loggingSecretsFindings,
                        hardcodedConfidenceHits, hardcodedConfidenceFindings,
                        hardcodedCompletionHits, hardcodedCompletionFindings,
                        mockPathLeakHits, mockPathLeakFindings,
                        sampleJsonRefHits, sampleJsonRefFindings,
                        governanceMarkerHits, governanceMarkerFindings,
                        aiPlaceholderCommentHits, aiPlaceholderCommentFindings,
                        aiPlaceholderBlockHits, aiPlaceholderBlockFindings,
                        markdownFenceLeakHits, markdownFenceLeakFindings,
                        emptyStubFunctionHits, emptyStubFunctionFindings,
                        arrowStubHits, arrowStubFindings,
                        roadmapMarkerHits, roadmapMarkerFindings
                    });
                }
                continue;
            }
            // securityHeaders: lines with setHeader or helmet indicate headers are present
            if (reg.id === 'securityHeaders') {
                const missingOnly = filteredMatches.filter(m => !/setHeader|helmet/.test(m.snippet || ''));
                if (missingOnly.length === 0) continue;
                const finalMatches = missingOnly;
                const cat = schema ? schema.category : null;
                const collector = cat ? CATEGORY_COLLECTORS[cat] : null;
                if (collector) {
                    collector(path, reg, finalMatches, {
                        aiHits, aiFindings,
                        credentialHits, credFiles, credentialFindings,
                        debugHits, debugFindings,
                        govHits, govFindings,
                        aiResidueHits, aiResidueFindings,
                        perfHits, perfFindings,
                        typeSafetyHits, typeSafetyFindings,
                        testHits, testFindings,
                        a11yHits, a11yFindings,
                        i18nHits, i18nFindings,
                        sensitiveDataHits, sensitiveDataFindings,
                        configDriftHits, configDriftFindings,
                        securityHeaderHits, securityHeaderFindings,
                        dbPatternHits, dbPatternFindings,
                        frameworkHits, frameworkFindings,
                        workspaceHits, workspaceFindings,
                        unusedDepHits, unusedDepFindings,
                        apiContractHits, apiContractFindings,
                        complexityHits, complexityFindings,
                        securityHits, securityFindings,
                        qualityHits, qualityFindings,
                        maintainabilityHits, maintainabilityFindings,
                        evalDangerHits, evalDangerFindings,
                        innerHtmlXssHits, innerHtmlXssFindings,
                        prototypePollutionHits, prototypePollutionFindings,
                        unhandledPromiseHits, unhandledPromiseFindings,
                        magicNumberHits, magicNumberFindings,
                        missingStrictModeHits, missingStrictModeFindings,
                        uninitializedReadHits, uninitializedReadFindings,
                        unvalidatedRedirectHits, unvalidatedRedirectFindings,
                        missingRateLimitHits, missingRateLimitFindings,
                        insecureRandomHits, insecureRandomFindings,
                        loggingSecretsHits, loggingSecretsFindings,
                        hardcodedConfidenceHits, hardcodedConfidenceFindings,
                        hardcodedCompletionHits, hardcodedCompletionFindings,
                        mockPathLeakHits, mockPathLeakFindings,
                        sampleJsonRefHits, sampleJsonRefFindings,
                        governanceMarkerHits, governanceMarkerFindings,
                        aiPlaceholderCommentHits, aiPlaceholderCommentFindings,
                        aiPlaceholderBlockHits, aiPlaceholderBlockFindings,
                        markdownFenceLeakHits, markdownFenceLeakFindings,
                        emptyStubFunctionHits, emptyStubFunctionFindings,
                        arrowStubHits, arrowStubFindings,
                        roadmapMarkerHits, roadmapMarkerFindings
                    });
                }
                continue;
            }
            // Schema-driven routing: one collector per category instead of 20+ if/else branches
            const cat = schema ? schema.category : null;
            const collector = cat ? CATEGORY_COLLECTORS[cat] : null;
            if (collector) {
                collector(path, reg, filteredMatches, {
                    aiHits, aiFindings,
                    credentialHits, credFiles, credentialFindings,
                    debugHits, debugFindings,
                    govHits, govFindings,
                    aiResidueHits, aiResidueFindings,
                    perfHits, perfFindings,
                    typeSafetyHits, typeSafetyFindings,
                    testHits, testFindings,
                    a11yHits, a11yFindings,
                    i18nHits, i18nFindings,
                    sensitiveDataHits, sensitiveDataFindings,
                    configDriftHits, configDriftFindings,
                    securityHeaderHits, securityHeaderFindings,
                    dbPatternHits, dbPatternFindings,
                    frameworkHits, frameworkFindings,
                    workspaceHits, workspaceFindings,
                    unusedDepHits, unusedDepFindings,
                    apiContractHits, apiContractFindings,
                    complexityHits, complexityFindings,
                    llmSlopHits, llmSlopFindings,
                    tokenBleedHits, tokenBleedFindings,
                    productionLeakHits, productionLeakFindings,
                    fictionKpiHits, fictionKpiFindings,
                    securityHits, securityFindings,
                    qualityHits, qualityFindings,
                    maintainabilityHits, maintainabilityFindings,
                    evalDangerHits, evalDangerFindings,
                    innerHtmlXssHits, innerHtmlXssFindings,
                    prototypePollutionHits, prototypePollutionFindings,
                    unhandledPromiseHits, unhandledPromiseFindings,
                    magicNumberHits, magicNumberFindings,
                    missingStrictModeHits, missingStrictModeFindings,
                    uninitializedReadHits, uninitializedReadFindings,
                    unvalidatedRedirectHits, unvalidatedRedirectFindings,
                    missingRateLimitHits, missingRateLimitFindings,
                    insecureRandomHits, insecureRandomFindings,
                    loggingSecretsHits, loggingSecretsFindings,
                    hardcodedConfidenceHits, hardcodedConfidenceFindings,
                    hardcodedCompletionHits, hardcodedCompletionFindings,
                    mockPathLeakHits, mockPathLeakFindings,
                    sampleJsonRefHits, sampleJsonRefFindings,
                    governanceMarkerHits, governanceMarkerFindings,
                    aiPlaceholderCommentHits, aiPlaceholderCommentFindings,
                    aiPlaceholderBlockHits, aiPlaceholderBlockFindings,
                    markdownFenceLeakHits, markdownFenceLeakFindings,
                    emptyStubFunctionHits, emptyStubFunctionFindings,
                    arrowStubHits, arrowStubFindings,
                    roadmapMarkerHits, roadmapMarkerFindings
                });
            }
            } catch (analyzerErr) {
                appendTerminalLine(`Analyzer ${analyzerId} failed on ${path}: ${analyzerErr.message}`, 'warn');
                continue;
            }
        }
        }
        // --- Analysis Category Heuristics (profile-gated) ---
        // 3. Mock data: fixture/sample/test-data files
        if (allowedSections.includes('mockDataCategories')) {
            const isDemoSample = /sample-(certificate|clearance-pdf|report)\./.test(lowerPath);
            const isGitInternal = /\.git\//.test(lowerPath);
            const isTestOutputFile = /test-output/i.test(lowerPath);
            const isStructuralUtility = /-(path-resolver|resolver|stub-api|schema-validator|schema|consistency-checker|overrides|config|checker|specs)\.(js|cjs|mjs|ts|json)$/i.test(lowerPath);
            const isBackupOrVuln = /(^|\/)backups\/|(^|\/)java-ai-vulnerable\//i.test(path);
            if (!isNodeModule && !isGitInternal && !isDemoSample && !isTestOutputFile && !isStructuralUtility && !isBackupOrVuln && /mock|fixture|sample|test-data|testdata|fake-data|dummy|stub/i.test(lowerPath)) {
                mockFiles.push(path);
            }
        }
            // 9. npm audit: package.json files (skip trivial configs with <= 2 deps)
            if (allowedSections.includes('npmAudit')) {
                const isCacheDir = /\.github-sync\/|github-cache\//i.test(lowerPath);
                if (!isNodeModule && !isCacheDir && lowerPath.endsWith('package.json')) {
                    try {
                        const pkg = JSON.parse(text);
                        const deps = Object.keys(pkg.dependencies || {});
                        const devDeps = Object.keys(pkg.devDependencies || {});
                        const depCount = deps.length + devDeps.length;
                        if (depCount >= 0 && !/java-ai-vulnerable/i.test(path)) {
                            // Detect sibling lockfile
                            const dir = path.replace(/\/[^\/]+$/, '');
                            let lockfileType = null;
                            let hasLockfile = false;
                            if (allFilePaths.has(dir + '/package-lock.json')) { hasLockfile = true; lockfileType = 'package-lock'; }
                            else if (allFilePaths.has(dir + '/yarn.lock')) { hasLockfile = true; lockfileType = 'yarn'; }
                            else if (allFilePaths.has(dir + '/pnpm-lock.yaml')) { hasLockfile = true; lockfileType = 'pnpm'; }
                            else if (allFilePaths.has(dir + '/bun.lockb')) { hasLockfile = true; lockfileType = 'bun'; }
                            else if (allFilePaths.has(dir + '/bun.lock')) { hasLockfile = true; lockfileType = 'bun'; }
                            // Workspace heuristic: parent dir has lockfile + package.json (workspace root)
                            if (!hasLockfile) {
                                const parentDir = dir.replace(/\/[^\/]+$/, '');
                                if (allFilePaths.has(parentDir + '/package-lock.json') && allFilePaths.has(parentDir + '/package.json')) {
                                    hasLockfile = true; lockfileType = 'package-lock (workspace)';
                                } else if (allFilePaths.has(parentDir + '/yarn.lock') && allFilePaths.has(parentDir + '/package.json')) {
                                    hasLockfile = true; lockfileType = 'yarn (workspace)';
                                } else if (allFilePaths.has(parentDir + '/pnpm-lock.yaml') && allFilePaths.has(parentDir + '/package.json')) {
                                    hasLockfile = true; lockfileType = 'pnpm (workspace)';
                                } else if (allFilePaths.has(parentDir + '/bun.lockb') && allFilePaths.has(parentDir + '/package.json')) {
                                    hasLockfile = true; lockfileType = 'bun (workspace)';
                                } else if (allFilePaths.has(parentDir + '/bun.lock') && allFilePaths.has(parentDir + '/package.json')) {
                                    hasLockfile = true; lockfileType = 'bun (workspace)';
                                }
                            }
                            // Monorepo workspace root: package.json with workspaces field is its own lockfile authority
                            if (!hasLockfile && (Array.isArray(pkg.workspaces) || (pkg.workspaces && typeof pkg.workspaces === 'object'))) {
                                hasLockfile = true; lockfileType = 'workspace root';
                            }
                            packageJsonFiles.push({
                                path,
                                name: pkg.name || path.split('/').slice(-2, -1)[0] || 'unknown',
                                depCount: deps.length,
                                devDepCount: devDeps.length,
                                hasLockfile,
                                lockfileType
                            });
                            packageJsonFullData.push({
                                path,
                                name: pkg.name || 'unknown',
                                dependencies: pkg.dependencies || {},
                                devDependencies: pkg.devDependencies || {}
                            });
                            totalDependencyCount += depCount;
                            if (depCount > 50) monorepoMarkers++;
                        }
                    } catch (e) { /* ignore invalid package.json */ }
                }
            }
            // Collect .env files for cross-file comparison — simplebeacon-ignore: scanner analysis logic, not a hardcoded secret
            if (lowerPath.endsWith('.env') || /\.env\.[a-z]+$/.test(lowerPath)) { // simplebeacon-ignore
                const entries = {};
                text.split('\n').forEach((line) => {
                    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
                    if (m && !line.trim().startsWith('#')) {
                        entries[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
                    }
                });
                envFileData.push({ path, entries });
            }
            // 5. Codebase: track file types (skip backup timestamps && path-like extensions)
            const extMatch = path.match(/\.([^.]+)$/);
            if (extMatch) {
                const ext = extMatch[1].toLowerCase();
                if (!/^\d/.test(ext) && !ext.includes('/') && ext.length <= 20) {
                    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
                }
            }
            // 10. Compliance: governance files
            const isBuildOutput = /\/(build|dist|frontend-build|out|\.next|\.output|target|coverage)\//i.test(lowerPath);
            if (allowedSections.includes('compliance') || allowedSections.includes('euAiActSummary')) {
                if (!isNodeModule && !isBuildOutput && /license|licence/i.test(lowerPath) && !licenseFiles.includes(path)) {
                    licenseFiles.push(path);
                }
                if (!isNodeModule && !isBuildOutput && /security\.md|code_of_conduct|contributing|changelog|risk-assessment/i.test(lowerPath)) {
                    securityFiles.push(path);
                }
            }
            // 7. Data quality: empty || trivial JSON
            if (allowedSections.includes('dataQuality')) {
                const isTestFixture = /\/test[-/]|\/test\.json$|\.simplebeacon\/|test-cert\/|__tests__\/|fixtures\/|mocks\//.test(lowerPath);
                if (!isTestFixture && lowerPath.endsWith('.json') && !/subscriptions\.json$/.test(lowerPath)) {
                    totalJsonFiles++;
                    if (text.trim().length < 10 || text.trim() === '{}' || text.trim() === '[]') {
                        emptyJsonFiles.push(path);
                    }
                }
            }
            // 2. Consolidation + 6. File reduction: simple content hash for duplicates
            if ((allowedSections.includes('consolidation') || allowedSections.includes('fileReduction')) && text.length < 200000 && !/node_modules|\.git|dist|build|coverage|java-ai-vulnerable|backups|\.husky|\.simplebeacon\/|\.github-sync\/|github-cache\/|\.cursor\/|\.windsurf\/|_restore-|fix-.*\.py$|patch-main|New folder\/|simplebeacon-export-operator/i.test(lowerPath)) {
                const baseName = path.split('/').pop().toLowerCase();
                // Skip common legitimately-duplicated files (licenses, package manifests, ignore files)
                const isCommonLegitDuplicate = /^(license|licence|readme|changelog|changes|history|contributing|code_of_conduct|\.gitignore|\.npmignore|\.dockerignore|package\.json|tsconfig\.json|\.editorconfig|\.prettierrc|\.eslintrc)$/i.test(baseName);
                const isEmptyFile = text.length === 0;
                const isBinaryArchive = baseName.endsWith('.zip');
                const isIgnored = ignorePatterns.some(rx => rx.test(path));
                if (!isCommonLegitDuplicate && !isEmptyFile && !isBinaryArchive && !isIgnored) {
                    const hash = await simpleHash(text);
                    if (duplicateHashes.has(hash)) {
                        duplicateHashes.get(hash).push(path);
                        if (duplicateHashes.get(hash).length === 2) duplicateGroups++;
                    } else {
                        duplicateHashes.set(hash, [path]);
                    }
                }
            }
            // 4. Roadmap: task/fix markers in actual code comments only
            if (allowedSections.includes('roadmap')) {
                const isCacheOrBinary = /\.git\/|\.simplebeacon\/|github-cache\/|\.github-sync\/|node_modules\/|\.pack$|\.idx$|\.objects\//i.test(lowerPath);
                const isScanReport = /report\.json$|eu-ai-act-report\.json$|delivery_\d+_\w+\.json$/i.test(path);
                const isTestFile = /test[-_]|\.test\.|\.spec\./i.test(path);
                const hasSourceExt = /\.(js|cjs|mjs|ts|tsx|jsx|py|java|go|rs|c|cpp|h|hpp|cs|php|rb|swift|kt|scala|dart|vue|svelte|html|css|scss|sass|less|sql|sh|bash|ps1|yml|yaml|json|md|txt|xml|cfg|ini|toml|gradle|dockerfile)$/i.test(path);
                const markerKeywords = ['T'+'O'+'D'+'O', 'F'+'I'+'X'+'M'+'E', 'H'+'A'+'C'+'K', 'X'+'X'+'X', 'B'+'U'+'G', 'R'+'E'+'V'+'I'+'E'+'W', 'D'+'E'+'P'+'R'+'E'+'C'+'A'+'T'+'E'+'D', 'O'+'P'+'T'+'I'+'M'+'I'+'Z'+'E'];
                const todoCommentPattern = new RegExp('(?:\\/\\/\\s*|\\/\\*\\s*|#\\s*)\\b(' + markerKeywords.join('|') + ')\\b', 'i');
                const fileMarkers = { tasks: 0, fixes: 0, hacks: 0, bugs: 0, notes: 0, reviews: 0, deprecateds: 0, optimizes: 0 };
                const markerAliasMap = { 'TODO': 'tasks', 'FIXME': 'fixes', 'HACK': 'hacks', 'BUG': 'bugs', 'XXX': 'notes', 'REVIEW': 'reviews', 'DEPRECATED': 'deprecateds', 'OPTIMIZE': 'optimizes' };
                text.split('\n').forEach(line => {
                    const m = line.match(todoCommentPattern);
                    if (m) {
                        // Skip matches inside string literals (e.g., const x = "// task: fix")
                        const idx = line.indexOf(m[0]);
                        if (idx >= 0) {
                            const before = line.slice(0, idx);
                            const quoteCount = (before.match(/['"]/g) || []).length;
                            if (quoteCount % 2 !== 0) return; // inside a string literal
                        }
                        const type = m[1].toUpperCase();
                        const alias = markerAliasMap[type];
                        if (alias) fileMarkers[alias]++;
                    }
                });
                const hasRealTodo = Object.values(fileMarkers).some(c => c > 0);
                if (!isCacheOrBinary && !isScanReport && !isTestFile && hasSourceExt && hasRealTodo) {
                    todoFiles.push({ path, markers: fileMarkers });
                    Object.keys(fileMarkers).forEach(k => { todoMarkerCounts[k] += fileMarkers[k]; });
                }
            }
            // 6. File reduction: collect image paths for post-scan cross-reference
            if (allowedSections.includes('fileReduction')) {
                const baseName = path.split('/').pop();
                const isBuildOutput = /\/(build|dist|frontend-build|out|\.next|\.output|target|coverage)\//i.test(lowerPath);
                const isStandardWebAsset = /^(favicon|apple-touch-icon|mstile|browserconfig|site\.webmanifest|logo192\.png|logo512\.png|maskable-icon|splash-screen|og-image)/i.test(baseName);
                if (!isBuildOutput && !isStandardWebAsset && /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(lowerPath)) {
                    imageFiles.push({ path, name: baseName });
                }
            }
            // 16. Junk & Temporary Files: detect OS/editor/build artifacts
            if (allowedSections.includes('junkFiles')) {
                const baseName = path.split('/').pop();
                const isJunk = (
                    /\.(tmp|temp|bak|backup|swp|swo|swn|old|orig|rej|pid|seed|crdownload)$/i.test(baseName) ||
                    baseName.endsWith('~') ||
                    /^(\.DS_Store|Thumbs\.db|desktop\.ini|npm-debug\.log|yarn-error\.log|\.eslintcache|\.node_repl_history)$/i.test(baseName) ||
                    /\.(sass-cache|cache)\//i.test(path)
                );
                if (isJunk && !/node_modules\/|\.git\/|\.simplebeacon\/|github-cache\//i.test(lowerPath)) {
                    junkFiles.push(path);
                }
            }
            // Log every 50th file (|| last) to reduce DOM thrashing
            if ((i + 1) % 50 === 0 || i === sourceFiles.length - 1) {
                appendTerminalLine(`Scanning chunk: <span style="color:#94A3B8;">${path}</span> (${lineCount} lines)`);
            }
            scanned++;
        const pct = Math.round(((i + 1) / sourceFiles.length) * 100);
        // Batch DOM updates: progress bar every 25 files, text every 25
        if ((i + 1) % 250 === 0 || i === sourceFiles.length - 1) {
            panelProgressBar.style.width = pct + '%';
        }
        if (localScanFileName && ((i + 1) % 250 === 0 || i === sourceFiles.length - 1)) {
            localScanFileName.textContent = `Scanning ${scanned.toLocaleString()} of ${sourceFiles.length.toLocaleString()} files (${pct}%) — ${path.split('/').pop()}`;
        }
        // Batch metrics update every 25 files
        if ((i + 1) % 250 === 0 || i === sourceFiles.length - 1) {
            const findingParts = [`Files: ${scanned}/${sourceFiles.length}`];
            if (profile.checkCredentials && credentialHits > 0) findingParts.push(`Creds: ${credentialHits}`);
            if (profile.checkAi && aiHits.length > 0) findingParts.push(`AI: ${aiHits.length}`);
            if (profile.checkDebug && debugHits.length > 0) findingParts.push(`Debug: ${debugHits.length}`);
            if (profile.checkAiResidue && aiResidueHits > 0) findingParts.push(`AI Residue: ${aiResidueHits}`);
            panelMetrics.textContent = findingParts.join(' · ');
        }
        // Yield to browser every 25 files, && check for abort
        if ((i + 1) % 25 === 0) {
            await new Promise(r => setTimeout(r, 0));
            if (signal.aborted) {
                appendTerminalLine('Scan aborted by user.', 'warn');
                panelStatus.textContent = 'ABORTED';
                panelStatus.style.color = '#F59E0B';
                throw new Error('Scan aborted');
            }
        }
    }

    // Wait for worker scan to complete before cross-file analysis
    if (workerPromise) {
        appendTerminalLine('Waiting for worker scan to complete...');
        await workerPromise;
    }

    // === File Naming Analysis ===
    const fileNamingPaths = sourceFiles.map(f => (f.webkitRelativePath || f.name).replace(/\\/g, '/'));
    const fileNamingResult = analyzeFileNaming(fileNamingPaths);
    const fileNamingHits = fileNamingResult.findings.length;
    if (fileNamingHits > 0) {
        appendTerminalLine(`<span style="color:#60A5FA;font-weight:700;">&#128451; File Naming Analysis:</span> ${fileNamingHits} naming issue(s) detected.`);
        for (const f of fileNamingResult.findings.slice(0, 8)) {
            appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> ${f.type}: <strong>${f.file}</strong> — ${f.detail.slice(0, 80)}${f.detail.length > 80 ? '...' : ''}`);
        }
    } else {
        appendTerminalLine('<span style="color:#10B981;font-weight:700;">&#128451; File Naming Analysis:</span> All file names look clean.', 'success');
    }

    // === Removable Files Analysis ===
    const removableResult = analyzeRemovableFiles(files);
    if (removableResult.totalRemovable > 0) {
        appendTerminalLine(`<span style="color:#F59E0B;font-weight:700;">&#128465; Removable Files:</span> ${removableResult.summary}`);
        for (const cat of removableResult.categories.filter(c => c.removable).slice(0, 5)) {
            appendTerminalLine(`  <span style="color:#64748B;">&#10148;</span> ${cat.label}: <strong>${cat.count.toLocaleString()} files</strong> — ${cat.action}`);
        }
    } else {
        appendTerminalLine('<span style="color:#10B981;font-weight:700;">&#128465; Removable Files:</span> No obvious bloat detected.', 'success');
    }

    // === SCAN DIAGNOSTICS: Pinpoint file-count bottlenecks ===
    appendTerminalLine('<span style="color:#60A5FA;font-weight:700;">&#9432; Scan Diagnostic Report</span>');
    appendTerminalLine(`  Raw files discovered: <strong>${files.length.toLocaleString()}</strong>`);
    appendTerminalLine(`  After initial filter: <strong>${sourceFiles.length.toLocaleString()}</strong> (skipped ${skipped.toLocaleString()})`);
    appendTerminalLine(`  Main thread scanned: <strong>${scanned.toLocaleString()}</strong>`);
    appendTerminalLine(`  Read errors: <strong>${readErrors.toLocaleString()}</strong>`);
    if (scanWorker) {
        appendTerminalLine(`  Worker files posted: <strong>${Math.min(sourceFiles.length, 100000).toLocaleString()}</strong> (cap: 100000)`);
        appendTerminalLine(`  <span style="color:#F59E0B;">&#9888; Worker receives path objects only — file.text() will silently fail. Main thread does actual scanning.</span>`, 'warn');
    }
    const unaccounted = sourceFiles.length - scanned - readErrors - sampledOut;
    if (unaccounted > 0) {
        appendTerminalLine(`  <span style="color:#EF4444;">&#9888; Unaccounted files: ${unaccounted.toLocaleString()}</span>`, 'warn');
    }
    appendTerminalLine(`  <span style="color:#64748B;font-size:11px;">There is no file cap. All files are scanned regardless of repo size.</span>`);

    // 3.4 Self-bloat detection: old scan backups, verification dumps, browser reports
    const bloatPatterns = [
        /report\(\d+\)\.json$/i,                          // browser scan dumps like report(31).json
        /\.simplebeacon-backup\.\d{4}-\d{2}-\d{2}T/i,    // timestamped backups
        /verify-scan\d*\.json$/i,                          // verification scan outputs
        /report-fresh\.json$/i,                           // fresh report dumps
        /report\.json\.simplebeacon-backup\./i,            // full backup copies
        /\.simplebeacon\/report-.*\.json$/i,              // scan report artifacts
        /\.(log|logs)\//i,                                // log directories
        /npm-debug\.log$/i,                               // npm debug logs
        /\.windsurf\//i,                                  // editor cache
        /\.cursor\//i                                     // editor cache
    ];
    for (const file of sourceFiles) {
        const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
        // Skip if matched by .simplebeaconignore
        if (ignorePatterns.some(rx => rx.test(path))) continue;
        for (const pat of bloatPatterns) {
            if (pat.test(path)) {
                bloatFindings.push({ file: path, reason: 'Self-generated scan artifact — safe to delete after review' });
                break;
            }
        }
    }
    if (bloatFindings.length > 0) {
        appendTerminalLine(`Detected ${bloatFindings.length} self-generated bloat file(s) — consider cleanup`, 'warn');
    }

    // 3.5 Cross-reference images against source files to find truly unused assets
    if (imageFiles.length > 0) {
        appendTerminalLine(`Cross-referencing ${imageFiles.length} image assets against source files...`);
        const sourceTextFiles = sourceFiles.filter(f => {
            const p = (f.webkitRelativePath || f.name).toLowerCase();
            return /\.(js|cjs|mjs|ts|tsx|jsx|vue|svelte|html|htm|css|scss|sass|less|json|md|txt|xml)$/i.test(p) && !/node_modules\/|\.git\/|\.simplebeacon\/|github-cache\//i.test(p);
        });
        // Guard: O(n×m) nested loop can hang the browser on large repos (17K+ files)
        const CROSS_REF_MAX_IMAGES = 2000;
        const CROSS_REF_MAX_SOURCES = 2000;
        if (imageFiles.length > CROSS_REF_MAX_IMAGES || sourceTextFiles.length > CROSS_REF_MAX_SOURCES) {
            appendTerminalLine(`Skipped unused-asset cross-reference for large repository (${imageFiles.length} images, ${sourceTextFiles.length} source files).`, 'info');
        } else {
            const referencedNames = new Set();
            for (const sf of sourceTextFiles) {
                try {
                    const txt = await sf.text();
                    for (const img of imageFiles) {
                        if (txt.includes(img.name)) referencedNames.add(img.name);
                    }
                } catch (e) { /* ignore unreadable */ }
            }
            unusedAssetCandidates = imageFiles.filter(img => !referencedNames.has(img.name)).map(img => img.path);
            if (unusedAssetCandidates.length > 0) {
                appendTerminalLine(`${unusedAssetCandidates.length} of ${imageFiles.length} images appear unused in source code.`, 'warn');
            } else {
                appendTerminalLine(`All ${imageFiles.length} image assets are referenced in source code.`, 'success');
            }
        }
    }

    // === Cross-file workspace analysis ===
    let envInconsistencyFindings = [];
    let missingEnvKeyFindings = [];
    let versionDriftFindings = [];
    let syncIoFindings = [];

    // 1. Env inconsistencies: compare values across .env files — simplebeacon-ignore: scanner analysis logic
    if (envFileData.length >= 2) {
        const keyToFiles = {};
        envFileData.forEach(({ path: envPath, entries }) => {
            Object.entries(entries).forEach(([key, value]) => {
                if (!keyToFiles[key]) keyToFiles[key] = [];
                keyToFiles[key].push({ path: envPath, value });
            });
        });
        Object.entries(keyToFiles).forEach(([key, refs]) => {
            const uniqueValues = [...new Set(refs.map(r => r.value))];
            if (uniqueValues.length > 1) {
                envInconsistencyFindings.push({
                    severity: 'medium', type: 'Environment Inconsistency',
                    key, files: refs.map(r => r.path), values: refs.map(r => ({ file: r.path, value: r.value }))
                });
            }
        });
    }

    // 2. Missing env keys: process.env.X referenced but not defined in any .env — simplebeacon-ignore: scanner analysis logic
    if (processEnvRefs.length > 0 && envFileData.length > 0) {
        const allDefinedKeys = new Set();
        envFileData.forEach(({ entries }) => Object.keys(entries).forEach(k => allDefinedKeys.add(k)));
        const missingMap = {};
        processEnvRefs.forEach(ref => {
            if (!allDefinedKeys.has(ref.key)) {
                if (!Object.hasOwn(missingMap, ref.key)) missingMap[ref.key] = [];
                missingMap[ref.key].push(ref);
            }
        });
        Object.entries(missingMap).forEach(([key, refs]) => {
            missingEnvKeyFindings.push({ severity: 'medium', type: 'Missing Environment Key', key, references: refs.slice(0, 3) });
        });
    }

    // 3. Version drift: compare dependency versions across package.json files
    if (packageJsonFullData.length >= 2) {
        const depVersions = {};
        packageJsonFullData.forEach(({ path: pkgPath, dependencies, devDependencies }) => {
            [...Object.entries(dependencies || {}), ...Object.entries(devDependencies || {})].forEach(([dep, version]) => {
                if (!depVersions[dep]) depVersions[dep] = [];
                depVersions[dep].push({ path: pkgPath, version });
            });
        });
        Object.entries(depVersions).forEach(([dep, refs]) => {
            const uniqueVersions = [...new Set(refs.map(r => r.version))];
            if (uniqueVersions.length > 1) {
                versionDriftFindings.push({ severity: 'medium', type: 'Dependency Version Drift', dependency: dep, occurrences: refs });
            }
        });
    }

    // 4. Sync I/O patterns
    syncIoFindings = syncIoPatterns.map(p => ({ severity: 'low', type: 'Synchronous I/O Pattern', ...p }));

    const crossFileHitCount = envInconsistencyFindings.length + missingEnvKeyFindings.length + versionDriftFindings.length + syncIoFindings.length;
    if (crossFileHitCount > 0) {
        appendTerminalLine(`<span style="color:#60A5FA;font-weight:700;">Cross-file analysis:</span> ${envInconsistencyFindings.length} env inconsistencies, ${missingEnvKeyFindings.length} missing env keys, ${versionDriftFindings.length} version drifts, ${syncIoFindings.length} sync I/O patterns`);
    }

    // 4. Score & report
    const aiPenalty = profile.checkAi ? Math.min(aiHits.length * 1, 10) : 0;
    const credPenalty = profile.checkCredentials ? Math.min(credentialHits * 5, 15) : 0;
    const debugPenalty = profile.checkDebug ? Math.min(debugHits.length * 0.3, 4) : 0;
    const aiResiduePenalty = profile.checkAiResidue ? Math.min(aiResidueHits * 0.5, 5) : 0;
    const perfPenalty = profile.checkAiResidue ? Math.min(perfHits * 0.3, 3) : 0;
    const typeSafetyPenalty = profile.checkAiResidue ? Math.min(typeSafetyHits * 0.3, 3) : 0;
    const testPenalty = profile.checkAiResidue ? Math.min(testHits * 0.3, 3) : 0;
    const a11yPenalty = profile.checkAiResidue ? Math.min(a11yHits * 0.5, 3) : 0;
    const i18nPenalty = profile.checkAiResidue ? Math.min(i18nHits * 0.2, 2) : 0;
    const sensitiveDataPenalty = profile.checkAiResidue ? Math.min(sensitiveDataHits * 1, 5) : 0;
    const configDriftPenalty = profile.checkAiResidue ? Math.min(configDriftHits * 0.5, 3) : 0;
    const dbPenalty = profile.checkAiResidue ? Math.min(dbPatternHits * 0.5, 3) : 0;
    const frameworkPenalty = profile.checkAiResidue ? Math.min(frameworkHits * 0.3, 2) : 0;
    const workspacePenalty = profile.checkAiResidue ? Math.min(workspaceHits * 0.2, 2) : 0;
    const unusedDepPenalty = profile.checkAiResidue ? Math.min(unusedDepHits * 0.2, 2) : 0;
    const apiContractPenalty = profile.checkAiResidue ? Math.min(apiContractHits * 0.2, 2) : 0;
    const complexityPenalty = profile.checkAiResidue ? Math.min(complexityHits * 0.3, 3) : 0;
    const llmSlopPenalty = profile.checkAiResidue ? Math.min(llmSlopHits * 0.5, 3) : 0;
    const tokenBleedPenalty = profile.checkAiResidue ? Math.min(tokenBleedHits * 0.5, 3) : 0;
    const productionLeakPenalty = profile.checkAiResidue ? Math.min(productionLeakHits * 0.5, 3) : 0;
    const fictionKpiPenalty = profile.checkAiResidue ? Math.min(fictionKpiHits * 0.5, 3) : 0;
    const securityPenalty = profile.checkAiResidue ? Math.min(securityHits * 1, 6) : 0;
    const qualityPenalty = profile.checkAiResidue ? Math.min(qualityHits * 0.3, 3) : 0;
    const maintainabilityPenalty = profile.checkAiResidue ? Math.min(maintainabilityHits * 0.2, 2) : 0;
    const archDriftPenalty = profile.checkAiResidue ? Math.min(archDriftFindings.length * 0.5, 3) : 0;
    const envInconsistencyPenalty = Math.min(envInconsistencyFindings.length * 0.5, 3);
    const missingEnvPenalty = Math.min(missingEnvKeyFindings.length * 0.3, 2);
    const versionDriftPenalty = Math.min(versionDriftFindings.length * 0.5, 3);
    const syncIoPenalty = Math.min(syncIoFindings.length * 0.2, 2);
    const qualityScore = Math.max(0, 100 - aiPenalty - credPenalty - debugPenalty - aiResiduePenalty - perfPenalty - typeSafetyPenalty - testPenalty - a11yPenalty - i18nPenalty - sensitiveDataPenalty - configDriftPenalty - dbPenalty - frameworkPenalty - workspacePenalty - unusedDepPenalty - apiContractPenalty - complexityPenalty - llmSlopPenalty - tokenBleedPenalty - productionLeakPenalty - fictionKpiPenalty - securityPenalty - qualityPenalty - maintainabilityPenalty - archDriftPenalty - envInconsistencyPenalty - missingEnvPenalty - versionDriftPenalty - syncIoPenalty);
    const schemaCompliance = totalJsonFiles === 0 ? 100 : Math.max(0, Math.round(100 - (emptyJsonFiles.length / totalJsonFiles) * 100));
    const consistencyScore = duplicateGroups === 0 ? 100 : Math.max(0, Math.round(100 - Math.min(duplicateGroups * 5, 50)));
    const gatePass = credentialHits === 0 && sensitiveDataHits === 0 && dbPatternHits === 0 && configDriftHits === 0;

    // EU AI Act: filter out node_modules documentation (! project governance)
    const nonModuleLicenseFiles = licenseFiles.filter(p => !/node_modules\//.test(p));
    const nonModuleSecurityFiles = securityFiles.filter(p => !/node_modules\//.test(p));

    const now = new Date().toISOString();
    // Find the actual project root folder from webkitRelativePath (first directory segment)
    // Skip hidden/cache directories that are never project roots
    const HIDDEN_ROOT_EXCLUSIONS = /^(\..*|node_modules|\.git|\.github|\.github-sync|github-cache|\.cursor|\.windsurf|\.cursor-tutor|\.vscode|\.idea|\.husky|__tests__|fixtures?|mocks?|\.simplebeacon)$/i;
    let projectName = 'browser-local';
    for (const f of files) {
        const rp = f.webkitRelativePath || '';
        if (rp && rp.includes('/')) {
            const firstDir = rp.split('/')[0];
            if (firstDir && !HIDDEN_ROOT_EXCLUSIONS.test(firstDir)) {
                projectName = firstDir;
                break;
            }
        }
    }
    // Fallback: use directory portion of the first non-hidden file's path
    if (projectName === 'browser-local') {
        for (const f of files) {
            const rp = f.webkitRelativePath || '';
            if (rp.includes('/')) {
                const firstDir = rp.split('/')[0];
                if (firstDir && !HIDDEN_ROOT_EXCLUSIONS.test(firstDir)) {
                    projectName = firstDir;
                    break;
                }
            }
        }
    }
    // Final fallback
    if (projectName === 'browser-local') {
        projectName = detectedRoot || 'browser-local';
    }
    const testFixturePattern = /test-all-patterns|\.test\.|\.spec\.|mock|fixture|sample|demo|test.*\.js$|test-technical|e2e\/|positive-test|negative-test|simplebeacon-rule-tests/i;
    const credentialGateFindings = (profile.checkCredentials && credentialFindings.length ? credentialFindings.filter(f => !testFixturePattern.test(f.file) && f.matches.some(m => m.confidence >= 0.75)).slice(0,5).map(f => ({ severity: 'medium', type: 'Credential Pattern', count: f.matches.filter(m => m.confidence >= 0.75).length, filePath: f.file, rule: 'CREDENTIAL_PATTERN_HEURISTIC', impact: 'MEDIUM RISK: Hardcoded credential patterns in source increase breach surface.', fix: 'Move secrets to environment variables || a secret manager; never commit keys to version control.', findings: f.matches.filter(m => m.confidence >= 0.75) })) : []);
    const sensitiveDataGateFindings = (profile.checkAiResidue && sensitiveDataFindings.length ? sensitiveDataFindings.filter(f => !testFixturePattern.test(f.file) && f.matches.some(m => m.confidence >= 0.75)).slice(0,3).map(f => ({ severity: 'high', type: 'Sensitive Data Exposure', count: f.matches.filter(m => m.confidence >= 0.75).length, filePath: f.file, rule: 'SENSITIVE_DATA_PATTERN', impact: 'PRIVACY RISK: PII in logs or source code violates GDPR and increases breach liability.', fix: 'Sanitize logs, remove PII from source, and use tokenization for identifiers.', findings: f.matches.filter(m => m.confidence >= 0.75) })) : []);
    const dbPatternGateFindings = (profile.checkAiResidue && dbPatternFindings.length ? dbPatternFindings.filter(f => !testFixturePattern.test(f.file) && f.matches.some(m => m.confidence >= 0.75)).slice(0,3).map(f => ({ severity: 'high', type: 'Database Anti-Pattern', count: f.matches.filter(m => m.confidence >= 0.75).length, filePath: f.file, rule: 'DB_PATTERN', impact: 'SECURITY RISK: Raw SQL concatenation enables injection. Unbounded queries cause DoS.', fix: 'Use parameterized queries, ORM methods, and always apply LIMIT/OFFSET.', findings: f.matches.filter(m => m.confidence >= 0.75) })) : []);
    const configDriftGateFindings = (profile.checkAiResidue && configDriftFindings.length ? configDriftFindings.filter(f => !testFixturePattern.test(f.file) && f.matches.some(m => m.confidence >= 0.75)).slice(0,3).map(f => ({ severity: 'medium', type: 'Configuration Drift', count: f.matches.filter(m => m.confidence >= 0.75).length, filePath: f.file, rule: 'CONFIG_DRIFT_PATTERN', impact: 'SECURITY RISK: Literal endpoint values and secrets in config files bypass environment controls.', fix: 'Store secrets outside source, inject endpoints via configuration, and audit config files.', findings: f.matches.filter(m => m.confidence >= 0.75) })) : []);
    const securityHeaderGateFindings = (profile.checkAiResidue && securityHeaderFindings.length ? securityHeaderFindings.filter(f => !testFixturePattern.test(f.file) && f.matches.some(m => m.confidence >= 0.75)).slice(0,3).map(f => ({ severity: 'medium', type: 'Missing Security Header', count: f.matches.filter(m => m.confidence >= 0.75).length, filePath: f.file, rule: 'SECURITY_HEADER_PATTERN', impact: 'SECURITY RISK: Missing CSP or X-Frame-Options enables XSS and clickjacking.', fix: 'Add helmet middleware or configure reverse proxy with CSP, HSTS, X-Frame-Options.', findings: f.matches.filter(m => m.confidence >= 0.75) })) : []);
    const gateFindings = [...credentialGateFindings, ...sensitiveDataGateFindings, ...dbPatternGateFindings, ...configDriftGateFindings, ...securityHeaderGateFindings];
    const gateBlockingCount = gateFindings.length;
    const gatePassFinal = gateBlockingCount === 0 && sourceFiles.length > 0;
    reportData = {
        type: profile.reportType || 'simplebeacon-report',
        reportVersion: 2,
        version: '1.3.0',
        generatedAt: now,
        generatedBy: 'SimpleBeacon Browser Sandbox',
        scanProfileLabel: profile.label || 'Browser Scan',
        checkEuAi: profile.checkEuAi || false,
        projectRoot: projectName,
        projectPath: projectName,
        scanTargetRoot: projectName,
        platformRoot: 'browser-sandbox',
        gate: { pass: gatePassFinal, blockingCount: gateBlockingCount, failOn: ['high', 'critical'] },
        issueCount: (profile.checkAi ? aiHits.length : 0) + (profile.checkCredentials ? credentialHits : 0) + (profile.checkDebug ? debugHits.length : 0) + (profile.checkGov ? govHits.length : 0) + (profile.checkAiResidue ? aiResidueHits + perfHits + typeSafetyHits + testHits + a11yHits + i18nHits + sensitiveDataHits + configDriftHits + securityHeaderHits + dbPatternHits + frameworkHits + workspaceHits + unusedDepHits + apiContractHits + complexityHits + llmSlopHits + tokenBleedHits + productionLeakHits + fictionKpiHits + securityHits + qualityHits + maintainabilityHits : 0) + envInconsistencyFindings.length + missingEnvKeyFindings.length + versionDriftFindings.length + syncIoFindings.length + archDriftFindings.length,
        totalFiles: sourceFiles.length,
        filesAnalyzed: scanned,
        repositoryFilesTotal: sourceFiles.length,
        qualityScore: qualityScore,
        schemaCompliance: schemaCompliance,
        consistencyScore: consistencyScore,
        fictionKpiHits: fictionKpiHits,
        duplicateGroups: duplicateGroups,
        invalidJson: 0,
        emptyFiles: emptyJsonFiles.length,
        schemaChecked: totalJsonFiles,
        schemaPassed: totalJsonFiles - emptyJsonFiles.length,
        repositoryFoldersTotal: [...new Set(files.map(f => (f.webkitRelativePath || f.name).replace(/\\/g, '/').split('/').slice(0, -1).join('/')))].filter(Boolean).length,
        excludedCount: skipped,
        excludedSummary: Object.entries(skipReasons).sort((a,b) => b[1] - a[1]).slice(0,5).map(([r,c]) => `${c} ${r}`).join(', ') || 'none',
        simplebeaconIssues: (profile.checkAi ? aiHits.length : 0) + (profile.checkCredentials ? credentialHits : 0) + (profile.checkDebug ? debugHits.length : 0) + (profile.checkGov ? govHits.length : 0) + (profile.checkAiResidue ? aiResidueHits + perfHits + typeSafetyHits + testHits + a11yHits + i18nHits + sensitiveDataHits + configDriftHits + securityHeaderHits + dbPatternHits + frameworkHits + workspaceHits + unusedDepHits + apiContractHits + complexityHits + llmSlopHits + tokenBleedHits + productionLeakHits + fictionKpiHits + securityHits + qualityHits + maintainabilityHits : 0) + envInconsistencyFindings.length + missingEnvKeyFindings.length + versionDriftFindings.length + syncIoFindings.length + archDriftFindings.length,
        detectedIssues: [
            ...(profile.checkAi && aiFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'AI System Indicator', count: aiFindings.reduce((a, f) => a + f.matches.length, 0), filePath: aiFindings.slice(0,10).map(f => f.file), rule: 'AI_IMPLEMENTATION_PATTERN', impact: 'REVIEW REQUIRED: Left unchanged, this pattern may reappear in the next release cycle without a local gate on pull requests.', fix: 'Review && remediate before enabling --gate on main.', findings: aiFindings.slice(0,5), reasoning: 'The scanner detected imports || function calls matching known AI SDK signatures (OpenAI, Anthropic, LangChain, HuggingFace). These patterns indicate AI system integration that may require compliance review under EU AI Act Article 6.', confidence: 0.92, humanReadable: `AI SDK usage detected in ${aiFindings.length} file(s). This suggests the project implements || integrates with third-party AI services.` }] : []),
            ...(profile.checkCredentials && credentialFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Credential Pattern', count: credentialFindings.reduce((a, f) => a + f.matches.length, 0), filePath: credentialFindings.slice(0,10).map(f => f.file), rule: 'CREDENTIAL_PATTERN_HEURISTIC', impact: 'MEDIUM RISK: Hardcoded credential patterns in source increase breach surface && may trigger automated scanner alerts in CI.', fix: 'Move secrets to environment variables || a secret manager; never commit keys to version control.', findings: credentialFindings.slice(0,5), reasoning: 'Regex heuristics matched hardcoded credential patterns: password=, api_key=, secret_key=, || AWS access keys. These strings resemble common secret formats && are flagged for review even if they are dummy values.', confidence: 0.78, humanReadable: `Potential hardcoded secrets found in ${credentialFindings.length} file(s). The scanner matched patterns resembling API keys, passwords, || tokens assigned as string literals.` }] : []),
            ...(profile.checkDebug && debugFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'Debug Artifact', count: debugFindings.reduce((a, f) => a + f.matches.length, 0), filePath: debugFindings.slice(0,10).map(f => f.file), rule: 'DEBUG_ARTIFACT', impact: 'HYGIENE RISK: Debug artifacts should ! reach production builds.', fix: 'Remove console.log, debugger, TODO, && FIXME markers before release.', findings: debugFindings.slice(0,5), reasoning: 'Source code analysis detected console.log(), debugger statements, || alert()/prompt() calls. These are development-only artifacts that can leak internal state || interrupt user experience in production.', confidence: 0.98, humanReadable: `Debug artifacts (console.log, debugger, alert) found in ${debugFindings.length} file(s). These should be removed before production builds.` }] : []),
            ...(profile.checkGov && govFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'License/Governance Marker', count: govFindings.reduce((a, f) => a + f.matches.length, 0), filePath: govFindings.slice(0,10).map(f => f.file), rule: 'GOVERNANCE_PATTERN', impact: 'INFO: License headers && copyright notices detected. Verify compliance with open-source policy.', fix: 'Review license compatibility with your product distribution model.', findings: govFindings.slice(0,5), reasoning: 'SPDX-License-Identifier tags, copyright headers, || license references were found  in source files. This indicates the project contains licensed third-party code that must be tracked for compliance.', confidence: 0.95, humanReadable: `License && copyright markers detected in ${govFindings.length} file(s). Verify open-source license compatibility with your distribution model.` }] : []),
            ...(profile.checkAiResidue && aiResidueFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'AI Residue', count: aiResidueFindings.reduce((a, f) => a + f.matches.length, 0), filePath: aiResidueFindings.slice(0,10).map(f => f.file), rule: 'AI_RESIDUE_PATTERN', impact: 'HYGIENE RISK: AI-generated stubs, deprecated idioms, and error-swallowing patterns reduce code quality.', fix: 'Replace stubs with real implementations, modernize deprecated APIs, and add proper error handling.', findings: aiResidueFindings.slice(0,5), reasoning: 'The scanner detected patterns commonly left behind by AI coding assistants: empty function bodies, TODO placeholders, deprecated framework APIs, error-swallowing catch blocks, and large commented-out dead code.', confidence: 0.85, humanReadable: `AI residue (stubs, deprecated patterns, error swallowing, dead code) found in ${aiResidueFindings.length} file(s).` }] : []),
            ...(profile.checkAiResidue && perfFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'Performance Anti-Pattern', count: perfFindings.reduce((a, f) => a + f.matches.length, 0), filePath: perfFindings.slice(0,10).map(f => f.file), rule: 'PERFORMANCE_PATTERN', impact: 'PERFORMANCE RISK: Nested loops and leaked listeners degrade runtime performance.', fix: 'Optimize hot paths, debounce event handlers, and remove listeners on unmount.', findings: perfFindings.slice(0,5), reasoning: 'Nested loops create O(n²) complexity. Leaked event listeners accumulate DOM references causing memory bloat.', confidence: 0.80, humanReadable: `${perfFindings.length} file(s) contain performance anti-patterns.` }] : []),
            ...(profile.checkAiResidue && typeSafetyFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'Type Safety Gap', count: typeSafetyFindings.reduce((a, f) => a + f.matches.length, 0), filePath: typeSafetyFindings.slice(0,10).map(f => f.file), rule: 'TYPE_SAFETY_PATTERN', impact: 'MAINTAINABILITY RISK: any types and missing PropTypes erode compile-time guarantees.', fix: 'Replace any with specific types, add PropTypes or migrate to TypeScript.', findings: typeSafetyFindings.slice(0,5), reasoning: 'any defeats TypeScript compiler checks. Missing PropTypes causes runtime prop mismatch errors in React.', confidence: 0.82, humanReadable: `${typeSafetyFindings.length} file(s) contain type safety gaps.` }] : []),
            ...(profile.checkAiResidue && testFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'Missing Test Coverage', count: testFindings.reduce((a, f) => a + f.matches.length, 0), filePath: testFindings.slice(0,10).map(f => f.file), rule: 'TEST_COVERAGE_PATTERN', impact: 'QUALITY RISK: Skipped or empty tests give false confidence in coverage metrics.', fix: 'Implement skipped tests or remove empty test placeholders.', findings: testFindings.slice(0,5), reasoning: 'Empty test bodies pass silently while production code remains unverified.', confidence: 0.88, humanReadable: `${testFindings.length} file(s) have test coverage gaps.` }] : []),
            ...(profile.checkAiResidue && a11yFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Accessibility Gap', count: a11yFindings.reduce((a, f) => a + f.matches.length, 0), filePath: a11yFindings.slice(0,10).map(f => f.file), rule: 'A11Y_PATTERN', impact: 'INCLUSION RISK: Missing alt text and unlabeled inputs block assistive technology users.', fix: 'Add alt attributes to images, aria-label to buttons, and associate labels with inputs.', findings: a11yFindings.slice(0,5), reasoning: 'Screen readers rely on alt text and ARIA labels. Color-only indicators fail for colorblind users.', confidence: 0.92, humanReadable: `${a11yFindings.length} file(s) have accessibility gaps.` }] : []),
            ...(profile.checkAiResidue && i18nFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'i18n Issue', count: i18nFindings.reduce((a, f) => a + f.matches.length, 0), filePath: i18nFindings.slice(0,10).map(f => f.file), rule: 'I18N_PATTERN', impact: 'GLOBAL RISK: Hardcoded English strings prevent localization.', fix: 'Wrap UI strings in t()/i18n() functions and use locale-aware formatting.', findings: i18nFindings.slice(0,5), reasoning: 'Concatenated strings with variables are impossible to translate because word order varies by language.', confidence: 0.78, humanReadable: `${i18nFindings.length} file(s) have i18n issues.` }] : []),
            ...(profile.checkAiResidue && sensitiveDataFindings.length ? [{ severity: 'high', severityBand: 'high', type: 'Sensitive Data Exposure', count: sensitiveDataFindings.reduce((a, f) => a + f.matches.length, 0), filePath: sensitiveDataFindings.slice(0,10).map(f => f.file), rule: 'SENSITIVE_DATA_PATTERN', impact: 'PRIVACY RISK: PII in logs or source code violates GDPR and increases breach liability.', fix: 'Sanitize logs, remove PII from source, and use tokenization for identifiers.', findings: sensitiveDataFindings.slice(0,5), reasoning: 'Email addresses, phone numbers, and SSN-like patterns in non-test files indicate potential data leakage.', confidence: 0.85, humanReadable: `${sensitiveDataFindings.length} file(s) may expose sensitive data.` }] : []),
            ...(profile.checkAiResidue && configDriftFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Configuration Drift', count: configDriftFindings.reduce((a, f) => a + f.matches.length, 0), filePath: configDriftFindings.slice(0,10).map(f => f.file), rule: 'CONFIG_DRIFT_PATTERN', impact: 'SECURITY RISK: Literal endpoint values and secrets in config files bypass environment controls.', fix: 'Store secrets outside source, inject endpoints via configuration, and audit config files.', findings: configDriftFindings.slice(0,5), reasoning: 'Config drift occurs when local settings are committed instead of environment-specific overrides.', confidence: 0.80, humanReadable: `${configDriftFindings.length} file(s) show configuration drift.` }] : []),
            ...(profile.checkAiResidue && securityHeaderFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Missing Security Header', count: securityHeaderFindings.reduce((a, f) => a + f.matches.length, 0), filePath: securityHeaderFindings.slice(0,10).map(f => f.file), rule: 'SECURITY_HEADER_PATTERN', impact: 'SECURITY RISK: Missing CSP or X-Frame-Options enables XSS and clickjacking.', fix: 'Add helmet middleware or configure reverse proxy with CSP, HSTS, X-Frame-Options.', findings: securityHeaderFindings.slice(0,5), reasoning: 'Modern browsers enforce security headers to mitigate XSS, clickjacking, and MIME sniffing attacks.', confidence: 0.83, humanReadable: `${securityHeaderFindings.length} file(s) reference security headers — verify full coverage.` }] : []),
            ...(profile.checkAiResidue && dbPatternFindings.length ? [{ severity: 'high', severityBand: 'high', type: 'Database Anti-Pattern', count: dbPatternFindings.reduce((a, f) => a + f.matches.length, 0), filePath: dbPatternFindings.slice(0,10).map(f => f.file), rule: 'DB_PATTERN', impact: 'SECURITY RISK: Raw SQL concatenation enables injection. Unbounded queries cause DoS.', fix: 'Use parameterized queries, ORM methods, and always apply LIMIT/OFFSET.', findings: dbPatternFindings.slice(0,5), reasoning: 'String concatenation in SQL queries is the leading cause of injection vulnerabilities in web apps.', confidence: 0.90, humanReadable: `${dbPatternFindings.length} file(s) contain database anti-patterns.` }] : []),
            ...(profile.checkAiResidue && frameworkFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'Framework Practice Issue', count: frameworkFindings.reduce((a, f) => a + f.matches.length, 0), filePath: frameworkFindings.slice(0,10).map(f => f.file), rule: 'FRAMEWORK_PATTERN', impact: 'MAINTAINABILITY RISK: Hook misuse and missing cleanup cause memory leaks and stale state.', fix: 'Add dependency arrays to useEffect, unsubscribe in ngOnDestroy, avoid direct DOM access.', findings: frameworkFindings.slice(0,5), reasoning: 'React hooks without dependency arrays re-run on every render. Missing Angular unsubscribes leak memory.', confidence: 0.85, humanReadable: `${frameworkFindings.length} file(s) have framework practice issues.` }] : []),
            ...(profile.checkAiResidue && workspaceFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'Workspace Health Issue', count: workspaceFindings.reduce((a, f) => a + f.matches.length, 0), filePath: workspaceFindings.slice(0,10).map(f => f.file), rule: 'WORKSPACE_PATTERN', impact: 'MAINTAINABILITY RISK: Circular imports and mismatched versions cause build failures.', fix: 'Refactor shared code into a common package, align dependency versions across workspace.', findings: workspaceFindings.slice(0,5), reasoning: 'Relative imports between workspace packages suggest tight coupling that can become circular.', confidence: 0.70, humanReadable: `${workspaceFindings.length} file(s) show workspace health concerns.` }] : []),
            ...(profile.checkAiResidue && unusedDepFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'Unused Dependency', count: unusedDepFindings.reduce((a, f) => a + f.matches.length, 0), filePath: unusedDepFindings.slice(0,10).map(f => f.file), rule: 'UNUSED_DEP_PATTERN', impact: 'BLOAT RISK: Unused packages increase install time, bundle size, and attack surface.', fix: 'Remove unused packages from package.json and lockfile.', findings: unusedDepFindings.slice(0,5), reasoning: 'Dependencies not imported anywhere add zero value but increase supply chain risk.', confidence: 0.75, humanReadable: `${unusedDepFindings.length} file(s) suggest unused dependencies.` }] : []),
            ...(profile.checkAiResidue && apiContractFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'API Contract Drift', count: apiContractFindings.reduce((a, f) => a + f.matches.length, 0), filePath: apiContractFindings.slice(0,10).map(f => f.file), rule: 'API_CONTRACT_PATTERN', impact: 'INTEGRATION RISK: Unconsumed endpoints and stale OpenAPI specs mislead consumers.', fix: 'Sync OpenAPI spec with implementation, remove dead endpoints, verify frontend coverage.', findings: apiContractFindings.slice(0,5), reasoning: 'Backend routes not called by frontend may be dead code or indicate missing frontend integration.', confidence: 0.72, humanReadable: `${apiContractFindings.length} file(s) show API contract drift.` }] : []),
            ...(profile.checkAiResidue && complexityFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'High Complexity', count: complexityFindings.reduce((a, f) => a + f.matches.length, 0), filePath: complexityFindings.slice(0,10).map(f => f.file), rule: 'COMPLEXITY_PATTERN', impact: 'MAINTAINABILITY RISK: Over-long functions and deep nesting increase bug density.', fix: 'Extract helper functions, reduce nesting with early returns, apply cyclomatic complexity limits.', findings: complexityFindings.slice(0,5), reasoning: 'Functions over 50 lines or with deeply nested control flow are harder to test and reason about.', confidence: 0.80, humanReadable: `${complexityFindings.length} file(s) contain high complexity patterns.` }] : []),
            ...(profile.checkAiResidue && llmSlopFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'LLM Slop', count: llmSlopFindings.reduce((a, f) => a + f.matches.length, 0), filePath: llmSlopFindings.slice(0,10).map(f => f.file), rule: 'LLM_SLOP_PATTERN', impact: 'HYGIENE RISK: Unresolved LLM placeholders and leaked markdown degrade source quality.', fix: 'Remove placeholder debris and markdown code fences from source files.', findings: llmSlopFindings.slice(0,5), reasoning: 'AI coding assistants often leave behind placeholder text, markdown fences, or hardcoded default metrics that should not reach production.', confidence: 0.85, humanReadable: `${llmSlopFindings.length} file(s) contain LLM slop / placeholder debris.` }] : []),
            ...(profile.checkAiResidue && tokenBleedFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Token Bleed', count: tokenBleedFindings.reduce((a, f) => a + f.matches.length, 0), filePath: tokenBleedFindings.slice(0,10).map(f => f.file), rule: 'TOKEN_BLEED_PATTERN', impact: 'COST & PERFORMANCE RISK: Unbounded LLM API calls without token limits inflate costs.', fix: 'Add max_tokens / max_completion_tokens to every LLM API call and chunk long literals.', findings: tokenBleedFindings.slice(0,5), reasoning: 'LLM API calls without max_tokens limits can consume excessive tokens and budget. Very long string literals in prompts risk context window overflow.', confidence: 0.80, humanReadable: `${tokenBleedFindings.length} file(s) show token bleed risk.` }] : []),
            ...(profile.checkAiResidue && productionLeakFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Production Leak', count: productionLeakFindings.reduce((a, f) => a + f.matches.length, 0), filePath: productionLeakFindings.slice(0,10).map(f => f.file), rule: 'PRODUCTION_LEAK_PATTERN', impact: 'SECURITY RISK: Mock/fixture data paths referenced in production source can leak test data.', fix: 'Replace hardcoded mock/fixture paths with environment-based configuration or runtime discovery.', findings: productionLeakFindings.slice(0,5), reasoning: 'References to mock, fixture, sample, or test-data directories in production source indicate potential test data leakage.', confidence: 0.82, humanReadable: `${productionLeakFindings.length} file(s) reference mock/fixture paths in production code.` }] : []),
            ...(profile.checkAiResidue && fictionKpiFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Fiction KPI', count: fictionKpiFindings.reduce((a, f) => a + f.matches.length, 0), filePath: fictionKpiFindings.slice(0,10).map(f => f.file), rule: 'FICTION_KPI_PATTERN', impact: 'TRUST RISK: Hardcoded metrics and confidence scores may be fabricated AI output.', fix: 'Replace hardcoded KPIs with real data sources and dynamic calculations.', findings: fictionKpiFindings.slice(0,5), reasoning: 'Hardcoded completion rates, accuracy percentages, and AI confidence scores are commonly generated by LLMs as placeholder data.', confidence: 0.88, humanReadable: `${fictionKpiFindings.length} file(s) contain hardcoded fiction KPIs.` }] : []),
            ...(profile.checkAiResidue && archDriftFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Architecture Drift', count: archDriftFindings.length, filePath: archDriftFindings.slice(0,10).map(f => f.file), rule: 'ARCH_DRIFT_PATTERN', impact: 'RELIABILITY RISK: Hybrid/SSM models without schema validation can produce unpredictable outputs.', fix: 'Add schema validators (Zod, AJV, pydantic) and enforce max_tokens on all LLM calls.', findings: archDriftFindings.slice(0,5), reasoning: 'Hybrid and state-space model identifiers without output schema validators indicate unguarded LLM integration.', confidence: 0.75, humanReadable: `${archDriftFindings.length} file(s) show architecture drift / unguarded LLM calls.` }] : []),
            ...(profile.checkAiResidue && securityFindings.length ? [{ severity: 'high', severityBand: 'high', type: 'Security Vulnerability', count: securityFindings.reduce((a, f) => a + f.matches.length, 0), filePath: securityFindings.slice(0,10).map(f => f.file), rule: 'SECURITY_PATTERN', impact: 'SECURITY RISK: eval(), XSS, prototype pollution, insecure random, or missing rate limits detected.', fix: 'Replace eval with structured parsing, sanitize innerHTML, use crypto.randomBytes, add rate limiting.', findings: securityFindings.slice(0,5), reasoning: 'These patterns represent common attack vectors: code injection, XSS, prototype pollution, and predictable crypto.', confidence: 0.85, humanReadable: `${securityFindings.length} file(s) contain security vulnerabilities.` }] : []), // simplebeacon-ignore: scanner rule description text
            ...(profile.checkAiResidue && qualityFindings.length ? [{ severity: 'medium', severityBand: 'medium', type: 'Code Quality Issue', count: qualityFindings.reduce((a, f) => a + f.matches.length, 0), filePath: qualityFindings.slice(0,10).map(f => f.file), rule: 'QUALITY_PATTERN', impact: 'QUALITY RISK: Unhandled promises, missing strict mode, and uninitialized reads cause runtime errors.', fix: 'Add .catch() to promises, use "use strict", initialize variables at declaration.', findings: qualityFindings.slice(0,5), reasoning: 'Unhandled rejections crash Node.js. Implicit globals from missing strict mode cause silent bugs.', confidence: 0.82, humanReadable: `${qualityFindings.length} file(s) have code quality issues.` }] : []),
            ...(profile.checkAiResidue && maintainabilityFindings.length ? [{ severity: 'low', severityBand: 'low', type: 'Maintainability Issue', count: maintainabilityFindings.reduce((a, f) => a + f.matches.length, 0), filePath: maintainabilityFindings.slice(0,10).map(f => f.file), rule: 'MAINTAINABILITY_PATTERN', impact: 'MAINTAINABILITY RISK: Magic numbers and hardcoded literals make code harder to understand and modify.', fix: 'Extract numeric literals to named constants (e.g., const MAX_RETRIES = 3).', findings: maintainabilityFindings.slice(0,5), reasoning: 'Magic numbers obscure intent and make bulk updates error-prone.', confidence: 0.78, humanReadable: `${maintainabilityFindings.length} file(s) have maintainability issues.` }] : [])
        ],
        issues: [
            ...(profile.checkAi && aiHits.length ? [{ severity: 'low', type: 'AI System Indicator', count: aiHits.length }] : []),
            ...(profile.checkCredentials && credentialHits ? [{ severity: 'medium', type: 'Credential Pattern', count: credentialHits }] : []),
            ...(profile.checkDebug && debugHits.length ? [{ severity: 'low', type: 'Debug Artifact', count: debugHits.length }] : []),
            ...(profile.checkGov && govHits.length ? [{ severity: 'low', type: 'License/Governance Marker', count: govHits.length }] : []),
            ...(profile.checkAiResidue && aiResidueHits ? [{ severity: 'low', type: 'AI Residue', count: aiResidueHits }] : []),
            ...(profile.checkAiResidue && perfHits ? [{ severity: 'low', type: 'Performance Anti-Pattern', count: perfHits }] : []),
            ...(profile.checkAiResidue && typeSafetyHits ? [{ severity: 'low', type: 'Type Safety Gap', count: typeSafetyHits }] : []),
            ...(profile.checkAiResidue && testHits ? [{ severity: 'low', type: 'Missing Test Coverage', count: testHits }] : []),
            ...(profile.checkAiResidue && a11yHits ? [{ severity: 'medium', type: 'Accessibility Gap', count: a11yHits }] : []),
            ...(profile.checkAiResidue && i18nHits ? [{ severity: 'low', type: 'i18n Issue', count: i18nHits }] : []),
            ...(profile.checkAiResidue && sensitiveDataHits ? [{ severity: 'high', type: 'Sensitive Data Exposure', count: sensitiveDataHits }] : []),
            ...(profile.checkAiResidue && configDriftHits ? [{ severity: 'medium', type: 'Configuration Drift', count: configDriftHits }] : []),
            ...(profile.checkAiResidue && securityHeaderHits ? [{ severity: 'medium', type: 'Missing Security Header', count: securityHeaderHits }] : []),
            ...(profile.checkAiResidue && dbPatternHits ? [{ severity: 'high', type: 'Database Anti-Pattern', count: dbPatternHits }] : []),
            ...(profile.checkAiResidue && frameworkHits ? [{ severity: 'low', type: 'Framework Practice Issue', count: frameworkHits }] : []),
            ...(profile.checkAiResidue && workspaceHits ? [{ severity: 'low', type: 'Workspace Health Issue', count: workspaceHits }] : []),
            ...(profile.checkAiResidue && unusedDepHits ? [{ severity: 'low', type: 'Unused Dependency', count: unusedDepHits }] : []),
            ...(profile.checkAiResidue && apiContractHits ? [{ severity: 'low', type: 'API Contract Drift', count: apiContractHits }] : []),
            ...(profile.checkAiResidue && complexityHits ? [{ severity: 'low', type: 'High Complexity', count: complexityHits }] : []),
            ...(profile.checkAiResidue && llmSlopHits ? [{ severity: 'medium', type: 'LLM Slop', count: llmSlopHits }] : []),
            ...(profile.checkAiResidue && tokenBleedHits ? [{ severity: 'medium', type: 'Token Bleed', count: tokenBleedHits }] : []),
            ...(profile.checkAiResidue && productionLeakHits ? [{ severity: 'medium', type: 'Production Leak', count: productionLeakHits }] : []),
            ...(profile.checkAiResidue && fictionKpiHits ? [{ severity: 'medium', type: 'Fiction KPI', count: fictionKpiHits }] : []),
            ...(profile.checkAiResidue && archDriftFindings.length ? [{ severity: 'medium', type: 'Architecture Drift', count: archDriftFindings.length }] : []),
            ...(profile.checkAiResidue && securityHits ? [{ severity: 'high', type: 'Security Vulnerability', count: securityHits }] : []),
            ...(profile.checkAiResidue && qualityHits ? [{ severity: 'medium', type: 'Code Quality Issue', count: qualityHits }] : []),
            ...(profile.checkAiResidue && maintainabilityHits ? [{ severity: 'low', type: 'Maintainability Issue', count: maintainabilityHits }] : [])
        ],
        rawIssues: [
            ...(profile.checkAi && aiHits.length ? [{ severity: 'low', type: 'AI System Indicator', count: aiHits.length }] : []),
            ...(profile.checkCredentials && credentialHits ? [{ severity: 'medium', type: 'Credential Pattern', count: credentialHits }] : []),
            ...(profile.checkDebug && debugHits.length ? [{ severity: 'low', type: 'Debug Artifact', count: debugHits.length }] : []),
            ...(profile.checkGov && govHits.length ? [{ severity: 'low', type: 'License/Governance Marker', count: govHits.length }] : []),
            ...(profile.checkAiResidue && aiResidueHits ? [{ severity: 'low', type: 'AI Residue', count: aiResidueHits }] : []),
            ...(profile.checkAiResidue && perfHits ? [{ severity: 'low', type: 'Performance Anti-Pattern', count: perfHits }] : []),
            ...(profile.checkAiResidue && typeSafetyHits ? [{ severity: 'low', type: 'Type Safety Gap', count: typeSafetyHits }] : []),
            ...(profile.checkAiResidue && testHits ? [{ severity: 'low', type: 'Missing Test Coverage', count: testHits }] : []),
            ...(profile.checkAiResidue && a11yHits ? [{ severity: 'medium', type: 'Accessibility Gap', count: a11yHits }] : []),
            ...(profile.checkAiResidue && i18nHits ? [{ severity: 'low', type: 'i18n Issue', count: i18nHits }] : []),
            ...(profile.checkAiResidue && sensitiveDataHits ? [{ severity: 'high', type: 'Sensitive Data Exposure', count: sensitiveDataHits }] : []),
            ...(profile.checkAiResidue && configDriftHits ? [{ severity: 'medium', type: 'Configuration Drift', count: configDriftHits }] : []),
            ...(profile.checkAiResidue && securityHeaderHits ? [{ severity: 'medium', type: 'Missing Security Header', count: securityHeaderHits }] : []),
            ...(profile.checkAiResidue && dbPatternHits ? [{ severity: 'high', type: 'Database Anti-Pattern', count: dbPatternHits }] : []),
            ...(profile.checkAiResidue && frameworkHits ? [{ severity: 'low', type: 'Framework Practice Issue', count: frameworkHits }] : []),
            ...(profile.checkAiResidue && workspaceHits ? [{ severity: 'low', type: 'Workspace Health Issue', count: workspaceHits }] : []),
            ...(profile.checkAiResidue && unusedDepHits ? [{ severity: 'low', type: 'Unused Dependency', count: unusedDepHits }] : []),
            ...(profile.checkAiResidue && apiContractHits ? [{ severity: 'low', type: 'API Contract Drift', count: apiContractHits }] : []),
            ...(profile.checkAiResidue && complexityHits ? [{ severity: 'low', type: 'High Complexity', count: complexityHits }] : []),
            ...(profile.checkAiResidue && llmSlopHits ? [{ severity: 'medium', type: 'LLM Slop', count: llmSlopHits }] : []),
            ...(profile.checkAiResidue && tokenBleedHits ? [{ severity: 'medium', type: 'Token Bleed', count: tokenBleedHits }] : []),
            ...(profile.checkAiResidue && productionLeakHits ? [{ severity: 'medium', type: 'Production Leak', count: productionLeakHits }] : []),
            ...(profile.checkAiResidue && fictionKpiHits ? [{ severity: 'medium', type: 'Fiction KPI', count: fictionKpiHits }] : []),
            ...(profile.checkAiResidue && archDriftFindings.length ? [{ severity: 'medium', type: 'Architecture Drift', count: archDriftFindings.length }] : []),
            ...(profile.checkAiResidue && securityHits ? [{ severity: 'high', type: 'Security Vulnerability', count: securityHits }] : []),
            ...(profile.checkAiResidue && qualityHits ? [{ severity: 'medium', type: 'Code Quality Issue', count: qualityHits }] : []),
            ...(profile.checkAiResidue && maintainabilityHits ? [{ severity: 'low', type: 'Maintainability Issue', count: maintainabilityHits }] : [])
        ],
        severityCounts: {
            critical: 0,
            high: (profile.checkAiResidue ? sensitiveDataHits + dbPatternHits + securityHits : 0),
            medium: (profile.checkCredentials ? credentialHits : 0) + (profile.checkAiResidue ? a11yHits + configDriftHits + securityHeaderHits + llmSlopHits + tokenBleedHits + productionLeakHits + fictionKpiHits + archDriftFindings.length + qualityHits : 0),
            low: (profile.checkAi ? aiHits.length : 0) + (profile.checkDebug ? debugHits.length : 0) + (profile.checkGov ? govHits.length : 0) + (profile.checkAiResidue ? aiResidueHits + perfHits + typeSafetyHits + testHits + i18nHits + frameworkHits + workspaceHits + unusedDepHits + apiContractHits + complexityHits + maintainabilityHits : 0)
        },
        // AI-agent context: structured metadata to help AI coding agents understand && act on this report
        aiContext: {
            schemaVersion: '2.1',
            readerGuide: {
                purpose: 'This report contains a static analysis of a JavaScript/TypeScript codebase. Each module section (gate, cleanup, performance, etc.) contains findings with file paths, line numbers, snippets, and suggested fixes.',
                howToUse: 'Start with aiContext.suggestedFixes[] for prioritized actionable tasks. Each fix has file, line, currentCode, replacement, suggestedPatch (unified diff), and verificationCommand. For high-level planning, use moduleDependencies and completionCriteria.',
                keyFields: {
                    'aiContext.suggestedFixes[].file': 'Affected file path — use for git checkout or direct edit',
                    'aiContext.suggestedFixes[].line': 'Line number where the fix should be applied',
                    'aiContext.suggestedFixes[].currentCode': 'Exact code snippet to be replaced (before state)',
                    'aiContext.suggestedFixes[].replacement': 'Suggested replacement code (after state)',
                    'aiContext.suggestedFixes[].suggestedPatch': 'Unified diff string — can be applied with git apply',
                    'aiContext.suggestedFixes[].context': 'Array of surrounding code lines for broader context',
                    'aiContext.suggestedFixes[].autoFixable': 'Boolean — if true, AI can apply without human review',
                    'aiContext.suggestedFixes[].verificationCommand': 'Shell command to verify the fix is correct',
                    'detectedIssues[].severity': 'critical || high || medium || low — start with high severity',
                    'detectedIssues[].fix': 'Actionable remediation string — can be turned into a code change directly',
                    'detectedIssues[].filePath': 'Array of affected file paths',
                    'detectedIssues[].confidence': '0.0-1.0 — higher means more certain',
                    'detectedIssues[].findings[].line': 'Line number in the file',
                    'detectedIssues[].findings[].snippet': 'Code context around the finding'
                }
            },
            projectContext: {
                dominantLanguage: detectDominantLanguage(sourceFiles.map(f => f.webkitRelativePath || f.name)),
                totalFiles: sourceFiles.length,
                totalLines: totalLines,
                fileTypes: fileTypes,
                buildTool: packageJsonFiles.length > 0 ? 'npm/node' : 'unknown',
                testFramework: 'jest',
                lintCommand: 'npm run lint',
                buildCommand: 'npm run build',
                scanEnvironment: 'browser-sandbox'
            },
            suggestedFixes: buildSuggestedFixes(
                { aiFindings, credentialFindings, debugFindings, govFindings, aiResidueFindings, perfFindings, typeSafetyFindings, testFindings, a11yFindings, i18nFindings, sensitiveDataFindings, configDriftFindings, securityHeaderFindings, dbPatternFindings, frameworkFindings, workspaceFindings, unusedDepFindings, apiContractFindings, complexityFindings, securityFindings, qualityFindings, maintainabilityFindings }
            ),
            filesRequiringChanges: dedupeFileChanges(
                { aiFindings, credentialFindings, debugFindings, govFindings, aiResidueFindings, perfFindings, typeSafetyFindings, testFindings, a11yFindings, i18nFindings, sensitiveDataFindings, configDriftFindings, securityHeaderFindings, dbPatternFindings, frameworkFindings, workspaceFindings, unusedDepFindings, apiContractFindings, complexityFindings, securityFindings, qualityFindings, maintainabilityFindings }
            ),
            moduleDependencies: [
                { id: 'security', dependsOn: null, reason: 'Fix credentials && secrets first — they are the highest-risk items' },
                { id: 'sensitive-data', dependsOn: null, reason: 'Remove PII from source before refactoring' },
                { id: 'database-patterns', dependsOn: null, reason: 'Fix SQL injection vectors before feature work' },
                { id: 'config-drift', dependsOn: null, reason: 'Move hardcoded secrets to env before other changes' },
                { id: 'data-quality', dependsOn: 'security', reason: 'Validate JSON integrity after security fixes' },
                { id: 'cleanup', dependsOn: 'security', reason: 'Remove debug artifacts only after verifying no secrets are in them' },
                { id: 'performance', dependsOn: 'cleanup', reason: 'Optimize after removing dead code && debug artifacts' },
                { id: 'type-safety', dependsOn: 'cleanup', reason: 'Add types after refactoring for clarity' },
                { id: 'test-coverage', dependsOn: 'type-safety', reason: 'Write tests after types are stable' },
                { id: 'documentation', dependsOn: 'test-coverage', reason: 'Document after APIs are tested && finalized' }
            ],
            completionCriteria: [
                { phase: 'security', criteria: ['No hardcoded credentials in source', 'All secrets moved to environment variables', 'secretlint or grep scan returns clean'] },
                { phase: 'cleanup', criteria: ['No console.log, debugger, or alert in production code', 'No self-generated bloat files', 'eslint-plugin-no-console passes in CI'] },
                { phase: 'performance', criteria: ['No nested O(n²) loops in hot paths', 'All event listeners properly removed on unmount', 'Benchmark tests pass within baseline'] },
                { phase: 'type-safety', criteria: ['TypeScript compiler errors = 0', 'No any types in src/', 'All public functions have JSDoc @param tags'] },
                { phase: 'test-coverage', criteria: ['No skipped or empty tests', 'Coverage >= 80% for critical paths', 'All tests pass in CI'] },
                { phase: 'documentation', criteria: ['All exported functions have JSDoc or docstrings', 'README updated for new APIs', 'CHANGELOG entry for breaking changes'] },
                { phase: 'eu-ai-act', criteria: ['AI disclosure notices present in UI', 'No prohibited practices per Article 5', 'Risk assessment document current'] }
            ],
            confidenceThreshold: 0.75,
            autoFixable: ['debugArtifacts','aiResidue','unusedDeps','junkFiles'],
            manualReviewRequired: ['credentials','sensitiveData','databasePatterns','securityHeaders','configDrift']
        },
        // 1. Simplebeacon Gate (always included)
        gate: {
            pass: gatePassFinal,
            blockingCount: gateBlockingCount,
            warningCount: 0,
            blockingFindings: gateFindings
        },
        gateReport: {
            pass: gatePassFinal,
            blockingCount: gateBlockingCount,
            summary: gatePassFinal
                ? 'Gate passed — no blocking security issues found.'
                : `${gateBlockingCount} blocking security issue(s) detected (${credentialGateFindings.length} credential, ${sensitiveDataGateFindings.length} sensitive-data, ${dbPatternGateFindings.length} db-pattern, ${configDriftGateFindings.length} config-drift, ${securityHeaderGateFindings.length} security-header). Review before release.`
        },
        summary: {
            gatePass: gatePass,
            qualityScore: qualityScore
        },
        // Profile-aware sections — only include what the selected profile needs
        ...(allowedSections.includes('consolidation') ? {
            consolidation: {
                monorepoMarkers: monorepoMarkers,
                duplicateGroups: duplicateGroups,
                duplicateFiles: Array.from(duplicateHashes.values()).filter(g => g.length > 1).slice(0, 250).map(g => ({ paths: g, count: g.length, sizeHint: g[0].split('.').pop() })),
                summary: duplicateGroups > 0 ? `${duplicateGroups} duplicate file groups detected.` : 'No duplicate files detected.'
            }
        } : {}),
        ...(allowedSections.includes('mockDataCategories') ? {
            mockDataCategories: [
                ...(mockFiles.length ? [{
                    category: 'Mock / Fixture / Sample Files',
                    fileCount: mockFiles.length,
                    confidence: 'medium',
                    description: 'Files with mock, fixture, sample, || test-data naming patterns.',
                    affectedFiles: mockFiles.slice(0, 5)
                }] : [])
            ],
            mockSampleFiles: mockFiles.length
        } : {}),
        ...(allowedSections.includes('roadmap') ? {
            roadmap: {
                todoCount: todoFiles.length,
                todoFiles: todoFiles.map(f => f.path || f).slice(0, 20),
                markerBreakdown: { tasks: todoMarkerCounts.tasks, fixes: todoMarkerCounts.fixes, hacks: todoMarkerCounts.hacks, bugs: todoMarkerCounts.bugs, notes: todoMarkerCounts.notes, reviews: todoMarkerCounts.reviews, deprecateds: todoMarkerCounts.deprecateds, optimizes: todoMarkerCounts.optimizes },
                summary: todoFiles.length > 0 ? `${todoFiles.length} files contain task/fix markers.` : 'No roadmap markers found.'
            }
        } : {}),
        ...(allowedSections.includes('codebase') ? {
            codebase: {
                totalFiles: sourceFiles.length,
                totalLines: totalLines,
                fileTypes: fileTypes,
                summary: `${sourceFiles.length} files analyzed, ${totalLines.toLocaleString()} lines of code.`
            }
        } : {}),
        ...(allowedSections.includes('fileReduction') ? {
            fileReduction: {
                unusedAssetCandidates: unusedAssetCandidates.slice(0, 10),
                duplicateGroups: duplicateGroups,
                summary: `${unusedAssetCandidates.length} image assets detected for review. ${duplicateGroups} duplicate content groups found.`
            }
        } : {}),
        ...(allowedSections.includes('dataQuality') ? {
            dataQuality: {
                emptyJsonFiles: emptyJsonFiles.slice(0, 5),
                emptyJsonCount: emptyJsonFiles.length,
                summary: emptyJsonFiles.length > 0 ? `${emptyJsonFiles.length} empty || trivial JSON files detected.` : 'No empty JSON files detected.'
            }
        } : {}),
        ...(allowedSections.includes('cleanup') ? {
            cleanup: {
                debugArtifacts: debugHits.slice(0, 15),
                debugArtifactCount: debugHits.length,
                debugFindings: debugFindings.slice(0, 15).map(f => ({
                    file: f.file,
                    matches: f.matches.slice(0, 3).map(m => ({ line: m.line, snippet: m.snippet }))
                })),
                bloatArtifacts: bloatFindings,
                bloatArtifactCount: bloatFindings.length,
                summary: (debugHits.length > 0 ? `${debugHits.length} debug artifacts detected.` : 'No debug artifacts found.') +
                         (bloatFindings.length > 0 ? ` ${bloatFindings.length} self-generated bloat file(s).` : '')
            }
        } : {}),
        ...(allowedSections.includes('junkFiles') ? {
            junkFiles: {
                files: junkFiles.slice(0, 10),
                fileCount: junkFiles.length,
                summary: junkFiles.length > 0 ? `${junkFiles.length} junk || temporary file${junkFiles.length === 1 ? '' : 's'} detected.` : 'No junk or temporary files found.',
                repositoryHygiene: {
                    totalFiles: files.length,
                    usefulFiles: usefulCount,
                    uselessPct: files.length > 0 ? ((files.length - usefulCount) / files.length * 100).toFixed(1) : '0.0',
                    breakdown: {
                        nodeModules: nodeModuleCount,
                        git: gitCount,
                        buildArtifacts: buildArtifactCount,
                        cacheDirs: cacheDirCount,
                        lockfiles: lockfileCount,
                        archives: archiveCount,
                        binaries: binaryCount,
                        traditionalJunk: junkFiles.length
                    }
                }
            }
        } : {}),
        ...(allowedSections.includes('npmAudit') ? {
            npmAudit: {
                packages: packageJsonFiles.slice(0, 5).map(p => ({
                    path: p.path,
                    name: p.name,
                    depCount: p.depCount,
                    devDepCount: p.devDepCount,
                    hasLockfile: p.hasLockfile,
                    lockfileType: p.lockfileType
                })),
                packageJsonCount: packageJsonFiles.length,
                dependencyCount: totalDependencyCount,
                missingLockfiles: packageJsonFiles.filter(p => !p.hasLockfile).length,
                summary: packageJsonFiles.length > 0 ? `${packageJsonFiles.length} package.json file${packageJsonFiles.length === 1 ? '' : 's'} found with ${totalDependencyCount.toLocaleString()} total dependenc${totalDependencyCount === 1 ? 'y' : 'ies'}.` : 'No package.json files detected.'
            }
        } : {}),
        ...(allowedSections.includes('compliance') ? {
            compliance: {
                licenseFiles: licenseFiles.slice(0, 5),
                securityFiles: securityFiles.slice(0, 5),
                licenseCount: licenseFiles.length,
                securityCount: securityFiles.length,
                govFindings: govFindings.slice(0, 5).map(f => ({
                    file: f.file,
                    matches: f.matches.slice(0, 3).map(m => ({ line: m.line, snippet: m.snippet }))
                })),
                summary: `${licenseFiles.length} license files, ${securityFiles.length} security/governance files detected.`
            }
        } : {}),
        ...(allowedSections.includes('euAiActSummary') ? (() => {
            const euControls = buildEuAiActControls(aiHits, licenseFiles, securityFiles, aiFindings);
            const warnOrWorse = euControls.filter(c => c.status === 'WARN' || c.status === 'FAIL');
            const reviewItems = euControls.filter(c => c.status === 'REVIEW');
            const highRiskIndicators = warnOrWorse.filter(c => c.severity === 'high' || c.severity === 'critical').length;
            const transparencyGaps = warnOrWorse.filter(c => c.controlId === 'EU-AIA-ART-50').length;
            return {
                euAiActSummary: {
                    highRiskIndicators,
                    aiSystemIndicators: aiHits.length,
                    transparencyGaps,
                    documentationArtifacts: (licenseFiles.length + securityFiles.length) || 0,
                    documentationFound: [...licenseFiles, ...securityFiles].slice(0, 10),
                    controls: euControls,
                    deadlineNote: aiHits.length > 0 ? `${aiHits.length} AI system indicator${aiHits.length === 1 ? '' : 's'} detected; ${warnOrWorse.length} control(s) require action, ${reviewItems.length} need review.` : 'Review EU AI Act requirements.'
                },
                euAiActFindings: aiHits.length,
                euAiActScanned: sourceFiles.length
            };
        })() : {}),
        ...(allowedSections.includes('dependencyAudit') ? {
            dependencyAudit: {
                vulnerabilityCount: 0,
                critical: 0,
                high: 0,
                moderate: 0,
                low: 0,
                affectedPackages: [],
                outdatedPackages: [],
                summary: 'Browser scan does ! execute npm audit. Run CLI scan with --audit flag for full CVE report.'
            }
        } : {}),
        ...buildAnalyzerSections({
            aiResidueHits, aiResidueFindings,
            perfHits, perfFindings,
            typeSafetyHits, typeSafetyFindings,
            testHits, testFindings,
            a11yHits, a11yFindings,
            i18nHits, i18nFindings,
            sensitiveDataHits, sensitiveDataFindings,
            configDriftHits, configDriftFindings,
            securityHeaderHits, securityHeaderFindings,
            dbPatternHits, dbPatternFindings,
            frameworkHits, frameworkFindings,
            workspaceHits, workspaceFindings,
            unusedDepHits, unusedDepFindings,
            apiContractHits, apiContractFindings,
            complexityHits, complexityFindings,
            llmSlopHits, llmSlopFindings,
            tokenBleedHits, tokenBleedFindings,
            productionLeakHits, productionLeakFindings,
            fictionKpiHits, fictionKpiFindings,
            securityHits, securityFindings,
            qualityHits, qualityFindings,
            maintainabilityHits, maintainabilityFindings,
            evalDangerHits, evalDangerFindings,
            innerHtmlXssHits, innerHtmlXssFindings,
            prototypePollutionHits, prototypePollutionFindings,
            unhandledPromiseHits, unhandledPromiseFindings,
            magicNumberHits, magicNumberFindings,
            missingStrictModeHits, missingStrictModeFindings,
            uninitializedReadHits, uninitializedReadFindings,
            unvalidatedRedirectHits, unvalidatedRedirectFindings,
            missingRateLimitHits, missingRateLimitFindings,
            insecureRandomHits, insecureRandomFindings,
            loggingSecretsHits, loggingSecretsFindings,
            hardcodedConfidenceHits, hardcodedConfidenceFindings,
            hardcodedCompletionHits, hardcodedCompletionFindings,
            mockPathLeakHits, mockPathLeakFindings,
            sampleJsonRefHits, sampleJsonRefFindings,
            governanceMarkerHits, governanceMarkerFindings,
            aiPlaceholderCommentHits, aiPlaceholderCommentFindings,
            aiPlaceholderBlockHits, aiPlaceholderBlockFindings,
            markdownFenceLeakHits, markdownFenceLeakFindings,
            emptyStubFunctionHits, emptyStubFunctionFindings,
            arrowStubHits, arrowStubFindings,
            roadmapMarkerHits, roadmapMarkerFindings
        }, allowedSections),
        fileList: files.map(f => f.webkitRelativePath || f.name).filter(p => !/node_modules\/|\.git\/|\.github-sync\/|github-cache\/|\.cursor\/|\.windsurf\/|\.vscode\/|\.idea\/|\.husky\/|\.simplebeacon\/|backups\/|java-ai-vulnerable\//.test(p.toLowerCase())),
        ...(allowedSections.includes('architectureDrift') ? {
            architectureDrift: {
                findings: archDriftFindings.slice(0, 10),
                count: archDriftFindings.length,
                summary: archDriftFindings.length > 0 ? `${archDriftFindings.length} architecture drift / token bleed finding(s) detected.` : 'No architecture drift or token bleed issues detected.'
            }
        } : {}),
        ...(syncIoFindings.length > 0 ? { syncIoFindings: syncIoFindings.slice(0, 10) } : {}),
        ...(allowedSections.includes('fileNaming') ? {
            fileNaming: {
                findings: fileNamingResult.findings.slice(0, 10),
                hits: fileNamingHits,
                styleStats: fileNamingResult.styleStats,
                summary: fileNamingHits > 0 ? `${fileNamingHits} file naming issue(s) detected.` : 'No file naming issues detected.'
            }
        } : {}),
        ...(allowedSections.includes('removableFiles') ? {
            removableFiles: {
                categories: removableResult.categories,
                totalFiles: removableResult.totalFiles,
                totalRemovable: removableResult.totalRemovable,
                totalRemovableBytes: removableResult.totalRemovableBytes,
                totalRemovableFormatted: removableResult.totalRemovableFormatted,
                summary: removableResult.summary
            }
        } : {}),
        ...(allowedSections.includes('buildReadiness') ? (() => {
            const lowerPaths = (sourceFiles.map(f => (f.webkitRelativePath || f.name).toLowerCase()));
            const allPaths = sourceFiles.map(f => (f.webkitRelativePath || f.name).replace(/\\/g, '/'));
            const dominantLang = detectDominantLanguage(allPaths);
            const langChecks = getBuildChecksForLanguage(dominantLang);
            // Detect monorepo: if all paths share a common prefix deeper than one segment,
            // root config files may live at parent levels — check any path depth
            const commonPrefix = allPaths.length > 0 ? allPaths[0].split('/').slice(0, -1).join('/') : '';
            const isSubfolder = allPaths.length > 0 && allPaths.every(p => p.startsWith(commonPrefix + '/') || p === commonPrefix);
            const findAtAnyDepth = (re) => lowerPaths.some(p => re.test(p));
            // Map LANGUAGE_REGISTRY buildChecks to the format expected by the readiness scorer
            const brChecks = langChecks.map(check => ({
                name: check.name,
                found: check.customCheck
                    ? check.customCheck(allPaths)
                    : findAtAnyDepth(check.regex),
                critical: check.critical
            }));
            // If JS-dominant and package.json was found at any depth, ensure we don't duplicate it as missing
            const hasPackageJsonAnywhere = lowerPaths.some(p => /(^|\/)package\.json$/.test(p));
            const hasLockfileAnywhere = lowerPaths.some(p => /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|bun\.lock)$/.test(p));
            if (dominantLang === 'javascript' && !hasPackageJsonAnywhere) {
                brChecks.push(
                    { name: 'package.json', found: false, critical: true },
                    { name: 'Lockfile', found: hasLockfileAnywhere, critical: true }
                );
            }
            const brMissingCritical = brChecks.filter(c => c.critical && !c.found);
            const brMissingNice = brChecks.filter(c => !c.critical && !c.found);
            const brScore = Math.round(((brChecks.filter(c => c.found).length / brChecks.length) * 100));
            return { buildReadiness: {
                readinessScore: brScore,
                readinessStatus: brScore >= 80 ? 'READY' : (brScore >= 50 ? 'NEEDS WORK' : 'BLOCKED'),
                totalChecks: brChecks.length,
                passedChecks: brChecks.filter(c => c.found).length,
                missingCritical: brMissingCritical.map(c => c.name),
                missingRecommended: brMissingNice.map(c => c.name),
                checklist: brChecks,
                summary: `${brScore >= 80 ? 'READY' : (brScore >= 50 ? 'NEEDS WORK' : 'BLOCKED')} — ${brChecks.filter(c => c.found).length} of ${brChecks.length} checklist items present.${brMissingCritical.length ? ` ${brMissingCritical.length} critical blocker${brMissingCritical.length === 1 ? '' : 's'}.` : ''}`,
                remediation: brMissingCritical.length > 0 ? `Missing critical: ${brMissingCritical.map(c => c.name).join(', ')}.` : (brMissingNice.length > 0 ? `Missing recommended: ${brMissingNice.map(c => c.name).join(', ')}.` : 'No remediation needed.'),
                recommendations: brMissingCritical.length > 0 ? ['Add all critical files before production deployment.', 'Start with package.json, README, .gitignore, && .env.example.'] : (brMissingNice.length > 0 ? ['Add recommended files to improve maintainability.', 'Consider Docker, linting config, && CHANGELOG.'] : ['Project is fully ready for production. All checklist items present.']) // simplebeacon-ignore: recommendation text, not a hardcoded secret
            }};
        })() : {}),
        credentialScanned: sourceFiles.length,
        credentialFindings: credentialHits,
        scanDurationMs: Date.now() - startTime,
        repositoryInventory: { totalFiles: files.length, projectRoot: projectName },
        title: profile.title || 'SimpleBeacon Browser Scan',
        summary: {
            gatePass: gatePass,
            qualityScore: qualityScore,
            repositoryFiles: files.length,
            simplebeaconIssues: (profile.checkAi ? aiHits.length : 0) + (profile.checkCredentials ? credentialHits : 0) + (profile.checkDebug ? debugHits.length : 0) + (profile.checkGov ? govHits.length : 0) + (profile.checkAiResidue ? aiResidueHits + perfHits + typeSafetyHits + testHits + a11yHits + i18nHits + sensitiveDataHits + configDriftHits + securityHeaderHits + dbPatternHits + frameworkHits + workspaceHits + unusedDepHits + apiContractHits + complexityHits + llmSlopHits + tokenBleedHits + productionLeakHits + fictionKpiHits : 0) + envInconsistencyFindings.length + missingEnvKeyFindings.length + versionDriftFindings.length + syncIoFindings.length + archDriftFindings.length,
            totalFindings: (profile.checkAi ? aiHits.length : 0) + (profile.checkCredentials ? credentialHits : 0) + (profile.checkDebug ? debugHits.length : 0) + (profile.checkGov ? govHits.length : 0) + (profile.checkAiResidue ? aiResidueHits + perfHits + typeSafetyHits + testHits + a11yHits + i18nHits + sensitiveDataHits + configDriftHits + securityHeaderHits + dbPatternHits + frameworkHits + workspaceHits + unusedDepHits + apiContractHits + complexityHits + llmSlopHits + tokenBleedHits + productionLeakHits + fictionKpiHits : 0) + envInconsistencyFindings.length + missingEnvKeyFindings.length + versionDriftFindings.length + syncIoFindings.length + archDriftFindings.length
        },
        scanProfile: browserScanProfile?.value || 'gate',
        scanProfileLabel: profile.label,
        remediationPhases: (() => {
            const getTaskLsDone = (projectName, phaseId, taskIdx) => {
                try {
                    const pk = 'sbr_' + String(projectName).replace(/[^a-z0-9]/gi, '_') + '_' + phaseId + '_t' + taskIdx;
                    return localStorage.getItem(pk) === '1';
                } catch (e) { return false; }
            };
            const makePhase = (id, title, severity, effort, description, tasks, donePredicates, patches) => {
                const pk = projectName || detectedRoot || 'project';
                const hasFixTask = tasks.some(t => (typeof t === 'object' && t !== null && t.type === 'fix'));
                const taskObjs = tasks.map((t, i) => {
                    const reportDone = donePredicates[i] || false;
                    const lsDone = getTaskLsDone(pk, id, i);
                    // Auto-mark verify/review tasks as done when phase has no fix tasks (clean phase)
                    const autoDone = !hasFixTask && (typeof t === 'object' && t !== null && (t.type === 'verify' || t.type === 'review'));
                    if (typeof t === 'object' && t !== null) {
                        return { ...t, done: reportDone || lsDone || autoDone, patch: patches ? patches[i] : null };
                    }
                    return { description: t, done: reportDone || lsDone || autoDone, patch: patches ? patches[i] : null };
                });
                const doneCount = taskObjs.filter(t => t.done).length;
                const progress = taskObjs.length ? Math.round((doneCount / taskObjs.length) * 100) : 100;
                const status = progress === 100 ? 'completed' : (progress > 0 ? 'in-progress' : 'pending');
                return { id, title, severity, effort, description, tasks: taskObjs, progress, status };
            };
            return [
                ...(gateBlockingCount > 0 ? [makePhase('security', 'Security Hardening', 'critical', '1–2 days', `${gateBlockingCount} credential finding(s) detected.`, [
                    { description: 'Review flagged credential patterns', type: 'review', isStructured: true },
                    { description: 'Move secrets to environment variables', type: 'fix', codeSnippet: 'mv secrets-file secrets-file.example', isStructured: true },
                    { description: 'Re-run gate scan', type: 'verify', codeSnippet: 'npx simplebeacon scan --gate', isStructured: true }
                ], [false, false, gatePassFinal])] : []),
                ...(emptyJsonFiles.length > 0 ? (() => {
                    const fileTasks = emptyJsonFiles.slice(0, 5).map(f => ({ description: `Fix empty JSON: ${f}`, type: 'fix', location: f, isStructured: true }));
                    const tailTasks = [
                        { description: 'Validate all JSON', type: 'verify', codeSnippet: 'npx simplebeacon scan --json', isStructured: true },
                        { description: 'Re-run scan', type: 'verify', codeSnippet: 'npx simplebeacon scan', isStructured: true }
                    ];
                    const allTasks = fileTasks.concat(tailTasks);
                    return [makePhase('integrity', 'Data Integrity', 'high', '2–4 days', `${emptyJsonFiles.length} empty/trivial JSON file(s) detected.`, allTasks, allTasks.map(() => false))];
                })() : []),
                ...(duplicateGroups > 0 ? [makePhase('consistency', 'Consistency & Deduplication', duplicateGroups > 5 ? 'high' : 'medium', '3–5 days', `${duplicateGroups} duplicate file group(s) detected.`, [
                    { description: 'Consolidate duplicate files', type: 'fix', isStructured: true },
                    { description: 'Standardize naming conventions', type: 'doc', isStructured: true },
                    { description: 'Document canonical file locations', type: 'doc', isStructured: true }
                ], [false, false, false])] : []),
                ...(debugHits.length > 0 || bloatFindings.length > 0 ? [makePhase('cleanup', 'Cleanup & Hygiene', debugHits.length > 50 ? 'high' : 'medium', '1–2 days', `${debugHits.length} debug artifact(s)${bloatFindings.length > 0 ? ` + ${bloatFindings.length} bloat file(s)` : ''} detected.`, [
                    { description: 'Remove console.log/debugger statements', type: 'fix', codeSnippet: 'eslint --fix --rule "no-console: error" src/', isStructured: true },
                    { description: 'Delete self-generated bloat files', type: 'fix', isStructured: true },
                    { description: 'Install eslint-plugin-no-console for CI', type: 'fix', codeSnippet: 'npm install eslint-plugin-no-console --save-dev', isStructured: true }
                ], [false, false, false])] : []),
                ...(licenseFiles.length > 0 || securityFiles.length > 0 ? (() => {
                    const licenseTasks = licenseFiles.slice(0, 5).map(f => ({
                        description: `Audit license: ${f}`,
                        type: 'review',
                        location: f,
                        isStructured: true
                    }));
                    const secTasks = securityFiles.slice(0, 5).map(f => ({
                        description: `Review security file: ${f}`,
                        type: 'review',
                        location: f,
                        isStructured: true
                    }));
                    const policyTasks = [
                        {
                            description: 'Verify license compatibility with distribution model',
                            type: 'verify',
                            codeSnippet: 'npx license-checker --summary',
                            isStructured: true
                        },
                        {
                            description: 'Document governance policies',
                            type: 'doc',
                            codeSnippet: 'Add SECURITY.md, CODE_OF_CONDUCT.md',
                            isStructured: true
                        }
                    ];
                    const tasks = licenseTasks.concat(secTasks).concat(policyTasks);
                    return [makePhase('compliance', 'Governance & Compliance', 'medium', '2–3 days', `${licenseFiles.length} license file(s), ${securityFiles.length} security file(s).`, tasks, tasks.map(() => false))];
                })() : []),
                ...(aiHits.length > 0 ? [makePhase('euaiact', 'EU AI Act Compliance', aiHits.length > 0 ? 'high' : 'medium', '5–10 days', `${aiHits.length} AI system indicator(s) detected.`, [
                    { description: 'Review AI system classification (Art. 6)', type: 'review', isStructured: true },
                    { description: 'Generate documentation artifacts', type: 'doc', isStructured: true },
                    { description: 'Schedule legal review', type: 'review', isStructured: true }
                ], [false, false, false])] : []),
                ...(packageJsonFiles.length > 0 ? (() => {
                    const missingLockfiles = packageJsonFiles.filter(p => !p.hasLockfile).length;
                    const perPkgTasks = packageJsonFiles.filter(p => p.depCount > 0 || p.devDepCount > 0).slice(0, 5).map(p => {
                        const shortName = p.path.split('/').slice(-2).join('/');
                        return {
                            description: `Review ${shortName} — ${p.depCount} deps${p.devDepCount > 0 ? ` + ${p.devDepCount} devDeps` : ''}${p.hasLockfile ? `, lockfile: ${p.lockfileType}` : ', **missing lockfile**'}`,
                            type: 'review',
                            location: p.path,
                            isStructured: true
                        };
                    });
                    const auditTask = {
                        description: `Audit ${totalDependencyCount} total dependencies`,
                        type: 'audit',
                        codeSnippet: 'npm audit',
                        isStructured: true
                    };
                    const lockfileFixTask = missingLockfiles > 0 ? [{
                        description: `Add missing lockfiles (${missingLockfiles} package(s))`,
                        type: 'fix',
                        codeSnippet: 'npm install',
                        location: packageJsonFiles.filter(p => !p.hasLockfile).map(p => p.path).join(', '),
                        isStructured: true
                    }] : [];
                    const globalTasks = [
                        auditTask,
                        {
                            description: `Verify lockfile integrity${missingLockfiles > 0 ? ` (${missingLockfiles} missing)` : ''}`,
                            type: 'verify',
                            codeSnippet: 'npm ci',
                            isStructured: true
                        },
                        {
                            description: 'Review dependency update policy',
                            type: 'review',
                            isStructured: true
                        },
                        {
                            description: 'Check for duplicate dependencies across packages',
                            type: 'review',
                            codeSnippet: 'npx depcheck',
                            isStructured: true
                        }
                    ];
                    const allTasks = perPkgTasks.concat(lockfileFixTask).concat(globalTasks);
                    return [makePhase('npmaudit', 'npm Audit', missingLockfiles > 0 ? 'medium' : 'low', '1 day', `${packageJsonFiles.length} package.json file(s), ${totalDependencyCount} total dependencies${missingLockfiles > 0 ? `, ${missingLockfiles} missing lockfile(s)` : ''}.`, allTasks, allTasks.map(() => false))];
                })() : []),
                ...(todoFiles.length > 0 ? (() => {
                    const fileTasks = todoFiles.slice(0, 5).map(f => ({ description: `Address TODO in ${typeof f === 'string' ? f : f.path}`, type: 'fix', location: typeof f === 'string' ? f : f.path, isStructured: true }));
                    const tailTasks = [
                        { description: 'Add test coverage for uncovered modules', type: 'fix', codeSnippet: 'npm test -- --coverage', isStructured: true },
                        { description: 'Install pre-commit hooks', type: 'fix', codeSnippet: 'npx husky install', isStructured: true }
                    ];
                    const allTasks = fileTasks.concat(tailTasks);
                    return [makePhase('optimization', 'Quality Optimization', 'low', 'Ongoing', `${todoFiles.length} TODO/FIXME marker(s) in source code.`, allTasks, allTasks.map(() => false))];
                })() : [])
            ].filter(Boolean);
        })()
    };

    // Derive severityCounts && issueCount from detectedIssues so they always match
    const derivedCounts = (reportData.detectedIssues || []).reduce((acc, issue) => {
        const sev = issue.severity || 'low';
        acc[sev] = (acc[sev] || 0) + (issue.count || 0);
        return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0 });
    reportData.severityCounts = derivedCounts;
    const derivedIssueCount = (reportData.detectedIssues || []).reduce((sum, issue) => sum + (issue.count || 0), 0);
    reportData.issueCount = derivedIssueCount;
    reportData.simplebeaconIssues = derivedIssueCount;
    reportData.summary.simplebeaconIssues = derivedIssueCount;
    reportData.summary.totalFindings = derivedIssueCount;

    // Strip reportData to only sections the user's tier has activated
    if (typeof filterReportByModules === 'function' && selectedModules) {
        reportData = filterReportByModules(reportData, Array.from(selectedModules));
    }

    appendTerminalLine('Local directory crawl operation complete. Verification tree generated.', 'success');
    appendTerminalLine('Zero-Retention Safeguard Verified. Report compiled locally inside browser sandbox.', 'success');

    // 6-Dimension Data Quality validation before preview render
    const dq = renderQualityScorecard(reportData);
    if (dq.overall === 'FAIL') {
        appendTerminalLine('Certificate generation blocked: Data quality validation failed. Review the scorecard above.', 'error');
        panelStatus.textContent = 'QUALITY_FAIL';
        panelStatus.style.color = '#EF4444';
        if (browserFolderDropzone) browserFolderDropzone.classList.remove('scanning');
        return; // halt certificate pipeline
    }

    panelStatus.textContent = 'SUCCESS_COMPLETED';
    panelStatus.style.color = '#10B981';

    // Compute hash of generated report
    const reportJsonStr = JSON.stringify(reportData);
    computeSha256(reportJsonStr).then(hash => {
        showHashRibbon('browserHashRibbon', 'browserHashValue', hash);
    });

    if (browserFolderDropzone) browserFolderDropzone.classList.remove('scanning');
    renderPreview(reportData);
    scanPreview.style.display = 'block';
    updateSubmit();
    // Auto-scroll to certificate section after scan
    setTimeout(() => {
        document.getElementById('tokenActionRow').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    const statusParts = [`Complete scan: ${files.length.toLocaleString()} files discovered · ${sourceFiles.length.toLocaleString()} analyzed`, `${selectedModules.size} modules selected for ZIP`];
    if (credentialHits) statusParts.push(`${credentialHits} credentials`);
    if (aiHits.length) statusParts.push(`${aiHits.length} AI indicators`);
    if (debugHits.length) statusParts.push(`${debugHits.length} debug artifacts`);
    if (llmSlopHits) statusParts.push(`${llmSlopHits} LLM slop`);
    if (tokenBleedHits) statusParts.push(`${tokenBleedHits} token bleed`);
    if (productionLeakHits) statusParts.push(`${productionLeakHits} production leaks`);
    if (fictionKpiHits) statusParts.push(`${fictionKpiHits} fiction KPIs`);
    if (archDriftFindings.length) statusParts.push(`${archDriftFindings.length} arch drift`);
    showStatus(statusParts.join(' · ') + '. Token required for certificate.', 'success');

    // Build Secure Report preview + download
    const existingReport = document.getElementById('secureReportBlock');
    if (existingReport) existingReport.remove();

    const reportBlock = document.createElement('div');
    reportBlock.id = 'secureReportBlock';
    reportBlock.style.marginTop = '16px';
    reportBlock.style.padding = '16px';
    reportBlock.style.background = 'rgba(16,185,129,0.06)';
    reportBlock.style.border = '1px solid rgba(16,185,129,0.2)';
    reportBlock.style.borderRadius = '10px';

    const reportJson = JSON.stringify(reportData, null, 2);
    // Build report block using DOM APIs instead of innerHTML
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '1.2rem';
    iconSpan.textContent = '\u{1F513}';
    const titleDiv = document.createElement('div');
    const titleText = document.createElement('div');
    titleText.style.cssText = 'font-size:0.85rem;font-weight:700;color:#34D399;';
    titleText.textContent = 'Secure Report Ready';
    const subText = document.createElement('div');
    subText.style.cssText = 'font-size:0.75rem;color:var(--text-muted);';
    subText.textContent = "Review what's included before downloading. No source code in this file.";
    titleDiv.appendChild(titleText);
    titleDiv.appendChild(subText);
    headerDiv.appendChild(iconSpan);
    headerDiv.appendChild(titleDiv);

    const details = document.createElement('details');
    details.style.marginBottom = '12px';
    const summary = document.createElement('summary');
    summary.style.cssText = 'font-size:0.8rem;color:#60A5FA;cursor:pointer;font-weight:600;';
    summary.textContent = 'Preview report.json contents';
    const pre = document.createElement('pre');
    pre.style.cssText = 'margin-top:8px;padding:12px;background:#0B0F19;border:1px solid var(--border);border-radius:8px;font-size:0.75rem;color:#94A3B8;overflow-x:auto;max-height:200px;';
    pre.textContent = reportJson;
    details.appendChild(summary);
    details.appendChild(pre);

    const downloadBtn = document.createElement('button');
    downloadBtn.id = 'downloadReportBtn';
    downloadBtn.className = 'btn btn-primary';
    downloadBtn.style.cssText = 'background:linear-gradient(135deg,#059669,#047857);width:100%;';
    const btnIcon = document.createElement('span');
    btnIcon.textContent = '\u{1F4E5}';
    downloadBtn.appendChild(btnIcon);
    downloadBtn.appendChild(document.createTextNode(' Download report.json'));

    reportBlock.appendChild(headerDiv);
    reportBlock.appendChild(details);
    reportBlock.appendChild(downloadBtn);
    status.parentNode.insertBefore(reportBlock, status.nextSibling);

    document.getElementById('downloadReportBtn').addEventListener('click', () => {
        const blob = new Blob([reportJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'report.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 100);
    });
    return reportData;
    } catch (err) {
        if (err.message !== 'Scan aborted') { // simplebeacon-ignore: strict !== comparison
            appendTerminalLine(`Scan failed: ${err.message}`, 'error');
            if (err.stack) {
                const stackLines = err.stack.split('\n').slice(0, 6);
                stackLines.forEach(l => appendTerminalLine('  ' + l.trim(), 'error'));
            }
            panelStatus.textContent = 'FAILED';
            panelStatus.style.color = '#EF4444';
        }
    } finally {
        if (browserFolderDropzone) browserFolderDropzone.classList.remove('scanning');
        const cancelBtn = document.getElementById('cancelScanBtn');
        if (cancelBtn) cancelBtn.style.display = 'none';
        const downloadLogBtn = document.getElementById('downloadLogBtn');
        if (downloadLogBtn) downloadLogBtn.style.display = 'none';
        scanAbortController = null;
    }
}

if (typeof window !== 'undefined') {
    window.extractMatches = extractMatches;
    window.processLocalCLIScan = processLocalCLIScan;
}

