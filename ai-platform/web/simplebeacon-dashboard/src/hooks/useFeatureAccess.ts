import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

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

export const TIER_CAPABILITIES: Record<string, TierCapabilities> = {
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
  admin: {
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

const FREE_TIERS = ['free', 'community', 'sandbox', '', 'bronze'];

function resolveTier(user: { plan?: string; tier?: string; role?: string } | null): string {
  if (!user) return 'free';
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'superuser') return 'enterprise';
  const tier = String(user.plan || user.tier || '').toLowerCase();
  if (TIER_CAPABILITIES[tier]) return tier;
  if (FREE_TIERS.includes(tier)) return 'free';
  // Unknown paid tier — default to developer so paying users aren't locked out
  if (tier && !FREE_TIERS.includes(tier)) return 'developer';
  return 'free';
}

export function useFeatureAccess() {
  const { user, isAuthenticated } = useAuth();
  const [capabilities, setCapabilities] = useState<TierCapabilities>(TIER_CAPABILITIES.free);

  useEffect(() => {
    const tier = resolveTier(user);
    setCapabilities(TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.free);
  }, [user, isAuthenticated]);

  const hasFeature = useCallback(
    (feature: keyof Omit<TierCapabilities, 'tier' | 'maxScans'>): boolean => {
      return Boolean(capabilities[feature]);
    },
    [capabilities]
  );

  return { capabilities, hasFeature, tier: capabilities.tier };
}

export { resolveTier };
