/**
 * Build a distribution zip for the Simplebeacon Local Agent Bridge extension.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const VERSION = MANIFEST.version;
const DIST_DIR = path.join(ROOT, 'dist');
const ZIP_NAME = `simplebeacon-local-agent-bridge-${VERSION}.zip`;
const ZIP_PATH = path.join(DIST_DIR, ZIP_NAME);

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Remove any previous zip with the same name.
  if (fs.existsSync(ZIP_PATH)) {
    fs.unlinkSync(ZIP_PATH);
  }

  // Use PowerShell Compress-Archive so no extra npm dependencies are required.
  const source = path.join(ROOT, '*');
  const command = `powershell -Command "Compress-Archive -Path '${source}' -DestinationPath '${ZIP_PATH}' -Force"`;
  execSync(command, { cwd: ROOT, stdio: 'inherit' });

  if (process.env.SB_DEBUG === '1') {
    console.log(`Built extension zip: ${ZIP_PATH}`);
  }
}

main();
