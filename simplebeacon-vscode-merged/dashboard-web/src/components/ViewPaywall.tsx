import { Lock, Sparkles, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getViewUpgradeInfo } from '@/config/viewAccess';

interface ViewPaywallProps {
  view: string;
}

/**
 * Inline paywall shown when a user navigates directly to a view
 * their tier doesn't include (e.g. via URL hash).
 */
export function ViewPaywall({ view }: ViewPaywallProps) {
  const info = getViewUpgradeInfo(view);
  if (!info) return null;

  const viewLabel = view
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{viewLabel}</h1>
          <Badge className="mt-1 bg-primary/15 text-primary border-primary/30">
            <Crown className="h-3 w-3 mr-1" />
            {info.minTier} plan required
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
          <Lock className="h-6 w-6" />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg font-semibold">Upgrade to {info.minTier}</h3>
          <p className="text-sm text-foreground-muted">{info.description}</p>
        </div>
        <Button className="gap-2" onClick={() => window.open('/pricing', '_blank')}>
          <Sparkles className="h-4 w-4" />
          Upgrade to {info.minTier} — {info.priceLabel}
        </Button>
      </div>
    </div>
  );
}
