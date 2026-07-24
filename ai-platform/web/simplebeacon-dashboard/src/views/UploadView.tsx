import { Card, CardContent } from '@/components/ui/card';
import { Upload } from 'lucide-react';

export function UploadView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Upload</h1>
        <p className="text-foreground-muted">Upload scan reports and project files</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Upload className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Drag and drop files here or browse</p>
        </CardContent>
      </Card>
    </div>
  );
}
