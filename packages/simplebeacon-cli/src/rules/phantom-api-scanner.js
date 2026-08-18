/**
 * Phantom API call scanner (SB-AGENT-002).
 * Detects method calls on real libraries that don't actually exist —
 * the #2 failure pattern in AI-generated code.
 *
 * AI agents memorize API shapes from training data but frequently
 * hallucinate method names that look plausible but don't exist:
 *   - fs.readFilePromise()        → should be fs.promises.readFile()
 *   - JSON.tryParse()             → JSON.parse() with try/catch
 *   - Array.prototype.first()     → arr[0] or arr.find(Boolean)
 *   - Object.deepClone()          → structuredClone() or JSON parse/stringify
 *   - pd.DataFrame.to_jsonl()     → pd.DataFrame.to_json()
 *
 * Source: CodeHalu (AAAI 2025), ghostcheck, ghostcall, bleurs
 */

const fs = require('fs');
const path = require('path');

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py'
]);

const MAX_SCAN_BYTES = 512000;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
  '.simplebeacon', 'fixtures', 'docs', 'coming-soon', 'reports',
  'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures',
  'ai-platform/web/simplebeacon-dashboard/js-es2018',
  'simplebeacon-vscode-merged/dashboard-web/js-es2018'
]);

const SKIP_FILES = /\.(test|spec)\.(js|cjs|mjs|ts|tsx|py)$/i;

function isScannable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCANNABLE_EXTENSIONS.has(ext)) return false;
  if (SKIP_FILES.test(path.basename(filePath))) return false;
  return true;
}

function isExcludedPath(filePath, rootDir) {
  const rel = filePath.replace(rootDir, '').replace(/^[/\\]+/, '');
  const dirs = rel.split(/[/\\]/);
  if (dirs.some((dir) => SKIP_DIRS.has(dir))) return true;
  if (/ai-platform[/\\]web[/\\]simplebeacon-dashboard[/\\]js\b/.test(rel)) return true;
  if (/simplebeacon-vscode-merged[/\\]dashboard-web[/\\]js\b/.test(rel)) return true;
  return false;
}

/**
 * JavaScript/TypeScript phantom API catalog.
 * Each entry: { object, method, severity, suggestion, category }
 */
const JS_PHANTOM_APIS = [
  // Node.js fs
  { object: 'fs', method: 'readFilePromise', suggestion: 'fs.promises.readFile()', severity: 'high', category: 'node-fs' },
  { object: 'fs', method: 'writeFilePromise', suggestion: 'fs.promises.writeFile()', severity: 'high', category: 'node-fs' },
  { object: 'fs', method: 'existsSyncPromise', suggestion: 'fs.promises.access()', severity: 'medium', category: 'node-fs' },
  { object: 'fs', method: 'mkdirPromise', suggestion: 'fs.promises.mkdir()', severity: 'high', category: 'node-fs' },
  { object: 'fs', method: 'statPromise', suggestion: 'fs.promises.stat()', severity: 'medium', category: 'node-fs' },
  { object: 'fs', method: 'readdirPromise', suggestion: 'fs.promises.readdir()', severity: 'medium', category: 'node-fs' },
  { object: 'fs', method: 'unlinkPromise', suggestion: 'fs.promises.unlink()', severity: 'medium', category: 'node-fs' },
  { object: 'fs', method: 'copyFilePromise', suggestion: 'fs.promises.copyFile()', severity: 'medium', category: 'node-fs' },
  { object: 'fs', method: 'renamePromise', suggestion: 'fs.promises.rename()', severity: 'medium', category: 'node-fs' },

  // JSON
  { object: 'JSON', method: 'tryParse', suggestion: 'JSON.parse() wrapped in try/catch', severity: 'high', category: 'json' },
  { object: 'JSON', method: 'parseSafe', suggestion: 'JSON.parse() wrapped in try/catch', severity: 'high', category: 'json' },
  { object: 'JSON', method: 'stringifySafe', suggestion: 'JSON.stringify() with a replacer function', severity: 'medium', category: 'json' },
  { object: 'JSON', method: 'deepClone', suggestion: 'structuredClone() or JSON.parse(JSON.stringify())', severity: 'medium', category: 'json' },

  // Array
  { object: 'Array', method: 'first', suggestion: 'arr[0] or arr.at(0)', severity: 'medium', category: 'array' },
  { object: 'Array', method: 'last', suggestion: 'arr[arr.length-1] or arr.at(-1)', severity: 'medium', category: 'array' },
  { object: 'Array', method: 'compact', suggestion: 'arr.filter(Boolean)', severity: 'medium', category: 'array' },
  { object: 'Array', method: 'flatten', suggestion: 'arr.flat() or arr.flat(Infinity)', severity: 'medium', category: 'array' },
  { object: 'Array', method: 'unique', suggestion: '[...new Set(arr)]', severity: 'low', category: 'array' },
  { object: 'Array', method: 'remove', suggestion: 'arr.filter(x => x !== val)', severity: 'low', category: 'array' },
  { object: 'Array', method: 'sample', suggestion: 'arr[Math.floor(Math.random() * arr.length)]', severity: 'low', category: 'array' },
  { object: 'Array', method: 'groupBy', suggestion: 'Object.groupBy(arr, fn) (ES2024) or a reduce loop', severity: 'low', category: 'array' },

  // Object
  { object: 'Object', method: 'deepClone', suggestion: 'structuredClone() or JSON.parse(JSON.stringify())', severity: 'medium', category: 'object' },
  { object: 'Object', method: 'deepMerge', suggestion: 'structuredClone + spread, or a library like lodash.merge', severity: 'medium', category: 'object' },
  { object: 'Object', method: 'deepEqual', suggestion: 'JSON.stringify(a) === JSON.stringify(b) or a library', severity: 'low', category: 'object' },
  { object: 'Object', method: 'fromEntries', suggestion: 'Object.fromEntries() exists — check spelling', severity: 'low', category: 'object' },

  // String
  { object: 'String', method: 'reverse', suggestion: 'str.split("").reverse().join("")', severity: 'low', category: 'string' },
  { object: 'String', method: 'capitalize', suggestion: 'str.charAt(0).toUpperCase() + str.slice(1)', severity: 'low', category: 'string' },
  { object: 'String', method: 'titleCase', suggestion: 'str.replace(/\\w\\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())', severity: 'low', category: 'string' },
  { object: 'String', method: 'toSlug', suggestion: 'str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")', severity: 'low', category: 'string' },

  // Promise
  { object: 'Promise', method: 'retry', suggestion: 'Use a retry library or a for-loop with try/catch', severity: 'medium', category: 'promise' },
  { object: 'Promise', method: 'timeout', suggestion: 'Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))])', severity: 'medium', category: 'promise' },
  { object: 'Promise', method: 'allSettledSync', suggestion: 'Promise.allSettled() exists — check spelling', severity: 'low', category: 'promise' },

  // console
  { object: 'console', method: 'success', suggestion: 'console.log() or console.info() with a prefix', severity: 'low', category: 'console' },
  { object: 'console', method: 'debug', suggestion: 'console.debug() exists but may be filtered — check if you meant console.log()', severity: 'low', category: 'console' },

  // Math
  { object: 'Math', method: 'clamp', suggestion: 'Math.max(min, Math.min(val, max))', severity: 'low', category: 'math' },
  { object: 'Math', method: 'lerp', suggestion: 'a + (b - a) * t', severity: 'low', category: 'math' },
  { object: 'Math', method: 'randomInt', suggestion: 'Math.floor(Math.random() * (max - min + 1)) + min', severity: 'low', category: 'math' },
  { object: 'Math', method: 'sum', suggestion: 'arr.reduce((a, b) => a + b, 0)', severity: 'low', category: 'math' },
  { object: 'Math', method: 'average', suggestion: 'arr.reduce((a, b) => a + b, 0) / arr.length', severity: 'low', category: 'math' },

  // fetch / Response
  { object: 'Response', method: 'jsonSafe', suggestion: 'res.json() wrapped in try/catch', severity: 'medium', category: 'fetch' },
  { object: 'fetch', method: 'retry', suggestion: 'Use a retry wrapper or library', severity: 'medium', category: 'fetch' },

  // crypto
  { object: 'crypto', method: 'hash', suggestion: 'crypto.createHash("sha256").update(data).digest("hex")', severity: 'medium', category: 'crypto' },
  { object: 'crypto', method: 'randomString', suggestion: 'crypto.randomBytes(n).toString("hex")', severity: 'medium', category: 'crypto' },
  { object: 'crypto', method: 'uuid', suggestion: 'crypto.randomUUID()', severity: 'low', category: 'crypto' },

  // lodash (common hallucinations)
  { object: '_', method: 'deepFreeze', suggestion: 'Object.freeze with recursion, or a library', severity: 'low', category: 'lodash' },
  { object: '_', method: 'cloneArray', suggestion: 'arr.slice() or [...arr]', severity: 'low', category: 'lodash' },

  // React
  { object: 'React', method: 'useMemoCallback', suggestion: 'useCallback and useMemo are separate hooks', severity: 'medium', category: 'react' },
  { object: 'React', method: 'useDebounce', suggestion: 'Use a custom hook or library like use-debounce', severity: 'low', category: 'react' },
  { object: 'React', method: 'useThrottle', suggestion: 'Use a custom hook or library like use-throttle', severity: 'low', category: 'react' },
  { object: 'React', method: 'usePrevious', suggestion: 'useRef with useEffect to track previous value', severity: 'low', category: 'react' },

  // Express
  { object: 'res', method: 'sendError', suggestion: 'res.status(code).json({ error: msg })', severity: 'medium', category: 'express' },
  { object: 'res', method: 'sendSuccess', suggestion: 'res.json({ data: ... })', severity: 'low', category: 'express' },
];

/**
 * Python phantom API catalog.
 */
const PY_PHANTOM_APIS = [
  // pandas
  { object: 'pd', method: 'DataFrame.to_jsonl', suggestion: 'df.to_json(orient="records", lines=True)', severity: 'high', category: 'pandas' },
  { object: 'pd', method: 'read_csv_async', suggestion: 'Use asyncio.to_thread(pd.read_csv, path) or a library', severity: 'medium', category: 'pandas' },
  { object: 'pd', method: 'DataFrame.flatten', suggestion: 'df.reset_index() or pd.json_normalize()', severity: 'medium', category: 'pandas' },

  // requests
  { object: 'requests', method: 'get_async', suggestion: 'Use httpx or aiohttp for async HTTP', severity: 'high', category: 'requests' },
  { object: 'requests', method: 'post_async', suggestion: 'Use httpx or aiohttp for async HTTP', severity: 'high', category: 'requests' },
  { object: 'requests', method: 'retry', suggestion: 'Use requests.Session with urllib3 Retry adapter', severity: 'medium', category: 'requests' },

  // json
  { object: 'json', method: 'loads_safe', suggestion: 'json.loads() wrapped in try/except json.JSONDecodeError', severity: 'high', category: 'json' },
  { object: 'json', method: 'dumps_safe', suggestion: 'json.dumps() with default=str parameter', severity: 'medium', category: 'json' },

  // os
  { object: 'os', method: 'path_exists', suggestion: 'os.path.exists()', severity: 'medium', category: 'os' },
  { object: 'os', method: 'mkdir_p', suggestion: 'os.makedirs(path, exist_ok=True)', severity: 'medium', category: 'os' },
  { object: 'os', method: 'listdir_recursive', suggestion: 'os.walk() or pathlib.Path.rglob()', severity: 'low', category: 'os' },

  // pathlib
  { object: 'Path', method: 'read_text_async', suggestion: 'Use aiofiles or asyncio.to_thread(path.read_text)', severity: 'medium', category: 'pathlib' },
  { object: 'Path', method: 'write_text_async', suggestion: 'Use aiofiles or asyncio.to_thread(path.write_text)', severity: 'medium', category: 'pathlib' },

  // str
  { object: 'str', method: 'reverse', suggestion: 's[::-1]', severity: 'low', category: 'str' },
  { object: 'str', method: 'title_case', suggestion: 's.title()', severity: 'low', category: 'str' },
  { object: 'str', method: 'to_slug', suggestion: 're.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")', severity: 'low', category: 'str' },

  // list
  { object: 'list', method: 'flatten', suggestion: '[item for sublist in l for item in sublist]', severity: 'low', category: 'list' },
  { object: 'list', method: 'unique', suggestion: 'list(set(l)) or list(dict.fromkeys(l))', severity: 'low', category: 'list' },
  { object: 'list', method: 'chunk', suggestion: '[l[i:i+n] for i in range(0, len(l), n)]', severity: 'low', category: 'list' },

  // dict
  { object: 'dict', method: 'deep_merge', suggestion: 'Use a library or recursive update function', severity: 'low', category: 'dict' },

  // asyncio
  { object: 'asyncio', method: 'run_sync', suggestion: 'asyncio.run() or loop.run_until_complete()', severity: 'medium', category: 'asyncio' },
  { object: 'asyncio', method: 'gather_with_limit', suggestion: 'asyncio.Semaphore with asyncio.gather()', severity: 'low', category: 'asyncio' },

  // openai
  { object: 'openai', method: 'ChatCompletion_stream', suggestion: 'client.chat.completions.create(stream=True)', severity: 'high', category: 'openai' },
];

function buildRegexForApi(api, isPython) {
  if (isPython) {
    // Python: obj.method(  or  obj\.method(
    return new RegExp(`\\b${api.object.replace(/\./g, '\\.')}\\.${api.method}\\s*\\(`, 'g');
  }
  // JS/TS: obj.method( or obj?.method(
  return new RegExp(`\\b${api.object.replace(/\./g, '\\.')}\\??\\.${api.method}\\s*\\(`, 'g');
}

function scanContent(content, filePath) {
  const findings = [];
  const ext = path.extname(filePath).toLowerCase();
  const isPython = ext === '.py';
  const apis = isPython ? PY_PHANTOM_APIS : JS_PHANTOM_APIS;

  for (const api of apis) {
    const regex = buildRegexForApi(api, isPython);
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      const matchedText = match[0].trim();
      findings.push({
        ruleId: 'phantom-api-call',
        severity: api.severity,
        category: 'agent-failure',
        type: 'PhantomApiCall',
        description: `${api.object}.${api.method}() does not exist — AI hallucinated this API`,
        recommendation: `Use ${api.suggestion} instead`,
        filePath,
        line,
        snippet: matchedText,
        pattern: `phantom-api:${api.category}:${api.object}.${api.method}`
      });
    }
  }

  return findings;
}

function scanPhantomApiCalls(rootDir, opts) {
  const options = opts || {};
  const sourcePaths = options.sourcePaths || ['src', 'lib', 'packages', 'ai-platform/server', 'ai-platform/src'];
  const findings = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && isScannable(fullPath)) {
        if (isExcludedPath(fullPath, rootDir)) continue;
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_SCAN_BYTES) continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          const fileFindings = scanContent(content, fullPath);
          findings.push(...fileFindings);
        } catch (e) {
          // Skip unreadable files
        }
      }
    }
  }

  for (const src of sourcePaths) {
    const srcPath = path.resolve(rootDir, src);
    if (fs.existsSync(srcPath)) {
      walk(srcPath);
    }
  }

  return {
    ruleId: 'phantom-api-call',
    findings
  };
}

module.exports = {
  scanPhantomApiCalls,
  scanContent,
  JS_PHANTOM_APIS,
  PY_PHANTOM_APIS
};
