/**
 * Detect risky or inefficient filesystem/data access patterns in code.
 */

const fs = require('fs');

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

const ACCESS_PATTERNS = [
    {
        id: 'sync-read-in-iteration',
        regex: /\.(?:map|forEach|filter|reduce)\s*\([\s\S]{0,500}?readFile(?:Sync)?\s*\(/g,
        reason: 'Filesystem read inside array iteration — possible N+1 I/O pattern',
        severity: 'medium',
        action: 'batch-or-cache-reads'
    },
    {
        id: 'sync-read-in-route',
        regex: /(?:router|app)\.(?:get|post|put|delete|patch)\s*\([\s\S]{0,700}?readFileSync\s*\(/g,
        reason: 'Synchronous filesystem read inside HTTP route handler',
        severity: 'high',
        action: 'async-read-or-cache'
    },
    {
        id: 'parse-sync-read',
        regex: /JSON\.parse\s*\(\s*fs\.readFileSync\s*\(/g,
        reason: 'JSON.parse(fs.readFileSync()) blocks event loop on every call',
        severity: 'medium',
        action: 'load-at-startup-or-cache'
    },
    {
        id: 'read-in-while-loop',
        regex: /while\s*\([\s\S]{0,400}?readFile(?:Sync)?\s*\(/g,
        reason: 'Filesystem read inside while loop',
        severity: 'medium',
        action: 'review-loop-io'
    }
];

class DataAccessPatternAnalyzer {
    constructor(config = {}) {
        this.sourcePrefixes = config.sourcePrefixes || ['server/', 'src/', 'packages/', 'lib/'];
        this.maxFiles = config.maxFiles ?? 2500;
    }

    async scan(projectRoot, options = {}) {
        const inventory = options.inventory;
        const sourceFiles = inventory.files
            .filter((file) => SOURCE_EXTENSIONS.has(file.ext))
            .filter((file) => this.sourcePrefixes.some((prefix) => file.relativePath.startsWith(prefix)))
            .slice(0, this.maxFiles);

        const findings = [];

        for (const file of sourceFiles) {
            let content = '';
            try {
                content = await fs.promises.readFile(file.path, 'utf8');
            } catch {
                continue;
            }

            for (const pattern of ACCESS_PATTERNS) {
                pattern.regex.lastIndex = 0;
                if (!pattern.regex.test(content)) continue;
                findings.push({
                    type: 'data-access-pattern',
                    path: file.relativePath,
                    reason: pattern.reason,
                    severity: pattern.severity,
                    confidence: 'medium',
                    action: pattern.action,
                    metadata: { patternId: pattern.id }
                });
                break;
            }
        }

        return {
            scanner: 'data-access-patterns',
            findings,
            summary: {
                sourceFilesScanned: sourceFiles.length,
                patternFindings: findings.length
            }
        };
    }
}

module.exports = {
    DataAccessPatternAnalyzer,
    ACCESS_PATTERNS
};
