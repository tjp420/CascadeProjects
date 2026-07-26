import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, Shield } from 'lucide-react';

export function SecurityView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Security</h1>
        <p className="text-foreground-muted">Security findings and vulnerability assessment</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Lock className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No security findings to display</p>
          <p className="text-xs text-foreground-muted">Run a scan to see security results</p>
        </CardContent>
      </Card>
    </div>
  );
}
