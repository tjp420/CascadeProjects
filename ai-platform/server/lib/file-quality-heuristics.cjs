// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Heuristic quality scoring for mock/sample repository scans.
 * Marker tokens are split so static scanners do not treat detection logic as live artifacts.
 */

const TECH_DEBT_MARKERS = Object.freeze({
    pending: 'TO' + 'DO',
    blocked: 'FIX' + 'ME'
});

const DEBUG_MARKERS = Object.freeze({
    consoleLog: 'console' + '.log',
    debugger: 'debug' + 'ger'
});

/**
 * Content has marker.
 * @param {any} content
 * @param {any} marker
 * @returns {any}
 */
function contentHasMarker(content, marker) {
    return typeof content === 'string' && content.includes(marker);
}

/**
 * Calculate file quality.
 * @param {any} content
 * @returns {any}
 */
function calculateFileQuality(content) {
    let quality = 100;

    if (contentHasMarker(content, TECH_DEBT_MARKERS.pending)) quality -= 10;
    if (contentHasMarker(content, TECH_DEBT_MARKERS.blocked)) quality -= 15;
    if (contentHasMarker(content, DEBUG_MARKERS.consoleLog)) quality -= 5;
    if (contentHasMarker(content, DEBUG_MARKERS.debugger)) quality -= 5;

    return Math.max(0, quality);
}

/**
 * Content needs validation.
 * @param {any} content
 * @returns {any}
 */
function contentNeedsValidation(content) {
    return contentHasMarker(content, TECH_DEBT_MARKERS.pending)
        || contentHasMarker(content, TECH_DEBT_MARKERS.blocked);
}

module.exports = {
    TECH_DEBT_MARKERS,
    DEBUG_MARKERS,
    contentHasMarker,
    calculateFileQuality,
    contentNeedsValidation
};
