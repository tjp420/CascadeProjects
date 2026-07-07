/**
 * @module path
 */
/**
 * Normalize backslashes to forward slashes.
 * @param {string} path
 * @param {Object} [opts]
 * @param {boolean} [opts.stripLeadingDot=false]
 * @param {boolean} [opts.lowercase=false]
 * @returns {string}
 */
export function normalizeSlashes(path, opts = {}) {
    let normalized = String(path || '').replace(/\\/g, '/');
    if (opts.stripLeadingDot)
        normalized = normalized.replace(/^\.\//, '');
    if (opts.lowercase)
        normalized = normalized.toLowerCase();
    return normalized;
}
/**
 * Display-only — hide C:\Users\… and /home/… prefixes in the UI.
 * @param {string} projectPath
 * @returns {string}
 */
export function redactPathForDisplay(projectPath) {
    if (typeof projectPath !== 'string' || !projectPath)
        return '';
    const normalized = normalizeSlashes(projectPath);
    const ellipsisUser = normalized.match(/^(?:…|\.\.\.)\/[^/]+(\/.+)?$/);
    if (ellipsisUser)
        return ellipsisUser[1] ? `…${ellipsisUser[1]}` : '…';
    const winHome = normalized.match(/^[a-zA-Z]:\/Users\/[^/]+(\/.+)?$/i);
    if (winHome)
        return winHome[1] ? `…${winHome[1]}` : '…';
    const unixHome = normalized.match(/^\/Users\/[^/]+(\/.+)?$/);
    if (unixHome)
        return unixHome[1] ? `…${unixHome[1]}` : '…';
    const unixHome2 = normalized.match(/^\/home\/[^/]+(\/.+)?$/);
    if (unixHome2)
        return unixHome2[1] ? `…${unixHome2[1]}` : '…';
    const unixLikeUserRoot = normalized.match(/^\/(?!usr\/|var\/|etc\/|opt\/|bin\/|sbin\/|tmp\/|dev\/|mnt\/|proc\/|sys\/|run\/)([^/]+)(\/.+)$/i);
    if (unixLikeUserRoot)
        return `…${unixLikeUserRoot[2]}`;
    if (/(?:^|\/)(?:…|\.{3})\/[^/]+\//.test(normalized)) {
        return normalized.replace(/((?:^|\/)(?:…|\.{3}))\/[^/]+(\/)/, '$1$2');
    }
    return projectPath;
}
/**
 * True when the string is a privacy-redacted path rather than a full absolute path.
 * @param {string} displayPath
 * @returns {boolean}
 */
export function isRedactedPathDisplay(displayPath) {
    if (displayPath == null || displayPath === '')
        return false;
    const normalized = normalizeSlashes(displayPath).trim();
    if (/^(?:…|\.{3})(?:\/|$)/.test(normalized))
        return true;
    if (/(?:^|\/)(?:…|\.{3})\//.test(normalized))
        return true;
    return false;
}
/**
 * Editable path inputs — keep the full absolute path; normalize slashes only.
 * @param {string} projectPath
 * @returns {string}
 */
export function formatPathInputValue(projectPath) {
    if (typeof projectPath !== 'string' || !projectPath)
        return '';
    return normalizeSlashes(projectPath);
}
/**
 * Format a scan path for display (relative to project root or redacted).
 * @param {string} scanPath
 * @param {string} [projectRoot]
 * @returns {string}
 */
export function formatScanPathForDisplay(scanPath, projectRoot) {
    if (typeof scanPath !== 'string' || !scanPath)
        return '';
    const normalized = normalizeSlashes(scanPath);
    const rawRoot = normalizeSlashes(projectRoot);
    const root = rawRoot === '/' ? rawRoot : rawRoot.replace(/\/$/, '');
    if (root && normalized.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
        return normalized.slice(root.length + 1);
    }
    if (root === '/' && normalized.startsWith('/'))
        return normalized.slice(1);
    if (!/^[a-zA-Z]:\//.test(normalized) && !normalized.startsWith('/'))
        return normalized;
    return redactPathForDisplay(scanPath);
}
/**
 * Format a path for label display (basename or redacted).
 * @param {string} projectPath
 * @returns {string}
 */
export function formatPathLabel(projectPath) {
    if (typeof projectPath !== 'string') {
        try {
            return String(projectPath !== null && projectPath !== void 0 ? projectPath : '');
        }
        catch (_a) {
            return '';
        }
    }
    const redacted = redactPathForDisplay(projectPath);
    if (redacted && redacted !== projectPath)
        return redacted;
    const normalized = normalizeSlashes(projectPath);
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 2 && /^[a-zA-Z]:$/.test(parts[0]))
        return normalized;
    return parts[parts.length - 1] || projectPath || '';
}
