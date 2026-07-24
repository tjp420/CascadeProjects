import { Card, CardContent } from '@/components/ui/card';
import { User } from 'lucide-react';

export function ProfileView() {
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-foreground-muted">Account settings and preferences</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <User className="h-12 w-12 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">Profile loading...</p>
        </CardContent>
      </Card>
    </div>
  );
}
