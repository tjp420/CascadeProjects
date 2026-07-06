/**
 * Analyze page utility functions.
 * Pure helpers extracted from AnalyzeView.js to reduce module size.
 */

/**
 * Read hash query param.
 * @param {string} name
 * @returns {string}
 */
export function readHashQueryParam(name) {
    const hash = typeof window !== 'undefined' ? (window.location.hash || '') : '';
    const qIndex = hash.indexOf('?');
    if (qIndex === -1)
        return '';
    return new URLSearchParams(hash.slice(qIndex + 1)).get(name) || '';
}

/**
 * Path to file slug.
 * @param {string} projectPath
 * @returns {string}
 */
export function pathToFileSlug(projectPath) {
    return (projectPath || 'scan')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'scan';
}

/**
 * Date stamp in ISO format (YYYY-MM-DD).
 * @returns {string}
 */
export function dateStamp() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Analysis type uses AI narrative.
 * @param {any} type
 * @returns {boolean}
 */
export function analysisTypeUsesAiNarrative(type) {
    return String(type || '').toLowerCase() !== 'roadmap';
}
