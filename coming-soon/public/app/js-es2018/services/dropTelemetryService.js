// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Drop Telemetry Service
 * Reads drag-and-drop traversal metrics from the dropTelemetryCounters module.
 * Client-side only — no backend endpoint needed since drag-and-drop scan
 * data never leaves the browser.
 */

import { getDropTelemetry, resetDropTelemetry } from './dropTelemetryCounters.js';

export { resetDropTelemetry };

/**
 * Fetch drop telemetry counters.
 * @returns {object} Drop telemetry counters
 */
export function fetchDropTelemetry() {
    try {
        return getDropTelemetry();
    } catch (error) {
        window["console"]["error"]('[dropTelemetryService] Error fetching telemetry:', error);
        return {
            totalDrops: 0,
            totalFilesDropped: 0,
            preReadSuccess: 0,
            preReadSkipped: 0,
            preReadFailed: 0,
            traversalErrors: 0,
            firefoxBypassUsed: 0,
        };
    }
}
