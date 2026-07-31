import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield,
  ShieldAlert,
  ArrowUpRight,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface EgressPolicy {
  id: string;
  orgId: string;
  name: string;
  description: string;
  pattern: string;
  flags: string;
  category: string;
  action: string;
  severity: string;
  replacement: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  valid: boolean;
  matchCount: number;
  matches: Array<{ value: string; index: number; length: number }>;
  redactedPreview: string;
  error?: string;
}

const CATEGORIES = ['leak', 'malicious'];
const ACTIONS = ['block', 'flag'];
const SEVERITIES = ['high', 'medium', 'low'];

const emptyForm = {
  name: '',
  description: '',
  pattern: '',
  flags: 'gi',
  category: 'leak',
  action: 'flag',
  severity: 'medium',
  replacement: '',
  enabled: true,
};

export function EgressGuardrailWorkspace() {
  const [policies, setPolicies] = useState<EgressPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl('/egress/policies'), { headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.message || 'Failed to load egress policies');
        return;
      }
      setPolicies(data.policies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setTestText('');
    setTestResult(null);
  };

  const startEdit = (policy: EgressPolicy) => {
    setForm({
      name: policy.name,
      description: policy.description,
      pattern: policy.pattern,
      flags: policy.flags,
      category: policy.category,
      action: policy.action,
      severity: policy.severity,
      replacement: policy.replacement,
      enabled: policy.enabled,
    });
    setEditingId(policy.id);
    setShowForm(true);
    setTestText('');
    setTestResult(null);
  };

  const savePolicy = async () => {
    if (!form.name.trim() || !form.pattern.trim()) {
      toast.error('Name and pattern are required');
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? apiUrl(`/egress/policies/${editingId}`)
        : apiUrl('/egress/policies');
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
      toast.success(editingId ? 'Egress policy updated' : 'Egress policy created');
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
      const resp = await fetch(apiUrl(`/egress/policies/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to delete policy');
        return;
      }
      toast.success('Egress policy deleted');
      fetchPolicies();
    } catch {
      toast.error('Failed to delete policy');
    }
  };

  const toggleEnabled = async (policy: EgressPolicy) => {
    try {
      const resp = await fetch(apiUrl(`/egress/policies/${policy.id}`), {
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
      const resp = await fetch(apiUrl('/egress/test'), {
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
          <span className="text-sm text-foreground-muted">Loading egress policies...</span>
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
                <ArrowUpRight className="h-5 w-5 text-primary" />
                Network Egress Guardrails
              </CardTitle>
              <CardDescription>
                Outbound leak detection and malicious payload patterns for LLM completions
                before they reach clients
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
              No egress guardrail policies configured. Outbound LLM completions will not be
              scanned for leaks or malicious payloads.
            </p>
          )}

          {policies.map((policy) => (
            <div
              key={policy.id}
              className="rounded-md border border-border bg-muted/20 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{policy.name}</span>
                  <Badge
                    variant={policy.category === 'malicious' ? 'danger' : 'warning'}
                    className="text-xs"
                  >
                    {policy.category}
                  </Badge>
                  <Badge
                    variant={policy.action === 'block' ? 'danger' : 'secondary'}
                    className="text-xs"
                  >
                    {policy.action}
                  </Badge>
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
                  <Button size="sm" variant="ghost" onClick={() => toggleEnabled(policy)} className="h-7 px-2">
                    {policy.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(policy)} className="h-7 px-2">
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
                {policy.replacement && (
                  <>
                    <span className="text-foreground-muted">→</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{policy.replacement}</span>
                  </>
                )}
              </div>
            </div>
          ))}

          {showForm && (
            <>
              <Separator />
              <div className="space-y-4 rounded-md border border-primary/20 bg-primary/5 p-4">
                <h3 className="font-medium text-sm">
                  {editingId ? 'Edit Egress Policy' : 'Create New Egress Guardrail Policy'}
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="egress-name">Name</Label>
                    <Input
                      id="egress-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Internal Project Name Leak"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="egress-severity">Severity</Label>
                    <select
                      id="egress-severity"
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="egress-desc">Description</Label>
                  <Input
                    id="egress-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What this pattern detects in outbound completions"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="egress-category">Category</Label>
                    <select
                      id="egress-category"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="egress-action">Action</Label>
                    <select
                      id="egress-action"
                      value={form.action}
                      onChange={(e) => setForm({ ...form, action: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="egress-pattern">Regex Pattern</Label>
                    <Input
                      id="egress-pattern"
                      value={form.pattern}
                      onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                      placeholder="e.g. \bPROJECT-[A-Z]{3}-\d{4}\b"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="egress-flags">Flags</Label>
                    <Input
                      id="egress-flags"
                      value={form.flags}
                      onChange={(e) => setForm({ ...form, flags: e.target.value })}
                      placeholder="gi"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="egress-replacement">Replacement Text (optional — empty = no redaction)</Label>
                  <Input
                    id="egress-replacement"
                    value={form.replacement}
                    onChange={(e) => setForm({ ...form, replacement: e.target.value })}
                    placeholder="[REDACTED-PROJECT]"
                    className="font-mono"
                  />
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="egress-test-text">Test Pattern (optional)</Label>
                  <Textarea
                    id="egress-test-text"
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Paste sample LLM completion text to test your pattern against..."
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
                              <ShieldAlert className="h-4 w-4 text-warning" />
                              <span className="font-medium">
                                {testResult.matchCount} match{testResult.matchCount !== 1 ? 'es' : ''} found
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-foreground-muted" />
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
                        {testResult.redactedPreview && form.replacement && (
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
                  <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
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
    </div>
  );
}
