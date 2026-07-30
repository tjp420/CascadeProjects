import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ClipboardList, Download, FileCode, AlertTriangle, Shield, CheckCircle2, Play, Info, Search, ChevronRight, FileText } from 'lucide-react';
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
    ruleScopedFilesAnalyzed: reportData?.ruleScopedFilesAnalyzed || reportData?.filesAnalyzed || reportData?.summary?.codeFilesAnalyzed || 0,
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
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
  const activeSeverities = severities.filter(s => result.severityCounts[s] > 0);
  const currentScanGrade = resolveScanLetterGrade(result.qualityScore, fullReport);

  const allIssues = useMemo(() => extractIssueListForSidebar(fullReport), [fullReport]);

  const filteredIssues = useMemo(() => {
    let issues = allIssues;
    if (filter !== 'all') {
      issues = issues.filter(i => i.severity === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      issues = issues.filter(i =>
        (i.type || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.filePath || '').toLowerCase().includes(q)
      );
    }
    issues = issues.filter(i => !String(i.filePath || '').includes('node_modules'));
    return issues;
  }, [allIssues, filter, searchQuery]);

  const issueCategories = useMemo(() => {
    const catMap: Record<string, number> = {};
    allIssues.forEach(i => {
      const cat = i.type || 'other';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    return Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }, [allIssues]);

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
            <MetricCard icon={CheckCircle2} label="Quality Score" value={result.qualityScore !== null ? `${result.qualityScore}%` : '—'} />
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            {severities.map((sev) => (
              <Badge
                key={sev}
                variant={
                  sev === 'critical' ? 'danger' :
                  sev === 'high' ? 'warning' :
                  sev === 'medium' ? 'info' :
                  sev === 'low' ? 'secondary' : 'outline'
                }
                className="capitalize gap-1.5"
              >
                {sev}: {result.severityCounts[sev]}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <ResultsReferralBanner
        userEmail={user?.email}
        currentScanGrade={currentScanGrade}
      />

      {/* Findings Table + Detail Tabs */}
      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="scope">Scope</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="findings">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader>
                <CardTitle>Findings Breakdown</CardTitle>
                <CardDescription>
                  {allIssues.length} total issue{allIssues.length !== 1 ? 's' : ''}
                  {filter !== 'all' && ` · filtered by ${filter}`}
                  {searchQuery && ` · matching "${searchQuery}"`}
                </CardDescription>
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
                      {sev !== 'all' && (
                        <span className="ml-1.5 text-xs opacity-70">
                          {result.severityCounts[sev as keyof typeof result.severityCounts]}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>

                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-foreground-muted" />
                  <Input
                    placeholder="Search by type, description, or file path…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>

                <Separator />

                {allIssues.length === 0 ? (
                  <div className="flex items-center gap-3 py-8">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                    <div>
                      <p className="text-sm font-medium">No issues detected</p>
                      <p className="text-xs text-foreground-muted">All gate rules passed with zero findings</p>
                    </div>
                  </div>
                ) : filteredIssues.length === 0 ? (
                  <div className="flex items-center gap-3 py-8">
                    <Search className="h-8 w-8 text-foreground-muted" />
                    <div>
                      <p className="text-sm font-medium">No issues match current filters</p>
                      <p className="text-xs text-foreground-muted">Try adjusting severity filter or search query</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {filteredIssues.length > 500 && (
                      <p className="text-xs text-foreground-muted py-2">
                        Showing first 500 of {filteredIssues.length} filtered issues. Export for the full set.
                      </p>
                    )}
                    <div className="rounded-md border border-border overflow-hidden">
                      <div className="max-h-[600px] overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                            <tr className="text-left">
                              <th className="px-3 py-2 font-medium text-foreground-muted">Severity</th>
                              <th className="px-3 py-2 font-medium text-foreground-muted">Type</th>
                              <th className="px-3 py-2 font-medium text-foreground-muted">Description</th>
                              <th className="px-3 py-2 font-medium text-foreground-muted">File</th>
                              <th className="px-3 py-2 font-medium text-foreground-muted text-right">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredIssues.slice(0, 500).map((issue, idx) => (
                              <tr
                                key={issue.id || idx}
                                onClick={() => setSelectedIssue(issue)}
                                className={`border-t border-border cursor-pointer transition-colors hover:bg-muted/50 ${selectedIssue === issue ? 'bg-muted' : ''}`}
                              >
                                <td className="px-3 py-2">
                                  <Badge
                                    variant={
                                      issue.severity === 'critical' ? 'danger' :
                                      issue.severity === 'high' ? 'warning' :
                                      issue.severity === 'medium' ? 'info' :
                                      issue.severity === 'low' ? 'secondary' : 'outline'
                                    }
                                    className="capitalize text-xs"
                                  >
                                    {issue.severity}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-foreground-muted whitespace-nowrap">{issue.type || '—'}</td>
                                <td className="px-3 py-2 text-foreground-muted max-w-md truncate">{issue.description || '—'}</td>
                                <td className="px-3 py-2 text-foreground-muted whitespace-nowrap max-w-[200px] truncate">
                                  {issue.filePath ? (
                                    <span className="font-mono text-xs">{issue.filePath.split('/').pop()}</span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-foreground-muted">{issue.count || 1}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Issue Detail Panel */}
            <Card className="lg:sticky lg:top-4 h-fit">
              <CardHeader>
                <CardTitle className="text-base">Issue Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedIssue ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          selectedIssue.severity === 'critical' ? 'danger' :
                          selectedIssue.severity === 'high' ? 'warning' :
                          selectedIssue.severity === 'medium' ? 'info' :
                          selectedIssue.severity === 'low' ? 'secondary' : 'outline'
                        }
                        className="capitalize"
                      >
                        {selectedIssue.severity}
                      </Badge>
                      <span className="text-sm font-medium">{selectedIssue.type || 'Issue'}</span>
                    </div>
                    <p className="text-sm text-foreground-muted">{selectedIssue.description || ''}</p>
                    {selectedIssue.filePath && (
                      <div className="space-y-1">
                        <p className="text-xs text-foreground-muted">File</p>
                        <code className="block text-xs bg-muted rounded-md p-2 break-all">{selectedIssue.filePath}{selectedIssue.line && selectedIssue.line > 1 ? `:${selectedIssue.line}` : ''}</code>
                      </div>
                    )}
                    {selectedIssue.recommendedAction && (
                      <div className="space-y-1">
                        <p className="text-xs text-foreground-muted">Recommended Action</p>
                        <p className="text-sm">{selectedIssue.recommendedAction}</p>
                      </div>
                    )}
                    {selectedIssue.affectedFiles?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-foreground-muted">Affected Files ({selectedIssue.affectedFiles.length})</p>
                        <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                          {selectedIssue.affectedFiles.map((f: string, i: number) => (
                            <li key={i} className="font-mono break-all">{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedIssue.metadata?.duplicatePaths?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-foreground-muted">Duplicate Paths</p>
                        <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                          {selectedIssue.metadata.duplicatePaths.map((p: string, i: number) => (
                            <li key={i} className="font-mono break-all">{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const vscode = (window as any).acquireVsCodeApi?.();
                          if (vscode && selectedIssue.filePath) {
                            vscode.postMessage({
                              command: 'openFile',
                              filePath: selectedIssue.filePath,
                              line: selectedIssue.line || 1,
                            });
                          }
                        }}
                      >
                        <FileText className="h-4 w-4" /> Open in editor
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <ChevronRight className="h-8 w-8 text-foreground-muted" />
                    <p className="text-sm text-foreground-muted">Click a finding in the table to see details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Severity Summary</CardTitle>
              <CardDescription>Issues grouped by severity and type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {severities
                  .filter(s => result.severityCounts[s] > 0)
                  .map((sev) => (
                    <div key={sev} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            sev === 'critical' ? 'danger' :
                            sev === 'high' ? 'warning' :
                            sev === 'medium' ? 'info' :
                            sev === 'low' ? 'secondary' : 'outline'
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

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Issues by Type</p>
                <div className="space-y-1">
                  {issueCategories.map(({ type, count }) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-foreground-muted">{type}</span>
                      <Badge variant="secondary" className="text-xs">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
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
                  <p>Repository inventory: <strong>{result.totalFiles} files</strong> indexed</p>
                  <p>Code files analyzed: <strong>{result.scanScope.codeFilesAnalyzed || 0} files</strong></p>
                  <p>Profile: <strong>{result.scanScope.profile}</strong></p>
                  <p>Scope: <strong>{result.scanScope.resultsViewScope}</strong></p>
                  <p>Deterministic gate scan — pattern matching on configured production paths. Source files are not semantically reviewed.</p>
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
              <Button variant="outline" size="sm" onClick={() => {
                if (!result) return;
                const exportData = fullReport || result;
                syncReportToVscodeSidebar(exportData, result.projectPath);
                const json = JSON.stringify(exportData, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const filename = `simplebeacon-report-${Date.now()}.json`;
                const params = new URLSearchParams(window.location.search);
                const inIde = typeof window !== 'undefined' && (
                  typeof (window as any).acquireVsCodeApi === 'function' ||
                  params.get('sb_parent_urlbar') ||
                  params.get('sb_notify_base') ||
                  params.get('sb_api_base')
                );
                if (inIde) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = String(reader.result || '').split(',')[1];
                    const vscode = (window as any).acquireVsCodeApi?.();
                    const msg = { command: 'downloadFile', filename, mimeType: blob.type, base64 };
                    if (vscode) { try { vscode.postMessage(msg); } catch { /* ignore */ } }
                    else if (window.parent && window.parent !== window) { try { window.parent.postMessage(msg, '*'); } catch { /* ignore */ } }
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
              }}>
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
function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) {
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
