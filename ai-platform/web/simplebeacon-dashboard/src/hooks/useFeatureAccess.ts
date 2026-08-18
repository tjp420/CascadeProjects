import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';

export type FeatureFlag =
  | 'canMapEuAiAct'
  | 'canUseCiGate'
  | 'canExportBoardPdf'
  | 'canExportCertificates'
  | 'canUseAdvancedAnalyzers'
  | 'canUseSso';

export interface TierCapabilities {
  tier: string;
  maxScans: number;
  canExportCertificates: boolean;
  canUseCiGate: boolean;
  canMapEuAiAct: boolean;
  canExportBoardPdf: boolean;
  canUseAdvancedAnalyzers: boolean;
  canUseSso: boolean;
}

const TIER_CAPABILITIES: Record<string, TierCapabilities> = {
  free: {
    tier: 'free',
    maxScans: 3,
    canExportCertificates: false,
    canUseCiGate: false,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
  community: {
    tier: 'community',
    maxScans: 3,
    canExportCertificates: false,
    canUseCiGate: false,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
  developer: {
    tier: 'developer',
    maxScans: Infinity,
    canExportCertificates: true,
    canUseCiGate: true,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: true,
    canUseSso: false,
  },
  team_pro: {
    tier: 'team_pro',
    maxScans: Infinity,
    canExportCertificates: true,
    canUseCiGate: true,
    canMapEuAiAct: true,
    canExportBoardPdf: true,
    canUseAdvancedAnalyzers: true,
    canUseSso: true,
  },
  enterprise: {
    tier: 'enterprise',
    maxScans: Infinity,
    canExportCertificates: true,
    canUseCiGate: true,
    canMapEuAiAct: true,
    canExportBoardPdf: true,
    canUseAdvancedAnalyzers: true,
    canUseSso: true,
  },
};

const FREE_TIERS = new Set(['free', 'community', 'sandbox', 'guest', 'instant', '', 'bronze']);

function isAdminUser(user: { role?: string; plan?: string; tier?: string; email?: string } | null): boolean {
  if (!user) return false;
  const email = String(user.email || '').toLowerCase();
  if (email === 'admin@simplebeacon.ai') return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'superuser' || role === 'superadmin') return true;
  const tier = String(user.plan || user.tier || '').toLowerCase();
  return tier === 'admin' || tier === 'superuser';
}

function resolveTier(user: { role?: string; plan?: string; tier?: string; email?: string } | null): string {
  if (!user) return 'free';
  if (isAdminUser(user)) return 'enterprise';
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'superuser' || role === 'superadmin') return 'enterprise';
  const tier = String(user.plan || user.tier || '').toLowerCase();
  if (TIER_CAPABILITIES[tier]) return tier;
  if (FREE_TIERS.has(tier)) return 'free';
  if (tier) return 'developer';
  return 'free';
}

function resolveCapabilities(user: { role?: string; plan?: string; tier?: string } | null): TierCapabilities {
  const tier = resolveTier(user);
  return TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.free;
}

export function useFeatureAccess() {
  const { user } = useAuth();
  const capabilities = useMemo(() => resolveCapabilities(user), [user]);

  const hasFeature = useCallback(
    (feature: FeatureFlag) => Boolean(capabilities[feature]),
    [capabilities],
  );

  return { hasFeature, capabilities, tier: capabilities.tier, maxScans: capabilities.maxScans };
}
