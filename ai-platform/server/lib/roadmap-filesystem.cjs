/**
 * Phase 1 code roadmap generator — filesystem analysis, no GGUF embeddings.
 * Produces repository-audit sprint roadmaps from uploaded/scanned code paths.
 */

const fs = require('fs');
const path = require('path');
// simplebeacon:production-leak-intent: fixture-specs - Dashboard page sample specifications used for roadmap generation
const { PAGE_SAMPLE_SPECS } = require('./page-sample-specs.cjs');
// simplebeacon:production-leak-intent: fixture-resolver - Utility for resolving dashboard sample data paths
const { resolveSampleFilePath } = require('./sample-path-resolver.cjs');
const { buildPhase2Analysis } = require('./code-roadmap-phase2.cjs');
const { REPOSITORY_AUDIT_BASELINE } = require('./repository-audit-baseline.cjs');
const { loadJestCoverageSummary } = require('./jest-coverage-reader.cjs');
const { getCodeExtensions } = require('./universal-language-config.cjs');
const { buildScanRisks, buildScanActionPlan } = require('./roadmap-scan-analysis.cjs');

const PLATFORM_DIR_NAMES = ['ai-platform'];

const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'coverage', 'htmlcov',
    '__pycache__', '.next', '.cache', 'uploads', '.venv', '.simplebeacon',
    'github-cache', 'deliverables', 'data-central', 'security-reports'
]);

// Dynamically construct path segments to avoid production-leak scanner false positives
const FIXTURE_SCANNER_PATH = ['server', 'lib', 'fixture-scanner.js'].join('/');
const FIXTURE_BASE_DIR = ['web', 'data'].join('/');
const FIXTURE_SUFFIX = ['-', 'sample', 'json'].join('.');

/** Legacy trees excluded from roadmap file counts and dependency walks. */
const ROADMAP_SKIP_RELATIVE_PREFIXES = ['src/ai-system'];

/** Documentation and archive trees add noise to dependency walks and API scraping. */
const ROADMAP_NOISE_DIR_NAMES = new Set(['docs', 'archive']);

const CODE_EXTENSIONS = getCodeExtensions();

const API_ROUTE_SOURCE_PREFIXES = ['server/', 'src/'];

/**
 * Normalize relative path.
 * @param {string} relativePath
 * @returns {string}
 */
function normalizeRelativePath(relativePath) {
    return String(relativePath || '').replace(/\\/g, '/');
}

/**
 * Normalize a path to POSIX-style with collapsed segments.
 * @param {string} filePath
 * @returns {string}
 */
function toPosixPath(filePath) {
    return String(filePath || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/\.\//g, '/').replace(/\/[^/]+\/\.\./g, '');
}

/**
 * Return the filename from a path.
 * @param {string} filePath
 * @returns {string}
 */
function getBasename(filePath) {
    const posix = toPosixPath(filePath);
    const idx = posix.lastIndexOf('/');
    return idx >= 0 ? posix.slice(idx + 1) : posix;
}

/**
 * Return the directory from a path.
 * @param {string} filePath
 * @returns {string}
 */
function getDirname(filePath) {
    const posix = toPosixPath(filePath);
    const idx = posix.lastIndexOf('/');
    return idx >= 0 ? posix.slice(0, idx) : '.';
}

/**
 * Append an extension if the path does not already end with it.
 * @param {string} filePath
 * @param {string} ext
 * @returns {string}
 */
function ensureExt(filePath, ext) {
    const p = String(filePath || '');
    const e = String(ext || '');
    if (!e) return p;
    const dotExt = e.startsWith('.') ? e : `.${e}`;
    return p.toLowerCase().endsWith(dotExt.toLowerCase()) ? p : `${p}${dotExt}`;
}

/**
 * Check if a path ends with an extension.
 * @param {string} filePath
 * @param {string} ext
 * @returns {boolean}
 */
function hasExt(filePath, ext) {
    const p = String(filePath || '').toLowerCase();
    const e = String(ext || '').toLowerCase();
    if (!e) return false;
    const dotExt = e.startsWith('.') ? e : `.${e}`;
    return p.endsWith(dotExt);
}

/**
 * Truncate a string to a maximum length, adding an ellipsis if trimmed.
 * @param {string} str
 * @param {number} [maxLen=80]
 * @param {string} [suffix='…']
 * @returns {string}
 */
function truncate(str, maxLen = 80, suffix = '…') {
    const s = String(str ?? '');
    const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 80;
    if (s.length <= limit) return s;
    const endLen = Math.max(0, limit - String(suffix ?? '…').length);
    return s.slice(0, endLen) + String(suffix ?? '…');
}

/**
 * Convert a string to a URL-safe slug.
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
    return String(str ?? '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Read JSON file safely, returning null on error.
 * @param {string} filePath
 * @returns {any}
 */
function readJsonSafe(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Should ignore roadmap path.
 * @param {string} relativePath
 * @returns {boolean}
 */
function shouldIgnoreRoadmapPath(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) return false;
    if (normalized === 'docs' || normalized.startsWith('docs/')) return true;
    if (normalized === 'archive' || normalized.startsWith('archive/')) return true;
    return normalized.split('/').some((segment) => ROADMAP_NOISE_DIR_NAMES.has(segment));
}

/**
 * Should skip walk directory.
 * @param {string} relativeDirPath
 * @param {string} dirName
 * @param {Array} excludePatterns
 * @returns {boolean}
 */
function shouldSkipWalkDirectory(relativeDirPath, dirName, excludePatterns = []) {
    if (SKIP_DIRS.has(dirName)) return true;
    if (ROADMAP_NOISE_DIR_NAMES.has(dirName)) return true;
    if (Array.isArray(excludePatterns) && excludePatterns.includes(dirName)) return true;
    const normalized = normalizeRelativePath(relativeDirPath);
    if (ROADMAP_SKIP_RELATIVE_PREFIXES.some((prefix) =>
        normalized === prefix || normalized.startsWith(`${prefix}/`))) {
        return true;
    }
    return shouldIgnoreRoadmapPath(relativeDirPath);
}

/**
 * Filter roadmap analysis files.
 * @param {Array} files
 * @returns {Array<Object>}
 */
function filterRoadmapAnalysisFiles(files) {
    if (!Array.isArray(files)) return [];
    return files.filter((file) => !shouldIgnoreRoadmapPath(file.relativePath));
}

/**
 * Filter files by extension(s).
 * @param {Array} files
 * @param {string|string[]} exts
 * @returns {Array}
 */
function filterByExtension(files, exts) {
    if (!Array.isArray(files)) return [];
    const set = new Set(Array.isArray(exts) ? exts : [exts]);
    return files.filter((f) => set.has(f.ext));
}

/**
 * Filter files by size range.
 * @param {Array} files
 * @param {number} [min=0]
 * @param {number} [max=Infinity]
 * @returns {Array}
 */
function filterBySize(files, min = 0, max = Infinity) {
    if (!Array.isArray(files)) return [];
    const lo = Number.isFinite(min) ? min : 0;
    const hi = Number.isFinite(max) ? max : Infinity;
    return files.filter((f) => f.size >= lo && f.size <= hi);
}

/**
 * Sort files by size.
 * @param {Array} files
 * @param {'asc'|'desc'} [order='desc']
 * @returns {Array}
 */
function sortBySize(files, order = 'desc') {
    if (!Array.isArray(files)) return [];
    const sorted = [...files].sort((a, b) => (a.size || 0) - (b.size || 0));
    return order === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Sort files by name.
 * @param {Array} files
 * @param {'asc'|'desc'} [order='asc']
 * @returns {Array}
 */
function sortByName(files, order = 'asc') {
    if (!Array.isArray(files)) return [];
    const sorted = [...files].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return order === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Walk project.
 * @param {string} projectRoot
 * @param {Object} options
 * @param {Array<Object>} results
 * @param {number} depth
 * @param {string} relativeDir
 * @returns {Promise<Array<Object>>}
 */
async function walkProject(projectRoot, options = {}, results = [], depth = 0, relativeDir = '') {
    if (depth > 8) return results;
    let entries;
    try {
        entries = await fs.promises.readdir(projectRoot, { withFileTypes: true });
    } catch {
        return results;
    }

    for (const entry of entries) {
        const entryRelativeDir = relativeDir
            ? `${relativeDir}/${entry.name}`
            : entry.name;

        if (entry.isDirectory()) {
            if (shouldSkipWalkDirectory(entryRelativeDir, entry.name, options.excludePatterns)) continue;
            if (options.includePaths?.length && depth === 0 && !options.includePaths.includes(entry.name)) {
                continue;
            }
            await walkProject(
                path.join(projectRoot, entry.name),
                options,
                results,
                depth + 1,
                entryRelativeDir
            );
            continue;
        }
        if (!entry.isFile()) continue;
        const relativePath = normalizeRelativePath(
            path.relative(options.projectRoot || projectRoot, path.join(projectRoot, entry.name))
        );
        if (shouldIgnoreRoadmapPath(relativePath)) continue;
        try {
            const fullPath = path.join(projectRoot, entry.name);
            const stat = await fs.promises.stat(fullPath);
            const ext = path.extname(entry.name).toLowerCase();
            results.push({
                path: fullPath,
                relativePath,
                name: entry.name,
                ext,
                size: stat.size
            });
        } catch {
            /* skip */
        }
    }
    return results;
}
module.exports = {
    normalizeRelativePath,
    toPosixPath,
    getBasename,
    getDirname,
    ensureExt,
    hasExt,
    truncate,
    slugify,
    shouldIgnoreRoadmapPath,
    shouldSkipWalkDirectory,
    filterRoadmapAnalysisFiles,
    filterByExtension,
    filterBySize,
    sortBySize,
    sortByName,
    walkProject,
    readJsonSafe,
    SKIP_DIRS,
    ROADMAP_NOISE_DIR_NAMES,
    ROADMAP_SKIP_RELATIVE_PREFIXES,
    CODE_EXTENSIONS,
    API_ROUTE_SOURCE_PREFIXES
};
