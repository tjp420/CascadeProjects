import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    ClipboardCheck,
    Download,
    CheckCircle2,
    XCircle,
    AlertCircle,
    FileCode,
    AlertTriangle,
    Play,
    Upload,
    Shield,
    Layers,
    Info,
    FileText,
    ChevronRight,
    Gauge,
    Thermometer,
    Cpu,
    Zap,
    Activity,
    TrendingUp
} from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { useAuth } from '@/hooks/useAuth';
import { resolveScanLetterGrade } from '@/lib/gradeFromScore';
import { getLargeItem } from '@/utils/dbStorage';

// ── Types ───────────────────────────────────────────────────────────────────

interface SeverityCounts {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
}

interface GateInfo {
    pass: boolean;
    blockingCount: number;
    warningCount: number;
}

interface AuditLayer {
    status: 'pass' | 'warn' | 'fail' | string;
    findings: number;
    scanned: number | string;
    checked?: number | string;
    label?: string;
    compliance?: number;
    knownPatterns?: number;
    pageSamplesChecked?: number;
    pageSamplesPassed?: number;
}

interface AuditLayers {
    credentials?: AuditLayer;
    fictionKpis?: AuditLayer;
    schema?: AuditLayer;
    productionLeaks?: AuditLayer;
    roadmap?: AuditLayer;
    jestBaseline?: AuditLayer;
    securityPatterns?: AuditLayer;
    llmSlop?: AuditLayer;
    gate?: AuditLayer & GateInfo;
}

interface ComplianceRule {
    id: string;
    title: string;
    status: 'pass' | 'fail' | 'skip' | string;
}

interface ComplianceChecklist {
    rules?: ComplianceRule[];
    summary?: { passed: number; failed: number; skipped: number };
}

interface ExecutiveSummary {
    headline?: string;
    gateResult?: string;
    qualityScore?: number | null;
    filesScanned?: number;
    highIssues?: number;
    mediumIssues?: number;
    lowIssues?: number;
}

interface Assessment {
    generatedAt?: string;
    executiveSummary?: ExecutiveSummary;
    complianceChecklist?: ComplianceChecklist;
}

interface ScanScope {
    profile?: string;
    resultsViewScope?: string;
    rulesEnabled?: string[];
    productionPaths?: string[];
    limitations?: string[];
    mockSampleFilesInScanPaths?: number;
    productionDirsScanned?: number;
    ruleScopedFilesAnalyzed?: number;
    jestExecutedDuringScan?: boolean;
}

interface GateWarning {
    severity?: string;
    type?: string;
    id?: string;
    description?: string;
    filePath?: string;
    file?: string;
}

interface ScanResultData {
    totalFiles: number;
    issueCount: number;
    severityCounts: SeverityCounts;
    gate: GateInfo;
    qualityScore: number | null;
    projectPath: string;
    scanScope: ScanScope;
}

interface FullReport extends Omit<ScanResultData, 'scanScope'> {
    rawIssues?: any[];
    detectedIssues?: any[];
    consistencyScore?: number;
    schemaChecked?: number;
    schemaPassed?: number;
    pageSampleSchemaChecked?: number;
    pageSampleSchemaPassed?: number;
    filesAnalyzed?: number;
    mockSampleFiles?: number;
    generatedAt?: string;
    repositoryInventory?: { totalFiles: number; totalFolders: number; projectRoot: string };
    scanScope?: ScanScope;
    gateWarnings?: GateWarning[];
    warningIssues?: GateWarning[];
    auditLayers?: AuditLayers;
    assessment?: Assessment;
    fictionCatalog?: { pattern: string; patternType: string; severity: string }[];
    jestBaselinePassed?: boolean;
    jestBaselineChecked?: boolean;
    securityPatternFindings?: number;
    securityPatternFilesScanned?: number;
    llmSlopPatternHits?: number;
    llmSlopFilesScanned?: number;
    credentialScanned?: number;
    productionLeakScanned?: number;
    sourceCodeFilesScanned?: number;
    roadmapSchemaChecked?: number;
    letterGrade?: string;
    letter_grade?: string;
    benchmark?: BenchmarkData;
}

interface BenchmarkData {
    model?: string;
    profile?: string;
    runs?: number;
    avgTokPerSec?: number;
    minTokPerSec?: number;
    maxTokPerSec?: number;
    variancePct?: number;
    profileMin?: number;
    profileMax?: number;
    throttleThreshold?: number;
    numGpu?: number;
    cpuTemp?: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const LAYER_LABELS: Record<string, string> = {
    credentials: 'Credential patterns',
    fictionKpis: 'Fiction & KPI drift',
    schema: 'JSON schema & page samples',
    productionLeaks: 'Production path leaks',
    roadmap: 'Roadmap & duplicates',
    jestBaseline: 'Jest baseline',
    securityPatterns: 'Security patterns',
    llmSlop: 'LLM slop patterns',
    gate: 'Compliance gate'
};

const LAYER_ICONS: Record<string, typeof Shield> = {
    credentials: Shield,
    fictionKpis: AlertTriangle,
    schema: FileCode,
    productionLeaks: AlertCircle,
    roadmap: FileText,
    jestBaseline: CheckCircle2,
    securityPatterns: Shield,
    llmSlop: AlertTriangle
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function layerStatusClass(status: string): string {
    if (status === 'pass') return 'success';
    if (status === 'warn' || status === 'warning') return 'warning';
    if (status === 'fail') return 'danger';
    return 'secondary';
}

function formatNumber(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString();
}

function formatPercent(n: number | null | undefined): string {
    if (n == null) return '—';
    return `${Math.round(n)}%`;
}

function isSimplebeaconReport(data: any): boolean {
    return Boolean(
        data &&
        typeof data === 'object' &&
        (data.gate || data.rawIssues || data.detectedIssues || data.issueCount != null || data.totalFiles != null)
    );
}

/** Derive audit layers from a raw scan report (mirrors JS buildAuditFromReport). */
function deriveAuditLayers(report: FullReport): AuditLayers {
    const rawIssues = report.rawIssues || report.detectedIssues || [];
    const gate = report.gate || { pass: true, blockingCount: 0, warningCount: 0 };
    const issueCount = report.issueCount || rawIssues.length;

    const credIssues = rawIssues.filter(i => i.type === 'credential' || i.patternId === 'credential');
    const leakIssues = rawIssues.filter(
        i => i.type === 'production-leak' || i.patternId === 'production-leak' || i.type === 'productionLeak'
    );
    const fictionIssues = rawIssues.filter(
        i => i.type === 'fiction' || i.patternId === 'fiction' || i.type === 'fictionKpi'
    );
    const secIssues = rawIssues.filter(
        i => i.type === 'security' || i.patternId === 'security' || i.type === 'securityPattern'
    );
    const slopIssues = rawIssues.filter(
        i => i.type === 'llm-slop' || i.patternId === 'llm-slop' || i.type === 'llmSlop'
    );

    return {
        credentials: {
            status: credIssues.length ? 'fail' : 'pass',
            findings: credIssues.length,
            scanned: report.credentialScanned || 0
        },
        productionLeaks: {
            status: leakIssues.length ? 'fail' : 'pass',
            findings: leakIssues.length,
            scanned: report.productionLeakScanned || 0
        },
        fictionKpis: {
            status: fictionIssues.length ? 'fail' : 'pass',
            findings: fictionIssues.length,
            scanned: report.sourceCodeFilesScanned || 0
        },
        schema: {
            status: 'pass',
            findings: 0,
            scanned: report.schemaChecked || 0,
            pageSamplesChecked: report.pageSampleSchemaChecked,
            pageSamplesPassed: report.pageSampleSchemaPassed
        },
        roadmap: {
            status: 'pass',
            findings: 0,
            scanned: report.roadmapSchemaChecked || 0
        },
        jestBaseline: {
            status: report.jestBaselinePassed ? 'pass' : 'warn',
            findings: 0,
            scanned: report.jestBaselineChecked ? 1 : 0
        },
        securityPatterns: {
            status: secIssues.length ? 'fail' : 'pass',
            findings: report.securityPatternFindings || secIssues.length || 0,
            scanned: report.securityPatternFilesScanned || 0
        },
        llmSlop: {
            status: slopIssues.length ? 'fail' : 'pass',
            findings: report.llmSlopPatternHits || slopIssues.length || 0,
            scanned: report.llmSlopFilesScanned || 0
        },
        gate: {
            pass: gate.pass !== false,
            status: gate.pass ? 'pass' : 'fail',
            findings: issueCount,
            blockingCount: gate.blockingCount || 0,
            warningCount: gate.warningCount || 0,
            scanned: '—'
        }
    };
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({
    icon: Icon,
    label,
    value,
    variant = 'default'
}: {
    icon: typeof Shield;
    label: string;
    value: string;
    variant?: 'default' | 'success' | 'danger' | 'warning';
}) {
    const colorClass =
        variant === 'success'
            ? 'text-success'
            : variant === 'danger'
              ? 'text-danger'
              : variant === 'warning'
                ? 'text-warning'
                : 'text-info';
    return (
        <Card>
            <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Icon className={`h-5 w-5 ${colorClass}`} />
                </div>
                <div>
                    <p className="text-xs text-foreground-muted">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function LayerCard({ layerKey, layer }: { layerKey: string; layer: AuditLayer }) {
    const Icon = LAYER_ICONS[layerKey] || Layers;
    const status = layer.status || (layer.findings > 0 ? 'fail' : 'pass');
    const findings = layer.findings ?? '—';
    const scanned = layer.scanned ?? layer.checked ?? layer.label ?? '—';

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-foreground-muted" />
                        <CardTitle className="text-sm">{LAYER_LABELS[layerKey] || layerKey}</CardTitle>
                    </div>
                    <Badge variant={layerStatusClass(status) as any} className="text-xs">
                        {status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                    <span className="text-foreground-muted">Checked</span>
                    <span className="font-medium">{String(scanned)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-foreground-muted">Findings</span>
                    <span className="font-medium">{String(findings)}</span>
                </div>
                {layer.compliance != null && (
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Compliance</span>
                        <span className="font-medium">{formatPercent(layer.compliance)}</span>
                    </div>
                )}
                {layer.knownPatterns != null && (
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Known patterns</span>
                        <span className="font-medium">{layer.knownPatterns}</span>
                    </div>
                )}
                {layerKey === 'schema' && layer.pageSamplesChecked != null && (
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Page specs</span>
                        <span className="font-medium">
                            {layer.pageSamplesPassed ?? 0}/{layer.pageSamplesChecked}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function GateWarningsTable({ warnings }: { warnings: GateWarning[] }) {
    if (!warnings.length) return null;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h2 className="text-lg font-semibold">Gate warnings ({warnings.length})</h2>
            </div>
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-muted/50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">Severity</th>
                                    <th className="px-4 py-2 text-left font-medium">Type</th>
                                    <th className="px-4 py-2 text-left font-medium">Description</th>
                                    <th className="px-4 py-2 text-left font-medium">File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {warnings.map((w, i) => {
                                    const file = (w.filePath || w.file || '').split(/[\\/]/).pop() || '—';
                                    return (
                                        <tr key={i} className="border-b last:border-0">
                                            <td className="px-4 py-2">
                                                <Badge variant={(w.severity as any) || 'secondary'} className="text-xs">
                                                    {w.severity || 'low'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2">{w.type || w.id || '—'}</td>
                                            <td className="px-4 py-2">{w.description || '—'}</td>
                                            <td className="px-4 py-2 text-xs text-foreground-muted">{file}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function ScanScopeSection({ scope }: { scope: ScanScope }) {
    const profile = scope.profile || '—';
    const rules = (scope.rulesEnabled || []).join(', ') || '—';
    const prodPaths = (scope.productionPaths || []).join(', ') || '—';
    const limitations = scope.limitations || [];
    const mockFiles = scope.mockSampleFilesInScanPaths != null ? formatNumber(scope.mockSampleFilesInScanPaths) : '—';
    const prodDirs = scope.productionDirsScanned != null ? formatNumber(scope.productionDirsScanned) : '—';
    const ruleScoped = scope.ruleScopedFilesAnalyzed != null ? formatNumber(scope.ruleScopedFilesAnalyzed) : '—';
    const jestExecuted = scope.jestExecutedDuringScan ? 'Yes' : 'No';

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-info" />
                <h2 className="text-lg font-semibold">Scan scope</h2>
            </div>
            <Card>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Profile</span>
                        <span className="font-medium">{profile}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Rules enabled</span>
                        <span className="font-medium text-right">{rules}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Rule-scoped files</span>
                        <span className="font-medium">{ruleScoped}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Mock/sample files</span>
                        <span className="font-medium">{mockFiles}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Production dirs scanned</span>
                        <span className="font-medium">{prodDirs}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Jest executed</span>
                        <span className="font-medium">{jestExecuted}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-foreground-muted">Production paths</span>
                        <span className="font-medium text-xs">{prodPaths}</span>
                    </div>
                    {limitations.length > 0 && (
                        <div className="pt-2">
                            <p className="text-xs font-medium text-foreground-muted mb-1">Limitations</p>
                            <ul className="list-disc list-inside text-xs text-foreground-muted space-y-0.5">
                                {limitations.map((l, i) => (
                                    <li key={i}>{l}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function AssessmentSummary({ assessment }: { assessment: Assessment }) {
    const exec = assessment.executiveSummary;
    const checklist = assessment.complianceChecklist || {};
    const rules = checklist.rules || [];
    const summary = checklist.summary ?? { passed: 0, failed: 0, skipped: 0 };
    const generatedAt = assessment.generatedAt ? new Date(assessment.generatedAt).toLocaleString() : null;

    if (!exec) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-info" />
                    <h2 className="text-lg font-semibold">Assessment summary</h2>
                </div>
                {generatedAt && <span className="text-xs text-foreground-muted">Updated {generatedAt}</span>}
            </div>
            <Card>
                <CardContent className="space-y-4">
                    <p className="text-sm">{exec.headline || '—'}</p>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant={exec.gateResult === 'PASS' ? 'success' : 'warning'} className="gap-1">
                            {exec.gateResult || '—'}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <strong>{exec.qualityScore ?? '—'}</strong> quality
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <strong>{formatNumber(exec.filesScanned)}</strong> files
                        </Badge>
                        <Badge variant="danger" className="gap-1">
                            <strong>{exec.highIssues ?? 0}</strong> high
                        </Badge>
                        <Badge variant="warning" className="gap-1">
                            <strong>{exec.mediumIssues ?? 0}</strong> medium
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <strong>{exec.lowIssues ?? 0}</strong> low
                        </Badge>
                    </div>
                    {rules.length > 0 && (
                        <>
                            <p className="text-xs text-foreground-muted">
                                Corporate safety checklist — {summary.passed ?? 0} pass · {summary.failed ?? 0} fail ·{' '}
                                {summary.skipped ?? 0} skipped
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-muted/50">
                                        <tr>
                                            <th className="px-3 py-1.5 text-left font-medium">Rule</th>
                                            <th className="px-3 py-1.5 text-left font-medium">Title</th>
                                            <th className="px-3 py-1.5 text-left font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rules.slice(0, 8).map((rule, i) => (
                                            <tr key={i} className="border-b last:border-0">
                                                <td className="px-3 py-1.5">
                                                    <Badge
                                                        variant={
                                                            rule.status === 'pass'
                                                                ? 'success'
                                                                : rule.status === 'fail'
                                                                  ? 'danger'
                                                                  : 'secondary'
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {rule.status === 'pass'
                                                            ? '✓'
                                                            : rule.status === 'fail'
                                                              ? '✗'
                                                              : '○'}{' '}
                                                        {rule.id}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-1.5">{rule.title}</td>
                                                <td className="px-3 py-1.5">{rule.status || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {rules.length > 8 && (
                                <p className="text-xs text-foreground-muted">
                                    {rules.length - 8} more rules in the full report.
                                </p>
                            )}
                        </>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const blob = new Blob([JSON.stringify(assessment, null, 2)], {
                                    type: 'application/json'
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `simplebeacon-assessment-${new Date().toISOString().slice(0, 10)}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <Download className="h-4 w-4" /> Download assessment JSON
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function ImportReportSection({ onLoad }: { onLoad: (data: any) => void }) {
    const [pasteMode, setPasteMode] = useState(false);
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                if (!isSimplebeaconReport(parsed)) {
                    setError('File is not a recognized Simplebeacon report');
                    return;
                }
                setError(null);
                onLoad(parsed);
            } catch (err: any) {
                setError(`Failed to load report: ${err.message}`);
            }
        },
        [onLoad]
    );

    const handlePasteLoad = useCallback(() => {
        try {
            const parsed = JSON.parse(jsonText);
            if (!isSimplebeaconReport(parsed)) {
                setError('Pasted JSON is not a recognized Simplebeacon report');
                return;
            }
            setError(null);
            onLoad(parsed);
        } catch (err: any) {
            setError(`Invalid JSON: ${err.message}`);
        }
    }, [jsonText, onLoad]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4" /> Import Existing Report
                </CardTitle>
                <CardDescription>
                    Load a pre-generated report.json from the CLI for offline audit review
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Tabs value={pasteMode ? 'paste' : 'file'} onValueChange={v => setPasteMode(v === 'paste')}>
                    <TabsList>
                        <TabsTrigger value="file">Upload file</TabsTrigger>
                        <TabsTrigger value="paste">Paste JSON</TabsTrigger>
                    </TabsList>
                    <TabsContent value="file" className="space-y-3">
                        <div
                            className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 text-center cursor-pointer hover:border-muted-foreground/40 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileCode className="h-8 w-8 text-foreground-muted" />
                            <p className="text-sm text-foreground-muted">
                                Click to select a <code className="text-xs">report.json</code> file
                            </p>
                            <p className="text-xs text-foreground-muted">
                                Generate with:{' '}
                                <code className="text-xs">
                                    npx simplebeacon scan --gate --offline --format json --output=report.json
                                </code>
                            </p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            aria-label="Upload audit report JSON"
                            hidden
                            onChange={handleFile}
                        />
                    </TabsContent>
                    <TabsContent value="paste" className="space-y-3">
                        <Textarea
                            placeholder="Paste report JSON here..."
                            className="min-h-[120px] font-mono text-xs"
                            value={jsonText}
                            onChange={e => setJsonText(e.target.value)}
                        />
                        <Button size="sm" onClick={handlePasteLoad} disabled={!jsonText.trim()}>
                            <CheckCircle2 className="h-4 w-4" /> Load JSON Report
                        </Button>
                    </TabsContent>
                </Tabs>
                {error && (
                    <p className="text-sm text-danger flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4" /> {error}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function FictionCatalogSection({
    catalog,
    activeFindings
}: {
    catalog: { pattern: string; patternType: string; severity: string }[];
    activeFindings: number;
}) {
    if (!catalog.length) return null;
    const statusLine =
        activeFindings === 0
            ? 'Latest scan: 0 active fiction findings in KPI fields — gate passes.'
            : `Latest scan: ${activeFindings} active fiction finding(s) — review Results for details.`;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h2 className="text-lg font-semibold">
                    Fiction detection catalog ({catalog.length} baseline patterns)
                </h2>
            </div>
            <Card>
                <CardContent className="space-y-3">
                    <p className="text-sm text-foreground-muted">
                        These {catalog.length} baseline patterns are banned KPI values Simplebeacon detects and rejects.
                        They are not scan failures by themselves. {statusLine}
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-muted/50">
                                <tr>
                                    <th className="px-3 py-1.5 text-left font-medium">Pattern</th>
                                    <th className="px-3 py-1.5 text-left font-medium">Type</th>
                                    <th className="px-3 py-1.5 text-left font-medium">Severity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {catalog.slice(0, 12).map((entry, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        <td className="px-3 py-1.5">
                                            <code className="text-xs">{entry.pattern}</code>
                                        </td>
                                        <td className="px-3 py-1.5">{entry.patternType || '—'}</td>
                                        <td className="px-3 py-1.5">
                                            <Badge variant={(entry.severity as any) || 'secondary'} className="text-xs">
                                                {entry.severity}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {catalog.length > 12 && (
                        <p className="text-xs text-foreground-muted">
                            {catalog.length - 12} more baseline patterns documented in{' '}
                            <code className="text-xs">.simplebeacon/baseline.json</code>.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ── Telemetry / Benchmark section ───────────────────────────────────────────

function ThroughputBar({
    label,
    value,
    profileMin,
    profileMax,
    throttleThreshold
}: {
    label: string;
    value: number;
    profileMin: number;
    profileMax: number;
    throttleThreshold?: number;
}) {
    // Scale bars relative to profileMax (cap at 120% for visual headroom)
    const scaleMax = Math.max(profileMax, value) * 1.2;
    const widthPct = Math.min(100, (value / scaleMax) * 100);
    const minLinePct = (profileMin / scaleMax) * 100;
    const maxLinePct = (profileMax / scaleMax) * 100;
    const throttlePct = throttleThreshold ? (throttleThreshold / scaleMax) * 100 : 0;

    const isThrottled = throttleThreshold ? value < throttleThreshold : value < profileMin * 0.8;
    const barColor = isThrottled
        ? 'bg-danger'
        : value >= profileMax
          ? 'bg-success'
          : value >= profileMin
            ? 'bg-info'
            : 'bg-warning';

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-muted">{label}</span>
                <span className="font-bold tabular-nums">{value.toFixed(1)} tok/s</span>
            </div>
            <div className="relative h-6 rounded-md bg-muted overflow-hidden">
                {/* Throttle threshold zone */}
                {throttlePct > 0 && (
                    <div className="absolute inset-y-0 left-0 bg-danger/10" style={{ width: `${throttlePct}%` }} />
                )}
                {/* Profile minimum line */}
                <div
                    className="absolute inset-y-0 w-0.5 bg-warning/60"
                    style={{ left: `${minLinePct}%` }}
                    title={`Profile min: ${profileMin} tok/s`}
                />
                {/* Profile maximum line */}
                <div
                    className="absolute inset-y-0 w-0.5 bg-success/60"
                    style={{ left: `${maxLinePct}%` }}
                    title={`Profile max: ${profileMax} tok/s`}
                />
                {/* Actual throughput bar */}
                <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${widthPct}%` }} />
            </div>
        </div>
    );
}

function StatusGauge({
    label,
    value,
    unit,
    icon: Icon,
    status
}: {
    label: string;
    value: string;
    unit?: string;
    icon: typeof Gauge;
    status: 'success' | 'warning' | 'danger' | 'info';
}) {
    const colorMap: Record<string, string> = {
        success: 'text-success',
        warning: 'text-warning',
        danger: 'text-danger',
        info: 'text-info'
    };
    const bgMap: Record<string, string> = {
        success: 'bg-success/10 border-success/30',
        warning: 'bg-warning/10 border-warning/30',
        danger: 'bg-danger/10 border-danger/30',
        info: 'bg-info/10 border-info/30'
    };
    return (
        <div className={`rounded-lg border p-3 ${bgMap[status]}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${colorMap[status]}`} />
                <span className="text-xs text-foreground-muted">{label}</span>
            </div>
            <div className={`text-xl font-bold tabular-nums ${colorMap[status]}`}>
                {value}
                {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
            </div>
        </div>
    );
}

function TelemetrySection({
    benchmark: initialBenchmark,
    onRunBenchmark,
    onApplyProfile
}: {
    benchmark: BenchmarkData;
    onRunBenchmark?: () => Promise<BenchmarkData | null>;
    onApplyProfile?: (
        profile: string
    ) => Promise<{ oldProfile: string; newProfile: string; containerRestarted: boolean }>;
}) {
    const [liveBenchmark, setLiveBenchmark] = useState<BenchmarkData | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [runError, setRunError] = useState<string | null>(null);
    const [runElapsed, setRunElapsed] = useState<number | null>(null);
    const [isTuning, setIsTuning] = useState(false);
    const [tuneResult, setTuneResult] = useState<{
        oldProfile: string;
        newProfile: string;
        containerRestarted: boolean;
    } | null>(null);
    const [tuneError, setTuneError] = useState<string | null>(null);

    const benchmark = liveBenchmark || initialBenchmark;
    const avg = benchmark.avgTokPerSec ?? 0;
    const min = benchmark.minTokPerSec ?? avg;
    const max = benchmark.maxTokPerSec ?? avg;
    const profileMin = benchmark.profileMin ?? 0;
    const profileMax = benchmark.profileMax ?? 0;
    const throttleThreshold = benchmark.throttleThreshold;
    const variance = benchmark.variancePct ?? 0;
    const numGpu = benchmark.numGpu ?? 0;
    const cpuTemp = benchmark.cpuTemp;
    const runs = benchmark.runs ?? 0;
    const profile = benchmark.profile ?? 'unknown';
    const model = benchmark.model ?? 'unknown';

    // Determine the recommended downshift profile for auto-tune
    const recommendedProfile = profile === 'maximum' ? 'balanced' : 'minimal';

    const handleRunBenchmark = useCallback(async () => {
        if (!onRunBenchmark || isRunning) return;
        setIsRunning(true);
        setRunError(null);
        setRunElapsed(null);
        try {
            const result = await onRunBenchmark();
            if (result) {
                setLiveBenchmark(result);
                setRunElapsed(Date.now());
            } else {
                setRunError('Benchmark completed but returned no data');
            }
        } catch (err) {
            setRunError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsRunning(false);
        }
    }, [onRunBenchmark, isRunning]);

    const handleAutoTune = useCallback(async () => {
        if (!onApplyProfile || isTuning) return;
        setIsTuning(true);
        setTuneError(null);
        setTuneResult(null);
        try {
            const result = await onApplyProfile(recommendedProfile);
            setTuneResult(result);
            // After profile change, automatically re-run benchmark if available
            if (onRunBenchmark && result.containerRestarted) {
                setIsRunning(true);
                setRunError(null);
                try {
                    const benchResult = await onRunBenchmark();
                    if (benchResult) {
                        setLiveBenchmark(benchResult);
                        setRunElapsed(Date.now());
                    }
                } catch (err) {
                    setRunError(err instanceof Error ? err.message : String(err));
                } finally {
                    setIsRunning(false);
                }
            }
        } catch (err) {
            setTuneError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsTuning(false);
        }
    }, [onApplyProfile, isTuning, recommendedProfile, onRunBenchmark]);

    // Determine statuses
    const isThrottled = throttleThreshold ? avg < throttleThreshold : avg < profileMin * 0.8;
    const throughputStatus: 'success' | 'warning' | 'danger' = isThrottled
        ? 'danger'
        : avg >= profileMin
          ? 'success'
          : 'warning';

    const gpuActive = numGpu !== 0;
    const gpuThroughputOk = gpuActive && avg >= profileMin * 2;
    const gpuStatus: 'success' | 'warning' | 'info' = !gpuActive ? 'info' : gpuThroughputOk ? 'success' : 'warning';

    const varianceStatus: 'success' | 'warning' | 'danger' =
        variance > 20 ? 'danger' : variance > 10 ? 'warning' : 'success';

    const thermalStatus: 'success' | 'warning' | 'danger' | 'info' =
        cpuTemp == null ? 'info' : cpuTemp > 85 ? 'danger' : cpuTemp > 75 ? 'warning' : 'success';

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-info" />
                <h2 className="text-lg font-semibold">Air-gap Telemetry</h2>
                <Badge variant="outline" className="text-xs">
                    {profile} profile
                </Badge>
                {liveBenchmark && (
                    <Badge variant="info" className="text-xs">
                        Live
                    </Badge>
                )}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Throughput Benchmark</CardTitle>
                            <CardDescription>
                                {model} · {runs} run{runs !== 1 ? 's' : ''} · {profile} profile
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {onRunBenchmark && (
                                <Button variant="outline" size="sm" onClick={handleRunBenchmark} disabled={isRunning}>
                                    {isRunning ? (
                                        <>
                                            <Activity className="h-4 w-4 animate-pulse" />
                                            Running...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="h-4 w-4" />
                                            Execute Live Telemetry Run
                                        </>
                                    )}
                                </Button>
                            )}
                            <Badge
                                variant={
                                    throughputStatus === 'success'
                                        ? 'success'
                                        : throughputStatus === 'danger'
                                          ? 'danger'
                                          : 'warning'
                                }
                                className="text-sm"
                            >
                                {throughputStatus === 'success'
                                    ? 'Meets profile'
                                    : throughputStatus === 'danger'
                                      ? 'Throttled'
                                      : 'Below min'}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Live run status */}
                    {runError && (
                        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm">
                            <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold text-danger">Benchmark run failed</p>
                                <p className="text-xs text-foreground-muted mt-0.5 font-mono">{runError}</p>
                            </div>
                        </div>
                    )}
                    {liveBenchmark && runElapsed && (
                        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            <span className="text-success font-semibold">Live benchmark data loaded</span>
                            <span className="text-xs text-foreground-muted ml-auto">
                                {new Date(runElapsed).toLocaleTimeString()}
                            </span>
                        </div>
                    )}
                    {/* Throughput bars */}
                    <div className="space-y-3">
                        <ThroughputBar
                            label="Minimum"
                            value={min}
                            profileMin={profileMin}
                            profileMax={profileMax}
                            throttleThreshold={throttleThreshold}
                        />
                        <ThroughputBar
                            label="Average"
                            value={avg}
                            profileMin={profileMin}
                            profileMax={profileMax}
                            throttleThreshold={throttleThreshold}
                        />
                        <ThroughputBar
                            label="Maximum"
                            value={max}
                            profileMin={profileMin}
                            profileMax={profileMax}
                            throttleThreshold={throttleThreshold}
                        />
                    </div>

                    <Separator />

                    {/* Status gauges grid */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatusGauge
                            label="Avg Throughput"
                            value={avg.toFixed(1)}
                            unit="tok/s"
                            icon={Activity}
                            status={throughputStatus}
                        />
                        <StatusGauge
                            label="GPU Offload"
                            value={
                                numGpu === 0
                                    ? 'CPU only'
                                    : numGpu === -1 || numGpu > 900
                                      ? 'All layers'
                                      : `${numGpu} layer${numGpu !== 1 ? 's' : ''}`
                            }
                            icon={Cpu}
                            status={gpuStatus}
                        />
                        <StatusGauge
                            label="Variance (CoV)"
                            value={variance.toFixed(1)}
                            unit="%"
                            icon={TrendingUp}
                            status={varianceStatus}
                        />
                        <StatusGauge
                            label="CPU Temp"
                            value={cpuTemp != null ? cpuTemp.toFixed(1) : 'N/A'}
                            unit={cpuTemp != null ? '°C' : ''}
                            icon={Thermometer}
                            status={thermalStatus}
                        />
                    </div>

                    <Separator />

                    {/* Profile range reference */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-foreground-muted">
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-3 h-0.5 bg-warning/60" />
                            Profile min: {profileMin} tok/s
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-3 h-0.5 bg-success/60" />
                            Profile max: {profileMax} tok/s
                        </span>
                        {throttleThreshold != null && (
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 bg-danger/10 border border-danger/30" />
                                Throttle zone: &lt;{throttleThreshold} tok/s
                            </span>
                        )}
                        <span className="flex items-center gap-1.5">
                            <Zap className="h-3 w-3" />
                            {variance > 20
                                ? 'High variance — possible thread contention or thermal instability'
                                : variance > 10
                                  ? 'Moderate variance — monitor for degradation'
                                  : 'Stable throughput across runs'}
                        </span>
                    </div>

                    {/* Diagnostic flags */}
                    {isThrottled && (
                        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm">
                            <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold text-danger">Throughput below throttle threshold</p>
                                <p className="text-xs text-foreground-muted mt-0.5">
                                    Average {avg.toFixed(1)} tok/s is below 80% of {profile} minimum (
                                    {throttleThreshold ?? profileMin * 0.8} tok/s). Check for thermal throttling, GPU
                                    offload failure, or resource contention.
                                </p>
                                {onApplyProfile && profile !== 'minimal' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 border-danger/40 text-danger hover:bg-danger/10"
                                        onClick={handleAutoTune}
                                        disabled={isTuning || isRunning}
                                    >
                                        {isTuning ? (
                                            <>
                                                <Activity className="h-4 w-4 animate-pulse" />
                                                Tuning to {recommendedProfile}...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="h-4 w-4" />
                                                Auto-Tune to {recommendedProfile} profile
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                    {gpuActive && !gpuThroughputOk && avg > 0 && (
                        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                            <Cpu className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold text-warning">GPU offload may not be effective</p>
                                <p className="text-xs text-foreground-muted mt-0.5">
                                    GPU is configured (NUM_GPU={numGpu}) but throughput ({avg.toFixed(1)} tok/s) is in
                                    CPU-only range. Verify GPU drivers and Ollama GPU detection.
                                </p>
                            </div>
                        </div>
                    )}
                    {variance > 20 && runs > 1 && (
                        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                            <TrendingUp className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold text-warning">High variance across runs</p>
                                <p className="text-xs text-foreground-muted mt-0.5">
                                    Coefficient of variation is {variance.toFixed(1)}% (threshold: 20%). Possible thread
                                    contention, thermal instability, or background processes.
                                </p>
                            </div>
                        </div>
                    )}
                    {cpuTemp != null && cpuTemp > 85 && (
                        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm">
                            <Thermometer className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold text-danger">CPU thermal throttling likely</p>
                                <p className="text-xs text-foreground-muted mt-0.5">
                                    CPU temperature is {cpuTemp.toFixed(1)}°C (threshold: 85°C). Reduce workload,
                                    improve cooling, or switch to a lower quantization profile.
                                </p>
                                {onApplyProfile && profile !== 'minimal' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 border-danger/40 text-danger hover:bg-danger/10"
                                        onClick={handleAutoTune}
                                        disabled={isTuning || isRunning}
                                    >
                                        {isTuning ? (
                                            <>
                                                <Activity className="h-4 w-4 animate-pulse" />
                                                Switching to {recommendedProfile}...
                                            </>
                                        ) : (
                                            <>
                                                <Thermometer className="h-4 w-4" />
                                                Downshift to {recommendedProfile} profile
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Auto-tune result banner */}
                    {tuneResult && (
                        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold text-success">
                                    Profile changed: {tuneResult.oldProfile} → {tuneResult.newProfile}
                                </p>
                                <p className="text-xs text-foreground-muted mt-0.5">
                                    {tuneResult.containerRestarted
                                        ? 'Container restarted with new profile. Benchmark re-run automatically.'
                                        : 'Env file updated but container not restarted. Restart manually, then re-run benchmark.'}
                                </p>
                            </div>
                        </div>
                    )}
                    {tuneError && (
                        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm">
                            <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold text-danger">Auto-tune failed</p>
                                <p className="text-xs text-foreground-muted mt-0.5 font-mono">{tuneError}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AuditView() {
    const [result, setResult] = useState<ScanResultData | null>(null);
    const [fullReport, setFullReport] = useState<FullReport | null>(null);
    const [scanTime, setScanTime] = useState<string | null>(null);
    const [importedReport, setImportedReport] = useState<FullReport | null>(null);
    const { isFreeTier } = useAuth();

    // Load scan data from localStorage + IndexedDB
    // simplebeacon-ignore: framework-practices — standard React useEffect hook
    useEffect(() => {
        try {
            const full = localStorage.getItem('sb_last_scan_full');
            if (full) {
                setResult(JSON.parse(full));
            }
            const report = localStorage.getItem('sb_last_scan_report');
            if (report) {
                setFullReport(JSON.parse(report));
            }
            const time = localStorage.getItem('sb_last_scan_time');
            if (time) {
                setScanTime(new Date(time).toLocaleString());
            }
        } catch {
            /* ignore */
        }
    }, []);

    // Fall back to IndexedDB for large reports
    // simplebeacon-ignore: framework-practices — standard React useEffect hook
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const storageHint = localStorage.getItem('sb_last_scan_report_storage');
                const hasReport = !!localStorage.getItem('sb_last_scan_report');
                if (!hasReport && storageHint === 'indexeddb') {
                    const r = await getLargeItem<any>('sb_last_scan_report');
                    if (!cancelled && r) {
                        setFullReport(r);
                    }
                }
            } catch {
                // ignore
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Use imported report if provided, otherwise use stored data
    const activeReport = importedReport || fullReport;
    const activeResult = importedReport
        ? ({
              totalFiles: importedReport.totalFiles || 0,
              issueCount: importedReport.issueCount || 0,
              severityCounts: importedReport.severityCounts || {
                  critical: 0,
                  high: 0,
                  medium: 0,
                  low: 0,
                  info: 0
              },
              gate: importedReport.gate || { pass: false, blockingCount: 0, warningCount: 0 },
              qualityScore: importedReport.qualityScore ?? null,
              projectPath: importedReport.projectPath || '',
              scanScope: importedReport.scanScope || { profile: 'standard', resultsViewScope: 'browser-local' }
          } as ScanResultData)
        : result;

    // Derive audit layers from the full report
    const auditLayers = useMemo<AuditLayers>(() => {
        if (activeReport?.auditLayers) return activeReport.auditLayers;
        if (activeReport) return deriveAuditLayers(activeReport as FullReport);
        return {};
    }, [activeReport]);

    const gateWarnings = useMemo<GateWarning[]>(() => {
        return activeReport?.gateWarnings || activeReport?.warningIssues || [];
    }, [activeReport]);

    const scanScope = useMemo<ScanScope | null>(() => {
        return activeReport?.scanScope || null;
    }, [activeReport]);

    const assessment = useMemo<Assessment | null>(() => {
        return activeReport?.assessment || null;
    }, [activeReport]);

    const fictionCatalog = useMemo(() => {
        return activeReport?.fictionCatalog || [];
    }, [activeReport]);

    const letterGrade = useMemo(() => {
        return resolveScanLetterGrade(
            activeResult?.qualityScore ?? null,
            activeReport ? { letterGrade: activeReport.letterGrade, letter_grade: activeReport.letter_grade } : null
        );
    }, [activeResult, activeReport]);

    const consistencyScore = activeReport?.consistencyScore ?? null;

    const benchmark = useMemo<BenchmarkData | null>(() => {
        return activeReport?.benchmark ?? null;
    }, [activeReport]);

    const handleImport = useCallback((data: any) => {
        const report = data as FullReport;
        setImportedReport(report);
        // Also populate the lightweight result
        setResult({
            totalFiles: report.totalFiles || 0,
            issueCount: report.issueCount || 0,
            severityCounts: report.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
            gate: report.gate || { pass: false, blockingCount: 0, warningCount: 0 },
            qualityScore: report.qualityScore ?? null,
            projectPath: report.projectPath || report.projectPath || '',
            scanScope: {
                profile: report.scanScope?.profile || 'standard',
                resultsViewScope: report.scanScope?.resultsViewScope || 'browser-local',
                ...report.scanScope
            }
        });
        if (report.generatedAt) {
            setScanTime(new Date(report.generatedAt).toLocaleString());
        }
    }, []);

    const exportJson = useCallback(() => {
        if (!activeReport) {
            const blob = new Blob([JSON.stringify(activeResult, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `simplebeacon-audit-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            return;
        }
        if (isFreeTier) {
            alert('Export disabled for free-tier accounts — upgrade to Pro to download full reports.');
            return;
        }
        const blob = new Blob([JSON.stringify(activeReport, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simplebeacon-audit-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [activeReport, activeResult, isFreeTier]);

    // Execute a live air-gap benchmark via the VS Code extension data server
    const handleRunBenchmark = useCallback(async (): Promise<BenchmarkData | null> => {
        const response = await fetch('/api/airgap/benchmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.detail || `HTTP ${response.status}`);
        }
        if (!data.success || !data.benchmark) {
            throw new Error(data.message || data.error || 'Benchmark returned no data');
        }
        return data.benchmark as BenchmarkData;
    }, []);

    // Apply a new memory profile to the air-gap deployment
    const handleApplyProfile = useCallback(
        async (
            targetProfile: string
        ): Promise<{ oldProfile: string; newProfile: string; containerRestarted: boolean }> => {
            const response = await fetch('/api/airgap/apply-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile: targetProfile })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || data.detail || `HTTP ${response.status}`);
            }
            return {
                oldProfile: data.oldProfile || 'unknown',
                newProfile: data.newProfile || targetProfile,
                containerRestarted: !!data.containerRestarted
            };
        },
        []
    );

    // ── Empty state ──────────────────────────────────────────────────────────

    if (!activeResult && !importedReport) {
        return (
            <div className="mx-auto max-w-5xl p-6 space-y-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Audit Report</h1>
                    <p className="text-foreground-muted">
                        Compliance audit with gate status, audit layers, and export options
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                        <ClipboardCheck className="h-12 w-12 text-foreground-muted" />
                        <p className="text-sm text-foreground-muted">No scan results loaded</p>
                        <p className="text-xs text-foreground-muted">
                            Run a scan from the Analyze page or import a report below
                        </p>
                        <Button className="mt-2" onClick={() => navigate('analyze')}>
                            <Play className="h-4 w-4" /> Go to Analyze
                        </Button>
                    </CardContent>
                </Card>
                <ImportReportSection onLoad={handleImport} />
            </div>
        );
    }

    // ── Main render ──────────────────────────────────────────────────────────

    const displayReport = activeReport || (activeResult as any);
    const layers = auditLayers;
    const gate = activeResult?.gate || { pass: false, blockingCount: 0, warningCount: 0 };
    const layerEntries = Object.entries(layers).filter(([k]) => k !== 'gate');
    const fictionActiveFindings = layers.fictionKpis?.findings ?? 0;

    return (
        <div className="mx-auto max-w-5xl p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Audit Report</h1>
                <p className="text-foreground-muted">
                    {activeResult?.projectPath || '—'}
                    {scanTime && <span className="ml-2 text-xs">— {scanTime}</span>}
                    {importedReport && (
                        <Badge variant="info" className="ml-2 text-xs">
                            Imported
                        </Badge>
                    )}
                </p>
            </div>

            {/* Top metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    icon={gate.pass ? CheckCircle2 : XCircle}
                    label="Gate Status"
                    value={gate.pass ? 'PASS' : 'FAIL'}
                    variant={gate.pass ? 'success' : 'danger'}
                />
                <MetricCard
                    icon={ClipboardCheck}
                    label="Quality Score"
                    value={
                        activeResult?.qualityScore != null
                            ? `${activeResult.qualityScore}% (${letterGrade})`
                            : `— (${letterGrade})`
                    }
                />
                <MetricCard icon={FileCode} label="Files Scanned" value={formatNumber(activeResult?.totalFiles)} />
                <MetricCard
                    icon={AlertTriangle}
                    label="Issues Found"
                    value={String(activeResult?.issueCount ?? 0)}
                    variant={(activeResult?.issueCount ?? 0) > 0 ? 'warning' : 'success'}
                />
            </div>

            {/* Gate status card with severity breakdown */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Gate Status</CardTitle>
                            <CardDescription>Deterministic gate scan results</CardDescription>
                        </div>
                        <Badge variant={gate.pass ? 'success' : 'danger'} className="text-sm">
                            {gate.pass ? 'PASS' : 'FAIL'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-2">
                            <FileCode className="h-5 w-5 text-info" />
                            <div>
                                <p className="text-xs text-foreground-muted">Files Scanned</p>
                                <p className="text-lg font-bold">{formatNumber(activeResult?.totalFiles)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-warning" />
                            <div>
                                <p className="text-xs text-foreground-muted">Issues Found</p>
                                <p className="text-lg font-bold">{activeResult?.issueCount ?? 0}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {gate.pass ? (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                                <XCircle className="h-5 w-5 text-danger" />
                            )}
                            <div>
                                <p className="text-xs text-foreground-muted">Blocking / Warnings</p>
                                <p className="text-lg font-bold">
                                    {gate.blockingCount} / {gate.warningCount}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-info" />
                            <div>
                                <p className="text-xs text-foreground-muted">Quality / Grade</p>
                                <p className="text-lg font-bold">
                                    {activeResult?.qualityScore != null ? `${activeResult.qualityScore}%` : '—'}{' '}
                                    <span className="text-sm text-foreground-muted">({letterGrade})</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {consistencyScore != null && (
                        <>
                            <Separator />
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-foreground-muted">Consistency score:</span>
                                <span className="font-bold">{formatPercent(consistencyScore)}</span>
                            </div>
                        </>
                    )}

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                        {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => (
                            <Badge
                                key={sev}
                                variant={
                                    sev === 'critical'
                                        ? 'danger'
                                        : sev === 'high'
                                          ? 'warning'
                                          : sev === 'medium'
                                            ? 'info'
                                            : sev === 'low'
                                              ? 'secondary'
                                              : 'outline'
                                }
                                className="capitalize gap-1.5"
                            >
                                {sev}: {activeResult?.severityCounts?.[sev] || 0}
                            </Badge>
                        ))}
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm" onClick={exportJson}>
                            <Download className="h-4 w-4" /> Export JSON
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate('results')}>
                            <FileCode className="h-4 w-4" /> View Full Results
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate('analyze')}>
                            <Play className="h-4 w-4" /> New Scan
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Assessment summary */}
            {assessment ? (
                <AssessmentSummary assessment={assessment} />
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                        <div className="text-3xl">📋</div>
                        <p className="text-sm font-semibold">No assessment generated yet</p>
                        <p className="text-xs text-foreground-muted">
                            Run assessment from the CLI to generate the executive summary and compliance checklist.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Audit layers */}
            {layerEntries.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-info" />
                        <h2 className="text-lg font-semibold">Audit layers</h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {layerEntries.map(([key, layer]) => (
                            <LayerCard key={key} layerKey={key} layer={layer} />
                        ))}
                    </div>
                </div>
            )}

            {/* Scan scope */}
            {scanScope && <ScanScopeSection scope={scanScope} />}

            {/* Gate warnings */}
            {gateWarnings.length > 0 && <GateWarningsTable warnings={gateWarnings} />}

            {/* Fiction catalog */}
            {fictionCatalog.length > 0 && (
                <FictionCatalogSection catalog={fictionCatalog} activeFindings={fictionActiveFindings} />
            )}

            {/* Air-gap telemetry / benchmark */}
            {benchmark && (
                <TelemetrySection
                    benchmark={benchmark}
                    onRunBenchmark={handleRunBenchmark}
                    onApplyProfile={handleApplyProfile}
                />
            )}

            {/* Import section (always available at bottom for loading alternative reports) */}
            {!importedReport && <ImportReportSection onLoad={handleImport} />}
        </div>
    );
}
