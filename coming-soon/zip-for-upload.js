/**
 * zip-for-upload.js
 * Creates a ZIP of the entire project for browser upload.
 * Excludes node_modules, .git, and other massive directories to keep ZIP size manageable.
 */

'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUT_ZIP = path.join(__dirname, 'upload-bundle.zip');

// Directories to exclude from ZIP (keep in sync with scanner exclusions)
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  '.github',
  '.husky',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  'frontend-build',
  '.github-sync',
  'github-cache',
  '.simplebeacon',
  '.cursor',
  '.windsurf',
  'deployments',
  'backups'
];

// File patterns to exclude
const EXCLUDE_PATTERNS = [
  /\.zip$/,
  /\.tgz$/,
  /\.tar\.gz$/,
  /\.mp4$/,
  /\.mp3$/,
  /\.avi$/,
  /\.mov$/,
  /\.exe$/,
  /\.dll$/,
  /\.db$/,
  /\.sqlite3?$/,
  /\.h5$/,
  /\.pack$/,
  /\.idx$/,
  /yarn\.lock$/,
  /package-lock\.json$/
];

async function shouldExclude(filePath) {
  const parts = filePath.split(path.sep);
  const baseName = path.basename(filePath);
  const lowerPath = filePath.toLowerCase();

  // Exclude directories
  for (const dir of EXCLUDE_DIRS) {
    if (parts.includes(dir)) return true;
  }

  // Exclude patterns
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(baseName)) return true;
  }

  // Exclude massive files (>50MB)
  try {
    const stats = await fsPromises.stat(filePath);
    if (stats.size > 50 * 1024 * 1024) return true;
  } catch (_) {
    return true;
  }

  return false;
}

async function getAllFiles(dir, files = []) {
  const entries = await fsPromises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (await shouldExclude(fullPath)) continue;
    if (entry.isDirectory()) {
      await getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function createZip() {
  const files = await getAllFiles(PROJECT_ROOT);

  // Use 7z if available (fastest), fallback to PowerShell Compress-Archive
  let cmd;
  try {
    execSync('7z -h', { stdio: 'ignore' });
    // Build 7z exclude list
    const excludeArgs = EXCLUDE_DIRS.map(d => `-xr!${d}`).join(' ');
    cmd = `7z a -tzip "${OUTPUT_ZIP}" "${PROJECT_ROOT}\\*" ${excludeArgs} -r`;
    console.log('Using 7-Zip for fast compression...');
  } catch (_) {
    // Fallback: create file list and use PowerShell
    const listFile = path.join(__dirname, 'upload-file-list.txt');
    const relativeFiles = files.map(f => path.relative(PROJECT_ROOT, f));
    await fsPromises.writeFile(listFile, relativeFiles.join('\n'));
    cmd = `powershell -Command "Compress-Archive -Path @(Get-Content '${listFile}') -DestinationPath '${OUTPUT_ZIP}' -Force"`;
    console.log('Using PowerShell Compress-Archive...');
  }

  try {
    execSync(cmd, { cwd: PROJECT_ROOT, stdio: 'inherit' });
    const stats = await fsPromises.stat(OUTPUT_ZIP);
    console.log(`\n✅ ZIP created: ${OUTPUT_ZIP}`);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Files: ${files.length}`);
    console.log(`\nDrag this ZIP onto the SimpleBeacon upload page.`);
  } catch (err) {
    console.error('❌ Failed to create ZIP:', err.message);
    process.exit(1);
  }
}

// Run
(async function() {
  if (!fs.existsSync(PROJECT_ROOT)) {
    console.error('Project root not found:', PROJECT_ROOT);
    process.exit(1);
  }
  await createZip();
})();
