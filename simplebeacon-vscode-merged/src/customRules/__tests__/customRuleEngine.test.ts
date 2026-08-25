import { runCustomRules, applySeverityOverrides, isAllowlisted } from '../customRuleEngine';
import { CustomRulesConfig, CustomRule, SeverityOverride } from '../customRuleLoader';
import { RealtimeIssue } from '../../realtimeIssue';

describe('CustomRuleEngine', () => {
  describe('runCustomRules', () => {
    it('matches custom regex rules against file content', () => {
      const config: CustomRulesConfig = {
        rules: [
          {
            id: 'CUSTOM-001',
            regex: 'console\\.warn\\(',
            severity: 'warning',
            message: 'console.warn not allowed',
            suggestion: 'Use project logger',
            enabled: true,
          },
        ],
        severityOverrides: [],
      };

      const issues = runCustomRules(config, 'src/app.ts', 'console.warn("test");\nconst x = 1;', 'app', '.ts');
      expect(issues.length).toBe(1);
      expect(issues[0].type).toBe('CUSTOM-001');
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].message).toBe('console.warn not allowed');
      expect(issues[0].line).toBe(1);
    });

    it('respects fileGlob targeting', () => {
      const config: CustomRulesConfig = {
        rules: [
          {
            id: 'CUSTOM-001',
            regex: 'console\\.warn\\(',
            severity: 'warning',
            message: 'console.warn not allowed',
            fileGlob: 'src/api/**',
            enabled: true,
          },
        ],
        severityOverrides: [],
      };

      // Should match in src/api/
      const issues1 = runCustomRules(config, 'src/api/handler.ts', 'console.warn("test");', 'app', '.ts');
      expect(issues1.length).toBe(1);

      // Should NOT match in src/utils/
      const issues2 = runCustomRules(config, 'src/utils/helper.ts', 'console.warn("test");', 'app', '.ts');
      expect(issues2.length).toBe(0);
    });

    it('respects fileRoles targeting', () => {
      const config: CustomRulesConfig = {
        rules: [
          {
            id: 'CUSTOM-001',
            regex: 'TODO\\(',
            severity: 'info',
            message: 'TODO with assignee',
            fileRoles: ['app'],
            enabled: true,
          },
        ],
        severityOverrides: [],
      };

      // Should match in app code
      const issues1 = runCustomRules(config, 'src/app.ts', 'TODO(john): fix this', 'app', '.ts');
      expect(issues1.length).toBe(1);

      // Should NOT match in test code
      const issues2 = runCustomRules(config, 'src/app.test.ts', 'TODO(john): fix this', 'test', '.ts');
      expect(issues2.length).toBe(0);
    });

    it('respects fileExtensions targeting', () => {
      const config: CustomRulesConfig = {
        rules: [
          {
            id: 'CUSTOM-001',
            regex: 'print\\(',
            severity: 'warning',
            message: 'print not allowed',
            fileExtensions: ['.py'],
            enabled: true,
          },
        ],
        severityOverrides: [],
      };

      // Should match .py files
      const issues1 = runCustomRules(config, 'src/app.py', 'print("hello")', 'app', '.py');
      expect(issues1.length).toBe(1);

      // Should NOT match .js files
      const issues2 = runCustomRules(config, 'src/app.js', 'print("hello")', 'app', '.js');
      expect(issues2.length).toBe(0);
    });

    it('skips disabled rules', () => {
      const config: CustomRulesConfig = {
        rules: [
          {
            id: 'CUSTOM-001',
            regex: 'console\\.warn\\(',
            severity: 'warning',
            message: 'console.warn not allowed',
            enabled: false,
          },
        ],
        severityOverrides: [],
      };

      const issues = runCustomRules(config, 'src/app.ts', 'console.warn("test");', 'app', '.ts');
      expect(issues.length).toBe(0);
    });

    it('handles invalid regex gracefully', () => {
      const config: CustomRulesConfig = {
        rules: [
          {
            id: 'CUSTOM-001',
            regex: '[invalid',
            severity: 'warning',
            message: 'invalid regex',
            enabled: true,
          },
        ],
        severityOverrides: [],
      };

      const issues = runCustomRules(config, 'src/app.ts', 'some content', 'app', '.ts');
      expect(issues.length).toBe(0);
    });

    it('matches multiple occurrences on different lines', () => {
      const config: CustomRulesConfig = {
        rules: [
          {
            id: 'CUSTOM-001',
            regex: 'console\\.log\\(',
            severity: 'warning',
            message: 'console.log found',
            enabled: true,
          },
        ],
        severityOverrides: [],
      };

      const content = 'console.log("a");\nconst x = 1;\nconsole.log("b");';
      const issues = runCustomRules(config, 'src/app.ts', content, 'app', '.ts');
      expect(issues.length).toBe(2);
      expect(issues[0].line).toBe(1);
      expect(issues[1].line).toBe(3);
    });
  });

  describe('applySeverityOverrides', () => {
    it('overrides severity for matching rule type', () => {
      const issues: RealtimeIssue[] = [
        {
          file: 'src/app.ts',
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'console-log',
          message: 'test',
          timestamp: new Date(),
        },
      ];
      const overrides: SeverityOverride[] = [{ ruleType: 'console-log', severity: 'error', reason: 'Override' }];

      const result = applySeverityOverrides(overrides, issues, 'src/app.ts', 'app');
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('error');
      expect(result[0].calibrated).toBe(true);
    });

    it('suppresses findings when override severity is suppressed', () => {
      const issues: RealtimeIssue[] = [
        {
          file: 'src/app.ts',
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'console-log',
          message: 'test',
          timestamp: new Date(),
        },
      ];
      const overrides: SeverityOverride[] = [{ ruleType: 'console-log', severity: 'suppressed', reason: 'Disabled' }];

      const result = applySeverityOverrides(overrides, issues, 'src/app.ts', 'app');
      expect(result.length).toBe(0);
    });

    it('respects fileGlob targeting in overrides', () => {
      // Override applies to src/api/** only
      const overrides: SeverityOverride[] = [
        { ruleType: 'console-log', severity: 'error', fileGlob: 'src/api/**', reason: 'API override' },
      ];

      // Issue in src/api/ — should be overridden
      const apiIssues: RealtimeIssue[] = [
        {
          file: 'src/api/handler.ts',
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'console-log',
          message: 'test',
          timestamp: new Date(),
        },
      ];
      const apiResult = applySeverityOverrides(overrides, apiIssues, 'src/api/handler.ts', 'app');
      expect(apiResult.length).toBe(1);
      expect(apiResult[0].severity).toBe('error');

      // Issue in src/utils/ — should NOT be overridden
      const utilIssues: RealtimeIssue[] = [
        {
          file: 'src/utils/helper.ts',
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'console-log',
          message: 'test',
          timestamp: new Date(),
        },
      ];
      const utilResult = applySeverityOverrides(overrides, utilIssues, 'src/utils/helper.ts', 'app');
      expect(utilResult.length).toBe(1);
      expect(utilResult[0].severity).toBe('warning'); // Unchanged
    });

    it('respects fileRoles targeting in overrides', () => {
      const issues: RealtimeIssue[] = [
        {
          file: 'src/app.ts',
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'console-log',
          message: 'test',
          timestamp: new Date(),
        },
      ];
      const overrides: SeverityOverride[] = [
        { ruleType: 'console-log', severity: 'error', fileRoles: ['test'], reason: 'Test only override' },
      ];

      const result = applySeverityOverrides(overrides, issues, 'src/app.ts', 'app');
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('warning'); // Not overridden (app role, override targets test)
    });

    it('does not affect unmatched rule types', () => {
      const issues: RealtimeIssue[] = [
        {
          file: 'src/app.ts',
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'todo-comment',
          message: 'test',
          timestamp: new Date(),
        },
      ];
      const overrides: SeverityOverride[] = [{ ruleType: 'console-log', severity: 'error', reason: 'Override' }];

      const result = applySeverityOverrides(overrides, issues, 'src/app.ts', 'app');
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('warning'); // Unchanged
    });

    it('wildcard ruleType matches all', () => {
      const issues: RealtimeIssue[] = [
        {
          file: 'src/app.ts',
          line: 1,
          column: 1,
          severity: 'warning',
          type: 'console-log',
          message: 'test',
          timestamp: new Date(),
        },
        {
          file: 'src/app.ts',
          line: 2,
          column: 1,
          severity: 'info',
          type: 'todo-comment',
          message: 'test',
          timestamp: new Date(),
        },
      ];
      const overrides: SeverityOverride[] = [{ ruleType: '*', severity: 'error', reason: 'Override all' }];

      const result = applySeverityOverrides(overrides, issues, 'src/app.ts', 'app');
      expect(result.length).toBe(2);
      expect(result[0].severity).toBe('error');
      expect(result[1].severity).toBe('error');
    });
  });

  describe('isAllowlisted', () => {
    it('matches glob patterns', () => {
      expect(isAllowlisted(['src/legacy/**'], 'src/legacy/old.ts')).toBe(true);
      expect(isAllowlisted(['src/legacy/**'], 'src/new/app.ts')).toBe(false);
    });

    it('matches exact paths', () => {
      expect(isAllowlisted(['src/config.ts'], 'src/config.ts')).toBe(true);
      expect(isAllowlisted(['src/config.ts'], 'src/other.ts')).toBe(false);
    });

    it('matches wildcard extensions', () => {
      expect(isAllowlisted(['**/*.test.*'], 'src/app.test.ts')).toBe(true);
      expect(isAllowlisted(['**/*.test.*'], 'src/app.ts')).toBe(false);
    });

    it('returns false for empty allowlist', () => {
      expect(isAllowlisted([], 'src/app.ts')).toBe(false);
      expect(isAllowlisted(undefined as any, 'src/app.ts')).toBe(false);
    });
  });
});
