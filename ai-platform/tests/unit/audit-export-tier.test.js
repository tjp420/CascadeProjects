const {
    assessAuditExportTier,
    resolveAuditClientName,
    auditExportButtonLabel
} = require('../../server/lib/audit-export-tier');

describe('audit export tier', () => {
    test('returns insufficient when payload is empty', () => {
        const tier = assessAuditExportTier(null);
        expect(tier.tier).toBe('insufficient');
        expect(tier.exportBlocked).toBe(true);
    });

    test('returns handoff when gate and codebase are both present', () => {
        const tier = assessAuditExportTier({
            projectPath: 'C:\\Projects\\demo',
            results: {
                simplebeacon: { gate: { pass: true }, issueCount: 0 },
                codebase: { summary: { codeFilesAnalyzed: 1921, healthScore: 100 } }
            }
        });
        expect(tier.tier).toBe('handoff');
        expect(tier.showSignOffBlock).toBe(true);
        expect(tier.showReadinessScore).toBe(true);
        expect(tier.exportBlocked).toBe(false);
    });

    test('returns gate-only without readiness score badge', () => {
        const tier = assessAuditExportTier({
            projectPath: 'C:\\Projects\\demo',
            results: {
                simplebeacon: { gate: { pass: true }, issueCount: 0, qualityScore: 100 }
            }
        });
        expect(tier.tier).toBe('gate-only');
        expect(tier.showReadinessScore).toBe(false);
        expect(tier.missingForHandoff).toContain('Codebase deep scan (production paths)');
    });

    test('returns codebase-only for deep scan without gate', () => {
        const tier = assessAuditExportTier({
            projectPath: 'C:\\Projects\\demo',
            results: {
                codebase: { summary: { codeFilesAnalyzed: 1921, healthScore: 100 } }
            }
        });
        expect(tier.tier).toBe('codebase-only');
        expect(tier.showReadinessScore).toBe(false);
        expect(tier.missingForHandoff).toContain('Simplebeacon gate attestation');
    });

    test('returns supplementary for data-quality-only export', () => {
        const tier = assessAuditExportTier({
            projectPath: 'C:\\Projects\\demo',
            summary: { scanKind: 'data-quality', dataQualityFindings: 75 },
            results: {
                dataQuality: { summary: { totalFindings: 75 } }
            }
        });
        expect(tier.tier).toBe('supplementary');
        expect(tier.label).toBe('Data quality');
        expect(tier.showReadinessScore).toBe(false);
    });

    test('resolveAuditClientName avoids Client project placeholder', () => {
        expect(resolveAuditClientName({ client: 'Client project' }, 'C:\\Users\\Trevor\\CascadeProjects'))
            .toBe('…/CascadeProjects');
    });

    test('resolveAuditClientName normalizes C:…/Users paths from client field', () => {
        expect(resolveAuditClientName({ client: 'C:…/Users/Trevor/CascadeProjects' }, ''))
            .toBe('…/CascadeProjects');
    });

    test('auditExportButtonLabel reflects tier', () => {
        expect(auditExportButtonLabel({ tier: 'handoff', exportBlocked: false }))
            .toBe('Download security audit PDF');
        expect(auditExportButtonLabel({ tier: 'supplementary', label: 'Data quality', exportBlocked: false }))
            .toBe('Download supplementary PDF (Data quality)');
    });
});
