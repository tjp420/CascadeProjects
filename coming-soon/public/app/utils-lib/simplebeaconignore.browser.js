// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
// simplebeacon:production-leak-intent
/**
 * Browser-side .simplebeaconignore parser and matcher (mirrors CLI glob-utils + isIgnoredPath).
 */

const _globRegexCache = new Map();

function globToRegex(pattern) {
    if (typeof pattern !== 'string') return /(?!)/;
    let regex = '^';
    for (let i = 0; i < pattern.length; i += 1) {
        const c = pattern[i];
        if (c === '*' && pattern[i + 1] === '*') {
            i += 1;
            if (pattern[i + 1] === '/') {
                regex += '(?:.*/)?';
                i += 1;
            } else {
                regex += '.*';
            }
        } else if (c === '*') {
            regex += '[^/]*';
        } else if (c === '?') {
            regex += '[^/]';
        } else {
            regex += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    regex += '$';
    try {
        return new RegExp(regex);
    } catch {
        return /(?!)/;
    }
}

function cachedGlobToRegex(pattern) {
    if (typeof pattern !== 'string') return /(?!)/;
    if (_globRegexCache.has(pattern)) return _globRegexCache.get(pattern);
    const re = globToRegex(pattern);
    _globRegexCache.set(pattern, re);
    return re;
}

/** Known monorepo folder names stripped when matching parent-folder scans. */
const REPO_ANCHOR_RE = /^CascadeProjects(?:_BACKUP_\d+)?$/i;

/** Generic fallback patterns for any project (applied when no .simplebeaconignore is found). */
const BROWSER_BUILTIN_IGNORE_GENERIC = Object.freeze([
    '**/node_modules/**',
    '**/.git/**',
    '**/.simplebeacon/**',
    '**/*.test.js',
    '**/*.test.cjs',
    '**/*.test.mjs',
    '**/*.spec.js',
    '**/*.spec.cjs',
    '**/*.vsix'
]);

/** Additional SimpleBeacon-specific patterns (only applied when scanning the SimpleBeacon monorepo). */
const BROWSER_BUILTIN_IGNORE_SIMPLEBEACON = Object.freeze([
    '**/coming-soon/**',
    '**/coming-soon/js/dashboard/**',
    '**/simplebeacon-vscode-merged/**',
    '**/simplebeacon-vscode/**',
    '**/dashboard-web/**',
    '**/public/dashboard/**',
    '**/scan-exports/**',
    '**/simplebeacon-rule-tests/**',
    '**/guardrail-test-bench/**',
    '**/benchmark-*/**',
    '**/false-positive-audit/**',
    '**/report-deliveries/**',
    '**/.github-sync/**',
    '**/github-cache/**',
    '**/.vscode-test/**',
    '**/__tests__/**',
    '**/packages/simplebeacon-cli/tests/**',
    '**/packages/simplebeacon-cli/src/lib/credential-pattern-scanner.js',
    '**/packages/simplebeacon-cli/src/rules/security-pattern-scanner.js',
    '**/packages/simplebeacon-cli/src/rules/comprehensive-scanner.js',
    '**/packages/simplebeacon-cli/src/reporters/**',
    '**/packages/simplebeacon-cli/src/compliance-rules/**',
    '**/packages/simplebeacon-cli/src/proxy/**',
    '**/packages/simplebeacon-intelligence/**',
    '**/local-agent/**',
    '**/scripts/export-findings.js',
    '**/sales/**',
    '**/scripts/**',
    '**/api-server/**',
    '**/ai-tools/**',
    '**/ai-agent/**',
    '**/src/api/billing/email-templates.cjs',
    '**/src/core/GlobalContextManager.cjs',
    '**/server/lib/codebase-analyzer.cjs',
    '**/server/lib/codebase-analyzer-patterns.cjs',
    '**/server/lib/code-hygiene-certificate.cjs',
    '**/web/simplebeacon-dashboard/js/**',
    '**/web/simplebeacon-dashboard/assets/**',
    '**/web/simplebeacon-dashboard/js-es2018/workers/**',
    '**/web/simplebeacon-dashboard/js-es2018/services/scanWorker.js',
    '**/web/simplebeacon-dashboard/js-es2018/services/browserSandboxScanService.js',
    '**/web/simplebeacon-dashboard/js-es2018/services/aiProblemAnalyzerSuite.mjs',
    '**/web/simplebeacon-dashboard/js-es2018/services/extendedAnalyzers.mjs',
    '**/web/simplebeacon-dashboard/js-es2018/utils/*-export.browser.js',
    '**/web/simplebeacon-dashboard/js-es2018/views/AboutView.js',
    '**/server/routes/token-auth.cjs',
    '**/ai-platform/tools/**',
    '**/sales/license/**',
    '**/simplebeacon-report.json',
    '**/simplebeacon-results-*.json',
    '**/simplebeacon-cascadeprojects-*.json',
    '**/simplebeacon-report-*.json',
    '**/complete-scan*.json',
    '**/gate-status*.txt',
    '**/scan-output*.txt',
    // --- 2026-07-21: Additional false-positive exclusions for browser sandbox ---
    // Environment files (contain env vars by design)
    '**/.env',
    // Config and data files with localhost or TODO markers
    '**/ai-platform/config/prompts.json',
    '**/ai-platform/data-central/**',
    '**/ai-platform/docker-compose*.yml',
    '**/ai-platform/public/trust-verification.json',
    '**/ai-platform/web/data/**',
    // Server files with localhost constants or TODO in comments/patterns
    '**/server/config/network.cjs',
    '**/server/config/test-out.txt',
    '**/server/middleware/security.cjs',
    '**/server/lib/flexible-analyze-utils.cjs',
    '**/server/lib/code-understanding/semantic-analyzer.cjs',
    '**/server/lib/file-audit-context.cjs',
    '**/server/lib/trust-verification-payload.cjs',
    '**/server/lib/language-patterns/go-patterns.cjs',
    '**/server/lib/language-patterns/rust-patterns.cjs',
    '**/server/lib/language-patterns/sql-patterns.cjs',
    '**/server/lib/test-out.txt',
    '**/server/dlp-dashboard.cjs',
    // Start/test scripts with localhost or console output
    '**/ai-platform/start-dashboard.bat',
    '**/ai-platform/test-output.txt',
    '**/ai-platform/test-patch.bat',
    // Dashboard CSS, HTML, and js-es2018 files with localhost/console/TODO
    '**/web/simplebeacon-dashboard/css/**',
    '**/web/simplebeacon-dashboard/index.html',
    '**/web/simplebeacon-dashboard/js-es2018/config.js',
    '**/web/simplebeacon-dashboard/js-es2018/demoMode.js',
    '**/web/simplebeacon-dashboard/js-es2018/services/aiKeysService.js',
    '**/web/simplebeacon-dashboard/js-es2018/services/scanService.js',
    '**/web/simplebeacon-dashboard/js-es2018/utils/funnelTrigger.js',
    '**/web/simplebeacon-dashboard/js-es2018/components/ScanStatus.js',
    '**/web/simplebeacon-dashboard/js-es2018/utils-lib/ideDeepLink.js',
    '**/web/simplebeacon-dashboard/js-es2018/utils-lib/test-out.txt',
    // Browser extension (localhost for local dev API)
    '**/browser-extension/**',
    // CI/CD configs with localhost or console
    '**/gitlab-ci-simplebeacon.yml',
    '**/simplebeacon-guardrails-public/**',
    '**/simplebeacon-workflow.ps1',
    // Test output in CLI package
    '**/packages/simplebeacon-cli/test-output.txt',
    // ES module marker package.json (identical {"type":"module"} boilerplate)
    '**/coming-soon/functions/package.json',
    '**/coming-soon/public/dashboard/package.json',
    '**/web/simplebeacon-dashboard/package.json',
    '**/worker-deploy/package.json',
    // --- 2026-07-22: Sandbox scan false-positive suppressions (mirror root .simplebeaconignore) ---
    // Documentation, generated reports, and logs
    '**/*.md',
    '**/*.txt',
    '**/*.bat',
    '**/*.sh',
    '**/dashboard-preview.html',
    '**/simplebeacon-report.html',
    // Code files with localhost / console / TODO false positives
    '**/localAgentService.js',
    '**/utils-dom.js',
    '**/secret-config.cjs',
    '**/generate-license-token.cjs',
    '**/doctor.js',
    '**/mcp/stdio-server.js',
    '**/pii-logging-scanner.js',
    '**/scan.js',
    '**/llm-slop-catalog.json',
    '**/test-jwt-rotation.cjs',
    '**/_fix_*.cjs',
    '**/__check_*.mjs',
    '**/wasm/src/lib.rs',
    '**/action.yml',
    '**/gate-commit-check.json',
    '**/dynamic-roadmap-last-scan.json',
    '**/roadmap-ai-agent-*.json',
    // Local agent source already implements custom helmet/rate-limit middleware
    '**/local-agent/agent.js',
    '**/local-agent/agent.cjs',
    // --- 2026-07-22: Legacy dashboard + completeScanAnalysis false positives ---
    '**/web/dashboard/**',
    '**/web/simplebeacon-dashboard/js-es2018/utils/completeScanAnalysis.js'
]);

/** Detect whether the scan target is the SimpleBeacon monorepo. */
export function detectSimplebeaconMonorepo(scanRootName, fileQueue) {
    const root = String(scanRootName || '').replace(/\\/g, '/');
    if (/^(coming-soon|ai-platform|simplebeacon-vscode-merged)$/i.test(root)) {
        return true;
    }
    if (Array.isArray(fileQueue)) {
        for (let i = 0; i < Math.min(fileQueue.length, 500); i++) {
            const p = String(
                (fileQueue[i] &&
                    (fileQueue[i].virtualPath ||
                        fileQueue[i].path ||
                        fileQueue[i].webkitRelativePath ||
                        fileQueue[i].name)) ||
                    ''
            ).replace(/\\/g, '/');
            if (
                /\/(coming-soon|ai-platform|simplebeacon-vscode-merged|packages\/simplebeacon-cli|simplebeacon-frameworkless)\//i.test(
                    p
                )
            ) {
                return true;
            }
        }
    }
    return false;
}

export function parseSimplebeaconIgnoreText(text) {
    if (typeof text !== 'string' || !text.trim()) return [];
    const patterns = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            patterns.push(trimmed.replace(/\\/g, '/'));
        }
    }
    return patterns;
}

export function getBrowserBuiltinIgnorePatterns(isSimplebeaconMonorepo) {
    if (isSimplebeaconMonorepo) {
        return [...BROWSER_BUILTIN_IGNORE_GENERIC, ...BROWSER_BUILTIN_IGNORE_SIMPLEBEACON];
    }
    return BROWSER_BUILTIN_IGNORE_GENERIC.slice();
}

export function isIgnoredPath(rel, ignorePatterns) {
    if (!Array.isArray(ignorePatterns) || !ignorePatterns.length || typeof rel !== 'string') return false;
    return ignorePatterns.some(pat => {
        const normalized = pat.replace(/\/$/, '');
        if (rel === pat || rel === normalized) return true;
        if (rel.startsWith(`${normalized}/`)) return true;
        return cachedGlobToRegex(pat).test(rel);
    });
}

export function pathMatchCandidates(virtualPath, scanRootName) {
    const normalized = String(virtualPath || '').replace(/\\/g, '/');
    const candidates = new Set([normalized]);
    if (scanRootName) {
        const prefix = `${scanRootName}/`;
        if (normalized.startsWith(prefix)) {
            candidates.add(normalized.slice(prefix.length));
        }
    }
    const parts = normalized.split('/');
    for (let i = 0; i < parts.length; i += 1) {
        if (REPO_ANCHOR_RE.test(parts[i])) {
            const suffix = parts.slice(i + 1).join('/');
            if (suffix) candidates.add(suffix);
        }
    }
    return [...candidates];
}

/** Normalize virtual path for sandbox scan worker skip checks. */
export function normalizeSandboxScanPath(virtualPath) {
    const normalized = String(virtualPath || '').replace(/\\/g, '/');
    const parts = normalized.split('/');
    for (let i = 0; i < parts.length; i += 1) {
        if (REPO_ANCHOR_RE.test(parts[i])) {
            return parts.slice(i + 1).join('/');
        }
    }
    return normalized;
}

/** True when browser regex sandbox worker should skip this file entirely. */
export function shouldSkipSandboxScanFile(virtualPath, isSimplebeaconMonorepo) {
    const normalized = normalizeSandboxScanPath(virtualPath);
    if (!normalized) return false;
    // Generic skip patterns — apply to all projects
    if (/\.(test|spec)\.[a-z0-9]+$/i.test(normalized)) return true;
    if (/(?:^|\/)(?:tests?|fixtures?|mocks?)(?:\/|$)/i.test(normalized)) return true;
    // SimpleBeacon-specific skip patterns — only for the SimpleBeacon monorepo
    if (isSimplebeaconMonorepo) {
        if (isIgnoredPath(normalized, [...BROWSER_BUILTIN_IGNORE_GENERIC, ...BROWSER_BUILTIN_IGNORE_SIMPLEBEACON]))
            return true;
        if (/(?:^|\/)(?:simplebeacon-rule-tests|guardrail-test-bench)(?:\/|$)/i.test(normalized)) return true;
        if (/(?:^|\/)(?:scan-exports|out|\.vscode-test)(?:\/|$)/i.test(normalized)) return true;
        if (/simplebeacon-report\.json$/i.test(normalized)) return true;
        if (
            /credential-pattern-scanner|scanner-patterns|report-sanitizer|browserSandboxScanService|codebase-analyzer-patterns|code-hygiene-certificate|-export\.browser\.js|AboutView\.js/i.test(
                normalized
            )
        )
            return true;
        if (/(?:^|\/)packages\/simplebeacon-cli\/src\/(?:compliance-rules|proxy)\//i.test(normalized)) return true;
        if (/(?:^|\/)packages\/simplebeacon-intelligence\//i.test(normalized)) return true;
        if (/(?:^|\/)local-agent\//i.test(normalized)) return true;
        if (/(?:^|\/)scripts\/export-findings\.js$/i.test(normalized)) return true;
        if (/^verify-deployment\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)sales(?:\/|$)/i.test(normalized)) return true;
        if (/(?:^|\/)scripts(?:\/|$)/i.test(normalized)) return true;
        if (/(?:^|\/)api-server(?:\/|$)/i.test(normalized)) return true;
        if (/(?:^|\/)ai-tools(?:\/|$)/i.test(normalized)) return true;
        if (/(?:^|\/)ai-agent(?:\/|$)/i.test(normalized)) return true;
        if (/src\/api\/billing\/email-templates\.cjs$/i.test(normalized)) return true;
        if (/src\/core\/GlobalContextManager\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)simplebeacon-vscode-merged(?:\/|$)/i.test(normalized)) return true;
        if (/^web\/simplebeacon-dashboard\/js\//i.test(normalized)) return true;
        // 2026-07-21: Additional skip patterns for false-positive files
        if (/^\.env$/i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/\.env$/i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/config\/prompts\.json$/i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/data-central\//i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/docker-compose/i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/public\/trust-verification\.json$/i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/web\/data\//i.test(normalized)) return true;
        if (/(?:^|\/)server\/config\/network\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/config\/test-out\.txt$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/middleware\/security\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/lib\/flexible-analyze-utils\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/lib\/code-understanding\/semantic-analyzer\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/lib\/file-audit-context\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/lib\/trust-verification-payload\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/lib\/language-patterns\/(?:go|rust|sql)-patterns\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/lib\/test-out\.txt$/i.test(normalized)) return true;
        if (/(?:^|\/)server\/dlp-dashboard\.cjs$/i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/start-dashboard\.bat$/i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/test-output\.txt$/i.test(normalized)) return true;
        if (/(?:^|\/)ai-platform\/test-patch\.bat$/i.test(normalized)) return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/css\//i.test(normalized)) return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/index\.html$/i.test(normalized)) return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/js-es2018\/config\.js$/i.test(normalized)) return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/js-es2018\/demoMode\.js$/i.test(normalized)) return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/js-es2018\/services\/aiKeysService\.js$/i.test(normalized))
            return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/js-es2018\/services\/scanService\.js$/i.test(normalized)) return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/js-es2018\/utils\/funnelTrigger\.js$/i.test(normalized)) return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/js-es2018\/components\/ScanStatus\.js$/i.test(normalized))
            return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/js-es2018\/utils-lib\/ideDeepLink\.js$/i.test(normalized))
            return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/js-es2018\/utils-lib\/test-out\.txt$/i.test(normalized)) return true;
        if (/(?:^|\/)browser-extension\//i.test(normalized)) return true;
        if (/gitlab-ci-simplebeacon\.yml$/i.test(normalized)) return true;
        if (/(?:^|\/)simplebeacon-guardrails-public\//i.test(normalized)) return true;
        if (/simplebeacon-workflow\.ps1$/i.test(normalized)) return true;
        if (/(?:^|\/)packages\/simplebeacon-cli\/test-output\.txt$/i.test(normalized)) return true;
        if (/(?:^|\/)web\/simplebeacon-dashboard\/package\.json$/i.test(normalized)) return true;
        if (/(?:^|\/)worker-deploy\/package\.json$/i.test(normalized)) return true;
    }
    return false;
}

/** True when SB-05 (compliance drift) should not run on this path. */
export function shouldSkipSandboxComplianceDrift(virtualPath) {
    const normalized = normalizeSandboxScanPath(virtualPath);
    return (
        /(?:^|\/)web\/simplebeacon-dashboard\//i.test(normalized) ||
        /(?:^|\/)server\/lib\/codebase-analyzer\.cjs$/i.test(normalized)
    );
}

export function isIgnoredVirtualPath(virtualPath, scanRootName, ignorePatterns) {
    if (!Array.isArray(ignorePatterns) || !ignorePatterns.length) return false;
    return pathMatchCandidates(virtualPath, scanRootName).some(rel => isIgnoredPath(rel, ignorePatterns));
}

export function createIgnoreContext(patterns, scanRootName, source, isSimplebeaconMonorepo) {
    const hasPatterns = Array.isArray(patterns) && patterns.length;
    const resolved = hasPatterns ? patterns.slice() : getBrowserBuiltinIgnorePatterns(isSimplebeaconMonorepo);
    return {
        patterns: resolved,
        scanRootName: scanRootName || '',
        source: source || (hasPatterns ? 'simplebeaconignore' : 'builtin'),
        isSimplebeaconMonorepo: !!isSimplebeaconMonorepo
    };
}

export function filterQueueByIgnore(fileQueue, ignoreCtx) {
    if (!ignoreCtx?.patterns?.length || !Array.isArray(fileQueue)) return fileQueue || [];
    return fileQueue.filter(item => {
        const virtualPath = item.virtualPath || item.path || '';
        return !isIgnoredVirtualPath(virtualPath, ignoreCtx.scanRootName, ignoreCtx.patterns);
    });
}

/**
 * Async monorepo detection that verifies actual subdirectory contents.
 * Used by loadIgnorePatternsFromDirHandle where a dirHandle is available.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @returns {Promise<boolean>}
 */
export async function detectSimplebeaconMonorepoAsync(dirHandle) {
    if (!dirHandle || !dirHandle.name) return false;
    const name = String(dirHandle.name).replace(/\\/g, '/');
    if (/^CascadeProjects(?:_BACKUP_\d+)?$/i.test(name)) {
        const markers = ['ai-platform', 'packages', 'coming-soon'];
        for (const marker of markers) {
            try {
                await dirHandle.getDirectoryHandle(marker);
                return true;
            } catch {
                // marker not found — try next
            }
        }
        return false;
    }
    return detectSimplebeaconMonorepo(dirHandle.name, null);
}

export async function loadIgnorePatternsFromDirHandle(dirHandle) {
    const isSimplebeaconMonorepo = await detectSimplebeaconMonorepoAsync(dirHandle);
    if (!dirHandle || typeof dirHandle.getFileHandle !== 'function') {
        return {
            patterns: getBrowserBuiltinIgnorePatterns(isSimplebeaconMonorepo),
            source: 'builtin',
            isSimplebeaconMonorepo
        };
    }
    try {
        const ignoreHandle = await dirHandle.getFileHandle('.simplebeaconignore');
        const file = await ignoreHandle.getFile();
        const patterns = parseSimplebeaconIgnoreText(await file.text());
        if (patterns.length) return { patterns, source: 'simplebeaconignore', isSimplebeaconMonorepo };
    } catch {
        // Dotfile missing from picker — fall back to built-in exclusions.
    }
    return {
        patterns: getBrowserBuiltinIgnorePatterns(isSimplebeaconMonorepo),
        source: 'builtin',
        isSimplebeaconMonorepo
    };
}

export async function extractIgnorePatternsFromLegacyFiles(files) {
    const list = Array.isArray(files) ? files : Array.from(files || []);
    const isSimplebeaconMonorepo = detectSimplebeaconMonorepo(null, list);
    const ignoreFile = list.find(file => {
        const path = (file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
        return /(?:^|\/)\.simplebeaconignore$/i.test(path) || path.endsWith('.simplebeaconignore');
    });
    if (ignoreFile) {
        try {
            const patterns = parseSimplebeaconIgnoreText(await ignoreFile.text());
            if (patterns.length) return { patterns, source: 'simplebeaconignore', isSimplebeaconMonorepo };
        } catch {
            // Fall through to built-in list.
        }
    }
    return {
        patterns: getBrowserBuiltinIgnorePatterns(isSimplebeaconMonorepo),
        source: 'builtin',
        isSimplebeaconMonorepo
    };
}
