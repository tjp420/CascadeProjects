// simplebeacon-ignore: Sample/demo data for dashboard preview — all findings are synthetic
/**
 * Sample CLI Report Generator
 *
 * Generates a realistic SimpleBeacon CLI JSON report with findings
 * across all severity levels (critical, high, medium, low) and all
 * 12 alert template rules. Used by the dashboard's "Download Sample
 * Report" button to let users preview the full widget experience
 * without needing to run a local scan.
 *
 * The sample report is deterministic — same output every time — so
 * tests can assert against it.
 *
 * Usage (browser ESM):
 *   import { generateSampleReport } from './sample-report.js';
 *   const report = generateSampleReport();
 *   // Upload to CliReportUploadZone or pass to CliMetricsWidget
 *
 * Usage (Node CJS):
 *   const { generateSampleReport } = require('./sample-report.cjs');
 */

/**
 * Generate a deterministic sample CLI report with varied findings.
 * @returns {object} A CLI JSON report matching the shape of `simplebeacon scan --format json`
 */
export function generateSampleReport() {
    const now = new Date().toISOString();
    const projectRoot = '/home/user/sample-project';

    const rawIssues = [
        // ═══ Critical (3 findings) ═══
        {
            id: 'SB-SEC-014-config/gcp-service-account.json',
            severity: 'critical',
            severityBand: 'critical',
            type: 'gcp-service-account',
            pattern: 'SB-SEC-014',
            filePath: 'config/gcp-service-account.json',
            file: 'config/gcp-service-account.json',
            line: 3,
            description: 'GCP service account key detected — private_key field contains a live RSA private key',
            confidence: 0.98,
            count: 1,
            affectedFiles: ['config/gcp-service-account.json'],
            metadata: { rule: 'SB-SEC-014', engine: 'security-pattern-scanner' }
        },
        {
            id: 'SB-SEC-015-config/azure-storage.env',
            severity: 'critical',
            severityBand: 'critical',
            type: 'azure-key',
            pattern: 'SB-SEC-015',
            filePath: 'config/azure-storage.env',
            file: 'config/azure-storage.env',
            line: 7,
            description: 'Azure storage account key detected — AccountKey parameter contains a hardcoded secret',
            confidence: 0.95,
            count: 1,
            affectedFiles: ['config/azure-storage.env'],
            metadata: { rule: 'SB-SEC-015', engine: 'security-pattern-scanner' }
        },
        {
            id: 'SB-SEC-009-.env',
            severity: 'critical',
            severityBand: 'critical',
            type: 'env-in-git',
            pattern: 'SB-SEC-009',
            filePath: '.env',
            file: '.env',
            line: 1,
            description: '.env file committed to repository — contains DATABASE_URL, JWT_SECRET, and STRIPE_API_KEY',
            confidence: 1.0,
            count: 1,
            affectedFiles: ['.env'],
            metadata: { rule: 'SB-SEC-009', engine: 'env-in-git-scanner' }
        },

        // ═══ High (4 findings) ═══
        {
            id: 'SB-SEC-016-src/auth/oauth-token.js',
            severity: 'high',
            severityBand: 'high',
            type: 'oauth-token',
            pattern: 'SB-SEC-016',
            filePath: 'src/auth/oauth-token.js',
            file: 'src/auth/oauth-token.js',
            line: 12,
            description: 'OAuth token hardcoded — ya29.* Google API token detected in source code',
            confidence: 0.92,
            count: 1,
            affectedFiles: ['src/auth/oauth-token.js'],
            metadata: { rule: 'SB-SEC-016', engine: 'security-pattern-scanner' }
        },
        {
            id: 'SB-SEC-017-Dockerfile',
            severity: 'high',
            severityBand: 'high',
            type: 'docker-privileged',
            pattern: 'SB-SEC-017',
            filePath: 'Dockerfile',
            file: 'Dockerfile',
            line: 15,
            description: 'Docker container configured to run in privileged mode — full host access granted',
            confidence: 1.0,
            count: 1,
            affectedFiles: ['Dockerfile'],
            metadata: { rule: 'SB-SEC-017', engine: 'security-pattern-scanner' }
        },
        {
            id: 'SB-SEC-021-package.json',
            severity: 'high',
            severityBand: 'high',
            type: 'suspicious-package',
            pattern: 'SB-SEC-021',
            filePath: 'package.json',
            file: 'package.json',
            line: 23,
            description: 'Suspicious npm package name detected — "expresss" appears to be a typosquat of "express"',
            confidence: 0.88,
            count: 1,
            affectedFiles: ['package.json'],
            metadata: { rule: 'SB-SEC-021', engine: 'security-pattern-scanner' }
        },
        {
            id: 'SB-SEC-022-package.json',
            severity: 'high',
            severityBand: 'high',
            type: 'malicious-postinstall',
            pattern: 'SB-SEC-022',
            filePath: 'package.json',
            file: 'package.json',
            line: 31,
            description: 'Malicious postinstall script detected — uses curl to download and execute remote code',
            confidence: 0.94,
            count: 1,
            affectedFiles: ['package.json'],
            metadata: { rule: 'SB-SEC-022', engine: 'security-pattern-scanner' }
        },

        // ═══ Medium (3 findings) ═══
        {
            id: 'SB-SEC-018-Dockerfile',
            severity: 'medium',
            severityBand: 'medium',
            type: 'docker-root-user',
            pattern: 'SB-SEC-018',
            filePath: 'Dockerfile',
            file: 'Dockerfile',
            line: 20,
            description: 'Docker container runs as root user — no USER directive specifies a non-root account',
            confidence: 1.0,
            count: 1,
            affectedFiles: ['Dockerfile'],
            metadata: { rule: 'SB-SEC-018', engine: 'security-pattern-scanner' }
        },
        {
            id: 'SB-SEC-023-package.json',
            severity: 'medium',
            severityBand: 'medium',
            type: 'unpinned-dependency',
            pattern: 'SB-SEC-023',
            filePath: 'package.json',
            file: 'package.json',
            line: 18,
            description: 'Unpinned dependency version — "axios" uses "^1.6.0" which can resolve to unexpected versions',
            confidence: 1.0,
            count: 1,
            affectedFiles: ['package.json'],
            metadata: { rule: 'SB-SEC-023', engine: 'security-pattern-scanner' }
        },
        {
            id: 'SB-FICTION-008-src/utils/helpers.js',
            severity: 'medium',
            severityBand: 'medium',
            type: 'boilerplate-comment',
            pattern: 'SB-FICTION-008',
            filePath: 'src/utils/helpers.js',
            file: 'src/utils/helpers.js',
            line: 1,
            description: 'Boilerplate LLM-generated comment detected — "This module provides utility functions for..."',
            confidence: 0.82,
            count: 1,
            affectedFiles: ['src/utils/helpers.js'],
            metadata: { rule: 'SB-FICTION-008', engine: 'llm-slop-scanner' }
        },

        // ═══ Low (2 findings) ═══
        {
            id: 'SB-SEC-020-Dockerfile',
            severity: 'low',
            severityBand: 'low',
            type: 'docker-no-healthcheck',
            pattern: 'SB-SEC-020',
            filePath: 'Dockerfile',
            file: 'Dockerfile',
            line: null,
            description:
                'Docker image missing HEALTHCHECK instruction — orchestrator cannot detect unhealthy containers',
            confidence: 1.0,
            count: 1,
            affectedFiles: ['Dockerfile'],
            metadata: { rule: 'SB-SEC-020', engine: 'security-pattern-scanner' }
        },
        {
            id: 'SB-SEC-007-src/config.js',
            severity: 'low',
            severityBand: 'low',
            type: 'hardcoded-url',
            pattern: 'SB-SEC-007',
            filePath: 'src/config.js',
            file: 'src/config.js',
            line: 5,
            description: 'Hardcoded URL detected — http://localhost:3000/api should use environment variable',
            confidence: 0.75,
            count: 1,
            affectedFiles: ['src/config.js'],
            metadata: { rule: 'SB-SEC-007', engine: 'hardcoded-url-scanner' }
        }
    ];

    const severityCounts = {
        critical: rawIssues.filter(i => i.severity === 'critical').length,
        high: rawIssues.filter(i => i.severity === 'high').length,
        medium: rawIssues.filter(i => i.severity === 'medium').length,
        low: rawIssues.filter(i => i.severity === 'low').length
    };

    const blockingIssues = rawIssues.filter(i => ['critical', 'high'].includes(i.severity));
    const warningIssues = rawIssues.filter(i => ['medium', 'low'].includes(i.severity));

    return {
        type: 'simplebeacon-scan',
        reportVersion: 2,
        scan_summary: {
            status: 'FAILED',
            block_merge: true
        },
        generatedAt: now,
        generatedBy: 'simplebeacon-cli v2.1.0 (sample report)',
        projectRoot,
        platformRoot: projectRoot,
        configPath: projectRoot + '/.simplebeacon/config.json',
        scanPaths: ['src', 'server', 'config', 'Dockerfile', 'package.json'],
        repositoryInventory: {
            totalFiles: 247,
            totalFolders: 28,
            projectRoot
        },
        mockSampleFiles: 3,
        totalFiles: 247,
        totalLines: 18450,
        ruleScopedFilesAnalyzed: 198,
        repositoryFilesTotal: 247,
        repositoryFoldersTotal: 28,
        filesAnalyzed: 198,
        totalSizeBytes: 2400000,
        totalSizeLabel: '2.4 MB',
        issueCount: rawIssues.length,
        invalidJson: 0,
        emptyFiles: 1,
        schemaChecked: 12,
        schemaPassed: 11,
        pageSampleSchemaChecked: 12,
        pageSampleSchemaPassed: 11,
        duplicateGroups: 2,
        roadmapSchemaChecked: 3,
        roadmapSchemaPassed: 3,
        consistencyChecked: 198,
        consistencyPassed: 196,
        fictionJsonFilesScanned: 15,
        fictionSampleFilesScanned: 8,
        fictionScope: 'web/data',
        credentialScanned: 198,
        credentialFindings: 3,
        productionLeakScanned: 198,
        productionLeakFindings: 1,
        productionLeakSuppressedIntent: 0,
        sourceCodeFilesScanned: 150,
        sourceFictionPatternHits: 1,
        llmSlopFilesScanned: 150,
        llmSlopPatternHits: 1,
        euAiActScanned: 150,
        euAiActFindings: 0,
        euAiActSummary: { status: 'pass', indicators: 0 },
        securityPatternFilesScanned: 198,
        securityPatternFindings: 8,
        hardcodedUrlFilesScanned: 150,
        hardcodedUrlFindings: 1,
        weakCryptoFilesScanned: 150,
        weakCryptoFindings: 0,
        secretInCommentsFilesScanned: 150,
        secretInCommentsFindings: 0,
        syncIoFilesScanned: 150,
        syncIoFindings: 0,
        envInGitFilesScanned: 198,
        envInGitFindings: 1,
        redosFilesScanned: 150,
        redosFindings: 0,
        piiLoggingFilesScanned: 150,
        piiLoggingFindings: 0,
        deadCodeFilesScanned: 150,
        deadCodeFindings: 0,
        memoryLeakFilesScanned: 150,
        memoryLeakFindings: 0,
        typeSafetyFilesScanned: 150,
        typeSafetyFindings: 0,
        hallucinatedImportFilesScanned: 150,
        hallucinatedImportFindings: 0,
        astStructuralFilesScanned: 150,
        astStructuralFindings: 0,
        astAvailable: true,
        dependencyGraphFilesScanned: 150,
        dependencyGraphFindings: 0,
        jestBaselineChecked: true,
        jestBaselinePassed: true,
        jestSummary: { passed: 142, failed: 0, skipped: 3 },
        severityCounts,
        mockDataCategories: {
            duplicateKpis: 2,
            staleSamples: 1
        },
        compliance: {
            checked: true,
            passed: false,
            checklist: [
                { check: 'no-hardcoded-credentials', status: 'fail' },
                { check: 'no-env-in-git', status: 'fail' },
                { check: 'npm-no-critical-high', status: 'pass' }
            ]
        },
        detectedIssues: rawIssues,
        rawIssues,
        benchmarkCacheIssues: [],
        sampleFiles: ['web/data/dashboard-sample.json', 'web/data/metrics-sample.json'],
        scanScope: {
            paths: ['src', 'server', 'config'],
            fullDirectoryScan: false
        },
        gate: {
            pass: false,
            failOn: ['critical', 'high'],
            warnOn: ['medium', 'low'],
            blockingCount: blockingIssues.length,
            warningCount: warningIssues.length,
            blockingIssues,
            warningIssues,
            allIssues: warningIssues,
            status: 'BLOCKED',
            severityColor: '#EF4444',
            summary: `Gate blocked — ${blockingIssues.length} blocking issue${blockingIssues.length === 1 ? '' : 's'} detected. Review before release.`,
            blockingFindings: blockingIssues.map(i => ({
                severity: i.severity,
                type: i.type,
                count: 1,
                filePath: i.filePath
            })),
            remediation: [
                'Rotate exposed GCP and Azure keys immediately',
                'Remove .env from git history using BFG Repo-Cleaner',
                'Revoke hardcoded OAuth token on Google Cloud Console'
            ]
        },
        scanErrors: [],
        ruleTimings: [
            { rule: 'credential-scanner', elapsedMs: 1200 },
            { rule: 'security-pattern-scanner', elapsedMs: 850 },
            { rule: 'llm-slop-scanner', elapsedMs: 420 },
            { rule: 'env-in-git-scanner', elapsedMs: 180 },
            { rule: 'hardcoded-url-scanner', elapsedMs: 95 }
        ],
        slowestRule: { rule: 'credential-scanner', ms: 1200 },
        totalScanTimeMs: 2745,
        totalScanDurationMs: 2.75,
        tierLimitation: null,
        qualityScoreHidden: false,
        tier: 'developer',
        sandbox: {},
        consolidation: { duplicateGroups: 2, potentialSavings: '12 KB' },
        codebase: {
            totalFiles: 247,
            totalLines: 18450,
            languages: { javascript: 180, typescript: 15, json: 12, other: 40 }
        },
        dataQuality: { invalidJsonCount: 0, emptyJsonCount: 1, duplicateGroups: 2 },
        cleanup: { debugArtifacts: 0, mockFiles: 3 },
        fileReduction: { removableFiles: 8, potentialReduction: '340 KB' },
        npmAudit: { packageJsonCount: 1, dependencyCount: 47, summary: '1 package.json with 47 dependencies.' },
        roadmap: { todoCount: 5, milestones: 3 },
        mockData: { categories: 2, files: 3 },
        euAiAct: { aiSystemIndicators: 0, scanned: 150 },
        dependencyAudit: { totalDeps: 47, vulnerabilities: { critical: 0, high: 0, moderate: 2, low: 1 } },
        buildReadiness: {
            score: 72,
            missingCritical: [],
            missingRecommended: ['CHANGELOG.md', '.dockerignore'],
            summary: 'NEEDS WORK — 2 recommended files missing.'
        },
        remediationPhases: [
            {
                id: 'integrity',
                title: 'Phase 1: Data Integrity',
                severity: 'high',
                effort: '2-4 days',
                tasks: [
                    { description: 'Rotate 3 exposed credentials', type: 'fix', done: false },
                    { description: 'Add .env to .gitignore', type: 'fix', done: false },
                    { description: 'Revoke OAuth token', type: 'fix', done: false }
                ],
                progress: 0,
                status: 'pending'
            },
            {
                id: 'security',
                title: 'Phase 2: Security Hardening',
                severity: 'high',
                effort: '3-5 days',
                tasks: [
                    { description: 'Remove privileged mode from Dockerfile', type: 'fix', done: false },
                    { description: 'Add non-root USER to Dockerfile', type: 'fix', done: false },
                    { description: 'Remove suspicious package "expresss"', type: 'fix', done: false },
                    { description: 'Remove malicious postinstall script', type: 'fix', done: false }
                ],
                progress: 0,
                status: 'pending'
            }
        ],
        fileInventory: {
            sourceCode: 180,
            markup: 5,
            config: 12,
            docs: 8,
            buildArtifacts: 2,
            testFixtures: 35,
            other: 5
        },
        removableFiles: [
            { path: 'node_modules/.cache/', reason: 'Build cache' },
            { path: 'dist/bundle.min.js', reason: 'Generated build artifact' },
            { path: 'coverage/', reason: 'Test coverage report' }
        ],
        removableFilesTotal: 8,
        diagnosticReport: {
            rawFiles: 247,
            filteredFiles: 198,
            scanErrors: 0
        },
        qualityScorecard: {
            accuracy: 70,
            completeness: 100,
            consistency: 90,
            timeliness: 100,
            validity: 72,
            integrity: 70
        },
        summary: {
            gatePass: false,
            qualityScore: 72,
            totalFiles: 247,
            totalLines: 18450
        },
        sanitized: false,
        sanitizedAt: null
    };
}
