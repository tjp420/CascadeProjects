import { useCallback, useMemo } from "react";
import { useAuth } from "./useAuth";

export type FeatureFlag =
  | "canMapEuAiAct"
  | "canUseCiGate"
  | "canExportBoardPdf"
  | "canExportCertificates"
  | "canUseAdvancedAnalyzers"
  | "canUseSso";

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
    tier: "free",
    maxScans: 3,
    canExportCertificates: false,
    canUseCiGate: false,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
  community: {
    tier: "community",
    maxScans: 3,
    canExportCertificates: false,
    canUseCiGate: false,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
  sandbox: {
    tier: "sandbox",
    maxScans: 50,
    canExportCertificates: false,
    canUseCiGate: false,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
  pro: {
    tier: "pro",
    maxScans: 500,
    canExportCertificates: false,
    canUseCiGate: true,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
  developer: {
    tier: "developer",
    maxScans: Infinity,
    canExportCertificates: true,
    canUseCiGate: true,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: true,
    canUseSso: false,
  },
  team_pro: {
    tier: "team_pro",
    maxScans: Infinity,
    canExportCertificates: true,
    canUseCiGate: true,
    canMapEuAiAct: true,
    canExportBoardPdf: true,
    canUseAdvancedAnalyzers: true,
    canUseSso: true,
  },
  enterprise: {
    tier: "enterprise",
    maxScans: Infinity,
    canExportCertificates: true,
    canUseCiGate: true,
    canMapEuAiAct: true,
    canExportBoardPdf: true,
    canUseAdvancedAnalyzers: true,
    canUseSso: true,
  },
  one_time_certificate: {
    tier: "one_time_certificate",
    maxScans: 1,
    canExportCertificates: true,
    canUseCiGate: false,
    canMapEuAiAct: false,
    canExportBoardPdf: false,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
  executive_clearance: {
    tier: "executive_clearance",
    maxScans: 1,
    canExportCertificates: true,
    canUseCiGate: false,
    canMapEuAiAct: false,
    canExportBoardPdf: true,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
  eu_ai_act_sprint: {
    tier: "eu_ai_act_sprint",
    maxScans: 20,
    canExportCertificates: true,
    canUseCiGate: false,
    canMapEuAiAct: true,
    canExportBoardPdf: true,
    canUseAdvancedAnalyzers: false,
    canUseSso: false,
  },
};

const FREE_TIERS = new Set(["free", "community", "sandbox", "", "bronze"]);

function resolveTier(
  user: { role?: string; plan?: string; tier?: string } | null,
): string {
  if (!user) return "free";
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "superuser") return "enterprise";
  const tier = String(user.plan || user.tier || "").toLowerCase();
  if (TIER_CAPABILITIES[tier]) return tier;
  if (FREE_TIERS.has(tier)) return "free";
  if (tier) return "developer";
  return "free";
}

function resolveCapabilities(
  user: { role?: string; plan?: string; tier?: string } | null,
): TierCapabilities {
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

  return {
    hasFeature,
    capabilities,
    tier: capabilities.tier,
    maxScans: capabilities.maxScans,
  };
}
