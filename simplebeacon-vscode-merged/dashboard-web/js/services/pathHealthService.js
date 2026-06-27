import { apiUrl } from '../utils.js';
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
    const response = await fetch(apiUrl('/api/metrics/path-health'));

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'unavailable', summary: {}, directories: [], engine: {} };
      }
      return { status: 'unavailable', summary: {}, directories: [], engine: {}, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();

    if (data.status !== 'success') {
      return { status: 'unavailable', summary: {}, directories: [], engine: {}, error: data.message || 'Failed to retrieve path health metrics' };
    }

    return data;
  } catch (error) {
    const msg = error?.message || String(error);
    return { status: 'unavailable', summary: {}, directories: [], engine: {}, error: msg };
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
