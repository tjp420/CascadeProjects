import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  FlaskConical,
  Sparkles,
  BarChart3,
  FileCheck,
  Layers,
  Eraser,
  History,
  PlayCircle,
  Search,
  Download,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface PiiPolicy {
  id: string;
  orgId: string;
  name: string;
  description: string;
  pattern: string;
  flags: string;
  replacement: string;
  severity: string;
  enabled: boolean;
  compliance?: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PiiStats {
  totalPolicies: number;
  enabledPolicies: number;
  bySeverity: Record<string, number>;
  byCompliance: Record<string, number>;
  defaultCount: number;
}

interface TestResult {
  valid: boolean;
  matchCount: number;
  matches: Array<{ value: string; index: number; length: number }>;
  redactedPreview: string;
  error?: string;
}

interface ScrubPreview {
  scanned: number;
  wouldScrub: number;
  entries: Array<{
    entryId: string;
    timestamp: string;
    action: string;
    entity: string;
    matchCount: number;
    patterns: string[];
    preview: string;
    redactedPreview: string;
  }>;
  patterns: Array<{ name: string; count: number }>;
}

interface ScrubResult {
  scrubbed: number;
  scanned: number;
  skipped: number;
  sealEntryId: string | null;
  backupFile: string | null;
}

interface ScrubStatus {
  orgId: string;
  ranAt: string;
  scanned: number;
  scrubbed: number;
  skipped: number;
  sealEntryId: string | null;
  backupFile: string | null;
  patterns?: Record<string, number>;
}

const SEVERITIES = ['high', 'medium', 'low'];

const emptyForm = {
  name: '',
  description: '',
  pattern: '',
  flags: 'gi',
  replacement: '[REDACTED]',
  severity: 'medium',
  enabled: true,
};

export function PiiPolicyWorkspace() {
  const [policies, setPolicies] = useState<PiiPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Test state
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Compliance stats state
  const [stats, setStats] = useState<PiiStats | null>(null);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);

  // Scrubber state
  const [scrubPreview, setScrubPreview] = useState<ScrubPreview | null>(null);
  const [scrubResult, setScrubResult] = useState<ScrubResult | null>(null);
  const [scrubStatus, setScrubStatus] = useState<ScrubStatus | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [confirmScrub, setConfirmScrub] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl('/pii/policies'), { headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.message || 'Failed to load PII policies');
        return;
      }
      setPolicies(data.policies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/pii/stats'), { headers: authHeaders() });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setStats({
          totalPolicies: data.totalPolicies || 0,
          enabledPolicies: data.enabledPolicies || 0,
          bySeverity: data.bySeverity || {},
          byCompliance: data.byCompliance || {},
          defaultCount: data.defaultCount || 0,
        });
      }
    } catch {
      // Stats are non-critical
    }
  }, []);

  const fetchFrameworks = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/pii/frameworks'), { headers: authHeaders() });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setFrameworks(data.frameworks || []);
      }
    } catch {
      // Frameworks list is non-critical
    }
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const resp = await fetch(apiUrl('/pii/seed'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to seed default patterns');
        return;
      }
      toast.success(`Seeded ${data.seeded} default PII patterns`, {
        description: 'Common PII types (email, SSN, credit card, phone, IP, API keys) are now active',
      });
      fetchPolicies();
      fetchStats();
    } catch {
      toast.error('Failed to seed default patterns');
    } finally {
      setSeeding(false);
    }
  };

  // ── Compliance bundle export handler ──
  const handleExportBundle = async (format: 'csv' | 'json') => {
    try {
      const resp = await fetch(apiUrl(`/pii/compliance-bundle?format=${format}`), {
        headers: authHeaders(),
      });
      if (!resp.ok) {
        toast.error('Failed to export compliance bundle');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `compliance-bundle-${dateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Compliance bundle exported (${format.toUpperCase()})`, {
        description: 'Includes PII policies, audit chain status, security monitor, and activity report',
      });
    } catch {
      toast.error('Failed to export compliance bundle');
    }
  };

  // ── Scrubber handlers ──
  const fetchScrubStatus = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/pii/scrub/status'), { headers: authHeaders() });
      const data = await resp.json();
      if (resp.ok && data.success && data.status) {
        setScrubStatus(data.status);
      }
    } catch {
      // Status is non-critical
    }
  }, []);

  const handlePreviewScrub = async () => {
    setPreviewing(true);
    setScrubPreview(null);
    try {
      const resp = await fetch(apiUrl('/pii/scrub/preview'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to generate scrub preview');
        return;
      }
      setScrubPreview({
        scanned: data.scanned || 0,
        wouldScrub: data.wouldScrub || 0,
        entries: data.entries || [],
        patterns: data.patterns || [],
      });
      if (data.wouldScrub > 0) {
        toast.info(`Found ${data.wouldScrub} entries with PII`, {
          description: `${data.scanned} entries scanned, ${data.wouldScrub} would be scrubbed`,
        });
      } else {
        toast.success('No PII found in historical entries', {
          description: `${data.scanned} entries scanned — all clean`,
        });
      }
    } catch {
      toast.error('Failed to generate scrub preview');
    } finally {
      setPreviewing(false);
    }
  };

  const handleRunScrub = async () => {
    setScrubbing(true);
    setConfirmScrub(false);
    try {
      const resp = await fetch(apiUrl('/pii/scrub/run'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to execute PII scrub');
        return;
      }
      setScrubResult({
        scrubbed: data.scrubbed || 0,
        scanned: data.scanned || 0,
        skipped: data.skipped || 0,
        sealEntryId: data.sealEntryId || null,
        backupFile: data.backupFile || null,
      });
      toast.success(`Scrubbed ${data.scrubbed} entries`, {
        description: `${data.scanned} scanned, ${data.scrubbed} scrubbed, seal: ${data.sealEntryId?.slice(0, 16)}...`,
      });
      fetchScrubStatus();
    } catch {
      toast.error('Failed to execute PII scrub');
    } finally {
      setScrubbing(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
    fetchStats();
    fetchFrameworks();
    fetchScrubStatus();
  }, [fetchPolicies, fetchStats, fetchFrameworks, fetchScrubStatus]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setTestText('');
    setTestResult(null);
  };

  const startEdit = (policy: PiiPolicy) => {
    setForm({
      name: policy.name,
      description: policy.description,
      pattern: policy.pattern,
      flags: policy.flags,
      replacement: policy.replacement,
      severity: policy.severity,
      enabled: policy.enabled,
    });
    setEditingId(policy.id);
    setShowForm(true);
    setTestText('');
    setTestResult(null);
  };

  const savePolicy = async () => {
    if (!form.name.trim() || !form.pattern.trim() || !form.replacement.trim()) {
      toast.error('Name, pattern, and replacement are required');
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? apiUrl(`/pii/policies/${editingId}`)
        : apiUrl('/pii/policies');
      const resp = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.message || 'Failed to save policy');
        return;
      }
      toast.success(editingId ? 'PII policy updated' : 'PII policy created');
      resetForm();
      fetchPolicies();
    } catch {
      toast.error('Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const deletePolicy = async (id: string) => {
    try {
      const resp = await fetch(apiUrl(`/pii/policies/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to delete policy');
        return;
      }
      toast.success('PII policy deleted');
      fetchPolicies();
    } catch {
      toast.error('Failed to delete policy');
    }
  };

  const toggleEnabled = async (policy: PiiPolicy) => {
    try {
      const resp = await fetch(apiUrl(`/pii/policies/${policy.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to toggle policy');
        return;
      }
      fetchPolicies();
    } catch {
      toast.error('Failed to toggle policy');
    }
  };

  const testPattern = async () => {
    if (!form.pattern.trim() || !testText.trim()) {
      toast.error('Pattern and test text are required');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(apiUrl('/pii/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          pattern: form.pattern,
          flags: form.flags,
          replacement: form.replacement,
          text: testText,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(data.message || 'Test failed');
        return;
      }
      setTestResult(data);
    } catch {
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading PII policies...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="governance" className="flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5" />
            Governance & Compliance
          </TabsTrigger>
          <TabsTrigger value="scrubber" className="flex items-center gap-1.5">
            <Eraser className="h-3.5 w-3.5" />
            Retention Scrubber
          </TabsTrigger>
        </TabsList>

        {/* ── Policies Tab ── */}
        <TabsContent value="policies">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                PII Redaction Policies
              </CardTitle>
              <CardDescription>
                Custom regex patterns that mask sensitive data in prompts before reaching upstream LLM models
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => (showForm ? resetForm() : setShowForm(true))}
            >
              {showForm ? (
                <>
                  <XCircle className="h-4 w-4" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> New Policy
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {policies.length === 0 && !showForm && (
            <p className="text-sm text-foreground-muted py-4 text-center">
              No custom PII policies configured. The built-in patterns (SSN, credit card, email,
              phone, API keys, AWS keys, IP addresses) are always active.
            </p>
          )}

          {policies.map((policy) => (
            <div
              key={policy.id}
              className="rounded-md border border-border bg-muted/20 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{policy.name}</span>
                  <Badge
                    variant={policy.severity === 'high' ? 'danger' : policy.severity === 'medium' ? 'warning' : 'secondary'}
                    className="text-xs"
                  >
                    {policy.severity}
                  </Badge>
                  {policy.enabled ? (
                    <Badge variant="success" className="text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Disabled</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleEnabled(policy)}
                    className="h-7 px-2"
                  >
                    {policy.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(policy)}
                    className="h-7 px-2"
                  >
                    <Shield className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deletePolicy(policy.id)}
                    className="h-7 px-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {policy.description && (
                <p className="text-xs text-foreground-muted">{policy.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <span className="rounded bg-muted px-1.5 py-0.5">/{policy.pattern}/{policy.flags}</span>
                <span className="text-foreground-muted">→</span>
                <span className="rounded bg-muted px-1.5 py-0.5">{policy.replacement}</span>
              </div>
            </div>
          ))}

          {showForm && (
            <>
              <Separator />
              <div className="space-y-4 rounded-md border border-primary/20 bg-primary/5 p-4">
                <h3 className="font-medium text-sm">
                  {editingId ? 'Edit Policy' : 'Create New PII Redaction Policy'}
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pii-name">Name</Label>
                    <Input
                      id="pii-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Employee ID"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pii-severity">Severity</Label>
                    <select
                      id="pii-severity"
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pii-desc">Description</Label>
                  <Input
                    id="pii-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What this pattern detects"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="pii-pattern">Regex Pattern</Label>
                    <Input
                      id="pii-pattern"
                      value={form.pattern}
                      onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                      placeholder="e.g. \bEMP-\d{6}\b"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pii-flags">Flags</Label>
                    <Input
                      id="pii-flags"
                      value={form.flags}
                      onChange={(e) => setForm({ ...form, flags: e.target.value })}
                      placeholder="gi"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pii-replacement">Replacement Text</Label>
                  <Input
                    id="pii-replacement"
                    value={form.replacement}
                    onChange={(e) => setForm({ ...form, replacement: e.target.value })}
                    placeholder="[REDACTED-EMP-ID]"
                    className="font-mono"
                  />
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="pii-test-text">Test Pattern (optional)</Label>
                  <Textarea
                    id="pii-test-text"
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Paste sample text to test your pattern against..."
                    className="min-h-[80px] font-mono text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={testPattern} disabled={testing}>
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                    Test Pattern
                  </Button>
                </div>

                {testResult && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                    {testResult.valid ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          {testResult.matchCount > 0 ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              <span className="font-medium">
                                {testResult.matchCount} match{testResult.matchCount !== 1 ? 'es' : ''} found
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-foreground-muted" />
                              <span className="text-foreground-muted">No matches found</span>
                            </>
                          )}
                        </div>
                        {testResult.matches.length > 0 && (
                          <div className="space-y-1">
                            {testResult.matches.slice(0, 5).map((m, i) => (
                              <div key={i} className="text-xs font-mono text-foreground-muted">
                                Match {i + 1}: <code className="text-foreground">{m.value}</code> at position {m.index}
                              </div>
                            ))}
                          </div>
                        )}
                        {testResult.redactedPreview && (
                          <div className="space-y-1">
                            <p className="text-xs text-foreground-muted">Redacted preview:</p>
                            <pre className="text-xs font-mono rounded bg-muted p-2 whitespace-pre-wrap break-all">
                              {testResult.redactedPreview}
                            </pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>{testResult.error || 'Invalid regex pattern'}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={savePolicy} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {editingId ? 'Update Policy' : 'Create Policy'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* ── Governance & Compliance Tab ── */}
        <TabsContent value="governance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-primary" />
                    Governance & Compliance
                  </CardTitle>
                  <CardDescription>
                    Regulatory framework coverage and default pattern management
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportBundle('csv')}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportBundle('json')}
                  >
                    <FileDown className="h-4 w-4" />
                    Export JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSeed}
                    disabled={seeding}
                  >
                    {seeding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Seed Defaults
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground-muted">Total Policies</span>
                    <Layers className="h-4 w-4 text-foreground-muted" />
                  </div>
                  <div className="text-2xl font-bold">{stats?.totalPolicies ?? 0}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground-muted">Active</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold">{stats?.enabledPolicies ?? 0}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground-muted">Default Patterns</span>
                    <Sparkles className="h-4 w-4 text-foreground-muted" />
                  </div>
                  <div className="text-2xl font-bold">{stats?.defaultCount ?? 0}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground-muted">Frameworks Covered</span>
                    <BarChart3 className="h-4 w-4 text-foreground-muted" />
                  </div>
                  <div className="text-2xl font-bold">
                    {stats?.byCompliance ? Object.keys(stats.byCompliance).length : 0}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Compliance Framework Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Compliance Framework Coverage
                </h3>
                {frameworks.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {frameworks.map((fw) => {
                      const count = stats?.byCompliance?.[fw] ?? 0;
                      const isActive = count > 0;
                      return (
                        <div
                          key={fw}
                          className={`rounded-lg border p-4 ${
                            isActive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{fw}</span>
                            <Badge
                              variant={isActive ? 'default' : 'secondary'}
                              className={isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : ''}
                            >
                              {count} {count === 1 ? 'pattern' : 'patterns'}
                            </Badge>
                          </div>
                          <div className="text-xs text-foreground-muted">
                            {isActive
                              ? `${count} redaction ${count === 1 ? 'rule' : 'rules'} mapped to ${fw}`
                              : 'No patterns mapped to this framework'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-foreground-muted py-4 text-center">
                    Loading compliance frameworks...
                  </p>
                )}
              </div>

              <Separator />

              {/* Severity Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Severity Distribution</h3>
                <div className="flex gap-3">
                  {['high', 'medium', 'low'].map((sev) => {
                    const count = stats?.bySeverity?.[sev] ?? 0;
                    const color =
                      sev === 'high'
                        ? 'bg-red-500/10 text-red-600 border-red-500/30'
                        : sev === 'medium'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-600 border-blue-500/30';
                    return (
                      <div
                        key={sev}
                        className={`flex-1 rounded-lg border p-3 text-center ${color}`}
                      >
                        <div className="text-xl font-bold capitalize">{sev}</div>
                        <div className="text-2xl font-bold">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Default Pattern Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Default Seed Patterns
                </h3>
                <p className="text-xs text-foreground-muted">
                  Click "Seed Defaults" to populate 6 industry-standard PII patterns (email, SSN,
                  credit card, phone, IPv4, API keys) mapped to GDPR, HIPAA, PCI-DSS, CCPA, and SOX
                  frameworks. Seeding only applies when no policies exist yet.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {policies
                    .filter((p) => p.isDefault)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="flex gap-1 mt-0.5">
                            {(p.compliance || []).map((c) => (
                              <Badge key={c} variant="outline" className="text-xs px-1.5 py-0">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge variant={p.enabled ? 'success' : 'secondary'} className="text-xs ml-2">
                          {p.enabled ? 'Active' : 'Off'}
                        </Badge>
                      </div>
                    ))}
                  {policies.filter((p) => p.isDefault).length === 0 && (
                    <p className="text-xs text-foreground-muted col-span-2 py-2 text-center">
                      No default patterns seeded yet. Click "Seed Defaults" above to get started.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Retention Scrubber Tab ── */}
        <TabsContent value="scrubber">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Eraser className="h-5 w-5 text-primary" />
                    PII Retention Scrubber
                  </CardTitle>
                  <CardDescription>
                    Retroactively scrub PII from historical audit log entries written before policies were activated
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Warning banner */}
              <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600">Irreversible Operation</p>
                  <p className="text-xs text-foreground-muted">
                    Running a scrub will modify historical audit log entries, recompute the entire hash chain,
                    and append a PII_SCRUBBED seal entry. Original entries are backed up to
                    <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">.simplebeacon/pii-scrub-backups/</code>
                    for forensic trail. Use dry-run preview first.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewScrub}
                  disabled={previewing}
                >
                  {previewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Dry-Run Preview
                </Button>
                {scrubPreview && scrubPreview.wouldScrub > 0 && !confirmScrub && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmScrub(true)}
                    disabled={scrubbing}
                  >
                    <Eraser className="h-4 w-4" />
                    Execute Scrub ({scrubPreview.wouldScrub} entries)
                  </Button>
                )}
                {confirmScrub && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-destructive">Confirm?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRunScrub}
                      disabled={scrubbing}
                    >
                      {scrubbing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                      Yes, Scrub Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmScrub(false)}
                      disabled={scrubbing}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Dry-run preview results */}
              {scrubPreview && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Dry-Run Preview Results
                    </h3>

                    {/* Preview KPIs */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-xs text-foreground-muted mb-1">Entries Scanned</div>
                        <div className="text-2xl font-bold">{scrubPreview.scanned}</div>
                      </div>
                      <div className={`rounded-lg border p-4 ${scrubPreview.wouldScrub > 0 ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
                        <div className="text-xs text-foreground-muted mb-1">Would Scrub</div>
                        <div className={`text-2xl font-bold ${scrubPreview.wouldScrub > 0 ? 'text-amber-600' : ''}`}>
                          {scrubPreview.wouldScrub}
                        </div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-xs text-foreground-muted mb-1">Patterns Triggered</div>
                        <div className="text-2xl font-bold">{scrubPreview.patterns.length}</div>
                      </div>
                    </div>

                    {/* Pattern breakdown */}
                    {scrubPreview.patterns.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-foreground-muted">Pattern Match Counts</h4>
                        <div className="flex flex-wrap gap-2">
                          {scrubPreview.patterns.map((p) => (
                            <Badge key={p.name} variant="secondary" className="gap-1">
                              {p.name}
                              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-bold">
                                {p.count}
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Entry details */}
                    {scrubPreview.entries.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-foreground-muted">
                          Entries with PII ({scrubPreview.entries.length})
                        </h4>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {scrubPreview.entries.slice(0, 20).map((entry) => (
                            <div
                              key={entry.entryId}
                              className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-foreground-muted">
                                    {entry.entryId.slice(0, 20)}...
                                  </span>
                                  <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                                  <Badge variant="secondary" className="text-xs">{entry.matchCount} matches</Badge>
                                </div>
                                <span className="text-xs text-foreground-muted">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-foreground-muted">Before: </span>
                                  <code className="text-foreground">{entry.preview}</code>
                                </div>
                                <div>
                                  <span className="text-foreground-muted">After: </span>
                                  <code className="text-emerald-600">{entry.redactedPreview}</code>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                {entry.patterns.map((p) => (
                                  <Badge key={p} variant="secondary" className="text-xs px-1.5 py-0">
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                          {scrubPreview.entries.length > 20 && (
                            <p className="text-xs text-foreground-muted text-center py-1">
                              ... and {scrubPreview.entries.length - 20} more entries
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scrub execution result */}
              {scrubResult && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Scrub Execution Result
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-xs text-foreground-muted mb-1">Scanned</div>
                        <div className="text-2xl font-bold">{scrubResult.scanned}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                        <div className="text-xs text-foreground-muted mb-1">Scrubbed</div>
                        <div className="text-2xl font-bold text-emerald-600">{scrubResult.scrubbed}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-xs text-foreground-muted mb-1">Skipped</div>
                        <div className="text-2xl font-bold">{scrubResult.skipped}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-xs text-foreground-muted mb-1">Seal Entry</div>
                        <div className="text-xs font-mono font-bold truncate">
                          {scrubResult.sealEntryId ? scrubResult.sealEntryId.slice(0, 20) + '...' : 'N/A'}
                        </div>
                      </div>
                    </div>
                    {scrubResult.backupFile && (
                      <div className="flex items-center gap-2 text-xs text-foreground-muted">
                        <History className="h-3.5 w-3.5" />
                        Backup saved: <code className="rounded bg-muted px-1.5 py-0.5">{scrubResult.backupFile}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Last scrub status */}
              {scrubStatus && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Last Scrub Operation
                    </h3>
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-foreground-muted">Organization</span>
                        <span className="text-sm font-medium">{scrubStatus.orgId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-foreground-muted">Ran At</span>
                        <span className="text-sm">{new Date(scrubStatus.ranAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-foreground-muted">Scanned / Scrubbed / Skipped</span>
                        <span className="text-sm font-mono">
                          {scrubStatus.scanned} / {scrubStatus.scrubbed} / {scrubStatus.skipped}
                        </span>
                      </div>
                      {scrubStatus.sealEntryId && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-foreground-muted">Seal Entry</span>
                          <code className="text-xs font-mono">{scrubStatus.sealEntryId.slice(0, 24)}...</code>
                        </div>
                      )}
                      {scrubStatus.backupFile && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-foreground-muted">Backup File</span>
                          <code className="text-xs font-mono">{scrubStatus.backupFile}</code>
                        </div>
                      )}
                      {scrubStatus.patterns && Object.keys(scrubStatus.patterns).length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-foreground-muted">Patterns Applied</span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(scrubStatus.patterns).map(([name, count]) => (
                              <Badge key={name} variant="secondary" className="text-xs">
                                {name}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!scrubPreview && !scrubResult && !scrubStatus && (
                <div className="text-center py-8 text-foreground-muted">
                  <Eraser className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Click "Dry-Run Preview" to scan historical audit entries for PII.</p>
                  <p className="text-xs mt-1">No scrub has been run yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
