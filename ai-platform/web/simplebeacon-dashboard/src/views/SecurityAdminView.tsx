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
  Ban,
  Globe,
  Download,
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
  const [partitionStatus, setPartitionStatus] = useState<any>(null);
  const [partitionConfig, setPartitionConfig] = useState<any>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [exportingViolations, setExportingViolations] = useState(false);

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

  const fetchPartitionStatus = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/audit/partition-status'), {
        headers: authHeaders(),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          setPartitionStatus(data);
        }
      }
    } catch {
      // silent — partition status is supplementary
    }
  }, []);

  const fetchPartitionConfig = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/audit/partition-config'), {
        headers: authHeaders(),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          setPartitionConfig(data.config);
        }
      }
    } catch {
      // silent
    }
  }, []);

  const updatePartitionConfig = useCallback(async (updates: Record<string, any>) => {
    setSavingConfig(true);
    try {
      const resp = await fetch(apiUrl('/audit/partition-config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setPartitionConfig(data.config);
        toast.success('Partition config updated');
        fetchPartitionStatus();
      } else {
        toast.error(data.message || data.error || 'Failed to update partition config');
      }
    } catch {
      toast.error('Failed to update partition config');
    } finally {
      setSavingConfig(false);
    }
  }, [fetchPartitionStatus]);

  const handleExportViolations = useCallback(async (format: 'json' | 'csv') => {
    setExportingViolations(true);
    try {
      const resp = await fetch(apiUrl(`/audit/partition-violations/export?format=${format}`), {
        headers: authHeaders(),
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `partition-violations-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Violations exported as ${format.toUpperCase()}`);
      } else {
        toast.error('Failed to export violations');
      }
    } catch {
      toast.error('Failed to export violations');
    } finally {
      setExportingViolations(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStatus();
    fetchPartitionStatus();
    fetchPartitionConfig();
  }, [fetchStatus, fetchPartitionStatus, fetchPartitionConfig]);

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

      {/* ── Org Partition Enforcement ── */}
      {partitionStatus && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Org Partition Enforcement
                </CardTitle>
                <CardDescription className="mt-1">
                  Cross-tenant data isolation monitoring — blocks unauthorized cross-org access attempts.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchPartitionStatus}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status banner */}
            <div
              className={`flex items-center gap-3 rounded-md border p-3 ${
                partitionStatus.enforcementEnabled
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-destructive/30 bg-destructive/5'
              }`}
            >
              {partitionStatus.enforcementEnabled ? (
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
              )}
              <div className="text-sm">
                <p className={`font-medium ${partitionStatus.enforcementEnabled ? 'text-emerald-700' : 'text-destructive'}`}>
                  {partitionStatus.enforcementEnabled ? 'Partition enforcement active' : 'Partition enforcement disabled'}
                </p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Caller org: <span className="font-mono">{partitionStatus.callerOrgId}</span>
                </p>
              </div>
            </div>

            {/* Violation KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className={`text-2xl font-bold ${partitionStatus.totalViolations > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                  {partitionStatus.totalViolations}
                </p>
                <p className="text-xs text-foreground-muted mt-1">Total Violations</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-emerald-500">0</p>
                <p className="text-xs text-foreground-muted mt-1">Allowed Cross-Org</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-blue-500">1</p>
                <p className="text-xs text-foreground-muted mt-1">Protected Routes</p>
              </div>
            </div>

            {/* ── Partition Config Panel ── */}
            {partitionConfig && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-primary" />
                  Enforcement Configuration
                </p>

                {/* Enforcement toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Partition Enforcement</p>
                    <p className="text-xs text-foreground-muted">
                      Block cross-org access attempts from non-admin users
                    </p>
                  </div>
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      partitionConfig.orgPartitionEnforcementEnabled
                        ? 'bg-emerald-500'
                        : 'bg-muted'
                    }`}
                    disabled={savingConfig}
                    onClick={() =>
                      updatePartitionConfig({
                        orgPartitionEnforcementEnabled: !partitionConfig.orgPartitionEnforcementEnabled,
                      })
                    }
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        partitionConfig.orgPartitionEnforcementEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Alert on violation toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Alert on Violation</p>
                    <p className="text-xs text-foreground-muted">
                      Fire alert when violations cross threshold
                    </p>
                  </div>
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      partitionConfig.orgPartitionAlertOnViolation
                        ? 'bg-emerald-500'
                        : 'bg-muted'
                    }`}
                    disabled={savingConfig}
                    onClick={() =>
                      updatePartitionConfig({
                        orgPartitionAlertOnViolation: !partitionConfig.orgPartitionAlertOnViolation,
                      })
                    }
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        partitionConfig.orgPartitionAlertOnViolation ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Violation alert threshold */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Violation Alert Threshold</p>
                    <p className="text-xs text-foreground-muted">
                      Number of violations before alert fires
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={partitionConfig.orgPartitionViolationAlertThreshold}
                      className="w-16 rounded-md border bg-transparent px-2 py-1 text-sm text-center"
                      disabled={savingConfig}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (val >= 1) {
                          setPartitionConfig({
                            ...partitionConfig,
                            orgPartitionViolationAlertThreshold: val,
                          });
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={savingConfig}
                      onClick={() =>
                        updatePartitionConfig({
                          orgPartitionViolationAlertThreshold: partitionConfig.orgPartitionViolationAlertThreshold,
                        })
                      }
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {/* Export buttons */}
                <div className="flex items-center gap-2 pt-1 border-t">
                  <p className="text-xs text-foreground-muted mr-auto">Export violation log:</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={exportingViolations || (partitionStatus?.totalViolations ?? 0) === 0}
                    onClick={() => handleExportViolations('json')}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={exportingViolations || (partitionStatus?.totalViolations ?? 0) === 0}
                    onClick={() => handleExportViolations('csv')}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                </div>
              </div>
            )}

            {/* Recent violations */}
            {partitionStatus.recentViolations && partitionStatus.recentViolations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Ban className="h-4 w-4 text-destructive" />
                  Recent Violation Attempts
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {partitionStatus.recentViolations.map((v: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-destructive">{v.method}</span>
                          <span className="font-mono">{v.path}</span>
                        </div>
                        <div className="text-foreground-muted">
                          <span className="font-mono">{v.callerOrgId}</span>
                          {' → '}
                          <span className="font-mono text-destructive">{v.clientOrgId}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-foreground-muted shrink-0">
                        {new Date(v.at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-emerald-700">No partition violations detected</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
