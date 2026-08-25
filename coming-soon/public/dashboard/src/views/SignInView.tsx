import { useState, useEffect, useCallback } from 'react';
// simplebeacon-ignore: unvalidated-redirect — SSO redirect uses server-resolved providerId from /sso/resolve, not user-controlled URLs
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LogIn, UserPlus, KeyRound, Building2, Fingerprint } from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { toast } from 'sonner';
import { apiUrl, waitForApiBase } from '@/config';

type SsoProvider = {
    found: boolean;
    providerId?: string;
    method?: 'oidc' | 'saml';
    displayName?: string;
    orgId?: string;
};

type Mode = 'signin' | 'register' | 'license';

export function SignInView() {
    const [mode, setMode] = useState<Mode>('signin');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [licenseKey, setLicenseKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [ssoProvider, setSsoProvider] = useState<SsoProvider | null>(null);
    const [ssoChecking, setSsoChecking] = useState(false);

    // Handle SSO callback — token in URL params after redirect from IdP
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const ssoToken = params.get('sso_token');
        const ssoError = params.get('sso_error');
        if (ssoToken) {
            localStorage.setItem('sb_token', ssoToken);
            const ssoProviderId = params.get('sso_provider') || '';
            localStorage.setItem('sb_sso_provider', ssoProviderId);
            try {
                window.dispatchEvent(new Event('sb:login'));
            } catch {
                /* ignore */
            }
            toast.success('SSO authentication successful');
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            navigate('dashboard');
        } else if (ssoError) {
            const errorMsg = params.get('sso_message') || ssoError;
            toast.error(`SSO login failed: ${errorMsg}`);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Read mode + token + email from URL params.
    // Checks both hash params (e.g. #/signin?mode=register&email=xxx)
    // and search params (e.g. /dashboard/signin?mode=register&email=xxx).
    // Search params are needed because many email clients strip # fragments.
    useEffect(() => {
        // Collect params from both hash and search string
        const allParams = new URLSearchParams();
        // From hash: #/signin?mode=register&email=xxx
        const hash = window.location.hash.slice(1);
        const hashQueryIndex = hash.indexOf('?');
        if (hashQueryIndex !== -1) {
            new URLSearchParams(hash.slice(hashQueryIndex + 1)).forEach((v, k) => allParams.set(k, v));
        }
        // From search: ?mode=register&email=xxx (used when email client strips # fragment)
        new URLSearchParams(window.location.search).forEach((v, k) => allParams.set(k, v));

        const urlMode = allParams.get('mode') as Mode | null;
        const urlToken = allParams.get('token');
        const urlEmail = allParams.get('email');
        const urlName = allParams.get('name');
        if (urlMode && (urlMode === 'signin' || urlMode === 'register' || urlMode === 'license')) {
            setMode(urlMode);
        }
        if (urlToken && urlMode === 'license') {
            setLicenseKey(urlToken);
        }
        if (urlEmail) {
            setEmail(urlEmail);
        }
        if (urlName) {
            setName(urlName);
        }
    }, []);

    // Debounced SSO domain detection
    const checkSsoDomain = useCallback(async (emailValue: string) => {
        if (!emailValue || !emailValue.includes('@')) {
            setSsoProvider(null);
            return;
        }
        setSsoChecking(true);
        try {
            await waitForApiBase();
            const resp = await fetch(apiUrl(`/sso/resolve?email=${encodeURIComponent(emailValue)}`));
            if (resp.ok) {
                const data = await resp.json();
                setSsoProvider(data.found ? data : null);
            } else {
                setSsoProvider(null);
            }
        } catch {
            setSsoProvider(null);
        } finally {
            setSsoChecking(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => checkSsoDomain(email), 400);
        return () => clearTimeout(timer);
    }, [email, checkSsoDomain]);

    const handleSsoLogin = () => {
        if (!ssoProvider?.providerId) return;
        const method = ssoProvider.method || 'oidc';
        const loginPath = method === 'saml' ? '/sso/saml/login' : '/sso/oidc/login';
        window.location.href = apiUrl(`${loginPath}?providerId=${encodeURIComponent(ssoProvider.providerId)}`);
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Please enter email and password');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }
        if (mode === 'register' && password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            await waitForApiBase();
            const endpoint = mode === 'signin' ? '/auth/login' : '/auth/register';
            const body: Record<string, string> = { email, password };
            if (mode === 'register' && name) body.name = name;
            const resp = await fetch(apiUrl(endpoint), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!resp.ok) {
                let friendlyMsg = `Authentication failed (${resp.status})`;
                try {
                    const errData = await resp.json();
                    friendlyMsg = errData.message || errData.error || errData.detail || friendlyMsg;
                } catch {
                    /* response was not JSON — use default message */
                }
                throw new Error(friendlyMsg);
            }
            const data = await resp.json();
            if (data.token) {
                localStorage.setItem('sb_token', data.token);
                if (data.user) localStorage.setItem('sb_user', JSON.stringify(data.user));
                try {
                    window.dispatchEvent(new Event('sb:login'));
                } catch {
                    /* ignore */
                }
                toast.success(mode === 'signin' ? 'Signed in' : 'Account created');
                navigate('dashboard');
            } else {
                throw new Error('No token received from server');
            }
        } catch (err: any) {
            toast.error(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLicenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = licenseKey.trim();
        if (!trimmed) {
            toast.error('Please paste your license key');
            return;
        }
        setLoading(true);
        try {
            await waitForApiBase();
            const resp = await fetch(apiUrl('/auth/token-status'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: trimmed })
            });
            if (!resp.ok) {
                if (resp.status === 503) {
                    throw new Error('License validation is temporarily unavailable');
                }
                let friendlyMsg = `Validation failed (${resp.status})`;
                try {
                    const errData = await resp.json();
                    friendlyMsg = errData.message || errData.error || errData.detail || friendlyMsg;
                } catch {
                    /* response was not JSON */
                }
                throw new Error(friendlyMsg);
            }
            const data = await resp.json();
            if (data.valid && data.registered) {
                localStorage.setItem('sb_token', trimmed);
                const userData = {
                    email: data.email || '',
                    tier: data.tier || 'developer',
                    plan: data.tier || 'developer',
                    // Use role from server response if available, otherwise default to 'user'.
                    // The useAuth hook will also decode the JWT as a fallback to get the correct role.
                    role: data.role || data.user?.role || 'user'
                };
                localStorage.setItem('sb_user', JSON.stringify(userData));
                try {
                    window.dispatchEvent(new Event('sb:login'));
                } catch {
                    /* ignore */
                }
                toast.success(`License activated — ${data.tier} tier`);
                navigate('dashboard');
            } else if (data.registered && !data.valid) {
                toast.error('License key found but no longer valid. It may have expired.');
            } else {
                toast.error('Invalid license key. Please check the key from your confirmation email.');
            }
        } catch (err: any) {
            toast.error(err.message || 'License activation failed');
        } finally {
            setLoading(false);
        }
    };

    const title = mode === 'signin' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Activate License';
    const description =
        mode === 'signin'
            ? 'Sign in to your SimpleBeacon account'
            : mode === 'register'
              ? 'Register for a free SimpleBeacon account'
              : 'Paste the license key from your confirmation email';

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                        {mode === 'license' ? (
                            <KeyRound className="h-7 w-7 text-primary-foreground" />
                        ) : (
                            <svg
                                viewBox="0 0 24 24"
                                className="h-7 w-7 text-primary-foreground"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <polyline points="9 12 12 15 16 10" />
                            </svg>
                        )}
                    </div>
                    <CardTitle className="text-2xl">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    {mode === 'license' ? (
                        <>
                            <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground-muted">
                                Your source code never leaves this machine. The license key unlocks dashboard features —
                                no code is uploaded during scans.
                            </div>
                            <form onSubmit={handleLicenseSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="licenseKey">License Key</Label>
                                    <Input
                                        id="licenseKey"
                                        type="text"
                                        placeholder="eyJhbGciOiJIUzI1NiIs..."
                                        value={licenseKey}
                                        onChange={e => setLicenseKey(e.target.value)}
                                        className="font-mono text-xs"
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? (
                                        <span className="animate-pulse">Validating...</span>
                                    ) : (
                                        <>
                                            <KeyRound className="h-4 w-4" /> Activate License
                                        </>
                                    )}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <form onSubmit={handleAuthSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    {...(mode === 'register' && email ? { readOnly: true } : {})}
                                />
                                {mode === 'register' && email && (
                                    <p className="text-xs text-muted-foreground">
                                        From your purchase — you can change this if needed.
                                    </p>
                                )}
                            </div>
                            {mode === 'register' && (
                                <div className="space-y-2">
                                    <Label htmlFor="name">
                                        Name <span className="text-muted-foreground">(optional)</span>
                                    </Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        placeholder="Jane Doe"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>
                            )}
                            {ssoProvider && ssoProvider.found && (
                                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Building2 className="h-4 w-4 text-primary" />
                                        <span>{ssoProvider.displayName || 'Enterprise SSO'} detected</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Your organization uses {ssoProvider.method?.toUpperCase() || 'SSO'} for
                                        authentication.
                                    </p>
                                    <Button type="button" variant="outline" className="w-full" onClick={handleSsoLogin}>
                                        <Fingerprint className="h-4 w-4" />
                                        Continue with {ssoProvider.displayName || 'Enterprise SSO'}
                                    </Button>
                                </div>
                            )}
                            {ssoChecking && email.includes('@') && (
                                <p className="text-xs text-muted-foreground animate-pulse">
                                    Checking for enterprise SSO...
                                </p>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                {mode === 'register' && (
                                    <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                                )}
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <span className="animate-pulse">Loading...</span>
                                ) : mode === 'signin' ? (
                                    <>
                                        <LogIn className="h-4 w-4" /> Sign In
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" /> Register
                                    </>
                                )}
                            </Button>
                        </form>
                    )}
                    <Separator className="my-4" />
                    <div className="flex flex-col items-center gap-2">
                        {mode === 'license' ? (
                            <Button variant="link" size="sm" onClick={() => setMode('signin')}>
                                Back to sign in
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => setMode(mode === 'signin' ? 'register' : 'signin')}
                                >
                                    {mode === 'signin'
                                        ? "Don't have an account? Register"
                                        : 'Already have an account? Sign in'}
                                </Button>
                                <Button variant="link" size="sm" onClick={() => setMode('license')}>
                                    <KeyRound className="h-3 w-3" /> Activate a license key
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
