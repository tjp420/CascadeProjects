#!/usr/bin/env node
/**
 * SimpleBeacon CLI Remediation Engine — Standalone Test Script
 *
 * This is a standalone test/demonstration script for the remediation engine.
 * The production CLI is: npx simplebeacon scan --fix [--fix-dry-run]
 *
 * Usage: node scripts/simplebeacon-fix-standalone.cjs [path] [flags]
 *   --write / -w       Apply changes to disk
 *   --rules=a,b,c      Select rule sets (default: markdown,slop,tokens)
 */

const fs = require('fs');
const path = require('path');
const { RemediationEngine, STRUCTURAL_RULES } = require('../src/policy/RemediationEngine');

// 1. Command Line Arguments Parsing
const args = process.argv.slice(2);
const targetPath = args[0] && !args[0].startsWith('-') ? args[0] : '.';
const flags = {
  write: args.includes('--write') || args.includes('-w'),
  dryRun: !args.includes('--write') && !args.includes('-w'),
  rules: args.find(a => a.startsWith('--rules='))?.split('=')[1]?.split(',') || ['markdown', 'slop', 'tokens']
};

const activeRules = STRUCTURAL_RULES.filter(r => flags.rules.includes(r.category));
const engine = new RemediationEngine(activeRules);

let stats = { filesScanned: 0, issuesFixed: 0, markdownRemoved: 0, tokensQuarantined: 0, slopCleaned: 0 };
let envVariablesToExport = [];

// 2. Recursive Directory Walker
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage', '.simplebeacon']);
const TEXT_EXTENSIONS = /\.(js|jsx|ts|tsx|mjs|cjs|json|md|py|rb|go|rs|java|c|cpp|h|hpp|css|scss|html|vue|svelte)$/;

function scanDirectory(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    console.error(`\x1b[31m[!] Cannot read directory: ${dir} — ${e.message}\x1b[0m`);
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(file) && !file.startsWith('.')) {
        scanDirectory(fullPath);
      }
    } else if (stat.isFile() && TEXT_EXTENSIONS.test(file)) {
      processFile(fullPath);
    }
  }
}

// 3. Structural Code Remediation Logic
function processFile(filePath) {
  stats.filesScanned++;
  let result;
  try {
    result = engine.processFile(filePath, { dryRun: !flags.write });
  } catch (e) {
    console.error(`\x1b[31m[!] Cannot process file: ${filePath} — ${e.message}\x1b[0m`);
    return;
  }

  if (!result.changed) return;

  stats.issuesFixed++;
  envVariablesToExport.push(...result.quarantine);

  for (const ruleId of result.rulesApplied) {
    const rule = activeRules.find(r => r.id === ruleId);
    if (!rule) continue;
    if (rule.category === 'markdown') stats.markdownRemoved += 1;
    else if (rule.category === 'slop') stats.slopCleaned += (result.matchCounts[ruleId] || 0);
    else if (rule.category === 'tokens') stats.tokensQuarantined += (result.matchCounts[ruleId] || 0);
  }

  console.log(`\n\x1b[4m--- ${path.relative(process.cwd(), filePath)}\x1b[0m`);
  for (const ruleId of result.rulesApplied) {
    const rule = activeRules.find(r => r.id === ruleId);
    if (!rule) continue;
    if (rule.category === 'markdown') {
      console.log(`  \x1b[32m[\u2713] ${rule.description}\x1b[0m`);
    } else if (rule.category === 'slop') {
      const count = result.matchCounts[ruleId] || 0;
      console.log(`  \x1b[33m[!] Removed ${count} LLM placeholder comment(s)\x1b[0m`);
    }
  }
  for (const entry of result.quarantine) {
    const eq = entry.indexOf('=');
    const name = entry.slice(0, eq);
    const suffix = name.replace('SIMPLEBEACON_QUARANTINE_', '');
    const idx = suffix.lastIndexOf('_');
    const keyType = idx > 0 ? suffix.slice(0, idx) : suffix;
    console.log(`  \x1b[31m[!] Extracted plaintext token [${keyType}] to env var: ${name}\x1b[0m`);
  }

  if (flags.dryRun && result.diff) {
    console.log(`  \x1b[90m--- dry-run diff (no changes written) ---\x1b[0m`);
    console.log(result.diff);
  }
}

// 4. Execution Control
console.log(`\x1b[1m\x1b[36m[SimpleBeacon Fix Engine v1.4.3]\x1b[0m Initializing local directory mitigation scanner...`);
console.log(`Target Path: ${path.resolve(targetPath)}`);
console.log(`Mode: ${flags.write ? '\x1b[31m--write (Disk Mutation Active)\x1b[0m' : '\x1b[32m--dry-run (Safe Layout Preview Mode)\x1b[0m'}\n`);

try {
  if (fs.existsSync(targetPath)) {
    if (fs.statSync(targetPath).isDirectory()) {
      scanDirectory(targetPath);
    } else {
      processFile(targetPath);
    }

    if (envVariablesToExport.length > 0 && flags.write) {
      const envPath = path.join(process.cwd(), '.env');
      const envPayload = `\n# --- SimpleBeacon Safety Token Quarantine ---\n# WARNING: These are REAL secrets extracted from your code.\n# Do NOT commit this file to version control.\n# Verify .gitignore includes .env before proceeding.\n${envVariablesToExport.join('\n')}\n`;
      fs.appendFileSync(envPath, envPayload, 'utf8');
      console.log(`\n\x1b[32m[\u2713] Appended ${envVariablesToExport.length} quarantine definitions to .env\x1b[0m`);
      console.log(`\x1b[33m[!] Verify .gitignore includes .env — do NOT commit this file.\x1b[0m`);
    } else if (envVariablesToExport.length > 0 && flags.dryRun) {
      console.log(`\n\x1b[33m[!] ${envVariablesToExport.length} tokens would be extracted to .env on --write:\x1b[0m`);
      envVariablesToExport.forEach(v => console.log(`  ${v}`));
    }

    console.log(`\n\x1b[1m\x1b[34m--- Scanning Remediations Metrics Report ---\x1b[0m`);
    console.log(`Files Processed:         ${stats.filesScanned}`);
    console.log(`Files with Debt:         ${stats.issuesFixed}`);
    console.log(`Markdown Blocks Cleaned: ${stats.markdownRemoved}`);
    console.log(`Slop Comments Removed:   ${stats.slopCleaned}`);
    console.log(`Tokens Quarantined:      ${stats.tokensQuarantined}`);

    if (flags.dryRun && stats.issuesFixed > 0) {
      console.log(`\n\x1b[33m\u26a0\ufe0f  No modifications were written to disk. Re-run with '--write' or '-w' flag to commit changes.\x1b[0m`);
    } else if (stats.issuesFixed === 0) {
      console.log(`\n\x1b[32m\u2713 No issues found. Code is clean.\x1b[0m`);
    }
  } else {
    console.error(`\u274c Target path does not exist: ${targetPath}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`\u274c Runtime error:`, error.message);
  process.exit(1);
}
