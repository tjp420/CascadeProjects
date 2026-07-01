/**
 * Engine resolution and filtering for export bundles.
 */

const { normalizeCompleteScanInput } = require('../complete-scan-audit-report.cjs');
const { detectScanKind } = require('./utils.cjs');
const { EU_AI_ACT_ARTIFACT_IDS, ARTIFACT_ENGINE_REQUIREMENTS } = require('./constants.cjs');

function resolveEnginesRun(payload, options = {}) {
    if (Array.isArray(options.enginesRun) && options.enginesRun.length) {
        return options.enginesRun;
    }
    if (Array.isArray(payload?.enginesRun) && payload.enginesRun.length) {
        return payload.enginesRun;
    }
    if (Array.isArray(payload?.analysisConfig?.enginesRun) && payload.analysisConfig.enginesRun.length) {
        return payload.analysisConfig.enginesRun;
    }
    if (Array.isArray(payload?.steps) && payload.steps.length) {
        return payload.steps.map((step) => step?.id).filter(Boolean);
    }
    return [];
}

function resolveSelectedEnginesForExport(payload, options = {}) {
    if (Array.isArray(options.selectedEngines) && options.selectedEngines.length) {
        return [...new Set(options.selectedEngines.filter(Boolean))];
    }
    const fromPayload = payload?.enginesRun || payload?.analysisConfig?.selectedEngines || payload?.selectedEngines;
    if (Array.isArray(fromPayload) && fromPayload.length) {
        return [...new Set(fromPayload.filter(Boolean))];
    }
    return null;
}

function filterCompleteScanForEngines(completeScan, engineIds = []) {
    if (!completeScan || typeof completeScan !== 'object') return completeScan;
    if (!Array.isArray(engineIds) || !engineIds.length) return completeScan;

    const selected = new Set(engineIds);
    const normalized = normalizeCompleteScanInput(completeScan) || completeScan;
    const results = { ...(normalized.results || {}) };

    const enginesRun = (normalized.enginesRun || normalized.analysisConfig?.enginesRun || [])
        .filter((id) => selected.has(id));
    const filteredEnginesRun = enginesRun.length
        ? enginesRun
        : engineIds.filter((id) => selected.has(id));

    const steps = Array.isArray(normalized.steps)
        ? normalized.steps.filter((step) => selected.has(step?.id))
        : normalized.steps;

    return {
        ...normalized,
        enginesRun: filteredEnginesRun,
        analysisConfig: {
            ...(normalized.analysisConfig || {}),
            selectedEngines: engineIds,
            enginesRun: filteredEnginesRun
        },
        steps,
        results
    };
}

function artifactAllowedForEngines(artifactId, engineSet, { includeEuAiAct = false, scanKind = 'unknown' } = {}) {
    if (artifactId === 'complete-scan-bundle') {
        return scanKind === 'complete';
    }
    if (EU_AI_ACT_ARTIFACT_IDS.has(artifactId)) {
        return includeEuAiAct && engineSet.has('eu-ai-act');
    }
    const required = ARTIFACT_ENGINE_REQUIREMENTS[artifactId];
    if (!required) return true;
    return required.some((engineId) => engineSet.has(engineId));
}

function shouldIncludeEuAiActArtifacts(payload, options = {}) {
    if (options.includeEuAiAct === false) return false;
    if (options.includeEuAiAct === true) return true;

    const kind = detectScanKind(payload);
    if (kind === 'eu-ai-act') return true;

    const enginesRun = resolveEnginesRun(payload, options);
    if (enginesRun.includes('eu-ai-act')) return true;

    if (payload?.results?.sprint || payload?.sprint) return true;

    return false;
}

module.exports = {
    resolveEnginesRun,
    resolveSelectedEnginesForExport,
    filterCompleteScanForEngines,
    artifactAllowedForEngines,
    shouldIncludeEuAiActArtifacts
};
