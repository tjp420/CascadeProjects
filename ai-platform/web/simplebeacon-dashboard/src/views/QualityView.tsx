import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, FileCode, AlertTriangle, Shield, CheckCircle2, Play, Info, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { navigate } from '@/router/HashRouter';

interface ScanResultData {
  totalFiles: number;
  issueCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  gate: { pass: boolean; blockingCount: number; warningCount: number };
  qualityScore: number | null;
  projectPath: string;
  scanScope: { profile: string; resultsViewScope: string; codeFilesAnalyzed: number };
}

export function QualityView() {
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);

  useEffect(() => {
    try {
      const full = localStorage.getItem('sb_last_scan_full');
      if (full) setResult(JSON.parse(full));
      const time = localStorage.getItem('sb_last_scan_time');
      if (time) setScanTime(new Date(time).toLocaleString());
    } catch {
      /* ignore */
    }
  }, []);

  if (!result) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Quality</h1>
          <p className="text-foreground-muted">Code quality metrics and trends</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Award className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">No quality metrics to display</p>
            <p className="text-xs text-foreground-muted">Run a scan from the Analyze page to see quality metrics</p>
            <button
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('analyze')}
            >
              <Play className="h-4 w-4" /> Go to Analyze
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sev = result.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const score = result.qualityScore ?? 0;
  const gatePass = result.gate?.pass ?? false;
  const codeFiles = result.scanScope?.codeFilesAnalyzed ?? 0;

  const severityItems = [
    { label: 'Critical', value: sev.critical || 0, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'High', value: sev.high || 0, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Medium', value: sev.medium || 0, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Low', value: sev.low || 0, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Info', value: sev.info || 0, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Quality</h1>
        <p className="text-foreground-muted">Code quality metrics and trends</p>
      </div>

      {/* Quality Score Card */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <Award className="h-12 w-12 text-foreground-muted" />
          <div className="text-4xl font-bold">{score}%</div>
          <div className="text-sm text-foreground-muted">Quality Score</div>
          <div className="flex items-center gap-2 mt-2">
            {gatePass ? (
              <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Gate: PASS
              </Badge>
            ) : (
              <Badge className="bg-red-500/15 text-red-600 border-red-500/30">
                <AlertTriangle className="h-3 w-3 mr-1" /> Gate: FAIL
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" /> {result.gate?.blockingCount ?? 0} blocking
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{result.issueCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Files Scanned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold flex items-center gap-2">
              <FileCode className="h-5 w-5 text-foreground-muted" />
              {result.totalFiles ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Code Files Analyzed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-foreground-muted" />
              {codeFiles}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Severity Breakdown</CardTitle>
          <CardDescription>Issues grouped by severity level</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {severityItems.map((item) => {
            const maxVal = Math.max(...severityItems.map((s) => s.value), 1);
            const pct = (item.value / maxVal) * 100;
            return (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-20 text-sm font-medium">{item.label}</div>
                <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${item.bg} transition-all`}
                    style={{ width: `${Math.max(pct, item.value > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <div className={`w-10 text-sm font-semibold text-right ${item.color}`}>{item.value}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Scan Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" /> Scan Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground-muted">Project Path</span>
            <span className="font-mono text-xs">{result.projectPath || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Scan Profile</span>
            <span>{result.scanScope?.profile || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Scan Time</span>
            <span>{scanTime || '—'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
