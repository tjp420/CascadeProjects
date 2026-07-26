import { Card, CardContent } from '@/components/ui/card';
import { Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navigate } from '@/router/HashRouter';

export function RemediationView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Remediation</h1>
        <p className="text-foreground-muted">Prioritized fix roadmap and remediation tracking</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <Map className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No remediation roadmap available</p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => navigate('analyze')}>Start a Scan</Button>
            <Button variant="outline" onClick={() => {
              // Trigger import flow (file input handled in Analyze/Results views)
              navigate('analyze');
            }}>Import Roadmap</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
