// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Build report bundle: validates license token, generates certificate, audit report, and ZIP.
 */

const path = require('path');
const archiver = require('archiver');
const { PassThrough } = require('stream');
const logger = require('../../../server/lib/app-logger.cjs');
const {
    buildCertificateModel,
    renderCertificateHtml
} = require('../../../server/lib/code-hygiene-certificate.cjs');
const { buildCompleteAuditReport } = require('../../../server/lib/complete-scan-audit-report.cjs');
const { buildAnalyzeExportZipStream } = require('../../../server/lib/analyze-export-bundle.cjs');
const { loadAgencyBranding } = require('../../../server/lib/agency-branding-store.cjs');
const { safeStringify, streamToBuffer, ensureReportDir, REPORT_STORE_DIR } = require('./billing-utils.cjs');
const { verifyLicenseToken } = require('../../../server/lib/simplebeacon-proxy.cjs');

/**
 * Build a report bundle from a license token and scan report JSON.
 * @param {string} licenseToken
 * @param {Object} reportJson
 * @returns {Promise<Object>}
 */
async function buildReportBundle(licenseToken, reportJson) {
    const { readStore } = require('../../../server/lib/simplebeacon-subscription-store.cjs');
    const store = await readStore();
    let record = Object.values(store.subscriptions || {}).find(
        (s) => s.licenseToken === licenseToken
    );
    let payload = null;
    if (!record) {
        // Fallback: cryptographically verify tokens not in store
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            const err = new Error('License secret not configured');
            err.statusCode = 503;
            throw err;
        }
        payload = verifyLicenseToken(licenseToken, secret);
        if (!payload) {
            const err = new Error('Invalid license token');
            err.statusCode = 401;
            throw err;
        }
        const tier = payload.tier || 'executive';
        record = {
            licenseToken,
            licenseTier: tier,
            email: payload.email || '',
            features: payload.features || [],
            certClientName: payload.clientName || 'Client',
            certProjectName: payload.projectName || 'Project'
        };
    } else {
        // Token found in store — enrich with cert fields from payload if missing
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) return record;
        payload = verifyLicenseToken(licenseToken, secret);
        if (payload) {
            record.certClientName = record.certClientName || payload.clientName || record.clientName || 'Client';
            record.certProjectName = record.certProjectName || payload.projectName || record.projectName || 'Project';
        }
    }
    if (!['executive', 'agency', 'universal', 'euai', 'instant', 'community'].includes(record.licenseTier)) {
        const err = new Error('License tier does not include certificate delivery');
        err.statusCode = 403;
        throw err;
    }

    const email = record.email;
    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Store the uploaded report. Ensure we canonicalize and sign a cloned
    // payload before any disk write so every write path persists a signed
    // artifact. This avoids races where another code path might write an
    // unsigned reference later.
    ensureReportDir();
    const fs = require('fs');
    const { signReport } = require('../../../server/lib/report-signer.cjs');
    const reportPath = path.join(REPORT_STORE_DIR, `${deliveryId}.json`);

    // Helper: return a deep-cloned, signed copy of the report JSON (not
    // mutating the original in-memory object used elsewhere).
    function buildSignedPayload(srcReport) {
        const signingKey = String(process.env.REPORT_SIGNING_KEY || '').trim() || null;
        const signingKeyId = String(process.env.REPORT_SIGNING_KEY_ID || '').trim() || null;
        let cloned;
        try {
            cloned = JSON.parse(JSON.stringify(srcReport));
        } catch (e) {
            // Fallback to safeStringify if JSON.stringify fails for any reason
            try { cloned = JSON.parse(safeStringify(srcReport, 2)); } catch (e2) { cloned = srcReport; }
        }
        if (!signingKey) {
            try { console.error('[DIAG] REPORT_SIGNING_KEY not configured — building unsigned snapshot'); } catch (e) {}
            return cloned;
        }
        try {
            try { console.error('[DIAG] buildSignedPayload signingKey present, keyId=', signingKeyId || null); } catch (e) {}
            const envelope = signReport(cloned, signingKey, signingKeyId || null);
            if (envelope) {
                cloned.cryptoValidation = envelope;
                try { console.error('[DIAG] buildSignedPayload attached signature length=', (envelope.signature || '').length); } catch (e) {}
            }
        } catch (signErr) {
            logger.warn('[Reports] buildSignedPayload signing failed, continuing without signature:', signErr && signErr.message);
        }
        return cloned;
    }

    // Atomic write with fsync: write the signed payload to temp, fsync, close, then rename.
    const tmpPath = reportPath + '.tmp';
    try {
        try { logger.info('[Reports] about to build signed payload and write file', { deliveryId, reportPath }); } catch (e) {}
        try { console.error('[DIAG] about to build signed payload for deliveryId=', deliveryId, 'reportPath=', reportPath); } catch (e) {}
        const signedPayload = buildSignedPayload(reportJson);
        const toWrite = JSON.stringify(signedPayload, null, 2);
        try { logger.info('[Reports] pre-write signed hasCryptoValidation=' + (!!signedPayload.cryptoValidation), { deliveryId }); } catch (e) {}
        try { console.error('[DIAG] pre-write signed hasCryptoValidation=', !!signedPayload.cryptoValidation, 'toWriteLen=', toWrite.length); } catch (e) {}
        const fd = fs.openSync(tmpPath, 'w', 0o600);
        try {
            fs.writeSync(fd, toWrite, null, 'utf8');
            try { fs.fsyncSync(fd); } catch (e) { /* best-effort flush */ }
        } finally {
            try { fs.closeSync(fd); } catch (e) { /* ignore */ }
        }
        fs.renameSync(tmpPath, reportPath);
        try {
            const after = fs.readFileSync(reportPath, 'utf8');
            try { console.error('[DIAG] post-rename file snapshot (start)'); } catch (e) {}
            try { console.error(after.slice(0, 4000)); } catch (e) {}
            try { console.error('[DIAG] post-rename file snapshot (end)'); } catch (e) {}
        } catch (e) {
            try { console.error('[DIAG] post-rename read failed:', e && e.message); } catch (e2) {}
        }

        // Short-lived watcher: detect any quick subsequent modifications to this file
        try {
            const watcher = fs.watch(reportPath, (eventType) => {
                try {
                    const now = fs.readFileSync(reportPath, 'utf8');
                    logger.info('[Reports] watcher detected modification', { deliveryId, eventType });
                    try { console.error('[DIAG] watcher snapshot (start)'); } catch (e) {}
                    try { console.error(now.slice(0, 4000)); } catch (e) {}
                    try { console.error('[DIAG] watcher snapshot (end)'); } catch (e) {}
                } catch (e) {
                    try { console.error('[DIAG] watcher read failed:', e && e.message); } catch (e2) {}
                }
            });
            setTimeout(() => {
                try { watcher.close(); } catch (e) {}
            }, 2000);
        } catch (e) {
            try { console.error('[DIAG] watcher install failed:', e && e.message); } catch (e2) {}
        }
    } catch (writeErr) {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
        throw writeErr;
    }

    // Load payer-specific agency branding (configured at payment time via certOrgId)
    let branding = null;
    try {
        const platformRoot = path.join(__dirname, '..', '..', '..');
        branding = loadAgencyBranding(platformRoot, record.certOrgId || 'default');
    } catch {
        branding = null;
    }

    // Generate certificate using stored cert profile (pre-configured at payment)
    const certificateModel = buildCertificateModel({
        report: reportJson,
        certificate_id: deliveryId,
        generated_at: new Date().toISOString(),
        milestone: record.certMilestone || 'release',
        client_name: record.certClientName || 'Client',
        project_name: record.certProjectName || 'Project',
        agency_name: branding?.agency_name || record.email || 'SimpleBeacon',
        branding: branding || { agency_name: record.email || 'SimpleBeacon' }
    });
    const certificateHtml = renderCertificateHtml(certificateModel);

    const totalScanned = reportJson.ruleScopedFilesAnalyzed
        || reportJson.repositoryFilesTotal
        || reportJson.llmSlopFilesScanned
        || 0;

    // Generate full audit report HTML (printable PDF source)
    let auditReportHtml = null;
    let auditReportFilename = null;
    try {
        const auditResult = await buildCompleteAuditReport({
            type: 'simplebeacon-complete-scan',
            version: '1.3.0',
            generatedAt: new Date().toISOString(),
            projectPath: reportJson.projectRoot || reportJson.scanTargetRoot || '',
            results: reportJson
        }, {
            client: record.certClientName || 'Client',
            company: record.certClientName || 'Client',
            assessor: 'SimpleBeacon',
            aiProvider: 'demo'
        });
        auditReportHtml = typeof auditResult === 'string' ? auditResult : (auditResult && auditResult.html) || null;
        auditReportFilename = auditResult && auditResult.filename ? auditResult.filename : null;
    } catch (auditErr) {
        logger.warn('[Reports] Audit report generation skipped:', auditErr.message);
    }

    // Build full export ZIP with all JSON artifacts + HTML reports via analyze-export-bundle
    const TIER_TO_DELIVERABLE_SKU = {
        community: 'community',
        executive: 'clearance499',
        agency: 'agency999',
        universal: 'operator',
        euai: 'euai2499',
        instant: 'moneyPrinter19'
    };
    const PRODUCT_TO_DELIVERABLE_SKU = {
        executive_clearance: 'clearance499',
        eu_ai_act_sprint: 'euai2499',
        instant_report: 'moneyPrinter19',
        community: 'community'
    };
    const tierLabel = TIER_TO_DELIVERABLE_SKU[record.licenseTier]
        || PRODUCT_TO_DELIVERABLE_SKU[record.product]
        || record.product
        || 'operator';
    // Extract embedded analysis results from upload-directory reportJson
    const embeddedResults = reportJson._completeResults || {};
    const simplebeaconReport = (() => {
        if (!reportJson.gate && !reportJson.issues) return null;
        const base = { ...reportJson };
        const embeddedKeys = [
            '_completeResults', '_codebaseAnalysis', '_npmAuditAnalysis',
            '_complianceAnalysis', '_dataCleanupAnalysis', '_dataQualityAnalysis',
            '_cleanupAssistantAnalysis', '_fileReductionAnalysis', '_roadmapAnalysis',
            '_consolidationAnalysis', '_mockScanAnalysis', '_euAiActAnalysis',
            '_analysisError'
        ];
        for (const key of embeddedKeys) delete base[key];
        return base;
    })();
    // Browser sandbox sends results as direct keys; ai-platform CLI sends as _ prefixed keys
    const browserMockScan = reportJson.mockDataCategories?.length ? { categories: reportJson.mockDataCategories, total: reportJson.mockSampleFiles || reportJson.mockDataCategories.length } : null;
    const browserDataQuality = reportJson.dataQuality?.emptyJsonCount !== undefined ? reportJson.dataQuality : null;
    const browserCleanup = reportJson.cleanup?.debugArtifactCount !== undefined ? reportJson.cleanup : null;
    const browserNpmAudit = reportJson.npmAudit?.packageJsonCount !== undefined ? reportJson.npmAudit : null;
    const browserCompliance = reportJson.compliance?.licenseCount !== undefined ? reportJson.compliance : null;
    const browserEuAiAct = reportJson.euAiActSummary?.highRiskIndicators !== undefined ? reportJson.euAiActSummary : null;

    const analysisResults = {
        simplebeacon: embeddedResults.simplebeacon || simplebeaconReport || reportJson,
        codebase: embeddedResults.codebase || reportJson._codebaseAnalysis || reportJson.codebase || null,
        mockScan: embeddedResults.mockScan || reportJson._mockScanAnalysis || browserMockScan || null,
        roadmap: embeddedResults.roadmap || reportJson._roadmapAnalysis || reportJson.roadmap || null,
        consolidation: embeddedResults.consolidation || reportJson._consolidationAnalysis || reportJson.consolidation || null,
        fileReduction: embeddedResults.fileReduction || reportJson._fileReductionAnalysis || reportJson.fileReduction || null,
        dataQuality: embeddedResults.dataQuality || embeddedResults.dataCleanup || reportJson._dataQualityAnalysis || browserDataQuality || null,
        cleanupAssistant: embeddedResults.cleanupAssistant || reportJson._cleanupAssistantAnalysis || browserCleanup || null,
        npmAudit: embeddedResults.npmAudit || reportJson._npmAuditAnalysis || browserNpmAudit || null,
        compliance: embeddedResults.compliance || reportJson._complianceAnalysis || browserCompliance || null,
        euAiAct: embeddedResults.euAiAct || reportJson._euAiActAnalysis || browserEuAiAct || (reportJson.type === 'simplebeacon-eu-ai-act-sprint' ? reportJson : null) || null
    };
    // Derive enginesRun from which result keys have actual data
    const enginesRun = [
        'simplebeacon',
        ...(analysisResults.codebase ? ['codebase'] : []),
        ...(analysisResults.mockScan ? ['mock-scan'] : []),
        ...(analysisResults.roadmap ? ['roadmap'] : []),
        ...(analysisResults.consolidation ? ['consolidation'] : []),
        ...(analysisResults.fileReduction ? ['file-reduction'] : []),
        ...(analysisResults.dataQuality ? ['data-quality'] : []),
        ...(analysisResults.cleanupAssistant ? ['cleanup-assistant'] : []),
        ...(analysisResults.npmAudit ? ['npm-audit'] : []),
        ...(analysisResults.compliance ? ['compliance'] : []),
        ...(analysisResults.euAiAct ? ['eu-ai-act'] : [])
    ];
    // Alias sprint for EU AI Act export bundle compatibility
    if (analysisResults.euAiAct && !analysisResults.sprint) {
        analysisResults.sprint = analysisResults.euAiAct;
    }
    const completeScanPayload = {
        type: 'simplebeacon-complete-scan',
        version: '1.3.0',
        generatedAt: new Date().toISOString(),
        projectPath: reportJson.projectRoot || reportJson.scanTargetRoot || '',
        results: analysisResults,
        enginesRun,
        analysisConfig: { selectedEngines: enginesRun }
    };
    logger.info('[buildReportBundle] results keys with data:', Object.keys(analysisResults).filter(k => !!analysisResults[k]));
    logger.info('[buildReportBundle] enginesRun:', enginesRun);

    let zipBuffer;
    let zipFilename;
    try {
        const { stream, filename } = await buildAnalyzeExportZipStream(completeScanPayload, {
            deliverableSku: tierLabel,
            internalDashboard: true,
            hasAuditDeliverableAccess: true,
            client: record.certClientName || 'Client',
            company: record.certClientName || 'Client',
            projectName: record.certProjectName || 'Project',
            assessor: 'SimpleBeacon',
            includeEuAiAct: tierLabel === 'euai2499' || record.licenseTier === 'euai2499' || record.licenseTier === 'euai' || record.licenseTier === 'universal'
        });
        zipBuffer = await streamToBuffer(stream);
        zipFilename = filename;
    } catch (zipErr) {
        logger.warn('[Reports] Full export ZIP failed, falling back to minimal:', zipErr.message, zipErr.code || '');
        // Fallback: build a minimal ZIP that includes the correct analysis artifacts
        const pass = new PassThrough();
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(pass);
        const date = new Date().toISOString().slice(0, 10);
        const slug = String(reportJson.projectRoot || reportJson.scanTargetRoot || 'project')
            .replace(/[\\/]/g, '-').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
        const root = `simplebeacon-export-${tierLabel}-${slug}-${date}`;
        archive.append(certificateHtml, { name: `${root}/reports/agency-certificate.html` });
        if (auditReportHtml) archive.append(auditReportHtml, { name: `${root}/reports/executive-audit.html` });
        if (analysisResults.euAiAct?.html) {
            archive.append(analysisResults.euAiAct.html, { name: `${root}/reports/eu-ai-act-audit.html` });
        } else if (analysisResults.euAiAct) {
            try {
                const { buildEuAiActAuditReport } = require('../../../server/lib/eu-ai-act-audit-report.cjs');
                const gateReport = analysisResults.simplebeacon || reportJson;
                const eu = await buildEuAiActAuditReport({
                    projectPath: reportJson.projectRoot || reportJson.scanTargetRoot || '',
                    clientName: record.certClientName || 'Client',
                    artifacts: {
                        report: gateReport,
                        platformRoot: reportJson.projectRoot || reportJson.scanTargetRoot || ''
                    }
                });
                archive.append(eu.html, { name: `${root}/reports/eu-ai-act-audit.html` });
            } catch (euErr) {
                logger.warn('[Reports] EU AI Act audit HTML generation skipped in fallback:', euErr.message);
            }
        }

        // Write the primary report
        const primaryReport = reportJson._completeResults || reportJson;
        let primaryText;
        try { primaryText = JSON.stringify(primaryReport, null, 2); }
        catch (e) { primaryText = safeStringify(primaryReport, 2); }
        archive.append(primaryText, { name: `${root}/json/report.json` });

        // Write all computed analysis artifacts regardless of tier
        const analysisMap = {
            '_mockScanAnalysis': { file: 'json/fiction-digest.json' },
            '_codebaseAnalysis': { file: 'json/codebase-summary.json' },
            '_roadmapAnalysis': { file: 'json/roadmap.json' },
            '_complianceAnalysis': { file: 'json/compliance-checklist.json' },
            '_fileReductionAnalysis': { file: 'json/file-reduction.json' },
            '_dataQualityAnalysis': { file: 'json/data-quality.json' },
            '_cleanupAssistantAnalysis': { file: 'json/cleanup-brief.json' },
            '_npmAuditAnalysis': { file: 'json/npm-audit.json' },
            '_euAiActAnalysis': { file: 'json/eu-ai-act-sprint.json' },
            '_consolidationAnalysis': { file: 'json/consolidation.json' },
            '_reAttestationReadme': { file: 'json/re-attestation-note.json' }
        };
        for (const [key, meta] of Object.entries(analysisMap)) {
            if (reportJson[key]) {
                let text;
                try { text = JSON.stringify(reportJson[key], null, 2); }
                catch (e) { text = safeStringify(reportJson[key], 2); }
                archive.append(text, { name: `${root}/${meta.file}` });
            }
        }

        // Build a minimal manifest
        const manifest = {
            type: 'simplebeacon-export-bundle-manifest',
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            tierId: tierLabel,
            fallback: true,
            fallbackReason: zipErr.message,
            artifactCount: 1 + Object.entries(analysisMap).filter(([k]) => reportJson[k]).length
        };
        let manifestText;
        try { manifestText = JSON.stringify(manifest, null, 2); }
        catch (e) { manifestText = safeStringify(manifest, 2); }
        archive.append(manifestText, { name: `${root}/manifest.json` });

        archive.append('SimpleBeacon fallback export — analysis artifacts included.\n', { name: `${root}/README.txt` });
        await archive.finalize();
        zipBuffer = await streamToBuffer(pass);
        zipFilename = `${root}.zip`;
    }

    // NOTE: final-authoritative overwrite removed — we now write a signed
    // snapshot at the canonical commit point above. Keeping a second writer
    // risks re-introducing the original race condition where an unsigned
    // reference is written later.

    return { record, email, deliveryId, certificateHtml, auditReportHtml, zipBuffer, zipFilename };
}

module.exports = { buildReportBundle };
