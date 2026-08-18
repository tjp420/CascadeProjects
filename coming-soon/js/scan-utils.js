/**
 * Scan Engine Utilities — pure functions extracted from upload.html
 * No DOM dependencies. Safe to test in Node.js.
 */
// Discovery cap for browser-side scans to keep UI behavior predictable.
const BROWSER_SCAN_UNLIMITED = Number.MAX_SAFE_INTEGER;
// Align with tests and UI expectations: cap discovery to 1,000,000 files in browser.
const MAX_DISCOVERED_FILES = 1000000;
const FOLDER_SIZE_WARN_CHROME_CAP = 8192; // legacy webkitdirectory picker only
const FOLDER_SIZE_WARN_LARGE = 100000;
const FOLDER_SIZE_WARN_HUGE = 500000;
const FOLDER_SIZE_WARN_SERVER_LIMIT = BROWSER_SCAN_UNLIMITED;
const FOLDER_SIZE_ERROR_SAMPLE_LIMIT = BROWSER_SCAN_UNLIMITED;
const FOLDER_SIZE_ERROR_DISCOVERY_CAP = BROWSER_SCAN_UNLIMITED;
const BROWSER_SCAN_CLI_HINT = 'npx simplebeacon scan --full --gate --format json --output .simplebeacon/report.json';

function getLargeRepoScanAdvice(fileCount) {
    var n = Number(fileCount) || 0;
    if (n < FOLDER_SIZE_WARN_LARGE) return null;
    return {
        fileCount: n,
        cliCommand: BROWSER_SCAN_CLI_HINT,
        usePathField: n >= FOLDER_SIZE_WARN_HUGE,
        useCli: false,
        message: 'Large folder (' + n.toLocaleString() + ' files). Browser scan will process all indexed files — may take several minutes on low-RAM machines.'
    };
}
/**
 * Simple non-crypto hash for duplicate detection.
 * @param {string} str
 * @returns {Promise<string>}
 */
async function simpleHash(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback FNV-1a for environments without Web Crypto
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}
/**
 * Extract up to `max` regex matches from text with line numbers and snippets.
 * @param {string} text
 * @param {RegExp} pattern
 * @param {number} max
 * @returns {{line:number, snippet:string}[]}
 */
function extractMatches(text, pattern, max = 3) {
    const matches = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && matches.length < max; i++) {
        const line = lines[i];
        if (pattern.test(line)) {
            matches.push({ line: i + 1, snippet: line.trim().slice(0, 120) });
        }
    }
    return matches;
}
/**
 * Check if a file path should be treated as a node_modules entry.
 * @param {string} path
 * @returns {boolean}
 */
function isNodeModulePath(path) {
    return /(^|[\/])node_modules([\/]|$)/i.test(path);
}
/**
 * Check if a path is a generated/cache artifact.
 * @param {string} path
 * @returns {boolean}
 */
function isCachePath(path) {
    return /\.simplebeacon[\/]/.test(path) || /github-cache[\/]/.test(path) || /\.git[\/]/.test(path);
}
/**
 * Check if a path is a test file.
 * @param {string} path
 * @returns {boolean}
 */
function isTestFilePath(path) {
    return /test-.*\.js$|\.test\.|\.spec\./i.test(path);
}
/**
 * Normalize a file path for consistent cross-platform handling.
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
    return path.replace(/\\/g, '/');
}
/** Paths excluded from browser scans (vendor, VCS, build output). */
var VENDOR_PATH_RE = /(^|[\/\\])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode|\.idea|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp|target|\.wrangler|\.cargo\/registry|\.cargo\/git)([\/\\]|$)/i;
function isVendorScanPath(path) {
    if (!path)
        return false;
    return VENDOR_PATH_RE.test(String(path).replace(/\\/g, '/'));
}
/**
 * Remove vendor/cache paths from a File array without blocking the main thread.
 * @param {File[]} files
 * @param {{chunkSize?: number, onProgress?: Function}} options
 * @returns {Promise<{files: File[], kept: number, dropped: number, total: number}>}
 */
async function stripVendorFiles(files, options) {
    options = options || {};
    var chunkSize = options.chunkSize || 2000;
    var onProgress = options.onProgress || function () { };
    var kept = [];
    var dropped = 0;
    var total = files.length;
    for (var i = 0; i < total; i++) {
        var f = files[i];
        var path = (f && (f.webkitRelativePath || f.name)) || '';
        if (isVendorScanPath(path)) {
            dropped++;
        }
        else {
            kept.push(f);
        }
        if (i > 0 && i % chunkSize === 0) {
            onProgress(i + 1, total, kept.length, dropped);
            await new Promise(function (r) { return setTimeout(r, 0); });
        }
    }
    onProgress(total, total, kept.length, dropped);
    return { files: kept, kept: kept.length, dropped: dropped, total: total };
}
/**
 * Analyze a folder's file list for size thresholds before uploading.
 * Samples large lists so post-discovery analysis does not freeze the tab.
 * @param {File[]|FileList} files - Array or FileList of files
 * @returns {{fileCount: number, totalSizeBytes: number, maxDepth: number, hasNodeModules: boolean, severity: string, message: string, blocked: boolean}}
 */
function analyzeFolderSize(files) {
    var fileCount = Array.isArray(files) ? files.length : (files ? files.length : 0);
    if (fileCount === 0) {
        return { fileCount: 0, totalSizeBytes: 0, maxDepth: 0, hasNodeModules: false, severity: 'ok', message: '', blocked: false, cliHint: BROWSER_SCAN_CLI_HINT };
    }
    var sampleLimit = 8000;
    var step = fileCount <= sampleLimit ? 1 : Math.max(1, Math.floor(fileCount / sampleLimit));
    var totalSizeBytes = 0;
    var maxDepth = 0;
    var hasNodeModules = false;
    var sampled = 0;
    for (var i = 0; i < fileCount; i += step) {
        var f = Array.isArray(files) ? files[i] : files[i];
        if (!f)
            continue;
        sampled++;
        totalSizeBytes += f.size || 0;
        var path = (f.webkitRelativePath || f.name || '').replace(/\\/g, '/');
        var depth = path.split('/').length - 1;
        if (depth > maxDepth)
            maxDepth = depth;
        if (/[\/](node_modules|\.git|\.next|dist|build|coverage)[\/]/i.test(path)) {
            hasNodeModules = true;
        }
    }
    if (step > 1) {
        totalSizeBytes = Math.round(totalSizeBytes * (fileCount / sampled));
    }
    let severity = 'ok';
    let message = '';
    let blocked = false;
    if (fileCount >= FOLDER_SIZE_WARN_HUGE) {
        severity = 'warn';
        message = 'Very large folder (' + fileCount.toLocaleString() + ' files). Scan will continue — ensure sufficient RAM; CLI is faster for 500k+ trees.';
    }
    else if (fileCount > FOLDER_SIZE_WARN_LARGE) {
        severity = 'warn';
        message = 'Large folder (' + fileCount.toLocaleString() + ' files). Full browser scan in progress — may take several minutes.';
    }
    else if (fileCount > FOLDER_SIZE_WARN_CHROME_CAP && fileCount < 12000) {
        severity = 'info';
        message = 'If this count looks low (~8k), you may have used the legacy folder picker — drag & drop the folder or use Select Drive Target again (recursive picker).';
    }
    return { fileCount, totalSizeBytes, maxDepth, hasNodeModules, severity, message, blocked, cliHint: BROWSER_SCAN_CLI_HINT };
}

var BINARY_EXT_RE = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|mp4|webm|mp3|wav|zip|gz|tar|bz2|7z|pdf|exe|dll|so|dylib|wasm|bin|dat|db|sqlite|lock)$/i;
var SOURCE_EXT_RE = /\.(js|cjs|mjs|ts|tsx|jsx|py|pyw|java|go|rs|php|rb|cs|swift|kt|scala|dart|vue|svelte|zs|lua|sh|bash|ps1)$/i;
var MARKUP_EXT_RE = /\.(html|htm|css|scss|sass|less)$/i;
var CONFIG_EXT_RE = /\.(json|ya?ml|toml|xml|ini|properties|tfvars|env\.example|cjs|config\.js)$/i;
var DOCS_EXT_RE = /\.(md|txt|rst|adoc)$/i;

/**
 * Categorize a normalized repo-relative path for inventory breakdown.
 * @param {string} path
 * @returns {string}
 */
function categorizeScanPath(path) {
    var p = String(path || '').replace(/\\/g, '/');
    var lower = p.toLowerCase();
    if (isVendorScanPath(p)) return 'vendor';
    if (BINARY_EXT_RE.test(lower)) return 'binary';
    if (SOURCE_EXT_RE.test(lower)) return 'sourceCode';
    if (MARKUP_EXT_RE.test(lower)) return 'markup';
    if (CONFIG_EXT_RE.test(lower)) return 'config';
    if (DOCS_EXT_RE.test(lower)) return 'docs';
    if (/\/(frontend-build|dist|build|\.next|out|coverage)[\/]|\.(map|chunk\.js)$/i.test(lower)) return 'buildArtifacts';
    if (/\/(test-cert|java-ai-vulnerable|simplebeacon-rule-tests|__tests__|mocks|fixtures)[\/]|\.(test|spec)\./i.test(lower)) return 'testFixtures';
    if (/(^|[\/])(tmp-|temp_|fix_|patch_|repair_|deploy-)[^\/]*\.js$/i.test(lower)) return 'tempDev';
    return 'other';
}

/**
 * Build a sampled file inventory for large folder lists (non-blocking).
 * @param {File[]|FileList} files
 * @param {{sampleLimit?: number, label?: string}} options
 * @returns {object}
 */
function buildFileInventorySummary(files, options) {
    options = options || {};
    var total = Array.isArray(files) ? files.length : (files ? files.length : 0);
    if (total === 0) {
        return {
            totalFiles: 0,
            sampled: false,
            categories: {},
            topExtensions: [],
            maxDepth: 0,
            totalSizeBytes: 0,
            scannableEstimate: 0,
            vendorEstimate: 0,
            binaryEstimate: 0
        };
    }
    var sampleLimit = options.sampleLimit || 15000;
    var step = total <= sampleLimit ? 1 : Math.max(1, Math.ceil(total / sampleLimit));
    var categories = {
        sourceCode: 0,
        markup: 0,
        config: 0,
        docs: 0,
        buildArtifacts: 0,
        testFixtures: 0,
        tempDev: 0,
        vendor: 0,
        binary: 0,
        other: 0
    };
    var extensions = Object.create(null);
    var maxDepth = 0;
    var totalSizeBytes = 0;
    var sampledCount = 0;
    var topLevelDirs = Object.create(null);

    for (var i = 0; i < total; i += step) {
        var f = Array.isArray(files) ? files[i] : files[i];
        if (!f) continue;
        sampledCount++;
        totalSizeBytes += f.size || 0;
        var path = normalizePath(f.webkitRelativePath || f.name || '');
        var parts = path.split('/').filter(Boolean);
        if (parts.length > maxDepth) maxDepth = parts.length;
        if (parts.length > 0) {
            var root = parts[0].toLowerCase();
            topLevelDirs[root] = (topLevelDirs[root] || 0) + 1;
        }
        var cat = categorizeScanPath(path);
        categories[cat] = (categories[cat] || 0) + 1;
        var dot = path.lastIndexOf('.');
        var ext = dot >= 0 ? path.slice(dot).toLowerCase() : '(no ext)';
        extensions[ext] = (extensions[ext] || 0) + 1;
    }

    var scale = step > 1 ? total / sampledCount : 1;
    var scaled = {};
    Object.keys(categories).forEach(function (key) {
        scaled[key] = Math.round((categories[key] || 0) * scale);
    });

    var topExtensions = Object.keys(extensions)
        .map(function (ext) { return { ext: ext, count: Math.round(extensions[ext] * scale) }; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 8);

    var topRoots = Object.keys(topLevelDirs)
        .map(function (name) { return { name: name, count: Math.round(topLevelDirs[name] * scale) }; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 6);

    var scannableEstimate = Math.max(0, total - (scaled.vendor || 0) - (scaled.binary || 0));

    return {
        totalFiles: total,
        sampled: step > 1,
        sampleStep: step,
        categories: scaled,
        topExtensions: topExtensions,
        topLevelDirs: topRoots,
        maxDepth: maxDepth,
        totalSizeBytes: step > 1 ? Math.round(totalSizeBytes * scale) : totalSizeBytes,
        scannableEstimate: scannableEstimate,
        vendorEstimate: scaled.vendor || 0,
        binaryEstimate: scaled.binary || 0,
        label: options.label || 'Folder'
    };
}

/**
 * Human-readable size.
 * @param {number} bytes
 * @returns {string}
 */
function formatByteSize(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
// Browser-compatible export (global) or CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        simpleHash,
        extractMatches,
        isNodeModulePath,
        isCachePath,
        isTestFilePath,
        normalizePath,
        isVendorScanPath,
        stripVendorFiles,
        MAX_DISCOVERED_FILES,
        analyzeFolderSize,
        getLargeRepoScanAdvice,
        categorizeScanPath,
        buildFileInventorySummary,
        formatByteSize,
        FOLDER_SIZE_WARN_CHROME_CAP,
        FOLDER_SIZE_WARN_LARGE,
        FOLDER_SIZE_WARN_HUGE,
        FOLDER_SIZE_WARN_SERVER_LIMIT,
        FOLDER_SIZE_ERROR_SAMPLE_LIMIT,
        FOLDER_SIZE_ERROR_DISCOVERY_CAP
    };
}
else if (typeof window !== 'undefined') {
    window.ScanUtils = {
        simpleHash,
        extractMatches,
        isNodeModulePath,
        isCachePath,
        isTestFilePath,
        normalizePath,
        isVendorScanPath,
        stripVendorFiles,
        MAX_DISCOVERED_FILES,
        analyzeFolderSize,
        getLargeRepoScanAdvice,
        categorizeScanPath,
        buildFileInventorySummary,
        formatByteSize,
        FOLDER_SIZE_WARN_CHROME_CAP,
        FOLDER_SIZE_WARN_LARGE,
        FOLDER_SIZE_WARN_HUGE,
        FOLDER_SIZE_WARN_SERVER_LIMIT,
        FOLDER_SIZE_ERROR_SAMPLE_LIMIT,
        FOLDER_SIZE_ERROR_DISCOVERY_CAP
    };
}
