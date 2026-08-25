import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    KeyRound,
    RefreshCw,
    Loader2,
    Save,
    RotateCcw,
    Trash2,
    Plus,
    ShieldCheck,
    Send,
    CheckCircle2,
    XCircle,
    Clock,
    FlaskConical
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface SigningStats {
    enabled: boolean;
    defaultAlgorithm: string;
    headerName: string;
    totalDeliveries: number;
    successful: number;
    failed: number;
    retried: number;
    signed: number;
    unsigned: number;
    signRate: number;
    successRate: number;
    byStatus: Record<string, number>;
    byOrg: Record<string, number>;
    keyCount: number;
    byAlgorithm: Record<string, number>;
    maxRetries: number;
    retryOnStatus: number[];
}

interface SigningConfig {
    enabled: boolean;
    defaultAlgorithm: string;
    headerName: string;
    timestampHeader: string;
    keyIdHeader: string;
    maxRetries: number;
    baseBackoffMs: number;
    maxBackoffMs: number;
    jitterMs: number;
    retryOnStatus: number[];
    keyRotationGraceHours: number;
}

interface KeyInfo {
    keyId: string;
    algorithm: string;
    orgId: string | null;
    publicKeyPem: string;
    createdAt: string;
}

interface Delivery {
    id: string;
    timestamp: string;
    url: string;
    orgId: string | null;
    event: string | null;
    keyId: string | null;
    signed: boolean;
    attempt: number;
    status: string;
    statusCode: number | null;
    latencyMs: number;
    error: string | null;
    retried: boolean;
}

export function WebhookSigningDashboard() {
    const [stats, setStats] = useState<SigningStats | null>(null);
    const [config, setConfig] = useState<SigningConfig | null>(null);
    const [keys, setKeys] = useState<KeyInfo[]>([]);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [maxRetries, setMaxRetries] = useState('');
    const [baseBackoff, setBaseBackoff] = useState('');
    const [maxBackoff, setMaxBackoff] = useState('');
    const [jitter, setJitter] = useState('');
    const [algorithm, setAlgorithm] = useState('rsa-sha256');

    // Key generation
    const [newKeyId, setNewKeyId] = useState('');
    const [newKeyAlg, setNewKeyAlg] = useState('rsa-sha256');
    const [newKeyOrg, setNewKeyOrg] = useState('');

    // Test signing
    const [testPayload, setTestPayload] = useState('');
    const [testKeyId, setTestKeyId] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [statsResp, cfgResp, keysResp, delResp] = await Promise.all([
                fetch(apiUrl('/webhook-signing/stats'), { headers: authHeaders() }),
                fetch(apiUrl('/webhook-signing/config'), { headers: authHeaders() }),
                fetch(apiUrl('/webhook-signing/keys'), { headers: authHeaders() }),
                fetch(apiUrl('/webhook-signing/deliveries?limit=20'), { headers: authHeaders() })
            ]);
            const statsData = await statsResp.json();
            const cfgData = await cfgResp.json();
            const keysData = await keysResp.json();
            const delData = await delResp.json();
            if (statsData.success) setStats(statsData.stats);
            if (cfgData.success) {
                setConfig(cfgData.config);
                setMaxRetries(String(cfgData.config.maxRetries ?? 3));
                setBaseBackoff(String(cfgData.config.baseBackoffMs ?? 500));
                setMaxBackoff(String(cfgData.config.maxBackoffMs ?? 10000));
                setJitter(String(cfgData.config.jitterMs ?? 250));
                setAlgorithm(cfgData.config.defaultAlgorithm || 'rsa-sha256');
            }
            if (keysData.success) setKeys(keysData.keys || []);
            if (delData.success) setDeliveries(delData.deliveries || []);
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
            const resp = await fetch(apiUrl('/webhook-signing/config'), {
                method: 'PUT',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    maxRetries: parseInt(maxRetries, 10) || 3,
                    baseBackoffMs: parseInt(baseBackoff, 10) || 500,
                    maxBackoffMs: parseInt(maxBackoff, 10) || 10000,
                    jitterMs: parseInt(jitter, 10) || 250,
                    defaultAlgorithm: algorithm
                })
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) {
                toast.error('Failed to save config');
                return;
            }
            toast.success('Signing config saved');
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
            const resp = await fetch(apiUrl('/webhook-signing/config'), {
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

    const resetConfig = async () => {
        try {
            const resp = await fetch(apiUrl('/webhook-signing/config/reset'), {
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

    const generateKey = async () => {
        try {
            const resp = await fetch(apiUrl('/webhook-signing/keys/generate'), {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyId: newKeyId || undefined,
                    algorithm: newKeyAlg,
                    orgId: newKeyOrg || undefined
                })
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) {
                toast.error(data.error?.message || 'Failed to generate key');
                return;
            }
            toast.success('Key pair generated: ' + data.key.keyId);
            setNewKeyId('');
            setNewKeyOrg('');
            fetchAll();
        } catch {
            toast.error('Failed to generate key');
        }
    };

    const deleteKey = async (keyId: string) => {
        try {
            const resp = await fetch(apiUrl(`/webhook-signing/keys/${keyId}`), {
                method: 'DELETE',
                headers: authHeaders()
            });
            const data = await resp.json();
            if (data.success) {
                toast.success('Key deleted: ' + keyId);
                fetchAll();
            }
        } catch {
            toast.error('Failed to delete key');
        }
    };

    const runTestSign = async () => {
        setTesting(true);
        try {
            const resp = await fetch(apiUrl('/webhook-signing/test-sign'), {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload: testPayload || undefined, keyId: testKeyId || undefined })
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) {
                toast.error('Test failed');
                return;
            }
            setTestResult(data.result);
        } catch {
            toast.error('Test failed');
        } finally {
            setTesting(false);
        }
    };

    const clearDeliveries = async () => {
        try {
            const resp = await fetch(apiUrl('/webhook-signing/deliveries/clear'), {
                method: 'POST',
                headers: authHeaders()
            });
            const data = await resp.json();
            if (data.success) {
                toast.success(`Cleared ${data.cleared} delivery records`);
                fetchAll();
            }
        } catch {
            toast.error('Failed to clear');
        }
    };

    const formatTime = (ts: string) => {
        if (!ts) return '\u2014';
        try {
            return new Date(ts).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return ts;
        }
    };

    const truncateUrl = (url: string, max = 50) => {
        if (!url) return '\u2014';
        return url.length > max ? url.slice(0, max) + '...' : url;
    };

    if (loading && !stats) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12 gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-foreground-muted">Loading webhook signing data...</span>
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
                                <KeyRound className="h-5 w-5 text-primary" />
                                Webhook Cryptographic Signing Engine
                            </CardTitle>
                            <CardDescription>
                                Asymmetric RSA/ECDSA payload signing with X-Beacon-Signature-256 headers, retry-backoff
                                tracking, and delivery audit log
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
                                <ShieldCheck className="h-4 w-4 text-green-600" />
                                <p className="text-xs text-foreground-muted">Sign Rate</p>
                            </div>
                            <p className="text-lg font-semibold">{((stats?.signRate ?? 0) * 100).toFixed(1)}%</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                <p className="text-xs text-foreground-muted">Success Rate</p>
                            </div>
                            <p className="text-lg font-semibold">{((stats?.successRate ?? 0) * 100).toFixed(1)}%</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                            <div className="flex items-center gap-2">
                                <Send className="h-4 w-4 text-purple-600" />
                                <p className="text-xs text-foreground-muted">Deliveries</p>
                            </div>
                            <p className="text-lg font-semibold">{stats?.totalDeliveries ?? 0}</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                            <div className="flex items-center gap-2">
                                <KeyRound className="h-4 w-4 text-orange-600" />
                                <p className="text-xs text-foreground-muted">Active Keys</p>
                            </div>
                            <p className="text-lg font-semibold">{stats?.keyCount ?? 0}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={stats?.enabled ? 'success' : 'secondary'} className="text-xs">
                            Signing: {stats?.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            Algorithm: {stats?.defaultAlgorithm ?? 'rsa-sha256'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            Header: {stats?.headerName ?? 'X-Beacon-Signature-256'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            Signed: {stats?.signed ?? 0} / Unsigned: {stats?.unsigned ?? 0}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            Retried: {stats?.retried ?? 0}
                        </Badge>
                    </div>
                    {stats && stats.byAlgorithm && Object.keys(stats.byAlgorithm).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="text-xs text-foreground-muted">Keys by algorithm:</span>
                            {Object.entries(stats.byAlgorithm).map(([alg, count]) => (
                                <Badge key={alg} variant="outline" className="text-[10px]">
                                    {alg}: {count}
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
                                <input type="checkbox" checked={config?.enabled ?? false} onChange={toggleEnabled} />
                                Signing enabled
                            </label>
                        </div>
                        <div>
                            <label className="text-xs text-foreground-muted">Default algorithm</label>
                            <select
                                value={algorithm}
                                onChange={e => setAlgorithm(e.target.value)}
                                className="w-full text-sm border border-border rounded-md p-1.5 bg-background"
                            >
                                <option value="rsa-sha256">RSA-SHA256 (2048-bit)</option>
                                <option value="ecdsa-sha256">ECDSA-SHA256 (P-256)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-foreground-muted">Max retries</label>
                                <Input
                                    value={maxRetries}
                                    onChange={e => setMaxRetries(e.target.value)}
                                    type="number"
                                    className="text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-foreground-muted">Base backoff (ms)</label>
                                <Input
                                    value={baseBackoff}
                                    onChange={e => setBaseBackoff(e.target.value)}
                                    type="number"
                                    className="text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-foreground-muted">Max backoff (ms)</label>
                                <Input
                                    value={maxBackoff}
                                    onChange={e => setMaxBackoff(e.target.value)}
                                    type="number"
                                    className="text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-foreground-muted">Jitter (ms)</label>
                                <Input
                                    value={jitter}
                                    onChange={e => setJitter(e.target.value)}
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

                {/* Test Signing */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-primary" />
                            Test Payload Signing
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <label className="text-xs text-foreground-muted">Payload (JSON or text)</label>
                            <textarea
                                value={testPayload}
                                onChange={e => setTestPayload(e.target.value)}
                                className="w-full text-xs font-mono border border-border rounded-md p-2 bg-background min-h-[60px]"
                                placeholder='{"event":"critical_finding","orgId":"acme"}'
                            />
                        </div>
                        <div>
                            <label className="text-xs text-foreground-muted">
                                Key ID (optional — auto-selects first available)
                            </label>
                            <Input
                                value={testKeyId}
                                onChange={e => setTestKeyId(e.target.value)}
                                placeholder="auto"
                                className="text-sm"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={runTestSign} disabled={testing}>
                            {testing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <FlaskConical className="h-3.5 w-3.5" />
                            )}
                            Sign & Verify
                        </Button>
                        {testResult && (
                            <div className="rounded-md border border-border bg-muted/10 p-3 space-y-2 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-[10px]">
                                        {testResult.algorithm}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                        Key: {testResult.keyId}
                                    </Badge>
                                    <Badge
                                        variant={testResult.verified ? 'success' : 'destructive'}
                                        className="text-[10px]"
                                    >
                                        {testResult.verified ? 'Verified' : 'Failed'}
                                    </Badge>
                                </div>
                                <div className="text-[10px] text-foreground-muted">
                                    Signature length: {testResult.signatureLength} chars
                                </div>
                                <div className="text-[10px] font-mono text-foreground-muted break-all max-h-[60px] overflow-y-auto">
                                    {testResult.signature}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Key Management */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Key Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 items-end">
                        <div>
                            <label className="text-xs text-foreground-muted">Key ID (optional)</label>
                            <Input
                                value={newKeyId}
                                onChange={e => setNewKeyId(e.target.value)}
                                placeholder="auto-generated"
                                className="text-sm w-40"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-foreground-muted">Algorithm</label>
                            <select
                                value={newKeyAlg}
                                onChange={e => setNewKeyAlg(e.target.value)}
                                className="text-sm border border-border rounded-md p-1.5 bg-background"
                            >
                                <option value="rsa-sha256">RSA-SHA256</option>
                                <option value="ecdsa-sha256">ECDSA-SHA256</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-foreground-muted">Org ID (optional)</label>
                            <Input
                                value={newKeyOrg}
                                onChange={e => setNewKeyOrg(e.target.value)}
                                placeholder="org-id"
                                className="text-sm w-32"
                            />
                        </div>
                        <Button variant="default" size="sm" onClick={generateKey}>
                            <Plus className="h-3.5 w-3.5" /> Generate Key Pair
                        </Button>
                    </div>
                    {keys.length === 0 ? (
                        <p className="text-xs text-foreground-muted text-center py-4">No keys generated yet</p>
                    ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {keys.map(key => (
                                <div
                                    key={key.keyId}
                                    className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-[10px]">
                                            {key.algorithm}
                                        </Badge>
                                        <span className="font-mono text-foreground">{key.keyId}</span>
                                        {key.orgId && (
                                            <Badge variant="outline" className="text-[10px]">
                                                org: {key.orgId}
                                            </Badge>
                                        )}
                                        <span className="text-[10px] text-foreground-muted ml-auto">
                                            {formatTime(key.createdAt)}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-1.5"
                                            onClick={() => deleteKey(key.keyId)}
                                        >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                    </div>
                                    <details className="text-[10px] text-foreground-muted">
                                        <summary className="cursor-pointer">Public key (PEM)</summary>
                                        <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[9px] max-h-[80px] overflow-y-auto">
                                            {key.publicKeyPem}
                                        </pre>
                                    </details>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delivery Log */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Delivery Log (Recent 20)</CardTitle>
                        <Button variant="outline" size="sm" onClick={clearDeliveries}>
                            <Trash2 className="h-3 w-3" /> Clear Log
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {deliveries.length === 0 ? (
                        <p className="text-xs text-foreground-muted text-center py-6">No delivery records</p>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {deliveries.map(del => (
                                <div
                                    key={del.id}
                                    className="rounded-md border border-border bg-muted/10 p-2 text-xs space-y-1"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {del.status === 'success' ? (
                                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                                        ) : (
                                            <XCircle className="h-3 w-3 text-destructive" />
                                        )}
                                        <Badge
                                            variant={del.status === 'success' ? 'success' : 'destructive'}
                                            className="text-[10px]"
                                        >
                                            {del.statusCode || del.status}
                                        </Badge>
                                        {del.signed && (
                                            <Badge variant="outline" className="text-[10px]">
                                                <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                                                Signed
                                            </Badge>
                                        )}
                                        {del.retried && (
                                            <Badge variant="outline" className="text-[10px]">
                                                <Clock className="h-2.5 w-2.5 mr-0.5" />
                                                Retried
                                            </Badge>
                                        )}
                                        {del.event && (
                                            <Badge variant="outline" className="text-[10px]">
                                                {del.event}
                                            </Badge>
                                        )}
                                        <span className="text-[10px] text-foreground-muted ml-auto">
                                            {formatTime(del.timestamp)}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[10px] text-foreground-muted">
                                        <span className="font-mono">{truncateUrl(del.url)}</span>
                                        <span>Latency: {del.latencyMs}ms</span>
                                        {del.attempt > 0 && <span>Attempt: {del.attempt}</span>}
                                    </div>
                                    {del.error && <p className="text-[10px] text-destructive">{del.error}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
