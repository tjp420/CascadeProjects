import { type ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionGateProps {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
  authenticated?: boolean;
}

export function PermissionGate({
  permission,
  fallback = null,
  children,
  authenticated = true,
}: PermissionGateProps) {
  const { hasPermission, loading } = usePermissions(authenticated);

  if (loading) return null;
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

interface AnyPermissionGateProps {
  permissions: string[];
  fallback?: ReactNode;
  children: ReactNode;
  authenticated?: boolean;
}

export function AnyPermissionGate({
  permissions,
  fallback = null,
  children,
  authenticated = true,
}: AnyPermissionGateProps) {
  const { hasAnyPermission, loading } = usePermissions(authenticated);

  if (loading) return null;
  if (!hasAnyPermission(permissions)) return <>{fallback}</>;
  return <>{children}</>;
}
