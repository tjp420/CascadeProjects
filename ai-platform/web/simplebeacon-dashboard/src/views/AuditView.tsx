import { useState, useEffect, useCallback } from 'react';
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
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Link2,
  FileText,
  Table,
} from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { apiUrl, authHeaders } from '@/config';
import { PermissionGate } from '@/components/PermissionGate';
import { toast } from 'sonner';

interface ScanResultData {
  totalFiles: number;
  issueCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  gate: { pass: boolean; blockingCount: number; warningCount: number };
  qualityScore: number | null;
  projectPath: string;
  scanScope: { profile: string; resultsViewScope: string };
}

interface ChainVerifyResult {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenAt: string | null;
  brokenEntryId: string | null;
  reason: string | null;
}

const CHAIN_VERIFY_INITIAL: ChainVerifyResult | null = null;

export function AuditView() {
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [scanTime, setScanTime] = useState<string | null>(null);
  const [chainResult, setChainResult] = useState<ChainVerifyResult | null>(CHAIN_VERIFY_INITIAL);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);

  const exportComplianceCsv = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/audit/export/compliance-csv'), {
        headers: authHeaders(),
      });
      if (!resp.ok) {
        toast.error('Failed to export compliance CSV');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-matrix-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Compliance CSV exported');
    } catch {
      toast.error('Failed to export compliance CSV');
    }
  }, []);

  const exportCompliancePdf = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/audit/export/compliance-pdf'), {
        headers: authHeaders(),
      });
      if (!resp.ok) {
        toast.error('Failed to export compliance PDF');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Compliance PDF exported');
    } catch {
      toast.error('Failed to export compliance PDF');
    }
  }, []);

  const verifyChain = useCallback(async () => {
    setChainLoading(true);
    setChainError(null);
    setChainResult(null);
    try {
      const resp = await fetch(apiUrl('/audit/verify'), {
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setChainError(data.message || data.error || 'Verification failed');
        return;
      }
      setChainResult({
        valid: data.valid,
        totalEntries: data.totalEntries,
        verifiedEntries: data.verifiedEntries,
        brokenAt: data.brokenAt,
        brokenEntryId: data.brokenEntryId,
        reason: data.reason,
      });
    } catch (err) {
      setChainError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setChainLoading(false);
    }
  }, []);

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
        <PermissionGate permission="read:audit" fallback={null}>
          <ChainIntegrityCard
            chainResult={chainResult}
            chainLoading={chainLoading}
            chainError={chainError}
            onVerify={verifyChain}
          />
        </PermissionGate>
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

      <PermissionGate permission="read:audit" fallback={null}>
        <ChainIntegrityCard
          chainResult={chainResult}
          chainLoading={chainLoading}
          chainError={chainError}
          onVerify={verifyChain}
        />
      </PermissionGate>

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
            <PermissionGate permission="export:audit" fallback={null}>
              <Button variant="outline" size="sm" onClick={exportComplianceCsv}>
                <Table className="h-4 w-4" /> Compliance CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportCompliancePdf}>
                <FileText className="h-4 w-4" /> Compliance PDF
              </Button>
            </PermissionGate>
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

function ChainIntegrityCard({
  chainResult,
  chainLoading,
  chainError,
  onVerify,
}: {
  chainResult: ChainVerifyResult | null;
  chainLoading: boolean;
  chainError: string | null;
  onVerify: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Audit Chain Integrity
            </CardTitle>
            <CardDescription>
              Cryptographic verification of the HMAC-SHA256 audit log hash chain
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={onVerify}
            disabled={chainLoading}
          >
            {chainLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {chainLoading ? 'Verifying...' : 'Verify Chain'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {chainError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{chainError}</span>
          </div>
        )}

        {chainResult && (
          <>
            <div className="flex items-center gap-3">
              {chainResult.valid ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Chain Verified — All entries intact</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  <span className="font-medium">Chain Broken — Tampering detected</span>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-foreground-muted">Total Entries</p>
                <p className="text-lg font-bold">{chainResult.totalEntries}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-foreground-muted">Verified Entries</p>
                <p className="text-lg font-bold text-success">{chainResult.verifiedEntries}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-foreground-muted">Status</p>
                <p className={`text-lg font-bold ${chainResult.valid ? 'text-success' : 'text-destructive'}`}>
                  {chainResult.valid ? 'VALID' : 'BROKEN'}
                </p>
              </div>
            </div>

            {chainResult.valid && chainResult.totalEntries > 0 && (
              <div className="flex items-center gap-2 text-xs text-foreground-muted">
                <Link2 className="h-3.5 w-3.5" />
                <span>
                  Genesis → {chainResult.verifiedEntries} entries cryptographically linked → Chain head verified
                </span>
              </div>
            )}

            {!chainResult.valid && chainResult.reason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Failure Reason</span>
                </div>
                <p className="text-xs text-destructive/80 pl-6">{chainResult.reason}</p>
                {chainResult.brokenEntryId && (
                  <p className="text-xs text-destructive/60 pl-6">
                    Broken at entry: <code className="font-mono">{chainResult.brokenEntryId}</code>
                    {chainResult.brokenAt && ` (${new Date(chainResult.brokenAt).toLocaleString()})`}
                  </p>
                )}
              </div>
            )}

            {chainResult.valid && chainResult.totalEntries === 0 && (
              <p className="text-xs text-foreground-muted">
                No audit log entries recorded yet. The chain will be established when the first entry is logged.
              </p>
            )}
          </>
        )}

        {!chainResult && !chainError && !chainLoading && (
          <p className="text-sm text-foreground-muted">
            Click "Verify Chain" to run a live cryptographic verification of the audit log hash chain.
            This checks every entry's HMAC-SHA256 signature against its predecessor to detect tampering,
            removal, or insertion.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
