// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Drop Telemetry Counters
 * Module-level in-memory counters for drag-and-drop traversal metrics.
 * Client-side only — no backend endpoint needed since drag-and-drop scan
 * data never leaves the browser.
 */

const dropTelemetry = {
    totalDrops: 0,
    totalFilesDropped: 0,
    preReadSuccess: 0,
    preReadSkipped: 0,
    preReadFailed: 0,
    traversalErrors: 0,
    firefoxBypassUsed: 0,
};

/**
 * Get the current drop telemetry counters.
 * @returns {object} Drop telemetry counters
 */
export function getDropTelemetry() {
    return { ...dropTelemetry };
}

/**
 * Reset all drop telemetry counters to zero.
 */
export function resetDropTelemetry() {
    dropTelemetry.totalDrops = 0;
    dropTelemetry.totalFilesDropped = 0;
    dropTelemetry.preReadSuccess = 0;
    dropTelemetry.preReadSkipped = 0;
    dropTelemetry.preReadFailed = 0;
    dropTelemetry.traversalErrors = 0;
    dropTelemetry.firefoxBypassUsed = 0;
}

/**
 * Increment a drop telemetry counter.
 * @param {string} key Counter name
 * @param {number} [amount=1] Amount to increment
 */
export function incrementDropCounter(key, amount = 1) {
    if (dropTelemetry[key] !== undefined) {
        dropTelemetry[key] += amount;
    }
}
