const {
    classifyRowKind,
    buildImpactRisk,
    buildCodeRecipe,
    buildVerificationCommand,
    enrichRemediationRow,
    buildFixSpec,
    buildStructuredChanges,
    recipeFromFixSpec,
    parseLocation,
    buildFixPlanFromScan,
    buildRemediationRowsFromScan,
    FIX_SPEC_VERSION
} = require('../../server/lib/audit-remediation-recipes');

describe('audit remediation recipes', () => {
    test('classifies credential and fiction rows', () => {
        expect(classifyRowKind({ rule: 'CREDENTIALS / AWS-ACCESS-KEY', snippet: 'AKIA…' })).toBe('credentials');
        expect(classifyRowKind({ rule: 'FICTION KPI', snippet: 'completion_rate: 98.5' })).toBe('fiction-kpi');
        expect(classifyRowKind({ rule: 'SB-FICTION-002', snippet: '```javascript' })).toBe('llm-slop');
        expect(classifyRowKind({ rule: 'DEBUG_ARTIFACT', snippet: 'console.log(token)' })).toBe('debug-artifact');
    });

    test('builds business impact statements by kind', () => {
        expect(buildImpactRisk('credentials', 'critical')).toMatch(/CRITICAL RISK/i);
        expect(buildImpactRisk('fiction-kpi', 'medium')).toMatch(/HYGIENE RISK/i);
        expect(buildImpactRisk('production-leak', 'high')).toMatch(/HIGH RISK/i);
    });

    test('builds snippet-specific code recipes', () => {
        expect(buildCodeRecipe('debug-artifact', 'console.log(token);', 'DEBUG')).toMatch(/Remove the statement/i);
        expect(buildCodeRecipe('credentials', 'api_key = "sk-proj-123"', 'CRED')).toMatch(/process\.env/i);
        expect(buildCodeRecipe('dev-dependency', 'import pytest', 'IMPORT')).toMatch(/devDependencies/i);
    });

    test('enriches remediation rows with impact and recipe', () => {
        const row = enrichRemediationRow({
            severity: 'critical',
            location: 'server/config.js:42',
            rule: 'CREDENTIALS',
            snippet: 'AKIA…redacted…',
            remediation: 'Rotate key'
        });
        expect(row.impact).toMatch(/CRITICAL RISK/i);
        expect(row.recipe).toBeTruthy();
        expect(row.impactClass).toBe('impact-critical');
    });

    test('buildVerificationCommand prefers project path', () => {
        expect(buildVerificationCommand('')).toBe('npx simplebeacon scan --gate');
        expect(buildVerificationCommand('C:/Users/agency/acme-dashboard')).toMatch(/--path "C:\/Users\/agency\/acme-dashboard"/);
        expect(buildVerificationCommand('C:/Users/Trevor/CascadeProjects', {
            platformRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform'
        })).toBe('npx simplebeacon scan --path ./ai-platform --gate');
    });

    test('parseLocation extracts file and line', () => {
        expect(parseLocation('server/api/user.js:42')).toEqual({
            file: 'server/api/user.js',
            line: 42,
            column: null
        });
        expect(parseLocation('packages/foo.js')).toEqual({
            file: 'packages/foo.js',
            line: null,
            column: null
        });
    });

    test('buildFixSpec emits structured changes for credentials', () => {
        const fixSpec = buildFixSpec({
            severity: 'critical',
            location: 'server/config.js:12',
            rule: 'CREDENTIALS',
            snippet: 'const key = "sk_test_abc123"'
        });

        expect(fixSpec.version).toBe(FIX_SPEC_VERSION);
        expect(fixSpec.kind).toBe('credentials');
        expect(fixSpec.blocksGate).toBe(true);
        expect(fixSpec.autoFixConfidence).toBe('medium');
        expect(fixSpec.changes.some((c) => c.type === 'replace-line')).toBe(true);
        expect(fixSpec.changes.some((c) => c.type === 'add-env' && c.key === 'STRIPE_SECRET_KEY')).toBe(true);
    });

    test('buildStructuredChanges suggests delete for debugger', () => {
        const changes = buildStructuredChanges(
            'debug-artifact',
            'debugger;',
            'DEBUG',
            'server/app.js:99',
            null
        );
        expect(changes).toEqual([{
            type: 'delete-line',
            file: 'server/app.js',
            line: 99,
            before: 'debugger;'
        }]);
    });

    test('recipeFromFixSpec renders diff-style recipe text', () => {
        const fixSpec = buildFixSpec({
            severity: 'medium',
            location: 'server/app.js:10',
            rule: 'DEBUG',
            snippet: 'console.log(user.id);'
        });
        const recipe = recipeFromFixSpec(fixSpec);
        expect(recipe).toMatch(/Replace:/);
        expect(recipe).toMatch(/logger\.info/);
    });

    test('enrichRemediationRow attaches fixSpec without losing recipe', () => {
        const row = enrichRemediationRow({
            severity: 'medium',
            location: 'server/lib/simplebeacon-audit-payment.js:12',
            rule: 'eslint',
            snippet: "'sendAgencyPackOperatorEmail' is assigned a value but never used"
        });
        expect(row.kind).toBe('eslint');
        expect(row.fixSpec.blocksGate).toBe(false);
        expect(row.fixSpec.changes.some((c) => c.type === 'replace-line')).toBe(true);
        expect(row.recipe).toBeTruthy();
    });

    test('env-secret in .env.production blocks deploy gate', () => {
        const fixSpec = buildFixSpec({
            severity: 'high',
            location: 'ai-platform/.env.production:37',
            rule: 'env-secret',
            snippet: 'Potential secret pattern (stripe-key) in environment file'
        });
        expect(fixSpec.kind).toBe('env-secret');
        expect(fixSpec.blocksGate).toBe(true);
        expect(fixSpec.rotationSteps?.length).toBe(4);
    });

    test('handoff deliverables are non-blocking artifacts', () => {
        const fixSpec = buildFixSpec({
            severity: 'low',
            location: 'deliverables/vendor-handoff-2026-05-28/02-codebase-hygiene-AJ1JFI.html:270',
            rule: 'lorem',
            snippet: 'lorem ipsum'
        });
        expect(fixSpec.blocksGate).toBe(false);
        expect(fixSpec.artifactType).toBe('handoff-deliverable');
    });

    test('buildFixPlanFromScan includes data quality findings and summary', () => {
        const plan = buildFixPlanFromScan({
            projectRoot: '/repo',
            results: {
                simplebeacon: { rawIssues: [], gate: { pass: true } },
                codebase: { findings: [] },
                dataQuality: {
                    allFindings: [{
                        type: 'env-secret',
                        severity: 'high',
                        path: 'ai-platform/.env.production',
                        reason: 'Potential secret pattern (stripe-key)',
                        metadata: { line: 37 }
                    }, {
                        type: 'config-sprawl',
                        severity: 'medium',
                        path: 'ai-platform/.env',
                        reason: '11 environment files detected'
                    }]
                }
            },
            summary: { simplebeaconGatePass: true }
        }, { projectPath: '/repo' });

        expect(plan.fixCount).toBe(2);
        expect(plan.summary.gateBlockingCount).toBe(1);
        expect(plan.summary.hygieneCount).toBe(1);
        expect(plan.fixes[0].fixSpec.kind).toBe('env-secret');
        expect(plan.fixes[0].fixSpec.blocksGate).toBe(true);
    });

    test('buildFixPlanFromScan reads standalone simplebeacon-report exports', () => {
        const plan = buildFixPlanFromScan({
            type: 'simplebeacon-report',
            projectRoot: '/repo',
            gate: { pass: true },
            rawIssues: [],
            detectedIssues: []
        }, { projectPath: '/repo' });

        expect(plan.gatePass).toBe(true);
        expect(plan.fixCount).toBe(0);
    });

    test('buildFixPlanFromScan normalizes gate issues and codebase findings', () => {
        const plan = buildFixPlanFromScan({
            projectRoot: '/repo',
            issues: [{
                severity: 'high',
                filePath: 'server/config.js',
                line: 3,
                type: 'CREDENTIALS',
                snippet: 'api_key = "sk_test_123"'
            }],
            codebaseAnalysis: {
                findings: [{
                    severity: 'medium',
                    filePath: 'server/app.js',
                    line: 10,
                    tier: 'production',
                    category: 'debug-artifact',
                    match: 'console.log(token)'
                }]
            }
        }, { projectPath: '/repo' });

        expect(plan.version).toBe(FIX_SPEC_VERSION);
        expect(plan.fixCount).toBe(2);
        expect(plan.fixes[0].fixSpec.kind).toBe('credentials');
        expect(plan.fixes[1].fixSpec.kind).toBe('debug-artifact');
    });

    test('remediation rows stay scoped to requested github-cache clone', () => {
        const platformRoot = 'C:/Users/Trevor/CascadeProjects/ai-platform';
        const cloneRoot = `${platformRoot}/github-cache/rocm-therock`;
        const remediation = buildRemediationRowsFromScan({
            results: {
                simplebeacon: { gate: { pass: true }, issues: [] },
                codebase: {
                    findings: [
                        {
                            filePath: 'github-cache/rocm-therock/README.md',
                            category: 'tech-debt',
                            type: 'todo',
                            severity: 'medium'
                        },
                        {
                            filePath: 'github-cache/nvidia-garak/README.md',
                            category: 'tech-debt',
                            type: 'todo',
                            severity: 'medium'
                        }
                    ]
                }
            }
        }, {
            projectPath: cloneRoot,
            platformRoot
        });

        expect(remediation.rows).toHaveLength(1);
        expect(remediation.rows[0].location).toContain('rocm-therock');
        expect(remediation.rows[0].location).not.toContain('nvidia-garak');
    });
});
