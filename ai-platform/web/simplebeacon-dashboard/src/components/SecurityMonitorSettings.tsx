import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Play,
  Power,
  Activity,
  Clock,
  Bell,
  Gauge,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface MonitorSettings {
  pollIntervalMs: number;
  guardrailSpikeThreshold: number;
  guardrailSpikeWindowMs: number;
  alertCooldownMs: number;
  autoHealEnabled: boolean;
  rollingBaselineWindowMs: number;
  anomalyDeltaThreshold: number;
  anomalySeverityLevels: string[];
  chainIntegrityCheckEnabled: boolean;
  guardrailAnomalyCheckEnabled: boolean;
  maxAlertsPerOrgPerHour: number;
  updatedAt: string | null;
}

interface MonitorStatus {
  running: boolean;
  pollIntervalMs: number;
  autoHealEnabled: boolean;
  guardrailSpikeThreshold: number;
  alertCooldownMs: number;
  chainIntegrityCheckEnabled: boolean;
  guardrailAnomalyCheckEnabled: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number;
  runCount: number;
  orgsTracked: number;
  settingsUpdatedAt: string | null;
}

export function SecurityMonitorSettings() {
  const [settings, setSettings] = useState<MonitorSettings | null>(null);
  const [defaults, setDefaults] = useState<MonitorSettings | null>(null);
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [runningOnce, setRunningOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MonitorSettings | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsResp, statusResp] = await Promise.all([
        fetch(apiUrl('/security-monitor/settings'), { headers: authHeaders() }),
        fetch(apiUrl('/security-monitor/status'), { headers: authHeaders() }),
      ]);
      const settingsData = await settingsResp.json();
      const statusData = await statusResp.json();
      if (settingsData.success) {
        setSettings(settingsData.settings);
        setDefaults(settingsData.defaults);
        setForm(settingsData.settings);
      }
      if (statusData.success) {
        setStatus(statusData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveSettings = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl('/security-monitor/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.message || 'Failed to save settings');
        toast.error('Failed to save settings');
        return;
      }
      setSettings(data.settings);
      toast.success('Security monitor settings updated');
      fetchAll();
    } catch {
      setError('Network error');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    setResetting(true);
    try {
      const resp = await fetch(apiUrl('/security-monitor/settings/reset'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to reset settings');
        return;
      }
      setSettings(data.settings);
      setForm(data.settings);
      toast.success('Settings reset to defaults');
      fetchAll();
    } catch {
      toast.error('Failed to reset settings');
    } finally {
      setResetting(false);
    }
  };

  const restartMonitor = async () => {
    setRestarting(true);
    try {
      const resp = await fetch(apiUrl('/security-monitor/restart'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to restart monitor');
        return;
      }
      toast.success('Security monitor restarted');
      fetchAll();
    } catch {
      toast.error('Failed to restart monitor');
    } finally {
      setRestarting(false);
    }
  };

  const runOnce = async () => {
    setRunningOnce(true);
    try {
      const resp = await fetch(apiUrl('/security-monitor/run-once'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to trigger check');
        return;
      }
      toast.success('Security check completed');
      fetchAll();
    } catch {
      toast.error('Failed to trigger check');
    } finally {
      setRunningOnce(false);
    }
  };

  const formatMs = (ms: number) => {
    if (ms >= 60000) return `${Math.round(ms / 60000)} min`;
    if (ms >= 1000) return `${Math.round(ms / 1000)} sec`;
    return `${ms} ms`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const isDirty = form && settings ? JSON.stringify(form) !== JSON.stringify(settings) : false;

  if (loading || !form) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading security monitor settings...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Security Monitor Settings
            </CardTitle>
            <CardDescription>
              Live-configure anomaly detection thresholds, alert cooldown profiles, and rolling baselines
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={runOnce} disabled={runningOnce}>
              {runningOnce ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run Check
            </Button>
            <Button variant="outline" size="sm" onClick={restartMonitor} disabled={restarting}>
              {restarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
              Restart
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

        {/* Runtime Status */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <p className="text-xs text-foreground-muted">Monitor Status</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status?.running ? 'success' : 'secondary'} className="text-xs">
                {status?.running ? 'Running' : 'Stopped'}
              </Badge>
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-xs text-foreground-muted">Last Run</p>
            </div>
            <p className="text-xs font-medium">{formatTime(status?.lastRunAt || null)}</p>
            <p className="text-xs text-foreground-muted">{status?.runCount ?? 0} total runs</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              <p className="text-xs text-foreground-muted">Orgs Tracked</p>
            </div>
            <p className="text-lg font-semibold">{status?.orgsTracked ?? 0}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <p className="text-xs text-foreground-muted">Settings Updated</p>
            </div>
            <p className="text-xs font-medium">{formatTime(status?.settingsUpdatedAt || null)}</p>
          </div>
        </div>

        <Separator />

        {/* Anomaly Detection */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Anomaly Detection
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sm-poll-interval">Poll Interval (ms)</Label>
              <Input
                id="sm-poll-interval"
                type="number"
                value={form.pollIntervalMs}
                onChange={(e) => setForm({ ...form, pollIntervalMs: parseInt(e.target.value, 10) || 0 })}
                className="font-mono"
              />
              <p className="text-xs text-foreground-muted">Min 10000 (10 sec). Default: {defaults?.pollIntervalMs}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-spike-threshold">Guardrail Spike Threshold</Label>
              <Input
                id="sm-spike-threshold"
                type="number"
                value={form.guardrailSpikeThreshold}
                onChange={(e) => setForm({ ...form, guardrailSpikeThreshold: parseInt(e.target.value, 10) || 0 })}
                className="font-mono"
              />
              <p className="text-xs text-foreground-muted">New blocks per window to trigger alert. Default: {defaults?.guardrailSpikeThreshold}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-spike-window">Spike Window (ms)</Label>
              <Input
                id="sm-spike-window"
                type="number"
                value={form.guardrailSpikeWindowMs}
                onChange={(e) => setForm({ ...form, guardrailSpikeWindowMs: parseInt(e.target.value, 10) || 0 })}
                className="font-mono"
              />
              <p className="text-xs text-foreground-muted">5-min anomaly delta window. Default: {defaults?.guardrailSpikeWindowMs}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-anomaly-delta">Anomaly Delta Threshold</Label>
              <Input
                id="sm-anomaly-delta"
                type="number"
                value={form.anomalyDeltaThreshold}
                onChange={(e) => setForm({ ...form, anomalyDeltaThreshold: parseInt(e.target.value, 10) || 0 })}
                className="font-mono"
              />
              <p className="text-xs text-foreground-muted">Delta count to flag anomaly. Default: {defaults?.anomalyDeltaThreshold}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-baseline-window">Rolling Baseline Window (ms)</Label>
              <Input
                id="sm-baseline-window"
                type="number"
                value={form.rollingBaselineWindowMs}
                onChange={(e) => setForm({ ...form, rollingBaselineWindowMs: parseInt(e.target.value, 10) || 0 })}
                className="font-mono"
              />
              <p className="text-xs text-foreground-muted">Historical baseline period. Default: {defaults?.rollingBaselineWindowMs}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-max-alerts">Max Alerts / Org / Hour</Label>
              <Input
                id="sm-max-alerts"
                type="number"
                value={form.maxAlertsPerOrgPerHour}
                onChange={(e) => setForm({ ...form, maxAlertsPerOrgPerHour: parseInt(e.target.value, 10) || 0 })}
                className="font-mono"
              />
              <p className="text-xs text-foreground-muted">Rate limit for alert delivery. Default: {defaults?.maxAlertsPerOrgPerHour}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Alert Cooldown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alert Cooldown Profile
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sm-cooldown">Alert Cooldown (ms)</Label>
              <Input
                id="sm-cooldown"
                type="number"
                value={form.alertCooldownMs}
                onChange={(e) => setForm({ ...form, alertCooldownMs: parseInt(e.target.value, 10) || 0 })}
                className="font-mono"
              />
              <p className="text-xs text-foreground-muted">
                Min time between same-type alerts. Current: {formatMs(form.alertCooldownMs)}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Feature Toggles */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Feature Toggles
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoHealEnabled}
                onChange={(e) => setForm({ ...form, autoHealEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Auto-Heal Broken Chains</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.chainIntegrityCheckEnabled}
                onChange={(e) => setForm({ ...form, chainIntegrityCheckEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Chain Integrity Check</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.guardrailAnomalyCheckEnabled}
                onChange={(e) => setForm({ ...form, guardrailAnomalyCheckEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Guardrail Anomaly Check</span>
            </label>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={resetSettings} disabled={resetting}>
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reset to Defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={saveSettings} disabled={saving || !isDirty}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
