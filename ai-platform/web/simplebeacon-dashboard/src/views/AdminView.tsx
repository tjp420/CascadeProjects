import { useState, useCallback, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users,
  RefreshCw,
  AlertCircle,
  Shield,
  UserCircle,
  Activity,
  Crown,
  Ban,
  CheckCircle2,
  Building2,
  Server,
  Clock,
  DollarSign,
  Key,
  TrendingUp,
  ChevronRight,
  Download,
  Lock,
  Plus,
  Trash2,
  Zap,
  Globe,
  UserPlus,
  X,
  Copy,
  Loader2,
} from "lucide-react";
import { IntegrationsView } from "./IntegrationsView";
import { UsageAnalyticsView } from "./UsageAnalyticsView";
import { WhitelabelAdminView } from "./WhitelabelAdminView";
import { apiUrl, authHeaders, getApiBase } from "@/config";
import { navigate } from "@/router/HashRouter";
import { toast } from "sonner";

type AdminStats = {
  totalAccounts?: number;
  onlineNow?: number;
  activeSessions?: number;
  tierCounts?: { bronze?: number; silver?: number; gold?: number };
  statusCounts?: {
    active?: number;
    suspended?: number;
    [key: string]: number | undefined;
  };
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

type AuditEntry = {
  eventId: string;
  timestamp: string;
  action: string;
  orgId: string;
  actor: string;
  actorIp: string | null;
  description: string;
  before: object | null;
  after: object | null;
  metadata: object;
  previousHash: string | null;
  hash: string;
};

type AuditStats = {
  totalEntries: number;
  actionCounts: Record<string, number>;
  orgCounts: Record<string, number>;
  last24h: number;
};

type SsoConfig = {
  providerId: string;
  orgId: string;
  displayName: string;
  method: "saml" | "oidc";
  providerType: string;
  domain: string;
  enabled: boolean;
  saml: { entryPoint?: string; cert?: string; issuer?: string } | null;
  oidc: {
    clientId?: string;
    clientSecret?: string;
    issuer?: string;
    redirectUri?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  org_created: { label: "Org Created", color: "text-green-600" },
  trial_started: { label: "Trial Started", color: "text-blue-600" },
  seat_added: { label: "Seat Added", color: "text-green-600" },
  seat_removed: { label: "Seat Removed", color: "text-red-600" },
  api_key_generated: { label: "API Key Generated", color: "text-amber-600" },
  azure_devops_generated: {
    label: "Azure DevOps Generated",
    color: "text-purple-600",
  },
  org_updated: { label: "Org Updated", color: "text-blue-600" },
  contract_upgraded: { label: "Contract Upgraded", color: "text-green-600" },
};

function enterpriseUrl(path: string): string {
  const base = getApiBase();
  return `${base}/api${path}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function daysUntil(iso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}

export function AdminView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(0);
  const [userHasMore, setUserHasMore] = useState(false);
  const [userNextCursor, setUserNextCursor] = useState<string | null>(null);
  const [userTotal, setUserTotal] = useState(0);
  const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [adminTab, setAdminTab] = useState("users");
  const [enterpriseOrgs, setEnterpriseOrgs] = useState<EnterpriseOrg[]>([]);
  const [enterpriseLoading, setEnterpriseLoading] = useState(false);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>("all");
  const [auditOrgFilter, setAuditOrgFilter] = useState<string>("all");
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [ssoConfigs, setSsoConfigs] = useState<SsoConfig[]>([]);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoStats, setSsoStats] = useState<{
    totalConfigs: number;
    enabledConfigs: number;
    byMethod: Record<string, number>;
    byProvider: Record<string, number>;
  } | null>(null);
  const [showOnboardForm, setShowOnboardForm] = useState(false);
  const [showTrialForm, setShowTrialForm] = useState(false);
  const [onboardResult, setOnboardResult] = useState<{
    orgId: string;
    apiKey: string;
    adminLicenseToken: string;
    companyName: string;
  } | null>(null);
  const [onboardForm, setOnboardForm] = useState({
    companyName: "",
    adminEmail: "",
    contactName: "",
    seats: "10",
    contractValue: "",
    contractPeriodMonths: "12",
    notes: "",
  });
  const [trialForm, setTrialForm] = useState({
    companyName: "",
    adminEmail: "",
    contactName: "",
    seatCount: "5",
  });
  const [addSeatEmail, setAddSeatEmail] = useState<string>("");
  const [addSeatOrgId, setAddSeatOrgId] = useState<string | null>(null);
  const [showSsoForm, setShowSsoForm] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null,
  );
  const [ssoForm, setSsoForm] = useState<{
    orgId: string;
    displayName: string;
    method: "saml" | "oidc";
    providerType: string;
    domain: string;
    enabled: boolean;
    samlEntryPoint: string;
    samlCert: string;
    samlIssuer: string;
    oidcClientId: string;
    oidcClientSecret: string;
    oidcIssuer: string;
  }>({
    orgId: "",
    displayName: "",
    method: "oidc",
    providerType: "okta",
    domain: "",
    enabled: true,
    samlEntryPoint: "",
    samlCert: "",
    samlIssuer: "",
    oidcClientId: "",
    oidcClientSecret: "",
    oidcIssuer: "",
  });

  // ─── License Generation State ─────────────────────────────────────
  const [licenseForm, setLicenseForm] = useState({
    email: "",
    tier: "enterprise" as "enterprise" | "team_pro" | "developer" | "pro",
    days: "365",
  });
  const [licenseGenerating, setLicenseGenerating] = useState(false);
  const [licenseResult, setLicenseResult] = useState<{
    token: string;
    tier: string;
    emailSent: boolean;
  } | null>(null);
  const [licenseCopied, setLicenseCopied] = useState(false);

  // ─── License Revocation State ─────────────────────────────────────
  const [revokeForm, setRevokeForm] = useState({
    token: "",
    email: "",
    reason: "",
    password: "",
  });
  const [revoking, setRevoking] = useState(false);
  const [revokeResult, setRevokeResult] = useState<{
    revokedCount: number;
    revoked: Array<{ token?: string; email?: string; jti?: string }>;
  } | null>(null);

  // ─── User Management Action State ─────────────────────────────────
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [actionDialog, setActionDialog] = useState<
    null | "suspend" | "unsuspend" | "delete" | "upgrade"
  >(null);
  const [actionPassword, setActionPassword] = useState("");
  const [actionTier, setActionTier] = useState("bronze");
  const [actionConfirmEmail, setActionConfirmEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Billing State ────────────────────────────────────────────────
  const [billingData, setBillingData] = useState<{
    subscriptions: Array<{
      id: number;
      email: string;
      stripeSubscriptionId: string | null;
      stripePriceId: string | null;
      status: string;
      tier: string;
      amountCents: number;
      isAnnual: boolean;
      periodStart: string | null;
      periodEnd: string | null;
      createdAt: string;
    }>;
    revenue: {
      totalCents: number;
      activeCents: number;
      monthlyRecurringCents: number;
      activeCount: number;
      totalCount: number;
    };
  } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const fetchSsoConfigs = useCallback(async () => {
    setSsoLoading(true);
    try {
      const [configsRes, statsRes] = await Promise.allSettled([
        fetch(enterpriseUrl("/enterprise/sso/configs"), {
          headers: authHeaders(),
        }),
        fetch(enterpriseUrl("/enterprise/sso/stats"), {
          headers: authHeaders(),
        }),
      ]);
      if (configsRes.status === "fulfilled" && configsRes.value.ok) {
        const data = await configsRes.value.json();
        setSsoConfigs(data.configs || []);
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setSsoStats({
          totalConfigs: data.totalConfigs,
          enabledConfigs: data.enabledConfigs,
          byMethod: data.byMethod,
          byProvider: data.byProvider,
        });
      }
    } catch {
      // SSO API may not be available
    } finally {
      setSsoLoading(false);
    }
  }, []);

  const saveSsoConfig = useCallback(async () => {
    try {
      const body: Record<string, unknown> = {
        orgId: ssoForm.orgId,
        displayName: ssoForm.displayName,
        method: ssoForm.method,
        providerType: ssoForm.providerType,
        domain: ssoForm.domain,
        enabled: ssoForm.enabled,
      };
      if (ssoForm.method === "saml") {
        body.saml = {
          entryPoint: ssoForm.samlEntryPoint,
          cert: ssoForm.samlCert,
          issuer: ssoForm.samlIssuer || undefined,
        };
      } else {
        body.oidc = {
          clientId: ssoForm.oidcClientId,
          clientSecret: ssoForm.oidcClientSecret,
          issuer: ssoForm.oidcIssuer,
        };
      }
      const isEditing = !!editingProviderId;
      const url = isEditing
        ? enterpriseUrl(`/enterprise/sso/configs/${editingProviderId}`)
        : enterpriseUrl("/enterprise/sso/configs");
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(
          isEditing ? "SSO configuration updated" : "SSO configuration saved",
        );
        setShowSsoForm(false);
        setEditingProviderId(null);
        fetchSsoConfigs();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save SSO config");
      }
    } catch {
      toast.error("Failed to save SSO config");
    }
  }, [ssoForm, editingProviderId, fetchSsoConfigs]);

  const editSsoConfig = useCallback((config: SsoConfig) => {
    setEditingProviderId(config.providerId);
    setSsoForm({
      orgId: config.orgId,
      displayName: config.displayName,
      method: config.method,
      providerType: config.providerType,
      domain: config.domain,
      enabled: config.enabled,
      samlEntryPoint: config.saml?.entryPoint || "",
      samlCert: config.saml?.cert || "",
      samlIssuer: config.saml?.issuer || "",
      oidcClientId: config.oidc?.clientId || "",
      oidcClientSecret: "",
      oidcIssuer: config.oidc?.issuer || "",
    });
    setShowSsoForm(true);
  }, []);

  const resetSsoForm = useCallback(() => {
    setEditingProviderId(null);
    setSsoForm({
      orgId: "",
      displayName: "",
      method: "oidc",
      providerType: "okta",
      domain: "",
      enabled: true,
      samlEntryPoint: "",
      samlCert: "",
      samlIssuer: "",
      oidcClientId: "",
      oidcClientSecret: "",
      oidcIssuer: "",
    });
  }, []);

  const deleteSsoConfig = useCallback(
    async (providerId: string) => {
      try {
        const res = await fetch(
          enterpriseUrl(`/enterprise/sso/configs/${providerId}`),
          {
            method: "DELETE",
            headers: authHeaders(),
          },
        );
        if (res.ok) {
          toast.success("SSO configuration deleted");
          fetchSsoConfigs();
        }
      } catch {
        toast.error("Failed to delete SSO config");
      }
    },
    [fetchSsoConfigs],
  );

  const testSsoConfig = useCallback(async (providerId: string) => {
    try {
      const res = await fetch(
        enterpriseUrl(`/enterprise/sso/test/${providerId}`),
        { headers: authHeaders() },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.overall === "pass") {
          toast.success(`SSO config validation passed — all checks green`);
        } else {
          toast.warning(
            `SSO config needs attention — ${data.checks.filter((c: { status: string }) => c.status !== "pass").length} issues found`,
          );
        }
      }
    } catch {
      toast.error("Failed to test SSO config");
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (auditFilter !== "all") params.set("action", auditFilter);
      if (auditOrgFilter !== "all") params.set("orgId", auditOrgFilter);
      const [entriesRes, statsRes, verifyRes] = await Promise.allSettled([
        fetch(enterpriseUrl(`/enterprise/audit?${params}`), {
          headers: authHeaders(),
        }),
        fetch(enterpriseUrl("/enterprise/audit/stats"), {
          headers: authHeaders(),
        }),
        fetch(enterpriseUrl("/enterprise/audit/verify"), {
          headers: authHeaders(),
        }),
      ]);
      if (entriesRes.status === "fulfilled" && entriesRes.value.ok) {
        const data = await entriesRes.value.json();
        setAuditEntries(data.entries || []);
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setAuditStats({
          totalEntries: data.totalEntries,
          actionCounts: data.actionCounts,
          orgCounts: data.orgCounts,
          last24h: data.last24h,
        });
      }
      if (verifyRes.status === "fulfilled" && verifyRes.value.ok) {
        const data = await verifyRes.value.json();
        setChainValid(data.valid);
      }
    } catch {
      // Audit API may not be available
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilter, auditOrgFilter]);

  const enterpriseErrorRef = useRef(false);
  const lastLocationRef = useRef<{ search: string; hash: string }>({
    search: "",
    hash: "",
  });

  // ─── License Revocation ───────────────────────────────────────────
  const handleRevokeLicense = async () => {
    if (!revokeForm.password) {
      toast.error("Admin password required");
      return;
    }
    if (!revokeForm.token && !revokeForm.email) {
      toast.error("Provide a token or email to revoke");
      return;
    }
    setRevoking(true);
    setRevokeResult(null);
    try {
      const res = await fetch(apiUrl("/admin/licenses/revoke"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          token: revokeForm.token || undefined,
          email: revokeForm.email || undefined,
          reason: revokeForm.reason || undefined,
          password: revokeForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Revoke failed");
      }
      setRevokeResult(data);
      toast.success(`Revoked ${data.revokedCount} license token(s)`);
      setRevokeForm({ token: "", email: "", reason: "", password: "" });
    } catch (err: any) {
      toast.error(err.message || "Revoke failed");
    } finally {
      setRevoking(false);
    }
  };

  // ─── License Generation ───────────────────────────────────────────
  const handleGenerateLicense = async () => {
    if (!licenseForm.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setLicenseGenerating(true);
    setLicenseResult(null);
    setLicenseCopied(false);
    try {
      const res = await fetch(apiUrl("/admin/generate-license"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          email: licenseForm.email,
          tier: licenseForm.tier,
          days: Number(licenseForm.days) || 365,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to generate license");
      }
      setLicenseResult({
        token: data.token,
        tier: data.tier,
        emailSent: data.emailSent,
      });
      toast.success(`${licenseForm.tier} license generated and emailed to ${licenseForm.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate license");
    } finally {
      setLicenseGenerating(false);
    }
  };

  // ─── User Management Actions ──────────────────────────────────────
  const handleUserAction = async () => {
    if (!actionUser) return;
    if (!actionPassword && actionDialog !== "unsuspend") {
      toast.error("Admin password required");
      return;
    }
    if (actionDialog === "delete" && actionConfirmEmail !== actionUser.email) {
      toast.error("Email confirmation does not match");
      return;
    }
    setActionLoading(true);
    try {
      const base = apiUrl("/admin");
      const headers = { "Content-Type": "application/json", ...authHeaders() };
      let res: Response;
      if (actionDialog === "suspend") {
        res = await fetch(`${base}/users/${actionUser.id}/suspend`, {
          method: "POST", headers,
          body: JSON.stringify({ password: actionPassword }),
        });
      } else if (actionDialog === "unsuspend") {
        res = await fetch(`${base}/users/${actionUser.id}/unsuspend`, {
          method: "POST", headers,
        });
      } else if (actionDialog === "delete") {
        res = await fetch(`${base}/users/${actionUser.id}`, {
          method: "DELETE", headers,
          body: JSON.stringify({ password: actionPassword, confirmEmail: actionConfirmEmail }),
        });
      } else if (actionDialog === "upgrade") {
        res = await fetch(`${base}/users/${actionUser.id}/trust-level`, {
          method: "POST", headers,
          body: JSON.stringify({
            password: actionPassword,
            trustLevel: actionTier,
            subscriptionTier: actionTier === "bronze" ? "community" : actionTier === "silver" ? "developer" : "team_pro",
          }),
        });
      } else {
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Action failed");
      toast.success(`User ${actionDialog} successful`);
      setActionDialog(null);
      setActionPassword("");
      setActionConfirmEmail("");
      setActionUser(null);
      // Refresh user list
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Fetch Billing ────────────────────────────────────────────────
  const fetchBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const res = await fetch(apiUrl("/admin/billing/subscriptions"), {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setBillingData(data);
      }
    } catch {
      /* ignore */
    } finally {
      setBillingLoading(false);
    }
  }, []);

  const fetchEnterpriseOrgs = useCallback(async () => {
    if (enterpriseErrorRef.current) return;
    setEnterpriseLoading(true);
    try {
      const res = await fetch(enterpriseUrl("/enterprise/organizations"), {
        headers: authHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          enterpriseErrorRef.current = true;
        }
        return;
      }
      const data = await res.json();
      setEnterpriseOrgs(data.organizations || []);
    } catch {
      // Enterprise API may not be available in all deployments
    } finally {
      setEnterpriseLoading(false);
    }
  }, []);

  const submitOnboard = useCallback(async () => {
    try {
      const body: Record<string, unknown> = {
        companyName: onboardForm.companyName,
        adminEmail: onboardForm.adminEmail,
        contactName: onboardForm.contactName || undefined,
        seats: parseInt(onboardForm.seats, 10) || 10,
        contractValue: onboardForm.contractValue
          ? parseInt(onboardForm.contractValue, 10)
          : undefined,
        contractPeriodMonths:
          parseInt(onboardForm.contractPeriodMonths, 10) || 12,
        notes: onboardForm.notes || undefined,
      };
      const res = await fetch(enterpriseUrl("/enterprise/onboard"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setOnboardResult({
          orgId: data.orgId,
          apiKey: data.apiKey,
          adminLicenseToken: data.adminLicenseToken,
          companyName: data.companyName,
        });
        toast.success(`Organization onboarded: ${data.companyName}`);
        setShowOnboardForm(false);
        enterpriseErrorRef.current = false;
        fetchEnterpriseOrgs();
      } else {
        const err = await res.json();
        toast.error(err.error || err.message || "Onboarding failed");
      }
    } catch {
      toast.error("Failed to submit onboarding request");
    }
  }, [onboardForm, fetchEnterpriseOrgs]);

  const submitTrial = useCallback(async () => {
    try {
      const body: Record<string, unknown> = {
        companyName: trialForm.companyName,
        adminEmail: trialForm.adminEmail,
        contactName: trialForm.contactName || undefined,
        seatCount: parseInt(trialForm.seatCount, 10) || 5,
      };
      const res = await fetch(enterpriseUrl("/enterprise/trial"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setOnboardResult({
          orgId: data.orgId,
          apiKey: data.apiKey,
          adminLicenseToken: data.adminLicenseToken,
          companyName: data.companyName,
        });
        toast.success(`Trial started for ${data.companyName} — 30 days`);
        setShowTrialForm(false);
        fetchEnterpriseOrgs();
      } else {
        const err = await res.json();
        toast.error(err.error || err.message || "Trial provisioning failed");
      }
    } catch {
      toast.error("Failed to submit trial request");
    }
  }, [trialForm, fetchEnterpriseOrgs]);

  const addSeat = useCallback(
    async (orgId: string, email: string) => {
      try {
        const res = await fetch(
          enterpriseUrl(`/enterprise/organizations/${orgId}/seats`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ email }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          toast.success(`Seat provisioned for ${data.email}`);
          setAddSeatEmail("");
          setAddSeatOrgId(null);
          fetchEnterpriseOrgs();
        } else {
          const err = await res.json();
          toast.error(err.error || err.message || "Failed to add seat");
        }
      } catch {
        toast.error("Failed to add seat");
      }
    },
    [fetchEnterpriseOrgs],
  );

  const removeSeat = useCallback(
    async (orgId: string, email: string) => {
      try {
        const res = await fetch(
          enterpriseUrl(
            `/enterprise/organizations/${orgId}/seats/${encodeURIComponent(email)}`,
          ),
          {
            method: "DELETE",
            headers: authHeaders(),
          },
        );
        if (res.ok) {
          toast.success(`Seat revoked for ${email}`);
          fetchEnterpriseOrgs();
        } else {
          const err = await res.json();
          toast.error(err.error || err.message || "Failed to remove seat");
        }
      } catch {
        toast.error("Failed to remove seat");
      }
    },
    [fetchEnterpriseOrgs],
  );

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copied to clipboard`);
      })
      .catch(() => {
        toast.error("Failed to copy");
      });
  }, []);

  // ─── User Search + Pagination ─────────────────────────────────────
  const fetchUsers = useCallback(
    async (opts?: { search?: string; cursor?: string | null; append?: boolean }) => {
      const search = opts?.search ?? userSearch;
      const cursor = opts?.cursor ?? null;
      const append = opts?.append ?? false;
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (search) params.set("q", search);
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(apiUrl(`/admin/users?${params.toString()}`), {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.users) {
          setUsers((prev) => (append ? [...prev, ...data.users] : data.users));
          setUserHasMore(!!data.hasMore);
          setUserNextCursor(data.nextCursor || null);
          setUserTotal(data.total || data.users.length);
        }
      } catch {
        // ignore — non-critical
      }
    },
    [userSearch],
  );

  // Debounced search trigger
  useEffect(() => {
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current);
    userSearchTimer.current = setTimeout(() => {
      setUserPage(0);
      fetchUsers({ search: userSearch, cursor: null, append: false });
    }, 300);
    return () => {
      if (userSearchTimer.current) clearTimeout(userSearchTimer.current);
    };
  }, [userSearch, fetchUsers]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const statsResp = await Promise.allSettled([
        fetch(apiUrl("/admin/stats"), {
          headers: authHeaders(),
          signal: controller.signal,
        }),
      ]);
      clearTimeout(timeout);

      if (statsResp.status === "fulfilled") {
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

      if (statsResp.status === "rejected") {
        throw new Error("Failed to fetch admin data");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchEnterpriseOrgs();
  }, [fetchData, fetchEnterpriseOrgs]);

  // If the route hash includes a `tab` query (e.g. #/admin?tab=analytics), honor it.
  useEffect(() => {
    function applyTabFromLocation() {
      try {
        // Prefer search params (path-based routing)
        const search = window.location.search || "";
        const sParams = new URLSearchParams(search);
        const t1 = sParams.get("tab");
        // Fallback to hash query
        const hash = window.location.hash.slice(1) || "";
        const parts = hash.split("?");
        const qs = parts[1] || "";
        const params = new URLSearchParams(qs);
        const t = params.get("tab");

        // Only log when the observed location actually changes to avoid noisy repeat logs
        const prev = lastLocationRef.current;
        if (search !== prev.search || hash !== prev.hash) {
          lastLocationRef.current = { search, hash };
        }

        if (t1 && t1 !== adminTab) {
          setAdminTab(t1);
          return;
        }
        if (t && t !== adminTab) setAdminTab(t);
      } catch (e) {
        /* ignore */
      }
    }
    applyTabFromLocation();
    window.addEventListener("hashchange", applyTabFromLocation);
    window.addEventListener("popstate", applyTabFromLocation);
    return () => {
      window.removeEventListener("hashchange", applyTabFromLocation);
      window.removeEventListener("popstate", applyTabFromLocation);
    };
  }, [adminTab]);

  useEffect(() => {
    if (adminTab === "audit") fetchAuditLogs();
    if (adminTab === "billing") fetchBilling();
  }, [adminTab, fetchAuditLogs, fetchBilling]);

  useEffect(() => {
    if (adminTab === "sso") fetchSsoConfigs();
  }, [adminTab, fetchSsoConfigs]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-foreground-muted">
            User management and system administration
          </p>
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
          <p className="text-foreground-muted">
            User management and system administration
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Shield className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">
              Admin access required. Sign in with an admin account.
            </p>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => navigate("signin")}>Sign In</Button>
              <Button variant="ghost" onClick={() => navigate("dashboard")}>
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
          <p className="text-foreground-muted">
            User management and system administration
          </p>
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
    const t = (tier || "bronze").toLowerCase();
    if (t === "gold") return { variant: "warning" as const, icon: Crown };
    if (t === "silver") return { variant: "outline" as const, icon: Shield };
    return { variant: "secondary" as const, icon: UserCircle };
  };

  // Enterprise KPIs
  const totalOrgs = enterpriseOrgs.length;
  const totalSeats = enterpriseOrgs.reduce((sum, o) => sum + o.seatCount, 0);
  const usedSeats = enterpriseOrgs.reduce((sum, o) => sum + o.seatsUsed, 0);
  const trialOrgs = enterpriseOrgs.filter((o) => o.trial);
  const activeOrgs = enterpriseOrgs.filter((o) => !o.trial);
  const totalContractValue = enterpriseOrgs.reduce(
    (sum, o) => sum + (o.contractValue || 0),
    0,
  );
  const expiringTrials = trialOrgs.filter(
    (o) => o.trialExpiresAt && daysUntil(o.trialExpiresAt) <= 7,
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-foreground-muted">
          User management, enterprise tenants, and system administration
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            className="w-fit"
          >
            <RefreshCw className="h-4 w-4" /> Refresh Users
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchEnterpriseOrgs}
            className="w-fit"
          >
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
              <span className="text-lg font-bold">
                {stats.totalAccounts ?? "—"}
              </span>
              <span className="text-xs text-foreground-muted">
                Total Accounts
              </span>
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
              <span className="text-lg font-bold">
                {stats.activeSessions ?? 0}
              </span>
              <span className="text-xs text-foreground-muted">
                Active Sessions
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Crown className="h-6 w-6 text-yellow-500" />
              <span className="text-lg font-bold">
                {stats.activeSubscriptions ?? 0}
              </span>
              <span className="text-xs text-foreground-muted">
                Subscriptions
              </span>
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
              <span className="text-xs text-foreground-muted">
                Enterprise Tenants
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Server className="h-6 w-6 text-blue-500" />
              <span className="text-lg font-bold">
                {usedSeats}/{totalSeats}
              </span>
              <span className="text-xs text-foreground-muted">
                Seats Provisioned
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <DollarSign className="h-6 w-6 text-green-500" />
              <span className="text-lg font-bold">
                ${totalContractValue.toLocaleString()}
              </span>
              <span className="text-xs text-foreground-muted">
                Contract Value
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Clock
                className={`h-6 w-6 ${expiringTrials.length > 0 ? "text-amber-500" : "text-foreground-muted"}`}
              />
              <span className="text-lg font-bold">{trialOrgs.length}</span>
              <span className="text-xs text-foreground-muted">
                Active Trials
              </span>
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
                  {expiringTrials.length} trial
                  {expiringTrials.length !== 1 ? "s" : ""} expiring within 7
                  days
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {expiringTrials.map((o) => o.companyName).join(", ")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAdminTab("tenants")}
              >
                View Tenants <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="licenses">Licenses</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="tenants">Enterprise Tenants</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="sso">SSO</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="whitelabel">Whitelabel</TabsTrigger>
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
                    <div
                      key={tier}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium capitalize">
                        {tier}
                      </span>
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
                  <div
                    key={status}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    {status === "active" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Ban className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {status}
                    </span>
                    <Badge variant={status === "active" ? "success" : "danger"}>
                      {count}
                    </Badge>
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
              <CardDescription>
                {userTotal > 0 ? `${userTotal} total` : "Recent registered users"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search + Load More */}
              <div className="flex items-center gap-2 mb-4">
                <Input
                  type="text"
                  placeholder="Search by email or name…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="max-w-xs"
                />
                {userSearch && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setUserSearch("")}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {users.length === 0 ? (
                <p className="text-sm text-foreground-muted text-center py-4">
                  No users found
                </p>
              ) : (
                <div className="space-y-2">
                  {users.map((user, i) => {
                    const { variant, icon: Icon } = tierBadge(user.trustLevel);
                    return (
                      <div
                        key={user.id || i}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {user.name || user.email || "Unknown"}
                            </span>
                            {user.online && (
                              <span
                                className="h-2 w-2 rounded-full bg-green-500 shrink-0"
                                title="Online"
                              />
                            )}
                          </div>
                          <span className="text-xs text-foreground-muted truncate block">
                            {user.email || "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={variant}
                            className="text-xs capitalize"
                          >
                            {user.trustLevel || "bronze"}
                          </Badge>
                          <Badge
                            variant={
                              user.status === "active" ? "success" : "danger"
                            }
                            className="text-xs capitalize"
                          >
                            {user.status || "active"}
                          </Badge>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setActionUser(user);
                                setActionTier(user.trustLevel || "bronze");
                                setActionDialog("upgrade");
                                setActionPassword("");
                              }}
                              title="Upgrade tier"
                            >
                              <Crown className="h-3 w-3" />
                            </Button>
                            {user.status === "active" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-orange-600"
                                onClick={() => {
                                  setActionUser(user);
                                  setActionDialog("suspend");
                                  setActionPassword("");
                                }}
                                title="Suspend user"
                              >
                                <Ban className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-green-600"
                                onClick={() => {
                                  setActionUser(user);
                                  setActionDialog("unsuspend");
                                }}
                                title="Unsuspend user"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600"
                              onClick={() => {
                                setActionUser(user);
                                setActionDialog("delete");
                                setActionPassword("");
                                setActionConfirmEmail("");
                              }}
                              title="Delete user"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Load More */}
              {userHasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = userPage + 1;
                      setUserPage(next);
                      fetchUsers({ search: userSearch, cursor: userNextCursor, append: true });
                    }}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Action Dialog */}
          {actionUser && actionDialog && (
            <Card className="border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {actionDialog === "suspend" && <Ban className="h-4 w-4 text-orange-600" />}
                  {actionDialog === "unsuspend" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {actionDialog === "delete" && <Trash2 className="h-4 w-4 text-red-600" />}
                  {actionDialog === "upgrade" && <Crown className="h-4 w-4 text-amber-600" />}
                  {actionDialog === "suspend" && "Suspend User"}
                  {actionDialog === "unsuspend" && "Unsuspend User"}
                  {actionDialog === "delete" && "Delete User"}
                  {actionDialog === "upgrade" && "Upgrade User Tier"}
                </CardTitle>
                <CardDescription>
                  {actionUser.email} — current tier: {actionUser.trustLevel}, status: {actionUser.status}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {actionDialog === "upgrade" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">New Tier</label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={actionTier}
                      onChange={(e) => setActionTier(e.target.value)}
                    >
                      <option value="bronze">Bronze (Free)</option>
                      <option value="silver">Silver (Developer)</option>
                      <option value="gold">Gold (Team Pro)</option>
                    </select>
                  </div>
                )}
                {actionDialog === "delete" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Type <code className="font-mono">{actionUser.email}</code> to confirm deletion
                    </label>
                    <Input
                      type="text"
                      placeholder={actionUser.email}
                      value={actionConfirmEmail}
                      onChange={(e) => setActionConfirmEmail(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                )}
                {actionDialog !== "unsuspend" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Admin Password</label>
                    <Input
                      type="password"
                      placeholder="Enter your admin password"
                      value={actionPassword}
                      onChange={(e) => setActionPassword(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant={actionDialog === "delete" ? "destructive" : "default"}
                    onClick={handleUserAction}
                    disabled={actionLoading || (actionDialog !== "unsuspend" && !actionPassword)}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : actionDialog === "delete" ? (
                      <Trash2 className="h-4 w-4" />
                    ) : actionDialog === "suspend" ? (
                      <Ban className="h-4 w-4" />
                    ) : actionDialog === "upgrade" ? (
                      <Crown className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {actionDialog === "suspend" && "Suspend"}
                    {actionDialog === "unsuspend" && "Unsuspend"}
                    {actionDialog === "delete" && "Delete Permanently"}
                    {actionDialog === "upgrade" && "Upgrade"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionDialog(null);
                      setActionUser(null);
                      setActionPassword("");
                      setActionConfirmEmail("");
                    }}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Licenses Tab */}
        <TabsContent value="licenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                Generate License Token
              </CardTitle>
              <CardDescription>
                Create a new license token for a customer and email it directly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer Email</label>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={licenseForm.email}
                    onChange={(e) => setLicenseForm({ ...licenseForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tier</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={licenseForm.tier}
                    onChange={(e) => setLicenseForm({ ...licenseForm, tier: e.target.value as any })}
                  >
                    <option value="enterprise">Enterprise ($499/mo)</option>
                    <option value="team_pro">Team Pro ($149/mo)</option>
                    <option value="developer">Developer ($49/mo)</option>
                    <option value="pro">Legacy Pro ($9/mo)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Validity (days)</label>
                  <Input
                    type="number"
                    placeholder="365"
                    value={licenseForm.days}
                    onChange={(e) => setLicenseForm({ ...licenseForm, days: e.target.value })}
                  />
                </div>
              </div>
              <Button
                onClick={handleGenerateLicense}
                disabled={licenseGenerating || !licenseForm.email.trim()}
              >
                {licenseGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                Generate & Email License
              </Button>

              {licenseResult && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    License generated successfully
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tier: <Badge variant="default" className="ml-1 capitalize">{licenseResult.tier}</Badge>
                    {" — "}Email sent: {licenseResult.emailSent ? "Yes" : "No"}
                  </div>
                  <div className="rounded-md bg-muted p-3 font-mono text-xs break-all max-h-32 overflow-y-auto">
                    {licenseResult.token}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(licenseResult.token);
                        setLicenseCopied(true);
                        setTimeout(() => setLicenseCopied(false), 2000);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {licenseCopied ? "Copied!" : "Copy Token"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* License Revocation */}
          <Card className="border-red-500/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <Ban className="h-4 w-4" />
                Revoke License Token
              </CardTitle>
              <CardDescription>
                Invalidate a license token by token string or email (revokes all tokens for that email)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Token (paste full token)</label>
                  <Input
                    type="text"
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                    value={revokeForm.token}
                    onChange={(e) => setRevokeForm({ ...revokeForm, token: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">OR Email (revokes all tokens)</label>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={revokeForm.email}
                    onChange={(e) => setRevokeForm({ ...revokeForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Reason (optional)</label>
                  <Input
                    type="text"
                    placeholder="Exposed in URL, customer refund, etc."
                    value={revokeForm.reason}
                    onChange={(e) => setRevokeForm({ ...revokeForm, reason: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Admin Password</label>
                  <Input
                    type="password"
                    placeholder="Enter your admin password"
                    value={revokeForm.password}
                    onChange={(e) => setRevokeForm({ ...revokeForm, password: e.target.value })}
                  />
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={handleRevokeLicense}
                disabled={revoking || !revokeForm.password || (!revokeForm.token && !revokeForm.email)}
              >
                {revoking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                Revoke License
              </Button>

              {revokeResult && (
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Revoked {revokeResult.revokedCount} token(s)
                  </div>
                  {revokeResult.revoked.map((r, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      {r.email} — {r.token || r.jti}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          {billingLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading billing data…
              </CardContent>
            </Card>
          ) : billingData ? (
            <>
              {/* Revenue Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Monthly Recurring</CardDescription>
                    <CardTitle className="text-2xl">
                      ${(billingData.revenue.monthlyRecurringCents / 100).toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Active Revenue</CardDescription>
                    <CardTitle className="text-2xl">
                      ${(billingData.revenue.activeCents / 100).toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Active Subs</CardDescription>
                    <CardTitle className="text-2xl">
                      {billingData.revenue.activeCount}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Subs</CardDescription>
                    <CardTitle className="text-2xl">
                      {billingData.revenue.totalCount}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Subscription List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Subscriptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {billingData.subscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No paid subscriptions found
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {billingData.subscriptions.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <DollarSign className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {sub.email}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {sub.stripeSubscriptionId || "No Stripe ID"}
                              {sub.periodEnd && ` — renews ${formatDate(sub.periodEnd)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="default" className="text-xs capitalize">
                              {sub.tier}
                            </Badge>
                            <Badge
                              variant={sub.status === "active" ? "success" : "danger"}
                              className="text-xs capitalize"
                            >
                              {sub.status}
                            </Badge>
                            <span className="text-xs font-medium">
                              ${(sub.amountCents / 100).toFixed(2)}
                              {sub.isAnnual ? "/yr" : "/mo"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No billing data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Enterprise Tenants Tab */}
        <TabsContent value="tenants" className="space-y-4">
          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowTrialForm(!showTrialForm);
                setShowOnboardForm(false);
                setOnboardResult(null);
              }}
            >
              <Clock className="h-4 w-4" /> Start Trial
            </Button>
            <Button
              onClick={() => {
                setShowOnboardForm(!showOnboardForm);
                setShowTrialForm(false);
                setOnboardResult(null);
              }}
            >
              <Plus className="h-4 w-4" /> Onboard Organization
            </Button>
          </div>

          {/* Onboarding Result Display */}
          {onboardResult && (
            <Card className="border-green-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-green-600">
                  <CheckCircle2 className="h-5 w-5" /> Organization Provisioned
                  Successfully
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Organization ID
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono flex-1">
                        {onboardResult.orgId}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copyToClipboard(onboardResult.orgId, "Org ID")
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Company
                    </span>
                    <p className="text-sm font-medium">
                      {onboardResult.companyName}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 space-y-1">
                    <span className="text-xs text-muted-foreground">
                      API Key
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono flex-1 truncate">
                        {onboardResult.apiKey}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copyToClipboard(onboardResult.apiKey, "API Key")
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Admin License Token
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono flex-1 truncate">
                        {onboardResult.adminLicenseToken}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copyToClipboard(
                            onboardResult.adminLicenseToken,
                            "License Token",
                          )
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOnboardResult(null)}
                >
                  <X className="h-3.5 w-3.5" /> Dismiss
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Onboarding Form */}
          {showOnboardForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Onboard New Enterprise Organization
                </CardTitle>
                <CardDescription>
                  Provision a new enterprise tenant with seat pool and API
                  access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={onboardForm.companyName}
                      onChange={(e) =>
                        setOnboardForm({
                          ...onboardForm,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="Acme Corporation"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Admin Email *</label>
                    <input
                      type="email"
                      value={onboardForm.adminEmail}
                      onChange={(e) =>
                        setOnboardForm({
                          ...onboardForm,
                          adminEmail: e.target.value,
                        })
                      }
                      placeholder="admin@acme.com"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Contact Name</label>
                    <input
                      type="text"
                      value={onboardForm.contactName}
                      onChange={(e) =>
                        setOnboardForm({
                          ...onboardForm,
                          contactName: e.target.value,
                        })
                      }
                      placeholder="John Smith"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Seat Count</label>
                    <input
                      type="number"
                      value={onboardForm.seats}
                      onChange={(e) =>
                        setOnboardForm({
                          ...onboardForm,
                          seats: e.target.value,
                        })
                      }
                      min="1"
                      max="500"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Contract Value ($)
                    </label>
                    <input
                      type="number"
                      value={onboardForm.contractValue}
                      onChange={(e) =>
                        setOnboardForm({
                          ...onboardForm,
                          contractValue: e.target.value,
                        })
                      }
                      placeholder="25000"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Contract Period (months)
                    </label>
                    <input
                      type="number"
                      value={onboardForm.contractPeriodMonths}
                      onChange={(e) =>
                        setOnboardForm({
                          ...onboardForm,
                          contractPeriodMonths: e.target.value,
                        })
                      }
                      min="1"
                      max="36"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={onboardForm.notes}
                    onChange={(e) =>
                      setOnboardForm({ ...onboardForm, notes: e.target.value })
                    }
                    placeholder="Internal notes about this customer…"
                    rows={2}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowOnboardForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={submitOnboard}
                    disabled={
                      !onboardForm.companyName || !onboardForm.adminEmail
                    }
                  >
                    <Building2 className="h-4 w-4" /> Provision Organization
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trial Form */}
          {showTrialForm && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-amber-500" /> Start Enterprise
                  Trial
                </CardTitle>
                <CardDescription>
                  30-day evaluation with up to 10 seats — no contract required
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={trialForm.companyName}
                      onChange={(e) =>
                        setTrialForm({
                          ...trialForm,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="Acme Corporation"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Admin Email *</label>
                    <input
                      type="email"
                      value={trialForm.adminEmail}
                      onChange={(e) =>
                        setTrialForm({
                          ...trialForm,
                          adminEmail: e.target.value,
                        })
                      }
                      placeholder="admin@acme.com"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Contact Name</label>
                    <input
                      type="text"
                      value={trialForm.contactName}
                      onChange={(e) =>
                        setTrialForm({
                          ...trialForm,
                          contactName: e.target.value,
                        })
                      }
                      placeholder="John Smith"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Seat Count (max 10)
                    </label>
                    <input
                      type="number"
                      value={trialForm.seatCount}
                      onChange={(e) =>
                        setTrialForm({
                          ...trialForm,
                          seatCount: e.target.value,
                        })
                      }
                      min="1"
                      max="10"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowTrialForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={submitTrial}
                    disabled={!trialForm.companyName || !trialForm.adminEmail}
                  >
                    <Clock className="h-4 w-4" /> Start 30-Day Trial
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {enterpriseLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
                <p className="text-sm text-foreground-muted">
                  Loading enterprise tenants…
                </p>
              </CardContent>
            </Card>
          ) : totalOrgs === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold">
                    No Enterprise Tenants
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    Provision enterprise organizations from the Enterprise
                    panel.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("enterprise")}
                >
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
                          expandedOrg === org.orgId ? "ring-1 ring-primary" : ""
                        }`}
                        onClick={() =>
                          setExpandedOrg(
                            expandedOrg === org.orgId ? null : org.orgId,
                          )
                        }
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {org.companyName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {org.adminEmail}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {org.seatsUsed}/{org.seatCount} seats
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {org.contractValue
                                  ? `$${org.contractValue.toLocaleString()}`
                                  : "Custom"}
                              </p>
                            </div>
                            <ChevronRight
                              className={`h-4 w-4 text-muted-foreground transition-transform ${expandedOrg === org.orgId ? "rotate-90" : ""}`}
                            />
                          </div>
                        </div>

                        {expandedOrg === org.orgId && (
                          <div className="mt-4 pt-4 border-t border-border space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground text-xs">
                                  Org ID
                                </span>
                                <p className="font-mono text-xs">{org.orgId}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">
                                  Created
                                </span>
                                <p className="font-medium">
                                  {formatDate(org.createdAt)}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">
                                  Expires
                                </span>
                                <p className="font-medium">
                                  {formatDate(org.expiresAt)}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">
                                  Contract
                                </span>
                                <p className="font-medium">
                                  {org.contractPeriodMonths} months
                                </p>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  Seat utilization
                                </span>
                                <span className="font-medium">
                                  {Math.round(
                                    (org.seatsUsed / org.seatCount) * 100,
                                  )}
                                  %
                                </span>
                              </div>
                              <Progress
                                value={(org.seatsUsed / org.seatCount) * 100}
                                indicatorClassName={
                                  org.seatsUsed >= org.seatCount
                                    ? "bg-destructive"
                                    : "bg-primary"
                                }
                              />
                            </div>

                            {org.provisionedEmails.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-xs">
                                  Provisioned Members
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {org.provisionedEmails.map((email, idx) => (
                                    <div
                                      key={email}
                                      className="flex items-center gap-1 rounded-md border px-2 py-1"
                                    >
                                      {idx === 0 && (
                                        <Crown className="h-3 w-3 text-amber-500" />
                                      )}
                                      <span className="text-xs">{email}</span>
                                      {idx !== 0 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeSeat(org.orgId, email);
                                          }}
                                          className="text-muted-foreground hover:text-destructive"
                                          title="Revoke seat"
                                          aria-label="Revoke seat"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {org.seatsUsed < org.seatCount && (
                              <div className="flex items-center gap-2 pt-1">
                                {addSeatOrgId === org.orgId ? (
                                  <>
                                    <input
                                      type="email"
                                      value={addSeatEmail}
                                      onChange={(e) =>
                                        setAddSeatEmail(e.target.value)
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="user@company.com"
                                      className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addSeat(org.orgId, addSeatEmail);
                                      }}
                                      disabled={!addSeatEmail}
                                    >
                                      <UserPlus className="h-3.5 w-3.5" /> Add
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAddSeatOrgId(null);
                                        setAddSeatEmail("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddSeatOrgId(org.orgId);
                                      setAddSeatEmail("");
                                    }}
                                  >
                                    <UserPlus className="h-3.5 w-3.5" /> Add
                                    Seat
                                  </Button>
                                )}
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("enterprise");
                                }}
                              >
                                <Building2 className="h-3.5 w-3.5" /> Manage in
                                Enterprise
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
                      const daysLeft = org.trialExpiresAt
                        ? daysUntil(org.trialExpiresAt)
                        : 0;
                      const isExpiring = daysLeft <= 7;
                      return (
                        <div
                          key={org.orgId}
                          className={`rounded-lg border p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                            expandedOrg === org.orgId
                              ? "ring-1 ring-primary"
                              : ""
                          } ${isExpiring ? "border-amber-300 dark:border-amber-800" : ""}`}
                          onClick={() =>
                            setExpandedOrg(
                              expandedOrg === org.orgId ? null : org.orgId,
                            )
                          }
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                                <Clock className="h-5 w-5 text-amber-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {org.companyName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {org.adminEmail}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p
                                  className={`text-sm font-medium ${isExpiring ? "text-amber-600" : ""}`}
                                >
                                  {daysLeft} days left
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {org.seatsUsed}/{org.seatCount} seats
                                </p>
                              </div>
                              <ChevronRight
                                className={`h-4 w-4 text-muted-foreground transition-transform ${expandedOrg === org.orgId ? "rotate-90" : ""}`}
                              />
                            </div>
                          </div>

                          {expandedOrg === org.orgId && (
                            <div className="mt-4 pt-4 border-t border-border space-y-3">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    Trial progress
                                  </span>
                                  <span className="font-medium">
                                    {daysLeft}/30 days remaining
                                  </span>
                                </div>
                                <Progress
                                  value={(daysLeft / 30) * 100}
                                  indicatorClassName={
                                    isExpiring ? "bg-amber-500" : "bg-primary"
                                  }
                                />
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground text-xs">
                                    Trial Started
                                  </span>
                                  <p className="font-medium">
                                    {org.trialStartedAt
                                      ? formatDate(org.trialStartedAt)
                                      : "—"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">
                                    Trial Expires
                                  </span>
                                  <p className="font-medium">
                                    {org.trialExpiresAt
                                      ? formatDate(org.trialExpiresAt)
                                      : "—"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">
                                    Seats
                                  </span>
                                  <p className="font-medium">
                                    {org.seatsUsed}/{org.seatCount}
                                  </p>
                                </div>
                              </div>

                              {org.provisionedEmails.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-muted-foreground text-xs">
                                    Provisioned Members
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {org.provisionedEmails.map((email, idx) => (
                                      <div
                                        key={email}
                                        className="flex items-center gap-1 rounded-md border px-2 py-1"
                                      >
                                        {idx === 0 && (
                                          <Crown className="h-3 w-3 text-amber-500" />
                                        )}
                                        <span className="text-xs">{email}</span>
                                        {idx !== 0 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeSeat(org.orgId, email);
                                            }}
                                            className="text-muted-foreground hover:text-destructive"
                                            title="Revoke seat"
                                            aria-label="Revoke seat"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {org.seatsUsed < org.seatCount && (
                                <div className="flex items-center gap-2 pt-1">
                                  {addSeatOrgId === org.orgId ? (
                                    <>
                                      <input
                                        type="email"
                                        value={addSeatEmail}
                                        onChange={(e) =>
                                          setAddSeatEmail(e.target.value)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="user@company.com"
                                        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addSeat(org.orgId, addSeatEmail);
                                        }}
                                        disabled={!addSeatEmail}
                                      >
                                        <UserPlus className="h-3.5 w-3.5" /> Add
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAddSeatOrgId(null);
                                          setAddSeatEmail("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAddSeatOrgId(org.orgId);
                                        setAddSeatEmail("");
                                      }}
                                    >
                                      <UserPlus className="h-3.5 w-3.5" /> Add
                                      Seat
                                    </Button>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("enterprise");
                                  }}
                                >
                                  <TrendingUp className="h-3.5 w-3.5" /> Convert
                                  to Contract
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

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          {auditLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
                <p className="text-sm text-foreground-muted">
                  Loading audit trail…
                </p>
              </CardContent>
            </Card>
          ) : auditEntries.length === 0 && !auditStats ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold">No Audit Entries</h2>
                  <p className="text-muted-foreground mt-1">
                    Administrative actions will appear here once enterprise
                    operations are performed.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Audit Stats + Chain Verification */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="flex flex-col items-center gap-1 py-4">
                    <Shield className="h-6 w-6 text-primary" />
                    <span className="text-lg font-bold">
                      {auditStats?.totalEntries ?? 0}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      Total Events
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center gap-1 py-4">
                    <Activity className="h-6 w-6 text-green-500" />
                    <span className="text-lg font-bold">
                      {auditStats?.last24h ?? 0}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      Last 24h
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center gap-1 py-4">
                    <Building2 className="h-6 w-6 text-blue-500" />
                    <span className="text-lg font-bold">
                      {Object.keys(auditStats?.orgCounts || {}).length}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      Orgs Tracked
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center gap-1 py-4">
                    {chainValid === true ? (
                      <>
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                        <span className="text-sm font-bold text-green-600">
                          Valid
                        </span>
                        <span className="text-xs text-foreground-muted">
                          Chain Integrity
                        </span>
                      </>
                    ) : chainValid === false ? (
                      <>
                        <AlertCircle className="h-6 w-6 text-red-500" />
                        <span className="text-sm font-bold text-red-600">
                          Broken
                        </span>
                        <span className="text-xs text-foreground-muted">
                          Chain Integrity
                        </span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-6 w-6 text-foreground-muted" />
                        <span className="text-sm font-bold">—</span>
                        <span className="text-xs text-foreground-muted">
                          Chain Integrity
                        </span>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="all">All Actions</option>
                  {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={auditOrgFilter}
                  onChange={(e) => setAuditOrgFilter(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="all">All Organizations</option>
                  {enterpriseOrgs.map((o) => (
                    <option key={o.orgId} value={o.orgId}>
                      {o.companyName}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (auditFilter !== "all")
                      params.set("action", auditFilter);
                    if (auditOrgFilter !== "all")
                      params.set("orgId", auditOrgFilter);
                    const url = enterpriseUrl(
                      `/enterprise/audit/export?${params}`,
                    );
                    window.open(url, "_blank");
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Export JSON
                </Button>
              </div>

              {/* Action Breakdown */}
              {auditStats &&
                Object.keys(auditStats.actionCounts).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Action Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                      {Object.entries(auditStats.actionCounts).map(
                        ([action, count]) => {
                          const info = ACTION_LABELS[action];
                          return (
                            <div
                              key={action}
                              className="flex items-center gap-2 rounded-lg border px-3 py-2"
                            >
                              <span
                                className={`text-sm font-medium ${info?.color || "text-foreground"}`}
                              >
                                {info?.label || action}
                              </span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          );
                        },
                      )}
                    </CardContent>
                  </Card>
                )}

              {/* Audit Entry List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Audit Trail</CardTitle>
                  <CardDescription>
                    Immutable, hash-chained administrative action log
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {auditEntries.length === 0 ? (
                    <p className="text-sm text-foreground-muted text-center py-4">
                      No audit entries match the current filters
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {auditEntries.map((entry) => {
                        const info = ACTION_LABELS[entry.action];
                        return (
                          <div
                            key={entry.eventId}
                            className="rounded-lg border p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-sm font-medium ${info?.color || "text-foreground"}`}
                                >
                                  {info?.label || entry.action}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  — {entry.description}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(entry.timestamp).toLocaleString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Key className="h-3 w-3" />
                                <span className="font-mono">{entry.actor}</span>
                              </span>
                              {entry.actorIp && (
                                <span className="font-mono">
                                  IP: {entry.actorIp}
                                </span>
                              )}
                              <span className="font-mono">
                                Org: {entry.orgId}
                              </span>
                              <span
                                className="font-mono text-[10px] text-muted-foreground/70"
                                title={entry.hash}
                              >
                                SHA-256: {entry.hash.slice(0, 12)}…
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* SSO Tab */}
        <TabsContent value="sso" className="space-y-4">
          {ssoLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
                <p className="text-sm text-foreground-muted">
                  Loading SSO configurations…
                </p>
              </CardContent>
            </Card>
          ) : ssoConfigs.length === 0 && !ssoStats ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold">
                    No SSO Configurations
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    Configure enterprise SSO providers (Okta, Azure AD, Ping)
                    for your organizations.
                  </p>
                </div>
                <Button onClick={() => setShowSsoForm(true)}>
                  <Plus className="h-4 w-4" /> Add SSO Provider
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* SSO Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="flex flex-col items-center gap-1 py-4">
                    <Lock className="h-6 w-6 text-primary" />
                    <span className="text-lg font-bold">
                      {ssoStats?.totalConfigs ?? 0}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      Total Providers
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center gap-1 py-4">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                    <span className="text-lg font-bold">
                      {ssoStats?.enabledConfigs ?? 0}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      Enabled
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center gap-1 py-4">
                    <Globe className="h-6 w-6 text-blue-500" />
                    <span className="text-lg font-bold">
                      {ssoStats?.byMethod?.saml ?? 0}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      SAML 2.0
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center gap-1 py-4">
                    <Zap className="h-6 w-6 text-amber-500" />
                    <span className="text-lg font-bold">
                      {ssoStats?.byMethod?.oidc ?? 0}
                    </span>
                    <span className="text-xs text-foreground-muted">OIDC</span>
                  </CardContent>
                </Card>
              </div>

              {/* Add SSO Provider Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (showSsoForm) {
                      resetSsoForm();
                      setShowSsoForm(false);
                    } else {
                      setShowSsoForm(true);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />{" "}
                  {showSsoForm ? "Cancel" : "Add SSO Provider"}
                </Button>
              </div>

              {/* SSO Config Form */}
              {showSsoForm && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {editingProviderId
                        ? "Edit SSO Provider Configuration"
                        : "New SSO Provider Configuration"}
                    </CardTitle>
                    <CardDescription>
                      {editingProviderId
                        ? "Update existing SAML 2.0 or OIDC provider settings"
                        : "Configure SAML 2.0 or OIDC for an enterprise organization"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Provider Presets */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground self-center mr-1">
                        Quick-fill:
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSsoForm({
                            ...ssoForm,
                            method: "oidc",
                            providerType: "okta",
                            oidcIssuer: "",
                            displayName: ssoForm.displayName || "Okta SSO",
                          })
                        }
                      >
                        Okta
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSsoForm({
                            ...ssoForm,
                            method: "oidc",
                            providerType: "azure_ad",
                            oidcIssuer: "",
                            displayName: ssoForm.displayName || "Azure AD SSO",
                          })
                        }
                      >
                        Azure AD
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSsoForm({
                            ...ssoForm,
                            method: "oidc",
                            providerType: "google",
                            oidcIssuer: "https://accounts.google.com",
                            displayName:
                              ssoForm.displayName || "Google Workspace SSO",
                          })
                        }
                      >
                        Google
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSsoForm({
                            ...ssoForm,
                            method: "saml",
                            providerType: "custom",
                            displayName: ssoForm.displayName || "SAML SSO",
                          })
                        }
                      >
                        SAML 2.0
                      </Button>
                    </div>
                    {ssoForm.providerType === "azure_ad" && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                        Azure AD: Enter your Tenant ID in the Issuer URL field
                        as
                        <code className="mx-1 text-xs">
                          https://login.microsoftonline.com/{"{tenantId}"}/v2.0
                        </code>
                        User info will be fetched from Microsoft Graph API
                        automatically.
                      </p>
                    )}
                    {ssoForm.providerType === "okta" && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                        Okta: Enter your Okta domain as
                        <code className="mx-1 text-xs">
                          https://your-org.okta.com
                        </code>
                        Ensure the app has Authorization Code grant type with
                        PKCE enabled.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">
                          Organization
                        </label>
                        <select
                          value={ssoForm.orgId}
                          onChange={(e) =>
                            setSsoForm({ ...ssoForm, orgId: e.target.value })
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select organization…</option>
                          {enterpriseOrgs.map((o) => (
                            <option key={o.orgId} value={o.orgId}>
                              {o.companyName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={ssoForm.displayName}
                          onChange={(e) =>
                            setSsoForm({
                              ...ssoForm,
                              displayName: e.target.value,
                            })
                          }
                          placeholder="e.g. Acme Okta"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Protocol</label>
                        <select
                          value={ssoForm.method}
                          onChange={(e) =>
                            setSsoForm({
                              ...ssoForm,
                              method: e.target.value as "saml" | "oidc",
                            })
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="oidc">OIDC (OpenID Connect)</option>
                          <option value="saml">SAML 2.0</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">
                          Provider Type
                        </label>
                        <select
                          value={ssoForm.providerType}
                          onChange={(e) =>
                            setSsoForm({
                              ...ssoForm,
                              providerType: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="okta">Okta</option>
                          <option value="azuread">
                            Azure Active Directory
                          </option>
                          <option value="ping">Ping Identity</option>
                          <option value="auth0">Auth0</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">
                          Email Domain
                        </label>
                        <input
                          type="text"
                          value={ssoForm.domain}
                          onChange={(e) =>
                            setSsoForm({ ...ssoForm, domain: e.target.value })
                          }
                          placeholder="e.g. acme.com"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          id="sso-enabled"
                          checked={ssoForm.enabled}
                          onChange={(e) =>
                            setSsoForm({
                              ...ssoForm,
                              enabled: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <label
                          htmlFor="sso-enabled"
                          className="text-sm font-medium"
                        >
                          Enabled
                        </label>
                      </div>
                    </div>

                    {ssoForm.method === "saml" ? (
                      <div className="space-y-3 border-t pt-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">
                            IdP Entry Point URL
                          </label>
                          <input
                            type="text"
                            value={ssoForm.samlEntryPoint}
                            onChange={(e) =>
                              setSsoForm({
                                ...ssoForm,
                                samlEntryPoint: e.target.value,
                              })
                            }
                            placeholder="https://acme.okta.com/app/simplebeacon/sso/saml"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">
                            IdP Certificate (PEM)
                          </label>
                          <textarea
                            value={ssoForm.samlCert}
                            onChange={(e) =>
                              setSsoForm({
                                ...ssoForm,
                                samlCert: e.target.value,
                              })
                            }
                            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                            rows={4}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">
                            SP Entity ID / Issuer (optional)
                          </label>
                          <input
                            type="text"
                            value={ssoForm.samlIssuer}
                            onChange={(e) =>
                              setSsoForm({
                                ...ssoForm,
                                samlIssuer: e.target.value,
                              })
                            }
                            placeholder="simplebeacon-ai (defaults to app name)"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 border-t pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">
                              Client ID
                            </label>
                            <input
                              type="text"
                              value={ssoForm.oidcClientId}
                              onChange={(e) =>
                                setSsoForm({
                                  ...ssoForm,
                                  oidcClientId: e.target.value,
                                })
                              }
                              placeholder="OAuth client ID"
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">
                              Client Secret
                            </label>
                            <input
                              type="password"
                              value={ssoForm.oidcClientSecret}
                              onChange={(e) =>
                                setSsoForm({
                                  ...ssoForm,
                                  oidcClientSecret: e.target.value,
                                })
                              }
                              placeholder={
                                editingProviderId
                                  ? "Enter new secret to replace (masked)"
                                  : "OAuth client secret"
                              }
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">
                            Issuer URL
                          </label>
                          <input
                            type="text"
                            value={ssoForm.oidcIssuer}
                            onChange={(e) =>
                              setSsoForm({
                                ...ssoForm,
                                oidcIssuer: e.target.value,
                              })
                            }
                            placeholder="https://acme.okta.com/oauth2/default"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSsoForm(false);
                          resetSsoForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={saveSsoConfig}
                        disabled={!ssoForm.orgId || !ssoForm.displayName}
                      >
                        <Lock className="h-4 w-4" />{" "}
                        {editingProviderId
                          ? "Update Configuration"
                          : "Save Configuration"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* SSO Config List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Configured SSO Providers
                  </CardTitle>
                  <CardDescription>
                    Enterprise identity provider configurations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ssoConfigs.length === 0 ? (
                    <p className="text-sm text-foreground-muted text-center py-4">
                      No SSO providers configured yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ssoConfigs.map((config) => (
                        <div
                          key={config.providerId}
                          className="rounded-lg border p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                {config.method === "saml" ? (
                                  <Globe className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <Zap className="h-5 w-5 text-amber-500" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">
                                    {config.displayName}
                                  </span>
                                  <Badge
                                    variant={
                                      config.enabled ? "default" : "secondary"
                                    }
                                  >
                                    {config.enabled ? "Active" : "Disabled"}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {config.method.toUpperCase()} ·{" "}
                                  {config.providerType} ·{" "}
                                  {config.domain || "no domain"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => testSsoConfig(config.providerId)}
                              >
                                <Zap className="h-3.5 w-3.5" /> Test
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => editSsoConfig(config)}
                              >
                                <Key className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label="Delete SSO config"
                                onClick={() =>
                                  deleteSsoConfig(config.providerId)
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t pt-2">
                            <span className="font-mono">
                              ID: {config.providerId}
                            </span>
                            <span>Org: {config.orgId}</span>
                            {config.oidc?.clientId && (
                              <span>
                                Client ID: {config.oidc.clientId.slice(0, 8)}…
                              </span>
                            )}
                            {config.oidc?.clientSecret && (
                              <span>Secret: {config.oidc.clientSecret}</span>
                            )}
                            {config.saml?.entryPoint && (
                              <span>
                                Entry: {config.saml.entryPoint.slice(0, 30)}…
                              </span>
                            )}
                            {config.saml?.issuer && (
                              <span>Issuer: {config.saml.issuer}</span>
                            )}
                            <span>Created: {formatDate(config.createdAt)}</span>
                            <span>Updated: {formatDate(config.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <IntegrationsView />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <UsageAnalyticsView />
        </TabsContent>

        {/* Whitelabel Tab */}
        <TabsContent value="whitelabel" className="space-y-4">
          <WhitelabelAdminView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
