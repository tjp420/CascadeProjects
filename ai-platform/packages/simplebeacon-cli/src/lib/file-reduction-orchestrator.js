/**
 * Coordinates file-reduction analyzers with shared inventory and ordering.
 */

const { runFileReductionAnalysis, DEFAULT_SCANNERS } = require('../analyzers/file-reduction');

class FileReductionOrchestrator {
    constructor(options = {}) {
        this.options = {
            dryRun: options.dryRun !== false,
            scanners: options.scanners || {},
            maxDepth: options.maxDepth,
            skipDirs: options.skipDirs
        };
    }

    async run(projectRoot) {
        return runFileReductionAnalysis(projectRoot, this.options);
    }

    listScanners() {
        return DEFAULT_SCANNERS.map((entry) => ({
            id: entry.id,
            enabled: this.options.scanners[entry.id]?.enabled !== false,
            priority: entry.priority
        }));
    }
}

async function runFileReductionScan(projectRoot, options = {}) {
    const orchestrator = new FileReductionOrchestrator(options);
    return orchestrator.run(projectRoot);
}

module.exports = {
    FileReductionOrchestrator,
    runFileReductionScan
};
