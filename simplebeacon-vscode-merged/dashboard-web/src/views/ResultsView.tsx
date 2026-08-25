import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ClipboardList, Download, FileCode, AlertTriangle, Shield, CheckCircle2, Play, Info } from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { useAuth } from '@/hooks/useAuth';
import { ResultsReferralBanner } from '@/components/ResultsReferralBanner';
import { resolveScanLetterGrade } from '@/lib/gradeFromScore';

interface ScanResultData {
  totalFiles: number;
  issueCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  gate: { pass: boolean; blockingCount: number; warningCount: number };
  qualityScore: number | null;
  projectPath: string;
  scanScope: { profile: string; resultsViewScope: string; codeFilesAnalyzed: number };
}

function extractIssueListForSidebar(report: any): any[] {
  if (Array.isArray(report?.rawIssues) && report.rawIssues.length) return report.rawIssues;
  if (Array.isArray(report?.detectedIssues) && report.detectedIssues.length) return report.detectedIssues;
  if (Array.isArray(report?.findings) && report.findings.length) {
    return report.findings.map((f: any) => ({
      filePath: f.filePath || f.file || '',
      line: f.line || 1,
      severity: f.severity || 'medium',
      severityBand: f.severityBand || f.severity || 'medium',
      type: f.category || f.type || 'finding',
      description: f.message || f.description || 'Finding detected',
      count: Number(f.count) || 1,
    }));
  }
  return [];
}

function syncReportToVscodeSidebar(reportData: any, fallbackProjectPath = ''): void {
  if (!reportData || typeof window === 'undefined') return;
  const issues = extractIssueListForSidebar(reportData);
  const sev = reportData?.severityCounts || {};
  const qualityScore = reportData?.qualityScore ?? reportData?.gate?.score ?? 0;
  const payload = {
    totalFiles: reportData?.repositoryFilesTotal || reportData?.totalFiles || reportData?.summary?.totalFiles || 0,
    ruleScopedFilesAnalyzed:
      reportData?.ruleScopedFilesAnalyzed || reportData?.filesAnalyzed || reportData?.summary?.codeFilesAnalyzed || 0,
    issueCount: issues.length,
    qualityScore,
    gate: reportData?.gate || { pass: false },
    issues: issues.slice(0, 200),
    projectPath: reportData?.projectRoot || reportData?.projectPath || fallbackProjectPath || '',
    severityCounts: {
      critical: sev.critical || 0,
      high: sev.high || 0,
      medium: sev.medium || 0,
      low: sev.low || 0,
      info: sev.info || 0,
    },
  };
  const stats = {
    issues: issues.length,
    critical: payload.severityCounts.critical,
    high: payload.severityCounts.high,
    medium: payload.severityCounts.medium,
    low: payload.severityCounts.low,
    score: qualityScore,
  };

  const vscode = (window as any).acquireVsCodeApi?.();
  try {
    if (vscode) {
      vscode.postMessage({ command: 'updateReport', report: payload });
      vscode.postMessage({ command: 'scanComplete', stats });
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage({ command: 'updateReport', report: payload }, '*');
      window.parent.postMessage({ command: 'scanComplete', stats }, '*');
    }
  } catch {
    // Sidebar sync is best-effort and should never block report export.
  }
}

export function ResultsView() {
  const [filter, setFilter] = useState<string>('all');
  const [selectedCell, setSelectedCell] = useState<{ impact: string; likelihood: string } | null>(null);
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [fullReport, setFullReport] = useState<any>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);
  const { user } = useAuth();

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    try {
      const full = localStorage.getItem('sb_last_scan_full');
      if (full) {
        setResult(JSON.parse(full));
      }
      const report = localStorage.getItem('sb_last_scan_report');
      if (report) {
        setFullReport(JSON.parse(report));
      }
      const time = localStorage.getItem('sb_last_scan_time');
      if (time) {
        setScanTime(new Date(time).toLocaleString());
      }
    } catch {
      /* ignore */
    }
  }, []);

  const allIssues = useMemo(() => {
    if (!fullReport) return [];
    return extractIssueListForSidebar(fullReport);
  }, [fullReport]);

  const heatmapGrid = useMemo(() => {
    const grid: Record<string, Record<string, number>> = {
      high: { high: 0, medium: 0, low: 0 },
      medium: { high: 0, medium: 0, low: 0 },
      low: { high: 0, medium: 0, low: 0 },
    };
    allIssues.forEach((i) => {
      const sev = (i.severity || 'low').toLowerCase();
      const impact = sev === 'critical' || sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low';
      const count = Number(i.count) || 1;
      const likelihood = count > 5 ? 'high' : count > 1 ? 'medium' : 'low';
      grid[impact][likelihood] += count;
    });
    return grid;
  }, [allIssues]);

  if (!result) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-foreground-muted">Detailed scan findings and issue breakdown</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ClipboardList className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">No scan results loaded</p>
            <p className="text-xs text-foreground-muted">Run a scan from the Analyze page to see results here</p>
            <Button className="mt-2" onClick={() => navigate('analyze')}>
              <Play className="h-4 w-4" /> Go to Analyze
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
  const activeSeverities = severities.filter((s) => result.severityCounts[s] > 0);
  const currentScanGrade = resolveScanLetterGrade(result.qualityScore, fullReport);

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Results</h1>
        <p className="text-foreground-muted">Detailed scan findings and issue breakdown</p>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scan Report</CardTitle>
              <CardDescription>
                {result.projectPath}
                {scanTime && <span className="ml-2 text-xs">— {scanTime}</span>}
              </CardDescription>
            </div>
            <Badge variant={result.gate.pass ? 'success' : 'danger'} className="text-sm">
              {result.gate.pass ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={FileCode} label="Files Scanned" value={result.totalFiles} />
            <MetricCard icon={AlertTriangle} label="Issues Found" value={result.issueCount} />
            <MetricCard icon={Shield} label="Rules Checked" value={result.scanScope.codeFilesAnalyzed || 0} />
            <MetricCard
              icon={CheckCircle2}
              label="Quality Score"
              value={result.qualityScore !== null ? `${result.qualityScore}%` : '—'}
            />
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            {severities.map((sev) => (
              <Badge
                key={sev}
                variant={
                  sev === 'critical'
                    ? 'danger'
                    : sev === 'high'
                      ? 'warning'
                      : sev === 'medium'
                        ? 'info'
                        : sev === 'low'
                          ? 'secondary'
                          : 'outline'
                }
                className="capitalize gap-1.5"
              >
                {sev}: {result.severityCounts[sev]}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <ResultsReferralBanner userEmail={user?.email} currentScanGrade={currentScanGrade} />

      {/* Risk Heatmap Card */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Heatmap</CardTitle>
          <CardDescription>
            3x3 matrix of issue impact vs. likelihood. Click or press Enter on a cell to filter findings.
            {selectedCell && ` · filtering: ${selectedCell.impact} impact, ${selectedCell.likelihood} likelihood`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1 max-w-md">
            <div />
            <div className="text-xs text-center text-foreground-muted font-medium">Low Lk</div>
            <div className="text-xs text-center text-foreground-muted font-medium">Med Lk</div>
            <div className="text-xs text-center text-foreground-muted font-medium">High Lk</div>
            {(['high', 'medium', 'low'] as const).map((imp) => (
              <div key={imp} className="contents">
                <div className="text-xs text-right text-foreground-muted font-medium self-center pr-1 capitalize">
                  {imp} Imp
                </div>
                {(['low', 'medium', 'high'] as const).map((lk) => {
                  const count = heatmapGrid[imp][lk];
                  const score: Record<string, number> = { low: 1, medium: 2, high: 3 };
                  const total = score[imp] * score[lk];
                  const cellClass =
                    total >= 6
                      ? 'bg-red-500/15 text-red-500 border-red-500/30'
                      : total >= 3
                        ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                        : 'bg-green-500/15 text-green-500 border-green-500/30';
                  const isSelected = selectedCell?.impact === imp && selectedCell?.likelihood === lk;
                  return (
                    <div
                      key={`${imp}-${lk}`}
                      tabIndex={0}
                      role="button"
                      aria-label={`${imp} impact, ${lk} likelihood: ${count} issues`}
                      title={`${imp} impact / ${lk} likelihood — ${count} issue${count === 1 ? '' : 's'}`}
                      onClick={() => setSelectedCell(isSelected ? null : { impact: imp, likelihood: lk })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCell(isSelected ? null : { impact: imp, likelihood: lk });
                        }
                      }}
                      className={`rounded-md border p-3 text-center cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring ${cellClass} ${isSelected ? 'ring-2 ring-ring' : ''}`}
                    >
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-[10px] opacity-60">
                        {total >= 6 ? 'Red' : total >= 3 ? 'Amber' : 'Green'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {selectedCell && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedCell(null)}>
              Clear heatmap filter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Severity Filter + Detail Tabs */}
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="scope">Scope</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Findings Breakdown</CardTitle>
              <CardDescription>Issues grouped by severity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 mb-2">
                {['all', ...activeSeverities].map((sev) => (
                  <Button
                    key={sev}
                    variant={filter === sev ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(sev)}
                    className="capitalize"
                  >
                    {sev}
                    {sev !== 'all' && sev !== 'info' && (
                      <span className="ml-1.5 text-xs opacity-70">
                        {result.severityCounts[sev as keyof typeof result.severityCounts]}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              <Separator />

              {result.issueCount === 0 ? (
                <div className="flex items-center gap-3 py-8">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                  <div>
                    <p className="text-sm font-medium">No issues detected</p>
                    <p className="text-xs text-foreground-muted">All gate rules passed with zero findings</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {severities
                    .filter((s) => filter === 'all' || s === filter)
                    .filter((s) => result.severityCounts[s] > 0)
                    .map((sev) => (
                      <div
                        key={sev}
                        className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              sev === 'critical'
                                ? 'danger'
                                : sev === 'high'
                                  ? 'warning'
                                  : sev === 'medium'
                                    ? 'info'
                                    : sev === 'low'
                                      ? 'secondary'
                                      : 'outline'
                            }
                            className="capitalize"
                          >
                            {sev}
                          </Badge>
                          <span className="text-sm text-foreground-muted">
                            {result.severityCounts[sev]} finding{result.severityCounts[sev] !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope">
          <Card>
            <CardHeader>
              <CardTitle>Scan Scope</CardTitle>
              <CardDescription>Configuration and scope of the last scan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p>
                    Repository inventory: <strong>{result.totalFiles} files</strong> indexed
                  </p>
                  <p>
                    Code files analyzed: <strong>{result.scanScope.codeFilesAnalyzed || 0} files</strong>
                  </p>
                  <p>
                    Profile: <strong>{result.scanScope.profile}</strong>
                  </p>
                  <p>
                    Scope: <strong>{result.scanScope.resultsViewScope}</strong>
                  </p>
                  <p>
                    Deterministic gate scan — pattern matching on configured production paths. Source files are not
                    semantically reviewed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export Results</CardTitle>
              <CardDescription>Download scan report in various formats</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!result) return;
                  const exportData = fullReport || result;
                  syncReportToVscodeSidebar(exportData, result.projectPath);
                  const json = JSON.stringify(exportData, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const filename = `simplebeacon-report-${Date.now()}.json`;
                  const params = new URLSearchParams(window.location.search);
                  const inIde =
                    typeof window !== 'undefined' &&
                    (typeof (window as any).acquireVsCodeApi === 'function' ||
                      params.get('sb_parent_urlbar') ||
                      params.get('sb_notify_base') ||
                      params.get('sb_api_base'));
                  if (inIde) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = String(reader.result || '').split(',')[1];
                      const vscode = (window as any).acquireVsCodeApi?.();
                      const msg = { command: 'downloadFile', filename, mimeType: blob.type, base64 };
                      if (vscode) {
                        try {
                          vscode.postMessage(msg);
                        } catch {
                          /* ignore */
                        }
                      } else if (window.parent && window.parent !== window) {
                        try {
                          window.parent.postMessage(msg, '*');
                        } catch {
                          /* ignore */
                        }
                      }
                    };
                    reader.readAsDataURL(blob);
                    return;
                  }
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" /> JSON Report
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('audit')}>
                <Download className="h-4 w-4" /> Audit PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('remediation')}>
                <Download className="h-4 w-4" /> Remediation Roadmap
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// simplebeacon-ignore: mega-params — only 3 params, false positive
function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-foreground-muted">{label}</span>
        <span className="text-lg font-bold">{value}</span>
      </div>
    </div>
  );
}
