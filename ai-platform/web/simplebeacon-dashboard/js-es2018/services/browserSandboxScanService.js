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
  'packages', 'vendor', 'bower_components'
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
    regex: /(sk_live_[a-zA-Z0-9]{24,}|sk_test_[a-zA-Z0-9]{24,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,}|xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|xoxp-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}|private[_\-]?key|-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----)/gi,
    msg: 'Hardcoded API key, token, or private key detected.'
  },
  {
    id: 'SB-02',
    type: 'Placeholder Debris',
    severity: 'MEDIUM',
    regex: /(\/\/ Add your logic here|\/\/ TODO:\s*AI\s*generated|\/\/ TODO:\s*implement|\byour-api-key-here\b|\bYOUR_API_KEY\b|\bexample_api_key\b|\binsert_secret_here\b)/gi,
    msg: 'Unimplemented stub or placeholder left by AI generation.'
  },
  {
    id: 'SB-03',
    type: 'Markdown Fences',
    severity: 'MEDIUM',
    regex: new RegExp('(' + ['```javascript', '```json', '```html', '```css', '```python', '```typescript', '```jsx', '```tsx', '```'].join('|') + ')', 'g'),
    msg: 'Raw markdown formatting left behind from an AI chat interaction wrapper.'
  },
  {
    id: 'SB-04',
    type: 'AI Slop / Repetitive Boilerplate',
    severity: 'MEDIUM',
    regex: /(\/\*\*\s*\n\s*\*\s+.*\n\s*\*\/\s*\n){3,}|(\bimport\s+\{\s*[^}]+\}\s+from\s+['"]npm-[a-z0-9-]+['"])|(\balert\s*\(\s*['"]TODO['"]\s*\))|(\bconsole\.log\s*\(\s*['"]AI generated['"]\s*\))/gi,
    msg: 'Repetitive AI-generated boilerplate or hallucinated dependency.'
  },
  {
    id: 'SB-05',
    type: 'Compliance Drift',
    severity: 'MEDIUM',
    regex: /(eval\s*\(|new\s+Function\s*\(|innerHTML\s*=|document\.write\s*\(|child_process|exec\s*\(|spawn\s*\()/g,
    msg: 'Code pattern that may violate security/compliance controls (unsafe eval, innerHTML injection, process spawning).'
  },
  {
    id: 'SB-06',
    type: 'Generic Error Swallowing',
    severity: 'LOW',
    regex: /catch\s*\(\s*\w+\s*\)\s*\{\s*\/*\s*(TODO|FIXME|ignore)?\s*\*\/\s*\}/g,
    msg: 'Error handler silently swallows exceptions.'
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

function createScanWorker() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./scanWorker.js', import.meta.url));
  }
  catch (err) {
    console.warn('[SimpleBeacon] Scan worker unavailable; falling back to main-thread scan.', err);
    return null;
  }
}

async function analyzeDirectory({ rootName, fileQueue }, { maxFileSize, onLog, onProgress }) {
  const results = new Map();
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let processed = 0;
  let skippedLarge = 0;
  let skippedError = 0;

  const worker = createScanWorker();

  if (worker) {
    logLine(onLog, 'Using background scan worker to keep the UI responsive.', 'info');
    const pending = new Map();

    worker.onmessage = (e) => {
      const { status, result } = e.data;
      if (status === 'FILE_COMPLETED') {
        const resolve = pending.get(result.virtualPath);
        if (resolve) {
          pending.delete(result.virtualPath);
          resolve(result);
        }
      }
    };

    worker.onerror = (err) => {
      console.error('[SimpleBeacon] Scan worker error:', err);
    };

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
        const promise = new Promise((resolve) => {
          pending.set(item.virtualPath, resolve);
        });

        worker.postMessage({
          action: 'SCAN_FILE',
          fileData: {
            name: file.name,
            virtualPath: item.virtualPath,
            content,
            size: file.size
          }
        });

        const result = await promise;
        results.set(item.virtualPath, result);
        processed += 1;
        if (typeof onProgress === 'function') {
          onProgress({ processed, total: fileQueue.length });
        }
        if (processed > 0 && processed % 50 === 0) {
          await yieldToBrowser();
        }
      }
      catch (err) {
        skippedError += 1;
        logLine(onLog, `Could not read ${item.virtualPath}: ${err.message}`, 'warning');
      }
    }

    worker.terminate();
  }
  else {
    // Fallback: scan directly on the main thread when Workers are unavailable.
    logLine(onLog, 'Scan worker not available; running scan on the main thread.', 'warning');
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
        results.set(item.virtualPath, {
          name: file.name,
          virtualPath: item.virtualPath,
          size: file.size,
          fileIssues,
          fileFindings
        });

        processed += 1;
        if (typeof onProgress === 'function') {
          onProgress({ processed, total: fileQueue.length });
        }
        if (processed > 0 && processed % YIELD_EVERY === 0) {
          await yieldToBrowser();
        }
      }
      catch (err) {
        skippedError += 1;
        logLine(onLog, `Could not read ${item.virtualPath}: ${err.message}`, 'warning');
      }
    }
  }

  // Aggregate results from the worker (or the main-thread fallback) into the
  // same report shape the dashboard expects.
  const fileReport = [];
  const globalIssuesQueue = [];
  for (let i = 0; i < fileQueue.length; i++) {
    const item = fileQueue[i];
    const result = results.get(item.virtualPath);
    if (!result) continue;

    fileReport.push({
      name: item.virtualPath.split('/').pop() || item.virtualPath,
      absolutePath: item.virtualPath,
      size: result.size,
      status: result.fileIssues.length > 0 ? `Issues Flagged: ${result.fileIssues.join(', ')}` : 'Clean'
    });

    for (const finding of result.fileFindings) {
      globalIssuesQueue.push(finding);
      if (finding.severity === 'HIGH' || finding.severity === 'CRITICAL') highRiskCount += 1;
      if (finding.severity === 'MEDIUM') mediumRiskCount += 1;
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
 * Determine whether a dropped DataTransferItemList represents a folder drop.
 * @param {DataTransferItemList} items
 * @returns {Promise<boolean>}
 */
export async function isDroppedFolder(items) {
  if (!items || items.length === 0) return false;
  const first = items[0];
  if (typeof first.getAsFileSystemHandle === 'function') {
    try {
      const handle = await first.getAsFileSystemHandle();
      if (handle && handle.kind === 'directory') return true;
      if (handle && handle.kind === 'file') return false;
    }
    catch (_a) { /* ignore */ }
  }
  if (typeof first.webkitGetAsEntry === 'function') {
    try {
      const entry = first.webkitGetAsEntry();
      return entry ? entry.isDirectory : false;
    }
    catch (_b) { /* ignore */ }
  }
  return false;
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

/**
 * Scan a dropped DataTransferItemList entirely in the browser.
 * Uses the File System Access API when available, falling back to webkitGetAsEntry.
 * @param {DataTransferItemList} items
 * @param {Object} [options]
 * @returns {Promise<Object>} Same report shape as runSandboxedDirectoryScan.
 */
export async function scanDroppedItems(items, options = {}) {
  const { maxFileSize = DEFAULT_MAX_FILE_SIZE, maxFiles = DEFAULT_MAX_FILES, onLog, onProgress } = options;

  if (!items || items.length === 0) {
    throw new Error('No items were dropped.');
  }

  const first = items[0];
  const name = (first && first.getAsFile && first.getAsFile().name) || 'dropped-folder';

  // Preferred: File System Access API handles.
  if (typeof first.getAsFileSystemHandle === 'function') {
    const handle = await first.getAsFileSystemHandle();
    if (handle && handle.kind === 'directory') {
      const fileQueue = [];
      await crawlSandboxedTree(handle, handle.name, fileQueue, { maxFiles, onLog });
      logLine(onLog, `Dropped directory "${handle.name}" — ${fileQueue.length} targets queued.`, 'info');
      return analyzeDirectory({ rootName: handle.name, fileQueue }, { maxFileSize, onLog, onProgress });
    }
  }

  // Fallback: webkitGetAsEntry traversal.
  const entry = typeof first.webkitGetAsEntry === 'function' ? first.webkitGetAsEntry() : null;
  if (entry && entry.isDirectory) {
    const fileQueue = [];
    await crawlWebkitEntryTree(entry, entry.name, fileQueue, { maxFiles, onLog });
    logLine(onLog, `Dropped directory "${entry.name}" — ${fileQueue.length} targets queued.`, 'info');
    return analyzeDirectory({ rootName: entry.name, fileQueue }, { maxFileSize, onLog, onProgress });
  }

  // Not a folder drop: treat as ordinary files and scan each one.
  const fileQueue = [];
  for (let i = 0; i < items.length && fileQueue.length < maxFiles; i++) {
    const item = items[i];
    const file = item && item.getAsFile && item.getAsFile();
    if (!file) continue;
    const extIndex = file.name.lastIndexOf('.');
    const ext = extIndex >= 0 ? file.name.substring(extIndex).toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    const pathParts = [file.name];
    fileQueue.push({ file, virtualPath: file.name });
  }
  if (fileQueue.length === 0) {
    throw new Error('No scannable files were dropped.');
  }
  logLine(onLog, `Dropped ${fileQueue.length} file(s) — scanning locally.`, 'info');
  return analyzeDirectory({ rootName: name, fileQueue }, { maxFileSize, onLog, onProgress });
}

async function crawlWebkitEntryTree(entry, currentPath, queue, options) {
  const { maxFiles, onLog } = options || {};
  if (!entry.isDirectory) {
    const file = await new Promise((resolve) => entry.file(resolve));
    const extIndex = file.name.lastIndexOf('.');
    const ext = extIndex >= 0 ? file.name.substring(extIndex).toLowerCase() : '';
    if (ALLOWED_EXTENSIONS.has(ext)) {
      queue.push({ file, virtualPath: currentPath });
    }
    return;
  }

  if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) {
    logLine(onLog, `Skipping dependency/build directory: ${currentPath}`, 'info');
    return;
  }

  const reader = entry.createReader();
  let batch;
  do {
    batch = await new Promise((resolve) => reader.readEntries(resolve));
    for (const child of batch) {
      if (queue.length >= maxFiles) {
        logLine(onLog, `Reached max file limit (${maxFiles}); stopping traversal.`, 'warning');
        break;
      }
      await crawlWebkitEntryTree(child, `${currentPath}/${child.name}`, queue, options);
    }
  } while (batch.length > 0 && queue.length < maxFiles);
}
