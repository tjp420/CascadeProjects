import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ClipboardCheck, Download, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export function AuditView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Audit Report</h1>
        <p className="text-foreground-muted">Compliance audit with gate status and export options</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gate Status</CardTitle>
              <CardDescription>Deterministic gate scan results</CardDescription>
            </div>
            <Badge variant="success" className="text-sm">PASS</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-xs text-foreground-muted">Blocking</p>
                <p className="text-lg font-bold">0</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              <div>
                <p className="text-xs text-foreground-muted">Warnings</p>
                <p className="text-lg font-bold">0</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-info" />
              <div>
                <p className="text-xs text-foreground-muted">Quality Score</p>
                <p className="text-lg font-bold">—</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Export JSON</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Export PDF</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Compliance Audit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
