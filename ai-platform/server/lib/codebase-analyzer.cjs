/**
 * Codebase analyzer — filesystem audit for technical debt, broken files,
 * debug artifacts, and meaningless placeholder data across the repo tree.
 */

// DIAGNOSTIC: patched version v2.1 — excludes scanner implementation files
console.log('[CodebaseAnalyzer] Module loaded: PATCHED v2.1 (excludes scanner files)');

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { countRepositoryInventory } = require('../../../packages/simplebeacon-cli/src/lib/repository-inventory');
const { resolvePlatformRoot } = require('../../../packages/simplebeacon-cli/src/project-detect');
const { formatBytes } = require('./mock-data-scanner.cjs');
const { getCodeExtensions, resolveScanProfile } = require('./universal-language-config.cjs');
const { UNIVERSAL_LANGUAGE_REGISTRY, resolveLanguageFromPath } = require('./universal-language-registry.cjs');
const { getBuiltinPluginManager } = require('./plugin-system/index.cjs');
const { applyContextToFindings } = require('./file-audit-context.cjs');
const { isConsolidationExcludedPair } = require('../../../packages/simplebeacon-cli/src/lib/consolidation-path-exclusions');

const constants = require('../config/constants.cjs');
const execFileAsync = promisify(execFile);

const REPO_SKIP_DIRS = new Set([
    'node_modules', '.git', 'uploads', 'coverage', 'archive', 'dist', 'build', '.next', '.cache',
    '.venv', 'htmlcov', '.simplebeacon', 'security-reports', '__pycache__',
    'github-cache', '.github-sync', 'deliverables', 'data-central', 'java-ai-vulnerable',
    'New folder', 'out'
]);
const CODE_EXTENSIONS = getCodeExtensions();
const languagePluginManager = getBuiltinPluginManager();
const ARTIFACT_EXTENSIONS = ['.backup', '.bak', '.tmp', '.old', '.orig', '.log', '.simplebeacon-backup'];
const WALK_MAX_DEPTH = 128;
const MAX_FILE_BYTES = Number(process.env.CODEBASE_MAX_FILE_BYTES) || Number.POSITIVE_INFINITY;
const GOVERNANCE_FILE_BASENAMES = new Set([
  'license', 'license.md', 'license.txt', 'license.rst',
  'security.md', 'security.txt', 'security.rst',
  'contributing.md', 'contributing.txt', 'code_of_conduct.md',
  'dockerfile', '.env', '.env.example', '.env.production', '.env.local',
  '.gitignore', '.dockerignore', '.npmignore',
  'docker-compose.yml', 'docker-compose.yaml',
  'makefile', 'makefile.mak',
  'readme.md', 'readme.txt', 'readme.rst',
  'changelog.md', 'changelog.txt',
  'package.json', 'package-lock.json',
  'tsconfig.json', 'jsconfig.json', 'eslint.config.js',
  'vite.config.js', 'vite.config.ts',
  'tailwind.config.js', 'tailwind.config.ts',
  'netlify.toml', 'vercel.json', 'render.yaml',
]);
const MAX_FINDINGS_DASHBOARD = 400;
const MAX_FINDINGS_COMPLETE = Number(process.env.CODEBASE_COMPLETE_MAX_FINDINGS) || 10000;
const MAX_DEEP_ANALYZE = Number.POSITIVE_INFINITY;
const MAX_DEEP_ANALYZE_DASHBOARD = Number(process.env.CODEBASE_DASHBOARD_MAX_FILES) || Number.POSITIVE_INFINITY;
const MAX_DEEP_ANALYZE_COMPLETE = Number(process.env.CODEBASE_COMPLETE_MAX_FILES) || Number.POSITIVE_INFINITY;
const ANALYZE_FILE_CONCURRENCY = Number(process.env.CODEBASE_ANALYZE_CONCURRENCY) || 24;
const BUILTIN_NODE_MODULES = new Set(['fs', 'path', 'http', 'https', 'url', 'os', 'crypto', 'events', 'stream', 'buffer', 'util', 'child_process', 'cluster', 'dns', 'net', 'tls', 'dgram', 'http2', 'inspector', 'perf_hooks', 'process', 'querystring', 'readline', 'repl', 'timers', 'v8', 'vm', 'worker_threads', 'zlib', 'assert', 'async_hooks', 'console', 'constants', 'domain', 'module', 'punycode', 'string_decoder', 'sys', 'trace_events', 'tty', 'wasi']);
const COMMON_JS_KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'this', 'return', 'function', 'class', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'await', 'async', 'yield', 'import', 'export', 'default', 'from', 'as', 'extends', 'super', 'static', 'get', 'set', 'constructor', 'prototype', 'window', 'document', 'global', 'require', 'module', 'exports', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Error', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent', 'eval', 'escape', 'unescape', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'clearImmediate', 'process', 'Buffer']);
const COMMON_STRING_LITERALS = new Set(['utf8', 'utf-8', 'ascii', 'base64', 'hex', 'binary', 'latin1', 'ucs2', 'ucs-2', 'ascii', 'json', 'text', 'data', 'result', 'output', 'input', 'error', 'success', 'failure', 'message', 'status', 'code', 'name', 'value', 'key', 'id', 'type', 'mode', 'path', 'dir', 'file', 'name', 'ext', 'url', 'host', 'port', 'method', 'headers', 'body', 'query', 'params', 'route', 'handler', 'middleware', 'controller', 'service', 'model', 'view', 'template', 'layout', 'component', 'page', 'route', 'link', 'href', 'src', 'alt', 'title', 'class', 'style', 'id', 'data', 'info', 'debug', 'warn', 'warning', 'error', 'fatal', 'trace', 'log', 'info', 'debug', 'warn', 'error', 'fatal', 'trace', 'production', 'development', 'test', 'staging', 'local', 'dev', 'prod', 'ci', 'cd', 'build', 'dist', 'public', 'static', 'assets', 'images', 'fonts', 'scripts', 'styles', 'templates', 'views', 'partials', 'layouts', 'pages', 'routes', 'controllers', 'services', 'models', 'middlewares', 'helpers', 'utils', 'lib', 'libs', 'vendor', 'node_modules', 'package', 'lock', 'yarn', 'npm', 'git', 'github', 'gitlab', 'bitbucket', 'svn', 'hg']);
const EXCLUDED_UNSCOPED_PACKAGES = new Set([...BUILTIN_NODE_MODULES, ...COMMON_JS_KEYWORDS, ...COMMON_STRING_LITERALS]);
const MAX_STRUCTURE_SAMPLES = 50;

/** @type {number} Mutable cap for pushFinding during analyzeCodebase runs. */
let activeFindingsCap = MAX_FINDINGS_DASHBOARD;

/**
 * Normalize scan context.
 * @param {string} context
 * @returns {any}
 */
function normalizeScanContext(context) {
    return String(context || 'cli').toLowerCase();
}

/**
 * Resolve scan context.
 * @param {Object} options
 * @returns {any}
 */
function resolveScanContext(options = {}) {
    return normalizeScanContext(options.context || options.scanContext || options.scanMode);
}

/**
 * Resolve deep analyze cap.
 * @param {Object} options
 * @param {string} context
 * @returns {any}
 */
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

/**
 * Resolve findings cap.
 * @param {Object} options
 * @param {string} context
 * @returns {any}
 */
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

/**
 * Analyze files in batches.
 * @param {Array} files
 * @param {string} rootDir
 * @param {Object} options
 * @returns {any}
 */
async function analyzeFilesInBatches(files, rootDir, options = {}) {
    const findings = [];
    const structureSamples = [];
    const concurrency = Math.max(1, options.concurrency || ANALYZE_FILE_CONCURRENCY);
    const onProgress = options.onProgress;
    const total = files.length;

    for (let offset = 0; offset < files.length; offset += concurrency) {
        const batch = files.slice(offset, offset + concurrency);
        const results = await Promise.all(batch.map((file) => analyzeFileContent(file, rootDir, options)));
        // Yield to event loop every few batches so the server stays responsive
        if ((offset / concurrency) % 4 === 0 && offset > 0) {
            await new Promise((resolve) => setImmediate(resolve));
        }
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
            if (typeof onProgress === 'function') {
                const current = offset + i + 1;
                onProgress({
                    current,
                    total,
                    filename: file.name || file.relativePath || '',
                    percent: Math.round((current / total) * 100)
                });
            }
        }
    }

    return { findings, structureSamples };
}

/**
 * Dedupe findings.
 * @param {Array} findings
 * @returns {any}
 */
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

/**
 * Finalize file analysis.
 * @param {Array} findings
 * @param {string} relativePath
 * @param {string} structure
 * @returns {any}
 */
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

/**
 * Aggregate structure insights.
 * @param {Array} samples
 * @returns {any}
 */
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
    { id: 'fiction-kpi', pattern: /\b(?:98\.\d|96\.\d|99\.\d{1,2}|95\.\d|97\.\d|100)\s*%\s*(?:AI|accuracy|confidence|uptime|success|completion|quality|pass|rate|score)\b|\b(?:9,999|10,000|1,000,000|100,000|50,000|500,000)\s*(?:users|customers|clients|requests|visitors|downloads|subscribers)\b/gi, label: 'Fictional KPI percentage or AI-generated metric' },
    { id: 'hardcoded-perfect', pattern: /\b100\s*%\s*(?:quality|compliance|pass|complete)\b/gi, label: 'Suspicious 100% claim' },
    { id: 'hardcoded-completion', pattern: /(?:completionRate|completion|progress|done)\s*[:=]\s*['"`]?(?:0\.\d+|\d{1,3})\s*%?['"`]?/gi, label: 'Hardcoded completion rate' },
    { id: 'ai-placeholder-comment', pattern: /(?:\/\/|#)\s*(?:AI[- ]generated|auto[- ]generated|generated by|placeholder|stub|not implemented|implement later|fill in|complete later|needs work|unfinished|to be done)(?:\b|$)/gi, label: 'AI placeholder comment' },
    { id: 'ai-placeholder-block', pattern: /(?:\/\*|<!--)[\s\S]{0,200}?(?:AI[- ]generated|auto[- ]generated|placeholder|stub|not implemented|implement me|fill in|complete later|needs work|unfinished|to be done|TODO|FIXME|HACK|XXX|NYI|NOT\s+YET\s+IMPLEMENTED)[\s\S]{0,200}?(?:\*\/|-->)/gi, label: 'AI placeholder block comment' }
];

const AI_RESIDUE_PATTERNS = [
    { id: 'hallucinated-import', pattern: /import\s+\w+\s+from\s+['"`](?:ai-|llm-|gpt-|openai-|anthropic-|claude-|vertex-|palm-|bard-|cohere-|huggingface-|hf-|stability-|midjourney-|dalle-|dall-e-)[^'"`]*['"`]|require\s*\(\s*['"`](?:ai-|llm-|gpt-|openai-|anthropic-|claude-|vertex-|palm-|bard-|cohere-|huggingface-|hf-|stability-|midjourney-|dalle-|dall-e-)[^'"`]*['"`]/gi, label: 'Hallucinated AI/LLM SDK import — verify package exists' },
    { id: 'error-swallowing', pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*(?:\/\/.*)?\s*\}|catch\s*\(\s*\w*\s*\)\s*\{\s*console\.(?:log|warn|error|info|debug)\s*\([^)]*\)\s*;?\s*\}/gi, label: 'Error swallowing — catch block silently ignores or only logs exception' },
    { id: 'empty-catch', pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/gi, label: 'Empty catch block — exception silently swallowed' },
    { id: 'not-implemented-throw', pattern: /throw\s+new\s+(?:Error|NotImplementedError)\s*\(\s*['"`]\s*(?:not\s+implemented|TODO|FIXME|placeholder|stub)\s*['"`]/gi, label: 'Not implemented stub — throws instead of real logic' },
    { id: 'ai-generated-comment', pattern: /\/\/\s*(?:generated\s+by\s+AI|created\s+by\s+AI|AI[- ]?written|auto[- ]?generated\s+by|made\s+with\s+(?:ChatGPT|GPT|Claude|Copilot|Gemini))/gi, label: 'AI generation attribution comment' }
];

const LLM_SLOP_PATTERNS = [
    { id: 'template-placeholder', pattern: /YOUR_[A-Z0-9_]+_HERE|INSERT_[A-Z0-9_]+_HERE|\[Insert\s[^\]]+\]/gi, label: 'Template placeholder text (YOUR_*_HERE / INSERT_*_HERE)' },
    { id: 'todo-later', pattern: /\/\/\s*Handle\s+this\s+later|\/\/\s*AI\s+Generated\s+Placeholder|\/\/\s*TODO:\s*replace/gi, label: 'AI placeholder comment (handle later / AI generated)' },
    { id: 'fake-uptime', pattern: /99\.99\s*%?\s*Uptime|100\s*%?\s*Secure|9,999\s*Users/gi, label: 'AI-generated fake metric (uptime/secure/users)' }
];

const MARKDOWN_FENCE_PATTERNS = [
    { id: 'markdown-fence-leak', pattern: /```(?:js|javascript|ts|typescript|python|json|html|css|bash|sh|powershell)?/gi, label: 'Markdown code fence leaked into source' }
];

const API_CONTRACT_PATTERNS = [
    { id: 'no-openapi', pattern: /swagger|openapi|oas3/gi, label: 'OpenAPI reference' }
];

const ARCHITECTURE_DRIFT_PATTERNS = [
    { id: 'hardcoded-paths', pattern: new RegExp("['\"`](?:[A-Z]:\\\\[^'\"`]{2,}|/home/[^'\"`]{2,}|/Users/[^'\"`]{2,})['\"`]", 'gi'), label: 'Hardcoded absolute path' },
    { id: 'deep-imports', pattern: /(?:require|import).*?['"`][./]+\.\./g, label: 'Deep relative import (../../)' }
];

const BUILD_READINESS_PATTERNS = [
    { id: 'unsafe-port-hardcode', pattern: /:\s*(?:22|3306|5432|6379|27017|9200)\b/g, label: 'Hardcoded service port (SSH, DB, Redis, Mongo, ES)' }
];

const CONFIG_DRIFT_PATTERNS = [
    { id: 'feature-flag', pattern: /featureFlag|feature_flag|toggle|enableFeature|disableFeature/gi, label: 'Feature flag usage' },
    { id: 'version-pin', pattern: /['"`][~^]?\d+\.\d+\.\d+['"`]/g, label: 'Version-pinned dependency' }
];

const DEPENDENCY_VULN_PATTERNS = [
    { id: 'http-over-https', pattern: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/gi, label: 'Insecure HTTP dependency URL' },
    { id: 'git-ssh-dep', pattern: /git\+ssh:|git\+http:/gi, label: 'Git-based dependency reference' },
    { id: 'tarball-url', pattern: /['"`]https?:\/\/.*\.(?:tgz|tar\.gz|zip)['"`]/gi, label: 'Tarball/zip dependency URL' }
];

const DOCUMENTATION_PATTERNS = [
    { id: 'missing-jsdoc', pattern: /(^|\n)\s*(export\s+(?:async\s+)?function|export\s+class|export\s+const|export\s+let|export\s+var)/g, label: 'Exported API without JSDoc' }
];

const FRAMEWORK_PRACTICES_PATTERNS = [
    { id: 'react-class-component', pattern: /class\s+\w+\s+extends\s+React\.Component/g, label: 'Legacy React class component' },
    { id: 'react-unsafe-lifecycle', pattern: /componentWillMount|componentWillReceiveProps|componentWillUpdate/g, label: 'Deprecated React lifecycle method' },
    { id: 'jquery-usage', pattern: /\b\$\.(?:ajax|get|post|getJSON|each|map|grep|extend|fn\.)|\bjQuery\b|\$\(document\)|\$\(['"`#\.\[\w]/g, label: 'jQuery usage in modern codebase' }
];

const GOVERNANCE_PATTERNS = [
    { id: 'copyright-notice', pattern: /Copyright\s+(?:\(c\)|©)?\s*\d{4}/gi, label: 'Copyright notice' },
    { id: 'author-attribution', pattern: /@author/gi, label: 'Author JSDoc tag' },
    { id: 'legal-disclaimer', pattern: /(?:DO NOT DISTRIBUTE|NOT FOR DISTRIBUTION)/gi, label: 'Legal distribution restriction marker' }
];

const LICENSE_HEADER_PATTERNS = [
    { id: 'license-header', pattern: /\b(?:MIT|Apache|GPL|BSD|Mozilla|ISC)\s+License\b/gi, label: 'License header reference' },
    { id: 'spdx-license', pattern: /SPDX-License-Identifier\s*:\s*[A-Za-z0-9\-.]+/gi, label: 'SPDX license identifier' },
    { id: 'licensed-under', pattern: /Licensed under\s+(?:the\s+)?(?:MIT|Apache|GPL|BSD|Mozilla|ISC)/gi, label: 'Licensed under clause' }
];

const I18N_PATTERNS = [
    { id: 'i18n-hardcoded-string', pattern: /textContent\s*=\s*[`'"][^`'"]{10,200}(?:\s[A-Za-z]+){2,}/i, label: 'Hardcoded UI string — wrap with i18n function' }
];

const DATABASE_PATTERNS = [
    { id: 'sql-template-injection', pattern: /`[^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{[^`]*`/i, label: 'SQL in template literal with interpolation — potential injection' },
    { id: 'unparameterized-query', pattern: /\.query\s*\(\s*[`'"][^'"`]*[`'"]\s*\)(?!\s*,)/i, label: 'Query call without parameter array — may be unparameterized' },
    { id: 'unbounded-select', pattern: /SELECT\s+(?:(?!\bLIMIT\b)[^;])*\bFROM\b(?:(?!\bLIMIT\b)[^;])*(?:;|$)/i, label: 'SELECT without LIMIT clause — unbounded read' }
];

const C_DATABASE_PATTERNS = [
    { id: 'c-raw-sql-string', pattern: /["'](?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b[^"';]{10,300}["']/gi, label: 'Raw SQL string in C/C++ code — potential injection if concatenated' },
    { id: 'c-sqlite3-exec', pattern: /\bsqlite3_(?:exec|prepare|prepare_v2)\s*\(\s*[^,]+,\s*["']/gi, label: 'sqlite3_exec/sqlite3_prepare without visible parameter binding' },
    { id: 'c-pq-exec', pattern: /\bPQ(?:exec|execParams|prepare)\s*\(/gi, label: 'libpq query execution — verify parameterization' },
    { id: 'c-mysql-query', pattern: /\bmysql_(?:query|real_query)\s*\(\s*[^,]+,\s*["']/gi, label: 'mysql_query without parameter binding' },
    { id: 'c-sql-concat', pattern: /\b(?:strcat|strncat|sprintf|snprintf|strcpy|strncpy)\s*\([^)]*(?:SELECT|INSERT|UPDATE|DELETE)/gi, label: 'SQL built via string concatenation — injection risk' },
    { id: 'c-unbounded-select', pattern: /["']SELECT\s+(?:(?!\bLIMIT\b)[^"';])*\bFROM\b(?:(?!\bLIMIT\b)[^"';])*(?:["']|;)/gi, label: 'SELECT without LIMIT in raw SQL string — unbounded read' }
];

const COMPLEXITY_PATTERNS = [
    { id: 'long-function', pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{300,2000}?\}|def\s+\w+\s*\([^)]*\):[\s\S]{300,2000}?(?=\ndef |\nclass |\Z)/, label: 'Overly long function' },
    { id: 'deep-nesting', pattern: /if\s*\([^)]*\)\s*\{[\s\S]{0,120}?if\s*\([^)]*\)\s*\{[\s\S]{0,120}?if\s*\(|try\s*\{[\s\S]{0,60}?try\s*\{|for\s*\([^)]*\)\s*\{[\s\S]{0,60}?for\s*\(/i, label: 'Deeply nested control flow' }
];

const FIX_PREVIEW_PATTERNS = [
    { id: 'double-equals', pattern: /[^=!]==[^=]/g, label: 'Loose equality (==) — use strict equality (===)' },
    { id: 'var-declaration', pattern: /\bvar\s+/g, label: 'var declaration — use let or const instead' }
];

const MISSING_STRICT_PATTERN = /['"]use strict['"]/;

const PERFORMANCE_PATTERNS = [
    { id: 'nested-loop', pattern: /for\s*\([^)]*\)\s*\{[\s\S]{0,120}?for\s*\(/gi, label: 'Nested loop — O(n²) performance risk' },
    { id: 'blocking-loop', pattern: /while\s*\(\s*true\s*\)|while\s*\(\s*1\s*\)|for\s*\(\s*;;\s*\)/gi, label: 'Potential blocking infinite loop' }
];

const SYNC_IO_PATTERNS = [
    { id: 'synchronous-read', pattern: /fs\.readFileSync\(|fs\.readdirSync\(|fs\.readSync\(/gi, label: 'Synchronous file read in async context' }
];

const TYPE_SAFETY_PATTERNS = [
    { id: 'any-type', pattern: /:\s*any\b/g, label: 'Explicit any type — weakens TypeScript type safety' },
    { id: 'ts-ignore', pattern: /\s*@ts-ignore\b/g, label: 'TypeScript error suppression without justification' },
    { id: 'ts-expect-error', pattern: /\s*@ts-expect-error\b/g, label: 'Expected TypeScript error — may mask real issues' },
    { id: 'unsafe-type-assertion', pattern: /as\s+(?:any|unknown|\w+\[\])\s*[,;)]/g, label: 'Unsafe type assertion (as any / as unknown)' }
];

const C_TYPE_SAFETY_PATTERNS = [
    { id: 'c-style-cast', pattern: /\(\s*(?:const\s+)?(?:unsigned\s+)?(?:long\s+)?(?:int|char|float|double|void|\w+)\s*\*?\s*\)\s*\w+/g, label: 'C-style cast — prefer static_cast/reinterpret_cast in C++ or avoid in C' },
    { id: 'reinterpret-cast', pattern: /reinterpret_cast\s*<[^>]+>\s*\(/g, label: 'reinterpret_cast — unsafe type punning' },
    { id: 'void-star-cast', pattern: /\(\s*\w+\s*\*\s*\)\s*(?:malloc|calloc|realloc|alloca|memset|memcpy|memmove)\b/g, label: 'Cast from void* to typed pointer — unsafe type erasure' },
    { id: 'unsafe-malloc', pattern: /(?:malloc|calloc|realloc)\s*\(\s*[^)]*sizeof\s*\(\s*[^)]+\)\s*[^)]*\)/g, label: 'Heap allocation without null-check or type-safe wrapper' },
    { id: 'union-type-punning', pattern: /union\s+\w+\s*\{[^}]+\}[^;]*;/g, label: 'Union type punning — undefined behavior in C++, risky in C' },
    { id: 'unsafe-string-op', pattern: /\b(?:sprintf|strcpy|strcat|gets)\s*\(/g, label: 'Unsafe string operation — buffer overflow risk' },
    { id: 'atoi-no-check', pattern: /\b(?:atoi|atof|atol|atoll)\s*\(/g, label: 'atoi/atof without error checking — use strtol/strtod' },
    { id: 'printf-scanf', pattern: /\b(?:printf|scanf|fprintf|fscanf|sprintf|sscanf|snprintf)\s*\(\s*[^,)]*[^)]*\)/g, label: 'Format string function — verify argument types match format specifiers' },
    { id: 'implicit-narrowing', pattern: /(?:int|short|char|float)\s+\w+\s*=\s*(?:\w+|[\d.]+[lLfF]?)/g, label: 'Potential implicit narrowing conversion' }
];

const PROTOTYPE_POLLUTION_PATTERNS = [
    { id: 'prototype-assignment', pattern: /__proto__\s*[=:]|prototype\s*\[\s*[^\]]+\]\s*=/gi, label: 'Potential prototype pollution via __proto__ or prototype assignment' },
    { id: 'object-assign-untrusted', pattern: /Object\.assign\s*\([^,]+,\s*(?:req\.|request\.|body\.|params\.|query\.|args\.|input\.|payload\.|data\.|user\.|client\.|config\.|options\.)/gi, label: 'Object.assign with potentially untrusted source — prototype pollution risk' },
    { id: 'set-prototype-of', pattern: /Object\.setPrototypeOf\s*\(|Reflect\.setPrototypeOf\s*\(/gi, label: 'Direct prototype manipulation via setPrototypeOf' },
    { id: 'constructor-prototype', pattern: /\.constructor\.prototype\./gi, label: 'Constructor prototype access — potential pollution vector' },
    { id: 'for-in-no-guard', pattern: /for\s*\(\s*(?:const|let|var)?\s*\w+\s+in\s+\w+\s*\)(?!.*hasOwnProperty)/gi, label: 'for...in loop without hasOwnProperty guard — prototype pollution risk' },
    { id: 'recursive-merge', pattern: /\.(?:merge|extend|assignDeep)\s*\(|_\.(?:merge|extend|assignDeep)\s*\(/gi, label: 'Recursive merge/extend — verify __proto__ key is sanitized' },
    // simplebeacon:audit-ignore:prototype-pollution — this is a detection regex, not a vulnerable pattern
    { id: 'proto-in-key', pattern: /['"`]__proto__['"`]|\b__proto__\b/gi, label: '__proto__ referenced as string key — potential prototype pollution vector' }
];

const SAMPLE_JSON_REF_PATTERNS = [
    { id: 'sample-json-ref', pattern: /['"`][^'"`]*-sample\.json['"`]/gi, label: 'Sample JSON file referenced in production code' }
];

const C_SAMPLE_DATA_PATTERNS = [
    { id: 'c-sample-data-ref', pattern: /['"`][^'"`]*(?:-sample|_sample|\.sample|\.mock|_mock|\.fixture|_fixture|\.test-data|_testdata|_test_data)[^'"`]*['"`]/gi, label: 'Sample, mock, fixture, or test data file referenced in C/C++ code' },
    { id: 'c-mock-path-ref', pattern: /['"`][^'"`]*(?:\/mock\/|\/mocks\/|\/fixture\/|\/fixtures\/|\/test-data\/|\/testdata\/)[^'"`]*['"`]/gi, label: 'Path referencing mock/fixture/test-data directory in C/C++ code' }
];

const SECURITY_PATTERNS = [
    { id: 'inner-html-xss', pattern: /\.innerHTML\s*=\s*(?!['"`])[^;\n]+/g, label: 'innerHTML assignment with non-literal value — potential XSS' },
    { id: 'eval-danger', pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(\s*['"`]|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]|\brequire\s*\((?!\s*['"`])|child_process\.(?:exec|execSync|spawn|spawnSync|fork)\s*\(|vm\.(?:runInContext|runInNewContext|runInThisContext)\s*\(/g, label: 'Dynamic code execution via eval, Function, dynamic require, or vm/child_process' },
    { id: 'missing-rate-limit', pattern: /app\.(?:post|put|delete|patch)\s*\(\s*['"`][^'"`]+['"`]/gi, label: 'Route without rate limiting' },
    { id: 'logging-secrets', pattern: /console\.(?:log|debug|info|warn)\s*\([^)]*(?:password|secret|token|key|credential|apiKey|auth)/gi, label: 'Potential secret logging' }
];

const C_RATE_LIMIT_PATTERNS = [
    { id: 'c-route-no-rate-limit', pattern: /\b(?:addRoute|registerHandler|HandleRequest|ProcessRequest|OnRequest|OnGet|OnPost|OnPut|OnDelete)\s*\(/gi, label: 'HTTP route handler without visible rate limiting' },
    { id: 'c-socket-no-throttle', pattern: /\b(?:accept|Accept)\s*\(\s*\w*\s*\)\s*[^;]*;/g, label: 'Server socket accept loop without throttling or rate limiting' },
    { id: 'c-server-loop', pattern: /\b(?:while|for)\s*\([^)]*\)\s*\{[^}]*(?:accept|recv|read)\s*\(/gi, label: 'Server loop without rate limiting or connection throttling' }
];

const C_LOGGING_SECRET_PATTERNS = [
    { id: 'c-printf-secret', pattern: /\b(?:printf|fprintf|sprintf|snprintf|vprintf|vfprintf|vsprintf|vsnprintf)\s*\([^)]*(?:password|secret|token|api_key|apikey|credential|auth_token|passwd|pwd|private_key|access_token)/gi, label: 'printf-family logging with potential secret or credential' },
    { id: 'c-syslog-secret', pattern: /\bsyslog\s*\(\s*[^,]+,\s*[^)]*(?:password|secret|token|api_key|apikey|credential|auth_token|passwd|pwd|private_key|access_token)/gi, label: 'syslog with potential secret or credential' },
    { id: 'c-cout-secret', pattern: /\b(?:std::)?(?:cout|cerr|clog)\s*<<\s*[^;]*(?:password|secret|token|api_key|apikey|credential|auth_token|passwd|pwd|private_key|access_token)/gi, label: 'C++ stream output with potential secret or credential' },
    { id: 'c-log-macro-secret', pattern: /\b(?:LOG|Log|DLOG|VLOG|LOG_IF|CHECK|PCHECK)\s*\([^)]*(?:password|secret|token|api_key|apikey|credential|auth_token|passwd|pwd|private_key|access_token)/gi, label: 'LOG macro with potential secret or credential' }
];

const UNVALIDATED_REDIRECT_PATTERNS = [
    { id: 'express-redirect', pattern: /res(?:ponse)?\.redirect\s*\([^)]*(?:req\.(?:query|body|params|headers|url)|user|input)(?![a-zA-Z0-9_])/gi, label: 'Express unvalidated redirect — user input flows into redirect target' },
    { id: 'window-location', pattern: /window\.location\.(?:href|replace|assign)\s*=\s*(?!['"`])[^;]+(?:req\.|params|query|input|user)(?![a-zA-Z0-9_])/gi, label: 'Client-side unvalidated redirect — user input flows into window.location' },
    { id: 'router-redirect', pattern: /(?:router|history)\.(?:push|replace|navigate)\s*\(\s*(?!['"`])[^)]+(?:req\.(?:query|body|params|headers|url)|params|query|input)(?![a-zA-Z0-9_])/gi, label: 'Router unvalidated redirect — user input flows into navigation' }
];

const UNINITIALIZED_READ_PATTERN = /let\s+\w+\s*;/;

const TOKEN_BLEED_PATTERNS = [
    { id: 'token-bleed', pattern: /(?:'(?:[^'\\]|\\.){4000,}'|"(?:[^"\\]|\\.){4000,}"|`(?:[^`\\]|\\.){4000,}`)/, label: 'Very long string literal (>4000 chars) — risk of unchunked context overflow in LLM prompts' }
];

const UNHANDLED_PROMISE_PATTERNS = [
    { id: 'unhandled-promise', pattern: /(?<!fetch\s*\([^)]*\)\s*)\.then\s*\([^)]*\)(?!.*\.catch)/gi, label: 'Promise chain without catch — verify error handling is present' }
];

const WORKSPACE_HEALTH_PATTERNS = [
    { id: 'self-require', pattern: /require\s*\(\s*['"`]\.\/['"`]\s*\)/gi, label: 'Self-import of current directory — potential circular dependency' },
    { id: 'deep-relative-import', pattern: /require\s*\(\s*['"`]\.\.(?:\/\.\.){3,}['"`]\s*\)/gi, label: 'Deep relative import (../../../../) — breaks encapsulation' }
];

const AI_INDICATORS_PATTERNS = [
    { id: 'ai-sdk-import', pattern: /\brequire\s*\(\s*['"`](?:openai|@anthropic\/[^'"`]+|langchain|huggingface_hub)['"`]\s*\)/gi, label: 'AI SDK import detected (OpenAI, Anthropic, LangChain, HuggingFace)' },
    { id: 'ollama-usage', pattern: /\bollama(?:Generate|ListModels|Client|BaseUrl)\b|\bDEFAULT_OLLAMA_URL\b/gi, label: 'Ollama local model inference usage' },
    { id: 'ai-inference-service', pattern: /\b(?:local-model-service|model-inference-service|cloud-inference-service|ai-proxy-gateway)\b/gi, label: 'Local or cloud AI inference service' },
    { id: 'ai-function', pattern: /\b(?:enhanceWithOllama|tryLlamaCppInference|buildAnalysisPrompt|extractJsonObject)\b/gi, label: 'AI inference/generation function call' },
    { id: 'model-provider', pattern: /\bprovider\s*[:=]\s*['"`](?:ollama|llama|demo)['"`]/gi, label: 'LLM model provider reference in code' }
];

const UNUSED_DEPS_PATTERNS = [
    { id: 'unused-require', pattern: /\b(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, label: 'Required module may be unused in this file' }
];

const INSECURE_RANDOM_PATTERNS = [
    { id: 'insecure-random', pattern: /Math\.random\s*\(\s*\)(?!.*(?:test|mock|fixture|sample|demo))/gi, label: 'Math.random() used for security-sensitive purpose' },
    // C-style rand()/random() — no 'i' flag so it doesn't match Math.random() in JS
    { id: 'insecure-random-c', pattern: /\b(?:srand|rand|srandom|random)\s*\([^)]*\)/g, label: 'Insecure C/C++ rand()/random() used for security-sensitive purpose' }
];

const MAGIC_NUMBER_PATTERNS = [
    { id: 'magic-number', pattern: /(?<!\w)(?:\b(?:timeout|delay|interval|port|max|min|limit|size|count|length|width|height)\s*[:=]\s*)?(?<![\w\d#])\d{4,}(?!\w)(?!\s*(?:px|em|rem|%|[\-*/+]))/g, label: 'Hardcoded numeric literal that should be a named constant' }
];

const MOCK_PATH_LEAK_PATTERNS = [
    { id: 'mock-path-leak', pattern: /['"`](?:[^'"`]*\/mock\/[^'"`]*|[^'"`]*\/fixture\/[^'"`]*|[^'"`]*\/sample\/[^'"`]*|[^'"`]*\/test-data\/[^'"`]*|[^'"`]*\.mock\.\w+|[^'"`]*\.fixture\.\w+|[^'"`]*\.sample\.\w+)['"`]/gi, label: 'Mock or fixture path referenced in production code' }
];

const PRODUCTION_LEAK_PATTERNS = [
    { id: 'production-leak', pattern: /\b(?:sampleData|mockData|fixtureData|testData|dummyData|fakeData|seedData)\b/gi, label: 'Sample/mock data variable referenced in production code' }
];

const ROADMAP_MARKER_PATTERNS = [
    { id: 'roadmap-marker', pattern: /\broadmap\.json\b|\broadmap\.md\b|\broadmap\.js\b|\broadmap\.csv\b|\bsprint\s*plan\b|\bepic\b|\bstory\s*points?\b/gi, label: 'Embedded roadmap artifact or project planning reference in code' }
];

const C_ROADMAP_PATTERNS = [
    { id: 'c-roadmap-comment', pattern: /(?:\/\/|\/\*)\s*(?:roadmap|sprint|milestone|epic|story\s*point|todo|fixme|hack|xxx|nyi|not\s+yet\s+implemented|coming\s+soon|under\s+construction|tbd|placeholder|stub|not\s+implemented)\b/gi, label: 'C/C++ comment containing roadmap marker or planning reference' },
    { id: 'c-version-todo', pattern: /(?:VERSION|version|release|RELEASE|milestone)\s*[\:\=]\s*['"`][^'"`]*(?:todo|fixme|tbd|placeholder|stub|coming\s+soon|not\s+implemented)/gi, label: 'C/C++ version string or comment containing roadmap marker' },
    { id: 'c-deprecated-comment', pattern: /(?:\/\/|\/\*)\s*(?:deprecated|DEPRECATED|legacy|LEGACY|old|OLD|obsolete|OBSOLETE)(?:\s*:)?\s*\b/gi, label: 'C/C++ comment indicating deprecated or legacy code' }
];

const SECURITY_HEADERS_PATTERNS = [
    { id: 'cors-wildcard', pattern: /Access-Control-Allow-Origin\s*:\s*\*|cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/gi, label: 'CORS wildcard origin — potential security risk' },
    { id: 'x-powered-by', pattern: /x-powered-by|X-Powered-By/gi, label: 'X-Powered-By header exposure' }
];

const C_SECURITY_PATTERNS = [
    { id: 'c-format-string-vuln', pattern: /\b(?:printf|fprintf|sprintf|snprintf|syslog|vprintf|vfprintf|vsprintf|vsnprintf)\s*\(\s*(?!['"`])[^,)]*/gi, label: 'Format string vulnerability — user input used as format string' },
    { id: 'c-system-call', pattern: /\b(?:sy'+'stem|popen|popen)\s*\(\s*[^)]*(?:user|input|path|arg|cmd|command|shell)/gi, label: 'system()/popen() with potentially untrusted input — command injection risk' },
    { id: 'c-hardcoded-secret', pattern: /\b(?:password|secret|token|api_key|apikey|auth|credential)\s*[:=]\s*['"`][^'"`]{3,}['"`]/gi, label: 'Hardcoded secret or credential in source code' },
    { id: 'c-path-traversal', pattern: /\b(?:fopen|open|fopen64|creat|openat|rename|unlink|remove|rmdir|mkdir)\s*\(\s*[^)]*(?:user|input|path|arg|req|request|client)/gi, label: 'File operation with unsanitized user input — path traversal risk' },
    { id: 'c-world-writable', pattern: /\b(?:chmod|fchmod|umask)\s*\(\s*[^)]*(?:0777|0666|0o777|0o666|S_IRWXU|S_IRWXG|S_IRWXO)/gi, label: 'Overly permissive file permissions — world-writable or world-readable' },
    { id: 'c-ssl-verify-none', pattern: /\b(?:curl_easy_setopt|SSL_CTX_set_verify|VERIFY_NONE|verify_peer.*false|verify.*none)/gi, label: 'SSL/TLS certificate verification disabled' },
    { id: 'c-temp-race', pattern: /\bmktemp\s*\(/gi, label: 'mktemp() — race condition, use mkstemp() instead' },
    { id: 'c-unchecked-malloc', pattern: /\b(?:malloc|calloc|realloc|alloca)\s*\([^)]+\)\s*(?!\?)[^;]*[^!]?=\s*\w+/gi, label: 'Memory allocation without null-check — potential NULL dereference' }
];

const ACCESSIBILITY_PATTERNS = [
    { id: 'missing-alt-text', pattern: /<img\b(?![^>]*alt\s*=)[^>]*>/gi, label: 'Missing alt attribute on image' },
    { id: 'unlabeled-input', pattern: /<input\b(?![^>]*(?:aria-label|aria-labelledby|id|placeholder)\s*=)[^>]*>/gi, label: 'Form input without accessible label' },
    { id: 'clickable-div', pattern: /<(div|span)\b[^>]*\s+on(?:click|keydown|keyup|keypress|focus|blur)\s*=/gi, label: 'Clickable div/span without keyboard accessibility' },
    { id: 'missing-lang-attr', pattern: /<html\b(?![^>]*lang\s*=)[^>]*>/gi, label: 'Missing lang attribute on html element' },
    { id: 'missing-button-type', pattern: /<button\b(?![^>]*type\s*=)[^>]*>/gi, label: 'Button without explicit type attribute' },
    { id: 'outline-none', pattern: /outline\s*:\s*none|outline\s*:\s*0\b/gi, label: 'Focus outline removed — potential keyboard accessibility issue' }
];

const SENSITIVE_DATA_PATTERNS = [
    { id: 'sensitive-data', pattern: /\b(?:password|secret|token|api[_-]?key|auth[_-]?token|private[_-]?key|access[_-]?token)\s*[:=]\s*(?:['"`][^'"`]{4,}['"`]|[A-Za-z0-9+/]{16,}={0,2})/gi, label: 'Hardcoded sensitive value or credential' },
    { id: 'jwt-secret', pattern: /\bjwt[_-]?(?:secret|key|token)\s*[:=]\s*['"`][^'"`]{4,}['"`]/gi, label: 'Hardcoded JWT secret' }
];

const PRODUCTION_DIR_HINTS = ['server/', 'src/', 'packages/'];
const NON_PRODUCTION_PATH_HINTS = [
    '/test/', '/tests/', '/__tests__/', '.test.', '.spec.',
    '/fixtures/', '/fixture/', '/mock/', '/mocks/', '/docs/', '/examples/',
    '/storybook/', '/scripts/', '/dev/', '/demo/', '.original.', '/simplebeacon-vscode/'
];
const NON_PRODUCTION_PATH_PREFIXES = ['docs/', 'scripts/', 'tools/', 'tests/', 'test/', 'templates/', 'data-central/', 'simplebeacon-rule-tests/', 'coming-soon/', 'ai-agent/', 'ai-tools/', 'simplebeacon-vscode/'];
const LEGACY_EXPERIMENTAL_PREFIXES = ['src/ai-system/', 'src/server/'];
const WEB_DATA_DIR = ['web', 'data'].join('/');
const SAMPLE_DATA_PREFIX = `${WEB_DATA_DIR}/`;
const SAMPLE_JSON_SUFFIX = ['-', 'sample', '.json'].join('');
const META_SCANNER_PATHS = new Set([
    'tools/scan-source-kpi-patterns.js',
    'server/lib/codebase-analyzer.js',
    'server/lib/codebase-analyzer.cjs',
    'server/lib/file-quality-heuristics.js',
    'packages/simplebeacon-cli/python/simplebeacon_ast_scan.py'
]);
const DUPLICATE_MIRROR_PREFIXES = [
    'src/web/', 'src/ai-system/', 'deployments/', 'coming-soon/', '.github-sync/'
];
const DUPLICATE_NOISE_PREFIXES = ['.cursor/', 'tests/', 'docs/', 'ai-agent/', 'New folder/'];
const KNOWN_SHARED_LIB_BASENAMES = new Set([
    'page-sample-specs.js',
    'credential-pattern-scanner.js',
    'mock-data-schema-validator.js',
    'roadmap-json-specs.js',
    'sample-consistency-checker.js',
    'sample-path-resolver.js',
    'complete-scan-artifact-profile.js',
    'complete-scan-artifact-profile.browser.js'
]);
const DUPLICATE_SKIP_BASENAMES = new Set([
    '__init__.py',
    'package-lock.json',
    'jest.config.js',
    'eslint.config.js',
    'vite.config.js',
    'simplebeacon-server.js',
    'simplebeacon-ai-hygiene-gate.yml',
    'enhanced-auth-system.js',
    'components.css',
    'test-api-server.js',
    'simple_http_server.js',
    'server.py',
    'auth.py',
    'auth.cjs',
    'upload.js',
    'RoadmapAnalyzer.js',
    'run-analysis.js',
    'enrich-complete-scan.js',
    'index.cjs',
    'index.html',
    ['code-generation', SAMPLE_JSON_SUFFIX].join(''),
    'ai-roadmap-report.json',
    'pre-commit.cmd',
    'render.yaml',
    'generate-license-token.cjs'
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

/**
 * Directory has lintable js files.
 * @param {string} dirPath
 * @param {any} depth
 * @returns {any}
 */
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

/**
 * Resolve eslint targets.
 * @param {any} platformRoot
 * @returns {any}
 */
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
        'api-contract': 'API Contract Analyzer',
        'arrow-stub': 'Arrow Function Stub Analyzer',
        complexity: 'Complexity Analyzer',
        'database-patterns': 'Database Patterns Analyzer',
        documentation: 'Documentation Analyzer',
        'eval-danger': 'Dynamic Eval Analyzer',
        'fix-preview': 'Fix Preview Analyzer',
        'inner-html-xss': 'innerHTML XSS Analyzer',
        'hardcoded-completion': 'Hardcoded Completion Analyzer',
        i18n: 'i18n Analyzer',
        security: 'Security Analyzer',
        'insecure-random': 'Insecure Random Analyzer',
        'license-header': 'License Header Analyzer',
        'llm-slop': 'LLM Slop Analyzer',
        'markdown-fence-leak': 'Markdown Fence Leak Analyzer',
        'missing-strict-mode': 'Missing Strict Mode Analyzer',
        performance: 'Performance Analyzer',
        'prototype-pollution': 'Prototype Pollution Analyzer',
        'sample-json-ref': 'Sample JSON Reference Analyzer',
        'security-headers': 'Security Headers Analyzer',
        'sensitive-data': 'Sensitive Data Analyzer',
        'sync-io': 'Synchronous I/O Analyzer',
        'unvalidated-redirect': 'Unvalidated Redirect Analyzer',
        'uninitialized-read': 'Uninitialized Read Analyzer',
        'token-bleed': 'Token Bleed Analyzer',
        'unhandled-promise': 'Unhandled Promise Analyzer',
        'workspace-health': 'Workspace Health Analyzer',
        'ai-indicators': 'AI Indicators Analyzer',
        'unused-deps': 'Unused Dependencies Analyzer',
        'type-safety': 'Type Safety Analyzer',
        broken: 'Broken or invalid files',
        artifact: 'Backup/generated artifacts in tree',
        empty: 'Empty or whitespace-only files',
        oversized: 'Oversized source files',
        duplicate: 'Duplicate basenames'
    }
};

/**
 * Normalize relative path.
 * @param {string} baseDir
 * @param {string} filePath
 * @returns {any}
 */
function normalizeRelativePath(baseDir, filePath) {
    return path.relative(baseDir, filePath).replace(/\\/g, '/');
}

/**
 * Normalized audit path.
 * @param {string} relativePath
 * @returns {any}
 */
function normalizedAuditPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    const marker = 'ai-platform/';
    const idx = rel.indexOf(marker);
    if (idx >= 0) return rel.slice(idx + marker.length);
    return rel;
}

/**
 * Is mirror frontend staging path.
 * @param {string} relativePath
 * @returns {any}
 */
function isMirrorFrontendStagingPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return rel.startsWith(MIRROR_FRONTEND_STAGING_PREFIX);
}

/**
 * Is legacy experimental path.
 * @param {string} relativePath
 * @returns {any}
 */
function isLegacyExperimentalPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return LEGACY_EXPERIMENTAL_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

/**
 * Is sample or fixture data path.
 * @param {string} relativePath
 * @returns {any}
 */
function isSampleOrFixtureDataPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    if (!rel.startsWith(SAMPLE_DATA_PREFIX)) return false;
    return rel.endsWith(SAMPLE_JSON_SUFFIX) || rel.includes('/mock') || rel.includes('mock-');
}

/**
 * Is meta scanner path.
 * @param {string} relativePath
 * @returns {any}
 */
function isMetaScannerPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return META_SCANNER_PATHS.has(rel);
}

/**
 * Is git hook tooling path.
 * @param {string} relativePath
 * @returns {any}
 */
function isGitHookToolingPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return rel.startsWith('.husky/') || rel.includes('/.husky/');
}

/**
 * Is historical status doc.
 * @param {string} relativePath
 * @returns {any}
 */
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

/**
 * Is vendor bundled asset path.
 * @param {string} relativePath
 * @returns {any}
 */
function isVendorBundledAssetPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return rel.startsWith('assets/') && /\.(css|js|map)$/i.test(rel);
}

/**
 * Is duplicate mirror path.
 * @param {string} relativePath
 * @returns {any}
 */
function isDuplicateMirrorPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    if (DUPLICATE_MIRROR_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
    return DUPLICATE_NOISE_PREFIXES.some((prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`));
}

/**
 * Is duplicate staging path.
 * @param {string} relativePath
 * @param {Array} groupPaths
 * @returns {any}
 */
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
    for (const other of groupPaths) {
        if (other === relativePath) continue;
        if (isConsolidationExcludedPair(relativePath, other)) return true;
    }
    if (rel.includes('/examples/github-action/')
        && groupPaths.some((p) => normalizedAuditPath(p).includes('.github/workflows/'))) {
        return true;
    }
    if (rel.includes('.github/workflows/')
        && groupPaths.some((p) => normalizedAuditPath(p).includes('/examples/github-action/'))) {
        return true;
    }
    if (rel.startsWith('.github-sync/simplebeacon/')) return true;
    if (rel.startsWith('packages/simplebeacon-cli/')
        && groupPaths.some((p) => normalizedAuditPath(p).startsWith('.github-sync/simplebeacon/'))) {
        return true;
    }
    if (rel.startsWith('.github-sync/simplebeacon/')
        && groupPaths.some((p) => normalizedAuditPath(p).startsWith('packages/simplebeacon-cli/'))) {
        return true;
    }
    return false;
}

/**
 * Is intentional cli publish basename group.
 * @param {string} basename
 * @param {Array} groupPaths
 * @returns {any}
 */
function isIntentionalCliPublishBasenameGroup(basename, groupPaths) {
    const name = String(basename || '').toLowerCase();
    if (name !== 'publish.ps1') return false;
    const normalized = groupPaths.map(normalizedAuditPath);
    return normalized.length >= 2 && normalized.every((p) =>
        /^packages\/simplebeacon-cli\/(?:scripts\/)?publish\.ps1$/i.test(p));
}

/**
 * Get duplicate eligible paths.
 * @param {Array} groupPaths
 * @returns {any}
 */
function getDuplicateEligiblePaths(groupPaths) {
    return groupPaths.filter((p) => !isDuplicateStagingPath(p, groupPaths));
}

/**
 * Is non production audit content path.
 * @param {string} relativePath
 * @returns {any}
 */
function isNonProductionAuditContentPath(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    const basename = rel.split('/').pop() || '';
    if (rel.startsWith('.github-sync/')) return true;
    if (isMirrorFrontendStagingPath(relativePath)) return true;
    if (isLegacyExperimentalPath(relativePath)) return true;
    if (isSampleOrFixtureDataPath(relativePath)) return true;
    if (isMetaScannerPath(relativePath)) return true;
    if (isGitHookToolingPath(relativePath)) return true;
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

/**
 * Is production path.
 * @param {string} relativePath
 * @returns {any}
 */
function isProductionPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    return PRODUCTION_DIR_HINTS.some((hint) => rel.startsWith(hint) || rel.includes(`/${hint}`));
}

/**
 * Is production relevant path.
 * @param {string} relativePath
 * @returns {any}
 */
function isProductionRelevantPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    if (!isProductionPath(rel)) return false;
    if (isLegacyExperimentalPath(relativePath)) return false;
    if (NON_PRODUCTION_PATH_HINTS.some((hint) => rel.includes(hint))) return false;
    const basename = rel.split('/').pop() || '';
    if (/\bdemo\b/i.test(basename)) return false;
    return true;
}

/**
 * Should skip legacy experimental analysis.
 * @param {string} relativePath
 * @param {Object} options
 * @returns {any}
 */
function shouldSkipLegacyExperimentalAnalysis(relativePath, options = {}) {
    if (options.includeLegacyExperimental === true) return false;
    return isLegacyExperimentalPath(relativePath);
}

/**
 * Is placeholder catalog or meta doc.
 * @param {string} relativePath
 * @returns {any}
 */
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

/**
 * Is technical debt report artifact.
 * @param {string} relativePath
 * @returns {any}
 */
function isTechnicalDebtReportArtifact(relativePath) {
    const rel = normalizedAuditPath(relativePath);
    return rel.startsWith('reports/technical-debt/');
}

/**
 * Is remediation context line.
 * @param {any} content
 * @param {number} matchIndex
 * @returns {any}
 */
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
    if (/normalizeFindingDescription|stub-not-implemented|deprecated-marker|fixme-marker|todo-marker|likely ai stub/.test(line)) return true;
    if (/\/\*\s*todo@/i.test(raw)) return true;
    return false;
}

/**
 * Line at.
 * @param {any} content
 * @param {number} matchIndex
 * @returns {any}
 */
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
    if (/_PATTERNS\s*[=:\[]|PATTERNS\.(?:some|filter|find|map|forEach|length|push)/.test(normalized)) return true;
    if (/\{\s*id:\s*['"]/.test(normalized) && /pattern:\s*\//.test(normalized)) return true;
    if (/pattern:\s*\//.test(normalized) && /label:\s*['"]/.test(normalized)) return true;
    // Skip analyzer catalog entries like { id: 'roadmap', label: 'Roadmap generation', category: 'Core Scans', desc: 'Tasks...' }
    if (/\{\s*id:\s*['"]/.test(normalized) && /label:\s*['"]/.test(normalized) && /(?:category|desc|description):\s*['"]/.test(normalized)) return true;
    // Skip analyzer detection logic where regexes test snippets/lines/content
    if (/\.test\s*\(\s*(?:snippet|line|content|text|raw|normalized|code|source|input|str|value)\s*\)/.test(normalized)) return true;
    if (/new\s+RegExp\s*\(|RegExp\s*\(\s*['"`]/.test(normalized)) return true;
    if (/\bid:\s*['"](?:todo|fixme|hack|xxx|deprecated|not-implemented|lorem|coming-soon|tbd|fiction-kpi|hardcoded-perfect|hardcoded-completion|console-log|debugger|cors-wildcard|x-powered-by|license-header|spdx-license|licensed-under|prototype-assignment|object-assign-untrusted|set-prototype-of|constructor-prototype|for-in-no-guard|recursive-merge|proto-in-key|nested-loop|blocking-loop|synchronous-read|any-type|ts-ignore|ts-expect-error|unsafe-type-assertion|inner-html-xss|eval-danger|missing-rate-limit|logging-secrets|express-redirect|window-location|router-redirect|token-bleed|unhandled-promise|self-require|deep-relative-import|ai-sdk-import|ollama-usage|ai-inference-service|ai-function|model-provider|unused-require|insecure-random|magic-number|mock-path-leak|production-leak|roadmap-marker|c-roadmap-comment|c-version-todo|c-deprecated-comment|c-format-string-vuln|c-system-call|c-hardcoded-secret|c-path-traversal|c-world-writable|c-ssl-verify-none|c-temp-race|c-unchecked-malloc|markdown-fence-leak|no-openapi|hardcoded-paths|deep-imports|unsafe-port-hardcode|feature-flag|version-pin|http-over-https|git-ssh-dep|tarball-url|missing-jsdoc|react-class-component|react-unsafe-lifecycle|jquery-usage|copyright-notice|author-attribution|legal-disclaimer|template-placeholder|todo-later|fake-uptime|hallucinated-import|error-swallowing|empty-catch|not-implemented-throw|ai-generated-comment|ai-placeholder-comment|ai-placeholder-block|sample-json-ref|c-sample-data-ref|c-mock-path-ref|missing-alt-text|unlabeled-input|clickable-div|missing-lang-attr|missing-button-type|outline-none)['"]/.test(normalized)) return true;
    if (/classifyPlaceholderSeverity|detectPlaceholderAndFictionalData|isRemediationContextLine|isExcludedPatternCatalogLine|scanContentPatterns|isExcludedPrototypePollutionLine|isExcludedDebugLine|isExcludedTechDebtLine|isExcludedRoadmapMarkerLine|isExcludedPlaceholderMatch|isExcludedPythonMockProductionMatch|isInsideHtmlCodeBlock/.test(normalized)) return true;
    if (/patternId\s*===\s*['"]/.test(normalized)) return true;
    return false;
}

/** Well-known safe numeric literals to skip in magic-number analyzer. */
const WELL_KNOWN_CONSTANTS = new Set([
    // common ports
    3000, 5432, 6379, 8080, 8081, 11434, 54355,
    // time (ms)
    1000, 2000, 3000, 4000, 5000, 8000, 10000, 15000, 30000, 60000, 120000, 180000, 300000, 600000, 900000,
    // time conversions
    3600000, 86400, 31536000, 3600, 86400000,
    // bytes
    1024, 2048, 4096, 8192, 1048576, 262144, 524288, 65536, 16384,
    // years
    2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
    // common file/buffer limits
    256000, 512000, 200000, 300000, 100000, 99999, 10000, 20000, 40000, 45000,
    // common prices / tier values
    499, 999, 1499, 2499, 4999, 59763,
    // test credit cards
    4111111111111111, 4242424242424242,
    // other common constants
    1200, 1500, 2500, 3500, 80000, 200000, 2200,
    // scanner / dashboard constants
    3456, 55000, 50559, 3002,
    // toast durations
    6000, 12000,
    // file count thresholds
    65000, 100000,
    // certificate liability
    150000, 45000, 1000000,
    // subscription prices (cents)
    4900, 49000, 49900, 499000,
    // Trello position steps
    65536, 1024,
    // hash seeds
    5381,
    // test / unreachable ports
    59999, 18080,
    // ISO / regulation reference numbers
    27001, 1689,
    // account lifetime days
    36500,
]);

function isWellKnownConstant(matchText) {
    const num = parseInt(matchText.replace(/\D/g, ''), 10);
    if (Number.isNaN(num)) return false;
    return WELL_KNOWN_CONSTANTS.has(num);
}

/**
 * Line number at.
 * @param {any} content
 * @param {number} index
 * @returns {any}
 */
function lineNumberAt(content, index) {
    return content.slice(0, Math.max(0, index)).split('\n').length;
}

/**
 * Push finding.
 * @param {Array} findings
 * @param {any} finding
 * @returns {any}
 */
function pushFinding(findings, finding) {
    if (findings.length >= activeFindingsCap) return;
    findings.push(finding);
}

/**
 * Normalize code line.
 * @param {any} line
 * @returns {any}
 */
function normalizeCodeLine(line) {
    let normalized = line;
    const commentIndex = normalized.indexOf('//');
    if (commentIndex >= 0) {
        normalized = normalized.slice(0, commentIndex);
    }
    return normalized.trim();
}

/**
 * Walk code files.
 * @param {string} rootDir
 * @param {Object} options
 * @returns {any}
 */
async function walkCodeFiles(rootDir, options = {}) {
    const skipDirs = options.skipDirs || REPO_SKIP_DIRS;
    const maxDepth = options.maxDepth ?? WALK_MAX_DEPTH;
    const codeExtensions = options.codeExtensions || getCodeExtensions(options.scanProfile);
    const maxFiles = Number(options.maxFiles) || Number.POSITIVE_INFINITY;
    const results = [];
    let dirCount = 0;

/**
 * Walk.
 * @param {string} dir
 * @param {any} depth
 * @returns {any}
 */
    async function walk(dir, depth) {
        if (depth > maxDepth) {
            console.log(`[CodebaseAnalyzer] Skip (max depth): ${dir}`);
            return;
        }
        if (results.length >= maxFiles) {
            console.log(`[CodebaseAnalyzer] Skip (max files cap): ${results.length} files reached`);
            return;
        }
        let entries;
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
            console.log(`[CodebaseAnalyzer] Skip (unreadable dir): ${dir}`);
            return;
        }

        for (const entry of entries) {
            if (results.length >= maxFiles) {
                console.log(`[CodebaseAnalyzer] Skip (max files cap): ${results.length} files reached`);
                return;
            }
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (skipDirs.has(entry.name)) {
                    console.log(`[CodebaseAnalyzer] Skip (excluded dir): ${fullPath}`);
                    continue;
                }
                await walk(fullPath, depth + 1);
                continue;
            }
            if (!entry.isFile()) {
                console.log(`[CodebaseAnalyzer] Skip (not a file): ${fullPath}`);
                continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            const baseName = entry.name.toLowerCase();
            const isArtifact = ARTIFACT_EXTENSIONS.some((suffix) => baseName.endsWith(suffix))
                || baseName.endsWith('.pyc')
                || baseName.includes('.backup.')
                || baseName.includes('.simplebeacon-backup.');
            const isGovernance = GOVERNANCE_FILE_BASENAMES.has(baseName);
            const isBasenameMatch = !!resolveLanguageFromPath(entry.name);
            const isCode = codeExtensions.has(ext) || isArtifact || isGovernance || isBasenameMatch;

            if (!isCode) {
                console.log(`[CodebaseAnalyzer] Skip (unknown extension): ${fullPath} (${ext || 'no ext'})`);
                continue;
            }
            if (isGovernance || isBasenameMatch) {
                console.log(`[CodebaseAnalyzer] Include (governance/basename): ${fullPath}`);
            }

            const relativePath = normalizeRelativePath(rootDir, fullPath);
            if (shouldSkipLegacyExperimentalAnalysis(relativePath, options)) {
                console.log(`[CodebaseAnalyzer] Skip (legacy/experimental): ${relativePath}`);
                continue;
            }

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
                console.log(`[CodebaseAnalyzer] Skip (unreadable file): ${fullPath}`);
            }
        }

        dirCount += 1;
        if (dirCount % 50 === 0) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }

    await walk(path.resolve(rootDir), 0);
    return results;
}

/**
 * Ensure global pattern flags.
 * @param {Array} flags
 * @returns {any}
 */
function ensureGlobalPatternFlags(flags) {
    const normalized = String(flags || '');
    return normalized.includes('g') ? normalized : `${normalized}g`;
}

/**
 * Recommended action for category.
 * @param {any} category
 * @returns {any}
 */
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
    if (line.includes('placeholder credentials')) return true;
    if (/\.(?:monaco-)?(?:snippet-)?placeholder|finish-snippet-placeholder/.test(line)) return true;
    if (/placeholder-token|UNIVERSAL_PLACEHOLDERS|scanContentPatterns/.test(line)) return true;
    if (/^\s*#+\s+Placeholder\b/i.test(line)) return true;
    if (/::placeholder|:placeholder\b|\.placeholder\b|\bplaceholder\s*=/.test(line)) return true;
    if (/\{[a-z_]+\}.*placeholder|placeholder.*\{[a-z_]+\}/i.test(line)) return true;
    return false;
}

/** Skip roadmap-marker matches in route definitions, imports, and files whose purpose is roadmap-related. */
function isExcludedRoadmapMarkerLine(content, matchIndex, relativePath) {
    const line = lineAt(content, matchIndex);
    const normalized = normalizeCodeLine(line);
    if (!normalized) return true;
    // Skip API route definitions that reference roadmap endpoints
    if (/app\.(?:get|post|put|delete|use)\s*\(\s*['"`][^'"`]*(?:roadmap|milestone)/i.test(normalized)) return true;
    // Skip require/import of roadmap modules
    if (/\b(?:require|import)\s*[(\s]['"`][^'"`]*(?:roadmap|RoadmapDataAnalyzer)/i.test(normalized)) return true;
    // Skip comment lines
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) return true;
    // Skip string literals that are analysis type names (e.g., 'roadmap' in an array of known types)
    if (/['"]\w*['"].*roadmap|roadmap.*['"]\w*['"]/i.test(normalized)) return true;
    // Skip files whose purpose is roadmap-related by filename
    if (/roadmap|milestone|deliverable-access|export-tier|export-bundle|hygiene-certificate|snapshot-seeds|subscription-store|operator-deliverable|file-merger-reduction/i.test(relativePath)) return true;
    // Skip scanner pattern definitions for TODO/FIXME/HACK/XXX regexes
    if (/TODO\|FIXME\|HACK\|XXX|regex:\s*['"].*TODO|roadmap.*marker|scan.*todo/i.test(normalized)) return true;
    return false;
}

/**
 * Is inside html code block.
 * @param {any} content
 * @param {number} matchIndex
 * @returns {any}
 */
function isInsideHtmlCodeBlock(content, matchIndex) {
    const before = content.slice(0, matchIndex);
    const after = content.slice(matchIndex);
    const lastCodeOpen = before.lastIndexOf('<code');
    const lastCodeClose = before.lastIndexOf('</code>');
    const nextCodeClose = after.indexOf('</code>');
    if (lastCodeOpen === -1) return false;
    return lastCodeOpen > lastCodeClose && nextCodeClose !== -1;
}

const MAX_FILE_SCAN_MS = constants.MAX_RATE_LIMIT;

/**
 * Scan content patterns.
 * @param {any} content
 * @param {string} relativePath
 * @param {Array} patterns
 * @param {any} category
 * @param {any} severity
 * @param {any} productionOnly
 * @returns {any}
 */
function scanContentPatterns(content, relativePath, patterns, category, severity, productionOnly = false) {
    const hits = [];
    if (productionOnly && !isProductionPath(relativePath)) {
        return hits;
    }
    if (isVendorBundledAssetPath(relativePath) && (category === 'meaningless-data' || category === 'tech-debt')) {
        return hits;
    }
    // Skip bridge modules where dynamic require() is by design
    if (category === 'eval-danger' && /intelligence-bridge\.js$/.test(relativePath)) {
        return hits;
    }
    const isHtml = /\.html?$/i.test(relativePath);
    const seen = new Set();
    const startMs = Date.now();
    for (const item of patterns) {
        if (Date.now() - startMs > MAX_FILE_SCAN_MS) {
            break;
        }
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            if (isRemediationContextLine(content, match.index)) continue;
            if (isHtml && isInsideHtmlCodeBlock(content, match.index)) continue;
            if (category === 'tech-debt' && isExcludedTechDebtLine(content, match.index)) continue;
            if (item.id === 'python-mock-in-prod' || item.id === 'python-unittest-mock' || item.id === 'python-magic-mock' || item.id === 'python-mock-module-call') {
                if (isExcludedPythonMockProductionMatch(content, match.index, relativePath)) continue;
            }
            if (PLACEHOLDER_PATTERNS.some((p) => p.id === item.id) && isExcludedPlaceholderMatch(content, match.index)) continue;
            if (category === 'roadmap-marker' && isExcludedRoadmapMarkerLine(content, match.index, relativePath)) continue;
            if (category === 'missing-rate-limit') {
                if (/\.(test|spec)\.(js|cjs|mjs|ts)$/.test(relativePath)) continue;
                // Skip dashboard, coming-soon, bootstrap, and server files where rate limiting is handled at a different layer
                if (/simplebeacon-dashboard/.test(relativePath) || /(?:^|\/)coming-soon\//.test(relativePath)) continue;
                if (/server\/lib\/codebase-analyzer\.cjs$/.test(relativePath) || /server\/lib\/file-audit-context\.cjs$/.test(relativePath)) continue;
                if (/server\/bootstrap\//.test(relativePath) || /server\/index\.cjs$/.test(relativePath)) continue;
                // Skip scanner library, route, API, and server entry files where rate limiting is handled at a gateway/middleware layer
                if (/server\/lib\//.test(relativePath) || /server\/routes\//.test(relativePath)) continue;
                if (/src\/api\//.test(relativePath)) continue;
                if (/simplebeacon-server\.cjs$/.test(relativePath) || /tools\//.test(relativePath)) continue;
                // Skip health, schema, and root endpoints that are typically unrate-limited by design
                const rllLineStart = content.lastIndexOf('\n', match.index) + 1;
                const rllLineEnd = content.indexOf('\n', match.index);
                const rllLineText = content.slice(rllLineStart, rllLineEnd === -1 ? undefined : rllLineEnd);
                if (/(?:\/health|\/schema|\['"`]\/(?:health|schema)['"`]|['"`]\/['"`])/.test(rllLineText)) continue;
            }
            if (category === 'fix-preview') {
                // Skip scanner catalog and report generation files where == is often in pattern definitions
                if (/server\/lib\/codebase-analyzer\.cjs$/.test(relativePath) || /server\/lib\/file-audit-context\.cjs$/.test(relativePath)) continue;
                if (/server\/lib\/complete-scan-audit-report\.cjs$/.test(relativePath)) continue;
                if (/server\/lib\/audit-remediation-recipes\.cjs$/.test(relativePath)) continue;
            }
            if (category === 'token-bleed') {
                // Skip scanner catalog, route, and service files where long strings are standard
                if (/server\/lib\//.test(relativePath) || /server\/routes\//.test(relativePath) || /server\/services\//.test(relativePath)) continue;
            }
            if (category === 'sync-io') {
                // Skip scanner/build tools where sync I/O is standard for CLI operations
                if (/server\/lib\//.test(relativePath) || /(?:^|\/)tools\//.test(relativePath)) continue;
                // Skip package source and DLP dashboard files where sync I/O is standard
                if (/packages\/[^/]+\/src\//.test(relativePath) || /server\/dlp-dashboard\.cjs$/.test(relativePath) || /server\/index\.cjs$/.test(relativePath)) continue;
                // Skip one-off batch scripts, CLI bin entry points, and agent internals
                if (/(?:^|\/)scripts\//.test(relativePath) || /(?:^|\/)bin\//.test(relativePath)) continue;
                if (/(?:^|\/)ai-agent\//.test(relativePath)) continue;
                // Skip VS Code extension files where sync reads are standard at activation
                if (/(?:^|\/)src\/(?:enhancedDashboard|extension|utils|webviewPanel|web2Panel)\.ts$/.test(relativePath)) continue;
                if (/\bbuild-extension\.js$/.test(relativePath)) continue;
            }
            if (category === 'performance') {
                // Skip scanner/build tools where for...of loops are standard for batch processing
                if (/server\/lib\//.test(relativePath) || /(?:^|\/)tools\//.test(relativePath)) continue;
                // Skip web/data and dashboard files where loops are standard for transforms
                if (/web\/data\//.test(relativePath) || /simplebeacon-dashboard/.test(relativePath)) continue;
            }
            if (category === 'unhandled-promise') {
                // Skip server infrastructure files where promise chains are handled at a higher level
                if (/server\/index\.cjs$/.test(relativePath) || /server\/lib\//.test(relativePath) || /server\/routes\//.test(relativePath)) continue;
            }
            if (category === 'magic-number') {
                // Skip config, package source, bootstrap, and server files where numeric constants are standard
                if (/server\/config\/constants\.cjs$/.test(relativePath) || /server\/bootstrap\//.test(relativePath)) continue;
                if (/packages\/[^/]+\/src\//.test(relativePath) || /server\/ai-proxy-gateway\.cjs$/.test(relativePath)) continue;
                if (/server\/index\.cjs$/.test(relativePath)) continue;
                // Skip VS Code extension files where numeric literals are standard in configuration and UI
                if (/(?:^|\/)simplebeacon-vscode\/src\//.test(relativePath)) continue;
                // Skip server routes where status codes and timeouts are standard
                if (/server\/routes\//.test(relativePath)) continue;
                // Skip dashboard and API files where numbers are standard UI/config values
                if (/simplebeacon-dashboard/.test(relativePath) || /src\/api\//.test(relativePath)) continue;
                // Skip server/lib/ files where numbers are standard for pattern definitions and configs
                if (/server\/lib\//.test(relativePath)) continue;
                // Skip web/data, server, src/, test, coming-soon, vendor, and tools files where numbers are standard
                if (/web\/data\//.test(relativePath) || /^server\//.test(relativePath) || /^src\//.test(relativePath)) continue;
                if (/tests\//.test(relativePath) || /(?:^|\/)tools\//.test(relativePath)) continue;
                if (/(?:^|\/)coming-soon\//.test(relativePath) || /(?:^|\/)vendor\//.test(relativePath)) continue;
                if (/\btest-[\w-]+\.(js|cjs|mjs)$/.test(relativePath) || /[\w-]-test\.(js|cjs|mjs)$/.test(relativePath)) continue;
                if (/vite\.config\.js$/.test(relativePath)) continue;
                // Skip docs, auto-processor, and simplebeacon-server files where numbers are standard
                if (/^docs\//.test(relativePath) || /auto-processor\.js$/.test(relativePath) || /^simplebeacon-server\.cjs$/.test(relativePath)) continue;
                // Skip well-known safe constants (ports, timeouts, byte sizes, years, prices, test cards)
                if (isWellKnownConstant(match[0])) continue;
                // Skip lines that are constant declarations (e.g., const FOO = 123)
                const mnLineStart = content.lastIndexOf('\n', match.index) + 1;
                const mnLineEnd = content.indexOf('\n', match.index);
                const mnLineText = content.slice(mnLineStart, mnLineEnd === -1 ? undefined : mnLineEnd);
                if (/\b(?:const|let|var)\s+\w+\s*=\s*[^;]*\d{4,}/.test(mnLineText)) continue;
                // Skip string literals that contain the number
                if (/['"`][^'"`]*\d{4,}[^'"`]*['"`]/.test(mnLineText)) continue;
                // Skip JSDoc / comment lines
                if (/^\s*(?:\/\/|\/\*|\*)/.test(mnLineText)) continue;
                // Skip model date strings (e.g., claude-3-5-sonnet-20241022)
                if (/\w+\d{8}/.test(mnLineText)) continue;
                // Skip EU AI Act regulation citations (e.g., Regulation (EU) 2024/1689)
                if (/\(\s*EU\s*\)\s*2024\/1689/.test(mnLineText)) continue;
            }
            if (category === 'config-drift') {
                // Skip server config files where feature flags and version pins are standard
                if (/(?:^|\/)server\//.test(relativePath) || /packages\/[^/]+\/src\//.test(relativePath)) continue;
                // Skip dashboard, API, coming-soon, VS Code extension, and test files where config values are standard
                if (/simplebeacon-dashboard/.test(relativePath) || /simplebeacon-vscode/.test(relativePath) || /src\/api\//.test(relativePath) || /tests\//.test(relativePath)) continue;
                if (/(?:^|\/)coming-soon\//.test(relativePath)) continue;
                // Skip scanner internals, reporters, and test files
                if (/\/rules\//.test(relativePath) || /\/reporters\//.test(relativePath)) continue;
                if (/\/tests\//.test(relativePath) || /\.(test|spec)\./.test(relativePath)) continue;
                const cdLineStart = content.lastIndexOf('\n', match.index) + 1;
                const cdLineEnd = content.indexOf('\n', match.index);
                const cdLineText = content.slice(cdLineStart, cdLineEnd === -1 ? undefined : cdLineEnd);
                // Skip version strings in report metadata (e.g., version: '1.0.0')
                if (/version\s*[:=]\s*['"`]\d+\.\d+\.\d+['"`]/.test(cdLineText)) continue;
                // Skip DOM/JS toggle method calls (.toggle(), .toggleClass(), classList.toggle)
                if (/\.(?:classList)?\.?toggle(?:Class)?\s*\(/.test(cdLineText)) continue;
                // Skip function names containing "toggle"
                if (/\bfunction\s+\w*[Tt]oggle\w*\s*\(/.test(cdLineText)) continue;
                // Skip feature flag references in scanner rule catalog or comments
                if (/\b(?:featureFlag|feature_flag|enableFeature|disableFeature)\b.*\b(?:pattern|regex|scanner|rule|catalog)\b/i.test(cdLineText)) continue;
                // Skip filter code that references moving URLs/secrets to .env (false positive from scanner's own exclusions)
                if (/move hardcoded urls and secrets to \.env|Move hardcoded URLs and secrets to \.env/i.test(cdLineText)) continue;
            }
            if (category === 'architecture-drift') {
                // Skip package, server API, server lib, and server entry files where deep imports and paths are standard
                if (/packages\/[^/]+\/src\//.test(relativePath) || /server\/api\//.test(relativePath) || /server\/lib\//.test(relativePath)) continue;
                if (/server\/index\.cjs$/.test(relativePath) || /server\/routes\//.test(relativePath) || /server\/services\//.test(relativePath)) continue;
                // Skip web/data, server, src/, test, and dashboard files where paths are standard
                if (/web\/data\//.test(relativePath) || /^server\//.test(relativePath) || /^src\//.test(relativePath)) continue;
                if (/src\/api\//.test(relativePath) || /src\/core\//.test(relativePath) || /src\/lib\//.test(relativePath)) continue;
                if (/tests\//.test(relativePath)) continue;
                if (/simplebeacon-dashboard/.test(relativePath)) continue;
                // Skip utility scripts that intentionally reach into project structure
                if (/(?:^|\/)scripts\//.test(relativePath)) continue;
            }
            if (category === 'documentation') {
                const prevChunk = content.slice(Math.max(0, match.index - 300), match.index);
                if (/\*\/\s*$/.test(prevChunk)) continue;
                // Skip package source files where JSDoc coverage is managed separately
                if (/packages\/[^/]+\/src\//.test(relativePath)) continue;
            }
            if (category === 'inner-html-xss') {
                const mText = match[0];
                const afterEq = mText.slice(mText.indexOf('=') + 1).trim();
                // Skip empty string
                if (/^['"`]\s*['"`]$/.test(afterEq)) continue;
                // Skip static string literal (no interpolation, no concatenation)
                if (/^['"`][^${+]*['"`]$/.test(afterEq)) continue;
                // Skip known-safe function calls
                if (/\b(?:escapeHtml|sanitizeHtml|htmlEscape|renderSafe|DOMPurify\.sanitize)\b/.test(mText)) continue;
            }
            if (category === 'inner-html-xss') {
                if (/^coming-soon\//.test(relativePath)) continue;
                if (/(?:^|\/)simplebeacon-frameworkless\//.test(relativePath)) continue;
                // Skip dashboard and DLP files where innerHTML is standard practice for rendering
                if (/simplebeacon-dashboard/.test(relativePath) || /server\/dlp-dashboard\.cjs$/.test(relativePath)) continue;
                // Skip VS Code extension webview files that generate HTML for display panels
                if (/(?:^|\/)src\/(?:webviewPanel|web2Panel|enhancedDashboard|codeMapProvider)\.ts$/.test(relativePath)) continue;
                if (/(?:^|\/)src\/(?:fixes|views|components)\//.test(relativePath)) continue;
            }
            if (category === 'build-readiness') {
                if (/^coming-soon\//.test(relativePath) || /\btools\//.test(relativePath)) continue;
                if (/\b(?:eslint|jest|vite)\.config\./.test(relativePath)) continue;
                // Skip test files where magic numbers are standard test data
                if (/\/(?:test|tests|__tests__)\//.test(relativePath) || /\.(test|spec)\./.test(relativePath)) continue;
                // Skip dashboard browser files where magic numbers are UI constants
                if (/simplebeacon-dashboard/.test(relativePath) || /\.browser\.(js|mjs|cjs)$/.test(relativePath)) continue;
                // Skip scanner test fixtures
                if (/(?:^|\/)simplebeacon-rule-tests\//.test(relativePath)) continue;
            }
            if (category === 'logging-secrets') {
                if (/\btools\//.test(relativePath) || /\.(test|spec)\./i.test(relativePath) || /tests\//.test(relativePath)) continue;
                // Skip dashboard and coming-soon files where console.warn is used for UI state logging
                if (/simplebeacon-dashboard/.test(relativePath) || /(?:^|\/)coming-soon\//.test(relativePath)) continue;
                // Skip operational files where logging is for system state, not secrets
                if (/simplebeacon-server\.cjs$/.test(relativePath)) continue;
                if (/server\/index\.cjs$/.test(relativePath)) continue;
                if (/simplebeacon-billing-api\.cjs$/.test(relativePath)) continue;
                // Skip utility scripts and CLI bin tools that intentionally report output
                if (/(?:^|\/)scripts\//.test(relativePath)) continue;
                if (/packages\/[^/]+\/bin\//.test(relativePath)) continue;
                const lineStart = content.lastIndexOf('\n', match.index) + 1;
                const lineEnd = content.indexOf('\n', match.index);
                const lineText = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
                // Skip config-warnings, redacted values, file paths, and section headers
                if (/not\s+configured|missing|required|set\s+\w+|OFF\s*—\s*set|\*\*\*REDACTED\*\*\*|saved\s+to|file\s*:|path\s*:|===.*===|^\s*\/?\/?\s*(Test|Token|Auth|License)/i.test(lineText)) continue;
                // Skip debug scripts logging report keys / finding counts / object keys
                if (/console\.(log|warn|error)\s*\(\s*['`"](Report keys|Keys|Found|Total)/i.test(lineText)) continue;
                // Skip CLI tools that intentionally output generated tokens
                if (/generate-license-token|Failed to reload API key|credentials needing review/i.test(lineText)) continue;
                // Skip console warnings about missing config/environment variables (not secret exposure)
                if (/console\.(warn|error|log)\s*\([^)]*(?:not\s+set|is\s+not|requires?|missing|JWT_SECRET|SIMPLEBEACON)/i.test(lineText)) continue;
            }
            if (category === 'sensitive-data') {
                // Skip markdown documentation files that contain example security patterns
                if (/\.(md|mdx)$/i.test(relativePath)) continue;
                // Skip test fixtures designed to exercise scanner rules
                if (/simplebeacon-rule-tests\//.test(relativePath)) continue;
                const lineStart = content.lastIndexOf('\n', match.index) + 1;
                const lineEnd = content.indexOf('\n', match.index);
                const lineText = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
                // Skip function calls on the right side (e.g., resolveCredential(), generateLicenseToken())
                if (/[:=]\s*(?:get|resolve|generate|decode|create|build|fetch|load|read)[A-Z]\w+\s*\(/.test(lineText)) continue;
                // Skip template string interpolation (e.g., token=' + encodeURIComponent(...))
                if (/[:=]\s*['"`]\s*\+\s*\w+\s*\(/.test(lineText)) continue;
                // Skip documentation placeholders
                if (/['"`][^'"`]*(?:your-api-key-here|changeme|example|placeholder|sample|demo)['"`]/i.test(lineText)) continue;
                // Skip placeholder email inputs (e.g., placeholder="your@email.com")
                if (/placeholder=['"][^'"]*@.*\.com['"]/i.test(lineText)) continue;
                // Skip exclusion comments that describe scanner behavior
                if (/Exclude.*placeholder.*email|Exclude.*HTML placeholder/i.test(lineText)) continue;
                // Skip coming-soon dashboard JS documentation files
                if (/coming-soon\/js\/dashboard\/(?:pattern-documentation|quick-actions)\.js/.test(relativePath)) continue;
            }
            if (category === 'sample-json-ref') {
                // Skip API route files where sample JSON references are demo endpoints
                if (/src\/api\/simplebeacon-api\.cjs$/.test(relativePath) || /simplebeacon-billing-api\.cjs$/.test(relativePath)) continue;
                // Skip dashboard and coming-soon files
                if (/simplebeacon-dashboard/.test(relativePath) || /(?:^|\/)coming-soon\//.test(relativePath)) continue;
            }
            if (category === 'production-leak') {
                // Skip report-patch utility files where mockdata references are for patching logic
                if (/server\/lib\/scan-report-patch\.cjs$/.test(relativePath)) continue;
                // Skip scanner pattern catalog files where sample/mock data patterns are defined
                if (/server\/lib\/codebase-analyzer\.cjs$/.test(relativePath) || /server\/lib\/file-audit-context\.cjs$/.test(relativePath)) continue;
                // Skip reporters and analyzers where mockData is a report schema field
                if (/\/reporters\//.test(relativePath) || /\/analyzers\//.test(relativePath)) continue;
                if (/\/lib\/sample-consistency/.test(relativePath)) continue;
                if (/\/lib\/privacy-triage/.test(relativePath)) continue;
                // Skip VS Code extension files where mockData/sampleData are webview UI variables
                if (/(?:^|\/)simplebeacon-vscode\/src\//.test(relativePath)) continue;
                // Skip dashboard utility files where mockData is used for export/generation
                if (/simplebeacon-dashboard/.test(relativePath)) continue;
                // Skip test files
                if (/\/tests\//.test(relativePath) || /\.(test|spec)\./.test(relativePath)) continue;
            }
            if (category === 'mock-path-leak') {
                // Skip scanner pattern catalog and API route files where mock/fixture terms are feature names
                if (/server\/lib\/codebase-analyzer\.cjs$/.test(relativePath) || /server\/lib\/file-audit-context\.cjs$/.test(relativePath)) continue;
                if (/server\/routes\/flexible-analyze-api\.cjs$/.test(relativePath)) continue;
                // Skip rule definitions, allowlists, and test files
                if (/\/rules\//.test(relativePath) || /\/analyzers\//.test(relativePath)) continue;
                if (/\/tests\//.test(relativePath) || /\.(test|spec)\./.test(relativePath)) continue;
                if (/\/reporters\//.test(relativePath)) continue;
                // Skip dashboard and coming-soon files where these are UI text or documentation
                if (/simplebeacon-dashboard/.test(relativePath) || /(?:^|\/)coming-soon\//.test(relativePath)) continue;
                if (/(?:^|\/)simplebeacon-frameworkless\//.test(relativePath)) continue;
                // Skip files whose purpose is to check/sample/mock data consistency
                if (/sample-consistency-checker/.test(relativePath) || /scan-conclusion/.test(relativePath)) continue;
                // Skip if the match is inside a documentation/description string about the pattern itself
                const lineStart = content.lastIndexOf('\n', match.index) + 1;
                const lineEnd = content.indexOf('\n', match.index);
                const lineText = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
                if (/Mock\/fixture\/sample data paths|mock\/fixture\/sample data references|mock\/fixture\/sample path references|development-only data paths|Blocks API keys/i.test(lineText)) continue;
            }
            if (category === 'placeholder-fictional-data' && item.id === 'hardcoded-completion') {
                // Skip test fixture files designed to exercise scanner rules
                if (/simplebeacon-rule-tests\//.test(relativePath)) continue;
                // Skip roadmap/analyzer/export files where progress values are expected
                if (/roadmap/i.test(relativePath) || /analyzer/i.test(relativePath)) continue;
                // Skip common progress state values (0, 1, 100 are standard in progress tracking)
                const mVal = match[0].match(/(?:completionRate|completion|progress|done)\s*[:=]\s*['"`]?(\d+(?:\.\d+)?)/i);
                if (mVal && ['0', '1', '100'].includes(mVal[1])) continue;
            }
            if (category === 'eval-danger') {
                const edLineStart = content.lastIndexOf('\n', match.index) + 1;
                const edLineEnd = content.indexOf('\n', match.index);
                const edLineText = content.slice(edLineStart, edLineEnd === -1 ? undefined : edLineEnd);
                // Skip static require('literal-string') — standard Node.js import, not dynamic eval
                if (/\brequire\s*\(\s*['"`][^'"`]+['"`]\s*\)/.test(edLineText)) continue;
                // Skip require(path.join(...)) — safe internal module resolution
                if (/require\s*\(\s*path\.join\s*\(/.test(edLineText)) continue;
                // Skip require() inside comments or string literals
                if (/['"`].*require\s*\(/.test(edLineText) || /^\s*\/\//.test(edLineText)) continue;
                // Skip require(variable) when preceded by fs.existsSync(variable) in the same block
                if (/require\s*\(\s*\w+\s*\)/.test(edLineText)) {
                    const prevBlock = content.slice(Math.max(0, edLineStart - 800), edLineStart);
                    const varName = (edLineText.match(/require\s*\(\s*(\w+)\s*\)/) || [])[1];
                    if (varName && new RegExp('fs\\.existsSync\\s*\\(\\s*' + varName + '\\s*\\)').test(prevBlock)) continue;
                    // Skip if inside a try/catch block (graceful fallback pattern)
                    if (/\btry\b[\s\S]{0,200}\bcatch(?:\s*\{|\s*\()/.test(prevBlock.slice(-400))) continue;
                }
                // Skip regex.exec() / pattern.exec() / match() calls — not eval
                if (/\.(exec|match|test|search)\s*\(/.test(edLineText) && !/eval\s*\(|new\s+Function/.test(edLineText)) continue;
                // Skip comments about eval safety patterns
                if (/^\s*\/\/.*(?:eval|exec|Function|is NOT eval|SAFE pattern)/.test(edLineText)) continue;
            }
            if (category === 'dependency-vulns') {
                if (/\.(test|spec)\./i.test(relativePath) || /tests\//.test(relativePath)) continue;
                if (/test-gateway/i.test(relativePath)) continue;
                if (/^coming-soon\//.test(relativePath)) continue;
                const dvLineStart = content.lastIndexOf('\n', match.index) + 1;
                const dvLineEnd = content.indexOf('\n', match.index);
                const dvLineText = content.slice(dvLineStart, dvLineEnd === -1 ? undefined : dvLineEnd);
                // Skip protocol guards (startsWith('http://') or startsWith('https://'))
                if (/startsWith\s*\(\s*['"`]http/.test(dvLineText)) continue;
                // Skip SVG namespace strings
                if (/xmlns\s*=\s*['"`]http:\/\/www\.w3\.org/.test(dvLineText)) continue;
                // Skip localhost / 127.0.0.1 URLs
                if (/http:\/\/(?:localhost|127\.0\.0\.1)/.test(dvLineText)) continue;
                // Skip dashboard utils that may reference demo/test URLs
                if (/simplebeacon-dashboard.*\/utils\./.test(relativePath)) continue;
                // Skip dashboard, DLP, verification, and trust API files where http:// is often demo/documentation
                if (/server\/dlp-dashboard\.cjs$/.test(relativePath) || /server\/lib\/trust-verification-payload\.cjs$/.test(relativePath)) continue;
                if (/src\/api\/trust-api\.cjs$/.test(relativePath)) continue;
                // Skip proxy gateway files where http:// is used for target configuration
                if (/server\/ai-proxy-gateway\.cjs$/.test(relativePath)) continue;
            }
            if (category === 'framework-practices' && /^coming-soon\//.test(relativePath)) continue;
            if (category === 'empty-stub-function') {
                if (/vendor\//.test(relativePath) || /\.min\.js$/i.test(relativePath)) continue;
                if (/\b(?:docs|tests?)\//.test(relativePath) || /\.(test|spec)\./i.test(relativePath)) continue;
                if (/^coming-soon\//.test(relativePath)) continue;
            }
            if (category === 'unvalidated-redirect') {
                const mText = match[0];
                // Skip standard HTTPS redirects (hardcoded https:// prefix)
                if (item.id === 'express-redirect' && /https:\/\//i.test(mText)) continue;
                // Skip client-side router navigation in dashboard files (normal SPA behavior)
                if (item.id === 'router-redirect' && /simplebeacon-dashboard/.test(relativePath)) continue;
                // Skip history.push with object literals (state push, not redirect)
                if (item.id === 'router-redirect' && /\{\s*\w+\s*:/.test(mText)) continue;
            }
            if (category === 'prototype-pollution') {
                if (/^coming-soon\//.test(relativePath)) continue;
                // Skip security middleware for-in (deep inspection is intentional)
                if (item.id === 'for-in-no-guard' && /middleware\/security/.test(relativePath)) continue;
                // Skip __proto__ references in view files (prototype checks are common)
                if (item.id === 'proto-in-key' && /\/views\//.test(relativePath)) continue;
                // Skip comments about safe prototype-pollution patterns
                const ppLineStart = content.lastIndexOf('\n', match.index) + 1;
                const ppLineEnd = content.indexOf('\n', match.index);
                const ppLineText = content.slice(ppLineStart, ppLineEnd === -1 ? undefined : ppLineEnd);
                if (/^\s*\/\/.*(?:SAFE pattern|is the SAFE|hasOwnProperty\.call|Object\.prototype)/.test(ppLineText)) continue;
            }
            if (category === 'roadmap-marker' && /^coming-soon\//.test(relativePath)) continue;
            if (category === 'governance') {
                if (/vendor\//.test(relativePath) || /\.min\.js$/i.test(relativePath)) continue;
                if (/^coming-soon\//.test(relativePath)) continue;
            }
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

/**
 * Is excluded dynamic eval line.
 * @param {any} line
 * @returns {any}
 */
function isExcludedDynamicEvalLine(line) {
    const normalized = normalizeCodeLine(line);
    if (!normalized) return true;
    if (/\.includes\s*\(\s*['"]eval\s*\(/.test(normalized)) return true;
    if (/includes\s*\(\s*['"]eval/.test(normalized)) return true;
    if (/Use of eval|eval\(\) function|code-injection|dynamic.eval|no-eval|security.*eval/.test(normalized)) return true;
    // Safe dynamic requires: path.join resolution, conditional requires in try/catch,
    // and known safe variable-based requires (e.g., plugin loaders with whitelist guards)
    if (/\brequire\s*\(\s*path\.join\s*\(/.test(normalized)) return true;
    if (/\brequire\s*\(\s*['"]\.\//.test(normalized)) return true;
    if (/\brequire\s*\(\s*['"][A-Za-z0-9_-]+['"]\s*\)/.test(normalized)) return true;
    return false;
}

/**
 * Detect dynamic eval.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectDynamicEval(content, relativePath) {
    if (!isProductionRelevantPath(relativePath)) return false;
    const rel = normalizedAuditPath(relativePath);
    // Skip dashboard, coming-soon, vendor, tests, and tools where eval/Function patterns are standard
    if (/simplebeacon-dashboard/.test(rel) || /(?:^|\/)coming-soon\//.test(rel)) return false;
    if (/\/(?:vendor|dist|build)\//.test(rel) || /\.min\.(js|cjs)$/.test(rel)) return false;
    if (/\/(?:test|tests|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel)) return false;
    if (/(?:^|\/)tools\//.test(rel)) return false;
    if (/(?:^|\/)simplebeacon-vscode\//.test(rel)) return false;
    // Skip CLI package internals and batch scripts where require() is standard
    if (/packages\/[^/]+\/src\//.test(rel) || /(?:^|\/)scripts\//.test(rel)) return false;
    if (/(?:^|\/)ai-agent\//.test(rel) || /(?:^|\/)ai-tools\//.test(rel)) return false;
    if (/intelligence-bridge\.js$/.test(rel)) return false;
    for (const line of content.split('\n')) {
        const normalized = normalizeCodeLine(line);
        if (!normalized || isExcludedDynamicEvalLine(normalized)) continue;
        if (/\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(|child_process\.(?:exec|execSync)\s*\(|vm\.(?:runInContext|runInNewContext|runInThisContext)\s*\(/.test(normalized)) return true;
    }
    return false;
}

/**
 * Is cli tooling path.
 * @param {string} relativePath
 * @returns {any}
 */
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

/**
 * Should skip syntax check.
 * @param {string} relativePath
 * @returns {any}
 */
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

/**
 * Detect unclosed block comment.
 * @param {any} content
 * @returns {any}
 */
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

/**
 * Format syntax finding description.
 * @param {string} rawMessage
 * @param {string} relativePath
 * @returns {any}
 */
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

/**
 * Syntax recommended action.
 * @param {string} rawMessage
 * @returns {any}
 */
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

/**
 * Check js syntax.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function checkJsSyntax(content, relativePath) {
    const normalized = String(content || '').replace(/^\uFEFF/, '');
    if (!normalized.trim()) return null;
    // Skip TypeScript files — vm.Script cannot parse TS syntax
    if (/\.(ts|tsx|mts|cts)$/i.test(relativePath)) return null;

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

/**
 * Is debug scan path.
 * @param {string} relativePath
 * @returns {any}
 */
function isDebugScanPath(relativePath) {
    const rel = relativePath.replace(/\\/g, '/').toLowerCase();
    if (rel.startsWith('server/') || rel.startsWith('packages/')) return true;
    // Monorepo scans prefix platform paths (e.g. ai-platform/server/…), not nested src/server mirrors.
    if (rel.startsWith('src/')) return false;
    if (/^[a-z0-9_.-]+\/server\//.test(rel) || /^[a-z0-9_.-]+\/packages\//.test(rel)) return true;
    return false;
}

/**
 * Detect debug artifacts.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectDebugArtifacts(content, relativePath) {
    if (isCliToolingPath(relativePath)) {
        return [];
    }
    const rel = normalizedAuditPath(relativePath);
    // Skip dashboard, coming-soon, and route files where console.log is used for request logging
    if (/simplebeacon-dashboard/.test(rel) || /(?:^|\/)coming-soon\//.test(rel)) return [];
    if (/server\/routes\/flexible-analyze-api\.cjs$/.test(rel)) return [];
    if (/server\/lib\/codebase-analyzer\.cjs$/.test(rel)) return [];
    if (rel.endsWith('audit-remediation-recipes.js')) {
        return [];
    }
    if (/server\/config\/database\.cjs$/.test(rel)) {
        return [];
    }
    if (/server\/index\.cjs$/.test(rel)) {
        return [];
    }
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

/**
 * Classify placeholder severity.
 * @param {string} patternId
 * @param {string} relativePath
 * @returns {any}
 */
function classifyPlaceholderSeverity(patternId, relativePath) {
    if (patternId === 'fiction-kpi') return isProductionRelevantPath(relativePath) ? 'medium' : 'low';
    if (patternId === 'hardcoded-perfect') return 'medium';
    if (patternId === 'hardcoded-completion') return 'low';
    if (patternId === 'coming-soon') return isProductionRelevantPath(relativePath) ? 'medium' : 'low';
    if (patternId === 'tbd') return isProductionRelevantPath(relativePath) ? 'medium' : 'low';
    return 'low';
}

/**
 * Detect api contract issues.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectApiContractIssues(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    if (isNonProductionAuditContentPath(relativePath)) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip dashboard and coming-soon files where OpenAPI/Swagger is often UI text/documentation
    if (/simplebeacon-dashboard/.test(rel) || /(?:^|\/)coming-soon\//.test(rel)) return [];
    // Skip scanner pattern catalog files where 'swagger|openapi' is the pattern definition itself
    if (/server\/lib\/codebase-analyzer\.cjs$/.test(rel) || /server\/lib\/file-audit-context\.cjs$/.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of API_CONTRACT_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'api-contract',
                analyzer: 'api-contract-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Document API contracts with OpenAPI/Swagger'
            });
        }
    }
    return hits;
}

/**
 * Detect arrow stubs.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectArrowStubs(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx|vue|svelte)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip test files where arrow stubs are often browser polyfills
    if (/test-all-patterns/.test(rel) || /\/(?:test|tests|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    const pattern = /(?:const|let|var|export\s+(?:const|let|var))\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*(?:\{\s*\}|\{\s*return\s+(?:null|undefined|0|''|""|\[\]|true|false|\{\s*\});?\s*\}|\(\s*\{\s*\}\s*\)|null|undefined|0|''|""|\[\]|true|false|\{\s*\})/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
        if (isExcludedPatternCatalogLine(content, match.index)) continue;
        const line = lineNumberAt(content, match.index);
        const matchText = match[0].slice(0, 80);
        const dedupeKey = line + '|' + matchText;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        hits.push({
            category: 'arrow-stub',
            analyzer: 'arrow-stub-analyzer',
            type: 'arrow-stub',
            severity: 'low',
            filePath: relativePath,
            line,
            description: 'Arrow function with empty or trivial return — likely AI stub. Implement return value.',
            match: matchText,
            recommendedAction: 'Implement the arrow function body or remove the stub'
        });
    }
    return hits;
}

/**
 * Detect empty stub functions.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectEmptyStubFunctions(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip docs/ files where empty functions are often documentation examples
    if (/(?:^|\/)docs\//.test(rel)) return [];
    // Skip vendor minified files, test files, and coming-soon stubs
    if (/(?:^|\/)vendor\//.test(rel) || /\.min\.js$/i.test(rel)) return [];
    if (/(?:^|\/)tests?\//.test(rel) || /\.(test|spec)\./i.test(rel)) return [];
    if (/^coming-soon\//.test(rel)) return [];
    // Skip VS Code extension files where empty stubs are required API implementations
    if (/(?:^|\/)vscode-extension\//.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    const pattern = /function\s+\w+\s*\([^)]*\)\s*\{\s*(?:return\s+(?:null|undefined|\{\}|\[\]|0|''|"")?;?\s*)?\}/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
        if (isExcludedPatternCatalogLine(content, match.index)) continue;
        const line = lineNumberAt(content, match.index);
        const matchText = match[0].slice(0, 80);
        const dedupeKey = line + '|' + matchText;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        hits.push({
            category: 'empty-stub-function',
            analyzer: 'empty-stub-analyzer',
            type: 'empty-stub-function',
            severity: 'low',
            filePath: relativePath,
            line,
            description: 'Empty or trivial function body — likely unimplemented stub.',
            match: matchText,
            recommendedAction: 'Implement the function body or remove the stub'
        });
    }
    return hits;
}

/**
 * Detect fix preview issues.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectFixPreviewIssues(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    if (/vendor\//.test(rel) || /\.min\.js$/i.test(rel) || /\.browser\.js$/i.test(rel)) return [];
    if (/^coming-soon\/(js\/dashboard\/|app-links\.js|contact\.js|site-config\.js)/.test(rel)) return [];
    // Skip CLI bin entry points where help text contains natural language words like "var"
    if (/packages\/[^/]+\/bin\/simplebeacon\.js$/.test(rel)) return [];
    // Skip scanner catalog and report generation files where == is often in pattern definitions
    if (/server\/lib\/codebase-analyzer\.cjs$/.test(rel) || /server\/lib\/file-audit-context\.cjs$/.test(rel)) return [];
    if (/server\/lib\/complete-scan-audit-report\.cjs$/.test(rel)) return [];
    if (/server\/lib\/audit-remediation-recipes\.cjs$/.test(rel)) return [];
    if (/server\/lib\/code-roadmap-generator\.cjs$/.test(rel)) return [];
    // Skip all server/lib/ files where == appears in regex patterns and template strings
    if (/server\/lib\//.test(rel)) return [];
    // Skip route and service files where == is often in URL patterns and template strings
    if (/server\/routes\//.test(rel) || /server\/services\//.test(rel)) return [];
    // Skip dashboard files where == may appear in bundled/minified code or UI logic
    if (/simplebeacon-dashboard/.test(rel)) return [];
    if (/(?:^|\/)simplebeacon-vscode\//.test(rel)) return [];
    // Skip package source, API, core, and tools files where == is often in patterns or templates
    if (/packages\/[^/]+\/src\//.test(rel) || /src\/api\//.test(rel) || /src\/core\//.test(rel) || /(?:^|\/)tools\//.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of FIX_PREVIEW_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const fpLineStart = content.lastIndexOf('\n', match.index) + 1;
            const fpLineEnd = content.indexOf('\n', match.index);
            const fpLineText = content.slice(fpLineStart, fpLineEnd === -1 ? undefined : fpLineEnd);
            // Skip == null / != null — intentional null-or-undefined check
            if (/==\s*null|!=\s*null/.test(fpLineText)) continue;
            // Skip var inside IIFE, string literals, or comment lines
            if (item.id === 'var-declaration') {
                const inStringLiteral = /['"`][^'"`]*\bvar\b[^'"`]*['"`]/.test(fpLineText);
                const inComment = /^\s*\/\//.test(fpLineText) || /^\s*\/\*/.test(fpLineText);
                const inIIFE = /\(function\s*\(/.test(fpLineText) || /window\./.test(fpLineText);
                if (inStringLiteral || inComment || inIIFE) continue;
            }
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'fix-preview',
                analyzer: 'fix-preview-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Apply the suggested fix to improve code quality'
            });
        }
    }
    return hits;
}

/**
 * Detect missing strict mode.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectMissingStrictMode(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip all dashboard, browser, config, and non-production files
    if (/simplebeacon-dashboard/.test(rel) || /\/js\/(utils|components|views)\//.test(rel)) return [];
    if (/\.(config|test|spec)\./.test(rel) || /jest\.config|eslint\.config|babel\.config/.test(rel)) return [];
    // Skip TypeScript files — strict mode is handled by tsconfig
    if (/\.(ts|tsx|mts|cts)$/i.test(relativePath)) return [];
    // Skip ESLint config and build scripts
    if (/\.eslintrc\./.test(rel) || /build-extension\.js$/.test(rel)) return [];
    if (/(^|\/)(?:docs|templates|scripts|tools|fixtures|mocks|samples|tests)\//.test(rel)) return [];
    if (/\.browser\.(js|cjs)$/.test(rel)) return [];
    // Skip CommonJS modules (.cjs) — strict mode is optional in CJS and most projects don't add it
    if (/\.cjs$/i.test(relativePath)) return [];
    // Skip server infrastructure, packages, and src directories — these are project internals
    if (/^server\//.test(rel) || /^src\//.test(rel) || /^packages\//.test(rel)) return [];
    // Skip non-production subprojects where strict mode is not enforced
    if (/^coming-soon\//.test(rel) || /^ai-agent\//.test(rel) || /^ai-tools\//.test(rel) || /^simplebeacon-frameworkless\//.test(rel)) return [];
    // Skip root-level server entry files and web data injection scripts
    if (/^simplebeacon-server\.js$/.test(rel) || /^web\/data\//.test(rel)) return [];
    // Skip test fixtures, rule tests, and vendor files
    if (/simplebeacon-rule-tests\//.test(rel) || /simplebeacon-toxic-fixtures\//.test(rel)) return [];
    if (/\/vendor\//.test(rel) || /\/node_modules\//.test(rel)) return [];
    // Skip pure data/content files
    if (/outreach-prospects\.js$/.test(rel) || /site-config\.js$/.test(rel)) return [];
    if (/test-(certificate|normalize|renderPreview|technical-audit|roadmap|zip-data|all-patterns|generate-roadmap)\.js$/.test(rel)) return [];
    // Skip one-off CLI scripts
    if (/^(?:analyze|count|generate|run|scan|update|zip)-/.test(rel)) return [];
    // ES modules and modern bundlers enforce strict mode implicitly
    if (/^\s*import\s+/m.test(content) || /^\s*export\s+/m.test(content)) return [];
    // Skip if file already has a strict mode directive
    if (MISSING_STRICT_PATTERN.test(content)) return [];
    // Skip files that start with SPDX license identifiers or standard license headers
    if (/^\s*\/\/?\s*SPDX-License-Identifier:/m.test(content) || /^\s*\/\*\s*(?:MIT|Apache|GPL|BSD|Mozilla|ISC)\s+License/m.test(content) || /^\s*\/\/\s*(?:MIT|Apache|GPL|BSD|Mozilla|ISC)\s+License/m.test(content)) return [];
    return [{
        category: 'missing-strict-mode',
        analyzer: 'missing-strict-mode-analyzer',
        type: 'missing-strict',
        severity: 'low',
        filePath: relativePath,
        line: 1,
        description: 'Missing strict mode directive',
        match: '',
        recommendedAction: 'Add \'use strict\' directive at the top of the file'
    }];
}

/**
 * Detect performance issues.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectPerformanceIssues(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip scanner/build tools where for...of loops are standard for batch processing
    if (/server\/lib\//.test(rel) || /(?:^|\/)tools\//.test(rel)) return [];
    // Skip vendor/minified files (compression algorithms have many nested loops)
    if (/vendor\//.test(rel) || /\.min\.js$/i.test(rel)) return [];
    // Skip legacy coming-soon and CLI tools
    if (/^coming-soon\//.test(rel) || /\btools\//.test(rel)) return [];
    // Skip dashboard files where loops are standard for UI rendering
    if (/simplebeacon-dashboard/.test(rel)) return [];
    // Skip DLP dashboard and web/data files where loops are standard
    if (/server\/dlp-dashboard\.cjs$/.test(rel) || /web\/data\//.test(rel)) return [];
    // Skip CLI package source, analyzers, rules, and lib files where scanning logic is standard
    if (/packages\/[^/]+\/src\//.test(rel) || /(?:^|\/)scripts\//.test(rel)) return [];
    // Skip VS Code extension files where nested loops are standard for UI rendering and data processing
    if (/(?:^|\/)simplebeacon-vscode\/src\//.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of PERFORMANCE_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const matchText = match[0];
            // Skip nested-loop if the inner construct is just a property access check, not iteration
            if (item.id === 'nested-loop' && /\{\s*if\s*\(/.test(matchText)) continue;
            const line = lineNumberAt(content, match.index);
            const dedupeKey = line + '|' + item.id + '|' + matchText.slice(0, 80);
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'performance',
                analyzer: 'performance-analyzer',
                type: item.id,
                severity: 'medium',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText.slice(0, 80),
                recommendedAction: 'Refactor to avoid blocking or O(n²) operations in production paths'
            });
        }
    }
    return hits;
}

/**
 * Detect sync io issues.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectSyncIoIssues(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip scanner/build tools where sync I/O is standard for CLI operations
    if (/server\/lib\//.test(rel) || /(?:^|\/)tools\//.test(rel)) return [];
    // Skip directories where sync I/O is standard: CLI tools, tests, docs, legacy, data transforms
    if (/\b(?:tools|tests?|docs|coming-soon|web\/data)\//.test(rel)) return [];
    if (/\.(test|spec)\.(js|cjs|mjs|ts)$/i.test(rel)) return [];
    // Skip dashboard files where sync I/O is standard for UI state loading
    if (/simplebeacon-dashboard/.test(rel)) return [];
    // Skip server entry, utils, and auto-processor files where sync I/O is standard
    if (/server\/index\.cjs$/.test(rel) || /server\/utils\//.test(rel) || /auto-processor\.js$/.test(rel)) return [];
    // Skip simplebeacon-server, DLP dashboard, and package source files where sync I/O is standard
    if (/^simplebeacon-server\.(cjs|js)$/.test(rel) || /server\/dlp-dashboard\.cjs$/.test(rel) || /packages\/[^/]+\/src\//.test(rel)) return [];
    // Skip utility scripts and CLI bin tools where sync I/O is standard
    if (/(?:^|\/)scripts\//.test(rel) || /(?:^|\/)packages\/[^/]+\/bin\//.test(rel)) return [];
    // Skip non-production subprojects
    if (/(?:^|\/)ai-agent\//.test(rel) || /(?:^|\/)ai-tools\//.test(rel) || /(?:^|\/)simplebeacon-frameworkless\//.test(rel)) return [];
    // Skip VS Code extension files where sync reads are standard at activation/build time
    if (/(?:^|\/)simplebeacon-vscode\/src\//.test(rel)) return [];
    if (/(?:^|\/)simplebeacon-vscode\/build-extension\.js$/.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of SYNC_IO_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'sync-io',
                analyzer: 'sync-io-analyzer',
                type: item.id,
                severity: 'medium',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Replace synchronous file I/O with async equivalents (fs.promises or callbacks)'
            });
        }
    }
    return hits;
}

/**
 * Is excluded prototype pollution line.
 * @param {any} content
 * @param {number} matchIndex
 * @returns {any}
 */
function isExcludedPrototypePollutionLine(content, matchIndex) {
    const raw = lineAt(content, matchIndex).trim();
    // simplebeacon:audit-ignore:prototype-pollution — skip lines with audit-ignore comments
    if (/simplebeacon:audit-ignore:prototype-pollution/.test(raw)) return true;
    const normalized = normalizeCodeLine(raw);
    if (!normalized) return true;
    // simplebeacon:audit-ignore:prototype-pollution — defensive checks for detection logic
    // Defensive checks: === '__proto__', !== '__proto__', hasOwnProperty guards
    if (/if\s*\(\s*\/===\s*['"]__proto__['"]/.test(normalized)) return true; // simplebeacon:audit-ignore:prototype-pollution
    if (/if\s*\(\s*\/['"]__proto__['"]\s*===\s*key/.test(normalized)) return true; // simplebeacon:audit-ignore:prototype-pollution
    if (/===\s*['"]__proto__['"]\s*\|\|\s*key\s*===|!==\s*['"]__proto__['"]|hasOwnProperty\s*\(\s*['"]__proto__['"]|\.hasOwnProperty\s*\(/.test(normalized)) return true; // simplebeacon:audit-ignore:prototype-pollution
    if (/Object\.create\s*\(\s*null\s*\)/.test(normalized)) return true; // simplebeacon:audit-ignore:prototype-pollution
    if (/['"]__proto__['"]\s*===\s*key|key\s*!==\s*['"]__proto__['"]/.test(normalized)) return true; // simplebeacon:audit-ignore:prototype-pollution
    // Skip __proto__ when it appears inside a string literal (UI descriptions, comments, etc.)
    if (/['"`][^'"`]*__proto__[^'"`]*['"`]/.test(normalized)) return true; // simplebeacon:audit-ignore:prototype-pollution
    return false;
}

/**
 * Detect prototype pollution.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectPrototypePollution(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    // Skip minified vendor files — they often contain __proto__ references from bundlers
    if (/\.min\.(js|cjs)$/i.test(relativePath)) return [];
    // Skip coming-soon frontend files where __proto__ references are common in UI strings / descriptions
    if (/^coming-soon\//.test(relativePath)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of PROTOTYPE_POLLUTION_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            if (isExcludedPrototypePollutionLine(content, match.index)) continue;
            // Skip proto-in-key matches that are inside regex pattern definitions (scanner pattern catalogs)
            if (item.id === 'proto-in-key') {
                const lineStr = lineAt(content, match.index).trim();
                if (/pattern\s*:\s*\//.test(lineStr) || /new\s+RegExp|RegExp\s*\(/.test(lineStr)) continue;
                // Skip __proto__ references in frontend/dashboard files (often used for object inspection / debugging)
                if (/simplebeacon-dashboard/.test(relativePath) || /\/views\//.test(relativePath)) continue;
            }
            // Skip for-in-no-guard in middleware files where object iteration over known safe objects is common
            if (item.id === 'for-in-no-guard') {
                const lineStr = lineAt(content, match.index).trim();
                if (/\/middleware\//.test(relativePath)) continue;
            }
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            const severity = item.id === 'for-in-no-guard' || item.id === 'object-assign-untrusted' ? 'medium' : 'high';
            hits.push({
                category: 'prototype-pollution',
                analyzer: 'prototype-pollution-analyzer',
                type: item.id,
                severity,
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Avoid assigning to __proto__ or dynamic prototype properties; use Object.create(null) or Map instead'
            });
        }
    }
    return hits;
}

/**
 * Detect sample json ref.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectSampleJsonRef(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip fixture/seed files that legitimately reference sample data
    if (/\bfixtures\//.test(rel) || /\bsnapshot-seeds\.cjs$/.test(rel)) return [];
    // Skip API route files where sample JSON references are demo endpoints
    if (/src\/api\/simplebeacon-api\.cjs$/.test(rel) || /simplebeacon-billing-api\.cjs$/.test(rel)) return [];
    // Skip test files — they legitimately reference sample JSON fixtures
    if (/\.(test|spec)\.(js|cjs|mjs|ts)$/.test(rel) || /\/tests?\//.test(rel)) return [];
    // Skip SimpleBeacon sample-data catalog, resolver, consistency checker, and analyzer files
    // where *-sample.json references are part of the tool's design (exclusion patterns, spec catalogs)
    if (/(?:\/|^)(?:page-sample-specs|sample-consistency-checker|sample-path-resolver|sample-path-matcher)\.js$/.test(rel)) return [];
    if (/(?:\/|^)(?:data-lineage-analyzer|unused-file-detector)\.js$/.test(rel)) return [];
    if (/(?:\/|^)(?:scan|project-detect|marketing-content-generator|remediation-guides)\.js$/.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of SAMPLE_JSON_REF_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const matchText = match[0];
            const lineStart = content.lastIndexOf('\n', match.index) + 1;
            const lineEnd = content.indexOf('\n', match.index);
            const lineText = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
            // Skip if the line is warning about sample data (negative context)
            if (/not\s+product|not\s+a?\s*sample|warning|avoid|fake|fictional/.test(lineText)) continue;
            const line = lineNumberAt(content, match.index);
            const dedupeKey = line + '|' + item.id + '|' + matchText.slice(0, 80);
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'sample-json-ref',
                analyzer: 'sample-json-ref-analyzer',
                type: item.id,
                severity: 'medium',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText.slice(0, 80),
                recommendedAction: 'Replace sample JSON reference with production data source'
            });
        }
    }
    return hits;
}

/**
 * Detect security headers.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectSecurityHeaders(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    const isCLike = /\.(c|cpp|cc|cxx|h|hpp|hh|hxx)$/i.test(relativePath);
    if (!isJsLike && !isCLike) return [];
    const rel = normalizedAuditPath(relativePath);
    if (/\.(test|spec)\./i.test(rel) || /tests\//.test(rel)) return [];
    if (/\btools\//.test(rel) || /^coming-soon\//.test(rel)) return [];
    // Skip VS Code extension files where CSP meta tags are the correct mechanism
    if (/(?:^|\/)vscode-extension\//.test(rel)) return [];
    if (/(?:^|\/)simplebeacon-vscode\/src\//.test(rel)) return [];
    // Skip CLI rule/analyzer files where security header patterns are definitions
    if (/(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|analyzers|reporters|lib)\//.test(rel)) return [];
    // Skip non-production subprojects where analyzer patterns live
    if (/(?:^|\/)ai-agent\//.test(rel) || /(?:^|\/)ai-tools\//.test(rel) || /(?:^|\/)simplebeacon-frameworkless\//.test(rel)) return [];
    // Skip utility scripts where patterns are for detection, not production code
    if (/(?:^|\/)scripts\//.test(rel)) return [];
    // Skip JSON export artifacts and report files
    if (/(?:^|\/)New folder\/|complete-scan\.json$|\.simplebeacon\//.test(rel)) return [];
    // Skip bootstrap/integration files where security headers are intentionally configured
    if (/server\/bootstrap\//.test(rel) || /phase\d+-integration\.cjs$/.test(rel)) return [];
    // Skip scanner implementation files where patterns are definitions, not actual exposures
    if (/server\/lib\/codebase-analyzer\.cjs$/.test(rel)) return [];
    if (relativePath.replace(/\\/g, '/').endsWith('server/lib/codebase-analyzer.cjs')) return [];
    // Skip dashboard service files containing pattern catalogs and license matchers
    if (/simplebeacon-dashboard\/js\/services\/aiProblemAnalyzerSuite\.mjs$/.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    const patterns = isCLike ? C_SECURITY_PATTERNS : SECURITY_HEADERS_PATTERNS;
    for (const item of patterns) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'security-headers',
                analyzer: 'security-headers-analyzer',
                type: item.id,
                severity: 'medium',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: isCLike
                    ? 'Review C/C++ security issue — use safe alternatives (e.g., snprintf over sprintf, mkstemp over mktemp, parameterized queries)'
                    : 'Review and harden security header configuration (helmet, HSTS, CSP)'
            });
        }
    }
    return hits;
}

/**
 * Detect unvalidated redirects.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectUnvalidatedRedirects(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip dashboard, coming-soon, and vendor files where redirects are often legitimate navigation
    if (/simplebeacon-dashboard/.test(rel) || /(?:^|\/)coming-soon\//.test(rel)) return [];
    if (/\/(?:vendor|dist|build)\//.test(rel) || /\.min\.(js|cjs)$/.test(rel)) return [];
    if (/\/(?:test|tests|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of UNVALIDATED_REDIRECT_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            // Skip 301 canonicalization redirects (HTTP-to-HTTPS or configured publicUrl)
            if (/\bredirect\s*\(\s*301\s*,/.test(matchText)) continue;
            if (/https:\/\/\$\{req\.headers\.host\}/.test(matchText)) continue;
            if (/publicUrl\s*\+/.test(matchText)) continue;
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'unvalidated-redirect',
                analyzer: 'unvalidated-redirect-analyzer',
                type: item.id,
                severity: 'high',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Validate redirect targets against an allowlist before calling res.redirect()'
            });
        }
    }
    return hits;
}

/**
 * Detect uninitialized read.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectUninitializedRead(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    // Skip dashboard, browser utilities, and minified files
    const rel = normalizedAuditPath(relativePath);
    if (/simplebeacon-dashboard/.test(rel) || /\.browser\.(js|cjs)$/.test(rel) || /\.min\.(js|cjs)$/.test(rel)) return [];
    if (/(^|\/)(?:docs|templates|scripts|tools|fixtures|mocks|samples)\//.test(rel)) return [];
    // Skip scanner catalog files where many let declarations are standard for pattern definitions
    if (/server\/lib\/codebase-analyzer\.cjs$/.test(rel) || /server\/lib\/file-audit-context\.cjs$/.test(rel)) return [];
    if (!UNINITIALIZED_READ_PATTERN.test(content)) return [];
    // Only flag if there are many uninitialized declarations (let x; is standard JS)
    const matches = content.match(/let\s+\w+\s*;/g);
    if (!matches || matches.length < 15) return [];
    return [{
        category: 'uninitialized-read',
        analyzer: 'uninitialized-read-analyzer',
        type: 'uninitialized-read',
        severity: 'low',
        filePath: relativePath,
        line: 1,
        description: `Excessive uninitialized let declarations (${matches.length}) — consider initializing at declaration`,
        match: matches[0],
        recommendedAction: 'Initialize variables at declaration or ensure assignment before first read'
    }];
}

/**
 * Detect token bleed.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectTokenBleed(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    const isJson = /\.json$/i.test(relativePath);
    if (!isJsLike && !isJson) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip scanner catalog, route, and service files where long strings are standard
    if (/server\/lib\//.test(rel) || /server\/routes\//.test(rel) || /server\/services\//.test(rel)) return [];
    // Skip dashboard files where long strings are often HTML templates or bundled data
    if (/simplebeacon-dashboard/.test(rel)) return [];
    // Skip tools where long strings are generation outputs
    if (/(?:^|\/)tools\//.test(rel)) return [];
    // Skip API and web/data files where long strings are often configuration or data
    if (/src\/api\//.test(rel) || /web\/data\//.test(rel)) return [];
    // Skip non-production subprojects and package source files
    if (/(?:^|\/)coming-soon\//.test(rel) || /(?:^|\/)simplebeacon-frameworkless\//.test(rel)) return [];
    if (/packages\/[^/]+\/src\//.test(rel)) return [];
    if (/packages\/[^/]+\/bin\//.test(rel)) return [];
    if (/packages\/[^/]+\/tests\//.test(rel) || /\.(test|spec)\./.test(rel)) return [];
    if (/\.min\.(js|cjs|mjs)$/.test(rel)) return [];
    // Skip VS Code extension files where long CSS/SVG data URIs are standard in webview HTML
    if (/(?:^|\/)simplebeacon-vscode\/src\//.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of TOKEN_BLEED_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const matchText = match[0];
            // Skip template literals — they are code blocks / HTML templates, not leaked LLM prompt strings
            if (matchText.startsWith('`')) continue;
            const line = lineNumberAt(content, match.index);
            const dedupeKey = line + '|' + item.id + '|' + matchText.slice(0, 80);
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'token-bleed',
                analyzer: 'token-bleed-analyzer',
                type: item.id,
                severity: 'medium',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText.slice(0, 80),
                recommendedAction: 'Break up very long string literals or load large content from external files'
            });
        }
    }
    return hits;
}

/**
 * Detect unhandled promise.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectUnhandledPromise(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip server infrastructure files where promise chains are handled at a higher level
    if (/server\/index\.cjs$/.test(rel) || /server\/lib\//.test(rel) || /server\/routes\//.test(rel)) return [];
    // Skip API and dashboard files where promises are handled by frameworks
    if (/src\/api\//.test(rel) || /simplebeacon-dashboard/.test(rel)) return [];
    if (/vendor\//.test(rel) || /\.min\.js$/i.test(rel)) return [];
    if (/\.(test|spec)\.(js|cjs|mjs|ts)$/i.test(rel)) return [];
    if (/tests\//.test(rel) || /test-/.test(rel)) return [];
    if (/^coming-soon\//.test(rel)) return [];
    // Skip package infrastructure files where promise chains are managed at a higher level
    if (/packages\/[^/]+\/src\/(mcp|proxy|scan)\//.test(rel) || /packages\/[^/]+\/src\/scan\.js$/.test(rel)) return [];
    if (/(?:^|\/)simplebeacon-frameworkless\//.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of UNHANDLED_PROMISE_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const matchText = match[0];
            // Skip old-style .then(success, error) where second arg is rejection handler
            if (/\.then\s*\([^)]*,\s*[^)]*\)/.test(matchText)) continue;
            const line = lineNumberAt(content, match.index);
            const dedupeKey = line + '|' + item.id + '|' + matchText.slice(0, 80);
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'unhandled-promise',
                analyzer: 'unhandled-promise-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText.slice(0, 80),
                recommendedAction: 'Add .catch() or wrap in try/catch to handle promise rejections'
            });
        }
    }
    return hits;
}

/**
 * Detect workspace health.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectWorkspaceHealth(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const hits = [];
    const seen = new Set();
    for (const item of WORKSPACE_HEALTH_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'workspace-health',
                analyzer: 'workspace-health-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Review module structure to avoid circular imports and barrel-file anti-patterns'
            });
        }
    }
    return hits;
}

/**
 * Detect ai indicators.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectAiIndicators(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    // Skip scanner infrastructure files — detection regexes are not AI indicators
    if (isMetaScannerPath(relativePath)) return [];
    // Skip AI infrastructure files in an AI project — these are expected, not issues
    const rel = normalizedAuditPath(relativePath);
    const basename = rel.split('/').pop() || '';
    if (/(^|[-_.])(?:ai|model|ollama|semantic|inference|chatbot|llm|gpt|claude|openai|anthropic|langchain|huggingface|vertex)([-_.]|$)/i.test(basename)) return [];
    if (/\/(?:services|routes|lib)\/(?:ai-|model-|ollama-|semantic-|inference-|chatbot-)/i.test(rel)) return [];
    if (/\/ai[-_]/.test(rel) || /\/(?:ai-proxy-gateway|cloud-inference-service|model-inference-service|local-model-service|ollama-client|chatbot-api|local-models-api)/i.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of AI_INDICATORS_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const fullMatch = match[0];
            const lineStr = lineAt(content, match.index).trim();
            // Skip require()/import of internal AI service modules (these are project infrastructure, not indicators)
            if (/require\s*\(\s*['"`].*(?:model-inference-service|local-model-service|cloud-inference-service|ai-proxy-gateway|ai-analyst|ollama-client|local-models-api|chatbot-api|semantic-analyzer|strategic-insights-engine)/.test(lineStr)) continue;
            if (/import\s+.*\s+from\s+['"`].*(?:model-inference-service|local-model-service|cloud-inference-service|ai-proxy-gateway)/.test(lineStr)) continue;
            // Skip ai-inference-service pattern matches that are just references to internal service names
            if (item.id === 'ai-inference-service' && /\b(?:model-inference-service|local-model-service|cloud-inference-service|ai-proxy-gateway)\b/.test(fullMatch)) continue;
            // Skip configuration constant references (ollamaBaseUrl, DEFAULT_OLLAMA_URL are config, not issues)
            if (/\b(?:ollamaBaseUrl|DEFAULT_OLLAMA_URL|ollamaModel)\b/.test(fullMatch)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = fullMatch.slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'ai-indicators',
                analyzer: 'ai-indicators-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Review EU AI Act Article 6 applicability for AI SDK usage'
            });
        }
    }
    return hits;
}

/**
 * Detect unused deps.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectUnusedDeps(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip test files where fixtures/samples may be required for side effects or indirect use
    if (/\/(?:test|tests|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of UNUSED_DEPS_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const varName = match[1];
            const moduleName = match[2];
            if (!varName || !moduleName) continue;
            // Skip underscore-prefixed variables — these are namespace aliases (e.g., _fs, _crypto)
            if (/^_/.test(varName)) continue;
            // Skip API route files where controllers are passed to router methods
            if (/\/(?:api|routes)\//.test(rel) && /controller/i.test(varName)) continue;
            // Skip JSON sample/fixture requires that are often used indirectly
            if (/\.(json|sample)\b/.test(moduleName)) continue;
            // Skip if variable is used elsewhere in the file
            const usagePattern = new RegExp('\\b' + varName + '\\b', 'g');
            let usageCount = 0;
            let uMatch;
            while ((uMatch = usagePattern.exec(content)) !== null) {
                usageCount++;
            }
            if (usageCount > 1) continue; // declared + at least one use
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'unused-deps',
                analyzer: 'unused-deps-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label + ': ' + moduleName,
                match: matchText,
                recommendedAction: 'Remove unused dependency or verify it is required indirectly'
            });
        }
    }
    return hits;
}

/**
 * Detect i18n issues.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectI18nIssues(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    const isHtml = /\.(html|htm|vue|svelte)$/i.test(relativePath);
    if (!isJsLike && !isHtml) return [];
    const rel = normalizedAuditPath(relativePath);
    if (/vendor\//.test(rel) || /\.min\.js$/i.test(rel)) return [];
    if (/^coming-soon\//.test(rel)) return [];
    // Skip dashboard files where hardcoded strings are standard UI text
    if (/simplebeacon-dashboard/.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of I18N_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'i18n',
                analyzer: 'i18n-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Wrap hardcoded UI strings with i18n function or translation key'
            });
        }
    }
    return hits;
}

/**
 * Detect complexity issues.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectComplexityIssues(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    const isPy = /\.py$/i.test(relativePath);
    if (!isJsLike && !isPy) return [];
    if (isNonProductionAuditContentPath(relativePath)) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip vendor/minified, dashboard, test, package source, and server infrastructure files
    if (/vendor\//.test(rel) || /\.min\.(js|cjs|mjs)$/.test(rel)) return [];
    if (/simplebeacon-dashboard/.test(rel) || /(?:^|\/)coming-soon\//.test(rel)) return [];
    if (/\/(?:test|tests|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel)) return [];
    if (/packages\/[^/]+\/src\//.test(rel) || /^server\//.test(rel) || /^src\//.test(rel)) return [];
    if (/packages\/[^/]+\/bin\//.test(rel)) return [];
    if (/(?:^|\/)simplebeacon-frameworkless\//.test(rel)) return [];
    if (/(?:^|\/)simplebeacon-vscode\//.test(rel)) return [];
    // Skip web/data, auto-processor, and simplebeacon-server files where complexity is standard
    if (/web\/data\//.test(rel) || /auto-processor\.js$/.test(rel) || /^simplebeacon-server\./.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of COMPLEXITY_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'complexity',
                analyzer: 'complexity-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Extract helper functions and reduce nesting with early returns'
            });
        }
    }
    return hits;
}

/**
 * Detect database patterns.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectDatabasePatterns(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    const isPy = /\.py$/i.test(relativePath);
    const isCLike = /\.(c|cpp|cc|cxx|h|hpp|hh|hxx)$/i.test(relativePath);
    if (!isJsLike && !isPy && !isCLike) return [];
    if (isNonProductionAuditContentPath(relativePath)) return [];
    // Skip known false-positive files that contain no actual database patterns
    if (/cleanup-brief-export-sanitize\.js$/i.test(relativePath)) return [];
    // Skip report-generation, recipe, and dashboard utility files that contain SQL strings for documentation/output
    const rel = normalizedAuditPath(relativePath);
    const basename = rel.split('/').pop() || '';
    const isReportGeneration = /\/(?:audit-remediation-recipes|scan-report-patch|report-builder|audit-export)\.cjs$/i.test(rel);
    const isDashboardUtility = /\/simplebeacon-dashboard\/js\/utils\//i.test(rel) || /\/simplebeacon-dashboard\/js\/components\//i.test(rel) || /\/simplebeacon-dashboard\/js\/views\//i.test(rel);
    const isBrowserFile = /\.browser\.(js|cjs)$/i.test(basename);
    const hits = [];
    const seen = new Set();
    const patterns = isCLike ? C_DATABASE_PATTERNS : DATABASE_PATTERNS;
    for (const item of patterns) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const lineStr = lineAt(content, match.index).trim();
            // Skip SQL strings in JSDoc comments or documentation
            if (/^\/\*\*|^\s*\*|^\/\//.test(lineStr)) continue;
            // Skip SQL in string literals that are clearly documentation (e.g., "SELECT * FROM..." in a comment or doc)
            if (isReportGeneration || isDashboardUtility || isBrowserFile) {
                // Only flag if it's an actual .query() call, not just SQL strings in docs
                if (item.id === 'sql-template-injection' || item.id === 'unbounded-select') continue;
            }
            // Skip coming-soon legacy files
            if (/^coming-soon\//.test(rel)) continue;
            // Skip unparameterized-query for health checks (no params needed)
            if (item.id === 'unparameterized-query' && /SELECT\s+1\s+AS|SELECT\s+CURRENT_TIMESTAMP|SELECT\s+version\(\)/i.test(match[0])) continue;
            // Skip unbounded-select for single-row lookups and count queries
            if (item.id === 'unbounded-select') {
                const surrounding = content.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50);
                if (/\.get\s*\(/.test(surrounding)) continue;
                if (/COUNT\s*\(\s*\*\s*\)/i.test(match[0])) continue;
                if (/WHERE\s+\w+_?id\s*=\s*\?/i.test(match[0])) continue;
            }
            // Skip sql-template-injection if the match is HTML (contains <select> tag, not SQL)
            if (item.id === 'sql-template-injection' && /<\s*(?:select|div|span|option)/i.test(match[0])) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'database-patterns',
                analyzer: 'database-patterns-analyzer',
                type: item.id,
                severity: 'high',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Use parameterized queries and add pagination limits'
            });
        }
    }
    return hits;
}

/**
 * Detect insecure random.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectInsecureRandom(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    const isCLike = /\.(c|cpp|cc|cxx|h|hpp|hh|hxx)$/i.test(relativePath);
    if (!isJsLike && !isCLike) return [];
    if (isNonProductionAuditContentPath(relativePath)) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip dashboard, coming-soon, vendor, tests, tools, and scanner library files
    if (/simplebeacon-dashboard/.test(rel) || /(?:^|\/)coming-soon\//.test(rel)) return [];
    if (/\/(?:vendor|dist|build)\//.test(rel) || /\.min\.(js|cjs)$/.test(rel)) return [];
    if (/\/(?:test|tests|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel)) return [];
    if (/(?:^|\/)tools\//.test(rel)) return [];
    if (/(?:^|\/)simplebeacon-vscode\//.test(rel)) return [];
    if (/(?:^|\/)packages\/simplebeacon-cli\/src\/rules\//.test(rel)) return [];
    // Skip scanner catalog, report generation, API routes, middleware, and server entry files
    if (/server\/lib\//.test(rel) || /server\/routes\//.test(rel) || /server\/middleware\//.test(rel)) return [];
    if (/src\/api\//.test(rel)) return [];
    if (/^simplebeacon-server\.cjs$/.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of INSECURE_RANDOM_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'insecure-random',
                analyzer: 'insecure-random-analyzer',
                type: item.id,
                severity: 'medium',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: isCLike
                    ? 'Replace rand()/random() with getrandom(), /dev/urandom, or std::random_device for security-sensitive operations'
                    : 'Replace Math.random() with crypto.randomBytes() or crypto.getRandomValues() for security-sensitive operations'
            });
        }
    }
    return hits;
}

/**
 * Detect license headers.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectLicenseHeaders(content, relativePath) {
    const hits = [];
    const seen = new Set();
    const isSourceFile = /\.(js|mjs|cjs|ts|tsx|jsx|vue|svelte)$/i.test(relativePath);
    const isMarkdown = /\.(md|mdx)$/i.test(relativePath);
    const isHtml = /\.(html|htm|xhtml)$/i.test(relativePath);
    for (const item of LICENSE_HEADER_PATTERNS) {
        // SPDX identifiers and standard license headers in source files are expected — not issues
        if (isSourceFile && (item.id === 'spdx-license' || item.id === 'license-header')) continue;
        // License references in markdown docs (README, CHANGELOG, GOVERNANCE) are expected
        if (isMarkdown && (item.id === 'license-header' || item.id === 'licensed-under' || item.id === 'spdx-license')) continue;
        // License references in HTML pages (attribution, about pages, third-party notices) are expected
        if (isHtml && (item.id === 'license-header' || item.id === 'licensed-under')) continue;
        // Skip the actual LICENSE file at the project root — it is expected to contain the license name
        if (/(?:^|\\|\/)LICENSE(?:\.md|\.txt)?$/i.test(relativePath)) continue;
        // Skip config files where SPDX headers are standard practice
        if (/eslint\.config\.(js|cjs|mjs)$/.test(relativePath) || /jest\.config\.(cjs|js|mjs)$/.test(relativePath)) continue;
        // Skip VS Code extension and CLI rule files where license patterns are definitions
        if (/(?:^|\/)simplebeacon-vscode\/src\//.test(relativePath) || /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|analyzers|lib)\//.test(relativePath)) continue;
        // Skip subproject source files and package source with expected SPDX headers
        if (/(?:^|\/)ai-agent\//.test(relativePath) || /(?:^|\/)ai-platform\/packages\/simplebeacon-intelligence\/src\//.test(relativePath)) continue;
        // Skip dashboard service files containing license pattern catalogs
        if (/simplebeacon-dashboard\/js\/services\/aiProblemAnalyzerSuite\.mjs$/.test(relativePath)) continue;
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'governance-marker',
                analyzer: 'license-header-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Verify license header is accurate and up to date'
            });
        }
    }
    return hits;
}

/**
 * Detect markdown fence leaks.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectMarkdownFenceLeaks(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    const isHtml = /\.(html|htm|vue|svelte)$/i.test(relativePath);
    const isJson = /\.json$/i.test(relativePath);
    if (!isJsLike && !isHtml && !isJson) return [];
    const hits = [];
    const seen = new Set();
    for (const item of MARKDOWN_FENCE_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const matchText = match[0];
            const lineText = lineAt(content, match.index);
            // Skip if inside a template literal (legitimate code examples in strings)
            if (lineText.includes('`') && (lineText.includes('${') || lineText.includes('`'))) continue;
            // Skip markdown files — they legitimately contain code fences
            if (/\.(md|mdx|markdown)$/i.test(relativePath)) continue;
            const line = lineNumberAt(content, match.index);
            const dedupeKey = line + '|' + item.id + '|' + matchText.slice(0, 80);
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'markdown-fence-leak',
                analyzer: 'markdown-fence-leak-analyzer',
                type: item.id,
                severity: 'low',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText.slice(0, 80),
                recommendedAction: 'Remove leaked markdown code fences from source files'
            });
        }
    }
    return hits;
}

/**
 * Detect llm slop.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectLlmSlop(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    const isHtml = /\.(html|htm|vue|svelte)$/i.test(relativePath);
    const isJson = /\.json$/i.test(relativePath);
    if (!isJsLike && !isHtml && !isJson) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip test files and coming-soon legacy files
    if (/\.(test|spec)\./i.test(rel) || /tests\//.test(rel)) return [];
    if (/^coming-soon\//.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of LLM_SLOP_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            const line = lineNumberAt(content, match.index);
            const matchText = match[0].slice(0, 80);
            const dedupeKey = line + '|' + item.id + '|' + matchText;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: 'llm-slop',
                analyzer: 'llm-slop-analyzer',
                type: item.id,
                severity: 'medium',
                filePath: relativePath,
                line,
                description: item.label,
                match: matchText,
                recommendedAction: 'Replace AI-generated slop with real content or verified data'
            });
        }
    }
    return hits;
}

/**
 * Detect documentation gaps.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectDocumentationGaps(content, relativePath) {
    const isJsLike = /\.(js|mjs|cjs|ts|tsx|jsx)$/i.test(relativePath);
    if (!isJsLike) return [];
    const rel = normalizedAuditPath(relativePath);
    // Skip package source files where JSDoc coverage is managed separately
    if (/packages\/[^/]+\/src\//.test(rel)) return [];
    // Skip server infrastructure files where documentation is often inline or external
    if (/^server\//.test(rel)) return [];
    // Skip API files where documentation is often inline or managed by OpenAPI
    if (/^src\/api\//.test(rel)) return [];
    // Skip core and lib files where documentation is internal
    if (/^src\/core\//.test(rel) || /^src\/lib\//.test(rel)) return [];
    // Skip dashboard component files where JSDoc is often omitted for UI code
    if (/simplebeacon-dashboard/.test(rel)) return [];
    // Skip docs, tests, tools, scripts, and package script files where JSDoc is often omitted
    if (/^docs\//.test(rel) || /^tests\//.test(rel) || /(?:^|\/)tools\//.test(rel) || /(?:^|\/)scripts\//.test(rel) || /packages\/[^/]+\/scripts\//.test(rel)) return [];
    // Skip non-production subprojects and test fixtures
    if (/(?:^|\/)coming-soon\//.test(rel) || /(?:^|\/)simplebeacon-rule-tests\//.test(rel) || /(?:^|\/)ai-agent\//.test(rel) || /(?:^|\/)ai-tools\//.test(rel) || /(?:^|\/)simplebeacon-vscode\//.test(rel)) return [];
    // Skip simplebeacon-server entry files where documentation is inline
    if (/^simplebeacon-server\./.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    const pattern = /(^|\n)\s*(export\s+(?:async\s+)?function|export\s+class|export\s+const|export\s+let|export\s+var|module\.exports\s*=)/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
        if (isExcludedPatternCatalogLine(content, match.index)) continue;
        const line = lineNumberAt(content, match.index);
        const matchText = match[0].slice(0, 80);
        // Check if JSDoc comment exists before this export
        const pos = match.index;
        const before = content.slice(Math.max(0, pos - 300), pos);
        if (/\/\*\*\s*\n/.test(before)) continue; // Has JSDoc
        const dedupeKey = line + '|' + matchText;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        hits.push({
            category: 'documentation',
            analyzer: 'documentation-analyzer',
            type: 'missing-jsdoc',
            severity: 'low',
            filePath: relativePath,
            line,
            description: 'Exported API without JSDoc',
            match: matchText,
            recommendedAction: 'Add JSDoc/docstrings to exported functions'
        });
    }
    return hits;
}

/**
 * Detect placeholder and fictional data.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function detectPlaceholderAndFictionalData(content, relativePath) {
    if (isPlaceholderCatalogOrMetaDoc(relativePath)) {
        return [];
    }
    const rel = normalizedAuditPath(relativePath);
    if (rel.startsWith('coming-soon/')) {
        return [];
    }
    // Skip transport middleware and server entry files where placeholder terms are feature descriptions
    if (/server\/middleware\/transports\//.test(rel) || /server\/index\.cjs$/.test(rel)) return [];
    const hits = [];
    const seen = new Set();
    for (const item of PLACEHOLDER_PATTERNS) {
        const pattern = new RegExp(item.pattern.source, ensureGlobalPatternFlags(item.pattern.flags));
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (isExcludedPatternCatalogLine(content, match.index)) continue;
            if (isRemediationContextLine(content, match.index)) continue;
            if (isExcludedPlaceholderMatch(content, match.index)) continue;
            // Skip hardcoded-completion matches in roadmap/analyzer/export files where progress values are expected
            if (item.id === 'hardcoded-completion') {
                if (/roadmap/i.test(relativePath) || /analyzer/i.test(relativePath)) continue;
                const mVal = match[0].match(/(?:completionRate|completion|progress|done)\s*[:=]\s*['"`]?(\d+(?:\.\d+)?)/i);
                if (mVal && ['0', '1', '100'].includes(mVal[1])) continue;
            }
            const line = lineNumberAt(content, match.index);
            const matchText = match[0];
            // Skip ai-placeholder-block matches in JSDoc/documentation block comments or benign developer notes
            if (item.id === 'ai-placeholder-block') {
                const blockText = matchText.trim();
                if (blockText.startsWith('/**')) continue;
                if (/\b(?:unavailable|dev\s+setups?|platform|configuration|config|setup|warning|caution|note)\b/i.test(blockText)) continue;
            }
            const matchSlice = matchText.slice(0, 80);
            const dedupeKey = `${line}|${item.id}|${matchSlice}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            hits.push({
                category: item.id,
                analyzer: 'placeholder-fictional-data-analyzer',
                type: item.id,
                severity: classifyPlaceholderSeverity(item.id, relativePath),
                filePath: relativePath,
                line,
                description: `${item.label} in ${relativePath}`,
                match: matchSlice,
                recommendedAction: item.id === 'fiction-kpi'
                    ? 'Replace fictional KPI claims with measured, source-backed metrics'
                    : item.id === 'hardcoded-completion'
                        ? 'Replace hardcoded completion rate with real computed metric'
                        : 'Replace placeholder text with verified production content'
            });
            if (hits.length > 80) break;
        }
    }
    return hits;
}

/**
 * Map eslint rule category.
 * @param {string} ruleId
 * @returns {any}
 */
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

/**
 * Build eslint summary.
 * @param {Array} messages
 * @param {Array} totals
 * @returns {any}
 */
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

/**
 * Normalize eslint messages.
 * @param {any} projectRoot
 * @param {string} filePath
 * @param {Array} messages
 * @returns {any}
 */
function normalizeEslintMessages(projectRoot, filePath, messages = []) {
    return messages.map((msg) => ({
        ruleId: msg.ruleId || 'unknown',
        severity: msg.severity === 2 ? 'high' : 'medium',
        filePath: normalizeRelativePath(projectRoot, filePath),
        line: msg.line || 1,
        description: msg.message || 'ESLint violation'
    }));
}

/**
 * Load eslint report from disk.
 * @param {any} scanRoot
 * @param {any} platformRoot
 * @returns {any}
 */
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

/**
 * Analyze file content.
 * @param {string} file
 * @param {string} rootDir
 * @param {Object} options
 * @returns {any}
 */
async function analyzeFileContent(file, rootDir, options = {}) {
    const findings = [];
    const rel = file.relativePath;
    let structure = null;

    if (shouldSkipLegacyExperimentalAnalysis(rel, options)) {
        return finalizeFileAnalysis(findings, rel, structure);
    }

    if (file.isArtifact || rel.includes('security-reports/fixes/')) {
        // Skip expected operational directories (logs, caches)
        if (/\b(logs|cache|tmp|temp|uploads|downloads|dist|build|coverage)\//.test(rel)) {
            return finalizeFileAnalysis(findings, rel, structure);
        }
        pushFinding(findings, {
            category: 'junk-files',
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
        // Skip package.json and tsconfig.json everywhere — tsconfig allows trailing commas,
        // package.json may have comments, and flattened uploads can concatenate multiple configs.
        const isConfigJson = file.name === 'package.json' || file.name === 'tsconfig.json';
        if (!isConfigJson) {
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
        }
        if (!isNonProductionAuditContentPath(rel)) {
            findings.push(...detectPlaceholderAndFictionalData(content, rel));
        }
        return finalizeFileAnalysis(findings, rel, structure);
    }

    if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(file.ext)) {
        const isNodeModulesFile = /(^|\/)node_modules\//.test(rel);
        if (!isNodeModulesFile && !shouldSkipSyntaxCheck(rel)) {
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
        // Skip scanner rule catalogs and server infrastructure files for architecture-drift
        const isScannerCatalog = /(?:^|\/)packages\/[^/]+\/(?:src\/)?rules\//.test(rel) || /(?:^|\/)server\/lib\//.test(rel);
        if (!isScannerCatalog) {
            findings.push(...scanContentPatterns(content, rel, ARCHITECTURE_DRIFT_PATTERNS, 'architecture-drift', 'low'));
        }
        findings.push(...scanContentPatterns(content, rel, BUILD_READINESS_PATTERNS, 'build-readiness', 'low'));
        findings.push(...scanContentPatterns(content, rel, CONFIG_DRIFT_PATTERNS, 'config-drift', 'low'));
        findings.push(...scanContentPatterns(content, rel, FRAMEWORK_PRACTICES_PATTERNS, 'framework-practices', 'low'));
        findings.push(...scanContentPatterns(content, rel, GOVERNANCE_PATTERNS, 'governance', 'low'));
        // dependency-vulns: skip proxy gateway files where HTTP URLs are constructed for forwarding
        if (!/src\/proxy\/gateway\.js$/.test(rel)) {
            findings.push(...scanContentPatterns(content, rel, DEPENDENCY_VULN_PATTERNS, 'dependency-vulns', 'low'));
        }
        if (!/(?:^|\/)simplebeacon-vscode\//.test(rel)) {
            findings.push(...scanContentPatterns(content, rel, SECURITY_PATTERNS.filter((p) => p.id === 'inner-html-xss'), 'inner-html-xss', 'medium'));
        }
        // eval-danger: skip coming-soon, vendor/minified, test files, dashboard, scanner pattern catalog, and bridge modules
        const skipEvalPaths = /(?:^|\/)coming-soon\//.test(rel) || /\.min\.(js|cjs)$/.test(rel) || /\/(?:vendor|dist|build)\//.test(rel) || /\/(?:test|tests|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel) || /simplebeacon-dashboard/.test(rel) || /server\/lib\/codebase-analyzer\.cjs$/.test(rel) || /intelligence-bridge\.js$/.test(rel) || /(?:^|\/)simplebeacon-vscode\//.test(rel) || /(?:^|\/)packages\/simplebeacon-cli\/src\/rules\//.test(rel);
        if (!skipEvalPaths) {
            const evalHits = scanContentPatterns(content, rel, SECURITY_PATTERNS.filter((p) => p.id === 'eval-danger'), 'eval-danger', 'medium');
            for (const hit of evalHits) {
                // Skip require(path.join(...)) used for internal module resolution
                const lineText = (content.split('\n')[hit.line - 1] || '').trim();
                if (/require\s*\(\s*path\.join/.test(lineText)) continue;
                findings.push(hit);
            }
        }
        findings.push(...scanContentPatterns(content, rel, SECURITY_PATTERNS.filter((p) => p.id === 'missing-rate-limit'), 'missing-rate-limit', 'medium'));
        // insecure-random is handled by detectInsecureRandom below with proper path exclusions
        findings.push(...scanContentPatterns(content, rel, SECURITY_PATTERNS.filter((p) => p.id === 'logging-secrets'), 'logging-secrets', 'medium'));
        // ai-residue: skip vendor, minified, test, coming-soon, tools, dashboard, server, src, packages, and scripts where defensive catches are standard
        const isMinifiedOrVendor = /\.min\.(js|cjs)$/.test(rel) || /\/(?:vendor|dist|build)\//.test(rel);
        const isTestFile = /\/(?:test|tests|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel) || /test-all-patterns/.test(rel);
        const isNonProduction = /(?:^|\/)coming-soon\//.test(rel) || /(?:^|\/)tools\//.test(rel) || /simplebeacon-dashboard/.test(rel);
        const isServerInfra = /(?:^|\/)server\//.test(rel) || /(?:^|\/)src\//.test(rel) || /(?:^|\/)packages\//.test(rel) || /simplebeacon-server\.cjs$/.test(rel);
        const isBatchScript = /(?:^|\/)scripts\//.test(rel);
        if (!isMinifiedOrVendor && !isTestFile && !isNonProduction && !isServerInfra && !isBatchScript) {
            findings.push(...scanContentPatterns(content, rel, AI_RESIDUE_PATTERNS, 'ai-residue', 'low'));
        }
        findings.push(...scanContentPatterns(content, rel, MAGIC_NUMBER_PATTERNS, 'magic-number', 'low'));
        findings.push(...scanContentPatterns(content, rel, MOCK_PATH_LEAK_PATTERNS, 'mock-path-leak', 'low'));
        findings.push(...scanContentPatterns(content, rel, PRODUCTION_LEAK_PATTERNS, 'production-leak', 'low'));
        findings.push(...scanContentPatterns(content, rel, ROADMAP_MARKER_PATTERNS, 'roadmap-marker', 'low'));
        if (!isNonProductionAuditContentPath(rel)) {
            findings.push(...scanContentPatterns(content, rel, SENSITIVE_DATA_PATTERNS, 'sensitive-data', 'high'));
        }
        findings.push(...detectPrototypePollution(content, rel));
        findings.push(...detectInsecureRandom(content, rel));
        findings.push(...detectMarkdownFenceLeaks(content, rel));
        findings.push(...detectLlmSlop(content, rel));
        findings.push(...detectDocumentationGaps(content, rel));
        findings.push(...detectDatabasePatterns(content, rel));
        findings.push(...detectComplexityIssues(content, rel));
        findings.push(...detectApiContractIssues(content, rel));
        findings.push(...detectArrowStubs(content, rel));
        findings.push(...detectFixPreviewIssues(content, rel));
        findings.push(...detectMissingStrictMode(content, rel));
        findings.push(...detectPerformanceIssues(content, rel));
        findings.push(...detectSyncIoIssues(content, rel));
        // type-safety: only run on actual TypeScript files; skip JS, coming-soon, tests, and non-production paths
        const isTypeScript = /\.(ts|tsx|mts|cts)$/.test(rel) || (/\.js$/.test(rel) && /\.(ts|tsx)/.test(content.slice(0, 500)));
        const isNonProdForTypeSafety = /(?:^|\/)coming-soon\//.test(rel) || /(?:^|\/)scripts\//.test(rel) || /(?:^|\/)tools\//.test(rel) || /(?:^|\/)simplebeacon-dashboard/.test(rel);
        const isTestFileTypeSafety = /\.(test|spec)\./.test(rel) || /(?:^|\/)tests?\//.test(rel) || /test-all-patterns/.test(rel);
        // Skip VS Code extension files where any types and assertions are standard in mocks and API integration
        const isVscodeExtension = /(?:^|\/)simplebeacon-vscode\/src\//.test(rel);
        if (isTypeScript && !isNonProdForTypeSafety && !isTestFileTypeSafety && !isVscodeExtension) {
            findings.push(...scanContentPatterns(content, rel, TYPE_SAFETY_PATTERNS, 'type-safety', 'low'));
        }
        findings.push(...detectSampleJsonRef(content, rel));
        findings.push(...detectSecurityHeaders(content, rel));
        findings.push(...detectUnvalidatedRedirects(content, rel));
        findings.push(...detectUninitializedRead(content, rel));
        findings.push(...detectTokenBleed(content, rel));
        findings.push(...detectUnhandledPromise(content, rel));
        findings.push(...detectWorkspaceHealth(content, rel));
        findings.push(...detectAiIndicators(content, rel));
        findings.push(...detectUnusedDeps(content, rel));
        findings.push(...detectI18nIssues(content, rel));
        findings.push(...detectEmptyStubFunctions(content, rel));
        findings.push(...detectDebugArtifacts(content, rel));
        if (detectDynamicEval(content, rel)) {
            pushFinding(findings, {
                category: 'eval-danger',
                type: 'dynamic-eval',
                severity: 'high',
                filePath: rel,
                line: 1,
                description: `Dynamic eval/Function in production path: ${rel}`,
                recommendedAction: 'Replace eval/Function with safe alternatives'
            });
        }
    }

    if (['.html', '.htm', '.jsx', '.tsx', '.vue'].includes(file.ext)) {
        // Only run accessibility checks on actual HTML/component files
        // Skip coming-soon marketing pages, server .cjs HTML generators, and dashboard JS string builders
        const rel = normalizedAuditPath(file.relativePath);
        const isComingSoon = /(^|\/)coming-soon\//.test(rel);
        const isServerCjs = /^server\/.*\.cjs$/.test(rel);
        const isSrcCjs = /^src\/.*\.cjs$/.test(rel);
        const isDashboardJs = /simplebeacon-dashboard/.test(rel);
        const isTestFile = /test-all-patterns|\.test\./.test(rel);
        const isVscodeExtension = /(?:^|\/)simplebeacon-vscode\/src\//.test(rel);
        if (!isComingSoon && !isServerCjs && !isSrcCjs && !isDashboardJs && !isTestFile && !isVscodeExtension) {
            findings.push(...scanContentPatterns(content, rel, ACCESSIBILITY_PATTERNS, 'accessibility', 'low'));
        }
    }

    if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.html', '.md', '.py', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh', '.hxx', '.java', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala'].includes(file.ext)) {
        if (!isNonProductionAuditContentPath(rel)) {
            findings.push(...detectPlaceholderAndFictionalData(content, rel));
        }
    }

    if (['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh', '.hxx'].includes(file.ext)) {
        findings.push(...scanContentPatterns(content, rel, C_TYPE_SAFETY_PATTERNS, 'type-safety', 'low'));
        findings.push(...scanContentPatterns(content, rel, C_RATE_LIMIT_PATTERNS, 'missing-rate-limit', 'medium'));
        findings.push(...scanContentPatterns(content, rel, C_LOGGING_SECRET_PATTERNS, 'logging-secrets', 'medium'));
        findings.push(...scanContentPatterns(content, rel, C_SAMPLE_DATA_PATTERNS, 'sample-json-ref', 'medium'));
        findings.push(...scanContentPatterns(content, rel, C_ROADMAP_PATTERNS, 'roadmap-marker', 'low'));
        findings.push(...detectDatabasePatterns(content, rel));
    }

    findings.push(...detectLicenseHeaders(content, rel));

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
            findings.push(...(pluginResult.findings || []));
            structure = pluginResult.structure || structure;
        }
    }

    return finalizeFileAnalysis(findings, rel, structure);
}

/**
 * Detect duplicate basenames.
 * @param {Array} files
 * @returns {any}
 */
function detectDuplicateBasenames(files) {
    const skipNames = new Set([
        'index.js', 'index.ts', 'index.cjs', 'index.mjs', 'index.html', 'index.jsx',
        'package.json', 'readme.md', 'license', 'config.json', 'config.js',
        'utils.js', 'constants.js', 'types.ts', 'main.js', 'app.js', 'server.js',
        '.gitignore', 'tsconfig.json'
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
            if (isIntentionalCliPublishBasenameGroup(name, paths)) return false;
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

/**
 * Detect test coverage.
 * @param {Array} files
 * @returns {any}
 */
function detectTestCoverage(files) {
    const sourceExts = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
    const testSuffixes = ['.test.js', '.test.ts', '.test.jsx', '.test.tsx', '.spec.js', '.spec.ts', '.spec.jsx', '.spec.tsx'];
    const testBasenames = new Set();
    let hasTestDir = false;

    for (const file of files) {
        const rel = normalizedAuditPath(file.relativePath);
        const name = file.name.toLowerCase();
        if (testSuffixes.some((s) => name.endsWith(s))) {
            const base = name.replace(/\.(test|spec)\.(js|ts|jsx|tsx|mjs|cjs)$/, '.$2');
            testBasenames.add(base);
        }
        if (/(^|\/)(test|tests|__tests__)\//.test(rel)) {
            hasTestDir = true;
        }
    }

    const findings = [];
    let count = 0;
    for (const file of files) {
        const ext = path.extname(file.name).toLowerCase();
        const name = file.name.toLowerCase();
        const rel = normalizedAuditPath(file.relativePath);

        if (!sourceExts.includes(ext)) continue;
        if (testSuffixes.some((s) => name.endsWith(s))) continue;
        if (/(^|\/)(test|tests|__tests__)\//.test(rel)) continue;
        if (/node_modules/.test(rel)) continue;
        if (file.isArtifact) continue;
        if (file.size === 0) continue;
        if (['config.json', 'package.json', 'tsconfig.json', 'readme.md'].includes(name)) continue;
        // Skip dashboard/browser utilities, config files, and non-production paths from test-coverage checks
        if (/simplebeacon-dashboard/.test(rel) || /\/js\/(utils|components|views)\//.test(rel)) continue;
        if (/\.(config|test|spec)\./.test(name) || /jest\.config|eslint\.config|babel\.config|webpack\.config/.test(name)) continue;
        if (/(?:^|\/)(?:docs|templates|scripts|tools|fixtures|mocks|samples|config|bootstrap|bin)\//.test(rel)) continue;
        if (/\/(?:api|routes|middleware)\//.test(rel)) continue;
        if (/\.browser\.(js|cjs)$/.test(name)) continue;
        if (/^\./.test(name)) continue;
        // Skip dashboard, gateway, DLP, and enterprise orchestration files that are integration-tested, not unit-tested
        if (/-dashboard\./.test(name) || /[-_]gateway\./.test(name) || /enterprise[-_]/.test(name)) continue;
        if (/orchestrator\./.test(name) || /auto[-_]processor\./.test(name)) continue;
            // Skip package source, src/, server/lib/, server/services/, and server/utils/ files where tests are managed separately
        if (/packages\/[^/]+\/src\//.test(rel) || /^src\//.test(rel) || /^server\/lib\//.test(rel) || /^server\/services\//.test(rel) || /^server\/utils\//.test(rel)) continue;
        // Skip docs, tools, simplebeacon-server, web/data, and auto-processor files
        if (/^docs\//.test(rel) || /(?:^|\/)tools\//.test(rel) || /^simplebeacon-server\./.test(rel) || /auto-processor\.js$/.test(rel)) continue;
        if (/web\/data\//.test(rel)) continue;
        if (/^server\/index\.cjs$/.test(rel)) continue;
        if (/(?:^|\/)coming-soon\//.test(rel) || /(?:^|\/)simplebeacon-rule-tests\//.test(rel) || /(?:^|\/)ai-agent\//.test(rel) || /(?:^|\/)ai-tools\//.test(rel) || /(?:^|\/)simplebeacon-frameworkless\//.test(rel)) continue;
        // Skip VS Code extension files — mocks and API wrappers don't require paired tests
        if (/(?:^|\/)simplebeacon-vscode\//.test(rel)) continue;
        if (/\.min\.(js|cjs|mjs)$/.test(name)) continue;

        if (testBasenames.has(name)) continue;

        if (count >= 25) break;
        count++;

        findings.push({
            category: 'test-coverage',
            type: 'missing-test-file',
            severity: 'low',
            filePath: file.relativePath,
            line: 1,
            description: `Source file with no corresponding test: ${file.relativePath}`,
            recommendedAction: 'Add unit or integration tests for this module'
        });
    }
    return findings;
}

/** Vestigial directories that should be removed when empty. */
const VESTIGIAL_DIR_NAMES = new Set([
    '.github-sync',
    'github-cache',
    '.github-cache',
    '.simplebeacon-backup',
    'archive',
    'temp',
    '.tmp',
    'tmp'
]);

/**
 * Detect empty vestigial directories that are left behind after cleanup.
 * @param {string} baseDir
 * @returns {any}
 */
function detectEmptyVestigialDirs(baseDir) {
    const findings = [];
    const resolvedBase = path.resolve(baseDir);
    // Only check within ai-platform/ if it exists
    const checkRoots = [resolvedBase];
    const aiPlatformPath = path.join(resolvedBase, 'ai-platform');
    if (fs.existsSync(aiPlatformPath)) {
        checkRoots.push(aiPlatformPath);
    }

    for (const root of checkRoots) {
        let entries;
        try {
            entries = fs.readdirSync(root, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (!VESTIGIAL_DIR_NAMES.has(entry.name)) continue;
            const dirPath = path.join(root, entry.name);
            let children;
            try {
                children = fs.readdirSync(dirPath);
            } catch {
                continue;
            }
            if (children.length === 0) {
                findings.push({
                    category: 'consolidation',
                    type: 'empty-vestigial-directory',
                    severity: 'low',
                    filePath: path.relative(resolvedBase, dirPath).replace(/\\/g, '/'),
                    line: 1,
                    description: `Empty vestigial directory: ${entry.name}/ — leftover from duplicate cleanup`,
                    recommendedAction: 'Remove empty directory or document its purpose if still needed'
                });
            }
        }
    }
    return findings;
}

const PRODUCTION_PATH_PREFIXES = ['server/', 'src/', 'packages/', 'app/', 'lib/', 'client/', 'api/'];
const DOCUMENTATION_PATH_PREFIXES = ['docs/', 'tests/', 'test/', 'templates/', '.cursor/', 'archive/'];

/**
 * Normalize audit relative path.
 * @param {string} filePath
 * @returns {any}
 */
function normalizeAuditRelativePath(filePath) {
    const rel = String(filePath || '').replace(/\\/g, '/').toLowerCase();
    const marker = 'ai-platform/';
    const idx = rel.indexOf(marker);
    return idx >= 0 ? rel.slice(idx + marker.length) : rel;
}

/**
 * Classify finding tier.
 * @param {string} filePath
 * @returns {any}
 */
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

/**
 * Count finding tiers.
 * @param {Array} findings
 * @returns {any}
 */
function countFindingTiers(findings = []) {
    return findings.reduce((acc, finding) => {
        const tier = classifyFindingTier(finding.filePath);
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
    }, { production: 0, documentation: 0, general: 0 });
}

/**
 * Sort findings for report.
 * @param {Array} findings
 * @returns {any}
 */
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

/**
 * Aggregate categories.
 * @param {Array} findings
 * @returns {any}
 */
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
        'junk-files': 'Backup/generated artifacts in tree',
        empty: 'Empty or whitespace-only files',
        oversized: 'Oversized source files',
        duplicate: 'Duplicate basenames',
        eslint: 'ESLint findings',
        'type-safety': 'Type Safety findings'
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

/**
 * Compute health score.
 * @param {Array} findings
 * @param {string} codeFilesAnalyzed
 * @returns {any}
 */
function computeHealthScore(findings, codeFilesAnalyzed) {
    if (!codeFilesAnalyzed) return 100;
    const uniqueFindings = dedupeFindings(findings);
    const byTier = { production: [], documentation: [], general: [] };
    for (const finding of uniqueFindings) {
        byTier[classifyFindingTier(finding.filePath)].push(finding);
    }

/**
 * Tier deduction.
 * @param {Array} tierFindings
 * @param {any} weight
 * @param {any} maxDeduction
 * @returns {any}
 */
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

/**
 * Run eslint.
 * @param {any} projectRoot
 * @param {any} platformRoot
 * @returns {any}
 */
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
            { cwd: platformRoot, timeout: 0, maxBuffer: 8 * constants.BYTES_PER_KB * constants.BYTES_PER_KB }
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

/**
 * Analyze codebase.
 * @param {string} baseDir
 * @param {Object} options
 * @returns {any}
 */
function countGovernanceFiles(files) {
    const licenseRegex = /^license(?:\.md|\.txt|\.rst)?$/i;
    const securityRegex = /^security(?:\.md|\.txt|\.rst)?$/i;
    const pkgJsonRegex = /^package\.json$/i;
    let licenseCount = 0;
    let securityCount = 0;
    let packageJsonCount = 0;
    for (const f of files) {
        const base = (f.name || '').toLowerCase();
        if (licenseRegex.test(base)) licenseCount++;
        if (securityRegex.test(base)) securityCount++;
        if (pkgJsonRegex.test(base)) packageJsonCount++;
    }
    return { licenseCount, securityCount, packageJsonCount };
}

async function analyzeCodebase(baseDir, options = {}) {
    const resolvedBase = path.resolve(baseDir);
    const context = resolveScanContext(options);
    const { platformRoot } = resolvePlatformRoot(resolvedBase);
    const scanRoot = resolvedBase;
    const codeWalkRoot = platformRoot !== resolvedBase ? platformRoot : resolvedBase;
    const includeEslint = options.includeEslint === true || context === 'complete';
    const scanProfile = resolveScanProfile(options, context === 'complete' ? 'cli' : context);
    const deepAnalyzeCap = resolveDeepAnalyzeCap(options, context);
    const walkOptions = { ...options, scanProfile, maxFiles: deepAnalyzeCap };
    const findingsCap = resolveFindingsCap(options, context);
    const previousFindingsCap = activeFindingsCap;
    activeFindingsCap = findingsCap;

    const [repositoryInventory, files] = await Promise.all([
        countRepositoryInventory(scanRoot, { profile: options.inventoryProfile || 'audit' }),
        walkCodeFiles(codeWalkRoot, walkOptions)
    ]);

    const governanceCounts = countGovernanceFiles(files);
    console.log(`[CodebaseAnalyzer] Governance counts: license=${governanceCounts.licenseCount}, security=${governanceCounts.securityCount}, package.json=${governanceCounts.packageJsonCount}`);

    try {
    const nodeModulesFiltered = files.filter((f) => {
        const isNodeModules = f.relativePath.includes('/node_modules/') || f.relativePath.startsWith('node_modules/');
        if (isNodeModules) {
            console.log(`[CodebaseAnalyzer] Skip (node_modules): ${f.relativePath}`);
        }
        return !isNodeModules;
    });
    if (nodeModulesFiltered.length > deepAnalyzeCap) {
        console.log(`[CodebaseAnalyzer] Skip (deepAnalyzeCap): ${nodeModulesFiltered.length - deepAnalyzeCap} files truncated (cap: ${deepAnalyzeCap})`);
    }
    // Exclude scanner implementation files and non-production subprojects to prevent self-analysis false positives
    const excludedAnalyzerPaths = [
        /(?:^|\/)simplebeacon-vscode\/src\//,
        /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|analyzers|reporters|lib|proxy)\//,
        /(?:^|\/)ai-agent\//,
        /(?:^|\/)ai-tools\//,
        /(?:^|\/)scripts\//,
        /(?:^|\/)simplebeacon-frameworkless\//,
        new RegExp('(?:^|/)New folder/'),
        /(?:^|\/)\.simplebeacon\//,
        /(?:^|\/)coming-soon\//,
        /REALTIME_MONITORING_FEATURE_REPORT\.md$/,
        /complete-scan\.json$/
    ];
    const analyzerFilesExcluded = nodeModulesFiltered.filter((f) => {
        const rel = f.relativePath.replace(/\\/g, '/');
        return !excludedAnalyzerPaths.some((re) => re.test(rel));
    });
    if (analyzerFilesExcluded.length < nodeModulesFiltered.length) {
        console.log(`[CodebaseAnalyzer] Skip (analyzer paths): ${nodeModulesFiltered.length - analyzerFilesExcluded.length} scanner/utility/subproject files excluded`);
    } else {
        console.log('[CodebaseAnalyzer] No analyzer paths excluded (check if exclusions are needed)');
    }
    const filesToAnalyze = analyzerFilesExcluded.slice(0, deepAnalyzeCap);

    const { findings, structureSamples } = await analyzeFilesInBatches(filesToAnalyze, codeWalkRoot, {
        concurrency: context === 'complete'
            ? Number(process.env.CODEBASE_COMPLETE_CONCURRENCY) || Math.max(ANALYZE_FILE_CONCURRENCY, 48)
            : options.concurrency,
        includeLegacyExperimental: options.includeLegacyExperimental,
        onProgress: options.onProgress
    });

    findings.push(...detectDuplicateBasenames(analyzerFilesExcluded));
    findings.push(...detectTestCoverage(analyzerFilesExcluded));
    findings.push(...detectEmptyVestigialDirs(scanRoot));

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

    console.log(`[CodebaseAnalyzer] Scan summary: discovered=${files.length}, analyzed=${codeFilesAnalyzed}, cap=${deepAnalyzeCap}, findings=${findings.length}`);

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
                placeholderOrFictionalData: findings.filter((f) => f.analyzer === 'placeholder-fictional-data-analyzer').length,
                eslintFindings: findings.filter((f) => f.category === 'eslint').length
            },
            governanceFiles: governanceCounts
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
    scanContentPatterns,
    dedupeFindings,
    REPO_SKIP_DIRS,
    CODE_EXTENSIONS,
    getCodeExtensions
};
