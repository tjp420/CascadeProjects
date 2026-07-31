import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { getApiBase, apiUrl, authHeaders } from '@/config';
import { PiiPolicyWorkspace } from '@/components/PiiPolicyWorkspace';
import { KeyRotationDashboard } from '@/components/KeyRotationDashboard';
import { EgressGuardrailWorkspace } from '@/components/EgressGuardrailWorkspace';
import { PermissionGate } from '@/components/PermissionGate';

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
  'database-patterns',
  'prototype-pollution',
  'token-bleed',
  'config-drift',
  'credentials',
  'production-leak',
  'security-patterns',
  'security-headers',
  'Broken or invalid files',
  'broken-or-invalid',
]);

function severityColor(sev: string): string {
  switch (sev.toLowerCase()) {
    case 'critical':
      return 'bg-red-500/15 text-red-500 border-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-500 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30';
    case 'low':
      return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
    default:
      return 'bg-gray-500/15 text-gray-500 border-gray-500/30';
  }
}

function categoryIcon(cat: string) {
  const c = cat.toLowerCase();
  if (c.includes('database')) return <Database className="h-4 w-4" />;
  if (c.includes('token') || c.includes('credential')) return <KeyRound className="h-4 w-4" />;
  if (c.includes('broken') || c.includes('invalid')) return <FileWarning className="h-4 w-4" />;
  if (c.includes('prototype') || c.includes('pollution'))
    return <ShieldAlert className="h-4 w-4" />;
  return <Lock className="h-4 w-4" />;
}

export function SecurityView() {
  const [scanData, setScanData] = useState<ScanResultData | null>(null);
  const [npmAudit, setNpmAudit] = useState<NpmAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiBase = getApiBase();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Load last scan summary from localStorage for basic info (projectPath, gate, etc.)
    let scan: ScanResultData | null = null;
    try {
      const stored = localStorage.getItem('sb_last_scan_full');
      if (stored) scan = JSON.parse(stored);
    } catch {
      /* ignore */
    }

    // Fetch codebase analysis (contains categories with security findings) and npm-audit in parallel
    {
      try {
        const [codebaseResp, npmResp] = await Promise.allSettled([
          fetch(apiUrl('/analyze/flexible'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              projectPath: scan?.projectPath || 'CascadeProjects',
              analysisType: 'codebase',
            }),
          }),
          fetch(apiUrl('/analyze/flexible'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              projectPath: scan?.projectPath || 'CascadeProjects',
              analysisType: 'npm-audit',
            }),
          }),
        ]);

        // Parse codebase response for categories
        if (codebaseResp.status === 'fulfilled' && codebaseResp.value.ok) {
          const json = await codebaseResp.value.json();
          const r = json.report || {};
          scan = {
            ...scan,
            ...r,
            projectPath: scan?.projectPath || r.projectPath || r.projectRoot || '',
            categories: r.categories || [],
            severityCounts: r.summary?.severityCounts || scan?.severityCounts || {},
            gate: r.gate || scan?.gate || {},
            totalFiles: r.summary?.repositoryFilesTotal || r.totalFiles || scan?.totalFiles,
            issueCount: r.summary?.findingsTotal || r.issueCount || scan?.issueCount,
            qualityScore: r.summary?.healthScore || r.qualityScore || scan?.qualityScore,
            scanScope: r.scanScope || scan?.scanScope,
            timestamp: r.generatedAt || new Date().toISOString(),
          };
        }

        // Parse npm audit response
        if (npmResp.status === 'fulfilled' && npmResp.value.ok) {
          const json = await npmResp.value.json();
          const r = json.report || json;
          setNpmAudit(r._npmAuditAnalysis || r.npmAudit || r);
        }
      } catch {
        // API errors are non-fatal
      }
    }

    setScanData(scan);
    setLoading(false);
  }, [apiBase]);

  // simplebeacon-ignore: framework-practices
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const securityFindings = (scanData?.categories || []).filter(
    (c) => SECURITY_CATEGORIES.has(c.category) || SECURITY_CATEGORIES.has(c.category.toLowerCase())
  );

  const securitySeverityCounts: Record<string, number> = {};
  for (const f of securityFindings) {
    const sev = f.severity || 'info';
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
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = `security-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // ignore
    }
  }, [scanData, npmAudit, securityFindings, securitySeverityCounts]);

  const totalSecurityFindings = securityFindings.reduce((sum, f) => sum + f.count, 0);
  const vulnTotal =
    npmAudit?.vulnerabilities?.total ?? npmAudit?.metadata?.vulnerabilities?.total ?? 0;
  const vulnBySev =
    npmAudit?.vulnerabilities?.bySeverity ?? npmAudit?.metadata?.vulnerabilities ?? {};

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Security</h1>
          <p className="text-foreground-muted">Security findings and vulnerability assessment</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <RefreshCw className="h-8 w-8 text-foreground-muted animate-spin" />
            <p className="text-sm text-foreground-muted">Analyzing security data…</p>
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
          <p className="text-foreground-muted">Security findings and vulnerability assessment</p>
          {scanData?.projectPath && (
            <p className="text-xs text-foreground-muted">
              {scanData.projectPath}
              {scanData.timestamp ? ` — ${new Date(scanData.timestamp).toLocaleString()}` : ''}
            </p>
          )}
        </div>
        <div className="ml-4">
          <Button size="sm" variant="outline" onClick={() => exportSecurityData()}>
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
            <span className="text-xs text-foreground-muted">Security Findings</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6">
            <Bug className="h-8 w-8 text-foreground-muted" />
            <span className="text-3xl font-bold">{vulnTotal}</span>
            <span className="text-xs text-foreground-muted">NPM Vulnerabilities</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6">
            <ShieldCheck className="h-8 w-8 text-foreground-muted" />
            <span className="text-3xl font-bold">
              {scanData?.gate?.pass === true
                ? 'PASS'
                : scanData?.gate?.pass === false
                  ? 'FAIL'
                  : '—'}
            </span>
            <span className="text-xs text-foreground-muted">Gate Status</span>
          </CardContent>
        </Card>
      </div>

      {/* Severity Breakdown */}
      {Object.keys(securitySeverityCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Security Severity Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {['critical', 'high', 'medium', 'low', 'info']
                .filter((s) => securitySeverityCounts[s])
                .map((sev) => (
                  <div key={sev} className="flex items-center gap-2">
                    <Badge className={severityColor(sev)} variant="outline">
                      {sev}
                    </Badge>
                    <span className="text-sm font-medium">{securitySeverityCounts[sev]}</span>
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
                      <p className="text-sm font-medium">{cat.label || cat.category}</p>
                      {cat.fileCount != null && (
                        <p className="text-xs text-foreground-muted">
                          {cat.fileCount} file{cat.fileCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={severityColor(cat.severity)} variant="outline">
                      {cat.severity}
                    </Badge>
                    <span className="text-sm font-bold">{cat.count}</span>
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
            <CardTitle className="text-lg">Dependency Vulnerabilities (npm audit)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {['critical', 'high', 'moderate', 'low', 'info']
                .filter((s) => vulnBySev[s])
                .map((sev) => (
                  <div key={sev} className="flex items-center gap-2">
                    <Badge
                      className={severityColor(sev === 'moderate' ? 'medium' : sev)}
                      variant="outline"
                    >
                      {sev}
                    </Badge>
                    <span className="text-sm font-medium">{vulnBySev[sev]}</span>
                  </div>
                ))}
            </div>
            {npmAudit?.advisories && npmAudit.advisories.length > 0 && (
              <div className="space-y-2">
                {npmAudit.advisories.slice(0, 20).map((adv, i) => (
                  <div key={adv.id || i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {adv.title || adv.id || 'Vulnerability'}
                      </span>
                      <Badge className={severityColor(adv.severity || 'info')} variant="outline">
                        {adv.severity || 'info'}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-foreground-muted">
                      {adv.package && (
                        <span>
                          Package: <code className="font-mono">{adv.package}</code>
                        </span>
                      )}
                      {adv.vulnerableVersions && (
                        <span>
                          Affected: <code className="font-mono">{adv.vulnerableVersions}</code>
                        </span>
                      )}
                      {adv.patchedVersions && (
                        <span>
                          Patch: <code className="font-mono">{adv.patchedVersions}</code>
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
            <p className="text-xs text-foreground-muted">Run a scan to see security results</p>
            <Button size="sm" variant="outline" onClick={() => fetchData()} className="mt-2">
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

      <PermissionGate permission="admin:all" fallback={null}>
        <PiiPolicyWorkspace />
      </PermissionGate>

      <PermissionGate permission="admin:all" fallback={null}>
        <KeyRotationDashboard />
      </PermissionGate>

      <PermissionGate permission="admin:all" fallback={null}>
        <EgressGuardrailWorkspace />
      </PermissionGate>
    </div>
  );
}
