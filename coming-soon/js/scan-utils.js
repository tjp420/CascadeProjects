/**
 * Scan Engine Utilities — pure functions extracted from upload.html
 * No DOM dependencies. Safe to test in Node.js.
 */

const MAX_DISCOVERED_FILES = 100000;

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

// Browser-compatible export (global) or CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        simpleHash,
        extractMatches,
        isNodeModulePath,
        isCachePath,
        isTestFilePath,
        normalizePath,
        MAX_DISCOVERED_FILES
    };
} else if (typeof window !== 'undefined') {
    window.ScanUtils = {
        simpleHash,
        extractMatches,
        isNodeModulePath,
        isCachePath,
        isTestFilePath,
        normalizePath,
        MAX_DISCOVERED_FILES
    };
}
