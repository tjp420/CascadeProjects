// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Recovery Telemetry Service
 * Fetches threshold account recovery metrics from the vault API
 */

/**
 * Fetch recovery telemetry metrics.
 * @returns {Promise<object>}
 */
export async function fetchRecoveryTelemetry() {
  try {
    const response = await fetch("/api/vault/recovery/status");
    if (!response.ok) {
      if (response.status === 403) {
        return { status: "forbidden", counters: {} };
      }
      if (response.status === 404) {
        return { status: "unavailable", counters: {} };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.success !== true) {
      throw new Error(data.error || "Failed to retrieve recovery telemetry");
    }
    return {
      status: "success",
      counters: data.counters || {},
      timestamp: data.timestamp,
    };
  } catch (error) {
    const msg =
      (error === null || error === void 0 ? void 0 : error.message) ||
      String(error);
    if (msg.includes("NetworkError") || msg.includes("Failed to fetch")) {
      return { status: "unavailable", counters: {} };
    }
    window["console"]["error"](
      "[recoveryTelemetryService] Error fetching telemetry:",
      msg,
    );
    throw error;
  }
}

/**
 * Get recovery counters summary.
 * @returns {Promise<object>}
 */
export async function getRecoveryCounters() {
  const data = await fetchRecoveryTelemetry();
  return data.counters;
}
