import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Clock, FileText, ShieldCheck, AlertTriangle } from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';

interface TimelinePoint {
  date: string;
  score: number;
  remediations: number;
  files: number;
}

interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface DashboardMetrics {
  totalScans: number;
  totalFilesAnalyzed: number;
  totalLinesAnalyzed: number;
  totalIssuesRemediated: number;
  developerHoursSaved: number;
  averageComplianceScore: number;
  currentGrade: string;
  severityDistribution: SeverityDistribution;
  timelineData: TimelinePoint[];
}

interface AnalyticsSummaryResponse {
  success: boolean;
  projectSignature: string;
  queryWindowDays: number;
  metrics: DashboardMetrics;
  error?: string;
}

interface AnalyticsDashboardProps {
  projectName: string;
}

function gradeColor(grade: string): string {
  if (grade === 'A') return 'text-emerald-500';
  if (grade === 'B') return 'text-blue-500';
  if (grade === 'C') return 'text-yellow-500';
  if (grade === 'D') return 'text-orange-500';
  return 'text-red-500';
}

const SEVERITY_BARS = [
  { label: 'Critical', key: 'critical' as const, color: '#ef4444' },
  { label: 'High', key: 'high' as const, color: '#f97316' },
  { label: 'Medium', key: 'medium' as const, color: '#eab308' },
  { label: 'Low', key: 'low' as const, color: '#64748b' },
];

const DAYS_OPTIONS = [7, 30, 90];

export function AnalyticsDashboard({ projectName }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [daysWindow, setDaysWindow] = useState(30);

  const loadMetrics = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl('analytics/summary')}?project=${encodeURIComponent(projectName)}&days=${daysWindow}`,
        { headers: { ...authHeaders() } }
      );
      if (!res.ok) {
        if (res.status === 401) throw new Error('Authentication required. Please log in.');
        if (res.status === 400) throw new Error('Project name is required.');
        throw new Error(`Request failed (${res.status})`);
      }
      const json: AnalyticsSummaryResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectName, daysWindow]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-sm text-muted-foreground">Loading compliance metrics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center gap-3 pt-6 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.metrics) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        No scan records found for this project.
      </div>
    );
  }

  const { metrics, projectSignature } = data;
  const points = metrics.timelineData || [];
  const maxSeverity = Math.max(1, ...Object.values(metrics.severityDistribution));

  // SVG line chart coordinates
  const chartW = 500;
  const chartH = 160;
  const pad = 24;
  const svgPoints = points
    .map((p, i) => {
      const x = pad + (i / Math.max(1, points.length - 1)) * (chartW - pad * 2);
      const y = chartH - pad - (p.score / 100) * (chartH - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Compliance Control Center</h2>
          <p className="text-sm text-muted-foreground">
            Project:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {projectSignature}
            </code>
          </p>
        </div>
        <div className="flex gap-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDaysWindow(d)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                daysWindow === d
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Compliance Grade
            </CardDescription>
            <CardTitle className={`text-3xl ${gradeColor(metrics.currentGrade)}`}>
              {metrics.currentGrade}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Avg score: {metrics.averageComplianceScore}/100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Dev Hours Saved
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-500">
              {metrics.developerHoursSaved}h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Senior pipeline time reclaimed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Total Scans
            </CardDescription>
            <CardTitle className="text-3xl">{metrics.totalScans}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {metrics.totalFilesAnalyzed.toLocaleString()} files analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Issues Remediated
            </CardDescription>
            <CardTitle className="text-3xl">{metrics.totalIssuesRemediated}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {metrics.totalLinesAnalyzed.toLocaleString()} lines scanned
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timeline Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Score Trend</CardTitle>
            <CardDescription>Historical quality scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            {points.length < 2 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Insufficient data to render trend chart.
              </div>
            ) : (
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: 'auto' }}>
                {/* Grid lines */}
                <line x1={pad} y1={pad} x2={chartW - pad} y2={pad} stroke="hsl(var(--border))" strokeDasharray="4" />
                <line x1={pad} y1={chartH / 2} x2={chartW - pad} y2={chartH / 2} stroke="hsl(var(--border))" strokeDasharray="4" />
                <line x1={pad} y1={chartH - pad} x2={chartW - pad} y2={chartH - pad} stroke="hsl(var(--border))" />

                {/* Trend line */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  points={svgPoints}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data points */}
                {points.map((p, i) => {
                  const x = pad + (i / Math.max(1, points.length - 1)) * (chartW - pad * 2);
                  const y = chartH - pad - (p.score / 100) * (chartH - pad * 2);
                  return (
                    <circle key={i} cx={x} cy={y} r="4" fill="white" stroke="#3b82f6" strokeWidth="2">
                      <title>{`${p.date}: ${p.score}/100`}</title>
                    </circle>
                  );
                })}
              </svg>
            )}
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Severity Distribution</CardTitle>
            <CardDescription>Active findings by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {SEVERITY_BARS.map((bar) => {
                const count = metrics.severityDistribution[bar.key];
                const widthPct = `${(count / maxSeverity) * 100}%`;
                return (
                  <div key={bar.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{bar.label}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: widthPct, backgroundColor: bar.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
