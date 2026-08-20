import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Progress } from '@/components/ui/progress';
import { DollarSign, AlertTriangle, Save, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BudgetConfig {
  softCapPercent?: number;
  hardStopPercent?: number;
  alertIntervals?: number[];
  alertCooldownMinutes?: number;
  webhookAlertsEnabled?: boolean;
  autoResetEnabled?: boolean;
}

interface Budget {
  id: string;
  orgId: string;
  scope: string;
  name?: string;
  limitUSD: number;
  spentUSD: number;
  period: string;
  periodStart: string;
  periodEnd: string;
  enabled: boolean;
  config: BudgetConfig;
  alerts: { type: string; crossedValue: number; pct: number; timestamp: string }[];
}

interface WorkspaceBudgetPanelProps {
  budgets: Budget[];
  orgId: string;
  isAdmin: boolean;
  onSave: (scope: string, updates: Partial<Budget>) => Promise<boolean>;
  onReset: (scope: string) => Promise<boolean>;
  loading: boolean;
}

export function WorkspaceBudgetPanel({ budgets, isAdmin, onSave, onReset, loading }: WorkspaceBudgetPanelProps) {
  const [dirty, setDirty] = useState<Record<string, Partial<Budget> | undefined>>({});

  const updateDraft = useCallback((scope: string, patch: Partial<Budget>) => {
    setDirty((prev) => ({
      ...prev,
      [scope]: { ...(prev[scope] ?? {}), ...patch },
    }));
  }, []);

  const updateDraftConfig = useCallback((scope: string, patch: Partial<BudgetConfig>) => {
    setDirty((prev) => ({
      ...prev,
      [scope]: {
        ...(prev[scope] ?? {}),
        config: { ...((prev[scope]?.config as BudgetConfig) ?? {}), ...patch },
      },
    }));
  }, []);

  const getBudgetDisplay = (b: Budget): Budget => {
    return { ...b, ...(dirty[b.scope] ?? {}) } as Budget;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Token Budget Allocation
        </CardTitle>
        <CardDescription>Live capacity, threshold, and alerting controls.{!isAdmin && ' View-only.'}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading budgets...
          </div>
        )}
        <div className="space-y-6">
          {budgets.map((b) => {
            const display = getBudgetDisplay(b);
            const pct = b.limitUSD > 0 ? (b.spentUSD / b.limitUSD) * 100 : 0;
            const isDirty = !!dirty[b.scope];
            return (
              <div key={b.scope} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{b.scope}</h4>
                    <p className="text-xs text-foreground-muted">{b.name || 'Default workspace budget'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pct >= (b.config?.hardStopPercent || 100) && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Hard Stop
                      </Badge>
                    )}
                    {isDirty && isAdmin && (
                      <Badge variant="outline" className="text-xs">
                        Unsaved
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-xs text-foreground-muted">
                    <span>
                      ${b.spentUSD.toFixed(2)} of ${b.limitUSD.toFixed(2)}
                    </span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className="h-2" />
                </div>

                {display.alerts && display.alerts.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {display.alerts.slice(-3).map((a, i) => (
                      <Badge key={i} variant={a.type === 'hard_stop' ? 'destructive' : 'secondary'} className="text-xs">
                        {a.type} {a.crossedValue}% — {new Date(a.timestamp).toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <BudgetField label="Limit (USD)">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={display.limitUSD}
                      disabled={!isAdmin}
                      onChange={(e) => updateDraft(b.scope, { limitUSD: parseFloat(e.target.value) })}
                    />
                  </BudgetField>

                  <BudgetField label="Soft Cap %">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={display.config?.softCapPercent ?? 80}
                      disabled={!isAdmin}
                      onChange={(e) => updateDraftConfig(b.scope, { softCapPercent: parseInt(e.target.value, 10) })}
                    />
                  </BudgetField>

                  <BudgetField label="Hard Stop %">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      step={1}
                      value={display.config?.hardStopPercent ?? 100}
                      disabled={!isAdmin}
                      onChange={(e) => updateDraftConfig(b.scope, { hardStopPercent: parseInt(e.target.value, 10) })}
                    />
                  </BudgetField>

                  <BudgetField label="Alert Intervals">
                    <Input
                      value={(display.config?.alertIntervals ?? []).join(', ')}
                      disabled={!isAdmin}
                      placeholder="50, 80, 100"
                      onChange={(e) => {
                        const vals = e.target.value
                          .split(',')
                          .map((s) => parseInt(s.trim(), 10))
                          .filter((n) => !isNaN(n) && n > 0);
                        updateDraftConfig(b.scope, { alertIntervals: vals });
                      }}
                    />
                  </BudgetField>

                  <BudgetField label="Period">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={display.period}
                      disabled={!isAdmin}
                      onChange={(e) => updateDraft(b.scope, { period: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </BudgetField>

                  <BudgetField label="Cooldown (min)">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={display.config?.alertCooldownMinutes ?? 30}
                      disabled={!isAdmin}
                      onChange={(e) =>
                        updateDraftConfig(b.scope, { alertCooldownMinutes: parseInt(e.target.value, 10) })
                      }
                    />
                  </BudgetField>

                  <div className="flex items-end gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-background"
                        checked={!!display.config?.autoResetEnabled}
                        disabled={!isAdmin}
                        onChange={(e) => updateDraftConfig(b.scope, { autoResetEnabled: e.target.checked })}
                      />
                      Auto reset
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-background"
                        checked={!!display.config?.webhookAlertsEnabled}
                        disabled={!isAdmin}
                        onChange={(e) => updateDraftConfig(b.scope, { webhookAlertsEnabled: e.target.checked })}
                      />
                      Webhooks
                    </label>
                  </div>

                  {isAdmin && (
                    <div className="flex items-end gap-2">
                      <Button
                        size="sm"
                        disabled={!isDirty}
                        onClick={async () => {
                          const ok = await onSave(b.scope, dirty[b.scope] ?? {});
                          if (ok) setDirty((prev) => ({ ...prev, [b.scope]: undefined }));
                        }}
                      >
                        <Save className="mr-1 h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const ok = await onReset(b.scope);
                          if (ok) setDirty((prev) => ({ ...prev, [b.scope]: undefined }));
                        }}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-foreground-muted">
                  Period: {new Date(b.periodStart).toLocaleDateString()} → {new Date(b.periodEnd).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
