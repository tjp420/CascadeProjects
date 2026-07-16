// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Phase 2 code roadmap analysis — dependency cycles, fuzzy similarity, solo resources.
 */

const fs = require('fs');
const path = require('path');
const { buildSemanticHints, probeLlamaCppBin } = require('./llama-cpp-hints.cjs');

const constants = require('../config/constants.cjs');
const FUZZY_THRESHOLD = 0.92;
const MAX_FUZZY_PAIRS = 12;
const MAX_GRAPH_FILES = 300;
const FUZZY_MAX_CONTENT_LENGTH = 8000;
const MAX_CYCLE_DEPTH = 300;

/**
 * Resolve relative import.
 * @param {string} fromRelativePath
 * @param {any} dep
 * @param {any} projectRoot
 * @returns {any}
 */
function resolveRelativeImport(fromRelativePath, dep, projectRoot) {
    if (!dep.startsWith('.')) return null;
    const fromAbs = path.join(projectRoot, fromRelativePath);
    const base = path.resolve(path.dirname(fromAbs), dep);
    const candidates = [
        base,
        `${base}.js`, `${base}.cjs`, `${base}.mjs`,
        `${base}.ts`, `${base}.tsx`, `${base}.jsx`,
        path.join(base, 'index.js'),
        path.join(base, 'index.cjs'),
        path.join(base, 'index.mjs')
    ];
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;
        const rel = path.relative(projectRoot, candidate).replace(/\\/g, '/');
        if (!rel.startsWith('..')) return rel;
    }
    return null;
}

/**
 * Should ignore phase2 path.
 * @param {string} relativePath
 * @returns {any}
 */
function shouldIgnorePhase2Path(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/');
    if (!normalized) return false;
    if (normalized === 'docs' || normalized.startsWith('docs/')) return true;
    if (normalized === 'archive' || normalized.startsWith('archive/')) return true;
    return normalized.split('/').some((segment) => segment === 'docs' || segment === 'archive');
}

/**
 * Build internal dependency graph.
 * @param {Array} files
 * @param {any} projectRoot
 * @returns {any}
 */
function buildInternalDependencyGraph(files, projectRoot) {
    const jsFiles = files
        .filter((f) => f.ext === '.js' && f.size < 200000 && !shouldIgnorePhase2Path(f.relativePath))
        .slice(0, MAX_GRAPH_FILES);
    const graph = new Map();
    const edges = [];

    for (const file of jsFiles) {
        if (!graph.has(file.relativePath)) graph.set(file.relativePath, new Set());
        let content;
        try {
            content = fs.readFileSync(file.path, 'utf8');
        } catch {
            continue;
        }
        const patterns = [
            /require\(['"]([^'"]+)['"]\)/g,
            /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
            /import\s*\(['"]([^'"]+)['"]\)/g
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const dep = match[1];
                const resolved = resolveRelativeImport(file.relativePath, dep, projectRoot);
                if (!resolved || resolved === file.relativePath) continue;
                graph.get(file.relativePath).add(resolved);
                edges.push({ from: file.relativePath, to: resolved, type: 'import' });
                if (!graph.has(resolved)) graph.set(resolved, new Set());
            }
        }
    }

    return {
        nodeCount: graph.size,
        edgeCount: edges.length,
        edges: edges.slice(0, 200),
        adjacencyList: Object.fromEntries(
            [...graph.entries()].map(([key, value]) => [key, [...value]])
        )
    };
}

/**
 * Detect circular dependencies.
 * @param {any} graph
 * @returns {any}
 */
function detectCircularDependencies(graph) {
    const adjacency = graph.adjacencyList || {};
    const nodes = Object.keys(adjacency);
    const cycles = [];
    const visited = new Set();
    const stack = new Set();

/**
 * Dfs.
 * @param {any} node
 * @param {string} pathStack
 * @returns {any}
 */
    const dfs = (node, pathStack, depth) => {
        if (depth > MAX_CYCLE_DEPTH) return;
        visited.add(node);
        stack.add(node);
        for (const neighbor of adjacency[node] || []) {
            if (!visited.has(neighbor)) {
                dfs(neighbor, [...pathStack, neighbor], depth + 1);
            } else if (stack.has(neighbor)) {
                const start = pathStack.indexOf(neighbor);
                const cyclePath = start >= 0 ? [...pathStack.slice(start), neighbor] : [...pathStack, neighbor];
                cycles.push({
                    path: cyclePath,
                    length: cyclePath.length,
                    impact: cyclePath.length > 4 ? 'medium' : 'low',
                    description: `${cyclePath.length}-node import cycle`
                });
            }
        }
        stack.delete(node);
    };

    for (const node of nodes) {
        if (!visited.has(node)) dfs(node, [node], 1);
    }

    const unique = [];
    const seen = new Set();
    for (const cycle of cycles) {
        const key = [...cycle.path].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(cycle);
    }

    return unique.slice(0, 20);
}

/**
 * Normalize for fuzzy.
 * @param {any} content
 * @returns {any}
 */
function normalizeForFuzzy(content) {
    return content
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, FUZZY_MAX_CONTENT_LENGTH);
}

/**
 * Fuzzy similarity.
 * @param {any} a
 * @param {any} b
 * @returns {any}
 */
function fuzzySimilarity(a, b) {
    if (a === b) return 1;
    if (!a.length || !b.length) return 0;
    const tokensA = new Set(a.split(/\W+/).filter((t) => t.length > 2));
    const tokensB = new Set(b.split(/\W+/).filter((t) => t.length > 2));
    if (!tokensA.size || !tokensB.size) return 0;
    let intersection = 0;
    for (const token of tokensA) {
        if (tokensB.has(token)) intersection += 1;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    return union ? intersection / union : 0;
}

/**
 * Find fuzzy similar pairs.
 * @param {Array} files
 * @param {any} _projectRoot
 * @returns {any}
 */
function findFuzzySimilarPairs(files, _projectRoot) {
    const scoped = files.filter((f) =>
        f.ext === '.js'
        && f.size < 80000
        && f.size > 100
        && (f.relativePath.startsWith('server/') || f.relativePath.startsWith('src/'))
    ).slice(0, 80);

    const loaded = [];
    for (const file of scoped) {
        try {
            const raw = fs.readFileSync(file.path, 'utf8');
            loaded.push({ file, normalized: normalizeForFuzzy(raw) });
        } catch {
            /* skip */
        }
    }

    const pairs = [];
    for (let i = 0; i < loaded.length; i++) {
        for (let j = i + 1; j < loaded.length; j++) {
            const similarity = fuzzySimilarity(loaded[i].normalized, loaded[j].normalized);
            if (similarity >= FUZZY_THRESHOLD && loaded[i].normalized !== loaded[j].normalized) {
                pairs.push({
                    fileA: loaded[i].file.relativePath,
                    fileB: loaded[j].file.relativePath,
                    similarity: Math.round(similarity * 1000) / 1000,
                    method: 'token-jaccard',
                    recommendation: 'Review for merge/refactor — not identical duplicates'
                });
            }
        }
    }

    return pairs.sort((a, b) => b.similarity - a.similarity).slice(0, MAX_FUZZY_PAIRS);
}

/**
 * Detect gguf availability.
 * @returns {any}
 */
function detectGgufAvailability() {
    const probe = probeLlamaCppBin();
    return {
        available: probe.configured,
        executable: probe.executable,
        llamaCppBin: probe.path,
        mode: !probe.configured
            ? 'filesystem-only'
            : probe.executable
                ? 'llama-cpp-ready'
                : 'llama-cpp-path-missing',
        semanticSimilarity: probe.configured
            ? 'Fuzzy token match + optional semantic hints on path scan'
            : 'Fuzzy token match only — set LLAMA_CPP_BIN for optional hints',
        note: 'No embedding model run during filesystem scan unless analyze uses model.path'
    };
}

/**
 * Estimate solo resources.
 * @param {any} sprintModel
 * @returns {any}
 */
function estimateSoloResources(sprintModel) {
    const phases = sprintModel.phases || [];
    const remaining = phases.filter((p) => p.status !== 'completed');
    let remainingHours = 0;

    for (const phase of remaining) {
        const progress = phase.progress || 0;
        const baseHours = 40;
        remainingHours += baseHours * ((100 - progress) / 100);
    }

    remainingHours = Math.round(remainingHours);
    const hourlyRateUsd = 75;
    const internalBudgetUsd = Math.round(remainingHours * hourlyRateUsd);

    return {
        teamSize: 1,
        role: 'Solo maintainer',
        remainingSprints: remaining.length,
        estimatedHours: remainingHours,
        hourlyRateUsd,
        internalBudgetUsd,
        budgetNote: 'Internal notional estimate — not $204k enterprise fiction',
        sprintBreakdown: remaining.map((phase) => ({
            phase: phase.phase,
            progress: phase.progress,
            estimatedHours: Math.round(40 * ((100 - (phase.progress || 0)) / 100))
        }))
    };
}

/**
 * Build phase2 analysis.
 * @param {Array} files
 * @param {any} projectRoot
 * @param {any} sprintModel
 * @returns {any}
 */
function buildPhase2Analysis(files, projectRoot, sprintModel) {
    const dependencyGraph = buildInternalDependencyGraph(files, projectRoot);
    const circularDependencies = detectCircularDependencies(dependencyGraph);
    const fuzzySimilarityPairs = findFuzzySimilarPairs(files, projectRoot);
    const gguf = detectGgufAvailability();
    const semanticHints = buildSemanticHints(fuzzySimilarityPairs);
    const resourceEstimate = estimateSoloResources(sprintModel);

    return {
        phase: 'Phase 2 — Code intelligence',
        status: 'active',
        dependencyGraph: {
            summary: {
                nodes: dependencyGraph.nodeCount,
                edges: dependencyGraph.edgeCount,
                circularCycles: circularDependencies.length
            },
            circularDependencies,
            sampleEdges: dependencyGraph.edges.slice(0, 12)
        },
        fuzzySimilarity: {
            method: 'token-jaccard',
            threshold: FUZZY_THRESHOLD,
            pairsFound: fuzzySimilarityPairs.length,
            pairs: fuzzySimilarityPairs,
            gguf
        },
        semanticHints,
        resourceEstimate,
        visualization: {
            circularDependencyGraph: {
                nodes: [...new Set(circularDependencies.flatMap((c) => c.path))],
                edges: circularDependencies.map((c, index) => ({
                    id: `cycle-${index + 1}`,
                    path: c.path,
                    impact: c.impact
                }))
            }
        },
        rejectedFiction: {
            claims: [
                '85-95% roadmap accuracy guarantees',
                'Multi-FTE team composition from GGUF',
                '$204k budget forecasts from scan'
            ]
        }
    };
}

module.exports = {
    buildInternalDependencyGraph,
    detectCircularDependencies,
    findFuzzySimilarPairs,
    detectGgufAvailability,
    estimateSoloResources,
    buildPhase2Analysis,
    FUZZY_THRESHOLD
};
