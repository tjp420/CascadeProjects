/**
 * Path Health Service
 * Fetches repository path health and scan summary metrics from the dashboard API
 */

export async function fetchPathHealthMetrics() {
  try {
    const response = await fetch('/api/metrics/path-health');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to retrieve path health metrics');
    }
    
    return data;
  } catch (error) {
    console.error('[pathHealthService] Error fetching metrics:', error);
    throw error;
  }
}

export async function getPathHealthSummary() {
  const data = await fetchPathHealthMetrics();
  return data.summary;
}

export async function getDirectoryHealth() {
  const data = await fetchPathHealthMetrics();
  return data.directories;
}

export async function getEngineMetadata() {
  const data = await fetchPathHealthMetrics();
  return data.engine;
}
