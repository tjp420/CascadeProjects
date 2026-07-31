import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Activity,
  RefreshCw,
  Loader2,
  Save,
  RotateCcw,
  Zap,
  ShieldCheck,
  AlertTriangle,
  HeartPulse,
  Trash2,
  Server,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface FailoverStats {
  totalProviders: number;
  healthyProviders: number;
  openCircuits: number;
  halfOpenCircuits: number;
  totalFailovers: number;
  totalRequests: number;
  totalEvents: number;
  failoverChain: string[];
  enabled: boolean;
  healthCheckActive: boolean;
}

interface ProviderStatus {
  providerId: string;
  circuitState: string;
  healthScore: number;
  failures: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  avgLatencyMs: number;
  lastLatency: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  totalFailovers: number;
  successRate: number;
  lastSuccess: string | null;
  lastFailure: string | null;
  openedAt: string | null;
}

interface FailoverEvent {
  id: string;
  timestamp: string;
  fromProvider: string;
  toProvider: string;
  reason: string;
  fromCircuitState: string;
  toCircuitState: string;
}

interface FailoverConfig {
  enabled: boolean;
  failoverChain: string[];
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeoutMs: number;
    halfOpenMaxProbes: number;
  };
  latencyThresholdMs: number;
  healthCheckIntervalMs: number;
  healthCheckEnabled: boolean;
  cooldownMs: number;
}

export function ProviderFailoverDashboard() {
  const [stats, setStats] = useState<FailoverStats | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [events, setEvents] = useState<FailoverEvent[]>([]);
  const [config, setConfig] = useState<FailoverConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resettingAll, setResettingAll] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [failureThreshold, setFailureThreshold] = useState('');
  const [recoveryTimeout, setRecoveryTimeout] = useState('');
  const [latencyThreshold, setLatencyThreshold] = useState('');
  const [chainText, setChainText] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, provResp, evtResp, cfgResp] = await Promise.all([
        fetch(apiUrl('/provider-failover/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/provider-failover/providers'), { headers: authHeaders() }),
        fetch(apiUrl('/provider-failover/events?limit=20'), { headers: authHeaders() }),
        fetch(apiUrl('/provider-failover/config'), { headers: authHeaders() }),
      ]);
      const statsData = await statsResp.json();
      const provData = await provResp.json();
      const evtData = await evtResp.json();
      const cfgData = await cfgResp.json();
      if (statsData.success) setStats(statsData.stats);
      if (provData.success) setProviders(provData.providers || []);
      if (evtData.success) setEvents(evtData.events || []);
      if (cfgData.success) {
        setConfig(cfgData.config);
        setFailureThreshold(String(cfgData.config.circuitBreaker?.failureThreshold || 5));
        setRecoveryTimeout(String(Math.round((cfgData.config.circuitBreaker?.recoveryTimeoutMs || 60000) / 1000)));
        setLatencyThreshold(String(cfgData.config.latencyThresholdMs || 10000));
        setChainText((cfgData.config.failoverChain || []).join(', '));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const resetCircuit = async (id: string) => {
    setResetting(id);
    try {
      const resp = await fetch(apiUrl(`/provider-failover/providers/${id}/reset`), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok || !data.success) { toast.error('Reset failed'); return; }
      toast.success(`${id} circuit reset to closed`);
      fetchAll();
    } catch { toast.error('Reset failed'); } finally { setResetting(null); }
  };

  const resetAllCircuits = async () => {
    setResettingAll(true);
    try {
      const resp = await fetch(apiUrl('/provider-failover/providers/reset-all'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok || !data.success) { toast.error('Reset all failed'); return; }
      toast.success('All circuits reset');
      fetchAll();
    } catch { toast.error('Reset all failed'); } finally { setResettingAll(false); }
  };

  const runHealthCheck = async () => {
    setHealthChecking(true);
    try {
      const resp = await fetch(apiUrl('/provider-failover/health-check'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok || !data.success) { toast.error('Health check failed'); return; }
      toast.success('Health checks complete');
      fetchAll();
    } catch { toast.error('Health check failed'); } finally { setHealthChecking(false); }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const resp = await fetch(apiUrl('/provider-failover/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          failoverChain: chainText.split(',').map((s) => s.trim()).filter(Boolean),
          circuitBreaker: {
            failureThreshold: parseInt(failureThreshold, 10) || 5,
            recoveryTimeoutMs: (parseInt(recoveryTimeout, 10) || 60) * 1000,
          },
          latencyThresholdMs: parseInt(latencyThreshold, 10) || 10000,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) { toast.error('Failed to save config'); return; }
      toast.success('Config saved');
      setConfig(data.config);
    } catch { toast.error('Failed to save config'); } finally { setSaving(false); }
  };

  const toggleEnabled = async () => {
    if (!config) return;
    try {
      const resp = await fetch(apiUrl('/provider-failover/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      const data = await resp.json();
      if (data.success) setConfig(data.config);
    } catch { toast.error('Failed to toggle'); }
  };

  const toggleHealthCheck = async () => {
    if (!config) return;
    try {
      const resp = await fetch(apiUrl('/provider-failover/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ healthCheckEnabled: !config.healthCheckEnabled }),
      });
      const data = await resp.json();
      if (data.success) setConfig(data.config);
    } catch { toast.error('Failed to toggle'); }
  };

  const resetConfig = async () => {
    try {
      const resp = await fetch(apiUrl('/provider-failover/config/reset'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (data.success) { toast.success('Config reset'); fetchAll(); }
    } catch { toast.error('Failed to reset'); }
  };

  const clearEvents = async () => {
    try {
      const resp = await fetch(apiUrl('/provider-failover/events/clear'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (data.success) { toast.success('Events cleared'); fetchAll(); }
    } catch { toast.error('Failed to clear'); }
  };

  const resetStats = async () => {
    try {
      const resp = await fetch(apiUrl('/provider-failover/stats/reset'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (data.success) { toast.success('Stats reset'); fetchAll(); }
    } catch { toast.error('Failed to reset'); }
  };

  const circuitColor = (state: string) => {
    if (state === 'open') return 'destructive';
    if (state === 'half-open') return 'warning';
    return 'success';
  };

  const healthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts; }
  };

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading failover data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Multi-Region Provider Failover & Circuit Breaker
              </CardTitle>
              <CardDescription>
                High-availability state machine for dynamic provider re-routing
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={runHealthCheck} disabled={healthChecking}>
                {healthChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartPulse className="h-3.5 w-3.5" />}
                Health Check
              </Button>
              <Button variant="outline" size="sm" onClick={resetAllCircuits} disabled={resettingAll}>
                {resettingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Reset All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <p className="text-xs text-foreground-muted">Healthy Providers</p>
              </div>
              <p className="text-lg font-semibold">{stats?.healthyProviders ?? 0}/{stats?.totalProviders ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-xs text-foreground-muted">Open Circuits</p>
              </div>
              <p className="text-lg font-semibold">{stats?.openCircuits ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Failovers</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalFailovers ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Requests</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalRequests ?? 0}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={stats?.enabled ? 'success' : 'secondary'} className="text-xs">
              Failover: {stats?.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Badge variant={stats?.healthCheckActive ? 'success' : 'secondary'} className="text-xs">
              Health Checks: {stats?.healthCheckActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Chain: {(stats?.failoverChain || []).join(' → ')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Provider Status Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Provider Circuit Breakers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {providers.map((prov) => (
              <div key={prov.providerId} className="rounded-md border border-border bg-muted/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{prov.providerId}</span>
                    <Badge variant={circuitColor(prov.circuitState) as any} className="text-[10px]">
                      {prov.circuitState}
                    </Badge>
                  </div>
                  <Button
                    variant="outline" size="sm" className="h-6 text-[10px]"
                    onClick={() => resetCircuit(prov.providerId)}
                    disabled={resetting === prov.providerId}
                  >
                    {resetting === prov.providerId ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Reset
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-foreground-muted">Health</span>
                    <p className={`font-semibold ${healthColor(prov.healthScore)}`}>{prov.healthScore}%</p>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Success Rate</span>
                    <p className="font-semibold">{prov.successRate}%</p>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Avg Latency</span>
                    <p className="font-semibold">{prov.avgLatencyMs}ms</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-foreground-muted">
                  <span>Requests: {prov.totalRequests}</span>
                  <span>Failures: {prov.totalFailures}</span>
                  <span>Failovers: {prov.totalFailovers}</span>
                  <span>Cons. failures: {prov.consecutiveFailures}</span>
                </div>
                {prov.openedAt && (
                  <div className="text-[10px] text-red-600">Opened: {formatTime(prov.openedAt)}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Configuration</CardTitle>
              <Button variant="outline" size="sm" onClick={resetConfig}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={config?.enabled ?? false} onChange={toggleEnabled} />
                Failover enabled
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={config?.healthCheckEnabled ?? false} onChange={toggleHealthCheck} />
                Health checks
              </label>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Failover chain (comma-separated)</label>
              <Input value={chainText} onChange={(e) => setChainText(e.target.value)} className="text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-foreground-muted">Failure threshold</label>
                <Input value={failureThreshold} onChange={(e) => setFailureThreshold(e.target.value)} type="number" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Recovery (seconds)</label>
                <Input value={recoveryTimeout} onChange={(e) => setRecoveryTimeout(e.target.value)} type="number" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Latency threshold (ms)</label>
                <Input value={latencyThreshold} onChange={(e) => setLatencyThreshold(e.target.value)} type="number" className="text-sm" />
              </div>
            </div>
            <Button variant="default" size="sm" onClick={saveConfig} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Save Config
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Failover Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Failover Events</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetStats}>
                <Trash2 className="h-3 w-3" /> Reset Stats
              </Button>
              <Button variant="outline" size="sm" onClick={clearEvents}>
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No failover events recorded</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {events.map((evt) => (
                <div key={evt.id} className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="warning" className="text-[10px]">Failover</Badge>
                    <span className="font-mono text-foreground-muted">{formatTime(evt.timestamp)}</span>
                    <span><b>{evt.fromProvider}</b> → <b>{evt.toProvider}</b></span>
                    <span className="text-foreground-muted">({evt.reason})</span>
                  </div>
                  <div className="text-[10px] text-foreground-muted">
                    {evt.fromProvider}: {evt.fromCircuitState} | {evt.toProvider}: {evt.toCircuitState}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
