import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Map,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ListTodo,
  TrendingUp,
  Zap,
  Download,
} from "lucide-react";
import { apiUrl, authHeaders } from "@/config";
import { getExtensionBridgeOrigin } from "@services/localAgentService.js";
import { navigate } from "@/router/HashRouter";
import { ACTION_CAP, buildRoadmapFromScan, SCAN_IN_PROGRESS_KEY, SCAN_UPDATED_EVENT, stripRoadmapArtifactRows } from "@/lib/collect-scan-issues";
import { getLargeItem } from "@/utils/dbStorage";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { PremiumUnlockCallout } from "@/components/PremiumUnlockCallout";
import {
  ROADMAP_PREVIEW_ROWS,
  remainingLockedRows,
} from "@/lib/executive-checkout";

type Phase = {
  phase?: string;
  name?: string;
  status?: string;
  items?: string[];
  milestones?: string[];
  features?:
    Array<{ name: string; status: string; category?: string }> | string[];
};

type Risk = {
  category?: string;
  severity?: string;
  description?: string;
};

type ActionItem = {
  priority?: string;
  action?: string;
  category?: string;
  description?: string;
};

type Recommendation = {
  priority?: string;
  action?: string;
  description?: string;
  effort?: string;
  risk?: string;
  savings?: string;
};

type RoadmapData = {
  type?: string;
  generatedAt?: string;
  projectName?: string;
  executiveSummary?: {
    totalFeatures?: number;
    completedFeatures?: number;
    inProgressFeatures?: number;
    plannedFeatures?: number;
    completionRate?: number;
    projectHealth?: string;
    notes?: string;
    lastUpdated?: string;
  };
  developmentPhases?: Phase[];
  implementationPhases?: Phase[];
  risks?: Risk[];
  actionPlan?: ActionItem[];
  recommendations?: Recommendation[];
  progressMetrics?: {
    completionRate?: number;
    totalFeatures?: number;
    completedFeatures?: number;
    [key: string]: unknown;
  };
  sourceProjectPath?: string;
};

function statusIcon(status?: string) {
  const s =
    typeof status === "string" && status ? status.toLowerCase() : "pending";
  if (s === "complete" || s === "completed" || s === "done")
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (s === "active" || s === "in-progress" || s === "in progress")
    return <Clock className="h-4 w-4 text-blue-500" />;
  if (s === "planned" || s === "pending" || s === "not-started")
    return <Circle className="h-4 w-4 text-foreground-muted" />;
  if (s === "blocked")
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  return <Circle className="h-4 w-4 text-foreground-muted" />;
}

function statusColor(status?: string): string {
  const s =
    typeof status === "string" && status ? status.toLowerCase() : "pending";
  if (s === "complete" || s === "completed" || s === "done")
    return "bg-green-500/15 text-green-500 border-green-500/30";
  if (s === "active" || s === "in-progress" || s === "in progress")
    return "bg-blue-500/15 text-blue-500 border-blue-500/30";
  if (s === "blocked") return "bg-red-500/15 text-red-500 border-red-500/30";
  if (s === "planned" || s === "pending")
    return "bg-gray-500/15 text-gray-500 border-gray-500/30";
  return "bg-gray-500/15 text-gray-500 border-gray-500/30";
}

function priorityColor(priority?: string): string {
  const p =
    typeof priority === "string" && priority ? priority.toLowerCase() : "";
  if (p === "critical" || p === "high")
    return "bg-red-500/15 text-red-500 border-red-500/30";
  if (p === "medium")
    return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
  if (p === "low") return "bg-blue-500/15 text-blue-500 border-blue-500/30";
  return "bg-gray-500/15 text-gray-500 border-gray-500/30";
}

export function RemediationView() {
  const { user } = useAuth();
  const { hasFeature } = useFeatureAccess();
  const paidRoadmap = hasFeature("canExportCertificates");
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanInProgress, setScanInProgress] = useState(false);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      try {
        setScanInProgress(localStorage.getItem(SCAN_IN_PROGRESS_KEY) === "1");
      } catch {
        setScanInProgress(false);
      }
      let scan: unknown = null;
      try {
        const stored = localStorage.getItem("sb_last_scan_full");
        if (stored) scan = JSON.parse(stored);
      } catch {
        /* ignore */
      }
      if (!buildRoadmapFromScan(scan)) {
        try {
          const fromIdb = await getLargeItem("sb_last_scan_report");
          if (fromIdb) scan = fromIdb;
        } catch {
          /* ignore */
        }
      }
      if (!buildRoadmapFromScan(scan)) {
        try {
          const report = localStorage.getItem("sb_last_scan_report");
          if (report) scan = JSON.parse(report);
        } catch {
          /* ignore */
        }
      }
      if (!buildRoadmapFromScan(scan)) {
        try {
          const compact = localStorage.getItem("sb_last_scan");
          if (compact) scan = JSON.parse(compact);
        } catch {
          /* ignore */
        }
      }

      const localRoadmap = buildRoadmapFromScan(scan);
      if (localRoadmap) {
        setData(stripRoadmapArtifactRows(localRoadmap) as RoadmapData);
        setLoading(false);
        return;
      }

      let projectPath = "CascadeProjects";
      if (scan && typeof scan === "object" && (scan as any).projectPath) {
        projectPath = String((scan as any).projectPath);
      }

      // On the hosted dashboard, don't auto-fire /analyze/flexible with a local
      // path — the remote backend can't access the user's filesystem.
      const isLocalPath = !/^https?:\/\//i.test(projectPath) &&
        !/^(git@|ssh:\/\/)/i.test(projectPath);
      if (
        typeof window !== "undefined" &&
        !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) &&
        isLocalPath &&
        !getExtensionBridgeOrigin()
      ) {
        setLoading(false);
        return;
      }

      const resp = await fetch(apiUrl("/analyze/flexible"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ projectPath, analysisType: "roadmap" }),
        signal: AbortSignal.timeout(35000),
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const json = await resp.json();
      const roadmap =
        json.roadmap || json.report?._roadmapAnalysis || json.report || json;
      setData(stripRoadmapArtifactRows(roadmap) as RoadmapData);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch remediation roadmap");
    } finally {
      setLoading(false);
    }
  }, []);

  const [rescanning, setRescanning] = useState(false);

  const triggerRescan = async () => {
    setRescanning(true);
    try {
      const projectPath = localStorage.getItem("sb_current_project") || ".";
      const resp = await fetch(apiUrl("/scan/trigger"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ patternId: undefined, projectPath }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(
          errData.message || errData.error || `HTTP ${resp.status}`,
        );
      }
      toast.success(
        "Local re-scan triggered successfully. Compliance matrix updating...",
      );
      await fetchData();
    } catch (err: any) {
      toast.error("Re-scan failed: " + (err?.message || "unknown error"));
    } finally {
      setRescanning(false);
    }
  };

  // simplebeacon-ignore: framework-practices
  useEffect(() => {
    void fetchData();
    const onUpdate = () => {
      void fetchData({ silent: true });
    };
    window.addEventListener(SCAN_UPDATED_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    const timer = window.setInterval(() => {
      try {
        if (localStorage.getItem(SCAN_IN_PROGRESS_KEY) === "1") {
          void fetchData({ silent: true });
        }
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => {
      window.removeEventListener(SCAN_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
      window.clearInterval(timer);
    };
  }, [fetchData]);

  const fmtDate = (s?: string) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  const exportRoadmap = () => {
    if (!data) return;
    const payload = { exportedAt: new Date().toISOString(), roadmap: data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const root = (data.sourceProjectPath || data.projectName || "roadmap")
      .replace(/[\/:\\\s]+/g, "-")
      .slice(0, 60);
    a.href = url;
    a.download = `remediation-${root || "roadmap"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Remediation</h1>
          <p className="text-foreground-muted">
            Prioritized fix roadmap and remediation tracking
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
            <p className="text-sm text-foreground-muted">
              Generating remediation roadmap…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Remediation</h1>
          <p className="text-foreground-muted">
            Prioritized fix roadmap and remediation tracking
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <AlertCircle className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">{error}</p>
            <Button size="sm" onClick={() => fetchData()} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Remediation</h1>
          <p className="text-foreground-muted">
            Prioritized fix roadmap and remediation tracking
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Map className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">
              {scanInProgress
                ? "Scan still running — the roadmap will appear when Analyze finishes storing the snapshot in this browser."
                : "No remediation roadmap available"}
            </p>
            <p className="text-xs text-foreground-muted max-w-md text-center">
              Hosted Remediation uses the Analyze snapshot stored in this
              browser. It cannot scan your local disk.
              {scanInProgress
                ? " Stay on this tab or return after the file count stops increasing."
                : " Finish a local scan, then open this page again."}
            </p>
            <Button onClick={() => navigate("analyze")} className="mt-2">
              {scanInProgress ? "Back to Analyze" : "Start a Scan"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = data.executiveSummary || {};
  const phases = data.developmentPhases || data.implementationPhases || [];
  const risks = data.risks || [];
  const actionPlan = data.actionPlan || [];
  const recommendations = data.recommendations || [];
  const completionRate =
    summary.completionRate ?? data.progressMetrics?.completionRate ?? 0;
  const previewActions = paidRoadmap
    ? actionPlan
    : actionPlan.slice(0, ROADMAP_PREVIEW_ROWS);
  const lockedActions = paidRoadmap
    ? []
    : actionPlan.slice(ROADMAP_PREVIEW_ROWS);
  const lockedCount = remainingLockedRows(
    Math.min(
      Math.max(actionPlan.length, Number(summary.totalFeatures) || 0),
      ACTION_CAP,
    ),
    ROADMAP_PREVIEW_ROWS,
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Remediation</h1>
          <p className="text-foreground-muted">
            Prioritized fix roadmap and remediation tracking
          </p>
          {data.sourceProjectPath && (
            <p className="text-xs text-foreground-muted">
              {data.sourceProjectPath} — {fmtDate(data.generatedAt)}
            </p>
          )}
        </div>
        {paidRoadmap ? (
          <div className="ml-4 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportRoadmap}>
              <Download className="h-4 w-4 mr-2" /> Export JSON
            </Button>
          </div>
        ) : null}
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <TrendingUp className="h-6 w-6 text-foreground-muted" />
            <span className="text-2xl font-bold">{completionRate}%</span>
            <span className="text-xs text-foreground-muted">Completion</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <span className="text-2xl font-bold">
              {summary.completedFeatures ?? 0}
            </span>
            <span className="text-xs text-foreground-muted">Completed</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <Clock className="h-6 w-6 text-blue-500" />
            <span className="text-2xl font-bold">
              {summary.inProgressFeatures ?? 0}
            </span>
            <span className="text-xs text-foreground-muted">In Progress</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4">
            <ListTodo className="h-6 w-6 text-foreground-muted" />
            <span className="text-2xl font-bold">
              {summary.plannedFeatures ?? 0}
            </span>
            <span className="text-xs text-foreground-muted">Planned</span>
          </CardContent>
        </Card>
      </div>

      {/* Project Health */}
      {summary.projectHealth && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              {summary.projectHealth === "Healthy" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : summary.projectHealth === "Blocked" ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : (
                <Clock className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <p className="text-sm font-medium">
                  Project Health: {summary.projectHealth}
                </p>
                {summary.notes && (
                  <p className="text-xs text-foreground-muted">
                    {summary.notes}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => triggerRescan()}
              disabled={rescanning}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${rescanning ? "animate-spin" : ""}`}
              />{" "}
              {rescanning ? "Rescanning…" : "Refresh"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action Plan */}
      {actionPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Action Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewActions.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    {item.priority && (
                      <Badge
                        className={priorityColor(item.priority)}
                        variant="outline"
                      >
                        {item.priority || ""}
                      </Badge>
                    )}
                    <span className="text-sm font-medium">
                      {item.action || item.description || "Action item"}
                    </span>
                  </div>
                  {item.category && (
                    <span className="text-xs text-foreground-muted">
                      Category: {item.category}
                    </span>
                  )}
                  {item.description && item.action && (
                    <span className="text-xs text-foreground-muted">
                      {item.description}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!paidRoadmap && lockedCount > 0 ? (
              <div className="relative min-h-[220px] overflow-hidden rounded-lg">
                <div className="pointer-events-none select-none blur-sm opacity-50 space-y-3">
                  {(lockedActions.length > 0 ? lockedActions : actionPlan)
                    .slice(0, 6)
                    .map((item, i) => (
                      <div
                        key={`locked-${i}`}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-1 flex-1">
                          <span className="text-sm font-medium">
                            {item.action || item.description || "Action item"}
                          </span>
                          {item.category && (
                            <span className="text-xs text-foreground-muted">
                              {item.category}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
                <PremiumUnlockCallout
                  remaining={lockedCount}
                  projectName={data.projectName || data.sourceProjectPath}
                  defaultEmail={String(user?.email || "")}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Risks — file-level detail stays behind paid clearance */}
      {paidRoadmap && risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.map((risk, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    {risk.severity && (
                      <Badge
                        className={priorityColor(risk.severity)}
                        variant="outline"
                      >
                        {risk.severity || ""}
                      </Badge>
                    )}
                    {risk.category && (
                      <span className="text-xs text-foreground-muted">
                        {risk.category}
                      </span>
                    )}
                  </div>
                  {risk.description && (
                    <span className="text-sm">{risk.description}</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Development Phases */}
      {phases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Development Phases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {phases.map((phase, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  {statusIcon(phase.status || "pending")}
                  <span className="text-sm font-medium">
                    {phase.phase || phase.name || `Phase ${i + 1}`}
                  </span>
                  {phase.status && (
                    <Badge
                      className={statusColor(phase.status || "pending")}
                      variant="outline"
                    >
                      {phase.status || "pending"}
                    </Badge>
                  )}
                </div>
                {phase.items && phase.items.length > 0 && (
                  <ul className="ml-6 space-y-1">
                    {phase.items.map((item, j) => (
                      <li key={j} className="text-xs text-foreground-muted">
                        • {item}
                      </li>
                    ))}
                  </ul>
                )}
                {phase.milestones && phase.milestones.length > 0 && (
                  <div className="ml-6 mt-2 space-y-1">
                    <span className="text-xs font-medium text-foreground-muted">
                      Milestones:
                    </span>
                    <ul className="space-y-0.5">
                      {phase.milestones.map((ms, j) => (
                        <li key={j} className="text-xs text-foreground-muted">
                          • {ms}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {phase.features && phase.features.length > 0 && (
                  <div className="ml-6 space-y-1 mt-2">
                    {phase.features.map((feat, j) => {
                      const isString = typeof feat === "string";
                      const featName = isString ? feat : (feat as any).name;
                      const featStatus = isString
                        ? phase.status || "pending"
                        : (feat as any).status || "pending";
                      return (
                        <div key={j} className="flex items-center gap-2">
                          {statusIcon(featStatus)}
                          <span className="text-xs">{featName}</span>
                          <Badge
                            className={statusColor(featStatus)}
                            variant="outline"
                          >
                            {featStatus}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {paidRoadmap && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.slice(0, 15).map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <Zap className="h-4 w-4 text-foreground-muted mt-0.5" />
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {rec.priority && (
                      <Badge
                        className={priorityColor(rec.priority)}
                        variant="outline"
                      >
                        {rec.priority || ""}
                      </Badge>
                    )}
                    {rec.action && (
                      <span className="text-sm font-medium">{rec.action}</span>
                    )}
                  </div>
                  {rec.description && (
                    <span className="text-xs text-foreground-muted">
                      {rec.description}
                    </span>
                  )}
                  <div className="flex items-center gap-4 text-xs text-foreground-muted">
                    {rec.effort && <span>Effort: {rec.effort}</span>}
                    {rec.risk && <span>Risk: {rec.risk}</span>}
                    {rec.savings && <span>Savings: {rec.savings}</span>}
                  </div>
                </div>
              </div>
            ))}
            {recommendations.length > 15 && (
              <p className="text-xs text-foreground-muted">
                Showing 15 of {recommendations.length} recommendations
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
