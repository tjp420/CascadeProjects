#!/usr/bin/env node
/**
 * Build a simplebeacon-diagnostic-bundle.json from local files (offline).
 * Output is dropped on simplebeacon.ai homepage — scanned in the browser only.
 *
 * Usage:
 *   node prepare-diagnostic-bundle.js path/to/file.json path/to/config.env
 *   node prepare-diagnostic-bundle.js --dir path/to/repo/server --out bundle.json
 */
const fs = require('fs');
const path = require('path');

require(path.join(__dirname, '..', 'diagnostic-bundle-lib.js'));
const lib = globalThis.SIMPLEBEACON_DIAGNOSTIC_BUNDLE;

function usage() {
  console.log(`SimpleBeacon diagnostic bundle prep (local only)

  node prepare-diagnostic-bundle.js <file> [file...]
  node prepare-diagnostic-bundle.js --dir <folder> [--out bundle.json]

Bundles up to ${lib.MAX_TOTAL_BYTES} bytes of text snippets for the homepage diagnostic.
Nothing is uploaded by this script.`);
}

function readSnippet(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return null;
  if (!lib.isAllowedFile(filePath)) return null;
  if (stat.size > lib.MAX_SNIPPET_BYTES) {
    console.warn(`Skip (too large): ${filePath}`);
    return null;
  }
  return {
    path: path.basename(filePath),
    content: fs.readFileSync(filePath, 'utf8')
  };
}

function walkDir(dir, collected) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, collected);
      continue;
    }
    const snippet = readSnippet(full);
    if (snippet) collected.push(snippet);
  }
}

function trimToBudget(snippets) {
  const kept = [];
  let total = 0;
  for (const snippet of snippets) {
    const size = Buffer.byteLength(snippet.content, 'utf8') + Buffer.byteLength(snippet.path, 'utf8');
    if (total + size > lib.MAX_TOTAL_BYTES) break;
    kept.push(snippet);
    total += size;
  }
  return kept;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    usage();
    process.exit(1);
  }

  let outPath = path.join(process.cwd(), 'simplebeacon-diagnostic-bundle.json');
  const snippets = [];

  if (args[0] === '--dir') {
    const dir = path.resolve(args[1] || '');
    const outIdx = args.indexOf('--out');
    if (outIdx !== -1 && args[outIdx + 1]) outPath = path.resolve(args[outIdx + 1]);
    if (!fs.existsSync(dir)) {
      console.error('Directory not found:', dir);
      process.exit(1);
    }
    walkDir(dir, snippets);
  } else {
    for (const arg of args) {
      if (arg === '--out') continue;
      if (args[args.indexOf(arg) - 1] === '--out') continue;
      const filePath = path.resolve(arg);
      if (!fs.existsSync(filePath)) {
        console.warn('Skip (missing):', filePath);
        continue;
      }
      const snippet = readSnippet(filePath);
      if (snippet) snippets.push(snippet);
    }
  }

  const trimmed = trimToBudget(snippets);
  if (!trimmed.length) {
    console.error('No eligible snippets found (.json, .js, .env, .yaml, etc.).');
    process.exit(1);
  }

  const bundle = lib.buildBundle(trimmed, { generator: 'prepare-diagnostic-bundle.js' });
  fs.writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath} (${trimmed.length} file(s), ${Buffer.byteLength(JSON.stringify(bundle), 'utf8')} bytes)`);
  console.log('Drop this file on simplebeacon.ai → Run diagnostic (browser-only scan).');
}

main();
