import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Filter, FolderSearch, ScanLine, ShieldCheck } from 'lucide-react';

export type ScanMode = 'browser-fsa' | 'browser-heuristic' | 'browser-webkit' | 'cli' | 'server' | 'extension';

export interface ScanPipelineMetrics {
  scanMode?: ScanMode | string;
  discovered?: number;
  filtered?: number;
  analyzed?: number;
  gateBlocking?: number;
  gatePass?: boolean;
  limitations?: string[];
}

const MODE_LABELS: Record<string, string> = {
  'browser-fsa': 'Browser (unlimited picker)',
  'browser-heuristic': 'Browser (file list)',
  'browser-webkit': 'Browser (webkit cap)',
  cli: 'CLI',
  server: 'Server',
  extension: 'VS Code extension',
};

function formatCount(value?: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  return n.toLocaleString();
}

function PipelineStep({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof FolderSearch;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-[7rem] flex-1 flex-col items-center gap-1 rounded-md border bg-muted/20 px-3 py-3 text-center">
      <Icon className="h-4 w-4 text-primary" />
      <div className="text-xs uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-[10px] text-foreground-muted leading-tight">{hint}</div> : null}
    </div>
  );
}

export function ScanPipelinePanel({ metrics, compact = false }: { metrics: ScanPipelineMetrics; compact?: boolean }) {
  const mode = metrics.scanMode || 'browser-heuristic';
  const modeLabel = MODE_LABELS[mode] || mode;
  const discovered = metrics.discovered ?? metrics.filtered ?? metrics.analyzed;
  const filtered = metrics.filtered ?? metrics.discovered ?? metrics.analyzed;
  const analyzed = metrics.analyzed ?? 0;
  const gateBlocking = metrics.gateBlocking ?? 0;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{modeLabel}</Badge>
        <span className="text-foreground-muted">
          {formatCount(discovered)} discovered → {formatCount(analyzed)} analyzed
          {metrics.gatePass === false ? ` · ${formatCount(gateBlocking)} blocking` : metrics.gatePass ? ' · gate PASS' : ''}
        </span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Scan pipeline</CardTitle>
          <Badge variant="secondary">{modeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
          <PipelineStep icon={FolderSearch} label="Discovered" value={formatCount(discovered)} hint="Files in inventory" />
          <ArrowRight className="hidden h-4 w-4 self-center text-foreground-muted sm:block" />
          <PipelineStep icon={Filter} label="Filtered" value={formatCount(filtered)} hint="After ignore rules" />
          <ArrowRight className="hidden h-4 w-4 self-center text-foreground-muted sm:block" />
          <PipelineStep icon={ScanLine} label="Analyzed" value={formatCount(analyzed)} hint="Rule engines ran" />
          <ArrowRight className="hidden h-4 w-4 self-center text-foreground-muted sm:block" />
          <PipelineStep
            icon={ShieldCheck}
            label="Gate"
            value={metrics.gatePass === true ? 'PASS' : metrics.gatePass === false ? `${formatCount(gateBlocking)} block` : '—'}
            hint={metrics.gatePass === false ? 'Critical/high findings' : metrics.gatePass ? 'No blocking issues' : undefined}
          />
        </div>
        {metrics.limitations && metrics.limitations.length > 0 ? (
          <ul className="space-y-1 text-xs text-foreground-muted">
            {metrics.limitations.slice(0, 4).map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
