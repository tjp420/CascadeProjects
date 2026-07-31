import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardCheck,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileCode,
  AlertTriangle,
  Play,
} from 'lucide-react';
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

export function AuditView() {
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);

  // simplebeacon-ignore: framework-practices
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
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Audit Report</h1>
          <p className="text-foreground-muted">
            Compliance audit with gate status and export options
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ClipboardCheck className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">No scan results loaded</p>
            <p className="text-xs text-foreground-muted">
              Run a scan from the Analyze page to see audit results here
            </p>
            <Button className="mt-2" onClick={() => navigate('analyze')}>
              <Play className="h-4 w-4" /> Go to Analyze
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simplebeacon-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Audit Report</h1>
        <p className="text-foreground-muted">
          {result.projectPath}
          {scanTime && <span className="ml-2 text-xs">— {scanTime}</span>}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gate Status</CardTitle>
              <CardDescription>Deterministic gate scan results</CardDescription>
            </div>
            <Badge variant={result.gate.pass ? 'success' : 'danger'} className="text-sm">
              {result.gate.pass ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-info" />
              <div>
                <p className="text-xs text-foreground-muted">Files Scanned</p>
                <p className="text-lg font-bold">{result.totalFiles.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="text-xs text-foreground-muted">Issues Found</p>
                <p className="text-lg font-bold">{result.issueCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result.gate.pass ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-danger" />
              )}
              <div>
                <p className="text-xs text-foreground-muted">Blocking / Warnings</p>
                <p className="text-lg font-bold">
                  {result.gate.blockingCount} / {result.gate.warningCount}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-info" />
              <div>
                <p className="text-xs text-foreground-muted">Quality Score</p>
                <p className="text-lg font-bold">
                  {result.qualityScore !== null ? `${result.qualityScore}%` : '—'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
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
                {sev}: {result.severityCounts[sev] || 0}
              </Badge>
            ))}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={exportJson}>
              <Download className="h-4 w-4" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('results')}>
              <FileCode className="h-4 w-4" /> View Full Results
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('analyze')}>
              <Play className="h-4 w-4" /> New Scan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
