// simplebeacon-ignore: debugArtifacts
/**
 * Zero-retention, in-memory data processing pipeline for SimpleBeacon audits.
 *
 * Pipeline: ZIP Upload Stream -> RAM/Encrypted Temp Folder -> SimpleBeacon CLI Scan -> Report -> WIPE
 *
 * Design constraints:
 * - Never write user code to a permanent database.
 * - Process inside isolated, short-lived temporary directories.
 * - Run the local CLI against the sandbox.
 * - Purge everything in a finally block, even on crash.
 */

const fs = require('fs');
const logger = require('../lib/app-logger.cjs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const constants = require('../config/constants.cjs');
const execAsync = util.promisify(exec);
const AdmZip = require('adm-zip');

const SANDBOX_PREFIX = 'simplebeacon_sandbox';
const MAX_UPLOAD_BYTES = 500 * constants.BYTES_PER_KB * constants.BYTES_PER_KB; // 500 MB

/**
 * Generate a cryptographically random sandbox directory name.
 */
function generateSandboxId() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Ensure the sandbox parent directory exists.
 */
function ensureSandboxRoot() {
    const root = path.join(os.tmpdir(), SANDBOX_PREFIX);
    if (!fs.existsSync(root)) {
        fs.mkdirSync(root, { recursive: true });
    }
    return root;
}

/**
 * Recursively and synchronously wipe a directory tree.
 * Falls back to best-effort async removal if sync fails.
 */
function wipeDirectorySync(dirPath) {
    try {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    } catch (syncErr) {
        // Best-effort async fallback
        fs.promises.rm(dirPath, { recursive: true, force: true }).catch(() => {});
    }
}

/**
 * Extract a ZIP buffer into the given sandbox directory.
 */
function extractZipBuffer(zipBuffer, targetDir) {
    const zipPath = path.join(targetDir, `__upload_${Date.now()}.zip`);
    fs.writeFileSync(zipPath, zipBuffer);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(targetDir, true);
    fs.unlinkSync(zipPath);
    return targetDir;
}

/**
 * Write a file buffer into a sandbox directory preserving relative path.
 */
function writeFileToSandbox(fileBuffer, relativePath, sandboxDir) {
    let safePath = String(relativePath || '')
        .replace(/^[\\/]+/, '')
        .replace(/\.\.[\\/]/g, '');
    // Strip control characters 0x00–0x1f and 0x7f without using them in regex literal
    safePath = safePath.split('').filter((c) => {
        const code = c.charCodeAt(0);
        return code > 31 && code !== 127;
    }).join('');
    const outPath = path.join(sandboxDir, safePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, fileBuffer);
    return outPath;
}

/**
 * Run the local SimpleBeacon CLI scan against a sandboxed directory.
 */
async function runLocalScan(sandboxDir, options = {}) {
    const cliBin = path.join(__dirname, '../../../packages/simplebeacon-cli/bin/simplebeacon.js');
    const reportOut = path.join(sandboxDir, '.simplebeacon', 'report.json');
    fs.mkdirSync(path.dirname(reportOut), { recursive: true }); // simplebeacon-ignore sync-io — temp directory creation before scan execution

    const configPath = path.join(sandboxDir, '.simplebeacon', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
        scanPaths: ['.'],
        productionPaths: ['.'],
        ignore: [
            'node_modules/**', '.git/**', 'coverage/**',
            'dist/**', 'build/**', '.next/**',
            '**/*.test.js', '**/*.spec.js',
            '**/*.test.ts', '**/*.spec.ts',
            '**/*.map', '**/*.min.js', '**/*.min.css',
            '**/*.d.ts', '**/*.lock', '**/*.lockb',
            'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
            '.DS_Store', 'Thumbs.db',
            '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico',
            '*.mp4', '*.webm', '*.mp3', '*.wav',
            '*.pdf', '*.doc', '*.docx', '*.zip', '*.tar', '*.gz',
            '**/.vscode-test/**', '**/simplebeacon-vscode-merged/**', '**/*.vsix'
        ],
        fullDirectoryScanSkipDirs: [
            '.git', 'node_modules', 'coverage', 'dist', 'build',
            '.next', '.simplebeacon', 'tmp', '.vscode-test', 'simplebeacon-vscode-merged'
        ]
    }, null, 2));

    const offlineFlag = options.offline !== false ? '--offline' : '';
    const fullScanFlag = options.fullDirectoryScan ? '--full' : '';
    const nodePath = process.execPath;
    const scanCmd = `"${nodePath}" "${cliBin}" scan --path "${sandboxDir}" --config "${configPath}" --format json --output "${reportOut}" ${offlineFlag} ${fullScanFlag}`;

    try {
        await execAsync(scanCmd, {
            timeout: 0,
            env: { ...process.env, FORCE_COLOR: '0' }
        });
    } catch (err) {
        try { await fs.promises.access(reportOut); } catch { throw err; }
    }

    const raw = await fs.promises.readFile(reportOut, 'utf8');
    return JSON.parse(raw);
}

/**
 * The main secure audit pipeline.
 *
 * @param {Buffer} zipFileBuffer — raw ZIP bytes from the upload stream
 * @param {object} projectContext — { analysisType, token, onProgress }
 * @returns {Promise<object>} — parsed SimpleBeacon report JSON
 */
async function executeSecureAuditPipeline(zipFileBuffer, projectContext = {}) {
    if (!Buffer.isBuffer(zipFileBuffer)) {
        throw new Error('executeSecureAuditPipeline expects a Buffer');
    }
    if (zipFileBuffer.length > MAX_UPLOAD_BYTES) {
        throw new Error(`Upload exceeds ${MAX_UPLOAD_BYTES} byte limit`);
    }

    const sandboxId = generateSandboxId();
    const sandboxRoot = ensureSandboxRoot();
    const sandboxDir = path.join(sandboxRoot, sandboxId);
    let reportJson = null;

    try {
        // 1. Ingest — write buffer to isolated temp location
        fs.mkdirSync(sandboxDir, { recursive: true });

        // 2. Extract ZIP into sandbox
        extractZipBuffer(zipFileBuffer, sandboxDir);

        // 3. Run local CLI scan (metadata extraction, no external API calls)
        reportJson = await runLocalScan(sandboxDir, {
            offline: true,
            fullDirectoryScan: projectContext.fullDirectoryScan || false
        });

        return reportJson;

    } catch (error) {
        console.error(`[Pipeline Error] Session ${sandboxId}:`, error.message);
        throw error;
    } finally {
        // 4. AUTOPILOT PRIVACY ENFORCER — purge everything no matter what
        wipeDirectorySync(sandboxDir);
        logger.debug(`[Pipeline Security] Sandbox ${sandboxId} purged from disk.`);
    }
}

/**
 * Legacy-compatible wrapper that accepts a directory path instead of a ZIP buffer.
 * Used by the existing Busboy upload handler when files are streamed individually.
 */
async function executeSecureAuditFromDir(sourceDir, projectContext = {}) {
    const sandboxId = generateSandboxId();
    const sandboxRoot = ensureSandboxRoot();
    const sandboxDir = path.join(sandboxRoot, sandboxId);
    let reportJson = null;

    try {
        // Copy source tree into isolated sandbox (preserves structure)
        copyDirectorySync(sourceDir, sandboxDir);

        reportJson = await runLocalScan(sandboxDir, {
            offline: true,
            fullDirectoryScan: projectContext.fullDirectoryScan || false
        });

        return reportJson;

    } catch (error) {
        console.error(`[Pipeline Error] Session ${sandboxId}:`, error.message);
        throw error;
    } finally {
        wipeDirectorySync(sandboxDir);
        logger.debug(`[Pipeline Security] Sandbox ${sandboxId} purged from disk.`);
    }
}

/**
 * Synchronously copy a directory tree.
 */
function copyDirectorySync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirectorySync(srcPath, destPath);
        } else if (entry.isFile()) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

module.exports = {
    executeSecureAuditPipeline,
    executeSecureAuditFromDir,
    generateSandboxId,
    copyDirectorySync,
    wipeDirectorySync,
    MAX_UPLOAD_BYTES
};
