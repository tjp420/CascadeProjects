import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Bug,
  Lock,
  FileWarning,
  Database,
  KeyRound,
  Crown,
  Activity,
} from "lucide-react";
import { apiUrl, authHeaders, waitForApiBase } from "@/config";
import { useAuth } from "@/hooks/useAuth";
import { ProviderFailoverDashboard } from "@/components/ProviderFailoverDashboard";
import { IdentityFederationDashboard } from "@/components/IdentityFederationDashboard";
import { SemanticCacheDashboard } from "@/components/SemanticCacheDashboard";
import { WebhookSigningDashboard } from "@/components/WebhookSigningDashboard";
import { AgenticOrchestrationDashboard } from "@/components/AgenticOrchestrationDashboard";
import { ToolSchemaValidationDashboard } from "@/components/ToolSchemaValidationDashboard";
import { StreamInterdictionDashboard } from "@/components/StreamInterdictionDashboard";
import { QuarantineLogBrowser } from "@/components/QuarantineLogBrowser";
import { PolicySyncer } from "@/components/PolicySyncer";
import { PolicySyncHistory } from "@/components/PolicySyncHistory";

type ScanResultData = {
  projectPath?: string;
  totalFiles?: number;
  issueCount?: number;
  qualityScore?: number;
  severityCounts?: Record<string, number>;
  categories?: Array<{
    category: string;
    label?: string;
    count: number;
    severity: string;
    fileCount?: number;
    topFiles?: string[];
  }>;
  scanScope?: {
    profile?: string;
    codeFilesAnalyzed?: number;
  };
  gate?: {
    pass?: boolean;
    blockingCount?: number;
    warningCount?: number;
  };
  timestamp?: string;
};

type NpmAuditData = {
  vulnerabilities?: {
    total?: number;
    bySeverity?: Record<string, number>;
  };
  advisories?: Array<{
    id?: string;
    title?: string;
    severity?: string;
    package?: string;
    vulnerableVersions?: string;
    patchedVersions?: string;
    url?: string;
  }>;
  metadata?: {
    vulnerabilities?: Record<string, number>;
  };
};

const SECURITY_CATEGORIES = new Set([
  "database-patterns",
  "prototype-pollution",
  "token-bleed",
  "config-drift",
  "credentials",
  "production-leak",
  "security-patterns",
  "security-headers",
  "Broken or invalid files",
  "broken-or-invalid",
]);

function severityColor(sev: string): string {
  switch (sev.toLowerCase()) {
    case "critical":
      return "bg-red-500/15 text-red-500 border-red-500/30";
    case "high":
      return "bg-orange-500/15 text-orange-500 border-orange-500/30";
    case "medium":
      return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
    case "low":
      return "bg-blue-500/15 text-blue-500 border-blue-500/30";
    default:
      return "bg-gray-500/15 text-gray-500 border-gray-500/30";
  }
}

function categoryIcon(cat: string) {
  const c = cat.toLowerCase();
  if (c.includes("database")) return <Database className="h-4 w-4" />;
  if (c.includes("token") || c.includes("credential"))
    return <KeyRound className="h-4 w-4" />;
  if (c.includes("broken") || c.includes("invalid"))
    return <FileWarning className="h-4 w-4" />;
  if (c.includes("prototype") || c.includes("pollution"))
    return <ShieldAlert className="h-4 w-4" />;
  return <Lock className="h-4 w-4" />;
}

/**
 * Derive security categories from raw scan issues.
 * Groups issues by type/category and maps them to security categories.
 */
function deriveCategoriesFromIssues(rawIssues: any[]): Array<{
  category: string;
  label?: string;
  count: number;
  severity: string;
  fileCount?: number;
  topFiles?: string[];
}> {
  const buckets = new Map<string, { count: number; severity: string; files: Set<string> }>();
  for (const issue of rawIssues) {
    const cat = String(issue.type || issue.category || issue.patternId || "unknown");
    const sev = String(issue.severity || "info").toLowerCase();
    // Only include security-relevant categories
    const catLower = cat.toLowerCase();
    const isSecurity =
      SECURITY_CATEGORIES.has(catLower) ||
      catLower.includes("credential") ||
      catLower.includes("security") ||
      catLower.includes("token") ||
      catLower.includes("database") ||
      catLower.includes("production") ||
      catLower.includes("prototype") ||
      catLower.includes("pollution") ||
      catLower.includes("config-drift") ||
      catLower.includes("secret");
    if (!isSecurity) continue;
    const existing = buckets.get(cat) || { count: 0, severity: sev, files: new Set() };
    existing.count += 1;
    // Track severity (keep highest)
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    if ((sevOrder[sev] ?? 5) < (sevOrder[existing.severity] ?? 5)) {
      existing.severity = sev;
    }
    if (issue.filePath || issue.file) {
      existing.files.add(String(issue.filePath || issue.file));
    }
    buckets.set(cat, existing);
  }
  return Array.from(buckets.entries()).map(([category, data]) => ({
    category,
    label: category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    count: data.count,
    severity: data.severity,
    fileCount: data.files.size,
    topFiles: Array.from(data.files).slice(0, 5),
  }));
}

/**
 * Derive security categories from server audit layers.
 * Maps audit layer keys to security category names.
 */
function deriveCategoriesFromAuditLayers(serverAudit: any): Array<{
  category: string;
  label?: string;
  count: number;
  severity: string;
  fileCount?: number;
}> {
  if (!serverAudit) return [];
  const layers = serverAudit.auditLayers || {};
  const result: Array<{ category: string; label?: string; count: number; severity: string; fileCount?: number }> = [];
  // Map audit layer keys to security categories
  const layerMap: Record<string, { category: string; severity: string }> = {
    credentials: { category: "credentials", severity: "high" },
    productionLeaks: { category: "production-leak", severity: "medium" },
    securityPatterns: { category: "security-patterns", severity: "high" },
    schema: { category: "config-drift", severity: "medium" },
  };
  for (const [layerKey, catInfo] of Object.entries(layerMap)) {
    const layer = (layers as any)[layerKey];
    if (layer && layer.findings > 0) {
      result.push({
        category: catInfo.category,
        label: catInfo.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        count: layer.findings,
        severity: layer.severity || catInfo.severity,
        fileCount: layer.scanned || undefined,
      });
    }
  }
  // Also check the report for credential/production leak findings
  const report = serverAudit.report || {};
  if (report.credentialFindings && report.credentialFindings > 0) {
    if (!result.find((r) => r.category === "credentials")) {
      result.push({
        category: "credentials",
        label: "Credentials",
        count: report.credentialFindings,
        severity: "high",
      });
    }
  }
  if (report.productionLeakFindings && report.productionLeakFindings > 0) {
    if (!result.find((r) => r.category === "production-leak")) {
      result.push({
        category: "production-leak",
        label: "Production Leaks",
        count: report.productionLeakFindings,
        severity: "medium",
      });
    }
  }
  if (report.securityPatternFindings && report.securityPatternFindings > 0) {
    if (!result.find((r) => r.category === "security-patterns")) {
      result.push({
        category: "security-patterns",
        label: "Security Patterns",
        count: report.securityPatternFindings,
        severity: "high",
      });
    }
  }
  return result;
}

export function SecurityView() {
  const [scanData, setScanData] = useState<ScanResultData | null>(null);
  const [npmAudit, setNpmAudit] = useState<NpmAuditData | null>(null);
  const [serverAudit, setServerAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Enterprise dashboards (ProviderFailover, IdentityFederation, SemanticCache,
  // WebhookSigning, AgenticOrchestration, ToolSchemaValidation) require
  // enterprise tier or admin role. Non-enterprise users see an upgrade CTA.
  const userTier = String(user?.plan || user?.tier || "").toLowerCase();
  const userRole = String(user?.role || "").toLowerCase();
  const isEnterprise =
    userTier === "enterprise" ||
    ["admin", "owner", "superuser", "superadmin"].includes(userRole);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Load last scan summary from localStorage for basic info (projectPath, gate, etc.)
    let scan: ScanResultData | null = null;
    try {
      const stored = localStorage.getItem("sb_last_scan_full");
      if (stored) scan = JSON.parse(stored);
    } catch {
      /* ignore */
    }

    // Also load the full report from localStorage for issue details
    let localReport: any = null;
    try {
      const storedReport = localStorage.getItem("sb_last_scan_report");
      if (storedReport) localReport = JSON.parse(storedReport);
    } catch {
      /* ignore */
    }

    // Try to wait for API base, but don't fail if unavailable (browser-only mode)
    let apiBase = true;
    try {
      await waitForApiBase();
    } catch {
      apiBase = false;
    }

    // Fetch audit payload (contains security audit layers + npm audit) and
    // codebase analysis (contains categories with security findings) in parallel
    let codebaseOk = false;
    let npmOk = false;
    let auditOk = false;

    if (apiBase) {
      try {
        const [auditResp, codebaseResp, npmResp] = await Promise.allSettled([
          fetch(apiUrl("/simplebeacon/audit?npmAudit=1"), {
            headers: authHeaders(),
          }),
          fetch(apiUrl("/analyze/flexible"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({
              projectPath: scan?.projectPath || "CascadeProjects",
              analysisType: "codebase",
            }),
          }),
          fetch(apiUrl("/analyze/flexible"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({
              projectPath: scan?.projectPath || "CascadeProjects",
              analysisType: "npm-audit",
            }),
          }),
        ]);

        // Parse audit response — this is the primary source for security layers
        if (auditResp.status === "fulfilled" && auditResp.value.ok) {
          auditOk = true;
          const auditData = await auditResp.value.json();
          setServerAudit(auditData);
          // Extract npm audit from audit payload if present
          if (auditData.npmAudit) {
            setNpmAudit(auditData.npmAudit);
            npmOk = true;
          }
          // Extract security-relevant data from audit report
          const ar = auditData.report || {};
          if (!scan) {
            scan = {
              projectPath: ar.projectRoot || ar.projectPath || "",
              totalFiles: ar.totalFiles || 0,
              issueCount: ar.issueCount || 0,
              qualityScore: ar.qualityScore ?? undefined,
              severityCounts: ar.severityCounts || {},
              gate: ar.gate || {},
              timestamp: ar.generatedAt || new Date().toISOString(),
            };
          } else {
            // Merge server data with local
            scan = {
              ...scan,
              gate: scan.gate || ar.gate,
              severityCounts: scan.severityCounts || ar.severityCounts,
              totalFiles: scan.totalFiles || ar.totalFiles,
              issueCount: scan.issueCount || ar.issueCount,
              qualityScore: scan.qualityScore || ar.qualityScore,
            };
          }
        }

        // Parse codebase response for categories (still fetch for detailed categories)
        if (codebaseResp.status === "fulfilled" && codebaseResp.value.ok) {
          codebaseOk = true;
          const json = await codebaseResp.value.json();
          const r = json.report || {};
          scan = {
            ...scan,
            ...r,
            projectPath:
              scan?.projectPath || r.projectPath || r.projectRoot || "",
            categories: r.categories || scan?.categories || [],
            severityCounts:
              r.summary?.severityCounts || scan?.severityCounts || {},
            gate: r.gate || scan?.gate || {},
            totalFiles:
              r.summary?.repositoryFilesTotal || r.totalFiles || scan?.totalFiles,
            issueCount:
              r.summary?.findingsTotal || r.issueCount || scan?.issueCount,
            qualityScore:
              r.summary?.healthScore || r.qualityScore || scan?.qualityScore,
            scanScope: r.scanScope || scan?.scanScope,
            timestamp: r.generatedAt || new Date().toISOString(),
          };
        }

        // Parse npm audit response (fallback if audit endpoint didn't have it)
        if (!npmOk && npmResp.status === "fulfilled" && npmResp.value.ok) {
          npmOk = true;
          const json = await npmResp.value.json();
          const r = json.report || json;
          setNpmAudit(r._npmAuditAnalysis || r.npmAudit || r);
        }

        // If all API calls failed and we have no cached scan, surface an error
        if (!codebaseOk && !npmOk && !auditOk && !scan) {
          setError(
            "Security API unavailable. Ensure the ai-platform server is running.",
          );
        }
      } catch {
        if (!scan) {
          setError(
            "Failed to fetch security data. Check your connection to the local server.",
          );
        }
      }
    }

    // If we have local report data with raw issues, derive categories from it
    if (scan && !scan.categories && localReport) {
      const rawIssues = localReport.rawIssues || localReport.detectedIssues || [];
      if (rawIssues.length > 0) {
        scan = {
          ...scan,
          categories: deriveCategoriesFromIssues(rawIssues),
        };
      }
    }

    // If we have server audit data, derive categories from audit layers
    if (serverAudit && (!scan || !scan.categories)) {
      const auditCats = deriveCategoriesFromAuditLayers(serverAudit);
      if (auditCats.length > 0) {
        scan = scan
          ? { ...scan, categories: [...(scan.categories || []), ...auditCats] }
          : { categories: auditCats, gate: serverAudit.report?.gate || {} };
      }
    }

    setScanData(scan);
    setLoading(false);
  }, [serverAudit]);

  // simplebeacon-ignore: framework-practices
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const securityFindings = (scanData?.categories || []).filter(
    (c) =>
      SECURITY_CATEGORIES.has(c.category) ||
      SECURITY_CATEGORIES.has(c.category.toLowerCase()),
  );

  const securitySeverityCounts: Record<string, number> = {};
  for (const f of securityFindings) {
    const sev = f.severity || "info";
    securitySeverityCounts[sev] = (securitySeverityCounts[sev] || 0) + f.count;
  }

  const exportSecurityData = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      scanData,
      npmAudit,
      securityFindings,
      securitySeverityCounts,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = `security-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("SecurityView.tsx error:", err);
      // ignore
    }
  }, [scanData, npmAudit, securityFindings, securitySeverityCounts]);

  const totalSecurityFindings = securityFindings.reduce(
    (sum, f) => sum + f.count,
    0,
  );
  const vulnTotal =
    npmAudit?.vulnerabilities?.total ??
    npmAudit?.metadata?.vulnerabilities?.total ??
    0;
  const vulnBySev =
    npmAudit?.vulnerabilities?.bySeverity ??
    npmAudit?.metadata?.vulnerabilities ??
    {};

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Security</h1>
          <p className="text-foreground-muted">
            Security findings and vulnerability assessment
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
            <p className="text-sm text-foreground-muted">
              Analyzing security data…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Security</h1>
          <p className="text-foreground-muted">
            Security findings and vulnerability assessment
          </p>
          {scanData?.projectPath && (
            <p className="text-xs text-foreground-muted">
              {scanData.projectPath}
              {scanData.timestamp
                ? ` — ${new Date(scanData.timestamp).toLocaleString()}`
                : ""}
              {serverAudit && (
                <Badge variant="success" className="ml-2 text-xs">
                  Server audit
                </Badge>
              )}
            </p>
          )}
        </div>
        <div className="ml-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchData()}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportSecurityData()}
          >
            Export JSON
          </Button>
        </div>
      </div>

      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6">
            <Shield className="h-8 w-8 text-foreground-muted" />
            <span className="text-3xl font-bold">{totalSecurityFindings}</span>
            <span className="text-xs text-foreground-muted">
              Security Findings
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6">
            <Bug className="h-8 w-8 text-foreground-muted" />
            <span className="text-3xl font-bold">{vulnTotal}</span>
            <span className="text-xs text-foreground-muted">
              NPM Vulnerabilities
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6">
            <ShieldCheck className="h-8 w-8 text-foreground-muted" />
            <span className="text-3xl font-bold">
              {scanData?.gate?.pass === true
                ? "PASS"
                : scanData?.gate?.pass === false
                  ? "FAIL"
                  : "—"}
            </span>
            <span className="text-xs text-foreground-muted">Gate Status</span>
          </CardContent>
        </Card>
      </div>

      {/* Severity Breakdown */}
      {Object.keys(securitySeverityCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Security Severity Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {["critical", "high", "medium", "low", "info"]
                .filter((s) => securitySeverityCounts[s])
                .map((sev) => (
                  <div key={sev} className="flex items-center gap-2">
                    <Badge className={severityColor(sev)} variant="outline">
                      {sev}
                    </Badge>
                    <span className="text-sm font-medium">
                      {securitySeverityCounts[sev]}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Findings by Category */}
      {securityFindings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Security Issue Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {securityFindings
              .sort((a, b) => {
                const order: Record<string, number> = {
                  critical: 0,
                  high: 1,
                  medium: 2,
                  low: 3,
                  info: 4,
                };
                return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
              })
              .map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {categoryIcon(cat.category)}
                    <div>
                      <p className="text-sm font-medium">
                        {cat.label || cat.category}
                      </p>
                      {cat.fileCount != null && (
                        <p className="text-xs text-foreground-muted">
                          {cat.fileCount} file{cat.fileCount !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={severityColor(cat.severity)}
                      variant="outline"
                    >
                      {cat.severity}
                    </Badge>
                    <span className="text-sm font-bold">{cat.count}</span>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Security Audit Layers from Server */}
      {serverAudit?.auditLayers && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Security Audit Layers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(serverAudit.auditLayers)
              .filter(([key]) =>
                ["credentials", "productionLeaks", "securityPatterns", "schema", "jestBaseline"].includes(key)
              )
              .map(([key, layer]: [string, any]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {categoryIcon(key)}
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {layer.scanned != null
                          ? `${layer.scanned} scanned`
                          : layer.checked != null
                            ? `${layer.checked} checked`
                            : layer.label || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={severityColor(
                        layer.status === "pass"
                          ? "low"
                          : layer.status === "fail"
                            ? "high"
                            : "medium"
                      )}
                      variant="outline"
                    >
                      {layer.status || "—"}
                    </Badge>
                    {layer.findings != null && layer.findings > 0 && (
                      <span className="text-sm font-bold">{layer.findings}</span>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* NPM Audit */}
      {vulnTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Dependency Vulnerabilities (npm audit)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {["critical", "high", "moderate", "low", "info"]
                .filter((s) => vulnBySev[s])
                .map((sev) => (
                  <div key={sev} className="flex items-center gap-2">
                    <Badge
                      className={severityColor(
                        sev === "moderate" ? "medium" : sev,
                      )}
                      variant="outline"
                    >
                      {sev}
                    </Badge>
                    <span className="text-sm font-medium">
                      {vulnBySev[sev]}
                    </span>
                  </div>
                ))}
            </div>
            {npmAudit?.advisories && npmAudit.advisories.length > 0 && (
              <div className="space-y-2">
                {npmAudit.advisories.slice(0, 20).map((adv, i) => (
                  <div key={adv.id || i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {adv.title || adv.id || "Vulnerability"}
                      </span>
                      <Badge
                        className={severityColor(adv.severity || "info")}
                        variant="outline"
                      >
                        {adv.severity || "info"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-foreground-muted">
                      {adv.package && (
                        <span>
                          Package:{" "}
                          <code className="font-mono">{adv.package}</code>
                        </span>
                      )}
                      {adv.vulnerableVersions && (
                        <span>
                          Affected:{" "}
                          <code className="font-mono">
                            {adv.vulnerableVersions}
                          </code>
                        </span>
                      )}
                      {adv.patchedVersions && (
                        <span>
                          Patch:{" "}
                          <code className="font-mono">
                            {adv.patchedVersions}
                          </code>
                        </span>
                      )}
                    </div>
                    {adv.url && (
                      <a
                        href={adv.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-xs text-blue-500 hover:underline"
                      >
                        More info →
                      </a>
                    )}
                  </div>
                ))}
                {npmAudit.advisories.length > 20 && (
                  <p className="text-xs text-foreground-muted">
                    Showing 20 of {npmAudit.advisories.length} advisories
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No data */}
      {totalSecurityFindings === 0 && vulnTotal === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <ShieldCheck className="h-12 w-12 text-green-500" />
            <p className="text-sm font-medium">No security findings detected</p>
            <p className="text-xs text-foreground-muted">
              Run a scan to see security results
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchData()}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <AlertCircle className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">{error}</p>
            <Button size="sm" onClick={() => fetchData()} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {isEnterprise ? (
        <>
          <ProviderFailoverDashboard />
          <IdentityFederationDashboard />
          <SemanticCacheDashboard />
          <WebhookSigningDashboard />
          <AgenticOrchestrationDashboard />
          <ToolSchemaValidationDashboard />
          <StreamInterdictionDashboard />
          <QuarantineLogBrowser />
          <PolicySyncer />
          <PolicySyncHistory />
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Crown className="h-12 w-12 text-amber-500" />
            <h3 className="text-lg font-bold">
              Enterprise Security Operations
            </h3>
            <p className="text-sm text-foreground-muted text-center max-w-md">
              Provider failover, identity federation, semantic cache, webhook
              signing, agentic orchestration, and tool schema validation are
              available on the Enterprise plan.
            </p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => window.open("/pricing", "_blank")}
            >
              <Crown className="h-4 w-4 mr-2" /> Upgrade to Enterprise
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
