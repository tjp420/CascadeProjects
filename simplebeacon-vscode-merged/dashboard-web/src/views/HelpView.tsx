import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';

export function HelpView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Help</h1>
        <p className="text-foreground-muted">Documentation, guides, and support</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <HelpCircle className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Help center and documentation</p>
        </CardContent>
      </Card>
    </div>
  );
}
