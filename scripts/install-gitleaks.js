#!/usr/bin/env node
const { spawnSync } = require('child_process');
const os = require('os');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, Object.assign({ stdio: 'inherit' }, opts));
  return { status: r.status, error: r.error };
}

function hasCmd(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', stdio: 'pipe' });
  return !r.error && r.status === 0;
}

async function installMac() {
  console.log('Detected macOS');
  if (hasCmd('brew')) {
    console.log('Running: brew install gitleaks');
    const r = run('brew', ['install', 'gitleaks']);
    process.exit(r.status || 0);
  }
  console.error('Homebrew not found. Install Homebrew first: https://brew.sh/');
  console.error('Then run: brew install gitleaks');
  process.exit(1);
}

async function installWindows() {
  console.log('Detected Windows');
  if (hasCmd('winget')) {
    console.log('Attempting winget install gitleaks...');
    const r = run('winget', ['install', '--id', 'Gitleaks.Gitleaks', '-e', '--silent']);
    if (r.status === 0) process.exit(0);
    console.warn('winget invocation failed or package id not found. Falling back to PowerShell downloader.');
  }

  // PowerShell downloader: fetch latest release asset and extract to %USERPROFILE%\bin
  const ps = `
$ErrorActionPreference = 'Stop'
$rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/gitleaks/gitleaks/releases/latest' -UseBasicParsing
$asset = $rel.assets | Where-Object { $_.name -match 'windows' -and $_.name -match '\\.zip$' } | Select-Object -First 1
if ($null -eq $asset) { Write-Error 'No windows zip asset found in latest release'; exit 2 }
$url = $asset.browser_download_url
$tmp = Join-Path $env:TEMP $asset.name
Write-Output "Downloading $($asset.name) to $tmp"
Invoke-WebRequest -Uri $url -OutFile $tmp
$dest = Join-Path $env:USERPROFILE 'bin'
if (-Not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
Write-Output "Extracting to $dest"
Expand-Archive -LiteralPath $tmp -DestinationPath $dest -Force
Write-Output "Installed gitleaks files to: $dest"
Write-Output "If $dest is not on your PATH, add it (e.g. setx PATH \"$env:PATH;$dest\") and reopen your shell."
`;

  const r = run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
  process.exit(r.status || 0);
}

async function installLinux() {
  console.log('Detected Linux');
  console.warn('No single-package installer implemented for Linux in this helper.');
  console.log('Suggested steps:');
  console.log('1) Download the latest release from https://github.com/gitleaks/gitleaks/releases/latest');
  console.log('2) Extract the binary and place it on your PATH (e.g. /usr/local/bin)');
  process.exit(1);
}

async function main() {
  const platform = os.platform();
  if (platform === 'darwin') return installMac();
  if (platform === 'win32') return installWindows();
  return installLinux();
}

main();
