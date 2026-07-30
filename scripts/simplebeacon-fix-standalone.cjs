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
 *
 * Bug fixes applied vs original prototype:
 *  1. Security: Secrets written to .env (gitignored), NOT .env.example (git-committed)
 *  2. Regex:    Reset lastIndex before .test() on /g regexes (stateful gotcha)
 *  3. Iteration: Collect all matches first, replace in reverse order (no mid-loop mutation)
 *  4. Line endings: Detect and preserve original LF/CRLF
 *  5. Slop: Remove placeholder TODO lines entirely, not reword them
 *  6. Fallback: Use error comment, not silent "REPLACED_BY_SIMPLEBEACON" string
 *  7. Dry-run: Show actual line-level diffs, not just summary messages
 */

const fs = require('fs');
const path = require('path');

// 1. Command Line Arguments Parsing
const args = process.argv.slice(2);
const targetPath = args[0] && !args[0].startsWith('-') ? args[0] : '.';
const flags = {
  write: args.includes('--write') || args.includes('-w'),
  dryRun: !args.includes('--write') && !args.includes('-w'),
  rules: args.find(a => a.startsWith('--rules='))?.split('=')[1]?.split(',') || ['markdown', 'slop', 'tokens']
};

// 2. Detection Regular Expressions
// FIX #2: Factory function returns fresh regex instances per file,
//          avoiding stateful lastIndex pollution across files.
function makePatterns() {
  return {
    markdownFence: /(^```[a-zA-Z]*\r?\n|```\r?\n?$)/g,
    llmPreamble: /^(here is your updated component|here is the complete code|sure, here is|i have modified the code)[\s\S]*?\r?\n/i,
    tokenPatterns: {
      STRIPE_KEY: /sk_live_[a-zA-Z0-9]{24,}/g,
      AWS_KEY: /AKIA[0-9A-Z]{16}/g,
      GENERIC_SECRET: /secret_key\s*=\s*['"][a-zA-Z0-9_\-]{16,}['"]/g
    },
    slopPlaceholders: /\/\/\s*TODO:\s*(implement the rest|add actual validation|your business logic here).*$/gim
  };
}

let stats = { filesScanned: 0, issuesFixed: 0, markdownRemoved: 0, tokensQuarantined: 0, slopCleaned: 0 };
let envVariablesToExport = [];

// 3. Recursive Directory Walker
// Skip heavy dependency zones, hidden dirs, and binary file extensions
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
      continue; // Skip broken symlinks / permission errors
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

// 4. Line Ending Preservation
// FIX #4: Detect original line ending style and restore it after modifications.
function detectLineEnding(content) {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
  if (crlfCount > 0 && lfCount === 0) return 'crlf';
  if (crlfCount === 0 && lfCount > 0) return 'lf';
  if (crlfCount > 0 && lfCount > 0) return 'mixed';
  return 'lf'; // empty or single-line files default to LF
}

function restoreLineEndings(content, originalEnding) {
  if (originalEnding === 'crlf') {
    // Normalize everything to CRLF
    return content.replace(/\r?\n/g, '\r\n');
  }
  // LF or mixed: normalize to LF (mixed files need consistency)
  return content.replace(/\r\n/g, '\n');
}

// 5. Structural Code Remediation Logic
function processFile(filePath) {
  stats.filesScanned++;

  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch (e) {
    console.error(`\x1b[31m[!] Cannot read file: ${filePath} — ${e.message}\x1b[0m`);
    return;
  }

  const content = buf.toString('utf8');
  const originalContent = content;
  const originalEnding = detectLineEnding(content);

  let modified = content;
  let hasChanges = false;
  let fileSummary = [];
  const patterns = makePatterns(); // FIX #2: Fresh patterns per file

  // Ruleset A: Markdown and Prompt Artifact Debris
  if (flags.rules.includes('markdown')) {
    // FIX #2: Reset lastIndex before .test() to avoid stateful /g regex bug
    patterns.markdownFence.lastIndex = 0;
    if (patterns.markdownFence.test(content)) {
      patterns.markdownFence.lastIndex = 0; // Reset again before replace
      modified = modified.replace(patterns.markdownFence, '');
      stats.markdownRemoved++;
      hasChanges = true;
      fileSummary.push('\x1b[32m[\u2713] Stripped markdown code fences\x1b[0m');
    }
    // llmPreamble has no /g flag, so .test() is safe here
    if (patterns.llmPreamble.test(content)) {
      modified = modified.replace(patterns.llmPreamble, '');
      stats.markdownRemoved++;
      hasChanges = true;
      fileSummary.push('\x1b[32m[\u2713] Purged chat prompt preamble headers\x1b[0m');
    }
  }

  // Ruleset B: AI Structural Slop & Destructive Placeholders
  // FIX #5: Remove the placeholder TODO line entirely, not reword it.
  //         Replacing "TODO: implement the rest" with "TODO(SimpleBeacon): ..."
  //         is not remediation — it's just rewording the slop.
  if (flags.rules.includes('slop')) {
    patterns.slopPlaceholders.lastIndex = 0;
    const slopMatches = modified.match(patterns.slopPlaceholders);
    if (slopMatches) {
      modified = modified.replace(patterns.slopPlaceholders, '');
      stats.slopCleaned += slopMatches.length;
      hasChanges = true;
      fileSummary.push(`\x1b[33m[!] Removed ${slopMatches.length} LLM placeholder comment(s)\x1b[0m`);
    }
  }

  // Ruleset C: Token/Credential Safe Quarantining
  // FIX #3: Collect ALL matches first, then replace in reverse order.
  //         Mutating the string inside pattern.exec() loop invalidates
  //         lastIndex and causes missed matches or infinite loops.
  if (flags.rules.includes('tokens')) {
    Object.entries(patterns.tokenPatterns).forEach(([keyType, pattern]) => {
      pattern.lastIndex = 0;
      const matches = [];
      let match;
      while ((match = pattern.exec(modified)) !== null) {
        matches.push({ index: match.index, value: match[0] });
      }

      // Replace in reverse order so earlier indices stay valid
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        const envVarName = `SIMPLEBEACON_QUARANTINE_${keyType}_${stats.tokensQuarantined}`;
        envVariablesToExport.push(`${envVarName}="${m.value}"`);

        // FIX #6: Use a clear error comment, not a silent fallback string.
        //         "REPLACED_BY_SIMPLEBEACON" would be used as a real API key
        //         at runtime if the env var isn't set — worse than the original.
        const replacement = `process.env.${envVarName} /* ERROR: ${keyType} removed by simplebeacon fix — set this env var before running */`;
        modified = modified.slice(0, m.index) + replacement + modified.slice(m.index + m.value.length);

        stats.tokensQuarantined++;
        hasChanges = true;
        fileSummary.push(`\x1b[31m[!] Extracted plaintext token [${keyType}] to env var: ${envVarName}\x1b[0m`);
      }
    });
  }

  // FIX #4: Restore original line endings after all modifications
  if (hasChanges) {
    modified = restoreLineEndings(modified, originalEnding);
  }

  // 6. Output Management
  if (hasChanges) {
    stats.issuesFixed++;
    console.log(`\n\x1b[4m--- ${path.relative(process.cwd(), filePath)}\x1b[0m`);
    fileSummary.forEach(logLine => console.log(`  ${logLine}`));

    // FIX #7: In dry-run mode, show actual line-level diffs
    if (flags.dryRun) {
      const origLines = originalContent.split(/\r?\n/);
      const newLines = modified.split(/\r?\n/);
      console.log(`  \x1b[90m--- dry-run diff (no changes written) ---\x1b[0m`);
      const maxLines = Math.max(origLines.length, newLines.length);
      let diffShown = 0;
      for (let i = 0; i < maxLines && diffShown < 25; i++) {
        const o = origLines[i] || '';
        const n = newLines[i] || '';
        if (o !== n) {
          if (o) console.log(`  \x1b[31m- ${o}\x1b[0m`);
          if (n) console.log(`  \x1b[32m+ ${n}\x1b[0m`);
          diffShown++;
        }
      }
      if (diffShown >= 25) console.log(`  \x1b[90m... (truncated, ${maxLines} total lines)\x1b[0m`);
    }

    if (flags.write) {
      fs.writeFileSync(filePath, modified, 'utf8');
    }
  }
}

// 7. Execution Control
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

    // FIX #1: Write secrets to .env (gitignored), NOT .env.example (git-committed).
    //         Writing real Stripe keys to .env.example would leak them to git —
    //         the exact opposite of what a security tool should do.
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

    // Final Processing Summary
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
