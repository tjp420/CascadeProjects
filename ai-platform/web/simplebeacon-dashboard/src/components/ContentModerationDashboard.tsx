import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Loader2,
  Save,
  RotateCcw,
  TestTube,
  Flag,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface ModerationConfig {
  enabled: boolean;
  checkPrompts: boolean;
  checkResponses: boolean;
  thresholds: { flag: number; block: number; blockHateSpeech: number; blockThreat: number };
  customBlockWords: string[];
  customFlagWords: string[];
  enabledCategories: Record<string, boolean>;
}

interface ModerationStats {
  total: number;
  blocked: number;
  flagged: number;
  inbound: number;
  outbound: number;
  categoryStats: Record<string, number>;
  avgToxicity: number;
}

interface FlaggedItem {
  id: string;
  timestamp: string;
  direction: string;
  userId: string;
  toxicityScore: number;
  verdict: string;
  sentiment: { label: string; score: number; confidence: number } | null;
  categories: Record<string, number>;
  matchedWords: Array<{ word: string; category: string; intensity: number }>;
  textPreview: string;
  action: string;
}

interface TestResult {
  toxicityScore: number;
  sentiment: { label: string; score: number; confidence: number };
  categories: Record<string, number>;
  matchedWords: Array<{ word: string; category: string; intensity: number }>;
  verdict: string;
}

export function ContentModerationDashboard() {
  const [config, setConfig] = useState<ModerationConfig | null>(null);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [flagged, setFlagged] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Editable config fields
  const [flagThreshold, setFlagThreshold] = useState('');
  const [blockThreshold, setBlockThreshold] = useState('');
  const [blockHateSpeech, setBlockHateSpeech] = useState('');
  const [blockThreat, setBlockThreat] = useState('');
  const [customBlockWords, setCustomBlockWords] = useState('');
  const [customFlagWords, setCustomFlagWords] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgResp, statsResp, flaggedResp] = await Promise.all([
        fetch(apiUrl('/content-moderation/config'), { headers: authHeaders() }),
        fetch(apiUrl('/content-moderation/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/content-moderation/flagged?limit=30'), { headers: authHeaders() }),
      ]);
      const cfgData = await cfgResp.json();
      const statsData = await statsResp.json();
      const flaggedData = await flaggedResp.json();
      if (cfgData.success) {
        setConfig(cfgData.config);
        setFlagThreshold(String(cfgData.config.thresholds.flag));
        setBlockThreshold(String(cfgData.config.thresholds.block));
        setBlockHateSpeech(String(cfgData.config.thresholds.blockHateSpeech));
        setBlockThreat(String(cfgData.config.thresholds.blockThreat));
        setCustomBlockWords((cfgData.config.customBlockWords || []).join(', '));
        setCustomFlagWords((cfgData.config.customFlagWords || []).join(', '));
      }
      if (statsData.success) setStats(statsData.stats);
      if (flaggedData.success) setFlagged(flaggedData.flagged || []);
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
      const resp = await fetch(apiUrl('/content-moderation/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thresholds: {
            flag: parseInt(flagThreshold, 10) || 25,
            block: parseInt(blockThreshold, 10) || 70,
            blockHateSpeech: parseInt(blockHateSpeech, 10) || 50,
            blockThreat: parseInt(blockThreat, 10) || 60,
          },
          customBlockWords: customBlockWords.split(',').map((w) => w.trim()).filter(Boolean),
          customFlagWords: customFlagWords.split(',').map((w) => w.trim()).filter(Boolean),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to save config');
        return;
      }
      toast.success('Moderation config saved');
      setConfig(data.config);
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    try {
      const resp = await fetch(apiUrl('/content-moderation/config/reset'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to reset config');
        return;
      }
      toast.success('Config reset to defaults');
      fetchAll();
    } catch {
      toast.error('Failed to reset config');
    }
  };

  const toggleCategory = async (cat: string) => {
    if (!config) return;
    const newCats = { ...config.enabledCategories, [cat]: !config.enabledCategories[cat] };
    try {
      const resp = await fetch(apiUrl('/content-moderation/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledCategories: newCats }),
      });
      const data = await resp.json();
      if (data.success) setConfig(data.config);
    } catch {
      toast.error('Failed to toggle category');
    }
  };

  const toggleEnabled = async (field: 'enabled' | 'checkPrompts' | 'checkResponses') => {
    if (!config) return;
    try {
      const resp = await fetch(apiUrl('/content-moderation/config'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !config[field] }),
      });
      const data = await resp.json();
      if (data.success) setConfig(data.config);
    } catch {
      toast.error('Failed to toggle setting');
    }
  };

  const runTest = async () => {
    if (!testText.trim()) return;
    setTesting(true);
    try {
      const resp = await fetch(apiUrl('/content-moderation/test'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
      });
      const data = await resp.json();
      if (data.success) setTestResult(data.result);
    } catch {
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  };

  const clearFlagged = async () => {
    try {
      const resp = await fetch(apiUrl('/content-moderation/flagged/clear'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success('Flagged content cleared');
        fetchAll();
      }
    } catch {
      toast.error('Failed to clear flagged content');
    }
  };

  const verdictBadge = (verdict: string) => {
    if (verdict === 'block') return <Badge variant="destructive" className="text-xs">Blocked</Badge>;
    if (verdict === 'flag') return <Badge variant="warning" className="text-xs">Flagged</Badge>;
    return <Badge variant="success" className="text-xs">Allowed</Badge>;
  };

  const sentimentBadge = (s: { label: string; score: number; confidence: number } | null) => {
    if (!s) return null;
    const variant = s.label === 'positive' ? 'success' : s.label === 'negative' ? 'destructive' : 'secondary';
    return <Badge variant={variant as any} className="text-[10px]">{s.label} ({s.score})</Badge>;
  };

  if (loading && !config) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading moderation data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Content Moderation & Toxicity Firewall
              </CardTitle>
              <CardDescription>
                High-speed sentiment analysis and toxicity scoring for prompts and responses
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
                <Flag className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Flagged</p>
              </div>
              <p className="text-lg font-semibold">{stats?.total ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldX className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Blocked</p>
              </div>
              <p className="text-lg font-semibold">{stats?.blocked ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Flagged (allowed)</p>
              </div>
              <p className="text-lg font-semibold">{stats?.flagged ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Avg Toxicity</p>
              </div>
              <p className="text-lg font-semibold">{stats?.avgToxicity ?? 0}/100</p>
            </div>
          </div>

          {stats && Object.keys(stats.categoryStats).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(stats.categoryStats).map(([cat, count]) => (
                <Badge key={cat} variant="outline" className="text-xs">{cat}: {count}</Badge>
              ))}
              <Badge variant="outline" className="text-xs">inbound: {stats.inbound}</Badge>
              <Badge variant="outline" className="text-xs">outbound: {stats.outbound}</Badge>
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
            {/* Toggles */}
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={config?.enabled ?? false} onChange={() => toggleEnabled('enabled')} />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={config?.checkPrompts ?? false} onChange={() => toggleEnabled('checkPrompts')} />
                Check Prompts
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={config?.checkResponses ?? false} onChange={() => toggleEnabled('checkResponses')} />
                Check Responses
              </label>
            </div>

            <Separator />

            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground-muted">Flag Threshold</label>
                <Input value={flagThreshold} onChange={(e) => setFlagThreshold(e.target.value)} type="number" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Block Threshold</label>
                <Input value={blockThreshold} onChange={(e) => setBlockThreshold(e.target.value)} type="number" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Block: Hate Speech</label>
                <Input value={blockHateSpeech} onChange={(e) => setBlockHateSpeech(e.target.value)} type="number" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Block: Threat</label>
                <Input value={blockThreat} onChange={(e) => setBlockThreat(e.target.value)} type="number" className="text-sm" />
              </div>
            </div>

            <Separator />

            {/* Category toggles */}
            <div className="flex flex-wrap gap-2">
              {config && Object.entries(config.enabledCategories).map(([cat, enabled]) => (
                <label key={cat} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={enabled} onChange={() => toggleCategory(cat)} />
                  {cat}
                </label>
              ))}
            </div>

            <Separator />

            {/* Custom words */}
            <div>
              <label className="text-xs text-foreground-muted">Custom Block Words (comma-separated)</label>
              <Input value={customBlockWords} onChange={(e) => setCustomBlockWords(e.target.value)} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-foreground-muted">Custom Flag Words (comma-separated)</label>
              <Input value={customFlagWords} onChange={(e) => setCustomFlagWords(e.target.value)} className="text-sm" />
            </div>

            <Button variant="default" size="sm" onClick={saveConfig} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Save Config
            </Button>
          </CardContent>
        </Card>

        {/* Test Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TestTube className="h-4 w-4" />
              Toxicity Test Tool
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter text to score for toxicity..."
              className="text-sm min-h-[100px]"
            />
            <Button variant="default" size="sm" onClick={runTest} disabled={testing || !testText.trim()}>
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
              Score Text
            </Button>

            {testResult && (
              <div className="rounded-md border border-border bg-muted/10 p-3 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  {verdictBadge(testResult.verdict)}
                  <span className="font-mono">Toxicity: {testResult.toxicityScore}/100</span>
                  {sentimentBadge(testResult.sentiment)}
                </div>
                {Object.keys(testResult.categories).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(testResult.categories).filter(([, v]) => v > 0).map(([cat, score]) => (
                      <Badge key={cat} variant="outline" className="text-[10px]">{cat}: {score}</Badge>
                    ))}
                  </div>
                )}
                {testResult.matchedWords.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-foreground-muted">Matched words:</p>
                    {testResult.matchedWords.slice(0, 10).map((mw, i) => (
                      <div key={i} className="font-mono text-[10px]">
                        "{mw.word}" — {mw.category} (intensity: {mw.intensity})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Flagged Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4" />
              Flagged Content
            </CardTitle>
            <Button variant="outline" size="sm" onClick={clearFlagged}>
              <RotateCcw className="h-3 w-3" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flagged.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No flagged content yet</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {flagged.map((item) => (
                <div key={item.id} className="rounded-md border border-border bg-muted/10 p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {verdictBadge(item.verdict)}
                    <Badge variant="outline" className="text-[10px]">{item.direction}</Badge>
                    <span className="font-mono text-foreground-muted">{item.toxicityScore}/100</span>
                    {sentimentBadge(item.sentiment)}
                    <span className="text-foreground-muted ml-auto">
                      {new Date(item.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs line-clamp-2 text-foreground-muted">{item.textPreview}</p>
                  {Object.keys(item.categories).filter((k) => item.categories[k] > 0).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(item.categories).filter(([, v]) => v > 0).map(([cat, score]) => (
                        <Badge key={cat} variant="outline" className="text-[10px]">{cat}: {score}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
