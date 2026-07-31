/**
 * Unit tests for compliance-checklist refactoring.
 */

const {
  evaluateComplianceChecklist,
  evaluateRule,
  detectProductionAuthProfile,
  resolveChecklistBase,
  DEFAULT_CHECKLIST,
  EU_AI_ACT_CHECKLIST,
} = require('../compliance-checklist');

describe('compliance-checklist', () => {
  describe('resolveChecklistBase', () => {
    it('returns default checklist for unknown profile', () => {
      const result = resolveChecklistBase({ checklistProfile: 'nonexistent' });
      expect(result).toBe(DEFAULT_CHECKLIST);
    });

    it('returns EU AI Act checklist for eu-ai-act profile', () => {
      const result = resolveChecklistBase({ checklistProfile: 'eu-ai-act' });
      expect(result).toBe(EU_AI_ACT_CHECKLIST);
    });
  });

  describe('evaluateRule', () => {
    it('evaluates gate-pass as pass when gate passes', () => {
      const result = evaluateRule(
        { id: 'g1', title: 'Gate', category: 'safety', severity: 'high', check: 'gate-pass' },
        { report: { gate: { pass: true, blockingCount: 0 } } }
      );
      expect(result.status).toBe('pass');
    });

    it('evaluates gate-pass as fail when gate fails', () => {
      const result = evaluateRule(
        { id: 'g1', title: 'Gate', category: 'safety', severity: 'high', check: 'gate-pass' },
        { report: { gate: { pass: false, blockingCount: 3 } } }
      );
      expect(result.status).toBe('fail');
      expect(result.evidence).toContain('3');
    });

    it('evaluates zero-credential-findings as pass with zero findings', () => {
      const result = evaluateRule(
        {
          id: 'c1',
          title: 'Creds',
          category: 'security',
          severity: 'critical',
          check: 'zero-credential-findings',
        },
        { report: { credentialFindings: 0, credentialScanned: 100 } }
      );
      expect(result.status).toBe('pass');
    });

    it('evaluates zero-credential-findings as fail with findings', () => {
      const result = evaluateRule(
        {
          id: 'c1',
          title: 'Creds',
          category: 'security',
          severity: 'critical',
          check: 'zero-credential-findings',
        },
        { report: { credentialFindings: 5 } }
      );
      expect(result.status).toBe('fail');
    });

    it('evaluates npm-no-critical-high as skip when no npmAudit', () => {
      const result = evaluateRule(
        {
          id: 'n1',
          title: 'NPM',
          category: 'dependencies',
          severity: 'high',
          check: 'npm-no-critical-high',
        },
        { report: {}, npmAudit: null }
      );
      expect(result.status).toBe('skip');
    });

    it('evaluates npm-no-critical-high as pass with zero critical/high', () => {
      const result = evaluateRule(
        {
          id: 'n1',
          title: 'NPM',
          category: 'dependencies',
          severity: 'high',
          check: 'npm-no-critical-high',
        },
        {
          report: {},
          npmAudit: {
            summary: { critical: 0, high: 0, moderate: 2, low: 1, total: 3 },
            source: 'test',
          },
        }
      );
      expect(result.status).toBe('pass');
    });

    it('evaluates npm-no-critical-high as fail with critical issues', () => {
      const result = evaluateRule(
        {
          id: 'n1',
          title: 'NPM',
          category: 'dependencies',
          severity: 'high',
          check: 'npm-no-critical-high',
        },
        {
          report: {},
          npmAudit: { summary: { critical: 1, high: 0, moderate: 0, low: 0, total: 1 } },
        }
      );
      expect(result.status).toBe('fail');
    });

    it('evaluates npm-moderate-limit with default limit of 0', () => {
      const result = evaluateRule(
        {
          id: 'n2',
          title: 'NPM Moderate',
          category: 'dependencies',
          severity: 'medium',
          check: 'npm-moderate-limit',
        },
        { report: {}, npmAudit: { summary: { moderate: 0 } } }
      );
      expect(result.status).toBe('pass');
    });

    it('evaluates schema-compliance as skip when no samples', () => {
      const result = evaluateRule(
        {
          id: 's1',
          title: 'Schema',
          category: 'quality',
          severity: 'medium',
          check: 'schema-compliance',
        },
        { report: { schemaChecked: 0 } }
      );
      expect(result.status).toBe('skip');
    });

    it('evaluates schema-compliance as pass when all pass', () => {
      const result = evaluateRule(
        {
          id: 's1',
          title: 'Schema',
          category: 'quality',
          severity: 'medium',
          check: 'schema-compliance',
        },
        { report: { schemaChecked: 5, schemaPassed: 5 } }
      );
      expect(result.status).toBe('pass');
    });

    it('evaluates consistency-pass as skip when not checked', () => {
      const result = evaluateRule(
        {
          id: 'co1',
          title: 'Consistency',
          category: 'quality',
          severity: 'medium',
          check: 'consistency-pass',
        },
        { report: { consistencyChecked: 0 } }
      );
      expect(result.status).toBe('skip');
    });

    it('evaluates consistency-pass as pass with high score', () => {
      const result = evaluateRule(
        {
          id: 'co1',
          title: 'Consistency',
          category: 'quality',
          severity: 'medium',
          check: 'consistency-pass',
        },
        { report: { consistencyChecked: 10, consistencyScore: 98 } }
      );
      expect(result.status).toBe('pass');
    });

    it('evaluates eu-ai-act-high-risk-reviewed as skip when not scanned', () => {
      const result = evaluateRule(
        {
          id: 'eu1',
          title: 'High Risk',
          category: 'compliance',
          severity: 'high',
          check: 'eu-ai-act-high-risk-reviewed',
        },
        { report: {} }
      );
      expect(result.status).toBe('skip');
    });

    it('evaluates unknown check as skip', () => {
      const result = evaluateRule(
        {
          id: 'u1',
          title: 'Unknown',
          category: 'test',
          severity: 'low',
          check: 'nonexistent-check',
        },
        { report: {} }
      );
      expect(result.status).toBe('skip');
      expect(result.evidence).toContain('Unknown check');
    });

    it('evaluates cleanup-bloat-reviewed as pass with no bloat', () => {
      const result = evaluateRule(
        {
          id: 'b1',
          title: 'Bloat',
          category: 'hygiene',
          severity: 'low',
          check: 'cleanup-bloat-reviewed',
        },
        { report: {}, dataCleanup: { findings: {}, summary: {} } }
      );
      expect(result.status).toBe('pass');
    });
  });

  describe('evaluateComplianceChecklist end-to-end', () => {
    it('returns scored result with all passing rules', () => {
      const report = {
        projectRoot: '',
        gate: { pass: true, blockingCount: 0 },
        credentialFindings: 0,
        credentialScanned: 50,
        productionLeakFindings: 0,
        productionLeakScanned: 30,
        schemaChecked: 5,
        schemaPassed: 5,
        consistencyChecked: 10,
        consistencyPassed: true,
        consistencyScore: 98,
      };
      const result = evaluateComplianceChecklist(report, {
        checklist: DEFAULT_CHECKLIST,
        npmAudit: { summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 } },
      });
      expect(result.type).toBe('simplebeacon-compliance-checklist');
      expect(result.summary.passed).toBeGreaterThan(0);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.readyForAutomation).toBe(true);
      expect(result.rules.length).toBeGreaterThan(0);
    });

    it('returns EU AI Act headline when profile is eu-ai-act', () => {
      const report = { projectRoot: '', gate: { pass: true } };
      const result = evaluateComplianceChecklist(report, {
        checklist: EU_AI_ACT_CHECKLIST,
        checklistProfile: 'eu-ai-act',
      });
      expect(result.summary.headline).toContain('EU AI Act');
    });
  });

  describe('detectProductionAuthProfile', () => {
    it('returns null when no projectRoot', () => {
      expect(detectProductionAuthProfile(null)).toBeNull();
    });

    it('returns not-configured when .env.production missing', () => {
      const result = detectProductionAuthProfile('/nonexistent/path');
      expect(result.configured).toBe(false);
      expect(result.reason).toContain('.env.production not present');
    });
  });
});
