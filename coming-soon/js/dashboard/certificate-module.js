// Defensive: ensure escapeHtml is available even if utils.js fails to load
if (typeof window !== 'undefined' && !window.escapeHtml) {
    window.escapeHtml = function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
}

// ============================================================================
// ZIP Markdown Template Schema — drives uniform module report generation
// ============================================================================
const ZIP_MARKDOWN_TEMPLATES = [
    { moduleId: '17', section: 'aiResidue', title: 'AI Residue', metricLabel: 'AI Residue Hits', advice: 'Review stubs, deprecated APIs, error swallowing, and dead code blocks before production.', filename: 'ai-residue.md' },
    { moduleId: '18', section: 'performance', title: 'Performance', metricLabel: 'Performance Hits', advice: 'Review nested loops, leaked event listeners, and inefficient regex patterns.', filename: 'performance.md' },
    { moduleId: '19', section: 'typeSafety', title: 'Type Safety', metricLabel: 'Type Safety Hits', advice: 'Replace `any` types, add PropTypes, and reduce excessive parameters.', filename: 'type-safety.md' },
    { moduleId: '20', section: 'documentation', title: 'Documentation', metricLabel: 'Documentation Gaps', advice: 'Add JSDoc to public functions and keep README in sync with code changes.', filename: 'documentation.md' },
    { moduleId: '21', section: 'testCoverage', title: 'Test Coverage', metricLabel: 'Test Coverage Gaps', advice: 'Ensure all production code has active test coverage; remove or fix skipped tests.', filename: 'test-coverage.md' },
    { moduleId: '22', section: 'accessibility', title: 'Accessibility', metricLabel: 'Accessibility Gaps', advice: 'Add alt text to images, label all inputs, and ensure buttons have accessible names.', filename: 'accessibility.md' },
    { moduleId: '23', section: 'i18n', title: 'i18n Readiness', metricLabel: 'i18n Issues', advice: 'Wrap UI strings with i18n functions and use locale-aware formatting.', filename: 'i18n.md' },
    { moduleId: '24', section: 'sensitiveData', title: 'Sensitive Data Exposure', metricLabel: 'Sensitive Data Hits', advice: 'Remove PII from logs and source code; never store tokens or passwords in localStorage.', filename: 'sensitive-data.md' },
    { moduleId: '25', section: 'configDrift', title: 'Configuration Drift', metricLabel: 'Config Drift Hits', advice: 'Move secrets to environment variables; avoid committing .env files to version control.', filename: 'config-drift.md' },
    { moduleId: '26', section: 'securityHeaders', title: 'Security Headers', metricLabel: 'Security Header References', advice: 'Verify CSP, X-Frame-Options, HSTS, and Referrer-Policy are configured on all responses.', filename: 'security-headers.md' },
    { moduleId: '27', section: 'databasePatterns', title: 'Database Patterns', metricLabel: 'Database Anti-Patterns', advice: 'Use parameterized queries, add pagination, and ensure transactions have rollback.', filename: 'database-patterns.md' },
    { moduleId: '28', section: 'frameworkPractices', title: 'Framework Practices', metricLabel: 'Framework Issues', advice: 'Fix React hook dependency arrays, avoid direct DOM access, and clean up subscriptions.', filename: 'framework-practices.md' },
    { moduleId: '29', section: 'workspaceHealth', title: 'Workspace Health', metricLabel: 'Workspace Issues', advice: 'Review circular imports and ensure dependency versions are consistent across packages.', filename: 'workspace-health.md' },
    { moduleId: '30', section: 'unusedDeps', title: 'Unused Dependencies', metricLabel: 'Unused Dependency Flags', advice: 'Cross-reference package.json against source imports to remove unused packages.', filename: 'unused-deps.md' },
    { moduleId: '31', section: 'apiContract', title: 'API Contract', metricLabel: 'API Contract Drifts', advice: 'Verify all REST endpoints have frontend consumers and OpenAPI specs are current.', filename: 'api-contract.md' },
    { moduleId: '32', section: 'complexity', title: 'Complexity Metrics', metricLabel: 'High Complexity Patterns', advice: 'Break down long functions, reduce nesting depth, and extract helper functions.', filename: 'complexity.md' },
    { moduleId: '33', section: 'llmSlop', title: 'LLM Slop', metricLabel: 'LLM Slop Patterns', advice: 'Remove placeholder debris, leaked markdown fences, and hardcoded AI-default metrics.', filename: 'llm-slop.md' },
    { moduleId: '34', section: 'tokenBleed', title: 'Token Bleed', metricLabel: 'Token Bleed Risks', advice: 'Add max_tokens limits to LLM calls and chunk long string literals in prompts.', filename: 'token-bleed.md' },
    { moduleId: '35', section: 'productionLeak', title: 'Production Data Leak', metricLabel: 'Production Data Leaks', advice: 'Remove mock, fixture, and sample data path references from production source.', filename: 'production-leak.md' },
    { moduleId: '36', section: 'fictionKpi', title: 'Fiction KPI', metricLabel: 'Fiction KPI Hits', advice: 'Replace hardcoded metrics with real data sources or remove unverified KPI values.', filename: 'fiction-kpi.md' },
    { moduleId: '37', section: 'architectureDrift', title: 'Architecture Drift', metricLabel: 'Architecture Drift Findings', advice: 'Add schema validators for hybrid/state-space models and enforce max_tokens on all LLM API calls.', filename: 'architecture-drift.md' },
    { moduleId: '38', section: 'fixPreview', title: 'Fix Preview', metricLabel: 'Fix Patches Available', advice: 'Review generated code diffs and apply copyable patches for each remediation task.', filename: 'fix-preview.md' },
    { moduleId: '39', section: 'syncIo', title: 'Sync I/O', metricLabel: 'Sync I/O Patterns', advice: 'Replace synchronous fs operations with async equivalents to avoid blocking the event loop.', filename: 'sync-io.md' },
    { moduleId: '40', section: 'evalDanger', title: 'Eval Danger', metricLabel: 'Eval Risks', advice: 'Avoid eval() and new Function(). Use JSON.parse or safe expression evaluators instead.', filename: 'eval-danger.md' },
    { moduleId: '41', section: 'innerHtmlXss', title: 'innerHTML XSS', metricLabel: 'innerHTML XSS Risks', advice: 'Sanitize all innerHTML assignments. Use textContent or DOMPurify instead.', filename: 'inner-html-xss.md' },
    { moduleId: '42', section: 'prototypePollution', title: 'Prototype Pollution', metricLabel: 'Prototype Pollution Risks', advice: 'Avoid modifying Object.prototype or __proto__. Use Object.create(null) or Map.', filename: 'prototype-pollution.md' },
    { moduleId: '43', section: 'unhandledPromise', title: 'Unhandled Promise', metricLabel: 'Unhandled Promises', advice: 'Add .catch() handlers to all promise chains to prevent unhandled rejections.', filename: 'unhandled-promise.md' },
    { moduleId: '44', section: 'magicNumber', title: 'Magic Numbers', metricLabel: 'Magic Numbers', advice: 'Extract hardcoded numeric literals into named constants.', filename: 'magic-number.md' },
    { moduleId: '45', section: 'missingStrictMode', title: 'Missing Strict Mode', metricLabel: 'Missing Strict Mode Files', advice: "Add 'use strict' to the top of each file to prevent implicit globals.", filename: 'missing-strict-mode.md' },
    { moduleId: '46', section: 'uninitializedRead', title: 'Uninitialized Read', metricLabel: 'Uninitialized Reads', advice: 'Initialize variables at declaration to avoid reading undefined values.', filename: 'uninitialized-read.md' },
    { moduleId: '47', section: 'unvalidatedRedirect', title: 'Unvalidated Redirect', metricLabel: 'Unvalidated Redirects', advice: 'Whitelist redirect destinations and validate all user-controlled URLs.', filename: 'unvalidated-redirect.md' },
    { moduleId: '48', section: 'missingRateLimit', title: 'Missing Rate Limit', metricLabel: 'Missing Rate Limits', advice: 'Add rate limiting to all API endpoints to prevent DoS attacks.', filename: 'missing-rate-limit.md' },
    { moduleId: '49', section: 'insecureRandom', title: 'Insecure Random', metricLabel: 'Insecure Random Uses', advice: 'Replace Math.random() with crypto.randomBytes() for security-sensitive operations.', filename: 'insecure-random.md' },
    { moduleId: '50', section: 'loggingSecrets', title: 'Logging Secrets', metricLabel: 'Secret Log Leaks', advice: 'Remove passwords, tokens, and secrets from log statements.', filename: 'logging-secrets.md' },
    { moduleId: '51', section: 'hardcodedConfidence', title: 'Hardcoded Confidence', metricLabel: 'Hardcoded Confidence Scores', advice: 'Replace static confidence scores with dynamic computed values.', filename: 'hardcoded-confidence.md' },
    { moduleId: '52', section: 'hardcodedCompletion', title: 'Hardcoded Completion', metricLabel: 'Hardcoded Completion Rates', advice: 'Replace static completion rates with real-time metrics.', filename: 'hardcoded-completion.md' },
    { moduleId: '53', section: 'mockPathLeak', title: 'Mock Path Leak', metricLabel: 'Mock Path Leaks', advice: 'Remove mock and fixture path references from production source code.', filename: 'mock-path-leak.md' },
    { moduleId: '54', section: 'sampleJsonRef', title: 'Sample JSON Reference', metricLabel: 'Sample JSON References', advice: 'Replace sample JSON file references with production data sources.', filename: 'sample-json-ref.md' },
    { moduleId: '55', section: 'governanceMarker', title: 'Governance Marker', metricLabel: 'Governance Markers', advice: 'Verify license compatibility with your product distribution model.', filename: 'governance-marker.md' },
    { moduleId: '56', section: 'aiPlaceholderComment', title: 'AI Placeholder Comment', metricLabel: 'AI Placeholder Comments', advice: 'Replace AI-generated placeholder comments with actual implementation.', filename: 'ai-placeholder-comment.md' },
    { moduleId: '57', section: 'aiPlaceholderBlock', title: 'AI Placeholder Block', metricLabel: 'AI Placeholder Blocks', advice: 'Remove or implement AI-generated placeholder block comments.', filename: 'ai-placeholder-block.md' },
    { moduleId: '58', section: 'markdownFenceLeak', title: 'Markdown Fence Leak', metricLabel: 'Markdown Fence Leaks', advice: 'Remove markdown code fences (```) that leaked into source files.', filename: 'markdown-fence-leak.md' },
    { moduleId: '59', section: 'emptyStubFunction', title: 'Empty Stub Function', metricLabel: 'Empty Stub Functions', advice: 'Implement empty function bodies or remove unused stubs.', filename: 'empty-stub-function.md' },
    { moduleId: '60', section: 'arrowStub', title: 'Arrow Stub', metricLabel: 'Arrow Function Stubs', advice: 'Implement arrow functions that return empty objects.', filename: 'arrow-stub.md' },
    { moduleId: '61', section: 'roadmapMarker', title: 'Roadmap Marker', metricLabel: 'Roadmap Markers', advice: 'Resolve HACK, XXX, and WORKAROUND markers or track them in your issue tracker.', filename: 'roadmap-marker.md' },
    { moduleId: '62', section: 'fileNaming', title: 'File Naming', metricLabel: 'File Naming Issues', advice: 'Standardize naming conventions, remove spaces/special chars, and use descriptive names for data files.', filename: 'file-naming.md' },
    { moduleId: '63', section: 'removableFiles', title: 'Removable Files', metricLabel: 'Removable Files', advice: 'Remove node_modules, build artifacts, caches, logs, and temp files. Add .gitignore entries to prevent recurrence.', filename: 'removable-files.md' }
];

function fmtCertBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateZipModuleMarkdown(zip, allowedModules, filteredReport, projectName, dateStr, template) {
    if (!allowedModules.includes(template.moduleId)) return;
    let data = filteredReport[template.section] || {};
    let hits = Number(data[`${template.section}Hits`]) || 0;
    let rawList = data[`${template.section}Findings`];
    // Fallback for alternate structure (e.g. architectureDrift: { count, findings })
    if (!hits && data.count != null) hits = Number(data.count) || 0;
    if (!Array.isArray(rawList) && Array.isArray(data.findings)) rawList = data.findings;
    // Fallback for direct findings array on report (e.g. syncIoFindings)
    if (!hits && !Array.isArray(rawList)) {
        const directFindings = filteredReport[`${template.section}Findings`];
        if (Array.isArray(directFindings)) {
            rawList = directFindings;
            hits = directFindings.length;
        }
    }
    // Special handling for removableFiles (categories instead of findings)
    if (template.section === 'removableFiles') {
        const cats = (data.categories || []).filter(c => c.removable);
        hits = data.totalRemovable || 0;
        const catMd = cats.length ? `## Removable Categories\n\n${cats.map(c => `- **${c.label}**: ${c.count.toLocaleString()} files${c.bytes ? ' (' + fmtCertBytes(c.bytes) + ')' : ''}\n  - Action: ${c.action}\n  - Examples: ${c.examples.slice(0, 3).join(', ') || 'N/A'}`).join('\n\n')}\n` : '';
        const md = `# ${template.title} Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Total Files Scanned | ${data.totalFiles || 0} |\n| Removable Files | ${hits} |\n| Estimated Savings | ${data.totalRemovableFormatted || '0 B'} |\n\n${catMd}> ${template.advice}\n`;
        zip.file(template.filename, md);
        return;
    }
    const list = Array.isArray(rawList) ? rawList.slice(0, 10) : [];
    const findingsMd = list.length ? `## Findings\n\n${list.map(f => `- ${f.file || 'N/A'} (${f.type || 'N/A'})`).join('\n')}\n` : '';
    const md = `# ${template.title} Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| ${template.metricLabel} | ${hits} |\n\n${findingsMd}> ${template.advice}\n`;
    zip.file(template.filename, md);
}

async function generateSovereignCertificate(report, token, options = {}) {
    if (!window.JSZip || !window.html2canvas) {
        throw new Error('Certificate libraries not loaded. Check your network connection.');
    }
    if (false) { /* token optional for certificate generation */
        throw new Error('Invalid or malformed license token. Please paste a valid token.');
    }
    if (!report || typeof report !== 'object' || Object.keys(report).length === 0) {
        throw new Error('Report data is missing or empty. Run a scan first.');
    }

    const zip = new JSZip();
    const now = new Date();
    const certId = 'SB-' + crypto.getRandomValues(new Uint32Array(1))[0];
    const dateStr = now.toLocaleDateString();
    const isoDate = now.toISOString();
    const defaultProjectName = report.projectName || report.projectRoot || report.projectPath || 'Untitled Project';
    const projectName = options.projectName || defaultProjectName;
    const profileLabelOverride = options.profileLabel || '';
    const signatoryName = options.signatoryName || 'SimpleBeacon';
    const signatoryTitle = options.signatoryTitle || 'Automated Compliance Engine';
    const contactEmail = options.contactEmail || 'contact@simplebeacon.ai';
    const fileCount = report.filesAnalyzed || report.totalFiles || report.fileCount || 0;
    const lineCount = report.totalLines || report.linesOfCode || 0;
    const gateReport = report.gateReport || report.gate || {};
    const issueCount = (gateReport.blockingIssues || []).length + (gateReport.warningIssues || []).length;
    const qs = Number.isFinite(report.qualityScore) ? report.qualityScore : (report.qualityScore || 0);
    let grade = 'F';
    let gradeColor = '#EF4444';
    if (qs >= 95) { grade = 'A'; gradeColor = '#34D399'; }
    else if (qs >= 85) { grade = 'B'; gradeColor = '#60A5FA'; }
    else if (qs >= 70) { grade = 'C'; gradeColor = '#F59E0B'; }
    else if (qs >= 50) { grade = 'D'; gradeColor = '#F97316'; }

    const gatePassed = report.gate?.pass === true || report.gate?.status === 'PASS';
    // Sync summary.gatePass so downstream consumers see consistent state
    if (report.summary && typeof report.summary === 'object') {
        report.summary.gatePass = gatePassed;
    }
    const gateLabel = gatePassed ? 'PASS' : (report.gate?.blockingCount ? 'BLOCKED' : 'REVIEW');
    const gateColor = gatePassed ? '#34D399' : '#EF4444';
    const profileLabel = profileLabelOverride || (window._tokenPayload?.tier || window._tokenPayload?.product || 'executive').toUpperCase();

    // Map UI module IDs (from analyzer dropdown) to certificate numeric module IDs
    const UI_TO_CERT_MODULE = {
        'gate': '1', 'consolidation': '2', 'mock-data': '3', 'roadmap': '4',
        'codebase': '5', 'file-reduction': '6', 'data-quality': '7', 'cleanup': '8',
        'npm-audit': '9', 'compliance': '10', 'eu-ai-act': '11', 'dependency-vulns': '12',
        'build-readiness': '13', 'ai-indicators': '14', 'governance': '15', 'junk-files': '16', 'ai-residue': '17',
        'performance': '18', 'type-safety': '19', 'documentation': '20', 'test-coverage': '21', 'accessibility': '22',
        'i18n': '23', 'sensitive-data': '24', 'config-drift': '25', 'security-headers': '26', 'database-patterns': '27',
        'framework-practices': '28', 'workspace-health': '29', 'unused-deps': '30', 'api-contract': '31', 'complexity': '32',
        'llm-slop': '33', 'token-bleed': '34', 'production-leak': '35', 'fiction-kpi': '36', 'architecture-drift': '37',
        'fix-preview': '38', 'sync-io': '39', 'eval-danger': '40', 'inner-html-xss': '41', 'prototype-pollution': '42',
        'unhandled-promise': '43', 'magic-number': '44', 'missing-strict-mode': '45', 'uninitialized-read': '46',
        'unvalidated-redirect': '47', 'missing-rate-limit': '48', 'insecure-random': '49', 'logging-secrets': '50',
        'hardcoded-confidence': '51', 'hardcoded-completion': '52', 'mock-path-leak': '53', 'sample-json-ref': '54',
        'governance-marker': '55', 'ai-placeholder-comment': '56', 'ai-placeholder-block': '57', 'markdown-fence-leak': '58',
        'empty-stub-function': '59', 'arrow-stub': '60', 'roadmap-marker': '61'
    };
    // Read selected modules from the analyzer card grid (global selectedModules Set)
    let allowedModules = [];
    if (typeof selectedModules !== 'undefined' && selectedModules instanceof Set && selectedModules.size > 0) {
        allowedModules = Array.from(selectedModules).map(id => UI_TO_CERT_MODULE[id]).filter(Boolean);
    }
    // Always enforce tier-based unlocking — intersect with what the user actually paid for
    const paidModules = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61'].filter(m => isModulePaidFor(m));
    if (allowedModules.length > 0) {
        allowedModules = allowedModules.filter(m => paidModules.includes(m));
    } else {
        allowedModules = paidModules;
    }
    // Safety net: never generate an empty module list — fall back to all modules
    if (!allowedModules.length) {
        allowedModules = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61'];
    }

    const moduleKeyMap = {
        '1': ['gateReport', 'gate'],
        '2': ['consolidation'],
        '3': ['mockDataCategories', 'mockSampleFiles'],
        '4': ['roadmap', 'remediationPhases'],
        '5': ['codebase'],
        '6': ['fileReduction'],
        '7': ['dataQuality'],
        '8': ['cleanup'],
        '9': ['npmAudit'],
        '10': ['compliance'],
        '11': ['euAiActSummary', 'checkEuAi'],
        '12': ['dependencyAudit', 'vulnerabilityAudit'],
        '13': ['buildReadiness'],
        '14': ['aiIndicators'],
        '15': ['governance', 'compliance'],
        '16': ['junkFiles'],
        '17': ['aiResidue', 'aiResidueFindings'],
        '18': ['performance', 'performanceFindings'],
        '19': ['typeSafety', 'typeSafetyFindings'],
        '20': ['documentation', 'documentationFindings'],
        '21': ['testCoverage', 'testCoverageFindings'],
        '22': ['accessibility', 'accessibilityFindings'],
        '23': ['i18n', 'i18nFindings'],
        '24': ['sensitiveData', 'sensitiveDataFindings'],
        '25': ['configDrift', 'configDriftFindings'],
        '26': ['securityHeaders', 'securityHeadersFindings'],
        '27': ['databasePatterns', 'databasePatternsFindings'],
        '28': ['frameworkPractices', 'frameworkPracticesFindings'],
        '29': ['workspaceHealth', 'workspaceHealthFindings'],
        '30': ['unusedDeps', 'unusedDepsFindings'],
        '31': ['apiContract', 'apiContractFindings'],
        '32': ['complexity', 'complexityFindings'],
        '33': ['llmSlop', 'llmSlopFindings'],
        '34': ['tokenBleed', 'tokenBleedFindings'],
        '35': ['productionLeak', 'productionLeakFindings'],
        '36': ['fictionKpi', 'fictionKpiFindings'],
        '37': ['architectureDrift', 'architectureDriftFindings'],
        '38': ['fixPreview'],
        '39': ['syncIo', 'syncIoFindings'],
        '40': ['evalDanger', 'evalDangerFindings'],
        '41': ['innerHtmlXss', 'innerHtmlXssFindings'],
        '42': ['prototypePollution', 'prototypePollutionFindings'],
        '43': ['unhandledPromise', 'unhandledPromiseFindings'],
        '44': ['magicNumber', 'magicNumberFindings'],
        '45': ['missingStrictMode', 'missingStrictModeFindings'],
        '46': ['uninitializedRead', 'uninitializedReadFindings'],
        '47': ['unvalidatedRedirect', 'unvalidatedRedirectFindings'],
        '48': ['missingRateLimit', 'missingRateLimitFindings'],
        '49': ['insecureRandom', 'insecureRandomFindings'],
        '50': ['loggingSecrets', 'loggingSecretsFindings'],
        '51': ['hardcodedConfidence', 'hardcodedConfidenceFindings'],
        '52': ['hardcodedCompletion', 'hardcodedCompletionFindings'],
        '53': ['mockPathLeak', 'mockPathLeakFindings'],
        '54': ['sampleJsonRef', 'sampleJsonRefFindings'],
        '55': ['governanceMarker', 'governanceMarkerFindings'],
        '56': ['aiPlaceholderComment', 'aiPlaceholderCommentFindings'],
        '57': ['aiPlaceholderBlock', 'aiPlaceholderBlockFindings'],
        '58': ['markdownFenceLeak', 'markdownFenceLeakFindings'],
        '59': ['emptyStubFunction', 'emptyStubFunctionFindings'],
        '60': ['arrowStub', 'arrowStubFindings'],
        '61': ['roadmapMarker', 'roadmapMarkerFindings']
    };
    const baseKeys = [
        'type', 'reportVersion', 'version', 'generatedAt', 'generatedBy', 'scanProfileLabel',
        'projectName', 'projectRoot', 'projectPath', 'scanTargetRoot', 'platformRoot',
        'filesAnalyzed', 'totalFiles', 'fileCount', 'fileList', 'repositoryInventory',
        'totalLines', 'linesOfCode', 'qualityScore', 'schemaCompliance', 'consistencyScore',
        'duplicateGroups', 'invalidJson', 'emptyFiles', 'schemaChecked', 'schemaPassed',
        'issues', 'issueCount', 'simplebeaconIssues', 'detectedIssues', 'severityCounts',
        'gate', 'gateReport', 'summary',
        'timestamp', 'metadata', 'totalModules', 'exportType',
        'euAiActFindings', 'euAiActScanned',
        'aiContext'
    ];

    const perModuleData = {
        '1': { gateReport: report.gateReport, gate: report.gate },
        '2': { consolidation: report.consolidation },
        '3': { mockDataCategories: report.mockDataCategories, mockSampleFiles: report.mockSampleFiles },
        '4': { roadmap: report.roadmap, remediationPhases: report.remediationPhases },
        '5': { codebase: report.codebase || { totalFiles: report.filesAnalyzed || 0, totalLines: report.totalLines || 0 } },
        '6': { fileReduction: report.fileReduction },
        '7': { dataQuality: report.dataQuality },
        '8': { cleanup: report.cleanup },
        '9': { npmAudit: report.npmAudit },
        '10': { compliance: report.compliance },
        '11': { euAiActSummary: report.euAiActSummary, checkEuAi: report.checkEuAi, euAiActFindings: report.euAiActFindings, euAiActScanned: report.euAiActScanned },
        '12': { dependencyAudit: report.dependencyAudit, vulnerabilityAudit: report.vulnerabilityAudit },
        '13': { buildReadiness: report.buildReadiness },
        '14': { aiIndicators: report.aiIndicators },
        '15': { governance: report.governance, compliance: report.compliance },
        '16': { junkFiles: report.junkFiles },
        '17': { aiResidue: report.aiResidue },
        '18': { performance: report.performance },
        '19': { typeSafety: report.typeSafety },
        '20': { documentation: report.documentation },
        '21': { testCoverage: report.testCoverage },
        '22': { accessibility: report.accessibility },
        '23': { i18n: report.i18n },
        '24': { sensitiveData: report.sensitiveData },
        '25': { configDrift: report.configDrift },
        '26': { securityHeaders: report.securityHeaders },
        '27': { databasePatterns: report.databasePatterns },
        '28': { frameworkPractices: report.frameworkPractices },
        '29': { workspaceHealth: report.workspaceHealth },
        '30': { unusedDeps: report.unusedDeps },
        '31': { apiContract: report.apiContract },
        '32': { complexity: report.complexity },
        '33': { llmSlop: report.llmSlop },
        '34': { tokenBleed: report.tokenBleed },
        '35': { productionLeak: report.productionLeak },
        '36': { fictionKpi: report.fictionKpi },
        '37': { architectureDrift: report.architectureDrift },
        '38': { fixPreview: report.fixPreview || { _note: 'Fix Preview provides copyable code patches for each remediation task. Open the dashboard to view interactive diffs.' } },
        '39': { syncIo: report.syncIo, syncIoFindings: report.syncIoFindings },
        '40': { evalDanger: report.evalDanger, evalDangerFindings: report.evalDangerFindings },
        '41': { innerHtmlXss: report.innerHtmlXss, innerHtmlXssFindings: report.innerHtmlXssFindings },
        '42': { prototypePollution: report.prototypePollution, prototypePollutionFindings: report.prototypePollutionFindings },
        '43': { unhandledPromise: report.unhandledPromise, unhandledPromiseFindings: report.unhandledPromiseFindings },
        '44': { magicNumber: report.magicNumber, magicNumberFindings: report.magicNumberFindings },
        '45': { missingStrictMode: report.missingStrictMode, missingStrictModeFindings: report.missingStrictModeFindings },
        '46': { uninitializedRead: report.uninitializedRead, uninitializedReadFindings: report.uninitializedReadFindings },
        '47': { unvalidatedRedirect: report.unvalidatedRedirect, unvalidatedRedirectFindings: report.unvalidatedRedirectFindings },
        '48': { missingRateLimit: report.missingRateLimit, missingRateLimitFindings: report.missingRateLimitFindings },
        '49': { insecureRandom: report.insecureRandom, insecureRandomFindings: report.insecureRandomFindings },
        '50': { loggingSecrets: report.loggingSecrets, loggingSecretsFindings: report.loggingSecretsFindings },
        '51': { hardcodedConfidence: report.hardcodedConfidence, hardcodedConfidenceFindings: report.hardcodedConfidenceFindings },
        '52': { hardcodedCompletion: report.hardcodedCompletion, hardcodedCompletionFindings: report.hardcodedCompletionFindings },
        '53': { mockPathLeak: report.mockPathLeak, mockPathLeakFindings: report.mockPathLeakFindings },
        '54': { sampleJsonRef: report.sampleJsonRef, sampleJsonRefFindings: report.sampleJsonRefFindings },
        '55': { governanceMarker: report.governanceMarker, governanceMarkerFindings: report.governanceMarkerFindings },
        '56': { aiPlaceholderComment: report.aiPlaceholderComment, aiPlaceholderCommentFindings: report.aiPlaceholderCommentFindings },
        '57': { aiPlaceholderBlock: report.aiPlaceholderBlock, aiPlaceholderBlockFindings: report.aiPlaceholderBlockFindings },
        '58': { markdownFenceLeak: report.markdownFenceLeak, markdownFenceLeakFindings: report.markdownFenceLeakFindings },
        '59': { emptyStubFunction: report.emptyStubFunction, emptyStubFunctionFindings: report.emptyStubFunctionFindings },
        '60': { arrowStub: report.arrowStub, arrowStubFindings: report.arrowStubFindings },
        '61': { roadmapMarker: report.roadmapMarker, roadmapMarkerFindings: report.roadmapMarkerFindings }
    };

    // Safety net: derive analyzer sections from detectedIssues when buildAnalyzerSections data is missing
    function deriveAnalyzerSectionsFromDetectedIssues(detectedIssues) {
        if (!Array.isArray(detectedIssues) || detectedIssues.length === 0) return {};
        const typeToSection = {
            'Debug Artifact': 'aiResidue',
            'License/Governance Marker': 'governanceMarker',
            'Architecture Drift': 'architectureDrift',
            'Maintainability Issue': 'magicNumber',
            'AI Residue': 'aiResidue',
            'Performance Anti-Pattern': 'performance',
            'Type Safety Gap': 'typeSafety',
            'Missing Test Coverage': 'testCoverage',
            'Accessibility Gap': 'accessibility',
            'i18n Issue': 'i18n',
            'Sensitive Data Exposure': 'sensitiveData',
            'Configuration Drift': 'configDrift',
            'Missing Security Header': 'securityHeaders',
            'Database Anti-Pattern': 'databasePatterns',
            'Framework Practice Issue': 'frameworkPractices',
            'Workspace Health Issue': 'workspaceHealth',
            'Unused Dependency': 'unusedDeps',
            'API Contract Drift': 'apiContract',
            'High Complexity': 'complexity',
            'LLM Slop': 'llmSlop',
            'Token Bleed': 'tokenBleed',
            'Production Leak': 'productionLeak',
            'Fiction KPI': 'fictionKpi',
            'Eval Danger': 'evalDanger',
            'innerHTML XSS': 'innerHtmlXss',
            'Prototype Pollution Risk': 'prototypePollution',
            'Unhandled Promise': 'unhandledPromise',
            'Magic Number': 'magicNumber',
            'Missing Strict Mode': 'missingStrictMode',
            'Uninitialized Variable Read': 'uninitializedRead',
            'Unvalidated Redirect': 'unvalidatedRedirect',
            'Missing Rate Limiting': 'missingRateLimit',
            'Insecure Random for Security': 'insecureRandom',
            'Sensitive Data in Logs': 'loggingSecrets',
            'Hardcoded Confidence Score': 'hardcodedConfidence',
            'Hardcoded Completion Rate': 'hardcodedCompletion',
            'Mock/Fixture Path in Production': 'mockPathLeak',
            'Sample JSON Reference': 'sampleJsonRef',
            'AI Placeholder Comment': 'aiPlaceholderComment',
            'AI Placeholder Block Comment': 'aiPlaceholderBlock',
            'Markdown Fence in Code': 'markdownFenceLeak',
            'Empty Stub Function': 'emptyStubFunction',
            'Arrow Function Stub': 'arrowStub',
            'Roadmap Marker': 'roadmapMarker'
        };
        const sectionSchema = [
            { section: 'aiResidue', hitsVar: 'aiResidueHits', findingsVar: 'aiResidueFindings', label: 'AI residue pattern' },
            { section: 'performance', hitsVar: 'perfHits', findingsVar: 'perfFindings', label: 'performance anti-pattern' },
            { section: 'typeSafety', hitsVar: 'typeSafetyHits', findingsVar: 'typeSafetyFindings', label: 'type safety gap' },
            { section: 'testCoverage', hitsVar: 'testHits', findingsVar: 'testFindings', label: 'test coverage gap' },
            { section: 'accessibility', hitsVar: 'a11yHits', findingsVar: 'a11yFindings', label: 'accessibility gap' },
            { section: 'i18n', hitsVar: 'i18nHits', findingsVar: 'i18nFindings', label: 'i18n issue' },
            { section: 'sensitiveData', hitsVar: 'sensitiveDataHits', findingsVar: 'sensitiveDataFindings', label: 'sensitive data exposure' },
            { section: 'configDrift', hitsVar: 'configDriftHits', findingsVar: 'configDriftFindings', label: 'configuration drift' },
            { section: 'securityHeaders', hitsVar: 'securityHeaderHits', findingsVar: 'securityHeaderFindings', label: 'security header reference' },
            { section: 'databasePatterns', hitsVar: 'dbPatternHits', findingsVar: 'dbPatternFindings', label: 'database anti-pattern' },
            { section: 'frameworkPractices', hitsVar: 'frameworkHits', findingsVar: 'frameworkFindings', label: 'framework practice issue' },
            { section: 'workspaceHealth', hitsVar: 'workspaceHits', findingsVar: 'workspaceFindings', label: 'workspace health issue' },
            { section: 'unusedDeps', hitsVar: 'unusedDepHits', findingsVar: 'unusedDepFindings', label: 'unused dependency reference' },
            { section: 'apiContract', hitsVar: 'apiContractHits', findingsVar: 'apiContractFindings', label: 'API contract drift' },
            { section: 'complexity', hitsVar: 'complexityHits', findingsVar: 'complexityFindings', label: 'high complexity pattern' },
            { section: 'llmSlop', hitsVar: 'llmSlopHits', findingsVar: 'llmSlopFindings', label: 'LLM slop pattern' },
            { section: 'tokenBleed', hitsVar: 'tokenBleedHits', findingsVar: 'tokenBleedFindings', label: 'token bleed risk' },
            { section: 'productionLeak', hitsVar: 'productionLeakHits', findingsVar: 'productionLeakFindings', label: 'production data leak' },
            { section: 'fictionKpi', hitsVar: 'fictionKpiHits', findingsVar: 'fictionKpiFindings', label: 'hardcoded fiction KPI' },
            { section: 'evalDanger', hitsVar: 'evalDangerHits', findingsVar: 'evalDangerFindings', label: 'dangerous eval usage' },
            { section: 'innerHtmlXss', hitsVar: 'innerHtmlXssHits', findingsVar: 'innerHtmlXssFindings', label: 'innerHTML XSS risk' },
            { section: 'prototypePollution', hitsVar: 'prototypePollutionHits', findingsVar: 'prototypePollutionFindings', label: 'prototype pollution risk' },
            { section: 'unhandledPromise', hitsVar: 'unhandledPromiseHits', findingsVar: 'unhandledPromiseFindings', label: 'unhandled promise' },
            { section: 'magicNumber', hitsVar: 'magicNumberHits', findingsVar: 'magicNumberFindings', label: 'magic number' },
            { section: 'missingStrictMode', hitsVar: 'missingStrictModeHits', findingsVar: 'missingStrictModeFindings', label: 'missing strict mode' },
            { section: 'uninitializedRead', hitsVar: 'uninitializedReadHits', findingsVar: 'uninitializedReadFindings', label: 'uninitialized variable read' },
            { section: 'unvalidatedRedirect', hitsVar: 'unvalidatedRedirectHits', findingsVar: 'unvalidatedRedirectFindings', label: 'unvalidated redirect' },
            { section: 'missingRateLimit', hitsVar: 'missingRateLimitHits', findingsVar: 'missingRateLimitFindings', label: 'missing rate limiting' },
            { section: 'insecureRandom', hitsVar: 'insecureRandomHits', findingsVar: 'insecureRandomFindings', label: 'insecure random usage' },
            { section: 'loggingSecrets', hitsVar: 'loggingSecretsHits', findingsVar: 'loggingSecretsFindings', label: 'secret in logs' },
            { section: 'hardcodedConfidence', hitsVar: 'hardcodedConfidenceHits', findingsVar: 'hardcodedConfidenceFindings', label: 'hardcoded confidence score' },
            { section: 'hardcodedCompletion', hitsVar: 'hardcodedCompletionHits', findingsVar: 'hardcodedCompletionFindings', label: 'hardcoded completion rate' },
            { section: 'mockPathLeak', hitsVar: 'mockPathLeakHits', findingsVar: 'mockPathLeakFindings', label: 'mock/fixture path leak' },
            { section: 'sampleJsonRef', hitsVar: 'sampleJsonRefHits', findingsVar: 'sampleJsonRefFindings', label: 'sample JSON reference' },
            { section: 'governanceMarker', hitsVar: 'governanceMarkerHits', findingsVar: 'governanceMarkerFindings', label: 'license/governance marker' },
            { section: 'aiPlaceholderComment', hitsVar: 'aiPlaceholderCommentHits', findingsVar: 'aiPlaceholderCommentFindings', label: 'AI placeholder comment' },
            { section: 'aiPlaceholderBlock', hitsVar: 'aiPlaceholderBlockHits', findingsVar: 'aiPlaceholderBlockFindings', label: 'AI placeholder block comment' },
            { section: 'markdownFenceLeak', hitsVar: 'markdownFenceLeakHits', findingsVar: 'markdownFenceLeakFindings', label: 'markdown fence leak' },
            { section: 'emptyStubFunction', hitsVar: 'emptyStubFunctionHits', findingsVar: 'emptyStubFunctionFindings', label: 'empty stub function' },
            { section: 'arrowStub', hitsVar: 'arrowStubHits', findingsVar: 'arrowStubFindings', label: 'arrow function stub' },
            { section: 'roadmapMarker', hitsVar: 'roadmapMarkerHits', findingsVar: 'roadmapMarkerFindings', label: 'roadmap marker' }
        ];
        const derived = {};
        for (const issue of detectedIssues) {
            const sectionName = typeToSection[issue.type];
            if (!sectionName) continue;
            const schema = sectionSchema.find(s => s.section === sectionName);
            if (!schema) continue;
            const findings = (issue.findings || []).map(f => ({
                file: typeof f === 'string' ? f : (f.file || f.filePath || 'unknown'),
                type: issue.type,
                matches: Array.isArray(f.matches) ? f.matches.slice(0, 3).map(m => ({
                    line: m.line || 0,
                    snippet: (m.snippet || '').slice(0, 120)
                })) : []
            }));
            const hits = issue.count || findings.length || 0;
            if (!derived[sectionName]) {
                derived[sectionName] = {
                    [schema.hitsVar]: 0,
                    [schema.findingsVar]: [],
                    summary: `No ${schema.label}s detected.`
                };
            }
            derived[sectionName][schema.hitsVar] += hits;
            derived[sectionName][schema.findingsVar].push(...findings);
        }
        // Update summaries for sections that have hits
        for (const s of sectionSchema) {
            if (derived[s.section]) {
                const hits = derived[s.section][s.hitsVar];
                derived[s.section].summary = hits > 0
                    ? `${hits} ${s.label}(s) detected.`
                    : `No ${s.label}s detected.`;
            }
        }
        return derived;
    }

    // Assemble comprehensive report.json with ALL available scan data for rich roadmap generation
    const assembledReport = {};
    for (const key of baseKeys) {
        if (report[key] != null) assembledReport[key] = report[key];
    }
    // Merge detectedIssues-derived analyzer sections as safety net
    const derivedSections = deriveAnalyzerSectionsFromDetectedIssues(report.detectedIssues);
    for (const [sectionName, sectionData] of Object.entries(derivedSections)) {
        if (!assembledReport[sectionName]) assembledReport[sectionName] = sectionData;
    }
    // Include ALL per-module data regardless of tier so roadmaps have full detail
    for (const data of Object.values(perModuleData)) {
        Object.entries(data).forEach(([k, v]) => { if (v != null) assembledReport[k] = v; });
    }
    const filteredReport = assembledReport;

    const reportHash = await computeSha256(JSON.stringify(assembledReport));
    const shortHash = reportHash.slice(0, 16) + '...' + reportHash.slice(-8);

    // --- Rich Executive Risk Certificate data ---
    const aiResidue = report.aiResidue || {};
    const aiIndicators = report.aiIndicators || {};
    const aiHits = aiResidue.aiResidueHits || 0;
    const aiSdkCount = aiIndicators.sdkCount || aiIndicators.aiSystemIndicators || 0;
    const credentialHits = (gateReport.blockingFindings || []).length || gateReport.blockingCount || 0;
    const comp = report.compliance || {};
    const licenseCount = comp.licenseCount || 0;
    const securityCount = comp.securityCount || 0;
    const hasLicense = licenseCount > 0;
    const hasSecurity = securityCount > 0;
    const gradeConfig = {
        'A': { label: 'Excellent', ringColor: '#3fb950', cssVar: 'var(--pass)' },
        'B': { label: 'Low-Medium Risk', ringColor: '#3fb950', cssVar: 'var(--pass)' },
        'C': { label: 'Medium Risk', ringColor: '#d29922', cssVar: 'var(--warn)' },
        'D': { label: 'High Risk', ringColor: '#d29922', cssVar: 'var(--warn)' },
        'F': { label: 'Critical Risk', ringColor: '#f85149', cssVar: 'var(--blocked)' }
    };
    const LIABILITY_MULTIPLIER_BLOCKING = 150000;
    const LIABILITY_MULTIPLIER_WARNING = 45000;
    const LIABILITY_FORMAT_THRESHOLD = 1000000;
    const gradeInfo = gradeConfig[grade] || gradeConfig['F'];
    const blocking = (gateReport.blockingIssues || []).length;
    const warnings = (gateReport.warningIssues || []).length;
    const liabilityRaw = (blocking * LIABILITY_MULTIPLIER_BLOCKING) + (warnings * LIABILITY_MULTIPLIER_WARNING);
    const liabilityFormatted = liabilityRaw > 0
        ? (liabilityRaw >= LIABILITY_FORMAT_THRESHOLD ? '$' + (liabilityRaw / LIABILITY_FORMAT_THRESHOLD).toFixed(1) + 'M' : '$' + liabilityRaw.toLocaleString())
        : '$0';
    const companyInitials = escapeHtml(projectName).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SB';
    const pillars = [];
    if (aiHits === 0) {
        pillars.push({ status: 'pass', statusText: 'PASS', name: 'AI Slop & Hallucinations', detail: 'No unresolved LLM placeholders or fake metrics detected' });
    } else {
        pillars.push({ status: 'warn', statusText: 'WARNING', name: 'AI Slop & Hallucinations', detail: aiHits + ' AI residue pattern(s) detected in source' });
    }
    if (credentialHits === 0) {
        pillars.push({ status: 'pass', statusText: 'PASS', name: 'Credential Leaks', detail: 'No hardcoded credentials or API keys detected in source' });
    } else {
        pillars.push({ status: 'warn', statusText: 'WARNING', name: 'Credential Leaks', detail: credentialHits + ' credential pattern(s) detected — review before release' });
    }
    if (aiSdkCount === 0) {
        pillars.push({ status: 'pass', statusText: 'PASS', name: 'Shadow AI Systems', detail: 'No undocumented AI integrations detected' });
    } else {
        pillars.push({ status: gatePassed ? 'pass' : 'warn', statusText: gatePassed ? 'PASS' : 'REVIEW', name: 'Shadow AI Systems', detail: aiSdkCount + ' AI SDK reference(s) detected — verify compliance documentation' });
    }
    if (hasLicense && hasSecurity) {
        pillars.push({ status: 'pass', statusText: 'PASS', name: 'Licensing & IP Verification', detail: licenseCount + ' license file(s), ' + securityCount + ' governance file(s) present' });
    } else {
        pillars.push({ status: 'warn', statusText: 'REVIEW', name: 'Licensing & IP Verification', detail: 'Missing governance files — add LICENSE and SECURITY.md' });
    }
    const pillarsHtml = pillars.map(p => `    <div class="pillar">
        <div class="status ${p.status}">${p.statusText}</div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="detail">${escapeHtml(p.detail)}</div>
    </div>`).join('\n');
    const validThrough = new Date(isoDate);
    validThrough.setFullYear(validThrough.getFullYear() + 1);
    const validThroughStr = validThrough.toLocaleDateString();
    const tokenDisplay = token.length >= 12 ? token.slice(0,8) + '...' + token.slice(-4) : (token || 'N/A');

    const certHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>SimpleBeacon Executive Risk Certificate — ${escapeHtml(projectName)}</title>
<style>
@page { margin: 12mm 14mm; background: #0d1117; }
:root { color-scheme: dark; --bg: #0d1117; --bg-elevated: #161b22; --border: #30363d; --border-muted: #21262d; --text: #e6edf3; --muted: #8b949e; --dim: #6e7681; --accent: #58a6ff; --accent-soft: rgba(88,166,255,0.12); --pass: #3fb950; --pass-bg: rgba(46,164,79,0.14); --warn: #d29922; --warn-bg: rgba(210,153,34,0.14); --blocked: #f85149; --blocked-bg: rgba(248,81,73,0.14); --gold: #d29922; }
* { box-sizing: border-box; }
html { background: var(--bg); }
body { font-family: "Inter","Segoe UI",system-ui,sans-serif; color: var(--text); margin: 0; background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(88,166,255,0.08), transparent 55%), var(--bg); font-size: 11pt; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.certificate { min-height: 100vh; padding: 48px 52px 40px; max-width: 860px; margin: 0 auto; background: radial-gradient(ellipse 90% 60% at 20% 0%, rgba(88,166,255,0.10), transparent 55%), radial-gradient(circle at 100% 20%, rgba(46,164,79,0.08), transparent 45%), linear-gradient(160deg, #010409 0%, #0d1117 42%, #161b22 100%); border: 1px solid var(--border); page-break-after: always; position: relative; }
.certificate::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--accent), var(--pass), var(--gold)); }
.header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 1px solid var(--border-muted); }
.co-brand { display: flex; align-items: center; gap: 12px; }
.co-brand .logo-box { width: 40px; height: 40px; border-radius: 8px; background: linear-gradient(135deg, var(--accent), #1f6feb); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 14px; }
.co-brand .company-name { font-size: 16px; font-weight: 700; color: var(--text); }
.co-brand .company-tag { font-size: 10px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.08em; }
.cert-label { text-align: right; }
.cert-label .kicker { font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-bottom: 4px; }
.cert-label .title { font-size: 13px; font-weight: 700; color: var(--accent); }
.cert-body { text-align: center; padding: 24px 0 32px; }
.cert-body h1 { font-size: 28pt; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.02em; background: linear-gradient(to right, #fff, #c9d1d9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.cert-body .subtitle { font-size: 12pt; color: var(--muted); margin-bottom: 32px; }
.grade-ring { width: 140px; height: 140px; border-radius: 50%; border: 6px solid ${gradeInfo.ringColor}; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: 0 0 40px ${gradeInfo.ringColor}30; }
.grade-ring .grade { font-size: 56px; font-weight: 800; color: ${gradeInfo.ringColor}; }
.grade-label { font-size: 16px; font-weight: 700; color: ${gradeInfo.ringColor}; margin-bottom: 4px; }
.grade-meta { font-size: 11px; color: var(--muted); margin-bottom: 24px; }
.liability-card { background: var(--pass-bg); border: 1px solid rgba(63,185,80,0.25); border-radius: 12px; padding: 20px 32px; display: inline-block; margin-bottom: 32px; }
.liability-card .amount { font-size: 32px; font-weight: 800; color: var(--pass); }
.liability-card .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.pillars { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; max-width: 560px; margin: 0 auto 32px; text-align: left; }
.pillar { background: var(--bg-elevated); border: 1px solid var(--border-muted); border-radius: 10px; padding: 14px 16px; }
.pillar .status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.pillar .status.pass { color: var(--pass); }
.pillar .status.warn { color: var(--warn); }
.pillar .status.blocked { color: var(--blocked); }
.pillar .name { font-size: 12px; font-weight: 600; color: var(--text); }
.pillar .detail { font-size: 10px; color: var(--dim); margin-top: 2px; }
.footer-section { border-top: 1px solid var(--border-muted); padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.signature-block { text-align: left; }
.signature-block .sig-line { font-family: "Georgia", serif; font-size: 18px; font-style: italic; color: var(--text); margin-bottom: 4px; }
.signature-block .sig-name { font-size: 11px; font-weight: 600; color: var(--text); }
.signature-block .sig-title { font-size: 10px; color: var(--dim); }
.hash-block { text-align: right; font-size: 9px; color: var(--dim); max-width: 280px; }
.hash-block .hash-label { text-transform: uppercase; letter-spacing: 0.08em; font-size: 8px; margin-bottom: 4px; }
.hash-block .hash-value { font-family: "JetBrains Mono", monospace; word-break: break-all; color: var(--muted); }
.disclaimer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border-muted); font-size: 9px; color: var(--dim); line-height: 1.6; }
@media print { body { background: var(--bg); } .certificate { border: none; } }
@media (max-width: 600px) { .certificate { padding: 28px 24px; } .cert-body h1 { font-size: 20pt; } .pillars { grid-template-columns: 1fr; } .header-row { flex-direction: column; gap: 12px; } .footer-section { flex-direction: column; align-items: flex-start; } .hash-block { text-align: left; } }
</style></head>
<body>
<div class="certificate">
<div class="header-row">
    <div class="co-brand">
        <div class="logo-box">${companyInitials}</div>
        <div>
            <div class="company-name">${escapeHtml(projectName)}</div>
            <div class="company-tag">${profileLabel} — Executive Risk Certificate</div>
        </div>
    </div>
    <div class="cert-label">
        <div class="kicker">SimpleBeacon Audit</div>
        <div class="title">Cert. No. ${certId}</div>
    </div>
</div>

<div class="cert-body">
    <h1>Executive Risk Certificate</h1>
    <p class="subtitle">Board-ready compliance assessment for AI-generated code, credential leaks, and shadow AI systems</p>

    <div class="grade-ring">
        <div class="grade">${grade}</div>
    </div>
    <div class="grade-label">${gradeInfo.label}</div>
    <div class="grade-meta">Compliance Score: ${qs}% | Gate: ${gateLabel} | ${issueCount} finding${issueCount === 1 ? '' : 's'} detected</div>

    <div class="liability-card">
        <div class="amount">${liabilityFormatted}</div>
        <div class="label">Estimated Maximum Financial Liability</div>
    </div>

    <div class="pillars">
${pillarsHtml}
    </div>
</div>

<div class="footer-section">
    <div class="signature-block">
        <div class="sig-line">${escapeHtml(signatoryName)}</div>
        <div class="sig-name">${escapeHtml(signatoryTitle)}</div>
        <div class="sig-title">Generated: ${dateStr} &nbsp;&middot;&nbsp; Valid through: ${validThroughStr}</div>
    </div>
    <div class="hash-block">
        <div class="hash-label">Cryptographic Signature</div>
        <div class="hash-value">sha256:${shortHash} &nbsp;|&nbsp; simplebeacon.ai/verify/${certId}</div>
    </div>
</div>

<div class="disclaimer">
    <strong>Important:</strong> This certificate represents a deterministic technical review of the submitted codebase at the time of scan. It is not a legal conformity certification under Regulation (EU) 2024/1689 (EU AI Act) or any other regulatory framework. Estimated financial liability is based on pattern severity scoring and historical penalty data; actual regulatory fines may vary. For questions about this certificate, contact ${escapeHtml(contactEmail)}.
</div>
</div>
</body></html>`;

    const readme = `# SimpleBeacon Executive Risk Certificate

**Project:** ${projectName}
**Certificate ID:** ${certId}
**Issued:** ${dateStr}
**Grade:** ${grade}
**Gate:** ${gateLabel}
**Quality Score:** ${qs}/100
**Files Analyzed:** ${fileCount}
**SHA-256:** ${reportHash}
**Product Tier:** ${window._tokenPayload ? (window._tokenPayload.tier || window._tokenPayload.product || 'executive').toUpperCase() : 'SOVEREIGN'}

Generated entirely in-browser. Zero data uploaded.
`;

    zip.file('certificate.html', certHtml);
    zip.file('report.json', JSON.stringify(assembledReport, null, 2));
    zip.file('README.md', readme);

    // Tier-filtered human-readable markdown reports
    if (allowedModules.includes('1')) {
        const gate = filteredReport.gateReport || filteredReport.gate || {};
        const blocking = gate.blockingFindings || gate.blockingIssues || [];
        const warnings = gate.allIssues || gate.warningIssues || [];
        const items = [];
        if (blocking.length) {
            items.push('## Blocking Issues\n');
            blocking.forEach((i, idx) => {
                const fp = Array.isArray(i.filePath) ? i.filePath.join(', ') : (i.filePath || 'N/A');
                items.push(`${idx + 1}. **${i.type || 'Issue'}** — ${(i.severity || '').toUpperCase()}\n   - File(s): ${fp}\n   - Count: ${i.count || 0}${i.fix ? '\n   - Remediation: ' + i.fix : ''}`);
            });
        }
        if (warnings.length) {
            items.push('## Warnings\n');
            warnings.forEach((i, idx) => {
                const fp = Array.isArray(i.filePath) ? i.filePath.join(', ') : (i.filePath || 'N/A');
                items.push(`${idx + 1}. **${i.type || 'Issue'}** — ${(i.severity || '').toUpperCase()}\n   - File(s): ${fp}\n   - Count: ${i.count || 0}${i.fix ? '\n   - Remediation: ' + i.fix : ''}`);
            });
        }
        const findingsMd = `# Gate Findings Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n**Blocking:** ${blocking.length}\n**Warnings:** ${warnings.length}\n\n${items.length ? items.join('\n\n') : 'No blocking or warning issues detected.'}\n`;
        zip.file('findings.md', findingsMd);
    }

    // Module 2: Consolidation
    if (allowedModules.includes('2')) {
        const cons = filteredReport.consolidation || {};
        const dupGroups = cons.duplicateGroups || 0;
        const dupFiles = (cons.duplicateFiles || []).slice(0, 10);
        const consMd = `# Consolidation Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Duplicate Groups | ${dupGroups} |\n\n${dupFiles.length ? `## Duplicate Files\n\n${dupFiles.map(f => `- ${f}`).join('\n')}\n` : ''}> Consolidate duplicate files and standardize naming conventions.\n`;
        zip.file('consolidation.md', consMd);
    }

    // Module 3: Mock Data
    if (allowedModules.includes('3')) {
        const mockCats = filteredReport.mockDataCategories || [];
        const mockSamples = filteredReport.mockSampleFiles || [];
        const mockTotal = mockSamples.length || mockCats.reduce((a, c) => a + (c.fileCount || 0), 0);
        const mockMd = `# Mock Data Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Mock / Fixture Files | ${mockTotal} |\n\n${mockCats.length ? `## Categories\n\n${mockCats.map(c => `- ${c.category}: ${c.fileCount || 0} file(s)`).join('\n')}\n` : ''}> Ensure mock data is excluded from production builds.\n`;
        zip.file('mock-data.md', mockMd);
    }

    if (allowedModules.includes('4')) {
        const phases = filteredReport.remediationPhases || [];
        const rm = filteredReport.roadmap || {};
        const roadmapMd = phases.length ? `# 5-Phase Compliance Roadmap\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n**Todo Items:** ${rm.todoCount || 0}\n\n${phases.map((p, idx) => `## ${idx + 1}. ${p.title || 'Untitled Phase'}\n\n${p.description || ''}\n\n- **Severity:** ${p.severity || 'N/A'}\n- **Effort:** ${p.effort || 'N/A'}\n- **Status:** ${p.status || 'N/A'}\n- **Progress:** ${p.progress ?? 0}%\n\n${(p.tasks || []).map(t => `- ${t}`).join('\n')}\n`).join('\n\n')}\n` : `# Roadmap\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n${rm.summary || 'No roadmap data available.'}\n`;
        zip.file('roadmap.md', roadmapMd);
    }

    if (allowedModules.includes('11')) {
        const eu = filteredReport.euAiActSummary || {};
        const euControls = eu.controls || [];
        const aiCount = eu.aiSystemIndicators || 0;
        const hrCount = eu.highRiskIndicators || 0;
        const tgCount = eu.transparencyGaps || 0;
        const docCount = eu.documentationArtifacts || 0;
        const docsFound = eu.documentationFound || [];
        const deadlineDate = new Date('2026-08-02');
        const daysUntil = Math.max(0, Math.ceil((deadlineDate - new Date(dateStr)) / (1000 * 60 * 60 * 24)));

        // Control cards
        const controlCards = euControls.length ? euControls.map(c => `### ${c.controlId}: ${c.title}\n\n- **Article:** ${c.article || 'N/A'}\n- **Status:** ${c.status || 'N/A'}\n- **Severity:** ${c.severity || 'N/A'}\n- **Evidence:** ${c.evidence || 'N/A'}\n- **Action:** ${c.action || 'N/A'}\n`).join('\n') : 'No controls data available.';

        // Risk matrix — use worst control status to drive overall risk, not just AI counts
        const worstControl = euControls.length ? euControls.reduce((w, c) => {
            const rank = { 'FAIL': 4, 'WARN': 3, 'REVIEW': 2, 'PASS': 1 };
            return rank[c.status] > rank[w.status] ? c : w;
        }, euControls[0]) : null;
        const likelihood = aiCount > 5 ? 'High' : (aiCount > 0 ? 'Medium' : 'Low');
        const impact = (worstControl && (worstControl.severity === 'critical' || worstControl.severity === 'high')) ? 'High' : (hrCount > 0 ? 'High' : (aiCount > 0 ? 'Medium' : 'Low'));
        const riskLevel = (likelihood === 'High' || impact === 'High') ? 'High' : (likelihood === 'Medium' || impact === 'Medium') ? 'Medium' : 'Low';
        const riskColor = riskLevel === 'High' ? '🔴' : (riskLevel === 'Medium' ? '🟡' : '🟢');

        // Remediation guide — PASS = no open task; REVIEW/WARN/FAIL = open task
        const remediationGuide = euControls.map(c => {
            if (c.status === 'PASS') return `- [ ] **${c.controlId}** — No open action. ${c.action}`;
            if (c.status === 'FAIL') return `- [ ] **${c.controlId}** — 🚨 **BLOCK RELEASE** until risk assessment and conformity documentation are complete.`;
            return `- [ ] **${c.controlId}** — ${c.action}`;
        }).join('\n');

        // Documentation checklist
        const requiredDocs = [
            { name: 'Model Card', pattern: /model[-_\s]?card/i, found: docsFound.some(d => /model[-_\s]?card/i.test(d)) },
            { name: 'Risk Assessment / FRIA', pattern: /risk[-_\s]?assessment|fundamental[-_\s]?rights/i, found: docsFound.some(d => /risk[-_\s]?assessment|fundamental[-_\s]?rights/i.test(d)) },
            { name: 'Technical Documentation', pattern: /technical[-_\s]?documentation|ai[-_\s]?system[-_\s]?documentation/i, found: docsFound.some(d => /technical[-_\s]?documentation/i.test(d)) },
            { name: 'Conformity Declaration', pattern: /conformity[-_\s]?declaration/i, found: docsFound.some(d => /conformity[-_\s]?declaration/i.test(d)) },
            { name: 'EU AI Act Reference', pattern: /eu[-_\s]?ai[-_\s]?act/i, found: docsFound.some(d => /eu[-_\s]?ai[-_\s]?act/i.test(d)) }
        ];
        const docChecklist = requiredDocs.map(d => `- [${d.found ? 'x' : ' '}] ${d.name}`).join('\n');

        const euMd = `# EU AI Act Assessment\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n## Executive Summary\n\n| Metric | Value |\n|---|---|\n| AI System Indicators | ${aiCount} |\n| High Risk Indicators | ${hrCount} |\n| Transparency Gaps | ${tgCount} |\n| Documentation Artifacts | ${docCount} |\n| Overall Risk Posture | ${riskColor} ${riskLevel} |\n\n${aiCount > 0 ? `**Risk Posture:** ${aiCount} AI indicator(s) detected; ${hrCount} high-risk; EU AI Act applicability review recommended.` : '**Risk Posture:** No AI indicators detected. EU AI Act obligations not applicable.'}\n\n---\n\n## Control Cards\n\n${controlCards}\n\n---\n\n## Risk Matrix\n\n| | **Impact: Low** | **Impact: Medium** | **Impact: High** |\n|---|---|---|---|\n| **Likelihood: High** | Medium | High | 🔴 **High** |\n| **Likelihood: Medium** | Low | 🟡 **Medium** | High |\n| **Likelihood: Low** | 🟢 **Low** | Low | Medium |\n\n**Position:** Likelihood = ${likelihood}, Impact = ${impact} → **${riskLevel} Risk**\n\n---\n\n## Remediation Guide\n\n${remediationGuide || 'No remediation actions required.'}\n\n---\n\n## Documentation Checklist\n\n${docChecklist}\n\n${docsFound.length ? `## Documentation Found\n\n${docsFound.map(f => `- ${f}`).join('\n')}\n` : ''}\n\n---\n\n## Deadline\n\n> **EU AI Act compliance deadline: August 2, 2026**\n> \n> ${daysUntil} days remaining.\n\n${eu.deadlineNote ? `> ${eu.deadlineNote}` : ''}\n`;
        zip.file('eu-ai-act.md', euMd);
    }

    // Module 5: Codebase Analysis
    if (allowedModules.includes('5')) {
        const cb = filteredReport.codebase || {};
        const langBreakdown = cb.languageBreakdown || {};
        const langRows = Object.entries(langBreakdown).map(([lang, count]) => `| ${lang} | ${count} |`).join('\n');
        const cbMd = `# Codebase Analysis\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Total Files | ${cb.totalFiles || 0} |\n| Total Lines | ${(cb.totalLines || 0).toLocaleString()} |\n| Avg Lines/File | ${cb.averageLinesPerFile || 0} |\n\n${langRows ? `## Language Breakdown\n\n| Language | Files |\n|---|---|\n${langRows}\n` : ''}\n`;
        zip.file('codebase.md', cbMd);
    }

    // Module 6: File Reduction
    if (allowedModules.includes('6')) {
        const fr = filteredReport.fileReduction || {};
        const unused = (fr.unusedAssetCandidates || []).slice(0, 10);
        const dupGroups = fr.duplicateGroups || 0;
        const frMd = `# File Reduction Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Unused Asset Candidates | ${unused.length} |\n| Duplicate Content Groups | ${dupGroups} |\n\n${unused.length ? `## Unused Assets\n\n${unused.map(f => `- ${f}`).join('\n')}\n` : ''}> Review and remove unused assets; consolidate duplicate files.\n`;
        zip.file('file-reduction.md', frMd);
    }

    // Module 7: Data Quality
    if (allowedModules.includes('7')) {
        const dq = filteredReport.dataQuality || {};
        const dqMd = `# Data Quality Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Invalid JSON | ${dq.invalidJsonCount || 0} |\n| Empty JSON | ${dq.emptyJsonCount || 0} |\n| Schema Compliance | ${dq.schemaCompliance != null ? dq.schemaCompliance + '%' : 'N/A'} |\n\n${dq.summary || 'No data quality issues detected.'}\n`;
        zip.file('data-quality.md', dqMd);
    }

    // Module 8: Cleanup & Hygiene
    if (allowedModules.includes('8')) {
        const cl = filteredReport.cleanup || {};
        const debugCount = cl.debugArtifactCount || 0;
        const bloatCount = cl.bloatArtifactCount || 0;
        const debugFiles = (cl.debugArtifacts || []).slice(0, 10);
        const bloatFiles = (cl.bloatArtifacts || []).slice(0, 10);
        const clMd = `# Cleanup & Hygiene Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Debug Artifacts | ${debugCount} |\n| Bloat Files | ${bloatCount} |\n\n${debugFiles.length ? `## Debug Artifacts\n\n${debugFiles.map(f => typeof f === 'string' ? `- ${f}` : `- ${f.file || 'N/A'}`).join('\n')}\n` : ''}${bloatFiles.length ? `## Bloat Files\n\n${bloatFiles.map(f => typeof f === 'string' ? `- ${f}` : `- ${f.file || 'N/A'}`).join('\n')}\n` : ''}> Remove debug artifacts and bloat files before production builds.\n`;
        zip.file('cleanup.md', clMd);
    }

    // Module 9: npm Audit
    if (allowedModules.includes('9')) {
        const npm = filteredReport.npmAudit || {};
        const pkgFiles = (npm.packageJsonFiles || []).slice(0, 10);
        const npmMd = `# npm Audit Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| package.json Files | ${npm.packageJsonCount || 0} |\n| Total Dependencies | ${(npm.dependencyCount || 0).toLocaleString()} |\n| Avg Deps / Package | ${npm.packageJsonCount > 0 ? Math.round((npm.dependencyCount || 0) / npm.packageJsonCount) : 0} |\n\n${pkgFiles.length ? `## package.json Files\n\n${pkgFiles.map(f => `- ${f}`).join('\n')}\n` : ''}\n`;
        zip.file('npm-audit.md', npmMd);
    }

    // Module 10: Compliance
    if (allowedModules.includes('10')) {
        const comp = filteredReport.compliance || {};
        const licFiles = (comp.licenseFiles || []).slice(0, 10);
        const secFiles = (comp.securityFiles || []).slice(0, 10);
        const compMd = `# Compliance & Governance Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| License Files | ${comp.licenseCount || 0} |\n| Security Files | ${comp.securityCount || 0} |\n\n${licFiles.length ? `## License Files\n\n${licFiles.map(f => `- ${f}`).join('\n')}\n` : ''}\n${secFiles.length ? `## Security / Governance Files\n\n${secFiles.map(f => `- ${f}`).join('\n')}\n` : ''}\n`;
        zip.file('compliance.md', compMd);
    }

    // Module 12: Dependency Vulnerabilities
    if (allowedModules.includes('12')) {
        const dep = filteredReport.dependencyAudit || filteredReport.vulnerabilityAudit || {};
        const vulnCount = dep.vulnerabilityCount || 0;
        const crit = dep.critical || 0;
        const high = dep.high || 0;
        const affected = (dep.affectedPackages || dep.affectedFiles || []).slice(0, 10);
        const depMd = `# Dependency Vulnerability Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Total Vulnerabilities | ${vulnCount} |\n| Critical | ${crit} |\n| High | ${high} |\n\n${affected.length ? `## Affected Packages\n\n${affected.map(f => `- ${f}`).join('\n')}\n` : ''}\n${vulnCount ? '> Run `npm audit fix` to auto-resolve patchable issues. Review breaking changes before major version bumps.\n' : ''}\n`;
        zip.file('dependency-vulns.md', depMd);
    }

    // Module 13: Build Readiness
    if (allowedModules.includes('13')) {
        const allFiles = filteredReport.fileList || filteredReport.repositoryInventory?.totalFiles || [];
        const filePaths = Array.isArray(allFiles) ? allFiles : [];
        const lowerPaths = filePaths.map(f => (typeof f === 'string' ? f : f.path || '').toLowerCase());
        const checks = [
            { name: 'package.json', found: lowerPaths.some(p => p.endsWith('package.json')) },
            { name: 'Lockfile', found: lowerPaths.some(p => /package-lock\.json|yarn\.lock|pnpm-lock\.yaml/.test(p)) },
            { name: 'README', found: lowerPaths.some(p => /readme\.?/.test(p)) },
            { name: 'CHANGELOG', found: lowerPaths.some(p => /changelog|changes|history/i.test(p)) },
            { name: 'Tests', found: lowerPaths.some(p => /test|spec|\.test\.|\.spec\.|__tests__|jest\.config|vitest\.config|cypress/i.test(p)) },
            { name: 'CI/CD', found: lowerPaths.some(p => /\.github\/workflows|\.gitlab-ci|jenkins|\.circleci|\.travis|azure-pipelines|build\.yml|deploy\.yml/i.test(p)) },
            { name: 'Docker', found: lowerPaths.some(p => /dockerfile|docker-compose|\.dockerignore/i.test(p)) },
            { name: 'Linting/Formatting', found: lowerPaths.some(p => /eslint|prettier|\.editorconfig|lint-staged|husky/i.test(p)) },
            { name: 'TypeScript Config', found: lowerPaths.some(p => /tsconfig|\.ts$/i.test(p)) },
            { name: 'Build Tool Config', found: lowerPaths.some(p => /(webpack|rollup|vite|esbuild|parcel|babel|gulpfile|gruntfile)/i.test(p)) },
            { name: '.env.example', found: lowerPaths.some(p => /\.env\.example|\.env\.sample|\.env\.template/i.test(p)) },
            { name: '.gitignore', found: lowerPaths.some(p => p.includes('.gitignore')) },
            { name: 'Build artifacts ignored', found: !lowerPaths.some(p => /\/(dist|build|\.next|out)\//.test(p) && !/node_modules\//.test(p)) }
        ];
        const readinessScore = Math.round(((checks.filter(c => c.found).length / checks.length) * 100));
        const present = checks.filter(c => c.found).map(c => `- [x] ${c.name}`).join('\n');
        const missing = checks.filter(c => !c.found).map(c => `- [ ] ${c.name}`).join('\n');
        const brMd = `# Build Readiness Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n**Score:** ${readinessScore}%\n\n## Present\n\n${present}\n\n## Missing\n\n${missing}\n`;
        zip.file('build-readiness.md', brMd);
    }

    // Module 14: AI System Indicators
    if (allowedModules.includes('14')) {
        const ai = filteredReport.aiIndicators || filteredReport.aiSystemIndicators || {};
        const aiFiles = (ai.files || []).slice(0, 10);
        const aiMd = `# AI System Indicators Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| AI SDK Imports | ${ai.sdkCount || ai.aiSystemIndicators || 0} |\n| Model References | ${ai.modelCount || 0} |\n\n${aiFiles.length ? `## Files with AI Indicators\n\n${aiFiles.map(f => `- ${f}`).join('\n')}\n` : ''}\n`;
        zip.file('ai-indicators.md', aiMd);
    }

    // Module 15: Governance
    if (allowedModules.includes('15')) {
        const gov = filteredReport.governance || {};
        const govFiles = (gov.files || []).slice(0, 10);
        const govMd = `# License & Governance Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| License Headers | ${gov.licenseHeaders || 0} |\n| Copyright Notices | ${gov.copyrightNotices || 0} |\n\n${govFiles.length ? `## Files with License Headers\n\n${govFiles.map(f => `- ${f}`).join('\n')}\n` : ''}\n`;
        zip.file('governance.md', govMd);
    }

    // Module 16: Junk & Temporary Files
    if (allowedModules.includes('16')) {
        const junk = filteredReport.junkFiles || {};
        const junkFileList = (junk.files || []).slice(0, 10);
        const junkMd = `# Junk & Temporary Files Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| Junk / Temp Files | ${junk.fileCount || 0} |\n\n${junkFileList.length ? `## Files Detected\n\n${junkFileList.map(f => `- ${f}`).join('\n')}\n` : ''}\n> Clean up temporary files, editor backups, and OS artifacts before production builds.\n`;
        zip.file('junk-files.md', junkMd);
    }

    // Modules 17-32: schema-driven markdown generation
    ZIP_MARKDOWN_TEMPLATES.forEach(t => generateZipModuleMarkdown(zip, allowedModules, filteredReport, projectName, dateStr, t));

    // Executive Summary — consolidated overview of all included modules
    const execSections = [];
    if (allowedModules.includes('1')) {
        const g = filteredReport.gateReport || filteredReport.gate || {};
        execSections.push(`## Gate Scan\n- Blocking: ${(g.blockingIssues || []).length}\n- Warnings: ${(g.warningIssues || []).length}\n- Status: ${g.pass ? 'PASS' : 'BLOCKED'}`);
    }
    if (allowedModules.includes('5')) {
        const cb = filteredReport.codebase || {};
        execSections.push(`## Codebase Analysis\n- Files: ${cb.totalFiles || 0}\n- Lines: ${(cb.totalLines || 0).toLocaleString()}\n- Avg lines/file: ${cb.averageLinesPerFile || 0}`);
    }
    if (allowedModules.includes('7')) {
        const dq = filteredReport.dataQuality || {};
        execSections.push(`## Data Quality\n- Invalid JSON: ${dq.invalidJsonCount || 0}\n- Empty JSON: ${dq.emptyJsonCount || 0}\n- Schema compliance: ${dq.schemaCompliance != null ? dq.schemaCompliance + '%' : 'N/A'}`);
    }
    if (allowedModules.includes('9')) {
        const npm = filteredReport.npmAudit || {};
        execSections.push(`## npm Audit\n- package.json files: ${npm.packageJsonCount || 0}\n- Dependencies: ${(npm.dependencyCount || 0).toLocaleString()}`);
    }
    if (allowedModules.includes('10')) {
        const comp = filteredReport.compliance || {};
        execSections.push(`## Compliance\n- License files: ${comp.licenseCount || 0}\n- Security files: ${comp.securityCount || 0}`);
    }
    if (allowedModules.includes('11')) {
        const eu = filteredReport.euAiActSummary || {};
        const euControls = eu.controls || [];
        execSections.push(`## EU AI Act\n- AI indicators: ${eu.aiSystemIndicators || 0}\n- High risk: ${eu.highRiskIndicators || 0}\n- Transparency gaps: ${eu.transparencyGaps || 0}\n\n### Controls\n\n| Control ID | Article | Status | Severity | Action |\n|---|---|---|---|---|\n${euControls.map(c => `| ${c.controlId} | ${(c.article || '').split(',').pop()?.trim() || 'N/A'} | ${c.status} | ${c.severity} | ${c.action.substring(0, 60)}${c.action.length > 60 ? '...' : ''} |`).join('\n')}`);
    }
    if (allowedModules.includes('12')) {
        const dep = filteredReport.dependencyAudit || filteredReport.vulnerabilityAudit || {};
        execSections.push(`## Dependency Vulnerabilities\n- Total: ${dep.vulnerabilityCount || 0}\n- Critical: ${dep.critical || 0}\n- High: ${dep.high || 0}`);
    }
    if (allowedModules.includes('15')) {
        const gov = filteredReport.governance || {};
        execSections.push(`## Governance\n- License headers: ${gov.licenseHeaders || 0}\n- Copyright notices: ${gov.copyrightNotices || 0}`);
    }
    if (allowedModules.includes('16')) {
        const junk = filteredReport.junkFiles || {};
        execSections.push(`## Junk & Temporary Files\n- Junk / temp files: ${junk.fileCount || 0}`);
    }
    // New modules in executive summary
    if (allowedModules.includes('17')) {
        const ar = filteredReport.aiResidue || {};
        execSections.push(`## AI Residue\n- AI residue hits: ${ar.aiResidueHits || 0}`);
    }
    if (allowedModules.includes('18')) {
        const perf = filteredReport.performance || {};
        execSections.push(`## Performance\n- Performance anti-patterns: ${perf.performanceHits || 0}`);
    }
    if (allowedModules.includes('19')) {
        const ts = filteredReport.typeSafety || {};
        execSections.push(`## Type Safety\n- Type safety gaps: ${ts.typeSafetyHits || 0}`);
    }
    if (allowedModules.includes('20')) {
        const doc = filteredReport.documentation || {};
        execSections.push(`## Documentation\n- Documentation gaps: ${doc.documentationHits || 0}`);
    }
    if (allowedModules.includes('21')) {
        const tc = filteredReport.testCoverage || {};
        execSections.push(`## Test Coverage\n- Test coverage gaps: ${tc.testCoverageHits || 0}`);
    }
    if (allowedModules.includes('22')) {
        const a11y = filteredReport.accessibility || {};
        execSections.push(`## Accessibility\n- Accessibility gaps: ${a11y.accessibilityHits || 0}`);
    }
    if (allowedModules.includes('23')) {
        const i18n = filteredReport.i18n || {};
        execSections.push(`## i18n Readiness\n- i18n issues: ${i18n.i18nHits || 0}`);
    }
    if (allowedModules.includes('24')) {
        const sd = filteredReport.sensitiveData || {};
        execSections.push(`## Sensitive Data\n- Sensitive data exposures: ${sd.sensitiveDataHits || 0}`);
    }
    if (allowedModules.includes('25')) {
        const cd = filteredReport.configDrift || {};
        execSections.push(`## Config Drift\n- Configuration drifts: ${cd.configDriftHits || 0}`);
    }
    if (allowedModules.includes('26')) {
        const sh = filteredReport.securityHeaders || {};
        execSections.push(`## Security Headers\n- Security header references: ${sh.securityHeadersHits || 0}`);
    }
    if (allowedModules.includes('27')) {
        const db = filteredReport.databasePatterns || {};
        execSections.push(`## Database Patterns\n- Database anti-patterns: ${db.databasePatternsHits || 0}`);
    }
    if (allowedModules.includes('28')) {
        const fw = filteredReport.frameworkPractices || {};
        execSections.push(`## Framework Practices\n- Framework issues: ${fw.frameworkPracticesHits || 0}`);
    }
    if (allowedModules.includes('29')) {
        const wh = filteredReport.workspaceHealth || {};
        execSections.push(`## Workspace Health\n- Workspace issues: ${wh.workspaceHealthHits || 0}`);
    }
    if (allowedModules.includes('30')) {
        const ud = filteredReport.unusedDeps || {};
        execSections.push(`## Unused Dependencies\n- Unused dependency flags: ${ud.unusedDepsHits || 0}`);
    }
    if (allowedModules.includes('31')) {
        const ac = filteredReport.apiContract || {};
        execSections.push(`## API Contract\n- API contract drifts: ${ac.apiContractHits || 0}`);
    }
    if (allowedModules.includes('32')) {
        const cx = filteredReport.complexity || {};
        execSections.push(`## Complexity Metrics\n- High complexity patterns: ${cx.complexityHits || 0}`);
    }
    if (execSections.length) {
        const execMd = `# Executive Summary\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n**Grade:** ${grade}\n**Quality Score:** ${qs}/100\n**Gate:** ${gateLabel}\n**Modules Included:** ${allowedModules.length} of 61\n\n---\n\n${execSections.join('\n\n---\n\n')}\n`;
        zip.file('executive-summary.md', execMd);
    }

    let createdModules = 0;
    for (const mod of allowedModules) {
        const data = perModuleData[mod];
        const cleanData = data ? Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null)) : {};
        if (Object.keys(cleanData).length === 0) {
            cleanData._note = 'Module enabled by token but no scan data available in this report.';
        }
        zip.file(`module-${mod}.json`, JSON.stringify(cleanData, null, 2));
        createdModules++;
    }


    zip.file('manifest.json', JSON.stringify({
        generator: 'SimpleBeacon Sovereign Engine v1.4.0',
        timestamp: isoDate,
        certificateId: certId,
        tokenPrefix: token.slice(0,8) + '...',
        reportIntegrity: reportHash,
        localOnly: true,
        zeroUpload: true,
        includedModules: allowedModules
    }, null, 2));

    try {
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/zip',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        if (!zipBlob || zipBlob.size === 0) {
            throw new Error('ZIP generation produced empty file');
        }
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simplebeacon-certificate-${isoDate.slice(0,10)}.zip`;
        a.style.display = 'none';
        document.body.appendChild(a);
        try { a.click(); } catch (e) { window.open(url, '_blank'); }
        // Revoke after 30s to ensure download completes
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 30000);
    } catch (zipErr) {
        throw new Error('Failed to generate certificate ZIP: ' + (zipErr.message || zipErr));
    }
}

let __certGenerating = false;
async function doGenerateCertificate(buttonEl) {
    if (__certGenerating) {
        showToast('Certificate generation already in progress...', 'info');
        return;
    }
    __certGenerating = true;
    const token = licenseInput ? licenseInput.value.trim() : '';
    const tokenError = document.getElementById('tokenError');
    if (tokenError) tokenError.classList.add('hidden-display');
    if (!reportData) {
        __certGenerating = false;
        showToast('No scan report loaded. Upload a JSON || run a browser scan first.', 'error');
        showStatus('No report data. Upload || scan first.', 'error');
        return;
    }

    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.classList.add('btn-loading');
    }
    showStatus('Generating certificate locally in browser sandbox...', 'loading');

    try {
        const creds = (typeof getCertificateCredentials === 'function') ? getCertificateCredentials() : {};
        await generateSovereignCertificate(reportData, token, creds);
        updateStepper();
        const CERT_TOAST_DURATION = 6000;
        showToast('Certificate ZIP downloaded — generated entirely in your browser!', 'success', CERT_TOAST_DURATION);
        showStatus('Certificate ZIP generated locally! Zero bytes uploaded to any server.', 'success');
    } catch (err) {
        const errMsg = (err && err.message) || (typeof err === 'string' ? err : JSON.stringify(err));
        appendTerminalLine(`Certificate generation failed: ${errMsg || 'Unknown error'}`, 'error');
        showToast(errMsg || 'Certificate generation failed', 'error');
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = '';
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
            const span = document.createElement('span');
            span.textContent = errMsg || 'Unknown error';
            const btn = document.createElement('button');
            btn.id = 'retryCertBtn';
            btn.style.cssText = 'padding:6px 14px;background:var(--accent);color:white;border:none;border-radius:6px;font-size:0.8rem;font-weight:600;cursor:pointer;';
            btn.textContent = 'Retry';
            wrap.appendChild(span);
            wrap.appendChild(btn);
            statusEl.appendChild(wrap);
            statusEl.className = 'status error';
            statusEl.style.display = 'block';
            btn.addEventListener('click', () => {
                doGenerateCertificate(buttonEl);
            });
        }
    } finally {
        __certGenerating = false;
        if (buttonEl) {
            buttonEl.disabled = false;
            buttonEl.classList.remove('btn-loading');
        }
    }
}

if (typeof window !== 'undefined') {
    window.generateSovereignCertificate = generateSovereignCertificate;
    window.doGenerateCertificate = doGenerateCertificate;
}
