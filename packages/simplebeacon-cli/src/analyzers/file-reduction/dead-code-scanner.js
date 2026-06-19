/**
 * Static-analysis scanner for orphaned exports and dead functions.
 * Operates at the function/export level to complement the file-level
 * unused-file-detector.
 */

const fs = require('fs');
const path = require('path');
const { walkProjectFiles } = require('./utils/project-walker');
const { parseImports, JS_SOURCE_EXTENSIONS } = require('./utils/import-parser');

const EXPORT_PATTERNS = [
    { kind: 'named', regex: /(?:export\s+(?:const|let|var|function|class)\s+)([A-Za-z_$][A-Za-z0-9_$]*)/g },
    { kind: 'named-list', regex: /export\s*\{\s*([A-Za-z_$][A-Za-z0-9_$]*(?:\s*,\s*[A-Za-z_$][A-Za-z0-9_$]*)*)\s*\}/g },
    { kind: 'default', regex: /export\s+default\s+(?:function\s+|class\s+)?([A-Za-z_$][A-Za-z0-9_$]*)/g },
    { kind: 'default-anon', regex: /export\s+default\s+(?:function\s*\(|class\s*\{)/g }
];

const IMPORT_PATTERNS_FOR_NAMES = [
    { kind: 'named', regex: /import\s*\{([^}]+)\}\s*from/g },
    { kind: 'star', regex: /import\s*\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from/g },
    { kind: 'default', regex: /import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from/g }
];

const BUILT_IN_GLOBALS = new Set([
    'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
    'Math', 'JSON', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Error', 'TypeError', 'ReferenceError', 'console', 'process',
    'Buffer', 'require', 'module', 'exports', '__dirname', '__filename',
    'global', 'window', 'document', 'fetch', 'setTimeout', 'setInterval',
    'clearTimeout', 'clearInterval', 'requestAnimationFrame'
]);

const SKIP_DEAD_CODE_PATHS = [
    /(?:^|\/)web\/simplebeacon-dashboard\/js\/components\//,
    /(?:^|\/)web\/simplebeacon-dashboard\/js\/services\//,
    /(?:^|\/)web\/simplebeacon-dashboard\/js\/lib\//,
    /(?:^|\/)web\/simplebeacon-dashboard\/js\/utils\//,
    /(?:^|\/)web\/simplebeacon-dashboard\/js\/views\//,
    /(?:^|\/)vscode-extension\/src\//,
    /(?:^|\/)simplebeacon-vscode\//,
    /complete-scan-artifact-profile\.browser\.js$/,
    /(?:^|\/)coming-soon\/js\/dashboard\/phase-registry\.js$/,
    // Skip landing page projects — exports are consumed by HTML script tags, not ES module imports
    /(?:^|\/)coming-soon\//,
    /(?:^|\/)ai-platform\/tools\/replay-scope-patches\.js$/,
    /(?:^|\/)scripts\/bulk-fix-jsdoc\.js$/,
    // Skip scanner infrastructure files — exports are used internally or by server routes, not by static imports
    /(?:^|\/)server\/lib\/codebase-analyzer\.(js|cjs)$/,
    /(?:^|\/)server\/lib\/token-db\.(js|cjs)$/,
    /(?:^|\/)server\/lib\/code-roadmap-generator\.(js|cjs)$/,
    /(?:^|\/)server\/lib\/code-roadmap-phase2\.(js|cjs)$/,
    /(?:^|\/)server\/lib\/file-merger-reduction-scanner\.(js|cjs)$/,
    /(?:^|\/)server\/lib\/json-file-cache\.(js|cjs)$/
];

function stripStringLiterals(content) {
    // Remove single-line strings (both single and double quotes)
    let cleaned = content.replace(/['"](?:[^'"\\]|\\.)*['"]/g, "''");
    // Remove template literals
    cleaned = cleaned.replace(/`(?:[^`\\]|\\.)*`/g, '``');
    return cleaned;
}

function extractNamedExports(content) {
    const exports = [];
    const cleanedContent = stripStringLiterals(content);
    for (const pattern of EXPORT_PATTERNS) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes('g') ? pattern.regex.flags : pattern.regex.flags + 'g');
        let match = regex.exec(cleanedContent);
        while (match) {
            if (pattern.kind === 'named-list' && match[1]) {
                const names = match[1].split(',').map((n) => n.trim()).filter(Boolean);
                for (const name of names) {
                    exports.push({ name, kind: 'named' });
                }
            } else if (pattern.kind === 'default-anon') {
                exports.push({ name: 'default', kind: 'default' });
            } else if (match[1]) {
                exports.push({ name: match[1], kind: pattern.kind });
            }
            match = regex.exec(cleanedContent);
        }
    }
    return exports;
}

function extractNamedImports(content) {
    const imports = [];
    for (const pattern of IMPORT_PATTERNS_FOR_NAMES) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes('g') ? pattern.regex.flags : pattern.regex.flags + 'g');
        let match = regex.exec(content);
        while (match) {
            if (pattern.kind === 'named' && match[1]) {
                const names = match[1].split(',').map((n) => n.trim()).filter(Boolean);
                for (const name of names) {
                    const cleanName = name.split(' as ')[0].trim();
                    imports.push({ name: cleanName, kind: 'named' });
                }
            } else if (match[1]) {
                imports.push({ name: match[1], kind: pattern.kind });
            }
            match = regex.exec(content);
        }
    }
    return imports;
}

function resolveModuleRelative(fromFile, specifier, projectRoot) {
    if (!specifier.startsWith('.')) return null;
    const baseDir = path.dirname(fromFile);
    const candidates = [
        path.resolve(baseDir, specifier),
        path.resolve(baseDir, `${specifier}.js`),
        path.resolve(baseDir, `${specifier}.mjs`),
        path.resolve(baseDir, `${specifier}.cjs`),
        path.resolve(baseDir, `${specifier}.ts`),
        path.resolve(baseDir, `${specifier}.tsx`),
        path.resolve(baseDir, `${specifier}.jsx`),
        path.resolve(baseDir, specifier, 'index.js'),
        path.resolve(baseDir, specifier, 'index.ts')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

function findImportSourcesForFile(filePath, projectFiles) {
    const importSources = [];
    for (const otherFile of projectFiles) {
        if (otherFile.path === filePath) continue;
        if (!JS_SOURCE_EXTENSIONS.has(otherFile.ext)) continue;
        let content;
        try {
            content = fs.readFileSync(otherFile.path, 'utf8');
        } catch {
            continue;
        }
        const imports = parseImports(otherFile.path, content, path.dirname(filePath));
        for (const imp of imports) {
            if (imp.resolvedPath === filePath) {
                importSources.push({ path: otherFile.relativePath, specifier: imp.specifier });
            }
        }
    }
    return importSources;
}

class DeadCodeScanner {
    constructor(config = {}) {
        this.maxFiles = config.maxFiles ?? 1500;
        this.minConfidence = config.minConfidence || 'low';
        this.confidenceRank = { high: 3, medium: 2, low: 1 };
    }

    async scan(projectRoot, options = {}) {
        const inventory = options.inventory || await walkProjectFiles(projectRoot, options);
        const findings = [];
        const sourceFiles = inventory.files
            .filter((file) => JS_SOURCE_EXTENSIONS.has(file.ext))
            .slice(0, this.maxFiles);

        const allExports = new Map();
        const allImports = new Map();

        for (const file of sourceFiles) {
            const normalizedRel = (file.relativePath || '').replace(/\\/g, '/');
            if (SKIP_DEAD_CODE_PATHS.some((re) => re.test(normalizedRel))) continue;

            let content;
            try {
                content = fs.readFileSync(file.path, 'utf8');
            } catch {
                continue;
            }

            const exports = extractNamedExports(content);
            if (exports.length > 0) {
                allExports.set(file.path, { file, exports });
            }

            const imports = extractNamedImports(content);
            allImports.set(file.path, { file, imports });
        }

        for (const [filePath, { file, exports }] of allExports) {
            const importSources = findImportSourcesForFile(filePath, sourceFiles);
            const importedNames = new Set();
            for (const source of importSources) {
                let content;
                try {
                    content = fs.readFileSync(path.join(projectRoot, source.path), 'utf8');
                } catch {
                    continue;
                }
                const names = extractNamedImports(content);
                for (const n of names) {
                    importedNames.add(n.name);
                }
            }

            for (const exp of exports) {
                if (exp.kind === 'default') continue;
                if (BUILT_IN_GLOBALS.has(exp.name)) continue;

                const isImported = importedNames.has(exp.name);
                const hasInternalRefs = this.hasInternalReferences(filePath, exp.name);

                if (!isImported && !hasInternalRefs) {
                    findings.push({
                        type: 'dead-export',
                        path: file.relativePath,
                        reason: `Export "${exp.name}" is never imported by other modules or used internally`,
                        severity: 'low',
                        confidence: 'medium',
                        action: 'remove-dead-export',
                        metadata: { symbol: exp.name, kind: exp.kind }
                    });
                } else if (!isImported && hasInternalRefs) {
                    findings.push({
                        type: 'orphaned-export',
                        path: file.relativePath,
                        reason: `Export "${exp.name}" is used internally but never imported externally`,
                        severity: 'low',
                        confidence: 'low',
                        action: 'consider-unexporting',
                        metadata: { symbol: exp.name, kind: exp.kind }
                    });
                }
            }
        }

        const filteredFindings = findings.filter((f) => {
            return this.confidenceRank[f.confidence] >= this.confidenceRank[this.minConfidence];
        });

        return {
            scanner: 'dead-code',
            findings: filteredFindings,
            summary: {
                filesAnalyzed: sourceFiles.length,
                deadExports: findings.filter((f) => f.type === 'dead-export').length,
                orphanedExports: findings.filter((f) => f.type === 'orphaned-export').length
            }
        };
    }

    hasInternalReferences(filePath, symbolName) {
        let content;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            return false;
        }
        const cleanedContent = stripStringLiterals(content);
        const exportDeclRegex = new RegExp(`export\\s+.*?\\b${symbolName}\\b[^\\n]*\\n?`, 'g');
        const withoutExport = cleanedContent.replace(exportDeclRegex, '');
        const regex = new RegExp(`\\b${symbolName}\\b`, 'g');
        return regex.test(withoutExport);
    }
}

module.exports = { DeadCodeScanner };
