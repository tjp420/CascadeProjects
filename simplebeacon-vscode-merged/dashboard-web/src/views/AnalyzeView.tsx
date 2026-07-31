// simplebeacon-ignore: mega-params — refactor flagged functions later if desired
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
import { navigate } from '@/router/HashRouter';

type ScanMode = 'local' | 'server' | 'github' | 'website';
type ScanState = 'idle' | 'scanning' | 'complete' | 'error';

function getExtensionBridgeBase(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    let bridge = params.get('sb_api_base') || params.get('sb_notify_base');
    // If no bridge params in current URL, clear stale sessionStorage entries
    if (!bridge && typeof sessionStorage !== 'undefined') {
      const stale = sessionStorage.getItem('sb_api_base') || sessionStorage.getItem('sb_notify_base');
      if (stale) {
        try {
          sessionStorage.removeItem('sb_api_base');
        } catch {
          /* ignore */
        }
        try {
          sessionStorage.removeItem('sb_notify_base');
        } catch {
          /* ignore */
        }
      }
    }
    if (bridge) {
      const trimmed = bridge.replace(/\/+$/, '');
      // Normalize: strip trailing /api so bridge base is consistent with getApiBase()
      const hostRoot = trimmed.replace(/\/api$/i, '');
      // Persist to sessionStorage so bridge survives URL rewrites
      if (typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem('sb_api_base', hostRoot);
        } catch {
          /* ignore */
        }
      }
      return hostRoot;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isHostedDashboard(): boolean {
  if (typeof window === 'undefined') return false;
  return !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function isWebsiteMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('sb_website_mode') === '1';
  } catch {
    return false;
  }
}

async function findFolderViaBridge(folderName: string, bridgeBase: string): Promise<string | null> {
  try {
    const res = await fetch(`${bridgeBase}/api/find-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.matches) && data.matches.length > 0) {
        return data.matches[0].path || data.matches[0];
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function pickFolderViaExtensionBridge(bridgeBase: string): Promise<string | null> {
  try {
    const res = await fetch(`${bridgeBase}/api/pick-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.path) return data.path;
    }
  } catch {
    /* ignore */
  }
  return null;
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

export function AnalyzeView() {
  const [mode, setMode] = useState<ScanMode>(isWebsiteMode() ? 'website' : 'local');
  const [path, setPath] = useState(localStorage.getItem('sb_default_path') || '');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fullDirectoryScan, setFullDirectoryScan] = useState(false);
  const [serverDefaultPath, setServerDefaultPath] = useState<string | null>(null);
  const [resolvedCandidate, setResolvedCandidate] = useState<string | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const bridgeBase = getExtensionBridgeBase();
  const hosted = isHostedDashboard();
  const websiteMode = isWebsiteMode();
  const [localNetworkDenied, setLocalNetworkDenied] = useState(false);
  const [isRemoteBackend, setIsRemoteBackend] = useState(false);

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

  // Fetch server defaultProjectPath on mount so we can auto-populate and resolve paths
  // simplebeacon-ignore: framework-practices
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // If bridgeBase is present and host is secure, ensure Local Network Access is allowed
      try {
        if (bridgeBase && window.location.protocol === 'https:') {
          const ok = await checkLocalNetworkAccess(bridgeBase, 2000);
          if (!ok) {
            setLocalNetworkDenied(true);
            return;
          }
          setLocalNetworkDenied(false);
        }
      } catch {}
      try {
        const resp = await fetch(apiUrl('/analyze/providers'), { headers: authHeaders() });
        if (resp.ok && !cancelled) {
          const data = await resp.json();
          const dp = data.defaultProjectPath;
          if (dp && !cancelled) {
            setServerDefaultPath(dp);
            // Auto-populate path if empty and no saved default
            if (!path.trim() && !localStorage.getItem('sb_default_path')) {
              setPath(dp);
            }
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const appendLog = useCallback((line: string) => {
    setTerminalOutput((prev) => [...prev, line]);
  }, []);

  const isGithubUrl = (url: string) => /^https?:\/\/github\.com\//i.test(url.trim());

  const isWindowsPath = (p: string) => /^[A-Za-z]:[\\/]/.test(p.trim());

  const handleScan = useCallback(async () => {
    let scanInput = path.trim();

    // Reject page URL or fragment as scan path
    if (
      scanInput &&
      (scanInput === window.location.href ||
        scanInput === window.location.pathname ||
        scanInput.includes(window.location.host + '/#/'))
    ) {
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
      // Default to server's defaultProjectPath if available
      if (serverDefaultPath) {
        scanInput = serverDefaultPath;
        setPath(scanInput);
        appendLog(`[SimpleBeacon] Using server default path: ${scanInput}`);
      } else {
        toast.error('Please enter a project path');
        return;
      }
    }
    setScanState('scanning');
    setProgress(0);
    setTerminalOutput([]);
    setResult(null);

    appendLog(`[SimpleBeacon] Starting scan: ${scanInput}`);
    setProgressLabel('Initializing...');
    setProgress(10);

    if (isTokenExpired()) {
      toast.error('Your session has expired. Please sign in again.');
      clearAuthAndRedirect();
      return;
    }

    try {
      const apiBase = getApiBase() || '';
      appendLog(`[SimpleBeacon] API base: ${apiBase || 'default'}`);

      let scanPath = scanInput;

      // If we have a dropped directory handle, use browser-based scan directly (skip server path resolution)
      const dirHandle = (window as any).__sbDroppedDirHandle as FileSystemDirectoryHandle | undefined;
      if (mode === 'local' && dirHandle && dirHandle.name === scanPath) {
        setProgressLabel('Scanning files in browser...');
        setProgress(20);
        appendLog(`[SimpleBeacon] Browser local scan via File System Access API...`);
        const report = await runLocalScan({
          dirHandle,
          projectPath: scanPath,
          onProgress: (processed: number, total: number) => {
            if (total > 0) {
              setProgress(Math.min(90, 20 + Math.round((processed / total) * 70)));
              setProgressLabel(`Scanning ${processed} / ${total} files`);
            }
          },
        });
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
          scanScope: r.scanScope || { profile: 'standard', resultsViewScope: 'browser-local' },
        };
        setResult(scanResult);
        setScanState('complete');
        setProgress(100);
        appendLog(
          `[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`
        );
        localStorage.setItem(
          'sb_last_scan',
          JSON.stringify({
            files: scanResult.totalFiles,
            issues: scanResult.issueCount,
            gate: scanResult.gate.pass,
          })
        );
        localStorage.setItem('sb_last_scan_full', JSON.stringify(scanResult));
        localStorage.setItem('sb_last_scan_time', new Date().toISOString());
        return;
      }

      // Detect local path on hosted dashboard — auto-switch to browser-local scan
      // On a hosted dashboard, the remote server cannot access the user's local filesystem.
      // Any non-URL path (Windows drive letter, Unix absolute, or relative folder name) should
      // trigger the browser-local scan via File System Access API.
      const isUrl = /^https?:\/\//i.test(scanPath);
      if (!isUrl && !isGithubUrl(scanPath) && hosted) {
        // If bridgeBase is set, verify it's reachable; if not, proceed with browser-local scan
        let bridgeReachable = false;
        if (bridgeBase) {
          bridgeReachable = await checkLocalNetworkAccess(bridgeBase, 2000);
          if (!bridgeReachable) {
            appendLog(
              `[SimpleBeacon] Extension bridge ${bridgeBase} not reachable, falling back to browser-local scan...`
            );
          }
        }
        if (!bridgeReachable) {
          // Try browser-local scan via File System Access API or file input fallback
          let dirHandlePick: any = null;
          if (typeof (window as any).showDirectoryPicker === 'function') {
            appendLog(
              `[SimpleBeacon] Local path "${scanPath}" detected on hosted dashboard. Switching to browser-local scan...`
            );
            toast.info('Local path detected. Please select the folder in the picker to scan it in your browser.');
            try {
              dirHandlePick = await (window as any).showDirectoryPicker();
            } catch (e: any) {
              if (e?.name === 'AbortError') {
                setScanState('idle');
                return;
              }
              appendLog(`[SimpleBeacon] showDirectoryPicker failed: ${e?.message || e}, trying file input fallback...`);
            }
          }
          if (!dirHandlePick && folderInputRef.current) {
            appendLog('[SimpleBeacon] Using file input fallback for folder selection...');
            toast.info('Please select the folder to scan using the file picker (select any file in the folder).');
            folderInputRef.current.click();
            setScanState('idle');
            return;
          }
          if (!dirHandlePick) {
            setScanState('error');
            appendLog(
              '[SimpleBeacon] No folder picker available in this context. Cannot scan local path on hosted dashboard.'
            );
            toast.error(
              'No folder picker available. Use the "Browse Folder" button to select a local directory, or enter a GitHub URL.'
            );
            return;
          }
          if (dirHandlePick) {
            setProgressLabel('Scanning files in browser...');
            setProgress(20);
            appendLog(`[SimpleBeacon] Browser local scan via File System Access API...`);
            const report = await runLocalScan({
              dirHandle: dirHandlePick,
              projectPath: scanPath,
              onProgress: (processed: number, total: number) => {
                if (total > 0) {
                  setProgress(Math.min(90, 20 + Math.round((processed / total) * 70)));
                  setProgressLabel(`Scanning ${processed} / ${total} files`);
                }
              },
            });
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
              scanScope: r.scanScope || { profile: 'standard', resultsViewScope: 'browser-local' },
            };
            setResult(scanResult);
            setScanState('complete');
            setProgress(100);
            appendLog(
              `[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`
            );
            localStorage.setItem(
              'sb_last_scan',
              JSON.stringify({
                files: scanResult.totalFiles,
                issues: scanResult.issueCount,
                gate: scanResult.gate.pass,
              })
            );
            localStorage.setItem('sb_last_scan_full', JSON.stringify(scanResult));
            localStorage.setItem('sb_last_scan_time', new Date().toISOString());
            return;
          }
        }
      }

      // Detect Windows path when no local server — use server's defaultProjectPath
      if (isWindowsPath(scanPath) && !apiBase) {
        appendLog(`[SimpleBeacon] Windows path "${scanPath}" detected but no local server running.`);
        appendLog(`[SimpleBeacon] Fetching server default path to scan remotely...`);
        toast.warning("Local API server not detected. Scanning the remote server's project directory instead.");
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
      if (
        scanPath &&
        !scanPath.startsWith('/') &&
        !scanPath.match(/^[A-Za-z]:[\\/]/) &&
        !isGithubUrl(scanPath) &&
        !scanPath.match(/^https?:\/\//i)
      ) {
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
            toast.error('Your session has expired. Please sign in again.');
            clearAuthAndRedirect();
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
            await new Promise((resolve) => setTimeout(resolve, 2000));
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
          totalFiles:
            s.repositoryFilesTotal ||
            r.repositoryFilesTotal ||
            r.repositoryInventory?.totalFiles ||
            data.repositoryFilesTotal ||
            0,
          issueCount: s.findingsTotal || r.issueCount || data.issueCount || 0,
          severityCounts: s.severityCounts ||
            r.severityCounts ||
            data.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          gate: r.gate || data.gate || { pass: true, blockingCount: 0, warningCount: 0 },
          qualityScore: s.healthScore ?? r.qualityScore ?? data.qualityScore ?? null,
          projectPath: r.projectRoot || r.projectPath || data.projectPath || scanPath,
          scanScope: {
            profile: scope.scanProfile || scope.profile || 'standard',
            resultsViewScope: scope.scanContext || scope.resultsViewScope || 'platform-only',
            codeFilesAnalyzed:
              s.codeFilesAnalyzed || s.ruleScopedFilesAnalyzed || r.ruleScopedFilesAnalyzed || r.filesAnalyzed || 0,
          },
        };

        setResult(scanResult);
        setScanState('complete');
        setProgress(100);
        appendLog(
          `[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`
        );

        localStorage.setItem(
          'sb_last_scan',
          JSON.stringify({
            files: scanResult.totalFiles,
            issues: scanResult.issueCount,
            gate: scanResult.gate.pass,
          })
        );
        localStorage.setItem('sb_last_scan_full', JSON.stringify(scanResult));
        localStorage.setItem('sb_last_scan_time', new Date().toISOString());
      } else {
        appendLog(`[SimpleBeacon] No API base — browser sandbox mode`);
        setProgressLabel('Browser sandbox not available in React mode yet');
        setProgress(50);
        throw new Error(
          'Browser sandbox scan requires the vanilla JS service. Use server mode with sb_api_base parameter.'
        );
      }
    } catch (err: any) {
      setScanState('error');
      const errMsg = err?.message || String(err || 'Unknown error');
      appendLog(`[SimpleBeacon] Error: ${errMsg}`);
      console.error('[SimpleBeacon] Scan error:', err);
      toast.error(errMsg || 'Scan failed');
    }
  }, [path, mode, appendLog]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const items = e.dataTransfer.items;
      const files = Array.from(e.dataTransfer.files);
      // Try to extract absolute path from dropped file (VS Code/Electron drops expose .path)
      if (files.length > 0 && (files[0] as any).path) {
        const filePath = String((files[0] as any).path).replace(/\\/g, '/');
        const folderName = (files[0] as any).webkitRelativePath?.split('/')[0] || files[0].name;
        const idx = filePath.indexOf(`/${folderName}/`);
        const absPath =
          idx >= 0
            ? filePath.slice(0, idx + folderName.length + 1).replace(/\//g, '\\')
            : filePath.slice(0, filePath.lastIndexOf('/')).replace(/\//g, '\\');
        if (absPath) {
          setPath(absPath);
          toast.info(`Folder dropped: ${absPath}`);
          return;
        }
      }
      // Try File System Access API for directory handle
      if (items && items.length > 0 && typeof (items[0] as any).getAsFileSystemHandle === 'function') {
        try {
          const handle = await (items[0] as any).getAsFileSystemHandle();
          if (handle && handle.kind === 'directory') {
            // On hosted dashboard with bridge, try to resolve real path
            if (hosted && bridgeBase) {
              const ok = await checkLocalNetworkAccess(bridgeBase, 2000);
              if (!ok) {
                setLocalNetworkDenied(true);
                toast.error('Local Network Access blocked — cannot resolve dropped folder via bridge');
                return;
              }
              const bridgePath = await findFolderViaBridge(handle.name, bridgeBase);
              if (bridgePath) {
                setPath(bridgePath);
                toast.info(`Folder located via bridge: ${bridgePath}`);
                return;
              }
            }
            setPath(handle.name);
            toast.info(`Folder dropped: ${handle.name}`);
            (window as any).__sbDroppedDirHandle = handle;
            return;
          }
        } catch {
          /* fall through to file handling */
        }
      }
      // Fallback: use file names
      if (files.length > 0) {
        const first = files[0];
        const dirName = (first as any).webkitRelativePath?.split('/')[0] || first.name;
        // On hosted with bridge, try to find the folder
        if (hosted && bridgeBase && dirName) {
          const bridgePath = await findFolderViaBridge(dirName, bridgeBase);
          if (bridgePath) {
            setPath(bridgePath);
            toast.info(`Folder located via bridge: ${bridgePath}`);
            return;
          }
        }
        setPath(dirName);
        toast.info(`Dropped: ${dirName}`);
      }
    },
    [bridgeBase, hosted]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const first = files[0];
      const rel = (first as any).webkitRelativePath;
      let dirName = first.name;
      if (rel) {
        dirName = rel.split('/')[0] || first.name;
      }
      setPath(dirName);

      // Run a browser-local scan with the selected files — no server involved
      setScanState('scanning');
      setProgress(20);
      setProgressLabel('Scanning files in browser...');
      setTerminalOutput([]);
      appendLog(`[SimpleBeacon] Browser local scan via file input (${files.length} files selected)...`);
      try {
        const report = await runLocalScan({
          files,
          projectPath: dirName,
          onProgress: (processed: number, total: number) => {
            if (total > 0) {
              setProgress(Math.min(90, 20 + Math.round((processed / total) * 70)));
              setProgressLabel(`Scanning ${processed} / ${total} files`);
            }
          },
        });
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
          scanScope: r.scanScope || { profile: 'standard', resultsViewScope: 'browser-local' },
        };
        setResult(scanResult);
        setScanState('complete');
        setProgress(100);
        appendLog(
          `[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`
        );
        localStorage.setItem(
          'sb_last_scan',
          JSON.stringify({
            files: scanResult.totalFiles,
            issues: scanResult.issueCount,
            gate: scanResult.gate.pass,
          })
        );
        localStorage.setItem('sb_last_scan_full', JSON.stringify(scanResult));
        localStorage.setItem('sb_last_scan_time', new Date().toISOString());
      } catch (err: any) {
        setScanState('error');
        appendLog(`[SimpleBeacon] Browser-local scan failed: ${err?.message || err}`);
        toast.error(err?.message || 'Local scan failed');
      }
      // Reset input so the same folder can be selected again
      e.target.value = '';
    },
    [appendLog]
  );

  const handleBrowseFolder = useCallback(async () => {
    // 1. Try extension bridge folder picker first (works in cross-origin iframes)
    if (bridgeBase) {
      const ok = await checkLocalNetworkAccess(bridgeBase, 2000);
      if (!ok) {
        setLocalNetworkDenied(true);
        toast.error('Local Network Access blocked — cannot open bridge folder picker');
        return;
      }
      const bridgePath = await pickFolderViaExtensionBridge(bridgeBase);
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
          const bridgePath = await findFolderViaBridge(handle.name, bridgeBase);
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
  }, [bridgeBase, hosted]);

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
      {localNetworkDenied && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-yellow-400/30 bg-yellow-50/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" />
            <div>
              <div className="font-medium">Local Network Access required</div>
              <div className="text-xs text-foreground-muted">
                The hosted dashboard needs permission to reach your local SimpleBeacon bridge. Grant permission in your
                browser and retry.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                if (!bridgeBase) return;
                const ok = await checkLocalNetworkAccess(bridgeBase, 3000);
                if (ok) setLocalNetworkDenied(false);
                else {
                  toast.error('Local Network Access still blocked. Check browser site settings.');
                }
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Analyze</h1>
        <p className="text-foreground-muted">
          Scan a project for AI safety issues, gate compliance, and quality metrics
        </p>
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
                <p className="text-xs text-foreground-muted">
                  Enter a public URL to scan a website for AI safety issues
                </p>
              </TabsContent>
            )}

            <TabsContent value="local" className="space-y-3">
              <div
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary-subtle' : 'border-border'}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Folder className="mx-auto h-10 w-10 text-foreground-muted" />
                <p className="mt-2 text-sm text-foreground-muted">Drag a folder here or browse</p>
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
                    <Button
                      size="sm"
                      onClick={() => {
                        setPath(resolvedCandidate || '');
                        setResolvedCandidate(null);
                      }}
                    >
                      Use candidate
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setResolvedCandidate(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
              {candidateError && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 mt-2">
                  <div className="text-sm text-foreground-muted">
                    Server candidate verification failed: {candidateError}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        toast(
                          'To enable server candidates: start the local bridge, allow Local Network Access in your browser, or add the path to ANALYZE_ALLOWED_ROOTS and restart the server.'
                        );
                      }}
                    >
                      How to fix
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCandidateError(null)}>
                      Dismiss
                    </Button>
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
                <span>
                  <strong>Full tree</strong> — content-scan every text file
                </span>
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
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Start Scan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {scanState === 'scanning' && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{progressLabel}</span>
              <span className="text-sm text-foreground-muted">{progress}%</span>
            </div>
            <Progress value={progress} />
            <Separator />
            <div className="rounded-md bg-muted p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
              {terminalOutput.map((line, i) => (
                <div key={i} className="text-foreground-secondary">
                  {line}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {scanState === 'error' && (
        <Card className="border-danger">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-5 w-5 text-danger" />
            <span className="text-sm">
              Scan failed.{' '}
              {terminalOutput.length > 0 &&
                terminalOutput[terminalOutput.length - 1].replace(/^\[SimpleBeacon\]\s*/i, '')}
            </span>
          </CardContent>
        </Card>
      )}

      {scanState === 'complete' && result && (
        <ScanResults result={result} terminalOutput={terminalOutput} isRemoteBackend={isRemoteBackend} />
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
      />
    </div>
  );
}

function ScanResults({
  result,
  terminalOutput,
  isRemoteBackend,
}: {
  result: ScanResult;
  terminalOutput: string[];
  isRemoteBackend: boolean;
}) {
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
                  ? "The remote server's project directory may be stale or empty. Start your local SimpleBeacon server (npm start in ai-platform) and refresh to scan your local codebase."
                  : "The scanned path may not contain any files, or the server's scan paths are not configured. Verify the path and try again."}
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
                <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400/30">
                  Remote
                </Badge>
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
                  <p>
                    Repository inventory: <strong>{result.totalFiles} files</strong> indexed
                  </p>
                  <p>
                    Code files analyzed: <strong>{result.scanScope.codeFilesAnalyzed || 0} files</strong>
                  </p>
                  <p>
                    Profile: <strong>{result.scanScope.profile}</strong>
                  </p>
                  <p>
                    Scope: <strong>{result.scanScope.resultsViewScope}</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-foreground-muted">
                Deterministic gate scan (AI narrative hidden for compliance integrity). Source files are not
                semantically reviewed. Gate passes on configured severities. Scoped to configured scanPaths and
                production directories — pattern matching only.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminal">
          <Card>
            <CardContent className="p-4">
              <div className="rounded-md bg-muted p-3 font-mono text-xs space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                {terminalOutput.map((line, i) => (
                  <div key={i} className="text-foreground-secondary">
                    {line}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardContent className="flex flex-wrap gap-3 p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `simplebeacon-report-${Date.now()}.json`;
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

// simplebeacon-ignore: mega-params — conservative suppression; plan refactor later
function ResultMetric({
  icon: Icon,
  label,
  value,
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

// simplebeacon-ignore: mega-params — conservative suppression; plan refactor later
function SeverityChip({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: 'danger' | 'warning' | 'info' | 'secondary' | 'outline';
}) {
  return (
    <Badge variant={variant} className="gap-1.5">
      {label}: {count}
    </Badge>
  );
}
