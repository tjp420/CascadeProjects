import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { WorkspaceSandboxPanel } from "@/components/WorkspaceSandboxPanel";
import { WorkspaceBudgetPanel } from "@/components/WorkspaceBudgetPanel";
import { getApiBase } from "@/config";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";

interface SandboxSummary {
  success: boolean;
  orgId: string;
  sso: { count: number; providers: string[] };
  integrations: { count: number; types: Record<string, number> };
  webhooks: { count: number; targets: string[] };
}

interface BudgetConfig {
  softCapPercent?: number;
  hardStopPercent?: number;
  alertIntervals?: number[];
  alertCooldownMinutes?: number;
  webhookAlertsEnabled?: boolean;
  autoResetEnabled?: boolean;
}

interface Budget {
  id: string;
  orgId: string;
  scope: string;
  name?: string;
  limitUSD: number;
  spentUSD: number;
  period: string;
  periodStart: string;
  periodEnd: string;
  enabled: boolean;
  config: BudgetConfig;
  alerts: {
    type: string;
    crossedValue: number;
    pct: number;
    timestamp: string;
  }[];
}

function apiUrl(path: string): string {
  const base = getApiBase();
  return `${base}/api${path}`;
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("sb_token") ||
    localStorage.getItem("sb-token") ||
    localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function WorkspaceConfigView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superuser";

  const [orgId, setOrgId] = useState<string>("default");
  const [activeTab, setActiveTab] = useState("budgets");

  const [summary, setSummary] = useState<SandboxSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingBudgets, setLoadingBudgets] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await fetch(
        apiUrl(`/workspace/sandbox-summary?orgId=${encodeURIComponent(orgId)}`),
        {
          headers: authHeaders(),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SandboxSummary = await res.json();
      setSummary(data);
    } catch (err: any) {
      setSummaryError(err.message || "Failed to load sandbox telemetry");
    } finally {
      setLoadingSummary(false);
    }
  }, [orgId]);

  const fetchBudgets = useCallback(async () => {
    setLoadingBudgets(true);
    setBudgetError(null);
    try {
      const res = await fetch(
        apiUrl(`/workspace/budgets?orgId=${encodeURIComponent(orgId)}`),
        {
          headers: authHeaders(),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBudgets(data.budgets || []);
    } catch (err: any) {
      setBudgetError(err.message || "Failed to load budgets");
    } finally {
      setLoadingBudgets(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchSummary();
    fetchBudgets();
  }, [fetchSummary, fetchBudgets]);

  const handleSave = useCallback(
    async (scope: string, updates: Partial<Budget>): Promise<boolean> => {
      try {
        const res = await fetch(
          apiUrl(
            `/workspace/budgets/${encodeURIComponent(scope)}?orgId=${encodeURIComponent(orgId)}`,
          ),
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ ...updates, orgId }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        toast.success(`Budget for ${scope} updated`);
        await fetchBudgets();
        return true;
      } catch (err: any) {
        toast.error(err.message || "Budget update failed");
        return false;
      }
    },
    [orgId, fetchBudgets],
  );

  const handleReset = useCallback(
    async (scope: string): Promise<boolean> => {
      try {
        const res = await fetch(
          apiUrl(
            `/workspace/budgets/${encodeURIComponent(scope)}/reset?orgId=${encodeURIComponent(orgId)}`,
          ),
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ orgId }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        toast.success(`Budget for ${scope} reset`);
        await fetchBudgets();
        return true;
      } catch (err: any) {
        toast.error(err.message || "Budget reset failed");
        return false;
      }
    },
    [orgId, fetchBudgets],
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Briefcase className="h-6 w-6" />
            Workspace Configuration
          </h1>
          <p className="text-sm text-foreground-muted">
            Sandbox telemetry and fiscal controls for multi-tenant
            administration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Organization</Label>
          <Input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="org-id"
            className="w-48"
          />
          <Button
            onClick={() => {
              fetchSummary();
              fetchBudgets();
            }}
          >
            Load
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="budgets">Token Budgets</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox Telemetry</TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="mt-4">
          <WorkspaceBudgetPanel
            budgets={budgets}
            orgId={orgId}
            isAdmin={isAdmin}
            onSave={handleSave}
            onReset={handleReset}
            loading={loadingBudgets}
          />
          {budgetError && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {budgetError}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sandbox" className="mt-4">
          <WorkspaceSandboxPanel
            summary={summary}
            loading={loadingSummary}
            error={summaryError}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
