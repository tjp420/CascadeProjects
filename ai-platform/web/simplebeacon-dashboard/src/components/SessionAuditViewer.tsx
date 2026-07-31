import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ScrollText,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  User,
  Bot,
  Clock,
  Cpu,
  Trash2,
  Search,
  Activity,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface SessionSummary {
  sessionId: string;
  userId: string;
  orgId: string;
  startedAt: string;
  lastActivityAt: string;
  turnCount: number;
  providers: string[];
}

interface Turn {
  turnId: string;
  requestId: string;
  timestamp: string;
  userMessage: string;
  assistantResponse: string;
  provider: string;
  model: string;
  personality: string;
  conversationHistoryLength: number;
  conversationHistory: Array<{ role: string; contentLength: number; contentPreview: string }>;
  routingDecision: {
    routed: boolean;
    provider: string;
    model: string;
    complexityScore: number;
    tokenEstimate: number;
    override: boolean;
    reason: string;
  } | null;
  timing: any;
  inferenceDurationMs: number | null;
  refusalDetected: boolean;
  retried: boolean;
  fallbackModelUsed: string | null;
}

interface SessionDetail {
  sessionId: string;
  userId: string;
  orgId: string;
  startedAt: string;
  lastActivityAt: string;
  turnCount: number;
  turns: Turn[];
}

interface SessionStats {
  totalSessions: number;
  totalTurns: number;
  avgTurnsPerSession: number;
  providerDistribution: Record<string, number>;
  refusalsDetected: number;
  fallbacksUsed: number;
  routingOverrides: number;
  avgInferenceDurationMs: number | null;
}

export function SessionAuditViewer() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [expandedTurns, setExpandedTurns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('userId', searchQuery);
      if (filterProvider) params.set('provider', filterProvider);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const resp = await fetch(apiUrl(`/session-audit/sessions?${params.toString()}`), {
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (data.success) {
        setSessions(data.sessions || []);
        setTotalCount(data.total || 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterProvider, offset]);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/session-audit/stats'), { headers: authHeaders() });
      const data = await resp.json();
      if (data.success) setStats(data.stats);
    } catch {
      // silent
    }
  }, []);

  const fetchSession = async (sessionId: string) => {
    setLoadingSession(true);
    try {
      const resp = await fetch(apiUrl(`/session-audit/sessions/${sessionId}`), {
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (data.success) {
        setSelectedSession(data.session);
      }
    } catch {
      toast.error('Failed to load session');
    } finally {
      setLoadingSession(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const resp = await fetch(apiUrl(`/session-audit/sessions/${sessionId}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to delete session');
        return;
      }
      toast.success('Session deleted');
      if (selectedSession?.sessionId === sessionId) setSelectedSession(null);
      fetchSessions();
      fetchStats();
    } catch {
      toast.error('Failed to delete session');
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchStats();
  }, [fetchSessions, fetchStats]);

  const toggleTurn = (turnId: string) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const providerBadge = (p: string) => {
    if (p === 'openai') return <Badge variant="secondary" className="text-xs">OpenAI</Badge>;
    if (p === 'anthropic') return <Badge variant="secondary" className="text-xs">Anthropic</Badge>;
    if (p === 'ollama') return <Badge variant="outline" className="text-xs">Ollama</Badge>;
    if (p === 'demo') return <Badge variant="outline" className="text-xs">Demo</Badge>;
    return <Badge variant="outline" className="text-xs">{p}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" />
                Session Audit & Replay
              </CardTitle>
              <CardDescription>
                Step-by-step user-model conversation histories for compliance teams
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => { fetchSessions(); fetchStats(); }}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Sessions</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalSessions ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Turns</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalTurns ?? 0}</p>
              <p className="text-xs text-foreground-muted">Avg {stats?.avgTurnsPerSession ?? 0}/session</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Routing Overrides</p>
              </div>
              <p className="text-lg font-semibold">{stats?.routingOverrides ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Avg Inference</p>
              </div>
              <p className="text-lg font-semibold">
                {stats?.avgInferenceDurationMs ? `${stats.avgInferenceDurationMs}ms` : '—'}
              </p>
            </div>
          </div>

          {stats && Object.keys(stats.providerDistribution).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(stats.providerDistribution).map(([prov, count]) => (
                <Badge key={prov} variant="secondary" className="text-xs">
                  {prov}: {count}
                </Badge>
              ))}
              {stats.refusalsDetected > 0 && (
                <Badge variant="warning" className="text-xs">Refusals: {stats.refusalsDetected}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        {/* Session List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Search by user..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setOffset(0); }}
                className="text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => { fetchSessions(); }}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
            <select
              value={filterProvider}
              onChange={(e) => { setFilterProvider(e.target.value); setOffset(0); }}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">All Providers</option>
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>

            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-foreground-muted">Loading...</span>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-foreground-muted text-center py-8">No sessions found</p>
            ) : (
              <>
                {sessions.map((s) => (
                  <div
                    key={s.sessionId}
                    className={`rounded-md border p-2 cursor-pointer transition-colors ${
                      selectedSession?.sessionId === s.sessionId
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/10 hover:bg-muted/20'
                    }`}
                    onClick={() => fetchSession(s.sessionId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{s.userId}</p>
                        <p className="text-[10px] text-foreground-muted">{formatTime(s.lastActivityAt)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px]">{s.turnCount} turns</Badge>
                          {s.providers.map((p) => (
                            <span key={p}>{providerBadge(p)}</span>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.sessionId); }}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                  >
                    Prev
                  </Button>
                  <span className="text-xs text-foreground-muted">
                    {offset + 1}-{Math.min(offset + limit, totalCount)} of {totalCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + limit >= totalCount}
                    onClick={() => setOffset(offset + limit)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Session Detail / Replay */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {selectedSession ? `Replay: ${selectedSession.userId}` : 'Select a session to replay'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSession ? (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-foreground-muted">Loading session...</span>
              </div>
            ) : !selectedSession ? (
              <p className="text-xs text-foreground-muted text-center py-12">
                Choose a session from the list to view the full conversation replay
              </p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                <div className="flex items-center gap-2 text-xs text-foreground-muted">
                  <Clock className="h-3 w-3" />
                  Started: {formatTime(selectedSession.startedAt)}
                  <Separator orientation="vertical" className="h-3" />
                  {selectedSession.turnCount} turns
                </div>
                <Separator />
                {selectedSession.turns.map((turn, idx) => {
                  const expanded = expandedTurns.has(turn.turnId);
                  return (
                    <div key={turn.turnId} className="space-y-2">
                      {/* Turn header */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-foreground-muted">#{idx + 1}</span>
                        <span className="text-foreground-muted">{formatTime(turn.timestamp)}</span>
                        {providerBadge(turn.provider)}
                        {turn.model && (
                          <Badge variant="outline" className="text-[10px] font-mono">{turn.model}</Badge>
                        )}
                        {turn.refusalDetected && (
                          <Badge variant="warning" className="text-[10px]">Refusal</Badge>
                        )}
                        {turn.routingDecision?.override && (
                          <Badge variant="secondary" className="text-[10px]">Routed</Badge>
                        )}
                        {turn.inferenceDurationMs !== null && (
                          <span className="text-[10px] text-foreground-muted">{turn.inferenceDurationMs}ms</span>
                        )}
                      </div>

                      {/* User message */}
                      <div className="flex gap-2">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 rounded-md border border-border bg-muted/10 p-2">
                          <p className={`text-xs whitespace-pre-wrap ${expanded ? '' : 'line-clamp-4'}`}>
                            {turn.userMessage}
                          </p>
                        </div>
                      </div>

                      {/* Assistant response */}
                      <div className="flex gap-2">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-secondary" />
                        </div>
                        <div className="flex-1 rounded-md border border-border bg-muted/5 p-2">
                          <p className={`text-xs whitespace-pre-wrap ${expanded ? '' : 'line-clamp-4'}`}>
                            {turn.assistantResponse}
                          </p>
                          {!expanded && (turn.userMessage.length > 200 || turn.assistantResponse.length > 200) && (
                            <button
                              onClick={() => toggleTurn(turn.turnId)}
                              className="text-[10px] text-primary hover:underline mt-1 flex items-center gap-1"
                            >
                              <ChevronDown className="h-3 w-3" /> Expand
                            </button>
                          )}
                          {expanded && (
                            <button
                              onClick={() => toggleTurn(turn.turnId)}
                              className="text-[10px] text-primary hover:underline mt-1 flex items-center gap-1"
                            >
                              <ChevronRight className="h-3 w-3" /> Collapse
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Turn metadata (expanded) */}
                      {expanded && (
                        <div className="ml-9 rounded-md border border-border/50 bg-muted/5 p-2 space-y-1 text-[10px] text-foreground-muted">
                          <div>Request ID: <span className="font-mono">{turn.requestId}</span></div>
                          <div>Personality: {turn.personality}</div>
                          <div>History length: {turn.conversationHistoryLength} messages</div>
                          {turn.routingDecision && (
                            <div>
                              Routing: complexity={turn.routingDecision.complexityScore},
                              tokens={turn.routingDecision.tokenEstimate},
                              {turn.routingDecision.override ? 'override' : 'passthrough'}
                              {turn.routingDecision.reason && ` — ${turn.routingDecision.reason}`}
                            </div>
                          )}
                          {turn.timing && (
                            <div>
                              Timing: {JSON.stringify(turn.timing)}
                            </div>
                          )}
                        </div>
                      )}

                      {idx < selectedSession.turns.length - 1 && <Separator className="my-2" />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
