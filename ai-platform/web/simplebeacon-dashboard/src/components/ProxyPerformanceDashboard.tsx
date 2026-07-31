import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  Gauge,
  Zap,
  Clock,
  TrendingUp,
  RefreshCw,
  Loader2,
  Server,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface PerfStats {
  windowSize: number;
  totalInWindow: number;
  successCount: number;
  failureCount: number;
  ttftAvg: number | null;
  ttftP50: number | null;
  ttftP95: number | null;
  ttftP99: number | null;
  durationAvg: number | null;
  durationP50: number | null;
  durationP95: number | null;
  tokenVelocityAvg: number | null;
  tokenVelocityMax: number | null;
  byProvider: Record<string, { total: number; success: number; fail: number }>;
  queueBackpressure: {
    currentDepth: number;
    peakDepth: number;
    avgDepth: number;
    maxConcurrentObserved: number;
    samplesInWindow: number;
  };
  providerProfileCount: number;
}

interface ProviderProfile {
  provider: string;
  model: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  ttft: { avg: number | null; p50: number | null; p95: number | null; p99: number | null; min: number | null; max: number | null };
  inferenceDuration: { avg: number | null; p50: number | null; p95: number | null; p99: number | null };
  queueWait: { avg: number | null; p50: number | null; p95: number | null };
  tokenVelocity: { avg: number | null; p50: number | null; max: number | null };
  lastUpdated: string | null;
}

interface RecentMetric {
  timestamp: number;
  provider: string;
  model: string;
  success: boolean;
  ttftMs: number | null;
  queueWaitMs: number | null;
  inferenceDurationMs: number | null;
  tokenVelocity: number | null;
  tokenCount: number | null;
  errorType: string | null;
}

interface Rollup {
  intervalStart: number;
  intervalEnd: number;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  ttftAvg: number | null;
  ttftP50: number | null;
  ttftP95: number | null;
  durationAvg: number | null;
  tokenVelocityAvg: number | null;
  byProvider: Record<string, { count: number; success: number; fail: number }>;
}

export function ProxyPerformanceDashboard() {
  const [stats, setStats] = useState<PerfStats | null>(null);
  const [providers, setProviders] = useState<Record<string, ProviderProfile>>({});
  const [recent, setRecent] = useState<RecentMetric[]>([]);
  const [rollups, setRollups] = useState<Rollup[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, provResp, recentResp, rollResp] = await Promise.all([
        fetch(apiUrl('/proxy-performance/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/proxy-performance/providers'), { headers: authHeaders() }),
        fetch(apiUrl('/proxy-performance/recent?limit=30'), { headers: authHeaders() }),
        fetch(apiUrl('/proxy-performance/rollups?limit=30'), { headers: authHeaders() }),
      ]);
      const statsData = await statsResp.json();
      const provData = await provResp.json();
      const recentData = await recentResp.json();
      const rollData = await rollResp.json();
      if (statsData.success) setStats(statsData.stats);
      if (provData.success) setProviders(provData.providers);
      if (recentData.success) setRecent(recentData.metrics || []);
      if (rollData.success) setRollups(rollData.rollups || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const resetMetrics = async () => {
    setResetting(true);
    try {
      const resp = await fetch(apiUrl('/proxy-performance/reset'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to reset metrics');
        return;
      }
      toast.success('Performance metrics reset');
      fetchAll();
    } catch {
      toast.error('Failed to reset metrics');
    } finally {
      setResetting(false);
    }
  };

  const formatMs = (ms: number | null) => (ms !== null ? `${ms}ms` : '—');
  const formatTok = (v: number | null) => (v !== null ? `${v}/s` : '—');
  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return String(ts);
    }
  };

  const providerBadge = (p: string) => {
    if (p === 'openai') return <Badge variant="secondary" className="text-xs">OpenAI</Badge>;
    if (p === 'anthropic') return <Badge variant="secondary" className="text-xs">Anthropic</Badge>;
    if (p === 'ollama') return <Badge variant="outline" className="text-xs">Ollama</Badge>;
    return <Badge variant="outline" className="text-xs">{p}</Badge>;
  };

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading performance metrics...</span>
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
                <Activity className="h-5 w-5 text-primary" />
                Proxy Performance Metrics
              </CardTitle>
              <CardDescription>
                High-resolution window observer — TTFT, queue backpressure, token velocity, and provider latencies
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={resetMetrics} disabled={resetting}>
                {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Core Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">TTFT (avg / p95)</p>
              </div>
              <p className="text-lg font-semibold">{formatMs(stats?.ttftAvg ?? null)}</p>
              <p className="text-xs text-foreground-muted">p95: {formatMs(stats?.ttftP95 ?? null)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Inference (avg / p95)</p>
              </div>
              <p className="text-lg font-semibold">{formatMs(stats?.durationAvg ?? null)}</p>
              <p className="text-xs text-foreground-muted">p95: {formatMs(stats?.durationP95 ?? null)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Token Velocity</p>
              </div>
              <p className="text-lg font-semibold">{formatTok(stats?.tokenVelocityAvg ?? null)}</p>
              <p className="text-xs text-foreground-muted">peak: {formatTok(stats?.tokenVelocityMax ?? null)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Queue Depth</p>
              </div>
              <p className="text-lg font-semibold">{stats?.queueBackpressure?.currentDepth ?? 0}</p>
              <p className="text-xs text-foreground-muted">
                peak: {stats?.queueBackpressure?.peakDepth ?? 0} · max: {stats?.queueBackpressure?.maxConcurrentObserved ?? 0}
              </p>
            </div>
          </div>

          {/* Success/Failure + Window Info */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <Badge variant="success">{stats?.successCount ?? 0} success</Badge>
            <Badge variant={stats?.failureCount ? 'destructive' : 'secondary'}>{stats?.failureCount ?? 0} failures</Badge>
            <span className="text-foreground-muted">
              Window: {stats?.totalInWindow ?? 0} requests · {stats?.providerProfileCount ?? 0} provider profiles
            </span>
          </div>

          {/* Provider Distribution */}
          {stats && Object.keys(stats.byProvider).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byProvider).map(([prov, data]) => (
                <Badge key={prov} variant="outline" className="text-xs">
                  {prov}: {data.total} ({data.success}ok / {data.fail}fail)
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Latency Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Server className="h-4 w-4" />
            Provider Latency Profiles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.keys(providers).length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No provider data yet</p>
          ) : (
            Object.entries(providers).map(([key, p]) => (
              <div key={key} className="rounded-md border border-border bg-muted/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {providerBadge(p.provider)}
                    <Badge variant="outline" className="text-xs font-mono">{p.model}</Badge>
                    <Badge variant={p.successRate >= 95 ? 'success' : p.successRate >= 80 ? 'warning' : 'destructive'} className="text-xs">
                      {p.successRate}% success
                    </Badge>
                  </div>
                  <span className="text-xs text-foreground-muted">{p.totalRequests} requests</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div>
                    <span className="text-foreground-muted">TTFT: </span>
                    <span className="font-mono">avg {formatMs(p.ttft.avg)} · p50 {formatMs(p.ttft.p50)} · p95 {formatMs(p.ttft.p95)}</span>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Duration: </span>
                    <span className="font-mono">avg {formatMs(p.inferenceDuration.avg)} · p95 {formatMs(p.inferenceDuration.p95)}</span>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Queue: </span>
                    <span className="font-mono">avg {formatMs(p.queueWait.avg)} · p95 {formatMs(p.queueWait.p95)}</span>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Velocity: </span>
                    <span className="font-mono">avg {formatTok(p.tokenVelocity.avg)} · max {formatTok(p.tokenVelocity.max)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4" />
            Recent Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No recent requests</p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {recent.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="text-foreground-muted font-mono w-20">{formatTime(m.timestamp)}</span>
                  {providerBadge(m.provider)}
                  <Badge variant={m.success ? 'success' : 'destructive'} className="text-[10px]">
                    {m.success ? 'OK' : 'FAIL'}
                  </Badge>
                  <span className="font-mono">TTFT: {formatMs(m.ttftMs)}</span>
                  <span className="font-mono">Dur: {formatMs(m.inferenceDurationMs)}</span>
                  <span className="font-mono">Q: {formatMs(m.queueWaitMs)}</span>
                  {m.tokenVelocity !== null && <span className="font-mono">{m.tokenVelocity}/s</span>}
                  {m.errorType && <span className="text-destructive">{m.errorType}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical Rollups Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            Historical Rollups (1-min intervals)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rollups.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No rollup data yet</p>
          ) : (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {rollups.slice().reverse().map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="text-foreground-muted font-mono w-24">{formatTime(r.intervalStart)}</span>
                  <Badge variant="outline" className="text-[10px]">{r.totalRequests} req</Badge>
                  <span className="font-mono">TTFT: {formatMs(r.ttftAvg)}</span>
                  <span className="font-mono">Dur: {formatMs(r.durationAvg)}</span>
                  {r.tokenVelocityAvg !== null && <span className="font-mono">{r.tokenVelocityAvg}/s</span>}
                  {r.failureCount > 0 && <Badge variant="destructive" className="text-[10px]">{r.failureCount} fail</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
