const fs = require('fs');
const path = require('path');

const edits = [
    ['server/routes/upload.js', [
        [/const archiver = require\('archiver'\);\n/, ''],
        [/async function processUploadedFiles\(files, user\)/, 'async function processUploadedFiles(files, _user)'],
        [/async function analyzeGitRepository\(tempDir, repoInfo, user\)/, 'async function analyzeGitRepository(tempDir, repoInfo, _user)'],
        [/async function handleGitHubIntegration\(repoUrl, accessToken, user\)/, 'async function handleGitHubIntegration(_repoUrl, _accessToken, _user)'],
        [/async function handleGitLabIntegration\(repoUrl, accessToken, user\)/, 'async function handleGitLabIntegration(_repoUrl, _accessToken, _user)'],
        [/async function handleBitbucketIntegration\(repoUrl, accessToken, user\)/, 'async function handleBitbucketIntegration(_repoUrl, _accessToken, _user)']
    ]],
    ['server/index.js', [
        [/function sendSimplebeaconDashboard\(res\) \{\n  res\.sendFile\(path\.join\(webRoot, 'simplebeacon-dashboard\/index\.html'\)\);\n\}\n\n/, ''],
        [/function analyzeFileContent\(content, filename\) \{\n  const lines = content\.split\('\\n'\);\n/, 'function analyzeFileContent(content, filename) {\n'],
        [/function getMockFileType\(filename, content\)/, 'function getMockFileType(filename, _content)'],
        [/  const severity = issues\.length > 0 \? issues\[0\]\.severity : 'info';\n\n  return \{/, '  return {'],
        [/function analyzeFileStatus\(content, filename\)/, 'function analyzeFileStatus(content, _filename)'],
        [/app\.use\(\(err, req, res, next\) => \{/, 'app.use((err, req, res, _next) => {']
    ]],
    ['server/routes/flexible-analyze-api.js', [
        [/async function buildAnalyzeResponsePayload\(report, opts\)/, 'async function buildAnalyzeResponsePayload(report, _opts)']
    ]],
    ['server/api/analysis/AnalysisRoutes.js', [
        [/\(err, req, res, next\) => \{/, '(err, req, res, _next) => {']
    ]],
    ['server/middleware/analysisMiddleware.js', [
        [/\(err, req, res, next\) => \{/, '(err, req, res, _next) => {']
    ]],
    ['server/api/ai/AIRoadmapController.js', [
        [/const path = require\('path'\);\n/, '']
    ]],
    ['server/config/sso-providers.js', [
        [/const crypto = require\('crypto'\);\n/, '']
    ]],
    ['server/lib/universal-language-detector.js', [
        [/const path = require\('path'\);\n/, '']
    ]],
    ['server/services/model-inference-service.js', [
        [/const \{ formatBytes \} = require\('\.\.\/lib\/mock-data-scanner'\);\n/, '']
    ]],
    ['server/services/sso-service.js', [
        [/const axios = require\('axios'\);\n/, '']
    ]],
    ['server/middleware/security.js', [
        [/const \{ createError \} = require\('http-errors'\);\n/, '']
    ]],
    ['server/middleware/compliance.js', [
        [/const fs = require\('fs'\);\n/, '']
    ]],
    ['server/middleware/upload-security.js', [
        [/const crypto = require\('crypto'\);\n/, ''],
        [/const \{ createHash \} = require\('crypto'\);\n/, '']
    ]],
    ['server/middleware/sso.js', [
        [/const passportAzureAD = require\('passport-azure-ad'\);\n/, ''],
        [/const crypto = require\('crypto'\);\n/, '']
    ]],
    ['server/lib/code-understanding/zscript-structure-analyzer.js', [
        [/function extractMethods\(/, 'function _extractMethods(']
    ]],
    ['server/lib/complete-scan-audit-report.js', [
        [/function formatReportDate\(/, 'function _formatReportDate('],
        [/function renderFindingRows\(/, 'function _renderFindingRows('],
        [/function buildFullHtmlReport\(fullHtml\)/, 'function buildFullHtmlReport(_fullHtml)']
    ]],
    ['server/dashboard-server.js', [
        [/function getSecurityFindings\(/, 'function _getSecurityFindings('],
        [/function getPerformanceFindings\(/, 'function _getPerformanceFindings('],
        [/function getQualityFindings\(/, 'function _getQualityFindings('],
        [/function generateMockFilePath\(/, 'function _generateMockFilePath('],
        [/function generateMockLineNumber\(/, 'function _generateMockLineNumber('],
        [/function generateMockConfidence\(/, 'function _generateMockConfidence(']
    ]]
];

const root = path.join(__dirname, '..');
for (const [rel, reps] of edits) {
    const file = path.join(root, rel);
    let text = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const [from, to] of reps) {
        const next = text.replace(from, to);
        if (next !== text) {
            text = next;
            changed = true;
        }
    }
    if (changed) fs.writeFileSync(file, text);
    console.log(changed ? 'updated' : 'skipped', rel);
}
