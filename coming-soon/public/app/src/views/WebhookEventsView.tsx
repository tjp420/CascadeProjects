import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    Ban,
    CreditCard,
    CalendarClock,
    ShieldAlert,
    Loader2,
    Activity
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

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    'checkout.session.completed': CheckCircle2,
    'customer.subscription.updated': Activity,
    'customer.subscription.deleted': XCircle,
    'invoice.paid': CheckCircle2,
    'invoice.payment_failed': AlertTriangle,
    'customer.subscription.trial_will_end': CalendarClock,
    'charge.dispute.created': ShieldAlert
};

const STATUS_COLORS: Record<string, string> = {
    processed: 'bg-green-500/15 text-green-700 dark:text-green-400',
    ignored: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
    duplicate: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
    error: 'bg-red-500/15 text-red-700 dark:text-red-400'
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

export function WebhookEventsView() {
    const [events, setEvents] = useState<WebhookEvent[]>([]);
    const [stats, setStats] = useState<WebhookStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (filterType) params.set('eventType', filterType);
            if (filterStatus) params.set('status', filterStatus);
            params.set('limit', '100');

            const [eventsResp, statsResp] = await Promise.all([
                fetch(apiUrl(`/webhook-events?${params.toString()}`), { headers: authHeaders() }),
                fetch(apiUrl('/webhook-events/stats'), { headers: authHeaders() })
            ]);

            // Handle non-OK responses (401/403/500) before parsing JSON
            if (!eventsResp.ok && !statsResp.ok) {
                if (eventsResp.status === 401 || eventsResp.status === 403) {
                    setError('Authentication required. Sign in to view webhook events.');
                } else {
                    setError(`Server returned ${eventsResp.status} / ${statsResp.status}`);
                }
                setLoading(false);
                return;
            }

            const eventsData = eventsResp.ok ? await eventsResp.json() : { success: false };
            const statsData = statsResp.ok ? await statsResp.json() : { success: false };

            if (eventsData.success) setEvents(eventsData.events || []);
            if (statsData.success) setStats(statsData.stats);
        } catch {
            setError('Failed to load webhook events. Check your connection to the server.');
        } finally {
            setLoading(false);
        }
    }, [filterType, filterStatus]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const eventTypes = stats ? Object.keys(stats.byType).sort() : [];
    const statusTypes = stats ? Object.keys(stats.byStatus).sort() : [];

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Webhook Events</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor Stripe webhook events in real-time — payment failures, disputes, trial warnings, and
                        more.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2">Refresh</span>
                </Button>
            </div>

            {error && (
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-sm text-destructive">{error}</p>
                    </CardContent>
                </Card>
            )}

            {stats && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Events</CardDescription>
                            <CardTitle className="text-3xl">{stats.total}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Last 24h</CardDescription>
                            <CardTitle className="text-3xl">{stats.last24h}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Processed</CardDescription>
                            <CardTitle className="text-3xl text-green-600">{stats.byStatus.processed || 0}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Errors</CardDescription>
                            <CardTitle className="text-3xl text-red-600">{stats.byStatus.error || 0}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            {stats && (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Events by Type</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {eventTypes.length === 0 && (
                                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                            )}
                            {eventTypes.map(type => {
                                const Icon = EVENT_ICONS[type] || Activity;
                                const count = stats.byType[type];
                                const isCritical = type.includes('payment_failed') || type.includes('dispute');
                                return (
                                    <div key={type} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon
                                                className={`h-4 w-4 ${isCritical ? 'text-red-500' : 'text-muted-foreground'}`}
                                            />
                                            <span className="text-sm font-mono">{type}</span>
                                        </div>
                                        <Badge variant="secondary">{count}</Badge>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Events by Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {statusTypes.length === 0 && (
                                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                            )}
                            {statusTypes.map(status => (
                                <div key={status} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex h-2 w-2 rounded-full ${STATUS_COLORS[status]?.split(' ')[0] || 'bg-gray-400'}`}
                                        />
                                        <span className="text-sm capitalize">{status}</span>
                                    </div>
                                    <Badge variant="secondary">{stats.byStatus[status]}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="flex gap-2 flex-wrap items-center">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="">All types</option>
                    {eventTypes.map(t => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
                <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                >
                    <option value="">All statuses</option>
                    {statusTypes.map(s => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
                {(filterType || filterStatus) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setFilterType('');
                            setFilterStatus('');
                        }}
                    >
                        Clear
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Recent Events</CardTitle>
                    <CardDescription>Latest {events.length} webhook events</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-8">
                            <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">No webhook events recorded yet.</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Events will appear here when Stripe sends webhooks to your endpoint.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {events.map(evt => {
                                const Icon = EVENT_ICONS[evt.eventType] || Activity;
                                const isCritical =
                                    evt.eventType.includes('payment_failed') || evt.eventType.includes('dispute');
                                return (
                                    <div
                                        key={evt.eventId}
                                        className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                                    >
                                        <Icon
                                            className={`h-5 w-5 mt-0.5 shrink-0 ${isCritical ? 'text-red-500' : 'text-muted-foreground'}`}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-mono font-medium">{evt.eventType}</span>
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[evt.status] || STATUS_COLORS.processed}`}
                                                >
                                                    {evt.status}
                                                </span>
                                                {evt.amount && (
                                                    <span className="text-xs text-muted-foreground">{evt.amount}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                <span>{timeAgo(evt.timestamp)}</span>
                                                {evt.customerEmail && (
                                                    <span className="truncate">{evt.customerEmail}</span>
                                                )}
                                                {evt.reason && <span className="text-red-500">{evt.reason}</span>}
                                                {evt.detail && <span>{evt.detail}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
