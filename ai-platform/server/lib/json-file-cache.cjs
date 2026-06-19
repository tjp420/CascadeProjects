/**
 * Cached JSON reads keyed by file mtime — avoids repeated sync I/O on hot paths.
 */

const fs = require('fs');

const cache = new Map();

/**
 * File stat key.
 * @param {string} filePath
 * @returns {any}
 */
function fileStatKey(filePath) {
    try {
        const stat = fs.statSync(filePath);
        return `${stat.mtimeMs}|${stat.size}`;
    } catch {
        return null;
    }
}

/**
 * Read json file cached.
 * @param {string} filePath
 * @returns {any}
 */
function readJsonFileCached(filePath) {
    const resolved = String(filePath || '');
    if (!resolved) return null;

    try {
        if (!fs.existsSync(resolved)) return null;
        const statKey = fileStatKey(resolved);
        const cached = cache.get(resolved);
        if (cached && cached.statKey === statKey) {
            return cached.value;
        }
        const value = JSON.parse(fs.readFileSync(resolved, 'utf8'));
        cache.set(resolved, { statKey, value });
        return value;
    } catch {
        return null;
    }
}

/**
 * Read text file cached.
 * @param {string} filePath
 * @returns {any}
 */
function readTextFileCached(filePath) {
    const resolved = String(filePath || '');
    if (!resolved) return null;

    try {
        if (!fs.existsSync(resolved)) return null;
        const statKey = fileStatKey(resolved);
        const cacheKey = `${resolved}::text`;
        const cached = cache.get(cacheKey);
        if (cached && cached.statKey === statKey) {
            return cached.value;
        }
        const value = fs.readFileSync(resolved, 'utf8');
        cache.set(cacheKey, { statKey, value });
        return value;
    } catch {
        return null;
    }
}

/**
 * Clear json file cache.
 * @returns {any}
 */
function clearJsonFileCache() {
    cache.clear();
}

module.exports = {
    readJsonFileCached,
    readTextFileCached,
    clearJsonFileCache
};
