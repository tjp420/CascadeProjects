/**
 * analyze-directory.js
 * High-performance directory analyzer for massive repositories (25K+ files).
 * Bypasses browser limits entirely via Node.js fs bindings.
 *
 * Usage:
 *   node analyze-directory.js [path] [--output report.json]
 *
 * Defaults to current working directory if no path given.
 */

const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────
const TARGET_DIR = path.resolve(process.argv[2] || process.cwd());
const OUT_FILE = (() => {
  const idx = process.argv.indexOf('--output');
  return idx > -1 ? path.resolve(process.argv[idx + 1]) : null;
})();

const SKIP_DIRS = /^node_modules$|^\.git$|^\.husky$|^dist$|^build$|^\.next$|^out$|^coverage$|^frontend-build$|^\.github-sync$|^github-cache$|^\.simplebeacon$|^\.cursor$|^\.windsurf$|^deployments$|^backups$|^java-ai-vulnerable$|^Domain$|^coming-soon-dev$|^packages$/;
const BINARY_EXTS = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|psd|ai|eps|sketch|mp3|mp4|avi|mov|wav|flac|ogg|webm|mkv|zip|tar|gz|bz2|xz|lz|7z|rar|exe|dll|so|dylib|bin|o|obj|class|woff2?|ttf|otf|eot|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|db|sqlite3?|wasm|dat|pkl|npy|h5|pb|pt|onnx|tflite|parquet|pcap|cap|jar|war|ear|apk|aab|ipa|dmg|pkg|msi|iso|img|vmdk|ova|tgz|rpm|deb)$/i;
const COPY_FILE = / copy( \d+)?\.(xml|txt|tfvars|py|js|ts|cjs|mjs|json|md|html|css|scss|sass|less|yml|yaml)$/i;

// ── Stats ───────────────────────────────────────────────────────
let totalFiles = 0;
let totalFolders = 0;
let totalBytes = 0;
let totalLines = 0;
let readErrors = 0;
let binarySkipped = 0;
let copySkipped = 0;
let dirSkipped = 0;

const fileTypes = {};
const sizeBuckets = { tiny: 0, small: 0, medium: 0, large: 0, huge: 0 };
const recentFiles = []; // Keep last 10 for sample // simplebeacon-ignore production-leak — collects recent files for analysis summary
const largestFiles = []; // Top 10 by size

const startTime = Date.now();

// ── Helpers ─────────────────────────────────────────────────────
function formatBytes(b) {
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function bucketSize(size) {
  if (size < 1024) return 'tiny';
  if (size < 64 * 1024) return 'small';
  if (size < 1024 * 1024) return 'medium';
  if (size < 100 * 1024 * 1024) return 'large';
  return 'huge';
}

function trackLargest(rel, size) {
  largestFiles.push({ file: rel, size });
  largestFiles.sort((a, b) => b.size - a.size);
  if (largestFiles.length > 10) largestFiles.pop();
}

// ── Walk (iterative to avoid stack overflow on deep trees) ──────
function walk(rootDir) {
  const stack = [path.resolve(rootDir)];
  const visited = new Set();

  while (stack.length > 0) {
    const dir = stack.pop();
    const dirKey = dir.toLowerCase();
    if (visited.has(dirKey)) continue;
    visited.add(dirKey);

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      readErrors++;
      continue;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(TARGET_DIR, full).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (SKIP_DIRS.test(entry.name)) {
          dirSkipped++;
          continue;
        }
        totalFolders++;
        stack.push(full);
      } else if (entry.isFile()) {
        // Skip binaries
        if (BINARY_EXTS.test(full)) {
          binarySkipped++;
          continue;
        }
        // Skip copy files
        if (COPY_FILE.test(rel)) {
          copySkipped++;
          continue;
        }

        const stat = fs.statSync(full);
        const size = stat.size;
        const ext = path.extname(full).slice(1).toLowerCase() || 'no-ext';

        totalFiles++;
        totalBytes += size;
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        sizeBuckets[bucketSize(size)]++;

        trackLargest(rel, size);

        if (recentFiles.length < 10) {
          recentFiles.push({ file: rel, size, ext });
        }

        // Count lines for text files (cap at 5MB to avoid memory issues)
        if (size < 5 * 1024 * 1024) {
          try {
            const text = fs.readFileSync(full, 'utf8');
            totalLines += text.split('\n').length;
          } catch (_) {
            // Binary or encoding issue — skip line count
          }
        }
      }
    }
  }
}

// ── Run ─────────────────────────────────────────────────────────
walk(TARGET_DIR);

const duration = ((Date.now() - startTime) / 1000).toFixed(2);

// ── Report ──────────────────────────────────────────────────────
const report = {
  generatedAt: new Date().toISOString(),
  targetDir: TARGET_DIR,
  summary: {
    totalFiles: totalFiles.toLocaleString(),
    totalFolders: totalFolders.toLocaleString(),
    totalBytes: formatBytes(totalBytes),
    totalLines: totalLines.toLocaleString(),
    durationSeconds: duration,
    readErrors,
    binarySkipped,
    copySkipped,
    dirSkipped
  },
  fileTypes: Object.entries(fileTypes)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {}),
  sizeDistribution: sizeBuckets,
  largestFiles,
  recentSamples: recentFiles // simplebeacon-ignore production-leak — recent file list from actual scan
};

// ── Console Output ──────────────────────────────────────────────
console.log(`✅ TOTAL FILES:      ${totalFiles.toLocaleString()}`); // simplebeacon-ignore debug-artifact — CLI output
console.log(`📁 TOTAL FOLDERS:    ${totalFolders.toLocaleString()}`);
console.log(`📦 TOTAL SIZE:       ${formatBytes(totalBytes)}`);
console.log(`📝 TOTAL LINES:      ${totalLines.toLocaleString()}`);
console.log(`⏱️  DURATION:        ${duration}s`);
console.log(`❌ READ ERRORS:      ${readErrors}`);
console.log(`🚫 BINARY SKIPPED:   ${binarySkipped}`);
console.log(`🚫 COPY SKIPPED:     ${copySkipped}`);
console.log(`🚫 DIR SKIPPED:      ${dirSkipped}`);
console.log('========================================\n');

console.log('📊 Top 10 File Types:');
Object.entries(report.fileTypes).slice(0, 10).forEach(([ext, count]) => {
  console.log(`   .${ext}: ${count.toLocaleString()}`);
});

console.log('\n🏆 Largest Files:');
largestFiles.forEach((f, i) => {
  console.log(`   ${i + 1}. ${f.file} (${formatBytes(f.size)})`);
});

// ── Write JSON Report ───────────────────────────────────────────
if (OUT_FILE) {
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved: ${OUT_FILE}`);
}

console.log('\n✨ Analysis complete.\n');
