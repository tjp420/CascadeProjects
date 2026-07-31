import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, RefreshCw, ArrowLeft } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { navigate } from '@/router/HashRouter';

interface PermissionGuardProps {
  requiredPermission?: string;
  children: ReactNode;
}

/**
 * Route-level permission guard. Wraps view components and enforces
 * RBAC checks before rendering. Uses the same permission matching
 * engine as the sidebar (honors admin:all, read:all, write:all wildcards).
 *
 * - While permissions are loading: shows a skeleton spinner to prevent
 *   false rejections or screen flickering.
 * - If the user lacks the required permission: shows a structured
 *   403 Access Denied frame with the required permission string and
 *   a fallback link to the dashboard.
 * - If no permission is required or the user has it: renders children.
 */
export function PermissionGuard({ requiredPermission, children }: PermissionGuardProps) {
  const { hasPermission, loading: permsLoading } = usePermissions(true);

  // Loading state — prevent false rejections during permission resolution
  if (permsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-foreground-muted" />
        <p className="text-sm text-foreground-muted">Verifying access permissions...</p>
      </div>
    );
  }

  // No permission required — render children directly
  if (!requiredPermission) {
    return <>{children}</>;
  }

  // Permission check — uses the same wildcard logic as the sidebar
  if (!hasPermission(requiredPermission)) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
              <p className="text-sm text-foreground-muted max-w-md">
                Your current role does not include the required permission to view this page.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted">Required permission:</span>
              <Badge variant="destructive">
                <code className="font-mono text-xs">{requiredPermission}</code>
              </Badge>
            </div>
            <Button
              onClick={() => navigate('dashboard')}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default PermissionGuard;
