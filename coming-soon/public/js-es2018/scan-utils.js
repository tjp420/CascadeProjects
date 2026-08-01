/**
 * Scan Engine Utilities — pure functions extracted from upload.html
 * No DOM dependencies. Safe to test in Node.js.
 */
const MAX_DISCOVERED_FILES = 999999999; // Effectively unlimited — scan all files
// Pre-upload folder size analyzer thresholds
const FOLDER_SIZE_WARN_CHROME_CAP = 1200;
const FOLDER_SIZE_WARN_LARGE = 50000;
const FOLDER_SIZE_WARN_SERVER_LIMIT = 500000;
const FOLDER_SIZE_ERROR_SAMPLE_LIMIT = 300000;
const FOLDER_SIZE_ERROR_DISCOVERY_CAP = 500000;
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
/**
 * Analyze a folder's file list for size thresholds before uploading.
 * @param {File[]|FileList} files - Array or FileList of files
 * @returns {{fileCount: number, totalSizeBytes: number, maxDepth: number, hasNodeModules: boolean, severity: string, message: string, blocked: boolean}}
 */
function analyzeFolderSize(files) {
    const arr = Array.isArray(files) ? files : Array.from(files || []);
    const fileCount = arr.length;
    let totalSizeBytes = 0;
    let maxDepth = 0;
    let hasNodeModules = false;
    for (const f of arr) {
        totalSizeBytes += f.size || 0;
        const path = (f.webkitRelativePath || f.name || '').replace(/\\/g, '/');
        const depth = path.split('/').length - 1;
        if (depth > maxDepth)
            maxDepth = depth;
        if (/[\/](node_modules|\.git|\.next|dist|build|coverage)[\/]/i.test(path)) {
            hasNodeModules = true;
        }
    }
    let severity = 'ok';
    let message = '';
    let blocked = false;
    if (fileCount > FOLDER_SIZE_ERROR_DISCOVERY_CAP) {
        severity = 'error';
        message = 'File count (' + fileCount.toLocaleString() + ') exceeds discovery cap of ' + FOLDER_SIZE_ERROR_DISCOVERY_CAP.toLocaleString() + '. Use CLI scan for complete analysis.';
        blocked = true;
    }
    else if (fileCount > FOLDER_SIZE_ERROR_SAMPLE_LIMIT) {
        severity = 'warn';
        message = 'Very large folder (' + fileCount.toLocaleString() + ' files). Deep scan will process all files — expect longer runtime. Use CLI for faster batch analysis.';
    }
    else if (fileCount > FOLDER_SIZE_WARN_SERVER_LIMIT) {
        severity = 'warn';
        message = 'Server upload limit is ' + FOLDER_SIZE_WARN_SERVER_LIMIT.toLocaleString() + ' files. Only browser scan is available for this folder.';
    }
    else if (fileCount > FOLDER_SIZE_WARN_LARGE) {
        severity = 'warn';
        message = 'Large folder detected (' + fileCount.toLocaleString() + ' files). Browser scan will process all files but may take several minutes.';
    }
    else if (fileCount > FOLDER_SIZE_WARN_CHROME_CAP) {
        severity = 'info';
        message = 'Chrome may cap the folder picker at ~' + FOLDER_SIZE_WARN_CHROME_CAP.toLocaleString() + ' files. Use drag-and-drop for full coverage.';
    }
    return { fileCount, totalSizeBytes, maxDepth, hasNodeModules, severity, message, blocked };
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
        MAX_DISCOVERED_FILES,
        analyzeFolderSize,
        FOLDER_SIZE_WARN_CHROME_CAP,
        FOLDER_SIZE_WARN_LARGE,
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
        MAX_DISCOVERED_FILES,
        analyzeFolderSize,
        FOLDER_SIZE_WARN_CHROME_CAP,
        FOLDER_SIZE_WARN_LARGE,
        FOLDER_SIZE_WARN_SERVER_LIMIT,
        FOLDER_SIZE_ERROR_SAMPLE_LIMIT,
        FOLDER_SIZE_ERROR_DISCOVERY_CAP
    };
}
