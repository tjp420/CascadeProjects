import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Gauge,
  RefreshCw,
  Loader2,
  Users,
  Building2,
  Layers,
  Save,
  RotateCcw,
  Shield,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface QuotaPolicies {
  user: { capacity: number; refillRatePerMin: number; burstAllowance: number; enabled: boolean };
  org: { capacity: number; refillRatePerMin: number; burstAllowance: number; enabled: boolean };
  tier: Record<string, { capacity: number; refillRatePerMin: number; costMultiplier: number }>;
}

interface UsageStats {
  totalRequests: number;
  totalTokensConsumed: number;
  totalBlocked: number;
  activeScopes: number;
  blockRate: number;
}

interface UsageEntry {
  totalRequests: number;
  totalTokensConsumed: number;
  blockedRequests: number;
  lastRequestAt: string | null;
  recentBuckets: Array<{ ts: number; count: number; tokensConsumed: number; blocked: number }>;
}

export function RateLimitQuotaDashboard() {
  const [policies, setPolicies] = useState<QuotaPolicies | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [usage, setUsage] = useState<Record<string, UsageEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Editable policy fields
  const [userCapacity, setUserCapacity] = useState('');
  const [userRefill, setUserRefill] = useState('');
  const [orgCapacity, setOrgCapacity] = useState('');
  const [orgRefill, setOrgRefill] = useState('');
  const [tierEdits, setTierEdits] = useState<Record<string, { capacity: string; refillRatePerMin: string; costMultiplier: string }>>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [polResp, statsResp, usageResp] = await Promise.all([
        fetch(apiUrl('/rate-limit/policies'), { headers: authHeaders() }),
        fetch(apiUrl('/rate-limit/usage/stats'), { headers: authHeaders() }),
        fetch(apiUrl('/rate-limit/usage'), { headers: authHeaders() }),
      ]);
      const polData = await polResp.json();
      const statsData = await statsResp.json();
      const usageData = await usageResp.json();
      if (polData.success) {
        setPolicies(polData.policies);
        setUserCapacity(String(polData.policies.user.capacity));
        setUserRefill(String(polData.policies.user.refillRatePerMin));
        setOrgCapacity(String(polData.policies.org.capacity));
        setOrgRefill(String(polData.policies.org.refillRatePerMin));
        const tierInit: Record<string, { capacity: string; refillRatePerMin: string; costMultiplier: string }> = {};
        for (const [tierId, tier] of Object.entries(polData.policies.tier) as [string, { capacity: number; refillRatePerMin: number; costMultiplier: number }][]) {
          tierInit[tierId] = {
            capacity: String(tier.capacity),
            refillRatePerMin: String(tier.refillRatePerMin),
            costMultiplier: String(tier.costMultiplier),
          };
        }
        setTierEdits(tierInit);
      }
      if (statsData.success) setStats(statsData.stats);
      if (usageData.success) setUsage(usageData.usage || {});
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

  const saveUserPolicy = async () => {
    setSaving(true);
    try {
      const resp = await fetch(apiUrl('/rate-limit/policies'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'user',
          updates: {
            capacity: parseInt(userCapacity, 10) || 100,
            refillRatePerMin: parseInt(userRefill, 10) || 30,
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to save user policy');
        return;
      }
      toast.success('User quota policy saved');
      setPolicies(data.policies);
    } catch {
      toast.error('Failed to save user policy');
    } finally {
      setSaving(false);
    }
  };

  const saveOrgPolicy = async () => {
    setSaving(true);
    try {
      const resp = await fetch(apiUrl('/rate-limit/policies'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'org',
          updates: {
            capacity: parseInt(orgCapacity, 10) || 500,
            refillRatePerMin: parseInt(orgRefill, 10) || 100,
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to save org policy');
        return;
      }
      toast.success('Organization quota policy saved');
      setPolicies(data.policies);
    } catch {
      toast.error('Failed to save org policy');
    } finally {
      setSaving(false);
    }
  };

  const saveTierPolicy = async (tierId: string) => {
    setSaving(true);
    try {
      const edits = tierEdits[tierId];
      if (!edits) return;
      const resp = await fetch(apiUrl('/rate-limit/policies'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'tier',
          updates: {
            [tierId]: {
              capacity: parseInt(edits.capacity, 10) || 100,
              refillRatePerMin: parseInt(edits.refillRatePerMin, 10) || 30,
              costMultiplier: parseFloat(edits.costMultiplier) || 1.0,
            },
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error(`Failed to save ${tierId} policy`);
        return;
      }
      toast.success(`${tierId} quota policy saved`);
      setPolicies(data.policies);
    } catch {
      toast.error('Failed to save tier policy');
    } finally {
      setSaving(false);
    }
  };

  const resetPolicies = async () => {
    setResetting(true);
    try {
      const resp = await fetch(apiUrl('/rate-limit/policies/reset'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to reset policies');
        return;
      }
      toast.success('Policies reset to defaults');
      fetchAll();
    } catch {
      toast.error('Failed to reset policies');
    } finally {
      setResetting(false);
    }
  };

  const resetUsage = async () => {
    try {
      const resp = await fetch(apiUrl('/rate-limit/usage/reset'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        toast.error('Failed to reset usage');
        return;
      }
      toast.success('Usage data reset');
      fetchAll();
    } catch {
      toast.error('Failed to reset usage');
    }
  };

  if (loading && !policies) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-foreground-muted">Loading quota data...</span>
        </CardContent>
      </Card>
    );
  }

  const tierColors: Record<string, string> = {
    'local-fast': 'outline',
    'local-capable': 'outline',
    'cloud-fast': 'secondary',
    'cloud-capable': 'secondary',
    'cloud-premium': 'secondary',
  };

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Rate Limiting & Quota Management
              </CardTitle>
              <CardDescription>
                Token bucket rate-limiting mesh — per user, org, and model tier
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={resetPolicies} disabled={resetting}>
                {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Reset Policies
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Total Requests</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalRequests ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Tokens Consumed</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalTokensConsumed ?? 0}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Blocked Requests</p>
              </div>
              <p className="text-lg font-semibold">{stats?.totalBlocked ?? 0}</p>
              <p className="text-xs text-foreground-muted">{stats?.blockRate ?? 0}% block rate</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-xs text-foreground-muted">Active Scopes</p>
              </div>
              <p className="text-lg font-semibold">{stats?.activeScopes ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policy Configuration */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* User Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              User Quota Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground-muted">Capacity (burst)</label>
                <Input value={userCapacity} onChange={(e) => setUserCapacity(e.target.value)} className="text-sm" type="number" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Refill Rate (tokens/min)</label>
                <Input value={userRefill} onChange={(e) => setUserRefill(e.target.value)} className="text-sm" type="number" />
              </div>
            </div>
            <Button variant="default" size="sm" onClick={saveUserPolicy} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Save User Policy
            </Button>
          </CardContent>
        </Card>

        {/* Org Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              Organization Quota Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground-muted">Capacity (burst)</label>
                <Input value={orgCapacity} onChange={(e) => setOrgCapacity(e.target.value)} className="text-sm" type="number" />
              </div>
              <div>
                <label className="text-xs text-foreground-muted">Refill Rate (tokens/min)</label>
                <Input value={orgRefill} onChange={(e) => setOrgRefill(e.target.value)} className="text-sm" type="number" />
              </div>
            </div>
            <Button variant="default" size="sm" onClick={saveOrgPolicy} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Save Org Policy
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tier Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4" />
            Model Tier Quota Policies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {policies && Object.entries(policies.tier).map(([tierId, tier]) => {
            const edits = tierEdits[tierId] || { capacity: '', refillRatePerMin: '', costMultiplier: '' };
            return (
              <div key={tierId} className="rounded-md border border-border bg-muted/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={(tierColors[tierId] as any) || 'outline'} className="text-xs">{tierId}</Badge>
                  <span className="text-xs text-foreground-muted">Cost multiplier controls token cost per request</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-foreground-muted">Capacity</label>
                    <Input
                      value={edits.capacity}
                      onChange={(e) => setTierEdits({ ...tierEdits, [tierId]: { ...edits, capacity: e.target.value } })}
                      className="text-sm"
                      type="number"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-foreground-muted">Refill/min</label>
                    <Input
                      value={edits.refillRatePerMin}
                      onChange={(e) => setTierEdits({ ...tierEdits, [tierId]: { ...edits, refillRatePerMin: e.target.value } })}
                      className="text-sm"
                      type="number"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-foreground-muted">Cost Multiplier</label>
                    <Input
                      value={edits.costMultiplier}
                      onChange={(e) => setTierEdits({ ...tierEdits, [tierId]: { ...edits, costMultiplier: e.target.value } })}
                      className="text-sm"
                      type="number"
                      step="0.1"
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => saveTierPolicy(tierId)} disabled={saving}>
                  <Save className="h-3 w-3" /> Save
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Usage Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4" />
              Usage Breakdown
            </CardTitle>
            <Button variant="outline" size="sm" onClick={resetUsage}>
              <RotateCcw className="h-3 w-3" /> Reset Usage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(usage).length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No usage data yet</p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {Object.entries(usage).map(([key, data]) => {
                const [scope, scopeKey] = key.split(':');
                return (
                  <div key={key} className="flex items-center gap-3 text-xs py-1 border-b border-border/50 last:border-0">
                    <Badge variant="outline" className="text-[10px]">{scope}</Badge>
                    <span className="font-mono flex-1 truncate">{scopeKey}</span>
                    <span className="text-foreground-muted">{data.totalRequests} req</span>
                    <span className="text-foreground-muted">{data.totalTokensConsumed} tokens</span>
                    {data.blockedRequests > 0 && (
                      <Badge variant="destructive" className="text-[10px]">{data.blockedRequests} blocked</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
