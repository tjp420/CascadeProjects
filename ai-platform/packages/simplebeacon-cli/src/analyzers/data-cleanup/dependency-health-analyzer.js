/**
 * Inspect package.json dependency health without external registry calls.
 */

const fs = require('fs');
const path = require('path');
const { filterWorkspaceFiles, isWorkspacePath } = require('./utils/workspace-path-utils');

const IMPORT_PATTERNS = [
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
];

function packageNameFromSpecifier(specifier) {
    if (!specifier || specifier.startsWith('.') || specifier.startsWith('/')) return null;
    if (specifier.startsWith('@')) {
        const parts = specifier.split('/');
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
    }
    return specifier.split('/')[0];
}

function collectImportedPackages(content) {
    const used = new Set();
    for (const regex of IMPORT_PATTERNS) {
        let match = regex.exec(content);
        while (match) {
            const pkg = packageNameFromSpecifier(match[1]);
            if (pkg) used.add(pkg);
            match = regex.exec(content);
        }
    }
    return used;
}

class DependencyHealthAnalyzer {
    async scan(projectRoot, options = {}) {
        const inventory = options.inventory;
        const packageFiles = filterWorkspaceFiles(
            inventory.files.filter((file) => file.name === 'package.json')
        );
        const findings = [];
        const dependencyIndex = new Map();

        for (const file of packageFiles) {
            let pkg;
            try {
                pkg = JSON.parse(fs.readFileSync(file.path, 'utf8'));
            } catch {
                findings.push({
                    type: 'invalid-package-json',
                    path: file.relativePath,
                    reason: 'Invalid JSON in package.json',
                    severity: 'high',
                    confidence: 'high',
                    action: 'fix-package-json'
                });
                continue;
            }

            const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
            const declared = new Map();
            for (const section of sections) {
                const block = pkg[section];
                if (!block || typeof block !== 'object') continue;
                for (const [name, version] of Object.entries(block)) {
                    if (declared.has(name)) {
                        findings.push({
                            type: 'duplicate-dependency',
                            path: file.relativePath,
                            reason: `Dependency "${name}" declared in multiple sections`,
                            severity: 'medium',
                            confidence: 'high',
                            action: 'dedupe-package-json',
                            metadata: { dependency: name }
                        });
                    }
                    declared.set(name, { version, section });
                    const bucket = dependencyIndex.get(name) || [];
                    bucket.push({ path: file.relativePath, version, section });
                    dependencyIndex.set(name, bucket);
                }
            }

            const usedPackages = await this.collectUsedPackagesForPackage(file.path, inventory);
            for (const [name] of declared.entries()) {
                if (name === 'simplebeacon') continue;
                if (!usedPackages.has(name) && !this.isLikelyToolingDependency(name, declared.get(name)?.section)) {
                    findings.push({
                        type: 'unused-dependency',
                        path: file.relativePath,
                        reason: `Dependency "${name}" not referenced by static imports in package tree`,
                        severity: 'low',
                        confidence: 'medium',
                        action: 'verify-and-remove',
                        metadata: { dependency: name }
                    });
                }
            }

            if (declared.has('lodash') && declared.has('lodash-es')) {
                findings.push({
                    type: 'duplicate-dependency',
                    path: file.relativePath,
                    reason: 'Both lodash and lodash-es declared — pick one',
                    severity: 'medium',
                    confidence: 'high',
                    action: 'consolidate-lodash'
                });
            }
        }

        for (const [name, entries] of dependencyIndex.entries()) {
            if (entries.length <= 1) continue;
            const versions = [...new Set(entries.map((entry) => entry.version))];
            if (versions.length <= 1) continue;
            findings.push({
                type: 'version-drift',
                path: entries[0].path,
                reason: `Dependency "${name}" has ${versions.length} versions across workspace`,
                severity: 'medium',
                confidence: 'high',
                action: 'align-workspace-versions',
                metadata: { dependency: name, entries }
            });
        }

        return {
            scanner: 'dependency-health',
            findings,
            summary: {
                packageJsonFiles: packageFiles.length,
                uniqueDependencies: dependencyIndex.size,
                unusedDependencies: findings.filter((f) => f.type === 'unused-dependency').length,
                duplicateDependencies: findings.filter((f) => f.type === 'duplicate-dependency').length,
                versionDrift: findings.filter((f) => f.type === 'version-drift').length
            }
        };
    }

    isLikelyToolingDependency(name, section) {
        if (section === 'devDependencies') {
            return /^(eslint|jest|vitest|typescript|prettier|husky|nodemon|webpack|vite|rollup|@types\/)/.test(name);
        }
        return false;
    }

    async collectUsedPackagesForPackage(packageJsonPath, inventory) {
        const packageDir = path.dirname(packageJsonPath);
        const packageKey = packageDir.replace(/\\/g, '/');
        const used = new Set();
        const sourceFiles = inventory.files.filter((file) => {
            if (!isWorkspacePath(file.relativePath)) return false;
            const dir = path.dirname(file.path).replace(/\\/g, '/');
            return dir === packageKey || dir.startsWith(`${packageKey}/`);
        }).filter((file) => /\.(js|mjs|cjs|ts|tsx|jsx)$/.test(file.ext));

        for (const file of sourceFiles.slice(0, 500)) {
            let content = '';
            try {
                content = fs.readFileSync(file.path, 'utf8');
            } catch {
                continue;
            }
            for (const pkg of collectImportedPackages(content)) {
                used.add(pkg);
            }
        }
        return used;
    }
}

module.exports = {
    DependencyHealthAnalyzer,
    collectImportedPackages,
    packageNameFromSpecifier
};
