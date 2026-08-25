import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Activity,
  RefreshCw,
  Loader2,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Ban,
  Clock,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

// ── Types ────────────────────────────────────────────────────────────────────

interface StreamFailureEntry {
  apiKey: string;
  type: string;
  detail: string | null;
  at: string;
}

interface StreamInterdictionStats {
  totalFailuresRecorded: number;
  totalAutoInterdicts: number;
  lastAutoInterdict: string | null;
  byType: Record<string, number>;
}

interface StreamInterdictionStatus {
  success?: boolean;
  enabled: boolean;
  windowMs: number;
  ttlMs: number;
  thresholds: Record<string, number>;
  totalFailuresInWindow: number;
  stats: StreamInterdictionStats;
  recentFailures: StreamFailureEntry[];
  byKey: Record<string, Record<string, number>>;
}

// Failure axis metadata for display
const FAILURE_AXES = [
  { type: 'chain_verification', label: 'Chain Verification', icon: Shield, color: 'text-red-400' },
  { type: 'pii_violation', label: 'PII Violation', icon: ShieldAlert, color: 'text-orange-400' },
  { type: 'guardrail_refusal', label: 'Guardrail Refusal', icon: Ban, color: 'text-yellow-400' },
  { type: 'auth_failure', label: 'Auth Failure', icon: ShieldAlert, color: 'text-purple-400' },
  { type: 'org_partition', label: 'Org Partition', icon: Shield, color: 'text-blue-400' },
  { type: 'rate_limit', label: 'Rate Limit', icon: Zap, color: 'text-cyan-400' },
  { type: 'bundle_verification', label: 'Bundle Verification', icon: ShieldCheck, color: 'text-pink-400' },
];

function formatDuration(ms: number): string {
  if (ms >= 60000) return `${Math.round(ms / 60000)}m`;
  if (ms >= 1000) return `${Math.round(ms / 1000)}s`;
  return `${ms}ms`;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return `${Math.round(diff / 3600000)}h ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function StreamInterdictionDashboard() {
  const [status, setStatus] = useState<StreamInterdictionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [recordingKey, setRecordingKey] = useState('');
  const [recordingType, setRecordingType] = useState('chain_verification');
  const [recordingDetail, setRecordingDetail] = useState('');
  const [recording, setRecording] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/api/audit/interdiction/stream/status'), {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setStatus(data);
    } catch (err) {
      // Non-fatal — dashboard degrades gracefully
      console.warn('[StreamInterdiction] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => void fetchStatus(), 5000);
    if (intervalRef.current.unref) intervalRef.current.unref();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchStatus]);

  const handleClear = useCallback(async () => {
    setClearing(true);
    try {
      const resp = await fetch(apiUrl('/api/audit/interdiction/stream/clear'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      toast.success(`Cleared ${data.cleared} stream failure(s)`);
      void fetchStatus();
    } catch (err) {
      toast.error(`Failed to clear: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setClearing(false);
    }
  }, [fetchStatus]);

  const handleRecord = useCallback(async () => {
    if (!recordingKey.trim()) {
      toast.error('API key is required');
      return;
    }
    setRecording(true);
    try {
      const resp = await fetch(apiUrl('/api/audit/interdiction/stream/record'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: recordingKey.trim(),
          failureType: recordingType,
          detail: recordingDetail.trim() || undefined,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.interdicted) {
        toast.warning(`Failure recorded — KEY AUTO-INTERDICTED (${data.count}/${data.threshold})`);
      } else {
        toast.success(`Failure recorded (${data.count}/${data.threshold})`);
      }
      setRecordingKey('');
      setRecordingDetail('');
      void fetchStatus();
    } catch (err) {
      toast.error(`Failed to record: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRecording(false);
    }
  }, [recordingKey, recordingType, recordingDetail, fetchStatus]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-6 w-6 text-foreground-muted animate-spin" />
          <p className="text-sm text-foreground-muted">Loading stream interdiction data…</p>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <AlertTriangle className="h-8 w-8 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Failed to load stream interdiction data</p>
          <Button size="sm" variant="outline" onClick={() => void fetchStatus()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const enabled = status.enabled;
  const totalAuto = status.stats.totalAutoInterdicts;
  const totalRecorded = status.stats.totalFailuresRecorded;
  const inWindow = status.totalFailuresInWindow;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Stream Interdiction Engine
            </CardTitle>
            <CardDescription className="mt-1">
              Multi-axis sliding-window failure tracker with auto-interdiction
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                enabled
                  ? 'bg-green-500/15 text-green-500 border-green-500/30'
                  : 'bg-gray-500/15 text-gray-500 border-gray-500/30'
              }
            >
              {enabled ? 'ACTIVE' : 'DISABLED'}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setAutoRefresh((v) => !v)}>
              <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void fetchStatus()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Top KPI Cards (4) ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <TrendingDown className="h-5 w-5 mx-auto text-foreground-muted" />
            <p className="text-2xl font-bold mt-1">{inWindow}</p>
            <p className="text-xs text-foreground-muted">In Window</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <ShieldAlert className="h-5 w-5 mx-auto text-orange-500" />
            <p className="text-2xl font-bold mt-1 text-orange-500">{totalAuto}</p>
            <p className="text-xs text-foreground-muted">Auto-Interdicts</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Activity className="h-5 w-5 mx-auto text-foreground-muted" />
            <p className="text-2xl font-bold mt-1">{totalRecorded}</p>
            <p className="text-xs text-foreground-muted">Total Recorded</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Clock className="h-5 w-5 mx-auto text-foreground-muted" />
            <p className="text-2xl font-bold mt-1">{formatDuration(status.windowMs)}</p>
            <p className="text-xs text-foreground-muted">Window Size</p>
          </div>
        </div>

        {/* ── 7-Axis Failure Grid ──────────────────────────────────────────── */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Failure Axis Breakdown</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {FAILURE_AXES.map((axis) => {
              const Icon = axis.icon;
              const count = status.stats.byType[axis.type] || 0;
              const threshold = status.thresholds[axis.type] || '—';
              return (
                <div key={axis.type} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${axis.color}`} />
                    <div>
                      <p className="text-xs font-medium">{axis.label}</p>
                      <p className="text-[10px] text-foreground-muted">threshold: {threshold}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      count >= (status.thresholds[axis.type] || Infinity)
                        ? 'bg-red-500/15 text-red-500 border-red-500/30'
                        : count > 0
                          ? 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30'
                          : 'bg-gray-500/15 text-gray-500 border-gray-500/30'
                    }
                  >
                    {count}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── By-Key Breakdown Table ───────────────────────────────────────── */}
        {Object.keys(status.byKey).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Failures by API Key</h4>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">API Key</th>
                    {FAILURE_AXES.map((a) => (
                      <th key={a.type} className="text-center p-2 font-medium text-xs">
                        {a.label.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(status.byKey).map(([key, counts]) => (
                    <tr key={key} className="border-t">
                      <td className="p-2 font-mono text-xs">{key}</td>
                      {FAILURE_AXES.map((a) => {
                        const c = counts[a.type] || 0;
                        return (
                          <td key={a.type} className="text-center p-2">
                            {c > 0 ? (
                              <span
                                className={
                                  c >= (status.thresholds[a.type] || Infinity)
                                    ? 'text-red-500 font-bold'
                                    : 'text-yellow-500'
                                }
                              >
                                {c}
                              </span>
                            ) : (
                              <span className="text-foreground-muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Recent Failures Feed ─────────────────────────────────────────── */}
        {status.recentFailures.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Recent Failures (last {status.recentFailures.length})</h4>
            <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-lg border p-2">
              {status.recentFailures.map((f, i) => {
                const axis = FAILURE_AXES.find((a) => a.type === f.type);
                const Icon = axis?.icon || AlertTriangle;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                    <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${axis?.color || 'text-foreground-muted'}`} />
                    <span className="font-mono text-foreground-muted flex-shrink-0">{f.apiKey}</span>
                    <Badge variant="outline" className="text-[10px] py-0">
                      {f.type}
                    </Badge>
                    {f.detail && <span className="text-foreground-muted truncate">{f.detail}</span>}
                    <span className="ml-auto text-foreground-muted flex-shrink-0">{formatTimeAgo(f.at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Manual Record Form ───────────────────────────────────────────── */}
        <div className="rounded-lg border p-3 space-y-2">
          <h4 className="text-sm font-semibold">Manual Failure Injection</h4>
          <p className="text-xs text-foreground-muted">
            Record a test failure to verify the interdiction pipeline. Useful for validating threshold behavior.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="API key"
              value={recordingKey}
              onChange={(e) => setRecordingKey(e.target.value)}
              className="flex-1 min-w-[120px]"
            />
            <select
              value={recordingType}
              onChange={(e) => setRecordingType(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {FAILURE_AXES.map((a) => (
                <option key={a.type} value={a.type}>
                  {a.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Detail (optional)"
              value={recordingDetail}
              onChange={(e) => setRecordingDetail(e.target.value)}
              className="flex-1 min-w-[120px]"
            />
            <Button size="sm" onClick={() => void handleRecord()} disabled={recording || !recordingKey.trim()}>
              {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record'}
            </Button>
          </div>
        </div>

        {/* ── Admin Actions ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Clear All Stream Failures</p>
            <p className="text-xs text-foreground-muted">
              Resets the sliding-window buffer. Interdicted keys remain locked until TTL expires.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void handleClear()}
            disabled={clearing || inWindow === 0}
          >
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear
          </Button>
        </div>

        {/* ── Last Auto-Interdict ──────────────────────────────────────────── */}
        {status.stats.lastAutoInterdict && (
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
            Last auto-interdiction: {formatTimeAgo(status.stats.lastAutoInterdict)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
