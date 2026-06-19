const path = require('path');
const { runFileReductionScan } = require('../packages/simplebeacon-cli/src/index.js');

async function main() {
  const projectDir = path.resolve('C:/Users/Trevor/CascadeProjects');

  console.log('Scanning:', projectDir);
  const report = await runFileReductionScan(projectDir, {
    dryRun: true,
    scanners: {
      'build-artifacts': { enabled: true },
      'asset-consolidation': { enabled: true },
      'unused-files': { enabled: true },
      'directory-bloat': { enabled: true }
    }
  });

  console.log('\n=== Report Summary ===');
  console.log('Inventory files:', report.inventory?.totalFiles);
  console.log('Inventory dirs:', report.inventory?.totalDirectories);
  console.log('Duration ms:', report.durationMs);
  console.log('Total findings:', report.summary?.totalFindings);

  console.log('\n=== Findings Breakdown ===');
  console.log('buildArtifacts:', report.findings?.buildArtifacts?.length || 0);
  console.log('assetConsolidation:', report.findings?.assetConsolidation?.length || 0);
  console.log('unusedFiles:', report.findings?.unusedFiles?.length || 0);
  console.log('directoryBloat:', report.findings?.directoryBloat?.length || 0);
  console.log('supplyChainSecurity:', report.findings?.supplyChainSecurity?.length || 0);
  console.log('deadCode:', report.findings?.deadCode?.length || 0);
  console.log('gitHygiene:', report.findings?.gitHygiene?.length || 0);
  console.log('configManagement:', report.findings?.configManagement?.length || 0);
  console.log('dependencyHealth:', report.findings?.dependencyHealth?.length || 0);
  console.log('environmentVariables:', report.findings?.environmentVariables?.length || 0);

  console.log('\n=== File Reduction Plan ===');
  const plan = report.fileReductionPlan;
  if (plan) {
    console.log('safeToDelete.topDirectories:', plan.safeToDelete?.topDirectories?.length || 0);
    console.log('safeToDelete.bytes:', plan.safeToDelete?.bytes || 0);
    console.log('safeToDelete.files:', plan.safeToDelete?.files || 0);
    console.log('reviewBeforeDelete.logs:', plan.reviewBeforeDelete?.logs?.length || 0);
    console.log('reviewBeforeDelete.files:', plan.reviewBeforeDelete?.files || 0);
    console.log('unusedFiles.candidates:', plan.unusedFiles?.candidates || 0);
    console.log('duplicateAssets.groups:', plan.duplicateAssets?.groups || 0);
    console.log('totals.reclaimableBytes:', plan.totals?.reclaimableBytes || 0);
    console.log('totals.estimatedImmediateSavingsBytes:', plan.totals?.estimatedImmediateSavingsBytes || 0);
  } else {
    console.log('NO fileReductionPlan');
  }

  console.log('\n=== Scan Scope ===');
  console.log('reportHealth:', report.scanScope?.reportHealth);
  console.log('rescanRecommended:', report.scanScope?.rescanRecommended);
  console.log('limitations:', report.scanScope?.limitations);
}

main().catch(console.error);
