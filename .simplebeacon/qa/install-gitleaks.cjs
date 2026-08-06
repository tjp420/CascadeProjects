'use strict';
/**
 * Cross-platform gitleaks installer.
 *
 * Downloads and installs the gitleaks binary to ~/.local/bin (user-space, no admin required).
 * Supports Windows (zip), macOS (tar.gz), and Linux (tar.gz).
 *
 * Usage:  npm run install-gitleaks
 * Exit:   0 = success, 1 = failure
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { createWriteStream, mkdirSync, rmSync, existsSync } = fs;

const GITLEAKS_VERSION = '8.30.1';
const HOME = os.homedir();
const BIN_DIR = path.join(HOME, '.local', 'bin');

function getPlatformAsset() {
    const platform = process.platform;
    const arch = process.arch;
    if (platform === 'win32') {
        const suffix = arch === 'arm64' ? 'windows_arm64' : 'windows_x64';
        return { asset: `gitleaks_${GITLEAKS_VERSION}_${suffix}.zip`, isZip: true };
    }
    if (platform === 'darwin') {
        const suffix = arch === 'arm64' ? 'darwin_arm64' : 'darwin_x64';
        return { asset: `gitleaks_${GITLEAKS_VERSION}_${suffix}.tar.gz`, isZip: false };
    }
    if (platform === 'linux') {
        const suffix = arch === 'arm64' ? 'linux_arm64' : 'linux_x64';
        return { asset: `gitleaks_${GITLEAKS_VERSION}_${suffix}.tar.gz`, isZip: false };
    }
    throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(dest);
        const handler = (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                // Follow redirect
                download(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        };
        https.get(url, handler).on('error', (e) => {
            try { fs.unlinkSync(dest); } catch (_e) { /* ignore */ }
            reject(e);
        });
    });
}

async function main() {
    const { asset, isZip } = getPlatformAsset();
    const url = `https://github.com/zricethezav/gitleaks/releases/download/v${GITLEAKS_VERSION}/${asset}`;

    console.log(`[install-gitleaks] Installing gitleaks ${GITLEAKS_VERSION}`);
    console.log(`[install-gitleaks] Platform: ${process.platform} ${process.arch}`);
    console.log(`[install-gitleaks] Download: ${url}`);
    console.log(`[install-gitleaks] Target:   ${BIN_DIR}`);

    mkdirSync(BIN_DIR, { recursive: true });

    const archivePath = path.join(os.tmpdir(), asset);

    // Download
    process.stdout.write('[install-gitleaks] Downloading... ');
    await download(url, archivePath);
    console.log('done');

    // Extract
    process.stdout.write('[install-gitleaks] Extracting... ');
    if (isZip) {
        // Windows: use PowerShell to extract zip
        execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${BIN_DIR}' -Force"`, { stdio: 'pipe' });
    } else {
        // Unix: tar
        execSync(`tar -xzf "${archivePath}" -C "${BIN_DIR}"`, { stdio: 'pipe' });
    }
    console.log('done');

    // Cleanup archive
    try { rmSync(archivePath, { force: true }); } catch (_e) { /* ignore */ }

    // Make executable on Unix
    if (process.platform !== 'win32') {
        const bin = path.join(BIN_DIR, 'gitleaks');
        if (existsSync(bin)) {
            execSync(`chmod +x "${bin}"`, { stdio: 'pipe' });
        }
    }

    // Verify
    const gitleaksExe = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks';
    const gitleaksPath = path.join(BIN_DIR, gitleaksExe);
    if (!existsSync(gitleaksPath)) {
        console.error(`[install-gitleaks] ERROR: ${gitleaksPath} not found after extraction`);
        process.exit(1);
    }

    try {
        const version = execSync(`"${gitleaksPath}" version`, { encoding: 'utf8', timeout: 5000 }).trim();
        console.log(`[install-gitleaks] Verified: gitleaks ${version}`);
    } catch (e) {
        console.error(`[install-gitleaks] WARNING: could not verify version: ${e.message}`);
    }

    // Check if ~/.local/bin is on PATH
    const pathEnv = process.env.PATH || '';
    const pathSep = process.platform === 'win32' ? ';' : ':';
    const onPath = pathEnv.split(pathSep).some(p => path.resolve(p) === BIN_DIR);
    if (!onPath) {
        console.warn(`[install-gitleaks] WARNING: ${BIN_DIR} is not on your PATH`);
        console.warn(`[install-gitleaks] Add it to your shell profile:`);
        if (process.platform === 'win32') {
            console.warn(`  setx PATH "%PATH%;${BIN_DIR}"`);
        } else {
            console.warn(`  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc`);
        }
    } else {
        console.log(`[install-gitleaks] ${BIN_DIR} is already on PATH`);
    }

    console.log('[install-gitleaks] Installation complete.');
    process.exit(0);
}

main().catch((e) => {
    console.error(`[install-gitleaks] FAILED: ${e.message}`);
    process.exit(1);
});
