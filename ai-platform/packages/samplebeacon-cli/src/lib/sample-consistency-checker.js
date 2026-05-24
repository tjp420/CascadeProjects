/**
 * Cross-sample KPI alignment against repository-audit baselines.
 */

const fs = require('fs');
const path = require('path');

const SKIP_FICTION_PATHS = new Set([
    'deprecatedNarrative',
    'rejectedFiction',
    'fictionRemoved',
    'deprecated',
    'previousOpenIssues',
    'fictionVsReality',
    'previousModel',
    'notes',
    'warning',
    'assessment',
    'question',
    'answer',
    'details',
    'description',
    // Comparison-report lenses (roadmap-comparison-sample.json and similar)
    'ggufReport',
    'aiReport',
    'differences',
    'visualComparison'
]);

const ACTIVE_MODEL_KEYS = new Set(['name', 'activeModel', 'model', 'currentModel']);

function isCatalogModelNamePath(keyPath) {
    return /(^|\.)models\.\d+\.name$/.test(keyPath);
}

/** Collect developmentPhases from common roadmap sample shapes. */
function collectDevelopmentPhases(payload) {
    const phases = [];
    if (Array.isArray(payload.developmentPhases)) phases.push(...payload.developmentPhases);
    if (Array.isArray(payload.roadmap?.developmentPhases)) phases.push(...payload.roadmap.developmentPhases);
    return phases;
}

/**
 * Detect stale roadmap template patterns in repository-audit samples.
 * Skips comparison-report lenses (ggufReport / aiReport hold historical fiction by design).
 */
function detectStaleRoadmapTemplate(payload) {
    if (!payload || typeof payload !== 'object') return [];
    if (payload.type === 'roadmap-comparison-report') return [];

    const dataSource = payload.dataSource || payload.roadmap?.dataSource;
    if (dataSource && dataSource !== 'repository-audit') return [];

    const hits = [];
    const phases = collectDevelopmentPhases(payload);
    const sprint3 = phases.find((phase) => String(phase?.phase || '').includes('Sprint 3'));

    if (sprint3?.status === 'in-progress' && Number(sprint3.progress) === 75) {
        hits.push('Sprint 3 stale template (in-progress at 75%)');
    }

    const overview = payload.projectOverview
        || payload.executiveSummary
        || payload.roadmap?.executiveSummary;
    if (overview?.totalFeatures === 8 && overview?.completionRate === 62) {
        hits.push('stale roadmap template (8 features at 62%)');
    }

    return hits;
}

function deepIncludesFiction(value, baseline, depth = 0, keyPath = '') {
    if (depth > 8 || value == null) return [];
    const leafKey = keyPath.split('.').pop() || '';
    if (SKIP_FICTION_PATHS.has(leafKey)) return [];

    const hits = [];
    const fiction = baseline.rejectedFiction || {};

    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (ACTIVE_MODEL_KEYS.has(leafKey) && !isCatalogModelNamePath(keyPath)) {
            for (const name of fiction.modelNames || []) {
                if (lower.includes(name)) hits.push(`model name "${name}"`);
            }
        }
        if (/\b1247\b/.test(value) && /mock/i.test(value)) hits.push('1247 mock files claim');
        if (/\b1559\b/.test(value) && /files?\/?s/i.test(value)) hits.push('1559 files/s throughput claim');
        return hits;
    }

    if (typeof value === 'number') {
        if ((fiction.completionRates || []).includes(value)) hits.push(`${value}% completion claim`);
        if ((fiction.openIssueCounts || []).includes(value)) hits.push(`${value} open issues claim`);
        if ((fiction.aiConfidenceScores || []).includes(value)) hits.push(`${value}% AI confidence claim`);
        return hits;
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const itemPath = keyPath ? `${keyPath}.${index}` : String(index);
            hits.push(...deepIncludesFiction(value[index], baseline, depth + 1, itemPath));
        }
        return hits;
    }

    if (typeof value === 'object') {
        for (const [key, nested] of Object.entries(value)) {
            const nestedPath = keyPath ? `${keyPath}.${key}` : key;
            if (SKIP_FICTION_PATHS.has(key)) continue;
            if (key === 'totalFeatures' && (fiction.featureCounts || []).includes(nested)) {
                hits.push(`totalFeatures=${nested}`);
            }
            if ((key === 'completionRate' || key === 'currentCompletion')
                && (fiction.completionRates || []).includes(Number(nested))) {
                hits.push(`${key}=${nested}`);
            }
            if (key === 'issuesDetected' && (fiction.openIssueCounts || []).includes(nested)) {
                hits.push(`issuesDetected=${nested}`);
            }
            if ((key === 'aiConfidence' || key === 'previousConfidence' || key === 'confidence')
                && (fiction.aiConfidenceScores || []).includes(Number(nested))) {
                hits.push(`${key}=${nested}`);
            }
            hits.push(...deepIncludesFiction(nested, baseline, depth + 1, nestedPath));
        }
    }

    return hits;
}

function extractKpis(payload, fileName, baseline) {
    const kpis = {};

    if (payload.dataSource) kpis.dataSource = payload.dataSource;
    if (payload.overview?.currentRelease) kpis.currentRelease = payload.overview.currentRelease;
    if (payload.releaseOverview?.currentRelease) kpis.currentRelease = payload.releaseOverview.currentRelease;
    if (payload.executiveSummary?.currentRelease) kpis.currentRelease = payload.executiveSummary.currentRelease;

    if (payload.overview?.jestTests) kpis.jestTests = payload.overview.jestTests;
    if (payload.repositoryMetrics?.jestTests != null) kpis.jestTests = payload.repositoryMetrics.jestTests;
    if (payload.repositorySnapshot?.jestTests != null) kpis.jestTests = payload.repositorySnapshot.jestTests;
    if (payload.overview?.passedTests != null) {
        kpis.jestTests = `${payload.overview.passedTests}/${payload.overview.totalTests || payload.overview.passedTests}`;
    }

    if (payload.modelInfo?.name) kpis.model = payload.modelInfo.name;
    if (payload.activeModel) kpis.model = payload.activeModel;

    return {
        fileName,
        kpis,
        fictionHits: [...new Set([
            ...deepIncludesFiction(payload, baseline),
            ...detectStaleRoadmapTemplate(payload)
        ])]
    };
}

function fictionIssuesFromExtractions(extractions) {
    const issues = [];
    for (const entry of extractions) {
        const hits = (entry.fictionHits || []).filter((h) => !String(h).startsWith('parse error'));
        if (!hits.length) continue;
        issues.push({
            id: `fiction-${entry.fileName}`,
            severity: 'high',
            type: 'Fictional KPI',
            filePath: entry.fileName,
            count: hits.length,
            description: `${entry.fileName}: ${hits.slice(0, 4).join('; ')}`,
            recommendedAction: 'Replace with repository-audit baseline sample values',
            affectedFiles: [entry.fileName],
            metadata: { fictionHits: hits }
        });
    }
    return issues;
}

function driftIssuesFromExtractions(extractions, baseline) {
    const issues = [];

    for (const entry of extractions) {
        if (baseline.dataSource && entry.kpis.dataSource && entry.kpis.dataSource !== baseline.dataSource) {
            issues.push({
                id: `datasource-${entry.fileName}`,
                severity: 'medium',
                type: 'Data Source Mismatch',
                filePath: entry.fileName,
                count: 1,
                description: `${entry.fileName}: dataSource="${entry.kpis.dataSource}" (expected "${baseline.dataSource}")`,
                recommendedAction: 'Set dataSource to repository-audit or import via stale guard',
                affectedFiles: [entry.fileName]
            });
        }

        if (baseline.currentRelease && entry.kpis.currentRelease && entry.kpis.currentRelease !== baseline.currentRelease) {
            issues.push({
                id: `release-${entry.fileName}`,
                severity: 'low',
                type: 'Release Mismatch',
                filePath: entry.fileName,
                count: 1,
                description: `${entry.fileName}: currentRelease="${entry.kpis.currentRelease}" (expected "${baseline.currentRelease}")`,
                recommendedAction: 'Align release milestone with release-timeline-sample.json',
                affectedFiles: [entry.fileName]
            });
        }

        const jest = entry.kpis.jestTests;
        if (baseline.jestTestsPassing != null && jest != null) {
            const numeric = typeof jest === 'number' ? jest : parseInt(String(jest).split('/')[0], 10);
            if (!Number.isNaN(numeric) && numeric !== baseline.jestTestsPassing) {
                issues.push({
                    id: `jest-${entry.fileName}`,
                    severity: 'medium',
                    type: 'Jest Count Mismatch',
                    filePath: entry.fileName,
                    count: 1,
                    description: `${entry.fileName}: jest=${jest} (expected ${baseline.jestTestsLabel})`,
                    recommendedAction: 'Run npm test and sync sample KPIs to measured baseline',
                    affectedFiles: [entry.fileName]
                });
            }
        }

        if (baseline.activeModel && entry.kpis.model && !String(entry.kpis.model).includes(baseline.activeModel.split('.')[0])) {
            const model = String(entry.kpis.model);
            if (!/platform-checklist|agi-chatbot-test/i.test(model)) {
                issues.push({
                    id: `model-${entry.fileName}`,
                    severity: 'low',
                    type: 'Model Name Mismatch',
                    filePath: entry.fileName,
                    count: 1,
                    description: `${entry.fileName}: model="${model}" (expected ${baseline.activeModel} or platform-checklist)`,
                    recommendedAction: 'Use measured activeModel or platform-checklist in sample modelInfo',
                    affectedFiles: [entry.fileName]
                });
            }
        }
    }

    const releaseValues = extractions
        .map((e) => e.kpis.currentRelease)
        .filter(Boolean);
    const uniqueReleases = [...new Set(releaseValues)];
    if (uniqueReleases.length > 1) {
        issues.push({
            id: 'cross-release-mismatch',
            severity: 'medium',
            type: 'Cross-Sample Inconsistency',
            filePath: 'anchor-samples',
            count: uniqueReleases.length,
            description: `currentRelease differs across anchors: ${uniqueReleases.join(', ')}`,
            recommendedAction: 'Sync release-timeline, master-roadmap, and engineering-baseline samples',
            affectedFiles: extractions.filter((e) => e.kpis.currentRelease).map((e) => e.fileName)
        });
    }

    return issues;
}

function compareKpis(extractions, baseline) {
    return [
        ...fictionIssuesFromExtractions(extractions),
        ...driftIssuesFromExtractions(extractions, baseline)
    ];
}

async function loadSampleExtractions(dataDir, fileNames, baseline) {
    const extractions = [];
    for (const fileName of fileNames) {
        const filePath = path.join(dataDir, fileName);
        if (!fs.existsSync(filePath)) continue;
        try {
            const payload = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
            extractions.push(extractKpis(payload, fileName, baseline));
        } catch (error) {
            extractions.push({
                fileName,
                kpis: {},
                fictionHits: [`parse error: ${error.message}`]
            });
        }
    }
    return extractions;
}

function listSampleJsonFiles(dataDir) {
    try {
        return fs.readdirSync(dataDir)
            .filter((name) => name.endsWith('-sample.json'))
            .sort();
    } catch {
        return [];
    }
}

async function checkSampleConsistency(baseDir, options = {}) {
    const sampleDir = options.sampleDir || path.join('web', 'data');
    const dataDir = path.join(baseDir, sampleDir);
    const baseline = options.baseline || {};
    const anchorSamples = options.anchorSamples || [];

    if (!fs.existsSync(dataDir)) {
        return { checked: 0, passed: 0, score: null, issues: [], extractions: [] };
    }

    const allSampleFiles = listSampleJsonFiles(dataDir);
    const presentAnchors = anchorSamples.filter((fileName) =>
        fs.existsSync(path.join(dataDir, fileName))
    );

    const fictionExtractions = allSampleFiles.length
        ? await loadSampleExtractions(dataDir, allSampleFiles, baseline)
        : [];
    const anchorExtractions = presentAnchors.length
        ? await loadSampleExtractions(dataDir, presentAnchors, baseline)
        : [];

    if (fictionExtractions.length === 0 && anchorExtractions.length === 0) {
        return { checked: 0, passed: 0, score: null, issues: [], extractions: [] };
    }

    const issues = [
        ...fictionIssuesFromExtractions(fictionExtractions),
        ...driftIssuesFromExtractions(anchorExtractions, baseline)
    ];
    const checked = Math.max(fictionExtractions.length, presentAnchors.length);
    const passed = Math.max(0, checked - issues.length);

    return {
        checked,
        passed,
        score: checked ? Math.round(((checked - issues.length) / checked) * 100) : null,
        issues,
        extractions: fictionExtractions,
        anchorExtractions,
        samplesScanned: fictionExtractions.length,
        anchorsChecked: presentAnchors.length
    };
}

module.exports = {
    checkSampleConsistency,
    extractKpis,
    deepIncludesFiction,
    detectStaleRoadmapTemplate,
    collectDevelopmentPhases,
    fictionIssuesFromExtractions,
    driftIssuesFromExtractions,
    compareKpis,
    listSampleJsonFiles,
    loadSampleExtractions
};
