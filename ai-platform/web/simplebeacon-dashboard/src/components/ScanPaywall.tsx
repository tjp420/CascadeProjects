import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Sparkles, Check } from 'lucide-react';
import { navigate } from '@/router/HashRouter';

type PaywallReason = 'scan_limit' | 'ci_gate' | 'eu_ai_act' | 'board_pdf' | 'generic';

interface ScanPaywallProps {
  reason: PaywallReason;
  requiredTier?: 'developer' | 'team_pro' | 'enterprise';
  className?: string;
}

const PAYWALL_CONTENT: Record<PaywallReason, {
  title: string;
  description: string;
  features: string[];
  cta: string;
  requiredTier: 'developer' | 'team_pro';
}> = {
  scan_limit: {
    title: 'Free Scan Limit Reached',
    description: "You've used all 3 free scans for this month. Upgrade to Developer for unlimited scans, CI gate integration, and JSON exports.",
    features: [
      'Unlimited scans — no monthly cap',
      'CI/CD gate — block PRs on critical findings',
      'JSON export for automation pipelines',
      'GitHub Actions & GitLab CI workflows',
    ],
    cta: 'Upgrade to Developer — $49/mo',
    requiredTier: 'developer',
  },
  ci_gate: {
    title: 'CI/CD Integration is a Developer Feature',
    description: 'Block pull requests on critical compliance findings with copy-paste GitHub Actions and GitLab CI workflows.',
    features: [
      'Copy-paste GitHub Actions workflow',
      'Copy-paste GitLab CI pipeline',
      'Gate fails PRs on critical/high findings',
      'JSON export for CI automation',
    ],
    cta: 'Upgrade to Developer — $49/mo',
    requiredTier: 'developer',
  },
  eu_ai_act: {
    title: 'EU AI Act Mapping is a Team Pro Feature',
    description: 'Map scan findings to specific EU AI Act articles (9-27), generate FRIA evidence, and produce regulator-ready compliance reports.',
    features: [
      'Article-by-article compliance mapping',
      'FRIA (Fundamental Rights Impact Assessment)',
      'SOC 2 evidence pack generation',
      'Board-ready signed PDF certificates',
      '5 seats with centralized provisioning',
    ],
    cta: 'Upgrade to Team Pro — $149/mo',
    requiredTier: 'team_pro',
  },
  board_pdf: {
    title: 'Board-Ready PDF Export is a Team Pro Feature',
    description: 'Generate tamper-evident, signed PDF certificates with financial liability estimates for board meetings and enterprise audits.',
    features: [
      'Signed, tamper-evident PDF certificates',
      'Financial liability estimate (€35M / 7% turnover)',
      'A-F grade with executive summary',
      'JSON + PDF artifact bundle',
      '5 seats with centralized provisioning',
    ],
    cta: 'Upgrade to Team Pro — $149/mo',
    requiredTier: 'team_pro',
  },
  generic: {
    title: 'Premium Feature',
    description: 'This feature requires a paid plan. Upgrade to unlock the full SimpleBeacon toolkit.',
    features: [],
    cta: 'View Pricing',
    requiredTier: 'developer',
  },
};

export function ScanPaywall({ reason, requiredTier, className = '' }: ScanPaywallProps) {
  const content = PAYWALL_CONTENT[reason];
  const tier = requiredTier || content.requiredTier;

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      {/* Glassmorphic blur overlay */}
      <div className="absolute inset-0 backdrop-blur-md bg-background/60 border border-border/50" />

      {/* Upgrade card */}
      <div className="relative z-10 flex items-center justify-center p-6 sm:p-8">
        <Card className="w-full max-w-md border-primary/30 shadow-lg">
          <CardContent className="space-y-5 py-8 px-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight">{content.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{content.description}</p>
            </div>

            {content.features.length > 0 && (
              <ul className="space-y-2 text-left text-sm">
                {content.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 pt-2">
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => navigate('pricing')}
              >
                <Sparkles className="h-4 w-4" />
                {content.cta}
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('pricing')}
              >
                Compare all plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Compact inline blocker — for buttons and small UI elements
export function PaywallBadge({ reason, onClick }: { reason: PaywallReason; onClick?: () => void }) {
  const content = PAYWALL_CONTENT[reason];
  return (
    <button
      onClick={onClick || (() => navigate('pricing'))}
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <Lock className="h-3 w-3" />
      {content.requiredTier === 'developer' ? 'Developer' : 'Team Pro'}
    </button>
  );
}
