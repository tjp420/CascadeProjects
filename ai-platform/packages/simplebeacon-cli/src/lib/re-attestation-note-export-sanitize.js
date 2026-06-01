/**
 * Sanitize warranty re-attestation cover-letter metadata for operator ZIP exports.
 */

const { redactProjectPathForExport, projectLabelFromPath } = require('./assessment-export-sanitize');

const RE_ATTESTATION_PRODUCT_SKUS = {
    warranty199: 'warranty199',
    agency1499: 'agency1499'
};

function resolveCurrentGateSnapshot(gateReport) {
    if (!gateReport?.gate) return null;
    const jestExecuted = gateReport.jestBaselineChecked !== false
        && gateReport.scanScope?.jestExecutedDuringScan !== false;
    return {
        pass: Boolean(gateReport.gate.pass),
        blockingCount: gateReport.gate.blockingCount ?? gateReport.issueCount ?? null,
        ruleScopedFilesAnalyzed: gateReport.ruleScopedFilesAnalyzed
            ?? gateReport.scanScope?.ruleScopedFilesAnalyzed
            ?? null,
        repositoryFilesTotal: gateReport.repositoryFilesTotal
            ?? gateReport.repositoryInventory?.totalFiles
            ?? null,
        qualityScore: gateReport.qualityScore ?? null,
        jestBaselineChecked: jestExecuted,
        generatedAt: gateReport.generatedAt || gateReport.scannedAt || null
    };
}

function resolveGateInventoryTotals(gateReport, currentGate = null, hygiene = null) {
    const repositoryFilesTotal = currentGate?.repositoryFilesTotal
        ?? gateReport?.repositoryFilesTotal
        ?? gateReport?.repositoryInventory?.totalFiles
        ?? hygiene?.gateRepositoryFilesTotal
        ?? hygiene?.repositoryFilesTotal
        ?? null;
    const ruleScopedFilesAnalyzed = currentGate?.ruleScopedFilesAnalyzed
        ?? gateReport?.ruleScopedFilesAnalyzed
        ?? gateReport?.scanScope?.ruleScopedFilesAnalyzed
        ?? hygiene?.ruleScopedFilesAnalyzed
        ?? null;
    const credentialScanned = gateReport?.credentialScanned
        ?? gateReport?.productionLeakScanned
        ?? gateReport?.scanScope?.productionDirsScanned
        ?? hygiene?.credentialScanned
        ?? hygiene?.contentFilesScanned
        ?? null;
    return { repositoryFilesTotal, ruleScopedFilesAnalyzed, credentialScanned };
}

function resolveReAttestationGateContext(payload, options = {}) {
    const gateReport = options.gateReport || {};
    const hygiene = payload?.hygieneSummary || {};
    const scanScope = payload?.scanScope || {};
    const currentGate = resolveCurrentGateSnapshot(gateReport)
        ?? (payload?.currentGate && typeof payload.currentGate === 'object' ? payload.currentGate : null);
    const { repositoryFilesTotal, ruleScopedFilesAnalyzed, credentialScanned } = resolveGateInventoryTotals(
        gateReport,
        currentGate,
        hygiene
    );
    const contentScanned = gateReport.scanScope?.fullDirectoryStats?.contentScanned
        ?? gateReport.scanScope?.fullDirectoryStats?.filesContentScanned
        ?? gateReport.credentialScanned
        ?? gateReport.productionLeakScanned
        ?? hygiene.contentFilesScanned
        ?? hygiene.credentialScanned
        ?? null;
    const gateProfile = gateReport.scanScope?.profile
        ?? scanScope.gateRuleBundleProfile
        ?? hygiene.gateRuleBundleProfile
        ?? null;
    const fictionJsonFilesScanned = gateReport.fictionJsonFilesScanned
        ?? gateReport.scanScope?.fictionJsonFilesScanned
        ?? hygiene.fictionJsonFilesScanned
        ?? null;
    const fictionSampleFilesScanned = gateReport.fictionSampleFilesScanned
        ?? gateReport.mockSampleFiles
        ?? gateReport.scanScope?.fictionSampleFilesScanned
        ?? hygiene.fictionSampleFilesScanned
        ?? null;
    const gatePass = currentGate?.pass ?? hygiene.gatePass ?? gateReport.gate?.pass ?? null;
    const blockingCount = currentGate?.blockingCount
        ?? hygiene.blockingCount
        ?? gateReport.gate?.blockingCount
        ?? gateReport.issueCount
        ?? null;
    const qualityScore = currentGate?.qualityScore ?? hygiene.qualityScore ?? gateReport.qualityScore ?? null;
    const jestBaselineChecked = currentGate?.jestBaselineChecked === false
        || hygiene.jestBaselineChecked === false
        || gateReport.jestBaselineChecked === false
        || gateReport.scanScope?.jestExecutedDuringScan === false
        ? false
        : (currentGate?.jestBaselineChecked ?? hygiene.jestBaselineChecked ?? true);
    const generatedAt = currentGate?.generatedAt ?? hygiene.gateGeneratedAt ?? gateReport.generatedAt ?? null;
    const effectiveGateReport = Object.keys(gateReport).length > 0 ? gateReport : {
        gate: { pass: gatePass, blockingCount },
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        credentialScanned,
        fictionJsonFilesScanned,
        fictionSampleFilesScanned,
        qualityScore,
        jestBaselineChecked,
        generatedAt,
        ...(gateProfile ? { scanScope: { profile: gateProfile } } : {})
    };
    const resolvedCurrentGate = currentGate ?? (gatePass != null ? {
        pass: gatePass,
        blockingCount,
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        qualityScore,
        jestBaselineChecked,
        generatedAt
    } : null);
    return {
        gateReport: effectiveGateReport,
        currentGate: resolvedCurrentGate,
        repositoryFilesTotal,
        ruleScopedFilesAnalyzed,
        credentialScanned,
        contentScanned,
        gateProfile,
        fictionJsonFilesScanned,
        fictionSampleFilesScanned,
        gatePass,
        blockingCount,
        qualityScore,
        jestBaselineChecked,
        generatedAt
    };
}

function buildReAttestationHygieneSummary(tierId, payload, options = {}) {
    const gateContext = resolveReAttestationGateContext(payload, options);
    const { currentGate, repositoryFilesTotal, ruleScopedFilesAnalyzed, credentialScanned, contentScanned,
        gateProfile, fictionJsonFilesScanned, fictionSampleFilesScanned, gatePass, blockingCount,
        qualityScore, jestBaselineChecked, generatedAt } = gateContext;
    return {
        workflowStatus: tierId === 'operator' ? 'reference-only' : 'awaiting-operator-comparison',
        gatePass: currentGate?.pass ?? gatePass ?? null,
        blockingCount: currentGate?.blockingCount ?? blockingCount ?? null,
        ruleScopedFilesAnalyzed,
        repositoryFilesTotal,
        ...(repositoryFilesTotal != null ? { gateRepositoryFilesTotal: repositoryFilesTotal } : {}),
        qualityScore: currentGate?.qualityScore ?? qualityScore ?? null,
        ...(credentialScanned != null ? { credentialScanned } : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        ...(repositoryFilesTotal != null && credentialScanned != null && repositoryFilesTotal > credentialScanned
            ? { gateMetadataOnlyFiles: repositoryFilesTotal - credentialScanned }
            : {}),
        ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
        ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        jestBaselineChecked: currentGate?.jestBaselineChecked ?? jestBaselineChecked,
        gateGeneratedAt: currentGate?.generatedAt ?? generatedAt ?? null,
        attestationNote: tierId === 'operator'
            ? 'Re-attestation workflow template — not a completed warranty deliverable or vendor handoff.'
            : 'Re-attestation comparison metadata — verify against original clearance499 PDF before delivery.'
    };
}

function buildReAttestationScanScope(scanScope, tierId, payload, options = {}) {
    const gateContext = resolveReAttestationGateContext(payload, options);
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    return {
        ...(scanScope || {}),
        resultsViewScope: 're-attestation-workflow-metadata',
        securityHandoffEligible: false,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        workflowNote: tierId === 'operator'
            ? (scanScope?.workflowNote
                || payload?.scanScope?.workflowNote
                || 'Reference template for warranty199/agency1499 — compare bundled gate to original clearance499 PDF.')
            : 'Warranty re-attestation workflow — compare currentGate to original clearance PDF before delivery.'
    };
}

function buildReAttestationExportNotes(tierId, gateContext = {}) {
    const notes = [
        'Absolute scan paths are redacted to project label in operator exports.',
        'securityHandoffEligible is false — this JSON is workflow cover-letter metadata, not a completed vendor security handoff.'
    ];
    if (tierId === 'operator') {
        notes.unshift(
            'Operator vault export includes this template for warranty199/agency1499 workflows — it is not itself a completed re-attestation deliverable.'
        );
    } else if (tierId === 'warranty199' || tierId === 'agency1499') {
        notes.unshift(
            'Compare currentGate to the original clearance499 PDF before issuing the re-attestation cover letter.'
        );
    }
    const gate = gateContext.currentGate;
    const gateReport = gateContext.gateReport || {};
    const { repositoryFilesTotal, credentialScanned, gateProfile, fictionJsonFilesScanned,
        fictionSampleFilesScanned, gatePass, blockingCount } = gateContext;
    const gateProfileResolved = gateProfile ?? gateReport?.scanScope?.profile ?? null;
    if (gate) {
        notes.push(
            `currentGate reflects the bundled scan at export time (pass=${gate.pass}, blocking=${gate.blockingCount ?? 'unknown'}).`
        );
        if (gatePass === false && (blockingCount ?? 0) > 0) {
            notes.push(
                `Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) — re-attestation template compares bundled gate only; see json/simplebeacon-gate.json for production-path evidence.`
            );
        }
        if (gate.repositoryFilesTotal != null && gate.ruleScopedFilesAnalyzed != null
            && gate.repositoryFilesTotal === gate.ruleScopedFilesAnalyzed) {
            notes.push(
                `Full-tree gate inventory — repository and rule-scoped counts both ${Number(gate.repositoryFilesTotal).toLocaleString()} paths.`
            );
        }
        if (repositoryFilesTotal != null && credentialScanned != null && credentialScanned < repositoryFilesTotal) {
            notes.push(
                `CRED/LEAK rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(repositoryFilesTotal - credentialScanned).toLocaleString()} metadata-only path(s) in gate inventory of ${Number(repositoryFilesTotal).toLocaleString()}.`
            );
        }
        if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null
            && fictionJsonFilesScanned > fictionSampleFilesScanned) {
            notes.push(
                `DATA-002 evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) — ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched.`
            );
        }
        if (gateProfileResolved) {
            notes.push(`Gate rule bundle profile: ${gateProfileResolved} — compare bundled gate to original clearance499 scan profile before re-attestation sign-off.`);
        }
        if (gate.jestBaselineChecked === false) {
            notes.push('Bundled gate did not run Jest — compare test attestation separately before warranty re-attestation sign-off.');
        }
        if (tierId === 'operator') {
            notes.push('For full gate metrics use json/simplebeacon-gate.json bundled in this operator ZIP.');
        }
    } else {
        notes.push('No gate report was bundled — attach json/simplebeacon-gate.json before operator comparison.');
    }
    return [...new Set(notes)].slice(0, 12);
}

function resolveReAttestationMessage(tierId) {
    if (tierId === 'warranty199' || tierId === 'agency1499') {
        return 'Post-handoff warranty re-scan cover letter metadata. Compare currentGate to the original clearance PDF before delivery.';
    }
    return 'Workflow metadata for warranty199/agency1499 re-attestation deliverables (not a completed re-attestation).';
}

/**
 * @param {object} payload
 * @param {{ projectPath?: string, gateReport?: object, tierId?: string }} [options]
 * @returns {object}
 */
function sanitizeReAttestationNoteArtifactExport(payload, options = {}) {
    if (!payload || payload.type !== 'simplebeacon-re-attestation-note') return payload;

    const tierId = options.tierId || payload.tier || 'operator';
    const rawPath = options.projectPath || payload.projectPath || payload.originalProject || '';
    const label = projectLabelFromPath(rawPath);
    const gateContext = resolveReAttestationGateContext(payload, options);
    const { currentGate } = gateContext;

    return {
        type: 'simplebeacon-re-attestation-note',
        generatedAt: payload.generatedAt || new Date().toISOString(),
        tier: tierId,
        productSku: RE_ATTESTATION_PRODUCT_SKUS[tierId] || null,
        purpose: 'warranty-re-scan-workflow-metadata',
        workflowStatus: tierId === 'operator' ? 'reference-only' : 'awaiting-operator-comparison',
        message: resolveReAttestationMessage(tierId),
        projectPath: redactProjectPathForExport(rawPath, label),
        currentGate,
        exportNormalized: true,
        exportSanitized: true,
        scanTargetProfile: 'product',
        securityHandoffEligible: false,
        handoffEligible: false,
        scanScope: buildReAttestationScanScope(payload.scanScope, tierId, payload, options),
        hygieneSummary: buildReAttestationHygieneSummary(tierId, payload, options),
        exportNotes: buildReAttestationExportNotes(tierId, gateContext)
    };
}

/**
 * Build raw re-attestation note payload before export sanitization.
 * @param {{ tierId?: string, projectPath?: string, gateReport?: object, generatedAt?: string }} [options]
 * @returns {object}
 */
function buildReAttestationNoteArtifact(options = {}) {
    const tierId = options.tierId || 'operator';
    return sanitizeReAttestationNoteArtifactExport({
        type: 'simplebeacon-re-attestation-note',
        generatedAt: options.generatedAt || new Date().toISOString(),
        tier: tierId,
        message: resolveReAttestationMessage(tierId),
        originalProject: options.projectPath || null
    }, {
        tierId,
        projectPath: options.projectPath,
        gateReport: options.gateReport,
        repositoryFilesTotal: options.repositoryFilesTotal ?? options.gateReport?.repositoryFilesTotal ?? null
    });
}

module.exports = {
    sanitizeReAttestationNoteArtifactExport,
    buildReAttestationNoteArtifact,
    buildReAttestationHygieneSummary,
    buildReAttestationScanScope,
    resolveReAttestationGateContext,
    resolveCurrentGateSnapshot,
    resolveGateInventoryTotals
};
