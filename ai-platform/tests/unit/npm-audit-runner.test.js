const { parseNpmAuditJson } = require('../../server/lib/npm-audit-runner');
const { mergeNpmAuditIntoSecurityModel } = require('../../server/lib/security-dashboard-builder');

describe('npm audit runner', () => {
    test('parseNpmAuditJson maps audit report vulnerabilities', () => {
        const raw = {
            auditReportVersion: 2,
            metadata: {
                vulnerabilities: {
                    info: 0,
                    low: 1,
                    moderate: 2,
                    high: 1,
                    critical: 1,
                    total: 5
                },
                dependencies: {
                    prod: 100,
                    dev: 862,
                    total: 962
                }
            },
            vulnerabilities: {
                lodash: {
                    name: 'lodash',
                    severity: 'high',
                    isDirect: false,
                    via: [
                        {
                            source: 123,
                            name: 'lodash',
                            title: 'Prototype Pollution',
                            url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
                            severity: 'high'
                        }
                    ],
                    fixAvailable: true
                },
                express: {
                    name: 'express',
                    severity: 'critical',
                    isDirect: true,
                    via: ['4.18.0'],
                    fixAvailable: false
                }
            }
        };

        const parsed = parseNpmAuditJson(raw);

        expect(parsed.summary.total).toBe(5);
        expect(parsed.summary.dependencies).toBe(962);
        expect(parsed.summary.vulnerabilityTotal).toBe(5);
        expect(parsed.dependencies.total).toBe(962);
        expect(parsed.vulnerabilities).toHaveLength(2);
        expect(parsed.vulnerabilities[0].component).toBe('express');
        expect(parsed.vulnerabilities[0].severity).toBe('critical');
        expect(parsed.vulnerabilities[0].source).toBe('npm-audit');
        expect(parsed.vulnerabilities[1].title).toBe('Prototype Pollution');
        expect(parsed.vulnerabilities[1].cve).toBe('GHSA-xxxx-yyyy-zzzz');
    });

    test('parseNpmAuditJson defaults missing metadata totals', () => {
        const parsed = parseNpmAuditJson({
            vulnerabilities: {
                minimist: {
                    severity: 'moderate',
                    via: [
                        {
                            title: 'Prototype Pollution',
                            url: 'https://github.com/advisories/GHSA-vh95-rmgr-6w4m'
                        }
                    ],
                    isDirect: true
                }
            }
        });

        expect(parsed.summary.total).toBe(1);
        expect(parsed.summary.vulnerabilityTotal).toBe(1);
        expect(parsed.vulnerabilities[0].component).toBe('minimist');
        expect(parsed.vulnerabilities[0].cve).toBe('GHSA-vh95-rmgr-6w4m');
    });
});

describe('security dashboard builder', () => {
    test('mergeNpmAuditIntoSecurityModel counts open critical vulnerabilities', () => {
        const merged = mergeNpmAuditIntoSecurityModel({
            overview: { securityScore: 72 },
            vulnerabilities: [
                { id: 'SEC-001', severity: 'medium', status: 'open' },
                { id: 'SEC-004', severity: 'medium', status: 'resolved' }
            ],
            threats: [],
            incidents: [],
            compliance: { overall: 72 },
            insights: []
        }, {
            summary: { total: 2, critical: 1, high: 1, moderate: 0, low: 0 },
            vulnerabilities: [
                { id: 'NPM-express', severity: 'critical', status: 'open', source: 'npm-audit', component: 'express' },
                { id: 'NPM-lodash', severity: 'high', status: 'open', source: 'npm-audit', component: 'lodash' }
            ]
        });

        expect(merged.overview.criticalVulnerabilities).toBe(1);
        expect(merged.overview.openVulnerabilities).toBe(2);
        expect(merged.overview.openEngineeringFindings).toBe(1);
        expect(merged.vulnerabilities.some((item) => item.id === 'NPM-express')).toBe(true);
        expect(merged.vulnerabilities.find((item) => item.id === 'SEC-004')?.status).toBe('resolved');
    });
});
