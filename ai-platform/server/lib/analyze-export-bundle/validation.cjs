// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Tier validation and public-summary building for export bundles.
 */

const {
    getTierManifest,
    resolveDeliverableTier,
    DELIVERABLE_TIERS
} = require('../analyze-deliverable-access.cjs');
const {
    applyPublicGateToAnalyzeResponse,
    sanitizePublicOutput,
    sanitizePublicSummaryArtifactExport,
    sanitizeCompleteScanExport,
    projectLabelFromPath,
    redactProjectPathForExport
} = require('../simplebeacon-proxy.cjs');
const { detectScanKind } = require('./utils.cjs');

function enrichExportBundleManifest(manifest, { tierId, projectPath } = {}) {
    const label = projectLabelFromPath(projectPath);
    const redactedPath = redactProjectPathForExport(projectPath, label) || manifest.projectPath;
    const exportNotes = [
        'Operator vault ZIP — bundled JSON artifacts are path-redacted; not SimpleBeacon vendor security handoff clearance.',
        'securityHandoffEligible is false on all bundled scan JSON — vendor handoff requires paid deliverable tier exports.'
    ];
    if (tierId === 'operator') {
        exportNotes.push(
            'Includes complete engine JSON plus HTML print sources — technical hygiene only, not legal conformity certification.'
        );
    }
    return {
        ...manifest,
        projectPath: redactedPath,
        exportNormalized: true,
        exportSanitized: true,
        securityHandoffEligible: false,
        handoffEligible: false,
        exportNotes: exportNotes.slice(0, 5)
    };
}

function resolveCompleteScanExportBundle(normalized, projectPath) {
    if (!normalized || normalized.type !== 'simplebeacon-complete-scan') return normalized;
    return sanitizeCompleteScanExport(normalized, { projectPath });
}

function buildPublicSummary(completeScan) {
    const { detectScanKind } = require('./utils.cjs');
    const kind = detectScanKind(completeScan);
    const normalized = (kind === 'complete' && completeScan?.type === 'simplebeacon-complete-scan')
        ? completeScan
        : completeScan;
    const results = normalized?.results || {};
    const simplebeacon = results.simplebeacon || normalized;
    const projectPath = normalized?.projectPath || normalized?.projectRoot || '';
    const gated = applyPublicGateToAnalyzeResponse(simplebeacon || normalized);
    const publicBlock = gated?.publicSummary || sanitizePublicOutput(simplebeacon || normalized);

    return sanitizePublicSummaryArtifactExport({
        type: 'simplebeacon-public-summary',
        generatedAt: new Date().toISOString(),
        projectPath: projectPath || normalized?.projectPath || null,
        summary: publicBlock.summary || publicBlock,
        severityCounts: publicBlock.severityCounts || gated?.severityCounts || {},
        publicGateLocked: true,
        note: 'Detailed file paths and remediation steps require a paid deliverable tier.'
    }, {
        projectPath,
        gateReport: simplebeacon
    });
}

function validateScanForTier(tierId, scanKind) {
    const tier = DELIVERABLE_TIERS[tierId];
    if (!tier) return { ok: false, error: 'Unknown deliverable tier' };
    if (tier.requiresCompleteScan && scanKind !== 'complete') {
        return {
            ok: false,
            error: 'This deliverable tier requires Analyze → Complete (all ten engines). Run a complete scan and retry.'
        };
    }
    if (tier.minScanKind && !tier.minScanKind.includes(scanKind)) {
        return {
            ok: false,
            error: `Scan type "${scanKind}" does not match tier requirements. Expected one of: ${tier.minScanKind.join(', ')}.`
        };
    }
    return { ok: true };
}

module.exports = {
    enrichExportBundleManifest,
    resolveCompleteScanExportBundle,
    buildPublicSummary,
    validateScanForTier
};
