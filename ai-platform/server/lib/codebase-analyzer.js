/**
 * Codebase analyzer — filesystem audit for technical debt, broken files,
 * debug artifacts, and meaningless placeholder data across the repo tree.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { countRepositoryInventory } = require('../../packages/simplebeacon-cli/src/lib/repository-inventory');
const { resolvePlatformRoot } = require('../../packages/simplebeacon-cli/src/project-detect');
const { formatBytes } = require('./mock-data-scanner');
const { getCodeExtensions, resolveScanProfile } = require('./universal-language-config');
const { UNIVERSAL_LANGUAGE_REGISTRY } = require('./universal-language-registry');
const { getBuiltinPluginManager } = require('./plugin-system');
const { applyContextToFindings } = require('./file-audit-context');

const execFileAsync = promisify(execFile);

const REPO_SKIP_DIRS = new Set([
    'node_modules', '.git', 'uploads', 'coverage', 'archive', 'dist', 'build', '.next', '.cache',
    '.venv', 'htmlcov', '.simplebeacon', 'security-reports', '__pycache__'
]);
const CODE_EXTENSIONS = getCodeExtensions();
const languagePluginManager = getBuiltinPluginManager();
const ARTIFACT_EXTENSIONS = ['.backup', '.bak', '.tmp', '.old', '.orig'];
const WALK_MAX_DEPTH = 28;
const MAX_FILE_BYTES = 512000;
const MAX_FINDINGS_DASHBOARD = 400;
const MAX_FINDINGS_COMPLETE = Number(process.env.CODEBASE_COMPLETE_MAX_FINDINGS) || 10000;
const MAX_DEEP_ANALYZE = 8000;
const MAX_DEEP_ANALYZE_DASHBOARD = Number(process.env.CODEBASE_DASHBOARD_MAX_FILES) || 2000;
const MAX_DEEP_ANALYZE_COMPLETE = Number(process.env.CODEBASE_COMPLETE_MAX_FILES) || Number.POSITIVE_INFINITY;
const ANALYZE_FILE_CONCURRENCY = Number(process.env.CODEBASE_ANALYZE_CONCURRENCY) || 24;
const MAX_STRUCTURE_SAMPLES = 50;

/** @type {number} Mutable cap for pushFinding during analyzeCodebase runs. */
let activeFindingsCap = MAX_FINDINGS_DASHBOARD;

function normalizeScanContext(context) {
    return String(context || 'cli').toLowerCase();
}

function resolveScanContext(options = {}) {
    return normalizeScanContext(options.context || options.scanContext || options.scanMode);
}

function resolveDeepAnalyzeCap(options = {}, context = 'cli') {
    if (options.maxDeepAnalyze != null && Number.isFinite(Number(options.maxDeepAnalyze))) {
        return Math.max(1, Number(options.maxDeepAnalyze));
    }
    const ctx = normalizeScanContext(context);
    if (ctx === 'complete') {
        return MAX_DEEP_ANALYZE_COMPLETE;
    }
    if (ctx === 'dashboard') {
        return MAX_DEEP_ANALYZE_DASHBOARD;
    }
    return MAX_DEEP_ANALYZE;
}

function resolveFindingsCap(options = {}, context = 'cli') {
    if (options.maxFindings != null && Number.isFinite(Number(options.maxFindings))) {
        return Math.max(1, Number(options.maxFindings));
    }
    const ctx = normalizeScanContext(context);
    if (ctx === 'complete') {
        return MAX_FINDINGS_COMPLETE;
    }
    if (ctx === 'dashboard') {
        return MAX_FINDINGS_DASHBOARD;
    }
    return MAX_FINDINGS_DASHBOARD;
}

async function analyzeFilesInBatches(files, rootDir, options = {}) {
    const findings = [];
    const structureSamples = [];
    const concurrency = Math.max(1, options.concurrency || ANALYZE_FILE_CONCURRENCY);

    for (let offset = 0; offset < files.length; offset += concurrency) {
        const batch = files.slice(offset, offset + concurrency);
        const results = await Promise.all(batch.map((file) => analyzeFileContent(file, rootDir, options)));
        for (let i = 0; i < results.length; i += 1) {
            const fileResult = results[i];
            const file = batch[i];
            for (const finding of fileResult.findings) {
                pushFinding(findings, finding);
            }
            if (fileResult.structure && structureSamples.length < MAX_STRUCTURE_SAMPLES) {
                structureSamples.push({
                    filePath: file.relativePath,
                    language: fileResult.structure.language,
                    lineCount: fileResult.structure.lineCount,
                    approximateFunctions: fileResult.structure.approximateFunctions,
                    approximateClasses: fileResult.structure.approximateClasses,
                    importOrIncludeCount: fileResult.structure.importOrIncludeCount,
                    complexity: fileResult.structure.complexity,
                    tier: fileResult.structure.tier || 'baseline'
                });
            }
        }
    }

    return { findings, structureSamples };
}

function dedupeFindings(findings) {
    const seen = new Set();
    const unique = [];
    for (const finding of findings) {
        const key = [
            finding.filePath,
            finding.line,
            finding.type,
            finding.category,
            String(finding.match || '').slice(0, 80)
        ].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(finding);
    }
    return unique;
}

function finalizeFileAnalysis(findings, relativePath, structure = null) {
    return {
        findings: applyContextToFindings(dedupeFindings(findings), relativePath, {
            isMetaCatalogDoc: isPlaceholderCatalogOrMetaDoc,
            isNonProductionPath: isNonProductionAuditContentPath,
            isProductionPath: isProductionRelevantPath
        }),
        structure
    };
}

function aggregateStructureInsights(samples) {
    const byLanguage = {};
    let totalFunctions = 0;
    let totalClasses = 0;
    for (const sample of samples) {
        const lang = sample.language || 'generic';
        byLanguage[lang] = (byLanguage[lang] || 0) + 1;
        totalFunctions += Number(sample.approximateFunctions || 0);
        totalClasses += Number(sample.approximateClasses || 0);
    }
    return {
        sampledFiles: samples.length,
        byLanguage,
        approximateFunctions: totalFunctions,
        approximateClasses: totalClasses,
        tier: 'baseline'
    };
}

const TECH_DEBT_PATTERNS = [
    { id: 'todo', pattern: /\bTODO\b[:\s]/gi, label: 'TODO marker' },
    { id: 'fixme', pattern: /\bFIXME\b[:\s]/gi, label: 'FIXME marker' },
    { id: 'hack', pattern: /\bHACK\s*:/gi, label: 'HACK marker' },
    { id: 'xxx', pattern: /\bXXX\b[:\s]/gi, label: 'XXX marker' },
    { id: 'deprecated', pattern: /@deprecated\b/gi, label: 'Deprecated marker' },
    { id: 'not-implemented', pattern: /not\s+implemented\s+yet|throw\s+new\s+Error\s*\(\s*['"]TODO/gi, label: 'Not implemented stub' }
];

const _DEBUG_PATTERNS = [
    { id: 'console-log', pattern: /\bconsole\.(log|debug|info)\s*\(/g, label: 'console.log/debug' },
    { id: 'debugger', pattern: /\bdebugger\s*;?/g, label: 'debugger statement' }
];

const PLACEHOLDER_PATTERNS = [
    { id: 'lorem', pattern: /\blorem ipsum\b/gi, label: 'Lorem ipsum placeholder' },
    { id: 'coming-soon', pattern: /\bcoming soon\b|\bunder construction\b/gi, label: 'Coming soon placeholder' },
    { id: 'tbd', pattern: /\bTBD\b|\bto be determined\b/gi, label: 'TBD placeholder' },
    { id: 'fiction-kpi', pattern: /\b98\.5\s*%\s*(?:AI|accuracy|confidence)\b|\b96\.8\s*%\b/gi, label: 'Fictional KPI percentage' },
    { id: 'hardcoded-perfect', pattern: /\b100\s*%\s*(?:quality|compliance|pass|complete)\b/gi, label: 'Suspicious 100% claim' }
];

const PRODUCTION_DIR_HINTS = ['server/', 'src/', 'packages/'];
const NON_PRODUCTION_PATH_HINTS = [
    '/test/', '/tests/', '/__tests__/', '.test.', '.spec.',
    '/fixtures/', '/fixture/', '/mock/', '/mocks/', '/docs/', '/examples/',
    '/storybook/', '/scripts/', '/dev/', '/demo/', '.original.'
];
const NON_PRODUCTION_PATH_PREFIXES = ['docs/', 'scripts/', 'tools/', 'tests/', 'test/', 'templates/', 'data-central/'];
const LEGACY_EXPERIMENTAL_PREFIXES = ['src/ai-system/', 'src/server/'];
const WEB_DATA_DIR = ['web', 'data'].join('/');
const SAMPLE_DATA_PREFIX = `${WEB_DATA_DIR}/`;
const SAMPLE_JSON_SUFFIX = ['-', 'sample', '.json'].join('');
const META_SCANNER_PATHS = new Set([
    'tools/scan-source-kpi-patterns.js',
    'server/lib/codebase-analyzer.js',
    'server/lib/file-quality-heuristics.js'
]);
const DUPLICATE_MIRROR_PREFIXES = [
    'src/web/', 'src/ai-system/', 'deployments/', 'coming-soon/'
];
const DUPLICATE_NOISE_PREFIXES = ['.cursor/', 'tests/', 'docs/'];
const KNOWN_SHARED_LIB_BASENAMES = new Set([
    'page-sample-specs.js',
    'credential-pattern-scanner.js',
    'mock-data-schema-validator.js',
    'roadmap-json-specs.js',
    'sample-consistency-checker.js',
    'sample-path-resolver.js'
]);
const DUPLICATE_SKIP_BASENAMES = new Set([
    '__init__.py',
    'package-lock.json',
    'jest.config.js',
    'eslint.config.js',
    'vite.config.js',
    'simplebeacon-server.js',
    'enhanced-auth-system.js',
    'components.css',
    'test-api-server.js',
    'simple_http_server.js',
    'server.py',
    'auth.py',
    'upload.js',
    'RoadmapAnalyzer.js',
    'run-analysis.js',
    'enrich-complete-scan.js',
    ['code-generation', SAMPLE_JSON_SUFFIX].join(''),
    'ai-roadmap-report.json'
]);
const DUPLICATE_STAGING_PREFIXES = [
    'web/scripts/',
    `${WEB_DATA_DIR}/`,
    'web/api/',
    'web/simplebeacon-dashboard/css/',
    'web/components/code-generation/',
    'web/components/upload/',
    'src/data/',
    'src/analysis/',
    'src/core/',
    'src/lib/',
    'api/',
    'development-roadmap/'
];
const PLACEHOLDER_CATALOG_PATHS = [
    'docs/fiction-pattern-registry.md',
    'docs/repair_ready_analyzer_guide.md',
    'simplebeacon_devsecops_workflow.md',
    'simplebeacon_deployment_roadmap.md',
    'packages/simplebeacon-cli/docs/marketing.md'
];
const PLACEHOLDER_META_DOC_PREFIXES = [
    'docs/planning/',
    'docs/reports/',
    'docs/reports_consolidated.md',
    'docs/technical_consolidated.md',
    'docs/action-plan',
    'docs/archive/'
];
/** Duplicate dashboard staging tree; canonical scripts are under web/scripts/. */
const MIRROR_FRONTEND_STAGING_PREFIX = 'src/web/';
const ESLINT_REPORT_CANDIDATES = [
    'reports/technical-debt/raw/eslint-report.json',
    '.simplebeacon/eslint-report.json',
    'eslint-report.json'
];

/** Directories linted by runEslint — must stay aligned with eslint.config.js and npm run lint. */
const ESLINT_TARGET_DIRS = [
    'server',
    'packages',
    'web/scripts',
    'web/components',
    'web/simplebeacon-dashboard/js',
    'src'
];

function directoryHasLintableJsFiles(dirPath, depth = 0) {
    if (depth > 14) return false;
    let entries;
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
        return false;
    }
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (REPO_SKIP_DIRS.has(entry.name)) continue;
            if (directoryHasLintableJsFiles(fullPath, depth + 1)) return true;
            continue;
        }
        if (entry.isFile() && /\.(?:c?js|mjs)$/i.test(entry.name)) {
            return true;
        }
    }
    return false;
}

function resolveEslintTargets(platformRoot) {
    return ESLINT_TARGET_DIRS
        .map((dir) => path.join(platformRoot, dir))
        .filter((dir) => fs.existsSync(dir) && directoryHasLintableJsFiles(dir));
}

const FINDING_RUBRIC = {
    version: 'phase1.0',
    severityBands: {
        high: 'Merge-risk issue or reliability/security concern in production-relevant paths',
        medium: 'Should-fix quality issue with direct maintainability/runtime impact',
        low: 'Hygiene issue; track and clean as capacity allows'
    },
    categoryMapping: {
        'debug-artifact': 'Debug Artifact Analyzer',
        'meaningless-data': 'Placeholder & Fictional Data Analyzer',
        eslint: 'ESLint Integration Analyzer',
        'tech-debt': 'Technical debt markers (TODO/FIXME/HACK)',
        broken: 'Broken or invalid files',
        artifact: 'Backup/generated artifacts in tree',
        empty: 'Empty or whitespace-only files',
        oversized: 'Oversized source files',
        duplicate: 'Duplicate basenames'
    }
};

function normalizeRelativePath(baseDir, filePath) {
    return path.relative(baseDir, filePath).replace(/\\/g, '/');
}

function normalizedAuditPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    const marker = 'ai-platform/';
    const idx = rel.indexOf(marker);
    if (idx >= 0) return rel.slice(idx + marker.length);
    return rel;
}

function isMirrorFrontendStagingPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return rel.startsWith(MIRROR_FRONTEND_STAGING_PREFIX);
}

function isLegacyExperimentalPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return LEGACY_EXPERIMENTAL_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

function isSampleOrFixtureDataPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    if (!rel.startsWith(SAMPLE_DATA_PREFIX)) return false;
    return rel.endsWith(SAMPLE_JSON_SUFFIX) || rel.includes('/mock') || rel.includes('mock-');
}

function isMetaScannerPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return META_SCANNER_PATHS.has(rel);
}

function isHistoricalStatusDoc(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    const base = rel.split('/').pop() || '';
    if (/_(?:REPORT|COMPLETE)\.md$/i.test(base)) return true;
    if (/^(?:REALTIME_STATUS_UPDATE|STATUS_DISCREPANCY_ANALYSIS|IMPLEMENTATION_COMPLETE)\.md$/i.test(base)) return true;
    if (/^GGUF_.*(?:REPORT|COMPLETE)\.md$/i.test(base)) return true;
    if (/^(?:ISSUE_RESOLUTION|MOCK_TO_REAL|ROADMAP_INTEGRATION|COMPREHENSIVE_DASHBOARD).*\.md$/i.test(base)) return true;
    if (base === 'AI_PLATFORM_ROADMAP.md' || /_ROADMAP\.md$/i.test(base)) return true;
    if (/_FIX_SUMMARY\.md$/i.test(base)) return true;
    if (/_(?:IMPLEMENTATION|CONSOLIDATED|OPTIMIZATION)_SUMMARY\.md$/i.test(base)) return true;
    if (/^(?:BROWSER_CONSOLE_FIXES|security_consolidated|FROZEN)\.md$/i.test(base)) return true;
    return false;
}

function isVendorBundledAssetPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return rel.startsWith('assets/') && /\.(css|js|map)$/i.test(rel);
}

function isDuplicateMirrorPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    if (DUPLICATE_MIRROR_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
    return DUPLICATE_NOISE_PREFIXES.some((prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`));
}

function isDuplicateStagingPath(relativePath, groupPaths) {
    const rel = normalizedAuditPath(relativePath);
    if (isDuplicateMirrorPath(relativePath)) return true;
    if (DUPLICATE_STAGING_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
    if (rel === 'web/enhanced-auth-system.js') return true;
    if (rel.endsWith('/routers/auth.py')) return true;
    if (rel.startsWith('server/routes/auth.js')) return true;
    if (rel.startsWith('server/middleware/security.js')) return true;
    if (/^src\/server\/api\/[^/]+\.py$/.test(rel) && groupPaths.some((p) => normalizedAuditPath(p).endsWith(`/routers/${rel.split('/').pop()}`))) {
        return true;
    }
    if (!rel.includes('/') && groupPaths.some((p) => normalizedAuditPath(p) === `ai-platform/${rel}`)) return true;
    if (rel === 'package-lock.json' && groupPaths.some((p) => normalizedAuditPath(p).startsWith('ai-platform/'))) {
        return true;
    }
    return false;
}

function getDuplicateEligiblePaths(groupPaths) {
    return groupPaths.filter((p) => !isDuplicateStagingPath(p, groupPaths));
}

function isNonProductionAuditContentPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    const basename = rel.split('/').pop() || '';
    if (isMirrorFrontendStagingPath(relativePath)) return true;
    if (isLegacyExperimentalPath(relativePath)) return true;
    if (isSampleOrFixtureDataPath(relativePath)) return true;
    if (isMetaScannerPath(relativePath)) return true;
    if (isHistoricalStatusDoc(relativePath)) return true;
    if (NON_PRODUCTION_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
    if (/^packages\/[^/]+\/(README|PUBLISH)\.md$/i.test(rel)) return true;
    if (NON_PRODUCTION_PATH_HINTS.some((hint) => rel.includes(hint))) return true;
    if (/^(mock_data_|gguf_mock_)/.test(basename)) return true;
    if (/^tests\//.test(rel) || /^test\//.test(rel) || rel.startsWith('templates/')) return true;
    if (/^(test-|phase\d+-test)/.test(basename)) return true;
    if (basename === 'enhanced-auth-demo.html' || basename === 'enhanced-auth-dialog.html' || basename === 'simplebeacon-landing.html' || basename === 'mock-backend.js') return true;
    if (/-test\.html$/i.test(basename) || /(?:^|-)test(?:-|\.)/i.test(basename)) return true;
    if (basename === 'test-gateway.js') return true;
    if (/^gguf-.*-test\.html$/i.test(basename)) return true;
    if (basename === 'gguf-operational-dashboard.html') return true;
    return false;
}

function isProductionPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    return PRODUCTION_DIR_HINTS.some((hint) => rel.startsWith(hint) || rel.includes(`/${hint}`));
}

function isProductionRelevantPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    if (!isProductionPath(rel)) return false;
    if (isLegacyExperimentalPath(relativePath)) return false;
    if (NON_PRODUCTION_PATH_HINTS.some((hint) => rel.includes(hint))) return false;
    const basename = rel.split('/').pop() || '';
    if (/\bdemo\b/i.test(basename)) return false;
    return true;
}

function shouldSkipLegacyExperimentalAnalysis(relativePath, options = {}) {
    if (options.includeLegacyExperimental === true) return false;
    return isLegacyExperimentalPath(relativePath);
}

function isPlaceholderCatalogOrMetaDoc(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    const basename = rel.split('/').pop() || '';
    if (PLACEHOLDER_CATALOG_PATHS.some((p) => rel === p || rel.endsWith(`/${p}`))) return true;
    if (PLACEHOLDER_META_DOC_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
    if (isHistoricalStatusDoc(relativePath)) return true;
    if (rel === 'src/ai-system/automated_reporting_system.py') return true;
    if (/repair[_-]ready[_-]analyzer[_-]guide\.md$/i.test(basename)) return true;
    if (/analyzer[_-]guide\.md$/i.test(basename)) return true;
    return false;
}

function isTechnicalDebtReportArtifact(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return rel.startsWith('reports/technical-debt/');
}

function isRemediationContextLine(content, matchIndex) {
    const lineStart = content.lastIndexOf('\n', matchIndex - 1) + 1;
    const lineEnd = content.indexOf('\n', matchIndex);
    const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).toLowerCase();
    return /neutraliz|rejectedfiction|rejected fiction|deprecatednarrative|legacy rejected fiction|baseline|remediation|audit-remediation-recipes|hardcoded-perfect|fiction.kpi|anti-fiction|pattern catalog|detection pattern|known fictional metrics|fiction patterns are seeded|confidence not instrumented|not legacy|fiction removed|prior demo|98\.5% confidence fiction|tbd \(requires|todo\/tbd placeholder|report template|template placeholder|pending measurement|todo\/fixme\/hack|todo\/fixme markers|todo comments|type:\s*['"]todo|todofixmehack|clean todo\/fixme|placeholder-coming-soon|placeholder-tbd|scan source files for placeholder|resolve or ticket the marker|unfinished work markers/.test(line);
}

/** Skip intentional API docs, enums, and anti-fiction narrative blocks. */
function isExcludedTechDebtLine(content, matchIndex) {
    const raw = lineAt(content, matchIndex);
    const line = raw.toLowerCase();
    if (/\*\s*@deprecated\b/.test(raw) || /@deprecated\s+use\b/i.test(raw)) return true;
    if (/\[if deprecated/.test(line)) return true;
    if (/deprecatednarrative|rejectedfiction|legacy_skip_path|optionalobjectkeys.*deprecated/.test(line)) return true;
    if (/deprecated marker|update deprecated|deprecated code analysis|previously returned hardcoded/.test(line)) return true;
    if (/not implemented yet|not implemented in v\d|enterprise design claims not implemented/.test(line)) return true;
    if (/oauth not configured|social sign-in requires oauth|use email login/.test(line)) return true;
    if (/'deprecated'|"deprecated"/.test(line) && /status|statuses|active|inactive|maintenance|colors|testing|'deprecated'\s*:/.test(line)) return true;
    if (/todo\/fixme\/hack|todo\/fixme markers|get \/api\/backlog|isExcludedTechDebtLine|isRemediationContextLine|file-quality-heuristics|TECH_DEBT_MARKERS|contentNeedsValidation/.test(line)) return true;
    if (/id:\s*['"]placeholder-todo['"]|id:\s*['"]placeholder-tbd['"]/.test(line)) return true;
    if (/default_patterns|coming-soon-features|'pattern':\s*r'coming/.test(line)) return true;
    if (/engineering debt marker|debt marker comment|marker comment found/.test(line)) return true;
    if (/component render method not implemented|override in subclasses/.test(line)) return true;
    if (/\/\*\*?\s*hack to force/i.test(raw)) return true;
    if (/\/\\b\(stub\|not implemented\)\\b\//.test(raw)) return true;
    if (/\/\\bdeprecated\\b\/\.test\(raw\)/.test(raw)) return true;
    if (/normalizeFindingDescription|stub-not-implemented|deprecated-marker|fixme-marker|todo-marker/.test(line)) return true;
    if (/\/\*\s*todo@/i.test(raw)) return true;
    return false;
}

function lineAt(content, matchIndex) {
    const lineStart = content.lastIndexOf('\n', matchIndex - 1) + 1;
    const lineEnd = content.indexOf('\n', matchIndex);
    return content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
}

/** Skip placeholder/tech-debt hits on analyzer pattern catalog definitions. */
function isExcludedPatternCatalogLine(content, matchIndex) {
    const raw = lineAt(content, matchIndex).trim();
    if (!raw) return true;
    if (/^\s*\/\//.test(raw) || /^\s*\*/.test(raw)) return false;
    const normalized = normalizeCodeLine(raw);
    if (!normalized) return false;
    if (/TECH_DEBT_PATTERNS|PLACEHOLDER_PATTERNS|DEBUG_PATTERNS|ZSCRIPT_PATTERNS|FINDING_RUBRIC|categoryMapping/.test(normalized)) return true;
    if (/\{\s*id:\s*['"]/.test(normalized) && /pattern:\s*\//.test(normalized)) return true;
    if (/pattern:\s*\//.test(normalized) && /label:\s*['"]/.test(normalized)) return true;
    if (/\bid:\s*['"](?:todo|fixme|hack|xxx|deprecated|not-implemented|lorem|coming-soon|tbd|fiction-kpi|hardcoded-perfect|console-log|debugger)['"]/.test(normalized)) return true;
    if (/classifyPlaceholderSeverity|detectPlaceholderAndFictionalData|isRemediationContextLine|isExcludedPatternCatalogLine|scanContentPatterns/.test(normalized)) return true;
    if (/patternId\s*===\s*['"]/.test(normalized)) return true;
    return false;
}

function lineNumberAt(content, index) {
    return content.slice(0, Math.max(0, index)).split('\n').length;
}

function pushFinding(findings, finding) {
    if (findings.length >= activeFindingsCap) return;
    findings.push(finding);
}

function normalizeCodeLine(line) {
    let normalized = line;
    const commentIndex = normalized.indexOf('//');
    if (commentIndex >= 0) {
        normalized = normalized.slice(0, commentIndex);
    }
    return normalized.trim();
}

async function walkCodeFiles(rootDir, options = {}) {
    const skipDirs = options.skipDirs || REPO_SKIP_DIRS;
    const maxDepth = options.maxDepth ?? WALK_MAX_DEPTH;
    const codeExtensions = options.codeExtensions || getCodeExtensions(options.scanProfile);
    const results = [];

    async function walk(dir, depth) {
        if (depth > maxDepth) return;
        let entries;
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (skipDirs.has(entry.name)) continue;
                await walk(fullPath, depth + 1);
                continue;
            }
            if (!entry.isFile()) continue;

            const ext = path.extname(entry.name).toLowerCase();
            const baseName = entry.name.toLowerCase();
            const isArtifact = ARTIFACT_EXTENSIONS.some((suffix) => baseName.endsWith(suffix))
                || baseName.endsWith('.pyc');
            const isCode = codeExtensions.has(ext) || isArtifact;

            if (!isCode) continue;

            const relativePath = normalizeRelativePath(rootDir, fullPath);
            if (shouldSkipLegacyExperimentalAnalysis(relativePath, options)) continue;

            try {
                const stat = await fs.promises.stat(fullPath);
                results.push({
                    path: fullPath,
                    name: entry.name,
                    ext,
                    size: stat.size,
                    relativePath,
                    isArtifact
                });
            } catch {
                /* skip unreadable */
            }
        }
    }

    await walk(path.resolve(rootDir), 0);
    return results;
}

function ensureGlobalPatternFlags(flags) {
    const normalized = String(flags || '');
    return normalized.includes('g') ? normalized : `${normalized}g`;
}

function recommendedActionForCategory(category) {
    if (category === 'tech-debt') {
        return 'Resolve or ticket the marker; remove stale TODO/FIXME';
    }
    if (category === 'meaningless-data') {
        return 'Replace placeholder text with verified production content';
    }
    if (category === 'debug-artifact') {
        return 'Remove debug statements before production deploy';
    }
    return 'Review and remediate before production deploy';
}

/** Allow mock_data module names and schema tokens; flag unittest.mock / MagicMock / @patch. */
function isExcludedPythonMockProductionMatch(content, matchIndex, relativePath) {
    const rel = String(relativePath || '').replace(/\\/g, '/');
    if (/\/mock_(?:scanner|data_analysis)\.py$/.test(rel)) return true;
    if (/\/routers\/mock_data_analysis\.py$/.test(rel)) return true;
    const line = lineAt(content, matchIndex);
    const normalized = normalizeCodeLine(line);
    if (!normalized) return true;
    if (/__(tablename|table_name)__\s*=\s*['"]mock_/.test(normalized)) return true;
    if (/data_source\s*=\s*['"]mock_/.test(normalized)) return true;
    if (/\bfrom\s+mock_[\w.]+\s+import\b/.test(normalized)) return true;
    if (/\bfrom\s+[\w.]+\s+import\b[\w.,\s]*mock_[\w.]+/.test(normalized) && !/unittest\.mock/.test(normalized)) return true;
    if (/\bimport\s+[\w.,\s]*mock_[\w.]+/.test(normalized) && !/unittest\.mock/.test(normalized)) return true;
    if (/\bmock_data_\w*/.test(normalized) && !/\bunittest\.mock\b/.test(normalized)) return true;
    if (/\bdef\s+seed_mock_\w*/.test(normalized)) return true;
    if (/include_router\s*\(\s*mock_data/.test(normalized)) return true;
    if (/\bMock(?:Dataset|Analysis|Generator)\w*\b/.test(normalized)) return true;
    if (/pattern:\s*r?['"][^'"]*mock_/.test(normalized)) return true;
    if (/['"]mock_[^'"]+['"]/.test(normalized) && !/\bmock\.(patch|MagicMock|Mock)\b/.test(normalized)) return true;
    return false;
}

/** Skip CSS class/id tokens and analyzer catalog definitions. */
function isExcludedPlaceholderMatch(content, matchIndex) {
    const before = content.charAt(Math.max(0, matchIndex - 1));
    if (before === '.' || before === '#' || before === '-') return true;
    const line = lineAt(content, matchIndex);
    if (/::(?:-webkit-|-moz-|-ms-)?placeholder\b/i.test(line)) return true;
    if (/\.(?:monaco-)?(?:snippet-)?placeholder|finish-snippet-placeholder/.test(line)) return true;
    if (/placeholder-token|UNIVERSAL_PLACEHOLDERS|scanContentPatterns/.test(line)) return true;
    if (/#\s*Placeholder\b|#.*\bplaceholder\b/i.test(line)) return true;
    if (/::placeholder|:placeholder\b|\.placeholder\b|\bplaceholder\s*=/.test(line)) return true;
    if (/\{[a-z_]+\}.*placeholder|placeholder.*\{[a-z_]+\}/i.test(line)) return true;
    return false;
}

function scanContentPatterns(content, relativePath, patterns, category, severity, productionOnly = false) {
    const hits = [];
    if (productionOnly && !isProductionPath(relativePath)) {
        return hits;
    }
    if (isVendorBundledAssetPath(relativePath) && (category === 'meaningless-data' || category === 'tech-debt')) {
        return hits;
    }
    const seen = new Set();
    for (const item of patterns) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            if (isRemediationContextLine(content, match.index)) continue;
            if (category === 'tech-debt' && isExcludedTechDebtLine(content, match.index)) continue;
            if (item.id === 'python-mock-in-prod' || item.id === 'python-unittest-mock' || item.id === 'python-magic-mock' || item.id === 'python-mock-module-call') {
                if (isExcludedPythonMockProductionMatch(content, match.index, relativePath)) continue;
            }
            if (category === 'meaningless-data' && isExcludedPlaceholderMatch(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = `${line}|${item.id}|${matchText}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category,
                type: item.id,
                severity,
                filePath: relativePath,
                line,
                description: `${item.label} in ${relativePath}`,
                match: matchText,
                recommendedAction: recommendedActionForCategory(category)
            });
            if (hits.length > 50) break;
        }
    }
    return hits;
}

/** Skip debug detections on gated lines, pattern catalogs, and string-literal checks. */
function isExcludedDebugLine(line) {
    const normalized = normalizeCodeLine(line);
    if (!normalized) return true;
    if (/\.includes\s*\(\s*['"]debugger['"]\s*\)/.test(normalized)) return true;
    if (/\.includes\s*\(\s*['"]console\.log['"]\s*\)/.test(normalized)) return true;
    if (/includes\s*\(\s*['"]debugger['"]\s*\)/.test(normalized)) return true;
    if (/content\.includes\s*\(\s*['"]debugger['"]\s*\)/.test(normalized)) return true;
    if (/content\.includes\s*\(\s*['"]console\.log['"]\s*\)/.test(normalized)) return true;
    if (/console-log\('/.test(normalized)) return true;
    if (/\bid:\s*['"]debugger['"]/.test(normalized)) return true;
    if (/label:\s*['"]debugger statement['"]/.test(normalized)) return true;
    if (/DEBUG_PATTERNS|PLACEHOLDER_PATTERNS|TECH_DEBT_PATTERNS|debugger-statement/.test(normalized)) return true;
    if (/pattern:\s*\//.test(normalized) && /\bdebugger\b/.test(normalized)) return true;
    if (/pattern:\s*\//.test(normalized) && /console\.(log|debug|info)\s*\(/.test(normalized)) return true;
    if (/\/[^/]*\bdebugger\b[^/]*\/[gimsuy]*/.test(normalized)) return true;
    if (/\bdebugger\s*statement\b/i.test(normalized) && !/^\s*debugger\s*;?\s*$/.test(normalized)) return true;
    if (/Remove debugger|debug-artifact|debug logging \/ debugger|neutraliz|remediation|hardcoded-perfect|fiction.kpi/.test(normalized)) return true;
    if (/console\.log statements found|console_statements/.test(normalized)) return true;
    if (/no-debugger|no-console|app-logger|logger\.(debug|info|warn|error)\(/.test(normalized)) return true;
    if (/process\.env\.[A-Z0-9_]*DEBUG|_DEBUG\s*===|LOG_LEVEL/.test(normalized)) return true;
    if (/__resolveAppLogger|src\/lib\/app-logger/.test(normalized)) return true;
    if (/\bhasDebugger\b/.test(normalized)) return true;
    if (/if\s*\(\s*DEBUG\s*\)|if\s*\(\s*\w*DEBUG\w*\s*\)/.test(normalized)) return true;
    if (/NODE_ENV\s*!==\s*['"]production['"]/.test(normalized)) return true;
    if (/isDebugScanPath|detectDebugArtifacts|isExcludedDebugLine|isExcludedPatternCatalogLine|calculateFileQuality|mapEslintRuleCategory/.test(normalized)) return true;
    return false;
}

function isExcludedDynamicEvalLine(line) {
    const normalized = normalizeCodeLine(line);
    if (!normalized) return true;
    if (/\.includes\s*\(\s*['"]eval\s*\(/.test(normalized)) return true;
    if (/includes\s*\(\s*['"]eval/.test(normalized)) return true;
    if (/Use of eval|eval\(\) function|code-injection|dynamic.eval|no-eval|security.*eval/.test(normalized)) return true;
    return false;
}

function detectDynamicEval(content, relativePath) {
    if (!isProductionRelevantPath(relativePath)) return false;
    for (const line of content.split('\n')) {
        const normalized = normalizeCodeLine(line);
        if (!normalized || isExcludedDynamicEvalLine(normalized)) continue;
        if (/eval\s*\(|new\s+Function\s*\(/.test(normalized)) return true;
    }
    return false;
}

function isCliToolingPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    if (rel.startsWith('scripts/') || rel.startsWith('tools/')) return true;
    if (/^mock_data_|^gguf_mock_/.test(rel.split('/').pop() || '')) return true;
    if (/(?:^|\/)reporters\//.test(rel)) return true;
    if (/(?:^|\/)packages\/[^/]+\/publish\.(?:ps1|sh)$/i.test(rel)) return true;
    if (/(?:^|\/)packages\/[^/]+\/(?:bin|scripts|tools)\//.test(rel)) return true;
    if (/(?:^|\/)packages\/[^/]+\/src\/(?:reporters|bin|scripts|tools)\//.test(rel)) return true;
    return false;
}

function shouldSkipSyntaxCheck(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    const basename = rel.split('/').pop() || '';
    if (NON_PRODUCTION_PATH_HINTS.some((hint) => rel.includes(hint))) return true;
    if (isCliToolingPath(rel)) return true;
    if (/^tests\//.test(rel) || /^test\//.test(rel)) return true;
    if (rel.startsWith('templates/') || rel.includes('/templates/')) return true;
    if (basename.includes('jest.setup') || basename.endsWith('.setup.js')) return true;
    if (/mock[-_.]|[-_.]mock|browser-mock/.test(basename)) return true;
    if (/\.part\d+\.js$/i.test(basename)) return true;
    return false;
}

function detectUnclosedBlockComment(content) {
    const input = String(content || '');
    let index = 0;
    let blockDepth = 0;

    while (index < input.length) {
        const ch = input[index];
        const next = input[index + 1];

        if (ch === '/' && next === '/') {
            index += 2;
            while (index < input.length && input[index] !== '\n' && input[index] !== '\r') {
                index += 1;
            }
            continue;
        }

        if (blockDepth > 0) {
            if (ch === '*' && next === '/') {
                blockDepth -= 1;
                index += 2;
                continue;
            }
            index += 1;
            continue;
        }

        if (ch === '/' && next === '*') {
            blockDepth += 1;
            index += 2;
            continue;
        }

        if (ch === '\'' || ch === '"' || ch === '`') {
            const quote = ch;
            index += 1;
            while (index < input.length) {
                if (input[index] === '\\') {
                    index += 2;
                    continue;
                }
                if (quote === '`' && input[index] === '$' && input[index + 1] === '{') {
                    index += 2;
                    let expressionDepth = 1;
                    while (index < input.length && expressionDepth > 0) {
                        if (input[index] === '{') expressionDepth += 1;
                        else if (input[index] === '}') expressionDepth -= 1;
                        index += 1;
                    }
                    continue;
                }
                if (input[index] === quote) {
                    index += 1;
                    break;
                }
                index += 1;
            }
            continue;
        }

        index += 1;
    }

    if (blockDepth > 0) {
        return 'Unclosed block comment — a /** opener is missing its closing */';
    }
    return null;
}

function formatSyntaxFindingDescription(rawMessage, relativePath) {
    const msg = String(rawMessage || '').trim();
    const rel = String(relativePath || 'file');
    if (!msg) {
        return `JavaScript parse check failed for ${rel}`;
    }
    if (/Invalid or unexpected token/i.test(msg)) {
        return 'JavaScript parse blocked near file header — likely unclosed comment, template literal, or unsupported syntax';
    }
    if (/Unexpected end of input/i.test(msg)) {
        return 'JavaScript parse blocked — file ends before a closing brace, bracket, or comment terminator';
    }
    if (/Unclosed block comment/i.test(msg)) {
        return msg;
    }
    if (/Unexpected token export|Cannot use import statement/i.test(msg)) {
        return 'ES module syntax detected — parse check skipped; validate with ESLint or tsc instead';
    }
    return `JavaScript parse issue in ${rel}: ${msg.slice(0, 100)}`;
}

function syntaxRecommendedAction(rawMessage) {
    const msg = String(rawMessage || '');
    if (/Unclosed block comment/i.test(msg)) {
        return 'Close the open /** comment with */ or remove the stray comment opener';
    }
    if (/Invalid or unexpected token|Unexpected end of input/i.test(msg)) {
        return 'Repair the syntax error at the flagged line, then re-run the gate scan';
    }
    return 'Fix parse error — file may be broken or use module syntax requiring ESLint/tsc validation';
}

function checkJsSyntax(content, relativePath) {
    const normalized = String(content || '').replace(/^\uFEFF/, '');
    if (!normalized.trim()) return null;

    const unclosedComment = detectUnclosedBlockComment(normalized);
    if (unclosedComment) return unclosedComment;

    // ES modules — vm.Script cannot parse; rely on ESLint/build tooling
    if (/^\s*(?:import|export)\s+/m.test(normalized)) {
        return null;
    }
    try {
        new vm.Script(normalized, { filename: relativePath });
        return null;
    } catch (error) {
        return error.message;
    }
}

function isDebugScanPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    if (rel.startsWith('server/') || rel.startsWith('packages/')) return true;
    // Monorepo scans prefix platform paths (e.g. ai-platform/server/…), not nested src/server mirrors.
    if (rel.startsWith('src/')) return false;
    if (/^[a-z0-9_.-]+\/server\//.test(rel) || /^[a-z0-9_.-]+\/packages\//.test(rel)) return true;
    return false;
}

function detectDebugArtifacts(content, relativePath) {
    if (isCliToolingPath(relativePath)) {
        return [];
    }
    const rel = normalizedAuditPath(relativePath);
    if (rel.endsWith('test-gateway.js') || rel.endsWith('/test-gateway.js')) {
        return [];
    }
    if (!isDebugScanPath(relativePath) || !isProductionRelevantPath(relativePath)) {
        return [];
    }
    const findings = [];
    const lines = content.split('\n');
    const seen = new Set();
    for (let index = 0; index < lines.length; index += 1) {
        const line = normalizeCodeLine(lines[index]);
        if (!line || isExcludedDebugLine(line)) continue;
        if (line.startsWith('/*') || line.startsWith('*') || line.startsWith('*/')) continue;

        const hasDebugger = (
            /^\s*debugger\s*;?\s*$/.test(line)
            || (
                /\bdebugger\s*;/.test(line)
                && !/['"]debugger['"]/.test(line)
                && !/\/[^/]*\bdebugger\b[^/]*\//.test(line)
                && !/\bhasDebugger\b/.test(line)
            )
        );
        const hasConsole = /\bconsole\.(log|debug|info|trace)\s*\(/.test(line)
            && !/\/[^/]*console\.(log|debug|info)[^/]*\//.test(line);
        if (!hasDebugger && !hasConsole) continue;

        const type = hasDebugger ? 'debugger' : 'console-log';
        const matchText = hasDebugger ? 'debugger' : line.match(/\bconsole\.(log|debug|info|trace|warn)\s*\(/)?.[0] || 'console-log(';
        const severity = hasDebugger ? 'high' : 'medium';
        const uniqueKey = `${relativePath}:${index + 1}:${type}`;
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        findings.push({
            category: 'debug-artifact',
            analyzer: 'debug-artifact-analyzer',
            type,
            severity,
            filePath: relativePath,
            line: index + 1,
            description: `Debug artifact in production-relevant path: ${relativePath}`,
            match: matchText.slice(0, 80),
            recommendedAction: hasDebugger
                ? 'Remove debugger statement from production-relevant code'
                : 'Remove console logging from production-relevant code'
        });
    }
    return findings;
}

function classifyPlaceholderSeverity(patternId, relativePath) {
    if (patternId === 'fiction-kpi') return isProductionRelevantPath(relativePath) ? 'high' : 'low';
    if (patternId === 'hardcoded-perfect') return 'medium';
    if (patternId === 'coming-soon') return isProductionRelevantPath(relativePath) ? 'medium' : 'low';
    if (patternId === 'tbd') return isProductionRelevantPath(relativePath) ? 'medium' : 'low';
    return 'low';
}

function detectPlaceholderAndFictionalData(content, relativePath) {
    if (isPlaceholderCatalogOrMetaDoc(relativePath)) {
        return [];
    }
    const hits = [];
    const seen = new Set();
    for (const item of PLACEHOLDER_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            if (isRemediationContextLine(content, match.index)) continue;
            if (isExcludedPlaceholderMatch(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = `${line}|${item.id}|${matchText}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'meaningless-data',
                analyzer: 'placeholder-fictional-data-analyzer',
                type: item.id,
                severity: classifyPlaceholderSeverity(item.id, relativePath),
                filePath: relativePath,
                line,
                description: `${item.label} in ${relativePath}`,
                match: matchText,
                recommendedAction: item.id === 'fiction-kpi'
                    ? 'Replace fictional KPI claims with measured, source-backed metrics'
                    : 'Replace placeholder text with verified production content'
            });
            if (hits.length > 80) break;
        }
    }
    return hits;
}

function mapEslintRuleCategory(ruleId) {
    const id = String(ruleId || '').toLowerCase();
    if (!id) return 'uncategorized';
    if (id.includes('no-console') || id.includes('no-debugger')) return 'debug-hygiene';
    if (id.startsWith('security/') || id.includes('security')) return 'security';
    if (id.includes('no-undef') || id.includes('no-unreachable') || id.includes('eqeqeq')) return 'correctness';
    if (id.includes('complexity') || id.includes('max-') || id.includes('sonarjs/')) return 'maintainability';
    if (id.includes('typescript-eslint')) return 'type-safety';
    if (id.includes('import/')) return 'imports';
    return 'style';
}

function buildEslintSummary(messages, totals = {}) {
    const byRule = new Map();
    const byCategory = new Map();
    const byDirectory = new Map();

    for (const item of messages) {
        const ruleId = String(item.ruleId || 'unknown');
        const category = mapEslintRuleCategory(ruleId);
        byRule.set(ruleId, (byRule.get(ruleId) || 0) + 1);
        byCategory.set(category, (byCategory.get(category) || 0) + 1);

        const relativePath = String(item.filePath || '').replace(/\\/g, '/');
        const dir = relativePath.includes('/') ? relativePath.split('/').slice(0, 2).join('/') : '(root)';
        byDirectory.set(dir, (byDirectory.get(dir) || 0) + 1);
    }

    const topRules = [...byRule.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([ruleId, count]) => ({ ruleId, count, category: mapEslintRuleCategory(ruleId) }));

    const categorizedWarnings = [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([category, count]) => ({ category, count }));

    const topDirectories = [...byDirectory.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([pathPrefix, count]) => ({ pathPrefix, count }));

    return {
        source: totals.source || 'none',
        reportPath: totals.reportPath || null,
        filesWithIssues: totals.filesWithIssues || 0,
        totalIssues: (totals.errors || 0) + (totals.warnings || 0),
        errors: totals.errors || 0,
        warnings: totals.warnings || 0,
        warningTrend: [
            { bucket: 'errors', count: totals.errors || 0 },
            { bucket: 'warnings', count: totals.warnings || 0 }
        ],
        topRules,
        categorizedWarnings,
        topDirectories
    };
}

function normalizeEslintMessages(projectRoot, filePath, messages = []) {
    return messages.map((msg) => ({
        ruleId: msg.ruleId || 'unknown',
        severity: msg.severity === 2 ? 'high' : 'medium',
        filePath: normalizeRelativePath(projectRoot, filePath),
        line: msg.line || 1,
        description: msg.message || 'ESLint violation'
    }));
}

async function loadEslintReportFromDisk(scanRoot, platformRoot) {
    const roots = [scanRoot, platformRoot].filter(Boolean);
    for (const root of roots) {
        for (const relPath of ESLINT_REPORT_CANDIDATES) {
            const fullPath = path.join(root, relPath);
            if (!fs.existsSync(fullPath)) continue;
            try {
                const raw = await fs.promises.readFile(fullPath, 'utf8');
                const parsed = JSON.parse(raw);
                const reportItems = Array.isArray(parsed) ? parsed : parsed.results;
                if (!Array.isArray(reportItems)) continue;

                const messages = [];
                let errors = 0;
                let warnings = 0;
                let filesWithIssues = 0;
                for (const fileReport of reportItems) {
                    const errorCount = fileReport.errorCount || 0;
                    const warningCount = fileReport.warningCount || 0;
                    const fileMessages = normalizeEslintMessages(scanRoot, fileReport.filePath || '', fileReport.messages || []);
                    if (errorCount + warningCount > 0) filesWithIssues += 1;
                    errors += errorCount;
                    warnings += warningCount;
                    messages.push(...fileMessages);
                }
                return {
                    source: 'artifact',
                    reportPath: normalizeRelativePath(scanRoot, fullPath),
                    errors,
                    warnings,
                    filesWithIssues,
                    messages
                };
            } catch {
                // Try next candidate.
            }
        }
    }
    return null;
}

async function analyzeFileContent(file, rootDir, options = {}) {
    const findings = [];
    const rel = file.relativePath;
    let structure = null;

    if (shouldSkipLegacyExperimentalAnalysis(rel, options)) {
        return finalizeFileAnalysis(findings, rel, structure);
    }

    if (file.isArtifact || rel.includes('security-reports/fixes/')) {
        pushFinding(findings, {
            category: 'artifact',
            type: 'backup-or-fixture',
            severity: 'low',
            filePath: rel,
            line: 1,
            description: `Generated or backup artifact: ${rel}`,
            recommendedAction: 'Archive outside the active tree or add to .gitignore'
        });
        return finalizeFileAnalysis(findings, rel, structure);
    }

    if (file.size === 0) {
        pushFinding(findings, {
            category: 'empty',
            type: 'empty-file',
            severity: 'low',
            filePath: rel,
            line: 1,
            description: `Empty file: ${rel}`,
            recommendedAction: 'Delete or populate — empty files add noise to the tree'
        });
        return finalizeFileAnalysis(findings, rel, structure);
    }

    if (file.size > MAX_FILE_BYTES) {
        pushFinding(findings, {
            category: 'oversized',
            type: 'oversized-source',
            severity: 'medium',
            filePath: rel,
            line: 1,
            description: `Oversized file (${formatBytes(file.size)}): ${rel}`,
            recommendedAction: 'Split, compress, or move large generated assets out of source'
        });
        return finalizeFileAnalysis(findings, rel, structure);
    }

    let content = '';
    try {
        content = await fs.promises.readFile(file.path, 'utf8');
    } catch (error) {
        pushFinding(findings, {
            category: 'broken',
            type: 'unreadable',
            severity: 'high',
            filePath: rel,
            line: 1,
            description: `Unreadable file: ${error.message}`,
            recommendedAction: 'Fix permissions or encoding'
        });
        return finalizeFileAnalysis(findings, rel, structure);
    }

    if (!content.trim()) {
        pushFinding(findings, {
            category: 'empty',
            type: 'whitespace-only',
            severity: 'low',
            filePath: rel,
            line: 1,
            description: `Whitespace-only file: ${rel}`,
            recommendedAction: 'Delete if unintentional'
        });
        return finalizeFileAnalysis(findings, rel, structure);
    }

    if (file.ext === '.json') {
        try {
            JSON.parse(content);
        } catch (error) {
            pushFinding(findings, {
                category: 'broken',
                type: 'invalid-json',
                severity: 'high',
                filePath: rel,
                line: 1,
                description: `Invalid JSON: ${error.message}`,
                recommendedAction: 'Fix JSON syntax or remove broken fixture'
            });
        }
        if (!isNonProductionAuditContentPath(rel)) {
            findings.push(...detectPlaceholderAndFictionalData(content, rel));
        }
        return finalizeFileAnalysis(findings, rel, structure);
    }

    if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(file.ext)) {
        if (!shouldSkipSyntaxCheck(rel)) {
            const syntaxError = checkJsSyntax(content, rel);
            if (syntaxError) {
                pushFinding(findings, {
                    category: 'broken',
                    type: 'syntax-error',
                    severity: 'high',
                    filePath: rel,
                    line: 1,
                    description: formatSyntaxFindingDescription(syntaxError, rel),
                    match: String(syntaxError).slice(0, 80),
                    recommendedAction: syntaxRecommendedAction(syntaxError)
                });
            }
        }
        if (!isNonProductionAuditContentPath(rel) && !isTechnicalDebtReportArtifact(rel)) {
            findings.push(...scanContentPatterns(content, rel, TECH_DEBT_PATTERNS, 'tech-debt', 'medium'));
        }
        findings.push(...detectDebugArtifacts(content, rel));
        if (detectDynamicEval(content, rel)) {
            pushFinding(findings, {
                category: 'tech-debt',
                type: 'dynamic-eval',
                severity: 'high',
                filePath: rel,
                line: 1,
                description: `Dynamic eval/Function in production path: ${rel}`,
                recommendedAction: 'Replace eval/Function with safe alternatives'
            });
        }
    }

    if (['.js', '.mjs', '.cjs', '.html', '.md', '.py'].includes(file.ext)) {
        if (!isNonProductionAuditContentPath(rel)) {
            findings.push(...detectPlaceholderAndFictionalData(content, rel));
        }
    }

    if (languagePluginManager.shouldUsePlugin(file.ext)) {
        const plugin = languagePluginManager.resolvePlugin(file.name, file.ext, content);
        if (plugin) {
            const pluginResult = plugin.analyze(content, rel, {
                scanContentPatterns,
                TECH_DEBT_PATTERNS,
                detectPlaceholderAndFictionalData,
                isNonProductionAuditContentPath,
                isPlaceholderCatalogOrMetaDoc,
                isTechnicalDebtReportArtifact,
                isProductionRelevantPath,
                isCliToolingPath
            });
            findings.push(...pluginResult.findings);
            structure = pluginResult.structure || structure;
        }
    }

    return finalizeFileAnalysis(findings, rel, structure);
}

function detectDuplicateBasenames(files) {
    const skipNames = new Set([
        'index.js', 'index.ts', 'package.json', 'readme.md', 'license', 'config.json',
        'utils.js', 'constants.js', 'types.ts', 'main.js', 'app.js', 'server.js'
    ]);
    const byName = new Map();
    for (const file of files) {
        if (skipNames.has(file.name.toLowerCase())) continue;
        if (!byName.has(file.name)) byName.set(file.name, []);
        byName.get(file.name).push(file.relativePath);
    }
    const findings = [];
    const groups = [...byName.entries()]
        .filter(([name, paths]) => {
            if (KNOWN_SHARED_LIB_BASENAMES.has(name)) return false;
            if (DUPLICATE_SKIP_BASENAMES.has(name)) return false;
            const canonicalPaths = getDuplicateEligiblePaths(paths);
            return canonicalPaths.length >= 2;
        })
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 20);

    for (const [name, paths] of groups) {
        const canonicalPaths = getDuplicateEligiblePaths(paths);
        pushFinding(findings, {
            category: 'duplicate',
            type: 'duplicate-basename',
            severity: 'low',
            filePath: canonicalPaths[0],
            line: 1,
            description: `${canonicalPaths.length} files named "${name}" — possible copy drift`,
            recommendedAction: 'Consolidate duplicates or rename for clarity',
            metadata: { paths: canonicalPaths.slice(0, 8) }
        });
    }
    return findings;
}

const PRODUCTION_PATH_PREFIXES = ['server/', 'src/', 'packages/', 'app/', 'lib/', 'client/', 'api/'];
const DOCUMENTATION_PATH_PREFIXES = ['docs/', 'tests/', 'test/', 'templates/', '.cursor/', 'archive/'];

function normalizeAuditRelativePath(filePath) {
    const rel = String(filePath || '').replace(/\\/g, '/').toLowerCase();
    const marker = 'ai-platform/';
    const idx = rel.indexOf(marker);
    return idx >= 0 ? rel.slice(idx + marker.length) : rel;
}

function classifyFindingTier(filePath) {
    const rel = normalizeAuditRelativePath(filePath);
    if (/\.(md|markdown|rst)$/i.test(rel)) return 'documentation';
    if (DOCUMENTATION_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`))) {
        return 'documentation';
    }
    if (/\.(test|spec)\.[jt]s$/i.test(rel)) return 'documentation';
    if (/\.(?:ps1|sh|bat|cmd)$/i.test(rel)) return 'general';
    if (/(?:^|\/)scripts\//.test(rel) || /(?:^|\/)tools\//.test(rel)) return 'general';
    if (/(?:^|\/)reporters\//.test(rel)) return 'general';
    if (/^server\/test[-_.]/i.test(rel) || /\/test-gateway\./i.test(rel)) return 'general';
    if (/^src\/ai-system\//.test(rel)) return 'general';
    if (rel.startsWith('server/')) return 'production';
    if (rel.startsWith('web/') || rel.includes('/web/simplebeacon-dashboard/')) return 'production';
    if (rel.startsWith('packages/') || rel.includes('/packages/')) {
        if (/(?:^|\/)packages\/[^/]+\/(?:reporters|bin|scripts|tools)\//.test(rel)) return 'general';
        if (/(?:^|\/)packages\/[^/]+\/publish\.(?:ps1|sh)$/i.test(rel)) return 'general';
        if (/(?:^|\/)packages\/[^/]+\/src\/(?:reporters|bin|scripts|tools)\//.test(rel)) return 'general';
        if (/(?:^|\/)packages\/[^/]+\/src\//.test(rel)) return 'production';
        return 'general';
    }
    if (rel.startsWith('src/api/') || rel.startsWith('src/server/') || rel.startsWith('src/web/')) {
        return 'production';
    }
    if (PRODUCTION_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`))) {
        return 'production';
    }
    return 'general';
}

function countFindingTiers(findings = []) {
    return findings.reduce((acc, finding) => {
        const tier = classifyFindingTier(finding.filePath);
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
    }, { production: 0, documentation: 0, general: 0 });
}

function sortFindingsForReport(findings = []) {
    const severityRank = { high: 0, medium: 1, low: 2 };
    const tierRank = { production: 0, documentation: 1, general: 2 };
    return [...findings].sort((a, b) => {
        const tierDelta = (tierRank[classifyFindingTier(a.filePath)] ?? 9)
            - (tierRank[classifyFindingTier(b.filePath)] ?? 9);
        if (tierDelta !== 0) return tierDelta;
        const sevDelta = (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9);
        if (sevDelta !== 0) return sevDelta;
        return String(a.filePath || '').localeCompare(String(b.filePath || ''));
    });
}

function aggregateCategories(findings = []) {
    const buckets = new Map();
    for (const finding of findings) {
        const key = finding.category || 'other';
        const bucket = buckets.get(key) || {
            category: key,
            count: 0,
            severity: finding.severity || 'low',
            files: new Set()
        };
        bucket.count += 1;
        bucket.files.add(finding.filePath);
        if (finding.severity === 'high') bucket.severity = 'high';
        else if (finding.severity === 'medium' && bucket.severity !== 'high') bucket.severity = 'medium';
        buckets.set(key, bucket);
    }

    const labels = {
        'tech-debt': 'Technical debt markers (TODO/FIXME/HACK)',
        broken: 'Broken or invalid files',
        'debug-artifact': 'Debug logging / debugger statements',
        'meaningless-data': 'Placeholder or fictional KPI text',
        artifact: 'Backup/generated artifacts in tree',
        empty: 'Empty or whitespace-only files',
        oversized: 'Oversized source files',
        duplicate: 'Duplicate basenames',
        eslint: 'ESLint findings'
    };

    return [...buckets.entries()]
        .map(([category, bucket]) => ({
            category,
            label: labels[category] || category,
            count: bucket.count,
            severity: bucket.severity,
            fileCount: bucket.files.size,
            topFiles: [...bucket.files].slice(0, 5)
        }))
        .sort((a, b) => b.count - a.count);
}

function computeHealthScore(findings, codeFilesAnalyzed) {
    if (!codeFilesAnalyzed) return 100;
    const uniqueFindings = dedupeFindings(findings);
    const byTier = { production: [], documentation: [], general: [] };
    for (const finding of uniqueFindings) {
        byTier[classifyFindingTier(finding.filePath)].push(finding);
    }

    function tierDeduction(tierFindings, weight, maxDeduction) {
        if (!tierFindings.length) return 0;
        const weights = { high: 8, medium: 3, low: 1 };
        const severityInCap = tierFindings.reduce((acc, f) => {
            acc[f.severity] = (acc[f.severity] || 0) + 1;
            return acc;
        }, { high: 0, medium: 0, low: 0 });
        const penaltyHigh = Math.min(severityInCap.high, 5) * weights.high;
        const penaltyMedium = Math.min(severityInCap.medium, 90) * weights.medium;
        const penaltyLow = Math.min(severityInCap.low, 150) * weights.low;
        const penalty = (penaltyHigh + penaltyMedium + penaltyLow) * weight;
        const normalized = Math.min(100, Math.round((penalty / Math.max(codeFilesAnalyzed, 1)) * 120));
        return Math.min(maxDeduction, normalized);
    }

    const deduction = tierDeduction(byTier.production, 1, 70)
        + tierDeduction(byTier.documentation, 0.35, 20)
        + tierDeduction(byTier.general, 0.15, 10);
    return Math.max(0, 100 - deduction);
}

async function runEslint(projectRoot, platformRoot) {
    const artifact = await loadEslintReportFromDisk(projectRoot, platformRoot);
    if (artifact) {
        const findings = artifact.messages.map((msg) => ({
            category: 'eslint',
            analyzer: 'eslint-integration-analyzer',
            type: 'eslint',
            severity: msg.severity,
            filePath: msg.filePath,
            line: msg.line,
            description: msg.description,
            recommendedAction: 'Fix ESLint rule violation',
            metadata: {
                ruleId: msg.ruleId,
                ruleCategory: mapEslintRuleCategory(msg.ruleId)
            }
        }));
        return {
            source: 'artifact',
            reportPath: artifact.reportPath,
            errors: artifact.errors,
            warnings: artifact.warnings,
            filesWithIssues: artifact.filesWithIssues,
            findings,
            summary: buildEslintSummary(artifact.messages, artifact)
        };
    }

    const eslintBin = path.join(platformRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
    if (!fs.existsSync(eslintBin)) {
        return {
            source: 'none',
            errors: 0,
            warnings: 0,
            filesWithIssues: 0,
            findings: [],
            summary: buildEslintSummary([], { source: 'none', errors: 0, warnings: 0, filesWithIssues: 0 })
        };
    }
    const flatConfig = path.join(platformRoot, 'eslint.config.js');
    if (!fs.existsSync(flatConfig)) {
        return {
            source: 'none',
            errors: 0,
            warnings: 0,
            filesWithIssues: 0,
            findings: [],
            skipped: 'Missing eslint.config.js at platform root',
            summary: buildEslintSummary([], { source: 'none', errors: 0, warnings: 0, filesWithIssues: 0 })
        };
    }

    const targets = resolveEslintTargets(platformRoot);

    if (!targets.length) {
        return {
            source: 'none',
            errors: 0,
            warnings: 0,
            filesWithIssues: 0,
            findings: [],
            summary: buildEslintSummary([], { source: 'none', errors: 0, warnings: 0, filesWithIssues: 0 })
        };
    }

    try {
        const { stdout } = await execFileAsync(
            process.execPath,
            [eslintBin, '--config', flatConfig, ...targets, '--format', 'json', '--max-warnings', '99999'],
            { cwd: platformRoot, timeout: 90000, maxBuffer: 8 * 1024 * 1024 }
        );
        const reports = JSON.parse(stdout || '[]');
        const findings = [];
        const normalizedMessages = [];
        let errors = 0;
        let warnings = 0;
        let filesWithIssues = 0;
        for (const fileReport of reports) {
            errors += fileReport.errorCount || 0;
            warnings += fileReport.warningCount || 0;
            if ((fileReport.errorCount || 0) + (fileReport.warningCount || 0) > 0) {
                filesWithIssues += 1;
            }
            const normalized = normalizeEslintMessages(projectRoot, fileReport.filePath, fileReport.messages || []);
            normalizedMessages.push(...normalized);
            for (const msg of normalized.slice(0, 20)) {
                pushFinding(findings, {
                    category: 'eslint',
                    analyzer: 'eslint-integration-analyzer',
                    type: 'eslint',
                    severity: msg.severity,
                    filePath: msg.filePath,
                    line: msg.line,
                    description: msg.description,
                    recommendedAction: 'Fix ESLint rule violation',
                    metadata: {
                        ruleId: msg.ruleId,
                        ruleCategory: mapEslintRuleCategory(msg.ruleId)
                    }
                });
            }
        }
        return {
            source: 'command',
            errors,
            warnings,
            filesWithIssues,
            findings,
            summary: buildEslintSummary(normalizedMessages, {
                source: 'command',
                errors,
                warnings,
                filesWithIssues
            })
        };
    } catch (error) {
        if (error.stdout) {
            try {
                const reports = JSON.parse(error.stdout);
                const errors = reports.reduce((s, r) => s + (r.errorCount || 0), 0);
                const warnings = reports.reduce((s, r) => s + (r.warningCount || 0), 0);
                return {
                    source: 'command',
                    errors,
                    warnings,
                    filesWithIssues: reports.filter((r) => (r.errorCount || 0) + (r.warningCount || 0) > 0).length,
                    findings: [],
                    summary: buildEslintSummary([], {
                        source: 'command',
                        errors,
                        warnings,
                        filesWithIssues: reports.filter((r) => (r.errorCount || 0) + (r.warningCount || 0) > 0).length
                    })
                };
            } catch {
                /* fall through */
            }
        }
        return {
            source: 'none',
            errors: 0,
            warnings: 0,
            filesWithIssues: 0,
            findings: [],
            skipped: error.message,
            summary: buildEslintSummary([], { source: 'none', errors: 0, warnings: 0, filesWithIssues: 0 })
        };
    }
}

async function analyzeCodebase(baseDir, options = {}) {
    const resolvedBase = path.resolve(baseDir);
    const context = resolveScanContext(options);
    const { platformRoot } = resolvePlatformRoot(resolvedBase);
    const scanRoot = resolvedBase;
    const codeWalkRoot = platformRoot !== resolvedBase ? platformRoot : resolvedBase;
    const includeEslint = options.includeEslint === true || context === 'complete';
    const scanProfile = resolveScanProfile(options, context === 'complete' ? 'cli' : context);
    const walkOptions = { ...options, scanProfile };
    const deepAnalyzeCap = resolveDeepAnalyzeCap(options, context);
    const findingsCap = resolveFindingsCap(options, context);
    const previousFindingsCap = activeFindingsCap;
    activeFindingsCap = findingsCap;

    const [repositoryInventory, files] = await Promise.all([
        countRepositoryInventory(scanRoot, { profile: options.inventoryProfile || 'audit' }),
        walkCodeFiles(codeWalkRoot, walkOptions)
    ]);

    try {
    const filesToAnalyze = files
        .filter((f) => !f.isArtifact || f.relativePath.includes('security-reports/fixes/'))
        .slice(0, deepAnalyzeCap);

    const { findings, structureSamples } = await analyzeFilesInBatches(filesToAnalyze, codeWalkRoot, {
        concurrency: context === 'complete'
            ? Number(process.env.CODEBASE_COMPLETE_CONCURRENCY) || Math.max(ANALYZE_FILE_CONCURRENCY, 48)
            : options.concurrency,
        includeLegacyExperimental: options.includeLegacyExperimental
    });

    findings.push(...detectDuplicateBasenames(files));

    let eslintErrors = 0;
    let eslintWarnings = 0;
    let eslintSummary = buildEslintSummary([], { source: 'none', errors: 0, warnings: 0, filesWithIssues: 0 });
    let eslintSource = 'none';
    let eslintReportPath = null;
    let eslintSkipped = null;
    if (includeEslint) {
        const eslint = await runEslint(scanRoot, platformRoot || scanRoot);
        eslintErrors = eslint.errors;
        eslintWarnings = eslint.warnings;
        eslintSource = eslint.source || 'none';
        eslintReportPath = eslint.reportPath || null;
        eslintSummary = eslint.summary || eslintSummary;
        eslintSkipped = eslint.skipped || null;
        for (const finding of eslint.findings) {
            pushFinding(findings, finding);
        }
    } else {
        const artifactOnly = await loadEslintReportFromDisk(scanRoot, platformRoot || scanRoot);
        if (artifactOnly) {
            eslintSource = 'artifact';
            eslintReportPath = artifactOnly.reportPath || null;
            eslintErrors = artifactOnly.errors || 0;
            eslintWarnings = artifactOnly.warnings || 0;
            eslintSummary = buildEslintSummary(artifactOnly.messages || [], artifactOnly);
            for (const msg of artifactOnly.messages.slice(0, 120)) {
                pushFinding(findings, {
                    category: 'eslint',
                    analyzer: 'eslint-integration-analyzer',
                    type: 'eslint',
                    severity: msg.severity,
                    filePath: msg.filePath,
                    line: msg.line,
                    description: msg.description,
                    recommendedAction: 'Fix ESLint rule violation',
                    metadata: {
                        ruleId: msg.ruleId,
                        ruleCategory: mapEslintRuleCategory(msg.ruleId)
                    }
                });
            }
        } else {
            eslintSkipped = 'ESLint command disabled by default in request path; set includeEslint=true to run CLI scan.';
        }
    }

    const severityCounts = findings.reduce((acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
    }, { high: 0, medium: 0, low: 0 });
    const tierCounts = countFindingTiers(findings);

    const categories = aggregateCategories(findings);
    const codeFilesAnalyzed = filesToAnalyze.length;
    const healthScore = computeHealthScore(findings, codeFilesAnalyzed);
    const findingsTruncated = findings.length > findingsCap;
    const sortedFindings = sortFindingsForReport(findings);
    const findingsReturned = sortedFindings.slice(0, findingsCap);

    return {
        type: 'codebase-analyzer-report',
        reportVersion: 1,
        title: 'Codebase Analysis Report',
        dataSource: 'repository-audit',
        generatedAt: new Date().toISOString(),
        generatedBy: 'codebase-analyzer',
        projectRoot: scanRoot,
        platformRoot: platformRoot !== scanRoot ? platformRoot : undefined,
        codeAnalysisRoot: codeWalkRoot !== scanRoot ? codeWalkRoot : undefined,
        repositoryInventory,
        summary: {
            repositoryFilesTotal: repositoryInventory?.totalFiles ?? null,
            repositoryFoldersTotal: repositoryInventory?.totalFolders ?? null,
            codeFilesAnalyzed,
            codeFilesDiscovered: files.length,
            findingsTotal: findings.length,
            findingsReturned: findingsReturned.length,
            findingsTruncated,
            scanContext: context,
            healthScore,
            severityCounts,
            tierCounts,
            eslintErrors,
            eslintWarnings,
            eslintSource,
            eslintReportPath,
            eslintSkipped,
            categoryCounts: Object.fromEntries(categories.map((c) => [c.category, c.count])),
            analyzerCounts: {
                debugArtifacts: findings.filter((f) => f.category === 'debug-artifact').length,
                placeholderOrFictionalData: findings.filter((f) => f.category === 'meaningless-data').length,
                eslintFindings: findings.filter((f) => f.category === 'eslint').length
            }
        },
        rubric: FINDING_RUBRIC,
        eslintSummary,
        categories,
        findings: findingsReturned,
        structureInsights: {
            summary: aggregateStructureInsights(structureSamples),
            samples: structureSamples
        },
        scanScope: {
            mode: context === 'complete' ? 'codebase-audit-complete' : 'codebase-audit',
            scanProfile,
            scanContext: context,
            universalLanguageCount: languagePluginManager.listLanguages().length,
            dedicatedLanguagePlugins: ['zscript', 'acs', 'decorate', 'glsl', 'lua', 'python', 'rust', 'go', 'sql'],
            description: context === 'complete'
                ? 'Complete scan profile — deep content analysis on every discovered code-like file (skips node_modules, .git, coverage). Not a semantic or security certification.'
                : 'Walks source-like files under the project root (audit profile — skips node_modules, .git, coverage). Uses universal language registry + plugins for domain scripts (ZScript, ACS, GLSL, etc.).',
            limitations: [
                codeWalkRoot !== scanRoot
                    ? `Code walk scoped to platform root (${path.relative(scanRoot, codeWalkRoot).replace(/\\/g, '/') || 'platform'}) — repository inventory still reflects the requested path.`
                    : null,
                context === 'complete'
                    ? (codeFilesAnalyzed >= files.length
                        ? `Complete scan: deep content analysis on all ${files.length.toLocaleString()} discovered code-like files.`
                        : `Complete scan: analyzed ${codeFilesAnalyzed.toLocaleString()} of ${files.length.toLocaleString()} code-like files.`)
                    : `Deep content analysis capped at ${deepAnalyzeCap.toLocaleString()} files${context === 'dashboard' ? ' (dashboard quick profile — use Complete scan for full codebase pass)' : ''}; ${files.length.toLocaleString()} code-like files discovered.`,
                findingsTruncated
                    ? `Findings capped at ${findingsCap.toLocaleString()} in report output (${findings.length.toLocaleString()} total detected).`
                    : null,
                `Extension profile: ${scanProfile} (dashboard default: universal; complete/CLI: default; override with SCAN_PROFILE or scanProfile).`,
                `${languagePluginManager.listLanguages().length} language plugins (${Object.keys(UNIVERSAL_LANGUAGE_REGISTRY).length} registry languages; Tier-2: Python, Rust, Go, SQL).`,
                'Context-aware filtering reduces false positives in tests, docs, and example paths.',
                'Structure hints are regex-based Tier-1 estimates — not AST parsing.',
                includeEslint
                    ? `ESLint ran on ${ESLINT_TARGET_DIRS.join(', ')} under the platform root when available.`
                    : 'ESLint not run in this request — set includeEslint=true or use Complete scan.',
                'Does not prove dead-code elimination — flags debt markers and broken files only.'
            ].filter(Boolean)
        }
    };
    } finally {
        activeFindingsCap = previousFindingsCap;
    }
}

module.exports = {
    analyzeCodebase,
    walkCodeFiles,
    resolveDeepAnalyzeCap,
    resolveFindingsCap,
    resolveScanContext,
    resolveEslintTargets,
    scanContentPatterns,
    dedupeFindings,
    analyzeFilesInBatches,
    REPO_SKIP_DIRS,
    ESLINT_TARGET_DIRS,
    CODE_EXTENSIONS,
    getCodeExtensions
};
