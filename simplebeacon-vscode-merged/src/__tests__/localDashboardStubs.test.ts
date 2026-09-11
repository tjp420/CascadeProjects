import * as http from 'http';
import { handleLocalDashboardStubs } from '../routes/localDashboardStubs';

function invoke(pathname: string): { handled: boolean; status: number; body: string } {
  let status = 0;
  let body = '';
  const res = {
    writeHead(code: number) {
      status = code;
    },
    end(payload?: string) {
      body = payload || '';
    },
  } as unknown as http.ServerResponse;
  const handled = handleLocalDashboardStubs(
    {} as http.IncomingMessage,
    res,
    new URL('http://127.0.0.1' + pathname)
  );
  return { handled, status, body };
}

describe('localDashboardStubs', () => {
  it('does not claim non-api or unknown paths', () => {
    expect(invoke('/dashboard').handled).toBe(false);
    expect(invoke('/api/health').handled).toBe(false);
  });

  it('stubs whitelabel, SSO, and auth refresh so the dashboard does not 404', () => {
    const brand = invoke('/api/whitelabel/resolve?domain=127.0.0.1');
    expect(brand.handled).toBe(true);
    expect(JSON.parse(brand.body).found).toBe(false);

    const sso = invoke('/api/sso/resolve?email=admin%40simplebeacon.ai');
    expect(sso.handled).toBe(true);
    expect(JSON.parse(sso.body).found).toBe(false);

    const refresh = invoke('/api/auth/refresh');
    expect(refresh.handled).toBe(true);
    expect(JSON.parse(refresh.body).success).toBe(true);
  });

  it('stubs stream interdiction and quarantine with dashboard shapes', () => {
    const interdiction = invoke('/api/audit/interdiction/stream/status');
    expect(interdiction.handled).toBe(true);
    expect(interdiction.status).toBe(200);
    const interdictionJson = JSON.parse(interdiction.body);
    expect(interdictionJson.enabled).toBe(false);
    expect(Array.isArray(interdictionJson.recentFailures)).toBe(true);

    const quarantine = invoke('/api/audit/quarantine');
    expect(quarantine.status).toBe(200);
    expect(JSON.parse(quarantine.body).entries).toEqual([]);
  });

  it('stubs PII policies and outreach payloads the dashboard can iterate', () => {
    const policies = invoke('/api/audit/pii/policies/org-source');
    expect(policies.handled).toBe(true);
    expect(JSON.parse(policies.body).policies).toEqual([]);

    const prospects = invoke('/api/outreach/prospects');
    expect(Array.isArray(JSON.parse(prospects.body))).toBe(true);

    const campaign = invoke('/api/outreach/campaign-state');
    const campaignJson = JSON.parse(campaign.body);
    expect(campaignJson.prospects).toEqual({});
    expect(campaignJson.stats).toBeTruthy();
  });

  it('stubs provider-failover prefix routes', () => {
    const stats = invoke('/api/provider-failover/stats');
    expect(stats.handled).toBe(true);
    expect(JSON.parse(stats.body).success).toBe(true);
    const providers = invoke('/api/provider-failover/providers');
    expect(JSON.parse(providers.body).providers).toEqual([]);
  });
});
