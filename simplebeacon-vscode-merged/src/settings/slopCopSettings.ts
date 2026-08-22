/**
 * Slop Cop settings state model — the single source of truth for
 * monitoring policy, noise controls, and blocking behavior.
 *
 * Milestone 3.5: Sidebar Settings Panel
 */

import * as vscode from 'vscode';

// ─── Types ───

export type MonitoringMode = 'live' | 'diff-only' | 'off';
export type ScanScope = 'changed-files' | 'current-file' | 'workspace';
export type RuleTier = 'security-only' | 'security-plus-repo' | 'all-rules' | 'minimal-advisory';
export type BlockingBehavior = 'high-only' | 'medium-plus' | 'advisory-none';
export type PauseDuration = 'session' | '30min' | 'until-restart';

export interface SlopCopSettings {
  // 1. Monitoring
  monitoringMode: MonitoringMode;
  scope: ScanScope;
  ruleTier: RuleTier;
  blockingBehavior: BlockingBehavior;

  // 2. Noise controls
  ignoreTests: boolean;
  ignoreFixtures: boolean;
  ignoreGenerated: boolean;
  ignoreVendor: boolean;
  autoSuppressSafePatterns: boolean;

  // 3. Policy
  customRulesEnabled: boolean;
  productionPathChecks: boolean;
  aiGuardrails: boolean;

  // 4. Status (runtime, not persisted)
  isPaused: boolean;
  pausedUntil?: number; // timestamp ms
  pauseDuration?: PauseDuration;
  lastScanTime?: number;
  activeBlockedFindings: number;
  suppressedFalsePositives: number;
}

// ─── Defaults ───

export const DEFAULT_SETTINGS: SlopCopSettings = {
  monitoringMode: 'diff-only',
  scope: 'changed-files',
  ruleTier: 'security-plus-repo',
  blockingBehavior: 'high-only',
  ignoreTests: true,
  ignoreFixtures: true,
  ignoreGenerated: true,
  ignoreVendor: true,
  autoSuppressSafePatterns: true,
  customRulesEnabled: true,
  productionPathChecks: true,
  aiGuardrails: true,
  isPaused: false,
  activeBlockedFindings: 0,
  suppressedFalsePositives: 0,
};

// ─── Settings manager (singleton) ───

const SETTINGS_KEY = 'simplebeacon.slopCopSettings';
const PAUSE_KEY = 'simplebeacon.slopCopPause';

export class SlopCopSettingsManager {
  private settings: SlopCopSettings = { ...DEFAULT_SETTINGS };
  private listeners: Array<(settings: SlopCopSettings) => void> = [];

  constructor(private context?: vscode.ExtensionContext) {
    this.loadSettings();
  }

  /**
   * Load settings from VS Code workspace state (persisted) or fall back to defaults.
   */
  loadSettings(): SlopCopSettings {
    // Try to load from VS Code config first
    const config = vscode.workspace.getConfiguration('simplebeacon');
    const configSettings = config.get<SlopCopSettings>(SETTINGS_KEY);
    if (configSettings) {
      this.settings = { ...DEFAULT_SETTINGS, ...configSettings };
    }

    // Check pause state
    if (this.context) {
      const pauseData = this.context.workspaceState.get<{ until: number; duration: PauseDuration }>(PAUSE_KEY);
      if (pauseData && pauseData.until > Date.now()) {
        this.settings.isPaused = true;
        this.settings.pausedUntil = pauseData.until;
        this.settings.pauseDuration = pauseData.duration;
      } else if (pauseData) {
        // Pause expired — clear it
        this.context.workspaceState.update(PAUSE_KEY, undefined);
        this.settings.isPaused = false;
      }
    }

    return this.getSettings();
  }

  /**
   * Get current settings (read-only).
   */
  getSettings(): SlopCopSettings {
    // Check if pause has expired
    if (this.settings.isPaused && this.settings.pausedUntil) {
      if (this.settings.pausedUntil <= Date.now()) {
        this.resume();
      }
    }
    return { ...this.settings };
  }

  /**
   * Update settings and persist.
   */
  async updateSettings(partial: Partial<SlopCopSettings>): Promise<void> {
    this.settings = { ...this.settings, ...partial };
    await this.persist();
    this.notifyListeners();
  }

  /**
   * Pause monitoring for a specified duration.
   */
  async pause(duration: PauseDuration): Promise<void> {
    let until: number;
    switch (duration) {
      case 'session':
        until = Date.now() + 8 * 60 * 60 * 1000; // 8 hours (session)
        break;
      case '30min':
        until = Date.now() + 30 * 60 * 1000;
        break;
      case 'until-restart':
        until = Date.now() + 365 * 24 * 60 * 60 * 1000; // effectively forever
        break;
    }

    this.settings.isPaused = true;
    this.settings.pausedUntil = until;
    this.settings.pauseDuration = duration;

    if (this.context) {
      this.context.workspaceState.update(PAUSE_KEY, { until, duration });
    }
    this.notifyListeners();
  }

  /**
   * Resume monitoring.
   */
  resume(): void {
    this.settings.isPaused = false;
    this.settings.pausedUntil = undefined;
    this.settings.pauseDuration = undefined;

    if (this.context) {
      this.context.workspaceState.update(PAUSE_KEY, undefined);
    }
    this.notifyListeners();
  }

  /**
   * Update status fields (runtime, not persisted).
   */
  updateStatus(status: Partial<Pick<SlopCopSettings, 'lastScanTime' | 'activeBlockedFindings' | 'suppressedFalsePositives'>>): void {
    this.settings = { ...this.settings, ...status };
    this.notifyListeners();
  }

  /**
   * Subscribe to settings changes.
   */
  onChange(listener: (settings: SlopCopSettings) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Check if monitoring is currently active (not paused and not off).
   */
  isMonitoringActive(): boolean {
    if (this.settings.monitoringMode === 'off') return false;
    if (this.settings.isPaused) return false;
    return true;
  }

  /**
   * Check if a file role should be scanned based on noise controls.
   */
  shouldScanRole(role: string): boolean {
    if (role === 'test' && this.settings.ignoreTests) return false;
    if (role === 'test' && this.settings.ignoreFixtures) return false; // fixtures are test role
    if (role === 'generated' && this.settings.ignoreGenerated) return false;
    if (role === 'vendor' && this.settings.ignoreVendor) return false;
    if (role === 'docs' && this.settings.ignoreFixtures) return false; // docs suppressed with fixtures
    if (role === 'sample' && this.settings.ignoreFixtures) return false;
    return true;
  }

  /**
   * Get the blocking severity threshold based on settings.
   */
  getBlockOnSeverity(): 'error' | 'warning' | 'info' | 'none' {
    switch (this.settings.blockingBehavior) {
      case 'high-only': return 'error';
      case 'medium-plus': return 'warning';
      case 'advisory-none': return 'none';
    }
  }

  /**
   * Get the rule tier filter.
   */
  getRuleTierFilter(): 'security' | 'security-plus-repo' | 'all' | 'minimal' {
    switch (this.settings.ruleTier) {
      case 'security-only': return 'security';
      case 'security-plus-repo': return 'security-plus-repo';
      case 'all-rules': return 'all';
      case 'minimal-advisory': return 'minimal';
    }
  }

  // ─── Internal ───

  private async persist(): Promise<void> {
    const config = vscode.workspace.getConfiguration('simplebeacon');
    // Don't persist runtime status fields
    const toPersist: Partial<SlopCopSettings> = {
      monitoringMode: this.settings.monitoringMode,
      scope: this.settings.scope,
      ruleTier: this.settings.ruleTier,
      blockingBehavior: this.settings.blockingBehavior,
      ignoreTests: this.settings.ignoreTests,
      ignoreFixtures: this.settings.ignoreFixtures,
      ignoreGenerated: this.settings.ignoreGenerated,
      ignoreVendor: this.settings.ignoreVendor,
      autoSuppressSafePatterns: this.settings.autoSuppressSafePatterns,
      customRulesEnabled: this.settings.customRulesEnabled,
      productionPathChecks: this.settings.productionPathChecks,
      aiGuardrails: this.settings.aiGuardrails,
    };
    await config.update(SETTINGS_KEY, toPersist, vscode.ConfigurationTarget.Workspace);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getSettings());
    }
  }
}

// ─── Singleton ───

let settingsManagerInstance: SlopCopSettingsManager | null = null;

export function getSettingsManager(context?: vscode.ExtensionContext): SlopCopSettingsManager {
  if (!settingsManagerInstance) {
    settingsManagerInstance = new SlopCopSettingsManager(context);
  } else if (context) {
    // Update context if provided (for workspace state access)
    (settingsManagerInstance as any).context = context;
    settingsManagerInstance.loadSettings();
  }
  return settingsManagerInstance;
}

export function resetSettingsManager(): void {
  settingsManagerInstance = null;
}
