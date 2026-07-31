import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Clock,
  Zap,
  Loader2,
  Layers,
} from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';
import { toast } from 'sonner';

type ChainResult = {
  orgId: string;
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenAt: string | null;
  brokenEntryId: string | null;
  reason: string | null;
  healed?: boolean;
  healResult?: {
    healed: boolean;
    quarantined: number;
    sealEntryId: string | null;
    quarantineFile?: string;
  } | null;
};

type GuardrailResult = {
  orgId: string;
  currentBlocked: number;
  previousBlocked: number;
  delta: number;
};

type SecurityStatus = {
  running: boolean;
  pollIntervalMs: number;
  autoHealEnabled: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number;
  runCount: number;
  orgsTracked: number;
  lastResults: {
    orgsChecked: number;
    chainResults: ChainResult[];
    guardrailResults: GuardrailResult[];
  } | null;
};

const REFRESH_INTERVAL_MS = 15_000;

export function SecurityAdminView() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [healing, setHealing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const resp = await fetch(apiUrl('/audit/security/status'), {
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.success && data.status) {
        setStatus(data.status);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      if (!status) {
        toast.error('Failed to load security status', { description: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const resp = await fetch(apiUrl('/audit/security/verify'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.success) {
        toast.success('Verification complete', {
          description: `${data.results.orgsChecked} orgs checked`,
        });
        await fetchStatus();
      } else {
        throw new Error('Verification failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Verification failed', { description: msg });
    } finally {
      setVerifying(false);
    }
  };

  const handleHeal = async (orgId: string) => {
    setHealing(orgId);
    try {
      const resp = await fetch(apiUrl('/audit/chain/heal'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.success && data.result) {
        if (data.result.healed) {
          toast.success('Chain healed', {
            description: `${data.result.quarantined} entries quarantined, seal: ${data.result.sealEntryId?.slice(0, 12)}...`,
          });
        } else {
          toast.info('Chain was already valid', {
            description: 'No healing needed',
          });
        }
        await fetchStatus();
      } else {
        throw new Error('Heal failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Chain heal failed', { description: msg });
    } finally {
      setHealing(null);
    }
  };

  if (loading && !status) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Security Operations</h1>
          <p className="text-foreground-muted">Audit chain integrity monitoring and recovery</p>
        </div>
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Security Operations</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load security status: {error}</span>
            </div>
            <Button onClick={fetchStatus} variant="outline" size="sm" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status) return null;

  const allChainsValid = status.lastResults?.chainResults.every((r) => r.valid) ?? true;
  const brokenCount = status.lastResults?.chainResults.filter((r) => !r.valid).length ?? 0;
  const healedCount = status.lastResults?.chainResults.filter((r) => r.healed).length ?? 0;
  const totalEntries = status.lastResults?.chainResults.reduce((sum, r) => sum + r.totalEntries, 0) ?? 0;
  const totalVerified = status.lastResults?.chainResults.reduce((sum, r) => sum + r.verifiedEntries, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Operations</h1>
            <p className="text-foreground-muted">Audit chain integrity monitoring and recovery</p>
          </div>
          <div className="flex items-center gap-2">
            {status.lastRunAt && (
              <span className="text-xs text-foreground-muted flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(status.lastRunAt).toLocaleTimeString()}
              </span>
            )}
            {/* Monitor status badge */}
            <Badge variant={status.running ? 'default' : 'secondary'} className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {status.running ? 'Active' : 'Stopped'}
            </Badge>
            {/* Auto-heal badge */}
            <Badge variant={status.autoHealEnabled ? 'default' : 'outline'} className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Auto-Heal {status.autoHealEnabled ? 'On' : 'Off'}
            </Badge>
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
            >
              <Zap className="h-4 w-4 mr-1" />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button onClick={handleVerify} variant="outline" size="sm" disabled={verifying}>
              {verifying ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Verify Now
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Chain Status */}
        <Card className={allChainsValid ? 'border-emerald-500/30' : 'border-destructive/50'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chain Integrity</CardTitle>
            {allChainsValid ? (
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            ) : (
              <ShieldX className="h-5 w-5 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allChainsValid ? 'Valid' : `${brokenCount} Broken`}
            </div>
            <p className="text-xs text-foreground-muted mt-1">
              {status.orgsTracked} org{status.orgsTracked !== 1 ? 's' : ''} tracked
            </p>
          </CardContent>
        </Card>

        {/* Total Entries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Layers className="h-5 w-5 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEntries.toLocaleString()}</div>
            <p className="text-xs text-foreground-muted mt-1">
              {totalVerified.toLocaleString()} verified
            </p>
          </CardContent>
        </Card>

        {/* Heal Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Healed</CardTitle>
            <Wrench className="h-5 w-5 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healedCount}</div>
            <p className="text-xs text-foreground-muted mt-1">
              chains recovered this cycle
            </p>
          </CardContent>
        </Card>

        {/* Poll Interval */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Poll Interval</CardTitle>
            <Clock className="h-5 w-5 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(status.pollIntervalMs / 1000).toFixed(0)}s</div>
            <p className="text-xs text-foreground-muted mt-1">
              run #{status.runCount} · {status.lastRunDurationMs}ms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Org Chain Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Per-Org Chain Verification
          </CardTitle>
          <CardDescription>
            Hash-chain integrity status for each tracked organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.lastResults && status.lastResults.chainResults.length > 0 ? (
            <div className="space-y-3">
              {status.lastResults.chainResults.map((cr) => (
                <div
                  key={cr.orgId}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    cr.valid
                      ? cr.healed
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-emerald-500/20'
                      : 'border-destructive/50 bg-destructive/5'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {cr.valid ? (
                      cr.healed ? (
                        <Wrench className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      )
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{cr.orgId}</div>
                      <div className="text-xs text-foreground-muted">
                        {cr.verifiedEntries}/{cr.totalEntries} entries verified
                        {cr.reason && ` · ${cr.reason}`}
                        {cr.healed && cr.healResult && (
                          <span className="text-amber-500">
                            {' · '}healed: {cr.healResult.quarantined} quarantined
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {cr.valid ? (
                      cr.healed ? (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                          Healed
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          Valid
                        </Badge>
                      )
                    ) : (
                      <>
                        <Badge variant="destructive">Broken</Badge>
                        <Button
                          onClick={() => handleHeal(cr.orgId)}
                          variant="outline"
                          size="sm"
                          disabled={healing === cr.orgId}
                        >
                          {healing === cr.orgId ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Wrench className="h-3.5 w-3.5 mr-1" />
                          )}
                          Heal
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-foreground-muted">
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No chain verification data yet. Click "Verify Now" to run a check.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guardrail Anomaly Results */}
      {status.lastResults && status.lastResults.guardrailResults.length > 0 && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Guardrail Anomaly Monitoring
              </CardTitle>
              <CardDescription>
                Blocked incident spike detection per organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {status.lastResults.guardrailResults.map((gr) => (
                  <div
                    key={gr.orgId}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{gr.orgId}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-foreground-muted">
                        Blocked: <span className="font-medium text-foreground">{gr.currentBlocked}</span>
                      </span>
                      <span className="text-foreground-muted">
                        Delta:{' '}
                        <span
                          className={`font-medium ${
                            gr.delta >= 10
                              ? 'text-destructive'
                              : gr.delta > 0
                                ? 'text-amber-500'
                                : 'text-foreground'
                          }`}
                        >
                          +{gr.delta}
                        </span>
                      </span>
                      {gr.delta >= 10 && (
                        <Badge variant="destructive" className="text-xs">
                          Spike
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
