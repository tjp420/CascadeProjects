import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Loader2, RefreshCw, Link2, Users, MousePointerClick, DollarSign } from 'lucide-react';
import { useReferralStats } from '@/hooks/useReferralStats';

interface ReferralAnalyticsPanelProps {
  userEmail?: string | null;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'converted' || status === 'granted') return 'default';
  if (status === 'signed_up') return 'secondary';
  return 'outline';
}

function formatStatus(status: string): string {
  if (status === 'signed_up') return 'Signed up';
  if (status === 'clicked') return 'Clicked';
  if (status === 'granted') return 'Granted';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ReferralAnalyticsPanel({ userEmail }: ReferralAnalyticsPanelProps) {
  const { data, loading, error, refresh } = useReferralStats(userEmail);
  const [copied, setCopied] = useState(false);

  const stats = data?.stats;
  const shareUrl = stats?.shareUrl || '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked */
    }
  };

  if (!userEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Referral Program</CardTitle>
          <CardDescription>Sign in to track link views, signups, and conversion rewards.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Referral Program</h2>
          <p className="text-sm text-foreground-muted">
            Live metrics for <span className="font-mono text-foreground">{userEmail}</span>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Link views"
          value={stats?.clicks ?? '—'}
          icon={<MousePointerClick className="h-4 w-4 text-indigo-400" />}
          loading={loading}
        />
        <MetricCard
          label="Registrations"
          value={stats?.signups ?? '—'}
          icon={<Users className="h-4 w-4 text-sky-400" />}
          loading={loading}
        />
        <MetricCard
          label="Conversions"
          value={stats?.conversions ?? '—'}
          icon={<Link2 className="h-4 w-4 text-emerald-400" />}
          loading={loading}
        />
        <MetricCard
          label="Accrued credit"
          value={stats ? `$${stats.pendingPayout.toFixed(2)}` : '—'}
          icon={<DollarSign className="h-4 w-4 text-amber-400" />}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share link</CardTitle>
          <CardDescription>Copy your referral URL and send it to engineering peers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 bg-background/60 p-1.5 border border-border rounded-md">
            <input
              type="text"
              readOnly
              value={
                loading ? 'Loading share URL…' : shareUrl || 'No partner link yet — run a scan and share from Results.'
              }
              className="bg-transparent text-foreground-muted text-xs px-2 py-1 w-full font-mono outline-none truncate"
            />
            <Button type="button" size="sm" onClick={handleCopy} disabled={loading || !shareUrl}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </>
              )}
            </Button>
          </div>
          {stats?.partnerCode && (
            <p className="text-xs text-foreground-muted mt-2 font-mono">Partner code: {stats.partnerCode}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversion history</CardTitle>
          <CardDescription>Attribution events synced from Stripe and signup flows.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-foreground-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
            </div>
          )}
          {!loading &&
            (!data?.ledger?.length ? (
              <p className="text-sm text-foreground-muted">
                No attribution events yet. Share your link to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-foreground-muted">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Referee</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ledger.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-4 font-mono text-xs">{row.date || '—'}</td>
                        <td className="py-2.5 pr-4 truncate max-w-[180px]">{row.refereeEmail || '—'}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={statusBadgeVariant(row.status)}>{formatStatus(row.status)}</Badge>
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          {row.reward > 0 ? `$${row.reward.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">{label}</p>
          {icon}
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-foreground-muted" /> : value}
        </p>
      </CardContent>
    </Card>
  );
}
