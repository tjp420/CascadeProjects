/**
 * Basic static analysis for files with zero incoming references.
 */

const fs = require('fs');
const path = require('path');
const { walkProjectFiles } = require('./utils/project-walker');
const { parseImports, JS_SOURCE_EXTENSIONS } = require('./utils/import-parser');
const { parseNonCodeReferences, addReference } = require('./utils/file-reference-tracker');
const { buildDependencyGraph, findUnreferencedNodes } = require('./utils/dependency-graph-builder');

const SOURCE_EXTENSIONS = new Set([
    ...JS_SOURCE_EXTENSIONS,
    '.py',
    '.html',
    '.htm',
    '.css',
    '.scss',
    '.json'
]);

const ENTRY_BASENAMES = new Set([
    'index.js',
    'index.ts',
    'index.mjs',
    'main.js',
    'main.ts',
    'app.js',
    'server.js'
]);

const PROTECTED_BASENAMES = new Set([
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'jsconfig.json',
    'README.md',
    'LICENSE',
    '.gitignore'
]);

class UnusedFileDetector {
    constructor(config = {}) {
        this.sourceExtensions = new Set(config.sourceExtensions || SOURCE_EXTENSIONS);
        this.protectedBasenames = new Set(config.protectedBasenames || PROTECTED_BASENAMES);
        this.entryBasenames = new Set(config.entryBasenames || ENTRY_BASENAMES);
    }

    async scan(projectRoot, options = {}) {
        const inventory = options.inventory || await walkProjectFiles(projectRoot, options);
        const sourceFiles = inventory.files.filter((file) => this.sourceExtensions.has(file.ext));
        const imports = [];
        const referenceMap = new Map();

        for (const file of sourceFiles) {
            let content = '';
            try {
                content = await fs.promises.readFile(file.path, 'utf8');
            } catch {
                continue;
            }
            imports.push(...parseImports(file.path, content, inventory.root));
            for (const ref of parseNonCodeReferences(file.path, content, inventory.root)) {
                if (ref.resolvedPath) {
                    addReference(referenceMap, ref.resolvedPath, ref.source);
                }
            }
        }

        for (const entry of imports) {
            if (entry.resolvedPath) {
                addReference(referenceMap, entry.resolvedPath, entry.source);
            }
        }

        const graph = buildDependencyGraph(imports, inventory.root);
        const entryPoints = this.collectEntryPoints(inventory, graph);
        const unreferencedNodes = findUnreferencedNodes(graph, entryPoints);

        const unusedFromGraph = unreferencedNodes
            .filter((node) => this.isCandidate(node.relativePath))
            .map((node) => ({
                type: 'unused-file',
                path: node.relativePath,
                reason: 'Zero incoming import references',
                confidence: 'medium',
                action: 'review-before-delete',
                severity: 'medium'
            }));

        const referencedPaths = new Set(referenceMap.keys());
        for (const [targetPath] of graph.entries()) {
            referencedPaths.add(targetPath);
        }
        for (const entry of entryPoints) {
            referencedPaths.add(path.resolve(entry));
        }

        const orphanFiles = sourceFiles
            .filter((file) => !referencedPaths.has(path.resolve(file.path)))
            .filter((file) => !entryPoints.some((entry) => path.resolve(entry) === path.resolve(file.path)))
            .filter((file) => this.isCandidate(file.relativePath))
            .map((file) => ({
                type: 'unused-file',
                path: file.relativePath,
                reason: 'Not referenced by static import graph',
                confidence: 'low',
                action: 'review-before-delete',
                severity: 'medium'
            }));

        const findings = dedupeFindings([...unusedFromGraph, ...orphanFiles]);

        return {
            scanner: 'unused-files',
            findings,
            summary: {
                sourceFilesScanned: sourceFiles.length,
                entryPoints: entryPoints.length,
                unusedCandidates: findings.length
            },
            metadata: {
                entryPoints: entryPoints.map((entry) => path.relative(inventory.root, entry).split(path.sep).join('/'))
            }
        };
    }

    collectEntryPoints(inventory, graph) {
        const entries = new Set();
        for (const file of inventory.files) {
            if (this.entryBasenames.has(file.name.toLowerCase())) {
                entries.add(file.path);
            }
            if (file.relativePath.startsWith('bin/')) {
                entries.add(file.path);
            }
        }

        const packageJsonPath = inventory.files.find((file) => file.name === 'package.json');
        if (packageJsonPath) {
            entries.add(packageJsonPath.path);
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath.path, 'utf8'));
                if (pkg.main) {
                    entries.add(path.resolve(inventory.root, pkg.main));
                }
                if (pkg.bin && typeof pkg.bin === 'object') {
                    for (const binPath of Object.values(pkg.bin)) {
                        entries.add(path.resolve(inventory.root, binPath));
                    }
                }
            } catch {
                /* ignore invalid package.json */
            }
        }

        for (const node of graph.values()) {
            if (node.importedBy.length === 0 && this.entryBasenames.has(path.basename(node.path).toLowerCase())) {
                entries.add(node.path);
            }
        }

        return [...entries];
    }

    isCandidate(relativePath) {
        const basename = path.basename(relativePath);
        if (this.protectedBasenames.has(basename)) return false;
        if (/\.(test|spec)\.[jt]s$/i.test(basename)) return false;
        if (relativePath.includes('/tests/') || relativePath.includes('/test/')) return false;
        return true;
    }
}

function dedupeFindings(findings) {
    const seen = new Set();
    const unique = [];
    for (const finding of findings) {
        if (seen.has(finding.path)) continue;
        seen.add(finding.path);
        unique.push(finding);
    }
    return unique;
}

module.exports = {
    UnusedFileDetector,
    dedupeFindings
};
