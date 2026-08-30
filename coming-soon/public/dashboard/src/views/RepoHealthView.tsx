import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  RefreshCw,
  AlertCircle,
  FileCode,
  FolderTree,
  Gauge,
  Shield,
  FileText,
  Bug,
  Zap,
  Download,
} from "lucide-react";
import { getApiBase, apiUrl, authHeaders, waitForApiBase, isTokenExpired } from "@/config";
import { useAuth } from "@/hooks/useAuth";

type CategoryInfo = {
  category: string;
  label: string;
  count: number;
  severity: string;
  fileCount: number;
  topFiles: string[];
};

type Summary = {
  repositoryFilesTotal: number;
  repositoryFoldersTotal: number;
  codeFilesAnalyzed: number;
  codeFilesDiscovered: number;
  findingsTotal: number;
  healthScore: number;
  severityCounts: Record<string, number>;
  tierCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  eslintErrors: number;
  eslintWarnings: number;
  eslintSource: string;
  governanceFiles: {
    licenseCount: number;
    securityCount: number;
    packageJsonCount: number;
  };
  analyzerCounts: Record<string, number>;
};

type RepoHealthData = {
  projectRoot: string;
  summary: Summary;
  categories: CategoryInfo[];
  repositoryInventory: {
    projectRoot: string;
    totalFiles: number;
    totalFolders: number;
    profile: string;
  };
  structureInsights: {
    summary: {
      sampledFiles: number;
      byLanguage: Record<string, number>;
      approximateFunctions: number;
      approximateClasses: number;
      tier: string;
    };
  };
  generatedAt: string;
};

export function RepoHealthView() {
  const [data, setData] = useState<RepoHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiBase = getApiBase();
  const { isAuthenticated } = useAuth();

  const fetchData = useCallback(async () => {
    // Skip API calls if not authenticated — prevents 401 spam on mount
    if (!isAuthenticated || isTokenExpired()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await waitForApiBase();
      const resp = await fetch(apiUrl("/analyze/flexible"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          projectPath: "CascadeProjects",
          analysisType: "codebase",
        }),
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const json = await resp.json();
      const r = json.report || json || {};
      const s = r.summary || {};
      const scope = r.scanScope || json.scanScope || {};
      const inv = r.repositoryInventory || {};
      setData({
        projectRoot: r.projectRoot || r.projectPath || json.projectPath || "",
        summary: {
          ...s,
          healthScore:
            s.healthScore ?? json.qualityScore ?? r.qualityScore ?? 0,
          findingsTotal:
            s.findingsTotal ?? json.issueCount ?? r.issueCount ?? 0,
          codeFilesAnalyzed:
            s.codeFilesAnalyzed ?? scope.codeFilesAnalyzed ?? 0,
          codeFilesDiscovered: s.codeFilesDiscovered ?? 0,
          repositoryFilesTotal: s.repositoryFilesTotal ?? inv.totalFiles ?? 0,
          repositoryFoldersTotal:
            s.repositoryFoldersTotal ?? inv.totalFolders ?? 0,
          severityCounts:
            s.severityCounts || json.severityCounts || r.severityCounts || {},
          tierCounts: s.tierCounts || {},
          categoryCounts: s.categoryCounts || {},
          eslintErrors: s.eslintErrors || 0,
          eslintWarnings: s.eslintWarnings || 0,
          eslintSource: s.eslintSource || "",
          governanceFiles: s.governanceFiles || {
            licenseCount: 0,
            securityCount: 0,
            packageJsonCount: 0,
          },
          analyzerCounts: s.analyzerCounts || {},
        } as Summary,
        categories: r.categories || [],
        repositoryInventory: inv || {
          projectRoot: "",
          totalFiles: 0,
          totalFolders: 0,
          profile: "",
        },
        structureInsights: r.structureInsights || {
          summary: {
            sampledFiles: 0,
            byLanguage: {},
            approximateFunctions: 0,
            approximateClasses: 0,
            tier: "baseline",
          },
        },
        generatedAt: r.generatedAt || json.generatedAt || "",
      });
    } catch {
      setError(
        "Failed to fetch repository health data. Ensure the ai-platform server is running.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // simplebeacon-ignore: framework-practices
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fmtDate = (s: string) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  const handleExport = () => {
    if (!data) return;
    const payload = { exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const root = (data.projectRoot || "repository")
      .replace(/[\/:\\\s]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const name = `repository-health-${root || "repo"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Repository Health
          </h1>
          <p className="text-foreground-muted">
            Repository structure, dependencies, and health metrics
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
            <p className="text-sm text-foreground-muted">
              Analyzing repository…
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
          <h1 className="text-3xl font-bold tracking-tight">
            Repository Health
          </h1>
          <p className="text-foreground-muted">
            Repository structure, dependencies, and health metrics
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
          <h1 className="text-3xl font-bold tracking-tight">
            Repository Health
          </h1>
          <p className="text-foreground-muted">
            Repository structure, dependencies, and health metrics
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Package className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">
              No repository health data available
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data.summary;
  const inv = data.repositoryInventory;
  const si = data.structureInsights?.summary;
  const topCategories = (data.categories || [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Repository Health
            </h1>
            <p className="text-foreground-muted">
              Repository structure, dependencies, and health metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export JSON
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fetchData()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-foreground-muted">
          {data.projectRoot} — {fmtDate(data.generatedAt)}
        </p>
      </div>

      {/* Health Score & Key Metrics */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            <CardTitle className="text-base">Health Overview</CardTitle>
          </div>
          <Badge
            variant={
              s.healthScore >= 80
                ? "default"
                : s.healthScore >= 60
                  ? "outline"
                  : "destructive"
            }
          >
            Score: {s.healthScore}%
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <FileCode className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-xs text-foreground-muted">Total Files</div>
                <div className="font-semibold">
                  {(
                    inv.totalFiles ||
                    s.repositoryFilesTotal ||
                    0
                  ).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FolderTree className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-xs text-foreground-muted">Folders</div>
                <div className="font-semibold">
                  {(
                    inv.totalFolders ||
                    s.repositoryFoldersTotal ||
                    0
                  ).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Bug className="h-8 w-8 text-orange-500" />
              <div>
                <div className="text-xs text-foreground-muted">Findings</div>
                <div className="font-semibold">{s.findingsTotal || 0}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-xs text-foreground-muted">
                  Code Analyzed
                </div>
                <div className="font-semibold">{s.codeFilesAnalyzed || 0}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Severity Breakdown */}
      {s.severityCounts && Object.keys(s.severityCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Severity Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(s.severityCounts)
                .sort(([a], [b]) => {
                  const order: Record<string, number> = {
                    critical: 0,
                    high: 1,
                    medium: 2,
                    low: 3,
                    info: 4,
                  };
                  return (order[a] ?? 5) - (order[b] ?? 5);
                })
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center gap-2 rounded-md border px-3 py-2"
                  >
                    <Badge
                      variant={
                        k === "critical" || k === "high"
                          ? "destructive"
                          : "outline"
                      }
                      className="capitalize"
                    >
                      {k}
                    </Badge>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Governance Files */}
      {s.governanceFiles && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle className="text-base">
                Governance & Dependencies
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-foreground-muted">
                  License Files
                </div>
                <div className="font-semibold">
                  {s.governanceFiles.licenseCount || 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-foreground-muted">
                  Security Files
                </div>
                <div className="font-semibold">
                  {s.governanceFiles.securityCount || 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-foreground-muted">
                  package.json Files
                </div>
                <div className="font-semibold">
                  {s.governanceFiles.packageJsonCount || 0}
                </div>
              </div>
            </div>
            {s.eslintSource && (
              <div className="mt-3 text-xs text-foreground-muted">
                ESLint: {s.eslintErrors} errors, {s.eslintWarnings} warnings
                (source: {s.eslintSource})
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Structure Insights */}
      {si && si.byLanguage && Object.keys(si.byLanguage).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <CardTitle className="text-base">Structure Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-foreground-muted">
                  Sampled Files
                </div>
                <div className="font-semibold">{si.sampledFiles}</div>
              </div>
              <div>
                <div className="text-xs text-foreground-muted">
                  Approx Functions
                </div>
                <div className="font-semibold">{si.approximateFunctions}</div>
              </div>
              <div>
                <div className="text-xs text-foreground-muted">
                  Approx Classes
                </div>
                <div className="font-semibold">{si.approximateClasses}</div>
              </div>
              <div>
                <div className="text-xs text-foreground-muted">Tier</div>
                <div className="font-semibold capitalize">{si.tier}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted mb-1">
                Languages Detected
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(si.byLanguage)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([lang, count]) => (
                    <Badge key={lang} variant="secondary" className="text-xs">
                      {lang}: {count}
                    </Badge>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Categories */}
      {topCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topCategories.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        cat.severity === "critical" || cat.severity === "high"
                          ? "destructive"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {cat.severity}
                    </Badge>
                    <span className="text-sm font-medium">
                      {cat.label || cat.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-foreground-muted">
                    <span>{cat.count} findings</span>
                    <span>{cat.fileCount} files</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier Distribution */}
      {s.tierCounts && Object.keys(s.tierCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(s.tierCounts).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
                  <Badge variant="secondary" className="capitalize">
                    {k}
                  </Badge>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
