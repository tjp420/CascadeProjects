/**
 * Intent scan orchestrator — combines Tier 1a/1b/1c and optional Tier 2 SLM.
 */

const path = require('path');
const { LANGUAGE_BY_EXT } = require('./constants');
const { scanStructuralIntent } = require('./structural-intent-scanner');
const { fingerprintFindings } = require('./vector-cache');
const { scanWithTreeSitter } = require('./tree-sitter-queries');
const { getTreeSitterStatus } = require('./tree-sitter-loader');
const { probeSlmBin, runSlmReview } = require('./slm-bridge');

const ENGINE = '@simplebeacon/intelligence';

function resolveLanguage(filePath, options = {}) {
    if (options.language) return options.language;
    const ext = path.extname(String(filePath || '')).toLowerCase();
    return LANGUAGE_BY_EXT[ext] || 'javascript';
}

function isLanguageSupported(language, options = {}) {
    const allowed = options.languages || ['javascript', 'typescript', 'python', 'go'];
    return allowed.includes(language);
}

async function scanIntentAsync(content, options = {}) {
    const filePath = options.filePath || 'snippet.txt';
    const language = resolveLanguage(filePath, options);

    if (!isLanguageSupported(language, options)) {
        return {
            enabled: true,
            filePath,
            language,
            skipped: true,
            reason: `Language '${language}' not in intelligence.languages`,
            findingCount: 0,
            findings: [],
            engine: ENGINE
        };
    }

    const scanOptions = {
        ...options,
        filePath,
        language
    };

    let scanResult;
    const useTreeSitter = options.treeSitter !== false;

    if (useTreeSitter) {
        scanResult = await scanWithTreeSitter(content, scanOptions);
    } else {
        scanResult = {
            engine: 'structural',
            treeSitterUsed: false,
            findings: scanStructuralIntent(content, scanOptions)
        };
    }

    const findings = [...(scanResult.findings || [])];

    if (options.fingerprintMatch !== false) {
        findings.push(...fingerprintFindings(content, findings, filePath, options));
    }

    let slmReview = null;
    const highRisk = findings.some((f) => f.severity === 'high' || f.severity === 'medium');
    const slmEnabled = options.slm?.enabled === true || process.env.SIMPLEBEACON_SLM_ENABLED === '1';

    if (slmEnabled && highRisk) {
        slmReview = runSlmReview(content, { ...options, filePath });
    }

    const blockingCount = findings.filter(
        (f) => f.severity === 'high' || f.severity === 'critical'
    ).length;

    return {
        enabled: true,
        filePath,
        language,
        engine: scanResult.engine,
        treeSitterUsed: scanResult.treeSitterUsed === true,
        treeSitterStatus: getTreeSitterStatus(options),
        slm: slmReview || { enabled: slmEnabled, reviewed: false, note: slmEnabled ? 'No high-risk findings to review' : probeSlmBin(options) },
        findingCount: findings.length,
        blockingCount,
        findings,
        localOnly: true,
        methodology: 'Deterministic structural intent — optional local SLM on flagged snippets only'
    };
}

function scanIntent(content, options = {}) {
    const filePath = options.filePath || 'snippet.txt';
    const language = resolveLanguage(filePath, options);

    if (!isLanguageSupported(language, options)) {
        return {
            enabled: true,
            filePath,
            language,
            skipped: true,
            reason: `Language '${language}' not in intelligence.languages`,
            findingCount: 0,
            findings: [],
            engine: 'structural'
        };
    }

    const scanOptions = { ...options, filePath, language };
    const findings = scanStructuralIntent(content, scanOptions);

    if (options.fingerprintMatch !== false) {
        findings.push(...fingerprintFindings(content, findings, filePath, options));
    }

    const blockingCount = findings.filter(
        (f) => f.severity === 'high' || f.severity === 'critical'
    ).length;

    return {
        enabled: true,
        filePath,
        language,
        engine: 'structural',
        treeSitterUsed: false,
        findingCount: findings.length,
        blockingCount,
        findings,
        localOnly: true,
        methodology: 'Deterministic structural intent (sync path)'
    };
}

module.exports = {
    scanIntent,
    scanIntentAsync,
    resolveLanguage,
    isLanguageSupported,
    engine: ENGINE
};
