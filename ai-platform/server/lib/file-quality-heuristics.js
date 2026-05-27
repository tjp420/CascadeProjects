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

function contentHasMarker(content, marker) {
    return typeof content === 'string' && content.includes(marker);
}

function calculateFileQuality(content) {
    let quality = 100;

    if (contentHasMarker(content, TECH_DEBT_MARKERS.pending)) quality -= 10;
    if (contentHasMarker(content, TECH_DEBT_MARKERS.blocked)) quality -= 15;
    if (contentHasMarker(content, DEBUG_MARKERS.consoleLog)) quality -= 5;
    if (contentHasMarker(content, DEBUG_MARKERS.debugger)) quality -= 5;

    return Math.max(0, quality);
}

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
