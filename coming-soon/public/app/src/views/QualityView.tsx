import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, FileCode, AlertTriangle, Shield, CheckCircle2, Play, Info, TrendingUp, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { navigate } from '@/router/HashRouter';
import { apiUrl, authHeaders } from '@/config';

interface ScanResultData {
  totalFiles: number;
  issueCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  gate: { pass: boolean; blockingCount: number; warningCount: number };
  qualityScore: number | null;
  projectPath: string;
  scanScope: { profile: string; resultsViewScope: string; codeFilesAnalyzed: number };
}

type QualityCandidate = {
  result: ScanResultData;
  generatedAt: string | null;
  epoch: number | null;
};

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseEpoch(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toIso(value: unknown): string | null {
  const epoch = parseEpoch(value);
  return epoch ? new Date(epoch).toISOString() : null;
}

function toNum(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return fallback;
}

function normalizeSeverityCounts(input: unknown): ScanResultData['severityCounts'] {
  const sev = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  return {
    critical: toNum(sev.critical, 0),
    high: toNum(sev.high, 0),
    medium: toNum(sev.medium, 0),
    low: toNum(sev.low, 0),
    info: toNum(sev.info, 0),
  };
}

function buildResultFromPayload(payload: Record<string, unknown> | null): ScanResultData | null {
  if (!payload) return null;
  const summary = (payload.summary && typeof payload.summary === 'object')
    ? payload.summary as Record<string, unknown>
    : null;
  const gateObj = (payload.gate && typeof payload.gate === 'object')
    ? payload.gate as Record<string, unknown>
    : null;
  const scanScopeObj = (payload.scanScope && typeof payload.scanScope === 'object')
    ? payload.scanScope as Record<string, unknown>
    : null;
  const findings = Array.isArray(payload.findings) ? payload.findings : [];

  return {
    totalFiles: toNum(payload.repositoryFilesTotal ?? payload.totalFiles ?? summary?.totalFiles, 0),
    issueCount: toNum(payload.issueCount ?? summary?.totalFindings ?? findings.length, 0),
    severityCounts: normalizeSeverityCounts(payload.severityCounts ?? summary?.severityCounts),
    gate: {
      pass: toBool(gateObj?.pass, true),
      blockingCount: toNum(gateObj?.blockingCount, 0),
      warningCount: toNum(gateObj?.warningCount, 0),
    },
    qualityScore: Number.isFinite(Number(payload.qualityScore)) ? Number(payload.qualityScore) : null,
    projectPath: String(payload.projectRoot ?? payload.projectPath ?? ''),
    scanScope: {
      profile: String(scanScopeObj?.profile ?? 'standard'),
      resultsViewScope: String(scanScopeObj?.resultsViewScope ?? 'dashboard'),
      codeFilesAnalyzed: toNum(
        scanScopeObj?.codeFilesAnalyzed
          ?? payload.ruleScopedFilesAnalyzed
          ?? payload.filesAnalyzed,
        0,
      ),
    },
  };
}

function toCandidate(payload: Record<string, unknown> | null, fallbackTime?: string | null): QualityCandidate | null {
  const result = buildResultFromPayload(payload);
  if (!result) return null;
  const generatedAt = toIso(payload?.generatedAt ?? payload?.lastScan ?? fallbackTime ?? null);
  return {
    result,
    generatedAt,
    epoch: parseEpoch(generatedAt),
  };
}

function chooseFreshest(candidates: Array<QualityCandidate | null>): QualityCandidate | null {
  const valid = candidates.filter((c): c is QualityCandidate => Boolean(c));
  if (valid.length === 0) return null;
  const withTime = valid.filter((c) => c.epoch !== null);
  if (withTime.length === 0) return valid[0];
  withTime.sort((a, b) => (b.epoch ?? 0) - (a.epoch ?? 0));
  return withTime[0];
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const epoch = parseEpoch(iso);
  return epoch ? new Date(epoch).toLocaleString() : iso;
}

export function QualityView() {
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const localFull = parseJsonObject(localStorage.getItem('sb_last_scan_full'));
    const localReport = parseJsonObject(localStorage.getItem('sb_last_scan_report'));
    const localTime = toIso(localStorage.getItem('sb_last_scan_time'));

    const localCandidate = chooseFreshest([
      toCandidate(localFull, localTime),
      toCandidate(localReport, localTime),
    ]);

    if (localCandidate) {
      setResult(localCandidate.result);
      setScanTime(formatTime(localCandidate.generatedAt));
    }

    const fetchApiCandidate = async () => {
      try {
        const res = await fetch(apiUrl(`/simplebeacon/report?_ts=${Date.now()}`), {
          headers: authHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) return;
        const apiPayload = await res.json() as Record<string, unknown>;
        const apiCandidate = toCandidate(apiPayload);
        const selected = chooseFreshest([localCandidate, apiCandidate]);
        if (cancelled || !selected) return;
        setResult(selected.result);
        setScanTime(formatTime(selected.generatedAt));
      } catch {
        // keep local candidate
      }
    };

    void fetchApiCandidate();
    return () => {
      cancelled = true;
    };
  }, []);

  const exportQuality = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      scan: result || {
        totalFiles: 0,
        issueCount: 0,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        gate: { pass: true, blockingCount: 0, warningCount: 0 },
        qualityScore: 100,
        projectPath: '',
        scanScope: { profile: 'unknown', resultsViewScope: 'quality', codeFilesAnalyzed: 0 },
      },
      scanTime,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const root = ((result && result.projectPath) || 'quality').replace(/[\/:\\\s]+/g, '-').slice(0, 60);
    a.href = url;
    a.download = `quality-${root || 'quality'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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
            <div className="mt-2 flex gap-2">
              <Button onClick={() => navigate('analyze')}>
                <Play className="h-4 w-4 mr-2" /> Go to Analyze
              </Button>
              <Button variant="outline" onClick={exportQuality}>
                <Download className="h-4 w-4 mr-2" /> Export JSON
              </Button>
            </div>
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
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Quality</h1>
          <p className="text-foreground-muted">Code quality metrics and trends</p>
        </div>
        <div className="ml-4 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportQuality}>
            <Download className="h-4 w-4 mr-2" /> Export JSON
          </Button>
        </div>
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
