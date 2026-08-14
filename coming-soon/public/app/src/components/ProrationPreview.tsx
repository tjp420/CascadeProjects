import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Loader2,
  Calculator,
  CalendarDays,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';

interface TierInfo {
  id: string;
  name: string;
  monthlyCents: number | null;
  annualCents: number | null;
}

interface ProrationResult {
  fromTier: string;
  toTier: string;
  fromTierName: string;
  toTierName: string;
  isUpgrade: boolean;
  daysRemaining: number;
  daysTotal: number;
  oldDailyRateCents: number;
  newDailyRateCents: number;
  creditCents: number;
  chargeCents: number;
  netAdjustmentCents: number;
  netAdjustmentDisplay: string;
  isAnnual: boolean;
}

function formatCents(cents: number | null): string {
  if (cents == null) return 'Custom';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRate(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ProrationPreview() {
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [fromTier, setFromTier] = useState('developer');
  const [toTier, setToTier] = useState('team_pro');
  const [isAnnual, setIsAnnual] = useState(false);
  const [result, setResult] = useState<ProrationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTiers = useCallback(async () => {
    setTiersLoading(true);
    try {
      const resp = await fetch(apiUrl('/billing/tiers'), { headers: authHeaders() });
      const data = await resp.json();
      if (data.success && data.tiers) {
        setTiers(data.tiers);
      }
    } catch {
      // Fallback to hardcoded tiers if API unavailable
      setTiers([
        { id: 'developer', name: 'Developer', monthlyCents: 4900, annualCents: 49000 },
        { id: 'team_pro', name: 'Team Pro', monthlyCents: 14900, annualCents: 149000 },
        { id: 'enterprise', name: 'Enterprise', monthlyCents: null, annualCents: null },
      ]);
    } finally {
      setTiersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const calculatePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl('/billing/proration-preview'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromTier, toTier, isAnnual }),
      });
      const data = await resp.json();
      if (data.success && data.proration) {
        setResult(data.proration);
      } else {
        setError(data.error || 'Failed to calculate proration');
      }
    } catch {
      setError('Failed to connect to billing API');
    } finally {
      setLoading(false);
    }
  }, [fromTier, toTier, isAnnual]);

  const sameTier = fromTier === toTier;
  const fromTierInfo = tiers.find((t) => t.id === fromTier);
  const toTierInfo = tiers.find((t) => t.id === toTier);

  return (
    <div className="space-y-6">
      {/* Tier Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5" />
            Proration Preview
          </CardTitle>
          <CardDescription>
            See exactly how much you'll be charged or credited when changing your subscription tier mid-cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Billing cycle toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={!isAnnual ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsAnnual(false)}
            >
              Monthly
            </Button>
            <Button
              variant={isAnnual ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsAnnual(true)}
            >
              Annual
            </Button>
          </div>

          {/* Tier selectors */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Current Plan</label>
              <div className="space-y-2">
                {tiers.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setFromTier(tier.id)}
                    className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      fromTier === tier.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-medium">{tier.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCents(isAnnual ? tier.annualCents : tier.monthlyCents)}
                        {isAnnual ? '/yr' : '/mo'}
                      </span>
                    </div>
                    {fromTier === tier.id && (
                      <Badge variant="default" className="text-xs">Current</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">New Plan</label>
              <div className="space-y-2">
                {tiers.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setToTier(tier.id)}
                    disabled={tier.id === fromTier}
                    className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      toTier === tier.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    } ${tier.id === fromTier ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div>
                      <span className="text-sm font-medium">{tier.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCents(isAnnual ? tier.annualCents : tier.monthlyCents)}
                        {isAnnual ? '/yr' : '/mo'}
                      </span>
                    </div>
                    {toTier === tier.id && (
                      <Badge variant="default" className="text-xs">Selected</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calculate button */}
          <Button
            onClick={calculatePreview}
            disabled={loading || sameTier || tiersLoading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            {sameTier ? 'Select different tiers to compare' : 'Calculate Proration'}
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {result.isUpgrade ? (
                <TrendingUp className="h-5 w-5 text-blue-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-green-500" />
              )}
              Proration Breakdown
            </CardTitle>
            <CardDescription>
              {result.fromTierName} <ArrowRight className="inline h-3 w-3" /> {result.toTierName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Net Adjustment Highlight */}
            <div
              className={`rounded-lg p-4 text-center ${
                result.netAdjustmentCents > 0
                  ? 'bg-blue-500/10 border border-blue-500/30'
                  : result.netAdjustmentCents < 0
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-muted border border-border'
              }`}
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Net Adjustment
              </p>
              <p
                className={`text-3xl font-bold ${
                  result.netAdjustmentCents > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : result.netAdjustmentCents < 0
                      ? 'text-green-600 dark:text-green-400'
                      : ''
                }`}
              >
                {result.netAdjustmentDisplay}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {result.netAdjustmentCents > 0
                  ? 'Charged to your next invoice'
                  : result.netAdjustmentCents < 0
                    ? 'Credited to your next invoice'
                    : 'No adjustment needed'}
              </p>
            </div>

            {/* Visual Breakdown Bars */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Credit (unused {result.fromTierName} time)</span>
                  <span className="font-mono">{formatRate(result.creditCents)}</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500/70"
                    style={{ width: `${Math.min(100, (result.creditCents / Math.max(1, result.chargeCents)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Charge (remaining {result.toTierName} time)</span>
                  <span className="font-mono">{formatRate(result.chargeCents)}</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/70"
                    style={{ width: `${Math.min(100, (result.chargeCents / Math.max(1, result.creditCents + result.chargeCents)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Days Remaining:</span>
                <span className="font-mono font-medium">{result.daysRemaining}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Billing Cycle:</span>
                <span className="font-medium">{result.isAnnual ? 'Annual' : 'Monthly'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Old Daily Rate:</span>
                <span className="font-mono">{formatRate(result.oldDailyRateCents)}/day</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">New Daily Rate:</span>
                <span className="font-mono">{formatRate(result.newDailyRateCents)}/day</span>
              </div>
            </div>

            {/* Tier Comparison */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">From</p>
                <p className="text-sm font-medium">{result.fromTierName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRate(result.oldDailyRateCents)}/day
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">To</p>
                <p className="text-sm font-medium">{result.toTierName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRate(result.newDailyRateCents)}/day
                </p>
              </div>
            </div>

            {/* Recalculate */}
            <Button variant="outline" size="sm" onClick={calculatePreview} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Recalculate</span>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
