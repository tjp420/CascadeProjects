#!/usr/bin/env node
/**
 * Generate EU AI Act Sprint deliverable after payment.
 * Usage: node generate-euai-sprint-deliverable.cjs --client "Acme Corp"
 */
const path = require('path');
const fs = require('fs');
const { buildEuAiActAuditReport } = require('./eu-ai-act-audit-report.cjs');

async function main() {
  const args = process.argv.slice(2);
  const clientFlag = args.find((a) => a.startsWith('--client='));
  const clientName = clientFlag ? clientFlag.split('=')[1] : 'Client';
  const outDir = path.resolve(process.cwd(), '.simplebeacon', 'deliveries');

  const report = await buildEuAiActAuditReport({
    platformRoot: process.cwd(),
    clientName
  });

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, report.filename);
  fs.writeFileSync(outPath, report.html, 'utf8');
}

main().catch((err) => {
  console.error('[EU AI Act Sprint] Error:', err.message);
  process.exit(1);
});
