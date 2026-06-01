/**
 * Offline vector fingerprint matching — Tier 1c enhancement.
 * Maps structural features to precomputed AI-slop behavior vectors.
 */

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', 'vector-cache', 'default-fingerprints.json');

let cachedFingerprints = null;

function loadFingerprints(customPath) {
    if (cachedFingerprints && !customPath) return cachedFingerprints;

    const cachePath = customPath || CACHE_PATH;
    try {
        const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        cachedFingerprints = raw.fingerprints || [];
        return cachedFingerprints;
    } catch {
        return [];
    }
}

function extractFeatureVector(content, structuralFindings = []) {
    const genericNames = 'data|result|output|temp|info|val|payload|obj|res';
    const genericAssigns = (content.match(new RegExp(`\\b(${genericNames})\\s*=`, 'gi')) || []).length;
    const tryBlocks = (content.match(/\btry\s*[\{:]/g) || []).length;
    const passHandlers = (content.match(/\bpass\b|\bcatch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
    const literalReturns = (content.match(/\breturn\s+(\{|\[|[\"'`\d])/g) || []).length;
    const genericReturns = (content.match(new RegExp(`\\breturn\\s+(${genericNames})\\b`, 'gi')) || []).length;
    const dictAssigns = (content.match(new RegExp(`\\b(${genericNames})\\s*=\\s*\\{`, 'gi')) || []).length;
    const credentialKeys = (content.match(/['"]?(secret|token|pass|key|api_key)['"]?\s*:/gi) || []).length;
    const placeholderVals = (content.match(/your_|changeme|placeholder/gi) || []).length;
    const hollowFindings = structuralFindings.filter((f) => f.id === 'SB-INTENT-001').length;
    const credFindings = structuralFindings.filter((f) => f.id === 'SB-INTENT-002').length;

    const total = Math.max(content.split('\n').length, 1);
    return [
        Math.min(genericAssigns / total, 1),
        Math.min(credentialKeys / total, 1),
        Math.min(tryBlocks / total, 1),
        Math.min(passHandlers / total, 1),
        Math.min((literalReturns + genericReturns + dictAssigns) / total, 1),
        Math.min(placeholderVals / total, 1),
        Math.min(hollowFindings, 1),
        Math.min(credFindings, 1)
    ];
}

function dotProduct(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
        sum += a[i] * b[i];
    }
    return sum;
}

function magnitude(v) {
    return Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
}

function cosineSimilarity(a, b) {
    return dotProduct(a, b) / (magnitude(a) * magnitude(b));
}

function matchFingerprints(content, structuralFindings = [], options = {}) {
    const fingerprints = loadFingerprints(options.fingerprintCachePath);
    if (!fingerprints.length) return [];

    const features = extractFeatureVector(content, structuralFindings);
    const matches = [];

    for (const fp of fingerprints) {
        const score = cosineSimilarity(features, fp.vector);
        if (score >= (fp.threshold ?? 0.65)) {
            matches.push({
                fingerprintId: fp.id,
                label: fp.label,
                score: Math.round(score * 1000) / 1000,
                features
            });
        }
    }

    return matches.sort((a, b) => b.score - a.score);
}

function fingerprintFindings(content, structuralFindings, filePath, options = {}) {
    const matches = matchFingerprints(content, structuralFindings, options);
    const { INTENT_RULE_IDS } = require('./constants');

    return matches.map((match) => ({
        id: INTENT_RULE_IDS.FINGERPRINT_MATCH,
        severity: match.score >= 0.8 ? 'medium' : 'low',
        category: 'AI Slop Fingerprint Match',
        type: 'Structural Intent',
        description: `Structural profile matches known AI-slop pattern '${match.label}' (similarity ${match.score}).`,
        filePath,
        line: null,
        pattern: INTENT_RULE_IDS.FINGERPRINT_MATCH,
        metadata: {
            ruleId: INTENT_RULE_IDS.FINGERPRINT_MATCH,
            engine: 'vector-cache',
            fingerprintId: match.fingerprintId,
            similarity: match.score
        }
    }));
}

module.exports = {
    loadFingerprints,
    extractFeatureVector,
    matchFingerprints,
    fingerprintFindings,
    cosineSimilarity
};
