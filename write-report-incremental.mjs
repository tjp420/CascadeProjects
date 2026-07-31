import { runSimpleBeaconAudit } from './SimpleBeaconPoC.mjs';
import fs from 'fs';
import path from 'path';

const IGNORES = new Set(['node_modules', '.git', '.simplebeacon', 'dist', 'build']);

(async () => {
  try {
    const root = process.cwd();
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory() && !IGNORES.has(e.name))
      .map((e) => e.name);
    console.log('Found folders to scan:', folders.join(', '));

    const aggregate = {
      reconciledMetrics: { totalFiles: 0, totalLines: 0, extensionBreakdown: {} },
      architecturalCyclesCount: 0,
      detectedCycles: [],
      complianceFindings: [],
    };

    for (const f of folders) {
      const full = path.join(root, f);
      console.log('\n--- Scanning', f, '---');
      try {
        const r = await runSimpleBeaconAudit(full);
        console.log(
          `  -> Files: ${r.reconciledMetrics.totalFiles}, Lines: ${r.reconciledMetrics.totalLines}, Cycles: ${r.architecturalCyclesCount}, Findings: ${r.complianceFindings.length}`
        );
        aggregate.reconciledMetrics.totalFiles += r.reconciledMetrics.totalFiles || 0;
        aggregate.reconciledMetrics.totalLines += r.reconciledMetrics.totalLines || 0;
        for (const [k, v] of Object.entries(r.reconciledMetrics.extensionBreakdown || {})) {
          aggregate.reconciledMetrics.extensionBreakdown[k] =
            (aggregate.reconciledMetrics.extensionBreakdown[k] || 0) + v;
        }
        if (r.architecturalCyclesCount && r.detectedCycles && r.detectedCycles.length) {
          aggregate.architecturalCyclesCount += r.architecturalCyclesCount || 0;
          aggregate.detectedCycles.push(...r.detectedCycles);
        }
        if (r.complianceFindings && r.complianceFindings.length) {
          aggregate.complianceFindings.push(...r.complianceFindings);
        }
      } catch (e) {
        console.error('Scan failed for', f, (e && e.stack) || e);
      }
    }

    fs.mkdirSync('.simplebeacon', { recursive: true });
    const out = '.simplebeacon/poc-report.json';
    fs.writeFileSync(out, JSON.stringify(aggregate, null, 2));
    console.log('\nWrote', out);
  } catch (e) {
    console.error('Error', (e && e.stack) || e);
    process.exit(1);
  }
})();
