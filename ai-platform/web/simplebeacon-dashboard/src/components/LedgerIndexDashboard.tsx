import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Database,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface IndexStats {
  auditEntries: number;
  analyticsEntries: number;
  indexRebuilds: number;
  lastRebuildAt: string | null;
  queryCount: number;
  indexHits: number;
  indexMisses: number;
  auditOrgs: number;
  analyticsOrgs: number;
  dailyRollupOrgs: number;
  hourlyActionOrgs: number;
  indexHitRate: number;
}

interface DailyRollup {
  date: string;
  totalScans: number;
  totalFindings: number;
  totalCritical: number;
  avgFindings: number;
  avgPostureScore: number | null;
  passRate: number;
  passCount: number;
  failCount: number;
}

interface HourlyAction {
  hour: string;
  actions: Record<string, number>;
  total: number;
}

export function LedgerIndexDashboard() {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [rollups, setRollups] = useState<DailyRollup[]>([]);
  const [hourlyActions, setHourlyActions] = useState<HourlyAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/ledger/stats'), { headers: authHeaders() });
      const data = await resp.json();
      if (data.success) {
        setStats(data);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchRollups = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/ledger/rollups'), { headers: authHeaders() });
      const data = await resp.json();
      if (data.success) {
        setRollups(data.rollups || []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchHourlyActions = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/ledger/hourly-actions?hours=24'), { headers: authHeaders() });
      const data = await resp.json();
      if (data.success) {
        setHourlyActions(data.actions || []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchStats(), fetchRollups(), fetchHourlyActions()]);
    setLoading(false);
  }, [fetchStats, fetchRollups, fetchHourlyActions]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const rebuildIndexes = async () => {
    setRebuilding(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl('/ledger/rebuild'), {
        method: 'POST',
        headers: { ...authHeaders() },
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.message || 'Rebuild failed');
        toast.error('Index rebuild failed');
        return;
      }
      toast.success('Indexes rebuilt successfully');
      fetchAll();
    } catch {
      setError('Network error during rebuild');
      toast.error('Index rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const maxHourlyTotal = Math.max(...hourlyActions.map((h) => h.total), 1);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading ledger index status...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Ledger Index Engine
              </CardTitle>
              <CardDescription>
                In-memory indexed lookups and materialized aggregations for audit logs and
                analytics data — O(1) field lookups, O(log n) timestamp range queries
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button size="sm" onClick={rebuildIndexes} disabled={rebuilding}>
                {rebuilding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Rebuilding...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4" /> Rebuild Indexes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Audit Entries Indexed</p>
              </div>
              <p className="text-lg font-semibold">{stats?.auditEntries ?? 0}</p>
              <p className="text-xs text-foreground-muted">{stats?.auditOrgs ?? 0} orgs</p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Analytics Entries Indexed</p>
              </div>
              <p className="text-lg font-semibold">{stats?.analyticsEntries ?? 0}</p>
              <p className="text-xs text-foreground-muted">{stats?.analyticsOrgs ?? 0} orgs</p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Index Hit Rate</p>
              </div>
              <p className="text-lg font-semibold">{stats?.indexHitRate ?? 0}%</p>
              <p className="text-xs text-foreground-muted">
                {stats?.indexHits ?? 0} hits / {stats?.queryCount ?? 0} queries
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Last Rebuild</p>
              </div>
              <p className="text-xs font-medium">{formatDate(stats?.lastRebuildAt || null)}</p>
              <p className="text-xs text-foreground-muted">
                {stats?.indexRebuilds ?? 0} total rebuilds
              </p>
            </div>
          </div>

          {/* Materialized Aggregations */}
          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Materialized Aggregations
            </h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                Daily Rollups: {stats?.dailyRollupOrgs ?? 0} orgs
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Hourly Actions: {stats?.hourlyActionOrgs ?? 0} orgs
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Rollups */}
      {rollups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4" />
              Daily Scan Rollups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rollups.slice(0, 14).map((r) => (
                <div
                  key={r.date}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/10 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-foreground-muted">{r.date}</span>
                    <Badge variant="outline" className="text-xs">{r.totalScans} scans</Badge>
                    <Badge
                      variant={r.passRate >= 80 ? 'success' : r.passRate >= 50 ? 'warning' : 'danger'}
                      className="text-xs"
                    >
                      {r.passRate}% pass
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-foreground-muted">
                    <span>{r.totalFindings} findings</span>
                    <span>{r.totalCritical} critical</span>
                    {r.avgPostureScore !== null && (
                      <span>posture: {r.avgPostureScore}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Actions Chart */}
      {hourlyActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              Hourly Action Volume (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {hourlyActions.map((h) => {
                const heightPct = (h.total / maxHourlyTotal) * 100;
                return (
                  <div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center gap-1 group relative"
                    title={`${h.hour}: ${h.total} actions`}
                  >
                    <div
                      className="w-full rounded-t bg-primary/20 group-hover:bg-primary/40 transition-colors"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    />
                    {h.total > 0 && (
                      <span className="text-[8px] text-foreground-muted">{h.total}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[8px] text-foreground-muted">
              <span>{hourlyActions[0]?.hour.substring(11) || ''}</span>
              <span>{hourlyActions[Math.floor(hourlyActions.length / 2)]?.hour.substring(11) || ''}</span>
              <span>{hourlyActions[hourlyActions.length - 1]?.hour.substring(11) || ''}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
