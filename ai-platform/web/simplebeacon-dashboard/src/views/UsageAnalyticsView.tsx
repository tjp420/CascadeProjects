import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import {
  RefreshCw, TrendingUp, TrendingDown, FileCode, AlertTriangle,
  Shield, Activity, Building2, Gauge, Calendar, Download, FileJson,
  ChevronDown, ChevronRight, Wrench,
} from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';
import { toast } from 'sonner';

type GlobalStats = {
  totalOrgs: number;
  totalScans: number;
  totalFilesAnalyzed: number;
  totalFindings: number;
  severityTotals: { critical: number; high: number; medium: number; low: number; info: number };
  avgPostureScore: number;
  languageBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  orgIds: string[];
};

type TrendPoint = {
  period: string;
  scans: number;
  filesAnalyzed: number;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgPosture: number;
};

type HeatmapEntry = {
  category: string;
  totalFindings: number;
  scanCount: number;
};

type RepositoryEntry = {
  name: string;
  scans: number;
  findings: number;
  lastScanAt: string | null;
};

type RemediationGuidance = {
  strategy: string;
  priority: string;
  description: string;
  steps: string[];
};

type ViolationRow = {
  scanId: string;
  orgId: string;
  timestamp: string;
  repository: string;
  branch: string;
  commitSha: string;
  triggeredBy: string;
  category: string;
  count: number;
  postureScore: number;
  gateStatus: string;
  remediation: RemediationGuidance;
};

const SEVERITY_COLORS = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFAA00',
  low: '#36A64F',
  info: '#4A90D9',
};

const LANGUAGE_COLORS = ['#4A90D9', '#F1E05A', '#3178C6', '#A371F7', '#E34C26', '#89E051', '#DB5855', '#563D7C', '#0DBFED', '#f34b7d'];

export function UsageAnalyticsView() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [days, setDays] = useState<number>(90);
  const [repoFilter, setRepoFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [repoOptions, setRepoOptions] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [violationsTotal, setViolationsTotal] = useState(0);
  const [violationsPage, setViolationsPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const violationsPageSize = 10;

  const fetchFilters = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (repoFilter) params.set('repository', repoFilter);
      const resp = await fetch(apiUrl(`/enterprise/analytics/filters?${params}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setRepoOptions(data.repositories || []);
        setBranchOptions(data.branches || []);
      }
    } catch {
      // silent — filters are optional
    }
  }, [repoFilter]);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('days', String(days));
      if (repoFilter) params.set('repository', repoFilter);
      if (branchFilter) params.set('branch', branchFilter);
      const resp = await fetch(apiUrl(`/enterprise/analytics?${params}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        if (data.stats) setStats(data.stats);
        if (data.trend) setTrend(data.trend || []);
        if (data.heatmap) setHeatmap(data.heatmap || []);
        if (data.repositories) setRepositories(data.repositories || []);
      } else {
        throw new Error('analytics_request_failed');
      }
    } catch {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [granularity, days, repoFilter, branchFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchViolations = useCallback(async (page: number) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(violationsPageSize));
      params.set('offset', String(page * violationsPageSize));
      if (repoFilter) params.set('repository', repoFilter);
      if (branchFilter) params.set('branch', branchFilter);
      const resp = await fetch(apiUrl(`/analytics/violations?${params}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setViolations(data.violations || []);
        setViolationsTotal(data.pagination?.total || 0);
      }
    } catch {
      // silent — violations table is supplementary
    }
  }, [repoFilter, branchFilter]);

  useEffect(() => { fetchViolations(violationsPage); }, [fetchViolations, violationsPage]);

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      params.set('days', String(days));
      if (repoFilter) params.set('repository', repoFilter);
      if (branchFilter) params.set('branch', branchFilter);
      const resp = await fetch(apiUrl(`/analytics/export?${params}`), { headers: authHeaders() });
      if (!resp.ok) throw new Error('export_failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    }
  }, [days, repoFilter, branchFilter]);

  const severityData = stats ? [
    { name: 'Critical', value: stats.severityTotals.critical, fill: SEVERITY_COLORS.critical },
    { name: 'High', value: stats.severityTotals.high, fill: SEVERITY_COLORS.high },
    { name: 'Medium', value: stats.severityTotals.medium, fill: SEVERITY_COLORS.medium },
    { name: 'Low', value: stats.severityTotals.low, fill: SEVERITY_COLORS.low },
  ].filter(d => d.value > 0) : [];

  const languageData = stats ? Object.entries(stats.languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value })) : [];

  const heatmapData = heatmap.slice(0, 10).map(h => ({
    category: h.category.length > 20 ? h.category.slice(0, 18) + '...' : h.category,
    fullName: h.category,
    findings: h.totalFindings,
  }));

  const avgPosture = stats?.avgPostureScore ?? 0;
  const postureColor = avgPosture >= 80 ? '#36A64F'
    : avgPosture >= 60 ? '#FFAA00'
    : avgPosture >= 40 ? '#FF6600'
    : '#FF0000';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Usage Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Scan volumes, violation trends, and compliance posture across all tenants
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={repoFilter}
            onChange={(e) => { setRepoFilter(e.target.value); setBranchFilter(''); }}
          >
            <option value="">All Repositories</option>
            {repoOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={!repoFilter && branchOptions.length === 0}
          >
            <option value="">All Branches</option>
            {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as any)}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={loading}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')} disabled={loading}>
            <FileJson className="h-4 w-4" /> JSON
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalScans ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalOrgs ?? 0} organizations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files Analyzed</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalFilesAnalyzed != null
                ? stats.totalFilesAnalyzed.toLocaleString()
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground">across all scans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Findings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalFindings != null
                ? stats.totalFindings.toLocaleString()
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.severityTotals.critical ?? 0} critical, {stats?.severityTotals.high ?? 0} high
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Posture Score</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: postureColor }}>
              {stats?.avgPostureScore ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">out of 100</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scan Activity Over Time</CardTitle>
            <CardDescription>Files analyzed and findings per {granularity}</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="filesAnalyzed" stroke="#4A90D9" fill="#4A90D9" fillOpacity={0.3} name="Files" />
                  <Area type="monotone" dataKey="totalFindings" stroke="#FF6600" fill="#FF6600" fillOpacity={0.3} name="Findings" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Posture Trend</CardTitle>
            <CardDescription>Average posture score per {granularity}</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgPosture" stroke="#36A64F" strokeWidth={2} name="Posture Score" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                No posture data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Severity & Language Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Severity Distribution</CardTitle>
            <CardDescription>Findings by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            {severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {severityData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
                No severity data
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Language Breakdown</CardTitle>
            <CardDescription>Files analyzed by programming language</CardDescription>
          </CardHeader>
          <CardContent>
            {languageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={languageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4A90D9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
                No language data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Violation Heatmap & Top Repositories */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Violation Heatmap by Category</CardTitle>
            <CardDescription>Top categories by total findings</CardDescription>
          </CardHeader>
          <CardContent>
            {heatmapData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={heatmapData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="findings" fill="#FF6600" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                No heatmap data
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Repositories</CardTitle>
            <CardDescription>Most frequently scanned repositories</CardDescription>
          </CardHeader>
          <CardContent>
            {repositories.length > 0 ? (
              <div className="space-y-2">
                {repositories.map((repo, i) => (
                  <div key={repo.name} className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{i + 1}</Badge>
                      <span className="text-sm font-medium truncate max-w-[200px]">{repo.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{repo.scans} scans</span>
                      <span>{repo.findings.toLocaleString()} findings</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                No repository data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Violations Table with Remediation Guidance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Violations & Remediation Guidance
          </CardTitle>
          <CardDescription>
            {violationsTotal > 0
              ? `${violationsTotal} violation entries — click a row to expand remediation steps`
              : 'No violation data available'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {violations.length > 0 ? (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 text-xs font-medium text-muted-foreground pb-2 border-b">
                <span className="w-6" />
                <span>Category</span>
                <span className="text-right">Count</span>
                <span className="text-center">Priority</span>
                <span className="text-right">Posture</span>
              </div>
              {violations.map((v) => {
                const rowKey = `${v.scanId}-${v.category}`;
                const isExpanded = expandedRow === rowKey;
                const priorityColor = v.remediation.priority === 'critical' ? 'bg-red-500'
                  : v.remediation.priority === 'high' ? 'bg-orange-500'
                  : v.remediation.priority === 'medium' ? 'bg-yellow-500'
                  : 'bg-blue-500';
                return (
                  <div key={rowKey} className="rounded-md">
                    <div
                      className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                      onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                    >
                      <span className="w-6 flex items-center justify-center">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{v.category}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.repository} · {v.branch} · {new Date(v.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="text-right font-medium tabular-nums">{v.count}</span>
                      <span className="flex justify-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${priorityColor}`}>
                          {v.remediation.priority}
                        </span>
                      </span>
                      <span className="text-right tabular-nums text-muted-foreground">{v.postureScore}</span>
                    </div>
                    {isExpanded && (
                      <div className="ml-9 mr-2 mb-2 p-3 rounded-md bg-muted/30 border text-sm space-y-2">
                        <div>
                          <span className="font-medium">Strategy: </span>
                          <Badge variant="outline" className="ml-1">{v.remediation.strategy}</Badge>
                        </div>
                        <p className="text-muted-foreground">{v.remediation.description}</p>
                        <div>
                          <span className="font-medium text-xs">Remediation Steps:</span>
                          <ol className="list-decimal list-inside mt-1 space-y-1 text-xs text-muted-foreground">
                            {v.remediation.steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground pt-1 border-t">
                          <span>Scan: <code className="font-mono">{v.scanId}</code></span>
                          <span>Commit: <code className="font-mono">{v.commitSha}</code></span>
                          <span>Trigger: {v.triggeredBy}</span>
                          <span>Gate: {v.gateStatus}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Pagination */}
              {violationsTotal > violationsPageSize && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Showing {violationsPage * violationsPageSize + 1}–{Math.min((violationsPage + 1) * violationsPageSize, violationsTotal)} of {violationsTotal}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={violationsPage === 0}
                      onClick={() => setViolationsPage(p => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(violationsPage + 1) * violationsPageSize >= violationsTotal}
                      onClick={() => setViolationsPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
              No violations data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
