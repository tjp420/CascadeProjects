import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  Activity,
  Target,
  Zap,
} from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { apiUrl, authHeaders } from '@/config';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ScanHistoryEntry {
  scanId: string;
  date: string;
  issueCount: number;
  qualityScore: number;
  gatePass: boolean;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info?: number;
  };
  fictionPatternsFound: number;
  totalFilesScanned: number;
}

interface MetricsState {
  history: ScanHistoryEntry[];
  loading: boolean;
  error: string | null;
}

const GATE_PASS_COLOR = '#22c55e';
const GATE_FAIL_COLOR = '#ef4444';
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return isoDate.slice(0, 10);
  }
}

function computeStats(history: ScanHistoryEntry[]) {
  if (!history.length) {
    return {
      totalScans: 0,
      avgQualityScore: 0,
      gatePassRate: 0,
      totalIssues: 0,
      totalFiles: 0,
      totalFiction: 0,
      latestScore: 0,
      latestGatePass: false,
      scoreTrend: 'flat' as 'up' | 'down' | 'flat',
    };
  }
  const totalScans = history.length;
  const scores = history.map((h) => h.qualityScore ?? 0);
  const passes = history.filter((h) => h.gatePass).length;
  const totalIssues = history.reduce((sum, h) => sum + (h.issueCount ?? 0), 0);
  const totalFiles = history.reduce((sum, h) => sum + (h.totalFilesScanned ?? 0), 0);
  const totalFiction = history.reduce((sum, h) => sum + (h.fictionPatternsFound ?? 0), 0);
  const avgQualityScore = Math.round(scores.reduce((a, b) => a + b, 0) / totalScans);
  const gatePassRate = Math.round((passes / totalScans) * 100);
  const latest = history[history.length - 1];
  const latestScore = latest?.qualityScore ?? 0;
  const latestGatePass = latest?.gatePass ?? false;

  let scoreTrend: 'up' | 'down' | 'flat' = 'flat';
  if (history.length >= 2) {
    const prev = history[history.length - 2]?.qualityScore ?? 0;
    if (latestScore > prev) scoreTrend = 'up';
    else if (latestScore < prev) scoreTrend = 'down';
  }

  return {
    totalScans,
    avgQualityScore,
    gatePassRate,
    totalIssues,
    totalFiles,
    totalFiction,
    latestScore,
    latestGatePass,
    scoreTrend,
  };
}

export function TeamMetricsView() {
  const [state, setState] = useState<MetricsState>({
    history: [],
    loading: true,
    error: null,
  });

  const loadData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Try localStorage first (same pattern as ProfileView)
      let history: ScanHistoryEntry[] = [];
      try {
        const raw = localStorage.getItem('sb_scan_history');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) history = parsed;
        }
      } catch {
        /* ignore parse errors */
      }

      // Fallback to API if localStorage is empty
      if (history.length === 0) {
        try {
          const resp = await fetch(apiUrl('/simplebeacon/history'), { headers: authHeaders() });
          if (resp.ok) {
            const body = await resp.json();
            if (Array.isArray(body)) history = body;
            else if (body?.history && Array.isArray(body.history)) history = body.history;
          }
        } catch {
          /* ignore network errors */
        }
      }

      setState({ history, loading: false, error: null });
    } catch (e) {
      setState({
        history: [],
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load metrics',
      });
    }
  }, []);

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    loadData();
  }, [loadData]);

  const { history, loading, error } = state;
  const stats = computeStats(history);

  // Prepare chart data
  const trendData = history.map((h) => ({
    date: formatDate(h.date),
    qualityScore: h.qualityScore ?? 0,
    issueCount: h.issueCount ?? 0,
    gatePass: h.gatePass ? 1 : 0,
  }));

  const latestEntry = history[history.length - 1];
  const severityData = latestEntry
    ? [
        {
          name: 'Critical',
          value: latestEntry.severityCounts?.critical ?? 0,
          color: SEVERITY_COLORS.critical,
        },
        { name: 'High', value: latestEntry.severityCounts?.high ?? 0, color: SEVERITY_COLORS.high },
        {
          name: 'Medium',
          value: latestEntry.severityCounts?.medium ?? 0,
          color: SEVERITY_COLORS.medium,
        },
        { name: 'Low', value: latestEntry.severityCounts?.low ?? 0, color: SEVERITY_COLORS.low },
      ].filter((d) => d.value > 0)
    : [];

  const gateData = [
    { name: 'Pass', value: history.filter((h) => h.gatePass).length, color: GATE_PASS_COLOR },
    { name: 'Fail', value: history.filter((h) => !h.gatePass).length, color: GATE_FAIL_COLOR },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Team Metrics</h1>
        </div>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Loading scan history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Team Metrics</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <XCircle className="h-10 w-10 text-danger" />
            <p className="text-sm text-danger">{error}</p>
            <Button size="sm" onClick={loadData} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Team Metrics</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Activity className="h-12 w-12 text-foreground-muted" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">No scan history yet</p>
              <p className="text-sm text-foreground-muted">
                Run a scan to start tracking quality scores, issue trends, and gate compliance over
                time.
              </p>
            </div>
            <Button onClick={() => navigate('analyze')} className="gap-2">
              <FileCode className="h-4 w-4" /> Run First Scan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team Metrics</h1>
            <p className="text-sm text-foreground-muted">
              Anonymized compliance telemetry across {stats.totalScans} scan
              {stats.totalScans !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label="Avg Quality Score"
          value={`${stats.avgQualityScore}%`}
          subtitle={`Latest: ${stats.latestScore}%`}
          trend={stats.scoreTrend}
        />
        <StatCard
          icon={Shield}
          label="Gate Pass Rate"
          value={`${stats.gatePassRate}%`}
          subtitle={`${history.filter((h) => h.gatePass).length}/${stats.totalScans} scans passed`}
          color={
            stats.gatePassRate >= 80 ? 'success' : stats.gatePassRate >= 50 ? 'warning' : 'danger'
          }
        />
        <StatCard
          icon={AlertTriangle}
          label="Total Issues"
          value={stats.totalIssues.toLocaleString()}
          subtitle={`Across all scans`}
          color={stats.totalIssues > 0 ? 'warning' : 'success'}
        />
        <StatCard
          icon={FileCode}
          label="Files Scanned"
          value={stats.totalFiles.toLocaleString()}
          subtitle={`${stats.totalFiction} fiction patterns found`}
          color="info"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quality Score Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Quality Score Trend
            </CardTitle>
            <CardDescription>Score progression over recent scans</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card, #fff)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="qualityScore"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Quality Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Issue Count Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Issue Count Trend
            </CardTitle>
            <CardDescription>Issue volume over recent scans</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="issueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card, #fff)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="issueCount"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#issueGradient)"
                  name="Issues"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Severity Breakdown — Latest Scan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-danger" />
              Severity Breakdown
            </CardTitle>
            <CardDescription>
              {latestEntry ? `Latest scan — ${formatDate(latestEntry.date)}` : 'Latest scan'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {severityData.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <p className="text-sm text-foreground-muted">No issues found in latest scan</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={severityData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card, #fff)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gate Pass/Fail Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-success" />
              Gate Pass / Fail
            </CardTitle>
            <CardDescription>Compliance gate results across all scans</CardDescription>
          </CardHeader>
          <CardContent>
            {gateData.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Shield className="h-8 w-8 text-foreground-muted" />
                <p className="text-sm text-foreground-muted">No gate data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={gateData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {gateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card, #fff)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
          <CardDescription>Detailed history of recent scan results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Gate</th>
                  <th className="pb-2 pr-4">Quality</th>
                  <th className="pb-2 pr-4">Issues</th>
                  <th className="pb-2 pr-4">Critical</th>
                  <th className="pb-2 pr-4">High</th>
                  <th className="pb-2 pr-4">Medium</th>
                  <th className="pb-2 pr-4">Low</th>
                  <th className="pb-2">Files</th>
                </tr>
              </thead>
              <tbody>
                {[...history]
                  .reverse()
                  .slice(0, 10)
                  .map((entry) => (
                    <tr key={entry.scanId} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-4 text-foreground-muted">{formatDate(entry.date)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={entry.gatePass ? 'success' : 'danger'} className="text-xs">
                          {entry.gatePass ? 'PASS' : 'FAIL'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-medium">{entry.qualityScore ?? 0}%</td>
                      <td className="py-2 pr-4">{entry.issueCount ?? 0}</td>
                      <td className="py-2 pr-4 text-danger">
                        {entry.severityCounts?.critical ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-warning">{entry.severityCounts?.high ?? 0}</td>
                      <td className="py-2 pr-4 text-foreground-muted">
                        {entry.severityCounts?.medium ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-info">{entry.severityCounts?.low ?? 0}</td>
                      <td className="py-2 text-foreground-muted">{entry.totalFilesScanned ?? 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'muted',
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  color?: 'info' | 'success' | 'warning' | 'danger' | 'muted';
  trend?: 'up' | 'down' | 'flat';
}) {
  const colorMap = {
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    muted: 'text-foreground-muted',
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-md bg-muted ${colorMap[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground-muted">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold">{value}</span>
            {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-success" />}
            {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-danger" />}
          </div>
          {subtitle && <span className="text-xs text-foreground-muted">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
