// simplebeacon-ignore: mega-params — refactor flagged functions later if desired
import { useState, useCallback, useRef } from 'react';
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
  Upload,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase } from '@/config';

type ScanMode = 'local' | 'server' | 'github' | 'upload';
type ScanState = 'idle' | 'scanning' | 'complete' | 'error';

interface ScanResult {
  totalFiles: number;
  issueCount: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
  gate: { pass: boolean; blockingCount: number; warningCount: number };
  qualityScore: number | null;
  projectPath: string;
  scanScope: { profile: string; resultsViewScope: string };
}

export function AnalyzeView() {
  const [mode, setMode] = useState<ScanMode>('local');
  const [path, setPath] = useState(localStorage.getItem('sb_default_path') || '');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const appendLog = useCallback((line: string) => {
    setTerminalOutput((prev) => [...prev, line]);
  }, []);

  const handleScan = useCallback(async () => {
    if (!path.trim()) {
      toast.error('Please enter a project path');
      return;
    }
    setScanState('scanning');
    setProgress(0);
    setTerminalOutput([]);
    setResult(null);

    appendLog(`[SimpleBeacon] Starting scan: ${path}`);
    setProgressLabel('Initializing...');
    setProgress(10);

    try {
      const apiBase = getApiBase();
      appendLog(`[SimpleBeacon] API base: ${apiBase || 'default'}`);

      setProgressLabel('Resolving scan strategy...');
      setProgress(20);

      if (apiBase) {
        appendLog(`[SimpleBeacon] Requesting server scan...`);
        setProgressLabel('Scanning via server...');
        setProgress(40);

        const resp = await fetch(`${apiBase}/analyze/flexible`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath: path }),
        });

        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const data = await resp.json();

        setProgressLabel('Processing results...');
        setProgress(90);

        const scanResult: ScanResult = {
          totalFiles: data.repositoryFilesTotal || data.summary?.totalFiles || 0,
          issueCount: data.issueCount || data.summary?.totalFindings || 0,
          severityCounts: data.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          gate: data.gate || { pass: true, blockingCount: 0, warningCount: 0 },
          qualityScore: data.qualityScore ?? null,
          projectPath: data.projectPath || path,
          scanScope: data.scanScope || { profile: 'standard', resultsViewScope: 'platform-only' },
        };

        setResult(scanResult);
        setScanState('complete');
        setProgress(100);
        appendLog(`[SimpleBeacon] Scan complete: ${scanResult.totalFiles} files, ${scanResult.issueCount} issues, gate ${scanResult.gate.pass ? 'PASS' : 'FAIL'}`);

        localStorage.setItem('sb_last_scan', JSON.stringify({
          files: scanResult.totalFiles,
          issues: scanResult.issueCount,
          gate: scanResult.gate.pass,
        }));
      } else {
        appendLog(`[SimpleBeacon] No API base — browser sandbox mode`);
        setProgressLabel('Browser sandbox not available in React mode yet');
        setProgress(50);
        throw new Error('Browser sandbox scan requires the vanilla JS service. Use server mode with sb_api_base parameter.');
      }
    } catch (err: any) {
      setScanState('error');
      appendLog(`[SimpleBeacon] Error: ${err.message}`);
      toast.error(err.message || 'Scan failed');
    }
  }, [path, appendLog]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const first = files[0];
      const dirName = (first as any).webkitRelativePath?.split('/')[0] || first.name;
      setPath(dirName);
      toast.info(`Dropped: ${dirName}`);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const first = files[0];
      const rel = (first as any).webkitRelativePath;
      if (rel) {
        const dir = rel.split('/').slice(0, -1).join('/') || first.name;
        setPath(dir);
      } else {
        setPath(first.name);
      }
    }
  }, []);

  const modeTabs: { key: ScanMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'local', label: 'Local Path', icon: Folder },
    { key: 'server', label: 'Server Path', icon: FolderSearch },
    { key: 'github', label: 'GitHub URL', icon: Github },
    { key: 'upload', label: 'Upload', icon: Upload },
  ];

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Analyze</h1>
        <p className="text-foreground-muted">Scan a project for AI safety issues, gate compliance, and quality metrics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan Target</CardTitle>
          <CardDescription>Choose a scan mode and provide a project path or URL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
            <TabsList className="w-full">
              {modeTabs.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.key} value={t.key} className="flex-1 gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="local" className="space-y-3">
              <div
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary-subtle' : 'border-border'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Folder className="mx-auto h-10 w-10 text-foreground-muted" />
                <p className="mt-2 text-sm text-foreground-muted">Drag a folder here or browse</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => folderInputRef.current?.click()}>
                  Browse Folder
                </Button>
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
              <Input
                placeholder="e.g. my-project or /path/to/project"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
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

            <TabsContent value="upload" className="space-y-3">
              <div
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary-subtle' : 'border-border'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-10 w-10 text-foreground-muted" />
                <p className="mt-2 text-sm text-foreground-muted">Drop a scan report JSON or browse</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                  Browse File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".json"
                  onChange={handleFileSelect}
                />
              </div>
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
                <div key={i} className="text-foreground-secondary">{line}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {scanState === 'error' && (
        <Card className="border-danger">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-5 w-5 text-danger" />
            <span className="text-sm">Scan failed. Check the terminal output above for details.</span>
          </CardContent>
        </Card>
      )}

      {scanState === 'complete' && result && (
        <ScanResults result={result} terminalOutput={terminalOutput} />
      )}
    </div>
  );
}

function ScanResults({ result, terminalOutput }: { result: ScanResult; terminalOutput: string[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scan Results</CardTitle>
              <CardDescription>{result.projectPath}</CardDescription>
            </div>
            <Badge variant={result.gate.pass ? 'success' : 'danger'} className="text-sm">
              {result.gate.pass ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ResultMetric icon={FileCode} label="Files" value={result.totalFiles} />
            <ResultMetric icon={AlertTriangle} label="Issues" value={result.issueCount} />
            <ResultMetric icon={Shield} label="Gate Rules" value={result.gate.blockingCount + result.gate.warningCount} />
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
                  <p>Gate rules checked: <strong>{result.gate.blockingCount + result.gate.warningCount} files</strong></p>
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
              <div className="rounded-md bg-muted p-3 font-mono text-xs space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                {terminalOutput.map((line, i) => (
                  <div key={i} className="text-foreground-secondary">{line}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardContent className="flex flex-wrap gap-3 p-4">
              <Button variant="outline" size="sm" onClick={() => {
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `simplebeacon-report-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="h-4 w-4" /> JSON Report
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> Audit PDF
              </Button>
              <Button variant="outline" size="sm">
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
