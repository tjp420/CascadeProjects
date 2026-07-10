/**
 * Detect supply-chain risks in lock files and package metadata.
 * Scans for typosquatting, suspicious install scripts, and known-compromised
 * package names without external registry calls.
 */

const fs = require('fs');
const path = require('path');
const { walkProjectFiles } = require('./utils/project-walker');

const POPULAR_PACKAGES = new Set([
    'lodash', 'express', 'react', 'react-dom', 'axios', 'next', 'vue',
    'angular', 'typescript', 'webpack', 'eslint', 'prettier', 'jest',
    'rimraf', 'commander', 'chalk', 'debug', 'async', 'request',
    'underscore', 'moment', 'uuid', 'fs-extra', 'glob', 'yargs',
    'inquirer', 'dotenv', 'babel-loader', '@babel/core',
    '@types/node', '@types/react', 'tslib', 'core-js',
    'node-fetch', 'cross-env', 'nodemon', 'mocha', 'chai',
    'mkdirp', 'semver', 'minimist', 'qs', 'bluebird',
    'prop-types', 'classnames', 'redux', 'react-redux',
    'styled-components', '@testing-library/react',
    '@testing-library/jest-dom', 'tailwindcss',
    'postcss', 'autoprefixer', 'vite', 'rollup',
    'ws', 'pg', 'webpack-cli', 'webpack-merge', 'webpack-sources',
    'babel-jest', 'babel-plugin-istanbul', 'babel-preset-jest',
    'eslint-scope', 'eslint-visitor-keys', 'express-rate-limit',
    'jest-changed-files', 'jest-circus', 'jest-cli', 'jest-config',
    'jest-diff', 'jest-docblock', 'jest-each', 'jest-environment-node',
    'jest-get-type', 'jest-haste-map', 'jest-leak-detector',
    'jest-matcher-utils', 'jest-message-util', 'jest-mock',
    'jest-pnp-resolver', 'jest-regex-util', 'jest-resolve',
    'jest-resolve-dependencies', 'jest-runner', 'jest-runtime',
    'jest-snapshot', 'jest-util', 'jest-validate', 'jest-watcher',
    'jest-worker', 'pg-cloudflare', 'pg-connection-string', 'pg-int8',
    'pg-pool', 'pg-protocol', 'pg-types', 'pgpass', 'react-is',
    'ms', 'jws', 'jwa', 'pkg', 'cors'
]);

// Packages that are standard, well-known dependencies but match the historical-compromise
// heuristics (e.g., 'rc' was flagged in a 2021 incident and is pulled in by 'pkg').
const SAFE_PACKAGES = new Set(['rc']);

const KNOWN_COMPROMISED_PATTERNS = [
    /^electron-native-notify/,
    /^flatmap-stream/,
    /^event-stream$/,
    /^colors[-_]/,
    /^faker[-_]/,
    /^node-ipc$/,
    /^ua-parser-js$/,
    /^coa$/,
    /^rc$/,
    /^colors$/,
    /^crossenv$/,
    /^safe-eval$/,
    /^bignumber.js/,
    /^telnet/
];

const SUSPICIOUS_SCRIPT_PATTERNS = [
    /curl\s+.*\|.*sh/,
    /wget\s+.*\|.*sh/,
    /fetch\(.*\)\s*\.then\(.*=>.*exec/,
    /child_process/,
    /spawn\s*\(/,
    /exec\s*\(/,
    /eval\s*\(/,
    /Function\s*\(/,
    /https?:\/\/[^\s"']+/,
    /\.exe/,
    /powershell/,
    /cmd\.exe/,
    /reg\s+add/,
    /netsh/,
    /iptables/,
    /base64\s+-d/,
    /atob\s*\(/,
    /Buffer\.from\s*\([^,]+,\s*['"]base64['"]/
];

function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[b.length][a.length];
}

function isTyposquat(name, popularSet, maxDistance = 1) {
    if (popularSet.has(name)) return null;
    for (const pop of popularSet) {
        if (Math.abs(name.length - pop.length) > maxDistance) continue;
        const dist = levenshteinDistance(name, pop);
        if (dist <= maxDistance && dist > 0) {
            return pop;
        }
    }
    return null;
}

function isKnownCompromisedPattern(name) {
    return KNOWN_COMPROMISED_PATTERNS.some((re) => re.test(name));
}

function hasSuspiciousScripts(pkg) {
    const scripts = pkg.scripts || {};
    const installHooks = [
        scripts.postinstall,
        scripts.preinstall,
        scripts.install
    ].filter(Boolean);
    const suspicious = [];
    for (const hook of installHooks) {
        for (const pattern of SUSPICIOUS_SCRIPT_PATTERNS) {
            if (pattern.test(hook)) {
                suspicious.push({ hook, pattern: pattern.source });
                break;
            }
        }
    }
    return suspicious;
}

function extractPackagesFromPackageLock(content) {
    try {
        const parsed = JSON.parse(content);
        const packages = [];
        const deps = parsed.packages || parsed.dependencies || {};
        for (const [key, value] of Object.entries(deps)) {
            if (!key || key === '') continue;
            const name = key.startsWith('node_modules/') ? key.slice('node_modules/'.length) : key;
            packages.push({ name, version: value.version, resolved: value.resolved, integrity: value.integrity });
        }
        return packages;
    } catch {
        return [];
    }
}

function extractPackagesFromYarnLock(content) {
    const packages = [];
    const lines = content.split('\n');
    let currentName = null;
    let currentVersion = null;
    for (const line of lines) {
        const nameMatch = line.match(/^"?([@\w/.-]+)@[^"]+"?:/);
        if (nameMatch) {
            currentName = nameMatch[1];
            currentVersion = null;
        }
        const versionMatch = line.match(/^\s+version\s+"(.+)"/);
        if (versionMatch && currentName) {
            currentVersion = versionMatch[1];
            packages.push({ name: currentName, version: currentVersion });
        }
    }
    return packages;
}

class SupplyChainSecurityScanner {
    constructor(config = {}) {
        this.popularPackages = new Set(config.popularPackages || POPULAR_PACKAGES);
        this.maxTyposquatDistance = config.maxTyposquatDistance ?? 1;
        this.maxFilesToScan = config.maxFilesToScan ?? 3;
    }

    async scan(projectRoot, options = {}) {
        const inventory = options.inventory || await walkProjectFiles(projectRoot, options);
        const findings = [];
        const scannedPackages = new Set();

        const lockFiles = inventory.files.filter((file) =>
            ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(file.name)
        );

        const packageJsonFiles = inventory.files.filter((file) => file.name === 'package.json');

        for (const lockFile of lockFiles.slice(0, this.maxFilesToScan)) {
            let content;
            try {
                content = fs.readFileSync(lockFile.path, 'utf8');
            } catch {
                continue;
            }

            let packages = [];
            if (lockFile.name === 'package-lock.json') {
                packages = extractPackagesFromPackageLock(content);
            } else if (lockFile.name === 'yarn.lock') {
                packages = extractPackagesFromYarnLock(content);
            }

            for (const pkg of packages) {
                if (scannedPackages.has(pkg.name)) continue;
                scannedPackages.add(pkg.name);
                if (SAFE_PACKAGES.has(pkg.name)) continue;

                const typosquatTarget = isTyposquat(pkg.name, this.popularPackages, this.maxTyposquatDistance);
                if (typosquatTarget) {
                    findings.push({
                        type: 'supply-chain-typosquat',
                        path: lockFile.relativePath,
                        reason: `Package "${pkg.name}" may be typosquatting "${typosquatTarget}"`,
                        severity: 'high',
                        confidence: 'medium',
                        action: 'verify-package-source',
                        metadata: { package: pkg.name, typosquatTarget, version: pkg.version }
                    });
                }

                if (isKnownCompromisedPattern(pkg.name)) {
                    findings.push({
                        type: 'supply-chain-compromised',
                        path: lockFile.relativePath,
                        reason: `Package "${pkg.name}" matches known compromised pattern`,
                        severity: 'critical',
                        confidence: 'medium',
                        action: 'remove-and-audit',
                        metadata: { package: pkg.name, version: pkg.version }
                    });
                }
            }
        }

        for (const pkgFile of packageJsonFiles) {
            let pkg;
            try {
                pkg = JSON.parse(fs.readFileSync(pkgFile.path, 'utf8'));
            } catch {
                continue;
            }

            const suspicious = hasSuspiciousScripts(pkg);
            if (suspicious.length > 0) {
                findings.push({
                    type: 'supply-chain-suspicious-script',
                    path: pkgFile.relativePath,
                    reason: `Suspicious install scripts detected: ${suspicious.map((s) => s.hook.slice(0, 40)).join(', ')}`,
                    severity: 'high',
                    confidence: 'high',
                    action: 'review-install-scripts',
                    metadata: { scripts: suspicious.map((s) => s.hook) }
                });
            }

            const allDeps = {
                ...pkg.dependencies,
                ...pkg.devDependencies,
                ...pkg.optionalDependencies,
                ...pkg.peerDependencies
            };

            for (const depName of Object.keys(allDeps)) {
                if (SAFE_PACKAGES.has(depName)) continue;
                const typosquatTarget = isTyposquat(depName, this.popularPackages, this.maxTyposquatDistance);
                if (typosquatTarget) {
                    findings.push({
                        type: 'supply-chain-typosquat',
                        path: pkgFile.relativePath,
                        reason: `Dependency "${depName}" may be typosquatting "${typosquatTarget}"`,
                        severity: 'high',
                        confidence: 'medium',
                        action: 'verify-package-source',
                        metadata: { package: depName, typosquatTarget }
                    });
                }
            }
        }

        return {
            scanner: 'supply-chain-security',
            findings,
            summary: {
                lockFilesScanned: lockFiles.length,
                packageJsonFilesScanned: packageJsonFiles.length,
                typosquatFindings: findings.filter((f) => f.type === 'supply-chain-typosquat').length,
                compromisedFindings: findings.filter((f) => f.type === 'supply-chain-compromised').length,
                suspiciousScriptFindings: findings.filter((f) => f.type === 'supply-chain-suspicious-script').length
            }
        };
    }
}

module.exports = { SupplyChainSecurityScanner };
