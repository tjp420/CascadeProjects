import { useState, useEffect, useCallback } from 'react';
import { apiUrl, authHeaders } from '../config';

export type PermissionSet = string[];

interface PermissionsState {
  permissions: PermissionSet;
  role: string;
  loading: boolean;
  hasPermission: (perm: string) => boolean;
  hasAnyPermission: (perms: string[]) => boolean;
}

const fallbackState: PermissionsState = {
  permissions: [],
  role: 'viewer',
  loading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
};

export function usePermissions(authenticated: boolean): PermissionsState {
  const [state, setState] = useState<PermissionsState>(fallbackState);

  const fetchPermissions = useCallback(async () => {
    if (!authenticated) {
      setState({ ...fallbackState, loading: false });
      return;
    }
    try {
      const resp = await fetch(apiUrl('/rbac/me'), {
        headers: authHeaders(),
      });
      if (!resp.ok) {
        setState({ ...fallbackState, loading: false });
        return;
      }
      const data = await resp.json();
      const perms: PermissionSet = data.permissions || [];
      const role: string = data.role || 'viewer';

      setState({
        permissions: perms,
        role,
        loading: false,
        hasPermission: (perm: string) => checkPermission(perms, perm),
        hasAnyPermission: (perms: string[]) => perms.some((p) => checkPermission(perms, p)),
      });
    } catch {
      setState({ ...fallbackState, loading: false });
    }
  }, [authenticated]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return state;
}

function checkPermission(perms: PermissionSet, required: string): boolean {
  if (!perms || perms.length === 0) return false;
  if (perms.includes('admin:all')) return true;
  if (required.startsWith('read:') && perms.includes('read:all')) return true;
  if (required.startsWith('write:') && perms.includes('write:all')) return true;
  if (required.startsWith('delete:') && perms.includes('delete:all')) return true;
  return perms.includes(required);
}
