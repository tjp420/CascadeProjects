import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

export function AdminView() {
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-foreground-muted">User management and system administration</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Users className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Admin panel requires authentication</p>
        </CardContent>
      </Card>
    </div>
  );
}
