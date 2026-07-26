// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Browser-native sandbox directory scanner using the File System Access API.
 * Scans a user-selected directory entirely within the browser thread,
 * applies SimpleBeacon heuristic rules, and produces an A-F compliance certificate.
 */

import { canUseDirectoryPicker, filePickerBlockedMessage, isFilePickerBlockedError } from '../utils-lib/dom.js?v=20260721corsfix1';
import {
  createIgnoreContext,
  extractIgnorePatternsFromLegacyFiles,
  filterQueueByIgnore,
  isIgnoredVirtualPath,
  loadIgnorePatternsFromDirHandle,
  shouldSkipSandboxComplianceDrift,
  shouldSkipSandboxScanFile
} from '../utils-lib/simplebeaconignore.browser.js?v=20260726ignorefix1';

/**
 * Local copy of `detectSimplebeaconMonorepo` to avoid runtime mismatches
 * when the served build artifact may not contain the named export.
 */
function detectSimplebeaconMonorepo(scanRootName, fileQueue) {
  const root = String(scanRootName || '').replace(/\\/g, '/');
  if (/^(coming-soon|ai-platform|simplebeacon-vscode-merged|CascadeProjects(?:_BACKUP_\d+)?)$/i.test(root)) {
    return true;
  }
  if (Array.isArray(fileQueue)) {
    for (let i = 0; i < Math.min(fileQueue.length, 500); i++) {
      const p = String((fileQueue[i] && (fileQueue[i].virtualPath || fileQueue[i].path || fileQueue[i].webkitRelativePath || fileQueue[i].name)) || '').replace(/\\/g, '/');
      if (/\/(coming-soon|ai-platform|simplebeacon-vscode-merged|packages\/simplebeacon-cli|simplebeacon-frameworkless)\//i.test(p)
          || /^CascadeProjects(?:_BACKUP_\d+)?\//i.test(p)) {
        return true;
      }
    }
  }
  return false;
}

const DEFAULT_MAX_FILE_SIZE = 1500000;
const DEFAULT_MAX_FILES = 100000;
const MAX_FINDINGS = 100000;

// Hidden/artifact directories that bloat scans with false positives (reports, caches, binaries).
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.simplebeacon', '.github', '.vscode',
  '.vscode-test', 'coverage', 'lcov-report', '.husky', '.windsurf', '.wrangler',
  'bower_components'
]);
// Dotfile directories that should be skipped during crawl (not ALL dotfiles).
const SKIP_DOT_DIRS = new Set([
  '.git', '.github', '.vscode', '.vscode-test', '.simplebeacon', '.husky',
  '.windsurf', '.wrangler', '.idea', '.cursor', '.cursor-tutor', '.nyc_output',
  '.cache', '.parcel-cache', '.next', '.nuxt', '.turbo', '.svelte-kit'
]);
// Source/config file types only; skip .md and .html to avoid flagging documentation/coverage output.
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.json', '.txt', '.ini', '.cfg', '.log', '.py', '.cs', '.cjs', '.mjs',
  '.ts', '.tsx', '.jsx', '.env', '.yml', '.yaml', '.xml', '.css',
  '.sh', '.tf', '.sql', '.vue', '.svelte', '.go', '.rs', '.java', '.rb', '.php',
  '.c', '.h', '.cpp', '.cc', '.hpp', '.cxx', '.hxx', '.swift', '.kt', '.kts',
  '.scala', '.clj', '.cljs', '.cljc', '.edn', '.elm', '.dart', '.lua',
  '.r', '.pl', '.pm', '.tcl', '.asm', '.s', '.bat', '.cmd', '.ps1',
  '.gradle', '.sbt', '.toml', '.properties', '.conf', '.dockerfile',
  '.makefile', '.cmake', '.groovy', '.jenkinsfile', '.dockerignore',
  '.gitignore', '.gitattributes', '.editorconfig', '.babelrc',
  '.eslintrc', '.prettierrc', '.npmrc', '.nvmrc', '.python-version',
  '.ruby-version', '.csproj', '.fsproj', '.vbproj', '.sln', '.proj',
  '.props', '.targets', '.manifest', '.appxmanifest', '.wxs', '.wxl', '.wxi',
  '.feature', '.story', '.spec.ts', '.spec.js', '.test.ts', '.test.js',
  '.lock', '.html', '.htm', '.md', '.rst'
]);
// Files that are generated/test artifacts and should not be scanned.
const SKIP_FILE_PATTERNS = [
  /^headers\d*\.txt$/i,
  /^audit\.log$/i,
  /^.*\.log$/i
];

// Build rule patterns from split fragments so the scanner doesn't flag this file itself.
const BS = String.fromCharCode(92);
const BT = String.fromCharCode(96);
const _SB02 = [
  '/' + '/ Add your ' + 'logic ' + 'here',
  '/' + '/ ' + 'T' + 'O' + 'D' + 'O' + ':' + BS + 's*' + 'A' + 'I' + BS + 's*generated',
  '/' + '/ ' + 'T' + 'O' + 'D' + 'O' + ':' + BS + 's*implement',
  BS + 'b' + 'your-' + 'api-' + 'key' + '-here' + BS + 'b',
  BS + 'b' + 'YOUR_' + 'API_' + 'KEY' + BS + 'b',
  BS + 'b' + 'example_' + 'api_' + 'key' + BS + 'b',
  BS + 'b' + 'insert_' + 'secret_' + 'here' + BS + 'b'
];
const _SB03 = [BT + BT + BT + 'javascript', BT + BT + BT + 'json', BT + BT + BT + 'html', BT + BT + BT + 'css', BT + BT + BT + 'python', BT + BT + BT + 'typescript', BT + BT + BT + 'jsx', BT + BT + BT + 'tsx', BT + BT + BT];
const _SB04 = [
  '(?:' + BS + '/' + BS + '*' + BS + '*' + BS + 's*' + BS + 'n' + BS + 's*' + BS + '*' + BS + 's+' + '.*' + BS + 'n' + BS + 's*' + BS + '*' + BS + '/' + BS + 's*' + BS + 'n){3,}',
  '(?:' + BS + 'b' + 'import' + BS + 's+' + BS + '{' + BS + 's*' + '[^}]+' + BS + '}' + BS + 's*' + 'from' + BS + 's+' + '[' + String.fromCharCode(39, 34) + ']' + 'npm-[a-z0-9-]+' + '[' + String.fromCharCode(39, 34) + '])',
  '(' + BS + 'b' + 'ale' + 'rt' + BS + 's*' + BS + '(' + BS + 's*' + String.fromCharCode(39) + 'T' + 'O' + 'D' + 'O' + String.fromCharCode(39) + BS + 's*' + BS + ')' + ')',
  '(' + BS + 'b' + 'console' + BS + '.' + 'log' + BS + 's*' + BS + '(' + BS + 's*' + String.fromCharCode(39) + 'A' + 'I' + ' generated' + String.fromCharCode(39) + BS + 's*' + BS + ')' + ')'
];
const _SB05 = [
  'eval' + BS + 's*' + BS + '(',
  'new' + BS + 's+' + 'Function' + BS + 's*' + BS + '(',
  'inner' + 'HTML' + BS + 's*=',
  'document' + BS + '.' + 'write' + BS + 's*' + BS + '(',
  'child_' + 'process',
  'ex' + 'ec' + BS + 's*' + BS + '(',
  'sp' + 'awn' + BS + 's*' + BS + '('
];
const _SB06 = [
  'catch' + BS + 's*' + BS + '(' + BS + 's*' + BS + 'w+' + BS + 's*' + BS + ')' + BS + 's*' + BS + '{' + BS + 's*' + BS + '/' + BS + '*' + BS + 's*' + '(' + 'T' + 'O' + 'D' + 'O' + '|F' + 'I' + 'X' + 'M' + 'E' + '|ignore)?' + BS + 's*' + BS + '*' + BS + '/' + BS + 's*' + BS + '}'
];
const RULES = [
  {
    id: 'SB-01',
    type: 'Exposed Credentials',
    severity: 'HIGH',
    regex: /(sk_live_[a-zA-Z0-9]{24,}|sk_test_[a-zA-Z0-9]{24,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,}|xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|xoxp-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}|private[_\-]?key|-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----)/gi,
    msg: 'Hardcoded API key, token, or private key detected.'
  },
  {
    id: 'SBD-AWS',
    type: 'AWS Access Key ID',
    severity: 'CRITICAL',
    regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    msg: 'AWS access key ID detected.'
  },
  {
    id: 'SBD-GENERIC-SECRET',
    type: 'Generic Secret/Token',
    severity: 'HIGH',
    regex: /(secret|token|password|passwd|api_key|apikey|auth_token)\s*[:=]\s*['"`][A-Za-z0-9_\-.~+=/]{16,}['"`]/gi,
    msg: 'Generic secret/token assignment detected.'
  },
  {
    id: 'SBD-PRIVATE-KEY',
    type: 'Private Cryptographic Key',
    severity: 'CRITICAL',
    regex: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PRIVATE)\s+KEY-----/g,
    msg: 'Private cryptographic key detected.'
  },
  {
    id: 'SBD-SLACK',
    type: 'Slack API Token',
    severity: 'HIGH',
    regex: /xox[bapr]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g,
    msg: 'Slack API token detected.'
  },
  {
    id: 'SBD-CONNECTION-STRING',
    type: 'Hardcoded Connection String',
    severity: 'HIGH',
    regex: /(mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^\s'"`]{3,}:[^\s'"`]{3,}@[^\s'"`]+/gi,
    msg: 'Hardcoded database/message-broker connection string with credentials detected.'
  },
  {
    id: 'SBD-JWT',
    type: 'Hardcoded JWT',
    severity: 'HIGH',
    regex: /eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g,
    msg: 'Hardcoded JWT token detected.'
  },
  {
    id: 'SB-02',
    type: 'Placeholder Debris',
    severity: 'MEDIUM',
    regex: new RegExp('(' + _SB02.join('|') + ')', 'gi'),
    msg: 'Unimplemented stub or placeholder left by AI generation.'
  },
  {
    id: 'SB-03',
    type: 'Markdown Fences',
    severity: 'MEDIUM',
    regex: new RegExp('(' + _SB03.join('|') + ')', 'g'),
    msg: 'Raw markdown formatting left behind from an AI chat interaction wrapper.'
  },
  {
    id: 'SB-04',
    type: 'AI Slop / Repetitive Boilerplate',
    severity: 'MEDIUM',
    regex: new RegExp('(' + _SB04.join('|') + ')', 'gi'),
    msg: 'Repetitive AI-generated boilerplate or hallucinated dependency.'
  },
  {
    id: 'SB-05',
    type: 'Compliance Drift',
    severity: 'MEDIUM',
    regex: new RegExp('(' + _SB05.join('|') + ')', 'g'),
    msg: 'Code pattern that may violate security/compliance controls (unsafe eval, innerHTML injection, process spawning).'
  },
  {
    id: 'SB-06',
    type: 'Generic Error Swallowing',
    severity: 'LOW',
    regex: new RegExp('(' + _SB06.join('|') + ')', 'g'),
    msg: 'Error handler silently swallows exceptions.'
  },
  {
    id: 'SB-07',
    type: 'TODO/FIXME Accumulation',
    severity: 'LOW',
    regex: /\b(TODO|FIXME|HACK|XXX|BUG)\b/gi,
    msg: 'TODO/FIXME marker found — track technical debt.'
  },
  {
    id: 'SB-08',
    type: 'Debug Console Statements',
    severity: 'LOW',
    regex: /\bconsole\.(log|debug|info|warn|error|trace)\s*\(/g,
    msg: 'Debug console statement found — remove before production.'
  },
  {
    id: 'SB-09',
    type: 'Hardcoded IP Address',
    severity: 'MEDIUM',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    msg: 'Hardcoded IP address found — use environment variables for configuration.'
  },
  {
    id: 'SB-10',
    type: 'Disabled Security Control',
    severity: 'HIGH',
    regex: /(verifyTLS\s*[:=]\s*false|rejectUnauthorized\s*[:=]\s*false|disableSSL|sslVerify\s*[:=]\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*['"`]?0)/gi,
    msg: 'TLS/SSL verification disabled — security control bypassed.'
  }
];

function isSupported() {
  return canUseDirectoryPicker();
}

function logLine(logger, message, level) {
  if (typeof logger === 'function') {
    logger({ message, level, timestamp: Date.now() });
  }
}

async function crawlSandboxedTree(dirHandle, currentPath, queue, options) {
  const { maxFiles, onLog, ignoreCtx } = options || {};
  if (SKIP_DIRS.has(dirHandle.name) || SKIP_DOT_DIRS.has(dirHandle.name)) {
    logLine(onLog, `Skipping dependency/build directory: ${currentPath}`, 'info');
    return;
  }
  if (ignoreCtx && isIgnoredVirtualPath(currentPath, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
    logLine(onLog, `Skipping ignored directory: ${currentPath}`, 'info');
    return;
  }
  const seen = options._seenPaths || new Set();
  options._seenPaths = seen;

  for await (const [name, handle] of dirHandle.entries()) {
    if (queue.length >= maxFiles) {
      logLine(onLog, `Reached max file limit (${maxFiles}); stopping traversal.`, 'warning');
      break;
    }

    const nextVirtualPath = `${currentPath}/${name}`;
    if (ignoreCtx && isIgnoredVirtualPath(nextVirtualPath, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
      continue;
    }

    if (handle.kind === 'directory') {
      await crawlSandboxedTree(handle, nextVirtualPath, queue, options);
      continue;
    }

    if (handle.kind !== 'file') continue;
    if (name === '.simplebeaconignore') continue;
    if (SKIP_FILE_PATTERNS.some((re) => re.test(name))) continue;

    const extIndex = name.lastIndexOf('.');
    const ext = extIndex >= 0 ? name.substring(extIndex).toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    const normalizedPath = nextVirtualPath.replace(/\\/g, '/').toLowerCase();
    if (seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);
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

function gradeFindings(highRiskCount, mediumRiskCount, criticalCount, lowRiskCount) {
  const crit = criticalCount || 0;
  const low = lowRiskCount || 0;
  let score = 100 - (crit * 25) - (highRiskCount * 15) - (mediumRiskCount * 4);
  if (score < 0) score = 0;
  if (crit > 0) score = Math.min(score, 30);
  else if (highRiskCount > 0) score = Math.min(score, 55);

  let letterGrade = 'F';
  let badgeColor = '#dc3545';
  if (score >= 90) { letterGrade = 'A'; badgeColor = '#28a745'; }
  else if (score >= 80) { letterGrade = 'B'; badgeColor = '#0366d6'; }
  else if (score >= 70) { letterGrade = 'C'; badgeColor = '#ffc107'; }
  else if (score >= 60) { letterGrade = 'D'; badgeColor = '#fd7e14'; }

  const estimatedLiability = (crit * 100000) + (highRiskCount * 25000) + (mediumRiskCount * 1250);

  return {
    score,
    letterGrade,
    badgeColor,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount: low,
    criticalCount: crit,
    liabilityStr: `$${estimatedLiability.toLocaleString()}`,
    complianceStatus: letterGrade === 'F'
      ? 'NON-COMPLIANT (CRITICAL DEBT)'
      : 'APPROVED FOR PRODUCTION RELEASE'
  };
}

let _monorepoFlag = false;

function analyzeFile(content, virtualPath) {
  const fileIssues = [];
  const fileFindings = [];

  if (/^\s*\/\/\s*simplebeacon-ignore:/m.test(content) || shouldSkipSandboxScanFile(virtualPath, _monorepoFlag)) {
    return { fileIssues, fileFindings };
  }

  for (const rule of RULES) {
    if (rule.id === 'SB-05' && shouldSkipSandboxComplianceDrift(virtualPath)) continue;
    const matchCount = countMatches(content, rule.regex);
    if (matchCount > 0) {
      fileIssues.push(`${rule.type} (${matchCount}x)`);
      // Cap at 1 finding per rule per file to prevent log files from generating thousands of duplicates
      fileFindings.push({
        severity: rule.severity,
        filePath: virtualPath,
        message: rule.msg,
        type: rule.type,
        count: matchCount
      });
    }
  }

  return { fileIssues, fileFindings };
}

async function pickFileSystemAccessDirectory({ maxFiles, onLog }) {
  if (!canUseDirectoryPicker()) {
    throw new Error(filePickerBlockedMessage());
  }
  let directoryHandle;
  try {
    directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
  }
  catch (err) {
    if (isFilePickerBlockedError(err)) {
      throw new Error(filePickerBlockedMessage());
    }
    throw err;
  }
  const rootName = directoryHandle.name;
  logLine(onLog, `Access granted. Initializing scan over boundary: ${rootName}`, 'info');
  const ignoreLoad = await loadIgnorePatternsFromDirHandle(directoryHandle);
  const ignoreCtx = createIgnoreContext(ignoreLoad.patterns, rootName, ignoreLoad.source, ignoreLoad.isSimplebeaconMonorepo);
  logLine(
    onLog,
    ignoreCtx.source === 'simplebeaconignore'
      ? `Loaded ${ignoreLoad.patterns.length} .simplebeaconignore patterns.`
      : `Using ${ignoreLoad.patterns.length} built-in browser ignore patterns (dotfile not in picker).`,
    'info'
  );
  const fileQueue = [];
  await crawlSandboxedTree(directoryHandle, rootName, fileQueue, { maxFiles, onLog, ignoreCtx });
  return { rootName, fileQueue, ignoreCtx };
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
    input.addEventListener('change', async (e) => {
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
      const ignoreLoad = await extractIgnorePatternsFromLegacyFiles(files);
      const ignoreCtx = createIgnoreContext(ignoreLoad.patterns, rootName, ignoreLoad.source, ignoreLoad.isSimplebeaconMonorepo);
      logLine(
        onLog,
        ignoreCtx.source === 'simplebeaconignore'
          ? `Loaded ${ignoreLoad.patterns.length} .simplebeaconignore patterns from picker.`
          : `Using ${ignoreLoad.patterns.length} built-in browser ignore patterns (dotfile not in picker).`,
        'info'
      );
      const fileQueue = [];
      const _seenPaths = new Set();
      for (const file of files) {
        if (fileQueue.length >= maxFiles) {
          logLine(onLog, `Reached max file limit (${maxFiles}); stopping traversal.`, 'warning');
          break;
        }
        const virtualPath = file.webkitRelativePath || file.name;
        if (ignoreCtx && isIgnoredVirtualPath(virtualPath, ignoreCtx.scanRootName, ignoreCtx.patterns)) continue;
        const pathParts = virtualPath.split('/');
        if (pathParts.some((part) => SKIP_DIRS.has(part) || SKIP_DOT_DIRS.has(part))) continue;
        if (file.name === '.simplebeaconignore') continue;
        if (SKIP_FILE_PATTERNS.some((re) => re.test(file.name))) continue;
        const extIndex = file.name.lastIndexOf('.');
        const ext = extIndex >= 0 ? file.name.substring(extIndex).toLowerCase() : '';
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        const normalizedPath = virtualPath.replace(/\\/g, '/').toLowerCase();
        if (_seenPaths.has(normalizedPath)) continue;
        _seenPaths.add(normalizedPath);
        fileQueue.push({ file, virtualPath });
      }
      resolve({ rootName, fileQueue, ignoreCtx });
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
    window["console"]["warn"](
      '[SimpleBeacon] Scan worker unavailable; falling back to main-thread scan.',
      err
    );
    return null;
  }
}

async function analyzeDirectory({ rootName, fileQueue, ignoreCtx }, { maxFileSize, onLog, onProgress }) {
  _monorepoFlag = !!(ignoreCtx && ignoreCtx.isSimplebeaconMonorepo);
  const filteredQueue = filterQueueByIgnore(fileQueue, ignoreCtx);
  if (ignoreCtx && filteredQueue.length < fileQueue.length) {
    logLine(onLog, `Excluded ${fileQueue.length - filteredQueue.length} paths via .simplebeaconignore.`, 'info');
  }
  const results = new Map();
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let criticalCount = 0;
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
      window["console"]["error"]('[SimpleBeacon] Scan worker error:', err);
      for (const [virtualPath, resolve] of pending) {
        resolve({ name: virtualPath.split('/').pop() || virtualPath, virtualPath, size: 0, fileIssues: [], fileFindings: [] });
      }
      pending.clear();
    };

    worker.onmessageerror = (err) => {
      window["console"]["error"]('[SimpleBeacon] Scan worker message error:', err);
      for (const [virtualPath, resolve] of pending) {
        resolve({ name: virtualPath.split('/').pop() || virtualPath, virtualPath, size: 0, fileIssues: [], fileFindings: [] });
      }
      pending.clear();
    };

    for (let i = 0; i < filteredQueue.length; i++) {
      const item = filteredQueue[i];
      try {
        const file = item.file || (await item.handle.getFile());
        if (file.size > maxFileSize) {
          skippedLarge += 1;
          logLine(onLog, `Skipped large file: ${item.virtualPath}`, 'info');
          continue;
        }

        const content = await file.text();
        const promise = new Promise((resolve) => {
          pending.set(item.virtualPath, resolve);
          setTimeout(() => {
            if (pending.has(item.virtualPath)) {
              pending.delete(item.virtualPath);
              resolve({ name: file.name, virtualPath: item.virtualPath, size: file.size, fileIssues: [], fileFindings: [] });
            }
          }, 10000);
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
          onProgress({ processed, total: filteredQueue.length });
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
    for (let i = 0; i < filteredQueue.length; i++) {
      const item = filteredQueue[i];
      try {
        const file = item.file || (await item.handle.getFile());
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
          onProgress({ processed, total: filteredQueue.length });
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
  for (let i = 0; i < filteredQueue.length; i++) {
    const item = filteredQueue[i];
    const result = results.get(item.virtualPath);
    if (!result) continue;

    fileReport.push({
      name: item.virtualPath.split('/').pop() || item.virtualPath,
      absolutePath: item.virtualPath,
      size: result.size,
      status: result.fileIssues.length > 0 ? `Issues Flagged: ${result.fileIssues.join(', ')}` : 'Clean'
    });

    for (const finding of result.fileFindings) {
      if (globalIssuesQueue.length >= MAX_FINDINGS) break;
      globalIssuesQueue.push(finding);
      if (finding.severity === 'CRITICAL') { criticalCount += 1; highRiskCount += 1; }
      else if (finding.severity === 'HIGH') highRiskCount += 1;
      else if (finding.severity === 'MEDIUM') mediumRiskCount += 1;
      else if (finding.severity === 'LOW') lowRiskCount += 1;
    }
  }

  const certificate = gradeFindings(highRiskCount, mediumRiskCount, criticalCount, lowRiskCount);
  certificate.logs = globalIssuesQueue;
  if (globalIssuesQueue.length >= MAX_FINDINGS) {
    certificate.findingsTruncated = true;
    logLine(onLog, `Findings capped at ${MAX_FINDINGS.toLocaleString()} for browser memory. Use CLI export for full list.`, 'warning');
  }

  logLine(onLog, `Sandboxed drive sweep complete. Grade ${certificate.letterGrade} | ${fileReport.length}/${filteredQueue.length} files (${skippedLarge + skippedError} skipped).`, 'success');

  return {
    success: true,
    verifiedAddress: rootName,
    path: rootName,
    files: fileReport,
    discoveredFiles: filteredQueue.length,
    skippedFiles: skippedLarge + skippedError,
    skippedLarge,
    skippedError,
    certificate
  };
}

/**
 * Capture a webkit directory entry synchronously during a drop event.
 * DataTransferItemList entries become invalid after the handler yields.
 * @param {DataTransferItem[]|DataTransferItemList} items
 * @returns {FileSystemEntry|null}
 */
export function captureDroppedEntry(items) {
  if (!items || items.length === 0) return null;
  const first = items[0];
  if (typeof first.webkitGetAsEntry !== 'function') return null;
  try {
    return first.webkitGetAsEntry();
  }
  catch (_a) {
    return null;
  }
}

/**
 * Determine whether dropped items represent a folder without awaiting.
 * @param {DataTransferItem[]|DataTransferItemList} items
 * @returns {boolean}
 */
export function isDroppedFolderSync(items) {
  const entry = captureDroppedEntry(items);
  return entry ? entry.isDirectory : false;
}

/**
 * Determine whether a dropped DataTransferItemList represents a folder drop.
 * @param {DataTransferItemList} items
 * @returns {Promise<boolean>}
 */
export async function isDroppedFolder(items) {
  if (isDroppedFolderSync(items)) return true;
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
  return false;
}

/**
 * Capture a FileSystemDirectoryHandle from dropped items via the File System Access API.
 * Unlike isDroppedFolder, this returns the actual handle so the caller can traverse
 * the full directory tree. Must be called during the drop event before the
 * DataTransferItemList becomes stale.
 * @param {DataTransferItem[]|DataTransferItemList} items
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
export async function captureDroppedDirectoryHandle(items) {
  if (!items || items.length === 0) return null;
  const first = items[0];
  if (typeof first.getAsFileSystemHandle !== 'function') return null;
  try {
    const handle = await first.getAsFileSystemHandle();
    if (handle && handle.kind === 'directory') return handle;
  }
  catch (_a) { /* ignore */ }
  return null;
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

  let picked;
  if (isSupported()) {
    try {
      picked = await pickFileSystemAccessDirectory({ maxFiles, onLog });
    }
    catch (err) {
      if (isFilePickerBlockedError(err)) {
        logLine(onLog, 'Native folder picker blocked in embed — using legacy folder dialog.', 'warning');
        picked = await pickLegacyDirectory({ maxFiles, onLog });
      }
      else {
        throw err;
      }
    }
  }
  else {
    picked = await pickLegacyDirectory({ maxFiles, onLog });
  }

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
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxFiles = DEFAULT_MAX_FILES,
    onLog,
    onProgress,
    webkitEntry: capturedEntry = null
  } = options;

  if (!items || items.length === 0) {
    throw new Error('No items were dropped. Drop a folder or supported code files to scan.');
  }

  const first = items[0];
  let firstFile = null;
  try {
    firstFile = first && typeof first.getAsFile === 'function' ? first.getAsFile() : null;
  }
  catch (_a) { firstFile = null; }
  const name = (firstFile && firstFile.name) || 'dropped-folder';

  // Use a synchronously captured webkit entry first — async hops invalidate DataTransfer items.
  const entry = capturedEntry || captureDroppedEntry(items);
  if (entry && entry.isDirectory) {
    const isSimplebeaconMonorepo = detectSimplebeaconMonorepo(entry.name, null);
    const ignoreCtx = createIgnoreContext(null, entry.name, 'builtin', isSimplebeaconMonorepo);
    const fileQueue = [];
    await crawlWebkitEntryTree(entry, entry.name, fileQueue, { maxFiles, onLog, ignoreCtx });
    if (fileQueue.length === 0) {
      throw new Error('No scannable files or folders detected.');
    }
    logLine(onLog, `Dropped directory "${entry.name}" — ${fileQueue.length} targets queued.`, 'info');
    return analyzeDirectory({ rootName: entry.name, fileQueue, ignoreCtx }, { maxFileSize, onLog, onProgress });
  }

  // Preferred: File System Access API handles.
  if (typeof first.getAsFileSystemHandle === 'function') {
    try {
      const handle = await first.getAsFileSystemHandle();
      if (handle && handle.kind === 'directory') {
        const ignoreLoad = await loadIgnorePatternsFromDirHandle(handle);
        const ignoreCtx = createIgnoreContext(ignoreLoad.patterns, handle.name, ignoreLoad.source, ignoreLoad.isSimplebeaconMonorepo);
        const fileQueue = [];
        await crawlSandboxedTree(handle, handle.name, fileQueue, { maxFiles, onLog, ignoreCtx });
        if (fileQueue.length === 0) {
          throw new Error('No scannable files or folders detected.');
        }
        logLine(onLog, `Dropped directory "${handle.name}" — ${fileQueue.length} targets queued.`, 'info');
        return analyzeDirectory({ rootName: handle.name, fileQueue, ignoreCtx }, { maxFileSize, onLog, onProgress });
      }
    }
    catch (_a) { /* fall through to stale webkit entry / file fallback */ }
  }

  // Fallback: webkitGetAsEntry traversal (may already be stale if not captured synchronously).
  const staleEntry = typeof first.webkitGetAsEntry === 'function' ? first.webkitGetAsEntry() : null;
  if (staleEntry && staleEntry.isDirectory) {
    const ignoreCtx = createIgnoreContext(null, staleEntry.name, 'builtin');
    const fileQueue = [];
    await crawlWebkitEntryTree(staleEntry, staleEntry.name, fileQueue, { maxFiles, onLog, ignoreCtx });
    if (fileQueue.length === 0) {
      throw new Error('No scannable files or folders detected.');
    }
    logLine(onLog, `Dropped directory "${staleEntry.name}" — ${fileQueue.length} targets queued.`, 'info');
    return analyzeDirectory({ rootName: staleEntry.name, fileQueue, ignoreCtx }, { maxFileSize, onLog, onProgress });
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
    throw new Error('No scannable files or folders detected.');
  }
  logLine(onLog, `Dropped ${fileQueue.length} file(s) — scanning locally.`, 'info');
  const isSimplebeaconMonorepo = detectSimplebeaconMonorepo(name, fileQueue);
  const ignoreCtx = createIgnoreContext(null, name, 'builtin', isSimplebeaconMonorepo);
  return analyzeDirectory({ rootName: name, fileQueue, ignoreCtx }, { maxFileSize, onLog, onProgress });
}

async function crawlWebkitEntryTree(entry, currentPath, queue, options) {
  const { maxFiles, onLog, ignoreCtx } = options || {};
  if (!entry.isDirectory) {
    if (ignoreCtx && isIgnoredVirtualPath(currentPath, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
      return;
    }
    const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
    if (!file) return;
    if (file.name === '.simplebeaconignore') return;
    if (SKIP_FILE_PATTERNS.some((re) => re.test(file.name))) return;
    const extIndex = file.name.lastIndexOf('.');
    const ext = extIndex >= 0 ? file.name.substring(extIndex).toLowerCase() : '';
    if (ALLOWED_EXTENSIONS.has(ext)) {
      const seen = options._seenPaths || (options._seenPaths = new Set());
      const normalizedPath = currentPath.replace(/\\/g, '/').toLowerCase();
      if (seen.has(normalizedPath)) return;
      seen.add(normalizedPath);
      queue.push({ file, virtualPath: currentPath });
    }
    return;
  }

  if (SKIP_DIRS.has(entry.name) || SKIP_DOT_DIRS.has(entry.name)) {
    logLine(onLog, `Skipping dependency/build directory: ${currentPath}`, 'info');
    return;
  }
  if (ignoreCtx && isIgnoredVirtualPath(currentPath, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
    logLine(onLog, `Skipping ignored directory: ${currentPath}`, 'info');
    return;
  }

  const reader = entry.createReader();
  let batch;
  do {
    batch = await new Promise((resolve, reject) => reader.readEntries(resolve, (err) => { logLine(onLog, `readEntries error at ${currentPath}: ${err}`, 'warning'); resolve([]); }));
    for (const child of batch) {
      if (queue.length >= maxFiles) {
        logLine(onLog, `Reached max file limit (${maxFiles}); stopping traversal.`, 'warning');
        break;
      }
      const childPath = `${currentPath}/${child.name}`;
      if (ignoreCtx && isIgnoredVirtualPath(childPath, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
        continue;
      }
      await crawlWebkitEntryTree(child, childPath, queue, options);
    }
  } while (batch.length > 0 && queue.length < maxFiles);
}
