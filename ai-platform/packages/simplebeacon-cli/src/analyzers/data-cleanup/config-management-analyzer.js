/**
 * Detect configuration sprawl and duplicate config files.
 */

const fs = require('fs');
const { parseEnvFile } = require('./utils/env-parser');
const { filterWorkspaceFiles } = require('./utils/workspace-path-utils');
const { resolveEnvProfileGroup, shouldSkipEnvInconsistency } = require('./utils/env-profile-utils');

const CONFIG_PATTERNS = [
    { id: 'env-file', match: (name) => /^\.env/i.test(name), label: 'Environment file' },
    { id: 'package-json', match: (name) => name === 'package.json', label: 'Package manifest' },
    { id: 'bundler-config', match: (name) => /^(webpack|vite|rollup|esbuild|parcel)\.config\./i.test(name), label: 'Bundler config' },
    { id: 'test-config', match: (name) => /^(jest|vitest|playwright|cypress)\.config\./i.test(name) || name === 'jest.config.js', label: 'Test runner config' },
    { id: 'ts-config', match: (name) => /^tsconfig.*\.json$/i.test(name), label: 'TypeScript config' }
];

class ConfigManagementAnalyzer {
    async scan(projectRoot, options = {}) {
        const inventory = options.inventory;
        const configFiles = filterWorkspaceFiles(
            inventory.files.filter((file) =>
                CONFIG_PATTERNS.some((pattern) => pattern.match(file.name))
            )
        );

        const findings = [];
        const byCategory = new Map();

        for (const file of configFiles) {
            const pattern = CONFIG_PATTERNS.find((entry) => entry.match(file.name));
            const bucket = byCategory.get(pattern.id) || [];
            bucket.push(file);
            byCategory.set(pattern.id, bucket);
        }

        const envFiles = byCategory.get('env-file') || [];
        if (envFiles.length > 3) {
            findings.push({
                type: 'config-sprawl',
                path: envFiles[0].relativePath,
                reason: `${envFiles.length} environment files detected — consider consolidating secrets`,
                severity: 'medium',
                confidence: 'medium',
                action: 'review-config-sprawl',
                metadata: { files: envFiles.map((file) => file.relativePath) }
            });
        }

        for (const [category, files] of byCategory.entries()) {
            if (category === 'env-file' || category === 'package-json') continue;
            if (files.length <= 1) continue;
            findings.push({
                type: 'duplicate-config-type',
                path: files[0].relativePath,
                reason: `${files.length} ${CONFIG_PATTERNS.find((p) => p.id === category)?.label || category} files`,
                severity: 'low',
                confidence: 'high',
                action: 'consolidate-configs',
                metadata: { files: files.map((file) => file.relativePath) }
            });
        }

        const packageJsons = byCategory.get('package-json') || [];
        if (packageJsons.length > 5) {
            findings.push({
                type: 'config-sprawl',
                path: packageJsons[0].relativePath,
                reason: `${packageJsons.length} package.json files — verify workspace layout is intentional`,
                severity: 'low',
                confidence: 'medium',
                action: 'review-workspace-layout',
                metadata: { files: packageJsons.map((file) => file.relativePath) }
            });
        }

        const envInconsistencies = this.findEnvInconsistencies(envFiles);
        findings.push(...envInconsistencies);

        const obsoleteCandidates = configFiles.filter((file) =>
            /\.(original|backup|bak|old)\./i.test(file.name)
        );
        for (const file of obsoleteCandidates) {
            findings.push({
                type: 'obsolete-config',
                path: file.relativePath,
                reason: 'Backup or legacy config filename pattern',
                severity: 'low',
                confidence: 'high',
                action: 'archive-or-delete',
                metadata: {}
            });
        }

        return {
            scanner: 'config-management',
            findings,
            summary: {
                configFiles: configFiles.length,
                envFiles: envFiles.length,
                packageJsonFiles: packageJsons.length,
                sprawlFindings: findings.filter((f) => f.type === 'config-sprawl').length,
                duplicateConfigTypes: findings.filter((f) => f.type === 'duplicate-config-type').length,
                inconsistentEnvKeys: findings.filter((f) => f.type === 'env-inconsistency').length
            }
        };
    }

    findEnvInconsistencies(envFiles) {
        const keyValues = new Map();
        const findings = [];

        for (const file of envFiles) {
            let content = '';
            try {
                content = fs.readFileSync(file.path, 'utf8');
            } catch {
                continue;
            }
            const profileGroup = resolveEnvProfileGroup(file.relativePath);
            const entries = parseEnvFile(content);
            for (const [key, meta] of entries.entries()) {
                const bucketKey = `${profileGroup}::${key}`;
                const bucket = keyValues.get(bucketKey) || [];
                bucket.push({ file: file.relativePath, value: meta.value });
                keyValues.set(bucketKey, bucket);
            }
        }

        for (const [bucketKey, values] of keyValues.entries()) {
            const key = bucketKey.split('::').slice(1).join('::');
            const unique = [...new Set(values.map((entry) => entry.value))];
            if (unique.length <= 1 || values.length <= 1) continue;
            if (shouldSkipEnvInconsistency(key, values)) continue;
            findings.push({
                type: 'env-inconsistency',
                path: values[0].file,
                reason: `Environment key ${key} has ${unique.length} different values across env files`,
                severity: 'medium',
                confidence: 'high',
                action: 'align-env-values',
                metadata: { key, values }
            });
        }

        return findings;
    }
}

module.exports = {
    ConfigManagementAnalyzer
};
