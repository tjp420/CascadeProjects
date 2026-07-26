import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';

export function RepoHealthView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Repository Health</h1>
        <p className="text-foreground-muted">Repository structure, dependencies, and health metrics</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Package className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No repository health data available</p>
        </CardContent>
      </Card>
    </div>
  );
}
