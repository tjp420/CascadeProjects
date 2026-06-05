/**
 * Run npm audit and normalize results for the Security dashboard.
 */

const { execSync, execFile } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = util.promisify(execFile);

function resolveNpmPath() {
    if (process.platform === 'win32') {
        try {
            const safeCwd = process.env.SystemRoot || 'C:\\Windows';
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

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, medium: 2, low: 1, info: 0 };

let cache = null;

function severityRank(severity) {
    return SEVERITY_RANK[String(severity || '').toLowerCase()] ?? 0;
}

function advisoryFromVia(via) {
    if (!Array.isArray(via)) return {};
    return via.find((entry) => entry && typeof entry === 'object') || {};
}

function parseNpmAuditJson(raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const vulnMeta = data.metadata?.vulnerabilities || {};
    const depMeta = data.metadata?.dependencies || {};
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

    let stdout = '';
    try {
        stdout = execSync(`"${NPM_PATH}" audit --json`, {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'pipe']
        });
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

// Async wrapper for server-side non-blocking usage
async function runNpmAuditAsync(projectRoot, options = {}) {
    const root = path.resolve(projectRoot || process.cwd());
    const cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const now = Date.now();

    if (!options.force && cache && cache.root === root && (now - cache.at) < cacheTtl) {
        return cache.result;
    }

    let stdout = '';
    try {
        const result = await execFileAsync(NPM_PATH, ['audit', '--json'], {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
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

function clearNpmAuditCache() {
    cache = null;
}

module.exports = {
    parseNpmAuditJson,
    runNpmAudit,
    runNpmAuditAsync,
    clearNpmAuditCache
};
