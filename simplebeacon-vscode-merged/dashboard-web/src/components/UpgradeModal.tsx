import { Lock, Sparkles, Crown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UpgradeInfo } from '@/config/viewAccess';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewLabel?: string;
  info: UpgradeInfo | null;
}

export function UpgradeModal({ open, onOpenChange, viewLabel, info }: UpgradeModalProps) {
  if (!info) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {viewLabel ? `${viewLabel} — Upgrade Required` : 'Upgrade Required'}
              </DialogTitle>
              <Badge className="mt-1 bg-primary/15 text-primary border-primary/30">
                <Crown className="h-3 w-3 mr-1" />
                {info.minTier} plan
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-sm text-foreground-muted pt-2">
            {info.description}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-4 text-center">
          <p className="text-sm text-foreground-secondary">
            Your current plan doesn't include this feature. Upgrade to{' '}
            <span className="font-semibold text-foreground">{info.minTier}</span> to
            unlock it.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              onOpenChange(false);
              window.open('/pricing', '_blank');
            }}
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to {info.minTier} — {info.priceLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
