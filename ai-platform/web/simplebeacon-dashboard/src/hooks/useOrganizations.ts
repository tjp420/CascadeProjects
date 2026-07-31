import { useState, useEffect, useCallback } from 'react';
import { apiUrl, authHeaders } from '@/config';

export interface OrgMember {
  id: string;
  user_email: string;
  user_name?: string;
  role: string;
  status: 'active' | 'invited' | 'pending';
  joinedAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  max_seats: number;
  role?: string;
  member_status?: string;
  memberCount?: number;
  createdAt?: string;
}

export interface OrgMetrics {
  totalScans: number;
  totalFindings: number;
  totalMembers: number;
  totalIntegrations: number;
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl('/organizations'), { headers: authHeaders() });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Failed to load organizations');
      }
      const data = await resp.json();
      const orgs: Organization[] = data.organizations || data.orgs || [];
      setOrganizations(orgs);
      if (orgs.length > 0 && !activeOrg) {
        setActiveOrg(orgs[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const createOrganization = useCallback(async (name: string, slug: string): Promise<Organization> => {
    const resp = await fetch(apiUrl('/organizations'), {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to create organization');
    await fetchOrganizations();
    return data.organization || data;
  }, [fetchOrganizations]);

  const updateOrganization = useCallback(async (orgId: string, updates: Record<string, unknown>): Promise<void> => {
    const resp = await fetch(apiUrl(`/organizations/${orgId}`), {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to update organization');
    await fetchOrganizations();
  }, [fetchOrganizations]);

  const deleteOrganization = useCallback(async (orgId: string): Promise<void> => {
    const resp = await fetch(apiUrl(`/organizations/${orgId}`), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || data.message || 'Failed to delete organization');
    }
    setActiveOrg(null);
    await fetchOrganizations();
  }, [fetchOrganizations]);

  const getMembers = useCallback(async (orgId: string): Promise<OrgMember[]> => {
    const resp = await fetch(apiUrl(`/organizations/${orgId}/members`), { headers: authHeaders() });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to load members');
    return data.members || [];
  }, []);

  const inviteMember = useCallback(async (orgId: string, email: string, role: string): Promise<void> => {
    const resp = await fetch(apiUrl(`/organizations/${orgId}/members`), {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to invite member');
  }, []);

  const updateMemberRole = useCallback(async (orgId: string, email: string, role: string): Promise<void> => {
    const resp = await fetch(apiUrl(`/organizations/${orgId}/members/${encodeURIComponent(email)}`), {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to update role');
  }, []);

  const removeMember = useCallback(async (orgId: string, email: string): Promise<void> => {
    const resp = await fetch(apiUrl(`/organizations/${orgId}/members/${encodeURIComponent(email)}`), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to remove member');
  }, []);

  const acceptInvitation = useCallback(async (orgId: string): Promise<void> => {
    const resp = await fetch(apiUrl(`/organizations/${orgId}/accept`), {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to accept invitation');
    await fetchOrganizations();
  }, [fetchOrganizations]);

  const getMetrics = useCallback(async (orgId: string): Promise<OrgMetrics> => {
    const resp = await fetch(apiUrl(`/organizations/${orgId}/metrics`), { headers: authHeaders() });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Failed to load metrics');
    return data.metrics || data;
  }, []);

  const switchOrg = useCallback((org: Organization) => {
    setActiveOrg(org);
  }, []);

  const refresh = useCallback(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return {
    organizations,
    activeOrg,
    loading,
    error,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    getMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    acceptInvitation,
    getMetrics,
    switchOrg,
    refresh,
  };
}
