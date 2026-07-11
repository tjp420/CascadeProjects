/**
 * Browser-native sandbox directory scanner using the File System Access API.
 * Scans a user-selected directory entirely within the browser thread,
 * applies SimpleBeacon heuristic rules, and produces an A-F compliance certificate.
 */

const DEFAULT_MAX_FILE_SIZE = 1500000;
const DEFAULT_MAX_FILES = 10000;

// Hidden/artifact directories that bloat scans with false positives (reports, caches, binaries).
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.simplebeacon', '.github', '.vscode',
  '.vscode-test', 'coverage', 'lcov-report', '.husky', '.windsurf', '.wrangler',
  'packages'
]);
// Source/config file types only; skip .md and .html to avoid flagging documentation/coverage output.
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.json', '.txt', '.ini', '.cfg', '.log', '.py', '.cs', '.cjs', '.mjs',
  '.ts', '.tsx', '.jsx', '.env', '.yml', '.yaml', '.xml', '.css'
]);

const RULES = [
  {
    id: 'SB-01',
    type: 'Exposed Credentials',
    severity: 'HIGH',
    regex: /(sk_live_[a-zA-Z0-9]{24,}|AKIA[0-9A-Z]{16})/g,
    msg: 'Hardcoded production API secret key leakage.'
  },
  {
    id: 'SB-02',
    type: 'Placeholder Debris',
    severity: 'MEDIUM',
    regex: /(\/\/ Add your logic here|\/\/\s*TODO:\s*AI\s*generated)/gi,
    msg: 'Unimplemented functional logic placeholder template.'
  },
  {
    id: 'SB-03',
    type: 'Markdown Fences',
    severity: 'MEDIUM',
    regex: new RegExp('(' + ['```javascript', '```json', '```html'].join('|') + ')', 'g'),
    msg: 'Raw markdown formatting left behind from an AI chat interaction wrapper.'
  }
];

function isSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

function logLine(logger, message, level) {
  if (typeof logger === 'function') {
    logger({ message, level, timestamp: Date.now() });
  }
}

async function crawlSandboxedTree(dirHandle, currentPath, queue, options) {
  const { maxFiles, onLog } = options || {};
  if (SKIP_DIRS.has(dirHandle.name) || dirHandle.name.startsWith('.')) {
    logLine(onLog, `Skipping dependency/build directory: ${currentPath}`, 'info');
    return;
  }

  for await (const [name, handle] of dirHandle.entries()) {
    if (queue.length >= maxFiles) {
      logLine(onLog, `Reached max file limit (${maxFiles}); stopping traversal.`, 'warning');
      break;
    }

    const nextVirtualPath = `${currentPath}/${name}`;

    if (handle.kind === 'directory') {
      await crawlSandboxedTree(handle, nextVirtualPath, queue, options);
      continue;
    }

    if (handle.kind !== 'file') continue;

    const extIndex = name.lastIndexOf('.');
    const ext = extIndex >= 0 ? name.substring(extIndex).toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    queue.push({ handle, virtualPath: nextVirtualPath });
  }
}

const MAX_LINE_LEN = 5000;

function countMatches(content, regex) {
  // Skip super-long lines to avoid catastrophic regex backtracking on minified/bundled files.
  const lines = content.split('\n');
  let total = 0;
  for (const line of lines) {
    if (line.length > MAX_LINE_LEN) continue;
    const matches = line.match(regex);
    if (matches) total += matches.length;
  }
  return total;
}

function gradeFindings(highRiskCount, mediumRiskCount) {
  let score = 100 - (highRiskCount * 15) - (mediumRiskCount * 4);
  if (score < 0) score = 0;
  if (highRiskCount > 0) score = Math.min(score, 55);

  let letterGrade = 'F';
  let badgeColor = '#dc3545';
  if (score >= 90) { letterGrade = 'A'; badgeColor = '#28a745'; }
  else if (score >= 80) { letterGrade = 'B'; badgeColor = '#0366d6'; }
  else if (score >= 70) { letterGrade = 'C'; badgeColor = '#ffc107'; }
  else if (score >= 60) { letterGrade = 'D'; badgeColor = '#fd7e14'; }

  const estimatedLiability = (highRiskCount * 25000) + (mediumRiskCount * 1250);

  return {
    score,
    letterGrade,
    badgeColor,
    highRiskCount,
    mediumRiskCount,
    liabilityStr: `$${estimatedLiability.toLocaleString()}`,
    complianceStatus: letterGrade === 'F'
      ? 'NON-COMPLIANT (CRITICAL DEBT)'
      : 'APPROVED FOR PRODUCTION RELEASE'
  };
}

function analyzeFile(content, virtualPath) {
  const fileIssues = [];
  const fileFindings = [];

  for (const rule of RULES) {
    const matchCount = countMatches(content, rule.regex);
    if (matchCount > 0) {
      fileIssues.push(`${rule.type} (${matchCount}x)`);
      for (let i = 0; i < matchCount; i += 1) {
        fileFindings.push({
          severity: rule.severity,
          filePath: virtualPath,
          message: rule.msg
        });
      }
    }
  }

  return { fileIssues, fileFindings };
}

async function pickFileSystemAccessDirectory({ maxFiles, onLog }) {
  const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
  const rootName = directoryHandle.name;
  logLine(onLog, `Access granted. Initializing scan over boundary: ${rootName}`, 'info');
  const fileQueue = [];
  await crawlSandboxedTree(directoryHandle, rootName, fileQueue, { maxFiles, onLog });
  return { rootName, fileQueue };
}

function pickLegacyDirectory({ maxFiles, onLog }) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.style.display = 'none';
    let resolved = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    input.addEventListener('change', (e) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      const files = Array.from(e.target.files || []);
      if (files.length === 0) {
        reject(new Error('Directory selection was cancelled or no files were chosen.'));
        return;
      }
      const rootName = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'selected-folder';
      logLine(onLog, `Legacy directory input selected. Streaming analysis over ${files.length} items...`, 'info');
      const fileQueue = [];
      for (const file of files) {
        if (fileQueue.length >= maxFiles) {
          logLine(onLog, `Reached max file limit (${maxFiles}); stopping traversal.`, 'warning');
          break;
        }
        const virtualPath = file.webkitRelativePath || file.name;
        const pathParts = virtualPath.split('/');
        if (pathParts.some((part) => SKIP_DIRS.has(part) || part.startsWith('.'))) continue;
        const extIndex = file.name.lastIndexOf('.');
        const ext = extIndex >= 0 ? file.name.substring(extIndex).toLowerCase() : '';
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        fileQueue.push({ file, virtualPath });
      }
      resolve({ rootName, fileQueue });
    });
    input.addEventListener('cancel', () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Directory selection was cancelled or no files were chosen.'));
      }
    });
    document.body.appendChild(input);
    input.click();
  });
}

const YIELD_EVERY = 50;

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function analyzeDirectory({ rootName, fileQueue }, { maxFileSize, onLog, onProgress }) {
  const fileReport = [];
  const globalIssuesQueue = [];
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let processed = 0;
  let skippedLarge = 0;
  let skippedError = 0;

  for (let i = 0; i < fileQueue.length; i++) {
    const item = fileQueue[i];
    try {
      const file = item.file || await item.handle.getFile();
      if (file.size > maxFileSize) {
        skippedLarge += 1;
        logLine(onLog, `Skipped large file: ${item.virtualPath}`, 'info');
        continue;
      }

      const content = await file.text();
      const { fileIssues, fileFindings } = analyzeFile(content, item.virtualPath);

      fileReport.push({
        name: item.virtualPath.split('/').pop() || item.virtualPath,
        absolutePath: item.virtualPath,
        size: file.size,
        status: fileIssues.length > 0 ? `Issues Flagged: ${fileIssues.join(', ')}` : 'Clean'
      });

      for (const finding of fileFindings) {
        globalIssuesQueue.push(finding);
        if (finding.severity === 'HIGH') highRiskCount += 1;
        if (finding.severity === 'MEDIUM') mediumRiskCount += 1;
      }

      processed += 1;
      if (typeof onProgress === 'function') {
        onProgress({ processed, total: fileQueue.length });
      }

      // Yield to the browser event loop every N files so large scans don't freeze the tab.
      if (processed > 0 && processed % YIELD_EVERY === 0) {
        await yieldToBrowser();
      }
    } catch (err) {
      skippedError += 1;
      logLine(onLog, `Could not read ${item.virtualPath}: ${err.message}`, 'warning');
    }
  }

  const certificate = gradeFindings(highRiskCount, mediumRiskCount);
  certificate.logs = globalIssuesQueue;

  logLine(onLog, `Sandboxed drive sweep complete. Grade ${certificate.letterGrade} | ${fileReport.length}/${fileQueue.length} files (${skippedLarge + skippedError} skipped).`, 'success');

  return {
    success: true,
    verifiedAddress: rootName,
    path: rootName,
    files: fileReport,
    discoveredFiles: fileQueue.length,
    skippedFiles: skippedLarge + skippedError,
    skippedLarge,
    skippedError,
    certificate
  };
}

/**
 * Prompt the user to pick a directory, then scan it in-browser.
 * @param {Object} [options]
 * @param {number} [options.maxFileSize=1500000]
 * @param {number} [options.maxFiles=10000]
 * @param {Function} [options.onLog] - Receives { message, level, timestamp } objects.
 * @param {Function} [options.onProgress] - Receives { processed, total } objects.
 * @returns {Promise<Object>} Report compatible with renderAgentCertificate.
 */
export async function runSandboxedDirectoryScan(options = {}) {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE, maxFiles = DEFAULT_MAX_FILES, onLog, onProgress } = options;

  const picked = isSupported()
    ? await pickFileSystemAccessDirectory({ maxFiles, onLog })
    : await pickLegacyDirectory({ maxFiles, onLog });

  logLine(onLog, `Discovered ${picked.fileQueue.length} text/code targets.`, 'info');
  return analyzeDirectory(picked, { maxFileSize, onLog, onProgress });
}
