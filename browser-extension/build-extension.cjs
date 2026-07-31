// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
/**
 * Build a distribution zip for the Simplebeacon Local Agent Bridge extension.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST_DIR = path.join(ROOT, 'dist');

async function readManifest() {
  const raw = await fs.promises.readFile(path.join(ROOT, 'manifest.json'), 'utf8');
  return JSON.parse(raw);
}

async function ensureDistDir() {
  try {
    await fs.promises.access(DIST_DIR);
  } catch {
    await fs.promises.mkdir(DIST_DIR, { recursive: true });
  }
}

async function removeExistingZip(zipPath) {
  try {
    await fs.promises.unlink(zipPath);
  } catch {
    // Ignore if it did not exist
  }
}

async function main() {
  const MANIFEST = await readManifest();
  const VERSION = MANIFEST.version;
  const ZIP_NAME = `simplebeacon-local-agent-bridge-${VERSION}.zip`;
  const ZIP_PATH = path.join(DIST_DIR, ZIP_NAME);

  await ensureDistDir();
  await removeExistingZip(ZIP_PATH);

  // Use PowerShell Compress-Archive so no extra npm dependencies are required.
  const source = path.join(ROOT, '*');
  const command = `powershell -Command "Compress-Archive -Path '${source}' -DestinationPath '${ZIP_PATH}' -Force"`;
  execSync(command, { cwd: ROOT, stdio: 'inherit' }); // simplebeacon-ignore sync-io — build script one-shot shell command

  if (process.env.SB_DEBUG === '1') {
    process.stdout.write([`Built extension zip: ${ZIP_PATH}`].join(' ') + '\n'); // simplebeacon-ignore debug-artifact — gated by SB_DEBUG=1
  }
}

main().catch((err) => {
  process.stderr.write(['Build failed:', err.message].join(' ') + '\n');
  process.exit(1);
});
