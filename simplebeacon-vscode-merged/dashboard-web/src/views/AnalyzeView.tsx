// simplebeacon-ignore: mega-params,debugArtifacts — refactor flagged functions later; console.warn diagnostics are intentional
import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  FolderSearch,
  Folder,
  Github,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCode,
  Shield,
  Download,
  Terminal,
  Info,
  Globe,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase, apiUrl, authHeaders, isTokenExpired, clearAuthAndRedirect } from '@/config';
import { checkLocalNetworkAccess, isLoopbackHost } from '@/utils/checkLocalNetwork';
import { runLocalScan } from '@services/localScanService.js';
import { captureDropEntries, collectFilesFromDrop, type VirtualFile } from '@/services/dropFolderTraversal';
import { useExtensionBridge } from '@/hooks/useExtensionBridge';
import { discoverAndApplyExtensionBridge } from '@services/localAgentService.js';
import { navigate } from '@/router/HashRouter';
import { requestNotificationPermission, showOSNotification, isNotificationsEnabled, setNotificationsEnabled as setNotificationsPreference } from '@utils/utils-lib/dom';

type ScanMode = 'local' | 'server' | 'github' | 'website';
type ScanState = 'idle' | 'scanning' | 'complete' | 'error' | 'auth_required';

function isHostedDashboard(): boolean {
  if (typeof window === 'undefined') return false;
  return !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function isWebsiteMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('sb_website_mode') === '1';
  } catch { return false; }
}

function isIdeEmbedSurface(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.__SB_IDE_EMBED__) return true;
    if (document.documentElement.hasAttribute('data-ide-embed')) return true;
    if (typeof win.acquireVsCodeApi === 'function') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('sb_api_base') || params.get('sb_notify_base')) return true;
  } catch { /* ignore */ }
  return window.self !== window.top;
}

/** Hosted dashboard scans require a valid session (browser-local included). */
function hostedScanRequiresAuth(hosted: boolean): boolean {
  return hosted && !isIdeEmbedSurface();
}

function bridgeFetchHeaders(bridgeToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bridgeToken) {
    headers['X-SimpleBeacon-Bridge-Token'] = bridgeToken;
  }
  return headers;
}

async function findFolderViaBridge(folderName: string, bridgeBase: string, bridgeToken?: string | null): Promise<string | null> {
  try {
    const res = await fetch(`${bridgeBase}/api/find-folder`, {
      method: 'POST',
      headers: bridgeFetchHeaders(bridgeToken),
      body: JSON.stringify({ folderName }),
    });
    if (res.ok) {
      const data = await res.json();
      const matches = Array.isArray(data.matches) ? data.matches : [];
      if (matches.length > 0) {
        return matches[0].path || matches[0];
      }
      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length > 0) {
        return typeof results[0] === 'string' ? results[0] : results[0]?.path || null;
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function pickFolderViaExtensionBridge(bridgeBase: string, bridgeToken?: string | null): Promise<string | null> {
  const headers = bridgeFetchHeaders(bridgeToken);
  for (const route of ['/api/analyze/pick-folder', '/api/pick-folder']) {
    try {
      const res = await fetch(`${bridgeBase}${route}`, { method: 'POST', headers });
      if (res.ok) {
        const data = await res.json();
        if (data.path) return data.path;
      }
    } catch { /* try alias */ }
  }
  return null;
}

function isAbsoluteLocalPath(value: string): boolean {
  return /^([A-Za-z]:[\\/]|\\\\|\/)/.test(String(value || '').trim());
}

async function runBridgeExtensionScan(
  bridgeBase: string,
  scanPath: string,
  bridgeToken: string | null | undefined,
  callbacks: {
    appendLog: (line: string) => void;
    setProgress: (n: number) => void;
    setProgressLabel: (label: string) => void;
  }
): Promise<any> {
  const headers = bridgeFetchHeaders(bridgeToken);
  let resolvedPath = scanPath;
  if (!isAbsoluteLocalPath(scanPath)) {
    callbacks.appendLog(`[SimpleBeacon] Resolving "${scanPath}" via extension bridge...`);
    const found = await findFolderViaBridge(scanPath, bridgeBase, bridgeToken);
    if (!found) {
      throw new Error(`Could not resolve folder "${scanPath}" on your machine via the VS Code extension.`);
    }
    resolvedPath = found;
    callbacks.appendLog(`[SimpleBeacon] Resolved to ${resolvedPath}`);
  }

  callbacks.setProgressLabel('Starting scan via VS Code extension...');
  callbacks.setProgress(10);
  const startResp = await fetch(`${bridgeBase}/api/scan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ path: resolvedPath }),
  });
  if (!startResp.ok) {
    throw new Error(`Bridge scan failed to start (${startResp.status})`);
  }

  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const progResp = await fetch(
      `${bridgeBase}/api/analyze/progress?projectPath=${encodeURIComponent(resolvedPath)}`,
      { headers }
    );
    if (!progResp.ok) continue;
    const progData = await progResp.json().catch(() => ({}));
    const progress = progData?.progress || {};
    if (progress.active) {
      const processed = Number(progress.processed) || 0;
      const total = Number(progress.total) || 0;
      if (total > 0) {
        callbacks.setProgress(Math.min(90, 15 + Math.round((processed / total) * 75)));
        callbacks.setProgressLabel(`Scanning via IDE ${processed.toLocaleString()} / ${total.toLocaleString()} files`);
      } else {
        callbacks.setProgressLabel(String(progress.label || 'Scanning via VS Code extension...'));
      }
      continue;
    }
    break;
  }

  callbacks.setProgressLabel('Fetching scan report from extension...');
  callbacks.setProgress(95);
  const reportResp = await fetch(`${bridgeBase}/api/report`, { headers });
  if (!reportResp.ok) {
    throw new Error(`Bridge report fetch failed (${reportResp.status})`);
  }
  const report = await reportResp.json();
  if (report && typeof report === 'object') {
    report.projectPath = report.projectPath || report.projectRoot || resolvedPath;
  }
  return report;
}

interface ScanResult {
  totalFiles: number;
  issueCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  gate: { pass: boolean; blockingCount: number; warningCount: number };
  qualityScore: number | null;
  projectPath: string;
  scanScope: { profile: string; resultsViewScope: string; codeFilesAnalyzed: number };
}

function extractIssueListForSidebar(report: any): any[] {
  if (Array.isArray(report?.rawIssues) && report.rawIssues.length) return report.rawIssues;
  if (Array.isArray(report?.detectedIssues) && report.detectedIssues.length) return report.detectedIssues;
  if (Array.isArray(report?.findings) && report.findings.length) {
    return report.findings.map((f: any) => ({
      filePath: f.filePath || f.file || '',
      line: f.line || 1,
      severity: f.severity || 'medium',
      severityBand: f.severityBand || f.severity || 'medium',
      type: f.category || f.type || 'finding',
      description: f.message || f.description || 'Finding detected',
      count: Number(f.count) || 1,
    }));
  }
  return [];
}

function syncReportToVscodeSidebar(reportData: any, fallbackProjectPath = ''): void {
  if (!reportData || typeof window === 'undefined') return;
  const issues = extractIssueListForSidebar(reportData);
  const sev = reportData?.severityCounts || {};
  const qualityScore = reportData?.qualityScore ?? reportData?.gate?.score ?? 0;
  const payload = {
    totalFiles: reportData?.repositoryFilesTotal || reportData?.totalFiles || reportData?.summary?.totalFiles || 0,
    ruleScopedFilesAnalyzed: reportData?.ruleScopedFilesAnalyzed || reportData?.filesAnalyzed || reportData?.summary?.codeFilesAnalyzed || 0,
    issueCount: issues.length,
    qualityScore,
    gate: reportData?.gate || { pass: false },
    issues: issues.slice(0, 200),
    projectPath: reportData?.projectRoot || reportData?.projectPath || fallbackProjectPath || '',
    severityCounts: {
      critical: sev.critical || 0,
      high: sev.high || 0,
      medium: sev.medium || 0,
      low: sev.low || 0,
      info: sev.info || 0,
    },
  };
  const stats = {
    issues: issues.length,
    critical: payload.severityCounts.critical,
    high: payload.severityCounts.high,
    medium: payload.severityCounts.medium,
    low: payload.severityCounts.low,
    score: qualityScore,
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

export function AnalyzeView() {
  const [mode, setMode] = useState<ScanMode>(isWebsiteMode() ? 'website' : 'local');
  const [path, setPath] = useState(localStorage.getItem('sb_default_path') || '');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [requiresManualTrigger, setRequiresManualTrigger] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fullReport, setFullReport] = useState<any>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fullDirectoryScan, setFullDirectoryScan] = useState(false);
  const [serverDefaultPath, setServerDefaultPath] = useState<string | null>(null);
  const [resolvedCandidate, setResolvedCandidate] = useState<string | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastErrorMsg, setLastErrorMsg] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [probingAgent, setProbingAgent] = useState(false);
  const [fileErrorsCount, setFileErrorsCount] = useState<number | null>(null);
  const [fileErrorExamples, setFileErrorExamples] = useState<any[] | null>(null);
  const [browserErrors, setBrowserErrors] = useState<any[] | null>(null);
  const [browserErrorsLoading, setBrowserErrorsLoading] = useState(false);
  const [rerunAfterProbe, setRerunAfterProbe] = useState(true);
  const [pendingBrowserErrorsCount, setPendingBrowserErrorsCount] = useState<number>(0);
  const { bridgeBase, bridgeToken, status: bridgeStatus, recheck: recheckBridge } = useExtensionBridge();
  const hosted = isHostedDashboard();
  const websiteMode = isWebsiteMode();
  const [localNetworkDenied, setLocalNetworkDenied] = useState(false);
  const [isRemoteBackend, setIsRemoteBackend] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(isNotificationsEnabled());
  const scanInFlightRef = useRef(false);

  // Detect whether we're using a local server or the remote Render backend
  // simplebeacon-ignore: framework-practices
  useEffect(() => {
    const base = getApiBase();
    if (!base || /^https?:\/\/(127\.0\.0\.1|localhost):/i.test(base)) {
      setIsRemoteBackend(false);
    } else {
      setIsRemoteBackend(true);
    }
  }, []);

  // Auto-open Local Agent modal when Local Network Access is denied
  useEffect(() => {
    if (localNetworkDenied) setShowAgentModal(true);
  }, [localNetworkDenied]);

  // Fetch recent browser-errors when modal opens
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!showAgentModal) return;
      // Flush pending browser errors (if any) when modal is opened
      try {
        await flushPendingBrowserErrors();
      } catch (_e) { /* ignore */ }

      setBrowserErrorsLoading(true);
      try {
        const resp = await fetch(apiUrl('/simplebeacon/report/browser-errors'), { headers: authHeaders() });
        if (!cancelled) {
          if (resp.ok) {
            const data = await resp.json();
            setBrowserErrors(Array.isArray(data) ? data : [data]);
          } else {
            setBrowserErrors([]);
          }
        }
      } catch (e) {
        if (!cancelled) setBrowserErrors([]);
      }
      if (!cancelled) setBrowserErrorsLoading(false);
      // update pending count
      try {
        const key = 'sb_pending_browser_errors';
        const raw = localStorage.getItem(key);
        const pending = raw ? JSON.parse(raw) : [];
        setPendingBrowserErrorsCount(Array.isArray(pending) ? pending.length : 0);
      } catch (_e) { setPendingBrowserErrorsCount(0); }
    })();
    return () => { cancelled = true; };
  }, [showAgentModal]);

  // Flush pending browser-errors if the user re-authenticates
  const flushPendingBrowserErrors = useCallback(async () => {
    try {
      const key = 'sb_pending_browser_errors';
      // If no valid token is present, skip network flush — wait for login
      if (isTokenExpired()) return 0;
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const pending = JSON.parse(raw || '[]');
      if (!Array.isArray(pending) || pending.length === 0) return 0;
      let flushed = 0;
      for (const p of pending) {
        try {
          const r = await fetch(apiUrl('/simplebeacon/report/browser-error'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(p) });
          if (r.status === 401) break; // still unauthorized
          if (r.ok) flushed++;
        } catch (_e) { break; }
      }
      if (flushed > 0) {
        try { localStorage.removeItem(key); } catch (_e) { }
        toast.success(`Flushed ${flushed} pending browser error(s)`);
      }
      return flushed;
    } catch (e) {
      return 0;
    }
  }, []);

  // Listen to storage events for login changes and poll auth state as a fallback
  useEffect(() => {
    let prevExpired = isTokenExpired();
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key) return;
      if (ev.key === 'sb_user' || ev.key === 'sb_user_id' || ev.key === 'sb_token') {
        // Try flushing pending errors on auth change
        (async () => { try { await flushPendingBrowserErrors(); } catch { } })();
      }
    };
    window.addEventListener('storage', onStorage);

    const interval = window.setInterval(async () => {
      try {
        const nowExpired = isTokenExpired();
        if (prevExpired && !nowExpired) {
          // token became valid
          await flushPendingBrowserErrors();
        }
        prevExpired = nowExpired;
      } catch (_e) { }
    }, 3000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, [flushPendingBrowserErrors]);

  // Listen for an explicit login event dispatched by the SignIn flow so we can
  // immediately flush pending browser errors in the same window (storage events
  // don't fire in the same tab that updated localStorage).
  useEffect(() => {
    const onLogin = async () => {
      try { await flushPendingBrowserErrors(); } catch { /* ignore */ }
    };
    window.addEventListener('sb:login', onLogin as EventListener);
    return () => { window.removeEventListener('sb:login', onLogin as EventListener); };
  }, [flushPendingBrowserErrors]);

  // Fetch server defaultProjectPath on mount so we can auto-populate and resolve paths
  // simplebeacon-ignore: framework-practices
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(apiUrl('/analyze/providers'), { headers: authHeaders() });
        if (resp.ok && !cancelled) {
          const data = await resp.json();
          const dp = data.defaultProjectPath;
          if (dp && !cancelled) {
            setServerDefaultPath(dp);
            // Auto-populate path if empty and no saved default — but only for local dev
            // On a hosted dashboard, the server's path is on a remote machine and useless
            // for browser-local scanning. Leave the field empty so the user types a folder name.
            if (!path.trim() && !localStorage.getItem('sb_default_path') && !isHostedDashboard()) {
              setPath(dp);
            }
          }
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const appendLog = useCallback((line: string) => {
    setTerminalOutput((prev) => [...prev, line]);
  }, []);

  // Persist scan result to localStorage without failing the scan on QuotaExceededError
  const persistScanResult = useCallback((scanResult: ScanResult, fullReportData?: any) => {
    const buildCompactReport = (report: any) => {
      const rawIssues = Array.isArray(report?.rawIssues) ? report.rawIssues
        : (Array.isArray(report?.detectedIssues) ? report.detectedIssues : []);
      const fullSummary = report?.summary || {};
      return {
        type: report?.type || 'simplebeacon-report',
        version: report?.version || '1.0.0',
        reportVersion: report?.reportVersion || 2,
        generatedAt: report?.generatedAt || new Date().toISOString(),
        scanSource: report?.scanSource || 'browser-local',
        projectPath: report?.projectPath || scanResult.projectPath,
        projectRoot: report?.projectRoot || report?.projectPath || scanResult.projectPath,
        // Strip summary to essential scalar fields only — nested arrays/objects can be large
        summary: {
          totalFiles: fullSummary.totalFiles ?? scanResult.totalFiles,
          codeFilesAnalyzed: fullSummary.codeFilesAnalyzed ?? scanResult.scanScope?.codeFilesAnalyzed,
          totalFindings: fullSummary.totalFindings ?? scanResult.issueCount,
          severityCounts: fullSummary.severityCounts || scanResult.severityCounts,
        },
        severityCounts: report?.severityCounts || scanResult.severityCounts,
        issueCount: report?.issueCount ?? scanResult.issueCount,
        gate: report?.gate || scanResult.gate,
        qualityScore: report?.qualityScore ?? scanResult.qualityScore,
        repositoryFilesTotal: report?.repositoryFilesTotal ?? scanResult.totalFiles,
        ruleScopedFilesAnalyzed: report?.ruleScopedFilesAnalyzed ?? scanResult.scanScope?.codeFilesAnalyzed,
        // Strip scanScope to scalar fields only — the full object can include arrays
        scanScope: {
          profile: report?.scanScope?.profile || scanResult.scanScope?.profile || 'standard',
          resultsViewScope: report?.scanScope?.resultsViewScope || scanResult.scanScope?.resultsViewScope || 'browser-local',
          codeFilesAnalyzed: report?.scanScope?.codeFilesAnalyzed ?? scanResult.scanScope?.codeFilesAnalyzed,
        },
        rawIssues: rawIssues.slice(0, 50),
        detectedIssues: rawIssues.slice(0, 50),
        issuesTruncated: Boolean(report?.issuesTruncated || rawIssues.length > 50),
        scanLimitNote: report?.scanLimitNote || (rawIssues.length > 50
          ? `Detailed findings capped at 50 rows for browser storage (${rawIssues.length.toLocaleString()} total). Export JSON or use the CLI for the full list.`
          : null),
      };
    };

    const clearBulkyScanKeys = () => {
      try {
        localStorage.removeItem('sb_last_scan_report');
        localStorage.removeItem('sb_last_scan_full');
      } catch { /* ignore */ }
    };

    const storeReportPayload = (payload: unknown) => {
      localStorage.setItem('sb_last_scan_report', JSON.stringify(payload));
    };

    try {
      localStorage.setItem('sb_last_scan', JSON.stringify({
        files: scanResult.totalFiles,
        issues: scanResult.issueCount,
        gate: scanResult.gate.pass,
      }));
    } catch (e) {
      console.warn('[SimpleBeacon] Failed to store sb_last_scan:', e);
    }
    try {
      localStorage.setItem('sb_last_scan_full', JSON.stringify(scanResult));
    } catch (e) {
      console.warn('[SimpleBeacon] Failed to store sb_last_scan_full (may exceed quota):', e);
      clearBulkyScanKeys();
      try {
        localStorage.setItem('sb_last_scan_full', JSON.stringify(scanResult));
      } catch {
        toast.warning('Results summary may be limited — localStorage quota exceeded.');
      }
    }
    if (fullReportData) {
      const rawIssues = Array.isArray(fullReportData?.rawIssues) ? fullReportData.rawIssues
        : (Array.isArray(fullReportData?.detectedIssues) ? fullReportData.detectedIssues : []);
      const useCompactFirst = rawIssues.length > 200 || (scanResult.issueCount ?? 0) > 500;
      const payload = useCompactFirst ? buildCompactReport(fullReportData) : fullReportData;
      try {
        storeReportPayload(payload);
      } catch (e) {
        console.warn('[SimpleBeacon] Failed to store sb_last_scan_report (may exceed quota):', e);
        clearBulkyScanKeys();
        try {
          storeReportPayload(buildCompactReport(fullReportData));
        } catch (compactErr) {
          console.warn('[SimpleBeacon] Failed to store compact sb_last_scan_report:', compactErr);
          toast.warning('Findings list not saved to browser storage — use Export on the Results page or re-scan after clearing site data.');
        }
      }
    }
    try {
      localStorage.setItem('sb_last_scan_time', new Date().toISOString());
    } catch (e) {
      console.warn('[SimpleBeacon] Failed to store sb_last_scan_time:', e);
    }
  }, []);

  const runBrowserLocalScan = useCallback(async (options: {
    files?: FileList | File[];
    dirHandle?: FileSystemDirectoryHandle;
    projectPath: string;
    logLabel?: string;
  }) => {
    if (hostedScanRequiresAuth(hosted) && isTokenExpired()) {
      setScanState('auth_required');
      setProgress(0);
      setProgressLabel('Sign in required to run analysis.');
      setLastErrorMsg('Sign in required to run analysis on the hosted dashboard.');
      toast.error('Sign in to run analysis.');
      return;
    }
    if (scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    setScanState('scanning');
    setProgress(2);
    setProgressLabel('Preparing files for scanning...');
    setTerminalOutput([]);
    setRequiresManualTrigger(false);
    setPath(options.projectPath);
    appendLog(`[SimpleBeacon] ${options.logLabel || 'Browser local scan'}...`);
    try {
      const report = await runLocalScan({
        files: options.files,
        dirHandle: options.dirHandle,
        projectPath: options.projectPath,
        onFilePrepProgress: (processed: number, total: number, label: string) => {
          if (total > 0) {
            setProgress(Math.min(15, Math.round((processed / total) * 15)));
            setProgressLabel(`${label} ${processed.toLocaleString()} / ${total.toLocaleString()}`);
          } else {
            setProgress(2);
            setProgressLabel(label);
          }
        },
        onProgress: (processed: number, total: number) => {
          if (total > 0) {
            setProgress(Math.min(90, 15 + Math.round((processed / total) * 75)));
            setProgressLabel(`Scanning ${processed.toLocaleString()} / ${total.toLocaleString()} files`);
          }
        },
      });
      setFileErrorsCount((report as any)?.telemetry?.fileErrors ?? null);
      setFileErrorExamples((report as any)?.telemetry?.fileErrorExamples ?? null);
      setProgressLabel('Processing results...');
      setProgress(95);
      const r = report as any;
      const scanResult: ScanResult = {
        totalFiles: r.repositoryFilesTotal || r.summary?.totalFiles || 0,
        issueCount: r.issueCount || r.summary?.totalFindings || 0,
        severityCounts: r.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        gate: r.gate || { pass: true, blockingCount: 0, warningCount: 0 },
        qualityScore: r.qualityScore ?? null,
        projectPath: r.projectPath || options.projectPath,
        scanScope: {
          profile: r.scanScope?.profile || 'standard',
          resultsViewScope: r.scanScope?.resultsViewScope || 'browser-local',
          codeFilesAnalyzed: r.scanScope?.codeFilesAnalyzed || r.scanScope?.ruleScopedFilesAnalyzed || r.summary?.codeFilesAnalyzed || r.filesAnalyzed || 0,
        },
      };
      setResult(scanResult);
      setFullReport(report);
      setScanState('complete');
      setProgress(100);
      appendLog(`[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`);
      persistScanResult(scanResult, report);
    } catch (err: any) {
      setScanState('error');
      const errMsg = err?.message || String(err || 'Unknown error');
      setLastErrorMsg(errMsg);
      appendLog(`[SimpleBeacon] Browser-local scan failed: ${errMsg}`);
      toast.error(errMsg || 'Local scan failed');
      postBrowserError({ source: 'dashboard', error: errMsg, filePath: options.projectPath, stack: err?.stack || null, context: 'drop-scan' });
    } finally {
      scanInFlightRef.current = false;
    }
  }, [appendLog, persistScanResult, hosted]);

  const ensureScanAuthorized = useCallback((): boolean => {
    if (!hostedScanRequiresAuth(hosted) || !isTokenExpired()) return true;
    setScanState('auth_required');
    setProgress(0);
    setProgressLabel('Sign in required to run analysis.');
    setLastErrorMsg('Sign in required to run analysis on the hosted dashboard.');
    appendLog('[SimpleBeacon] Authentication required before scan.');
    toast.error('Sign in to run analysis.');
    return false;
  }, [appendLog, hosted]);

  // Debounced append to reduce layout churn when many logs arrive quickly
  const debouncedAppendLog = useCallback((line: string) => {
    // Use a short debounce to batch rapid updates
    (window as any).__sb_debounce_append = (window as any).__sb_debounce_append || { timer: 0, queue: [] };
    const state = (window as any).__sb_debounce_append;
    state.queue.push(line);
    if (state.timer) return;
    state.timer = window.setTimeout(() => {
      setTerminalOutput((prev) => [...prev, ...state.queue]);
      state.queue = [];
      clearTimeout(state.timer);
      state.timer = 0;
    }, 80);
  }, []);

  const postBrowserError = useCallback(async (payload: any) => {
    try {
      const key = 'sb_pending_browser_errors';
      const body = {
        traceId: traceId || undefined,
        userId: userId || undefined,
        ...payload
      };

      // If no valid token, persist locally and skip network POST to avoid unauthenticated requests.
      if (isTokenExpired()) {
        try {
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.push(body);
          localStorage.setItem(key, JSON.stringify(existing));
        } catch (_e) { /* ignore */ }
        return;
      }

      const url = apiUrl('/simplebeacon/report/browser-error');
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (resp.status === 401) {
        // Auth required — persist locally for later retry
        try {
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.push(body);
          localStorage.setItem(key, JSON.stringify(existing));
        } catch (_e) { /* ignore */ }
      }
    } catch (e) {
      // Swallow errors — logging best-effort only
      console.debug('[SimpleBeacon] Failed to POST browser error', e);
      try {
        const key = 'sb_pending_browser_errors';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push({ traceId: traceId || undefined, userId: userId || undefined, ...payload });
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (_e) { /* ignore */ }
    }
  }, [traceId, userId]);

  // Small allowlist for transient/benign filenames to avoid noisy reports
  const fileErrorAllowlist = [
    /(^|[\\/])~\$/,
    /(^|[\\/])\.DS_Store$/i,
    /(^|[\\/])Thumbs\.db$/i,
    /(^|[\\/])desktop\.ini$/i,
    /(^|[\\/])\..*\.swp$/i,
    /(^|[\\/]).*\.tmp$/i
  ];
  const isAllowedFileError = (filePath: string) => {
    if (!filePath) return false;
    try {
      return fileErrorAllowlist.some((rx) => rx.test(filePath));
    } catch (_a) { return false; }
  };

  const isGithubUrl = (url: string) => /^https?:\/\/github\.com\//i.test(url.trim());

  const isWindowsPath = (p: string) => /^[A-Za-z]:[\\/]/.test(p.trim());

  const handleScan = useCallback(async () => {
    if (scanInFlightRef.current) {
      appendLog('[SimpleBeacon] Scan already in progress; ignoring duplicate start request.');
      return;
    }
    if (!ensureScanAuthorized()) {
      return;
    }
    scanInFlightRef.current = true;
    let scanInput = path.trim();

    // Reject page URL or fragment as scan path
    if (scanInput && (scanInput === window.location.href || scanInput === window.location.pathname || scanInput.includes(window.location.host + '/#/'))) {
      scanInput = '';
      setPath('');
    }

    if (mode === 'website') {
      if (!scanInput) {
        toast.error('Please enter a website URL');
        return;
      }
      if (!/^https?:\/\//i.test(scanInput)) {
        toast.error('Website URL must start with http:// or https://');
        return;
      }
    }

    if (!scanInput) {
      // Default to server's defaultProjectPath if available — but only for server scans
      // On a hosted dashboard, the server's path is on a remote machine and useless
      // for browser-local scanning. Prompt the user to enter a folder name instead.
      if (serverDefaultPath && !hosted) {
        scanInput = serverDefaultPath;
        setPath(scanInput);
        appendLog(`[SimpleBeacon] Using server default path: ${scanInput}`);
      } else {
        toast.error('Please enter a project folder name (e.g. CascadeProjects) or use the Browse Folder button.');
        return;
      }
    }
    setScanState('scanning');
    setProgress(0);
    setRequiresManualTrigger(false);
    setTerminalOutput([]);
    setResult(null);
    setFullReport(null);

    appendLog(`[SimpleBeacon] Starting scan: ${scanInput}`);
    setProgressLabel('Initializing...');
    setProgress(10);

    // Establish a traceId for this scan for correlation and capture user id if available
    try {
      setTraceId((crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
    } catch (_a) {
      setTraceId(String(Date.now()) + Math.random().toString(36).slice(2));
    }
    try {
      const maybe = (window as any).__SB_USER || localStorage.getItem('sb_user') || localStorage.getItem('sb_user_id');
      if (maybe) {
        try {
          const parsed = typeof maybe === 'string' ? JSON.parse(maybe) : maybe;
          setUserId(parsed && parsed.id ? String(parsed.id) : String(parsed || ''));
        } catch (_b) {
          setUserId(String(maybe));
        }
      }
    } catch (_c) { }

    try {
      const apiBase = getApiBase() || '';
      appendLog(`[SimpleBeacon] API base: ${apiBase || 'default'}`);

      let scanPath = scanInput;

      // If we have a dropped directory handle, use browser-based scan directly (skip server path resolution)
      // Browser-local scans run on the user's machine; auth is checked at scan start.
      // Server-side paths below also require authentication.
      const dirHandle = (window as any).__sbDroppedDirHandle as FileSystemDirectoryHandle | undefined;
      if (mode === 'local' && dirHandle && dirHandle.name === scanPath) {
        setProgressLabel('Collecting files from folder...');
        setProgress(5);
        appendLog(`[SimpleBeacon] Browser local scan via File System Access API...`);
        const report = await runLocalScan({
          dirHandle,
          projectPath: scanPath,
          onFilePrepProgress: (processed: number, total: number, label: string) => {
            if (total > 0) {
              const pct = Math.min(15, Math.round((processed / total) * 15));
              setProgress(pct);
              setProgressLabel(`${label} ${processed.toLocaleString()} / ${total.toLocaleString()}`);
            } else {
              setProgress(5);
              setProgressLabel(label);
            }
          },
          onProgress: (processed: number, total: number) => {
            if (total > 0) {
              setProgress(Math.min(90, 15 + Math.round((processed / total) * 75)));
              setProgressLabel(`Scanning ${processed.toLocaleString()} / ${total.toLocaleString()} files`);
            }
          },
          onFileError: (file: string, err: any) => {
            if (!isAllowedFileError(file)) {
              debouncedAppendLog(`[file-error] ${file} ${err?.name || ''} ${err?.message || ''}`);
              postBrowserError({ source: 'dashboard', error: err?.message || String(err), filePath: file, context: 'file-access', errorName: err?.name || null, stack: err?.stack || null });
            }
          }
        });
        setProgressLabel('Processing results...');
        setProgress(95);
        const r = report as any;
        setFileErrorsCount(r?.telemetry?.fileErrors ?? null);
        setFileErrorExamples(r?.telemetry?.fileErrorExamples ?? null);
        const scanResult: ScanResult = {
          totalFiles: r.repositoryFilesTotal || r.summary?.totalFiles || 0,
          issueCount: r.issueCount || r.summary?.totalFindings || 0,
          severityCounts: r.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          gate: r.gate || { pass: true, blockingCount: 0, warningCount: 0 },
          qualityScore: r.qualityScore ?? null,
          projectPath: r.projectPath || scanPath,
          scanScope: {
            profile: r.scanScope?.profile || 'standard',
            resultsViewScope: r.scanScope?.resultsViewScope || 'browser-local',
            codeFilesAnalyzed: r.scanScope?.codeFilesAnalyzed || r.scanScope?.ruleScopedFilesAnalyzed || r.summary?.codeFilesAnalyzed || r.filesAnalyzed || 0,
          },
        };
        setResult(scanResult);
        setFullReport(report);
        setScanState('complete');
        setProgress(100);
        appendLog(`[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`);
        persistScanResult(scanResult, report);
        return;
      }

      // Detect local path on hosted dashboard — auto-switch to browser-local scan
      // On a hosted dashboard, the remote server cannot access the user's local filesystem.
      // Any non-URL path (Windows drive letter, Unix absolute, or relative folder name) should
      // trigger the browser-local scan via File System Access API.
      // Exception: the server's own defaultProjectPath should be scanned remotely, not locally.
      const isUrl = /^https?:\/\//i.test(scanPath);
      const isServerDefaultPath = !!serverDefaultPath && scanPath === serverDefaultPath;
      if (!isUrl && !isGithubUrl(scanPath) && hosted && !isServerDefaultPath) {
        const hasFsaEarly = typeof (window as any).showDirectoryPicker === 'function';
        // Relative names like "Games" cannot be resolved on hosted without bridge or FSA.
        // Skip async bridge probes that break the user-gesture chain on Firefox/Safari.
        if (!isAbsoluteLocalPath(scanPath) && !bridgeBase && !hasFsaEarly) {
          appendLog('[SimpleBeacon] Relative folder name without IDE bridge — use Select Folder (sync click) or drop onto scan zone.');
          setRequiresManualTrigger(true);
          setScanState('idle');
          setProgress(0);
          setProgressLabel('Click Select Folder to choose a local directory to scan.');
          toast.info('Your browser cannot resolve "' + scanPath + '" automatically. Click Select Folder below.');
          return;
        }
        // Bridge-first: scan via VS Code extension data server when available
        let activeBridge = bridgeBase;
        let activeToken = bridgeToken;
        if (!activeBridge) {
          appendLog('[SimpleBeacon] No bridge yet — probing local extension ports (user gesture)...');
          const probe = await recheckBridge(true);
          if (probe?.ok && 'base' in probe && probe.base) {
            activeBridge = probe.base;
            if ('token' in probe && probe.token) {
              activeToken = probe.token;
            } else if (typeof sessionStorage !== 'undefined') {
              activeToken = sessionStorage.getItem('sb_bridge_token');
            }
          }
        }
        let bridgeReachable = false;
        if (activeBridge) {
          bridgeReachable = await checkLocalNetworkAccess(activeBridge, 2000);
          if (bridgeReachable) {
            try {
              appendLog('[SimpleBeacon] Scanning via local VS Code extension bridge...');
              setProgressLabel('Scanning workspace via local IDE engine...');
              setProgress(5);
              const report = await runBridgeExtensionScan(activeBridge, scanPath, activeToken, {
                appendLog,
                setProgress,
                setProgressLabel,
              });
              setProgressLabel('Processing results...');
              setProgress(95);
              const r = report as any;
              setFileErrorsCount(r?.telemetry?.fileErrors ?? null);
              setFileErrorExamples(r?.telemetry?.fileErrorExamples ?? null);
              const scanResult: ScanResult = {
                totalFiles: r.repositoryFilesTotal || r.summary?.totalFiles || r.totalFiles || 0,
                issueCount: r.issueCount || r.summary?.totalFindings || (r.rawIssues?.length ?? 0),
                severityCounts: r.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
                gate: r.gate || { pass: true, blockingCount: 0, warningCount: 0 },
                qualityScore: r.qualityScore ?? null,
                projectPath: r.projectPath || r.projectRoot || scanPath,
                scanScope: {
                  profile: r.scanScope?.profile || 'standard',
                  resultsViewScope: r.scanScope?.resultsViewScope || 'extension-bridge',
                  codeFilesAnalyzed: r.scanScope?.codeFilesAnalyzed || r.scanScope?.ruleScopedFilesAnalyzed || r.summary?.codeFilesAnalyzed || r.filesAnalyzed || 0,
                },
              };
              setResult(scanResult);
              setFullReport(report);
              setScanState('complete');
              setProgress(100);
              appendLog(`[SimpleBeacon] Bridge scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues`);
              persistScanResult(scanResult, report);
              return;
            } catch (bridgeErr: any) {
              appendLog(`[SimpleBeacon] Extension bridge scan failed: ${bridgeErr?.message || bridgeErr}. Falling back to browser-local scan...`);
            }
          } else {
            appendLog(`[SimpleBeacon] Extension bridge ${activeBridge} not reachable, falling back to browser-local scan...`);
          }
        } else {
          appendLog('[SimpleBeacon] VS Code extension bridge not found. Install the extension or use Browse Folder.');
        }
        // Browser-local fallback when bridge is unavailable or bridge scan failed
        let dirHandlePick: any = null;
        const hasFsa = typeof (window as any).showDirectoryPicker === 'function';
        console.warn('[SimpleBeacon] Browser-local scan path: showDirectoryPicker available:', hasFsa, '| folderInputRef exists:', !!folderInputRef.current, '| bridgeBase:', activeBridge, '| scanPath:', scanPath);
        if (hasFsa) {
          appendLog(`[SimpleBeacon] Local path "${scanPath}" detected on hosted dashboard. Switching to browser-local scan...`);
          toast.info('Local path detected. Please select the folder in the picker to scan it in your browser.');
          try {
            dirHandlePick = await (window as any).showDirectoryPicker();
            console.warn('[SimpleBeacon] showDirectoryPicker succeeded:', dirHandlePick?.name);
          } catch (e: any) {
            if (e?.name === 'AbortError') {
              setScanState('idle');
              return;
            }
            console.error('[SimpleBeacon] showDirectoryPicker failed:', e);
            appendLog(`[SimpleBeacon] showDirectoryPicker failed: ${e?.name || ''} ${e?.message || e}, trying file input fallback...`);
            postBrowserError({ source: 'dashboard', error: String(e?.message || e), filePath: scanPath, context: 'showDirectoryPicker', errorName: e?.name || null, stack: e?.stack || null });
          }
        }
        if (!dirHandlePick && folderInputRef.current) {
          // The user-gesture chain may be broken by the async checkLocalNetworkAccess /
          // showDirectoryPicker awaits above. Some browsers (Firefox, Safari, cross-origin
          // iframes) will silently block .click() on a file input when not invoked within
          // a synchronous user gesture. Surface a manual "Select Folder" button instead.
          const gestureChainBroken = !hasFsa;
          console.warn('[SimpleBeacon] Using file input fallback. folderInputRef.current:', folderInputRef.current, '| has webkitdirectory:', folderInputRef.current.hasAttribute('webkitdirectory'), '| gestureChainBroken:', gestureChainBroken);
          appendLog('[SimpleBeacon] Using file input fallback for folder selection...');
          if (gestureChainBroken) {
            setRequiresManualTrigger(true);
            setScanState('idle');
            setProgress(0);
            setProgressLabel('Click "Select Folder" below to choose a local directory to scan.');
            appendLog('[SimpleBeacon] Gesture chain broken — showing manual Select Folder button.');
            return;
          }
          toast.info('Please select the folder to scan using the file picker (select any file in the folder).');
          try {
            folderInputRef.current.click();
          } catch (clickErr: any) {
            console.error('[SimpleBeacon] folderInputRef.current.click() threw:', clickErr);
            setScanState('idle');
          }
          // Keep scanState as 'scanning' with a waiting message so the loading overlay stays visible
          // while the file picker is open. handleFileSelect will update progress when the user picks a folder.
          setProgressLabel('Waiting for folder selection — select a folder in the picker to continue...');
          setProgress(1);
          return;
        }
        if (!dirHandlePick) {
          setScanState('error');
          appendLog('[SimpleBeacon] No folder picker available in this context. Cannot scan local path on hosted dashboard.');
          toast.error('No folder picker available. Use the "Browse Folder" button to select a local directory, or enter a GitHub URL.');
          return;
        }
        if (dirHandlePick) {
          setProgressLabel('Collecting files from folder...');
          setProgress(5);
          appendLog(`[SimpleBeacon] Browser local scan via File System Access API...`);
          const report = await runLocalScan({
            dirHandle: dirHandlePick,
            projectPath: scanPath,
            onFilePrepProgress: (processed: number, total: number, label: string) => {
              if (total > 0) {
                const pct = Math.min(15, Math.round((processed / total) * 15));
                setProgress(pct);
                setProgressLabel(`${label} ${processed.toLocaleString()} / ${total.toLocaleString()}`);
              } else {
                setProgress(5);
                setProgressLabel(label);
              }
            },
            onProgress: (processed: number, total: number) => {
              if (total > 0) {
                setProgress(Math.min(90, 15 + Math.round((processed / total) * 75)));
                setProgressLabel(`Scanning ${processed.toLocaleString()} / ${total.toLocaleString()} files`);
              }
            },
            onFileError: (file: string, err: any) => {
              if (!isAllowedFileError(file)) {
                debouncedAppendLog(`[file-error] ${file} ${err?.name || ''} ${err?.message || ''}`);
                postBrowserError({ source: 'dashboard', error: err?.message || String(err), filePath: file, context: 'file-access', errorName: err?.name || null, stack: err?.stack || null });
              }
            }
          });
          setFileErrorsCount((report as any)?.telemetry?.fileErrors ?? null);
          setFileErrorExamples((report as any)?.telemetry?.fileErrorExamples ?? null);
          setProgressLabel('Processing results...');
          setProgress(95);
          const r = report as any;
          const scanResult: ScanResult = {
            totalFiles: r.repositoryFilesTotal || r.summary?.totalFiles || 0,
            issueCount: r.issueCount || r.summary?.totalFindings || 0,
            severityCounts: r.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
            gate: r.gate || { pass: true, blockingCount: 0, warningCount: 0 },
            qualityScore: r.qualityScore ?? null,
            projectPath: r.projectPath || scanPath,
            scanScope: {
            profile: r.scanScope?.profile || 'standard',
            resultsViewScope: r.scanScope?.resultsViewScope || 'browser-local',
            codeFilesAnalyzed: r.scanScope?.codeFilesAnalyzed || r.scanScope?.ruleScopedFilesAnalyzed || r.summary?.codeFilesAnalyzed || r.filesAnalyzed || 0,
          },
          };
          setResult(scanResult);
          setFullReport(report);
          setScanState('complete');
          setProgress(100);
          appendLog(`[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`);
          persistScanResult(scanResult, report);
          return;
        }
      }

      // Server-side scan paths below require authentication.
      if (isTokenExpired()) {
        setScanState('auth_required');
        setProgress(0);
        setProgressLabel('Session expired. Please sign in again.');
        setLastErrorMsg('Session expired. Please sign in again.');
        appendLog('[SimpleBeacon] Authentication required: session expired before server-side scan.');
        toast.error('Your session has expired. Please sign in again.');
        return;
      }

      // Detect Windows path when no local server — use server's defaultProjectPath
      if (isWindowsPath(scanPath) && !apiBase) {
        appendLog(`[SimpleBeacon] Windows path "${scanPath}" detected but no local server running.`);
        appendLog(`[SimpleBeacon] Fetching server default path to scan remotely...`);
        toast.warning('Local API server not detected. Scanning the remote server\'s project directory instead.');
        try {
          const pr = await fetch(apiUrl('/analyze/providers'), { headers: authHeaders() });
          if (pr.ok) {
            const pd = await pr.json();
            if (pd.defaultProjectPath) {
              scanPath = pd.defaultProjectPath;
              appendLog(`[SimpleBeacon] Using server defaultProjectPath: ${scanPath}`);
            }
          }
        } catch {
          appendLog(`[SimpleBeacon] Could not fetch server default path, sending original`);
        }
      }

      // If path is relative and we have a server API, try to resolve it
      if (scanPath && !scanPath.startsWith('/') && !scanPath.match(/^[A-Za-z]:[\\/]/) && !isGithubUrl(scanPath) && !scanPath.match(/^https?:\/\//i)) {
        appendLog(`[SimpleBeacon] Resolving relative path "${scanPath}" via server...`);
        try {
          const providersController = new AbortController();
          const providersTimeout = setTimeout(() => providersController.abort(), 10000);
          const providersResp = await fetch(apiUrl('/analyze/providers'), {
            headers: authHeaders(),
            signal: providersController.signal,
          });
          clearTimeout(providersTimeout);
          if (providersResp.ok) {
            const providersData = await providersResp.json();
            const defaultPath = providersData.defaultProjectPath;
            const allowedRoots: string[] = providersData.allowedAnalysisRoots || [];
            appendLog(`[SimpleBeacon] Server defaultProjectPath: ${defaultPath}, allowedRoots: ${allowedRoots.length}`);
            // Try joining with each allowed root, use the first that contains the folder
            for (const root of [...allowedRoots, defaultPath].filter(Boolean)) {
              const candidate = root.replace(/\/+$/, '') + '/' + scanPath.replace(/^[\\/]+/, '');
              appendLog(`[SimpleBeacon] Trying: ${candidate}`);
              try {
                const verifyController = new AbortController();
                const verifyTimeout = setTimeout(() => verifyController.abort(), 10000);
                const verifyResp = await fetch(apiUrl('/verify-path'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeaders() },
                  body: JSON.stringify({ path: candidate }),
                  signal: verifyController.signal,
                });
                clearTimeout(verifyTimeout);
                if (verifyResp.ok) {
                  const v = await verifyResp.json();
                  if (v && v.success) {
                    scanPath = candidate;
                    // auto-apply verified candidate and log it
                    setPath(candidate);
                    setResolvedCandidate(null);
                    setCandidateError(null);
                    appendLog(`[SimpleBeacon] Applied verified candidate: ${candidate}`);
                    toast.success('Applied verified server candidate');
                    break;
                  }
                  const errMsg = v && v.error ? v.error : 'unknown';
                  appendLog(`[SimpleBeacon] Candidate invalid: ${errMsg}`);
                  setCandidateError(errMsg);
                  setResolvedCandidate(null);
                } else if (verifyResp.status === 404) {
                  appendLog(`[SimpleBeacon] Verify endpoint not available, skipping path resolution`);
                  break;
                } else {
                  appendLog(`[SimpleBeacon] Verify endpoint returned ${verifyResp.status}`);
                }
              } catch (e: any) {
                const m = e?.message || String(e);
                appendLog(`[SimpleBeacon] Path verify failed: ${m}`);
                setCandidateError(m);
              }
            }
          }
        } catch (e) {
          appendLog(`[SimpleBeacon] Could not resolve relative path, sending as-is`);
        }
      }

      // GitHub URL: clone first, then scan the local clone path
      if (isGithubUrl(scanPath)) {
        setProgressLabel('Cloning GitHub repository...');
        setProgress(20);
        appendLog(`[SimpleBeacon] Cloning ${scanPath}...`);
        const cloneResp = await fetch(apiUrl('/analyze/github-clone'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ repoUrl: scanPath }),
        });
        if (!cloneResp.ok) {
          const cloneErr = await cloneResp.json().catch(() => ({}));
          throw new Error(cloneErr.error || `GitHub clone failed (${cloneResp.status})`);
        }
        const cloneData = await cloneResp.json();
        if (!cloneData.success) throw new Error(cloneData.error || 'GitHub clone failed');
        scanPath = cloneData.projectPath;
        appendLog(`[SimpleBeacon] Clone complete: ${scanPath} (method: ${cloneData.method || 'git'})`);
        setProgress(40);
      }

      setProgressLabel('Resolving scan strategy...');
      setProgress(50);

      if (apiBase || hosted) {
        const scanMode = apiBase ? 'local server' : 'remote backend (Render proxy)';
        appendLog(`[SimpleBeacon] Requesting server scan via ${scanMode}...`);
        setProgressLabel(`Scanning via ${scanMode}...`);
        setProgress(60);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        let resp: Response;
        try {
          resp = await fetch(apiUrl('/analyze/flexible'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ projectPath: scanPath, analysisType: 'codebase' }),
            signal: controller.signal,
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr?.name === 'AbortError') {
            throw new Error('Scan timed out after 120 seconds. The server may be unresponsive.');
          }
          throw fetchErr;
        }
        clearTimeout(timeoutId);

        if (!resp.ok) {
          if (resp.status === 401) {
            setScanState('auth_required');
            setProgress(0);
            setProgressLabel('Session expired. Please sign in again.');
            setLastErrorMsg('Session expired. Please sign in again.');
            appendLog('[SimpleBeacon] Authentication required: /analyze/flexible returned 401.');
            toast.error('Your session has expired. Please sign in again.');
            return;
          }
          throw new Error(`Server returned ${resp.status}`);
        }
        const data = await resp.json();

        // Handle async scan job (202) — poll until complete
        if (data.asyncScan && data.scanId) {
          const scanId = data.scanId;
          appendLog(`[SimpleBeacon] Server scan started (job ${scanId}), polling for results...`);
          let pollData: any = null;
          let pollAttempts = 0;
          const maxPollAttempts = 120; // 120 × 2s = 240s max
          while (pollAttempts < maxPollAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            pollAttempts++;
            try {
              const pollResp = await fetch(apiUrl(`/analyze/progress?scanId=${encodeURIComponent(scanId)}`), {
                headers: authHeaders(),
              });
              if (!pollResp.ok) {
                if (pollResp.status === 404) {
                  throw new Error('Scan job not found on server. It may have expired.');
                }
                throw new Error(`Poll returned ${pollResp.status}`);
              }
              pollData = await pollResp.json();
              if (pollData.status === 'complete') {
                appendLog(`[SimpleBeacon] Scan complete (polled ${pollAttempts} times)`);
                break;
              }
              if (pollData.status === 'error') {
                throw new Error(pollData.error || 'Scan failed on server');
              }
              if (pollData.percent != null) {
                setProgress(60 + Math.round(pollData.percent * 0.3));
                setProgressLabel(`Scanning... ${pollData.percent}% (${pollData.current}/${pollData.total})`);
              }
            } catch (pollErr: any) {
              throw pollErr;
            }
          }
          if (!pollData || pollData.status !== 'complete') {
            throw new Error('Scan timed out waiting for results. The server may be overloaded.');
          }
          // Use the report from the poll response
          const data2 = pollData.reportJson;
          if (!data2 || !data2.success) {
            throw new Error('Scan completed but no report was returned');
          }
          Object.assign(data, data2);
        }

        setProgressLabel('Processing results...');
        setProgress(90);

        const r = data.report || {};
        const s = r.summary || {};
        const scope = r.scanScope || data.scanScope || {};
        const scanResult: ScanResult = {
          totalFiles: s.repositoryFilesTotal || r.repositoryFilesTotal || r.repositoryInventory?.totalFiles || data.repositoryFilesTotal || 0,
          issueCount: s.findingsTotal || r.issueCount || data.issueCount || 0,
          severityCounts: s.severityCounts || r.severityCounts || data.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          gate: r.gate || data.gate || { pass: true, blockingCount: 0, warningCount: 0 },
          qualityScore: s.healthScore ?? r.qualityScore ?? data.qualityScore ?? null,
          projectPath: r.projectRoot || r.projectPath || data.projectPath || scanPath,
          scanScope: {
            profile: scope.scanProfile || scope.profile || 'standard',
            resultsViewScope: scope.scanContext || scope.resultsViewScope || 'platform-only',
            codeFilesAnalyzed: s.codeFilesAnalyzed || s.ruleScopedFilesAnalyzed || r.ruleScopedFilesAnalyzed || r.filesAnalyzed || 0,
          },
        };

        setResult(scanResult);
        setFullReport(data.report || data);
        setScanState('complete');
        setProgress(100);
        appendLog(`[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`);

        persistScanResult(scanResult, data.report || data);
      } else {
        appendLog(`[SimpleBeacon] No API base — browser sandbox mode`);
        setProgressLabel('Browser sandbox not available in React mode yet');
        setProgress(50);
        throw new Error('Browser sandbox scan requires the vanilla JS service. Use server mode with sb_api_base parameter.');
      }
    } catch (err: any) {
      setScanState('error');
      const errMsg = err?.message || String(err || 'Unknown error');
      setLastErrorMsg(errMsg);
      appendLog(`[SimpleBeacon] Error: ${errMsg}`);
      console.error('[SimpleBeacon] Scan error:', err);
      toast.error(errMsg || 'Scan failed');
      postBrowserError({ source: 'dashboard', error: errMsg, filePath: path || null, stack: (err && err.stack) || null, context: 'handleScan' });
    } finally {
      scanInFlightRef.current = false;
    }
  }, [path, mode, appendLog, hosted, serverDefaultPath, ensureScanAuthorized, bridgeBase, bridgeToken, recheckBridge, persistScanResult, postBrowserError, debouncedAppendLog, isAllowedFileError]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (hostedScanRequiresAuth(hosted) && isTokenExpired()) {
      setScanState('auth_required');
      setLastErrorMsg('Sign in required to run analysis on the hosted dashboard.');
      toast.error('Sign in to run analysis.');
      return;
    }

    const capturedEntries = captureDropEntries(e.dataTransfer.items);
    const dtFiles = Array.from(e.dataTransfer.files);
    const firstItem = e.dataTransfer.items?.[0] as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle> };

    // Firefox invalidates DataTransfer (and all derived FileSystemEntry/File
    // objects) after the drop event handler yields on its first await. The
    // modern getAsFileSystemHandle() API returns a stable FileSystemDirectoryHandle
    // that survives after the event, but the call itself MUST be initiated
    // synchronously before any await — otherwise the DataTransferItem is already
    // stale. Capture the Promise here; await it later as the primary path.
    let fsHandlePromise: Promise<FileSystemHandle | null> | null = null;
    if (firstItem && typeof firstItem.getAsFileSystemHandle === 'function') {
      try {
        fsHandlePromise = firstItem.getAsFileSystemHandle();
      } catch {
        /* getAsFileSystemHandle not available or DataTransferItem stale */
      }
    }

    if (dtFiles.length > 0 && (dtFiles[0] as any).path) {
      const filePath = String((dtFiles[0] as any).path).replace(/\\/g, '/');
      const folderName = (dtFiles[0] as any).webkitRelativePath?.split('/')[0] || dtFiles[0].name;
      const idx = filePath.indexOf(`/${folderName}/`);
      const absPath = idx >= 0
        ? filePath.slice(0, idx + folderName.length + 1).replace(/\//g, '\\')
        : filePath.slice(0, filePath.lastIndexOf('/')).replace(/\//g, '\\');
      if (absPath) {
        setPath(absPath);
        toast.info(`Folder dropped: ${absPath}`);
        return;
      }
    }

    // Primary path: use the modern File System Access API handle. This is
    // stable across event yields and supports recursive directory traversal
    // without DataTransfer invalidation issues in Firefox.
    if (fsHandlePromise) {
      try {
        const handle = await fsHandlePromise;
        if (handle && handle.kind === 'directory') {
          const dirHandle = handle as FileSystemDirectoryHandle;
          toast.info(`Scanning dropped folder "${dirHandle.name}"...`);
          await runBrowserLocalScan({
            dirHandle,
            projectPath: dirHandle.name,
            logLabel: `Browser local scan via directory handle (${dirHandle.name})`,
          });
          return;
        }
      } catch (dropErr: any) {
        appendLog(`[SimpleBeacon] getAsFileSystemHandle failed: ${dropErr?.message || dropErr}`);
      }
    }

    // Fallback: webkitGetAsEntry traversal. In Firefox this may fail with
    // DOMException if the DataTransfer was invalidated between capture and
    // traversal.
    if (capturedEntries.length > 0) {
      try {
        const { files, rootName, traverseErrors } = await collectFilesFromDrop(undefined, capturedEntries);
        if (files.length > 0) {
          if (traverseErrors > 0) {
            appendLog(`[SimpleBeacon] Warning: ${traverseErrors} file(s) unreadable during drop traversal.`);
          }
          toast.info(`Scanning dropped folder "${rootName}" (${files.length.toLocaleString()} files)...`);
          try {
            await runBrowserLocalScan({
              files,
              projectPath: rootName,
              logLabel: `Browser local scan via drag-and-drop (${files.length.toLocaleString()} files)`,
            });
          } catch (scanErr: any) {
            appendLog(`[SimpleBeacon] Browser local scan failed: ${scanErr?.name || ''} ${scanErr?.message || scanErr}`);
            console.error('[SimpleBeacon] runBrowserLocalScan error:', scanErr);
            try {
              // Extra defensive logging for DOMException-like failures
              console.error('Error details:', {
                name: scanErr?.name,
                message: scanErr?.message,
                code: scanErr?.code,
                stack: scanErr?.stack,
              });
            } catch (logErr) {
              console.warn('[SimpleBeacon] Failed to stringify scan error details', logErr);
            }
            throw scanErr;
          }
          return;
        }
      } catch (traverseErr: any) {
        appendLog(`[SimpleBeacon] Drop traversal failed: ${traverseErr?.message || traverseErr}`);
        console.warn('[SimpleBeacon] Drop traversal error:', traverseErr);
      }
    }

    if (dtFiles.length > 0) {
      const flatFiles: VirtualFile[] = [];
      const hasRelativePath = dtFiles.some((f) => {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
        return rel && rel.includes('/');
      });
      // Guard: if only 1-2 files without webkitRelativePath, the folder wasn't
      // traversed (browser DOMException on readEntries). Scanning 1 file from
      // a folder drop produces a false-positive gate PASS. Match the /audit
      // page behavior: refuse to scan and prompt for Select Folder.
      if (!hasRelativePath && dtFiles.length <= 2) {
        toast.warning('Folder drop exposed only 1 file. Click Select Folder to scan the full directory.', { duration: 10000 });
        setScanState('idle');
        return;
      }
      for (const f of dtFiles) {
        const virtualFile = f as VirtualFile;
        const rel = hasRelativePath
          ? (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
          : f.name;
        try {
          Object.defineProperty(virtualFile, 'webkitRelativePath', {
            value: rel,
            configurable: true,
          });
        } catch {
          /* ignore */
        }
        virtualFile._virtualPath = (rel || f.name).replace(/\\/g, '/');
        flatFiles.push(virtualFile);
      }
      const firstRel = flatFiles[0]?._virtualPath || flatFiles[0]?.name || 'dropped-files';
      const rootName = String(firstRel).split('/')[0] || 'dropped-files';
      toast.info(`Scanning dropped folder "${rootName}" (${flatFiles.length.toLocaleString()} files)...`);
      await runBrowserLocalScan({
        files: flatFiles,
        projectPath: rootName,
        logLabel: `Browser local scan via flat drop (${flatFiles.length.toLocaleString()} files)`,
      });
      return;
    }

      const first = dtFiles[0];
      const dirName = (first as any).webkitRelativePath?.split('/')[0] || first.name;
      if (hosted && bridgeBase && dirName) {
        const bridgePath = await findFolderViaBridge(dirName, bridgeBase, bridgeToken);
        if (bridgePath) {
          setPath(bridgePath);
          toast.info(`Folder located via bridge: ${bridgePath}`);
          return;
        }
      }
      setPath(dirName);
      setRequiresManualTrigger(true);
      setScanState('idle');
    toast.error('Could not read dropped folder. Click Select Folder below or install the VS Code extension.');
    setRequiresManualTrigger(true);
    setScanState('idle');
  }, [appendLog, bridgeBase, bridgeToken, hosted, runBrowserLocalScan]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (hostedScanRequiresAuth(hosted) && isTokenExpired()) {
      setScanState('auth_required');
      setLastErrorMsg('Sign in required to run analysis on the hosted dashboard.');
      toast.error('Sign in to run analysis.');
      e.target.value = '';
      return;
    }
    console.warn('[SimpleBeacon] handleFileSelect: files.length =', files.length, '| first.webkitRelativePath =', (files[0] as any).webkitRelativePath);
    const first = files[0];
    const rel = (first as any).webkitRelativePath;
    let dirName = first.name;
    if (rel) {
      dirName = rel.split('/')[0] || first.name;
    }
    setPath(dirName);

    // Run a browser-local scan with the selected files — no server involved
    setScanState('scanning');
    setProgress(2);
    setProgressLabel(`Preparing ${files.length.toLocaleString()} files for scanning...`);
    setTerminalOutput([]);
    appendLog(`[SimpleBeacon] Browser local scan via file input (${files.length} files selected)...`);
    try {
      const report = await runLocalScan({
        files,
        projectPath: dirName,
        onFilePrepProgress: (processed: number, total: number, label: string) => {
          // File prep phase: 0-15% of the bar
          if (total > 0) {
            const pct = Math.min(15, Math.round((processed / total) * 15));
            setProgress(pct);
            setProgressLabel(`${label} ${processed.toLocaleString()} / ${total.toLocaleString()}`);
          } else {
            setProgress(2);
            setProgressLabel(label);
          }
        },
        onProgress: (processed: number, total: number) => {
          if (total > 0) {
            // Worker scan phase: 15-90% of the bar
            setProgress(Math.min(90, 15 + Math.round((processed / total) * 75)));
            setProgressLabel(`Scanning ${processed.toLocaleString()} / ${total.toLocaleString()} files`);
          }
        },
      });
      setFileErrorsCount((report as any)?.telemetry?.fileErrors ?? null);
      setFileErrorExamples((report as any)?.telemetry?.fileErrorExamples ?? null);
      setProgressLabel('Processing results...');
      setProgress(95);
      const r = report as any;
      const scanResult: ScanResult = {
        totalFiles: r.repositoryFilesTotal || r.summary?.totalFiles || 0,
        issueCount: r.issueCount || r.summary?.totalFindings || 0,
        severityCounts: r.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        gate: r.gate || { pass: true, blockingCount: 0, warningCount: 0 },
        qualityScore: r.qualityScore ?? null,
        projectPath: r.projectPath || dirName,
        scanScope: {
            profile: r.scanScope?.profile || 'standard',
            resultsViewScope: r.scanScope?.resultsViewScope || 'browser-local',
            codeFilesAnalyzed: r.scanScope?.codeFilesAnalyzed || r.scanScope?.ruleScopedFilesAnalyzed || r.summary?.codeFilesAnalyzed || r.filesAnalyzed || 0,
          },
      };
      setResult(scanResult);
      setFullReport(report);
      setScanState('complete');
      setProgress(100);
      appendLog(`[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`);
      persistScanResult(scanResult, report);
    } catch (err: any) {
      console.error('[SimpleBeacon] Browser-local scan (file input) failed:', err);
      setScanState('error');
      appendLog(`[SimpleBeacon] Browser-local scan failed: ${err?.message || err}`);
      toast.error(err?.message || 'Local scan failed');
      postBrowserError({ source: 'dashboard', error: err?.message || String(err), filePath: dirName, stack: err?.stack || null, context: 'file-input-scan' });
    }
    // Reset input so the same folder can be selected again
    e.target.value = '';
  }, [appendLog, hosted, persistScanResult]);

  const handleBrowseFolder = useCallback(async () => {
    // 1. Try extension bridge folder picker first (works in cross-origin iframes)
    if (bridgeBase) {
      const ok = await checkLocalNetworkAccess(bridgeBase, 2000);
      if (!ok) {
        setLocalNetworkDenied(true);
        toast.error('Local Network Access blocked — cannot open bridge folder picker');
        return;
      }
      const bridgePath = await pickFolderViaExtensionBridge(bridgeBase, bridgeToken);
      if (bridgePath) {
        setPath(bridgePath);
        toast.info(`Folder selected via extension: ${bridgePath}`);
        return;
      }
    }
    // 2. Try browser-native directory picker
    if (typeof (window as any).showDirectoryPicker !== 'function') {
      folderInputRef.current?.click();
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker();
      if (handle) {
        // On hosted dashboard with bridge, try to resolve real path via bridge
        if (hosted && bridgeBase) {
          const bridgePath = await findFolderViaBridge(handle.name, bridgeBase, bridgeToken);
          if (bridgePath) {
            setPath(bridgePath);
            toast.info(`Folder selected: ${bridgePath}`);
            return;
          }
        }
        setPath(handle.name);
        toast.info(`Folder selected: ${handle.name}`);
        (window as any).__sbDroppedDirHandle = handle;
      }
    } catch {
      // User cancelled or permission denied — fall back to input
      folderInputRef.current?.click();
    }
  }, [bridgeBase, bridgeToken, hosted]);

  const modeTabs: { key: ScanMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = websiteMode
    ? [
        { key: 'website', label: 'Website URL', icon: Globe },
        { key: 'github', label: 'GitHub URL', icon: Github },
      ]
    : [
        { key: 'local', label: 'Local Path', icon: Folder },
        { key: 'server', label: 'Server Path', icon: FolderSearch },
        { key: 'github', label: 'GitHub URL', icon: Github },
      ];

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={async () => {
          try {
            if (notifsEnabled) {
              setNotificationsPreference(false);
              setNotifsEnabled(false);
              toast.success('Notifications disabled');
              return;
            }
            setNotificationsPreference(true);
            setNotifsEnabled(true);
            const perm = await requestNotificationPermission();
            if (perm === 'granted') {
              showOSNotification('SimpleBeacon', { body: 'Notifications enabled' });
              toast.success('Notifications enabled');
            }
            else {
              toast.error('Notifications not enabled');
            }
          }
          catch (e) {
            toast.error('Could not enable notifications');
          }
        }}>{notifsEnabled ? 'Disable notifications' : 'Enable notifications'}</Button>
      </div>
      {localNetworkDenied && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-yellow-400/30 bg-yellow-50/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" />
            <div>
              <div className="font-medium">Local Network Access required</div>
              <div className="text-xs text-foreground-muted">The hosted dashboard needs permission to reach your local SimpleBeacon bridge. Grant permission in your browser and retry.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={async () => {
              if (!bridgeBase) return;
              const ok = await checkLocalNetworkAccess(bridgeBase, 3000);
              if (ok) setLocalNetworkDenied(false);
              else {
                toast.error('Local Network Access still blocked. Check browser site settings.');
              }
            }}>Retry</Button>
          </div>
        </div>
      )}
      {/* Hidden file inputs used for folder fallback and upload */}
      <input ref={uploadInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return; try {
          const txt = await f.text();
          let parsed = null;
          try { parsed = JSON.parse(txt); } catch (_a) { parsed = null; }
          const url = apiUrl('/simplebeacon/report/upload');
          const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: parsed ? JSON.stringify(parsed) : txt });
          if (resp.ok) {
            toast.success('Uploaded scan JSON successfully');
          } else {
            toast.error('Upload failed');
          }
        } catch (err) { toast.error('Upload failed'); }
        // reset
        (e.target as HTMLInputElement).value = '';
      }} />

      {scanState === 'error' && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <div className="font-medium">Scan failed</div>
              <div className="text-xs text-foreground-muted">{terminalOutput.length ? terminalOutput[terminalOutput.length - 1] : 'An error occurred during scan.'}</div>
              <div className="mt-1 text-xs text-foreground-muted">Try one of these workarounds.</div>
            </div>
          </div>
            <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { handleBrowseFolder(); }}>Browse folder</Button>
            <Button size="sm" onClick={() => { setShowAgentModal(true); }}>Use Local Agent</Button>
            <Button size="sm" onClick={() => uploadInputRef.current?.click()}>Upload scan JSON</Button>
          </div>
        </div>
      )}

      {/* Local Agent Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Local Agent</h3>
                <p className="mt-1 text-sm text-foreground-muted">Start the Local Agent on your machine to enable direct filesystem scans from the hosted dashboard. The agent listens on loopback and proxies requests to your filesystem.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setShowAgentModal(false)}>Close</Button>
              </div>
            </div>

            <Tabs defaultValue="instructions" className="mt-3">
              <TabsList>
                <TabsTrigger value="instructions">Instructions</TabsTrigger>
                <TabsTrigger value="errors">Browser errors</TabsTrigger>
              </TabsList>

              <TabsContent value="instructions">
                <ol className="mt-3 ml-4 text-sm list-decimal">
                  <li>Download/start the agent: <code>node local-agent/agent.js</code> or use the platform installer.</li>
                  <li>Allow Local Network Access when prompted by your browser.</li>
                  <li>Click "Probe agent now" to detect a running agent and apply the bridge.</li>
                </ol>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!rerunAfterProbe} onChange={(e) => setRerunAfterProbe(e.target.checked)} />
                  <span>Re-run current scan after successful probe</span>
                </label>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button onClick={async () => {
                    setProbingAgent(true);
                    try {
                      const res = await discoverAndApplyExtensionBridge({ userInitiated: true });
                      if (res && res.ok) {
                        toast.success('Local agent detected and applied');
                        setShowAgentModal(false);
                        if (rerunAfterProbe) {
                          // Re-run the scan after a brief delay to allow bridge to settle
                          setTimeout(() => { try { (handleScan as any)(); } catch { } }, 500);
                        }
                      } else {
                        toast.error('Local agent not detected');
                      }
                    } catch (e) {
                      toast.error('Probe failed');
                    }
                    setProbingAgent(false);
                  }}>{probingAgent ? 'Probing...' : 'Probe agent now'}</Button>
                </div>
              </TabsContent>

              <TabsContent value="errors">
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Recent browser errors</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={async () => {
                        setBrowserErrorsLoading(true);
                        try {
                          const resp = await fetch(apiUrl('/simplebeacon/report/browser-errors'), { headers: authHeaders() });
                          if (resp.ok) {
                            const data = await resp.json();
                            setBrowserErrors(Array.isArray(data) ? data : [data]);
                          } else {
                            setBrowserErrors([]);
                          }
                        } catch (e) {
                          setBrowserErrors([]);
                        }
                        setBrowserErrorsLoading(false);
                      }}>Refresh</Button>
                      <Button size="sm" onClick={async () => {
                        const flushed = await flushPendingBrowserErrors();
                        // refresh list after flushing
                        try {
                          const resp = await fetch(apiUrl('/simplebeacon/report/browser-errors'), { headers: authHeaders() });
                          if (resp.ok) {
                            const data = await resp.json();
                            setBrowserErrors(Array.isArray(data) ? data : [data]);
                          }
                        } catch { }
                        // update pending count
                        try {
                          const key = 'sb_pending_browser_errors';
                          const raw = localStorage.getItem(key);
                          const pending = raw ? JSON.parse(raw) : [];
                          setPendingBrowserErrorsCount(Array.isArray(pending) ? pending.length : 0);
                        } catch (_e) { setPendingBrowserErrorsCount(0); }
                      }}>{pendingBrowserErrorsCount > 0 ? `Retry pending (${pendingBrowserErrorsCount})` : 'Retry pending'}</Button>
                    </div>
                  </div>
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-md border bg-muted p-3 text-xs font-mono">
                    {browserErrorsLoading ? (
                      <div>Loading...</div>
                    ) : browserErrors && browserErrors.length > 0 ? (
                      browserErrors.map((be, i) => {
                        return (
                          <div key={i} className="mb-2">
                            <div className="text-foreground-muted text-[11px]">{be.timestamp || be.time || ''} — {be.traceId || ''}</div>
                            <div className="text-sm">{be.errorName || be.error || be.message || JSON.stringify(be)}</div>
                            <div className="text-foreground-muted text-[11px]">{be.filePath ? `file: ${be.filePath}` : ''}</div>
                            <Separator className="my-2" />
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-foreground-muted">No browser errors found.</div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
      {/* Ensure folder input has webkitdirectory attribute for directory picking in browsers */}
      {/* Set attribute at runtime to avoid TSX unknown prop errors */}
      {/* eslint-disable-next-line react-hooks/rules-of-hooks */}
      {(() => {
        try {
          if (folderInputRef.current && !folderInputRef.current.hasAttribute('webkitdirectory')) {
            folderInputRef.current.setAttribute('webkitdirectory', '');
          }
        }
        catch (_a) { }
        return null;
      })()}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analyze</h1>
            <p className="text-foreground-muted">Scan a project for AI safety issues, gate compliance, and quality metrics</p>
          </div>
          {hosted && (
            <div className="flex items-center gap-2 shrink-0">
              {bridgeStatus === 'connected' && bridgeBase ? (
                <Badge variant="default" className="gap-1">IDE bridge connected</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const probe = await recheckBridge(true);
                    if (probe?.ok) return;
                    if (probe && 'deepLink' in probe && probe.deepLink) {
                      window.location.href = probe.deepLink;
                    } else {
                      toast.info('Install the SimpleBeacon VS Code extension, reload this page, then try Connect IDE again.');
                    }
                  }}
                >
                  Connect IDE
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scan Target</CardTitle>
              <CardDescription>Choose a scan mode and provide a project path or URL</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              <Lock className="h-3 w-3" />
              Private
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
            <TabsList className="w-full">
              {modeTabs.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.key} value={t.key} aria-label={t.label} title={t.label} className="flex-1 gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {websiteMode && (
              <TabsContent value="website" className="space-y-3">
                <Input
                  placeholder="https://example.com"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                />
                <p className="text-xs text-foreground-muted">Enter a public URL to scan a website for AI safety issues</p>
              </TabsContent>
            )}

            <TabsContent value="local" className="space-y-3">
              <div
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary-subtle' : 'border-border'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Folder className="mx-auto h-10 w-10 text-foreground-muted" />
                <p className="mt-2 text-sm text-foreground-muted">Drag a folder here to scan immediately, or browse</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleBrowseFolder}>
                  Browse Folder
                </Button>
              </div>
              <Input
                placeholder={serverDefaultPath || 'e.g. my-project or /path/to/project'}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
              {resolvedCandidate && resolvedCandidate !== path && (
                <div className="mt-2 flex items-center justify-between rounded-md border px-3 py-2 bg-muted/10 text-sm">
                  <div className="truncate">
                    <strong>Server candidate:</strong> <span className="ml-1">{resolvedCandidate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => { setPath(resolvedCandidate || ''); setResolvedCandidate(null); }}>Use candidate</Button>
                    <Button variant="ghost" size="sm" onClick={() => setResolvedCandidate(null)}>Dismiss</Button>
                  </div>
                </div>
              )}
                {candidateError && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 mt-2">
                    <div className="text-sm text-foreground-muted">Server candidate verification failed: {candidateError}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => {
                        toast('To enable server candidates: start the local bridge, allow Local Network Access in your browser, or add the path to ANALYZE_ALLOWED_ROOTS and restart the server.');
                      }}>How to fix</Button>
                      <Button variant="ghost" size="sm" onClick={() => setCandidateError(null)}>Dismiss</Button>
                    </div>
                  </div>
                )}
              <label className="flex items-center gap-2 text-xs text-foreground-muted">
                <input
                  type="checkbox"
                  checked={fullDirectoryScan}
                  onChange={(e) => setFullDirectoryScan(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span><strong>Full tree</strong> — content-scan every text file</span>
              </label>
            </TabsContent>

            <TabsContent value="server" className="space-y-3">
              <Input
                placeholder="/opt/render/project/src or C:\Users\..."
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
              <p className="text-xs text-foreground-muted">Enter an absolute server path for server-side scanning</p>
            </TabsContent>

            <TabsContent value="github" className="space-y-3">
              <Input
                placeholder="https://github.com/user/repo"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
              <p className="text-xs text-foreground-muted">Scan a public GitHub repository URL</p>
            </TabsContent>

          </Tabs>

          <Button
            variant="default"
            size="lg"
            className="w-full"
            disabled={scanState === 'scanning' || !path.trim()}
            onClick={handleScan}
          >
            {scanState === 'scanning' ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</>
            ) : (
              <><Play className="h-4 w-4" /> Start Scan</>
            )}
          </Button>
          {requiresManualTrigger && (
            <div className="mt-3 rounded-md border border-blue-300 bg-blue-50/50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <strong>Select Folder</strong>
                  <p className="text-xs text-foreground-muted mt-1">
                    Your browser blocked the automatic file picker (async gesture chain broken).
                    Click the button below to choose a local directory to scan.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setRequiresManualTrigger(false);
                    folderInputRef.current?.click();
                  }}
                >
                  Select Folder
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {scanState === 'complete' && fileErrorsCount ? (
        <div className="rounded-md border p-3 bg-muted/5 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <strong>File access issues:</strong> {fileErrorsCount} file(s) could not be read during the scan.
              {fileErrorExamples && fileErrorExamples.length > 0 && (
                <div className="mt-2 text-xs text-foreground-muted">
                  Examples: {fileErrorExamples.slice(0,3).map((e,i) => <span key={i} className="inline-block mr-2">{e.file}</span>)}{fileErrorExamples.length>3?` (+${fileErrorExamples.length-3} more)`:null}
                </div>
              )}
            </div>
            <div>
              <Button size="sm" onClick={() => {
                // open browser-errors view
                navigate('#/reports/browser-errors');
              }}>View browser errors</Button>
            </div>
          </div>
        </div>
      ) : null}

      {scanState === 'scanning' && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold break-words">{progressLabel || 'Scanning...'}</div>
                <div className="text-xs text-foreground-muted">{progress}% complete</div>
              </div>
              <span className="text-sm text-foreground-muted shrink-0">{progress}%</span>
            </div>
            <Progress value={progress} />
            <Separator />
            <div className="rounded-md bg-muted p-3 font-mono text-xs space-y-0 max-h-48 overflow-y-auto scrollbar-thin break-words">
              {terminalOutput.map((line, i) => (
                <div key={i} className="text-foreground-secondary break-all whitespace-pre-wrap">{line}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {scanState === 'auth_required' && (
        <Card className="border-yellow-400/30 bg-yellow-50/30">
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="flex items-start gap-3 min-w-0">
              <Lock className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Sign in required</div>
                <div className="text-xs text-foreground-muted truncate">{lastErrorMsg || 'Sign in to run analysis on the hosted dashboard.'}</div>
              </div>
            </div>
            <Button size="sm" className="shrink-0" onClick={() => clearAuthAndRedirect()}>Sign in again</Button>
          </CardContent>
        </Card>
      )}

      {scanState === 'error' && (
        <Card className="border-danger">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-5 w-5 text-danger" />
            <span className="text-sm">Scan failed. {terminalOutput.length > 0 && terminalOutput[terminalOutput.length - 1].replace(/^\[SimpleBeacon\]\s*/i, '')}</span>
          </CardContent>
        </Card>
      )}

      {scanState === 'complete' && result && (
        <ScanResults result={result} terminalOutput={terminalOutput} isRemoteBackend={isRemoteBackend} fullReport={fullReport} />
      )}

      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFileSelect}
        onCancel={() => {
          // If the user cancels the file picker while waiting for folder selection, reset to idle
          setScanState(prev => (prev === 'scanning' ? 'idle' : prev));
        }}
      />
    </div>
  );
}

function ScanResults({ result, terminalOutput, isRemoteBackend, fullReport }: { result: ScanResult; terminalOutput: string[]; isRemoteBackend: boolean; fullReport?: any }) {
  const isZeroResult = result.totalFiles === 0 && result.issueCount === 0;
  return (
    <div className="space-y-4">
      {isZeroResult && (
        <Card className="border-yellow-400/30 bg-yellow-50/30">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Scan returned no files or issues</p>
              <p className="text-xs text-foreground-muted">
                {isRemoteBackend
                  ? 'The remote server\'s project directory may be stale or empty. Start your local SimpleBeacon server (npm start in ai-platform) and refresh to scan your local codebase.'
                  : 'The scanned path may not contain any files, or the server\'s scan paths are not configured. Verify the path and try again.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scan Results</CardTitle>
              <CardDescription>{result.projectPath}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isRemoteBackend && (
                <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400/30">Remote</Badge>
              )}
              <Badge variant={result.gate.pass ? 'success' : 'danger'} className="text-sm">
                {result.gate.pass ? 'PASS' : 'FAIL'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ResultMetric icon={FileCode} label="Files" value={result.totalFiles} />
            <ResultMetric icon={AlertTriangle} label="Issues" value={result.issueCount} />
            <ResultMetric icon={Shield} label="Rules Checked" value={result.scanScope.codeFilesAnalyzed || 0} />
            <ResultMetric
              icon={CheckCircle2}
              label="Quality"
              value={result.qualityScore !== null ? `${result.qualityScore}%` : '—'}
            />
          </div>

          <Separator className="my-4" />

          <div className="flex flex-wrap gap-2">
            <SeverityChip label="Critical" count={result.severityCounts.critical} variant="danger" />
            <SeverityChip label="High" count={result.severityCounts.high} variant="warning" />
            <SeverityChip label="Medium" count={result.severityCounts.medium} variant="info" />
            <SeverityChip label="Low" count={result.severityCounts.low} variant="secondary" />
            <SeverityChip label="Info" count={result.severityCounts.info} variant="outline" />
          </div>

          <Separator className="my-4" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('results')}>
              <FileCode className="h-4 w-4" /> View Results
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="scope">Scope</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p>Repository inventory: <strong>{result.totalFiles} files</strong> indexed</p>
                  <p>Code files analyzed: <strong>{result.scanScope.codeFilesAnalyzed || 0} files</strong></p>
                  <p>Profile: <strong>{result.scanScope.profile}</strong></p>
                  <p>Scope: <strong>{result.scanScope.resultsViewScope}</strong></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-foreground-muted">
                Deterministic gate scan (AI narrative hidden for compliance integrity).
                Source files are not semantically reviewed. Gate passes on configured severities.
                Scoped to configured scanPaths and production directories — pattern matching only.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminal">
          <Card>
            <CardContent className="p-4">
              <div className="rounded-md bg-muted p-3 font-mono text-xs space-y-0 overflow-y-auto scrollbar-thin break-words max-h-96">
                {terminalOutput.map((line, i) => (
                  <div key={i} className="text-foreground-secondary break-all whitespace-pre-wrap">{line}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardContent className="flex flex-wrap gap-3 p-4">
              <Button variant="outline" size="sm" onClick={() => {
                if (!result) return;
                const exportData = fullReport || result;
                syncReportToVscodeSidebar(exportData, result.projectPath);
                const json = JSON.stringify(exportData, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const filename = `simplebeacon-report-${Date.now()}.json`;
                const params = new URLSearchParams(window.location.search);
                const inIde = typeof window !== 'undefined' && (
                  typeof (window as any).acquireVsCodeApi === 'function' ||
                  params.get('sb_parent_urlbar') ||
                  params.get('sb_notify_base') ||
                  params.get('sb_api_base')
                );
                if (inIde) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = String(reader.result || '').split(',')[1];
                    const vscode = (window as any).acquireVsCodeApi?.();
                    const msg = { command: 'downloadFile', filename, mimeType: blob.type, base64 };
                    if (vscode) { try { vscode.postMessage(msg); } catch { /* ignore */ } }
                    else if (window.parent && window.parent !== window) { try { window.parent.postMessage(msg, '*'); } catch { /* ignore */ } }
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
              }}>
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

// simplebeacon-ignore: mega-params — conservative suppression; plan refactor later
function ResultMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) {
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

// simplebeacon-ignore: mega-params — conservative suppression; plan refactor later
function SeverityChip({ label, count, variant }: { label: string; count: number; variant: 'danger' | 'warning' | 'info' | 'secondary' | 'outline' }) {
  return (
    <Badge variant={variant} className="gap-1.5">
      {label}: {count}
    </Badge>
  );
}
