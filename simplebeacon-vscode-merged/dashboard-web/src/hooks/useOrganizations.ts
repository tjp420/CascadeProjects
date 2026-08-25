import { useState, useCallback, useEffect } from 'react';

export type OrgMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  max_seats: number;
};

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(false);
    setError(null);
    setOrganizations([]);
    setActiveOrg(null);
  }, []);

  const switchOrg = useCallback(
    async (id: string) => {
      const org = organizations.find((o) => o.id === id);
      setActiveOrg(org || null);
    },
    [organizations]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    organizations,
    activeOrg,
    loading,
    error,
    createOrganization: async (name: string, slug: string) => ({ id: slug, name, slug, max_seats: 10 }) as Organization,
    updateOrganization: async (id: string, _updates: Partial<Organization>) => activeOrg,
    deleteOrganization: async (_id: string) => {},
    getMembers: async (_orgId: string) => [] as OrgMember[],
    inviteMember: async (_orgId: string, _email: string, _role: string) => ({}) as OrgMember,
    updateMemberRole: async (_orgId: string, _memberId: string, _role: string) => {},
    removeMember: async (_orgId: string, _memberId: string) => {},
    acceptInvitation: async (_token: string) => ({}) as Organization,
    getMetrics: async (_orgId: string) => ({}) as any,
    switchOrg,
    refresh,
  };
}
