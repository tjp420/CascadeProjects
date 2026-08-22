import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FolderSearch, ClipboardList, ClipboardCheck, Shield, Zap, TrendingUp, FileCode,
  AlertTriangle, CheckCircle2, Lock, Award, FileText, Rocket, ArrowRight, ScanLine,
} from 'lucide-react';
import { navigate } from '@/router/HashRouter';
import { useAuth } from '@/hooks/useAuth';
import { OllamaUptimeWidget } from '@/components/OllamaUptimeWidget';

export function DashboardView() {
  const { isFreeTier } = useAuth();
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
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Hero Section — only for free tier */}
      {isFreeTier && (
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        <CardContent className="relative flex flex-col items-center text-center py-12 px-6 space-y-5">
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
            <ScanLine className="h-3.5 w-3.5 mr-1.5" />
            Zero-Upload AI Audit
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
            Pass the EU AI Act without exposing your code.
          </h1>
          <p className="text-foreground-muted max-w-xl text-sm sm:text-base">
            SimpleBeacon runs entirely on your local machine to audit, clean, and certify your AI code pipelines for enterprise governance reviews.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => navigate('analyze')} className="gap-2">
              <FolderSearch className="h-4 w-4" />
              Run Free Browser Scan
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('audit')} className="gap-2">
              <FileText className="h-4 w-4" />
              View Sample Report
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground-muted">Free — 10 scans/mo</span>
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground-muted">Pro — $9/mo</span>
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground-muted">Compliance Suite — $399/mo</span>
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground-muted">Enterprise Air-Gapped — Custom</span>
          </div>
          <p className="text-xs text-foreground-muted pt-1">
            100% private. No sign-up required for basic scans. <strong>Not affiliated with Beacons.ai.</strong>
          </p>
        </CardContent>
      </Card>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={FileCode}
          label="Files Scanned"
          value={lastScan?.files?.toString() || '—'}
          color="info"
        />
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
        <MetricCard
          icon={TrendingUp}
          label="Quality Score"
          value="—"
          color="muted"
        />
      </div>

      {/* Quick Actions + Scan Status + Ollama Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start a new scan or view recent results</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="default"
              size="lg"
              className="justify-start gap-3"
              onClick={() => navigate('analyze')}
            >
              <FolderSearch className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">New Scan</span>
                <span className="text-xs opacity-80">Analyze a project or repository</span>
              </div>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="justify-start gap-3"
              onClick={() => navigate('results')}
            >
              <ClipboardList className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">View Results</span>
                <span className="text-xs opacity-80">Browse scan findings</span>
              </div>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="justify-start gap-3"
              onClick={() => navigate('audit')}
            >
              <ClipboardCheck className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">Audit Report</span>
                <span className="text-xs opacity-80">Compliance & gate details</span>
              </div>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="justify-start gap-3"
              onClick={() => navigate('remediation')}
            >
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
                  <Badge variant={lastScan.issues > 0 ? 'warning' : 'success'}>
                    {lastScan.issues}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Gate</span>
                  <Badge variant={lastScan.gate ? 'success' : 'danger'}>
                    {lastScan.gate ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <OllamaUptimeWidget />
      </div>

      {/* Features Grid — only for free tier */}
      {isFreeTier && (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Why SimpleBeacon</h2>
          <p className="text-sm text-foreground-muted mt-1">Deterministic scanning that boards and clients can trust</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Shield}
            title="Deterministic Gate Scan"
            desc="No AI narratives — just pattern-matched findings with severity scores. Gate passes or fails on configured thresholds, not opinions."
          />
          <FeatureCard
            icon={Lock}
            title="Privacy-First Architecture"
            desc="Built on a lightweight, browser-local heuristic engine. Your proprietary source code never touches our servers."
          />
          <FeatureCard
            icon={Award}
            title="Agency Reputation Shield"
            desc="Hand over clean, certified repositories to clients with proof that the code is secure and compliant."
          />
        </div>
      </div>
      )}

      {/* Certificate Preview — only for free tier */}
      {isFreeTier && (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Board-Ready in Seconds</h2>
          <p className="text-sm text-foreground-muted mt-1">
            See exactly what your executives will present. A–F grade. Financial liability estimate. Actionable remediation.
          </p>
        </div>
        <Card className="max-w-2xl mx-auto bg-gradient-to-br from-slate-50 to-white text-slate-900 dark:from-slate-100 dark:to-slate-200 border-slate-200">
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-4">
              <div>
                <div className="text-lg font-bold text-slate-900">Executive Risk Certificate</div>
                <div className="text-xs text-slate-500">SimpleBeacon · Q2 2026 Assessment</div>
              </div>
              <div className="text-5xl font-black text-emerald-600">B+</div>
            </div>
            <CertRow label="Repository" value="acme-platform/api-v3" />
            <CertRow label="Files Scanned" value="1,247" />
            <CertRow label="Critical Issues" value="0" valueClass="text-emerald-600" />
            <CertRow label="High Issues" value="3" valueClass="text-amber-600" />
            <CertRow label="Est. Financial Liability" value="$124,000" valueClass="text-amber-600" />
            <CertRow label="Compliance Standard" value="SOC 2 / EU AI Act" />
            <CertRow label="Remediation Guide" value="Included" />
            <div className="flex justify-center pt-4">
              <Button onClick={() => navigate('analyze')} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <ScanLine className="h-4 w-4" />
                Run Live Scan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* CTA Section — only for free tier */}
      {isFreeTier && (
      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-center text-center py-8 px-6 space-y-4">
          <Rocket className="h-10 w-10 text-primary" />
          <h2 className="text-xl font-bold">Ready to audit your codebase?</h2>
          <p className="text-sm text-foreground-muted max-w-md">
            Drag and drop a project folder to get started. No sign-up, no upload — runs entirely in your browser.
          </p>
          <Button size="lg" onClick={() => navigate('analyze')} className="gap-2">
            <FolderSearch className="h-4 w-4" />
            Start Scanning
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
      )}
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

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Card className="transition-transform hover:scale-[1.02] hover:border-primary/30">
      <CardContent className="p-6 space-y-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-foreground-muted leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}

function CertRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-slate-900 ${valueClass || ''}`}>{value}</span>
    </div>
  );
}
