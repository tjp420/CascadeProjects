import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Archive,
  RefreshCw,
  Loader2,
  Download,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileSearch,
  X,
  ChevronRight,
  Trash2,
  Activity,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

// ── Types ────────────────────────────────────────────────────────────────────

interface QuarantineEntry {
  id: string;
  orgId?: string;
  timestamp: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entity?: string;
  entityId?: string;
  changes?: unknown;
  metadata?: unknown;
  prevHash?: string;
  hash?: string;
  quarantinedAt: string;
  quarantineReason: string;
}

interface QuarantineMetadata {
  createdAt?: string;
  lastUpdated?: string;
  totalQuarantined?: number;
  encrypted?: boolean;
  decryptionError?: boolean;
}

interface QuarantineResponse {
  success?: boolean;
  totalEntries: number;
  entries: QuarantineEntry[];
  metadata: QuarantineMetadata;
}

interface VerifyEntryResponse {
  success?: boolean;
  found: boolean;
  hashMatches: boolean;
  expectedHash: string;
  actualHash: string;
  quarantineReason: string | null;
  entry: QuarantineEntry | null;
  decryptionStatus: string;
}

interface HealChainResponse {
  success?: boolean;
  healed: boolean;
  quarantined: Array<{ id: string; reason: string; quarantinedAt: string }>;
  relinked: number;
  remaining: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function reasonColor(reason: string): string {
  if (reason === 'content_tampered') return 'bg-red-500/15 text-red-500 border-red-500/30';
  if (reason === 'broken_link') return 'bg-orange-500/15 text-orange-500 border-orange-500/30';
  return 'bg-gray-500/15 text-gray-500 border-gray-500/30';
}

function reasonLabel(reason: string): string {
  if (reason === 'content_tampered') return 'Content Tampered';
  if (reason === 'broken_link') return 'Broken Link';
  return reason || 'Unknown';
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

function truncateHash(hash: string | undefined, len = 16): string {
  if (!hash) return '—';
  if (hash.length <= len) return hash;
  return hash.slice(0, len / 2) + '…' + hash.slice(-len / 2);
}

// ── Component ────────────────────────────────────────────────────────────────

export function QuarantineLogBrowser() {
  const [data, setData] = useState<QuarantineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [healing, setHealing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<QuarantineEntry | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyEntryResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQuarantine = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('audit/quarantine'), {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${resp.status}`);
      }
      const json = await resp.json();
      setData(json);
    } catch (err) {
      console.warn('[Quarantine] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQuarantine();
  }, [fetchQuarantine]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => void fetchQuarantine(), 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchQuarantine]);

  const handleHeal = useCallback(async () => {
    setHealing(true);
    try {
      const resp = await fetch(apiUrl('audit/heal-chain'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${resp.status}`);
      }
      const result: HealChainResponse = await resp.json();
      if (result.healed) {
        toast.success(`Chain healed: ${result.quarantined.length} quarantined, ${result.relinked} relinked, ${result.remaining} remaining`);
      } else {
        toast.success('Chain is already valid — no healing needed');
      }
      void fetchQuarantine();
    } catch (err) {
      toast.error(`Heal failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setHealing(false);
    }
  }, [fetchQuarantine]);

  const handleVerifyEntry = useCallback(async (entry: QuarantineEntry) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const resp = await fetch(apiUrl('audit/quarantine/verify-entry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ entryId: entry.id }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${resp.status}`);
      }
      const result: VerifyEntryResponse = await resp.json();
      setVerifyResult(result);
      if (result.hashMatches) {
        toast.success(`Entry ${entry.id.slice(0, 8)}… hash verified`);
      } else {
        toast.warning(`Entry ${entry.id.slice(0, 8)}… hash mismatch detected`);
      }
    } catch (err) {
      toast.error(`Verify failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setVerifying(false);
    }
  }, []);

  const handleDownloadEntry = useCallback((entry: QuarantineEntry) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      type: 'quarantine_entry',
      entry,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quarantine-${entry.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded quarantine entry ${entry.id.slice(0, 8)}…`);
    } catch {
      toast.error('Failed to download entry');
    }
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (!data || data.entries.length === 0) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      type: 'quarantine_bundle',
      totalEntries: data.totalEntries,
      metadata: data.metadata,
      entries: data.entries,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quarantine-bundle-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${data.totalEntries} quarantine entries`);
    } catch {
      toast.error('Failed to download bundle');
    }
  }, [data]);

  const openDrawer = useCallback((entry: QuarantineEntry) => {
    setSelectedEntry(entry);
    setVerifyResult(null);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedEntry(null);
    setVerifyResult(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-6 w-6 text-foreground-muted animate-spin" />
          <p className="text-sm text-foreground-muted">Loading quarantine data…</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <AlertTriangle className="h-8 w-8 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Failed to load quarantine data</p>
          <Button size="sm" variant="outline" onClick={() => void fetchQuarantine()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const entries = data.entries;
  const total = data.totalEntries;
  const metadata = data.metadata;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Quarantine Log Browser
              </CardTitle>
              <CardDescription className="mt-1">
                Forensic inspection of quarantined audit entries
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAutoRefresh((v) => !v)}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Auto' : 'Manual'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void fetchQuarantine()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── Summary KPIs ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <Archive className="h-5 w-5 mx-auto text-foreground-muted" />
              <p className="text-2xl font-bold mt-1">{total}</p>
              <p className="text-xs text-foreground-muted">Quarantined</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <ShieldAlert className="h-5 w-5 mx-auto text-red-500" />
              <p className="text-2xl font-bold mt-1 text-red-500">
                {entries.filter((e) => e.quarantineReason === 'content_tampered').length}
              </p>
              <p className="text-xs text-foreground-muted">Tampered</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto text-orange-500" />
              <p className="text-2xl font-bold mt-1 text-orange-500">
                {entries.filter((e) => e.quarantineReason === 'broken_link').length}
              </p>
              <p className="text-xs text-foreground-muted">Broken Links</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Lock className="h-5 w-5 mx-auto text-foreground-muted" />
              <p className="text-2xl font-bold mt-1">
                {metadata.encrypted ? 'YES' : 'NO'}
              </p>
              <p className="text-xs text-foreground-muted">Encrypted</p>
            </div>
          </div>

          {/* ── Action Bar ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void handleHeal()}
              disabled={healing}
            >
              {healing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Re-Heal Chain
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownloadAll()}
              disabled={entries.length === 0}
            >
              <Download className="h-4 w-4" />
              Download All
            </Button>
            {metadata.lastUpdated && (
              <span className="text-xs text-foreground-muted ml-auto">
                Last updated: {formatTimeAgo(metadata.lastUpdated)}
              </span>
            )}
          </div>

          {/* ── Empty State ───────────────────────────────────────────────── */}
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <ShieldCheck className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium">No quarantined entries</p>
              <p className="text-xs text-foreground-muted">
                The audit chain is clean — no tampered or broken entries detected
              </p>
            </div>
          ) : (
            /* ── Entry List ─────────────────────────────────────────────── */
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => openDrawer(entry)}
                >
                  <div className="flex-shrink-0">
                    {entry.quarantineReason === 'content_tampered' ? (
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium truncate">
                        {entry.id.slice(0, 12)}…
                      </span>
                      <Badge variant="outline" className={`text-[10px] py-0 ${reasonColor(entry.quarantineReason)}`}>
                        {reasonLabel(entry.quarantineReason)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-foreground-muted mt-0.5">
                      <span>{entry.action}</span>
                      {entry.actorEmail && <span>by {entry.actorEmail}</span>}
                      <span>{formatTimeAgo(entry.quarantinedAt)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <span className="text-xs font-mono text-foreground-muted">
                      {truncateHash(entry.hash)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-foreground-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Drawer / Overlay ──────────────────────────────────────── */}
      {drawerOpen && selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          onClick={closeDrawer}
        >
          <div
            className="w-full max-w-2xl h-full bg-background border-l shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Quarantine Entry Inspector</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={closeDrawer}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Content */}
            <div className="p-4 space-y-4">
              {/* Entry Metadata */}
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={reasonColor(selectedEntry.quarantineReason)}>
                    {reasonLabel(selectedEntry.quarantineReason)}
                  </Badge>
                  <span className="text-xs text-foreground-muted">
                    Quarantined {formatTimeAgo(selectedEntry.quarantinedAt)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-foreground-muted">Entry ID</span>
                    <p className="font-mono text-xs break-all">{selectedEntry.id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-foreground-muted">Timestamp</span>
                    <p className="text-xs">{new Date(selectedEntry.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-xs text-foreground-muted">Action</span>
                    <p className="text-xs font-medium">{selectedEntry.action}</p>
                  </div>
                  <div>
                    <span className="text-xs text-foreground-muted">Entity</span>
                    <p className="text-xs">{selectedEntry.entity || '—'}</p>
                  </div>
                  {selectedEntry.actorEmail && (
                    <div>
                      <span className="text-xs text-foreground-muted">Actor</span>
                      <p className="text-xs">{selectedEntry.actorEmail}</p>
                    </div>
                  )}
                  {selectedEntry.entityId && (
                    <div>
                      <span className="text-xs text-foreground-muted">Entity ID</span>
                      <p className="font-mono text-xs break-all">{selectedEntry.entityId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Hash Details */}
              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="text-sm font-semibold">Cryptographic Hash Details</h4>
                <div className="space-y-1.5">
                  <div>
                    <span className="text-xs text-foreground-muted">Stored Hash</span>
                    <p className="font-mono text-xs break-all bg-muted/30 rounded p-1.5">
                      {selectedEntry.hash || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-foreground-muted">Previous Hash</span>
                    <p className="font-mono text-xs break-all bg-muted/30 rounded p-1.5">
                      {selectedEntry.prevHash || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verify Result */}
              {verifyResult && (
                <div className="rounded-lg border p-3 space-y-2">
                  <h4 className="text-sm font-semibold">Verification Result</h4>
                  <div className="flex items-center gap-2">
                    {verifyResult.hashMatches ? (
                      <ShieldCheck className="h-5 w-5 text-green-500" />
                    ) : (
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                    )}
                    <Badge variant="outline" className={verifyResult.hashMatches ? 'bg-green-500/15 text-green-500 border-green-500/30' : 'bg-red-500/15 text-red-500 border-red-500/30'}>
                      {verifyResult.hashMatches ? 'HASH MATCHES' : 'HASH MISMATCH'}
                    </Badge>
                    <span className="text-xs text-foreground-muted">
                      Decryption: {verifyResult.decryptionStatus}
                    </span>
                  </div>
                  {!verifyResult.hashMatches && (
                    <div className="space-y-1">
                      <div>
                        <span className="text-xs text-foreground-muted">Expected Hash</span>
                        <p className="font-mono text-xs break-all bg-muted/30 rounded p-1.5">
                          {verifyResult.expectedHash}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-foreground-muted">Actual Hash</span>
                        <p className="font-mono text-xs break-all bg-muted/30 rounded p-1.5">
                          {verifyResult.actualHash}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Full Entry JSON */}
              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="text-sm font-semibold">Full Entry Payload</h4>
                <pre className="text-xs font-mono bg-muted/30 rounded p-2 overflow-x-auto max-h-64">
                  {JSON.stringify(selectedEntry, null, 2)}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 sticky bottom-0 bg-background py-3 border-t">
                <Button
                  size="sm"
                  onClick={() => void handleVerifyEntry(selectedEntry)}
                  disabled={verifying}
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Verify Hash
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadEntry(selectedEntry)}
                >
                  <Download className="h-4 w-4" />
                  Download JSON
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={closeDrawer}
                  className="ml-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
