#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * CLI: Generate marketing content from Simplebeacon scan reports.
 *
 * Usage:
 *   node bin/generate-marketing-content.js --report .simplebeacon/report.json --channel blog --output ./content
 *   node bin/generate-marketing-content.js --report .simplebeacon/report.json --all --output ./content
 *   node bin/generate-marketing-content.js --complete-scan .simplebeacon/latest-scan.json --all
 */

const fs = require('fs');
const path = require('path');
const {
  generateMarketingContent,
  generateAllChannels,
} = require('../src/lib/marketing/marketing-content-generator');

function parseArgs(argv) {
  const args = { _rest: [] };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._rest.push(arg);
    }
  }
  return args;
}

function loadReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    console.error(`Report not found: ${reportPath}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse report: ${err.message}`);
    process.exit(1);
  }
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help || args.h) {
    console.log(`
Generate marketing content from Simplebeacon scan reports.

Options:
  --report <path>          Simplebeacon report JSON
  --complete-scan <path>   Complete scan bundle JSON
  --channel <name>           Single channel: blog, twitter, linkedin, newsletter,
                             case-study, press-kit, one-pager, landing-page
  --all                      Generate all channels
  --output <dir>             Output directory (default: ./marketing-content)
  --tone <tone>              Tone: professional, conversational, friendly,
                             formal, concise (default varies by channel)
  --industry <name>          Industry for case-study (default: software)
  --help                     Show this help

Examples:
  node bin/generate-marketing-content.js --report .simplebeacon/report.json --channel blog
  node bin/generate-marketing-content.js --complete-scan .simplebeacon/latest-scan.json --all --output ./content
`);
    process.exit(0);
  }

  let report;
  if (args['complete-scan']) {
    const complete = loadReport(args['complete-scan']);
    report = complete.results?.simplebeacon || complete;
    report.projectName =
      report.projectName ||
      complete.projectName ||
      complete.projectPath ||
      (complete.scanTargetRoot ? path.basename(complete.scanTargetRoot) : null) ||
      'your project';
    report.scanTargetRoot = report.scanTargetRoot || complete.scanTargetRoot || null;
  } else if (args.report) {
    report = loadReport(args.report);
  } else {
    console.error('Error: --report or --complete-scan is required');
    process.exit(1);
  }

  const outputDir = path.resolve(args.output || './marketing-content');

  if (args.all) {
    const results = generateAllChannels(report, {
      tone: args.tone,
      industry: args.industry,
      outputDir,
    });
    console.log(`Generated marketing content in ${outputDir}:`);
    for (const [channel, filePath] of Object.entries(results)) {
      console.log(`  ${channel}: ${filePath}`);
    }
  } else if (args.channel) {
    const content = generateMarketingContent(report, {
      channel: args.channel,
      tone: args.tone,
      industry: args.industry,
    });
    const ext =
      args.channel === 'twitter' ? 'txt' : args.channel === 'landing-page' ? 'html' : 'md';
    const outFile = path.join(outputDir, `simplebeacon-${args.channel}.${ext}`);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outFile, content, 'utf8');
    console.log(`Generated ${args.channel} content: ${outFile}`);
  } else {
    console.error('Error: --channel or --all is required');
    process.exit(1);
  }
}

main();
