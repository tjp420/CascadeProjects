import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  KeyRound,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  ShieldAlert,
  Lock,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface RotationStatus {
  activeVersion: number | null;
  totalVersions: number;
  lastRotation: string | null;
  keyHash: string | null;
  algorithm: string;
}

interface HistoryEntry {
  version: number;
  keyHash: string;
  status: string;
  createdAt: string;
  retiredAt: string | null;
  rotatedBy: string | null;
}

interface RotationResult {
  success: boolean;
  newVersion?: { version: number; keyHash: string; createdAt: string };
  storeResults?: Array<{ name: string; records: number; reencrypted: number; error?: string }>;
  error?: string;
}

export function KeyRotationDashboard() {
  const [status, setStatus] = useState<RotationStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [lastResult, setLastResult] = useState<RotationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/key-rotation/status'), { headers: authHeaders() });
      const data = await resp.json();
      if (data.success) {
        setStatus({
          activeVersion: data.activeVersion,
          totalVersions: data.totalVersions,
          lastRotation: data.lastRotation,
          keyHash: data.keyHash,
          algorithm: data.algorithm,
        });
      }
    } catch {
      // silent
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/key-rotation/history'), { headers: authHeaders() });
      const data = await resp.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchStatus(), fetchHistory()]);
    setLoading(false);
  }, [fetchStatus, fetchHistory]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const performRotation = async () => {
    setRotating(true);
    setError(null);
    setLastResult(null);
    try {
      const resp = await fetch(apiUrl('/key-rotation/rotate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.message || 'Key rotation failed');
        toast.error('Key rotation failed');
        return;
      }
      setLastResult(data);
      toast.success(`Key rotated to v${data.newVersion.version}`);
      fetchAll();
    } catch {
      setError('Network error during rotation');
      toast.error('Key rotation failed');
    } finally {
      setRotating(false);
    }
  };

  const revokeKey = async (version: number) => {
    try {
      const resp = await fetch(apiUrl(`/key-rotation/revoke/${version}`), {
        method: 'POST',
        headers: { ...authHeaders() },
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.message || 'Failed to revoke key');
        return;
      }
      toast.success(`Key v${version} revoked`);
      fetchAll();
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso || iso === '1970-01-01T00:00:00.000Z') return '—';
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading key rotation status...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Encryption Key Rotation
          </CardTitle>
          <CardDescription>
            Manage AES-256-GCM encryption keys for store data. Rotation re-encrypts all
            sensitive data with a new key while retired keys remain available for decryption.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Status Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <p className="text-xs text-foreground-muted">Active Version</p>
              <p className="text-lg font-semibold">
                {status?.activeVersion !== null && status?.activeVersion !== undefined ? (
                  <span className="flex items-center gap-2">
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> v{status.activeVersion}
                    </Badge>
                  </span>
                ) : (
                  <span className="text-foreground-muted">Unknown</span>
                )}
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <p className="text-xs text-foreground-muted">Algorithm</p>
              <p className="text-sm font-medium font-mono">{status?.algorithm || 'AES-256-GCM'}</p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <p className="text-xs text-foreground-muted">Key Fingerprint</p>
              <p className="text-xs font-mono text-foreground-muted">
                {status?.keyHash ? `sha256:${status.keyHash}` : '—'}
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <p className="text-xs text-foreground-muted">Last Rotation</p>
              <p className="text-xs font-medium">{formatDate(status?.lastRotation || null)}</p>
            </div>
          </div>

          {/* Rotate Button */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={performRotation} disabled={rotating}>
              {rotating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Rotating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" /> Rotate Key Now
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {/* Last Rotation Result */}
          {lastResult?.storeResults && (
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Rotation to v{lastResult.newVersion?.version} complete
              </p>
              <div className="space-y-1">
                {lastResult.storeResults.map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{r.name}</span>
                    <span className={r.error ? 'text-destructive' : 'text-foreground-muted'}>
                      {r.error ? `Error: ${r.error}` : `${r.reencrypted}/${r.records} records re-encrypted`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4" />
            Key Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-foreground-muted py-4 text-center">
              No rotation history. The current key is version 0.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.version}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/10 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      {entry.status === 'active' ? (
                        <Shield className="h-4 w-4 text-success" />
                      ) : entry.status === 'revoked' ? (
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                      ) : (
                        <Lock className="h-4 w-4 text-foreground-muted" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">v{entry.version}</span>
                        <Badge
                          variant={
                            entry.status === 'active'
                              ? 'success'
                              : entry.status === 'revoked'
                                ? 'danger'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          {entry.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-foreground-muted space-x-2">
                        <span>Created: {formatDate(entry.createdAt)}</span>
                        {entry.retiredAt && (
                          <span>Retired: {formatDate(entry.retiredAt)}</span>
                        )}
                        {entry.rotatedBy && entry.rotatedBy !== 'system-init' && (
                          <span>by {entry.rotatedBy}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-foreground-muted">
                      {entry.keyHash}
                    </span>
                    {entry.status === 'retired' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revokeKey(entry.version)}
                        className="h-7 px-2 text-destructive hover:text-destructive"
                      >
                        <Lock className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    )}
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
