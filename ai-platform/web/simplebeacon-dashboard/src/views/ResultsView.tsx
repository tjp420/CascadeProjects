import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ClipboardList, Download, FileCode, AlertTriangle, Shield, CheckCircle2, Play, Info } from 'lucide-react';
import { navigate } from '@/router/HashRouter';

interface ScanResultData {
  totalFiles: number;
  issueCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  gate: { pass: boolean; blockingCount: number; warningCount: number };
  qualityScore: number | null;
  projectPath: string;
  scanScope: { profile: string; resultsViewScope: string };
}

export function ResultsView() {
  const [filter, setFilter] = useState<string>('all');
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    try {
      const full = localStorage.getItem('sb_last_scan_full');
      if (full) {
        setResult(JSON.parse(full));
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
            <MetricCard icon={Shield} label="Gate Rules" value={result.gate.blockingCount + result.gate.warningCount} />
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
                    .filter(s => filter === 'all' || s === filter)
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
                  <p>Repository inventory: <strong>{result.totalFiles} files</strong> indexed</p>
                  <p>Gate rules checked: <strong>{result.gate.blockingCount + result.gate.warningCount} files</strong></p>
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
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `simplebeacon-report-${Date.now()}.json`;
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
