import { useState, useEffect, useCallback } from 'react';
import { apiUrl, authHeaders, waitForApiBase } from '@/config';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    owner_email: string;
    plan: string;
    max_seats: number;
    created_at: string;
    updated_at: string;
    role?: string;
    member_status?: string;
}

export interface OrgMember {
    id: number;
    org_id: string;
    user_email: string;
    role: string;
    invited_by: string | null;
    invited_at: string;
    accepted_at: string | null;
    status: string;
    user_name?: string;
    user_tier?: string;
}

export interface OrgMetrics {
    organization: { id: string; name: string; slug: string; plan: string };
    members: { total: number; active: number; pending: number };
    seats: { used: number; max: number };
    roles: Record<string, number>;
}

const ACTIVE_ORG_KEY = 'sb_active_org';

export function useOrganizations() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrganizations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await waitForApiBase();
            const resp = await fetch(apiUrl('/api/orgs'), {
                headers: { ...authHeaders() }
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to load organizations (${resp.status})`);
            }
            const data = await resp.json();
            const orgs: Organization[] = data.organizations || [];
            setOrganizations(orgs);

            const storedId = localStorage.getItem(ACTIVE_ORG_KEY);
            const stored = storedId ? orgs.find(o => o.id === storedId) : null;
            setActiveOrg(stored || orgs[0] || null);
        } catch (err: any) {
            setError(err.message || 'Failed to load organizations');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrganizations();
    }, [fetchOrganizations]);

    const switchOrg = useCallback((org: Organization) => {
        localStorage.setItem(ACTIVE_ORG_KEY, org.id);
        setActiveOrg(org);
    }, []);

    const createOrganization = useCallback(
        async (name: string, slug: string, plan?: string, maxSeats?: number) => {
            await waitForApiBase();
            const resp = await fetch(apiUrl('/api/orgs'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ name, slug, plan, maxSeats })
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to create organization (${resp.status})`);
            }
            const data = await resp.json();
            await fetchOrganizations();
            return data.organization as Organization;
        },
        [fetchOrganizations]
    );

    const updateOrganization = useCallback(
        async (orgId: string, updates: { name?: string; plan?: string; maxSeats?: number }) => {
            await waitForApiBase();
            const resp = await fetch(apiUrl(`/api/orgs/${orgId}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(updates)
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to update organization (${resp.status})`);
            }
            const data = await resp.json();
            await fetchOrganizations();
            return data.organization as Organization;
        },
        [fetchOrganizations]
    );

    const deleteOrganization = useCallback(
        async (orgId: string) => {
            await waitForApiBase();
            const resp = await fetch(apiUrl(`/api/orgs/${orgId}`), {
                method: 'DELETE',
                headers: { ...authHeaders() }
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to delete organization (${resp.status})`);
            }
            localStorage.removeItem(ACTIVE_ORG_KEY);
            await fetchOrganizations();
        },
        [fetchOrganizations]
    );

    const getMembers = useCallback(async (orgId: string): Promise<OrgMember[]> => {
        await waitForApiBase();
        const resp = await fetch(apiUrl(`/api/orgs/${orgId}/members`), {
            headers: { ...authHeaders() }
        });
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to load members (${resp.status})`);
        }
        const data = await resp.json();
        return data.members || [];
    }, []);

    const inviteMember = useCallback(async (orgId: string, email: string, role: string) => {
        await waitForApiBase();
        const resp = await fetch(apiUrl(`/api/orgs/${orgId}/members`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ email, role })
        });
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to invite member (${resp.status})`);
        }
        return await resp.json();
    }, []);

    const updateMemberRole = useCallback(async (orgId: string, email: string, role: string) => {
        await waitForApiBase();
        const resp = await fetch(apiUrl(`/api/orgs/${orgId}/members/${encodeURIComponent(email)}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ role })
        });
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to update role (${resp.status})`);
        }
        return await resp.json();
    }, []);

    const removeMember = useCallback(async (orgId: string, email: string) => {
        await waitForApiBase();
        const resp = await fetch(apiUrl(`/api/orgs/${orgId}/members/${encodeURIComponent(email)}`), {
            method: 'DELETE',
            headers: { ...authHeaders() }
        });
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to remove member (${resp.status})`);
        }
        return await resp.json();
    }, []);

    const acceptInvitation = useCallback(
        async (orgId: string) => {
            await waitForApiBase();
            const resp = await fetch(apiUrl(`/api/orgs/${orgId}/accept`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() }
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to accept invitation (${resp.status})`);
            }
            await fetchOrganizations();
            return await resp.json();
        },
        [fetchOrganizations]
    );

    const getMetrics = useCallback(async (orgId: string): Promise<OrgMetrics> => {
        await waitForApiBase();
        const resp = await fetch(apiUrl(`/api/orgs/${orgId}/metrics`), {
            headers: { ...authHeaders() }
        });
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to load metrics (${resp.status})`);
        }
        const data = await resp.json();
        return data.metrics;
    }, []);

    return {
        organizations,
        activeOrg,
        loading,
        error,
        switchOrg,
        createOrganization,
        updateOrganization,
        deleteOrganization,
        getMembers,
        inviteMember,
        updateMemberRole,
        removeMember,
        acceptInvitation,
        getMetrics,
        refresh: fetchOrganizations
    };
}
