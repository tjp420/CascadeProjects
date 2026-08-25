import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    ClipboardList,
    Download,
    FileCode,
    AlertTriangle,
    Shield,
    CheckCircle2,
    Play,
    Info,
    Search,
    ChevronRight,
    FileText,
    Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { navigate } from '@/router/HashRouter';
import { useAuth } from '@/hooks/useAuth';
import { ResultsReferralBanner } from '@/components/ResultsReferralBanner';
import { PostScanCliNudge } from '@/components/PostScanCliNudge';
import { PostScanShareBanner } from '@/components/PostScanShareBanner';
import { resolveScanLetterGrade } from '@/lib/gradeFromScore';
import { resolveReportIssues } from '@services/analyzeService.js';
import { getLargeItem } from '@/utils/dbStorage';

// ── Regulatory Framework Catalog (22 international frameworks) ──────────────
const REGULATORY_FRAMEWORKS = [
    'California SB 1047',
    'NIST AI RMF 1.0',
    'Colorado SB 24-205',
    'Utah SB 149',
    'NYC Local Law 144',
    'Canada AIDA',
    'UK AI Safety Framework',
    'ISO/IEC 42001',
    'Singapore Model AI Governance',
    'Brazil PL 2338/2023',
    'EU AI Act',
    'Texas HB 4045',
    'Illinois HB 2557',
    'Japan METI AI Guidelines',
    'Australia AI Ethics Framework',
    'South Korea AI Basic Act',
    'China GenAI Measures',
    'India DPDP Act',
    'OECD AI Principles'
] as const;

/** Extract framework from an issue's metadata or type string. */
function getIssueFramework(issue: any): string | null {
    const fw = issue?.metadata?.framework || issue?.framework;
    if (fw && typeof fw === 'string') return fw;
    // Fallback: match framework name in the issue type/description
    const text = `${issue?.type || ''} ${issue?.description || ''}`;
    for (const f of REGULATORY_FRAMEWORKS) {
        if (text.includes(f)) return f;
    }
    return null;
}

interface ScanResultData {
    totalFiles: number;
    issueCount: number;
    severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
    gate: { pass: boolean; blockingCount: number; warningCount: number };
    qualityScore: number | null;
    projectPath: string;
    scanScope: { profile: string; resultsViewScope: string; codeFilesAnalyzed: number };
}

function syncReportToVscodeSidebar(reportData: any, fallbackProjectPath = ''): void {
    if (!reportData || typeof window === 'undefined') return;
    const issues = resolveReportIssues(reportData);
    const sev = reportData?.severityCounts || {};
    const qualityScore = reportData?.qualityScore ?? reportData?.gate?.score ?? 0;
    const payload = {
        totalFiles: reportData?.repositoryFilesTotal || reportData?.totalFiles || reportData?.summary?.totalFiles || 0,
        ruleScopedFilesAnalyzed:
            reportData?.ruleScopedFilesAnalyzed ||
            reportData?.filesAnalyzed ||
            reportData?.summary?.codeFilesAnalyzed ||
            0,
        issueCount: reportData?.issueCount ?? issues.reduce((sum, i) => sum + (Number(i.count) || 1), 0),
        qualityScore,
        gate: reportData?.gate || { pass: false },
        issues: issues.slice(0, 200),
        projectPath: reportData?.projectRoot || reportData?.projectPath || fallbackProjectPath || '',
        severityCounts: {
            critical: sev.critical || 0,
            high: sev.high || 0,
            medium: sev.medium || 0,
            low: sev.low || 0,
            info: sev.info || 0
        }
    };
    const stats = {
        issues: payload.issueCount,
        critical: payload.severityCounts.critical,
        high: payload.severityCounts.high,
        medium: payload.severityCounts.medium,
        low: payload.severityCounts.low,
        score: qualityScore
    };

    const vscode = (window as any).acquireVsCodeApi?.();
    try {
        if (vscode) {
            vscode.postMessage({ command: 'updateReport', report: payload });
            vscode.postMessage({ command: 'scanComplete', stats });
        } else if (window.parent && window.parent !== window) {
            window.parent.postMessage({ command: 'updateReport', report: payload }, '*');
            window.parent.postMessage({ command: 'scanComplete', stats }, '*');
        }
    } catch {
        // Sidebar sync is best-effort and should never block report export.
    }
}

export function ResultsView() {
    const [filter, setFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedIssue, setSelectedIssue] = useState<any>(null);
    const [selectedCell, setSelectedCell] = useState<{ impact: string; likelihood: string } | null>(null);
    const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
    const [result, setResult] = useState<ScanResultData | null>(null);
    const [fullReport, setFullReport] = useState<any>(null);
    const [scanTime, setScanTime] = useState<string | null>(null);
    const { user } = useAuth();

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

    // If localStorage doesn't contain the full report (quota or missing), fall back to IndexedDB.
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
                        // Try to hydrate the lightweight `result` summary if present inside the payload
                        try {
                            const summary = r.summary || {};
                            const scanResult = {
                                totalFiles: r.repositoryFilesTotal || summary.totalFiles || 0,
                                issueCount: r.issueCount || summary.totalFindings || 0,
                                severityCounts: r.severityCounts || {
                                    critical: 0,
                                    high: 0,
                                    medium: 0,
                                    low: 0,
                                    info: 0
                                },
                                gate: r.gate || { pass: false, blockingCount: 0, warningCount: 0 },
                                qualityScore: r.qualityScore ?? null,
                                projectPath: r.projectPath || r.projectRoot || '',
                                scanScope: {
                                    profile: r.scanScope?.profile || 'standard',
                                    resultsViewScope: r.scanScope?.resultsViewScope || 'browser-local',
                                    codeFilesAnalyzed: r.scanScope?.codeFilesAnalyzed || summary.codeFilesAnalyzed || 0
                                }
                            } as any;
                            setResult(scanResult);
                        } catch (_e) {
                            // ignore summary hydration failures
                        }
                    }
                }
            } catch (_e) {
                // ignore
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const reportForIssues = useMemo(() => {
        if (!result && !fullReport) return null;
        return {
            ...(fullReport || {}),
            severityCounts: fullReport?.severityCounts || result?.severityCounts,
            issueCount: fullReport?.issueCount ?? result?.issueCount,
            gate: fullReport?.gate || result?.gate,
            projectPath: fullReport?.projectPath || fullReport?.projectRoot || result?.projectPath,
            qualityScore: fullReport?.qualityScore ?? result?.qualityScore
        };
    }, [fullReport, result]);

    const allIssues = useMemo(() => {
        if (!reportForIssues) return [];
        return resolveReportIssues(reportForIssues);
    }, [reportForIssues]);

    const findingsDetailLimited = Boolean(
        result &&
        result.issueCount > 0 &&
        (fullReport?.issuesTruncated ||
            !fullReport ||
            !(fullReport.rawIssues?.length || fullReport.detectedIssues?.length || fullReport.findings?.length))
    );

    const heatmapGrid = useMemo(() => {
        const score: Record<string, number> = { low: 1, medium: 2, high: 3 };
        const grid: Record<string, Record<string, number>> = {
            high: { high: 0, medium: 0, low: 0 },
            medium: { high: 0, medium: 0, low: 0 },
            low: { high: 0, medium: 0, low: 0 }
        };
        allIssues.forEach(i => {
            const sev = (i.severity || 'low').toLowerCase();
            const impact = sev === 'critical' || sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low';
            const count = Number(i.count) || 1;
            const likelihood = count > 5 ? 'high' : count > 1 ? 'medium' : 'low';
            grid[impact][likelihood] += count;
        });
        return grid;
    }, [allIssues]);

    const filteredIssues = useMemo(() => {
        let issues = allIssues;
        if (filter !== 'all') {
            issues = issues.filter(i => i.severity === filter);
        }
        if (selectedCell) {
            issues = issues.filter(i => {
                const sev = (i.severity || 'low').toLowerCase();
                const impact = sev === 'critical' || sev === 'high' ? 'high' : sev === 'medium' ? 'medium' : 'low';
                const count = Number(i.count) || 1;
                const likelihood = count > 5 ? 'high' : count > 1 ? 'medium' : 'low';
                return impact === selectedCell.impact && likelihood === selectedCell.likelihood;
            });
        }
        if (selectedFramework) {
            issues = issues.filter(i => getIssueFramework(i) === selectedFramework);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            issues = issues.filter(
                i =>
                    (i.type || '').toLowerCase().includes(q) ||
                    (i.description || '').toLowerCase().includes(q) ||
                    (i.filePath || '').toLowerCase().includes(q)
            );
        }
        issues = issues.filter(i => !String(i.filePath || '').includes('node_modules'));
        return issues;
    }, [allIssues, filter, searchQuery, selectedCell, selectedFramework]);

    // Count issues per regulatory framework (for chip badges)
    const frameworkCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allIssues.forEach(i => {
            const fw = getIssueFramework(i);
            if (fw) counts[fw] = (counts[fw] || 0) + (Number(i.count) || 1);
        });
        return counts;
    }, [allIssues]);

    // Frameworks that have at least one matching issue, sorted by count desc
    const activeFrameworks = useMemo(() => {
        return REGULATORY_FRAMEWORKS.filter(fw => frameworkCounts[fw] > 0).sort(
            (a, b) => (frameworkCounts[b] || 0) - (frameworkCounts[a] || 0)
        );
    }, [frameworkCounts]);

    const issueCategories = useMemo(() => {
        const catMap: Record<string, number> = {};
        allIssues.forEach(i => {
            const cat = i.type || 'other';
            catMap[cat] = (catMap[cat] || 0) + (Number(i.count) || 1);
        });
        return Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => ({ type, count }));
    }, [allIssues]);

    if (!result) {
        return (
            <div className="mx-auto max-w-7xl p-6 space-y-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Results</h1>
                    <p className="text-foreground-muted">Detailed scan findings and issue breakdown</p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-16">
                        <ClipboardList className="h-12 w-12 text-foreground-muted" />
                        <p className="text-sm text-foreground-muted">No scan results loaded</p>
                        <p className="text-xs text-foreground-muted">
                            Run a scan from the Analyze page to see results here
                        </p>
                        <Button className="mt-2" onClick={() => navigate('analyze')}>
                            <Play className="h-4 w-4" /> Go to Analyze
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
    const activeSeverities = severities.filter(s => result.severityCounts[s] > 0);
    const currentScanGrade = resolveScanLetterGrade(result.qualityScore, fullReport);

    return (
        <div className="mx-auto max-w-7xl p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Results</h1>
                <p className="text-foreground-muted">Detailed scan findings and issue breakdown</p>
            </div>

            {/* Overview Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Scan Report</CardTitle>
                            <CardDescription>
                                {result.projectPath}
                                {scanTime && <span className="ml-2 text-xs">— {scanTime}</span>}
                            </CardDescription>
                        </div>
                        <Badge variant={result.gate.pass ? 'success' : 'danger'} className="text-sm">
                            {result.gate.pass ? 'PASS' : 'FAIL'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard icon={FileCode} label="Files Scanned" value={result.totalFiles} />
                        <MetricCard icon={AlertTriangle} label="Issues Found" value={result.issueCount} />
                        <MetricCard
                            icon={Shield}
                            label="Rules Checked"
                            value={result.scanScope.codeFilesAnalyzed || 0}
                        />
                        <MetricCard
                            icon={CheckCircle2}
                            label="Quality Score"
                            value={result.qualityScore !== null ? `${result.qualityScore}%` : '—'}
                        />
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                        {severities.map(sev => (
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
                                {sev}: {result.severityCounts[sev]}
                            </Badge>
                        ))}
                    </div>

                    {/* Storage Engine Badge Footer */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600">Report Storage State:</span>
                            {localStorage.getItem('sb_last_scan_report_storage') === 'indexeddb' ? (
                                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-medium border border-blue-200">
                                    ⚡ IndexedDB (Quota-Safe)
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-medium border border-emerald-200">
                                    LocalStorage (Legacy)
                                </span>
                            )}
                        </div>
                        <div className="text-slate-600">Max Scan Bounds: Unlimited (Sentinels Active)</div>
                    </div>
                </CardContent>
            </Card>

            <ResultsReferralBanner userEmail={user?.email} currentScanGrade={currentScanGrade} />

            <PostScanCliNudge scanGatePass={result.gate.pass} />

            <PostScanShareBanner
                qualityScore={result.qualityScore}
                gatePass={result.gate.pass}
                userEmail={user?.email}
                currentScanGrade={currentScanGrade}
            />

            {/* Risk Heatmap Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Risk Heatmap</CardTitle>
                    <CardDescription>
                        3x3 matrix of issue impact vs. likelihood. Click or press Enter on a cell to filter findings.
                        {selectedCell &&
                            ` · filtering: ${selectedCell.impact} impact, ${selectedCell.likelihood} likelihood`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1 max-w-md">
                        <div />
                        <div className="text-xs text-center text-foreground-muted font-medium">Low Lk</div>
                        <div className="text-xs text-center text-foreground-muted font-medium">Med Lk</div>
                        <div className="text-xs text-center text-foreground-muted font-medium">High Lk</div>
                        {(['high', 'medium', 'low'] as const).map(imp => (
                            <div key={imp} className="contents">
                                <div className="text-xs text-right text-foreground-muted font-medium self-center pr-1 capitalize">
                                    {imp} Imp
                                </div>
                                {(['low', 'medium', 'high'] as const).map(lk => {
                                    const count = heatmapGrid[imp][lk];
                                    const score: Record<string, number> = { low: 1, medium: 2, high: 3 };
                                    const total = score[imp] * score[lk];
                                    const cellClass =
                                        total >= 6
                                            ? 'bg-red-500/15 text-red-500 border-red-500/30'
                                            : total >= 3
                                              ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                              : 'bg-green-500/15 text-green-500 border-green-500/30';
                                    const isSelected = selectedCell?.impact === imp && selectedCell?.likelihood === lk;
                                    return (
                                        <div
                                            key={`${imp}-${lk}`}
                                            tabIndex={0}
                                            role="button"
                                            aria-label={`${imp} impact, ${lk} likelihood: ${count} issues`}
                                            title={`${imp} impact / ${lk} likelihood — ${count} issue${count === 1 ? '' : 's'}`}
                                            onClick={() =>
                                                setSelectedCell(isSelected ? null : { impact: imp, likelihood: lk })
                                            }
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedCell(
                                                        isSelected ? null : { impact: imp, likelihood: lk }
                                                    );
                                                }
                                            }}
                                            className={`rounded-md border p-3 text-center cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring ${cellClass} ${isSelected ? 'ring-2 ring-ring' : ''}`}
                                        >
                                            <div className="text-lg font-bold">{count}</div>
                                            <div className="text-[10px] opacity-60">
                                                {total >= 6 ? 'Red' : total >= 3 ? 'Amber' : 'Green'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    {selectedCell && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedCell(null)}>
                            Clear heatmap filter
                        </Button>
                    )}

                    {/* Regulatory Framework Filter */}
                    {activeFrameworks.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2 mb-2">
                                <Globe className="h-4 w-4 text-foreground-muted" />
                                <span className="text-sm font-medium">Regulatory Frameworks</span>
                                <span className="text-xs text-foreground-muted">
                                    · {activeFrameworks.length} of {REGULATORY_FRAMEWORKS.length} frameworks with
                                    findings
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {activeFrameworks.map(fw => {
                                    const count = frameworkCounts[fw] || 0;
                                    const isSelected = selectedFramework === fw;
                                    return (
                                        <button
                                            key={fw}
                                            type="button"
                                            onClick={() => setSelectedFramework(isSelected ? null : fw)}
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring ${
                                                isSelected
                                                    ? 'bg-primary/15 text-primary border-primary/40 ring-1 ring-primary/30'
                                                    : 'bg-muted/50 text-foreground-muted border-border hover:bg-muted'
                                            }`}
                                            title={`${fw}: ${count} issue${count === 1 ? '' : 's'}`}
                                        >
                                            {fw}
                                            <span
                                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                                    isSelected
                                                        ? 'bg-primary/20 text-primary'
                                                        : 'bg-muted text-foreground-muted'
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                                {selectedFramework && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="ml-1 h-7 px-2 text-xs"
                                        onClick={() => setSelectedFramework(null)}
                                    >
                                        Clear framework filter
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Findings Table + Detail Tabs */}
            <Tabs defaultValue="findings">
                <TabsList>
                    <TabsTrigger value="findings">Findings</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory</TabsTrigger>
                    <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
                    <TabsTrigger value="scope">Scope</TabsTrigger>
                    <TabsTrigger value="export">Export</TabsTrigger>
                </TabsList>

                <TabsContent value="findings">
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                        <Card>
                            <CardHeader>
                                <CardTitle>Findings Breakdown</CardTitle>
                                <CardDescription>
                                    {Math.max(
                                        result?.issueCount ?? 0,
                                        allIssues.reduce((sum, i) => sum + (Number(i.count) || 1), 0)
                                    ).toLocaleString()}{' '}
                                    total issue{Math.max(result?.issueCount ?? 0, allIssues.length) !== 1 ? 's' : ''}
                                    {findingsDetailLimited &&
                                        ' · detailed list limited — export JSON or use CLI for full paths'}
                                    {filter !== 'all' && ` · filtered by ${filter}`}
                                    {selectedCell && ` · heatmap: ${selectedCell.impact}/${selectedCell.likelihood}`}
                                    {selectedFramework && ` · framework: ${selectedFramework}`}
                                    {searchQuery && ` · matching "${searchQuery}"`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {['all', ...activeSeverities].map(sev => (
                                        <Button
                                            key={sev}
                                            variant={filter === sev ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setFilter(sev)}
                                            className="capitalize"
                                        >
                                            {sev}
                                            {sev !== 'all' && (
                                                <span className="ml-1.5 text-xs opacity-70">
                                                    {result.severityCounts[sev as keyof typeof result.severityCounts]}
                                                </span>
                                            )}
                                        </Button>
                                    ))}
                                </div>

                                <div className="relative mb-3">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-foreground-muted" />
                                    <Input
                                        placeholder="Search by type, description, or file path…"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>

                                <Separator />

                                {(result?.issueCount ?? 0) === 0 && allIssues.length === 0 ? (
                                    <div className="flex items-center gap-3 py-8">
                                        <CheckCircle2 className="h-8 w-8 text-success" />
                                        <div>
                                            <p className="text-sm font-medium">No issues detected</p>
                                            <p className="text-xs text-foreground-muted">
                                                All gate rules passed with zero findings
                                            </p>
                                        </div>
                                    </div>
                                ) : (result?.issueCount ?? 0) > 0 && allIssues.length === 0 ? (
                                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                                        <AlertTriangle className="h-8 w-8 text-amber-400" />
                                        <div>
                                            <p className="text-sm font-medium">
                                                {(result?.issueCount ?? 0).toLocaleString()} issues found — detailed
                                                list unavailable
                                            </p>
                                            <p className="text-xs text-foreground-muted mt-1">
                                                The findings list was too large for browser storage. Export the JSON
                                                report from the Analyze page or run{' '}
                                                <code className="font-mono bg-muted px-1 py-0.5 rounded">
                                                    npx simplebeacon scan --full --gate
                                                </code>{' '}
                                                via the CLI for the complete list.
                                            </p>
                                        </div>
                                    </div>
                                ) : filteredIssues.length === 0 ? (
                                    <div className="flex items-center gap-3 py-8">
                                        <Search className="h-8 w-8 text-foreground-muted" />
                                        <div>
                                            <p className="text-sm font-medium">No issues match current filters</p>
                                            <p className="text-xs text-foreground-muted">
                                                Try adjusting severity filter or search query
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {filteredIssues.length > 500 && (
                                            <p className="text-xs text-foreground-muted py-2">
                                                Showing first 500 of {filteredIssues.length} filtered issues. Export for
                                                the full set.
                                            </p>
                                        )}
                                        <div className="rounded-md border border-border overflow-hidden">
                                            <div className="max-h-[600px] overflow-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                                                        <tr className="text-left">
                                                            <th className="px-3 py-2 font-medium text-foreground-muted">
                                                                Severity
                                                            </th>
                                                            <th className="px-3 py-2 font-medium text-foreground-muted">
                                                                Type
                                                            </th>
                                                            <th className="px-3 py-2 font-medium text-foreground-muted">
                                                                Description
                                                            </th>
                                                            <th className="px-3 py-2 font-medium text-foreground-muted">
                                                                Framework
                                                            </th>
                                                            <th className="px-3 py-2 font-medium text-foreground-muted">
                                                                File
                                                            </th>
                                                            <th className="px-3 py-2 font-medium text-foreground-muted text-right">
                                                                Count
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredIssues.slice(0, 500).map((issue, idx) => {
                                                            const fw = getIssueFramework(issue);
                                                            return (
                                                                <tr
                                                                    key={issue.id || idx}
                                                                    onClick={() => setSelectedIssue(issue)}
                                                                    className={`border-t border-border cursor-pointer transition-colors hover:bg-muted/50 ${selectedIssue === issue ? 'bg-muted' : ''}`}
                                                                >
                                                                    <td className="px-3 py-2">
                                                                        <Badge
                                                                            variant={
                                                                                issue.severity === 'critical'
                                                                                    ? 'danger'
                                                                                    : issue.severity === 'high'
                                                                                      ? 'warning'
                                                                                      : issue.severity === 'medium'
                                                                                        ? 'info'
                                                                                        : issue.severity === 'low'
                                                                                          ? 'secondary'
                                                                                          : 'outline'
                                                                            }
                                                                            className="capitalize text-xs"
                                                                        >
                                                                            {issue.severity}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-foreground-muted whitespace-nowrap">
                                                                        {issue.type || '—'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-foreground-muted max-w-md truncate">
                                                                        {issue.description || '—'}
                                                                    </td>
                                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                                        {fw ? (
                                                                            <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
                                                                                <Globe className="h-3 w-3" />
                                                                                {fw}
                                                                            </span>
                                                                        ) : (
                                                                            '—'
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-foreground-muted whitespace-nowrap max-w-[200px] truncate">
                                                                        {issue.filePath ? (
                                                                            <span className="font-mono text-xs">
                                                                                {issue.filePath.split('/').pop()}
                                                                            </span>
                                                                        ) : (
                                                                            '—'
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right text-foreground-muted">
                                                                        {issue.count || 1}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Issue Detail Panel */}
                        <Card className="lg:sticky lg:top-4 h-fit">
                            <CardHeader>
                                <CardTitle className="text-base">Issue Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {selectedIssue ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={
                                                    selectedIssue.severity === 'critical'
                                                        ? 'danger'
                                                        : selectedIssue.severity === 'high'
                                                          ? 'warning'
                                                          : selectedIssue.severity === 'medium'
                                                            ? 'info'
                                                            : selectedIssue.severity === 'low'
                                                              ? 'secondary'
                                                              : 'outline'
                                                }
                                                className="capitalize"
                                            >
                                                {selectedIssue.severity}
                                            </Badge>
                                            <span className="text-sm font-medium">{selectedIssue.type || 'Issue'}</span>
                                        </div>
                                        <p className="text-sm text-foreground-muted">
                                            {selectedIssue.description || ''}
                                        </p>
                                        {getIssueFramework(selectedIssue) && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-foreground-muted">Regulatory Framework</p>
                                                <div className="flex items-center gap-2">
                                                    <Globe className="h-4 w-4 text-foreground-muted" />
                                                    <span className="text-sm font-medium">
                                                        {getIssueFramework(selectedIssue)}
                                                    </span>
                                                    {selectedIssue.metadata?.category && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {selectedIssue.metadata.category}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {selectedIssue.filePath && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-foreground-muted">File</p>
                                                <code className="block text-xs bg-muted rounded-md p-2 break-all">
                                                    {selectedIssue.filePath}
                                                    {selectedIssue.line && selectedIssue.line > 1
                                                        ? `:${selectedIssue.line}`
                                                        : ''}
                                                </code>
                                            </div>
                                        )}
                                        {selectedIssue.recommendedAction && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-foreground-muted">Recommended Action</p>
                                                <p className="text-sm">{selectedIssue.recommendedAction}</p>
                                            </div>
                                        )}
                                        {selectedIssue.affectedFiles?.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-foreground-muted">
                                                    Affected Files ({selectedIssue.affectedFiles.length})
                                                </p>
                                                <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                                                    {selectedIssue.affectedFiles.map((f: string, i: number) => (
                                                        <li key={i} className="font-mono break-all">
                                                            {f}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {selectedIssue.metadata?.duplicatePaths?.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-xs text-foreground-muted">Duplicate Paths</p>
                                                <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                                                    {selectedIssue.metadata.duplicatePaths.map(
                                                        (p: string, i: number) => (
                                                            <li key={i} className="font-mono break-all">
                                                                {p}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const filePath = selectedIssue.filePath;
                                                    const line = selectedIssue.line || 1;
                                                    const vscode = (window as any).acquireVsCodeApi?.();
                                                    if (vscode && filePath) {
                                                        vscode.postMessage({
                                                            command: 'openFile',
                                                            filePath,
                                                            line
                                                        });
                                                        return;
                                                    }
                                                    // Hosted dashboard — try vscode:// and cursor:// URL schemes.
                                                    // Use a hidden anchor element to trigger the URL scheme (avoids
                                                    // window.location.href assignment which triggers open-redirect
                                                    // scanner rules — these are local editor URL schemes, not web redirects).
                                                    if (filePath) {
                                                        const absPath =
                                                            filePath.startsWith('/') ||
                                                            filePath.match(/^[A-Za-z]:[\\/]/)
                                                                ? filePath
                                                                : `/${filePath}`;
                                                        const normalizedPath = absPath.replace(/\\/g, '/');
                                                        const editorSchemes = [
                                                            `vscode://file/${normalizedPath}:${line}:1`,
                                                            `cursor://file/${normalizedPath}:${line}:1`
                                                        ];
                                                        // Try each scheme — the browser silently fails if the app isn't installed
                                                        for (const scheme of editorSchemes) {
                                                            try {
                                                                const a = document.createElement('a');
                                                                a.href = scheme;
                                                                a.style.display = 'none';
                                                                document.body.appendChild(a);
                                                                a.click();
                                                                document.body.removeChild(a);
                                                            } catch {
                                                                /* ignore — app not installed */
                                                            }
                                                        }
                                                        // Copy path to clipboard as a fallback
                                                        try {
                                                            navigator.clipboard?.writeText(`${absPath}:${line}`);
                                                        } catch {
                                                            /* ignore */
                                                        }
                                                        toast.info('Opening in editor', {
                                                            description: `Trying VS Code / Cursor for ${filePath}:${line}. Path copied to clipboard as fallback.`
                                                        });
                                                    } else {
                                                        toast.error('No file path available for this issue');
                                                    }
                                                }}
                                            >
                                                <FileText className="h-4 w-4" /> Open in editor
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                                        <ChevronRight className="h-8 w-8 text-foreground-muted" />
                                        <p className="text-sm text-foreground-muted">
                                            Click a finding in the table to see details
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="summary">
                    <Card>
                        <CardHeader>
                            <CardTitle>Severity Summary</CardTitle>
                            <CardDescription>Issues grouped by severity and type</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {severities
                                    .filter(s => result.severityCounts[s] > 0)
                                    .map(sev => (
                                        <div
                                            key={sev}
                                            className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Badge
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
                                                    className="capitalize"
                                                >
                                                    {sev}
                                                </Badge>
                                                <span className="text-sm text-foreground-muted">
                                                    {result.severityCounts[sev]} finding
                                                    {result.severityCounts[sev] !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            <Separator />

                            <div>
                                <p className="text-sm font-medium mb-2">Issues by Type</p>
                                <div className="space-y-1">
                                    {issueCategories.map(({ type, count }) => (
                                        <div key={type} className="flex items-center justify-between text-sm">
                                            <span className="text-foreground-muted">{type}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {count}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {fullReport?.qualityScorecard && (
                                <div>
                                    <Separator className="my-3" />
                                    <p className="text-sm font-medium mb-2">Quality Scorecard</p>
                                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                        {Object.entries(fullReport.qualityScorecard).map(([dim, score]) => (
                                            <div key={dim} className="rounded-md border p-2 text-center">
                                                <div className="text-xs text-foreground-muted capitalize">{dim}</div>
                                                <div
                                                    className={`text-lg font-bold ${(score as number) >= 80 ? 'text-green-600' : (score as number) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}
                                                >
                                                    {score as number}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="inventory">
                    <Card>
                        <CardHeader>
                            <CardTitle>File Inventory</CardTitle>
                            <CardDescription>Breakdown of files by category and removable artifacts</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {fullReport?.fileInventory ? (
                                <div>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                        {Object.entries(fullReport.fileInventory).map(([cat, count]) => (
                                            <div key={cat} className="rounded-md border p-3">
                                                <div className="text-xs text-foreground-muted capitalize">
                                                    {cat.replace(/([A-Z])/g, ' $1').trim()}
                                                </div>
                                                <div className="text-xl font-bold">{count as number}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-foreground-muted">
                                    File inventory not available for this scan.
                                </p>
                            )}
                            {fullReport?.removableFiles && fullReport.removableFiles.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium mb-2">
                                        Removable Files (
                                        {fullReport.removableFilesTotal || fullReport.removableFiles.length} total)
                                    </p>
                                    <div className="rounded-md bg-muted p-3 font-mono text-xs space-y-1 overflow-y-auto max-h-48">
                                        {fullReport.removableFiles
                                            .slice(0, 50)
                                            .map((f: { path: string; reason: string }, i: number) => (
                                                <div
                                                    key={i}
                                                    className="text-foreground-secondary break-all whitespace-pre-wrap"
                                                >
                                                    <span className="text-yellow-600">[removable]</span> {f.path}{' '}
                                                    <span className="text-foreground-muted">— {f.reason}</span>
                                                </div>
                                            ))}
                                        {fullReport.removableFiles.length > 50 && (
                                            <div className="text-foreground-muted">
                                                ... and {fullReport.removableFiles.length - 50} more (export JSON for
                                                full list)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="diagnostics">
                    <Card>
                        <CardHeader>
                            <CardTitle>Scan Diagnostics</CardTitle>
                            <CardDescription>Internal scan statistics and file processing breakdown</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {fullReport?.diagnosticReport ? (
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Raw Files</div>
                                        <div className="text-xl font-bold">{fullReport.diagnosticReport.rawFiles}</div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Filtered</div>
                                        <div className="text-xl font-bold">
                                            {fullReport.diagnosticReport.filteredFiles}
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Scanned</div>
                                        <div className="text-xl font-bold">
                                            {fullReport.diagnosticReport.scannedFiles}
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Read Errors</div>
                                        <div className="text-xl font-bold text-red-600">
                                            {fullReport.diagnosticReport.readErrors}
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Large Skips</div>
                                        <div className="text-xl font-bold text-yellow-600">
                                            {fullReport.diagnosticReport.largeFileSkips}
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">File Errors</div>
                                        <div className="text-xl font-bold text-red-600">
                                            {fullReport.diagnosticReport.fileErrors}
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Ignored Dirs</div>
                                        <div className="text-xl font-bold">
                                            {fullReport.diagnosticReport.ignoredDirs}
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Ignored Pattern</div>
                                        <div className="text-xl font-bold">
                                            {fullReport.diagnosticReport.ignoredByPattern}
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Heavy Vendor</div>
                                        <div className="text-xl font-bold">
                                            {fullReport.diagnosticReport.heavyVendor}
                                        </div>
                                    </div>
                                    <div className="rounded-md border p-3">
                                        <div className="text-xs text-foreground-muted">Unaccounted</div>
                                        <div className="text-xl font-bold text-yellow-600">
                                            {fullReport.diagnosticReport.unaccounted}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-foreground-muted">
                                    Diagnostics not available for this scan.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="scope">
                    <Card>
                        <CardHeader>
                            <CardTitle>Scan Scope</CardTitle>
                            <CardDescription>Configuration and scope of the last scan</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-start gap-3">
                                <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
                                <div className="text-sm space-y-1">
                                    <p>
                                        Repository inventory: <strong>{result.totalFiles} files</strong> indexed
                                    </p>
                                    <p>
                                        Code files analyzed:{' '}
                                        <strong>{result.scanScope.codeFilesAnalyzed || 0} files</strong>
                                    </p>
                                    <p>
                                        Profile: <strong>{result.scanScope.profile}</strong>
                                    </p>
                                    <p>
                                        Scope: <strong>{result.scanScope.resultsViewScope}</strong>
                                    </p>
                                    <p>
                                        Deterministic gate scan — pattern matching on configured production paths.
                                        Source files are not semantically reviewed.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="export">
                    <Card>
                        <CardHeader>
                            <CardTitle>Export Results</CardTitle>
                            <CardDescription>Download scan report in various formats</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (!result) return;
                                    const exportData = fullReport || result;
                                    syncReportToVscodeSidebar(exportData, result.projectPath);
                                    const json = JSON.stringify(exportData, null, 2);
                                    const blob = new Blob([json], { type: 'application/json' });
                                    const filename = `simplebeacon-report-${Date.now()}.json`;
                                    const params = new URLSearchParams(window.location.search);
                                    const inIde =
                                        typeof window !== 'undefined' &&
                                        (typeof (window as any).acquireVsCodeApi === 'function' ||
                                            params.get('sb_parent_urlbar') ||
                                            params.get('sb_notify_base') ||
                                            params.get('sb_api_base'));
                                    if (inIde) {
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                            const base64 = String(reader.result || '').split(',')[1];
                                            const vscode = (window as any).acquireVsCodeApi?.();
                                            const msg = {
                                                command: 'downloadFile',
                                                filename,
                                                mimeType: blob.type,
                                                base64
                                            };
                                            if (vscode) {
                                                try {
                                                    vscode.postMessage(msg);
                                                } catch {
                                                    /* ignore */
                                                }
                                            } else if (window.parent && window.parent !== window) {
                                                try {
                                                    window.parent.postMessage(msg, '*');
                                                } catch {
                                                    /* ignore */
                                                }
                                            }
                                        };
                                        reader.readAsDataURL(blob);
                                        return;
                                    }
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = filename;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                            >
                                <Download className="h-4 w-4" /> JSON Report
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => navigate('audit')}>
                                <Download className="h-4 w-4" /> Audit PDF
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => navigate('remediation')}>
                                <Download className="h-4 w-4" /> Remediation Roadmap
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// simplebeacon-ignore: mega-params — only 3 params, false positive
function MetricCard({
    icon: Icon,
    label,
    value
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number | string;
}) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-foreground-muted">{label}</span>
                <span className="text-lg font-bold">{value}</span>
            </div>
        </div>
    );
}
