import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Users, RefreshCw, AlertCircle, UserPlus, Trash2, Copy, CheckCircle2,
  Clock, Mail, Loader2, Crown,
} from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';
import { toast } from 'sonner';

interface Seat {
  seatId: string;
  email: string;
  status: 'active' | 'pending';
  inviteToken: string | null;
  invitedAt: string;
  activatedAt: string | null;
}

interface SeatRoster {
  success: boolean;
  maxSeats: number;
  seatsUsed: number;
  seatsRemaining: number;
  tier: string;
  seats: Seat[];
  pendingInvites: Seat[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function tierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    developer: 'Developer',
    team_pro: 'Team Pro',
    enterprise: 'Enterprise',
    pro: 'Pro (Legacy)',
  };
  return names[tier] || tier;
}

export function LicenseManagerView() {
  const [roster, setRoster] = useState<SeatRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [revokingSeatId, setRevokingSeatId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/license/seats'), {
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError('No active license found. Purchase a Team Pro or Enterprise plan to manage seats.');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      // Normalize — API may omit empty arrays or numeric fields
      setRoster({
        seats: data.seats || [],
        pendingInvites: data.pendingInvites || [],
        maxSeats: data.maxSeats ?? 0,
        seatsUsed: data.seatsUsed ?? 0,
        seatsRemaining: data.seatsRemaining ?? 0,
        tier: data.tier || 'free',
        ...data,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load seat roster');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(apiUrl('/license/seats/invite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || 'Failed to send invitation');
        return;
      }
      toast.success(`Invitation created for ${inviteEmail.trim()}`);
      setInviteEmail('');
      await fetchRoster();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (seatId: string, email: string) => {
    if (!confirm(`Revoke seat access for ${email}? This will deactivate their license immediately.`)) {
      return;
    }
    setRevokingSeatId(seatId);
    try {
      const res = await fetch(apiUrl(`/license/seats/revoke/${seatId}`), {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || 'Failed to revoke seat');
        return;
      }
      toast.success(`Seat revoked for ${email}`);
      await fetchRoster();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke seat');
    } finally {
      setRevokingSeatId(null);
    }
  };

  const copyInviteLink = async (token: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/#/activate-license?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      toast.success('Invitation link copied to clipboard');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchRoster}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  if (!roster) return null;

  const allSeats = [...(roster.seats || []), ...(roster.pendingInvites || [])];
  const seatUtilization = roster.maxSeats === Infinity ? 0 : (roster.seatsUsed / roster.maxSeats) * 100;
  const isUnlimited = roster.maxSeats === Infinity;

  return (
    <div className="space-y-6">
      {/* Header + Seat Capacity Gauge */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                License Seat Management
              </CardTitle>
              <CardDescription>
                Manage developer seats for your {tierDisplayName(roster.tier)} plan
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRoster} disabled={loading}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Seat Utilization</span>
              <span className="text-sm text-muted-foreground">
                {isUnlimited ? (
                  <span className="flex items-center gap-1">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    Unlimited seats
                  </span>
                ) : (
                  `${roster.seatsUsed} / ${roster.maxSeats} seats used`
                )}
              </span>
            </div>
            {!isUnlimited && (
              <Progress
                value={seatUtilization}
                indicatorClassName={
                  seatUtilization >= 100 ? 'bg-destructive' :
                  seatUtilization >= 80 ? 'bg-yellow-500' : 'bg-primary'
                }
              />
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {roster.seatsUsed} active
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                {roster.pendingInvites.length} pending
              </span>
              {!isUnlimited && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {roster.seatsRemaining} remaining
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invite New Seat */}
      {!isUnlimited && roster.seatsRemaining <= 0 ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              All {roster.maxSeats} seats are in use. Revoke a seat to invite a new developer.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Developer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="developer@team.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !inviting && handleInvite()}
                disabled={inviting}
                className="flex-1"
              />
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send Invite
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seat Roster Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seat Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {allSeats.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No seats allocated yet. Invite a developer to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {allSeats.map((seat) => (
                <div
                  key={seat.seatId}
                  className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {seat.status === 'active' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{seat.email}</span>
                        <Badge
                          variant="secondary"
                          className={
                            seat.status === 'active'
                              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                              : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                          }
                        >
                          {seat.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {seat.status === 'active' && seat.activatedAt
                          ? `Activated ${timeAgo(seat.activatedAt)}`
                          : `Invited ${timeAgo(seat.invitedAt)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {seat.status === 'pending' && seat.inviteToken && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyInviteLink(seat.inviteToken!)}
                        title="Copy invitation link"
                      >
                        {copiedToken === seat.inviteToken ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(seat.seatId, seat.email)}
                      disabled={revokingSeatId === seat.seatId}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Revoke seat"
                      aria-label="Revoke seat"
                    >
                      {revokingSeatId === seat.seatId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
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
