import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Wrench, RefreshCw, AlertCircle, CheckCircle2, Loader2,
  Trash2, FileText, Database, Shield, Download, Calculator, Zap, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase, apiUrl, authHeaders } from '@/config';
import { navigate } from '@/router/HashRouter';

type ToolStatus = 'idle' | 'running' | 'done' | 'error';

type ToolDef = {
  id: string;
  name: string;
  description: string;
  icon: typeof Wrench;
  analysisType?: string;
  endpoint?: string;
  method?: 'GET' | 'POST';
  color: string;
};

const TOOLS: ToolDef[] = [
  {
    id: 'data-cleanup',
    name: 'Data Cleanup Scan',
    description: 'Directory bloat, stale data, config sprawl, and privacy findings',
    icon: Trash2,
    analysisType: 'data-cleanup',
    color: 'text-orange-500',
  },
  {
    id: 'file-reduction',
    name: 'File Reduction',
    description: 'Build artifacts, duplicate assets, and unused files (dry-run)',
    icon: FileText,
    analysisType: 'file-reduction',
    color: 'text-blue-500',
  },
  {
    id: 'data-quality',
    name: 'Data Quality Scan',
    description: 'Config drift, env keys, stale data, lineage, and shape drift',
    icon: Database,
    analysisType: 'data-quality',
    color: 'text-purple-500',
  },
  {
    id: 'npm-audit',
    name: 'NPM Audit',
    description: 'Dependency vulnerability scan via npm audit',
    icon: Shield,
    analysisType: 'npm-audit',
    color: 'text-red-500',
  },
  {
    id: 'compliance',
    name: 'Compliance Export',
    description: 'Gate layers, compliance checklist, and audit bundle export',
    icon: Download,
    analysisType: 'compliance',
    color: 'text-green-500',
  },
  {
    id: 'ai-math-audit',
    name: 'AI Math Audit',
    description: 'Detect fabricated metrics and hallucinated KPIs in AI outputs',
    icon: Calculator,
    endpoint: '/analyze/ai-math-audit',
    method: 'POST',
    color: 'text-cyan-500',
  },
  {
    id: 'fix-strategies',
    name: 'Fix Strategies',
    description: 'List supported auto-remediation strategies by finding type',
    icon: Zap,
    endpoint: '/v2/fixes/strategies',
    method: 'GET',
    color: 'text-yellow-500',
  },
];

export function ToolsView() {
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<Record<string, { status: ToolStatus; data?: unknown; error?: string }>>({});
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const apiBase = getApiBase();

  const runTool = useCallback(async (tool: ToolDef) => {
    setRunningTool(tool.id);
    setToolResults(prev => ({ ...prev, [tool.id]: { status: 'running' } }));
    setProgress(10);
    setProgressLabel(`Starting ${tool.name}...`);

    try {
      let projectPath = 'CascadeProjects';
      try {
        const stored = localStorage.getItem('sb_last_scan_full');
        if (stored) {
          const scan = JSON.parse(stored);
          if (scan?.projectPath) projectPath = scan.projectPath;
        }
      } catch { /* ignore */ }

      setProgress(30);
      setProgressLabel(`Running ${tool.name}...`);

      let resp: Response;

      if (tool.endpoint && tool.method === 'GET') {
        resp = await fetch(apiUrl(tool.endpoint), {
          headers: authHeaders(),
        });
      } else if (tool.endpoint && tool.method === 'POST') {
        resp = await fetch(apiUrl(tool.endpoint), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ projectPath }),
        });
      } else {
        resp = await fetch(apiUrl('/analyze/flexible'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ projectPath, analysisType: tool.analysisType }),
        });
      }

      setProgress(80);
      setProgressLabel('Processing results...');

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `Server returned ${resp.status}`);
      }

      const data = await resp.json();
      setProgress(100);
      setProgressLabel('Complete');
      setToolResults(prev => ({ ...prev, [tool.id]: { status: 'done', data } }));
      toast.success(`${tool.name} completed`);
    } catch (e: any) {
      setToolResults(prev => ({ ...prev, [tool.id]: { status: 'error', error: e?.message || 'Failed' } }));
      toast.error(`${tool.name} failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setRunningTool(null);
      setTimeout(() => { setProgress(0); setProgressLabel(''); }, 2000);
    }
  }, []);

  const downloadResult = (toolId: string) => {
    const result = toolResults[toolId];
    if (!result?.data) return;
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simplebeacon-${toolId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
        <p className="text-foreground-muted">Advanced scanning tools and utilities</p>
        {!apiBase && (
          <p className="text-xs text-yellow-600">
            No local API server detected — tools will run against the remote backend. Start your local SimpleBeacon server for current data.
          </p>
        )}
      </div>

      {runningTool && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{progressLabel}</span>
              <span className="text-sm text-foreground-muted">{progress}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {TOOLS.map((tool) => {
          const result = toolResults[tool.id];
          const isRunning = runningTool === tool.id;
          const Icon = tool.icon;
          return (
            <Card key={tool.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className={`h-5 w-5 ${tool.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                      <CardDescription className="text-xs">{tool.description}</CardDescription>
                    </div>
                  </div>
                  {result?.status === 'done' && (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  )}
                  {result?.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {result?.status === 'error' && (
                  <p className="text-xs text-red-500">{result.error}</p>
                )}
                {result?.status === 'done' && result.data != null && (
                  <div className="space-y-2">
                    <div className="rounded-md bg-muted p-2 text-xs font-mono max-h-32 overflow-y-auto scrollbar-thin">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(result.data, null, 2).slice(0, 2000)}</pre>
                      {JSON.stringify(result.data).length > 2000 && '...'}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadResult(tool.id)}>
                      <Download className="h-3 w-3" /> Export JSON
                    </Button>
                  </div>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  disabled={isRunning}
                  onClick={() => runTool(tool)}
                >
                  {isRunning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
                  ) : result?.status === 'done' ? (
                    <><RefreshCw className="h-4 w-4" /> Re-run</>
                  ) : (
                    <><Wrench className="h-4 w-4" /> Run Tool</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('analyze')}>
            <Wrench className="h-4 w-4" /> Full Scan
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('audit')}>
            <Shield className="h-4 w-4" /> Audit Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('remediation')}>
            <Clock className="h-4 w-4" /> Remediation Roadmap
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('security')}>
            <Shield className="h-4 w-4" /> Security View
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
