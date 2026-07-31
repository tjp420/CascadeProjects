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
import {
  isNotificationsEnabled,
  setNotificationsEnabled as setNotificationsPreference,
} from '@utils/utils-lib/dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { ReferralAnalyticsPanel } from '@/components/ReferralAnalyticsPanel';

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
const PROVIDER_MODEL_OPTIONS: Record<'ollama' | 'openai' | 'anthropic', string[]> = {
  ollama: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3', 'qwen2.5-coder'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  anthropic: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
};

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
      ? parsed.ollamaModels.filter(
          (m: unknown): m is string => typeof m === 'string' && m.trim().length > 0
        )
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

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-foreground-muted">
          Configure API keys, scan paths, AI providers, and preferences
        </p>
      </div>

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI Providers</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="paths">Scan Paths</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
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
                <Label>Default Project Path</Label>
                <Input placeholder="/path/to/project" />
              </div>
              <div className="space-y-2">
                <Label>Production Paths</Label>
                <Input placeholder="server/, src/, web/" />
              </div>
              <Button>Save Paths</Button>
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
      </Tabs>
    </div>
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
        <CardDescription>
          Manage API keys for scanning and analysis. Keys are encrypted at rest.
        </CardDescription>
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
                <Label>OpenAI API Key</Label>
                {openaiHint && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Check className="h-3 w-3 text-success" /> {openaiHint}
                  </Badge>
                )}
              </div>
              <Input
                type="password"
                placeholder={openaiHint ? 'sk-… (configured — enter new key to replace)' : 'sk-...'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Anthropic API Key</Label>
                {anthropicHint && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Check className="h-3 w-3 text-success" /> {anthropicHint}
                  </Badge>
                )}
              </div>
              <Input
                type="password"
                placeholder={
                  anthropicHint ? 'sk-ant-… (configured — enter new key to replace)' : 'sk-ant-...'
                }
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
  const [selectedProvider, setSelectedProvider] = useState<'ollama' | 'openai' | 'anthropic'>(
    'ollama'
  );
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
          const providerList = Array.isArray(providersData.providers)
            ? providersData.providers
            : [];
          const ollamaMeta = providerList.find((p: any) => p?.id === 'ollama');
          const discoveredModels = Array.isArray(ollamaMeta?.models)
            ? ollamaMeta.models.filter((m: any) => typeof m === 'string' && m.trim())
            : [];
          setDynamicOllamaModels(discoveredModels);
          writeProviderDiscoveryCache(discoveredModels);
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
      selectedProvider === 'ollama'
        ? ollamaModel
        : selectedProvider === 'openai'
          ? openaiModel
          : anthropicModel;
    setSelectedModel(fromPrefs || stored || fallback);
  }, [selectedProvider, modelPrefs, ollamaModel, openaiModel, anthropicModel, dynamicOllamaModels]);

  const availableModelOptions =
    selectedProvider === 'ollama' && dynamicOllamaModels.length > 0
      ? dynamicOllamaModels
      : PROVIDER_MODEL_OPTIONS[selectedProvider];
  const isCustomModel = Boolean(selectedModel) && !availableModelOptions.includes(selectedModel);

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
        toast.success(
          selectedProvider === 'ollama' ? 'Ollama configuration saved' : 'Model preference saved'
        );
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
          Configure AI analysis providers for the chatbot and narrative summaries. Outputs are
          AI-generated — EU AI Act Article 50 disclosure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Provider Status */}
        <div className="grid gap-3 sm:grid-cols-3">
          <ProviderStatusCard
            label="OpenAI"
            configured={openaiConfigured}
            hint="Configure in API Keys tab"
          />
          <ProviderStatusCard
            label="Anthropic"
            configured={anthropicConfigured}
            hint="Configure in API Keys tab"
          />
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
                onChange={(e) =>
                  setSelectedProvider(e.target.value as 'ollama' | 'openai' | 'anthropic')
                }
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
                  if (e.target.value === '__custom__') return;
                  setSelectedModel(e.target.value);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
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
            <Label>Custom / Exact Model ID</Label>
            <Input
              placeholder="llama3.2"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            />
            <p className="text-xs text-foreground-muted">
              Use this if your exact model name is not listed in the dropdown.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Ollama Base URL</Label>
            <Input
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

        <div className="text-xs text-foreground-muted space-y-1">
          <p>
            <strong>OpenAI</strong> and <strong>Anthropic</strong> keys are managed in the API Keys
            tab.
          </p>
          <p>Keys are encrypted at rest (AES-256-GCM) and never exposed back to the browser.</p>
          <p>
            The chatbot will use the first available provider in order: Ollama → OpenAI → Anthropic.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderStatusCard({
  label,
  configured,
  hint,
}: {
  label: string;
  configured: boolean;
  hint: string;
}) {
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
                followSystem
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <Monitor className="h-6 w-6 text-foreground-muted" />
              <span className="text-sm font-medium">System</span>
            </button>
          </div>
          {followSystem && (
            <p className="text-xs text-foreground-muted">
              Dashboard will match your OS preference. Currently using <strong>{theme}</strong>{' '}
              mode.
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
