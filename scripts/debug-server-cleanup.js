const path = require('path');

// Use the same import path as the server
const { runFileReductionScan } = require('../packages/simplebeacon-cli/src/index.js');
const { enrichCleanupReport, compactDataCleanupReportForClient } = require('../ai-platform/server/lib/simplebeacon-proxy.cjs');

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

  console.log('=== Raw Report ===');
  console.log('Keys:', Object.keys(report));
  console.log('fileReductionPlan present:', !!report.fileReductionPlan);

  const plan = report.fileReductionPlan;
  if (plan) {
    console.log('safeToDelete.topDirectories count:', plan.safeToDelete?.topDirectories?.length);
    console.log('safeToDelete.topDirectories[0]:', plan.safeToDelete?.topDirectories?.[0]);
    console.log('reviewBeforeDelete.logs count:', plan.reviewBeforeDelete?.logs?.length);
    console.log('unusedFiles.candidates:', plan.unusedFiles?.candidates);
    console.log('totals.estimatedImmediateSavingsBytes:', plan.totals?.estimatedImmediateSavingsBytes);
  }

  console.log('\n=== Server Enrichment ===');
  const enriched = enrichCleanupReport(report, { profile: 'file-reduction' });
  console.log('enrichCleanupReport returned same object:', enriched === report);

  console.log('\n=== Compact Report ===');
  const compact = compactDataCleanupReportForClient(enriched);
  console.log('compactDataCleanupReportForClient returned same object:', compact === enriched);

  console.log('\n=== After server path ===');
  const finalPlan = compact?.fileReductionPlan || compact?.plan || null;
  console.log('finalPlan present:', !!finalPlan);
  console.log('finalPlan.safeToDelete?.topDirectories?.length:', finalPlan?.safeToDelete?.topDirectories?.length || 0);
  console.log('finalPlan.unusedFiles?.candidates:', finalPlan?.unusedFiles?.candidates || 0);

  console.log('\n=== Dashboard would build ===');
  const safeDirs = finalPlan?.safeToDelete?.topDirectories || [];
  const reviewDirs = finalPlan?.reviewBeforeDelete?.logs || [];
  const brief = {
    estimatedReduction: {
      files: safeDirs.reduce((s, d) => s + (d.files || 0), 0) + (finalPlan?.duplicateAssets?.groups || 0),
      bytes: finalPlan?.totals?.estimatedImmediateSavingsBytes || 0,
      percentOfInventory: compact?.summary?.estimatedReductionPct || 0,
      phase2DuplicateBytes: finalPlan?.totals?.duplicateAssetBytes || 0,
      phase2DuplicateFiles: finalPlan?.duplicateAssets?.groups || 0
    },
    projectedInventory: {
      totalFiles: compact?.inventory?.totalFiles ?? null,
      totalFolders: compact?.inventory?.totalDirectories ?? null
    },
    tiers: {
      safeNow: { files: 0, bytes: 0, directories: safeDirs },
      investigate: { files: finalPlan?.unusedFiles?.candidates ?? 0, note: finalPlan?.unusedFiles?.note || null }
    }
  };
  console.log(JSON.stringify(brief, null, 2));
}

main().catch(console.error);
