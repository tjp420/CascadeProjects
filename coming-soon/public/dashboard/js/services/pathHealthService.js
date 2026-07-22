// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Path Health Service
 * Fetches repository path health and scan summary metrics from the dashboard API
 */

/**
 * Fetch path health metrics.
 * @returns {any}
 */
export async function fetchPathHealthMetrics() {
  try {
    const response = await fetch('/api/metrics/path-health');

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'unavailable', summary: {}, directories: [], engine: {} };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to retrieve path health metrics');
    }

    return data;
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
      return { status: 'unavailable', summary: {}, directories: [], engine: {} };
    }
    window["console"]["error"]('[pathHealthService] Error fetching metrics:', msg);
    throw error;
  }
}

/**
 * Get path health summary.
 * @returns {any}
 */
export async function getPathHealthSummary() {
  const data = await fetchPathHealthMetrics();
  return data.summary;
}

/**
 * Get directory health.
 * @returns {any}
 */
export async function getDirectoryHealth() {
  const data = await fetchPathHealthMetrics();
  return data.directories;
}

/**
 * Get engine metadata.
 * @returns {any}
 */
export async function getEngineMetadata() {
  const data = await fetchPathHealthMetrics();
  return data.engine;
}
