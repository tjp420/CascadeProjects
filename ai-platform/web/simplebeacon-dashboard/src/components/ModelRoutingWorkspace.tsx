import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Cpu,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  DollarSign,
  Zap,
  Gauge,
  Activity,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface Tier {
  id: string;
  name: string;
  provider: string;
  model: string;
  priority: number;
  maxTokenLength: number;
  maxComplexityScore: number;
  costPer1kTokens: number;
  avgLatencyMs: number;
  enabled: boolean;
}

interface RoutingConfig {
  enabled: boolean;
  strategy: string;
  complexityWeights: {
    codeBlockRatio: number;
    avgWordLength: number;
    questionDepth: number;
    technicalTerms: number;
    messageLength: number;
  };
  tokenEstimateCharsPerToken: number;
  fallbackTierId: string;
  costBudgetPerRequest: number;
  latencySlaMs: number;
  preferLocalWhenAvailable: boolean;
}

interface RoutingStats {
  totalRequests: number;
  tierDistribution: Record<string, number>;
  totalEstimatedCost: number;
  avgComplexityScore: number;
  avgTokenEstimate: number;
  routingOverrides: number;
}

interface TestResult {
  success: boolean;
  complexityScore: number;
  tokenEstimate: number;
  selectedTier: Tier | null;
  provider: string;
  model: string;
  reason: string;
  estimatedCost: number;
  fallback: boolean;
}

const emptyTier: Omit<Tier, 'id'> = {
  name: '',
  provider: 'ollama',
  model: '',
  priority: 1,
  maxTokenLength: 8000,
  maxComplexityScore: 50,
  costPer1kTokens: 0,
  avgLatencyMs: 3000,
  enabled: true,
};

export function ModelRoutingWorkspace() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [config, setConfig] = useState<RoutingConfig | null>(null);
  const [stats, setStats] = useState<RoutingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [creatingTier, setCreatingTier] = useState(false);
  const [tierForm, setTierForm] = useState<Omit<Tier, 'id'>>(emptyTier);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersResp, configResp, statsResp] = await Promise.all([
        fetch(apiUrl('/model-routing/tiers'), { headers: authHeaders() }),
        fetch(apiUrl('/model-routing/config'), { headers: authHeaders() }),
        fetch(apiUrl('/model-routing/stats'), { headers: authHeaders() }),
      ]);
      const tiersData = await tiersResp.json();
      const configData = await configResp.json();
      const statsData = await statsResp.json();
      if (tiersData.success) setTiers(tiersData.tiers);
      if (configData.success) setConfig(configData.config);
      if (statsData.success) setStats(statsData.stats);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveTier = async () => {
    try {
      const url = editingTier
        ? apiUrl(`/model-routing/tiers/${editingTier.id}`)
        : apiUrl('/model-routing/tiers');
      const resp = await fetch(url, {
        method: editingTier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(tierForm),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.message || 'Failed to save tier');
        return;
      }
      toast.success(editingTier ? 'Tier updated' : 'Tier created');
      setEditingTier(null);
      setCreatingTier(false);
      setTierForm(emptyTier);
      fetchAll();
    } catch {
      toast.error('Failed to save tier');
    }
  };

  const deleteTier = async (id: string) => {
    try {
      const resp = await fetch(apiUrl(`/model-routing/tiers/${id}`), {
        method: 'DELETE',
        headers: authHeaders() },
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to delete tier');
        return;
      }
      toast.success('Tier deleted');
      fetchAll();
    } catch {
      toast.error('Failed to delete tier');
    }
  };

  const toggleTier = async (tier: Tier) => {
    try {
      const resp = await fetch(apiUrl(`/model-routing/tiers/${tier.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ enabled: !tier.enabled }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to toggle tier');
        return;
      }
      fetchAll();
    } catch {
      toast.error('Failed to toggle tier');
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const resp = await fetch(apiUrl('/model-routing/config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(config),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to save config');
        return;
      }
      toast.success('Routing config saved');
      fetchAll();
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  };

  const runTest = async () => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(apiUrl('/model-routing/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Test failed');
        return;
      }
      setTestResult(data);
    } catch {
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  };

  const resetStats = async () => {
    try {
      const resp = await fetch(apiUrl('/model-routing/stats/reset'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to reset stats');
        return;
      }
      toast.success('Stats reset');
      fetchAll();
    } catch {
      toast.error('Failed to reset stats');
    }
  };

  const startEdit = (tier: Tier) => {
    setEditingTier(tier);
    setCreatingTier(false);
    const { id, ...rest } = tier;
    setTierForm(rest);
  };

  const startCreate = () => {
    setCreatingTier(true);
    setEditingTier(null);
    setTierForm(emptyTier);
  };

  const cancelEdit = () => {
    setEditingTier(null);
    setCreatingTier(false);
    setTierForm(emptyTier);
  };

  const providerBadge = (p: string) => {
    if (p === 'openai') return <Badge variant="secondary" className="text-xs">OpenAI</Badge>;
    if (p === 'anthropic') return <Badge variant="secondary" className="text-xs">Anthropic</Badge>;
    return <Badge variant="outline" className="text-xs">Ollama</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading model routing...</span>
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
                <Cpu className="h-5 w-5 text-primary" />
                Model-Routing Optimizer
              </CardTitle>
              <CardDescription>
                Intelligent prompt orchestration — routes between public and localized model tiers
                based on complexity, token length, cost, and latency
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetStats}>Reset Stats</Button>
              <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Requests</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalRequests ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Avg Complexity</p>
              </div>
              <p className="text-lg font-semibold">{stats?.avgComplexityScore ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Est. Total Cost</p>
              </div>
              <p className="text-lg font-semibold">${(stats?.totalEstimatedCost ?? 0).toFixed(4)}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Routing Overrides</p>
              </div>
              <p className="text-lg font-semibold">{stats?.routingOverrides ?? 0}</p>
            </div>
          </div>

          {/* Tier Distribution */}
          {stats && Object.keys(stats.tierDistribution).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Tier Distribution</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.tierDistribution).map(([tierId, count]) => (
                  <Badge key={tierId} variant="secondary" className="text-xs">
                    {tierId}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Routing Config */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4" />
              Routing Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Routing Enabled</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.preferLocalWhenAvailable}
                  onChange={(e) => setConfig({ ...config, preferLocalWhenAvailable: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Prefer Local When Available</span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="mr-strategy">Strategy</Label>
                <select
                  id="mr-strategy"
                  value={config.strategy}
                  onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="cost-optimized">Cost Optimized</option>
                  <option value="quality-optimized">Quality Optimized</option>
                  <option value="latency-optimized">Latency Optimized</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mr-budget">Cost Budget / Request ($)</Label>
                <Input
                  id="mr-budget"
                  type="number"
                  step="0.01"
                  value={config.costBudgetPerRequest}
                  onChange={(e) => setConfig({ ...config, costBudgetPerRequest: parseFloat(e.target.value) || 0 })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mr-sla">Latency SLA (ms)</Label>
                <Input
                  id="mr-sla"
                  type="number"
                  value={config.latencySlaMs}
                  onChange={(e) => setConfig({ ...config, latencySlaMs: parseInt(e.target.value, 10) || 0 })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mr-chars">Chars / Token Estimate</Label>
                <Input
                  id="mr-chars"
                  type="number"
                  value={config.tokenEstimateCharsPerToken}
                  onChange={(e) => setConfig({ ...config, tokenEstimateCharsPerToken: parseInt(e.target.value, 10) || 4 })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mr-fallback">Fallback Tier ID</Label>
                <Input
                  id="mr-fallback"
                  value={config.fallbackTierId}
                  onChange={(e) => setConfig({ ...config, fallbackTierId: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>

            <Button size="sm" onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save Config
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tier Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Model Tiers</CardTitle>
            <Button size="sm" onClick={startCreate}>
              <Plus className="h-3.5 w-3.5" /> Add Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/10 p-3"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium text-sm">{tier.name}</span>
                {providerBadge(tier.provider)}
                <Badge variant="outline" className="text-xs font-mono">{tier.model}</Badge>
                <Badge variant={tier.enabled ? 'success' : 'secondary'} className="text-xs">
                  {tier.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <span className="text-xs text-foreground-muted">
                  P{tier.priority} · {tier.maxTokenLength} tokens · {tier.maxComplexityScore} complexity · ${tier.costPer1kTokens}/1k · {tier.avgLatencyMs}ms
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleTier(tier)}>
                  {tier.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(tier)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteTier(tier.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Create/Edit Tier Form */}
      {(creatingTier || editingTier) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {editingTier ? `Edit Tier: ${editingTier.name}` : 'Create New Tier'}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <select
                  value={tierForm.provider}
                  onChange={(e) => setTierForm({ ...tierForm, provider: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openai">OpenAI (Cloud)</option>
                  <option value="anthropic">Anthropic (Cloud)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input value={tierForm.model} onChange={(e) => setTierForm({ ...tierForm, model: e.target.value })} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Input type="number" value={tierForm.priority} onChange={(e) => setTierForm({ ...tierForm, priority: parseInt(e.target.value, 10) || 1 })} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Token Length</Label>
                <Input type="number" value={tierForm.maxTokenLength} onChange={(e) => setTierForm({ ...tierForm, maxTokenLength: parseInt(e.target.value, 10) || 0 })} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Complexity Score</Label>
                <Input type="number" value={tierForm.maxComplexityScore} onChange={(e) => setTierForm({ ...tierForm, maxComplexityScore: parseInt(e.target.value, 10) || 0 })} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Cost / 1k Tokens ($)</Label>
                <Input type="number" step="0.01" value={tierForm.costPer1kTokens} onChange={(e) => setTierForm({ ...tierForm, costPer1kTokens: parseFloat(e.target.value) || 0 })} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Avg Latency (ms)</Label>
                <Input type="number" value={tierForm.avgLatencyMs} onChange={(e) => setTierForm({ ...tierForm, avgLatencyMs: parseInt(e.target.value, 10) || 0 })} className="font-mono" />
              </div>
            </div>
            <Button size="sm" onClick={saveTier}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {editingTier ? 'Update Tier' : 'Create Tier'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Routing Test Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4" />
            Routing Test Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Test Prompt</Label>
            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter a prompt to test routing..."
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
            />
          </div>
          <Button size="sm" onClick={runTest} disabled={testing || !testPrompt.trim()}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Test Routing
          </Button>
          {testResult && (
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Complexity: {testResult.complexityScore}</Badge>
                <Badge variant="secondary">Tokens: {testResult.tokenEstimate}</Badge>
                {testResult.selectedTier && (
                  <Badge variant="outline">{testResult.selectedTier.name}</Badge>
                )}
                {testResult.fallback && <Badge variant="warning">Fallback</Badge>}
              </div>
              <p className="text-xs text-foreground-muted">
                Provider: <span className="font-mono">{testResult.provider}</span> · Model: <span className="font-mono">{testResult.model}</span>
              </p>
              <p className="text-xs text-foreground-muted">Reason: {testResult.reason}</p>
              <p className="text-xs text-foreground-muted">Est. Cost: ${testResult.estimatedCost.toFixed(6)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
