/**
 * Track mock/data file consumers and orphaned datasets.
 */

const fs = require('fs');
const path = require('path');
const { isDataFile } = require('./utils/data-file-utils');
const { parseNonCodeReferences } = require('../file-reduction/utils/file-reference-tracker');
const { parseImports } = require('../file-reduction/utils/import-parser');

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.md']);

const DEFAULT_LINEAGE_ALLOWLIST = [
    'web/data/**',
    '**/*-sample.json',
    'data/mock/**',
    'data-central/**',
    'data/roadmap/**',
    'docker-compose*.yml',
    'tests/fixtures/**',
    'reports/archive/**'
];

function globToRegExp(pattern) {
    const normalized = String(pattern || '').replace(/\\/g, '/').trim();
    if (!normalized) return null;
    let regex = '';
    for (let i = 0; i < normalized.length; i += 1) {
        const ch = normalized[i];
        if (ch === '*') {
            if (normalized[i + 1] === '*') {
                regex += '.*';
                i += 1;
            } else {
                regex += '[^/]*';
            }
            continue;
        }
        regex += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${regex}$`, 'i');
}

function buildAllowlistPatterns(patterns = []) {
    const merged = [...DEFAULT_LINEAGE_ALLOWLIST, ...patterns];
    return merged.map(globToRegExp).filter(Boolean);
}

function isLineageAllowlisted(relativePath, allowlistPatterns) {
    const rel = String(relativePath || '').replace(/\\/g, '/');
    return allowlistPatterns.some((pattern) => pattern.test(rel));
}

class DataLineageAnalyzer {
    constructor(options = {}) {
        const custom = options.lineageAllowlist || options.allowlist || [];
        this.allowlistPatterns = buildAllowlistPatterns(custom);
    }

    async scan(projectRoot, options = {}) {
        const inventory = options.inventory;
        const dataFiles = inventory.files.filter((file) => isDataFile(file));
        const sourceFiles = inventory.files.filter((file) => SOURCE_EXTENSIONS.has(file.ext));
        const consumers = new Map();

        for (const dataFile of dataFiles) {
            consumers.set(dataFile.relativePath, new Set());
        }

        for (const sourceFile of sourceFiles.slice(0, 3000)) {
            let content = '';
            try {
                content = await fs.promises.readFile(sourceFile.path, 'utf8');
            } catch {
                continue;
            }

            for (const dataFile of dataFiles) {
                const basename = dataFile.name;
                const relForward = dataFile.relativePath.replace(/\\/g, '/');
                if (
                    content.includes(basename)
                    || content.includes(relForward)
                    || content.includes(relForward.replace(/\//g, '\\'))
                ) {
                    consumers.get(relForward)?.add(sourceFile.relativePath);
                }
            }

            for (const ref of parseNonCodeReferences(sourceFile.path, content, inventory.root)) {
                if (!ref.resolvedPath) continue;
                const rel = path.relative(inventory.root, ref.resolvedPath).split(path.sep).join('/');
                if (consumers.has(rel)) {
                    consumers.get(rel).add(sourceFile.relativePath);
                }
            }

            for (const imp of parseImports(sourceFile.path, content, inventory.root)) {
                if (!imp.resolvedPath) continue;
                const rel = path.relative(inventory.root, imp.resolvedPath).split(path.sep).join('/');
                if (consumers.has(rel)) {
                    consumers.get(rel).add(sourceFile.relativePath);
                }
            }
        }

        const findings = [];
        const lineage = [];

        for (const dataFile of dataFiles) {
            const rel = dataFile.relativePath;
            const refs = [...(consumers.get(rel) || [])];
            lineage.push({
                path: rel,
                consumerCount: refs.length,
                consumers: refs.slice(0, 10)
            });

            if (refs.length === 0 && !isLineageAllowlisted(rel, this.allowlistPatterns)) {
                findings.push({
                    type: 'orphaned-data',
                    path: rel,
                    reason: 'Data file has no detected consumers in scanned source',
                    severity: 'low',
                    confidence: 'medium',
                    action: 'archive-or-wire-consumer',
                    metadata: { consumerCount: 0 }
                });
            }
        }

        return {
            scanner: 'data-lineage',
            findings,
            summary: {
                dataFilesTracked: dataFiles.length,
                orphanedDataFiles: findings.length,
                connectedDataFiles: dataFiles.length - findings.length
            },
            metadata: { lineage: lineage.slice(0, 200) }
        };
    }
}

module.exports = {
    DataLineageAnalyzer,
    DEFAULT_LINEAGE_ALLOWLIST,
    isLineageAllowlisted,
    buildAllowlistPatterns
};
