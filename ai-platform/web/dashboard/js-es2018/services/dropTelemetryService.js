// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Drop Telemetry Service
 * Reads client-side drag-and-drop telemetry counters.
 */

let counters = {
    totalDrops: 0,
    filesDropped: 0,
    preReadSuccesses: 0,
    preReadSkips: 0,
    preReadFailures: 0,
    firefoxBypass: 0,
    traversalErrors: 0,
};

export function incrementDropCounter(key, amount) {
    if (counters[key] !== undefined) {
        counters[key] += (amount || 1);
    }
}

export function getDropTelemetry() {
    return { ...counters };
}

export function resetDropTelemetry() {
    counters = {
        totalDrops: 0,
        filesDropped: 0,
        preReadSuccesses: 0,
        preReadSkips: 0,
        preReadFailures: 0,
        firefoxBypass: 0,
        traversalErrors: 0,
    };
}

export async function fetchDropTelemetry() {
    return { status: 'success', counters: getDropTelemetry() };
}
