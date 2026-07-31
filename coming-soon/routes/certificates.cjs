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
    buildCertificateHtml,
    buildEuComplianceCertificateHtml
} = require('../lib/certificate-utils.cjs');
const { getModuleAccess } = require('../lib/plans.cjs');

const logger = {
    warn: (...a) => {
        const c = globalThis.console;
        c.warn(...a);
    },
    error: (...a) => {
        const c = globalThis.console;
        c.error(...a);
    }
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
        reportJson.consolidation =
            reportJson.consolidation || rawResults.consolidation || rawResults._consolidationAnalysis || null;
        reportJson.mockDataCategories =
            reportJson.mockDataCategories ||
            rawResults.mockScan?.mockDataCategories ||
            rawResults.mockScan?.categories ||
            null;
        reportJson.mockSampleFiles = reportJson.mockSampleFiles || rawResults.mockScan?.mockSampleFiles || null;
        reportJson.roadmap = reportJson.roadmap || rawResults.roadmap || rawResults._roadmapAnalysis || null;
        reportJson.codebase = reportJson.codebase || rawResults.codebase || rawResults._codebaseAnalysis || null;
        reportJson.fileReduction =
            reportJson.fileReduction || rawResults.fileReduction || rawResults._fileReductionAnalysis || null;
        reportJson.dataQuality =
            reportJson.dataQuality ||
            rawResults.dataQuality ||
            rawResults._dataQualityAnalysis ||
            rawResults.dataCleanup ||
            null;
        reportJson.cleanup =
            reportJson.cleanup ||
            rawResults.cleanupAssistant ||
            rawResults._cleanupAssistantAnalysis ||
            rawResults.cleanup ||
            null;
        reportJson.npmAudit = reportJson.npmAudit || rawResults.npmAudit || rawResults._npmAuditAnalysis || null;
        reportJson.compliance =
            reportJson.compliance || rawResults.compliance || rawResults._complianceAnalysis || null;
        reportJson.euAiActSummary =
            reportJson.euAiActSummary ||
            rawResults.euAiAct ||
            rawResults._euAiActAnalysis ||
            rawResults.euAiActSummary ||
            null;
    }
    const certificateHtml = buildCertificateHtml(reportJson, payload);

    try {
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', err => {
            logger.error('[Archive] Error:', err.message);
        });
        archive.on('warning', err => {
            logger.error('[Archive] Warning:', err.message);
        });
        const tier = payload.tier || 'executive';
        const tierConfig = getTierConfig(tier);
        const allowedModules = getModuleAccess(tier);
        const hasModule = id => allowedModules.includes(id);
        const dateStr = new Date().toISOString().slice(0, 10);
        const zipName = `simplebeacon-${tierConfig.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')}-${dateStr}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        archive.pipe(res);

        const addJson = (name, data) => {
            const str = JSON.stringify(data, null, 2);
            archive.append(str, { name });
        };

        // Master certificate HTML always shows total results regardless of tier
        archive.append(certificateHtml, { name: 'reports/certificate.html' });
        addJson('json/report.json', reportJson);

        // Only package modules the account tier has access to
        if (hasModule('gate')) {
            addJson('json/01-simplebeacon-gate.json', reportJson.gateReport || {});
        }
        if (hasModule('consolidation')) {
            addJson('json/02-consolidation.json', reportJson.consolidation || {});
        }
        if (hasModule('mock-data')) {
            addJson('json/03-mock-data.json', reportJson.mockDataCategories || []);
        }
        if (hasModule('roadmap')) {
            addJson('json/04-roadmap.json', reportJson.roadmap || {});
        }
        if (hasModule('codebase')) {
            addJson('json/05-codebase.json', reportJson.codebase || {});
        }
        if (hasModule('file-reduction')) {
            addJson('json/06-file-reduction.json', reportJson.fileReduction || {});
        }
        if (hasModule('data-quality')) {
            addJson('json/07-data-quality.json', reportJson.dataQuality || {});
        }
        if (hasModule('cleanup')) {
            addJson('json/08-cleanup.json', reportJson.cleanup || {});
        }
        if (hasModule('npm-audit')) {
            addJson('json/09-npm-audit.json', reportJson.npmAudit || {});
        }
        if (hasModule('compliance')) {
            addJson('json/10-compliance.json', reportJson.compliance || {});
        }
        if (hasModule('eu-ai-act')) {
            addJson('json/11-eu-ai-act.json', reportJson.euAiActSummary || {});
        }
        if (hasModule('dependency-vulns')) {
            addJson('json/12-dependency-vulns.json', reportJson.dependencyAudit || reportJson.vulnerabilityAudit || {});
        }
        if (hasModule('build-readiness')) {
            addJson('json/13-build-readiness.json', reportJson.buildReadiness || {});
        }
        addJson('json/14-remediation-roadmap.json', reportJson.remediationPhases || []);

        // Human-readable HTML reports (print to PDF) — tier-filtered
        const projectName = reportJson.projectRoot || reportJson.projectPath || reportJson.projectName || 'Project';
        if (hasModule('gate')) {
            archive.append(buildModuleHtml('SimpleBeacon Gate', '🛡️', reportJson.gateReport, projectName), {
                name: 'reports/01-simplebeacon-gate.html'
            });
        }
        if (hasModule('consolidation')) {
            archive.append(buildModuleHtml('Consolidation', '🔀', reportJson.consolidation, projectName), {
                name: 'reports/02-consolidation.html'
            });
        }
        if (hasModule('mock-data')) {
            const mockDataModuleData = (reportJson.mockDataCategories || []).length
                ? {
                      'Detected Categories': reportJson.mockDataCategories.map(c =>
                          `${c.category || 'Unknown'}: ${c.fileCount || 0} files (${c.confidence || 'medium'} confidence) — ${c.description || ''}`.trim()
                      )
                  }
                : { Status: 'No mock data detected' };
            archive.append(buildModuleHtml('Mock Data Detection', '🔍', mockDataModuleData, projectName), {
                name: 'reports/03-mock-data.html'
            });
        }
        if (hasModule('roadmap')) {
            archive.append(buildModuleHtml('Roadmap Markers', '🗺️', reportJson.roadmap, projectName), {
                name: 'reports/04-roadmap.html'
            });
        }
        if (hasModule('codebase')) {
            archive.append(buildModuleHtml('Codebase Analysis', '🧹', reportJson.codebase, projectName), {
                name: 'reports/05-codebase.html'
            });
        }
        if (hasModule('file-reduction')) {
            archive.append(buildModuleHtml('File Reduction', '📦', reportJson.fileReduction, projectName), {
                name: 'reports/06-file-reduction.html'
            });
        }
        if (hasModule('data-quality')) {
            archive.append(buildModuleHtml('Data Quality', '🧪', reportJson.dataQuality, projectName), {
                name: 'reports/07-data-quality.html'
            });
        }
        if (hasModule('cleanup')) {
            archive.append(buildModuleHtml('Cleanup Assistant', '🗂️', reportJson.cleanup, projectName), {
                name: 'reports/08-cleanup.html'
            });
        }
        if (hasModule('npm-audit')) {
            archive.append(buildModuleHtml('npm Audit', '📦', reportJson.npmAudit, projectName), {
                name: 'reports/09-npm-audit.html'
            });
        }
        if (hasModule('compliance')) {
            archive.append(buildModuleHtml('Compliance', '✅', reportJson.compliance, projectName), {
                name: 'reports/10-compliance.html'
            });
        }
        if (hasModule('eu-ai-act')) {
            archive.append(buildModuleHtml('EU AI Act Readiness', '🇪🇺', reportJson.euAiActSummary, projectName), {
                name: 'reports/11-eu-ai-act.html'
            });
        }
        if (hasModule('dependency-vulns')) {
            archive.append(
                buildModuleHtml(
                    'Dependency Vulnerabilities',
                    '🔒',
                    reportJson.dependencyAudit || reportJson.vulnerabilityAudit || {},
                    projectName
                ),
                { name: 'reports/12-dependency-vulns.html' }
            );
        }
        if (hasModule('build-readiness')) {
            archive.append(buildModuleHtml('Build Readiness', '🏗️', reportJson.buildReadiness || {}, projectName), {
                name: 'reports/13-build-readiness.html'
            });
        }
        archive.append(buildEuComplianceCertificateHtml(reportJson, payload), {
            name: 'reports/eu-ai-act-compliance-certificate.html'
        });

        const manifestFiles = [
            'reports/certificate.html',
            ...(hasModule('gate') ? ['reports/01-simplebeacon-gate.html', 'json/01-simplebeacon-gate.json'] : []),
            ...(hasModule('consolidation') ? ['reports/02-consolidation.html', 'json/02-consolidation.json'] : []),
            ...(hasModule('mock-data') ? ['reports/03-mock-data.html', 'json/03-mock-data.json'] : []),
            ...(hasModule('roadmap') ? ['reports/04-roadmap.html', 'json/04-roadmap.json'] : []),
            ...(hasModule('codebase') ? ['reports/05-codebase.html', 'json/05-codebase.json'] : []),
            ...(hasModule('file-reduction') ? ['reports/06-file-reduction.html', 'json/06-file-reduction.json'] : []),
            ...(hasModule('data-quality') ? ['reports/07-data-quality.html', 'json/07-data-quality.json'] : []),
            ...(hasModule('cleanup') ? ['reports/08-cleanup.html', 'json/08-cleanup.json'] : []),
            ...(hasModule('npm-audit') ? ['reports/09-npm-audit.html', 'json/09-npm-audit.json'] : []),
            ...(hasModule('compliance') ? ['reports/10-compliance.html', 'json/10-compliance.json'] : []),
            ...(hasModule('eu-ai-act') ? ['reports/11-eu-ai-act.html', 'json/11-eu-ai-act.json'] : []),
            ...(hasModule('dependency-vulns')
                ? ['reports/12-dependency-vulns.html', 'json/12-dependency-vulns.json']
                : []),
            ...(hasModule('build-readiness')
                ? ['reports/13-build-readiness.html', 'json/13-build-readiness.json']
                : []),
            'reports/eu-ai-act-compliance-certificate.html',
            'json/14-remediation-roadmap.json',
            'json/report.json',
            'manifest.json',
            'README.txt'
        ];
        addJson('manifest.json', {
            type: 'simplebeacon-export-manifest',
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            tier: tier,
            productSku: payload.productSku || tier,
            files: manifestFiles,
            certificateType: tierConfig.label,
            reportId: 'SB-AUD-' + dateStr.replace(/-/g, '') + '-' + crypto.randomBytes(4).toString('hex').toUpperCase()
        });
        const includedModules = [
            ...(hasModule('gate') ? ['01-simplebeacon-gate'] : []),
            ...(hasModule('consolidation') ? ['02-consolidation'] : []),
            ...(hasModule('mock-data') ? ['03-mock-data'] : []),
            ...(hasModule('roadmap') ? ['04-roadmap'] : []),
            ...(hasModule('codebase') ? ['05-codebase'] : []),
            ...(hasModule('file-reduction') ? ['06-file-reduction'] : []),
            ...(hasModule('data-quality') ? ['07-data-quality'] : []),
            ...(hasModule('cleanup') ? ['08-cleanup'] : []),
            ...(hasModule('npm-audit') ? ['09-npm-audit'] : []),
            ...(hasModule('compliance') ? ['10-compliance'] : []),
            ...(hasModule('eu-ai-act') ? ['11-eu-ai-act'] : []),
            ...(hasModule('dependency-vulns') ? ['12-dependency-vulns'] : []),
            ...(hasModule('build-readiness') ? ['13-build-readiness'] : [])
        ];
        archive.append(
            `SimpleBeacon ${tierConfig.label}
============================

Generated: ${new Date().toLocaleString()}
Tier: ${tier}
Product SKU: ${payload.productSku || tier}

This package includes modules attached to your tier.
The master certificate.html shows total scan results from all engines.

Packaged modules (${includedModules.length}):
  reports/
    certificate.html                      : Master certificate (open in browser, print to PDF)
${includedModules.map(m => `    ${m}.html                    : Human-readable report (print to PDF)`).join('\n')}
    eu-ai-act-compliance-certificate.html : EU AI Act Compliance Certificate (print to PDF)
  json/
    report.json                           : Raw complete scan report (machine-readable JSON)
${includedModules.map(m => `    ${m}.json                   : Machine-readable JSON data`).join('\n')}
    14-remediation-roadmap.json          : Phased remediation plan (machine-readable JSON)
  manifest.json                           : Export manifest for verification
  README.txt                              : This file

For vendor handoff, run a Complete Scan via the CLI:
  npx simplebeacon scan --gate --complete

Questions? https://simplebeacon.ai
`,
            { name: 'README.txt' }
        );
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
