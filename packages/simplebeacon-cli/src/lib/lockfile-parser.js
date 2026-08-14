// simplebeacon-ignore: Scanner utility — lockfile parsing, no real secrets
/**
 * Shared lockfile parser for CVE dependency scanner and SBOM generator.
 * Supports:
 *   - npm package-lock.json (v2/v3)
 *   - yarn.lock (v1)
 *   - pnpm-lock.yaml (v5/v6, lightweight parse)
 *
 * Exports a single function: parseLockfile(rootDir, options) → { ecosystem, packages, lockfilePath, format }
 * where packages is an array of { name, version, resolved, integrity, dev, optional }
 */

const fs = require('fs');
const path = require('path');

/**
 * Find the first lockfile in the project root.
 * @param {string} rootDir
 * @returns {{ lockfilePath: string, format: 'npm'|'yarn'|'pnpm' } | null}
 */
function findLockfile(rootDir) {
    const candidates = [
        { file: 'package-lock.json', format: 'npm' },
        { file: 'npm-shrinkwrap.json', format: 'npm' },
        { file: 'yarn.lock', format: 'yarn' },
        { file: 'pnpm-lock.yaml', format: 'pnpm' },
    ];
    for (const c of candidates) {
        const full = path.join(rootDir, c.file);
        if (fs.existsSync(full)) {
            return { lockfilePath: full, format: c.format };
        }
    }
    // Check subdirectories one level deep (monorepo workspaces)
    try {
        const entries = fs.readdirSync(rootDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            for (const c of candidates) {
                const full = path.join(rootDir, entry.name, c.file);
                if (fs.existsSync(full)) {
                    return { lockfilePath: full, format: c.format };
                }
            }
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * Parse npm package-lock.json (v2/v3).
 * @param {string} lockfilePath
 * @returns {{ packages: Array, format: string, ecosystem: string }}
 */
function parseNpmLockfile(lockfilePath) {
    const raw = fs.readFileSync(lockfilePath, 'utf8');
    const data = JSON.parse(raw);
    const packages = [];
    // v3: { packages: { "node_modules/foo": { version, resolved, integrity, dev, optional } } }
    // v1: { dependencies: { foo: { version, resolved, integrity, dev, optional, dependencies: {...} } } }
    if (data.packages && typeof data.packages === 'object') {
        for (const [key, info] of Object.entries(data.packages)) {
            if (!key || key === '' || info.version == null) continue;
            // Extract package name from path like "node_modules/foo" or "node_modules/@bar/baz"
            const name = extractNpmPackageName(key);
            if (!name) continue;
            packages.push({
                name,
                version: info.version,
                resolved: info.resolved || '',
                integrity: info.integrity || '',
                dev: info.dev === true,
                optional: info.optional === true,
            });
        }
    } else if (data.dependencies && typeof data.dependencies === 'object') {
        // v1 format — flatten nested deps
        function walkDeps(deps, prefix) {
            for (const [name, info] of Object.entries(deps || {})) {
                if (!name || info.version == null) continue;
                packages.push({
                    name,
                    version: info.version,
                    resolved: info.resolved || '',
                    integrity: info.integrity || '',
                    dev: info.dev === true,
                    optional: info.optional === true,
                });
                if (info.dependencies) walkDeps(info.dependencies, prefix);
            }
        }
        walkDeps(data.dependencies, '');
    }
    return { packages, format: 'npm', ecosystem: 'npm' };
}

/**
 * Extract package name from npm lockfile v3 key path.
 * "node_modules/foo" → "foo"
 * "node_modules/@bar/baz" → "@bar/baz"
 * "apps/server/node_modules/lodash" → "lodash"
 */
function extractNpmPackageName(key) {
    const parts = key.split('node_modules/');
    const last = parts[parts.length - 1];
    if (!last) return null;
    // Scoped package: @org/name
    if (last.startsWith('@')) {
        const slashIdx = last.indexOf('/');
        if (slashIdx === -1) return last;
        // @org/name — but there might be a subpath after name
        const afterOrg = last.slice(slashIdx + 1);
        const nextSlash = afterOrg.indexOf('/');
        return nextSlash === -1 ? last : last.slice(0, slashIdx + 1 + nextSlash);
    }
    const slashIdx = last.indexOf('/');
    return slashIdx === -1 ? last : last.slice(0, slashIdx);
}

/**
 * Parse yarn.lock (v1).
 * Format is text, not JSON:
 *   "package-name@^1.0.0":
 *     version "1.0.1"
 *     resolved "https://..."
 *     integrity sha512-...
 */
function parseYarnLockfile(lockfilePath) {
    const raw = fs.readFileSync(lockfilePath, 'utf8');
    const packages = [];
    const seen = new Set();
    const lines = raw.split('\n');
    let currentName = null;
    let currentVersion = null;
    let currentResolved = '';
    let currentIntegrity = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Key line: starts with " or contains @ at start (no leading spaces)
        if (line && !line.startsWith(' ') && !line.startsWith('#') && line.trim()) {
            // Flush previous entry
            if (currentName && currentVersion) {
                const key = `${currentName}@${currentVersion}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    packages.push({
                        name: currentName,
                        version: currentVersion,
                        resolved: currentResolved,
                        integrity: currentIntegrity,
                        dev: false,
                        optional: false,
                    });
                }
            }
            // Parse new key — could be multiple specs separated by ", "
            // e.g. "lodash@^4.17.0, lodash@^4.17.21":
            const keyMatch = line.match(/^"?([^@]+)@/);
            if (keyMatch) {
                currentName = keyMatch[1].replace(/^"/, '');
                // Handle scoped: "@org/name@version"
                if (currentName.startsWith('@') && line.match(/^"(@[^"]+@)/)) {
                    currentName = line.match(/^"(@[^"]+)@/)[1];
                }
            }
            currentVersion = null;
            currentResolved = '';
            currentIntegrity = '';
        } else if (line.startsWith('  version ')) {
            currentVersion = line.match(/version\s+"([^"]+)"/)?.[1] || null;
        } else if (line.startsWith('  resolved ')) {
            currentResolved = line.match(/resolved\s+"([^"]+)"/)?.[1] || '';
        } else if (line.startsWith('  integrity ')) {
            currentIntegrity = line.match(/integrity\s+(\S+)/)?.[1] || '';
        }
    }
    // Flush last entry
    if (currentName && currentVersion) {
        const key = `${currentName}@${currentVersion}`;
        if (!seen.has(key)) {
            seen.add(key);
            packages.push({
                name: currentName,
                version: currentVersion,
                resolved: currentResolved,
                integrity: currentIntegrity,
                dev: false,
                optional: false,
            });
        }
    }
    return { packages, format: 'yarn', ecosystem: 'npm' };
}

/**
 * Parse pnpm-lock.yaml (v5/v6) — lightweight text parse (no YAML dependency).
 * Extracts packages from the `packages:` section.
 */
function parsePnpmLockfile(lockfilePath) {
    const raw = fs.readFileSync(lockfilePath, 'utf8');
    const packages = [];
    const seen = new Set();
    // pnpm v6: "/lodash/4.17.21" or "/@babel/core/7.0.0"
    // pnpm v5: "lodash/4.17.21"
    const _packageRegex = /^\/?(?:@[^/]+\/)?[^/\s]+\/(\d[^/\s]*)/gm;
    // More robust: parse line by line in packages section
    const lines = raw.split('\n');
    let inPackages = false;
    for (const line of lines) {
        if (line.startsWith('packages:')) {
            inPackages = true;
            continue;
        }
        if (inPackages) {
            // End of packages section when we hit a non-indented line
            if (line && !line.startsWith(' ') && !line.startsWith('#')) {
                inPackages = false;
                continue;
            }
            // Match: "  /lodash/4.17.21:" or "  /@babel/core/7.0.0:"
            const match = line.match(/^\s+\/?(@[^/]+\/[^/\s]+|[^/\s]+)\/(\d[^/\s]*):/);
            if (match) {
                const name = match[1];
                const version = match[2];
                const key = `${name}@${version}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    packages.push({
                        name,
                        version,
                        resolved: '',
                        integrity: '',
                        dev: false,
                        optional: false,
                    });
                }
            }
        }
    }
    return { packages, format: 'pnpm', ecosystem: 'npm' };
}

/**
 * Parse the lockfile in rootDir and return a normalized package list.
 * @param {string} rootDir
 * @param {{ lockfilePath?: string }} [options]
 * @returns {{ packages: Array<{name:string,version:string,resolved:string,integrity:string,dev:boolean,optional:boolean}>, lockfilePath: string, format: string, ecosystem: string } | null}
 */
function parseLockfile(rootDir, options = {}) {
    const located = options.lockfilePath
        ? { lockfilePath: options.lockfilePath, format: detectFormat(options.lockfilePath) }
        : findLockfile(rootDir);
    if (!located) return null;

    switch (located.format) {
        case 'npm':
            return { ...parseNpmLockfile(located.lockfilePath), lockfilePath: located.lockfilePath };
        case 'yarn':
            return { ...parseYarnLockfile(located.lockfilePath), lockfilePath: located.lockfilePath };
        case 'pnpm':
            return { ...parsePnpmLockfile(located.lockfilePath), lockfilePath: located.lockfilePath };
        default:
            return null;
    }
}

function detectFormat(lockfilePath) {
    const base = path.basename(lockfilePath);
    if (base === 'package-lock.json' || base === 'npm-shrinkwrap.json') return 'npm';
    if (base === 'yarn.lock') return 'yarn';
    if (base === 'pnpm-lock.yaml') return 'pnpm';
    return 'npm';
}

/**
 * Read package.json from rootDir to extract license info for SBOM.
 * @param {string} rootDir
 * @returns {{ name?: string, version?: string, license?: string, dependencies?: object, devDependencies?: object } | null}
 */
function readPackageJson(rootDir) {
    const pkgPath = path.join(rootDir, 'package.json');
    try {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

module.exports = {
    parseLockfile,
    findLockfile,
    readPackageJson,
    extractNpmPackageName,
};
