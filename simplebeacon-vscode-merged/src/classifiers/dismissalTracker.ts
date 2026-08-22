/**
 * Dismissal tracker — tracks how often each rule's findings are dismissed
 * by users. Rules with high dismissal rates are false-positive suspects
 * and should be auto-suggested for allowlisting.
 *
 * Milestone 1: Trust and Noise Reduction
 */

export interface DismissalStats {
  ruleType: string;
  totalFindings: number;
  dismissedFindings: number;
  dismissalRate: number; // 0-1
  lastDismissedAt: Date | null;
  lastSeenAt: Date | null;
}

export interface DismissalSuggestion {
  ruleType: string;
  dismissalRate: number;
  suggestion: string;
  suggestedAllowlistEntry?: string;
}

const DISMISSAL_THRESHOLD = 0.3; // 30% dismissal rate triggers a suggestion
const MIN_SAMPLES = 5; // Need at least 5 findings before suggesting

export class DismissalTracker {
  private stats = new Map<string, { findings: number; dismissed: number; lastDismissed: Date | null; lastSeen: Date | null }>();
  private dismissedSignatures = new Set<string>();

  /**
   * Record that a finding was detected for a rule type.
   */
  recordFinding(ruleType: string, signature: string): void {
    const entry = this.stats.get(ruleType) || { findings: 0, dismissed: 0, lastDismissed: null, lastSeen: null };
    entry.findings++;
    entry.lastSeen = new Date();
    this.stats.set(ruleType, entry);
  }

  /**
   * Record that a finding was dismissed by the user.
   */
  recordDismissal(ruleType: string, signature: string): void {
    const entry = this.stats.get(ruleType) || { findings: 0, dismissed: 0, lastDismissed: null, lastSeen: null };
    entry.dismissed++;
    entry.lastDismissed = new Date();
    this.stats.set(ruleType, entry);
    this.dismissedSignatures.add(signature);
  }

  /**
   * Check if a specific finding signature has been dismissed.
   */
  isDismissed(signature: string): boolean {
    return this.dismissedSignatures.has(signature);
  }

  /**
   * Get dismissal stats for a specific rule type.
   */
  getStats(ruleType: string): DismissalStats | null {
    const entry = this.stats.get(ruleType);
    if (!entry) return null;
    return {
      ruleType,
      totalFindings: entry.findings,
      dismissedFindings: entry.dismissed,
      dismissalRate: entry.findings > 0 ? entry.dismissed / entry.findings : 0,
      lastDismissedAt: entry.lastDismissed,
      lastSeenAt: entry.lastSeen,
    };
  }

  /**
   * Get stats for all rule types.
   */
  getAllStats(): DismissalStats[] {
    const results: DismissalStats[] = [];
    for (const [ruleType, entry] of this.stats) {
      results.push({
        ruleType,
        totalFindings: entry.findings,
        dismissedFindings: entry.dismissed,
        dismissalRate: entry.findings > 0 ? entry.dismissed / entry.findings : 0,
        lastDismissedAt: entry.lastDismissed,
        lastSeenAt: entry.lastSeen,
      });
    }
    return results.sort((a, b) => b.dismissalRate - a.dismissalRate);
  }

  /**
   * Get rules with high dismissal rates that should be suggested for allowlisting.
   */
  getSuggestions(): DismissalSuggestion[] {
    const suggestions: DismissalSuggestion[] = [];
    for (const [ruleType, entry] of this.stats) {
      if (entry.findings < MIN_SAMPLES) continue;
      const rate = entry.findings > 0 ? entry.dismissed / entry.findings : 0;
      if (rate >= DISMISSAL_THRESHOLD) {
        suggestions.push({
          ruleType,
          dismissalRate: rate,
          suggestion: `Rule "${ruleType}" has a ${(rate * 100).toFixed(0)}% dismissal rate (${entry.dismissed}/${entry.findings} findings dismissed). Consider allowlisting or adjusting its confidence threshold.`,
        });
      }
    }
    return suggestions.sort((a, b) => b.dismissalRate - a.dismissalRate);
  }

  /**
   * Get the top N noisiest rules (most findings).
   */
  getNoisiestRules(limit: number = 10): DismissalStats[] {
    return this.getAllStats()
      .sort((a, b) => b.totalFindings - a.totalFindings)
      .slice(0, limit);
  }

  /**
   * Get rules with zero findings (candidates for removal/disabling).
   */
  getDormantRules(): string[] {
    const dormant: string[] = [];
    for (const [ruleType, entry] of this.stats) {
      if (entry.findings === 0) {
        dormant.push(ruleType);
      }
    }
    return dormant;
  }

  /**
   * Reset all stats (e.g. when switching workspaces).
   */
  reset(): void {
    this.stats.clear();
    this.dismissedSignatures.clear();
  }

  /**
   * Export stats as JSON for the noise dashboard.
   */
  exportJson(): {
    rules: DismissalStats[];
    suggestions: DismissalSuggestion[];
    noisiest: DismissalStats[];
    dormant: string[];
    totalFindings: number;
    totalDismissed: number;
    overallDismissalRate: number;
  } {
    const rules = this.getAllStats();
    const totalFindings = rules.reduce((sum, r) => sum + r.totalFindings, 0);
    const totalDismissed = rules.reduce((sum, r) => sum + r.dismissedFindings, 0);
    return {
      rules,
      suggestions: this.getSuggestions(),
      noisiest: this.getNoisiestRules(10),
      dormant: this.getDormantRules(),
      totalFindings,
      totalDismissed,
      overallDismissalRate: totalFindings > 0 ? totalDismissed / totalFindings : 0,
    };
  }
}

/**
 * Singleton instance.
 */
let dismissalTrackerInstance: DismissalTracker | null = null;

export function getDismissalTracker(): DismissalTracker {
  if (!dismissalTrackerInstance) {
    dismissalTrackerInstance = new DismissalTracker();
  }
  return dismissalTrackerInstance;
}

export function resetDismissalTracker(): void {
  dismissalTrackerInstance = null;
}
