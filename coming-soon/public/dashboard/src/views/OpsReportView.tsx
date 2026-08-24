import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Loader2,
  BarChart3,
  Mail,
  Send,
  ShieldAlert,
  CalendarClock,
  CreditCard,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';

interface WebhookEvent {
  eventId: string;
  eventType: string;
  customerEmail: string | null;
  status: string;
  tier: string | null;
  amount: string | null;
  reason: string | null;
  detail: string | null;
  timestamp: string;
}

interface WebhookStats {
  total: number;
  last24h: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  oldestEvent: string | null;
  newestEvent: string | null;
}

interface OpsReportStatus {
  success: boolean;
  schedulerEnabled: boolean;
  recipient: string;
  scheduledHour: number;
}

const EVENT_META: Record<string, { icon: LucideIcon; label: string; critical: boolean }> = {
  'checkout.session.completed': { icon: CheckCircle2, label: 'New Subscriptions', critical: false },
  'customer.subscription.updated': { icon: Activity, label: 'Subscription Updates', critical: false },
  'customer.subscription.deleted': { icon: XCircle, label: 'Cancellations', critical: true },
  'invoice.paid': { icon: CheckCircle2, label: 'Successful Payments', critical: false },
  'invoice.payment_failed': { icon: AlertTriangle, label: 'Payment Failures', critical: true },
  'customer.subscription.trial_will_end': { icon: CalendarClock, label: 'Trial Ending', critical: false },
  'charge.dispute.created': { icon: ShieldAlert, label: 'Disputes', critical: true },
  'invoice.upcoming': { icon: Receipt, label: 'Upcoming Invoices', critical: false },
};

const STATUS_COLORS: Record<string, string> = {
  processed: 'bg-green-500/15 text-green-700 dark:text-green-400',
  ignored: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
  duplicate: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  error: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function hourBucket(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:00`;
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function OpsReportView() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [reportStatus, setReportStatus] = useState<OpsReportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsResp, statsResp, statusResp] = await Promise.all([
        fetch(apiUrl('/webhook-events?limit=200'), { headers: authHeaders() }),
        fetch(apiUrl('/webhook-events/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/ops-report/status'), { headers: authHeaders() }),
      ]);

      // If all three endpoints fail, surface an error
      if (!eventsResp.ok && !statsResp.ok && !statusResp.ok) {
        if (eventsResp.status === 401 || eventsResp.status === 403) {
          setError('Authentication required. Sign in to view operations data.');
        } else {
          setError(`Server returned ${eventsResp.status} / ${statsResp.status} / ${statusResp.status}`);
        }
        setLoading(false);
        return;
      }

      const eventsData = eventsResp.ok ? await eventsResp.json() : { success: false };
      const statsData = statsResp.ok ? await statsResp.json() : { success: false };
      const statusData = statusResp.ok ? await statusResp.json() : { success: false };

      if (eventsData.success) setEvents(eventsData.events || []);
      if (statsData.success) setStats(statsData.stats);
      if (statusData.success) setReportStatus(statusData);
    } catch {
      setError('Failed to load operations data. Check your connection to the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTriggerReport = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const resp = await fetch(apiUrl('/ops-report/trigger'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (data.success) {
        setTriggerResult(data.queued ? 'Report queued for delivery' : 'Report sent successfully');
      } else {
        setTriggerResult(`Failed: ${data.error || 'unknown error'}`);
      }
    } catch {
      setTriggerResult('Failed to trigger report');
    } finally {
      setTriggering(false);
      setTimeout(() => setTriggerResult(null), 5000);
    }
  };

  // Compute metrics from events
  const last24hEvents = events.filter(
    (e) => Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000
  );

  const failureCount = last24hEvents.filter((e) =>
    e.eventType.includes('payment_failed') || e.eventType.includes('dispute')
  ).length;

  const successCount = last24hEvents.filter((e) =>
    e.eventType === 'checkout.session.completed' || e.eventType === 'invoice.paid'
  ).length;

  const errorCount = last24hEvents.filter((e) => e.status === 'error').length;

  const failureRate = last24hEvents.length > 0
    ? ((failureCount / last24hEvents.length) * 100).toFixed(1)
    : '0.0';

  // Build hourly distribution for last 24h
  const hourlyBuckets: Record<string, number> = {};
  for (let h = 0; h < 24; h++) {
    const key = `${h.toString().padStart(2, '0')}:00`;
    hourlyBuckets[key] = 0;
  }
  for (const e of last24hEvents) {
    const bucket = hourBucket(e.timestamp);
    if (hourlyBuckets[bucket] !== undefined) hourlyBuckets[bucket]++;
  }
  const maxHourly = Math.max(1, ...Object.values(hourlyBuckets));

  // Build event type distribution
  const typeDistribution: Record<string, number> = {};
  for (const e of last24hEvents) {
    typeDistribution[e.eventType] = (typeDistribution[e.eventType] || 0) + 1;
  }
  const sortedTypes = Object.entries(typeDistribution).sort((a, b) => b[1] - a[1]);
  const maxTypeCount = Math.max(1, ...Object.values(typeDistribution));

  // Build daily trend (last 7 days)
  const dailyBuckets: Record<string, number> = {};
  for (let d = 6; d >= 0; d--) {
    const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    const key = dayBucket(date.toISOString());
    dailyBuckets[key] = 0;
  }
  for (const e of events) {
    const key = dayBucket(e.timestamp);
    if (dailyBuckets[key] !== undefined) dailyBuckets[key]++;
  }
  const maxDaily = Math.max(1, ...Object.values(dailyBuckets));

  // Critical events (failures, disputes, errors)
  const criticalEvents = last24hEvents
    .filter((e) =>
      e.eventType.includes('payment_failed') ||
      e.eventType.includes('dispute') ||
      e.status === 'error'
    )
    .slice(0, 10);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            24-hour billing operations overview — event trends, failure rates, and critical alerts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerReport}
            disabled={triggering}
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-2">Send Report</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {triggerResult && (
        <Card className={triggerResult.includes('Failed') ? 'border-destructive' : 'border-green-500'}>
          <CardContent className="pt-6">
            <p className={`text-sm ${triggerResult.includes('Failed') ? 'text-destructive' : 'text-green-600'}`}>
              {triggerResult}
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* KPI Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total Events (24h)</CardDescription>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl">{last24hEvents.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Successful Payments</CardDescription>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <CardTitle className="text-3xl text-green-600">{successCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Critical Events</CardDescription>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <CardTitle className="text-3xl text-red-600">{failureCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Failure Rate</CardDescription>
              {parseFloat(failureRate) > 10 ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
            </div>
            <CardTitle className="text-3xl">{failureRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Hourly Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Event Volume — Last 24 Hours</CardTitle>
          <CardDescription>Hourly webhook event distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40">
            {Object.entries(hourlyBuckets).map(([hour, count]) => (
              <div
                key={hour}
                className="flex-1 flex flex-col items-center gap-1 group"
                title={`${hour}: ${count} events`}
              >
                <div
                  className="w-full rounded-t bg-blue-500/70 group-hover:bg-blue-500 transition-colors"
                  style={{
                    height: `${(count / maxHourly) * 100}%`,
                    minHeight: count > 0 ? '4px' : '0',
                  }}
                />
                <span className="text-[9px] text-muted-foreground -rotate-45 origin-center whitespace-nowrap">
                  {hour}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 7-Day Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">7-Day Event Trend</CardTitle>
            <CardDescription>Daily webhook event volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-32">
              {Object.entries(dailyBuckets).map(([day, count]) => (
                <div
                  key={day}
                  className="flex-1 flex flex-col items-center gap-1 group"
                  title={`${day}: ${count} events`}
                >
                  <span className="text-xs font-medium text-muted-foreground">{count}</span>
                  <div
                    className="w-full rounded-t bg-indigo-500/70 group-hover:bg-indigo-500 transition-colors"
                    style={{
                      height: `${(count / maxDaily) * 80}%`,
                      minHeight: count > 0 ? '4px' : '0',
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Event Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Event Type Distribution (24h)</CardTitle>
            <CardDescription>Breakdown by Stripe event type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">No events in the last 24 hours.</p>
            )}
            {sortedTypes.map(([type, count]) => {
              const meta = EVENT_META[type] || { icon: Activity, label: type, critical: false };
              const Icon = meta.icon;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-4 w-4 ${meta.critical ? 'text-red-500' : 'text-muted-foreground'}`}
                      />
                      <span className="font-medium">{meta.label}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${meta.critical ? 'bg-red-500/70' : 'bg-blue-500/70'}`}
                      style={{ width: `${(count / maxTypeCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown + Scheduler Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Processing Status (24h)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats &&
              Object.entries(stats.byStatus)
                .sort()
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge className={STATUS_COLORS[status] || 'bg-gray-500/15 text-gray-600'}>
                      {status}
                    </Badge>
                    <span className="font-mono text-sm">{count}</span>
                  </div>
                ))}
            {errorCount > 0 && (
              <div className="mt-2 pt-2 border-t">
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{errorCount} processing errors in last 24h</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Report Scheduler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportStatus ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    className={
                      reportStatus.schedulerEnabled
                        ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                        : 'bg-gray-500/15 text-gray-600 dark:text-gray-400'
                    }
                  >
                    {reportStatus.schedulerEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recipient</span>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-mono">{reportStatus.recipient}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scheduled Hour</span>
                  <span className="text-sm font-mono">
                    {reportStatus.scheduledHour}:00 (local)
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Scheduler status unavailable.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Critical Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Critical Events — Last 24h</CardTitle>
          <CardDescription>
            Payment failures, disputes, and processing errors requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {criticalEvents.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600 py-4">
              <CheckCircle2 className="h-4 w-4" />
              <span>No critical events in the last 24 hours.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {criticalEvents.map((evt) => {
                const meta = EVENT_META[evt.eventType] || { icon: AlertTriangle, label: evt.eventType, critical: true };
                const Icon = meta.icon;
                return (
                  <div
                    key={evt.eventId}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-4 w-4 text-red-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{meta.label}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {evt.customerEmail || '—'} {evt.reason ? `· ${evt.reason}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {evt.amount && (
                        <span className="text-xs font-mono text-muted-foreground">{evt.amount}</span>
                      )}
                      <Badge className={STATUS_COLORS[evt.status] || ''}>{evt.status}</Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(evt.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5" />
        <span>
          Data from webhook event log · {stats?.total || 0} total events recorded
        </span>
      </div>
    </div>
  );
}
