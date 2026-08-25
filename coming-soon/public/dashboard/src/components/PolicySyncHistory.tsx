import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    AreaChart,
    Area
} from 'recharts';
import {
    RefreshCw,
    Loader2,
    Activity,
    TrendingUp,
    GitMerge,
    Replace,
    Copy,
    SkipForward,
    Trash2,
    Clock,
    Building2,
    History
} from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';

interface TimelinePoint {
    date: string;
    syncs: number;
    cloned: number;
    skipped: number;
    removed: number;
}

interface ActorStat {
    actor: string;
    syncs: number;
    cloned: number;
}

interface SourceOrgStat {
    sourceOrg: string;
    syncs: number;
    cloned: number;
}

interface RecentSync {
    id: string;
    timestamp: string;
    actorEmail: string;
    sourceOrgId: string;
    targetCount: number;
    mode: string;
    totalCloned: number;
    totalSkipped: number;
    totalRemoved: number;
}

interface SyncHistoryData {
    success: boolean;
    totalSyncs: number;
    totalCloned: number;
    totalSkipped: number;
    totalRemoved: number;
    mergeCount: number;
    replaceCount: number;
    timeline: TimelinePoint[];
    actors: ActorStat[];
    sourceOrgs: SourceOrgStat[];
    recent: RecentSync[];
    days: number;
}

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

function formatTimeAgo(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
}

function formatDay(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PolicySyncHistory() {
    const [data, setData] = useState<SyncHistoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await fetch(apiUrl('audit/pii/sync-history?days=' + days + '&limit=50'), {
                headers: authHeaders(),
                credentials: 'include'
            });
            if (!resp.ok) {
                const b = await resp.json().catch(() => ({}));
                throw new Error(b.message || 'HTTP ' + resp.status);
            }
            const json = await resp.json();
            setData(json);
        } catch (err) {
            console.warn('[PolicySyncHistory] fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        void fetchHistory();
    }, [fetchHistory]);

    const modeData = data
        ? [
              { name: 'Merge', value: data.mergeCount, color: '#3b82f6' },
              { name: 'Replace', value: data.replaceCount, color: '#ef4444' }
          ].filter(d => d.value > 0)
        : [];

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Policy Sync History
                        </CardTitle>
                        <CardDescription className="mt-1">Synchronization telemetry and audit trail</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={days}
                            onChange={e => setDays(parseInt(e.target.value, 10))}
                            className="px-2 py-1 border rounded text-xs"
                        >
                            <option value={7}>7 days</option>
                            <option value={30}>30 days</option>
                            <option value={90}>90 days</option>
                            <option value={365}>1 year</option>
                        </select>
                        <Button size="sm" variant="outline" onClick={() => void fetchHistory()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Loader2 className="h-6 w-6 text-foreground-muted animate-spin" />
                        <p className="text-sm text-foreground-muted">Loading sync history...</p>
                    </div>
                ) : !data || data.totalSyncs === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Activity className="h-8 w-8 text-foreground-muted" />
                        <p className="text-sm text-foreground-muted">No policy sync events in the selected period</p>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                                    <Activity className="h-3.5 w-3.5" /> Total Syncs
                                </div>
                                <p className="text-2xl font-bold">{data.totalSyncs}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                                    <Copy className="h-3.5 w-3.5" /> Policies Cloned
                                </div>
                                <p className="text-2xl font-bold text-green-500">{data.totalCloned}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                                    <SkipForward className="h-3.5 w-3.5" /> Skipped
                                </div>
                                <p className="text-2xl font-bold text-gray-500">{data.totalSkipped}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                                    <Trash2 className="h-3.5 w-3.5" /> Removed
                                </div>
                                <p className="text-2xl font-bold text-red-500">{data.totalRemoved}</p>
                            </div>
                        </div>

                        {/* Timeline Chart */}
                        {data.timeline.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4" /> Sync Activity Over Time
                                </h4>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.timeline}>
                                            <defs>
                                                <linearGradient id="clonedGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="removedGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                            <XAxis dataKey="date" tickFormatter={formatDay} fontSize={11} />
                                            <YAxis fontSize={11} />
                                            <Tooltip
                                                labelFormatter={label => formatDay(label)}
                                                contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <Area
                                                type="monotone"
                                                dataKey="cloned"
                                                stroke="#10b981"
                                                fill="url(#clonedGrad)"
                                                name="Cloned"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="removed"
                                                stroke="#ef4444"
                                                fill="url(#removedGrad)"
                                                name="Removed"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="skipped"
                                                stroke="#f59e0b"
                                                fill="none"
                                                name="Skipped"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Mode Distribution + Syncs per Day */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {modeData.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-1">
                                        <GitMerge className="h-4 w-4" /> Sync Mode Distribution
                                    </h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={modeData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={40}
                                                    outerRadius={70}
                                                    dataKey="value"
                                                >
                                                    {modeData.map((entry, i) => (
                                                        <Cell key={i} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {data.timeline.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-1">
                                        <Activity className="h-4 w-4" /> Syncs Per Day
                                    </h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={data.timeline}>
                                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                                <XAxis dataKey="date" tickFormatter={formatDay} fontSize={11} />
                                                <YAxis fontSize={11} allowDecimals={false} />
                                                <Tooltip
                                                    labelFormatter={label => formatDay(label)}
                                                    contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                                                />
                                                <Bar
                                                    dataKey="syncs"
                                                    fill="#3b82f6"
                                                    name="Syncs"
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Top Actors + Source Orgs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.actors.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">Top Operators</h4>
                                    <div className="space-y-1.5">
                                        {data.actors.map(a => (
                                            <div
                                                key={a.actor}
                                                className="flex items-center justify-between text-xs border-b pb-1.5 last:border-0"
                                            >
                                                <span className="font-mono truncate flex-1">{a.actor}</span>
                                                <div className="flex items-center gap-3 ml-2">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {a.syncs} syncs
                                                    </Badge>
                                                    <span className="text-green-500">{a.cloned} cloned</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.sourceOrgs.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-1">
                                        <Building2 className="h-4 w-4" /> Top Source Orgs
                                    </h4>
                                    <div className="space-y-1.5">
                                        {data.sourceOrgs.map(s => (
                                            <div
                                                key={s.sourceOrg}
                                                className="flex items-center justify-between text-xs border-b pb-1.5 last:border-0"
                                            >
                                                <span className="font-mono truncate flex-1">{s.sourceOrg}</span>
                                                <div className="flex items-center gap-3 ml-2">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {s.syncs} syncs
                                                    </Badge>
                                                    <span className="text-green-500">{s.cloned} cloned</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Recent Events Table */}
                        {data.recent.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-1">
                                    <Clock className="h-4 w-4" /> Recent Sync Events
                                </h4>
                                <div className="space-y-1 max-h-64 overflow-y-auto">
                                    {data.recent.map(e => (
                                        <div
                                            key={e.id}
                                            className="flex items-center gap-3 text-xs border rounded px-3 py-2"
                                        >
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {e.mode === 'replace' ? (
                                                    <Replace className="h-3.5 w-3.5 text-red-500" />
                                                ) : (
                                                    <GitMerge className="h-3.5 w-3.5 text-blue-500" />
                                                )}
                                                <span className="text-foreground-muted">{e.mode}</span>
                                            </div>
                                            <span className="font-mono text-foreground-muted truncate flex-1">
                                                {e.sourceOrgId}
                                            </span>
                                            <span className="text-foreground-muted">
                                                {'->'} {e.targetCount} targets
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]"
                                            >
                                                +{e.totalCloned}
                                            </Badge>
                                            {e.totalRemoved > 0 && (
                                                <Badge
                                                    variant="outline"
                                                    className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]"
                                                >
                                                    -{e.totalRemoved}
                                                </Badge>
                                            )}
                                            <span className="text-foreground-muted flex-shrink-0">
                                                {formatTimeAgo(e.timestamp)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
