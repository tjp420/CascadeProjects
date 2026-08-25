// simplebeacon-ignore: Dashboard code — security telemetry service
import { apiBase } from './authService.js?v=20260722bridgefix1';

/**
 * Fetch security telemetry from the backend aggregation endpoint.
 * @param {object} [authHeaders] - Auth headers from authService.getAuthHeaders()
 * @returns {Promise<object>} Telemetry data with scrubber, replay, audit, pii stats
 */
export async function fetchSecurityTelemetry(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/telemetry`;
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { ...authHeaders },
      credentials: 'include',
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    throw new Error(`Failed to fetch telemetry: ${err.message}`);
  }
}

/**
 * Build a summary object from telemetry data for dashboard rendering.
 * @param {object} telemetry - Raw telemetry response
 * @returns {object} Normalized summary
 */
export function buildTelemetrySummary(telemetry) {
  if (!telemetry || !telemetry.success) return null;
  const scrubber = telemetry.scrubber || {};
  const replay = telemetry.replay || {};
  const audit = telemetry.audit || {};
  const pii = telemetry.pii || {};

  return {
    timestamp: telemetry.timestamp || Date.now(),
    scrubber: {
      activeScrubbers: scrubber.activeScrubbers || 0,
      maxScrubbers: scrubber.maxScrubbers || 0,
      totalCreated: scrubber.totalCreated || 0,
      totalEvicted: scrubber.totalEvicted || 0,
      totalExpired: scrubber.totalExpired || 0,
      ttlMs: scrubber.ttlMs || 0,
      utilization: scrubber.maxScrubbers > 0 ? Math.round((scrubber.activeScrubbers / scrubber.maxScrubbers) * 100) : 0,
    },
    replay: {
      totalChecked: replay.totalChecked || 0,
      totalReplays: replay.totalReplays || 0,
      orgCount: replay.orgCount || 0,
      totalFingerprints: replay.totalFingerprints || 0,
      replayRate: replay.totalChecked > 0 ? Math.round((replay.totalReplays / replay.totalChecked) * 10000) / 100 : 0,
    },
    audit: {
      chainValid: audit.chainValid !== undefined ? audit.chainValid : true,
      totalEntries: audit.totalEntries || 0,
      verifiedEntries: audit.verifiedEntries || 0,
      brokenLinks: audit.brokenLinks || 0,
      tamperedEntries: audit.tamperedEntries || 0,
      quarantinedCount: audit.quarantinedCount || 0,
    },
    pii: {
      totalPolicies: pii.totalPolicies || 0,
      enabledPolicies: pii.enabledPolicies || 0,
      bySeverity: pii.bySeverity || {},
      hasError: !!pii.error,
    },
  };
}
