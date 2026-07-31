import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  RefreshCw,
  Activity,
  Users,
  Database,
  AlertTriangle,
  Gauge,
  TrendingUp,
  Zap,
  Clock,
  Wifi,
  WifiOff,
  Download,
  FileText,
  FileJson,
} from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';
import { useAnalyticsSocket } from '@/hooks/useAnalyticsSocket';
import { toast } from 'sonner';

type DashboardSummary = {
  orgId: string;
  generatedAt: string;
  windowHours: number;
  windowStart: string;
  summary: {
    totalVolume: number;
    totalRiskActions: number;
    riskDensity: number;
    uniqueActors: number;
    uniqueEntities: number;
  };
  topActors: { key: string; count: number }[];
  topEntities: { key: string; count: number }[];
  topActions: { key: string; count: number }[];
  hourlyVolume: { hour: string; volume: number; riskCount: number }[];
};

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

const REFRESH_INTERVAL_MS = 30_000;

export function AnalyticsDashboardView() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowHours, setWindowHours] = useState(24);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WebSocket subscription for real-time ANALYTICS_UPDATE push
  const { pushedSummary, connected: wsConnected } = useAnalyticsSocket(autoRefresh);

  // When a pushed summary arrives, update state immediately (no polling needed)
  useEffect(() => {
    if (pushedSummary) {
      setSummary(pushedSummary);
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    }
  }, [pushedSummary]);

  const fetchSummary = useCallback(async (wh: number) => {
    try {
      setError(null);
      const resp = await fetch(apiUrl(`/audit/analytics/dashboard?windowHours=${wh}`), {
        headers: authHeaders(),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.success && data.summary) {
        setSummary(data.summary);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      // Only show toast on first load failure, not on auto-refresh
      if (!summary) {
        toast.error('Failed to load analytics dashboard', { description: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [summary]);

  // Initial load + window change — always fetch via HTTP first for immediate data
  useEffect(() => {
    setLoading(true);
    fetchSummary(windowHours);
  }, [fetchSummary, windowHours]);

  // Auto-refresh polling — only active when WebSocket is NOT connected
  // (WebSocket push handles real-time updates when connected)
  useEffect(() => {
    if (!autoRefresh || wsConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      fetchSummary(windowHours);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, windowHours, fetchSummary, wsConnected]);

  const handleRefresh = () => {
    setLoading(true);
    fetchSummary(windowHours);
  };

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const resp = await fetch(
        apiUrl(`/audit/analytics/export?format=${format}&windowHours=${windowHours}`),
        { headers: authHeaders() }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `audit-analytics-${dateStr}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Export failed', { description: msg });
    }
  }, [windowHours]);

  if (loading && !summary) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Audit Analytics</h1>
          <p className="text-foreground-muted">Real-time audit telemetry and activity metrics</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-foreground-muted" />
            <p className="text-sm text-foreground-muted">Loading analytics...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Audit Analytics</h1>
          <p className="text-foreground-muted">Real-time audit telemetry and activity metrics</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-foreground-muted">Failed to load analytics</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summary) return null;

  const riskDensityPct = Math.round(summary.summary.riskDensity * 100);
  const riskLevel = riskDensityPct > 40 ? 'high' : riskDensityPct > 20 ? 'medium' : 'low';
  const riskColor = riskLevel === 'high' ? 'destructive' : riskLevel === 'medium' ? 'secondary' : 'default';

  // Format hourly data for charts
  const hourlyData = summary.hourlyVolume.map((h) => ({
    ...h,
    timeLabel: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  // Format top actors for bar chart
  const actorData = summary.topActors.map((a) => ({
    name: a.key.length > 20 ? a.key.slice(0, 18) + '...' : a.key,
    count: a.count,
  }));

  // Format top entities for bar chart
  const entityData = summary.topEntities.map((e) => ({
    name: e.key.length > 20 ? e.key.slice(0, 18) + '...' : e.key,
    count: e.count,
  }));

  // Format top actions for pie chart
  const actionData = summary.topActions.map((a) => ({
    name: a.key,
    value: a.count,
  }));

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Analytics</h1>
            <p className="text-foreground-muted">Real-time audit telemetry and activity metrics</p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-foreground-muted flex items-center gap-1">
                <Clock className="h-3 w-3" /> {lastUpdated}
              </span>
            )}
            {/* WebSocket connection indicator */}
            <span className="text-xs flex items-center gap-1" title={wsConnected ? 'Live WebSocket connection' : 'WebSocket disconnected — using polling'}>
              {wsConnected ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-foreground-muted" />
              )}
              {wsConnected ? 'Live' : 'Polling'}
            </span>
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
            >
              <Zap className="h-4 w-4 mr-1" />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {/* Export buttons */}
            <Button
              onClick={() => handleExport('csv')}
              variant="outline"
              size="sm"
              title="Export as CSV"
            >
              <FileText className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              onClick={() => handleExport('json')}
              variant="outline"
              size="sm"
              title="Export as JSON"
            >
              <FileJson className="h-4 w-4 mr-1" />
              JSON
            </Button>
          </div>
        </div>
        {/* Window selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">Rolling window:</span>
          {[1, 6, 24, 72, 168].map((wh) => (
            <Button
              key={wh}
              onClick={() => setWindowHours(wh)}
              variant={windowHours === wh ? 'default' : 'outline'}
              size="sm"
            >
              {wh < 24 ? `${wh}h` : wh === 24 ? '24h' : wh === 168 ? '7d' : `${Math.floor(wh / 24)}d`}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.summary.totalVolume.toLocaleString()}</p>
              <p className="text-xs text-foreground-muted">Total Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.summary.uniqueActors}</p>
              <p className="text-xs text-foreground-muted">Unique Actors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Database className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.summary.uniqueEntities}</p>
              <p className="text-xs text-foreground-muted">Unique Entities</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.summary.totalRiskActions}</p>
              <p className="text-xs text-foreground-muted">Risk Actions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <Gauge className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{riskDensityPct}%</p>
              <p className="text-xs text-foreground-muted">Risk Density</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Density Banner */}
      {riskDensityPct > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-foreground-muted" />
                <span className="text-sm font-medium">Risk Density Index</span>
                <Badge variant={riskColor as any}>
                  {riskLevel.toUpperCase()}
                </Badge>
              </div>
              <span className="text-sm text-foreground-muted">
                {summary.summary.totalRiskActions} of {summary.summary.totalVolume} events are high-severity
                (DELETE, RUN, EVALUATE)
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  riskLevel === 'high' ? 'bg-destructive' : riskLevel === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(riskDensityPct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Hourly Volume Timeline
          </CardTitle>
          <CardDescription>
            Event ingestion velocity over the last {windowHours < 24 ? `${windowHours}h` : windowHours === 168 ? '7 days' : `${Math.floor(windowHours / 24)}d`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="timeLabel" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#volumeGrad)"
                  name="Total Events"
                />
                <Area
                  type="monotone"
                  dataKey="riskCount"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#riskGrad)"
                  name="Risk Events"
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-foreground-muted">
              No volume data in the selected window
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Actors + Top Entities (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Actors
            </CardTitle>
            <CardDescription>Most active users by event count</CardDescription>
          </CardHeader>
          <CardContent>
            {actorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={actorData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Events" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-foreground-muted">
                No actor data
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Top 10 Entities
            </CardTitle>
            <CardDescription>Most targeted resources by event count</CardDescription>
          </CardHeader>
          <CardContent>
            {entityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={entityData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Events" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-foreground-muted">
                No entity data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Distribution Pie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Action Distribution
          </CardTitle>
          <CardDescription>Breakdown of audit events by action type</CardDescription>
        </CardHeader>
        <CardContent>
          {actionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={actionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {actionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-foreground-muted">
              No action data
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <div className="flex items-center justify-between text-xs text-foreground-muted">
        <span>
          Window: {new Date(summary.windowStart).toLocaleString()} — {new Date().toLocaleString()}
        </span>
        <span>Generated: {new Date(summary.generatedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

export default AnalyticsDashboardView;
