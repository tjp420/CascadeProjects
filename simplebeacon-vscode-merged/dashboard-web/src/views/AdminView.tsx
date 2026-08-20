import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Users, RefreshCw, AlertCircle, Shield, UserCircle, Activity, Crown, Ban, CheckCircle2 } from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';
import { navigate } from '@/router/HashRouter';

type AdminStats = {
  totalAccounts?: number;
  onlineNow?: number;
  activeSessions?: number;
  tierCounts?: { bronze?: number; silver?: number; gold?: number };
  statusCounts?: { active?: number; suspended?: number; [key: string]: number | undefined };
  activeSubscriptions?: number;
};

type AdminUser = {
  id?: string;
  email?: string;
  name?: string;
  trustLevel?: string;
  status?: string;
  online?: boolean;
  lastSeen?: string | null;
  createdAt?: string;
};

export function AdminView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const [statsResp, usersResp] = await Promise.allSettled([
        fetch(apiUrl('/admin/stats'), { headers: authHeaders(), signal: controller.signal }),
        fetch(apiUrl('/admin/users?limit=20'), { headers: authHeaders(), signal: controller.signal }),
      ]);
      clearTimeout(timeout);

      if (statsResp.status === 'fulfilled') {
        if (statsResp.value.status === 401 || statsResp.value.status === 403) {
          setForbidden(true);
          setLoading(false);
          return;
        }
        if (statsResp.value.ok) {
          const data = await statsResp.value.json();
          if (data.success) setStats(data.stats);
        }
      }

      if (usersResp.status === 'fulfilled') {
        if (usersResp.value.ok) {
          const data = await usersResp.value.json();
          if (data.success && data.users) setUsers(data.users);
        }
      }

      if (statsResp.status === 'rejected' && usersResp.status === 'rejected') {
        throw new Error('Failed to fetch admin data');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-foreground-muted">User management and system administration</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
            <p className="text-sm text-foreground-muted">Loading admin data…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-foreground-muted">User management and system administration</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Shield className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">Admin access required. Sign in with an admin account.</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => navigate('signin')}>Sign In</Button>
              <Button variant="ghost" onClick={() => navigate('dashboard')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !stats && users.length === 0) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-foreground-muted">User management and system administration</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <AlertCircle className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">{error}</p>
            <Button size="sm" onClick={fetchData} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierBadge = (tier?: string) => {
    const t = (tier || 'bronze').toLowerCase();
    if (t === 'gold') return { variant: 'warning' as const, icon: Crown };
    if (t === 'silver') return { variant: 'outline' as const, icon: Shield };
    return { variant: 'secondary' as const, icon: UserCircle };
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-foreground-muted">User management and system administration</p>
        <Button size="sm" variant="outline" onClick={fetchData} className="w-fit">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Users className="h-6 w-6 text-foreground-muted" />
              <span className="text-lg font-bold">{stats.totalAccounts ?? '—'}</span>
              <span className="text-xs text-foreground-muted">Total Accounts</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Activity className="h-6 w-6 text-green-500" />
              <span className="text-lg font-bold">{stats.onlineNow ?? 0}</span>
              <span className="text-xs text-foreground-muted">Online Now</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Shield className="h-6 w-6 text-foreground-muted" />
              <span className="text-lg font-bold">{stats.activeSessions ?? 0}</span>
              <span className="text-xs text-foreground-muted">Active Sessions</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Crown className="h-6 w-6 text-yellow-500" />
              <span className="text-lg font-bold">{stats.activeSubscriptions ?? 0}</span>
              <span className="text-xs text-foreground-muted">Subscriptions</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tier & Status Breakdown */}
      {stats?.tierCounts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {Object.entries(stats.tierCounts).map(([tier, count]) => {
              const { variant, icon: Icon } = tierBadge(tier);
              return (
                <div key={tier} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium capitalize">{tier}</span>
                  <Badge variant={variant}>{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {stats?.statusCounts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                {status === 'active' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Ban className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium capitalize">{status}</span>
                <Badge variant={status === 'active' ? 'success' : 'danger'}>{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users</CardTitle>
          <CardDescription>Recent registered users</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-foreground-muted text-center py-4">No users found</p>
          ) : (
            <div className="space-y-2">
              {users.map((user, i) => {
                const { variant, icon: Icon } = tierBadge(user.trustLevel);
                return (
                  <div key={user.id || i} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{user.name || user.email || 'Unknown'}</span>
                        {user.online && <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" title="Online" />}
                      </div>
                      <span className="text-xs text-foreground-muted truncate block">{user.email || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={variant} className="text-xs capitalize">
                        {user.trustLevel || 'bronze'}
                      </Badge>
                      <Badge variant={user.status === 'active' ? 'success' : 'danger'} className="text-xs capitalize">
                        {user.status || 'active'}
                      </Badge>
                    </div>
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
