/**
 * Build a portable distribution of the SimpleBeacon local agent.
 *
 * Produces a directory that can be zipped and shipped to end users. It contains
 * the agent source, its dependencies, the SimpleBeacon CLI scanner source, and a
 * small launcher script for Windows and Unix.
 */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const LOCAL_AGENT_DIR = __dirname;
const MONOREPO_ROOT = path.resolve(LOCAL_AGENT_DIR, '..', '..');
const OUT_DIR = path.join(LOCAL_AGENT_DIR, 'dist', 'portable');
const SCANNER_SRC = path.join(MONOREPO_ROOT, 'packages', 'simplebeacon-cli', 'src');
const SIMPLEBEACON_DIR = path.join(MONOREPO_ROOT, '.simplebeacon');

const WIN_BAT = `@echo off
start "" "node.exe" "%~dp0agent.cjs"
`;

const UNIX_SH = `#!/bin/sh
"$(dirname "$0")/node" "$(dirname "$0")/agent.cjs"
`;

const INSTALL_README_NOTE = `
INSTALLATION
------------
Windows:
  Double-click install-windows.bat to install the agent to
  %LOCALAPPDATA%\\SimpleBeaconLocalAgent, add it to your Start Menu and
  startup folder, and start it immediately.

  To remove it later, run uninstall-windows.bat.

macOS / Linux:
  Run ./start-agent.sh directly, or copy the folder to ~/.local/share/
  and add start-agent.sh to your login items.
`;

const BATCH_INSTALLER = `@echo off
:: SimpleBeacon Local Agent installer launcher.
:: Double-click this file to install for the current user.
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
`;

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanOutDir() {
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function main() {
  if (!fs.existsSync(SCANNER_SRC)) {
    throw new Error(`Scanner source not found at ${SCANNER_SRC}`);
  }
  if (!fs.existsSync(SIMPLEBEACON_DIR)) {
    throw new Error(`.simplebeacon directory not found at ${SIMPLEBEACON_DIR}`);
  }
  if (!fs.existsSync(path.join(LOCAL_AGENT_DIR, 'node_modules'))) {
    throw new Error('node_modules not found in local-agent; run npm install first');
  }

  cleanOutDir();

  // Copy the agent source and manifest.
  fs.copyFileSync(path.join(LOCAL_AGENT_DIR, 'agent.cjs'), path.join(OUT_DIR, 'agent.cjs'));
  fs.copyFileSync(path.join(LOCAL_AGENT_DIR, 'package.json'), path.join(OUT_DIR, 'package.json'));
  fs.copyFileSync(path.join(LOCAL_AGENT_DIR, 'README.md'), path.join(OUT_DIR, 'README.md'));

  // Copy dependencies and scanner source.
  copyDir(path.join(LOCAL_AGENT_DIR, 'node_modules'), path.join(OUT_DIR, 'node_modules'));
  copyDir(SCANNER_SRC, path.join(OUT_DIR, 'packages', 'simplebeacon-cli', 'src'));
  copyDir(SIMPLEBEACON_DIR, path.join(OUT_DIR, '.simplebeacon'));

  // Launcher scripts.
  fs.writeFileSync(path.join(OUT_DIR, 'start-agent.bat'), WIN_BAT);
  fs.writeFileSync(path.join(OUT_DIR, 'start-agent.sh'), UNIX_SH, { mode: 0o755 });

  // Windows installer scripts.
  const installerFiles = ['install.ps1', 'install-windows.bat', 'uninstall.ps1', 'uninstall-windows.bat'];
  for (const f of installerFiles) {
    const src = path.join(LOCAL_AGENT_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(OUT_DIR, f));
    }
  }

  // Append installation notes to README.
  const readmePath = path.join(OUT_DIR, 'README.md');
  const existingReadme = fs.readFileSync(readmePath, 'utf8');
  fs.writeFileSync(readmePath, existingReadme + INSTALL_README_NOTE);

  // Zip the portable directory.
  const zipPath = path.join(LOCAL_AGENT_DIR, 'dist', 'simplebeacon-local-agent-portable.zip');
  if (process.platform === 'win32') {
    const psCmd = `Push-Location '${OUT_DIR}'; Get-ChildItem | Compress-Archive -DestinationPath '${zipPath}' -Force; Pop-Location`;
    childProcess.execSync(`powershell -Command "${psCmd}"`, { stdio: 'inherit' });
  } else {
    childProcess.execSync(`cd "${OUT_DIR}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }

  console.log(`[build-portable] Portable distribution ready at ${OUT_DIR}`);
  console.log(`[build-portable] Zip archive at ${zipPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
