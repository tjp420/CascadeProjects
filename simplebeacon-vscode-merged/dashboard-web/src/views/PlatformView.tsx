import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  RefreshCw,
  AlertCircle,
  Server,
  Activity,
  Cpu,
  HardDrive,
  Globe,
  Zap,
  CheckCircle2,
} from 'lucide-react';
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

export function PlatformView() {
  const [platformData, setPlatformData] = useState<PlatformStatus | null>(null);
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResp, healthResp] = await Promise.allSettled([
        fetch(apiUrl('/status'), { headers: authHeaders() }),
        fetch(apiUrl('/health'), { headers: authHeaders() }),
      ]);

      if (statusResp.status === 'fulfilled' && statusResp.value.ok) {
        setPlatformData(await statusResp.value.json());
      }
      if (healthResp.status === 'fulfilled' && healthResp.value.ok) {
        setHealthData(await healthResp.value.json());
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
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
            <Badge variant={healthData.status === 'healthy' ? 'success' : 'warning'}>{healthData.status}</Badge>
          )}
          {healthData?.version && <Badge variant="outline">v{healthData.version}</Badge>}
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
                  <Badge
                    variant={value === 'ready' || value === 'active' || value === 'available' ? 'success' : 'outline'}
                  >
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
              <span className="font-medium">
                {healthData.timestamp ? new Date(healthData.timestamp).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Consolidation</span>
              <span className="font-medium">{stats.consolidation_complete ? 'Complete' : 'In Progress'}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
