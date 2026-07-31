import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FolderSearch,
  ClipboardList,
  ClipboardCheck,
  Shield,
  Zap,
  TrendingUp,
  FileCode,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { navigate } from '@/router/HashRouter';

export function DashboardView() {
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [lastScan, setLastScan] = useState<{ files: number; issues: number; gate: boolean } | null>(null);

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sb_last_scan');
      if (saved) {
        const data = JSON.parse(saved);
        setLastScan({
          files: data.files || 0,
          issues: data.issues || 0,
          gate: data.gate ?? true,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-foreground-muted">AI safety scanning overview and quick actions</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={FileCode} label="Files Scanned" value={lastScan?.files?.toString() || '—'} color="info" />
        <MetricCard
          icon={AlertTriangle}
          label="Issues Found"
          value={lastScan?.issues?.toString() || '—'}
          color={lastScan && lastScan.issues > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          icon={Shield}
          label="Gate Status"
          value={lastScan ? (lastScan.gate ? 'PASS' : 'FAIL') : '—'}
          color={lastScan ? (lastScan.gate ? 'success' : 'danger') : 'muted'}
        />
        <MetricCard icon={TrendingUp} label="Quality Score" value="—" color="muted" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start a new scan or view recent results</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button variant="default" size="lg" className="justify-start gap-3" onClick={() => navigate('analyze')}>
              <FolderSearch className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">New Scan</span>
                <span className="text-xs opacity-80">Analyze a project or repository</span>
              </div>
            </Button>
            <Button variant="outline" size="lg" className="justify-start gap-3" onClick={() => navigate('results')}>
              <ClipboardList className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">View Results</span>
                <span className="text-xs opacity-80">Browse scan findings</span>
              </div>
            </Button>
            <Button variant="outline" size="lg" className="justify-start gap-3" onClick={() => navigate('audit')}>
              <ClipboardCheck className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">Audit Report</span>
                <span className="text-xs opacity-80">Compliance & gate details</span>
              </div>
            </Button>
            <Button variant="outline" size="lg" className="justify-start gap-3" onClick={() => navigate('remediation')}>
              <Zap className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">Remediation</span>
                <span className="text-xs opacity-80">Fix roadmap & priorities</span>
              </div>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scan Status</CardTitle>
            <CardDescription>Current scan activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanStatus === 'idle' && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-foreground-muted" />
                <p className="text-sm text-foreground-muted">No scan in progress</p>
                <Button size="sm" onClick={() => navigate('analyze')}>
                  Start Scan
                </Button>
              </div>
            )}
            {scanStatus === 'scanning' && (
              <div className="space-y-3">
                <Progress value={45} />
                <p className="text-sm text-foreground-muted">Scanning files...</p>
              </div>
            )}
            {scanStatus === 'complete' && lastScan && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Files</span>
                  <Badge variant="secondary">{lastScan.files}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Issues</span>
                  <Badge variant={lastScan.issues > 0 ? 'warning' : 'success'}>{lastScan.issues}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Gate</span>
                  <Badge variant={lastScan.gate ? 'success' : 'danger'}>{lastScan.gate ? 'PASS' : 'FAIL'}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: 'info' | 'success' | 'warning' | 'danger' | 'muted';
}) {
  const colorMap = {
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    muted: 'text-foreground-muted',
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md bg-muted ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground-muted">{label}</span>
          <span className="text-xl font-bold">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}
