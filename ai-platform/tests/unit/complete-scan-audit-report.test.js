const {
    buildCompleteAuditModel,
    normalizeCompleteScanInput,
    renderCompleteAuditHtml,
    dedupeFindings,
    enrichFindings,
    buildLaunchReadiness,
    buildDeterministicExecutive,
    mergeExecutiveSummary,
    normalizeSimplebeaconForCompliance,
    isProductionCodePath,
    calculateAuditConfidence,
    buildCleanScanRemediationMessage,
    buildExecutivePriorities,
    buildSampleAuditReportHtml,
    buildSampleAuditReportModel
} = require('../../server/lib/complete-scan-audit-report');
const { buildComplianceTable } = require('../../packages/simplebeacon-cli/src/reporters/audit-report');

describe('complete scan audit report', () => {
    test('dedupes repeated codebase findings', () => {
        const findings = dedupeFindings([
            { filePath: 'a.js', line: 1, type: 'todo', category: 'tech-debt', description: 'TODO marker' },
            { filePath: 'a.js', line: 1, type: 'todo', category: 'tech-debt', description: 'TODO marker' }
        ]);
        expect(findings).toHaveLength(1);
    });

    test('dedupes equivalent stub wording on the same line', () => {
        const findings = dedupeFindings([
            { filePath: 'docs/plan.md', line: 7, category: 'tech-debt', description: 'Not implemented stub in docs/plan.md' },
            { filePath: 'docs/plan.md', line: 7, category: 'tech-debt', description: 'Stub / not implemented marker in docs/plan.md' }
        ]);
        expect(findings).toHaveLength(1);
    });

    test('separates production and documentation tier findings', () => {
        const enriched = enrichFindings([
            { filePath: 'server/index.js', line: 1, severity: 'medium', category: 'tech-debt', description: 'TODO' },
            { filePath: 'docs/plan.md', line: 2, severity: 'medium', category: 'tech-debt', description: 'TODO' }
        ]);
        expect(enriched.find((f) => f.filePath === 'server/index.js').tier).toBe('production');
        expect(enriched.find((f) => f.filePath === 'docs/plan.md').tier).toBe('documentation');
        expect(isProductionCodePath('server/index.js')).toBe(true);
        expect(isProductionCodePath('docs/plan.md')).toBe(false);
    });

    test('launch readiness is conditional when gate pass but production findings exist', () => {
        const model = buildCompleteAuditModel({
            projectPath: 'C:\\Projects\\demo',
            results: {
                simplebeacon: { gate: { pass: true }, issueCount: 0, rawIssues: [] },
                codebase: {
                    summary: { healthScore: 88, findingsTotal: 100, codeFilesAnalyzed: 100 },
                    findings: [
                        { filePath: 'server/app.js', line: 1, severity: 'medium', category: 'tech-debt', description: 'TODO' }
                    ]
                }
            }
        });
        expect(model.summary.gatePass).toBe(true);
        expect(model.summary.productionFindings).toBe(1);
        expect(model.readiness.tone).toBe('conditional');
        expect(model.readiness.label).toMatch(/Ready with conditions/i);
    });

    test('launch readiness is ready when gate pass and no production findings', () => {
        const model = buildCompleteAuditModel({
            projectPath: 'C:\\Projects\\demo',
            results: {
                simplebeacon: { gate: { pass: true }, issueCount: 0, rawIssues: [] },
                codebase: {
                    summary: {
                        healthScore: 88,
                        findingsTotal: 51,
                        tierCounts: { production: 0, documentation: 51, general: 0 }
                    },
                    findings: [
                        { filePath: 'docs/plan.md', line: 2, severity: 'medium', category: 'tech-debt', description: 'TODO' }
                    ]
                }
            }
        });
        expect(model.summary.productionFindings).toBe(0);
        expect(model.readiness.tone).toBe('ready');
    });

    test('fills compliance scan counts when slim payload omitted credentialScanned', () => {
        const normalized = normalizeSimplebeaconForCompliance({
            gate: { pass: true },
            credentialFindings: 0,
            productionLeakFindings: 0,
            ruleScopedFilesAnalyzed: 3780
        });
        const table = buildComplianceTable(normalized, null, 'C:\\Projects\\demo');
        expect(table).toContain('3780');
        expect(table).not.toContain('Scanned 0 path(s)');
    });

    test('rejects placeholder AI priorities in favor of deterministic actions', () => {
        const deterministic = buildDeterministicExecutive({
            projectPath: 'C:\\Projects\\demo',
            readiness: { score: 92, label: 'Gate clear — maintain CI enforcement' },
            summary: {
                gatePass: true,
                simplebeaconIssues: 0,
                productionFindings: 0,
                documentationFindings: 51,
                codebaseHealth: 88,
                severityCounts: { high: 0, medium: 0, low: 0 },
                codeSeverity: { high: 0, medium: 51, low: 0 },
                codeFilesAnalyzed: 4460,
                codeFilesDiscovered: 4513,
                ruleScopedFiles: 3780
            }
        });
        const merged = mergeExecutiveSummary(deterministic, {
            intro: 'Gate passed with zero production-path blockers; documentation markers remain informational.',
            businessImpact: 'Client handoff can proceed once CI gate enforcement is documented.',
            headline: 'Lock in Simplebeacon gate on pull requests before release.',
            priorities: ['priority 1', 'priority 2', 'priority 3'],
            verdict: 'Ready with conditions'
        });
        expect(merged.priorities.join(' ')).not.toMatch(/priority 1/i);
        expect(merged.priorities[0]).toMatch(/Zero production-path issues/i);
        expect(merged.verdict).toMatch(/Gate clear/i);
    });

    test('clean scan section 03 shows hygiene context instead of empty placeholder', () => {
        const message = buildCleanScanRemediationMessage({
            productionFindings: 0,
            documentationFindings: 69,
            generalFindings: 12,
            codebaseHealth: 88,
            codeFilesAnalyzed: 584
        });
        expect(message).toMatch(/No production-path issues detected/i);
        expect(message).toMatch(/69 documentation-tier/i);
        expect(message).not.toMatch(/requiring remediation under this audit profile/i);

        const model = buildCompleteAuditModel({
            projectPath: 'C:\\Projects\\demo',
            results: {
                simplebeacon: { gate: { pass: true }, issueCount: 0, rawIssues: [], ruleScopedFilesAnalyzed: 0 },
                codebase: {
                    summary: {
                        healthScore: 88,
                        tierCounts: { production: 0, documentation: 69, general: 12 },
                        codeFilesAnalyzed: 584
                    },
                    findings: []
                }
            }
        });
        const html = renderCompleteAuditHtml(model);
        expect(html).toContain('No production-path issues detected');
        expect(html).toContain('configure production paths in simplebeacon.config.json');
        expect(html).toContain('audit confidence');
    });

    test('confidence score penalizes missing gate rule coverage', () => {
        const withGate = calculateAuditConfidence({
            gatePass: true,
            ruleScopedFiles: 3780,
            codebaseHealth: 88,
            codeFilesAnalyzed: 4460
        }, { schemaChecked: 45, schemaPassed: 45 });
        const withoutGate = calculateAuditConfidence({
            gatePass: true,
            ruleScopedFiles: 0,
            codebaseHealth: 88,
            codeFilesAnalyzed: 584
        });
        expect(withGate).toBeGreaterThan(withoutGate);
        expect(withoutGate).toBe(85);
    });

    test('builds audit model for cleanup-assistant-only scans without simplebeacon gate', () => {
        const model = buildCompleteAuditModel({
            type: 'simplebeacon-complete-scan',
            projectPath: 'C:\\Projects\\demo',
            results: {
                cleanupAssistant: {
                    estimatedReduction: { files: 0, bytes: 0 },
                    tiers: { safeNow: { files: 0, bytes: 0, directories: [] } }
                },
                fileReduction: {
                    summary: { totalFindings: 10060, reclaimableBytes: 8426665 },
                    fileReductionPlan: { totals: { reclaimableBytes: 8426665 } }
                },
                dataQuality: {
                    summary: { totalFindings: 517 }
                }
            }
        }, { client: 'Cleanup scan' });

        expect(model.summary.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(model.summary.gatePass).toBeNull();
        expect(model.markdown.compliance).toContain('Gate scan not included');

        const html = renderCompleteAuditHtml(model);
        expect(html).toContain('SB-AUD-');
        expect(html).toContain('Cleanup scan');
    });

    test('accepts flat data-cleanup-report payloads without results wrapper', () => {
        const model = buildCompleteAuditModel({
            type: 'data-cleanup-report',
            scanProfile: 'data-quality',
            projectRoot: 'C:\\Projects\\demo',
            inventory: { totalFiles: 35027, totalDirectories: 4110 },
            summary: { totalFindings: 432 },
            executiveSummary: {
                data: { orphanedDataFiles: 178 },
                priorityActions: [{ title: 'Align environment values' }]
            }
        }, { client: 'Data quality only' });

        expect(model.summary.repositoryFiles).toBe(35027);
        expect(model.summary.dataQualityFindings).toBe(432);
        expect(model.summary.gatePass).toBeNull();
    });

    test('executive priorities are context-specific for clean production scans', () => {
        const priorities = buildExecutivePriorities({
            gatePass: true,
            productionFindings: 0,
            documentationFindings: 69,
            codebaseHealth: 88,
            codeFilesAnalyzed: 584,
            ruleScopedFiles: 0,
            severityCounts: { high: 0, medium: 0, low: 0 }
        });
        expect(priorities[0]).toMatch(/Zero production-path issues/i);
        expect(priorities[2]).toMatch(/Configure gate rules/i);
    });

    test('tooling paths are not production-tier for client audit', () => {
        const enriched = enrichFindings([
            { filePath: 'packages/simplebeacon-cli/publish.ps1', line: 5, severity: 'medium', category: 'debug-artifact', description: 'Script debug output' },
            { filePath: 'packages/simplebeacon-cli/src/reporters/build-report.js', line: 41, severity: 'medium', category: 'debug-artifact', description: 'console.log' },
            { filePath: 'server/test-gateway.js', line: 90, severity: 'medium', category: 'debug-artifact', description: 'console.log' },
            { filePath: 'src/ai-system/agent.py', line: 37, severity: 'high', category: 'tech-debt', description: 'mock_' },
            { filePath: 'server/index.js', line: 1, severity: 'medium', category: 'tech-debt', description: 'TODO' }
        ]);
        expect(enriched.find((f) => f.filePath.includes('publish.ps1')).tier).toBe('general');
        expect(enriched.find((f) => f.filePath.includes('reporters/build-report.js')).tier).toBe('general');
        expect(enriched.find((f) => f.filePath === 'server/test-gateway.js').tier).toBe('general');
        expect(enriched.find((f) => f.filePath === 'src/ai-system/agent.py').tier).toBe('general');
        expect(enriched.find((f) => f.filePath === 'server/index.js').tier).toBe('production');
    });

    test('renders premium HTML with report ID and readiness score', () => {
        const model = buildCompleteAuditModel({
            type: 'simplebeacon-complete-scan',
            projectPath: 'C:\\Projects\\demo',
            generatedAt: '2026-05-26T12:00:00.000Z',
            results: {
                simplebeacon: {
                    gate: { pass: true },
                    issueCount: 0,
                    qualityScore: 100,
                    repositoryFilesTotal: 43421,
                    ruleScopedFilesAnalyzed: 3780,
                    credentialScanned: 555,
                    productionLeakScanned: 531,
                    credentialFindings: 0,
                    productionLeakFindings: 0,
                    rawIssues: [],
                    scanScope: { limitations: ['Gate rules checked 3780 files.'] }
                },
                codebase: {
                    summary: {
                        healthScore: 88,
                        findingsTotal: 51,
                        tierCounts: { production: 0, documentation: 51, general: 0 },
                        codeFilesAnalyzed: 4460,
                        codeFilesDiscovered: 4513,
                        severityCounts: { high: 0, medium: 27, low: 24 }
                    },
                    findings: [
                        {
                            severity: 'medium',
                            category: 'tech-debt',
                            type: 'todo',
                            filePath: 'docs/plan.md',
                            line: 10,
                            description: 'TODO marker',
                            recommendedAction: 'Resolve or ticket the marker'
                        }
                    ],
                    scanScope: { limitations: ['Complete scan profile.'] }
                }
            }
        }, { client: 'Acme Corp' });

        const html = renderCompleteAuditHtml(model);
        expect(html).toContain('SB-AUD-');
        expect(html).toContain('Acme Corp');
        expect(html).toContain('READINESS');
        expect(html).toContain('Audit Metadata &amp; Ledger');
        expect(html).toContain('Executive Dashboard (CFO View)');
        expect(html).toContain('Developer Action Plan (Technical Recipe Book)');
        expect(html).toContain('Why it breaks (impact)');
        expect(html).toContain('Safe code fix recipe');
        expect(html).toContain('Local verification before re-submit');
        expect(html).toContain('production compliance sign-off');
        expect(html).toContain('STAGE 2: Zero-dependency re-scan executed');
        expect(html).toContain('Compliance &amp; Git Gate Recommendations');
        expect(html).toContain('Overall gate result');
        expect(html).toContain('npx simplebeacon hook install');
        expect(html).toContain('Independent disclaimer');
        expect(html).toContain('555');
        expect(html).toContain('audit confidence');
        expect(html).not.toContain('10000');
        expect(html).not.toContain('priority 1');
        expect(html).not.toContain('Scanned 0 path(s)');
        expect(html).not.toContain('Risk assessment matrix');
    });

    test('sample marketing report uses the same premium template as paid PDF deliverables', () => {
        const model = buildSampleAuditReportModel();
        expect(model.reportId).toBe('SB-AUD-2026-SAMPLE');
        expect(model.summary.gatePass).toBe(false);

        const html = buildSampleAuditReportHtml({ siteChrome: true });
        expect(html).toContain('cover-page');
        expect(html).toContain('SB-AUD-2026-SAMPLE');
        expect(html).toContain('Digital Build Agency LLC');
        expect(html).toContain('Executive Dashboard (CFO View)');
        expect(html).toContain('Developer Action Plan (Technical Recipe Book)');
        expect(html).toContain('Sample deliverable only');
        expect(html).toContain('GATE FAIL');

        const pdfHtml = buildSampleAuditReportHtml({ siteChrome: false });
        expect(pdfHtml).not.toContain('Sample deliverable only');
        expect(pdfHtml).toContain('color-scheme: dark');
        expect(pdfHtml).toContain('--bg: #0d1117');
        expect(pdfHtml).not.toContain('--ink: #0b1220');
        expect(pdfHtml).not.toContain('background: #fff; font-size: 11pt');
        expect(pdfHtml).toContain('.data-table td { background: var(--bg-elevated)');
        expect(pdfHtml).toContain('CRITICAL RISK');
        expect(pdfHtml).toContain('npx simplebeacon scan --path');
    });
});
