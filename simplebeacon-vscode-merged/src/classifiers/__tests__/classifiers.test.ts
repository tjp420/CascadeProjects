import { classifyFileRole, shouldScanRole, isProductionRole, FileRole } from '../fileRoleClassifier';
import { calibrateSeverity } from '../severityCalibrator';
import { shouldSuppress } from '../smartSuppressor';
import { getEffectiveConfidence, meetsConfidenceThreshold } from '../confidenceCalibrator';
import { DismissalTracker } from '../dismissalTracker';

describe('FileRoleClassifier', () => {
  describe('classifyFileRole', () => {
    it('classifies test files by path pattern', () => {
      const result = classifyFileRole('src/__tests__/utils.test.ts');
      expect(result.role).toBe('test');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies test files by name pattern', () => {
      const result = classifyFileRole('src/utils.test.ts');
      expect(result.role).toBe('test');
    });

    it('classifies spec files by name pattern', () => {
      const result = classifyFileRole('src/api.spec.js');
      expect(result.role).toBe('test');
    });

    it('classifies node_modules as vendor', () => {
      const result = classifyFileRole('node_modules/express/index.js');
      expect(result.role).toBe('vendor');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('classifies dist as generated', () => {
      const result = classifyFileRole('dist/bundle.js');
      expect(result.role).toBe('generated');
    });

    it('classifies .md files as docs', () => {
      const result = classifyFileRole('README.md');
      expect(result.role).toBe('docs');
    });

    it('classifies Dockerfiles as infra', () => {
      const result = classifyFileRole('Dockerfile');
      expect(result.role).toBe('infra');
    });

    it('classifies .env files as config', () => {
      const result = classifyFileRole('.env');
      expect(result.role).toBe('config');
    });

    it('classifies fixtures as test', () => {
      const result = classifyFileRole('tests/fixtures/sample-data.json');
      expect(result.role).toBe('test');
    });

    it('classifies examples as sample', () => {
      const result = classifyFileRole('examples/demo-handler.ts');
      expect(result.role).toBe('sample');
    });

    it('classifies generated files by content marker', () => {
      const result = classifyFileRole('src/compiled.ts', '/* DO NOT EDIT - auto-generated */\nexport const x = 1;');
      expect(result.role).toBe('generated');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('defaults to app for unrecognized files', () => {
      const result = classifyFileRole('src/handlers/userApi.ts');
      expect(result.role).toBe('app');
    });

    it('classifies package-lock.json as generated', () => {
      const result = classifyFileRole('package-lock.json');
      expect(result.role).toBe('generated');
    });

    it('classifies .tf files as infra', () => {
      const result = classifyFileRole('infra/main.tf');
      expect(result.role).toBe('infra');
    });
  });

  describe('shouldScanRole', () => {
    it('returns true for app code', () => {
      expect(shouldScanRole('app')).toBe(true);
    });
    it('returns true for test code', () => {
      expect(shouldScanRole('test')).toBe(true);
    });
    it('returns false for generated code', () => {
      expect(shouldScanRole('generated')).toBe(false);
    });
    it('returns false for vendor code', () => {
      expect(shouldScanRole('vendor')).toBe(false);
    });
  });

  describe('isProductionRole', () => {
    it('returns true for app', () => {
      expect(isProductionRole('app')).toBe(true);
    });
    it('returns true for config', () => {
      expect(isProductionRole('config')).toBe(true);
    });
    it('returns false for test', () => {
      expect(isProductionRole('test')).toBe(false);
    });
    it('returns false for docs', () => {
      expect(isProductionRole('docs')).toBe(false);
    });
  });
});

describe('SeverityCalibrator', () => {
  describe('calibrateSeverity', () => {
    it('keeps error severity for hardcoded password in app code', () => {
      const result = calibrateSeverity('hardcoded-password', 'error', 'app');
      expect(result.severity).toBe('error');
    });

    it('downshifts hardcoded password to info in test files', () => {
      const result = calibrateSeverity('hardcoded-password', 'error', 'test');
      expect(result.severity).toBe('info');
    });

    it('suppresses hardcoded password in docs', () => {
      const result = calibrateSeverity('hardcoded-password', 'error', 'docs');
      expect(result.severity).toBe('suppressed');
    });

    it('suppresses hardcoded password in generated files', () => {
      const result = calibrateSeverity('hardcoded-password', 'error', 'generated');
      expect(result.severity).toBe('suppressed');
    });

    it('suppresses console.log in generated files', () => {
      const result = calibrateSeverity('console-log', 'warning', 'generated');
      expect(result.severity).toBe('suppressed');
    });

    it('downshifts console.log to info in test files', () => {
      const result = calibrateSeverity('console-log', 'warning', 'test');
      expect(result.severity).toBe('info');
    });

    it('keeps eval severity in test files (security)', () => {
      const result = calibrateSeverity('eval-usage', 'warning', 'test');
      expect(result.severity).toBe('warning');
    });

    it('suppresses AI boilerplate in docs', () => {
      const result = calibrateSeverity('ai-boilerplate', 'warning', 'docs');
      expect(result.severity).toBe('suppressed');
    });

    it('uses default downshift for unknown rule types in test', () => {
      const result = calibrateSeverity('unknown-rule', 'error', 'test');
      expect(result.severity).toBe('warning');
    });

    it('uses default suppression for unknown rule types in vendor', () => {
      const result = calibrateSeverity('unknown-rule', 'error', 'vendor');
      expect(result.severity).toBe('suppressed');
    });
  });
});

describe('SmartSuppressor', () => {
  describe('shouldSuppress', () => {
    it('suppresses known placeholder credentials', () => {
      const result = shouldSuppress(
        'hardcoded-password',
        'password = "changeme"',
        'src/app.ts',
        'const password = "changeme";',
        'app'
      );
      expect(result.suppressed).toBe(true);
      expect(result.suppressor).toBe('safe-credential-value');
    });

    it('suppresses test-secret credentials', () => {
      const result = shouldSuppress(
        'hardcoded-token',
        'token = "test-secret"',
        'src/app.ts',
        'const token = "test-secret";',
        'app'
      );
      expect(result.suppressed).toBe(true);
    });

    it('does not suppress real-looking credentials', () => {
      const result = shouldSuppress(
        'hardcoded-password',
        'password = "Sup3rS3cr3t!2024"',
        'src/app.ts',
        'const password = "Sup3rS3cr3t!2024";',
        'app'
      );
      expect(result.suppressed).toBe(false);
    });

    it('suppresses public emails in PII logging', () => {
      const result = shouldSuppress(
        'pii-credential-logging',
        'admin@simplebeacon.ai',
        'src/app.ts',
        'console.log(admin@simplebeacon.ai)',
        'app'
      );
      expect(result.suppressed).toBe(true);
      expect(result.suppressor).toBe('public-email');
    });

    it('suppresses example.com URLs', () => {
      const result = shouldSuppress(
        'hardcoded-staging-url',
        'https://example.com/api',
        'src/app.ts',
        'const url = "https://example.com/api";',
        'app'
      );
      expect(result.suppressed).toBe(true);
    });

    it('suppresses AI slop in fixtures paths', () => {
      const result = shouldSuppress(
        'ai-boilerplate',
        'Here is the implementation',
        'tests/fixtures/sample-handler.ts',
        '// Here is the implementation',
        'test'
      );
      expect(result.suppressed).toBe(true);
      expect(result.suppressor).toBe('demo-path');
    });

    it('does not suppress non-credential findings in app code', () => {
      const result = shouldSuppress(
        'console-log',
        'console.log("hello")',
        'src/app.ts',
        'console.log("hello");',
        'app'
      );
      expect(result.suppressed).toBe(false);
    });
  });
});

describe('ConfidenceCalibrator', () => {
  describe('getEffectiveConfidence', () => {
    it('does not adjust for app code', () => {
      expect(getEffectiveConfidence(0.6, 'app')).toBe(0.6);
    });

    it('raises threshold for test files', () => {
      expect(getEffectiveConfidence(0.6, 'test')).toBeGreaterThan(0.6);
    });

    it('raises threshold even more for docs', () => {
      const testThreshold = getEffectiveConfidence(0.6, 'test');
      const docsThreshold = getEffectiveConfidence(0.6, 'docs');
      expect(docsThreshold).toBeGreaterThan(testThreshold);
    });

    it('lowers threshold for config files', () => {
      expect(getEffectiveConfidence(0.6, 'config')).toBeLessThan(0.6);
    });
  });

  describe('meetsConfidenceThreshold', () => {
    it('passes when confidence meets threshold', () => {
      expect(meetsConfidenceThreshold(0.8, 0.6, 'app')).toBe(true);
    });

    it('fails when confidence is below threshold', () => {
      expect(meetsConfidenceThreshold(0.4, 0.6, 'app')).toBe(false);
    });

    it('requires higher confidence in test files', () => {
      // 0.65 passes in app but might fail in test (0.6 + 0.15 = 0.75 threshold)
      expect(meetsConfidenceThreshold(0.65, 0.6, 'app')).toBe(true);
      expect(meetsConfidenceThreshold(0.65, 0.6, 'test')).toBe(false);
    });

    it('passes when confidence is undefined (backwards compat)', () => {
      expect(meetsConfidenceThreshold(undefined, 0.6, 'app')).toBe(true);
    });
  });
});

describe('DismissalTracker', () => {
  let tracker: DismissalTracker;

  beforeEach(() => {
    tracker = new DismissalTracker();
  });

  it('tracks finding counts', () => {
    tracker.recordFinding('console-log', 'file:1:console-log');
    tracker.recordFinding('console-log', 'file:2:console-log');
    const stats = tracker.getStats('console-log');
    expect(stats).not.toBeNull();
    expect(stats!.totalFindings).toBe(2);
  });

  it('tracks dismissal counts', () => {
    tracker.recordFinding('console-log', 'file:1:console-log');
    tracker.recordFinding('console-log', 'file:2:console-log');
    tracker.recordDismissal('console-log', 'file:1:console-log');
    const stats = tracker.getStats('console-log');
    expect(stats!.dismissedFindings).toBe(1);
    expect(stats!.dismissalRate).toBe(0.5);
  });

  it('checks if a signature is dismissed', () => {
    tracker.recordDismissal('console-log', 'file:1:console-log');
    expect(tracker.isDismissed('file:1:console-log')).toBe(true);
    expect(tracker.isDismissed('file:2:console-log')).toBe(false);
  });

  it('suggests allowlisting for high-dismissal rules', () => {
    // Record 10 findings, dismiss 5 (50% rate)
    for (let i = 0; i < 10; i++) {
      tracker.recordFinding('noisy-rule', `file:${i}:noisy-rule`);
    }
    for (let i = 0; i < 5; i++) {
      tracker.recordDismissal('noisy-rule', `file:${i}:noisy-rule`);
    }
    const suggestions = tracker.getSuggestions();
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].ruleType).toBe('noisy-rule');
    expect(suggestions[0].dismissalRate).toBe(0.5);
  });

  it('does not suggest for rules with low dismissal rates', () => {
    for (let i = 0; i < 10; i++) {
      tracker.recordFinding('good-rule', `file:${i}:good-rule`);
    }
    tracker.recordDismissal('good-rule', 'file:0:good-rule');
    const suggestions = tracker.getSuggestions();
    expect(suggestions.find((s) => s.ruleType === 'good-rule')).toBeUndefined();
  });

  it('requires minimum samples before suggesting', () => {
    // Only 2 findings, 1 dismissed (50% rate but below MIN_SAMPLES)
    tracker.recordFinding('rare-rule', 'file:1:rare-rule');
    tracker.recordFinding('rare-rule', 'file:2:rare-rule');
    tracker.recordDismissal('rare-rule', 'file:1:rare-rule');
    const suggestions = tracker.getSuggestions();
    expect(suggestions.find((s) => s.ruleType === 'rare-rule')).toBeUndefined();
  });

  it('exports JSON with all stats', () => {
    tracker.recordFinding('console-log', 'file:1:console-log');
    tracker.recordDismissal('console-log', 'file:1:console-log');
    const json = tracker.exportJson();
    expect(json.totalFindings).toBe(1);
    expect(json.totalDismissed).toBe(1);
    expect(json.rules.length).toBe(1);
    expect(json.rules[0].ruleType).toBe('console-log');
  });

  it('resets all stats', () => {
    tracker.recordFinding('console-log', 'file:1:console-log');
    tracker.reset();
    expect(tracker.getStats('console-log')).toBeNull();
    expect(tracker.isDismissed('file:1:console-log')).toBe(false);
  });
});
