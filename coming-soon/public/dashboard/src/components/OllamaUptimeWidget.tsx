import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

const BROWSER_OLLAMA_URL = 'http://127.0.0.1:11434';

interface OllamaHealthData {
  ok: boolean;
  baseUrl: string;
  endpoint: string | null;
  latencyMs: number;
  models: string[];
  modelCount: number;
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

/**
 * Probe Ollama directly from the browser. On the hosted dashboard, the server
 * cannot reach the user's local Ollama (127.0.0.1:11434), so we check from
 * the browser instead. This avoids the 404 on /api/ollama/health.
 */
async function probeBrowserOllama(baseUrl: string, timeoutMs = 3000): Promise<OllamaHealthData> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json();
      const models: string[] = Array.isArray(data.models)
        ? data.models.map((m: any) => m.name).filter((n: string) => typeof n === 'string' && n.trim())
        : [];
      return {
        ok: true,
        baseUrl,
        endpoint: '/api/tags',
        latencyMs,
        models,
        modelCount: models.length,
        checkedAt: new Date().toISOString(),
      };
    }
    return {
      ok: false,
      baseUrl,
      endpoint: null,
      latencyMs,
      models: [],
      modelCount: 0,
      checkedAt: new Date().toISOString(),
      error: `Ollama returned HTTP ${res.status}`,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        baseUrl,
        endpoint: null,
        latencyMs,
        models: [],
        modelCount: 0,
        checkedAt: new Date().toISOString(),
        error: 'Ollama not responding (timeout)',
      };
    }
    // TypeError: Failed to fetch — could be CORS or not running
    const isHosted = typeof window !== 'undefined' && window.location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    return {
      ok: false,
      baseUrl,
      endpoint: null,
      latencyMs,
      models: [],
      modelCount: 0,
      checkedAt: new Date().toISOString(),
      error: isHosted
        ? 'Cannot reach local Ollama. Ensure Ollama is running and OLLAMA_ORIGINS allows this site.'
        : 'Cannot reach Ollama. Ensure `ollama serve` is running.',
    };
  }
}

export function OllamaUptimeWidget() {
  const [data, setData] = useState<OllamaHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async () => {
    // Probe Ollama directly from the browser — the hosted server cannot
    // reach the user's local Ollama instance.
    const result = await probeBrowserOllama(BROWSER_OLLAMA_URL);
    setData(result);
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    setPollInterval(interval);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchHealth]);

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
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Endpoint</span>
              <span className="font-mono font-medium ml-auto truncate max-w-[100px]">
                {data.endpoint || '/api/status'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Checked</span>
              <span className="font-mono font-medium ml-auto">{formatUptime(data.checkedAt)}</span>
            </div>
          </div>
        )}

        {/* Model list */}
        {data && status === 'connected' && data.models.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Available Models</p>
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
        {status === 'disconnected' && error && (
          <p className="text-xs text-muted-foreground">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
