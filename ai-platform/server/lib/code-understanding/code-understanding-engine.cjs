/**
 * Multi-layer code understanding orchestrator (static + semantic + contextual + expert).
 */

const fs = require('fs');
const path = require('path');
const { createLanguageDetector } = require('../universal-language-detector.cjs');
const { getBuiltinPluginManager } = require('../plugin-system/index.cjs');
const { analyzeSemanticLayer } = require('./semantic-analyzer.cjs');
const { analyzeContextualLayer } = require('./contextual-analyzer.cjs');
const { loadExpertReviews, summarizeExpertConsensus } = require('./expert-review-store.cjs');

const detector = createLanguageDetector();

/**
 * Build static layer.
 * @param {any} content
 * @param {string} filePath
 * @param {Array} staticFindings
 * @returns {any}
 */
function buildStaticLayer(content, filePath, staticFindings = []) {
    const detection = detector.detectLanguage(filePath || 'snippet.txt', content);
    const plugin = getBuiltinPluginManager().getByLanguage(detection.language);

    return {
        layer: 'static',
        language: detection.language,
        languageLabel: detection.label || detection.language,
        confidence: detection.confidence,
        method: detection.method,
        pluginId: plugin?.id || null,
        findingCount: staticFindings.length,
        topFindings: staticFindings.slice(0, 8).map((f) => ({
            category: f.category,
            type: f.type,
            severity: f.severity,
            description: f.description
        }))
    };
}

/**
 * Synthesize summary.
 * @param {Array} layers
 * @returns {any}
 */
function synthesizeSummary(layers) {
    const parts = [];
    if (layers.semantic?.purpose) parts.push(layers.semantic.purpose);
    if (layers.contextual?.contextSummary) parts.push(layers.contextual.contextSummary);
    if (layers.expert?.consensus?.latestNote) parts.push(`Expert note: ${layers.expert.consensus.latestNote}`);
    if (layers.semantic?.aiSummary) parts.push(layers.semantic.aiSummary);
    return parts.join(' ').trim() || 'Insufficient data for a consolidated summary.';
}

/**
 * Assess overall confidence.
 * @param {Array} layers
 * @returns {any}
 */
function assessOverallConfidence(layers) {
    const scores = [
        layers.static?.confidence,
        layers.semantic?.purposeConfidence,
        layers.contextual?.confidence,
        layers.expert?.consensus?.confidence
    ].filter((v) => typeof v === 'number');
    if (!scores.length) return 0.4;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

/**
 * Understand code snippet.
 * @param {any} content
 * @param {string} context
 * @param {Object} options
 * @returns {any}
 */
async function understandCodeSnippet(content, context = {}, options = {}) {
    const filePath = context.filePath || 'snippet.txt';
    const staticFindings = context.staticFindings || [];
    const detection = detector.detectLanguage(filePath, content);

    const staticLayer = buildStaticLayer(content, filePath, staticFindings);
    const semanticLayer = await analyzeSemanticLayer(content, {
        ...context,
        filePath,
        languageDetection: detection,
        staticFindings
    }, options);

    const contextualLayer = context.projectPath
        ? await analyzeContextualLayer(filePath, context.projectPath, content)
        : { layer: 'contextual', available: false, contextSummary: 'No project root provided for git/doc context.' };

    let expertLayer = { layer: 'expert', reviews: [], consensus: { count: 0, consensus: null, confidence: 0 } };
    if (context.projectPath) {
        const relPath = String(filePath).replace(/\\/g, '/');
        const reviews = await loadExpertReviews(context.platformRoot || context.projectPath, {
            filePath: relPath,
            projectPath: context.projectPath
        });
        expertLayer = {
            layer: 'expert',
            reviews: reviews.slice(-5),
            consensus: await summarizeExpertConsensus(reviews)
        };
    }

    const layers = {
        static: staticLayer,
        semantic: semanticLayer,
        contextual: contextualLayer,
        expert: expertLayer
    };

    return {
        type: 'code-understanding-report',
        reportVersion: 1,
        filePath,
        projectPath: context.projectPath || null,
        generatedAt: new Date().toISOString(),
        layers,
        summary: synthesizeSummary(layers),
        overallConfidence: assessOverallConfidence(layers),
        limitations: [
            'Semantic layer uses heuristics — analysis mode optional via understandingMode=semantic.',
            'Runtime behavior (Layer 3) not included in this release.',
            'Expert reviews are local-only until a shared review service is configured.'
        ]
    };
}

/**
 * Understand file.
 * @param {string} absolutePath
 * @param {Object} options
 * @returns {any}
 */
async function understandFile(absolutePath, options = {}) {
    const resolved = path.resolve(absolutePath);
    const content = await fs.promises.readFile(resolved, 'utf8');
    const projectPath = options.projectPath || path.dirname(resolved);
    return understandCodeSnippet(content, {
        filePath: options.relativePath || path.basename(resolved),
        projectPath,
        platformRoot: options.platformRoot || projectPath,
        staticFindings: options.staticFindings || []
    }, options);
}

/**
 * Attach understanding to codebase report.
 * @param {number} report
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
async function attachUnderstandingToCodebaseReport(report, projectPath, options = {}) {
    const analysisRoot = report.codeAnalysisRoot || report.platformRoot || report.projectRoot || projectPath;
    const sampleFindings = (report.findings || []).slice(0, 20);
    const topFiles = [...new Set(sampleFindings.map((f) => f.filePath))].slice(0, 3);
    const fileInsights = [];

    for (const rel of topFiles) {
        const abs = path.join(analysisRoot, rel);
        try {
            const content = await fs.promises.readFile(abs, 'utf8');
            const understanding = await understandCodeSnippet(content, {
                filePath: rel,
                projectPath,
                platformRoot: options.platformRoot || projectPath,
                staticFindings: sampleFindings.filter((f) => f.filePath === rel)
            }, { ...options, mode: options.understandingMode || 'deterministic' });
            fileInsights.push({ filePath: rel, understanding });
        } catch {
            /* skip unreadable */
        }
    }

    return {
        ...report,
        codeUnderstanding: {
            mode: options.understandingMode || 'deterministic',
            projectSummary: fileInsights.length
                ? `Sampled ${fileInsights.length} high-signal file(s) for semantic/contextual understanding.`
                : 'No file samples available for deep understanding.',
            fileInsights,
            layersAvailable: ['static', 'semantic', 'contextual', 'expert'],
            layersPlanned: ['runtime']
        }
    };
}

module.exports = {
    understandCodeSnippet,
    understandFile,
    attachUnderstandingToCodebaseReport,
    synthesizeSummary
};
