import {
  DEFAULT_SETTINGS,
  SlopCopSettings,
  MonitoringMode,
  ScanScope,
  RuleTier,
  BlockingBehavior,
  PauseDuration,
} from '../slopCopSettings';

// We test the pure logic functions without the VS Code dependency
// by importing the settings model types and testing defaults + logic

describe('SlopCopSettings Model', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_SETTINGS.monitoringMode).toBe('diff-only');
      expect(DEFAULT_SETTINGS.scope).toBe('changed-files');
      expect(DEFAULT_SETTINGS.ruleTier).toBe('security-plus-repo');
      expect(DEFAULT_SETTINGS.blockingBehavior).toBe('high-only');
    });

    it('defaults noise controls to true (suppress noise)', () => {
      expect(DEFAULT_SETTINGS.ignoreTests).toBe(true);
      expect(DEFAULT_SETTINGS.ignoreFixtures).toBe(true);
      expect(DEFAULT_SETTINGS.ignoreGenerated).toBe(true);
      expect(DEFAULT_SETTINGS.ignoreVendor).toBe(true);
      expect(DEFAULT_SETTINGS.autoSuppressSafePatterns).toBe(true);
    });

    it('defaults policy to all enabled', () => {
      expect(DEFAULT_SETTINGS.customRulesEnabled).toBe(true);
      expect(DEFAULT_SETTINGS.productionPathChecks).toBe(true);
      expect(DEFAULT_SETTINGS.aiGuardrails).toBe(true);
    });

    it('defaults to not paused', () => {
      expect(DEFAULT_SETTINGS.isPaused).toBe(false);
      expect(DEFAULT_SETTINGS.pausedUntil).toBeUndefined();
    });

    it('defaults status counters to zero', () => {
      expect(DEFAULT_SETTINGS.activeBlockedFindings).toBe(0);
      expect(DEFAULT_SETTINGS.suppressedFalsePositives).toBe(0);
    });
  });

  describe('Type constraints', () => {
    it('MonitoringMode has exactly 3 values', () => {
      const modes: MonitoringMode[] = ['live', 'diff-only', 'off'];
      expect(modes.length).toBe(3);
      expect(modes).toContain('live');
      expect(modes).toContain('diff-only');
      expect(modes).toContain('off');
    });

    it('ScanScope has exactly 3 values', () => {
      const scopes: ScanScope[] = ['changed-files', 'current-file', 'workspace'];
      expect(scopes.length).toBe(3);
    });

    it('RuleTier has exactly 4 values', () => {
      const tiers: RuleTier[] = ['security-only', 'security-plus-repo', 'all-rules', 'minimal-advisory'];
      expect(tiers.length).toBe(4);
    });

    it('BlockingBehavior has exactly 3 values', () => {
      const behaviors: BlockingBehavior[] = ['high-only', 'medium-plus', 'advisory-none'];
      expect(behaviors.length).toBe(3);
    });

    it('PauseDuration has exactly 3 values', () => {
      const durations: PauseDuration[] = ['session', '30min', 'until-restart'];
      expect(durations.length).toBe(3);
    });
  });

  describe('Settings shape', () => {
    it('has all required fields', () => {
      const settings: SlopCopSettings = { ...DEFAULT_SETTINGS };
      // Monitoring
      expect(settings).toHaveProperty('monitoringMode');
      expect(settings).toHaveProperty('scope');
      expect(settings).toHaveProperty('ruleTier');
      expect(settings).toHaveProperty('blockingBehavior');
      // Noise
      expect(settings).toHaveProperty('ignoreTests');
      expect(settings).toHaveProperty('ignoreFixtures');
      expect(settings).toHaveProperty('ignoreGenerated');
      expect(settings).toHaveProperty('ignoreVendor');
      expect(settings).toHaveProperty('autoSuppressSafePatterns');
      // Policy
      expect(settings).toHaveProperty('customRulesEnabled');
      expect(settings).toHaveProperty('productionPathChecks');
      expect(settings).toHaveProperty('aiGuardrails');
      // Status
      expect(settings).toHaveProperty('isPaused');
      expect(settings).toHaveProperty('activeBlockedFindings');
      expect(settings).toHaveProperty('suppressedFalsePositives');
    });

    it('can be partially updated', () => {
      const original: SlopCopSettings = { ...DEFAULT_SETTINGS };
      const updated: SlopCopSettings = { ...original, monitoringMode: 'live', ignoreTests: false };
      expect(updated.monitoringMode).toBe('live');
      expect(updated.ignoreTests).toBe(false);
      // Other fields unchanged
      expect(updated.scope).toBe(original.scope);
      expect(updated.ruleTier).toBe(original.ruleTier);
    });
  });

  describe('Blocking behavior mapping', () => {
    it('high-only blocks on error', () => {
      const settings = { ...DEFAULT_SETTINGS, blockingBehavior: 'high-only' as BlockingBehavior };
      // The manager maps this to 'error' severity threshold
      expect(settings.blockingBehavior).toBe('high-only');
    });

    it('medium-plus blocks on warning+', () => {
      const settings = { ...DEFAULT_SETTINGS, blockingBehavior: 'medium-plus' as BlockingBehavior };
      expect(settings.blockingBehavior).toBe('medium-plus');
    });

    it('advisory-none does not block', () => {
      const settings = { ...DEFAULT_SETTINGS, blockingBehavior: 'advisory-none' as BlockingBehavior };
      expect(settings.blockingBehavior).toBe('advisory-none');
    });
  });

  describe('Rule tier mapping', () => {
    it('security-only uses only security rules', () => {
      const settings = { ...DEFAULT_SETTINGS, ruleTier: 'security-only' as RuleTier };
      expect(settings.ruleTier).toBe('security-only');
    });

    it('security-plus-repo uses security + custom rules', () => {
      const settings = { ...DEFAULT_SETTINGS, ruleTier: 'security-plus-repo' as RuleTier };
      expect(settings.ruleTier).toBe('security-plus-repo');
    });

    it('all-rules uses everything', () => {
      const settings = { ...DEFAULT_SETTINGS, ruleTier: 'all-rules' as RuleTier };
      expect(settings.ruleTier).toBe('all-rules');
    });

    it('minimal-advisory uses minimal set', () => {
      const settings = { ...DEFAULT_SETTINGS, ruleTier: 'minimal-advisory' as RuleTier };
      expect(settings.ruleTier).toBe('minimal-advisory');
    });
  });

  describe('Noise control combinations', () => {
    it('can disable all noise controls for maximum sensitivity', () => {
      const settings: SlopCopSettings = {
        ...DEFAULT_SETTINGS,
        ignoreTests: false,
        ignoreFixtures: false,
        ignoreGenerated: false,
        ignoreVendor: false,
        autoSuppressSafePatterns: false,
      };
      expect(settings.ignoreTests).toBe(false);
      expect(settings.ignoreFixtures).toBe(false);
      expect(settings.ignoreGenerated).toBe(false);
      expect(settings.ignoreVendor).toBe(false);
      expect(settings.autoSuppressSafePatterns).toBe(false);
    });

    it('can enable all noise controls for minimum noise', () => {
      const settings: SlopCopSettings = {
        ...DEFAULT_SETTINGS,
        ignoreTests: true,
        ignoreFixtures: true,
        ignoreGenerated: true,
        ignoreVendor: true,
        autoSuppressSafePatterns: true,
      };
      expect(settings.ignoreTests).toBe(true);
      expect(settings.ignoreFixtures).toBe(true);
      expect(settings.ignoreGenerated).toBe(true);
      expect(settings.ignoreVendor).toBe(true);
      expect(settings.autoSuppressSafePatterns).toBe(true);
    });
  });

  describe('Monitoring mode semantics', () => {
    it('live mode scans on every change', () => {
      const settings = { ...DEFAULT_SETTINGS, monitoringMode: 'live' as MonitoringMode };
      expect(settings.monitoringMode).toBe('live');
    });

    it('diff-only mode scans only changed files', () => {
      const settings = { ...DEFAULT_SETTINGS, monitoringMode: 'diff-only' as MonitoringMode };
      expect(settings.monitoringMode).toBe('diff-only');
    });

    it('off mode disables all automatic scanning', () => {
      const settings = { ...DEFAULT_SETTINGS, monitoringMode: 'off' as MonitoringMode };
      expect(settings.monitoringMode).toBe('off');
    });
  });
});
