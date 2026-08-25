import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Users,
    RefreshCw,
    Loader2,
    Save,
    RotateCcw,
    KeyRound,
    ShieldCheck,
    AlertTriangle,
    Trash2,
    Fingerprint,
    UserCheck,
    Network,
    FlaskConical
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface FederationStats {
    enabled: boolean;
    jitProvisioningEnabled: boolean;
    totalProvisioned: number;
    uniqueUsers: number;
    byRole: Record<string, number>;
    byProvider: Record<string, number>;
    bySource: Record<string, number>;
    defaultRole: string;
    defaultTrustLevel: string;
    claimMappingCount: number;
    groupMappingCount: number;
    attributeMappingCount: number;
    autoDeprovision: boolean;
    deprovisionAfterDays: number;
}

interface FederationConfig {
    enabled: boolean;
    jitProvisioningEnabled: boolean;
    defaultRole: string;
    defaultTrustLevel: string;
    claimMappings: Record<string, any>;
    attributeMappings: Record<string, string[]>;
    groupMappings: Record<string, Record<string, string>>;
    autoDeprovision: boolean;
    deprovisionAfterDays: number;
}

interface ProvisioningEvent {
    id: string;
    timestamp: string;
    email: string;
    name: string;
    providerId: string;
    orgId: string;
    role: string;
    trustLevel: string;
    roleSource: string;
    matchedRule: string | null;
    groups: string[];
}

const ROLES = ['admin', 'auditor', 'operator', 'viewer'];
const TRUST_LEVELS = ['bronze', 'silver', 'gold', 'platinum'];

export function IdentityFederationDashboard() {
    const [stats, setStats] = useState<FederationStats | null>(null);
    const [config, setConfig] = useState<FederationConfig | null>(null);
    const [history, setHistory] = useState<ProvisioningEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [defaultRole, setDefaultRole] = useState('');
    const [defaultTrustLevel, setDefaultTrustLevel] = useState('');
    const [deprovisionDays, setDeprovisionDays] = useState('');

    const [testUserInfo, setTestUserInfo] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [statsResp, cfgResp, histResp] = await Promise.all([
                fetch(apiUrl('/identity-federation/stats'), { headers: authHeaders() }),
                fetch(apiUrl('/identity-federation/config'), { headers: authHeaders() }),
                fetch(apiUrl('/identity-federation/history?limit=20'), { headers: authHeaders() })
            ]);
            const statsData = await statsResp.json();
            const cfgData = await cfgResp.json();
            const histData = await histResp.json();
            if (statsData.success) setStats(statsData.stats);
            if (cfgData.success) {
                setConfig(cfgData.config);
                setDefaultRole(cfgData.config.defaultRole || 'viewer');
                setDefaultTrustLevel(cfgData.config.defaultTrustLevel || 'silver');
                setDeprovisionDays(String(cfgData.config.deprovisionAfterDays || 90));
            }
            if (histData.success) setHistory(histData.history || []);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 30000);
        return () => clearInterval(interval);
    }, [fetchAll]);

    const saveConfig = async () => {
        setSaving(true);
        try {
            const resp = await fetch(apiUrl('/identity-federation/config'), {
                method: 'PUT',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    defaultRole,
                    defaultTrustLevel,
                    deprovisionAfterDays: parseInt(deprovisionDays, 10) || 90
                })
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) {
                toast.error('Failed to save config');
                return;
            }
            toast.success('Config saved');
            setConfig(data.config);
        } catch {
            toast.error('Failed to save config');
        } finally {
            setSaving(false);
        }
    };

    const toggleEnabled = async () => {
        if (!config) return;
        try {
            const resp = await fetch(apiUrl('/identity-federation/config'), {
                method: 'PUT',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !config.enabled })
            });
            const data = await resp.json();
            if (data.success) setConfig(data.config);
        } catch {
            toast.error('Failed to toggle');
        }
    };

    const toggleJit = async () => {
        if (!config) return;
        try {
            const resp = await fetch(apiUrl('/identity-federation/config'), {
                method: 'PUT',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ jitProvisioningEnabled: !config.jitProvisioningEnabled })
            });
            const data = await resp.json();
            if (data.success) setConfig(data.config);
        } catch {
            toast.error('Failed to toggle');
        }
    };

    const toggleAutoDeprovision = async () => {
        if (!config) return;
        try {
            const resp = await fetch(apiUrl('/identity-federation/config'), {
                method: 'PUT',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoDeprovision: !config.autoDeprovision })
            });
            const data = await resp.json();
            if (data.success) setConfig(data.config);
        } catch {
            toast.error('Failed to toggle');
        }
    };

    const resetConfig = async () => {
        try {
            const resp = await fetch(apiUrl('/identity-federation/config/reset'), {
                method: 'POST',
                headers: authHeaders()
            });
            const data = await resp.json();
            if (data.success) {
                toast.success('Config reset');
                fetchAll();
            }
        } catch {
            toast.error('Failed to reset');
        }
    };

    const clearHistory = async () => {
        try {
            const resp = await fetch(apiUrl('/identity-federation/history/clear'), {
                method: 'POST',
                headers: authHeaders()
            });
            const data = await resp.json();
            if (data.success) {
                toast.success('History cleared');
                fetchAll();
            }
        } catch {
            toast.error('Failed to clear');
        }
    };

    const runTestResolution = async () => {
        setTesting(true);
        try {
            var parsed = JSON.parse(testUserInfo || '{}');
            const resp = await fetch(apiUrl('/identity-federation/test-resolution'), {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInfo: parsed })
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) {
                toast.error('Test failed');
                return;
            }
            setTestResult(data.resolution);
            toast.success('Resolution tested');
        } catch (e) {
            toast.error('Invalid JSON input');
        } finally {
            setTesting(false);
        }
    };

    const roleColor = (role: string) => {
        if (role === 'admin') return 'destructive';
        if (role === 'auditor') return 'warning';
        if (role === 'operator') return 'success';
        return 'secondary';
    };

    const sourceColor = (source: string) => {
        if (source === 'provider_claim') return 'success';
        if (source === 'global_claim') return 'success';
        if (source === 'group_mapping') return 'warning';
        if (source === 'group_pattern') return 'warning';
        return 'secondary';
    };

    const formatTime = (ts: string | null) => {
        if (!ts) return '\u2014';
        try {
            return new Date(ts).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
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
                    <span className="text-sm text-foreground-muted">Loading federation data...</span>
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
                                <Network className="h-5 w-5 text-primary" />
                                Identity Federation & JIT Provisioning
                            </CardTitle>
                            <CardDescription>
                                Just-in-time user provisioning with claim-to-role mapping for enterprise SSO
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
                                <UserCheck className="h-4 w-4 text-green-600" />
                                <p className="text-xs text-foreground-muted">Total Provisioned</p>
                            </div>
                            <p className="text-lg font-semibold">{stats?.totalProvisioned ?? 0}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                <p className="text-xs text-foreground-muted">Unique Users</p>
                            </div>
                            <p className="text-lg font-semibold">{stats?.uniqueUsers ?? 0}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                            <div className="flex items-center gap-2">
                                <KeyRound className="h-4 w-4 text-primary" />
                                <p className="text-xs text-foreground-muted">Claim Mappings</p>
                            </div>
                            <p className="text-lg font-semibold">{stats?.claimMappingCount ?? 0}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                            <div className="flex items-center gap-2">
                                <Fingerprint className="h-4 w-4 text-primary" />
                                <p className="text-xs text-foreground-muted">Group Mappings</p>
                            </div>
                            <p className="text-lg font-semibold">{stats?.groupMappingCount ?? 0}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={stats?.enabled ? 'success' : 'secondary'} className="text-xs">
                            Federation: {stats?.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant={stats?.jitProvisioningEnabled ? 'success' : 'secondary'} className="text-xs">
                            JIT: {stats?.jitProvisioningEnabled ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            Default role: {stats?.defaultRole ?? 'viewer'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            Trust: {stats?.defaultTrustLevel ?? 'silver'}
                        </Badge>
                        {stats?.autoDeprovision && (
                            <Badge variant="warning" className="text-xs">
                                Auto-deprovision: {stats?.deprovisionAfterDays ?? 90}d
                            </Badge>
                        )}
                    </div>
                    {stats && stats.byRole && Object.keys(stats.byRole).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-xs text-foreground-muted">Roles:</span>
                            {Object.entries(stats.byRole).map(([role, count]) => (
                                <Badge key={role} variant={roleColor(role) as any} className="text-[10px]">
                                    {role}: {count}
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
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
                                <input type="checkbox" checked={config?.enabled ?? false} onChange={toggleEnabled} />
                                Federation enabled
                            </label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config?.jitProvisioningEnabled ?? false}
                                    onChange={toggleJit}
                                />
                                JIT provisioning
                            </label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config?.autoDeprovision ?? false}
                                    onChange={toggleAutoDeprovision}
                                />
                                Auto-deprovision
                            </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-xs text-foreground-muted">Default role</label>
                                <select
                                    value={defaultRole}
                                    onChange={e => setDefaultRole(e.target.value)}
                                    className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background"
                                >
                                    {ROLES.map(r => (
                                        <option key={r} value={r}>
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-foreground-muted">Default trust level</label>
                                <select
                                    value={defaultTrustLevel}
                                    onChange={e => setDefaultTrustLevel(e.target.value)}
                                    className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background"
                                >
                                    {TRUST_LEVELS.map(t => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-foreground-muted">Deprovision after (days)</label>
                                <Input
                                    value={deprovisionDays}
                                    onChange={e => setDeprovisionDays(e.target.value)}
                                    type="number"
                                    className="text-sm"
                                />
                            </div>
                        </div>
                        <Button variant="default" size="sm" onClick={saveConfig} disabled={saving}>
                            <Save className="h-3.5 w-3.5" /> Save Config
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-primary" />
                            Test Claim Resolution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <label className="text-xs text-foreground-muted">
                                Paste IdP userInfo JSON (OIDC userinfo or SAML attributes)
                            </label>
                            <textarea
                                value={testUserInfo}
                                onChange={e => setTestUserInfo(e.target.value)}
                                className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[100px]"
                                placeholder={'{"email":"user@acme.com","groups":["admins","engineers"],"role":"admin"}'}
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={runTestResolution} disabled={testing}>
                            {testing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <FlaskConical className="h-3.5 w-3.5" />
                            )}
                            Test Resolution
                        </Button>
                        {testResult && (
                            <div className="rounded-md border border-border bg-muted/10 p-3 space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="text-foreground-muted">Resolved role:</span>
                                    <Badge variant={roleColor(testResult.role) as any} className="text-[10px]">
                                        {testResult.role}
                                    </Badge>
                                    <Badge variant={sourceColor(testResult.source) as any} className="text-[10px]">
                                        {testResult.source}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-foreground-muted">Trust level:</span> {testResult.trustLevel}
                                </div>
                                {testResult.matchedRule && (
                                    <div>
                                        <span className="text-foreground-muted">Matched rule:</span>{' '}
                                        <code className="text-[10px]">{testResult.matchedRule}</code>
                                    </div>
                                )}
                                {testResult.groups && testResult.groups.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        <span className="text-foreground-muted">Groups:</span>
                                        {testResult.groups.map((g: string) => (
                                            <Badge key={g} variant="outline" className="text-[9px]">
                                                {g}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {testResult.attributes && Object.keys(testResult.attributes).length > 0 && (
                                    <div className="text-[10px] text-foreground-muted">
                                        Attributes: {JSON.stringify(testResult.attributes)}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">JIT Provisioning History</CardTitle>
                        <Button variant="outline" size="sm" onClick={clearHistory}>
                            <Trash2 className="h-3 w-3" /> Clear
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <p className="text-xs text-foreground-muted text-center py-6">
                            No provisioning events recorded
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {history.map(evt => (
                                <div
                                    key={evt.id}
                                    className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant={roleColor(evt.role) as any} className="text-[10px]">
                                            {evt.role}
                                        </Badge>
                                        <Badge variant={sourceColor(evt.roleSource) as any} className="text-[10px]">
                                            {evt.roleSource}
                                        </Badge>
                                        <span className="font-medium">{evt.email}</span>
                                        <span className="text-foreground-muted">via {evt.providerId}</span>
                                        <span className="font-mono text-foreground-muted ml-auto">
                                            {formatTime(evt.timestamp)}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[10px] text-foreground-muted">
                                        <span>Trust: {evt.trustLevel}</span>
                                        {evt.matchedRule && (
                                            <span>
                                                Rule: <code>{evt.matchedRule}</code>
                                            </span>
                                        )}
                                        {evt.groups && evt.groups.length > 0 && (
                                            <span>Groups: {evt.groups.join(', ')}</span>
                                        )}
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
