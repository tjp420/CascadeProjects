import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import {
  EXECUTIVE_CLEARANCE_USD,
  startExecutiveCheckout,
} from "@/lib/executive-checkout";

type PremiumUnlockCalloutProps = {
  remaining: number;
  projectName?: string;
  defaultEmail?: string;
};

export function PremiumUnlockCallout({
  remaining,
  projectName,
  defaultEmail = "",
}: PremiumUnlockCalloutProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const locked = Math.max(0, Number(remaining) || 0);
  const label =
    locked > 0
      ? `Unlock the remaining ${locked} prioritized fixes and the Executive Risk Certificate ($${EXECUTIVE_CLEARANCE_USD}).`
      : `Unlock the full remediation list and the Executive Risk Certificate ($${EXECUTIVE_CLEARANCE_USD}).`;

  const onCheckout = async () => {
    setBusy(true);
    try {
      const result = await startExecutiveCheckout({
        email,
        projectName,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg space-y-3">
        <div className="flex items-start gap-2">
          <Lock className="h-5 w-5 shrink-0 mt-0.5 text-foreground-muted" />
          <p className="text-sm font-medium">{label}</p>
        </div>
        <Input
          type="email"
          autoComplete="email"
          placeholder="Work email for Stripe checkout"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email for checkout"
        />
        <Button className="w-full" disabled={busy} onClick={() => void onCheckout()}>
          {busy ? "Opening Stripe…" : `Continue to $${EXECUTIVE_CLEARANCE_USD} checkout`}
        </Button>
      </div>
    </div>
  );
}
