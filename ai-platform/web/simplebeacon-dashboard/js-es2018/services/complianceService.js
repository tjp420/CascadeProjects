// simplebeacon-ignore: Dashboard code — compliance report service
import { apiBase } from './authService.js?v=20260722bridgefix1';

/**
 * Fetch a compliance report as JSON.
 * @param {object} [authHeaders] - Auth headers from authService.getAuthHeaders()
 * @returns {Promise<object>} Result with success and report
 */
export async function fetchComplianceReport(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/compliance/report`;
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
    throw new Error(`Failed to fetch compliance report: ${err.message}`);
  }
}

/**
 * Download a compliance report as CSV via a Blob.
 * @param {object} [authHeaders] - Auth headers
 * @returns {Promise<boolean>} True if download succeeded
 */
export async function downloadComplianceCsv(authHeaders = {}) {
  const base = apiBase() || '';
  const url = `${base}/api/audit/compliance/report?format=csv`;
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
    const csvText = await resp.text();
    const blob = new Blob([csvText], { type: 'text/csv' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `compliance_proof_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return true;
  } catch (err) {
    throw new Error(`Failed to download compliance CSV: ${err.message}`);
  }
}

/**
 * Compliance service facade exposing a downloadReport dispatcher.
 * @param {object} [authHeaders] - Auth headers
 * @param {'json'|'csv'} [format='json'] - Report format
 * @returns {Promise<object>} JSON report object for 'json', { success: true } for 'csv'
 */
async function downloadReport(authHeaders = {}, format = 'json') {
  if (format === 'csv') {
    await downloadComplianceCsv(authHeaders);
    return { success: true };
  }
  return fetchComplianceReport(authHeaders);
}

export const complianceService = { downloadReport };
