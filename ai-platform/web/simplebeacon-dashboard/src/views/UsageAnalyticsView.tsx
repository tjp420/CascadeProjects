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
  Shield, Activity, Building2, Gauge, Calendar,
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, trendResp, heatmapResp, reposResp] = await Promise.all([
        fetch(apiUrl('/analytics/stats'), { headers: authHeaders() }),
        fetch(apiUrl(`/analytics/trends?granularity=${granularity}`), { headers: authHeaders() }),
        fetch(apiUrl('/analytics/heatmap'), { headers: authHeaders() }),
        fetch(apiUrl('/analytics/repositories?limit=10'), { headers: authHeaders() }),
      ]);

      if (statsResp.ok) setStats(await statsResp.json());
      if (trendResp.ok) {
        const data = await trendResp.json();
        setTrend(data.trend || []);
      }
      if (heatmapResp.ok) {
        const data = await heatmapResp.json();
        setHeatmap(data.heatmap || []);
      }
      if (reposResp.ok) {
        const data = await reposResp.json();
        setRepositories(data.repositories || []);
      }
    } catch {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [granularity]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
        <div className="flex gap-2 items-center">
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as any)}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
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
    </div>
  );
}
