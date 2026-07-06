import { fetchWithTimeout, downloadJson, downloadText, apiUrl } from '../utils.js';
import { billingService } from './billingService.js';
import { authService } from './authService.js';
import { isDemoMode, isLocalDevHost, DEMO_API_BASE } from '../demoMode.js';
import { readJsonResponseBody } from '../lib/recoverable-fetch.js';
import { buildDashboardExportBundle } from '../utils/dashboard-export.browser.js?v=20260616demodashboard1';

/**
 * Simplebeacon api base.
 * @returns {any}
 */
function simplebeaconApiBase() {
  if (isDemoMode()) return DEMO_API_BASE;
  const stored = localStorage.getItem('sb_api_host');
  if (stored) return stored + '/api/simplebeacon';
  return '/api/simplebeacon';
}

/**
 * Merge auth headers.
 * @param {any} extra
 * @returns {any}
 */
function mergeAuthHeaders(extra = {}) {
  return { ...authService.getAuthHeaders(), ...billingService.getAuthHeaders(), ...extra };
}

/**
 * Fetch simplebeacon.
 * @param {string} url
 * @param {Object} options
 * @param {number} timeout
 * @returns {any}
 */
async function fetchSimplebeacon(url, options = {}, timeout = 30000) {
  const headers = mergeAuthHeaders(options.headers || {});
  let res;
  try {
    res = await fetchWithTimeout(url, { credentials: 'same-origin', ...options, headers }, timeout);
  } catch (error) {
    const detail = error?.message ? ` (${error.message})` : '';
    throw new Error(
      `Network request failed for ${url}${detail}. `
      + 'Verify the dashboard API server is running and reachable, then retry.'
    );
  }
  if (res.status === 403) {
    const forbiddenBody = await readJsonResponseBody(res, {});
    if (forbiddenBody.error === 'demo_readonly') {
      const err = new Error(forbiddenBody.message || 'Demo mode is read-only');
      err.code = 'demo_readonly';
      throw err;
    }
    if (forbiddenBody.error === 'vault_required') {
      const err = new Error(forbiddenBody.message || 'Internal dashboard requires vault authentication.');
      err.code = 'vault_required';
      throw err;
    }
    const err = new Error(forbiddenBody.message || 'Subscription required');
    err.code = 'subscription_required';
    err.details = forbiddenBody;
    throw err;
  }
  if (res.status === 401) {
    const err = new Error('Authentication required');
    err.code = 'auth_required';
    throw err;
  }
  return res;
}

/**
 * Scan service.
 */
export class ScanService {
  constructor() {
    this.report = null;
    this.baseline = null;
    this.config = null;
    this.history = [];
  }

  async fetchAll(projectPath = null) {
    const [reportR, baselineR, configR, historyR] = await Promise.allSettled([
      this.fetchReport(projectPath),
      this.fetchBaseline(),
      this.fetchConfig(projectPath),
      this.fetchHistory()
    ]);

    const firstError = [reportR, baselineR, configR].find((r) => r.status === 'rejected');
    if (firstError) {
      throw firstError.reason;
    }

    return {
      report: reportR.status === 'fulfilled' ? reportR.value : null,
      baseline: baselineR.status === 'fulfilled' ? baselineR.value : null,
      config: configR.status === 'fulfilled' ? configR.value : null,
      history: historyR.status === 'fulfilled' ? historyR.value : []
    };
  }

  async fetchReport(projectPath) {
    if (projectPath && /^https?:\/\//i.test(projectPath)) {
      return null;
    }
    const query = new URLSearchParams();
    if (projectPath) query.set('projectPath', projectPath);
    query.set('_cb', Date.now().toString());
    const params = query.toString() ? `?${query.toString()}` : '';
    const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/report${params}`);
    if (!res.ok) throw new Error('Failed to load scan report — is the dashboard server running?');
    const report = await readJsonResponseBody(res, null);
    if (!report || typeof report !== 'object') {
      throw new Error('Scan report API unavailable on this host (received HTML instead of JSON).');
    }
    this.report = await this.enrichReport(report);
    return this.report;
  }

  async fetchRepositoryInventory(projectPath) {
    const path = String(projectPath || '').trim();
    if (!path) return null;
    if (/^https?:\/\//i.test(path) && !/^(git@|ssh:\/\/|https:\/\/(github|gitlab|bitbucket|codeberg)\.)/i.test(path)) {
      return null;
    }
    const params = new URLSearchParams({ projectPath: path, profile: 'explorer' });
    const inventoryHttpResponse = await fetchWithTimeout(apiUrl(`/api/analyze/inventory?${params}`), { headers: mergeAuthHeaders() });
    const inventoryPayload = await readJsonResponseBody(inventoryHttpResponse, {});
    if (!inventoryHttpResponse.ok || !inventoryPayload.success) return null;
    return inventoryPayload.inventory;
  }

  async enrichReport(report) {
    if (!report?.projectRoot || report.repositoryInventory?.totalFiles != null) {
      return report;
    }
    const inventory = await this.fetchRepositoryInventory(report.projectRoot);
    if (!inventory) return report;
    return { ...report, repositoryInventory: inventory };
  }

  async fetchBaseline() {
    const res = await fetchWithTimeout(`${simplebeaconApiBase()}/baseline`, { headers: mergeAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load baseline');
    this.baseline = await readJsonResponseBody(res, null);
    if (!this.baseline || typeof this.baseline !== 'object') {
      throw new Error('Baseline API unavailable on this host (received HTML instead of JSON).');
    }
    return this.baseline;
  }

  async fetchConfig(projectPath = null) {
    const qs = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : '';
    const res = await fetchWithTimeout(`${simplebeaconApiBase()}/config${qs}`, { headers: mergeAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load config');
    this.config = await readJsonResponseBody(res, null);
    if (!this.config || typeof this.config !== 'object') {
      throw new Error('Config API unavailable on this host (received HTML instead of JSON).');
    }
    return this.config;
  }

  async fetchConfigPresets() {
    const presetsHttpResponse = await fetchWithTimeout(`${simplebeaconApiBase()}/config/presets`, { headers: mergeAuthHeaders() });
    if (!presetsHttpResponse.ok) throw new Error('Failed to load config presets');
    const presetsPayload = await readJsonResponseBody(presetsHttpResponse, {});
    return presetsPayload.presets || {};
  }

  async saveConfig(config) {
    const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }, 30000);
    const data = await readJsonResponseBody(res, {});
    if (!res.ok) {
      const detail = data.errors?.join('; ') || data.message || 'Failed to save config';
      throw new Error(detail);
    }
    this.config = data.config;
    return data;
  }

  async fetchHistory() {
    const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/history`);
    if (!res.ok) return [];
    const history = await readJsonResponseBody(res, []);
    this.history = Array.isArray(history) ? history : [];
    return this.history;
  }

  async fetchDashboard() {
    const dashboardHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/dashboard`);
    if (!dashboardHttpResponse.ok) throw new Error('Failed to load dashboard aggregate');
    const dashboardPayload = await readJsonResponseBody(dashboardHttpResponse, null);
    if (!dashboardPayload || typeof dashboardPayload !== 'object') {
      throw new Error('Dashboard API unavailable on this host (received HTML instead of JSON).');
    }
    return dashboardPayload;
  }

  async fetchScanResults(scanId = 'latest') {
    const resultsHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/results/${encodeURIComponent(scanId)}`);
    if (!resultsHttpResponse.ok) throw new Error('Failed to load scan results');
    const scanResultsPayload = await readJsonResponseBody(resultsHttpResponse, null);
    if (!scanResultsPayload || typeof scanResultsPayload !== 'object') {
      throw new Error('Scan results API unavailable on this host (received HTML instead of JSON).');
    }
    return scanResultsPayload;
  }

  async fetchAudit(includeNpmAudit = false) {
    const query = includeNpmAudit ? '?npmAudit=1' : '';
    const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/audit${query}`, {}, includeNpmAudit ? 120000 : 30000);
    if (!res.ok) throw new Error('Failed to load compliance audit');
    const data = await readJsonResponseBody(res, null);
    if (!data || typeof data !== 'object') {
      throw new Error('Audit API unavailable on this host (received HTML instead of JSON).');
    }
    return data;
  }

  async runAssess() {
    const assessHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/assess`, { method: 'POST' }, 60000);
    const assessResponse = await readJsonResponseBody(assessHttpResponse, {});
    if (!assessHttpResponse.ok) throw new Error(assessResponse.error || assessResponse.message || 'Assessment failed');
    return assessResponse;
  }

  async runNpmAudit() {
    const npmAuditHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/npm-audit`, { method: 'POST' }, 120000);
    const npmAuditResponse = await readJsonResponseBody(npmAuditHttpResponse, {});
    if (!npmAuditHttpResponse.ok) throw new Error(npmAuditResponse.error || npmAuditResponse.message || 'npm audit failed');
    return npmAuditResponse;
  }

  async fetchAssessment() {
    const assessmentHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/assessment`);
    if (!assessmentHttpResponse.ok) throw new Error('Failed to load assessment');
    const assessmentPayload = await readJsonResponseBody(assessmentHttpResponse, null);
    if (!assessmentPayload || typeof assessmentPayload !== 'object') {
      throw new Error('Assessment API unavailable on this host (received HTML instead of JSON).');
    }
    return assessmentPayload;
  }

  async fetchScanProgress(projectPath) {
    if (!projectPath) return { active: false };
    const params = new URLSearchParams({ projectPath });
    try {
      const res = await fetchWithTimeout(
        `${simplebeaconApiBase()}/scan/progress?${params}`,
        { headers: mergeAuthHeaders() },
        5000
      );
      const data = await readJsonResponseBody(res, {});
      if (res.status === 404) {
        return { active: false, endpointUnavailable: true };
      }
      if (!res.ok) return { active: false };
      return data.progress || { active: false };
    } catch {
      return { active: false, endpointUnavailable: true };
    }
  }

  async runScan(projectPath, options = {}) {
    if (isDemoMode() && !isLocalDevHost()) {
      const err = new Error('Demo mode is read-only');
      err.code = 'demo_readonly';
      throw err;
    }
    const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: projectPath || undefined, fullDirectoryScan: options.fullDirectoryScan !== false })
    }, 600000);
    const data = await readJsonResponseBody(res, {});
    if (!res.ok) {
      if (data.partialReport) {
        this.report = await this.enrichReport(data.partialReport);
        return {
          ...data,
          report: this.report,
          projectPath: projectPath || data.projectPath,
          gateFailed: true
        };
      }
      throw new Error(data.error || data.message || 'Scan failed');
    }
    const resolvedPath = projectPath || data.projectPath || null;
    try {
      this.report = await this.fetchReport(resolvedPath);
    } catch {
      this.report = data.report ? await this.enrichReport(data.report) : null;
    }
    return {
      ...data,
      report: this.report,
      projectPath: resolvedPath || data.projectPath,
      gateFailed: Boolean(data.gateFailed)
    };
  }

  async exportReport(report = this.report) {
    let data = report;
    if (!data) {
      const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/report`);
      data = await readJsonResponseBody(res, null);
      if (!data || typeof data !== 'object') {
        throw new Error('Scan report API unavailable on this host (received HTML instead of JSON).');
      }
    }
    downloadJson(data, `simplebeacon-report-${new Date().toISOString().slice(0, 10)}.json`);
  }

  exportDashboard(options = {}) {
    const bundle = buildDashboardExportBundle({
      report: options.report || this.report || null,
      baseline: options.baseline || this.baseline || null,
      config: options.config || null,
      history: options.history || this.history || [],
      dashboardHome: options.dashboardHome || null,
      exportFilename: options.exportFilename || `simplebeacon-dashboard-${new Date().toISOString().slice(0, 10)}.json`
    });
    downloadJson(bundle, bundle.exportFilename || `simplebeacon-dashboard-${new Date().toISOString().slice(0, 10)}.json`);
  }

  exportFilteredIssues(issues, meta = {}) {
    const payload = {
      type: 'simplebeacon-results-export',
      exportedAt: new Date().toISOString(),
      filters: meta,
      issueCount: issues.length,
      issues
    };
    downloadJson(payload, `simplebeacon-results-${new Date().toISOString().slice(0, 10)}.json`);
  }

  exportIssuesCsv(issues) {
    const header = ['severity', 'type', 'description', 'file', 'count', 'recommendedAction'];
/**
 * Escape.
 * @param {any} v
 * @returns {any}
 */
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = issues.map((i) => [
      i.severity,
      i.type,
      i.description,
      i.filePath,
      i.count ?? 1,
      i.recommendedAction
    ].map(escape).join(','));
    downloadText([header.join(','), ...rows].join('\n'), `simplebeacon-results-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  }

  getIssueCategories(report = this.report) {
    if (!report) return [];

    const raw = report.rawIssues || report.detectedIssues || [];
/**
 * Count by type.
 * @param {any} typeMatch
 * @returns {any}
 */
    const countByType = (typeMatch) =>
      raw.filter((i) => typeMatch(i.type)).reduce((s, i) => s + (i.count || 1), 0);

    const credCount = report.credentialFindings ?? countByType((t) => /credential/i.test(t));
    const schemaCount = countByType((t) => /schema/i.test(t));
    const prodCount = report.productionLeakFindings ?? countByType((t) => /production leak/i.test(t));
    const fictionCount = countByType((t) => /fiction|consistency|kpi/i.test(t));
    const dupCount = countByType((t) => /duplicate/i.test(t));
    const typeSafetyCount = countByType((t) => /type-safety|prop-types|any-type|ts-ignore|ts-expect-error|unsafe-type-assertion/i.test(t));
    const categorizedCount = credCount + schemaCount + prodCount + fictionCount + dupCount + typeSafetyCount;
    const totalRaw = raw.reduce((s, i) => s + (i.count || 1), 0);
    const otherCount = Math.max(0, totalRaw - categorizedCount);

/**
 * Max severity.
 * @param {number} count
 * @param {any} defaultSev
 * @returns {any}
 */
    const maxSeverity = (count, defaultSev) => {
      if (count === 0) return 'none';
      const issues = raw.filter((i) => i.count > 0 || i.severity);
      const relevant = issues.filter((i) => i.severity);
      if (!relevant.length) return defaultSev;
      if (relevant.some((i) => i.severity === 'high')) return 'high';
      if (relevant.some((i) => i.severity === 'medium')) return 'medium';
      return 'low';
    };

    return [
      {
        id: 'credentials',
        icon: '🔑',
        title: 'Credential Patterns',
        count: credCount,
        severity: credCount ? 'high' : 'none',
        filter: (i) => /credential/i.test(i.type)
      },
      {
        id: 'schema',
        icon: '📄',
        title: 'Schema Violations',
        count: schemaCount,
        severity: schemaCount ? 'high' : 'none',
        filter: (i) => /schema/i.test(i.type)
      },
      {
        id: 'production',
        icon: '🔗',
        title: 'Production Leaks',
        count: prodCount,
        severity: prodCount ? 'medium' : 'none',
        filter: (i) => /production leak/i.test(i.type)
      },
      {
        id: 'consistency',
        icon: '📊',
        title: 'Consistency Issues',
        count: fictionCount,
        severity: fictionCount ? maxSeverity(fictionCount, 'medium') : 'none',
        filter: (i) => /fiction|consistency|kpi/i.test(i.type)
      },
      {
        id: 'consolidation',
        icon: '🔀',
        title: 'Duplicate Data',
        count: dupCount,
        severity: dupCount ? 'low' : 'none',
        filter: (i) => /duplicate/i.test(i.type)
      },
      {
        id: 'type-safety',
        icon: '🛡️',
        title: 'Type Safety',
        count: typeSafetyCount,
        severity: typeSafetyCount ? maxSeverity(typeSafetyCount, 'low') : 'none',
        filter: (i) => /type-safety|prop-types|any-type|ts-ignore|ts-expect-error|unsafe-type-assertion/i.test(i.type)
      },
      {
        id: 'other',
        icon: '📁',
        title: 'Other Findings',
        count: otherCount,
        severity: otherCount ? 'low' : 'none',
        filter: (i) =>
          !/credential|schema|production leak|fiction|consistency|kpi|duplicate|type-safety|prop-types|any-type|ts-ignore|ts-expect-error|unsafe-type-assertion/i.test(i.type)
      }
    ];
  }

  formatRelativeTime(isoString) {
    if (!isoString) return 'Never';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  basename(filePath) {
    if (!filePath) return '—';
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }
}

/**
 * Scan service.
 */
export const scanService = new ScanService();
