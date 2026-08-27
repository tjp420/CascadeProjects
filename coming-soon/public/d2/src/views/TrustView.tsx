import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BadgeCheck,
  ShieldCheck,
  Activity,
  FileCheck,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Download,
  Database,
} from "lucide-react";
import { apiUrl, authHeaders, waitForApiBase } from "@/config";
import { getLargeItem } from "@/utils/dbStorage";

type SeverityCounts = Record<string, number>;

type TrustScope = {
  label: string;
  projectRoot: string;
  generatedAt: string;
  gatePass: boolean;
  qualityScore: number | null;
  issueCount: number;
  severityCounts: SeverityCounts;
  repositoryFilesTotal: number;
  ruleScopedFilesAnalyzed: number;
  schemaChecked: number;
  schemaPassed: number;
  consistencyScore?: number | null;
  consistencyChecked?: number | null;
  consistencyPassed?: number | null;
  schemaCompliance?: number | null;
  mockSampleFiles?: number | null;
  fictionJsonFilesScanned?: number | null;
  fictionSampleFilesScanned?: number | null;
  rulesEnabled: string[];
  scopeNote?: string;
};

type TrustVerification = {
  success: boolean;
  type: string;
  generatedAt: string;
  verificationMethod: string;
  platform: TrustScope;
  monorepo: TrustScope;
  headlineSource: string;
  headlineReason: string;
  headline: {
    gatePass: boolean;
    qualityScore: number | null;
    issueCount: number;
    lastScan: string;
    repositoryFilesTotal: number;
    ruleScopedFilesAnalyzed: number;
  };
  disclaimers: string[];
  publishedAt: string | null;
};

type TrustTrend = {
  window: number;
  snapshots: number;
  passRatePercent: number;
  avgQualityScore: number;
  avgIssues: number;
  issueDelta: number;
  qualityDelta: number;
  latest: {
    verificationId: string;
    generatedAt: string;
    gatePass: boolean;
    qualityScore: number;
    issues: number;
  } | null;
};

type TrustHistory = {
  success: boolean;
  count: number;
  trend: TrustTrend;
  entries: Array<{
    recordedAt: string;
    generatedAt: string;
    verificationId: string;
    gatePass: boolean;
    qualityScore: number;
    issues: number;
    source: string;
  }>;
};

/**
 * Build a trust verification envelope from locally stored scan data.
 * This is used as a fallback when the server trust API is unavailable.
 */
function buildLocalTrustVerification(
  scanResult: any,
  fullReport: any,
): TrustVerification | null {
  if (!scanResult && !fullReport) return null;
  const report = fullReport || scanResult || {};
  const gate = report.gate || scanResult?.gate || {};
  const severityCounts = report.severityCounts || scanResult?.severityCounts || {};
  const totalFiles =
    report.repositoryFilesTotal ||
    report.totalFiles ||
    scanResult?.totalFiles ||
    0;
  const ruleScoped =
    report.ruleScopedFilesAnalyzed ||
    report.filesAnalyzed ||
    report.summary?.codeFilesAnalyzed ||
    scanResult?.scanScope?.codeFilesAnalyzed ||
    0;
  const issueCount =
    report.issueCount ||
    scanResult?.issueCount ||
    (report.detectedIssues || report.rawIssues || []).length ||
    0;
  const qualityScore = report.qualityScore ?? scanResult?.qualityScore ?? null;
  const generatedAt = report.generatedAt || new Date().toISOString();
  const projectPath = report.projectRoot || report.projectPath || scanResult?.projectPath || "";

  const scope: TrustScope = {
    label: "Local scan",
    projectRoot: projectPath,
    generatedAt,
    gatePass: gate.pass ?? false,
    qualityScore,
    issueCount,
    severityCounts,
    repositoryFilesTotal: totalFiles,
    ruleScopedFilesAnalyzed: ruleScoped,
    schemaChecked: report.schemaChecked ?? 0,
    schemaPassed: report.schemaPassed ?? 0,
    rulesEnabled: report.scanScope?.rulesEnabled || [],
    scopeNote: report.scanScope?.limitations?.[0] || "Local scan data — server trust API was unavailable.",
  };

  return {
    success: true,
    type: "simplebeacon-trust-verification",
    generatedAt,
    verificationMethod: "simplebeacon-deterministic-gate (local fallback)",
    platform: scope,
    monorepo: null,
    headlineSource: "platform",
    headlineReason: "Built from locally stored scan data (server API unavailable)",
    headline: {
      gatePass: scope.gatePass,
      qualityScore: scope.qualityScore,
      issueCount: scope.issueCount,
      lastScan: scope.generatedAt,
      repositoryFilesTotal: scope.repositoryFilesTotal,
      ruleScopedFilesAnalyzed: scope.ruleScopedFilesAnalyzed,
    },
    disclaimers: [
      "This verification was built from locally stored scan data — the server trust API was unavailable.",
      "Quality score and issue counts apply to the last scan run from this browser.",
      "Publish via a connected server to get a cryptographically signed verification ID.",
    ],
    publishedAt: null,
  };
}

export function TrustView() {
  const [verification, setVerification] = useState<TrustVerification | null>(
    null,
  );
  const [history, setHistory] = useState<TrustHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"server" | "local" | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Try to wait for API base, but don't fail if unavailable
    let apiBase = true;
    try {
      await waitForApiBase();
    } catch {
      apiBase = false;
    }

    let serverVerification: TrustVerification | null = null;
    let serverHistory: TrustHistory | null = null;
    let serverOk = false;

    if (apiBase) {
      try {
        const [vRes, hRes] = await Promise.allSettled([
          fetch(apiUrl("/trust/verification"), { headers: authHeaders() }),
          fetch(apiUrl("/trust/history?limit=10"), { headers: authHeaders() }),
        ]);

        if (vRes.status === "fulfilled" && vRes.value.ok) {
          const vData = await vRes.value.json();
          serverVerification = vData;
          serverOk = true;
        }
        if (hRes.status === "fulfilled" && hRes.value.ok) {
          const hData = await hRes.value.json();
          serverHistory = hData;
        }
      } catch {
        // Network error — fall through to local fallback
      }
    }

    if (serverOk && serverVerification) {
      setVerification(serverVerification);
      setHistory(serverHistory);
      setDataSource("server");
      setError(null);
    } else {
      // Fallback: build trust verification from localStorage scan data
      let localScan: any = null;
      let localReport: any = null;
      try {
        const stored = localStorage.getItem("sb_last_scan_full");
        if (stored) localScan = JSON.parse(stored);
      } catch { /* ignore */ }
      try {
        const storedReport = localStorage.getItem("sb_last_scan_report");
        if (storedReport) localReport = JSON.parse(storedReport);
      } catch { /* ignore */ }
      // Try IndexedDB if localStorage didn't have it
      if (!localReport) {
        try {
          const storageHint = localStorage.getItem("sb_last_scan_report_storage");
          if (storageHint === "indexeddb") {
            localReport = await getLargeItem<any>("sb_last_scan_report");
          }
        } catch { /* ignore */ }
      }

      const localVerification = buildLocalTrustVerification(localScan, localReport);
      if (localVerification) {
        setVerification(localVerification);
        setHistory(null);
        setDataSource("local");
        setError(null);
      } else if (!apiBase) {
        setError("No API base configured and no local scan data found. Run a scan first.");
        setVerification(null);
      } else {
        setError(
          "Trust API unavailable and no local scan data found. Run a scan from the Analyze page.",
        );
        setVerification(null);
      }
    }

    setLoading(false);
  }, []);

  // simplebeacon-ignore: framework-practices
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handlePublish = async () => {
    try {
      const res = await fetch(apiUrl("/trust/publish"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      if (res.ok) {
        void fetchData();
      }
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    if (!verification) return;
    const blob = new Blob([JSON.stringify(verification, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trust-verification.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtDate = (s: string | null | undefined) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  const renderScope = (scope: TrustScope, title: string) => {
    if (!scope) return null;
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant={scope.gatePass ? "default" : "destructive"}>
            {scope.gatePass ? "PASS" : "FAIL"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-foreground-muted">Quality Score</div>
              <div className="font-semibold">{scope.qualityScore ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">Issues</div>
              <div className="font-semibold">{scope.issueCount}</div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">Files Total</div>
              <div className="font-semibold">
                {scope.repositoryFilesTotal?.toLocaleString() ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">
                Rules Analyzed
              </div>
              <div className="font-semibold">
                {scope.ruleScopedFilesAnalyzed?.toLocaleString() ?? "—"}
              </div>
            </div>
          </div>
          {/* Additional stats row */}
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-foreground-muted">Schema Checks</div>
              <div className="font-semibold">
                {scope.schemaChecked != null
                  ? `${scope.schemaPassed ?? 0}/${scope.schemaChecked}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">Consistency</div>
              <div className="font-semibold">
                {scope.consistencyScore != null
                  ? `${scope.consistencyScore}%`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">Mock/Sample Files</div>
              <div className="font-semibold">
                {scope.mockSampleFiles?.toLocaleString() ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">Fiction JSON Scanned</div>
              <div className="font-semibold">
                {scope.fictionJsonFilesScanned?.toLocaleString() ?? "—"}
              </div>
            </div>
          </div>
          {scope.severityCounts &&
            Object.keys(scope.severityCounts).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(scope.severityCounts)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => (
                    <Badge
                      key={k}
                      variant={
                        k === "critical"
                          ? "destructive"
                          : k === "high"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {k}: {v}
                    </Badge>
                  ))}
              </div>
            )}
          {scope.rulesEnabled && scope.rulesEnabled.length > 0 && (
            <div>
              <div className="text-xs text-foreground-muted mb-1">
                Rules Enabled
              </div>
              <div className="flex flex-wrap gap-1">
                {scope.rulesEnabled.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {scope.scopeNote && (
            <p className="text-xs text-foreground-muted">{scope.scopeNote}</p>
          )}
          <div className="text-xs text-foreground-muted">
            Last scan: {fmtDate(scope.generatedAt)}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Trust</h1>
          <p className="text-foreground-muted">
            Trust verification and integrity attestation
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
            <p className="text-sm text-foreground-muted">Loading trust data…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !verification) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Trust</h1>
          <p className="text-foreground-muted">
            Trust verification and integrity attestation
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

  if (!verification) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Trust</h1>
          <p className="text-foreground-muted">
            Trust verification and integrity attestation
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <BadgeCheck className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">
              No trust verification data
            </p>
            <Button size="sm" onClick={() => fetchData()} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const headline = verification.headline || {
    gatePass: false,
    qualityScore: null,
    issueCount: 0,
    lastScan: null,
    repositoryFilesTotal: null,
  };
  const trend = history?.trend;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Trust</h1>
        <p className="text-foreground-muted">
          Trust verification and integrity attestation
          {dataSource === "local" && (
            <Badge variant="warning" className="ml-2 text-xs">
              Local data
            </Badge>
          )}
          {dataSource === "server" && (
            <Badge variant="success" className="ml-2 text-xs">
              Server verified
            </Badge>
          )}
        </p>
      </div>

      {/* Headline Summary */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle className="text-base">Verification Summary</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button size="sm" onClick={handlePublish}>
              <RefreshCw className="h-4 w-4 mr-1" /> Publish
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fetchData()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <BadgeCheck
                className={`h-8 w-8 ${headline.gatePass ? "text-green-500" : "text-red-500"}`}
              />
              <div>
                <div className="text-xs text-foreground-muted">Gate Status</div>
                <div className="font-semibold">
                  {headline.gatePass ? "PASS" : "FAIL"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-xs text-foreground-muted">
                  Quality Score
                </div>
                <div className="font-semibold">
                  {headline.qualityScore ?? "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileCheck className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-xs text-foreground-muted">Issues</div>
                <div className="font-semibold">{headline.issueCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <div>
                <div className="text-xs text-foreground-muted">Last Scan</div>
                <div className="font-semibold text-xs">
                  {fmtDate(headline.lastScan)}
                </div>
              </div>
            </div>
          </div>
          <div className="text-xs text-foreground-muted">
            Verification method: {verification.verificationMethod} · Source:{" "}
            {verification.headlineSource} · {verification.headlineReason}
          </div>
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-4">
            <Database className="h-6 w-6 text-blue-500" />
            <span className="text-2xl font-bold">
              {headline.repositoryFilesTotal?.toLocaleString() ?? "—"}
            </span>
            <span className="text-xs text-foreground-muted">Files Total</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-4">
            <FileCheck className="h-6 w-6 text-purple-500" />
            <span className="text-2xl font-bold">
              {headline.ruleScopedFilesAnalyzed?.toLocaleString() ?? "—"}
            </span>
            <span className="text-xs text-foreground-muted">Rules Analyzed</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-4">
            <ShieldCheck className="h-6 w-6 text-green-500" />
            <span className="text-2xl font-bold">
              {verification.platform?.schemaChecked != null
                ? `${verification.platform.schemaPassed ?? 0}/${verification.platform.schemaChecked}`
                : "—"}
            </span>
            <span className="text-xs text-foreground-muted">Schema Checks</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-4">
            <Activity className="h-6 w-6 text-orange-500" />
            <span className="text-2xl font-bold">
              {verification.platform?.consistencyScore != null
                ? `${verification.platform.consistencyScore}%`
                : "—"}
            </span>
            <span className="text-xs text-foreground-muted">Consistency</span>
          </CardContent>
        </Card>
      </div>

      {/* Trend */}
      {trend && trend.latest && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle className="text-base">Trust Trend</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <div className="text-xs text-foreground-muted">Snapshots</div>
                <div className="font-semibold">{trend.snapshots}</div>
              </div>
              <div>
                <div className="text-xs text-foreground-muted">Pass Rate</div>
                <div className="font-semibold">{trend.passRatePercent}%</div>
              </div>
              <div>
                <div className="text-xs text-foreground-muted">Avg Quality</div>
                <div className="font-semibold">{trend.avgQualityScore}</div>
              </div>
              <div>
                <div className="text-xs text-foreground-muted">Avg Issues</div>
                <div className="font-semibold">{trend.avgIssues}</div>
              </div>
            </div>
            {history && history.entries.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs text-foreground-muted">
                  Recent Snapshots
                </div>
                {history.entries.slice(0, 5).map((e) => (
                  <div
                    key={e.verificationId}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={e.gatePass ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {e.gatePass ? "PASS" : "FAIL"}
                      </Badge>
                      <span className="text-xs text-foreground-muted">
                        {fmtDate(e.generatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>Q: {e.qualityScore}</span>
                      <span>Issues: {e.issues}</span>
                      <span className="text-foreground-muted">{e.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Platform & Monorepo Scopes */}
      <div className="grid gap-4 md:grid-cols-2">
        {verification.platform &&
          renderScope(verification.platform, "Platform Gate (ai-platform)")}
        {verification.monorepo &&
          renderScope(verification.monorepo, "Monorepo Root")}
      </div>

      {/* Disclaimers */}
      {verification.disclaimers && verification.disclaimers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disclaimers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-foreground-muted">
              {verification.disclaimers.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
