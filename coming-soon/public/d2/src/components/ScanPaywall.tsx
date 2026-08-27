import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ScanPaywallReason =
  "scan_limit" | "ci_gate" | "eu_ai_act" | "board_pdf";

const PAYWALL_COPY: Record<
  ScanPaywallReason,
  { title: string; description: string; cta: string; tierLabel: string }
> = {
  scan_limit: {
    title: "Free Scan Limit Reached",
    description:
      "You have used all 3 free scans this month. Upgrade to Developer for unlimited scans and CI gate export.",
    cta: "Upgrade to Developer — $49/mo",
    tierLabel: "Developer",
  },
  ci_gate: {
    title: "CI/CD Integration is a Developer Feature",
    description:
      "Export gate-ready CI configs, SARIF reports, and pipeline snippets with a Developer plan or higher.",
    cta: "Upgrade to Developer — $49/mo",
    tierLabel: "Developer",
  },
  eu_ai_act: {
    title: "EU AI Act Mapping is a Team Pro Feature",
    description:
      "Unlock EU AI Act compliance mapping, board-ready analytics, and advanced telemetry with Team Pro.",
    cta: "Upgrade to Team Pro — $149/mo",
    tierLabel: "Team Pro",
  },
  board_pdf: {
    title: "Board PDF Export is a Team Pro Feature",
    description:
      "Generate board-ready PDF compliance reports with Team Pro or Enterprise.",
    cta: "Upgrade to Team Pro — $149/mo",
    tierLabel: "Team Pro",
  },
};

interface ScanPaywallProps {
  reason: ScanPaywallReason;
  className?: string;
}

export function ScanPaywall({ reason, className }: ScanPaywallProps) {
  const copy = PAYWALL_COPY[reason];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-6 w-6" />
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold">{copy.title}</h3>
        <p className="text-sm text-foreground-muted">{copy.description}</p>
      </div>
      <Button
        className="gap-2"
        onClick={() => window.open("/pricing", "_blank")}
      >
        <Sparkles className="h-4 w-4" />
        {copy.cta}
      </Button>
      <p className="text-xs text-foreground-muted">
        {copy.tierLabel} plan required
      </p>
    </div>
  );
}
