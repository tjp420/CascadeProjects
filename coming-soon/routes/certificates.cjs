/**
 * Certificate generation route — builds ZIP with HTML reports and JSON data.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
    normalizeReport,
    getTierConfig,
    buildModuleHtml,
    buildCertificateHtml
} = require('../lib/certificate-utils.cjs');

const logger = {
    warn: (...a) => { const c = globalThis.console; c.warn(...a); },
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

// Certificate generation rate limiter: max 10 per IP per 10 minutes
const CERT_RATE_LIMIT_MS = 10 * 60 * 1000;
const CERT_RATE_LIMIT_MAX = 10;
const certRateLog = new Map(); // ip -> { count, resetAt }

function verifyLicenseToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    try {
        return jwt.verify(token, secret, { clockTolerance: 60 });
    } catch {
        return null;
    }
}

router.post('/api/certificate/download', async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Rate limiting
    const rateEntry = certRateLog.get(clientIp);
    if (rateEntry && now < rateEntry.resetAt) {
        if (rateEntry.count >= CERT_RATE_LIMIT_MAX) {
            logger.warn(`[Certificate] Rate limit exceeded for IP ${clientIp}`);
            return res.status(429).json({ error: 'Too many certificate requests. Please try again later.' });
        }
        rateEntry.count++;
    } else {
        certRateLog.set(clientIp, { count: 1, resetAt: now + CERT_RATE_LIMIT_MS });
    }

    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) {
        logger.error('[Certificate] License secret not configured');
        return res.status(500).json({ error: 'License secret not configured' });
    }
    if (!token || token.length < 10) {
        return res.status(401).json({ error: 'License token required' });
    }
    const payload = verifyLicenseToken(token, secret);
    if (!payload) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Validate report data presence
    let reportJson = req.body.reportJson || {};
    if (!reportJson || typeof reportJson !== 'object' || Array.isArray(reportJson)) {
        return res.status(400).json({ error: 'Report JSON must be an object.' });
    }
    if (Object.keys(reportJson).length === 0) {
        return res.status(400).json({ error: 'Report JSON required in request body' });
    }

    // Guard against oversized reports (50MB limit)
    const reportSize = JSON.stringify(reportJson).length;
    if (reportSize > 50 * 1024 * 1024) {
        logger.warn(`[Certificate] Report too large: ${(reportSize / 1024 / 1024).toFixed(1)}MB from ${clientIp}`);
        return res.status(413).json({ error: 'Report JSON exceeds 50MB size limit' });
    }

    const rawResults = reportJson.results || {};
    reportJson = normalizeReport(reportJson);
    // Merge ai-platform complete-scan modules from nested results into top level for ZIP generation
    if (rawResults && typeof rawResults === 'object') {
        reportJson.consolidation = reportJson.consolidation || rawResults.consolidation || rawResults._consolidationAnalysis || null;
        reportJson.mockDataCategories = reportJson.mockDataCategories || (rawResults.mockScan?.mockDataCategories) || (rawResults.mockScan?.categories) || null;
        reportJson.mockSampleFiles = reportJson.mockSampleFiles || rawResults.mockScan?.mockSampleFiles || null;
        reportJson.roadmap = reportJson.roadmap || rawResults.roadmap || rawResults._roadmapAnalysis || null;
        reportJson.codebase = reportJson.codebase || rawResults.codebase || rawResults._codebaseAnalysis || null;
        reportJson.fileReduction = reportJson.fileReduction || rawResults.fileReduction || rawResults._fileReductionAnalysis || null;
        reportJson.dataQuality = reportJson.dataQuality || rawResults.dataQuality || rawResults._dataQualityAnalysis || rawResults.dataCleanup || null;
        reportJson.cleanup = reportJson.cleanup || rawResults.cleanupAssistant || rawResults._cleanupAssistantAnalysis || rawResults.cleanup || null;
        reportJson.npmAudit = reportJson.npmAudit || rawResults.npmAudit || rawResults._npmAuditAnalysis || null;
        reportJson.compliance = reportJson.compliance || rawResults.compliance || rawResults._complianceAnalysis || null;
        reportJson.euAiActSummary = reportJson.euAiActSummary || rawResults.euAiAct || rawResults._euAiActAnalysis || rawResults.euAiActSummary || null;
    }
    const certificateHtml = buildCertificateHtml(reportJson, payload);

    try {
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => { logger.error('[Archive] Error:', err.message); });
        archive.on('warning', (err) => { logger.error('[Archive] Warning:', err.message); });
        const tier = payload.tier || 'executive';
        const tierConfig = getTierConfig(tier);
        const dateStr = new Date().toISOString().slice(0,10);
        const zipName = `simplebeacon-${tierConfig.label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${dateStr}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        archive.pipe(res);

        const addJson = (name, data) => {
            const str = JSON.stringify(data, null, 2);
            archive.append(str, { name });
        };

        archive.append(certificateHtml, { name: 'reports/certificate.html' });
        addJson('json/report.json', reportJson);
        addJson('json/01-simplebeacon-gate.json', reportJson.gateReport || {});
        addJson('json/02-consolidation.json', reportJson.consolidation || {});
        addJson('json/03-mock-data.json', reportJson.mockDataCategories || []);
        addJson('json/04-roadmap.json', reportJson.roadmap || {});
        addJson('json/05-codebase.json', reportJson.codebase || {});
        addJson('json/06-file-reduction.json', reportJson.fileReduction || {});
        addJson('json/07-data-quality.json', reportJson.dataQuality || {});
        addJson('json/08-cleanup.json', reportJson.cleanup || {});
        addJson('json/09-npm-audit.json', reportJson.npmAudit || {});
        addJson('json/10-compliance.json', reportJson.compliance || {});
        addJson('json/11-eu-ai-act.json', reportJson.euAiActSummary || {});
        addJson('json/12-dependency-vulns.json', reportJson.dependencyAudit || reportJson.vulnerabilityAudit || {});
        addJson('json/13-build-readiness.json', reportJson.buildReadiness || {});
        addJson('json/14-remediation-roadmap.json', reportJson.remediationPhases || []);

        // Human-readable HTML reports (print to PDF)
        const projectName = reportJson.projectRoot || reportJson.projectPath || reportJson.projectName || 'Project';
        archive.append(buildModuleHtml('SimpleBeacon Gate', '🛡️', reportJson.gateReport, projectName), { name: 'reports/01-simplebeacon-gate.html' });
        archive.append(buildModuleHtml('Consolidation', '🔀', reportJson.consolidation, projectName), { name: 'reports/02-consolidation.html' });
        const mockDataModuleData = (reportJson.mockDataCategories || []).length ? {
            'Detected Categories': reportJson.mockDataCategories.map(c => `${c.category || 'Unknown'}: ${c.fileCount || 0} files (${c.confidence || 'medium'} confidence) — ${c.description || ''}`.trim())
        } : { 'Status': 'No mock data detected' };
        archive.append(buildModuleHtml('Mock Data Detection', '🔍', mockDataModuleData, projectName), { name: 'reports/03-mock-data.html' });
        archive.append(buildModuleHtml('Roadmap Markers', '🗺️', reportJson.roadmap, projectName), { name: 'reports/04-roadmap.html' });
        archive.append(buildModuleHtml('Codebase Analysis', '🧹', reportJson.codebase, projectName), { name: 'reports/05-codebase.html' });
        archive.append(buildModuleHtml('File Reduction', '📦', reportJson.fileReduction, projectName), { name: 'reports/06-file-reduction.html' });
        archive.append(buildModuleHtml('Data Quality', '🧪', reportJson.dataQuality, projectName), { name: 'reports/07-data-quality.html' });
        archive.append(buildModuleHtml('Cleanup Assistant', '🗂️', reportJson.cleanup, projectName), { name: 'reports/08-cleanup.html' });
        archive.append(buildModuleHtml('npm Audit', '📦', reportJson.npmAudit, projectName), { name: 'reports/09-npm-audit.html' });
        archive.append(buildModuleHtml('Compliance', '✅', reportJson.compliance, projectName), { name: 'reports/10-compliance.html' });
        archive.append(buildModuleHtml('EU AI Act Readiness', '🇪🇺', reportJson.euAiActSummary, projectName), { name: 'reports/11-eu-ai-act.html' });
        archive.append(buildModuleHtml('Dependency Vulnerabilities', '🔒', reportJson.dependencyAudit || reportJson.vulnerabilityAudit || {}, projectName), { name: 'reports/12-dependency-vulns.html' });
        archive.append(buildModuleHtml('Build Readiness', '🏗️', reportJson.buildReadiness || {}, projectName), { name: 'reports/13-build-readiness.html' });

        addJson('manifest.json', {
            type: 'simplebeacon-export-manifest',
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            tier: tier,
            productSku: payload.productSku || tier,
            files: [
                'reports/certificate.html',
                'reports/01-simplebeacon-gate.html',
                'reports/02-consolidation.html',
                'reports/03-mock-data.html',
                'reports/04-roadmap.html',
                'reports/05-codebase.html',
                'reports/06-file-reduction.html',
                'reports/07-data-quality.html',
                'reports/08-cleanup.html',
                'reports/09-npm-audit.html',
                'reports/10-compliance.html',
                'reports/11-eu-ai-act.html',
                'reports/12-dependency-vulns.html',
                'reports/13-build-readiness.html',
                'json/14-remediation-roadmap.json',
                'json/report.json',
                'json/01-simplebeacon-gate.json',
                'json/02-consolidation.json',
                'json/03-mock-data.json',
                'json/04-roadmap.json',
                'json/05-codebase.json',
                'json/06-file-reduction.json',
                'json/07-data-quality.json',
                'json/08-cleanup.json',
                'json/09-npm-audit.json',
                'json/10-compliance.json',
                'json/11-eu-ai-act.json',
                'json/12-dependency-vulns.json',
                'json/13-build-readiness.json',
                'manifest.json',
                'README.txt'
            ],
            certificateType: tierConfig.label,
            reportId: 'SB-AUD-' + dateStr.replace(/-/g,'') + '-' + crypto.randomBytes(4).toString('hex').toUpperCase()
        });
        archive.append(`SimpleBeacon ${tierConfig.label}
============================

Generated: ${new Date().toLocaleString()}
Tier: ${tier}
Product SKU: ${payload.productSku || tier}

Contents:
  reports/
    certificate.html                      : Master certificate (open in browser, print to PDF)
    01-simplebeacon-gate.html            : 🛡️ Gate scan — human-readable report (print to PDF)
    02-consolidation.html                : 🔀 Consolidation — human-readable report (print to PDF)
    03-mock-data.html                    : 🔍 Mock data — human-readable report (print to PDF)
    04-roadmap.html                      : 🗺️ Roadmap — human-readable report (print to PDF)
    05-codebase.html                     : 🧹 Codebase — human-readable report (print to PDF)
    06-file-reduction.html               : 📦 File reduction — human-readable report (print to PDF)
    07-data-quality.html                 : 🧪 Data quality — human-readable report (print to PDF)
    08-cleanup.html                      : 🗂️ Cleanup — human-readable report (print to PDF)
    09-npm-audit.html                    : 📦 npm audit — human-readable report (print to PDF)
    10-compliance.html                 : ✅ Compliance — human-readable report (print to PDF)
    11-eu-ai-act.html                    : 🇪🇺 EU AI Act — human-readable report (print to PDF)
    12-dependency-vulns.html             : 🔒 Dependency vulnerabilities — human-readable report (print to PDF)
    13-build-readiness.html              : 🏗️ Build readiness — human-readable report (print to PDF)
  json/
    report.json                           : Raw complete scan report (machine-readable JSON)
    01-simplebeacon-gate.json            : Gate scan results (machine-readable JSON)
    02-consolidation.json                : Monorepo & duplicate file analysis (machine-readable JSON)
    03-mock-data.json                    : Mock / fixture / sample file detection (machine-readable JSON)
    04-roadmap.json                      : TODO / FIXME marker inventory (machine-readable JSON)
    05-codebase.json                     : File & line count summary (machine-readable JSON)
    06-file-reduction.json               : Unused asset & duplicate detection (machine-readable JSON)
    07-data-quality.json                 : Empty / trivial JSON findings (machine-readable JSON)
    08-cleanup.json                      : Debug artifact & hygiene sweep (machine-readable JSON)
    09-npm-audit.json                    : package.json inventory (machine-readable JSON)
    10-compliance.json                   : License & governance file detection (machine-readable JSON)
    11-eu-ai-act.json                    : EU AI Act readiness indicators (machine-readable JSON)
    12-dependency-vulns.json             : Dependency vulnerability audit (machine-readable JSON)
    13-build-readiness.json              : Build readiness checklist (machine-readable JSON)
    14-remediation-roadmap.json          : Phased remediation plan (machine-readable JSON)
  manifest.json                           : Export manifest for verification
  README.txt                              : This file

For vendor handoff, run a Complete Scan via the CLI:
  npx simplebeacon scan --gate --complete

Questions? https://simplebeacon.ai
`, { name: 'README.txt' });
        await archive.finalize();
    } catch (err) {
        logger.error(`[Certificate] Archive failed: ${err.message} ip=${clientIp}`);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Certificate generation failed' });
        } else {
            res.destroy();
        }
    }
});

module.exports = router;
