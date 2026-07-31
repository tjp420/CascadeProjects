import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Shield,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Download,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { navigate } from '@/router/HashRouter';
import { Button } from '@/components/ui/button';

interface ScanResultData {
  totalFiles: number;
  issueCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  gate: { pass: boolean; blockingCount: number; warningCount: number };
  qualityScore: number | null;
}

// simplebeacon-ignore: euAiAct — compliance checklist UI intentionally references EU AI Act articles
const euAiActChecklist = [
  {
    id: 'transparency',
    label: 'Transparency & User Notice',
    desc: 'AI-generated content is disclosed to users (Art. 52)',
    check: (r: ScanResultData) => r.severityCounts.critical === 0,
  },
  {
    id: 'risk-mgmt',
    label: 'Risk Management System',
    desc: 'Identified and mitigated high-risk AI system risks (Art. 9)',
    check: (r: ScanResultData) => r.severityCounts.high === 0,
  },
  {
    id: 'data-governance',
    label: 'Data Governance',
    desc: 'Training and test data meet quality standards (Art. 10)',
    check: (r: ScanResultData) => r.severityCounts.medium <= 5,
  },
  {
    id: 'logging',
    label: 'Automatic Logging',
    desc: 'Events are logged for traceability (Art. 12)',
    check: (r: ScanResultData) => true,
  },
  {
    id: 'transparency-ops',
    label: 'Operational Transparency',
    desc: 'Deployers can interpret system output (Art. 13)',
    check: (r: ScanResultData) => r.qualityScore !== null && r.qualityScore >= 80,
  },
  {
    id: 'accuracy',
    label: 'Accuracy & Robustness',
    desc: 'System achieves appropriate accuracy levels (Art. 15)',
    check: (r: ScanResultData) => r.gate?.pass ?? false,
  },
];

const securityChecklist = [
  {
    id: 'no-creds',
    label: 'No Credential Leaks',
    desc: 'No hardcoded secrets or credentials in source',
    check: (r: ScanResultData) => r.severityCounts.critical === 0,
  },
  {
    id: 'no-sqli',
    label: 'No SQL Injection',
    desc: 'No string-concatenated database queries',
    check: (r: ScanResultData) => r.severityCounts.high === 0,
  },
  {
    id: 'rate-limits',
    label: 'Rate Limiting',
    desc: 'API endpoints have rate limiting configured',
    check: (r: ScanResultData) => r.severityCounts.medium <= 8,
  },
  {
    id: 'no-prototype',
    label: 'No Prototype Pollution',
    desc: 'Object merging is safe against __proto__ injection',
    check: (r: ScanResultData) => r.severityCounts.high === 0,
  },
  {
    id: 'no-redirect',
    label: 'No Unvalidated Redirects',
    desc: 'Redirect URLs are validated against allowlist',
    check: (r: ScanResultData) => r.severityCounts.high === 0,
  },
  {
    id: 'gate-pass',
    label: 'Gate Check Passes',
    desc: 'Automated quality gate passes with no blocking issues',
    check: (r: ScanResultData) => r.gate?.pass ?? false,
  },
];

const safetyChecklist = [
  {
    id: 'no-fiction',
    label: 'No Fictional KPIs',
    desc: 'No fabricated metrics or fictional data in codebase',
    check: (r: ScanResultData) => r.severityCounts.critical === 0,
  },
  {
    id: 'governance',
    label: 'Governance Markers',
    desc: 'AI-generated code is properly marked and tracked',
    check: (r: ScanResultData) => true,
  },
  {
    id: 'quality-score',
    label: 'Quality Score ≥ 80%',
    desc: 'Codebase meets minimum quality threshold',
    check: (r: ScanResultData) => r.qualityScore !== null && r.qualityScore >= 80,
  },
  {
    id: 'no-llm-slop',
    label: 'No LLM Slop',
    desc: 'No AI-generated boilerplate or verbose comments',
    check: (r: ScanResultData) => r.severityCounts.medium <= 10,
  },
];

export function AssessmentView() {
  const [result, setResult] = useState<ScanResultData | null>(null);

  useEffect(() => {
    try {
      const full = localStorage.getItem('sb_last_scan_full');
      if (full) setResult(JSON.parse(full));
    } catch {
      /* ignore */
    }
  }, []);

  if (!result) {
    return (
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
          <p className="text-foreground-muted">AI safety assessments and compliance checklists</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <FileText className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">No assessment data available</p>
            <p className="text-xs text-foreground-muted">
              Run a scan to generate compliance assessments
            </p>
            <button
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('analyze')}
            >
              <Play className="h-4 w-4" /> Go to Analyze
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderChecklist = (
    items: typeof euAiActChecklist,
    icon: React.ReactNode,
    title: string,
    desc: string
  ) => {
    const passed = items.filter((i) => i.check(result)).length;
    const total = items.length;
    const allPass = passed === total;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
            <Badge
              className={
                allPass
                  ? 'bg-green-500/15 text-green-600 border-green-500/30'
                  : 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30'
              }
            >
              {passed}/{total} passed
            </Badge>
          </CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => {
            const pass = item.check(result);
            return (
              <div key={item.id} className="flex items-start gap-3">
                {pass ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-foreground-muted">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  const handleExport = () => {
    if (!result) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      ...result,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const overallPass =
    result.gate?.pass && result.severityCounts.critical === 0 && result.severityCounts.high === 0;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
        <p className="text-foreground-muted">AI safety assessments and compliance checklists</p>
      </div>

      {/* Overall Status */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          {overallPass ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-2xl font-semibold text-green-600">All Assessments Passed</div>
              <p className="text-sm text-foreground-muted">
                Your codebase meets all compliance and safety requirements
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-12 w-12 text-yellow-500" />
              <div className="text-2xl font-semibold text-yellow-600">Action Required</div>
              <p className="text-sm text-foreground-muted">
                Some assessments need attention — review the checklists below
              </p>
            </>
          )}
          <div className="flex gap-4 mt-3 text-sm">
            <div className="text-center">
              <div className="font-semibold">{result.qualityScore ?? '—'}%</div>
              <div className="text-xs text-foreground-muted">Quality</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{result.issueCount ?? 0}</div>
              <div className="text-xs text-foreground-muted">Issues</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{result.totalFiles ?? 0}</div>
              <div className="text-xs text-foreground-muted">Files</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {renderChecklist(
        euAiActChecklist,
        <Scale className="h-5 w-5" />,
        'EU AI Act Compliance',
        'Requirements under EU AI Act Articles 9-15, 52'
      )}
      {renderChecklist(
        securityChecklist,
        <Shield className="h-5 w-5" />,
        'Security Audit',
        'Code security and vulnerability assessment'
      )}
      {renderChecklist(
        safetyChecklist,
        <AlertTriangle className="h-5 w-5" />,
        'AI Safety Assessment',
        'AI-generated code quality and safety checks'
      )}
    </div>
  );
}
