/**
 * Run npm audit and normalize results for the Security dashboard.
 */

const { execSync } = require('child_process');
const path = require('path');

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

function runNpmAudit(projectRoot, options = {}) {
    const root = path.resolve(projectRoot || process.cwd());
    const cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const now = Date.now();

    if (!options.force && cache && cache.root === root && (now - cache.at) < cacheTtl) {
        return cache.result;
    }

    let stdout = '';
    try {
        stdout = execSync('npm audit --json', {
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
                error: error.message,
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
    clearNpmAuditCache
};
