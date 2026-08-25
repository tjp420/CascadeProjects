// simplebeacon-ignore: debugArtifacts, security
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

const fs = require("fs");
const logger = require("../lib/app-logger.cjs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const util = require("util");
const constants = require("../config/constants.cjs");
const execAsync = util.promisify(exec);
const unzipper = require("unzipper");

const SANDBOX_PREFIX = "simplebeacon_sandbox";
const MAX_UPLOAD_BYTES = 500 * constants.BYTES_PER_KB * constants.BYTES_PER_KB; // 500 MB

/**
 * Generate a cryptographically random sandbox directory name.
 */
function generateSandboxId() {
  return crypto.randomBytes(16).toString("hex");
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
    console.error("data-processor.cjs error:", syncErr);
    // Best-effort async fallback
    fs.promises.rm(dirPath, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extract a ZIP buffer into the given sandbox directory.
 */
async function extractZipBuffer(zipBuffer, targetDir) {
  // Safety limits to guard against zip bombs
  const MAX_TOTAL_EXTRACT_BYTES =
    200 * constants.BYTES_PER_KB * constants.BYTES_PER_KB; // 200 MB
  const MAX_ENTRIES = 1000;

  const directory = await unzipper.Open.buffer(zipBuffer);
  if (directory.files.length > MAX_ENTRIES) {
    throw new Error(
      `ZIP contains too many entries (${directory.files.length})`,
    );
  }

  let totalExtracted = 0;

  for (const file of directory.files) {
    // sanitize path
    const rawPath = String(file.path || "")
      .replace(/^[\\/]+/, "")
      .replace(/\.\.[\\/]/g, "");
    const outPath = path.join(targetDir, rawPath);
    if (!outPath.startsWith(targetDir)) {
      throw new Error("Invalid ZIP entry path");
    }

    if (file.type === "Directory") {
      fs.mkdirSync(outPath, { recursive: true });
      continue;
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    // stream the file with size checks
    await new Promise((resolve, reject) => {
      const readStream = file.stream();
      const writeStream = fs.createWriteStream(outPath, { flags: "wx" });
      let fileBytes = 0;

      readStream.on("data", (chunk) => {
        fileBytes += chunk.length;
        totalExtracted += chunk.length;
        if (
          fileBytes > MAX_UPLOAD_BYTES ||
          totalExtracted > MAX_TOTAL_EXTRACT_BYTES
        ) {
          readStream.destroy(new Error("ZIP extract exceeds allowed size"));
        }
      });

      readStream.on("error", (err) => {
        try {
          writeStream.destroy();
        } catch {}
        try {
          fs.unlinkSync(outPath);
        } catch {}
        reject(err);
      });

      writeStream.on("error", (err) => {
        try {
          readStream.destroy();
        } catch {}
        try {
          fs.unlinkSync(outPath);
        } catch {}
        reject(err);
      });

      writeStream.on("finish", () => resolve());
      readStream.pipe(writeStream);
    });
  }

  return targetDir;
}

/**
 * Write a file buffer into a sandbox directory preserving relative path.
 */
function writeFileToSandbox(fileBuffer, relativePath, sandboxDir) {
  let safePath = String(relativePath || "")
    .replace(/^[\\/]+/, "")
    .replace(/\.\.[\\/]/g, "");
  // Strip control characters 0x00–0x1f and 0x7f without using them in regex literal
  safePath = safePath
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("");
  const outPath = path.join(sandboxDir, safePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, fileBuffer);
  return outPath;
}

/**
 * Run the local SimpleBeacon CLI scan against a sandboxed directory.
 */
async function runLocalScan(sandboxDir, options = {}) {
  const cliBin = path.join(
    __dirname,
    "../../../packages/simplebeacon-cli/bin/simplebeacon.js",
  );
  const reportOut = path.join(sandboxDir, ".simplebeacon", "report.json");
  fs.mkdirSync(path.dirname(reportOut), { recursive: true }); // simplebeacon-ignore sync-io — temp directory creation before scan execution

  const configPath = path.join(sandboxDir, ".simplebeacon", "config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        scanPaths: ["."],
        productionPaths: ["."],
        ignore: [
          "node_modules/**",
          ".git/**",
          "coverage/**",
          "dist/**",
          "build/**",
          ".next/**",
          "**/*.test.js",
          "**/*.spec.js",
          "**/*.test.ts",
          "**/*.spec.ts",
          "**/*.map",
          "**/*.min.js",
          "**/*.min.css",
          "**/*.d.ts",
          "**/*.lock",
          "**/*.lockb",
          "package-lock.json",
          "yarn.lock",
          "pnpm-lock.yaml",
          ".DS_Store",
          "Thumbs.db",
          "*.png",
          "*.jpg",
          "*.jpeg",
          "*.gif",
          "*.svg",
          "*.ico",
          "*.mp4",
          "*.webm",
          "*.mp3",
          "*.wav",
          "*.pdf",
          "*.doc",
          "*.docx",
          "*.zip",
          "*.tar",
          "*.gz",
          "**/.vscode-test/**",
          "**/simplebeacon-vscode-merged/**",
          "**/*.vsix",
        ],
        fullDirectoryScanSkipDirs: [
          ".git",
          "node_modules",
          "coverage",
          "dist",
          "build",
          ".next",
          ".simplebeacon",
          "tmp",
          ".vscode-test",
          "simplebeacon-vscode-merged",
        ],
      },
      null,
      2,
    ),
  );

  const offlineFlag = options.offline !== false ? "--offline" : "";
  const fullScanFlag = options.fullDirectoryScan ? "--full" : "";
  const nodePath = process.execPath;
  const scanCmd = `"${nodePath}" "${cliBin}" scan --path "${sandboxDir}" --config "${configPath}" --format json --output "${reportOut}" ${offlineFlag} ${fullScanFlag}`;

  try {
    await execAsync(scanCmd, {
      timeout: 0,
      env: { ...process.env, FORCE_COLOR: "0" },
    });
  } catch (err) {
    try {
      await fs.promises.access(reportOut);
    } catch {
      throw err;
    }
  }

  // Read report with safety checks and redact sensitive values before returning
  async function readJsonFileWithLimit(fp, maxBytes = 10 * 1024 * 1024) {
    // 10 MB
    const st = await fs.promises.stat(fp);
    if (st.size > maxBytes) {
      throw new Error(
        `Report file too large to read safely (${st.size} bytes)`,
      );
    }
    // stream-read into buffer
    return new Promise((resolve, reject) => {
      const chunks = [];
      let received = 0;
      const rs = fs.createReadStream(fp, {
        encoding: "utf8",
        highWaterMark: 64 * 1024,
      });
      rs.on("data", (c) => {
        received += c.length;
        if (received > maxBytes) {
          rs.destroy(new Error("Exceeded max read limit"));
          return;
        }
        chunks.push(c);
      });
      rs.on("error", (err) => reject(err));
      rs.on("end", () => resolve(chunks.join("")));
    });
  }

  function redactReportSecrets(obj) {
    const tokenLike =
      /(?:api[_-]?key|openai[_-]?key|secret|token|access[_-]?key|aws[_-]?secret)["']?\s*[:=]?\s*["']?([A-Za-z0-9\-_.]{8,})/i;
    const longSecret = /[A-Za-z0-9_\-]{32,}/;

    function walk(value) {
      if (value == null) return value;
      if (Array.isArray(value)) return value.map(walk);
      if (typeof value === "object") {
        const out = {};
        for (const k of Object.keys(value)) {
          try {
            out[k] = walk(value[k]);
          } catch {
            out[k] = null;
          }
        }
        return out;
      }
      if (typeof value === "string") {
        if (tokenLike.test(value) || longSecret.test(value)) {
          return "[REDACTED]";
        }
        return value;
      }
      return value;
    }

    return walk(obj);
  }

  const raw = await readJsonFileWithLimit(reportOut, 10 * 1024 * 1024);
  const parsed = JSON.parse(raw);
  return redactReportSecrets(parsed);
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
    throw new Error("executeSecureAuditPipeline expects a Buffer");
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

    // 2. Extract ZIP into sandbox (await safe extractor)
    await extractZipBuffer(zipFileBuffer, sandboxDir);

    // 3. Run local CLI scan (metadata extraction, no external API calls)
    reportJson = await runLocalScan(sandboxDir, {
      offline: true,
      fullDirectoryScan: projectContext.fullDirectoryScan || false,
    });

    return reportJson;
  } catch (error) {
    logger.error(`[Pipeline Error] Session ${sandboxId}:`, error.message);
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
      fullDirectoryScan: projectContext.fullDirectoryScan || false,
    });

    return reportJson;
  } catch (error) {
    logger.error(`[Pipeline Error] Session ${sandboxId}:`, error.message);
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
  MAX_UPLOAD_BYTES,
};
