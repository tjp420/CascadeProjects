'use strict';

/**
 * Tests for High-Risk Finding Alert Templates
 *
 * Tests cover:
 * - ALERT_TEMPLATES: structure and completeness of all 12 templates
 * - getAlertTemplate: lookup by rule ID
 * - enrichFindingWithAlert: attaching templates to findings
 * - enrichFindingsWithAlerts: batch enrichment
 * - formatAlertMarkdown: markdown formatting for CLI text output
 * - getAllAlertTemplates: sorted list of all templates
 * - getAlertsBySeverity: filtering by severity
 *
 * Run: node --test tests/test-alert-templates.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    ALERT_TEMPLATES,
    getAlertTemplate,
    enrichFindingWithAlert,
    enrichFindingsWithAlerts,
    formatAlertMarkdown,
    getAllAlertTemplates,
    getAlertsBySeverity
} = require('../packages/simplebeacon-cli/src/reporters/alert-templates');

// ═══════════════════════════════════════════════
// Expected rule IDs and their severities
// ═══════════════════════════════════════════════

const EXPECTED_RULES = {
    'SB-SEC-014': 'critical',  // GCP Service Account Key
    'SB-SEC-015': 'critical',  // Azure Storage Key
    'SB-SEC-016': 'high',      // OAuth Token
    'SB-SEC-017': 'high',      // Docker Privileged
    'SB-SEC-018': 'medium',    // Docker Root User
    'SB-SEC-019': 'critical',  // Docker ENV Secret
    'SB-SEC-020': 'low',       // Docker Health Check
    'SB-SEC-021': 'high',      // Suspicious Package
    'SB-SEC-022': 'high',      // Malicious postinstall
    'SB-SEC-023': 'medium',    // Unpinned Dependency
    'SB-SEC-009': 'critical',  // .env Committed
    'SB-SEC-013': 'critical',  // CI/CD Secret
};

const REQUIRED_TEMPLATE_FIELDS = [
    'title', 'severity', 'summary', 'impact',
    'immediateAction', 'remediationSteps', 'preventionGuidance',
    'references', 'rotationRequired'
];

// ═══════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════

describe('ALERT_TEMPLATES structure', () => {

    test('has all 12 expected rule IDs', () => {
        const ruleIds = Object.keys(ALERT_TEMPLATES);
        assert.equal(ruleIds.length, 12, `Expected 12 templates, got ${ruleIds.length}`);
        for (const expectedId of Object.keys(EXPECTED_RULES)) {
            assert.ok(ALERT_TEMPLATES[expectedId], `Missing template for ${expectedId}`);
        }
    });

    test('each template has all required fields', () => {
        for (const [ruleId, template] of Object.entries(ALERT_TEMPLATES)) {
            for (const field of REQUIRED_TEMPLATE_FIELDS) {
                assert.ok(template[field] !== undefined,
                    `${ruleId} missing required field: ${field}`);
            }
        }
    });

    test('each template has correct severity', () => {
        for (const [ruleId, expectedSeverity] of Object.entries(EXPECTED_RULES)) {
            assert.equal(ALERT_TEMPLATES[ruleId].severity, expectedSeverity,
                `${ruleId} should have severity "${expectedSeverity}"`);
        }
    });

    test('remediationSteps is a non-empty array for each template', () => {
        for (const [ruleId, template] of Object.entries(ALERT_TEMPLATES)) {
            assert.ok(Array.isArray(template.remediationSteps),
                `${ruleId}: remediationSteps must be an array`);
            assert.ok(template.remediationSteps.length > 0,
                `${ruleId}: remediationSteps must not be empty`);
        }
    });

    test('references is a non-empty array for each template', () => {
        for (const [ruleId, template] of Object.entries(ALERT_TEMPLATES)) {
            assert.ok(Array.isArray(template.references),
                `${ruleId}: references must be an array`);
            assert.ok(template.references.length > 0,
                `${ruleId}: references must not be empty`);
        }
    });

    test('rotationRequired is boolean for each template', () => {
        for (const [ruleId, template] of Object.entries(ALERT_TEMPLATES)) {
            assert.equal(typeof template.rotationRequired, 'boolean',
                `${ruleId}: rotationRequired must be boolean`);
        }
    });

    test('critical severity templates all require rotation', () => {
        for (const [ruleId, template] of Object.entries(ALERT_TEMPLATES)) {
            if (template.severity === 'critical') {
                assert.equal(template.rotationRequired, true,
                    `${ruleId}: critical severity should require rotation`);
            }
        }
    });

    test('cwe field is present for security rules', () => {
        for (const [ruleId, template] of Object.entries(ALERT_TEMPLATES)) {
            if (ruleId !== 'SB-SEC-020') {  // Health check has no CWE
                assert.ok(template.cwe,
                    `${ruleId}: should have a CWE identifier`);
            }
        }
    });
});

describe('getAlertTemplate', () => {

    test('returns template for valid rule ID', () => {
        const template = getAlertTemplate('SB-SEC-014');
        assert.ok(template);
        assert.equal(template.title, 'GCP Service Account Key Exposed');
    });

    test('returns null for unknown rule ID', () => {
        const template = getAlertTemplate('SB-SEC-999');
        assert.equal(template, null);
    });

    test('returns null for null input', () => {
        const template = getAlertTemplate(null);
        assert.equal(template, null);
    });

    test('returns null for undefined input', () => {
        const template = getAlertTemplate(undefined);
        assert.equal(template, null);
    });
});

describe('enrichFindingWithAlert', () => {

    test('enriches a finding with matching rule ID via pattern field', () => {
        const finding = {
            severity: 'critical',
            type: 'gcp-service-account',
            pattern: 'SB-SEC-014',
            filePath: 'config/gcp.json',
            description: 'GCP key detected'
        };
        const enriched = enrichFindingWithAlert(finding);
        assert.ok(enriched.alertTemplate);
        assert.equal(enriched.alertTemplate.title, 'GCP Service Account Key Exposed');
        assert.equal(enriched.alertTemplate.severity, 'critical');
        assert.ok(enriched.alertTemplate.remediationSteps.length > 0);
    });

    test('enriches a finding with matching rule ID via id field', () => {
        const finding = {
            id: 'SB-SEC-015-config/azure.env',
            severity: 'critical',
            type: 'azure-key',
            filePath: 'config/azure.env',
            description: 'Azure key detected'
        };
        const enriched = enrichFindingWithAlert(finding);
        assert.ok(enriched.alertTemplate);
        assert.equal(enriched.alertTemplate.title, 'Azure Storage Key Exposed');
    });

    test('returns finding unchanged when no template matches', () => {
        const finding = {
            severity: 'low',
            type: 'unknown-rule',
            pattern: 'SB-UNKNOWN-001',
            filePath: 'test.js',
            description: 'Unknown issue'
        };
        const enriched = enrichFindingWithAlert(finding);
        assert.equal(enriched.alertTemplate, undefined);
        assert.equal(enriched.severity, 'low');
        assert.equal(enriched.type, 'unknown-rule');
    });

    test('preserves original finding fields', () => {
        const finding = {
            severity: 'high',
            type: 'docker-privileged',
            pattern: 'SB-SEC-017',
            filePath: 'Dockerfile',
            description: 'Privileged mode',
            customField: 'custom value'
        };
        const enriched = enrichFindingWithAlert(finding);
        assert.equal(enriched.severity, 'high');
        assert.equal(enriched.type, 'docker-privileged');
        assert.equal(enriched.filePath, 'Dockerfile');
        assert.equal(enriched.description, 'Privileged mode');
        assert.equal(enriched.customField, 'custom value');
    });

    test('handles null finding gracefully', () => {
        const enriched = enrichFindingWithAlert(null);
        assert.equal(enriched, null);
    });
});

describe('enrichFindingsWithAlerts', () => {

    test('enriches an array of findings', () => {
        const findings = [
            { pattern: 'SB-SEC-014', severity: 'critical', type: 'gcp', filePath: 'a.json', description: 'GCP' },
            { pattern: 'SB-SEC-017', severity: 'high', type: 'docker', filePath: 'Dockerfile', description: 'Docker' },
            { pattern: 'SB-UNKNOWN', severity: 'low', type: 'unknown', filePath: 'b.js', description: 'Unknown' },
        ];
        const enriched = enrichFindingsWithAlerts(findings);
        assert.equal(enriched.length, 3);
        assert.ok(enriched[0].alertTemplate, 'First finding should have alert template');
        assert.ok(enriched[1].alertTemplate, 'Second finding should have alert template');
        assert.equal(enriched[2].alertTemplate, undefined, 'Third finding should not have alert template');
    });

    test('returns empty array for null input', () => {
        const enriched = enrichFindingsWithAlerts(null);
        assert.deepEqual(enriched, []);
    });

    test('returns empty array for undefined input', () => {
        const enriched = enrichFindingsWithAlerts(undefined);
        assert.deepEqual(enriched, []);
    });

    test('returns empty array for non-array input', () => {
        const enriched = enrichFindingsWithAlerts('not an array');
        assert.deepEqual(enriched, []);
    });

    test('handles empty array', () => {
        const enriched = enrichFindingsWithAlerts([]);
        assert.deepEqual(enriched, []);
    });

    test('enriches all 12 known rule IDs', () => {
        const findings = Object.keys(EXPECTED_RULES).map(ruleId => ({
            pattern: ruleId,
            severity: EXPECTED_RULES[ruleId],
            type: 'test',
            filePath: 'test.js',
            description: 'Test'
        }));
        const enriched = enrichFindingsWithAlerts(findings);
        for (const f of enriched) {
            assert.ok(f.alertTemplate, `${f.pattern} should have alert template`);
        }
    });
});

describe('formatAlertMarkdown', () => {

    test('formats a finding with alert template as markdown', () => {
        const finding = enrichFindingWithAlert({
            pattern: 'SB-SEC-014',
            severity: 'critical',
            type: 'gcp',
            filePath: 'config/gcp.json',
            description: 'GCP key'
        });
        const md = formatAlertMarkdown(finding);
        assert.ok(md.includes('### GCP Service Account Key Exposed'));
        assert.ok(md.includes('**Severity:** CRITICAL'));
        assert.ok(md.includes('**Impact:**'));
        assert.ok(md.includes('**Immediate Action:**'));
        assert.ok(md.includes('**Remediation Steps:**'));
        assert.ok(md.includes('1.'));
        assert.ok(md.includes('**References:**'));
    });

    test('includes rotation warning when rotationRequired is true', () => {
        const finding = enrichFindingWithAlert({
            pattern: 'SB-SEC-014',
            severity: 'critical',
            type: 'gcp',
            filePath: 'a.json',
            description: 'GCP'
        });
        const md = formatAlertMarkdown(finding);
        assert.ok(md.includes('Rotate exposed secrets'));
    });

    test('includes CWE when present', () => {
        const finding = enrichFindingWithAlert({
            pattern: 'SB-SEC-014',
            severity: 'critical',
            type: 'gcp',
            filePath: 'a.json',
            description: 'GCP'
        });
        const md = formatAlertMarkdown(finding);
        assert.ok(md.includes('CWE-798'));
    });

    test('returns empty string for finding without alert template', () => {
        const md = formatAlertMarkdown({ severity: 'low', type: 'unknown' });
        assert.equal(md, '');
    });
});

describe('getAllAlertTemplates', () => {

    test('returns all 12 templates sorted by severity', () => {
        const all = getAllAlertTemplates();
        assert.equal(all.length, 12);
        // Critical should come first
        assert.equal(all[0].severity, 'critical');
        // Low should come last
        assert.equal(all[all.length - 1].severity, 'low');
    });

    test('includes ruleId in each template', () => {
        const all = getAllAlertTemplates();
        for (const t of all) {
            assert.ok(t.ruleId, 'Each template should have ruleId');
        }
    });
});

describe('getAlertsBySeverity', () => {

    test('returns only critical templates', () => {
        const critical = getAlertsBySeverity('critical');
        assert.ok(critical.length > 0);
        for (const t of critical) {
            assert.equal(t.severity, 'critical');
        }
    });

    test('returns only high templates', () => {
        const high = getAlertsBySeverity('high');
        assert.ok(high.length > 0);
        for (const t of high) {
            assert.equal(t.severity, 'high');
        }
    });

    test('returns only medium templates', () => {
        const medium = getAlertsBySeverity('medium');
        assert.ok(medium.length > 0);
        for (const t of medium) {
            assert.equal(t.severity, 'medium');
        }
    });

    test('returns only low templates', () => {
        const low = getAlertsBySeverity('low');
        assert.ok(low.length > 0);
        for (const t of low) {
            assert.equal(t.severity, 'low');
        }
    });

    test('returns empty array for unknown severity', () => {
        const unknown = getAlertsBySeverity('unknown');
        assert.deepEqual(unknown, []);
    });
});

describe('Integration with CLI report findings', () => {

    test('enriches realistic CLI findings with alert templates', () => {
        const cliFindings = [
            {
                id: 'SB-SEC-014-config/gcp.json',
                severity: 'critical',
                type: 'gcp-service-account',
                pattern: 'SB-SEC-014',
                filePath: 'config/gcp.json',
                file: 'config/gcp.json',
                line: 5,
                description: 'GCP service account key detected',
                confidence: 0.95
            },
            {
                id: 'SB-SEC-017-Dockerfile',
                severity: 'high',
                type: 'docker-privileged',
                pattern: 'SB-SEC-017',
                filePath: 'Dockerfile',
                file: 'Dockerfile',
                line: 10,
                description: 'Container running in privileged mode'
            },
            {
                id: 'SB-SEC-023-package.json',
                severity: 'medium',
                type: 'unpinned-dependency',
                pattern: 'SB-SEC-023',
                filePath: 'package.json',
                file: 'package.json',
                line: 12,
                description: 'Unpinned dependency version'
            }
        ];

        const enriched = enrichFindingsWithAlerts(cliFindings);

        // All three should have alert templates
        assert.ok(enriched[0].alertTemplate, 'GCP finding should have alert template');
        assert.ok(enriched[1].alertTemplate, 'Docker finding should have alert template');
        assert.ok(enriched[2].alertTemplate, 'Unpinned dep finding should have alert template');

        // Verify specific template content
        assert.equal(enriched[0].alertTemplate.title, 'GCP Service Account Key Exposed');
        assert.equal(enriched[0].alertTemplate.rotationRequired, true);
        assert.equal(enriched[1].alertTemplate.title, 'Docker Container Running in Privileged Mode');
        assert.equal(enriched[1].alertTemplate.rotationRequired, false);
        assert.equal(enriched[2].alertTemplate.title, 'Unpinned Dependency Version');
        assert.equal(enriched[2].alertTemplate.rotationRequired, false);
    });

    test('alert templates are JSON-serializable', () => {
        const all = getAllAlertTemplates();
        assert.doesNotThrow(() => JSON.stringify(all));
    });
});
