import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LogIn, UserPlus } from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { toast } from 'sonner';
import { apiUrl, authHeaders, waitForApiBase } from '@/config';

export function SignInView() {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await waitForApiBase();
      const endpoint = mode === 'signin' ? '/auth/login' : '/auth/register';
      const resp = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, password }),
      });
      if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
      const data = await resp.json();
      if (data.token) {
        localStorage.setItem('sb_token', data.token);
        if (data.user) localStorage.setItem('sb_user', JSON.stringify(data.user));
        toast.success(mode === 'signin' ? 'Signed in' : 'Account created');
        navigate('dashboard');
      } else {
        throw new Error('No token received');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 12 15 16 10" />
            </svg>
          </div>
          <CardTitle className="text-2xl">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {mode === 'signin' ? 'Sign in to your SimpleBeacon account' : 'Register for a free SimpleBeacon account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="animate-pulse">Loading...</span>
              ) : mode === 'signin' ? (
                <><LogIn className="h-4 w-4" /> Sign In</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Register</>
              )}
            </Button>
          </form>
          <Separator className="my-4" />
          <div className="text-center">
            <Button
              variant="link"
              size="sm"
              onClick={() => setMode(mode === 'signin' ? 'register' : 'signin')}
            >
              {mode === 'signin' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
