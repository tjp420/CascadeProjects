#!/usr/bin/env node
/**
 * SimpleBeacon Local Agent installer.
 *
 * This script can be packaged with `pkg` to produce a single .exe installer
 * that downloads the portable agent zip, installs it, creates shortcuts,
 * and starts the agent.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { execSync, spawn } = require('child_process');

const DEFAULT_DOWNLOAD_URL = 'https://cascadeprojects-yzzd.onrender.com/downloads/simplebeacon-local-agent-portable.zip';

function getInstallDir() {
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'SimpleBeaconLocalAgent');
  }
  return path.join(os.homedir(), '.local', 'share', 'simplebeacon-local-agent');
}

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[SimpleBeacon Installer] ${msg}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const uri = new URL(url);
    const client = uri.protocol === 'https:' ? https : http;
    const req = client.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        resolve(downloadFile(redirectUrl, dest));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => resolve(dest));
      out.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timed out'));
    });
  });
}

function extractZip(zipPath, destDir) {
  ensureDir(destDir);
  if (process.platform === 'win32') {
    const psCmd = `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`;
    execSync(`powershell.exe -Command "${psCmd}"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
  }
}

function createWindowsShortcuts(installDir) {
  if (process.platform !== 'win32') { return; }

  const startMenuDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'SimpleBeacon');
  ensureDir(startMenuDir);

  const wsh = require('child_process').execSync;

  function createShortcut(shortcutPath, target) {
    const vbs = `
Set WshShell = WScript.CreateObject("WScript.Shell")
Set lnk = WshShell.CreateShortcut("${shortcutPath}")
lnk.TargetPath = "${target}"
lnk.WorkingDirectory = "${installDir}"
lnk.Save
`;
    const vbsPath = path.join(os.tmpdir(), 'sb-shortcut.vbs');
    fs.writeFileSync(vbsPath, vbs, 'utf8');
    execSync(`cscript //NoLogo "${vbsPath}"`, { stdio: 'ignore' });
    try { fs.unlinkSync(vbsPath); } catch { /* ignore */ }
  }

  const batPath = path.join(installDir, 'start-agent.bat');
  createShortcut(path.join(startMenuDir, 'SimpleBeacon Local Agent.lnk'), batPath);
  createShortcut(path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'SimpleBeacon Local Agent.lnk'), batPath);
  log('Created Start Menu and startup shortcuts.');
}

function startAgent(installDir) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', path.join(installDir, 'start-agent.bat')], {
      cwd: installDir,
      detached: true,
      windowsHide: false
    });
  } else {
    const sh = path.join(installDir, 'start-agent.sh');
    spawn('sh', [sh], { cwd: installDir, detached: true, stdio: 'ignore' }).unref();
  }
  log('Started SimpleBeacon Local Agent.');
}

async function main() {
  const installDir = getInstallDir();
  const url = process.env.SB_AGENT_DOWNLOAD_URL || DEFAULT_DOWNLOAD_URL;

  log(`Installing to ${installDir}`);
  ensureDir(installDir);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-agent-setup-'));
  const zipPath = path.join(tempDir, 'simplebeacon-local-agent-portable.zip');

  try {
    log(`Downloading from ${url}...`);
    await downloadFile(url, zipPath);
    log(`Downloaded ${zipPath}`);

    log(`Extracting to ${installDir}...`);
    extractZip(zipPath, installDir);

    if (process.platform === 'win32') {
      createWindowsShortcuts(installDir);
    }

    log('Starting agent...');
    startAgent(installDir);

    log('Installation complete.');
    log('The agent is running on http://127.0.0.1:55432');
  } catch (err) {
    log(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

main();
