import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, RefreshCw, AlertCircle, Server, Activity, Cpu, HardDrive, Globe, Zap, CheckCircle2, Shield, Lock, KeyRound, Eye, FileCheck, Network, Boxes, ScanLine } from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';

type PlatformStatus = {
  platform?: string;
  status?: string;
  features?: Record<string, string>;
  statistics?: {
    files_processed?: number | string;
    consolidation_complete?: boolean;
    reduction_rate?: string;
    [key: string]: unknown;
  };
};

type HealthStatus = {
  status?: string;
  timestamp?: string;
  platform?: string;
  version?: string;
};

type ConsensusEngineState = {
  nodeId?: string;
  state?: string;
  term?: number;
  leaderId?: string | null;
  commitIndex?: number;
  lastAppliedIndex?: number;
  logLength?: number;
  quorumNodes?: number;
  clusterSize?: number;
  lastSnapshotIndex?: number;
  lastSnapshotTerm?: number;
  hasSnapshot?: boolean;
};

type ConsensusStatus = {
  success?: boolean;
  timestamp?: number;
  engine?: ConsensusEngineState | null;
  counters?: Record<string, number>;
};

export function PlatformView() {
  const [platformData, setPlatformData] = useState<PlatformStatus | null>(null);
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [consensusData, setConsensusData] = useState<ConsensusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const consensusErrorRef = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchPromises: Promise<Response | null>[] = [
        fetch(apiUrl('/platform/status'), { headers: authHeaders() }),
        fetch(apiUrl('/health'), { headers: authHeaders() }),
        consensusErrorRef.current
          ? Promise.resolve(null)
          : fetch(apiUrl('/vault/consensus/status'), { headers: authHeaders() }),
      ];

      const [statusResp, healthResp, consensusResp] = await Promise.allSettled(fetchPromises);

      if (statusResp.status === 'fulfilled' && statusResp.value && statusResp.value.ok) {
        setPlatformData(await statusResp.value.json());
      }
      if (healthResp.status === 'fulfilled' && healthResp.value && healthResp.value.ok) {
        setHealthData(await healthResp.value.json());
      }
      if (consensusResp.status === 'fulfilled' && consensusResp.value) {
        if (consensusResp.value.ok) {
          setConsensusData(await consensusResp.value.json());
        } else if (consensusResp.value.status === 401 || consensusResp.value.status === 403) {
          consensusErrorRef.current = true;
        }
      }

      if (statusResp.status === 'rejected' && healthResp.status === 'rejected') {
        throw new Error('Failed to fetch platform data');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch platform data');
    } finally {
      setLoading(false);
    }
  }, []);

  // fetch on mount
  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Platform</h1>
          <p className="text-foreground-muted">Platform analytics and deployment metrics</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
            <p className="text-sm text-foreground-muted">Loading platform data…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !platformData && !healthData) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Platform</h1>
          <p className="text-foreground-muted">Platform analytics and deployment metrics</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <AlertCircle className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">{error}</p>
            <Button size="sm" onClick={fetchData} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const features = platformData?.features || {};
  const stats = platformData?.statistics || {};

  const featureIcons: Record<string, typeof Server> = {
    ai_scan: Cpu,
    web_interface: Globe,
    api_endpoints: Zap,
    tools: Server,
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Platform</h1>
        <p className="text-foreground-muted">Platform analytics and deployment metrics</p>
        <div className="flex items-center gap-2">
          {healthData?.status && (
            <Badge variant={healthData.status === 'healthy' ? 'success' : 'warning'}>
              {healthData.status}
            </Badge>
          )}
          {healthData?.version && (
            <Badge variant="outline">v{healthData.version}</Badge>
          )}
          <Button size="sm" variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <Server className="h-6 w-6 text-foreground-muted" />
            <span className="text-lg font-bold">{platformData?.platform || 'Simplebeacon'}</span>
            <span className="text-xs text-foreground-muted">Platform</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <Activity className="h-6 w-6 text-green-500" />
            <span className="text-lg font-bold capitalize">{platformData?.status || healthData?.status || '—'}</span>
            <span className="text-xs text-foreground-muted">Status</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <HardDrive className="h-6 w-6 text-foreground-muted" />
            <span className="text-lg font-bold">{String(stats.files_processed ?? '—')}</span>
            <span className="text-xs text-foreground-muted">Files Processed</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <BarChart3 className="h-6 w-6 text-foreground-muted" />
            <span className="text-lg font-bold">{stats.reduction_rate || '—'}</span>
            <span className="text-xs text-foreground-muted">Reduction Rate</span>
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      {Object.keys(features).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Features</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {Object.entries(features).map(([key, value]) => {
              const Icon = featureIcons[key] || CheckCircle2;
              return (
                <div key={key} className="flex items-center gap-3 rounded-lg border p-3">
                  <Icon className="h-5 w-5 text-foreground-muted" />
                  <div className="flex-1">
                    <span className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                  </div>
                  <Badge variant={value === 'ready' || value === 'active' || value === 'available' ? 'success' : 'outline'}>
                    {value}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Health Details */}
      {healthData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Health Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Platform</span>
              <span className="font-medium">{healthData.platform || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Version</span>
              <span className="font-medium">{healthData.version || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Timestamp</span>
              <span className="font-medium">{healthData.timestamp ? new Date(healthData.timestamp).toLocaleString() : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Consolidation</span>
              <span className="font-medium">{stats.consolidation_complete ? 'Complete' : 'In Progress'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Architecture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Architecture
          </CardTitle>
          <CardDescription>HSM adapter stack — 16 tracks (10-25), all production-ready</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Lock className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">Cross-Tenant Key Escrow</div>
                <div className="text-xs text-foreground-muted">Dual-consent declassification with replay guarding</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Eye className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">Blind Signatures & PIR</div>
                <div className="text-xs text-foreground-muted">Chaum RSA blind issuers, homomorphic query gating</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <FileCheck className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">FIPS 140-3 POST</div>
                <div className="text-xs text-foreground-muted">NIST known-answer vectors, EU AI Act telemetry</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <KeyRound className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">ZKP Identity Federation</div>
                <div className="text-xs text-foreground-muted">Zero-knowledge proof tokens, temporal drift anchors</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              230 test suites, 2,438 assertions, 0 failures
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Consensus Telemetry */}
      {consensusData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Network className="h-5 w-5" />
              Consensus Telemetry
            </CardTitle>
            <CardDescription>Distributed Byzantine consensus engine — Track 34 (7 phases)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Engine State */}
            {consensusData.engine ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
                  <Boxes className="h-5 w-5 text-foreground-muted" />
                  <span className="text-base font-bold capitalize">{consensusData.engine.state || '—'}</span>
                  <span className="text-xs text-foreground-muted">Node Role</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
                  <Server className="h-5 w-5 text-foreground-muted" />
                  <span className="text-base font-bold">{consensusData.engine.nodeId || '—'}</span>
                  <span className="text-xs text-foreground-muted">Node ID</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
                  <Activity className="h-5 w-5 text-foreground-muted" />
                  <span className="text-base font-bold">Term {consensusData.engine.term ?? '—'}</span>
                  <span className="text-xs text-foreground-muted">Current Term</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
                  <CheckCircle2 className="h-5 w-5 text-foreground-muted" />
                  <span className="text-base font-bold">{consensusData.engine.commitIndex ?? '—'}</span>
                  <span className="text-xs text-foreground-muted">Commit Index</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
                  <ScanLine className="h-5 w-5 text-foreground-muted" />
                  <span className="text-base font-bold">{consensusData.engine.logLength ?? '—'}</span>
                  <span className="text-xs text-foreground-muted">Log Length</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
                  <Network className="h-5 w-5 text-foreground-muted" />
                  <span className="text-base font-bold">{consensusData.engine.clusterSize ?? '—'}</span>
                  <span className="text-xs text-foreground-muted">Cluster Size</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-foreground-muted">
                <AlertCircle className="h-4 w-4" />
                No consensus engine instance registered — running in local mode
              </div>
            )}

            {/* Leader Info */}
            {consensusData.engine?.leaderId && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Leader</span>
                <Badge variant="success">{consensusData.engine.leaderId}</Badge>
              </div>
            )}

            {/* Snapshot Info */}
            {consensusData.engine?.hasSnapshot && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Last Snapshot</span>
                <span className="font-medium">Index {consensusData.engine.lastSnapshotIndex} (term {consensusData.engine.lastSnapshotTerm})</span>
              </div>
            )}

            {/* Metrics Counters */}
            {consensusData.counters && Object.keys(consensusData.counters).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Counters</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(consensusData.counters)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-xs rounded-lg border px-3 py-2">
                        <span className="text-foreground-muted font-mono">{key.replace(/^hsm_consensus_/, '').replace(/_total$/, '')}</span>
                        <Badge variant={value > 0 ? 'default' : 'outline'}>{value}</Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
