import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Gauge,
  Timer,
  FileCode,
  Layers,
  Shield,
} from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ScanPaywall } from '@/components/ScanPaywall';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────

interface BatchExecutionEntry {
  scanId: string;
  date: string;
  totalFiles: number;
  totalChunks: number;
  totalBatches: number;
  totalTokensEstimated: number;
  durationMs: number;
  avgChunkTokens: number;
  errors: number;
}

interface ComplianceTrendEntry {
  scanId: string;
  date: string;
  euAiActScore: number; // 0-100
  soc2Score: number; // 0-100
  gateScore: number; // 0-100
  overallScore: number; // 0-100
}

interface IssueResolutionEntry {
  scanId: string;
  date: string;
  newIssues: number;
  resolvedIssues: number;
  netChange: number;
  openTotal: number;
}

interface TelemetryState {
  batchHistory: BatchExecutionEntry[];
  complianceHistory: ComplianceTrendEntry[];
  resolutionHistory: IssueResolutionEntry[];
  loading: boolean;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return isoDate.slice(0, 10);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

// ── Batch execution stats ─────────────────────────────────────────────────

function computeBatchStats(history: BatchExecutionEntry[]) {
  if (!history.length) {
    return {
      totalSweeps: 0,
      totalFiles: 0,
      totalChunks: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      avgFilesPerSweep: 0,
      avgTokensPerChunk: 0,
      totalErrors: 0,
      latestDurationMs: 0,
      durationTrend: 'flat' as 'up' | 'down' | 'flat',
    };
  }
  const totalSweeps = history.length;
  const totalFiles = history.reduce((s, h) => s + h.totalFiles, 0);
  const totalChunks = history.reduce((s, h) => s + h.totalChunks, 0);
  const totalTokens = history.reduce((s, h) => s + h.totalTokensEstimated, 0);
  const totalDurationMs = history.reduce((s, h) => s + h.durationMs, 0);
  const totalErrors = history.reduce((s, h) => s + h.errors, 0);
  const avgDurationMs = Math.round(totalDurationMs / totalSweeps);
  const avgFilesPerSweep = Math.round(totalFiles / totalSweeps);
  const avgTokensPerChunk = totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0;
  const latest = history[history.length - 1];
  const latestDurationMs = latest?.durationMs ?? 0;

  let durationTrend: 'up' | 'down' | 'flat' = 'flat';
  if (history.length >= 2) {
    const prev = history[history.length - 2]?.durationMs ?? 0;
    if (latestDurationMs < prev * 0.9)
      durationTrend = 'down'; // faster = down = good
    else if (latestDurationMs > prev * 1.1) durationTrend = 'up'; // slower = up = bad
  }

  return {
    totalSweeps,
    totalFiles,
    totalChunks,
    totalTokens,
    totalDurationMs,
    avgDurationMs,
    avgFilesPerSweep,
    avgTokensPerChunk,
    totalErrors,
    latestDurationMs,
    durationTrend,
  };
}

// ── Compliance trend stats ────────────────────────────────────────────────

function computeComplianceStats(history: ComplianceTrendEntry[]) {
  if (!history.length) {
    return {
      totalScans: 0,
      avgEuAiAct: 0,
      avgSoc2: 0,
      avgGate: 0,
      avgOverall: 0,
      latestOverall: 0,
      overallTrend: 'flat' as 'up' | 'down' | 'flat',
    };
  }
  const totalScans = history.length;
  const avgEuAiAct = Math.round(history.reduce((s, h) => s + h.euAiActScore, 0) / totalScans);
  const avgSoc2 = Math.round(history.reduce((s, h) => s + h.soc2Score, 0) / totalScans);
  const avgGate = Math.round(history.reduce((s, h) => s + h.gateScore, 0) / totalScans);
  const avgOverall = Math.round(history.reduce((s, h) => s + h.overallScore, 0) / totalScans);
  const latest = history[history.length - 1];
  const latestOverall = latest?.overallScore ?? 0;

  let overallTrend: 'up' | 'down' | 'flat' = 'flat';
  if (history.length >= 2) {
    const prev = history[history.length - 2]?.overallScore ?? 0;
    if (latestOverall > prev) overallTrend = 'up';
    else if (latestOverall < prev) overallTrend = 'down';
  }

  return { totalScans, avgEuAiAct, avgSoc2, avgGate, avgOverall, latestOverall, overallTrend };
}

// ── Issue resolution stats ────────────────────────────────────────────────

function computeResolutionStats(history: IssueResolutionEntry[]) {
  if (!history.length) {
    return {
      totalNew: 0,
      totalResolved: 0,
      netChange: 0,
      currentOpen: 0,
      resolutionRate: 0,
      latestResolved: 0,
      resolutionTrend: 'flat' as 'up' | 'down' | 'flat',
    };
  }
  const totalNew = history.reduce((s, h) => s + h.newIssues, 0);
  const totalResolved = history.reduce((s, h) => s + h.resolvedIssues, 0);
  const netChange = totalNew - totalResolved;
  const currentOpen = history[history.length - 1]?.openTotal ?? 0;
  const resolutionRate = totalNew > 0 ? Math.round((totalResolved / totalNew) * 100) : 0;
  const latestResolved = history[history.length - 1]?.resolvedIssues ?? 0;

  let resolutionTrend: 'up' | 'down' | 'flat' = 'flat';
  if (history.length >= 2) {
    const prev = history[history.length - 2]?.resolvedIssues ?? 0;
    if (latestResolved > prev) resolutionTrend = 'up';
    else if (latestResolved < prev) resolutionTrend = 'down';
  }

  return { totalNew, totalResolved, netChange, currentOpen, resolutionRate, latestResolved, resolutionTrend };
}

// ── Main component ────────────────────────────────────────────────────────

export function TelemetryView() {
  const { hasFeature } = useFeatureAccess();
  const [state, setState] = useState<TelemetryState>({
    batchHistory: [],
    complianceHistory: [],
    resolutionHistory: [],
    loading: true,
    error: null,
  });

  const loadData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      let batchHistory: BatchExecutionEntry[] = [];
      let complianceHistory: ComplianceTrendEntry[] = [];
      let resolutionHistory: IssueResolutionEntry[] = [];

      // Load from localStorage (same pattern as TeamMetricsView)
      try {
        const rawBatch = localStorage.getItem('sb_telemetry_batches');
        if (rawBatch) {
          const parsed = JSON.parse(rawBatch);
          if (Array.isArray(parsed)) batchHistory = parsed;
        }
      } catch {
        /* ignore */
      }

      try {
        const rawCompliance = localStorage.getItem('sb_telemetry_compliance');
        if (rawCompliance) {
          const parsed = JSON.parse(rawCompliance);
          if (Array.isArray(parsed)) complianceHistory = parsed;
        }
      } catch {
        /* ignore */
      }

      try {
        const rawResolution = localStorage.getItem('sb_telemetry_resolution');
        if (rawResolution) {
          const parsed = JSON.parse(rawResolution);
          if (Array.isArray(parsed)) resolutionHistory = parsed;
        }
      } catch {
        /* ignore */
      }

      // Fallback: derive from scan history if telemetry keys are empty
      if (batchHistory.length === 0 || complianceHistory.length === 0 || resolutionHistory.length === 0) {
        try {
          const rawScanHistory = localStorage.getItem('sb_scan_history');
          if (rawScanHistory) {
            const scanHistory = JSON.parse(rawScanHistory);
            if (Array.isArray(scanHistory)) {
              // Derive batch execution data from scan history
              if (batchHistory.length === 0) {
                batchHistory = scanHistory.map((h: any) => ({
                  scanId: h.scanId || `scan-${h.date}`,
                  date: h.date,
                  totalFiles: h.totalFilesScanned || 0,
                  totalChunks: Math.max(1, Math.ceil((h.totalFilesScanned || 0) / 10)),
                  totalBatches: Math.max(1, Math.ceil((h.totalFilesScanned || 0) / 50)),
                  totalTokensEstimated: (h.totalFilesScanned || 0) * 350,
                  durationMs: h.processingTimeMs || Math.round((h.totalFilesScanned || 0) * 12),
                  avgChunkTokens: 350,
                  errors: 0,
                }));
              }

              // Derive compliance trend from scan history
              if (complianceHistory.length === 0) {
                complianceHistory = scanHistory.map((h: any) => {
                  const gateScore = h.gatePass ? 100 : Math.max(0, 100 - (h.issueCount || 0) * 5);
                  const euAiActScore = Math.max(0, Math.min(100, gateScore - (h.fictionPatternsFound || 0) * 3));
                  const soc2Score = Math.max(0, Math.min(100, gateScore - (h.severityCounts?.critical || 0) * 10));
                  const overallScore = Math.round((euAiActScore + soc2Score + gateScore) / 3);
                  return {
                    scanId: h.scanId || `scan-${h.date}`,
                    date: h.date,
                    euAiActScore,
                    soc2Score,
                    gateScore,
                    overallScore,
                  };
                });
              }

              // Derive issue resolution from scan history
              if (resolutionHistory.length === 0 && scanHistory.length >= 2) {
                resolutionHistory = scanHistory.slice(1).map((h: any, i: number) => {
                  const prev = scanHistory[i];
                  const newIssues = Math.max(0, (h.issueCount || 0) - (prev.issueCount || 0));
                  const resolvedIssues = Math.max(0, (prev.issueCount || 0) - (h.issueCount || 0));
                  return {
                    scanId: h.scanId || `scan-${h.date}`,
                    date: h.date,
                    newIssues,
                    resolvedIssues,
                    netChange: newIssues - resolvedIssues,
                    openTotal: h.issueCount || 0,
                  };
                });
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      setState({ batchHistory, complianceHistory, resolutionHistory, loading: false, error: null });
    } catch (e) {
      setState({
        batchHistory: [],
        complianceHistory: [],
        resolutionHistory: [],
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load telemetry',
      });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { batchHistory, complianceHistory, resolutionHistory, loading, error } = state;

  // Team Pro feature gate — EU AI Act mapping and board-ready analytics
  if (!hasFeature('canMapEuAiAct')) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Advanced Telemetry</h1>
            <p className="text-sm text-foreground-muted">
              Multi-file batch analytics, compliance trends, and issue resolution tracking
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Advanced Telemetry Analytics
              <Badge className="bg-primary/15 text-primary border-primary/30">Team Pro</Badge>
            </CardTitle>
            <CardDescription>
              Batch execution times, EU AI Act compliance trends, and issue resolution tracking
            </CardDescription>
          </CardHeader>
          <ScanPaywall reason="eu_ai_act" className="min-h-[300px]" />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Advanced Telemetry</h1>
        </div>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Loading telemetry data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Advanced Telemetry</h1>
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

  const hasData = batchHistory.length > 0 || complianceHistory.length > 0 || resolutionHistory.length > 0;

  if (!hasData) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Advanced Telemetry</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Activity className="h-12 w-12 text-foreground-muted" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">No telemetry data yet</p>
              <p className="text-sm text-foreground-muted">
                Run multi-file scans to start tracking batch execution times, compliance trends, and issue resolution
                rates.
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

  // ── Compute stats and chart data ────────────────────────────────────────

  const batchStats = computeBatchStats(batchHistory);
  const complianceStats = computeComplianceStats(complianceHistory);
  const resolutionStats = computeResolutionStats(resolutionHistory);

  const batchTrendData = batchHistory.map((h) => ({
    date: formatDate(h.date),
    durationMs: h.durationMs,
    files: h.totalFiles,
    chunks: h.totalChunks,
    tokens: h.totalTokensEstimated,
  }));

  const complianceTrendData = complianceHistory.map((h) => ({
    date: formatDate(h.date),
    euAiAct: h.euAiActScore,
    soc2: h.soc2Score,
    gate: h.gateScore,
    overall: h.overallScore,
  }));

  const resolutionTrendData = resolutionHistory.map((h) => ({
    date: formatDate(h.date),
    newIssues: h.newIssues,
    resolvedIssues: h.resolvedIssues,
    openTotal: h.openTotal,
  }));

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Advanced Telemetry</h1>
            <p className="text-sm text-foreground-muted">
              Batch execution, compliance trends, and issue resolution analytics
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* ── Section 1: Batch Execution Times ─────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Multi-File Batch Execution</h2>
        </div>

        {/* Batch Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Clock}
            label="Avg Sweep Duration"
            value={formatDuration(batchStats.avgDurationMs)}
            subtitle={`Latest: ${formatDuration(batchStats.latestDurationMs)}`}
            trend={batchStats.durationTrend === 'down' ? 'up' : batchStats.durationTrend === 'up' ? 'down' : 'flat'}
            color={
              batchStats.durationTrend === 'down' ? 'success' : batchStats.durationTrend === 'up' ? 'warning' : 'muted'
            }
          />
          <StatCard
            icon={FileCode}
            label="Total Files Processed"
            value={batchStats.totalFiles.toLocaleString()}
            subtitle={`Avg ${batchStats.avgFilesPerSweep} per sweep`}
            color="info"
          />
          <StatCard
            icon={Layers}
            label="Total Chunks"
            value={batchStats.totalChunks.toLocaleString()}
            subtitle={`Avg ${batchStats.avgTokensPerChunk} tokens/chunk`}
            color="info"
          />
          <StatCard
            icon={AlertTriangle}
            label="Chunk Errors"
            value={batchStats.totalErrors.toLocaleString()}
            subtitle={batchStats.totalErrors === 0 ? 'No errors' : 'Some chunks failed'}
            color={batchStats.totalErrors > 0 ? 'warning' : 'success'}
          />
        </div>

        {/* Batch Duration Trend Chart */}
        {batchHistory.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Sweep Duration Trend
                </CardTitle>
                <CardDescription>Execution time per multi-file sweep</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={batchTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatDuration(v)} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-card, #fff)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      formatter={(v) => formatDuration(Number(v))}
                    />
                    <Line
                      type="monotone"
                      dataKey="durationMs"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Duration"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-info" />
                  Token Volume per Sweep
                </CardTitle>
                <CardDescription>Estimated tokens processed per sweep</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={batchTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatTokens(v)} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-card, #fff)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      formatter={(v) => formatTokens(Number(v)) + ' tokens'}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#tokenGradient)"
                      name="Tokens"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Batch History Table */}
        {batchHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Batch Executions</CardTitle>
              <CardDescription>Detailed history of multi-file sweep performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Files</th>
                      <th className="pb-2 pr-4">Chunks</th>
                      <th className="pb-2 pr-4">Batches</th>
                      <th className="pb-2 pr-4">Tokens</th>
                      <th className="pb-2 pr-4">Duration</th>
                      <th className="pb-2 pr-4">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...batchHistory]
                      .reverse()
                      .slice(0, 10)
                      .map((entry) => (
                        <tr key={entry.scanId} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 pr-4 text-foreground-muted">{formatDate(entry.date)}</td>
                          <td className="py-2 pr-4">{entry.totalFiles.toLocaleString()}</td>
                          <td className="py-2 pr-4">{entry.totalChunks.toLocaleString()}</td>
                          <td className="py-2 pr-4">{entry.totalBatches}</td>
                          <td className="py-2 pr-4 text-info">{formatTokens(entry.totalTokensEstimated)}</td>
                          <td className="py-2 pr-4 font-medium">{formatDuration(entry.durationMs)}</td>
                          <td className="py-2 pr-4">
                            {entry.errors > 0 ? (
                              <Badge variant="warning" className="text-xs">
                                {entry.errors}
                              </Badge>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Section 2: Compliance Trends ─────────────────────────────────── */}
      {complianceHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Historical Compliance Scores</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Gauge}
              label="Avg Overall Score"
              value={`${complianceStats.avgOverall}%`}
              subtitle={`Latest: ${complianceStats.latestOverall}%`}
              trend={complianceStats.overallTrend}
              color={
                complianceStats.avgOverall >= 80 ? 'success' : complianceStats.avgOverall >= 60 ? 'warning' : 'danger'
              }
            />
            <StatCard
              icon={CheckCircle2}
              label="Avg EU AI Act"
              value={`${complianceStats.avgEuAiAct}%`}
              color={complianceStats.avgEuAiAct >= 80 ? 'success' : 'warning'}
            />
            <StatCard
              icon={Shield}
              label="Avg SOC 2"
              value={`${complianceStats.avgSoc2}%`}
              color={complianceStats.avgSoc2 >= 80 ? 'success' : 'warning'}
            />
            <StatCard
              icon={Zap}
              label="Avg Gate Score"
              value={`${complianceStats.avgGate}%`}
              color={complianceStats.avgGate >= 80 ? 'success' : 'warning'}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Compliance Score Trends
              </CardTitle>
              <CardDescription>EU AI Act, SOC 2, and Gate scores over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={complianceTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="overall"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Overall"
                  />
                  <Line
                    type="monotone"
                    dataKey="euAiAct"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="EU AI Act"
                  />
                  <Line type="monotone" dataKey="soc2" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="SOC 2" />
                  <Line type="monotone" dataKey="gate" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Gate" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Section 3: Issue Resolution Trends ───────────────────────────── */}
      {resolutionHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Issue Resolution Tracking</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={AlertTriangle}
              label="Total New Issues"
              value={resolutionStats.totalNew.toLocaleString()}
              subtitle="Across all scans"
              color="warning"
            />
            <StatCard
              icon={CheckCircle2}
              label="Total Resolved"
              value={resolutionStats.totalResolved.toLocaleString()}
              subtitle={`Latest: ${resolutionStats.latestResolved}`}
              trend={resolutionStats.resolutionTrend}
              color="success"
            />
            <StatCard
              icon={Gauge}
              label="Resolution Rate"
              value={`${resolutionStats.resolutionRate}%`}
              subtitle="Resolved / New"
              color={
                resolutionStats.resolutionRate >= 80
                  ? 'success'
                  : resolutionStats.resolutionRate >= 50
                    ? 'warning'
                    : 'danger'
              }
            />
            <StatCard
              icon={XCircle}
              label="Currently Open"
              value={resolutionStats.currentOpen.toLocaleString()}
              subtitle={
                resolutionStats.netChange > 0 ? `+${resolutionStats.netChange} net` : `${resolutionStats.netChange} net`
              }
              color={resolutionStats.currentOpen === 0 ? 'success' : 'warning'}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                New vs. Resolved Issues
              </CardTitle>
              <CardDescription>Issue inflow vs. resolution over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resolutionTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card, #fff)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="newIssues" fill="#f97316" radius={[4, 4, 0, 0]} name="New Issues" />
                  <Bar dataKey="resolvedIssues" fill="#22c55e" radius={[4, 4, 0, 0]} name="Resolved" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-success" />
                Open Issue Backlog
              </CardTitle>
              <CardDescription>Total open issues over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={resolutionTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="backlogGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
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
                    dataKey="openTotal"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#backlogGradient)"
                    name="Open Issues"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── StatCard helper ───────────────────────────────────────────────────────

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
        <div className={`flex h-10 w-10 items-center justify-center rounded-md bg-muted ${colorMap[color]}`}>
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
