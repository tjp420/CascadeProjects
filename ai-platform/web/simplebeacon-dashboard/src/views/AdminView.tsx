import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Users, RefreshCw, AlertCircle, Shield, UserCircle, Activity, Crown, Ban, CheckCircle2,
  Building2, Server, Clock, DollarSign, Key, TrendingUp, ChevronRight,
} from 'lucide-react';
import { apiUrl, authHeaders, getApiBase } from '@/config';
import { navigate } from '@/router/HashRouter';
import { toast } from 'sonner';

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

type EnterpriseOrg = {
  orgId: string;
  companyName: string;
  adminEmail: string;
  tier: string;
  status: string;
  seatCount: number;
  seatsUsed: number;
  provisionedEmails: string[];
  contractValue: number | null;
  contractPeriodMonths: number;
  createdAt: string;
  expiresAt: string;
  trial: boolean;
  trialStartedAt?: string;
  trialExpiresAt?: string;
};

function enterpriseUrl(path: string): string {
  const base = getApiBase();
  return `${base}/api${path}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function AdminView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [adminTab, setAdminTab] = useState('users');
  const [enterpriseOrgs, setEnterpriseOrgs] = useState<EnterpriseOrg[]>([]);
  const [enterpriseLoading, setEnterpriseLoading] = useState(false);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  const fetchEnterpriseOrgs = useCallback(async () => {
    setEnterpriseLoading(true);
    try {
      const res = await fetch(enterpriseUrl('/enterprise/organizations'), { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setEnterpriseOrgs(data.organizations || []);
    } catch {
      // Enterprise API may not be available in all deployments
    } finally {
      setEnterpriseLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchData();
    fetchEnterpriseOrgs();
  }, [fetchData, fetchEnterpriseOrgs]);

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
              <Button variant="ghost" onClick={() => navigate('dashboard')}>Back</Button>
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

  // Enterprise KPIs
  const totalOrgs = enterpriseOrgs.length;
  const totalSeats = enterpriseOrgs.reduce((sum, o) => sum + o.seatCount, 0);
  const usedSeats = enterpriseOrgs.reduce((sum, o) => sum + o.seatsUsed, 0);
  const trialOrgs = enterpriseOrgs.filter(o => o.trial);
  const activeOrgs = enterpriseOrgs.filter(o => !o.trial);
  const totalContractValue = enterpriseOrgs.reduce((sum, o) => sum + (o.contractValue || 0), 0);
  const expiringTrials = trialOrgs.filter(o => o.trialExpiresAt && daysUntil(o.trialExpiresAt) <= 7);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-foreground-muted">User management, enterprise tenants, and system administration</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchData} className="w-fit">
            <RefreshCw className="h-4 w-4" /> Refresh Users
          </Button>
          <Button size="sm" variant="outline" onClick={fetchEnterpriseOrgs} className="w-fit">
            <RefreshCw className="h-4 w-4" /> Refresh Tenants
          </Button>
        </div>
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

      {/* Enterprise KPI Cards */}
      {totalOrgs > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">{totalOrgs}</span>
              <span className="text-xs text-foreground-muted">Enterprise Tenants</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Server className="h-6 w-6 text-blue-500" />
              <span className="text-lg font-bold">{usedSeats}/{totalSeats}</span>
              <span className="text-xs text-foreground-muted">Seats Provisioned</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <DollarSign className="h-6 w-6 text-green-500" />
              <span className="text-lg font-bold">${totalContractValue.toLocaleString()}</span>
              <span className="text-xs text-foreground-muted">Contract Value</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Clock className={`h-6 w-6 ${expiringTrials.length > 0 ? 'text-amber-500' : 'text-foreground-muted'}`} />
              <span className="text-lg font-bold">{trialOrgs.length}</span>
              <span className="text-xs text-foreground-muted">Active Trials</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Expiring Trial Alert */}
      {expiringTrials.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {expiringTrials.length} trial{expiringTrials.length !== 1 ? 's' : ''} expiring within 7 days
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {expiringTrials.map(o => o.companyName).join(', ')}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setAdminTab('tenants')}>
                View Tenants <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="tenants">Enterprise Tenants</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
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
                    {status === 'active' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Ban className="h-4 w-4 text-red-500" />}
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
                            {user.online && (
                              <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" title="Online" />
                            )}
                          </div>
                          <span className="text-xs text-foreground-muted truncate block">{user.email || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={variant} className="text-xs capitalize">{user.trustLevel || 'bronze'}</Badge>
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
        </TabsContent>

        {/* Enterprise Tenants Tab */}
        <TabsContent value="tenants" className="space-y-4">
          {enterpriseLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
                <p className="text-sm text-foreground-muted">Loading enterprise tenants…</p>
              </CardContent>
            </Card>
          ) : totalOrgs === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold">No Enterprise Tenants</h2>
                  <p className="text-muted-foreground mt-1">Provision enterprise organizations from the Enterprise panel.</p>
                </div>
                <Button variant="outline" onClick={() => navigate('enterprise')}>
                  <Building2 className="h-4 w-4" /> Go to Enterprise
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Active Contracts */}
              {activeOrgs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Active Contracts ({activeOrgs.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {activeOrgs.map((org) => (
                      <div
                        key={org.orgId}
                        className={`rounded-lg border p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                          expandedOrg === org.orgId ? 'ring-1 ring-primary' : ''
                        }`}
                        onClick={() => setExpandedOrg(expandedOrg === org.orgId ? null : org.orgId)}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{org.companyName}</p>
                              <p className="text-xs text-muted-foreground truncate">{org.adminEmail}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-medium">{org.seatsUsed}/{org.seatCount} seats</p>
                              <p className="text-xs text-muted-foreground">
                                {org.contractValue ? `$${org.contractValue.toLocaleString()}` : 'Custom'}
                              </p>
                            </div>
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedOrg === org.orgId ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {expandedOrg === org.orgId && (
                          <div className="mt-4 pt-4 border-t border-border space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground text-xs">Org ID</span>
                                <p className="font-mono text-xs">{org.orgId}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Created</span>
                                <p className="font-medium">{formatDate(org.createdAt)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Expires</span>
                                <p className="font-medium">{formatDate(org.expiresAt)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Contract</span>
                                <p className="font-medium">{org.contractPeriodMonths} months</p>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Seat utilization</span>
                                <span className="font-medium">{Math.round((org.seatsUsed / org.seatCount) * 100)}%</span>
                              </div>
                              <Progress
                                value={(org.seatsUsed / org.seatCount) * 100}
                                indicatorClassName={org.seatsUsed >= org.seatCount ? 'bg-destructive' : 'bg-primary'}
                              />
                            </div>

                            {org.provisionedEmails.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-xs">Provisioned Members</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {org.provisionedEmails.map((email, idx) => (
                                    <Badge key={email} variant={idx === 0 ? 'warning' : 'secondary'} className="text-xs">
                                      {idx === 0 && <Crown className="h-3 w-3 mr-1" />}
                                      {email}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); navigate('enterprise'); }}
                              >
                                <Building2 className="h-3.5 w-3.5" /> Manage in Enterprise
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Active Trials */}
              {trialOrgs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="h-5 w-5 text-amber-500" />
                      Active Trials ({trialOrgs.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {trialOrgs.map((org) => {
                      const daysLeft = org.trialExpiresAt ? daysUntil(org.trialExpiresAt) : 0;
                      const isExpiring = daysLeft <= 7;
                      return (
                        <div
                          key={org.orgId}
                          className={`rounded-lg border p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                            expandedOrg === org.orgId ? 'ring-1 ring-primary' : ''
                          } ${isExpiring ? 'border-amber-300 dark:border-amber-800' : ''}`}
                          onClick={() => setExpandedOrg(expandedOrg === org.orgId ? null : org.orgId)}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                                <Clock className="h-5 w-5 text-amber-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{org.companyName}</p>
                                <p className="text-xs text-muted-foreground truncate">{org.adminEmail}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className={`text-sm font-medium ${isExpiring ? 'text-amber-600' : ''}`}>
                                  {daysLeft} days left
                                </p>
                                <p className="text-xs text-muted-foreground">{org.seatsUsed}/{org.seatCount} seats</p>
                              </div>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedOrg === org.orgId ? 'rotate-90' : ''}`} />
                            </div>
                          </div>

                          {expandedOrg === org.orgId && (
                            <div className="mt-4 pt-4 border-t border-border space-y-3">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Trial progress</span>
                                  <span className="font-medium">{daysLeft}/30 days remaining</span>
                                </div>
                                <Progress
                                  value={(daysLeft / 30) * 100}
                                  indicatorClassName={isExpiring ? 'bg-amber-500' : 'bg-primary'}
                                />
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground text-xs">Trial Started</span>
                                  <p className="font-medium">{org.trialStartedAt ? formatDate(org.trialStartedAt) : '—'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Trial Expires</span>
                                  <p className="font-medium">{org.trialExpiresAt ? formatDate(org.trialExpiresAt) : '—'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Seats</span>
                                  <p className="font-medium">{org.seatsUsed}/{org.seatCount}</p>
                                </div>
                              </div>

                              {org.provisionedEmails.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-muted-foreground text-xs">Provisioned Members</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {org.provisionedEmails.map((email, idx) => (
                                      <Badge key={email} variant={idx === 0 ? 'warning' : 'secondary'} className="text-xs">
                                        {idx === 0 && <Crown className="h-3 w-3 mr-1" />}
                                        {email}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.stopPropagation(); navigate('enterprise'); }}
                                >
                                  <TrendingUp className="h-3.5 w-3.5" /> Convert to Contract
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
