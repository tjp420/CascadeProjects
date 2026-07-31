import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Table, FileText, Download } from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';
import { PermissionGate } from '@/components/PermissionGate';
import { toast } from 'sonner';

export function ComplianceView() {
  const exportComplianceCsv = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/audit/export/compliance-csv'), {
        headers: authHeaders(),
      });
      if (!resp.ok) {
        toast.error('Failed to export compliance CSV');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-matrix-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Compliance CSV exported');
    } catch {
      toast.error('Failed to export compliance CSV');
    }
  }, []);

  const exportCompliancePdf = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/audit/export/compliance-pdf'), {
        headers: authHeaders(),
      });
      if (!resp.ok) {
        toast.error('Failed to export compliance PDF');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Compliance PDF exported');
    } catch {
      toast.error('Failed to export compliance PDF');
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Compliance</h1>
        <p className="text-foreground-muted">EU AI Act checklist and compliance framework</p>
      </div>

      <PermissionGate permission="export:audit" fallback={null}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Compliance Export Engine
            </CardTitle>
            <CardDescription>
              Export signed compliance documentation with cryptographic integrity verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Table className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">CSV Matrix Export</h3>
                </div>
                <p className="text-xs text-foreground-muted">
                  Deterministic CSV with summary tables (by action, entity, actor, day),
                  chain verification status, detailed entry matrix, and HMAC-SHA256 signature.
                </p>
                <Button size="sm" onClick={exportComplianceCsv}>
                  <Table className="h-4 w-4" /> Export CSV
                </Button>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Signed PDF Report</h3>
                </div>
                <p className="text-xs text-foreground-muted">
                  Self-contained PDF with executive summary, action breakdowns, top actors,
                  recent entries, and HMAC-SHA256 signature metadata for tamper-evident records.
                </p>
                <Button size="sm" onClick={exportCompliancePdf}>
                  <FileText className="h-4 w-4" /> Export PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </PermissionGate>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <ClipboardCheck className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No compliance data available</p>
        </CardContent>
      </Card>
    </div>
  );
}
