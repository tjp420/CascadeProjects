import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export function AssessmentView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
        <p className="text-foreground-muted">AI safety assessments and compliance checklists</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <FileText className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No assessments available</p>
        </CardContent>
      </Card>
    </div>
  );
}
