#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Complexity Findings Prioritizer
 * Reads the complexity scan JSON and outputs a prioritized refactoring list.
 *
 * Usage:
 *   node scripts/prioritize-complexity.js < findings.json
 *   node scripts/prioritize-complexity.js --top 20
 *
 * If no stdin is provided, it scans the codebase for functions and reports
 * line counts (requires running from repo root).
 */

const fs = require('fs');
const path = require('path');

function summarizeByFile(findings) {
  const map = new Map();
  for (const f of findings) {
    const entry = map.get(f.filePath) || { count: 0, types: new Set(), lines: [] };
    entry.count++;
    entry.types.add(f.type);
    entry.lines.push(f.line);
    map.set(f.filePath, entry);
  }
  return Array.from(map.entries())
    .map(([filePath, data]) => ({
      filePath,
      count: data.count,
      types: Array.from(data.types),
      firstLine: Math.min(...data.lines),
    }))
    .sort((a, b) => b.count - a.count);
}

function summarizeByFunction(findings) {
  const map = new Map();
  for (const f of findings) {
    const key = `${f.filePath}:${f.line}`;
    const entry = map.get(key) || { ...f, occurrences: 0 };
    entry.occurrences++;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.occurrences - a.occurrences);
}

function printFileReport(summary, limit = 30) {
  console.log(`\n=== Top ${limit} Files by Finding Count ===\n`);
  console.log(`${'Rank'.padEnd(6)} ${'Findings'.padEnd(10)} ${'Types'.padEnd(25)} ${'File'}`);
  console.log('-'.repeat(90));
  summary.slice(0, limit).forEach((entry, i) => {
    const types = entry.types.join(', ').slice(0, 24).padEnd(25);
    console.log(
      `${String(i + 1).padEnd(6)} ${String(entry.count).padEnd(10)} ${types} ${entry.filePath}`
    );
  });
}

function printFunctionReport(findings, limit = 30) {
  console.log(`\n=== Top ${limit} Functions by Severity ===\n`);
  const byFn = summarizeByFunction(findings);
  console.log(
    `${'Rank'.padEnd(6)} ${'File'.padEnd(50)} ${'Line'.padEnd(8)} ${'Type'.padEnd(15)} ${'Desc'}`
  );
  console.log('-'.repeat(100));
  byFn.slice(0, limit).forEach((entry, i) => {
    const file = entry.filePath.slice(0, 49).padEnd(50);
    const line = String(entry.line).padEnd(8);
    const type = entry.type.padEnd(15);
    console.log(`${String(i + 1).padEnd(6)} ${file} ${line} ${type} ${entry.description}`);
  });
}

function printTierList() {
  console.log(`\n=== Recommended Refactoring Order (Tiers) ===\n`);
  const tiers = [
    {
      name: 'Tier A: Server Core',
      files: [
        'ai-platform/server/index.cjs',
        'ai-platform/server/lib/code-roadmap-generator.cjs',
        'ai-platform/server/lib/analyze-export-bundle.cjs',
        'ai-platform/server/lib/audit-remediation-recipes.cjs',
      ],
    },
    {
      name: 'Tier B: Bootstrap & Config',
      files: [
        'ai-platform/server/bootstrap/phase2-integration.cjs',
        'ai-platform/server/bootstrap/public-api-routes.cjs',
        'ai-platform/server/config/database.cjs',
        'ai-platform/server/config/redis.cjs',
      ],
    },
    {
      name: 'Tier C: Intelligence Package',
      files: [
        'ai-platform/packages/simplebeacon-intelligence/src/structural-intent-scanner.js',
        'ai-platform/packages/simplebeacon-intelligence/src/tree-sitter-queries.js',
        'ai-platform/packages/simplebeacon-intelligence/src/vector-cache.js',
      ],
    },
  ];
  for (const tier of tiers) {
    console.log(`\n${tier.name}`);
    for (const f of tier.files) {
      console.log(`  - ${f}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const topFlag = args.find((a) => a.startsWith('--top='));
  const fileFlag = args.find((a) => a.startsWith('--file='));
  const topLimit = topFlag ? parseInt(topFlag.split('=')[1], 10) : 30;

  let input = '';
  if (fileFlag) {
    const filePath = fileFlag.split('=')[1];
    input = fs.readFileSync(filePath, 'utf8');
  } else if (!process.stdin.isTTY) {
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      input += chunk;
    }
  }

  if (!input.trim()) {
    console.log('No JSON input detected. Run with:');
    console.log('  node scripts/prioritize-complexity.js --file=findings.json');
    console.log('  node scripts/prioritize-complexity.js < findings.json');
    printTierList();
    process.exit(0);
  }

  let findings;
  try {
    const parsed = JSON.parse(input);
    findings = parsed.findings || parsed;
    if (!Array.isArray(findings)) {
      throw new Error('Expected findings array');
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    process.exit(1);
  }

  const fileSummary = summarizeByFile(findings);

  console.log(`\nTotal Findings: ${findings.length}`);
  console.log(`Files Affected:  ${fileSummary.length}`);

  printFileReport(fileSummary, topLimit);
  printFunctionReport(findings, topLimit);
  printTierList();

  // Output a quick todo list for the next file to tackle
  console.log(`\n=== Next Action ===`);
  const topFile = fileSummary[0];
  if (topFile) {
    console.log(
      `Start with: ${topFile.filePath} (${topFile.count} findings, ${topFile.types.join('/')})`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
