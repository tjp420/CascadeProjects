import { useState, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Users,
  RefreshCw,
  AlertCircle,
  UserPlus,
  Trash2,
  Copy,
  CheckCircle2,
  Clock,
  Mail,
  Loader2,
  Crown,
  KeyRound,
  Download,
  Shield,
  Zap,
  Calendar,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  apiUrl,
  authHeaders,
  waitForApiBase,
  getLicenseToken,
  setLicenseToken,
  clearLicenseToken,
} from "@/config";
import { toast } from "sonner";

interface Seat {
  seatId: string;
  email: string;
  status: "active" | "pending";
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

interface LicenseStatus {
  registered: boolean;
  valid: boolean;
  email: string | null;
  tier: string | null;
  features: string[];
  registeredAt: string | null;
  expiresAt: string | null;
  expiry: number | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function tierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    developer: "Developer",
    team_pro: "Team Pro",
    enterprise: "Enterprise",
    pro: "Pro (Legacy)",
    free: "Free",
    startup: "Pro",
    growth: "Team",
    team: "Team",
  };
  return names[tier] || tier;
}

function tierColor(tier: string): string {
  if (tier === "enterprise" || tier === "team_pro" || tier === "team" || tier === "growth")
    return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
  if (tier === "developer" || tier === "free" || tier === "startup")
    return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
  return "bg-gray-500/15 text-gray-700 dark:text-gray-400";
}

function featureLabel(feature: string): string {
  const labels: Record<string, string> = {
    continuous_shield: "Continuous Shield",
    team_dashboard: "Team Dashboard",
    ci_integration: "CI/CD Integration",
    compliance_certificate: "Compliance Certificate",
    eu_ai_act: "EU AI Act",
    analyst_support: "Analyst Support",
    export_reports: "Export Reports",
    scan: "Scan",
  };
  return labels[feature] || feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LicenseManagerView() {
  const [roster, setRoster] = useState<SeatRoster | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revokingSeatId, setRevokingSeatId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [activateKey, setActivateKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copiedLicense, setCopiedLicense] = useState(false);
  const [showReplaceForm, setShowReplaceForm] = useState(false);

  const currentToken = getLicenseToken() || "";
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [sessionTokenLoading, setSessionTokenLoading] = useState(false);

  const fetchLicenseStatus = useCallback(async () => {
    if (!currentToken) {
      setLicenseStatus(null);
      return;
    }
    try {
      await waitForApiBase();
      const res = await fetch(apiUrl("/auth/token-status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(data);
      }
    } catch {
      /* non-blocking */
    }
  }, [currentToken]);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/license/seats"), {
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError(
            "No active license found. Activate a license key below to manage seats.",
          );
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRoster({
        ...data,
        success: true,
        seats: data.seats || [],
        pendingInvites: data.pendingInvites || [],
        maxSeats: data.maxSeats ?? 0,
        seatsUsed: data.seatsUsed ?? 0,
        seatsRemaining: data.seatsRemaining ?? 0,
        tier: data.tier || "free",
      });
    } catch (err: any) {
      setError(err.message || "Failed to load seat roster");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLicenseStatus();
    fetchRoster();

    // Check for checkout=success in URL (post-Stripe redirect)
    try {
      const params = new URLSearchParams(window.location.search);
      const checkoutSuccess = params.get("checkout") === "success";
      const sessionId = params.get("session_id");
      if (checkoutSuccess) {
        setCheckoutSuccess(true);
      }
      // If session_id is present, try to fetch the token from the session-token store
      if (sessionId && !currentToken) {
        setSessionTokenLoading(true);
        (async () => {
          try {
            await waitForApiBase();
            const res = await fetch(apiUrl(`/session-token/${encodeURIComponent(sessionId)}`));
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.token) {
                setActivateKey(data.token);
                toast.success("License token retrieved from checkout session");
              }
            }
          } catch {
            /* non-blocking — user can paste manually */
          } finally {
            setSessionTokenLoading(false);
          }
        })();
      }
    } catch {
      /* ignore URL parse errors */
    }
  }, [fetchLicenseStatus, fetchRoster, currentToken]);

  const handleActivate = async () => {
    const trimmed = activateKey.trim();
    if (!trimmed) {
      toast.error("Please paste your license key");
      return;
    }
    setActivating(true);
    try {
      await waitForApiBase();
      const resp = await fetch(apiUrl("/auth/token-status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });
      if (!resp.ok) {
        if (resp.status === 503) {
          throw new Error("License validation is temporarily unavailable");
        }
        let msg = `Validation failed (${resp.status})`;
        try {
          const errData = await resp.json();
          msg = errData.message || errData.error || msg;
        } catch {
          /* not JSON */
        }
        throw new Error(msg);
      }
      const data = await resp.json();
      if (data.valid && data.registered) {
        setLicenseToken(trimmed);
        const userData = {
          email: data.email || "",
          tier: data.tier || "developer",
          plan: data.tier || "developer",
          role: data.role || "user",
        };
        localStorage.setItem("sb_user", JSON.stringify(userData));
        try {
          window.dispatchEvent(new Event("sb:license"));
        } catch {
          /* ignore */
        }
        toast.success(`License activated — ${tierDisplayName(data.tier || "developer")} tier`);
        setActivateKey("");
        await fetchLicenseStatus();
        await fetchRoster();
      } else if (data.registered && !data.valid) {
        toast.error("License key found but no longer valid. It may have expired.");
      } else {
        toast.error("Invalid license key. Please check the key from your confirmation email.");
      }
    } catch (err: any) {
      toast.error(err.message || "License activation failed");
    } finally {
      setActivating(false);
    }
  };

  const handleRemoveLicense = () => {
    if (!confirm("Remove the current license token? You'll need to activate a new one to use license-gated features.")) {
      return;
    }
    clearLicenseToken();
    setLicenseStatus(null);
    setRoster(null);
    setShowReplaceForm(false);
    setActivateKey("");
    try {
      window.dispatchEvent(new Event("sb:license"));
    } catch {
      /* ignore */
    }
    toast.success("License token removed");
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(apiUrl("/license/seats/invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || "Failed to send invitation");
        return;
      }
      toast.success(`Invitation created for ${inviteEmail.trim()}`);
      setInviteEmail("");
      await fetchRoster();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (seatId: string, email: string) => {
    if (
      !confirm(
        `Revoke seat access for ${email}? This will deactivate their license immediately.`,
      )
    ) {
      return;
    }
    setRevokingSeatId(seatId);
    try {
      const res = await fetch(apiUrl(`/license/seats/revoke/${seatId}`), {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || "Failed to revoke seat");
        return;
      }
      toast.success(`Seat revoked for ${email}`);
      await fetchRoster();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke seat");
    } finally {
      setRevokingSeatId(null);
    }
  };

  const copyInviteLink = async (token: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/dashboard/signin?mode=license&token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      toast.success("Invitation link copied to clipboard");
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const copyLicenseToken = async () => {
    if (!currentToken) return;
    try {
      await navigator.clipboard.writeText(currentToken);
      setCopiedLicense(true);
      toast.success("License token copied to clipboard");
      setTimeout(() => setCopiedLicense(false), 2000);
    } catch {
      toast.error("Failed to copy token");
    }
  };

  const downloadLicenseToken = () => {
    if (!currentToken) return;
    const blob = new Blob([currentToken], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "simplebeacon-license.jwt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("License token downloaded");
  };

  const refreshAll = () => {
    fetchLicenseStatus();
    fetchRoster();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasLicense = licenseStatus?.valid && licenseStatus?.registered;
  const daysLeft = daysUntil(licenseStatus?.expiresAt || null);
  const allSeats = [...(roster?.seats || []), ...(roster?.pendingInvites || [])];
  const seatUtilization =
    roster && roster.maxSeats === Infinity
      ? 0
      : roster
        ? (roster.seatsUsed / roster.maxSeats) * 100
        : 0;
  const isUnlimited = roster?.maxSeats === Infinity;

  return (
    <div className="space-y-6">
      {/* Checkout Success Banner */}
      {checkoutSuccess && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Payment successful!
                </p>
                <p className="text-xs text-muted-foreground">
                  {sessionTokenLoading
                    ? "Retrieving your license token..."
                    : activateKey
                      ? "Your license token is ready below — click Activate to unlock your features."
                      : "Check your email for the license token, then paste it in the Activate section below."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCheckoutSuccess(false)}
                className="text-muted-foreground"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* License Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                License Status
              </CardTitle>
              <CardDescription>
                Your current SimpleBeacon license and feature access
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {hasLicense ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={tierColor(licenseStatus!.tier || "free")}>
                  <Crown className="h-3 w-3 mr-1" />
                  {tierDisplayName(licenseStatus!.tier || "free")}
                </Badge>
                <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
                {daysLeft !== null && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {daysLeft > 0
                      ? `${daysLeft} days remaining`
                      : "Expired"}
                  </span>
                )}
              </div>

              {licenseStatus!.email && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Registered to: </span>
                  <span className="font-medium">{licenseStatus!.email}</span>
                </div>
              )}

              {licenseStatus!.registeredAt && (
                <div className="text-xs text-muted-foreground">
                  Registered {timeAgo(licenseStatus!.registeredAt)}
                  {licenseStatus!.expiresAt && (
                    <> · Expires {new Date(licenseStatus!.expiresAt).toLocaleDateString()}</>
                  )}
                </div>
              )}

              {/* Features */}
              {licenseStatus!.features && licenseStatus!.features.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Included Features</span>
                  <div className="flex flex-wrap gap-2">
                    {licenseStatus!.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="gap-1">
                        <Zap className="h-3 w-3 text-primary" />
                        {featureLabel(feature)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center max-w-md">
                No active license found. Activate a license key below to unlock
                dashboard features and scans.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* License Token Management */}
      {currentToken && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              License Token
            </CardTitle>
            <CardDescription>
              Your license token — copy or download for CLI activation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  type={showToken ? "text" : "password"}
                  value={currentToken}
                  readOnly
                  className="font-mono text-xs flex-1"
                  placeholder="No token stored"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToken(!showToken)}
                  title={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyLicenseToken}
                  title="Copy to clipboard"
                >
                  {copiedLicense ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadLicenseToken}
                  title="Download as .jwt file"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">CLI Usage:</strong>
                <br />
                <code className="text-[11px]">
                  export SIMPLEBEACON_LICENSE_TOKEN="{showToken ? currentToken : "<your-token>"}"
                </code>
                <br />
                <span>Or save to file:</span>
                <br />
                <code className="text-[11px]">
                  mkdir -p ~/.simplebeacon && echo "{showToken ? currentToken : "<your-token>"}" &gt; ~/.simplebeacon/license.jwt
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activate / Replace / Upgrade License */}
      {(!hasLicense || showReplaceForm) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {hasLicense ? "Replace License" : "Activate License"}
            </CardTitle>
            <CardDescription>
              {hasLicense
                ? "Paste a new license key to upgrade or replace your current one"
                : "Paste the license key from your confirmation email to unlock dashboard features"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hasLicense && (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm">
                  <strong>Current tier:</strong>{" "}
                  {tierDisplayName(licenseStatus?.tier || "free")}
                  <br />
                  <span className="text-muted-foreground">
                    Replacing your license will overwrite the current token. Make
                    sure the new key is valid before activating.
                  </span>
                </div>
              )}
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground-muted">
                Your source code never leaves this machine. The license key
                unlocks dashboard features — no code is uploaded during scans.
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  value={activateKey}
                  onChange={(e) => setActivateKey(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !activating && handleActivate()
                  }
                  disabled={activating}
                  className="font-mono text-xs flex-1"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  onClick={handleActivate}
                  disabled={activating || !activateKey.trim()}
                >
                  {activating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  {hasLicense ? "Replace" : "Activate"}
                </Button>
                {hasLicense && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowReplaceForm(false);
                      setActivateKey("");
                    }}
                    disabled={activating}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade / Replace / Remove buttons — shown when license is active */}
      {hasLicense && !showReplaceForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              License Actions
            </CardTitle>
            <CardDescription>
              Upgrade, replace, or remove your current license token
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                onClick={() => {
                  setActivateKey("");
                  setShowReplaceForm(true);
                }}
              >
                <KeyRound className="h-4 w-4" />
                Upgrade / Replace License
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm("Go to pricing page to purchase a new plan?")) {
                    window.open("/pricing", "_blank");
                  }
                }}
              >
                View Pricing
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveLicense}
              >
                <Trash2 className="h-4 w-4" />
                Remove License
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seat Management — only show if license is active */}
      {hasLicense && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Seat Management
                  </CardTitle>
                  <CardDescription>
                    Manage developer seats for your{" "}
                    {tierDisplayName(licenseStatus?.tier || roster?.tier || "free")}{" "}
                    plan
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    {error}
                  </p>
                </div>
              ) : !roster ? null : (
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
                        seatUtilization >= 100
                          ? "bg-destructive"
                          : seatUtilization >= 80
                            ? "bg-yellow-500"
                            : "bg-primary"
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
              )}
            </CardContent>
          </Card>

          {/* Invite New Seat */}
          {!isUnlimited && roster && roster.seatsRemaining <= 0 ? (
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  All {roster.maxSeats} seats are in use. Revoke a seat to
                  invite a new developer.
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
                    onKeyDown={(e) =>
                      e.key === "Enter" && !inviting && handleInvite()
                    }
                    disabled={inviting}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                  >
                    {inviting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
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
                          {seat.status === "active" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {seat.email}
                            </span>
                            <Badge
                              variant="secondary"
                              className={
                                seat.status === "active"
                                  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                                  : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                              }
                            >
                              {seat.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {seat.status === "active" && seat.activatedAt
                              ? `Activated ${timeAgo(seat.activatedAt)}`
                              : `Invited ${timeAgo(seat.invitedAt)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {seat.status === "pending" && seat.inviteToken && (
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
        </>
      )}
    </div>
  );
}
