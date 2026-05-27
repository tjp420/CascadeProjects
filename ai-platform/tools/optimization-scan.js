/**
 * Run consolidation scan and cache report for trust/health dashboards.
 * Usage: npm run optimization:scan [projectPath]
 */

const path = require('path');
const { scanFileMergerReduction } = require('../server/lib/file-merger-reduction-scanner');
const { resolvePlatformRoot } = require('../packages/simplebeacon-cli/src/project-detect');
const {
    saveConsolidationReport,
    computeRepositoryHealthScore
} = require('../server/lib/repository-health-payload');

async function main() {
    const baseDir = path.resolve(process.argv[2] || path.join(process.cwd(), '..'));
    const { platformRoot } = resolvePlatformRoot(baseDir);

    console.log(`Running consolidation scan: ${baseDir}`);
    const report = await scanFileMergerReduction(baseDir, {
        scope: 'repository',
        sampleBase: platformRoot || baseDir
    });
    const savedPath = saveConsolidationReport(report, baseDir);
    const score = computeRepositoryHealthScore(report.summary || {});

    console.log(`Saved: ${savedPath}`);
    console.log(`  health score: ${score}/100`);
    console.log(`  savings: ${report.summary?.potentialSavingsLabel || '—'}`);
    console.log(`  duplicate groups: ${report.summary?.exactDuplicateGroups ?? '—'}`);
    console.log(`  repo files: ${report.summary?.repositoryFilesTotal ?? '—'}`);
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
