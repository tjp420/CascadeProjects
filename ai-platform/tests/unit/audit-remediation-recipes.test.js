const {
    classifyRowKind,
    buildImpactRisk,
    buildCodeRecipe,
    buildVerificationCommand,
    enrichRemediationRow
} = require('../../server/lib/audit-remediation-recipes');

describe('audit remediation recipes', () => {
    test('classifies credential and fiction rows', () => {
        expect(classifyRowKind({ rule: 'CREDENTIALS / AWS-ACCESS-KEY', snippet: 'AKIA…' })).toBe('credentials');
        expect(classifyRowKind({ rule: 'FICTION KPI', snippet: 'completion_rate: 98.5' })).toBe('fiction-kpi');
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
        expect(buildVerificationCommand('')).toBe('npx simplebeacon scan --path ./src --gate');
        expect(buildVerificationCommand('C:/Users/agency/acme-dashboard')).toMatch(/npx simplebeacon scan --path \.\//);
        expect(buildVerificationCommand('C:/Users/agency/acme-dashboard')).toMatch(/--gate$/);
    });
});
