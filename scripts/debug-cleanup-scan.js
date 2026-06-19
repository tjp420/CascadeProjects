const path = require('path');
const { runFileReductionScan } = require('../packages/simplebeacon-cli/src/lib/file-reduction-orchestrator');

async function main() {
  const projectDir = path.resolve('C:/Users/Trevor/CascadeProjects/ai-platform');
  const report = await runFileReductionScan(projectDir, {
    dryRun: true,
    scanners: {
      'build-artifacts': { enabled: true },
      'asset-consolidation': { enabled: true },
      'unused-files': { enabled: true },
      'directory-bloat': { enabled: true }
    }
  });

  console.log('Report keys:', Object.keys(report));
  console.log('Has fileReductionPlan:', !!report.fileReductionPlan);
  console.log('Has plan:', !!report.plan);

  if (report.fileReductionPlan) {
    const plan = report.fileReductionPlan;
    console.log('safeToDelete.topDirectories:', plan.safeToDelete?.topDirectories?.length || 0);
    console.log('reviewBeforeDelete.logs:', plan.reviewBeforeDelete?.logs?.length || 0);
    console.log('unusedFiles.candidates:', plan.unusedFiles?.candidates || 0);
    console.log('totals.reclaimableBytes:', plan.totals?.reclaimableBytes || 0);
  }

  console.log('Inventory files:', report.inventory?.totalFiles);
  console.log('Summary totalFindings:', report.summary?.totalFindings);
  console.log('Findings buildArtifacts:', report.findings?.buildArtifacts?.length);
  console.log('Findings directoryBloat:', report.findings?.directoryBloat?.length);
  console.log('Findings unusedFiles:', report.findings?.unusedFiles?.length);

  if (report.findings?.buildArtifacts?.length > 0) {
    console.log('First build artifact:', JSON.stringify(report.findings.buildArtifacts[0], null, 2));
  }
}

main().catch(console.error);
