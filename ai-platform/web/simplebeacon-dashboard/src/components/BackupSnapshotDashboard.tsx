import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Archive,
  RefreshCw,
  Loader2,
  Save,
  RotateCcw,
  Download,
  Upload,
  ShieldCheck,
  Trash2,
  HardDrive,
  Clock,
  FileStack,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface BackupStats {
  totalSnapshots: number;
  totalUncompressedSize: number;
  totalCompressedSize: number;
  totalFiles: number;
  compressionRatio: number;
  oldestSnapshot: string | null;
  newestSnapshot: string | null;
}

interface SnapshotEntry {
  id: string;
  timestamp: string;
  fileCount: number;
  uncompressedSize: number;
  compressedSize: number;
  compressed: boolean;
  signature: string;
  filePath: string;
  createdBy: string;
  durationMs: number;
}

interface BackupConfig {
  enabled: boolean;
  intervalMs: number;
  maxSnapshots: number;
  compress: boolean;
  includeSubdirs: boolean;
  excludePatterns: string[];
  retentionDays: number;
}

export function BackupSnapshotDashboard() {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable config
  const [intervalMin, setIntervalMin] = useState('');
  const [maxSnapshots, setMaxSnapshots] = useState('');
  const [retentionDays, setRetentionDays] = useState('');
  const [excludePatterns, setExcludePatterns] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, snapResp, cfgResp] = await Promise.all([
        fetch(apiUrl('/backup/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/backup/snapshots'), { headers: authHeaders() }),
        fetch(apiUrl('/backup/config'), { headers: authHeaders() }),
      ]);
      const statsData = await statsResp.json();
      const snapData = await snapResp.json();
      const cfgData = await cfgResp.json();
      if (statsData.success) setStats(statsData.stats);
      if (snapData.success) setSnapshots(snapData.snapshots || []);
      if (cfgData.success) {
        setConfig(cfgData.config);
        setIntervalMin(String(Math.round(cfgData.config.intervalMs / 60000)));
        setMaxSnapshots(String(cfgData.config.maxSnapshots));
        setRetentionDays(String(cfgData.config.retentionDays));
        setExcludePatterns((cfgData.config.excludePatterns || []).join(', '));
      }
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

  const createSnapshot = async () => {
    setCreating(true);
    try {
      const resp = await fetch(apiUrl('/backup/create'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.error || data.message || 'Failed to create snapshot');
        return;
      }
      toast.success(`Snapshot created: ${data.snapshot.fileCount} files, ${formatBytes(data.snapshot.compressedSize)}`);
      fetchAll();
    } catch {
      toast.error('Failed to create snapshot');
    } finally {
      setCreating(false);
    }
  };

  const restoreSnapshot = async (id: string) => {
    setRestoring(id);
    try {
      const resp = await fetch(apiUrl(`/backup/restore/${id}`), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.error || data.message || 'Restore failed');
        return;
      }
      toast.success(`Restored ${data.restoredCount}/${data.totalFiles} files from snapshot`);
      fetchAll();
    } catch {
      toast.error('Restore failed');
    } finally {
      setRestoring(null);
    }
  };

  const verifySnapshot = async (id: string) => {
    setVerifying(id);
    try {
      const resp = await fetch(apiUrl(`/backup/verify/${id}`), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Verification failed');
        return;
      }
      if (data.verified) {
        toast.success(`Snapshot ${id} signature verified`);
      } else {
        toast.error(`Snapshot ${id} signature INVALID — may be tampered`);
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(null);
    }
  };

  const deleteSnapshot = async (id: string) => {
    setDeleting(id);
    try {
      const resp = await fetch(apiUrl(`/backup/snapshots/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Delete failed');
        return;
      }
      toast.success(`Snapshot ${id} deleted`);
      fetchAll();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const resp = await fetch(apiUrl('/backup/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervalMs: (parseInt(intervalMin, 10) || 60) * 60000,
          maxSnapshots: parseInt(maxSnapshots, 10) || 24,
          retentionDays: parseInt(retentionDays, 10) || 7,
          excludePatterns: excludePatterns.split(',').map((w) => w.trim()).filter(Boolean),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to save config');
        return;
      }
      toast.success('Backup config saved');
      setConfig(data.config);
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    try {
      const resp = await fetch(apiUrl('/backup/config/reset'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to reset config');
        return;
      }
      toast.success('Config reset to defaults');
      fetchAll();
    } catch {
      toast.error('Failed to reset config');
    }
  };

  const toggleEnabled = async () => {
    if (!config) return;
    try {
      const resp = await fetch(apiUrl('/backup/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      const data = await resp.json();
      if (data.success) setConfig(data.config);
    } catch {
      toast.error('Failed to toggle');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading backup data...</span>
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
                <Archive className="h-5 w-5 text-primary" />
                Encrypted Storage Backup & Snapshot Recovery
              </CardTitle>
              <CardDescription>
                Cryptographically signed, compressed snapshots of platform state records
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button variant="default" size="sm" onClick={createSnapshot} disabled={creating}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Create Snapshot
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <FileStack className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Snapshots</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalSnapshots ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Compressed Size</p>
              </div>
              <p className="text-lg font-semibold">{formatBytes(stats?.totalCompressedSize ?? 0)}</p>
              <p className="text-xs text-foreground-muted">{stats?.compressionRatio ?? 0}% compression</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Uncompressed</p>
              </div>
              <p className="text-lg font-semibold">{formatBytes(stats?.totalUncompressedSize ?? 0)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Newest</p>
              </div>
              <p className="text-sm font-semibold">{stats?.newestSnapshot ? formatTime(stats.newestSnapshot) : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Configuration</CardTitle>
              <Button variant="outline" size="sm" onClick={resetConfig}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={config?.enabled ?? false} onChange={toggleEnabled} />
              Automatic snapshots enabled
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground-muted">Interval (minutes)</label>
                <Input value={intervalMin} onChange={(e) => setIntervalMin(e.target.value)} type="number" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Max Snapshots</label>
                <Input value={maxSnapshots} onChange={(e) => setMaxSnapshots(e.target.value)} type="number" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Retention (days)</label>
                <Input value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} type="number" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Exclude patterns (comma-sep)</label>
                <Input value={excludePatterns} onChange={(e) => setExcludePatterns(e.target.value)} className="text-sm" />
              </div>
            </div>

            <Button variant="default" size="sm" onClick={saveConfig} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Save Config
            </Button>
          </CardContent>
        </Card>

        {/* Snapshot Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Backup Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Total files backed up:</span>
              <span className="font-mono">{stats?.totalFiles ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Oldest snapshot:</span>
              <span className="font-mono">{stats?.oldestSnapshot ? formatTime(stats.oldestSnapshot) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Compression:</span>
              <span className="font-mono">{stats?.compressionRatio ?? 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Auto-scheduler:</span>
              <Badge variant={config?.enabled ? 'success' : 'secondary'} className="text-[10px]">
                {config?.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Signing:</span>
              <Badge variant="success" className="text-[10px]">HMAC-SHA256</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Compression:</span>
              <Badge variant={config?.compress ? 'success' : 'secondary'} className="text-[10px]">
                {config?.compress ? 'Gzip' : 'None'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Snapshots List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No snapshots yet. Click "Create Snapshot" to start.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {snapshots.map((snap) => (
                <div key={snap.id} className="rounded-md border border-border bg-muted/10 p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">{snap.id}</Badge>
                      {snap.compressed && <Badge variant="secondary" className="text-[10px]">Gzip</Badge>}
                      <span className="text-xs text-foreground-muted">{formatTime(snap.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="sm" className="h-6 text-[10px]"
                        onClick={() => verifySnapshot(snap.id)}
                        disabled={verifying === snap.id}
                      >
                        {verifying === snap.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                        Verify
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-6 text-[10px]"
                        onClick={() => restoreSnapshot(snap.id)}
                        disabled={restoring === snap.id}
                      >
                        {restoring === snap.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Restore
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-6 text-[10px] text-red-600"
                        onClick={() => deleteSnapshot(snap.id)}
                        disabled={deleting === snap.id}
                      >
                        {deleting === snap.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-foreground-muted">
                    <span>{snap.fileCount} files</span>
                    <span>{formatBytes(snap.uncompressedSize)} → {formatBytes(snap.compressedSize)}</span>
                    <span>by {snap.createdBy}</span>
                    <span>{snap.durationMs}ms</span>
                  </div>
                  <div className="text-[10px] font-mono text-foreground-muted truncate">
                    sig: {snap.signature.substring(0, 32)}...
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
