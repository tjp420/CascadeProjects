import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ClipboardList, Download, Filter, AlertTriangle, CheckCircle2, FileCode } from 'lucide-react';

export function ResultsView() {
  const [filter, setFilter] = useState<string>('all');

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Results</h1>
        <p className="text-foreground-muted">Detailed scan findings and issue breakdown</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan Report</CardTitle>
          <CardDescription>Latest scan results with severity filters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'critical', 'high', 'medium', 'low', 'info'].map((sev) => (
              <Button
                key={sev}
                variant={filter === sev ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(sev)}
                className="capitalize"
              >
                {sev}
              </Button>
            ))}
          </div>

          <Separator />

          <div className="flex items-center gap-3 py-8 text-center flex-col">
            <ClipboardList className="h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">No scan results loaded</p>
            <p className="text-xs text-foreground-muted">Run a scan from the Analyze page to see results here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
