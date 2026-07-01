/**
 * Optional bridge to @simplebeacon/intelligence — never required for core gate.
 */

const path = require('path');

let cachedModule = null;
let loadAttempted = false;

function resolveIntelligencePaths() {
    return [
        '@simplebeacon/intelligence',
        path.join(__dirname, '..', '..', '..', 'simplebeacon-intelligence', 'src', 'index.js')
    ];
}

function loadIntelligenceModule() {
    if (loadAttempted) return cachedModule;
    loadAttempted = true;
    for (const modPath of resolveIntelligencePaths()) {
        try {
            cachedModule = require(modPath);
            return cachedModule;
        } catch {
            // try next path
        }
    }
    cachedModule = null;
    return null;
}

function isIntelligenceAvailable() {
    return loadIntelligenceModule() != null;
}

function getDefaultIntelligenceConfig() {
    return {
        enabled: false,
        languages: ['javascript', 'typescript', 'python'],
        sourcePaths: null,
        genericVarThreshold: 0.6,
        fingerprintMatch: true,
        treeSitter: { enabled: true },
        slm: { enabled: false, binPath: null, modelPath: null }
    };
}

function getIntelligenceOptions(config) {
    const defaults = getDefaultIntelligenceConfig();
    const intel = config?.intelligence || {};
    return {
        ...defaults,
        ...intel,
        treeSitter: { ...defaults.treeSitter, ...(intel.treeSitter || {}) },
        slm: { ...defaults.slm, ...(intel.slm || {}) }
    };
}

function scanIntelligenceLayer(content, options = {}) {
    const mod = loadIntelligenceModule();
    if (!mod) {
        return {
            enabled: false,
            available: false,
            findingCount: 0,
            blockingCount: 0,
            findings: [],
            note: 'Install @simplebeacon/intelligence for structural intent analysis'
        };
    }
    if (!options.intelligence?.enabled && options.enabled !== true && options.intelligence !== true) {
        return { enabled: false, available: true, findingCount: 0, blockingCount: 0, findings: [] };
    }
    const intelOpts = {
        ...options.intelligence,
        filePath: options.filePath,
        languages: options.intelligence?.languages,
        genericVarThreshold: options.intelligence?.genericVarThreshold,
        fingerprintMatch: options.intelligence?.fingerprintMatch,
        slm: options.intelligence?.slm,
        treeSitter: options.intelligence?.treeSitter
    };
    const result = mod.scanIntent(content, intelOpts);
    return { ...result, available: true };
}

async function scanIntelligenceLayerAsync(content, options = {}) {
    const mod = loadIntelligenceModule();
    if (!mod) {
        return {
            enabled: false,
            available: false,
            findingCount: 0,
            blockingCount: 0,
            findings: [],
            note: 'Install @simplebeacon/intelligence for structural intent analysis'
        };
    }
    if (!options.intelligence?.enabled && options.enabled !== true && options.intelligence !== true) {
        return { enabled: false, available: true, findingCount: 0, blockingCount: 0, findings: [] };
    }
    const intelOpts = {
        ...options.intelligence,
        filePath: options.filePath,
        languages: options.intelligence?.languages,
        genericVarThreshold: options.intelligence?.genericVarThreshold,
        fingerprintMatch: options.intelligence?.fingerprintMatch,
        slm: options.intelligence?.slm,
        treeSitter: options.intelligence?.treeSitter
    };
    if (typeof mod.scanIntentAsync === 'function') {
        const result = await mod.scanIntentAsync(content, intelOpts);
        return { ...result, available: true };
    }
    return scanIntelligenceLayer(content, options);
}

function runLocalSlmReview(content, options = {}) {
    const mod = loadIntelligenceModule();
    if (!mod?.runSlmReview) {
        return { enabled: false, reviewed: false, note: 'Install @simplebeacon/intelligence for local SLM review' };
    }
    return mod.runSlmReview(content, {
        ...options,
        filePath: options.filePath,
        slm: options.intelligence?.slm || options.slm,
        binPath: options.intelligence?.slm?.binPath || options.binPath,
        modelPath: options.intelligence?.slm?.modelPath || options.modelPath
    });
}

module.exports = {
    isIntelligenceAvailable,
    getIntelligenceOptions,
    scanIntelligenceLayerAsync,
    runLocalSlmReview
};
