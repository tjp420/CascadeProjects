import { useState, useEffect, useMemo } from 'react';
import { apiUrl, authHeaders } from '@/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
    Mail,
    Users,
    TrendingUp,
    CheckCircle2,
    Calendar,
    DollarSign,
    Target,
    Send,
    RefreshCw,
    Inbox
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailHistoryEntry {
    sequence: string;
    step: number;
    template: string;
    subject: string;
    sentAt: string;
}

interface ProspectState {
    status: 'pending' | 'contacted';
    sequence: 'A' | 'B' | 'C';
    currentStep: number;
    firstEmailDate: string | null;
    lastEmailDate: string | null;
    replied: boolean;
    repliedAt: string | null;
    meetingBooked: boolean;
    meetingDate: string | null;
    pilotStarted: boolean;
    pilotDate: string | null;
    closed: boolean;
    closedDate: string | null;
    closedValue: number;
    reactivationStep: number;
    sequenceCompleteDate: string | null;
    emailHistory: EmailHistoryEntry[];
}

interface CampaignStats {
    totalContacted: number;
    totalReplies: number;
    totalMeetings: number;
    totalPilots: number;
    totalClosed: number;
}

interface CampaignState {
    createdAt: string;
    updatedAt: string;
    prospects: { [prospectId: string]: ProspectState };
    stats: CampaignStats;
}

interface ProspectRecord {
    id?: string;
    name?: string;
    email?: string;
    company?: string;
    persona?: string;
    [key: string]: unknown;
}

// ── Computed data shapes ──────────────────────────────────────────────────────

interface FunnelStage {
    stage: string;
    count: number;
    fill: string;
}

interface SequenceMetric {
    sequence: string;
    label: string;
    sent: number;
    replies: number;
    meetings: number;
    closes: number;
    replyRate: number;
    meetingRate: number;
    closeRate: number;
}

interface TimelinePoint {
    date: string;
    emailsSent: number;
    cumulativeReplies: number;
}

interface ActivityRow {
    prospectName: string;
    sequence: string;
    step: number;
    subject: string;
    date: string;
    status: 'sent' | 'replied';
}

interface OverviewStats {
    totalProspects: number;
    emailsSent: number;
    replyRate: number;
    meetings: number;
    pipelineValue: number;
    conversionRate: number;
}

// ── Color palette ─────────────────────────────────────────────────────────────

const COLORS = {
    blue: '#3b82f6',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    pink: '#ec4899'
};

const FUNNEL_COLORS = [
    COLORS.blue, // Prospects
    COLORS.cyan, // Contacted
    COLORS.purple, // Replied
    COLORS.amber, // Meetings
    COLORS.pink, // Pilots
    COLORS.green // Closed
];

const SEQUENCE_COLORS: Record<string, string> = {
    A: COLORS.blue,
    B: COLORS.purple,
    C: COLORS.amber
};

const SEQUENCE_LABELS: Record<string, string> = {
    A: 'CLO',
    B: 'CCO',
    C: 'CRO'
};

// ── Helper functions ──────────────────────────────────────────────────────────

function computeFunnelData(campaign: CampaignState): FunnelStage[] {
    const prospects = Object.values(campaign.prospects || {});
    const total = prospects.length;
    const contacted = prospects.filter(p => p.status === 'contacted' || (p.emailHistory?.length ?? 0) > 0).length;
    const replied = prospects.filter(p => p.replied).length;
    const meetings = prospects.filter(p => p.meetingBooked).length;
    const pilots = prospects.filter(p => p.pilotStarted).length;
    const closed = prospects.filter(p => p.closed).length;
    return [
        { stage: 'Prospects', count: total, fill: FUNNEL_COLORS[0] },
        { stage: 'Contacted', count: contacted, fill: FUNNEL_COLORS[1] },
        { stage: 'Replied', count: replied, fill: FUNNEL_COLORS[2] },
        { stage: 'Meetings', count: meetings, fill: FUNNEL_COLORS[3] },
        { stage: 'Pilots', count: pilots, fill: FUNNEL_COLORS[4] },
        { stage: 'Closed', count: closed, fill: FUNNEL_COLORS[5] }
    ];
}

function computeSequenceMetrics(campaign: CampaignState): SequenceMetric[] {
    const prospects = Object.values(campaign.prospects || {});
    const sequences = ['A', 'B', 'C'];
    return sequences.map(seq => {
        const inSeq = prospects.filter(p => p.sequence === seq);
        const sent = inSeq.reduce((sum, p) => sum + (p.emailHistory?.length ?? 0), 0);
        const replies = inSeq.filter(p => p.replied).length;
        const meetings = inSeq.filter(p => p.meetingBooked).length;
        const closes = inSeq.filter(p => p.closed).length;
        const denom = inSeq.length || 1;
        return {
            sequence: seq,
            label: SEQUENCE_LABELS[seq] || seq,
            sent,
            replies,
            meetings,
            closes,
            replyRate: Math.round((replies / denom) * 1000) / 10,
            meetingRate: Math.round((meetings / denom) * 1000) / 10,
            closeRate: Math.round((closes / denom) * 1000) / 10
        };
    });
}

function computeTimelineData(campaign: CampaignState): TimelinePoint[] {
    const prospects = Object.values(campaign.prospects || {});
    const byDate: Record<string, { sent: number; replies: number }> = {};

    for (const p of prospects) {
        for (const e of p.emailHistory || []) {
            if (!e.sentAt) continue;
            const d = e.sentAt.slice(0, 10);
            if (!byDate[d]) byDate[d] = { sent: 0, replies: 0 };
            byDate[d].sent += 1;
        }
        if (p.replied && p.repliedAt) {
            const d = p.repliedAt.slice(0, 10);
            if (!byDate[d]) byDate[d] = { sent: 0, replies: 0 };
            byDate[d].replies += 1;
        }
    }

    const sorted = Object.keys(byDate).sort();
    let cumulative = 0;
    return sorted.map(d => {
        cumulative += byDate[d].replies;
        return {
            date: d,
            emailsSent: byDate[d].sent,
            cumulativeReplies: cumulative
        };
    });
}

function computeRecentActivity(campaign: CampaignState, prospects: ProspectRecord[]): ActivityRow[] {
    const prospectMap: Record<string, ProspectRecord> = {};
    for (const p of prospects) {
        if (p.id) prospectMap[p.id] = p;
    }

    const rows: ActivityRow[] = [];
    const entries = Object.entries(campaign.prospects || {});

    for (const [prospectId, p] of entries) {
        const rec = prospectMap[prospectId];
        const name = rec?.name || rec?.email || prospectId;
        for (const e of p.emailHistory || []) {
            rows.push({
                prospectName: name,
                sequence: e.sequence,
                step: e.step,
                subject: e.subject,
                date: e.sentAt,
                status: 'sent'
            });
        }
        if (p.replied && p.repliedAt) {
            rows.push({
                prospectName: name,
                sequence: p.sequence,
                step: p.currentStep,
                subject: 'Reply received',
                date: p.repliedAt,
                status: 'replied'
            });
        }
    }

    return rows.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
}

function computeOverviewStats(campaign: CampaignState): OverviewStats {
    const prospects = Object.values(campaign.prospects || {});
    const total = prospects.length;
    const emailsSent = prospects.reduce((sum, p) => sum + (p.emailHistory?.length ?? 0), 0);
    const replies = prospects.filter(p => p.replied).length;
    const meetings = prospects.filter(p => p.meetingBooked).length;
    const closed = prospects.filter(p => p.closed).length;
    const pipelineValue = prospects.reduce((sum, p) => sum + (p.closedValue || 0), 0);
    return {
        totalProspects: total,
        emailsSent,
        replyRate: total ? Math.round((replies / total) * 1000) / 10 : 0,
        meetings,
        pipelineValue,
        conversionRate: total ? Math.round((closed / total) * 1000) / 10 : 0
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OutreachAnalyticsView() {
    const [campaign, setCampaign] = useState<CampaignState | null>(null);
    const [prospects, setProspects] = useState<ProspectRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Campaign state — localStorage first, then API fallback
            let campaignState: CampaignState | null = null;
            const rawCampaign = localStorage.getItem('sb_outreach_campaign_state');
            if (rawCampaign) {
                try {
                    campaignState = JSON.parse(rawCampaign) as CampaignState;
                } catch {
                    /* ignore parse error */
                }
            }
            if (!campaignState) {
                try {
                    const res = await fetch(apiUrl('/outreach/campaign-state'), { headers: authHeaders() });
                    if (res.ok) campaignState = (await res.json()) as CampaignState;
                } catch {
                    /* API optional */
                }
            }

            // Prospects — localStorage first, then API fallback
            let prospectList: ProspectRecord[] = [];
            const rawProspects = localStorage.getItem('sb_outreach_prospects');
            if (rawProspects) {
                try {
                    prospectList = JSON.parse(rawProspects) as ProspectRecord[];
                } catch {
                    /* ignore parse error */
                }
            }
            if (prospectList.length === 0) {
                try {
                    const res = await fetch(apiUrl('/outreach/prospects'), { headers: authHeaders() });
                    if (res.ok) prospectList = (await res.json()) as ProspectRecord[];
                } catch {
                    /* API optional */
                }
            }

            setCampaign(campaignState);
            setProspects(prospectList);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load outreach data');
        } finally {
            setLoading(false);
        }
    };

    // simplebeacon-ignore: framework-practices — standard React useEffect hook
    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const overview = useMemo(() => {
        if (!campaign) return null;
        return computeOverviewStats(campaign);
    }, [campaign]);

    const funnelData = useMemo(() => {
        if (!campaign) return [];
        return computeFunnelData(campaign);
    }, [campaign]);

    const sequenceMetrics = useMemo(() => {
        if (!campaign) return [];
        return computeSequenceMetrics(campaign);
    }, [campaign]);

    const personaData = useMemo(() => {
        if (!campaign) return [];
        const prospectsList = Object.values(campaign.prospects || {});
        const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
        for (const p of prospectsList) {
            if (p.sequence in counts) counts[p.sequence] += 1;
        }
        return (['A', 'B', 'C'] as const).map(seq => ({
            name: SEQUENCE_LABELS[seq],
            value: counts[seq],
            fill: SEQUENCE_COLORS[seq]
        }));
    }, [campaign]);

    const timelineData = useMemo(() => {
        if (!campaign) return [];
        return computeTimelineData(campaign);
    }, [campaign]);

    const recentActivity = useMemo(() => {
        if (!campaign) return [];
        return computeRecentActivity(campaign, prospects);
    }, [campaign, prospects]);

    // ── Loading state ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">Outreach Analytics</h3>
                    <p className="text-sm text-muted-foreground">Campaign performance and prospect engagement</p>
                </div>
                <div className="flex items-center justify-center p-20 text-sm text-muted-foreground">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading campaign data…
                </div>
            </div>
        );
    }

    // ── Error state ────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">Outreach Analytics</h3>
                    <p className="text-sm text-muted-foreground">Campaign performance and prospect engagement</p>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-danger">{error}</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={loadData}>
                            <RefreshCw className="h-4 w-4" /> Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── Empty state ─────────────────────────────────────────────────────────────
    if (!campaign || !overview || overview.totalProspects === 0) {
        return (
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">Outreach Analytics</h3>
                    <p className="text-sm text-muted-foreground">Campaign performance and prospect engagement</p>
                </div>
                <Card>
                    <CardContent className="pt-6 flex flex-col items-center gap-3 py-12">
                        <Inbox className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            No outreach campaign data found. Run the outreach pipeline to populate prospect sequences
                            and start tracking campaign analytics here.
                        </p>
                        <Button variant="outline" size="sm" onClick={loadData}>
                            <RefreshCw className="h-4 w-4" /> Refresh
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Outreach Analytics</h3>
                    <p className="text-sm text-muted-foreground">Campaign performance and prospect engagement</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Overview KPI cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.totalProspects}</div>
                        <p className="text-xs text-muted-foreground">in campaign</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                        <Send className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.emailsSent}</div>
                        <p className="text-xs text-muted-foreground">across all sequences</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.replyRate}%</div>
                        <p className="text-xs text-muted-foreground">of prospects replied</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.meetings}</div>
                        <p className="text-xs text-muted-foreground">from outreach</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${overview.pipelineValue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">closed value</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.conversionRate}%</div>
                        <p className="text-xs text-muted-foreground">prospects closed</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="funnel">
                <TabsList>
                    <TabsTrigger value="funnel">Funnel</TabsTrigger>
                    <TabsTrigger value="sequences">Sequences</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                {/* Tab 1: Funnel */}
                <TabsContent value="funnel" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Conversion Funnel</CardTitle>
                            <CardDescription>
                                Prospects progressing through each stage of the outreach campaign
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                    data={funnelData}
                                    layout="vertical"
                                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis dataKey="stage" type="category" width={90} />
                                    <Tooltip cursor={{ fill: 'transparent' }} formatter={v => [String(v), 'Count']} />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                        {funnelData.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>

                            <Separator className="my-4" />

                            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                                {funnelData.map((stage, idx) => {
                                    const prev = idx > 0 ? funnelData[idx - 1].count : stage.count;
                                    const rate = prev ? Math.round((stage.count / prev) * 1000) / 10 : 0;
                                    return (
                                        <div key={stage.stage} className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="inline-block h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: stage.fill }}
                                                />
                                                <span className="text-sm font-medium">{stage.stage}</span>
                                            </div>
                                            <span className="text-xl font-bold">{stage.count}</span>
                                            {idx > 0 && (
                                                <span className="text-xs text-muted-foreground">
                                                    {rate}% from previous
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Sequences */}
                <TabsContent value="sequences" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Sequence Performance</CardTitle>
                                <CardDescription>
                                    Emails sent, replies, meetings, and closes per sequence
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={sequenceMetrics} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="label" />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar
                                            dataKey="sent"
                                            name="Emails Sent"
                                            fill={COLORS.blue}
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="replies"
                                            name="Replies"
                                            fill={COLORS.purple}
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="meetings"
                                            name="Meetings"
                                            fill={COLORS.amber}
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Bar dataKey="closes" name="Closes" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Persona Distribution</CardTitle>
                                <CardDescription>
                                    Prospect allocation across CLO, CCO, and CRO sequences
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={personaData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            label
                                        >
                                            {personaData.map((entry, idx) => (
                                                <Cell key={idx} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Sequence Conversion Rates</CardTitle>
                            <CardDescription>Reply, meeting, and close rates per sequence (%)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={sequenceMetrics} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" />
                                    <YAxis unit="%" />
                                    <Tooltip formatter={v => `${v}%`} />
                                    <Legend />
                                    <Bar
                                        dataKey="replyRate"
                                        name="Reply Rate"
                                        fill={COLORS.purple}
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="meetingRate"
                                        name="Meeting Rate"
                                        fill={COLORS.amber}
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="closeRate"
                                        name="Close Rate"
                                        fill={COLORS.green}
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Timeline */}
                <TabsContent value="timeline" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Emails Sent Over Time</CardTitle>
                            <CardDescription>Daily email send volume across all sequences</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {timelineData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={timelineData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                                        <defs>
                                            <linearGradient id="emailArea" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.4} />
                                                <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Area
                                            type="monotone"
                                            dataKey="emailsSent"
                                            name="Emails Sent"
                                            stroke={COLORS.blue}
                                            fill="url(#emailArea)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="py-12 text-center text-sm text-muted-foreground">
                                    No email send history available yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Cumulative Replies</CardTitle>
                            <CardDescription>Total replies accumulated over time</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {timelineData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={timelineData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Line
                                            type="monotone"
                                            dataKey="cumulativeReplies"
                                            name="Cumulative Replies"
                                            stroke={COLORS.green}
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="py-12 text-center text-sm text-muted-foreground">
                                    No reply data available yet.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 4: Activity */}
                <TabsContent value="activity" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                            <CardDescription>Latest email sends and replies (last 20)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {recentActivity.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                                                <th className="pb-2 pr-4 font-medium">Prospect</th>
                                                <th className="pb-2 pr-4 font-medium">Sequence / Step</th>
                                                <th className="pb-2 pr-4 font-medium">Subject</th>
                                                <th className="pb-2 pr-4 font-medium">Date</th>
                                                <th className="pb-2 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentActivity.map((row, idx) => (
                                                <tr key={idx} className="border-b last:border-0">
                                                    <td className="py-2 pr-4 font-medium">{row.prospectName}</td>
                                                    <td className="py-2 pr-4">
                                                        <Badge variant="outline">
                                                            {SEQUENCE_LABELS[row.sequence] || row.sequence} · Step{' '}
                                                            {row.step}
                                                        </Badge>
                                                    </td>
                                                    <td
                                                        className="py-2 pr-4 max-w-xs truncate text-muted-foreground"
                                                        title={row.subject}
                                                    >
                                                        {row.subject}
                                                    </td>
                                                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                                                        {row.date ? new Date(row.date).toLocaleString() : '—'}
                                                    </td>
                                                    <td className="py-2">
                                                        {row.status === 'replied' ? (
                                                            <Badge className="gap-1">
                                                                <CheckCircle2 className="h-3 w-3" /> Replied
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="gap-1">
                                                                <Mail className="h-3 w-3" /> Sent
                                                            </Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="py-12 text-center text-sm text-muted-foreground">
                                    No recent activity to display.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
