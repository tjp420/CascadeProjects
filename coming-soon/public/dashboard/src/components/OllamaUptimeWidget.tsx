import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Cpu,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Activity,
  Clock,
  HardDrive,
  Zap,
  MemoryStick,
  Download,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiUrl, authHeaders, hasAuthToken, isHostedProductionDashboard } from '@/config';

interface ModelDetail {
  name: string;
  sizeBytes: number;
  sizeDisplay: string;
  quantization: string | null;
  family: string | null;
  parameterSize: string | null;
}

interface RunningModel {
  name: string;
  sizeVRAMBytes: number;
  sizeVRAMDisplay: string;
  sizeBytes: number;
  sizeDisplay: string;
  expiresAt: string | null;
}

interface PullEntry {
  model: string;
  status: string;
  digest: string | null;
  total: number;
  completed: number;
  percent: number;
  error: string | null;
  startedAt: string;
  updatedAt: string;
  totalDisplay: string;
  completedDisplay: string;
}

interface OllamaHealthData {
  ok: boolean;
  baseUrl: string;
  endpoint: string | null;
  latencyMs: number;
  models: string[];
  modelCount: number;
  modelDetails: ModelDetail[];
  runningModels: RunningModel[];
  runningModelCount: number;
  totalSizeBytes: number;
  totalSizeDisplay: string;
  totalVRAMBytes: number;
  totalVRAMDisplay: string;
  checkedAt: string;
  error?: string;
  cached?: boolean;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'error';

function deriveStatus(data: OllamaHealthData | null): ConnectionStatus {
  if (!data) return 'checking';
  if (data.ok) return 'connected';
  if (data.error) return 'error';
  return 'disconnected';
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatUptime(checkedAt: string): string {
  const now = Date.now();
  const checked = new Date(checkedAt).getTime();
  const diff = now - checked;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export function OllamaUptimeWidget() {
  const [data, setData] = useState<OllamaHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulls, setPulls] = useState<PullEntry[]>([]);
  const [pullModel, setPullModel] = useState('');
  const [pulling, setPulling] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showRunning, setShowRunning] = useState(true);
  const pullPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipServerProbe = isHostedProductionDashboard() || !hasAuthToken();

  const fetchHealth = useCallback(async () => {
    if (skipServerProbe) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    try {
      const resp = await fetch(apiUrl('/ollama/health'), {
        headers: authHeaders(),
      });
      if (resp.status === 401 || resp.status === 403) {
        setData(null);
        setError(null);
        return;
      }
      const json = await resp.json();
      if (json.success) {
        setData(json);
        setError(null);
      } else {
        setError(json.error || 'Failed to check Ollama status');
      }
    } catch {
      setError('Failed to connect to Ollama health API');
    } finally {
      setLoading(false);
    }
  }, [skipServerProbe]);

  const fetchPullStatus = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/ollama/pull/status'), {
        headers: authHeaders(),
      });
      const json = await resp.json();
      if (json.success && Array.isArray(json.pulls)) {
        setPulls(json.pulls);
      }
    } catch {
      // silent — pull status is best-effort
    }
  }, []);

  const handlePull = useCallback(async () => {
    const model = pullModel.trim();
    if (!model) return;
    setPulling(true);
    try {
      await fetch(apiUrl('/ollama/pull'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      setPullModel('');
      fetchPullStatus();
    } catch {
      // error will be reflected in pull status
    } finally {
      setPulling(false);
    }
  }, [pullModel, fetchPullStatus]);

  useEffect(() => {
    if (skipServerProbe) {
      setLoading(false);
      return undefined;
    }
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchHealth, skipServerProbe]);

  // Poll pull status when there are active downloads
  useEffect(() => {
    const hasActive = pulls.some(
      (p) => p.status === 'downloading' || p.status === 'starting',
    );
    if (hasActive && !pullPollRef.current) {
      fetchPullStatus();
      pullPollRef.current = setInterval(fetchPullStatus, 2000);
    } else if (!hasActive && pullPollRef.current) {
      clearInterval(pullPollRef.current);
      pullPollRef.current = null;
    }
    return () => {
      if (pullPollRef.current) {
        clearInterval(pullPollRef.current);
        pullPollRef.current = null;
      }
    };
  }, [pulls, fetchPullStatus]);

  if (skipServerProbe) {
    return (
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Ollama (local)</CardTitle>
              <CardDescription className="text-xs">Runs on your machine — not probed from simplebeacon.ai</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Configure Ollama in <strong>Settings → AI providers</strong>, use the VS Code extension bridge, or run the dashboard locally with <code className="font-mono">ollama serve</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = deriveStatus(data);
  const statusConfig = {
    connected: {
      icon: Wifi,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/30',
      label: 'Connected',
      badge: 'success' as const,
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
      border: 'border-border',
      label: 'Offline',
      badge: 'secondary' as const,
    },
    checking: {
      icon: Loader2,
      color: 'text-info',
      bg: 'bg-info/10',
      border: 'border-info/30',
      label: 'Checking…',
      badge: 'outline' as const,
    },
    error: {
      icon: WifiOff,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      label: 'Error',
      badge: 'destructive' as const,
    },
  };

  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;
  const isSpinning = status === 'checking';

  return (
    <Card className={`border ${cfg.border}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${cfg.bg} ${cfg.color}`}>
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Ollama Status</CardTitle>
              <CardDescription className="text-xs">Local LLM connection</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchHealth();
            }}
            disabled={loading}
            className="h-7 w-7 p-0"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status indicator */}
        <div className={`flex items-center gap-2 rounded-md ${cfg.bg} px-3 py-2`}>
          <StatusIcon className={`h-4 w-4 ${cfg.color} ${isSpinning ? 'animate-spin' : ''}`} />
          <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
          {data?.cached && (
            <span className="text-xs text-muted-foreground ml-auto">cached</span>
          )}
        </div>

        {/* Metrics grid */}
        {data && status === 'connected' && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Latency</span>
              <span className="font-mono font-medium ml-auto">{formatLatency(data.latencyMs)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Models</span>
              <span className="font-mono font-medium ml-auto">{data.modelCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MemoryStick className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">VRAM</span>
              <span className="font-mono font-medium ml-auto">{data.totalVRAMDisplay}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Disk</span>
              <span className="font-mono font-medium ml-auto">{data.totalSizeDisplay}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Running</span>
              <span className="font-mono font-medium ml-auto">{data.runningModelCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Checked</span>
              <span className="font-mono font-medium ml-auto">{formatUptime(data.checkedAt)}</span>
            </div>
          </div>
        )}

        {/* Running models with VRAM breakdown */}
        {data && status === 'connected' && data.runningModels.length > 0 && (
          <div className="space-y-1.5">
            <button
              onClick={() => setShowRunning(!showRunning)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRunning ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <MemoryStick className="h-3.5 w-3.5" />
              Running Models ({data.runningModels.length})
            </button>
            {showRunning && (
              <div className="space-y-1.5 pl-4">
                {data.runningModels.map((m) => (
                  <div key={m.name} className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium truncate max-w-[140px]">{m.name}</span>
                      <span className="font-mono text-muted-foreground">{m.sizeVRAMDisplay}</span>
                    </div>
                    {m.sizeVRAMBytes > 0 && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${Math.min(100, (m.sizeVRAMBytes / m.sizeBytes) * 100)}%` }}
                        />
                      </div>
                    )}
                    {m.expiresAt && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        expires {formatUptime(m.expiresAt)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Model list with details */}
        {data && status === 'connected' && data.models.length > 0 && (
          <div className="space-y-1.5">
            <button
              onClick={() => setShowModels(!showModels)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showModels ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <HardDrive className="h-3.5 w-3.5" />
              All Models ({data.modelCount})
            </button>
            {!showModels && (
              <div className="flex flex-wrap gap-1">
                {data.models.slice(0, 6).map((model) => (
                  <Badge key={model} variant="outline" className="text-xs font-mono">
                    {model}
                  </Badge>
                ))}
                {data.models.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{data.models.length - 6} more
                  </Badge>
                )}
              </div>
            )}
            {showModels && data.modelDetails.length > 0 && (
              <div className="space-y-1 pl-4 max-h-48 overflow-y-auto">
                {data.modelDetails.map((m) => (
                  <div key={m.name} className="flex items-center justify-between text-xs py-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-medium truncate max-w-[120px]">{m.name}</span>
                      {m.quantization && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                          {m.quantization}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                      {m.parameterSize && (
                        <span className="text-[10px]">{m.parameterSize}</span>
                      )}
                      <span className="font-mono">{m.sizeDisplay}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Download progress section */}
        {data && status === 'connected' && (
          <div className="space-y-2 border-t border-border/50 pt-2">
            <div className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Pull Model</span>
            </div>
            <div className="flex gap-1.5">
              <Input
                value={pullModel}
                onChange={(e) => setPullModel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePull()}
                placeholder="e.g. llama3:8b"
                className="h-7 text-xs"
                disabled={pulling}
              />
              <Button
                onClick={handlePull}
                disabled={pulling || !pullModel.trim()}
                size="sm"
                className="h-7 px-2 text-xs"
              >
                {pulling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              </Button>
            </div>

            {/* Active download progress bars */}
            {pulls.length > 0 && (
              <div className="space-y-1.5">
                {pulls.map((p) => {
                  const isActive = p.status === 'downloading' || p.status === 'starting';
                  const isDone = p.status === 'success';
                  const isErr = p.status === 'error';
                  return (
                    <div key={p.model} className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isDone && <CheckCircle2 className="h-3 w-3 text-success shrink-0" />}
                          {isErr && <AlertCircle className="h-3 w-3 text-destructive shrink-0" />}
                          {isActive && <Loader2 className="h-3 w-3 animate-spin text-info shrink-0" />}
                          <span className="font-mono font-medium truncate max-w-[120px]">{p.model}</span>
                        </div>
                        <span className="font-mono text-muted-foreground shrink-0">
                          {isDone ? 'Done' : isErr ? 'Failed' : `${p.percent}%`}
                        </span>
                      </div>
                      {isActive && (
                        <>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${p.percent}%` }}
                            />
                          </div>
                          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
                            <span>{p.completedDisplay}</span>
                            <span>{p.totalDisplay}</span>
                          </div>
                        </>
                      )}
                      {isErr && p.error && (
                        <p className="mt-0.5 text-[10px] text-destructive truncate">{p.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Base URL display */}
        {data && (
          <div className="text-xs text-muted-foreground truncate">
            <span className="font-mono">{data.baseUrl}</span>
          </div>
        )}

        {/* Error message */}
        {error && status !== 'connected' && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* Disconnected hint */}
        {status === 'disconnected' && !error && (
          <p className="text-xs text-muted-foreground">
            Run <code className="font-mono">ollama serve</code> locally to enable AI-powered features.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
