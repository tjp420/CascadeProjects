// simplebeacon-ignore: debugArtifacts — console.error in catch block is intentional error handling
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Shield, Crown, LogOut, Settings as SettingsIcon, Download, RefreshCw } from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { apiUrl, authHeaders, getApiBase } from '@/config';

interface UserData {
    email?: string;
    name?: string;
    role?: string;
    plan?: string;
    tier?: string;
}

export function ProfileView() {
    const [user, setUser] = useState<UserData | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [subscription, setSubscription] = useState<{
        plan?: string;
        scansRemaining?: string | number;
        apiAccess?: string;
    } | null>(null);
    const [subscriptionUnavailable, setSubscriptionUnavailable] = useState(false);

    // simplebeacon-ignore: framework-practices — standard React useEffect hook
    useEffect(() => {
        try {
            const token = localStorage.getItem('sb_token') || localStorage.getItem('auth_token');
            if (token) {
                setIsAuthenticated(true);
                const userData = localStorage.getItem('sb_user');
                if (userData) {
                    setUser(JSON.parse(userData));
                }
                // Fetch subscription data from server
                (async () => {
                    try {
                        const resp = await fetch(apiUrl('/user/subscription'), { headers: authHeaders() });
                        if (resp.status === 404) {
                            setSubscriptionUnavailable(true);
                        }
                        if (resp.ok) {
                            const body = await resp.json();
                            if (body && body.subscription) setSubscription(body.subscription);
                        }
                    } catch {
                        setSubscriptionUnavailable(true);
                    }
                })();
            }
        } catch {
            /* ignore */
        }
    }, []);

    const handleSignOut = () => {
        localStorage.removeItem('sb_token');
        localStorage.removeItem('sb_user');
        localStorage.removeItem('auth_token');
        navigate('signin');
    };

    const [exporting, setExporting] = useState(false);

    const handleExport = useCallback(async () => {
        setExporting(true);
        try {
            const profile = user || {};
            const email = profile.email || 'unknown';
            const host = typeof window !== 'undefined' ? window.location?.hostname || 'localhost' : 'localhost';
            const timestamp = Date.now();

            // Gather data from localStorage
            let scanHistory: unknown[] = [];
            try {
                const raw = localStorage.getItem('sb_scan_history');
                if (raw) scanHistory = JSON.parse(raw);
            } catch {
                /* ignore */
            }

            let report: unknown = null;
            try {
                const raw = localStorage.getItem('sb_last_scan_full');
                if (raw) report = JSON.parse(raw);
            } catch {
                /* ignore */
            }

            let baseline: unknown = null;
            try {
                const raw = localStorage.getItem('sb_baseline');
                if (raw) baseline = JSON.parse(raw);
            } catch {
                /* ignore */
            }

            let config: unknown = null;
            try {
                const raw = localStorage.getItem('sb_config');
                if (raw) config = JSON.parse(raw);
            } catch {
                /* ignore */
            }

            let assessment: unknown = null;
            try {
                const raw = localStorage.getItem('sb_assessment');
                if (raw) assessment = JSON.parse(raw);
            } catch {
                /* ignore */
            }

            // Fetch AI keys from API
            let aiKeys: unknown = null;
            try {
                const resp = await fetch(apiUrl('/simplebeacon/user/ai-keys'), { headers: authHeaders() });
                if (resp.ok) aiKeys = await resp.json();
            } catch {
                /* ignore */
            }

            // If scan history is empty, try fetching from API
            if (scanHistory.length === 0) {
                try {
                    const resp = await fetch(apiUrl('/simplebeacon/history?limit=50'), { headers: authHeaders() });
                    if (resp.ok) {
                        const body = await resp.json();
                        if (Array.isArray(body)) {
                            scanHistory = body;
                        } else if (body?.history) {
                            scanHistory = body.history;
                        }
                    }
                } catch {
                    /* ignore */
                }
            }

            const bundle = {
                exportedAt: new Date().toISOString(),
                profile: {
                    id: (profile as any).id || 'dev-user-01',
                    email,
                    name: profile.name || 'Local Developer',
                    role: profile.role || 'admin',
                    tier: (profile as any).tier || null,
                    trustLevel: (profile as any).trustLevel || 'platinum'
                },
                aiKeys: aiKeys || {
                    email,
                    providers: {},
                    ollamaBaseUrl: '',
                    ollamaModel: '',
                    updatedAt: null
                },
                scanHistory,
                report,
                baseline,
                config,
                assessment
            };

            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `simplebeacon-export-${host.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        } finally {
            setExporting(false);
        }
    }, [user]);

    if (!isAuthenticated) {
        return (
            <div className="mx-auto max-w-4xl p-6 space-y-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
                    <p className="text-foreground-muted">Account settings and preferences</p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                        <User className="h-12 w-12 text-foreground-muted" />
                        <p className="text-sm text-foreground-muted">Sign in to view your profile</p>
                        <Button onClick={() => navigate('signin')}>Sign In</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const displayName = user?.name || user?.email || 'User';
    const initials = displayName.charAt(0).toUpperCase();
    const plan =
        user?.plan || user?.tier || (user?.role === 'admin' || user?.role === 'superuser' ? 'enterprise' : 'free');
    const role = user?.role || 'user';
    const displayedPlan = subscription?.plan || plan;

    return (
        <div className="mx-auto max-w-4xl p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
                <p className="text-foreground-muted">Account settings and preferences</p>
            </div>

            {/* User Identity Card */}
            <Card>
                <CardContent className="flex items-center gap-4 py-6">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                        {initials}
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold">{displayName}</h2>
                            {plan !== 'free' && (
                                <Badge className="gap-1">
                                    <Crown className="h-3 w-3" /> {plan}
                                </Badge>
                            )}
                            {role !== 'user' && (
                                <Badge variant="outline" className="gap-1">
                                    <Shield className="h-3 w-3" /> {role}
                                </Badge>
                            )}
                        </div>
                        {user?.email && (
                            <div className="flex items-center gap-1.5 text-sm text-foreground-muted">
                                <Mail className="h-3.5 w-3.5" /> {user.email}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Subscription / Tier Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Current plan and usage</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Plan</span>
                            <Badge variant={plan === 'free' ? 'secondary' : 'default'} className="capitalize">
                                {displayedPlan}
                            </Badge>
                        </div>
                        {displayedPlan === 'free' && (
                            <Button
                                size="sm"
                                onClick={() => (subscriptionUnavailable ? navigate('help') : navigate('settings'))}
                            >
                                <Crown className="h-4 w-4" /> Upgrade
                            </Button>
                        )}
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">Scans remaining</span>
                        <span className="text-sm font-medium">{subscription?.scansRemaining ?? 'Unlimited'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-muted">API access</span>
                        <span className="text-sm font-medium">
                            {subscription?.apiAccess ?? (plan === 'free' ? 'Limited' : 'Full')}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Preferences Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Preferences</CardTitle>
                    <CardDescription>Manage dashboard and scan preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                        <div className="flex items-center gap-3">
                            <SettingsIcon className="h-4 w-4 text-foreground-muted" />
                            <div>
                                <p className="text-sm font-medium">Dashboard Settings</p>
                                <p className="text-xs text-foreground-muted">API keys, scan paths, AI providers</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate('settings')}>
                            Open
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Account Actions Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Actions</CardTitle>
                    <CardDescription>Manage your account data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                        <div className="flex items-center gap-3">
                            <Download className="h-4 w-4 text-foreground-muted" />
                            <div>
                                <p className="text-sm font-medium">Export Data</p>
                                <p className="text-xs text-foreground-muted">Download your scan history and reports</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
                            {exporting ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin" /> Exporting…
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" /> Export
                                </>
                            )}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-danger/30 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <LogOut className="h-4 w-4 text-danger" />
                            <div>
                                <p className="text-sm font-medium">Sign Out</p>
                                <p className="text-xs text-foreground-muted">End your current session</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleSignOut}>
                            Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
