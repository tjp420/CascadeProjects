import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  Trash2,
  RefreshCw,
  Loader2,
  Save,
  RotateCcw,
  Eye,
  Play,
  HardDrive,
  Zap,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface RetentionStats {
  totalPurges: number;
  totalItemsPurged: number;
  totalSizeFreed: number;
  lastPurge: { timestamp: string; totalPurged: number; totalSizeFreed: number; durationMs: number } | null;
  enabledCategories: number;
  totalCategories: number;
  schedulerActive: boolean;
  dryRun: boolean;
}

interface PurgeHistoryEntry {
  id: string;
  timestamp: string;
  dryRun: boolean;
  durationMs: number;
  totalPurged: number;
  totalSizeFreed: number;
  triggeredBy: string;
  results: Record<string, any>;
}

interface CategoryDef {
  name: string;
  type: string;
  defaultRetentionDays: number;
}

interface RetentionConfig {
  enabled: boolean;
  intervalMs: number;
  dryRun: boolean;
  secureDelete: boolean;
  policies: Record<string, { enabled: boolean; retentionDays: number }>;
  categories: Record<string, CategoryDef>;
}

export function DataRetentionDashboard() {
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [config, setConfig] = useState<RetentionConfig | null>(null);
  const [history, setHistory] = useState<PurgeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [intervalHrs, setIntervalHrs] = useState('');
  const [policyEdits, setPolicyEdits] = useState<Record<string, { retentionDays: string; enabled: boolean }>>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, cfgResp, histResp] = await Promise.all([
        fetch(apiUrl('/data-retention/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/data-retention/config'), { headers: authHeaders() }),
        fetch(apiUrl('/data-retention/history?limit=15'), { headers: authHeaders() }),
      ]);
      const statsData = await statsResp.json();
      const cfgData = await cfgResp.json();
      const histData = await histResp.json();
      if (statsData.success) setStats(statsData.stats);
      if (cfgData.success) {
        setConfig(cfgData.config);
        setIntervalHrs(String(Math.round(cfgData.config.intervalMs / 3600000)));
        const edits: Record<string, { retentionDays: string; enabled: boolean }> = {};
        for (const [catId, pol] of Object.entries(cfgData.config.policies || {}) as [string, { retentionDays: number; enabled: boolean }][]) {
          edits[catId] = { retentionDays: String(pol.retentionDays), enabled: pol.enabled };
        }
        setPolicyEdits(edits);
      }
      if (histData.success) setHistory(histData.history || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const runPurge = async () => {
    setPurging(true);
    try {
      const resp = await fetch(apiUrl('/data-retention/purge'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.error || data.message || 'Purge failed');
        return;
      }
      toast.success(`Purge complete: ${data.totalPurged} items, ${formatBytes(data.totalSizeFreed)} freed`);
      fetchAll();
    } catch {
      toast.error('Purge failed');
    } finally {
      setPurging(false);
    }
  };

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const resp = await fetch(apiUrl('/data-retention/purge/preview'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Preview failed');
        return;
      }
      setPreview(data);
      toast.info(`Preview: ${data.totalPurged} items would be purged, ${formatBytes(data.totalSizeFreed)} freed`);
    } catch {
      toast.error('Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const resp = await fetch(apiUrl('/data-retention/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervalMs: (parseInt(intervalHrs, 10) || 6) * 3600000,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to save config');
        return;
      }
      toast.success('Config saved');
      setConfig(data.config);
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async (catId: string) => {
    const edit = policyEdits[catId];
    if (!edit) return;
    try {
      const resp = await fetch(apiUrl(`/data-retention/policies/${catId}`), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: edit.enabled,
          retentionDays: parseInt(edit.retentionDays, 10) || 30,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(`Failed to save ${catId} policy`);
        return;
      }
      toast.success(`${catId} policy saved`);
    } catch {
      toast.error('Failed to save policy');
    }
  };

  const toggleGlobal = async (field: 'enabled' | 'dryRun' | 'secureDelete') => {
    if (!config) return;
    try {
      const resp = await fetch(apiUrl('/data-retention/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !config[field] }),
      });
      const data = await resp.json();
      if (data.success) setConfig(data.config);
    } catch {
      toast.error('Failed to toggle');
    }
  };

  const togglePolicy = (catId: string) => {
    setPolicyEdits((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], enabled: !prev[catId]?.enabled },
    }));
  };

  const resetConfig = async () => {
    try {
      const resp = await fetch(apiUrl('/data-retention/config/reset'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (data.success) {
        toast.success('Config reset to defaults');
        fetchAll();
      }
    } catch {
      toast.error('Failed to reset');
    }
  };

  const clearHistory = async () => {
    try {
      const resp = await fetch(apiUrl('/data-retention/history/clear'), { method: 'POST', headers: authHeaders() });
      const data = await resp.json();
      if (data.success) {
        toast.success('History cleared');
        fetchAll();
      }
    } catch {
      toast.error('Failed to clear history');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading retention data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Data Retention & Automated Purge Lifecycles
              </CardTitle>
              <CardDescription>
                Configurable data lifecycle daemon for automated historic data cleanup
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={runPreview} disabled={previewing}>
                {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Preview
              </Button>
              <Button variant="default" size="sm" onClick={runPurge} disabled={purging}>
                {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run Purge
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Purges</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalPurges ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Items Purged</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalItemsPurged ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Space Freed</p>
              </div>
              <p className="text-lg font-semibold">{formatBytes(stats?.totalSizeFreed ?? 0)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Last Purge</p>
              </div>
              <p className="text-sm font-semibold">{stats?.lastPurge ? formatTime(stats.lastPurge.timestamp) : '—'}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={stats?.schedulerActive ? 'success' : 'secondary'} className="text-xs">
              Scheduler: {stats?.schedulerActive ? 'Active' : 'Disabled'}
            </Badge>
            <Badge variant={stats?.dryRun ? 'warning' : 'success'} className="text-xs">
              Mode: {stats?.dryRun ? 'Dry Run' : 'Live'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {stats?.enabledCategories ?? 0}/{stats?.totalCategories ?? 0} categories enabled
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Preview Results */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4" />
              Purge Preview (Dry Run)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-4 text-xs">
              <span><b>{preview.totalPurged}</b> items would be purged</span>
              <span><b>{formatBytes(preview.totalSizeFreed)}</b> would be freed</span>
              <span><b>{preview.durationMs}ms</b> estimated</span>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {Object.entries(preview.results || {}).map(([catId, res]: [string, any]) => (
                <div key={catId} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                  <Badge variant="outline" className="text-[10px]">{catId}</Badge>
                  {res.skipped ? (
                    <span className="text-foreground-muted">skipped</span>
                  ) : res.error ? (
                    <span className="text-red-600">error: {res.error}</span>
                  ) : (
                    <>
                      <span>{res.purged} purged, {res.remaining} remaining</span>
                      <span className="text-foreground-muted">{formatBytes(res.sizeBefore)} → {formatBytes(res.sizeAfter)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Global Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Global Configuration</CardTitle>
              <Button variant="outline" size="sm" onClick={resetConfig}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={config?.enabled ?? false} onChange={() => toggleGlobal('enabled')} />
                Scheduler enabled
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={config?.dryRun ?? false} onChange={() => toggleGlobal('dryRun')} />
                Dry run mode
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={config?.secureDelete ?? false} onChange={() => toggleGlobal('secureDelete')} />
                Secure delete
              </label>
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Purge interval (hours)</label>
              <Input value={intervalHrs} onChange={(e) => setIntervalHrs(e.target.value)} type="number" className="text-sm" />
            </div>
            <Button variant="default" size="sm" onClick={saveConfig} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Save Config
            </Button>
          </CardContent>
        </Card>

        {/* Category Policies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Category Retention Policies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[350px] overflow-y-auto">
            {config && Object.entries(config.categories || {}).map(([catId, cat]) => {
              const edit = policyEdits[catId] || { retentionDays: '30', enabled: true };
              return (
                <div key={catId} className="rounded-md border border-border bg-muted/10 p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{cat.name}</span>
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                      <input type="checkbox" checked={edit.enabled} onChange={() => togglePolicy(catId)} />
                      {edit.enabled ? 'Enabled' : 'Disabled'}
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={edit.retentionDays}
                      onChange={(e) => setPolicyEdits({ ...policyEdits, [catId]: { ...edit, retentionDays: e.target.value } })}
                      type="number"
                      className="text-xs h-7 w-20"
                    />
                    <span className="text-[10px] text-foreground-muted">days retention</span>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => savePolicy(catId)}>
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Purge History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Purge History</CardTitle>
            <Button variant="outline" size="sm" onClick={clearHistory}>
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No purge history yet</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.dryRun ? (
                      <Badge variant="warning" className="text-[10px]">Dry Run</Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px]">Live</Badge>
                    )}
                    <span className="font-mono text-foreground-muted">{formatTime(entry.timestamp)}</span>
                    <span>{entry.totalPurged} items purged</span>
                    <span className="text-foreground-muted">{formatBytes(entry.totalSizeFreed)} freed</span>
                    <span className="text-foreground-muted ml-auto">by {entry.triggeredBy}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
