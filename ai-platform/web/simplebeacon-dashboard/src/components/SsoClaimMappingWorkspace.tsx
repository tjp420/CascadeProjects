import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  KeyRound,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface RoleInfo {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface ClaimMapping {
  matchValue: string;
  matchMode: string;
  role: string;
}

interface ClaimMappings {
  claimPath: string;
  mappings: ClaimMapping[];
  defaultRole: string;
}

interface SsoConfig {
  providerId: string;
  displayName: string;
  method: string;
  providerType: string;
  domain: string;
  enabled: boolean;
}

const MATCH_MODES = ['equals', 'contains', 'regex'];

export function SsoClaimMappingWorkspace() {
  const [configs, setConfigs] = useState<SsoConfig[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [mappings, setMappings] = useState<ClaimMappings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [claimPath, setClaimPath] = useState('');
  const [defaultRole, setDefaultRole] = useState('viewer');
  const [mappingRows, setMappingRows] = useState<ClaimMapping[]>([]);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl('/enterprise/sso/configs'), {
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.message || 'Failed to load SSO configs');
        return;
      }
      const list = (data.configs || []).filter((c: SsoConfig) => c.enabled);
      setConfigs(list);
      if (list.length > 0 && !selectedProviderId) {
        setSelectedProviderId(list[0].providerId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [selectedProviderId]);

  const fetchMappings = useCallback(async () => {
    if (!selectedProviderId) return;
    try {
      const resp = await fetch(
        apiUrl(`/enterprise/sso/configs/${selectedProviderId}/claim-mappings`),
        { headers: authHeaders() }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.message || 'Failed to load claim mappings');
        return;
      }
      setRoles(data.availableRoles || []);
      const cm = data.claimMappings;
      if (cm) {
        setMappings(cm);
        setClaimPath(cm.claimPath || '');
        setDefaultRole(cm.defaultRole || 'viewer');
        setMappingRows(cm.mappings || []);
      } else {
        setMappings(null);
        setClaimPath('');
        setDefaultRole('viewer');
        setMappingRows([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  }, [selectedProviderId]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    if (selectedProviderId) fetchMappings();
  }, [selectedProviderId, fetchMappings]);

  const addMappingRow = () => {
    setMappingRows([...mappingRows, { matchValue: '', matchMode: 'equals', role: 'viewer' }]);
  };

  const updateMappingRow = (index: number, field: keyof ClaimMapping, value: string) => {
    setMappingRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const removeMappingRow = (index: number) => {
    setMappingRows((prev) => prev.filter((_, i) => i !== index));
  };

  const saveMappings = async () => {
    if (!selectedProviderId) return;
    if (!claimPath.trim()) {
      toast.error('Claim path is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(
        apiUrl(`/enterprise/sso/configs/${selectedProviderId}/claim-mappings`),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            claimPath: claimPath.trim(),
            mappings: mappingRows.filter((m) => m.matchValue.trim()),
            defaultRole,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.message || 'Failed to save claim mappings');
        toast.error('Failed to save claim mappings');
        return;
      }
      setMappings(data.claimMappings);
      toast.success('Claim mappings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      toast.error('Failed to save claim mappings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading SSO configurations...</span>
        </CardContent>
      </Card>
    );
  }

  if (configs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <KeyRound className="h-10 w-10 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No enabled SSO providers configured</p>
          <p className="text-xs text-foreground-muted">
            Configure and enable an SSO provider first to set up claim-to-role mappings
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            SSO Identity Provider Claim Mapping
          </CardTitle>
          <CardDescription>
            Map external IdP claims (SAML attributes, OIDC claims) to internal RBAC roles.
            When users authenticate via SSO, their role is automatically resolved from these mappings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>SSO Provider</Label>
            <div className="flex flex-wrap gap-2">
              {configs.map((c) => (
                <button
                  key={c.providerId}
                  type="button"
                  onClick={() => setSelectedProviderId(c.providerId)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    selectedProviderId === c.providerId
                      ? 'border-primary bg-primary-subtle text-primary'
                      : 'border-border text-foreground-secondary hover:bg-muted'
                  }`}
                >
                  {c.displayName} ({c.method.toUpperCase()})
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="claim-path">Claim Path / Attribute Name</Label>
            <Input
              id="claim-path"
              value={claimPath}
              onChange={(e) => setClaimPath(e.target.value)}
              placeholder="e.g. groups, role, http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
            />
            <p className="text-xs text-foreground-muted">
              The IdP claim or SAML attribute name to inspect for role values
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Claim Value → Role Mappings</Label>
              <Button size="sm" variant="outline" onClick={addMappingRow}>
                <Plus className="h-3.5 w-3.5" /> Add Mapping
              </Button>
            </div>

            {mappingRows.length === 0 && (
              <p className="text-sm text-foreground-muted py-4 text-center">
                No mappings configured. Users will receive the default role.
              </p>
            )}

            {mappingRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.matchValue}
                  onChange={(e) => updateMappingRow(i, 'matchValue', e.target.value)}
                  placeholder="Claim value (e.g. admins, Engineering)"
                  className="flex-1"
                />
                <select
                  value={row.matchMode}
                  onChange={(e) => updateMappingRow(i, 'matchMode', e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {MATCH_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ArrowRight className="h-4 w-4 text-foreground-muted shrink-0" />
                <select
                  value={row.role}
                  onChange={(e) => updateMappingRow(i, 'role', e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeMappingRow(i)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="default-role">Default Role (when no mapping matches)</Label>
            <select
              id="default-role"
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name} — {r.description}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            {mappings ? (
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> Mappings configured
              </Badge>
            ) : (
              <Badge variant="outline">Not configured</Badge>
            )}
            <Button onClick={saveMappings} disabled={saving || !claimPath.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Mappings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {roles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available Internal Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((r) => (
              <div key={r.id} className="flex items-start gap-2 text-sm">
                <Badge variant="secondary" className="shrink-0">{r.name}</Badge>
                <span className="text-foreground-muted">{r.description}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
