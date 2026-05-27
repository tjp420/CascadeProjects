const logger = require('../lib/production-logger');
/**
 * Repository optimization API — health metrics, merge preview, safe execution.
 */

const path = require('path');
const _fs = require('fs');
const { scanFileMergerReduction } = require('../../server/lib/file-merger-reduction-scanner');
const { resolvePlatformRoot } = require('../../packages/simplebeacon-cli/src/project-detect');
const {
    buildRepositoryHealthPayload,
    saveConsolidationReport,
    readJsonIfExists
} = require('../../server/lib/repository-health-payload');
const { buildMergePreview } = require('../../server/lib/merge-preview');
const { executeSafeMerge, rollbackMerge } = require('../../server/lib/safe-merge-guard');
const { buildDevSecOpsCompliancePayload, buildComplianceHtml } = require('../../server/lib/devsecops-compliance-payload');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function wantsHtmlResponse(req) {
    if (String(req.query.format || '').toLowerCase() === 'html') return true;
    if (String(req.query.format || '').toLowerCase() === 'json') return false;
    const accept = String(req.headers.accept || '');
    return accept.includes('text/html') && !accept.includes('application/json');
}

function resolveProjectPath(rawPath, defaultRoot) {
    if (!rawPath) return defaultRoot;
    return path.isAbsolute(rawPath)
        ? path.normalize(rawPath)
        : path.join(defaultRoot, rawPath);
}

function loadMergeCandidate(projectRoot, candidateId) {
    const report = readJsonIfExists(path.join(projectRoot, '.simplebeacon', 'consolidation-report.json'));
    if (!report?.mergeCandidates?.length) return null;
    return report.mergeCandidates.find((item) => item.id === candidateId) || null;
}

function setupOptimizationAPI(app, options = {}) {
    const defaultPlatformRoot = options.platformRoot || PROJECT_ROOT;
    const defaultMonorepoRoot = options.monorepoRoot || path.join(defaultPlatformRoot, '..');

    app.get('/api/optimization/health', (req, res) => {
        try {
            const payload = buildRepositoryHealthPayload({
                platformRoot: defaultPlatformRoot,
                monorepoRoot: defaultMonorepoRoot
            });
            res.set('Cache-Control', 'public, max-age=300');
            res.json({ success: true, ...payload });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/optimization/compliance', (req, res) => {
        try {
            const payload = buildDevSecOpsCompliancePayload({
                platformRoot: defaultPlatformRoot,
                monorepoRoot: defaultMonorepoRoot
            });
            res.set('Cache-Control', 'public, max-age=300');
            if (wantsHtmlResponse(req)) {
                res.set('Content-Type', 'text/html; charset=utf-8');
                return res.send(buildComplianceHtml(payload));
            }
            res.json({ success: true, ...payload });
        } catch (error) {
            if (wantsHtmlResponse(req)) {
                res.status(500).set('Content-Type', 'text/html; charset=utf-8');
                return res.send(`<!DOCTYPE html><html><body><h1>Compliance unavailable</h1><p>${error.message}</p></body></html>`);
            }
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/optimization/candidates', (req, res) => {
        try {
            const projectRoot = resolveProjectPath(req.query.projectPath, defaultMonorepoRoot);
            const report = readJsonIfExists(path.join(projectRoot, '.simplebeacon', 'consolidation-report.json'));
            const candidates = (report?.mergeCandidates || []).slice(0, 20);
            res.json({
                success: true,
                projectRoot,
                generatedAt: report?.generatedAt || null,
                candidates
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/optimization/analyze', async (req, res) => {
        try {
            const baseDir = resolveProjectPath(req.body?.projectPath || req.query?.projectPath, defaultMonorepoRoot);
            const { platformRoot } = resolvePlatformRoot(baseDir);
            const scope = String(req.body?.scope || req.query?.scope || 'repository').toLowerCase() === 'sample-data-only'
                ? 'sample-data-only'
                : 'repository';

            const report = await scanFileMergerReduction(baseDir, {
                scope,
                sampleBase: platformRoot || baseDir
            });
            const savedPath = saveConsolidationReport(report, baseDir);
            const health = buildRepositoryHealthPayload({
                platformRoot: defaultPlatformRoot,
                monorepoRoot: defaultMonorepoRoot
            });

            res.set('Cache-Control', 'no-store');
            res.json({
                success: true,
                report,
                savedPath,
                savingsBytes: report.summary?.potentialSavingsBytes ?? 0,
                savingsLabel: report.summary?.potentialSavingsLabel ?? null,
                mergeCandidates: report.summary?.mergeCandidates ?? 0,
                reductionOpportunities: report.summary?.reductionOpportunities ?? 0,
                repositoryHealthScore: computeHealthFromReport(report),
                health
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/optimization/merge-preview', async (req, res) => {
        try {
            const projectRoot = resolveProjectPath(req.body?.projectPath, defaultMonorepoRoot);
            let candidate = req.body?.candidate || null;
            if (!candidate && req.body?.candidateId) {
                candidate = loadMergeCandidate(projectRoot, req.body.candidateId);
                if (!candidate) {
                    return res.status(404).json({ success: false, error: 'Merge candidate not found — run consolidation scan first' });
                }
            }
            if (!candidate) {
                return res.status(400).json({ success: false, error: 'candidate or candidateId required' });
            }

            const preview = await buildMergePreview({
                projectRoot,
                candidate,
                strategy: req.body?.strategy,
                keepFile: req.body?.keepFile
            });

            res.set('Cache-Control', 'no-store');
            res.json({ success: true, preview });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/optimization/merge-execute', async (req, res) => {
        try {
            const projectRoot = resolveProjectPath(req.body?.projectPath, defaultMonorepoRoot);
            const result = await executeSafeMerge({
                projectRoot,
                previewId: req.body?.previewId,
                confirmed: req.body?.confirmed,
                confirmationPhrase: req.body?.confirmationPhrase
            });
            res.set('Cache-Control', 'no-store');
            res.json({ success: true, result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    app.post('/api/optimization/merge-rollback', async (req, res) => {
        try {
            const projectRoot = resolveProjectPath(req.body?.projectPath, defaultMonorepoRoot);
            const result = await rollbackMerge(projectRoot, req.body?.previewId);
            res.set('Cache-Control', 'no-store');
            res.json({ success: true, result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    logger.debug('✅ Repository optimization API at /api/optimization/* (health, compliance, merge-preview)');
}

function computeHealthFromReport(report) {
    const { computeRepositoryHealthScore } = require('../../server/lib/repository-health-payload');
    return computeRepositoryHealthScore(report.summary || {});
}

module.exports = { setupOptimizationAPI };

