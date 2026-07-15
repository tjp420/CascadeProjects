import { fetchWithTimeout } from '../utils.js';
import { authService } from './authService.js?v=20260713sync6';
import { billingService } from './billingService.js';
import { fetchDataCleanupScan as fetchDataCleanupAnalysis } from './analyzeService.js';
import { spaUrl } from '../platformRoutes.js';
import { readJsonResponseBody } from '../lib/recoverable-fetch.js';
import { DEMO_EMAIL } from '../demoMode.js';

// simplebeacon:production-leak-intent: web-data-sample - Legitimate web data path detection for platform service functionality

export { spaUrl };

const PLATFORM = {
  dashboardHome: '/api/dashboard-home',
  devTools: '/api/dev-tools/tools',
  devWorkflows: '/api/dev-tools/workflows',
  coverageOverview: '/api/coverage-reports/overview',
  securityOverview: '/api/security/overview',
  securityNpmAudit: '/api/security/npm-audit',
  qualityOverview: '/api/quality/overview',
  help: '/api/help'
};

/**
 * Build network error message.
 * @param {any} target
 * @param {any} error
 * @returns {any}
 */
function buildNetworkErrorMessage(target, error) {
  const detail = error?.message ? ` (${error.message})` : '';
  return `Network request failed for ${target}${detail}. Verify the dashboard API server is running and reachable, then retry.`;
}

/**
 * Fetch json.
 * @param {string} url
 * @param {Array} timeoutMs
 * @returns {any}
 */
async function fetchJson(url, timeoutMs = 10000) {
  let httpResponse;
  try {
    httpResponse = await fetchWithTimeout(url, { headers: authService.getAuthHeaders() }, timeoutMs);
  } catch (error) {
    throw new Error(buildNetworkErrorMessage(url, error));
  }
  if (httpResponse.status === 401) {
    authService.clearSession();
    throw new Error(`Session expired — sign in again at #/signin (${DEMO_EMAIL}).`);
  }
  if (!httpResponse.ok) {
    const body = await httpResponse.text().catch(() => '');
    throw new Error(`Failed to load ${url}${body ? ` (${httpResponse.status}: ${body.slice(0, 120)})` : ` (${httpResponse.status})`}`);
  }
  return readJsonResponseBody(httpResponse, {});
}

/**
 * Platform service.
 */
export class PlatformService {
  constructor() {
    this.dashboardHome = null;
    this.devTools = null;
    this.devWorkflows = null;
    this.coverage = null;
    this.security = null;
    this.npmAudit = null;
    this.quality = null;
    this.help = null;
  }

  async fetchAll() {
    const results = await Promise.allSettled([
      fetchJson(PLATFORM.dashboardHome).then((d) => { this.dashboardHome = d.data || d; }),
      fetchJson(PLATFORM.devTools).then((d) => { this.devTools = Array.isArray(d) ? d : d.tools || []; }),
      fetchJson(PLATFORM.devWorkflows).then((d) => { this.devWorkflows = Array.isArray(d) ? d : d.workflows || []; }),
      fetchJson(PLATFORM.coverageOverview).then((d) => { this.coverage = d; }),
      fetchJson(PLATFORM.securityOverview).then((d) => { this.security = d; }),
      fetchJson(PLATFORM.qualityOverview).then((d) => { this.quality = d; }),
      fetchJson(PLATFORM.help).then((d) => { this.help = d.data || d; })
    ]);
    return results;
  }

  async refreshNpmAudit(options = {}) {
    const headers = {
      ...authService.getAuthHeaders(),
      ...billingService.getAuthHeaders()
    };
    if (options.force) {
      const npmAuditHttpResponse = await fetch(PLATFORM.securityNpmAudit, { method: 'POST', headers });
      const npmAuditPayload = await readJsonResponseBody(npmAuditHttpResponse, {});
      if (!npmAuditHttpResponse.ok) {
        throw new Error(npmAuditPayload.message || npmAuditPayload.error || 'npm audit failed');
      }
      this.npmAudit = npmAuditPayload;
      return this.npmAudit;
    }
    this.npmAudit = await fetchJson(PLATFORM.securityNpmAudit);
    return this.npmAudit;
  }

  async runBaselineSync() {
    const syncHttpResponse = await fetch('/api/simplebeacon/tools/baseline-sync', {
      method: 'POST',
      headers: {
        ...authService.getAuthHeaders(),
        ...billingService.getAuthHeaders()
      }
    });
    const syncResponseBody = await readJsonResponseBody(syncHttpResponse, {});
    if (!syncHttpResponse.ok) throw new Error(syncResponseBody.message || syncResponseBody.error || 'Baseline sync failed');
    return syncResponseBody;
  }

  async fetchMergerReductionScan(projectPath) {
    const params = new URLSearchParams({ scope: 'repository', _: String(Date.now()) });
    if (projectPath) params.set('projectPath', projectPath);
    const data = await fetchJson(`/api/merger-tool/reduction-scan?${params}`, 180000);
    const report = data.data || data;
    this.mergerReductionScan = report;
    return report;
  }

  async fetchDataCleanupScan(projectPath, options = {}) {
    const report = await fetchDataCleanupAnalysis(projectPath, options);
    this.dataCleanupScan = report;
    return report;
  }

  /** Deep-link within Simplebeacon SPA */
  spaLink(view) {
    return spaUrl(view);
  }
}

/**
 * Platform service.
 */
export const platformService = new PlatformService();

/** Consolidated feature catalog — one card per distinct SPA destination */
export const FEATURE_CATALOG = [
  {
    group: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: '📊',
        route: 'dashboard',
        description: 'Last scan, consistency score, mock/sample scope, issue categories, and rescan'
      },
      {
        id: 'platform',
        label: 'Platform overview',
        icon: '📈',
        route: 'platform',
        description: 'Engineering baseline, Jest health, schema pass rate, and live vs sample metrics'
      },
      {
        id: 'pricing',
        label: 'Pricing',
        icon: '💳',
        route: 'pricing',
        description: 'Community CLI ($0), Cloud Teams ($49/mo), Enterprise Perimeter (from $5,000 setup)'
      }
    ]
  },
  {
    group: 'Scan & Analyze',
    items: [
      {
        id: 'complete-scan',
        label: 'Complete scan',
        icon: '⚡',
        route: 'analyze',
        analyzeMode: 'complete',
        description: 'Full gate bundle — all eight scans including file reduction, data quality, and cleanup assistant (dry-run)'
      },
      {
        id: 'simplebeacon-scan',
        label: 'Simplebeacon scan',
        icon: '🛡️',
        route: 'analyze',
        analyzeMode: 'simplebeacon',
        description: 'Deterministic gate on .simplebeacon/config.json scanPaths and all rules'
      },
      {
        id: 'mock-scan',
        label: 'Mock data scan',
        icon: '🔍',
        route: 'analyze',
        analyzeMode: 'mock-scan',
        description: 'Fiction/KPI digest scoped to sample paths — not a full-repo semantic walk'
      },
      {
        id: 'consolidation',
        label: 'Data consolidation',
        icon: '🔀',
        route: 'analyze',
        analyzeMode: 'consolidation',
        description: 'Duplicate JSON groups, similar schemas, and oversized files in sample paths'
      },
      {
        id: 'codebase',
        label: 'Codebase analysis',
        icon: '🧹',
        route: 'analyze',
        analyzeMode: 'codebase',
        description: 'Technical debt markers, broken JSON/syntax, debug artifacts, placeholders, ESLint'
      },
      {
        id: 'file-reduction',
        label: 'File reduction',
        icon: '📦',
        route: 'analyze',
        analyzeMode: 'file-reduction',
        description: 'Build artifacts, duplicate assets, and unused file candidates (dry-run reclaim estimate)'
      },
      {
        id: 'data-quality',
        label: 'Data quality',
        icon: '🧪',
        route: 'analyze',
        analyzeMode: 'data-quality',
        description: 'Config sprawl, env keys, stale mock data, privacy leaks, lineage, and JSON shape drift'
      },
      {
        id: 'roadmap',
        label: 'Roadmap analysis',
        icon: '🗺️',
        route: 'analyze',
        analyzeMode: 'roadmap',
        description: 'Filesystem sprint scan for planning — exports belong in reports/, not sample directories'
      },
      {
        id: 'auto-scan',
        label: 'Auto mode',
        icon: '🤖',
        route: 'analyze',
        analyzeMode: 'auto',
        description: 'Picks Simplebeacon for platform or mock paths; roadmap for other directories'
      }
    ]
  },
  {
    group: 'Results & Compliance',
    items: [
      {
        id: 'results',
        label: 'Issue results',
        icon: '📋',
        route: 'results',
        description: 'Filter by severity and category — empty with gate PASS means a clean scan'
      },
      {
        id: 'audit',
        label: 'Compliance audit',
        icon: '🛡️',
        route: 'audit',
        description: 'All layers — credentials, fiction KPIs, schema, leaks, roadmap, Jest, npm audit'
      },
      {
        id: 'security',
        label: 'Security scanner',
        icon: '🔒',
        route: 'security',
        description: 'Credential patterns and production-leak findings from live Simplebeacon scan'
      },
      {
        id: 'quality',
        label: 'Quality & security',
        icon: '🔒',
        route: 'quality',
        description: 'Live npm audit with dependency count, security checklist, and coverage posture'
      }
    ]
  },
  {
    group: 'Enterprise',
    items: [
      {
        id: 'assessments',
        label: 'Assessment portal',
        icon: '📑',
        route: 'assessments',
        description: 'Client M&A flow — clone repo or scan local path (signed-in) → assessment JSON'
      }
    ]
  },
  {
    group: 'Tools & Configuration',
    items: [
      {
        id: 'tools',
        label: 'Tools & workflows',
        icon: '🔧',
        route: 'tools',
        description: 'Run scans, sync baseline, npm audit, dev tools catalog, and CI workflows'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: '⚙️',
        route: 'settings',
        description: 'Edit scan paths, rule toggles, gate policy, and profile presets — saves to config.json'
      },
      {
        id: 'help',
        label: 'Help & docs',
        icon: '❓',
        route: 'help',
        description: 'Scan number glossary, dashboard pages, CLI commands, and FAQ'
      }
    ]
  }
];

/** @deprecated Use FEATURE_CATALOG */
export const LEGACY_SECTIONS = FEATURE_CATALOG;
