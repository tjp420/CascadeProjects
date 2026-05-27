#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');
const sourceLanding = path.join(repoRoot, 'coming-soon');
const sourceDashboard = path.join(root, 'web', 'simplebeacon-dashboard');
const sourceFaviconSvg = path.join(root, 'web', 'favicon.svg');
const sourceFaviconIco = path.join(root, 'web', 'favicon.ico');
const sourceTrustVerificationJson = path.join(root, 'public', 'trust-verification.json');

const outRoot = path.join(repoRoot, 'deployments', 'signin-site');
const outZip = path.join(repoRoot, 'deployments', 'signin-site.zip');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function removeDir(target) {
  await fs.promises.rm(target, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  await ensureDir(dest);
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(from, to);
    }
  }
}

async function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  await ensureDir(path.dirname(dest));
  await fs.promises.copyFile(src, dest);
}

async function patchSignedOffIndex() {
  const src = path.join(sourceDashboard, 'index.html');
  const dest = path.join(outRoot, 'signin', 'index.html');
  let html = await fs.promises.readFile(src, 'utf8');

  // Keep assets loaded from /simplebeacon-dashboard and run in /signin path.
  html = html.replace(
    '<title>SimpleBeacon Dashboard</title>',
    '<title>SimpleBeacon Dashboard — Signed-off Copy</title>'
  );

  await ensureDir(path.dirname(dest));
  await fs.promises.writeFile(dest, html, 'utf8');
}

async function writeReadme() {
  const readmePath = path.join(outRoot, 'SIGNED_OFF_UPLOAD_README.md');
  const content = `# Signed-off upload bundle

This bundle is generated from the current repository state.

## What is included

- Landing/marketing files from \`coming-soon/\` (kept intact).
- Dashboard assets from \`ai-platform/web/simplebeacon-dashboard/\`.
- A dashboard entry page at \`/signin/index.html\`.

## Expected behavior

- \`/\` serves your current coming-soon landing.
- \`/signin/\` serves the signed-off dashboard copy.
- In \`/signin/\`, payment actions are intentionally disabled and appear grayed out.

## Upload notes

- Upload this folder as the website root.
- Ensure the host serves static files for nested paths (including \`/simplebeacon-dashboard/*\` and \`/signin/*\`).
`;
  await fs.promises.writeFile(readmePath, content, 'utf8');
}

function createZip(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function main() {
  if (!fs.existsSync(sourceLanding)) {
    throw new Error(`Missing source landing directory: ${sourceLanding}`);
  }
  if (!fs.existsSync(sourceDashboard)) {
    throw new Error(`Missing source dashboard directory: ${sourceDashboard}`);
  }

  await removeDir(outRoot);
  await ensureDir(outRoot);

  await copyDir(sourceLanding, outRoot);
  await copyDir(sourceDashboard, path.join(outRoot, 'simplebeacon-dashboard'));
  await patchSignedOffIndex();
  await copyFileIfExists(sourceFaviconSvg, path.join(outRoot, 'favicon.svg'));
  await copyFileIfExists(sourceFaviconIco, path.join(outRoot, 'favicon.ico'));
  await copyFileIfExists(sourceTrustVerificationJson, path.join(outRoot, 'trust-verification.json'));
  await writeReadme();

  await ensureDir(path.dirname(outZip));
  const bytes = await createZip(outRoot, outZip);

  console.log(`Created signin site bundle folder: ${outRoot}`);
  console.log(`Created signin site zip: ${outZip}`);
  console.log(`Zip size: ${(bytes / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(`Failed to create signed-off site bundle: ${err.message}`);
  process.exit(1);
});
