import * as http from 'http';

/**
 * Local empty payloads for cloud-only dashboard APIs.
 * The VS Code data server does not run the hosted platform routes; returning
 * 200 + empty collections stops the dashboard from 404-spamming and retrying.
 */
function sendJson(res: http.ServerResponse, body: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function emptyList(key: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { success: true, local: true, found: false, [key]: [], ...extra };
}

function matchProviderFailover(pathname: string): Record<string, unknown> | null {
  if (!pathname.startsWith('/api/provider-failover')) return null;
  if (pathname.endsWith('/stats')) {
    return {
      success: true,
      local: true,
      stats: { totalFailovers: 0, healthy: 0, unhealthy: 0 },
    };
  }
  if (pathname.endsWith('/providers')) return emptyList('providers');
  if (pathname.includes('/events')) return emptyList('events');
  if (pathname.endsWith('/config') || pathname.endsWith('/config/reset')) {
    return {
      success: true,
      local: true,
      config: {
        enabled: false,
        failoverChain: [],
        latencyThresholdMs: 10000,
        latencyOpenThresholdMs: 15000,
        latencyOpenConsecutiveCount: 3,
        healthCheckJitterMs: 2000,
        circuitBreaker: { failureThreshold: 5, recoveryTimeoutMs: 60000 },
      },
    };
  }
  return { success: true, local: true };
}

function matchIdentityFederation(pathname: string): Record<string, unknown> | null {
  if (!pathname.startsWith('/api/identity-federation')) return null;
  if (pathname.endsWith('/stats')) return { success: true, local: true, stats: { connections: 0 } };
  if (pathname.endsWith('/config')) return { success: true, local: true, config: { enabled: false } };
  if (pathname.includes('/history')) return emptyList('history');
  return { success: true, local: true };
}

function matchSemanticCache(pathname: string): Record<string, unknown> | null {
  if (!pathname.startsWith('/api/semantic-cache')) return null;
  if (pathname.endsWith('/stats')) return { success: true, local: true, stats: { hits: 0, misses: 0, entries: 0 } };
  if (pathname.endsWith('/config')) return { success: true, local: true, config: { enabled: false } };
  if (pathname.includes('/entries')) return emptyList('entries');
  return { success: true, local: true };
}

function matchWebhookSigning(pathname: string): Record<string, unknown> | null {
  if (!pathname.startsWith('/api/webhook-signing')) return null;
  if (pathname.endsWith('/stats')) return { success: true, local: true, stats: { deliveries: 0 } };
  if (pathname.endsWith('/config')) return { success: true, local: true, config: { enabled: false } };
  if (pathname.endsWith('/keys')) return emptyList('keys');
  if (pathname.includes('/deliveries')) return emptyList('deliveries');
  return { success: true, local: true };
}

function matchAgentic(pathname: string): Record<string, unknown> | null {
  if (!pathname.startsWith('/api/agentic')) return null;
  if (pathname.endsWith('/stats')) return { success: true, local: true, stats: { agents: 0, executions: 0 } };
  if (pathname.endsWith('/agents')) return emptyList('agents');
  if (pathname.endsWith('/executions')) return emptyList('executions');
  if (pathname.endsWith('/tools')) return emptyList('tools');
  return { success: true, local: true };
}

function matchToolSchemas(pathname: string): Record<string, unknown> | null {
  if (!pathname.startsWith('/api/tool-schemas')) return null;
  if (pathname.endsWith('/stats')) return { success: true, local: true, stats: { schemas: 0, violations: 0 } };
  if (pathname.includes('/violations')) return emptyList('violations');
  if (pathname.endsWith('/config')) return { success: true, local: true, config: { enabled: false } };
  if (pathname === '/api/tool-schemas') {
    return { success: true, local: true, schemas: { builtin: {}, custom: {} } };
  }
  return { success: true, local: true };
}

function matchExactDashboardStubs(pathname: string): unknown {
  switch (pathname) {
    case '/api/audit/interdiction/stream/status':
      return {
        success: true,
        local: true,
        enabled: false,
        windowMs: 60000,
        ttlMs: 300000,
        thresholds: {},
        totalFailuresInWindow: 0,
        stats: {
          totalFailuresRecorded: 0,
          totalAutoInterdicts: 0,
          lastAutoInterdict: null,
          byType: {},
        },
        recentFailures: [],
        byKey: {},
      };
    case '/api/audit/quarantine':
      return {
        success: true,
        local: true,
        totalEntries: 0,
        entries: [],
        metadata: { totalQuarantined: 0 },
      };
    case '/api/audit/pii/orgs':
      return emptyList('orgs', { organizations: [] });
    case '/api/audit/log':
      return emptyList('entries', { total: 0, offset: 0, limit: 0 });
    case '/api/audit/pii/sync-history':
      return {
        success: true,
        local: true,
        totalSyncs: 0,
        totalCloned: 0,
        totalSkipped: 0,
        totalRemoved: 0,
        mergeCount: 0,
        replaceCount: 0,
        timeline: [],
        actors: [],
        sourceOrgs: [],
        recent: [],
        days: 30,
      };
    case '/api/trust/history':
      return { success: true, local: true, history: [], snapshots: [] };
    case '/api/vault/consensus/status':
      return { success: true, local: true, status: 'local', healthy: true, peers: 0 };
    case '/api/outreach/campaign-state':
      return {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prospects: {},
        stats: {
          totalContacted: 0,
          totalReplies: 0,
          totalMeetings: 0,
          totalPilots: 0,
          totalClosed: 0,
        },
      };
    case '/api/outreach/prospects':
      return [];
    case '/api/enterprise/organizations':
      return emptyList('organizations');
    case '/api/workspace/sandbox-summary':
      return {
        success: true,
        local: true,
        orgId: 'default',
        sso: { count: 0, providers: [] },
        integrations: { count: 0, types: {} },
        webhooks: { count: 0, targets: [] },
      };
    case '/api/workspace/budgets':
      return emptyList('budgets');
    case '/api/telemetry/collect':
      return emptyList('items', { page: 1, limit: 25, total: 0 });
    case '/api/telemetry/datasets':
      return emptyList('datasets');
    case '/api/webhook-events':
      return emptyList('events');
    case '/api/webhook-events/stats':
      return { success: true, local: true, stats: { total: 0, byType: {}, byStatus: {} } };
    case '/api/ops-report/status':
      return { success: true, local: true, status: 'idle', lastRun: null };
    case '/api/license/seats':
      return {
        success: true,
        local: true,
        maxSeats: 1,
        seatsUsed: 0,
        seatsRemaining: 1,
        tier: 'local',
        seats: [],
        pendingInvites: [],
      };
    case '/api/user/subscription':
      return { success: true, local: true, subscription: null };
    case '/api/whitelabel/resolve':
      return { success: true, local: true, found: false };
    case '/api/sso/resolve':
      return { success: true, local: true, found: false, sso: false };
    case '/api/auth/refresh':
      return { success: true, local: true, refreshed: false };
    default:
      return null;
  }
}

/**
 * @returns true if the request was handled
 */
export function handleLocalDashboardStubs(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  parsed: URL
): boolean {
  const pathname = parsed.pathname || '';
  if (!pathname.startsWith('/api/')) return false;

  if (pathname.startsWith('/api/audit/pii/policies/')) {
    const orgId = decodeURIComponent(pathname.slice('/api/audit/pii/policies/'.length) || 'default');
    sendJson(res, { success: true, local: true, orgId, policies: [] });
    return true;
  }

  const body =
    matchExactDashboardStubs(pathname) ||
    matchProviderFailover(pathname) ||
    matchIdentityFederation(pathname) ||
    matchSemanticCache(pathname) ||
    matchWebhookSigning(pathname) ||
    matchAgentic(pathname) ||
    matchToolSchemas(pathname);

  if (!body) return false;
  sendJson(res, body);
  return true;
}
