import type { FeatureFlag } from "@/hooks/useFeatureAccess";

/**
 * Maps each dashboard view to the feature flag required to access it.
 * Views not listed here are available to all authenticated users.
 * Admin-only views (admin, assessments) are handled separately in the Sidebar
 * filter and route guard.
 */
export const VIEW_ACCESS: Record<string, FeatureFlag> = {
  // Trust / certificates — Developer+
  trust: "canExportCertificates",
  "license-manager": "canExportCertificates",

  // CI gate / platform metrics — Developer+
  platform: "canUseCiGate",
  "ops-report": "canUseCiGate",

  // EU AI Act / compliance analytics — Team Pro+
  telemetry: "canMapEuAiAct",
  "outreach-analytics": "canMapEuAiAct",
  compliance: "canMapEuAiAct",

  // Board PDF / enterprise reporting — Team Pro+
  enterprise: "canExportBoardPdf",

  // Advanced analyzers — Developer+
  "fine-tuning": "canUseAdvancedAnalyzers",
  workspace: "canUseAdvancedAnalyzers",

  // SSO / organization — Team Pro+
  organization: "canUseSso",
  "team-metrics": "canUseSso",
  "webhook-events": "canUseSso",
};

/**
 * Human-readable info for the upgrade prompt shown when a user
 * tries to access a view their tier doesn't include.
 */
export interface UpgradeInfo {
  /** The feature flag that's required. */
  flag: FeatureFlag;
  /** The minimum tier that unlocks this feature. */
  minTier: string;
  /** The price label for the upgrade CTA. */
  priceLabel: string;
  /** Short description of what the user gets. */
  description: string;
}

const FLAG_UPGRADE: Record<FeatureFlag, UpgradeInfo> = {
  canExportCertificates: {
    flag: "canExportCertificates",
    minTier: "Developer",
    priceLabel: "$49/mo",
    description:
      "Unlock trust certificates, license management, and signed compliance artifacts.",
  },
  canUseCiGate: {
    flag: "canUseCiGate",
    minTier: "Developer",
    priceLabel: "$49/mo",
    description:
      "Unlock CI/CD gate integration, platform metrics, and ops reporting.",
  },
  canUseAdvancedAnalyzers: {
    flag: "canUseAdvancedAnalyzers",
    minTier: "Developer",
    priceLabel: "$49/mo",
    description:
      "Unlock advanced analyzers, fine-tuning curation, and workspace configuration.",
  },
  canMapEuAiAct: {
    flag: "canMapEuAiAct",
    minTier: "Team Pro",
    priceLabel: "$149/mo",
    description:
      "Unlock EU AI Act compliance mapping, outreach analytics, and compliance dashboards.",
  },
  canExportBoardPdf: {
    flag: "canExportBoardPdf",
    minTier: "Team Pro",
    priceLabel: "$149/mo",
    description:
      "Unlock board-ready PDF reports and enterprise governance dashboards.",
  },
  canUseSso: {
    flag: "canUseSso",
    minTier: "Team Pro",
    priceLabel: "$149/mo",
    description:
      "Unlock organization management, team metrics, and webhook event integration.",
  },
};

/**
 * Returns the upgrade info for a view, or null if the view is available
 * to all authenticated users.
 */
export function getViewUpgradeInfo(view: string): UpgradeInfo | null {
  const flag = VIEW_ACCESS[view];
  if (!flag) return null;
  return FLAG_UPGRADE[flag] || null;
}
