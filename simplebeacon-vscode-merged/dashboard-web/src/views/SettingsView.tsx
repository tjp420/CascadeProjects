import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Settings,
  Key,
  FolderTree,
  Cpu,
  Palette,
  Bell,
  Check,
  Loader2,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Copy,
  CreditCard,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { apiUrl, authHeaders, waitForApiBase } from '@/config';
import { isNotificationsEnabled, setNotificationsEnabled as setNotificationsPreference } from '@utils/utils-lib/dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { ReferralAnalyticsPanel } from '@/components/ReferralAnalyticsPanel';
import { ProrationPreview } from '@/components/ProrationPreview';

interface AiKeysState {
  openai: { configured: boolean; hint: string };
  anthropic: { configured: boolean; hint: string };
  ollamaBaseUrl: string;
  ollamaModel: string;
  updatedAt: string | null;
}

const MODEL_PREFS_STORAGE_KEY = 'simplebeacon_ai_model_preferences';
const PROVIDER_DISCOVERY_CACHE_KEY = 'simplebeacon_provider_discovery_cache';
const PROVIDER_DISCOVERY_TTL_MS = 15000;
const BROWSER_OLLAMA_URL = 'http://127.0.0.1:11434';
const OLLAMA_REGISTRY_MODELS: string[] = [
  'llama3.2',
  'llama3.1',
  'llama3',
  'llama2',
  'mistral',
  'mistral-nemo',
  'mixtral',
  'codellama',
  'codegemma',
  'qwen2.5-coder',
  'deepseek-coder-v2',
  'phi3',
  'phi3.5',
  'gemma2',
  'gemma',
  'qwen2.5',
  'qwen2',
  'yi',
  'llava',
  'llava-llama3',
  'dolphin-llama3',
  'dolphin-mistral',
  'wizardlm2',
  'orca2',
  'command-r',
  'command-r-plus',
  'starcoder2',
  'stable-code',
  'mathstral',
  'granite-code',
  'smollm2',
  'llama3.2-vision',
];
const PROVIDER_MODEL_OPTIONS: Record<'ollama' | 'openai' | 'anthropic', string[]> = {
  ollama: OLLAMA_REGISTRY_MODELS,
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  anthropic: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
};

/**
 * Probe Ollama directly from the browser (for hosted dashboard where server
 * can't reach user's local Ollama). Returns discovered model names or null.
 */
async function probeBrowserOllama(baseUrl: string, timeoutMs = 2500): Promise<string[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/tags`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.models)) {
      return data.models.map((m: any) => m.name).filter((n: string) => typeof n === 'string' && n.trim());
    }
    return [];
  } catch {
    return null;
  }
}

function readModelPrefs(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MODEL_PREFS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeModelPrefs(next: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MODEL_PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort only
  }
}

function readProviderDiscoveryCache(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROVIDER_DISCOVERY_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return [];
    if (typeof parsed.fetchedAt !== 'number') return [];
    if (Date.now() - parsed.fetchedAt > PROVIDER_DISCOVERY_TTL_MS) return [];
    return Array.isArray(parsed.ollamaModels)
      ? parsed.ollamaModels.filter((m: unknown): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function writeProviderDiscoveryCache(ollamaModels: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      PROVIDER_DISCOVERY_CACHE_KEY,
      JSON.stringify({
        fetchedAt: Date.now(),
        ollamaModels,
      })
    );
  } catch {
    // best-effort only
  }
}

export function SettingsView() {
  const [enabled, setEnabled] = useState(isNotificationsEnabled());
  const { user } = useAuth();
  const [defaultProjectPath, setDefaultProjectPath] = useState(
    () => localStorage.getItem('simplebeacon_default_project_path') || ''
  );
  const [productionPaths, setProductionPaths] = useState(
    () => localStorage.getItem('simplebeacon_production_paths') || ''
  );
  const [savingPaths, setSavingPaths] = useState(false);

  const handleSavePaths = useCallback(() => {
    setSavingPaths(true);
    try {
      localStorage.setItem('simplebeacon_default_project_path', defaultProjectPath);
      localStorage.setItem('simplebeacon_production_paths', productionPaths);
      toast.success('Scan paths saved');
    } catch {
      toast.error('Failed to save scan paths');
    } finally {
      setSavingPaths(false);
    }
  }, [defaultProjectPath, productionPaths]);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-foreground-muted">Configure API keys, scan paths, AI providers, and preferences</p>
      </div>

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI Providers</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="paths">Scan Paths</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <AiProvidersTab />
        </TabsContent>

        <TabsContent value="api">
          <ApiKeysTab />
        </TabsContent>

        <TabsContent value="paths">
          <Card>
            <CardHeader>
              <CardTitle>Scan Paths</CardTitle>
              <CardDescription>Configure which directories to scan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-project-path">Default Project Path</Label>
                <Input
                  id="default-project-path"
                  placeholder="/path/to/project"
                  value={defaultProjectPath}
                  onChange={(e) => setDefaultProjectPath(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="production-paths">Production Paths</Label>
                <Input
                  id="production-paths"
                  placeholder="server/, src/, web/"
                  value={productionPaths}
                  onChange={(e) => setProductionPaths(e.target.value)}
                />
              </div>
              <Button onClick={handleSavePaths} disabled={savingPaths}>
                {savingPaths ? 'Saving...' : 'Save Paths'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <ThemeTab />
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure scan and alert notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                <input
                  id="notifications-toggle"
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnabled(checked);
                    setNotificationsPreference(checked);
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="notifications-toggle">Enable desktop notifications</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals">
          <ReferralAnalyticsPanel userEmail={user?.email} />
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-6">
            <ManageSubscriptionCard userEmail={user?.email} />
            <ProrationPreview />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ManageSubscriptionCard({ userEmail }: { userEmail?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<{ tier: string; subscriptionActive: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function safeStripeRedirect(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === 'checkout.stripe.com' ||
        parsed.hostname === 'billing.stripe.com' ||
        parsed.hostname.endsWith('.stripe.com')
      ) {
        window.open(parsed.href, '_self');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const loadBillingStatus = useCallback(async () => {
    setStatusLoading(true);
    if (!userEmail) {
      setStatusLoading(false);
      return;
    }
    try {
      await waitForApiBase();
      const resp = await fetch(apiUrl(`/simplebeacon/billing/status?email=${encodeURIComponent(userEmail)}`), {
        headers: authHeaders(),
      });
      if (resp.ok) {
        const data = await resp.json();
        setBillingStatus({ tier: data.tier || 'free', subscriptionActive: Boolean(data.subscriptionActive) });
      }
    } catch {
      // Billing status unavailable — show the manage button anyway
    } finally {
      setStatusLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    void loadBillingStatus();
  }, [loadBillingStatus]);

  const handleManageSubscription = async () => {
    if (!userEmail) {
      toast.error('You must be signed in to manage your subscription');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await waitForApiBase();
      const resp = await fetch(apiUrl('/simplebeacon/billing/portal'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await resp.json();
      if (resp.ok && data.url) {
        if (!safeStripeRedirect(data.url)) {
          setError('Invalid redirect URL received from billing service');
          return;
        }
      } else if (resp.status === 503) {
        setError('Billing is not yet configured. Paid plans will be available soon.');
      } else if (resp.status === 404) {
        setError('No active subscription found. Visit the pricing page to subscribe.');
      } else {
        setError(data.error || data.message || `Failed to open billing portal (${resp.status})`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect to billing service');
    } finally {
      setLoading(false);
    }
  };

  const isPaid = billingStatus && billingStatus.subscriptionActive && billingStatus.tier !== 'free';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>Manage your plan, upgrade, downgrade, or cancel your subscription.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusLoading ? (
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading subscription status…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Current Plan</span>
                <Badge variant={isPaid ? 'default' : 'secondary'} className="capitalize">
                  {billingStatus?.tier || 'free'}
                </Badge>
              </div>
              {!isPaid && (
                <Button size="sm" variant="outline" onClick={() => window.open('/pricing.html', '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-1" /> View Plans
                </Button>
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <Button onClick={handleManageSubscription} disabled={loading || !userEmail}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Manage Subscription
              </Button>
              <p className="text-xs text-foreground-muted">
                {isPaid
                  ? 'Upgrade, downgrade, update payment methods, or cancel via Stripe.'
                  : 'Subscribe on the pricing page, then manage your plan here.'}
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-foreground-muted">{error}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ApiKeysTab() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiHint, setOpenaiHint] = useState('');
  const [anthropicHint, setAnthropicHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      await waitForApiBase();
      const resp = await fetch(apiUrl('/simplebeacon/user/ai-keys'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setOpenaiHint(data.openai?.hint || '');
        setAnthropicHint(data.anthropic?.hint || '');
      }
    } catch {
      // API unavailable — allow manual entry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await waitForApiBase();
      const payload: Record<string, string> = {};
      if (openaiKey) payload.openai = openaiKey;
      if (anthropicKey) payload.anthropic = anthropicKey;
      const resp = await fetch(apiUrl('/simplebeacon/user/ai-keys'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const data = await resp.json();
        setOpenaiHint(data.openai?.hint || '');
        setAnthropicHint(data.anthropic?.hint || '');
        setOpenaiKey('');
        setAnthropicKey('');
        toast.success('API keys saved');
      } else {
        const data = await resp.json().catch(() => ({}));
        toast.error(data.error || `Save failed (${resp.status})`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await waitForApiBase();
      const resp = await fetch(apiUrl('/simplebeacon/user/ai-keys'), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (resp.ok) {
        setOpenaiHint('');
        setAnthropicHint('');
        setOpenaiKey('');
        setAnthropicKey('');
        toast.success('API keys cleared');
      } else {
        toast.error('Failed to clear keys');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to clear API keys');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>Manage API keys for scanning and analysis. Keys are encrypted at rest.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                {openaiHint && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Check className="h-3 w-3 text-success" /> {openaiHint}
                  </Badge>
                )}
              </div>
              <Input
                id="openai-api-key"
                type="password"
                placeholder={openaiHint ? 'sk-… (configured — enter new key to replace)' : 'sk-...'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="anthropic-api-key">Anthropic API Key</Label>
                {anthropicHint && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Check className="h-3 w-3 text-success" /> {anthropicHint}
                  </Badge>
                )}
              </div>
              <Input
                id="anthropic-api-key"
                type="password"
                placeholder={anthropicHint ? 'sk-ant-… (configured — enter new key to replace)' : 'sk-ant-...'}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
              />
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || (!openaiKey && !anthropicKey)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Keys
              </Button>
              {(openaiHint || anthropicHint) && (
                <Button variant="outline" onClick={handleClear} disabled={saving}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AiProvidersTab() {
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('');
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [anthropicConfigured, setAnthropicConfigured] = useState(false);
  const [dynamicOllamaModels, setDynamicOllamaModels] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<'ollama' | 'openai' | 'anthropic'>('ollama');
  const [selectedModel, setSelectedModel] = useState('');
  const [modelPrefs, setModelPrefs] = useState<Record<string, string>>(() => readModelPrefs());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await waitForApiBase();
      const resp = await fetch(apiUrl('/simplebeacon/user/ai-keys'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setOllamaUrl(data.ollamaBaseUrl || '');
        setOllamaModel(data.ollamaModel || '');
        setOpenaiModel(data.openaiModel || '');
        setAnthropicModel(data.anthropicModel || '');
        setOpenaiConfigured(data.providers?.openai?.configured || false);
        setAnthropicConfigured(data.providers?.anthropic?.configured || false);
        const merged = {
          ...readModelPrefs(),
          ...(data.ollamaModel ? { ollama: data.ollamaModel } : {}),
          ...(data.openaiModel ? { openai: data.openaiModel } : {}),
          ...(data.anthropicModel ? { anthropic: data.anthropicModel } : {}),
        };
        setModelPrefs(merged);
      }

      const cachedModels = readProviderDiscoveryCache();
      if (cachedModels.length > 0) {
        setDynamicOllamaModels(cachedModels);
      } else {
        const providersResp = await fetch(apiUrl('/chatbot/providers'), {
          method: 'GET',
          headers: authHeaders(),
        });
        if (providersResp.ok) {
          const providersData = await providersResp.json();
          const providerList = Array.isArray(providersData.providers) ? providersData.providers : [];
          const ollamaMeta = providerList.find((p: any) => p?.id === 'ollama');
          const discoveredModels = Array.isArray(ollamaMeta?.models)
            ? ollamaMeta.models.filter((m: any) => typeof m === 'string' && m.trim())
            : [];
          if (discoveredModels.length > 0) {
            setDynamicOllamaModels(discoveredModels);
            writeProviderDiscoveryCache(discoveredModels);
          }
        }
      }

      // On the hosted dashboard, the server can't reach the user's local Ollama.
      // Probe directly from the browser to discover installed models.
      const isHosted =
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
      if (isHosted) {
        const browserModels = await probeBrowserOllama(BROWSER_OLLAMA_URL);
        if (browserModels && browserModels.length > 0) {
          // Merge discovered (installed) models with registry models — installed first
          const merged = [...browserModels];
          for (const m of OLLAMA_REGISTRY_MODELS) {
            if (!merged.includes(m)) merged.push(m);
          }
          setDynamicOllamaModels(merged);
          writeProviderDiscoveryCache(merged);
        } else if (browserModels && browserModels.length === 0) {
          // Ollama running but no models — show registry list
          setDynamicOllamaModels(OLLAMA_REGISTRY_MODELS);
        }
      }
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fromPrefs = modelPrefs[selectedProvider] || '';
    const fallbackOptions =
      selectedProvider === 'ollama' && dynamicOllamaModels.length > 0
        ? dynamicOllamaModels
        : PROVIDER_MODEL_OPTIONS[selectedProvider];
    const fallback = fallbackOptions[0] || '';
    const stored =
      selectedProvider === 'ollama' ? ollamaModel : selectedProvider === 'openai' ? openaiModel : anthropicModel;
    setSelectedModel(fromPrefs || stored || fallback);
  }, [selectedProvider, modelPrefs, ollamaModel, openaiModel, anthropicModel, dynamicOllamaModels]);

  const availableModelOptions =
    selectedProvider === 'ollama'
      ? dynamicOllamaModels.length > 0
        ? dynamicOllamaModels
        : PROVIDER_MODEL_OPTIONS[selectedProvider]
      : PROVIDER_MODEL_OPTIONS[selectedProvider];
  const isCustomModel = Boolean(selectedModel) && !availableModelOptions.includes(selectedModel);
  const oracleInstalledSettings = selectedProvider === 'ollama' && availableModelOptions.includes('unbreakable-oracle');

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextPrefs = { ...modelPrefs, [selectedProvider]: selectedModel };
      setModelPrefs(nextPrefs);
      writeModelPrefs(nextPrefs);

      await waitForApiBase();
      const payload =
        selectedProvider === 'ollama'
          ? { ollamaBaseUrl: ollamaUrl, ollamaModel: selectedModel || ollamaModel }
          : selectedProvider === 'openai'
            ? { openaiModel: selectedModel }
            : { anthropicModel: selectedModel };
      const resp = await fetch(apiUrl('/simplebeacon/user/ai-keys'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const result = await resp.json().catch(() => ({}));
        setOllamaModel(result.ollamaModel || selectedModel || ollamaModel);
        setOpenaiModel(result.openaiModel || openaiModel);
        setAnthropicModel(result.anthropicModel || anthropicModel);
        toast.success(selectedProvider === 'ollama' ? 'Ollama configuration saved' : 'Model preference saved');
      } else {
        toast.error('Failed to save model configuration');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-foreground-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading AI provider configuration…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Providers</CardTitle>
        <CardDescription>
          Configure AI analysis providers for the chatbot and narrative summaries. Outputs are AI-generated — EU AI Act
          Article 50 disclosure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Provider Status */}
        <div className="grid gap-3 sm:grid-cols-3">
          <ProviderStatusCard label="OpenAI" configured={openaiConfigured} hint="Configure in API Keys tab" />
          <ProviderStatusCard label="Anthropic" configured={anthropicConfigured} hint="Configure in API Keys tab" />
          <ProviderStatusCard label="Ollama" configured={!!ollamaUrl} hint="Configure below" />
        </div>

        <Separator />

        {/* Ollama Configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-foreground-muted" />
            <h3 className="text-sm font-semibold">Model Selection</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>AI Provider</Label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as 'ollama' | 'openai' | 'anthropic')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <select
                value={isCustomModel ? '__custom__' : selectedModel}
                onChange={(e) => {
                  if (e.target.value === '__oracle_install__') {
                    window.open('/dashboard/#/chatbot', '_blank');
                    return;
                  }
                  if (e.target.value === '__custom__') return;
                  setSelectedModel(e.target.value);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {selectedProvider === 'ollama' &&
                  (oracleInstalledSettings ? (
                    <option value="unbreakable-oracle">★ unbreakable-oracle (installed)</option>
                  ) : (
                    <option value="__oracle_install__">★ Unbreakable Oracle — Click to install…</option>
                  ))}
                {availableModelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                <option value="__custom__">Custom model…</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-model-id">Custom / Exact Model ID</Label>
            <Input
              id="custom-model-id"
              placeholder="llama3.2"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            />
            <p className="text-xs text-foreground-muted">
              Use this if your exact model name is not listed in the dropdown.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ollama-base-url">Ollama Base URL</Label>
            <Input
              id="ollama-base-url"
              placeholder="http://localhost:11434"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              disabled={selectedProvider !== 'ollama'}
            />
            <p className="text-xs text-foreground-muted">
              Default: http://localhost:11434 — only used when provider is set to Ollama
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {selectedProvider === 'ollama' ? 'Save Ollama Settings' : 'Save Model Preference'}
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-600" />
            <h4 className="text-sm font-semibold">Custom Models</h4>
          </div>
          <div className="rounded-lg border border-purple-400/30 bg-purple-50/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Unbreakable Oracle</p>
                <p className="text-xs text-foreground-muted mt-1">
                  Custom LLM based on llama3.2 (3.2B) with a unique system prompt. Free to download, runs locally.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={oracleInstalledSettings ? 'default' : 'secondary'} className="text-xs">
                    {oracleInstalledSettings ? 'Installed' : 'Not installed'}
                  </Badge>
                  <span className="text-xs text-foreground-muted">1.88 GB · Q4_K_M · llama3.2 family</span>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Install in your terminal:</p>
              <pre className="rounded bg-muted px-3 py-2 text-xs overflow-x-auto">{`curl -L -o Modelfile https://simplebeacon.ai/models/Modelfile
ollama create unbreakable-oracle -f Modelfile
ollama run unbreakable-oracle`}</pre>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(
                  'curl -L -o Modelfile https://simplebeacon.ai/models/Modelfile\nollama create unbreakable-oracle -f Modelfile\nollama run unbreakable-oracle'
                );
                toast.success('Copied install commands to clipboard');
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy install commands
            </Button>
          </div>
        </div>

        <Separator />

        <div className="text-xs text-foreground-muted space-y-1">
          <p>
            <strong>OpenAI</strong> and <strong>Anthropic</strong> keys are managed in the API Keys tab.
          </p>
          <p>Keys are encrypted at rest (AES-256-GCM) and never exposed back to the browser.</p>
          <p>The chatbot will use the first available provider in order: Ollama → OpenAI → Anthropic.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderStatusCard({ label, configured, hint }: { label: string; configured: boolean; hint: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={configured ? 'default' : 'secondary'} className="text-xs">
          {configured ? (
            <>
              <Check className="h-3 w-3 mr-1" /> Ready
            </>
          ) : (
            'Not configured'
          )}
        </Badge>
      </div>
      <span className="text-xs text-foreground-muted">{hint}</span>
    </div>
  );
}

function ThemeTab() {
  const { theme, toggleTheme } = useTheme();
  const [followSystem, setFollowSystem] = useState(false);

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sb_theme');
      setFollowSystem(!stored);
    } catch {
      /* ignore */
    }
  }, []);

  const applyTheme = (next: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sb_theme', next);
    setFollowSystem(false);
    toast.success(`Theme set to ${next} mode`);
  };

  const enableFollowSystem = () => {
    localStorage.removeItem('sb_theme');
    setFollowSystem(true);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    toast.success('Theme set to follow system preference');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Theme
        </CardTitle>
        <CardDescription>Customize the dashboard appearance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <div className="space-y-3">
          <Label>Appearance Mode</Label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => applyTheme('light')}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                theme === 'light' && !followSystem
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <Sun className="h-6 w-6 text-warning" />
              <span className="text-sm font-medium">Light</span>
            </button>
            <button
              type="button"
              onClick={() => applyTheme('dark')}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                theme === 'dark' && !followSystem
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <Moon className="h-6 w-6 text-info" />
              <span className="text-sm font-medium">Dark</span>
            </button>
            <button
              type="button"
              onClick={enableFollowSystem}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                followSystem ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
            >
              <Monitor className="h-6 w-6 text-foreground-muted" />
              <span className="text-sm font-medium">System</span>
            </button>
          </div>
          {followSystem && (
            <p className="text-xs text-foreground-muted">
              Dashboard will match your OS preference. Currently using <strong>{theme}</strong> mode.
            </p>
          )}
        </div>

        <Separator />

        {/* Quick Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Quick Toggle</Label>
            <p className="text-xs text-foreground-muted">Switch between light and dark instantly</p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </Button>
        </div>

        <Separator />

        {/* Current Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Current Status</Label>
            <p className="text-xs text-foreground-muted">
              Active theme: <strong className="capitalize">{theme}</strong>
              {followSystem && ' (following system)'}
            </p>
          </div>
          <Badge variant={theme === 'dark' ? 'secondary' : 'outline'} className="gap-1.5">
            {theme === 'dark' ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
            <span className="capitalize">{theme}</span>
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
