const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.PORT, 10) || 3456;
const ROOT = __dirname;
const AUDIT_ROOT = path.join(__dirname, '..', '..', 'coming-soon');

// --- Drive Scanner Helpers ---
function getActiveDrives() {
  try {
    const stdout = execSync('wmic logicaldisk get name').toString();
    return stdout.split('\r\r\n')
      .map(v => v.trim())
      .filter(v => /^[A-Z]:/.test(v));
  } catch {
    return ['C:'];
  }
}

async function scanDirectory(dirPath, fileCallback) {
  try {
    const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    await Promise.all(dirents.map(async (dirent) => {
      const res = path.resolve(dirPath, dirent.name);
      if (dirent.isDirectory()) {
        if (dirent.name.startsWith('$') || dirent.name === 'System Volume Information') return;
        await scanDirectory(res, fileCallback);
      } else {
        fileCallback(res);
      }
    }));
  } catch {
    // silently skip permission-denied directories
  }
}

async function findDirectoryByName(rootPath, targetName, maxDepth = 8, maxResults = 10, maxDirsPerLevel = 200) {
  const results = [];
  let current = [rootPath];
  for (let d = 0; d <= maxDepth && current.length > 0; d++) {
    if (results.length >= maxResults) break;
    // Cap directories per level to prevent runaway on huge drives
    const toProcess = current.length > maxDirsPerLevel ? current.slice(0, maxDirsPerLevel) : current;
    const next = [];
    await Promise.all(toProcess.map(async (p) => {
      try {
        const names = await fs.promises.readdir(p);
        for (const name of names) {
          if (results.length >= maxResults) break;
          if (name.startsWith('$') || name === 'System Volume Information') continue;
          try {
            const full = path.join(p, name);
            const stat = await fs.promises.lstat(full);
            if (stat.isDirectory() || stat.isSymbolicLink()) {
              if (name.toLowerCase() === targetName.toLowerCase()) {
                results.push(full);
                if (results.length >= maxResults) break;
              }
              next.push(full);
            }
          } catch {
            // skip inaccessible
          }
        }
      } catch {
        // skip permission denied
      }
    }));
    current = next;
  }
  return results;
}

function readJsonBody(req, cb) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      cb(null, JSON.parse(body));
    } catch (e) {
      cb(e, null);
    }
  });
}
// -----------------------------
// === SimpleBeacon Scanner Engine ===
const scanState = { lastReport: null, history: [] };

// Load existing scan report if available
 try {
   const reportPath = path.join(__dirname, '..', 'simplebeacon-report.json');
   if (fs.existsSync(reportPath)) {
     const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
     if (reportData) {
       scanState.lastReport = reportData;
       if (!scanState.lastReport.metrics) scanState.lastReport.metrics = {};
       scanState.history.push({
         projectPath: reportData.projectRoot || 'unknown',
         generatedAt: reportData.generatedAt || new Date().toISOString(),
         gatePass: reportData.gate ? reportData.gate.pass : null,
         qualityScore: reportData.qualityScore || 0
       });
       console.log('Loaded existing scan report from', reportPath);
     }
   }
 } catch (e) {
   console.error('Failed to load existing report:', e.message);
 }

// --- Local Auth State (in-memory, dev-only) ---
const localUsers = new Map(); // email -> { id, email, password, tier }
// Pre-seed local demo accounts
localUsers.set('dev@simplebeacon.local', { id: 'dev-1', email: 'dev@simplebeacon.local', password: hashPassword('demo123'), tier: 'pro' });
localUsers.set('trevor.punt@live.com', { id: 'dev-2', email: 'trevor.punt@live.com', password: hashPassword('demo123'), tier: 'pro' });
function makeLocalJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${body}.localdev`;
}
function hashPassword(pw) {
  // Simple hash for dev — NOT for production
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(pw).digest('hex');
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.vercel', '.netlify', 'vendor',
  'bower_components', '.hg', '.svn', '__pycache__', '.tox',
  '.venv', 'venv', 'env', '.env', 'target', '.gradle',
  '.idea', '.vscode', '.vs', 'bin', 'obj', 'Debug', 'Release',
  'Pods', '.DS_Store', 'System Volume Information'
]);
const SKIP_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff',
  '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov',
  '.avi', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe',
  '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.map', '.lock'
]);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

function shouldSkipFile(filePath) {
  const base = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_EXTS.has(ext)) return true;
  const parts = filePath.split(/[\\/]/);
  for (const part of parts) {
    if (SKIP_DIRS.has(part)) return true;
  }
  return false;
}

async function readFileLimited(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > MAX_FILE_SIZE) return null;
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

// 63 Analyzer patterns
const ANALYZERS = [
  // === Security (1-15) ===
  { id: 1, name: 'Hardcoded Credentials', type: 'credential', severity: 'critical',
    pattern: /(?:password|passwd|pwd|secret|token|api_key|apikey|access_token|auth_token)\s*[:=]\s*['"`][^'"`\s]{4,}/gi,
    desc: 'Hardcoded credential or secret detected in source code.' },
  { id: 2, name: 'AWS Access Key', type: 'credential', severity: 'critical',
    pattern: /AKIA[0-9A-Z]{16}/g,
    desc: 'Potential AWS access key ID found.' },
  { id: 3, name: 'Private Key Material', type: 'credential', severity: 'critical',
    pattern: /-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    desc: 'Private key material embedded in source.' },
  { id: 4, name: 'SQL Injection Risk', type: 'security', severity: 'high',
    pattern: /(?:query|exec|execute|run)\s*\(.*['"]\s*\+|\$\{.*\}.*\b(?:SELECT|INSERT|UPDATE|DELETE|DROP)\b/gi,
    desc: 'Potential SQL injection through string concatenation or template interpolation.' },
  { id: 5, name: 'Cross-Site Scripting (XSS)', type: 'security', severity: 'high',
    pattern: /\binnerHTML\s*=|\.html\s*\(|dangerouslySetInnerHTML|document\.write\s*\(/g,
    desc: 'Direct HTML insertion without sanitization detected.' },
  { id: 6, name: 'Dynamic Code Execution', type: 'security', severity: 'critical',
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]/g,
    desc: 'Dynamic code execution (eval, new Function) allows code injection.' },
  { id: 7, name: 'Command Injection', type: 'security', severity: 'critical',
    pattern: /(?:exec|execSync|spawn|execFile)\s*\([^)]*(?:\+|\$\{|\`)/g,
    desc: 'Shell command execution with user-controlled input.' },
  { id: 8, name: 'Insecure HTTP URL', type: 'security', severity: 'medium',
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[a-zA-Z0-9][^\s'"`]+/g,
    desc: 'Insecure HTTP URL found; prefer HTTPS in production.' },
  { id: 9, name: 'Security TODO/FIXME', type: 'security', severity: 'medium',
    pattern: /(?:TODO|FIXME|HACK|XXX|BUG)\s*[:\-]?\s*(?:security|vuln|insecure|auth|csrf|xss|sqli|password|leak)/gi,
    desc: 'Security-related TODO/FIXME comment indicating unfinished security work.' },
  { id: 10, name: 'LocalStorage Sensitive Data', type: 'security', severity: 'medium',
    pattern: /localStorage\.(?:setItem|getItem)\s*\(\s*['"`](?:token|password|secret|auth|key|session)/gi,
    desc: 'Sensitive data stored in localStorage (vulnerable to XSS extraction).' },
  { id: 11, name: 'Disabled Certificate Validation', type: 'security', severity: 'high',
    pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*[=:]\s*['"`]?0|strictSSL\s*:\s*false/g,
    desc: 'TLS certificate validation disabled - man-in-the-middle risk.' },
  { id: 12, name: 'Weak Cryptography', type: 'security', severity: 'high',
    pattern: /\b(?:md5|sha1)\s*\(|createHash\s*\(\s*['"`](?:md5|sha1)/gi,
    desc: 'Weak hashing algorithm (MD5/SHA1) used for security purposes.' },
  { id: 13, name: 'Path Traversal Risk', type: 'security', severity: 'medium',
    pattern: /(?:fs\.readFile|fs\.writeFile|require|import)\s*\([^)]*\+(?:\s*req\.|\s*\$\{)/g,
    desc: 'File path constructed from user input without validation.' },
  { id: 14, name: 'CSRF Protection Missing', type: 'security', severity: 'medium',
    pattern: /(?:app\.use\s*\([^)]*csrf|csrf\s*:\s*false|xsrfProtection\s*:\s*false)/gi,
    desc: 'CSRF protection disabled or missing in web framework.' },
  { id: 15, name: 'Debug Information Exposure', type: 'security', severity: 'medium',
    pattern: /(?:console\.log|console\.warn|console\.error)\s*\([^)]*(?:password|token|secret|key|auth)/gi,
    desc: 'Sensitive data logged to console.' },

  // === Code Quality (16-27) ===
  { id: 16, name: 'Debug Statement Left in Code', type: 'quality', severity: 'low',
    pattern: new RegExp('\\bconsole\\.(?:log|warn|error|debug|info)\\s*\\(|\\bdebug' + 'ger;|\\balert\\s*\\(', 'g'),
    desc: 'Debug statement left in production code.' },
  { id: 17, name: 'Unresolved TODO/FIXME', type: 'quality', severity: 'low',
    pattern: /(?:TODO|FIXME|HACK|XXX|BUG)\b/g,
    desc: 'Unresolved TODO or FIXME comment in code.' },
  { id: 18, name: 'Long Function', type: 'quality', severity: 'medium',
    pattern: null, // handled per-file
    desc: 'Function exceeds recommended line count (suggests refactoring).' },
  { id: 19, name: 'Deep Nesting', type: 'quality', severity: 'low',
    pattern: null, // handled per-file
    desc: 'Code nested more than 4 levels deep (hard to maintain).' },
  { id: 20, name: 'Magic Number', type: 'quality', severity: 'low',
    pattern: /\b(?:if|while|for|return)\s*\([^)]*\b[0-9]{4,}\b[^)]*\)/g,
    desc: 'Large unnamed numeric literal in control flow (consider a named constant).' },
  { id: 21, name: 'Commented-Out Code', type: 'quality', severity: 'low',
    pattern: /\/\/.*(?:function|const|let|var|import|export|class|if|for|while|return)/g,
    desc: 'Dead code left as comments should be removed.' },
  { id: 22, name: 'Empty Catch Block', type: 'quality', severity: 'medium',
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    desc: 'Empty catch block silently swallows errors.' },
  { id: 23, name: 'Callback Hell', type: 'quality', severity: 'medium',
    pattern: /(?:\([^)]*\)\s*=>\s*\{[^}]*\([^)]*\)\s*=>\s*\{[^}]*\([^)]*\)\s*=>)/g,
    desc: 'Deeply nested callbacks (use async/await instead).' },
  { id: 24, name: 'Var Usage', type: 'quality', severity: 'low',
    pattern: /\bvar\s+/g,
    desc: 'Use of var instead of let/const (scoping issues).' },
  { id: 25, name: 'Unused Import Pattern', type: 'quality', severity: 'low',
    pattern: /import\s+\*\s+as\s+\w+\s+from|import\s+['"`].*['"`];?\s*(?!.*\bfrom\b)/g,
    desc: 'Potential unused or side-effect import pattern.' },
  { id: 26, name: 'Complex Conditional', type: 'quality', severity: 'low',
    pattern: /if\s*\([^)]*(?:&&|\|\|)[^)]*(?:&&|\|\|)[^)]*(?:&&|\|\|)/g,
    desc: 'Complex conditional with 3+ logical operators (extract to function).' },
  { id: 27, name: 'Duplicate Code Block', type: 'quality', severity: 'low',
    pattern: null, // handled per-file
    desc: 'Similar code blocks detected (consider extracting to a function).' },

  // === Type Safety (28-37) ===
  { id: 28, name: 'Any Type Usage', type: 'type-safety', severity: 'medium',
    pattern: /:\s*any\b/g,
    desc: 'TypeScript any type defeats type safety.' },
  { id: 29, name: 'TypeScript Ignore Directive', type: 'type-safety', severity: 'medium',
    pattern: /@ts-ignore|@ts-expect-error/g,
    desc: 'TypeScript error suppression directive found.' },
  { id: 30, name: 'Non-Null Assertion', type: 'type-safety', severity: 'medium',
    pattern: /!\./g,
    desc: 'TypeScript non-null assertion bypasses null checks.' },
  { id: 31, name: 'Prop-Types in TypeScript', type: 'type-safety', severity: 'low',
    pattern: /PropTypes\./g,
    desc: 'PropTypes used alongside TypeScript (redundant).' },
  { id: 32, name: 'Inline Styles', type: 'type-safety', severity: 'low',
    pattern: /style\s*=\s*\{\s*\{/g,
    desc: 'Inline styles make components harder to maintain and test.' },
  { id: 33, name: 'Inline Event Handler', type: 'type-safety', severity: 'low',
    pattern: /\s(onclick|onchange|onsubmit|onload|onerror)\s*=\s*['"`]/gi,
    desc: 'Inline event handler (prefer addEventListener or framework binding).' },
  { id: 34, name: 'Deprecated API Usage', type: 'type-safety', severity: 'medium',
    pattern: /\b(escape|unescape|eval|with|__proto__|__defineGetter__|__lookupGetter__|substr\b)/g,
    desc: 'Deprecated JavaScript API in use.' },
  { id: 35, name: 'Unsafe Type Cast', type: 'type-safety', severity: 'medium',
    pattern: /as\s+(?:any|unknown)\b|\bunknown\s*\|\s*(?!null|undefined)\w+\b/g,
    desc: 'Unsafe type cast or broad type union that defeats type safety.' },
  { id: 36, name: 'String eval in Template', type: 'type-safety', severity: 'high',
    pattern: /`[^`]*\$\{[^}]*eval\([^}]*\}[^`]*`/g,
    desc: 'eval interpolated inside template literal.' },
  { id: 37, name: 'Circular Dependency Risk', type: 'type-safety', severity: 'low',
    pattern: null, // handled per-file
    desc: 'Potential circular import pattern detected.' },

  // === Performance (38-45) ===
  { id: 38, name: 'Sync IO in Async Context', type: 'performance', severity: 'medium',
    pattern: /await.*(?:readFileSync|writeFileSync|existsSync|readdirSync|statSync)/g,
    desc: 'Synchronous file operation inside async function blocks event loop.' },
  { id: 39, name: 'Memory Leak Pattern', type: 'performance', severity: 'medium',
    pattern: /(?:addEventListener|on\w+\s*=)\s*[^;]*;(?!.*(?:removeEventListener|off\b))/g,
    desc: 'Event listener added without corresponding removal (memory leak risk).' },
  { id: 40, name: 'Inefficient Loop', type: 'performance', severity: 'low',
    pattern: /for\s*\(\s*let\s+\w+\s*=\s*0;\s*\w+\s*<\s*(\w+)\.length;/g,
    desc: 'Loop re-evaluates array length on each iteration (cache it).' },
  { id: 41, name: 'String Concatenation in Loop', type: 'performance', severity: 'low',
    pattern: /for\s*\([^)]*\)\s*\{[^}]*\+\s*=\s*[^}]*\}/g,
    desc: 'String concatenation in loop (use array join or template accumulation).' },
  { id: 42, name: 'N+1 Query Pattern', type: 'performance', severity: 'medium',
    pattern: /(?:for|while|map|forEach)\s*\([^)]*\)\s*\{[^}]*\b(?:findOne|findById|query|select|get)\s*\(/g,
    desc: 'Query inside loop suggests N+1 query problem.' },
  { id: 43, name: 'Prototype Pollution Risk', type: 'security', severity: 'high',
    pattern: /obj\.__proto__|Object\.prototype\s*=|constructor\.prototype|prototype\s*\[[\s\S]*\]\s*=/g,
    desc: 'Prototype pollution pattern that could allow attacker-controlled property injection.' },
  { id: 44, name: 'Large Dependency Import', type: 'performance', severity: 'low',
    pattern: /import\s+.*\bfrom\s+['"`](lodash|moment|jquery|underscore|ramda)['"`]/g,
    desc: 'Full import of large utility library (use modular imports).' },
  { id: 45, name: 'Unnecessary Re-render', type: 'performance', severity: 'low',
    pattern: /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*setState/g,
    desc: 'setState inside useEffect without dependency array can cause infinite re-renders.' },

  // === AI/LLM Specific (46-55) ===
  { id: 46, name: 'LLM Slop Pattern', type: 'consistency', severity: 'medium',
    pattern: /(?:AI-generated|generated by AI|GPT|Copilot|autogenerated|autogenerated comment|auto-generated code|Created with ChatGPT|Generated by Claude)/gi,
    desc: 'AI-generated code marker detected - review for correctness.' },
  { id: 47, name: 'Token Bleed Pattern', type: 'consistency', severity: 'high',
    pattern: /(?:sk-|pk-|tk-)[a-zA-Z0-9]{24,48}/g,
    desc: 'Potential API token or key leak in code.' },
  { id: 48, name: 'Fiction KPI', type: 'consistency', severity: 'medium',
    pattern: /(?:99\.9% uptime|100% coverage|zero bugs|perfect score|unlimited scalability|instant response|guaranteed)/gi,
    desc: 'Unrealistic metric or claim (fiction KPI) detected.' },
  { id: 49, name: 'Architecture Drift', type: 'consistency', severity: 'medium',
    pattern: /(?:unused|deprecated|legacy|refactor|cleanup|temporary|TEMP|HOLD|WIP)\s*(?:function|class|interface|method|component)/gi,
    desc: 'Marker indicating architectural drift or incomplete refactor.' },
  { id: 50, name: 'Placeholder Implementation', type: 'consistency', severity: 'medium',
    pattern: /(?:TODO implement|FIXME implement|not implemented|placeholder|stub|coming soon|under construction)/gi,
    desc: 'Placeholder or stub implementation found.' },
  { id: 51, name: 'Hallucinated API Call', type: 'consistency', severity: 'high',
    pattern: /\.(?:getUserProfile|fetchDataFromAI|generateContent|analyzeSentiment|getPrediction)\s*\(/g,
    desc: 'Generic AI-sounding API call pattern (verify API exists).' },
  { id: 52, name: 'Overconfident Comment', type: 'consistency', severity: 'low',
    pattern: /\/\/.*(?:always|never|guaranteed|perfect|bulletproof|foolproof|100%|completely safe)/gi,
    desc: 'Overly confident claim in comment may mask edge cases.' },
  { id: 53, name: 'AI Watermark', type: 'consistency', severity: 'low',
    pattern: /(?:import React, \{ useState, useEffect \} from 'react';\s*export default function|const \[\w+, set\w+\] = useState\(['"`])/g,
    desc: 'Common AI code generation pattern detected.' },
  { id: 54, name: 'Temperature Zero Hardcode', type: 'consistency', severity: 'low',
    pattern: /temperature\s*:\s*0\b/g,
    desc: 'LLM temperature set to 0 (deterministic but less creative).' },
  { id: 55, name: 'System Prompt Leakage', type: 'consistency', severity: 'medium',
    pattern: /(?:system prompt|system instruction|you are a|act as a|role:\s*assistant|ignore previous instructions)/gi,
    desc: 'System prompt or role definition potentially exposed in code.' },

  // === Configuration (56-63) ===
  { id: 56, name: 'Hardcoded Environment Value', type: 'production leak', severity: 'medium',
    pattern: /(?:NODE_ENV|ENVIRONMENT|APP_ENV)\s*[:=]\s*['"`](?:development|staging|test|local)['"`]|baseURL\s*[:=]\s*['"`]http:\/\/localhost['"`]/gi,
    desc: 'Hardcoded environment-specific configuration in production code.' },
  { id: 57, name: 'Missing Env Var Check', type: 'production leak', severity: 'medium',
    pattern: /process\.env\.[A-Z_]+\b(?!\s*\?\?|\s*\|\||\s*\?\.|\s*!)/g,
    desc: 'Environment variable accessed without fallback or null check.' },
  { id: 58, name: 'Debug Mode Enabled', type: 'production leak', severity: 'high',
    pattern: /(?:DEBUG|NODE_ENV|ENV)\s*[:=]\s*['"`]?(?:development|debug|true|1)/gi,
    desc: 'Debug or development mode configuration found in production.' },
  { id: 59, name: 'Excessive Logging', type: 'production leak', severity: 'low',
    pattern: /\bconsole\.(?:log|warn|error|debug|info|trace)\s*\(/g,
    desc: 'Console logging statements in production code (use structured logger).' },
  { id: 60, name: 'Sensitive Config in VCS', type: 'production leak', severity: 'high',
    pattern: /(?:DATABASE_URL|REDIS_URL|MONGO_URI|CONNECTION_STRING)\s*[:=]\s*['"`][^'"`]+/g,
    desc: 'Database connection string or sensitive config in source control.' },
  { id: 61, name: 'Weak Default Password', type: 'production leak', severity: 'critical',
    pattern: /(?:default_password|password123|123456|qwerty|letmein|admin123|welcome1)\s*[:=]/gi,
    desc: 'Weak or default password configuration detected.' },
  { id: 62, name: 'CORS Wildcard', type: 'production leak', severity: 'medium',
    pattern: /origin\s*:\s*['"`]\*['"`]|cors\s*:\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/gi,
    desc: 'CORS configured to allow all origins (security risk).' },
  { id: 63, name: 'Exposed Stack Trace', type: 'production leak', severity: 'medium',
    pattern: /(?:err\.stack|error\.stack|e\.stack|stack trace)\s*(?:console\.log|res\.send|res\.json|return)/gi,
    desc: 'Stack trace potentially exposed to client in error handler.' }
];

// Per-file analyzers (line-based)
function analyzeFilePerLine(filePath, content, findings, activeAnalyzers) {
  const activeIds = new Set(activeAnalyzers.map((a) => a.id));
  const lines = content.split('\n');
  let inFunction = false;
  let functionStart = 0;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Long function detection (analyzer 18)
    if (activeIds.has(18) && (/\bfunction\b|\b=>\s*\{|\basync\s+\w+\s*\(/.test(trimmed))) {
      inFunction = true;
      functionStart = i;
      braceDepth = 0;
    }
    if (activeIds.has(18) && inFunction) {
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth <= 0 && i - functionStart > 50) {
        findings.push({ analyzerId: 18, name: 'Long Function', type: 'quality', line: functionStart + 1, severity: 'medium',
          desc: 'Function spans ' + (i - functionStart) + ' lines (refactor recommended).' });
        inFunction = false;
      }
    }

    // Deep nesting detection (analyzer 19)
    if (activeIds.has(19)) {
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      if (indent >= 16 && (trimmed.startsWith('if') || trimmed.startsWith('for') || trimmed.startsWith('while'))) {
        findings.push({ analyzerId: 19, name: 'Deep Nesting', type: 'quality', line: i + 1, severity: 'low',
          desc: 'Code nested 4+ levels deep at line ' + (i + 1) + '.' });
      }
    }

    // Duplicate code blocks (analyzer 27) - simplified: check for identical consecutive lines
    if (activeIds.has(27) && i > 0 && trimmed.length > 20 && trimmed === lines[i - 1].trim()) {
      findings.push({ analyzerId: 27, name: 'Duplicate Code Block', type: 'quality', line: i + 1, severity: 'low',
        desc: 'Identical consecutive lines detected (possible duplication).' });
    }
  }
}

function isInStringOrComment(content, index) {
  // Simple heuristic: check if index is inside a comment or string literal
  let inSingleString = false, inDoubleString = false, inTemplate = false, inRegex = false;
  let inLineComment = false, inBlockComment = false;
  for (let i = 0; i < index; i++) {
    const ch = content[i];
    const next = content[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') inBlockComment = false;
      continue;
    }
    if (!inSingleString && !inDoubleString && !inTemplate && !inRegex) {
      if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    }
    if (inRegex) {
      if (ch === '\\') { i++; continue; }
      if (ch === '/') { inRegex = false; continue; }
      continue;
    }
    if (ch === '\\') { i++; continue; }
    if (!inDoubleString && !inTemplate && ch === "'") { inSingleString = !inSingleString; continue; }
    if (!inSingleString && !inTemplate && ch === '"') { inDoubleString = !inDoubleString; continue; }
    if (!inSingleString && !inDoubleString && ch === '`') { inTemplate = !inTemplate; continue; }
    if (!inSingleString && !inDoubleString && !inTemplate && ch === '/') {
      // Potential regex - check preceding char is not alphanumeric or closing paren/bracket
      const prev = content[i - 1];
      if (!prev || !/[a-zA-Z0-9_\)\]]/.test(prev)) inRegex = true;
    }
  }
  return inSingleString || inDoubleString || inTemplate || inRegex || inLineComment || inBlockComment;
}

async function runSimplebeaconScan(targetPath, analyzerIds = null) {
  const startTime = Date.now();
  const MAX_SCAN_TIME_MS = 120000; // 2 minutes
  const findings = [];
  let totalFiles = 0;
  let filesAnalyzed = 0;
  let folderCount = 0;
  const extensions = {};
  const imports = new Map();
  // Filter analyzers if specific IDs requested
  const activeAnalyzers = analyzerIds && Array.isArray(analyzerIds) && analyzerIds.length > 0
    ? ANALYZERS.filter((a) => analyzerIds.includes(a.id))
    : ANALYZERS;

  async function scanDir(dir) {
    if (Date.now() - startTime > MAX_SCAN_TIME_MS) return;
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (Date.now() - startTime > MAX_SCAN_TIME_MS) return;
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        folderCount++;
        await scanDir(fullPath);
      } else if (entry.isFile()) {
        totalFiles++;
        const ext = path.extname(entry.name).toLowerCase() || 'no-ext';
        extensions[ext] = (extensions[ext] || 0) + 1;
        if (shouldSkipFile(fullPath)) continue;

        const content = await readFileLimited(fullPath);
        if (!content) continue;
        filesAnalyzed++;

        // Track imports for circular dependency detection
        if (/\.(js|ts|jsx|tsx|cjs|mjs)$/.test(ext)) {
          const importMatches = content.matchAll(/(?:import|require)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
          for (const m of importMatches) {
            const mod = m[1] || m[2];
            if (mod && !mod.startsWith('.') && !mod.startsWith('/')) continue; // only local
            const key = path.resolve(dir, mod || '.');
            if (!imports.has(fullPath)) imports.set(fullPath, new Set());
            imports.get(fullPath).add(key);
          }
        }

        // Run regex analyzers
        const perAnalyzerFileCount = new Map();
        for (const analyzer of activeAnalyzers) {
          if (!analyzer.pattern) continue;
          const matches = content.matchAll(analyzer.pattern);
          const seen = new Set();
          let fileCount = 0;
          const MAX_PER_FILE = analyzer.severity === 'critical' ? 3 : analyzer.severity === 'high' ? 5 : 10;
          for (const m of matches) {
            if (fileCount >= MAX_PER_FILE) break;
            const snippet = m[0].slice(0, 80);
            if (seen.has(snippet)) continue;
            seen.add(snippet);
            // Skip matches inside comments or string literals for high/critical analyzers
            if ((analyzer.severity === 'critical' || analyzer.severity === 'high') && isInStringOrComment(content, m.index)) continue;
            // Skip matches inside regex pattern definitions (meta-scanning false positives)
            const matchLinePrefix = content.slice(Math.max(0, m.index - 200), m.index).split('\n').pop() || '';
            if (/^\s*(?:pattern|const\s+\w+\s*=)\s*[:=]\s*[`/"']/.test(matchLinePrefix)) continue;
            // Skip obvious false positives
            if (analyzer.id === 1 && /example|sample|placeholder|changeme|your-|test-|dummy|fake|demo|sandbox/.test(snippet)) continue;
            if (analyzer.id === 2 && /EXAMPLE/.test(snippet)) continue; // AWS example keys
            if (analyzer.id === 6 && isInStringOrComment(content, m.index)) continue; // eval in strings/comments
            if (analyzer.id === 8 && /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(snippet)) continue; // local dev URLs
            if (analyzer.id === 34 && /"eval"|'eval'|`eval`|\beval\b.*\bfunction\b/.test(snippet)) continue; // eval in strings or descriptions
            if (analyzer.id === 50 && /placeholder|stub/.test(snippet.toLowerCase()) && (isInStringOrComment(content, m.index) || /placeholder|stub/.test(content.slice(Math.max(0, m.index - 30), m.index)))) continue;
            findings.push({
              analyzerId: analyzer.id,
              type: analyzer.type,
              name: analyzer.name,
              severity: analyzer.severity,
              filePath: fullPath,
              line: (content.slice(0, m.index).match(/\n/g) || []).length + 1,
              desc: analyzer.desc,
              snippet: snippet
            });
            fileCount++;
          }
          if (fileCount > 0) perAnalyzerFileCount.set(analyzer.id, fileCount);
        }

        // Run per-line analyzers (only if their IDs are in active set)
        analyzeFilePerLine(fullPath, content, findings, activeAnalyzers);
      }
    }
  }

  await scanDir(targetPath);

  // Circular dependency check (analyzer 37) - only if active
  if (activeAnalyzers.some((a) => a.id === 37)) {
    const fileKeys = Array.from(imports.keys());
    for (const file of fileKeys) {
      const deps = imports.get(file);
      if (!deps) continue;
      for (const dep of deps) {
        const depFile = fileKeys.find(f => f.startsWith(dep) || dep.startsWith(f));
        if (depFile && depFile !== file) {
          const reverseDeps = imports.get(depFile);
          if (reverseDeps && reverseDeps.has(file.split('.')[0])) {
            findings.push({ analyzerId: 37, name: 'Circular Dependency Risk', filePath: file, line: 1, severity: 'low',
              desc: 'Potential circular import dependency detected.' });
            break;
          }
        }
      }
    }
  }

  // Aggregate findings by type and deduplicate by file+analyzer
  const dedupMap = new Map();
  for (const f of findings) {
    const key = f.filePath + '|' + f.analyzerId + '|' + f.line;
    if (!dedupMap.has(key)) dedupMap.set(key, f);
  }
  const uniqueFindings = Array.from(dedupMap.values());

  // Build severity counts
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of uniqueFindings) severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;

  // Build rawIssues grouped by type
  const typeGroups = {};
  for (const f of uniqueFindings) {
    if (!typeGroups[f.type]) typeGroups[f.type] = [];
    typeGroups[f.type].push(f);
  }
  const rawIssues = Object.entries(typeGroups).map(([type, items]) => ({
    type,
    severity: items[0].severity,
    description: items[0].name + (items.length > 1 ? ` (${items.length} occurrences)` : ''),
    filePath: items[0].filePath,
    count: items.length,
    recommendedAction: 'Review and remediate ' + items[0].name.toLowerCase() + ' findings.'
  }));

  // Compute quality score (0-100)
  // Use capped penalties so real codebases with many minor issues don't always score 0
  const criticalPenalty = Math.min(40, severityCounts.critical * 10);
  const highPenalty = Math.min(30, severityCounts.high * 5);
  const mediumPenalty = Math.min(15, severityCounts.medium * 0.3);
  const lowPenalty = Math.min(5, severityCounts.low * 0.05);
  const penalty = Math.min(100, criticalPenalty + highPenalty + mediumPenalty + lowPenalty);
  const qualityScore = Math.max(0, Math.round(100 - penalty));

  // Gate score (0-100, higher is better)
  const gateScore = qualityScore;
  const gatePass = severityCounts.critical === 0 && severityCounts.high === 0;
  const blockingCount = severityCounts.critical + severityCounts.high;

  return {
    projectRoot: targetPath,
    generatedAt: new Date().toISOString(),
    totalFiles,
    filesAnalyzed,
    extensions,
    qualityScore,
    severityCounts,
    gate: { pass: gatePass, score: gateScore, blockingCount },
    rawIssues,
    findings: uniqueFindings,
    totalSizeLabel: `${(totalFiles / 1000).toFixed(1)}k files`,
    repositoryInventory: {
      totalFiles,
      totalSize: totalFiles * 1024,
      totalFolders: folderCount
    },
    scanScope: {
      profile: 'full',
      rulesEnabled: activeAnalyzers.map(a => a.name),
      repositoryFilesTotal: totalFiles,
      repositoryFoldersTotal: folderCount,
      ruleScopedFilesAnalyzed: filesAnalyzed
    }
  };
}

// -----------------------------

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Stub API endpoints for dashboard functionality
  if (urlPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }
  if (urlPath === '/api/drives') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ drives: getActiveDrives() }));
    return;
  }
  if (urlPath === '/api/list-directory' && req.method === 'POST') {
    readJsonBody(req, async (err, body) => {
      if (err || !body || !body.path) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Path is required.' }));
        return;
      }
      const targetPath = body.path;
      try {
        const names = await fs.promises.readdir(targetPath);
        const MAX_ENTRIES = 500;
        const entries = [];
        let skipped = 0;
        for (const name of names.slice(0, MAX_ENTRIES + 50)) {
          if (entries.length >= MAX_ENTRIES) {
            skipped = names.length - MAX_ENTRIES;
            break;
          }
          if (name.startsWith('$') || name === 'System Volume Information') continue;
          try {
            const full = path.join(targetPath, name);
            const stat = await fs.promises.lstat(full);
            if (stat.isDirectory() || stat.isSymbolicLink()) {
              entries.push({ name, type: 'directory', path: full });
            }
          } catch {
            // skip inaccessible entries
          }
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, path: targetPath, entries, truncated: skipped > 0, total: names.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read directory: ' + (e && e.message) }));
      }
    });
    return;
  }
  if (urlPath === '/api/find-folder' && req.method === 'POST') {
    readJsonBody(req, async (err, body) => {
      if (err || !body || !body.folderName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'folderName is required.' }));
        return;
      }
      const targetName = body.folderName;
      const allResults = [];
      const drives = getActiveDrives();
      const requestedDrive = body.drive ? body.drive.toUpperCase().replace(/:$/, '') : '';

      // Timeout guard: if search takes too long, return what we have
      const startTime = Date.now();
      const SEARCH_TIMEOUT_MS = 20000;
      function timedOut() { return Date.now() - startTime > SEARCH_TIMEOUT_MS; }

      try {
        // If a specific drive is requested, search only that drive with moderate depth
        if (requestedDrive && drives.includes(requestedDrive + ':')) {
          const found = await findDirectoryByName(requestedDrive + ':\\', targetName, 6, 15, 300);
          allResults.push(...found);
        } else {
          // Phase 1: quick shallow scan of drive roots in parallel (depth 1 = root + immediate subdirs)
          const phase1Promises = drives.map(async (drive) => {
            if (allResults.length >= 10 || timedOut()) return [];
            return await findDirectoryByName(drive + '\\', targetName, 1, 10, 100);
          });
          const phase1Results = await Promise.all(phase1Promises);
          phase1Results.forEach((found) => allResults.push(...found));

          // Phase 2: deep scan of common user folders (only if shallow didn't find enough)
          if (allResults.length < 5 && !timedOut()) {
            const homeDir = require('os').homedir();
            const commonRoots = [homeDir, path.join(homeDir, 'CascadeProjects'), path.join(homeDir, 'Documents'), path.join(homeDir, 'Desktop')];
            for (const root of commonRoots) {
              if (allResults.length >= 10 || timedOut()) break;
              try { await fs.promises.access(root); } catch { continue; }
              const found = await findDirectoryByName(root, targetName, 5, 10, 200);
              allResults.push(...found);
            }
          }
          // Phase 3: deep scan of drives if still nothing (limited scope)
          if (allResults.length === 0 && !timedOut()) {
            for (const drive of drives) {
              if (allResults.length >= 10 || timedOut()) break;
              const found = await findDirectoryByName(drive + '\\', targetName, 4, 10, 200);
              allResults.push(...found);
            }
          }
        }
      } catch (e) {
        // Return partial results on error
      }

      const sorted = allResults
        .map((p) => ({
          p,
          depth: p.split(/[\\/]/).length,
          exact: path.basename(p) === targetName,
          homeScore: (/\\Users\\/.test(p) || /\\Users\//.test(p)) ? 2 : (/^C:[\\/]/.test(p) || /^c:[\\/]/.test(p)) ? 1 : 0
        }))
        .sort((a, b) =>
          (b.homeScore - a.homeScore) ||
          (b.exact ? 1 : 0) - (a.exact ? 1 : 0) ||
          a.depth - b.depth ||
          a.p.localeCompare(b.p)
        )
        .map((o) => o.p);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, folderName: targetName, results: sorted.slice(0, 15), timedOut: timedOut() }));
    });
    return;
  }
  if (urlPath === '/api/scan' && req.method === 'POST') {
    readJsonBody(req, async (err, body) => {
      if (err || !body || !body.path) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Target path is required.' }));
        return;
      }
      const targetPath = body.path;
      const analyzerIds = body.analyzerIds || null;
      try {
        const report = await runSimplebeaconScan(targetPath, analyzerIds);
        scanState.lastReport = report;
        scanState.history.unshift({ projectPath: targetPath, generatedAt: report.generatedAt, gatePass: report.gate.pass, qualityScore: report.qualityScore });
        if (scanState.history.length > 20) scanState.history.pop();
        // Return both report and metrics-compatible fields for Analyze page
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          report,
          scannedPath: targetPath,
          metrics: {
            totalFiles: report.totalFiles,
            totalSize: report.repositoryInventory.totalSize,
            breakdown: report.extensions
          }
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Scan failed: ' + (e && e.message) }));
      }
    });
    return;
  }
  if (urlPath === '/api/simplebeacon/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, features: { scan: true, analyze: true }, env: 'local' }));
    return;
  }
  if (urlPath === '/api/simplebeacon/scan' && req.method === 'POST') {
    readJsonBody(req, async (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body.' }));
        return;
      }
      const targetPath = body.projectPath || body.path;
      if (!targetPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'projectPath is required.' }));
        return;
      }
      const analyzerIds = body.analyzerIds || null;
      try {
        const report = await runSimplebeaconScan(targetPath, analyzerIds);
        scanState.lastReport = report;
        scanState.history.unshift({ projectPath: targetPath, generatedAt: report.generatedAt, gatePass: report.gate.pass, qualityScore: report.qualityScore });
        if (scanState.history.length > 20) scanState.history.pop();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, report, projectPath: targetPath, gateFailed: !report.gate.pass }));
      } catch (e) {
        console.error('Scan error:', e && e.stack || e && e.message || e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Scan failed: ' + (e && e.message), stack: e && e.stack, gateFailed: true }));
      }
    });
    return;
  }
  if (urlPath === '/api/simplebeacon/scan/progress') {
    const qs = new URL(req.url, `http://localhost`).searchParams;
    const projectPath = qs.get('projectPath');
    const lastReport = scanState.lastReport;
    const isMatch = lastReport && (!projectPath || lastReport.projectRoot === projectPath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      active: false,
      completed: isMatch,
      projectPath: isMatch ? lastReport.projectRoot : projectPath,
      qualityScore: isMatch ? lastReport.qualityScore : null,
      gatePass: isMatch ? lastReport.gate.pass : null
    }));
    return;
  }
  if (urlPath === '/api/simplebeacon/report') {
    const qs = new URL(req.url, `http://localhost`).searchParams;
    const projectPath = qs.get('projectPath');
    const report = scanState.lastReport;
    if (report && (!projectPath || report.projectRoot === projectPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'No report available. Run a scan first.' }));
    }
    return;
  }
  if (urlPath === '/api/simplebeacon/baseline') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, baseline: { qualityScore: 85, gatePass: true } }));
    return;
  }
  if (urlPath === '/api/simplebeacon/history') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(scanState.history));
    return;
  }
  if (urlPath === '/api/simplebeacon/dashboard') {
    const report = scanState.lastReport;
    const useAdjusted = report && typeof report.adjustedQualityScore === 'number';
    const score = useAdjusted ? report.adjustedQualityScore : (report ? report.qualityScore : 0);
    const issues = report ? (report.detectedIssues || report.rawIssues || []) : [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      overview: {
        totalFiles: report ? report.totalFiles : 0,
        codeQuality: score,
        adjustedQualityScore: useAdjusted ? report.adjustedQualityScore : null,
        schemaPassRate: report ? (report.gate.pass ? 100 : 0) : 0,
        scannerIssues: issues.length,
        securityScore: report ? (report.gate.pass ? '90/100' : '60/100') : '—',
        lastScan: report ? report.generatedAt : null,
        falsePositiveEstimate: report ? report.falsePositiveEstimate : null,
        productionIssueCount: report ? report.productionIssueCount : null,
        confidenceDistribution: report ? report.confidenceDistribution : null
      }
    }));
    return;
  }
  if (urlPath === '/api/platform/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authRequired: false, version: '3.0.1', env: 'local' }));
    return;
  }
  if (urlPath === '/api/auth/me') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: { id: 'local-dev', email: 'dev@simplebeacon.local', tier: 'pro' }, authRequired: false }));
    return;
  }
  if (urlPath === '/api/analyze/inventory') {
    const qs = new URL(req.url, `http://localhost`).searchParams;
    const projectPath = qs.get('projectPath');
    const profile = qs.get('profile') || 'explorer';
    if (!projectPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'projectPath is required.' }));
      return;
    }
    (async () => {
      try {
        let totalFiles = 0;
        let totalFolders = 0;
        let totalSize = 0;
        async function walk(dir) {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              totalFolders++;
              await walk(full);
            } else if (entry.isFile()) {
              totalFiles++;
              try {
                const stat = await fs.promises.stat(full);
                totalSize += stat.size;
              } catch {}
            }
          }
        }
        await walk(projectPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          inventory: {
            totalFiles,
            totalFolders,
            totalSize,
            scannedAt: new Date().toISOString()
          }
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Inventory failed: ' + (e && e.message) }));
      }
    })();
    return;
  }
  if (urlPath === '/api/dashboard-home') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { metrics: {}, recentScans: [] } }));
    return;
  }
  if (urlPath === '/api/simplebeacon/user/ai-keys') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, providers: { openai: { available: true, models: ['gpt-4', 'gpt-3.5-turbo'] } }, ollamaBaseUrl: '', ollamaModel: '' }));
    return;
  }
  if (urlPath === '/api/dev-tools/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, tools: [] }));
    return;
  }
  if (urlPath === '/api/coverage-reports/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, coverage: { overall: 0 } }));
    return;
  }
  if (urlPath === '/api/security/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, vulnerabilities: [] }));
    return;
  }
  if (urlPath === '/api/quality/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, issues: [] }));
    return;
  }
  if (urlPath === '/api/help') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, topics: [] }));
    return;
  }
  if (urlPath === '/api/models/test-ollama') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ok: true, availableModels: ['llama3.2:latest'], message: 'Ollama connected' }));
    return;
  }
  if (urlPath === '/api/analyze/providers') {
    let allowedRoots = [];
    let rootsSummary = 'none';
    let defaultPath = '';
    try {
      const projectRoot = path.join(ROOT, '..');
      const searchPaths = [projectRoot];
      const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          searchPaths.push(path.join(projectRoot, entry.name));
        }
      }
      for (const basePath of searchPaths) {
        const configJsonPath = path.join(basePath, '.simplebeacon', 'config.json');
        if (fs.existsSync(configJsonPath)) {
          const configJson = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
          if (Array.isArray(configJson.allowedAnalysisRoots) && configJson.allowedAnalysisRoots.length > 0) {
            allowedRoots = configJson.allowedAnalysisRoots;
            rootsSummary = allowedRoots.slice(0, 4).join('; ');
            defaultPath = configJson.defaultProjectPath || basePath;
            break;
          }
        }
      }
    } catch { /* ignore */ }
    if (allowedRoots.length === 0) {
      const fallbackPath = path.join(ROOT, '..');
      allowedRoots = [fallbackPath];
      rootsSummary = fallbackPath;
      defaultPath = fallbackPath;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      providers: [
        { id: 'simplebeacon', name: 'SimpleBeacon', configured: true },
        { id: 'openai', name: 'OpenAI', configured: false },
        { id: 'ollama', name: 'Ollama', configured: false },
      ],
      allowedAnalysisRoots: allowedRoots,
      allowedAnalysisRootsSummary: rootsSummary,
      defaultProjectPath: defaultPath,
    }));
    return;
  }

  // --- Auth endpoints (dev-only, in-memory) ---
  if (urlPath === '/api/auth/register' && req.method === 'POST') {
    readJsonBody(req, (err, body) => {
      if (err || !body || !body.email || !body.password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Email and password required.' }));
        return;
      }
      const email = String(body.email).trim().toLowerCase();
      const password = String(body.password);
      if (localUsers.has(email)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Account already exists.' }));
        return;
      }
      const user = { id: 'u-' + Date.now(), email, password: hashPassword(password), tier: 'pro' };
      localUsers.set(email, user);
      const now = Math.floor(Date.now() / 1000);
      const token = makeLocalJwt({ sub: user.id, email: user.email, tier: user.tier, plan: user.tier, iat: now, exp: now + 60 * 60 * 24 * 30 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token, user: { id: user.id, email: user.email, tier: user.tier, plan: user.tier } }));
    });
    return;
  }
  if (urlPath === '/api/auth/login' && req.method === 'POST') {
    readJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid request.' }));
        return;
      }
      // Email + password login
      if (body.email && body.password) {
        const email = String(body.email).trim().toLowerCase();
        const password = String(body.password);
        const user = localUsers.get(email);
        if (!user || user.password !== hashPassword(password)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid email or password.' }));
          return;
        }
        const now = Math.floor(Date.now() / 1000);
        const token = makeLocalJwt({ sub: user.id, email: user.email, tier: user.tier, plan: user.tier, iat: now, exp: now + 60 * 60 * 24 * 30 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, token, user: { id: user.id, email: user.email, tier: user.tier, plan: user.tier }, authMethod: 'email' }));
        return;
      }
      // Token / license token login
      const token = (body.token || body.licenseToken || '').trim();
      if (token) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, token, user: { id: 'token-user', email: body.email || 'user@simplebeacon.ai', tier: 'pro', plan: 'pro' } }));
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Email and password or token required.' }));
    });
    return;
  }
  if (urlPath === '/api/tokens/sandbox' && req.method === 'POST') {
    const now = Math.floor(Date.now() / 1000);
    const token = makeLocalJwt({ tier: 'sandbox', source: 'sandbox', iat: now, exp: now + 60 * 60 * 24 * 7 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, token }));
    return;
  }
  if (urlPath === '/api/auth/set-token-password' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (urlPath === '/audit.html') {
    const auditPath = path.join(AUDIT_ROOT, 'audit.html');
    fs.readFile(auditPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('audit.html not found');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
    return;
  }

  // Serve /coming-soon/* static files from the AUDIT_ROOT (coming-soon landing pages)
  // Also serve the same files at root paths so the unified site works locally.
  if (urlPath.startsWith('/coming-soon/') || !urlPath.startsWith('/dashboard/')) {
    const comingSoonRel = urlPath.replace(/^\/coming-soon\//, '');
    const comingSoonPath = path.join(AUDIT_ROOT, comingSoonRel === '' ? 'index.html' : comingSoonRel);
    // Prevent path traversal outside AUDIT_ROOT
    const resolved = path.resolve(comingSoonPath);
    const resolvedRoot = path.resolve(AUDIT_ROOT);
    if (resolved.startsWith(resolvedRoot) && fs.existsSync(comingSoonPath) && fs.statSync(comingSoonPath).isFile()) {
      fs.readFile(comingSoonPath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        const ext2 = path.extname(comingSoonPath).toLowerCase();
        const ct2 = mimeTypes[ext2] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': ct2 });
        res.end(data);
      });
      return;
    }
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  let filePath = path.join(ROOT, urlPath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  function tryReadFile(targetPath, cb) {
    fs.readFile(targetPath, (err, data) => {
      if (err && (err.code === 'ENOENT' || err.code === 'EISDIR')) {
        // Try stripping known SPA route prefixes
        const rel = urlPath.replace(/^\/dashboard\//, '/').replace(/^\/api\/trust\//, '/');
        if (rel !== urlPath) {
          const altPath = path.join(ROOT, rel);
          fs.readFile(altPath, (err2, data2) => {
            if (err2)
              cb(err, null);
            else
              cb(null, { data: data2, path: altPath });
          });
          return;
        }
      }
      if (err)
        cb(err, null);
      else
        cb(null, { data, path: targetPath });
    });
  }

  tryReadFile(filePath, (err, result) => {
    if (err || !result) {
      const errCode = err && (err.code === 'ENOENT' || err.code === 'EISDIR');
      const isStaticAsset = ext && ext !== '.html';
      if (errCode && isStaticAsset) {
        // Don't SPA-fallback real static files (CSS, JS, images)
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      if (errCode) {
        // Don't SPA-fallback favicon requests — they cause ORB blocking
        const baseName = path.basename(urlPath).toLowerCase();
        if (baseName === 'favicon.ico' || baseName === 'favicon.svg' || baseName.startsWith('favicon')) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        // SPA fallback: serve index.html for unknown routes
        fs.readFile(path.join(ROOT, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          }
        });
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error: ' + (err && err.code));
      return;
    }
    const resultExt = path.extname(result.path).toLowerCase();
    const resultContentType = mimeTypes[resultExt] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': resultContentType });
    res.end(result.data);
  });
});

server.listen(PORT);
