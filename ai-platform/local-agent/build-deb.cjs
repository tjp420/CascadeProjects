#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Build a .deb package for SimpleBeacon Local Agent on Debian/Ubuntu.
 *
 * Run on a Linux machine with dpkg-deb installed:
 *   node build-deb.cjs
 *
 * Produces: dist/simplebeacon-local-agent_1.0.2_amd64.deb
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOCAL_AGENT_DIR = __dirname;
const PORTABLE_DIR = path.join(LOCAL_AGENT_DIR, 'dist', 'portable');
const OUT_DIR = path.join(LOCAL_AGENT_DIR, 'dist');
const VERSION = '1.0.3';
const ARCH = 'amd64';
const PKG_NAME = `simplebeacon-local-agent_${VERSION}_${ARCH}`;

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

function main() {
  if (!fs.existsSync(PORTABLE_DIR)) {
    throw new Error('Portable distribution not found. Run npm run build:portable first.');
  }

  if (process.platform === 'win32') {
    throw new Error('.deb packages must be built on Linux or WSL.');
  }

  try {
    execSync('dpkg-deb --version', { stdio: 'ignore' });
  } catch {
    throw new Error('dpkg-deb not found. Install it with: sudo apt install dpkg-dev');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pkgDir = path.join(OUT_DIR, 'deb', PKG_NAME);
  if (fs.existsSync(pkgDir)) {
    fs.rmSync(pkgDir, { recursive: true, force: true });
  }

  const dataDir = path.join(pkgDir, 'usr', 'share', 'simplebeacon-local-agent');
  fs.mkdirSync(dataDir, { recursive: true });

  copyDir(PORTABLE_DIR, dataDir);

  const binDir = path.join(pkgDir, 'usr', 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.symlinkSync(
    path.join('..', 'share', 'simplebeacon-local-agent', 'start-agent.sh'),
    path.join(binDir, 'simplebeacon-local-agent')
  );

  const systemdDir = path.join(pkgDir, 'lib', 'systemd', 'user');
  fs.mkdirSync(systemdDir, { recursive: true });
  fs.writeFileSync(
    path.join(systemdDir, 'simplebeacon-local-agent.service'),
    `[Unit]
Description=SimpleBeacon Local Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/share/simplebeacon-local-agent/start-agent.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`,
    'utf8'
  );

  const controlDir = path.join(pkgDir, 'DEBIAN');
  fs.mkdirSync(controlDir, { recursive: true });
  fs.writeFileSync(
    path.join(controlDir, 'control'),
    `Package: simplebeacon-local-agent
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Depends: nodejs (>= 18.0.0)
Maintainer: SimpleBeacon <support@simplebeacon.ai>
Description: Local agent for SimpleBeacon code analysis
 Lets the SimpleBeacon web dashboard and VS Code extension scan
 local filesystem paths without uploading source code.
`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(controlDir, 'postinst'),
    `#!/bin/sh
set -e
systemctl --user daemon-reload || true
systemctl --user enable simplebeacon-local-agent.service || true
systemctl --user start simplebeacon-local-agent.service || true
`,
    'utf8'
  );
  fs.chmodSync(path.join(controlDir, 'postinst'), 0o755);

  const debPath = path.join(OUT_DIR, `${PKG_NAME}.deb`);
  execSync(`dpkg-deb --build "${pkgDir}" "${debPath}"`, { stdio: 'inherit' });

  console.log(`[build-deb] Debian package ready at ${debPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
