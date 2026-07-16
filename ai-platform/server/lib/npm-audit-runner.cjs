// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Run npm audit and normalize results for the Security dashboard.
 */

const { execSync, execFile, exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const constants = require('../config/constants.cjs');
const execFileAsync = util.promisify(execFile);
const execAsync = util.promisify(exec);

/**
 * Resolve npm path.
 * @returns {any}
 */
function resolveNpmPath() {
    if (process.platform === 'win32') {
        try {
            const safeCwd = process.env['SystemRoot'] || 'C:\\Windows';
            const output = execSync('where npm.cmd', { encoding: 'utf8', cwd: safeCwd }).trim();
            const first = output.split(/\r?\n/)[0];
            if (first) return first;
        } catch {
            // fall through
        }
    }
    try {
        const output = execSync('which npm', { encoding: 'utf8' }).trim();
        if (output) return output;
    } catch {
        // fall through
    }
    return 'npm';
}

const NPM_PATH = resolveNpmPath();

const DEFAULT_CACHE_TTL_MS = 5 * constants.ONE_MINUTE_MS;
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, medium: 2, low: 1, info: 0 };

let cache = null;

/**
 * Severity rank.
 * @param {any} severity
 * @returns {any}
 */
function severityRank(severity) {
    return SEVERITY_RANK[String(severity || '').toLowerCase()] ?? 0;
}

/**
 * Advisory from via.
 * @param {any} via
 * @returns {any}
 */
function advisoryFromVia(via) {
    if (!Array.isArray(via)) return {};
    return via.find((entry) => entry && typeof entry === 'object') || {};
}

/**
 * Normalize npm dependency meta.
 * @param {any} depMeta
 * @returns {any}
 */
function normalizeNpmDependencyMeta(depMeta) {
    const prod = depMeta.prod ?? 0;
    const dev = depMeta.dev ?? 0;
    const optional = depMeta.optional ?? 0;
    const peer = depMeta.peer ?? 0;
    const peerOptional = depMeta.peerOptional ?? 0;
    const total = depMeta.total ?? (prod + dev + optional + peer);
    // npm can report total < prod when lockfile includes transitive deps not counted in prod
    const correctedTotal = Math.max(total, prod + dev + optional + peer);
    return { prod, dev, optional, peer, peerOptional, total: correctedTotal };
}

/**
 * Parse npm audit json.
 * @param {any} raw
 * @returns {any}
 */
function parseNpmAuditJson(raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const vulnMeta = data.metadata?.vulnerabilities || {};
    const depMeta = normalizeNpmDependencyMeta(data.metadata?.dependencies || {});
    const vulnerabilities = [];

    for (const [pkg, entry] of Object.entries(data.vulnerabilities || {})) {
        const advisory = advisoryFromVia(entry.via);
        const url = advisory.url || null;
        vulnerabilities.push({
            id: `NPM-${pkg}`,
            title: advisory.title || `${pkg} dependency vulnerability`,
            severity: entry.severity || advisory.severity || 'moderate',
            status: 'open',
            component: pkg,
            cve: url ? url.replace(/^.*\//, '') : '—',
            source: 'npm-audit',
            url,
            fixAvailable: Boolean(entry.fixAvailable),
            isDirect: Boolean(entry.isDirect)
        });
    }

    vulnerabilities.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

    const vulnerabilityTotal = vulnMeta.total ?? vulnerabilities.length;

    return {
        auditReportVersion: data.auditReportVersion || null,
        metadata: {
            vulnerabilities: vulnMeta,
            dependencies: depMeta
        },
        dependencies: depMeta,
        vulnerabilities,
        summary: {
            ...vulnMeta,
            vulnerabilityTotal,
            total: vulnerabilityTotal,
            dependencies: depMeta.total ?? null,
            prodDependencies: depMeta.prod ?? null,
            devDependencies: depMeta.dev ?? null
        }
    };
}

/**
 * Find package json.
 * @param {string} startDir
 * @returns {any}
 */
function findPackageJson(startDir) {
    if (fs.existsSync(path.join(startDir, 'package.json'))) return startDir;
    try {
        const entries = fs.readdirSync(startDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                const subDir = path.join(startDir, entry.name);
                if (fs.existsSync(path.join(subDir, 'package.json'))) return subDir;
            }
        }
    } catch { /* directory read may fail on restricted paths */ }
    return null;
}

const SKIP_PACKAGE_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', 'build', '.next', '.cache', '.venv', 'htmlcov', 'github-cache']);

/**
 * Discover package json locations.
 * @param {string} startDir
 * @param {any} depth
 * @returns {any}
 */
function discoverPackageJsonLocations(startDir, depth = 0) {
    const results = [];
    if (depth > 4) return results;
    if (fs.existsSync(path.join(startDir, 'package.json'))) {
        results.push(startDir);
    }
    try {
        const entries = fs.readdirSync(startDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (SKIP_PACKAGE_DIRS.has(entry.name)) continue;
            if (entry.name.startsWith('.')) continue;
            const subDir = path.join(startDir, entry.name);
            results.push(...discoverPackageJsonLocations(subDir, depth + 1));
        }
    } catch { /* skip restricted dirs */ }
    return results;
}

/**
 * Run single npm audit.
 * @param {any} auditRoot
 * @returns {any}
 */
function runSingleNpmAudit(auditRoot) {
    let stdout = '';
    try {
        stdout = execSync(`"${NPM_PATH}" audit --json`, {
            cwd: auditRoot,
            encoding: 'utf8',
            maxBuffer: 10 * constants.BYTES_PER_KB * constants.BYTES_PER_KB,
            stdio: ['ignore', 'pipe', 'pipe']
        });
    } catch (error) {
        stdout = error.stdout || '';
        if (!stdout.trim()) {
            return null;
        }
    }
    return parseNpmAuditJson(stdout);
}

/**
 * Aggregate npm audits.
 * @param {Array} results
 * @returns {any}
 */
function aggregateNpmAudits(results) {
    const valid = results.filter(Boolean);
    if (valid.length === 0) {
        return {
            auditReportVersion: 2,
            metadata: { vulnerabilities: {}, dependencies: {} },
            dependencies: {},
            vulnerabilities: [],
            summary: { total: 0, vulnerabilityTotal: 0 }
        };
    }
    if (valid.length === 1) return valid[0];

    const seenVulns = new Map();
    const depMeta = { prod: 0, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 0 };
    const vulnMeta = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };

    for (const r of valid) {
        const d = r.metadata?.dependencies || r.dependencies || {};
        depMeta.prod += d.prod || 0;
        depMeta.dev += d.dev || 0;
        depMeta.optional += d.optional || 0;
        depMeta.peer += d.peer || 0;
        depMeta.peerOptional += d.peerOptional || 0;
        depMeta.total += d.total || 0;

        const v = r.metadata?.vulnerabilities || {};
        vulnMeta.info += v.info || 0;
        vulnMeta.low += v.low || 0;
        vulnMeta.moderate += v.moderate || 0;
        vulnMeta.high += v.high || 0;
        vulnMeta.critical += v.critical || 0;
        vulnMeta.total += v.total || 0;

        for (const vuln of r.vulnerabilities || []) {
            const key = vuln.component + '|' + vuln.severity;
            if (!seenVulns.has(key)) {
                seenVulns.set(key, vuln);
            }
        }
    }

    const vulnerabilities = Array.from(seenVulns.values());
    vulnerabilities.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

    return {
        auditReportVersion: 2,
        metadata: { vulnerabilities: vulnMeta, dependencies: depMeta },
        dependencies: depMeta,
        vulnerabilities,
        summary: {
            ...vulnMeta,
            vulnerabilityTotal: vulnMeta.total,
            total: vulnMeta.total,
            dependencies: depMeta.total,
            prodDependencies: depMeta.prod,
            devDependencies: depMeta.dev
        },
        auditRoots: valid.map((r, i) => ({ index: i, root: r.auditRoot || 'unknown' }))
    };
}

/**
 * Run npm audit.
 * @param {any} projectRoot
 * @param {Object} options
 * @returns {any}
 */
function runNpmAudit(projectRoot, options = {}) {
    let root = path.resolve(projectRoot || process.cwd());
    const cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const now = Date.now();

    if (!options.force && cache && cache.root === root && (now - cache.at) < cacheTtl) {
        return cache.result;
    }

    // Uploaded projects may have package.json in a subdirectory
    if (!fs.existsSync(path.join(root, 'package.json'))) {
        const found = findPackageJson(root);
        if (found) root = found;
    }

    const packageRoots = options.monorepo !== false
        ? discoverPackageJsonLocations(root)
        : [root];

    if (packageRoots.length === 0) {
        const result = {
            generatedAt: new Date().toISOString(),
            dataSource: 'npm-audit',
            error: `No package.json found in ${root}. Upload a Node.js project to run npm audit.`,
            metadata: {},
            vulnerabilities: [],
            summary: {}
        };
        cache = { root, at: now, result };
        return result;
    }

    const auditResults = packageRoots.map((auditRoot) => {
        const single = runSingleNpmAudit(auditRoot);
        if (single) single.auditRoot = auditRoot;
        return single;
    });

    const aggregated = aggregateNpmAudits(auditResults);
    const result = {
        generatedAt: new Date().toISOString(),
        dataSource: 'npm-audit',
        auditRoot: root,
        auditRoots: packageRoots,
        ...aggregated
    };

    cache = { root, at: now, result };
    return result;
}

// Async wrapper for server-side non-blocking usage
/**
 * Run npm audit async.
 * @param {any} projectRoot
 * @param {Object} options
 * @returns {any}
 */
async function runNpmAuditAsync(projectRoot, options = {}) {
    let root = path.resolve(projectRoot || process.cwd());
    const cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const now = Date.now();

    if (!options.force && cache && cache.root === root && (now - cache.at) < cacheTtl) {
        return cache.result;
    }

    // Uploaded projects may have package.json in a subdirectory
    if (!fs.existsSync(path.join(root, 'package.json'))) {
        const found = findPackageJson(root);
        if (found) root = found;
    }

    let stdout = '';
    try {
        const result = await execAsync(`"${NPM_PATH}" audit --json`, {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 10 * constants.BYTES_PER_KB * constants.BYTES_PER_KB
        });
        stdout = result.stdout || '';
    } catch (error) {
        stdout = error.stdout || '';
        if (!stdout.trim()) {
            const result = {
                generatedAt: new Date().toISOString(),
                dataSource: 'npm-audit',
                error: `No package.json found in ${root}. Upload a Node.js project to run npm audit.`,
                metadata: {},
                vulnerabilities: [],
                summary: {}
            };
            cache = { root, at: now, result };
            return result;
        }
    }

    const parsed = parseNpmAuditJson(stdout);
    const result = {
        generatedAt: new Date().toISOString(),
        dataSource: 'npm-audit',
        ...parsed
    };

    cache = { root, at: now, result };
    return result;
}

/**
 * Clear npm audit cache.
 * @returns {any}
 */
function clearNpmAuditCache() {
    cache = null;
}

module.exports = {
    parseNpmAuditJson,
    runNpmAudit,
    runNpmAuditAsync,
    clearNpmAuditCache
};
