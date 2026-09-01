import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Database,
  RefreshCw,
  Loader2,
  Save,
  RotateCcw,
  Trash2,
  Zap,
  TrendingUp,
  Gauge,
  FlaskConical,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { apiUrl, authHeaders } from "@/config";

interface CacheStats {
  enabled: boolean;
  similarityThreshold: number;
  ttlMs: number;
  maxEntries: number;
  minPromptLength: number;
  cacheSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  totalSavedLatencyMs: number;
  totalSavedTokens: number;
  avgSavedLatencyMs: number;
  totalHitCount: number;
  byProvider: Record<string, number>;
  vectorDimensions: number;
  perProviderPartition: boolean;
  excludedPatternsCount: number;
}

interface CacheConfig {
  enabled: boolean;
  similarityThreshold: number;
  ttlMs: number;
  maxEntries: number;
  minPromptLength: number;
  skipSystemPrompts: boolean;
  perProviderPartition: boolean;
  excludedPatterns: string[];
}

interface CacheEntry {
  key: string;
  provider: string;
  model: string;
  promptPreview: string;
  promptHash: string;
  hitCount: number;
  latencyMs: number;
  tokenCount: number;
  createdAt: string;
  lastAccessedAt: string;
  ageMs: number;
}

export function SemanticCacheDashboard() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [config, setConfig] = useState<CacheConfig | null>(null);
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [threshold, setThreshold] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState("");
  const [maxEntries, setMaxEntries] = useState("");
  const [minPromptLen, setMinPromptLen] = useState("");

  // Test similarity
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [similarityResult, setSimilarityResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Invalidate
  const [invalidateProvider, setInvalidateProvider] = useState("");
  const [invalidatePattern, setInvalidatePattern] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, cfgResp, entriesResp] = await Promise.all([
        fetch(apiUrl("/semantic-cache/stats"), { headers: authHeaders() }),
        fetch(apiUrl("/semantic-cache/config"), { headers: authHeaders() }),
        fetch(apiUrl("/semantic-cache/entries?limit=20"), {
          headers: authHeaders(),
        }),
      ]);
      const statsData = await statsResp.json();
      const cfgData = await cfgResp.json();
      const entriesData = await entriesResp.json();
      if (statsData.success) setStats(statsData.stats);
      if (cfgData.success) {
        setConfig(cfgData.config);
        setThreshold(String(cfgData.config.similarityThreshold || 0.92));
        setTtlMinutes(
          String(Math.round((cfgData.config.ttlMs || 3600000) / 60000)),
        );
        setMaxEntries(String(cfgData.config.maxEntries || 1000));
        setMinPromptLen(String(cfgData.config.minPromptLength || 20));
      }
      if (entriesData.success) setEntries(entriesData.entries || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const resp = await fetch(apiUrl("/semantic-cache/config"), {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          similarityThreshold: parseFloat(threshold) || 0.92,
          ttlMs: (parseInt(ttlMinutes, 10) || 60) * 60 * 1000,
          maxEntries: parseInt(maxEntries, 10) || 1000,
          minPromptLength: parseInt(minPromptLen, 10) || 20,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error("Failed to save config");
        return;
      }
      toast.success("Cache config saved");
      setConfig(data.config);
    } catch {
      toast.error("Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    if (!config) return;
    try {
      const resp = await fetch(apiUrl("/semantic-cache/config"), {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      const data = await resp.json();
      if (data.success) setConfig(data.config);
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const togglePartition = async () => {
    if (!config) return;
    try {
      const resp = await fetch(apiUrl("/semantic-cache/config"), {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          perProviderPartition: !config.perProviderPartition,
        }),
      });
      const data = await resp.json();
      if (data.success) setConfig(data.config);
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const resetConfig = async () => {
    try {
      const resp = await fetch(apiUrl("/semantic-cache/config/reset"), {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success("Config reset");
        fetchAll();
      }
    } catch {
      toast.error("Failed to reset");
    }
  };

  const clearCache = async () => {
    try {
      const resp = await fetch(apiUrl("/semantic-cache/clear"), {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Cache cleared (${data.cleared} entries)`);
        fetchAll();
      }
    } catch {
      toast.error("Failed to clear");
    }
  };

  const doInvalidateProvider = async () => {
    if (!invalidateProvider) return;
    try {
      const resp = await fetch(apiUrl("/semantic-cache/invalidate/provider"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ provider: invalidateProvider }),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(
          `Invalidated ${data.invalidated} entries for ${invalidateProvider}`,
        );
        fetchAll();
      }
    } catch {
      toast.error("Failed to invalidate");
    }
  };

  const doInvalidatePattern = async () => {
    if (!invalidatePattern) return;
    try {
      const resp = await fetch(apiUrl("/semantic-cache/invalidate/pattern"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: invalidatePattern }),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(
          `Invalidated ${data.invalidated} entries matching pattern`,
        );
        fetchAll();
      }
    } catch {
      toast.error("Failed to invalidate");
    }
  };

  const runTestSimilarity = async () => {
    if (!textA || !textB) return;
    setTesting(true);
    try {
      const resp = await fetch(apiUrl("/semantic-cache/test-similarity"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ textA, textB }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error("Test failed");
        return;
      }
      setSimilarityResult(data.result);
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return ms + "ms";
    if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
    return (ms / 60000).toFixed(1) + "min";
  };

  const formatTime = (ts: string) => {
    if (!ts) return "\u2014";
    try {
      return new Date(ts).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">
            Loading semantic cache data...
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Semantic Cache & Vector Optimization Proxy
              </CardTitle>
              <CardDescription>
                Vector-based prompt similarity matching for local response
                serving — slashes token latency and provider overhead
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                <p className="text-xs text-foreground-muted">Hit Rate</p>
              </div>
              <p className="text-lg font-semibold">
                {((stats?.hitRate ?? 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-600" />
                <p className="text-xs text-foreground-muted">Cache Size</p>
              </div>
              <p className="text-lg font-semibold">
                {stats?.cacheSize ?? 0} / {stats?.maxEntries ?? 1000}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <p className="text-xs text-foreground-muted">Saved Latency</p>
              </div>
              <p className="text-lg font-semibold">
                {formatDuration(stats?.totalSavedLatencyMs ?? 0)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-purple-600" />
                <p className="text-xs text-foreground-muted">Saved Tokens</p>
              </div>
              <p className="text-lg font-semibold">
                {(stats?.totalSavedTokens ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              variant={stats?.enabled ? "success" : "secondary"}
              className="text-xs"
            >
              Cache: {stats?.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Threshold:{" "}
              {((stats?.similarityThreshold ?? 0.92) * 100).toFixed(0)}%
            </Badge>
            <Badge variant="outline" className="text-xs">
              TTL: {formatDuration(stats?.ttlMs ?? 3600000)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Vectors: {stats?.vectorDimensions ?? 256}d
            </Badge>
            {stats?.perProviderPartition && (
              <Badge variant="outline" className="text-xs">
                Per-provider partition
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-foreground-muted">
            <span>
              Hits:{" "}
              <strong className="text-foreground">{stats?.hits ?? 0}</strong>
            </span>
            <span>
              Misses:{" "}
              <strong className="text-foreground">{stats?.misses ?? 0}</strong>
            </span>
            <span>
              Evictions:{" "}
              <strong className="text-foreground">
                {stats?.evictions ?? 0}
              </strong>
            </span>
            <span>
              Avg saved/hit:{" "}
              <strong className="text-foreground">
                {stats?.avgSavedLatencyMs ?? 0}ms
              </strong>
            </span>
          </div>
          {stats &&
            stats.byProvider &&
            Object.keys(stats.byProvider).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs text-foreground-muted">
                  By provider:
                </span>
                {Object.entries(stats.byProvider).map(([prov, count]) => (
                  <Badge key={prov} variant="outline" className="text-[10px]">
                    {prov}: {count}
                  </Badge>
                ))}
              </div>
            )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Configuration</CardTitle>
              <Button variant="outline" size="sm" onClick={resetConfig}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.enabled ?? false}
                  onChange={toggleEnabled}
                />
                Cache enabled
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.perProviderPartition ?? false}
                  onChange={togglePartition}
                />
                Per-provider partition
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-foreground-muted">
                  Similarity threshold (0-1)
                </label>
                <Input
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">
                  TTL (minutes)
                </label>
                <Input
                  value={ttlMinutes}
                  onChange={(e) => setTtlMinutes(e.target.value)}
                  type="number"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">
                  Max entries
                </label>
                <Input
                  value={maxEntries}
                  onChange={(e) => setMaxEntries(e.target.value)}
                  type="number"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">
                  Min prompt length
                </label>
                <Input
                  value={minPromptLen}
                  onChange={(e) => setMinPromptLen(e.target.value)}
                  type="number"
                  className="text-sm"
                />
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={saveConfig}
              disabled={saving}
            >
              <Save className="h-3.5 w-3.5" /> Save Config
            </Button>
          </CardContent>
        </Card>

        {/* Test Similarity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Test Prompt Similarity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-foreground-muted">Text A</label>
              <textarea
                value={textA}
                onChange={(e) => setTextA(e.target.value)}
                className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[60px]"
                placeholder="How do I fix a memory leak in Node.js?"
              />
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Text B</label>
              <textarea
                value={textB}
                onChange={(e) => setTextB(e.target.value)}
                className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[60px]"
                placeholder="What's the best way to resolve memory leaks in a Node.js application?"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runTestSimilarity}
              disabled={testing || !textA || !textB}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FlaskConical className="h-3.5 w-3.5" />
              )}
              Test Similarity
            </Button>
            {similarityResult && (
              <div className="rounded-md border border-border bg-muted/10 p-3 space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-foreground-muted">Similarity:</span>
                  <Badge
                    variant={
                      similarityResult.wouldMatch ? "success" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {(similarityResult.similarity * 100).toFixed(2)}%
                  </Badge>
                  {similarityResult.wouldMatch && (
                    <Badge variant="success" className="text-[10px]">
                      Would match
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-foreground-muted">
                  Threshold: {(similarityResult.threshold * 100).toFixed(0)}% |
                  Tokens A: {similarityResult.tokensA} | Tokens B:{" "}
                  {similarityResult.tokensB}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cache Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-foreground-muted">
                Invalidate by provider
              </label>
              <Input
                value={invalidateProvider}
                onChange={(e) => setInvalidateProvider(e.target.value)}
                placeholder="openai"
                className="text-sm w-40"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={doInvalidateProvider}
              disabled={!invalidateProvider}
            >
              <Trash2 className="h-3 w-3" /> Invalidate Provider
            </Button>
            <div>
              <label className="text-xs text-foreground-muted">
                Invalidate by pattern
              </label>
              <Input
                value={invalidatePattern}
                onChange={(e) => setInvalidatePattern(e.target.value)}
                placeholder="memory leak"
                className="text-sm w-40"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={doInvalidatePattern}
              disabled={!invalidatePattern}
            >
              <Trash2 className="h-3 w-3" /> Invalidate Pattern
            </Button>
            <Button variant="destructive" size="sm" onClick={clearCache}>
              <Trash2 className="h-3 w-3" /> Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cache Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Cached Entries (Top 20 by recency)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">
              No cached entries
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.key}
                  className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {entry.provider}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {entry.model}
                    </Badge>
                    {entry.hitCount > 0 && (
                      <Badge variant="success" className="text-[10px]">
                        {entry.hitCount} hits
                      </Badge>
                    )}
                    <span className="font-mono text-foreground-muted ml-auto">
                      {formatTime(entry.lastAccessedAt)}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground-muted truncate">
                    {entry.promptPreview}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-foreground-muted">
                    <span>Latency: {entry.latencyMs}ms</span>
                    {entry.tokenCount > 0 && (
                      <span>Tokens: {entry.tokenCount}</span>
                    )}
                    <span>Age: {formatDuration(entry.ageMs)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
