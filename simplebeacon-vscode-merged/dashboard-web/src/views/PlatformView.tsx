import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export function PlatformView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Platform</h1>
        <p className="text-foreground-muted">Platform analytics and deployment metrics</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <BarChart3 className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No platform data available</p>
        </CardContent>
      </Card>
    </div>
  );
}
