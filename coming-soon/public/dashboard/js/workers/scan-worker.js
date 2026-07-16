/**
 * Local browser scan worker for the AI platform dashboard.
 * Scans files selected by the user on their own hardware — no data is sent to the server.
 *
 * This version streams large files through a Rust/WebAssembly chunk analyzer (with a
 * pure-JS fallback) instead of loading the entire file into memory at once.
 */

import { analyzeFileChunks, findingsToIssues } from './scan-wasm-bridge.js?v=20260716cachefix1';

const MAX_DISCOVERED_FILES = 500000;
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const BINARY_EXTENSIONS = /\.(exe|dll|bin|so|dylib|wasm|zip|tar|gz|tgz|bz2|7z|rar|iso|img|dmg|pkg|deb|msi|apk|ipa|woff|woff2|ttf|otf|eot|png|jpg|jpeg|gif|bmp|ico|webp|avif|svg|mp3|mp4|wav|avi|mov|mkv|webm|pdf|doc|docx|xls|xlsx|ppt|pptx|sqlite|db|lock|scx|scm|sc2map|sc2data|chk|mix|vxl|shp|tmp|mpq|w3x|w3m|nif|bik|ogv|dat|vsix|pack|bundle|map)$/i;

const LANGUAGE_REGISTRY = {
  javascript: { extensions: ['js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx'] },
  python: { extensions: ['py', 'pyw', 'pyi'] },
  java: { extensions: ['java', 'kt', 'scala', 'groovy'] },
  go: { extensions: ['go'] },
  rust: { extensions: ['rs'] },
  php: { extensions: ['php'] },
  ruby: { extensions: ['rb'] },
  dotnet: { extensions: ['cs', 'vb'] }
};

const PATTERN_REGISTRY = {
  debugArtifacts: {
    appliesTo: ['javascript'],
    pattern: /\bconsole\.(log|warn|error|info|debug|table|trace|dir|group)\s*\(|\bdebugger\b|\balert\s*\(|\bprompt\s*\(|\bconfirm\s*\(/gi
  },
  todoMarkers: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    pattern: /(?:\/\/\s*|\/\*\s*|#\s*)\b(TODO|FIXME|HACK|XXX|BUG)\b/gi
  },
  credentials: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
    pattern: /(?:^|[^a-zA-Z0-9_-])(password|passwd|pwd|secret|api[_-]?key|private[_-]?key|client[_-]?secret|access_token|auth_token|refresh_token|bearer_token)\s*[:=]\s*['"`][^'"`\s]{8,}/gi
  },
  euAiAct: {
    appliesTo: ['javascript'],
    pattern: /ai_system|high_risk|transparency|conformity|bias_audit|data_governance/gi
  },
  pythonDebug: {
    appliesTo: ['python'],
    pattern: /\bprint\s*\(|\bpprint\s*\(|\blogging\.debug\s*\(|\bbreakpoint\s*\(/i
  },
  javaDebug: {
    appliesTo: ['java'],
    pattern: /\bSystem\.(out|err)\.(print|println)\s*\(|\be\.printStackTrace\s*\(|\bjava\.util\.logging\./i
  },
  pythonFramework: {
    appliesTo: ['python'],
    pattern: /\bDEBUG\s*=\s*True\b|\bapp\.run\s*\(\s*[^)]*debug\s*=\s*True/i
  },
  javaFramework: {
    appliesTo: ['java'],
    pattern: /spring\.datasource\.(password|url)\s*=\s*['"][^'"]{4,}|log4j.*CVE|log4shell|jndi:ldap/i
  },
  goDebug: {
    appliesTo: ['go'],
    pattern: /\bfmt\.Print(?:ln|f)?\s*\(|\blog\.Print(?:ln|f)?\s*\(|\blog\.Fatal(?:f|ln)?\s*\(|\bpanic\s*\(/i
  },
  goFramework: {
    appliesTo: ['go'],
    pattern: /\bgin\.SetMode\s*\(\s*gin\.DebugMode|http\.ListenAndServe\s*\(\s*["'][^"']+["']\s*,\s*nil\s*\)/i
  },
  rustDebug: {
    appliesTo: ['rust'],
    pattern: /\bprintln!\s*\(|\beprintln!\s*\(|\bdbg!\s*\(|\bprint!\s*\(|\bpanic!\s*\(/i
  },
  rustFramework: {
    appliesTo: ['rust'],
    pattern: /\.unwrap\s*\(\s*\)(?:\s*\?\s*\.unwrap\s*\(\s*\))+|\.expect\s*\(\s*["']\s*["']\s*\)/i
  },
  phpDebug: {
    appliesTo: ['php'],
    pattern: /\becho\s+['"]|\bvar_dump\s*\(|\bprint_r\s*\(|\bdie\s*\(|\bexit\s*\(|\bdebug_backtrace\s*\(|\btrigger_error\s*\(/i
  },
  phpFramework: {
    appliesTo: ['php'],
    pattern: /APP_DEBUG\s*=>\s*true|APP_ENV\s*=>\s*['"]local['"]|DB::raw\s*\(|mysql_query\s*\(|mysqli_query\s*\(|PDO\s*::\s*query\s*\(|eval\s*\(/i
  },
  dotnetDebug: {
    appliesTo: ['dotnet'],
    pattern: /\bConsole\.Write(Line)?\s*\(|\bDebug\.Write(Line)?\s*\(|\bTrace\.Write(Line)?\s*\(|\bDebugger\.Break\s*\(/i
  },
  dotnetFramework: {
    appliesTo: ['dotnet'],
    pattern: /connectionString\s*=\s*["'][^"']{10,}|Integrated\s+Security\s*=\s*false|Server=localhost;|\.UseInMemoryDatabase\s*\(/i
  },
  rubyDebug: {
    appliesTo: ['ruby'],
    pattern: /\bputs\s+['"]|\bp\s+['"]|\bdebugger\b|\bdebug\s+['"]|\bbinding\.irb\b|\bbinding\.pry\b|\bRails\.logger\.debug\s*\(/i
  },
  rubyFramework: {
    appliesTo: ['ruby'],
    pattern: /\.permit!\s*\)|\bskip_before_action\b|\beval\s*\(|\bsend\s*\(\s*params\[/i
  }
};

const SEVERITY_MAP = {
  credentials: 'critical',
  euAiAct: 'high'
};

const CREDENTIAL_ALLOWLIST = /placeholder|changeme|example\.com|your-api-key|your-secret|dummy-token|test-secret|fake-api|mock-secret|not-a-real|hardcoded-secret-for-unit-test|secret-key-for-unit-test|sk_test_your|xxxxxxxx|replace_me|sample-token|template-secret|programmatically generated/i;
const IGNORE_LINE_RE = /simplebeacon-ignore\s+(?:credentials|credential-pattern|sensitive-data)/i;
const EU_AI_ACT_COMPLIANCE_LINE_RE = /EU AI Act Documentation Marker|Documentation Marker|Annex III|Article\s*50|Article\s*12|euaiactcompliance|transparency disclosure|human-in-the-loop|humanInTheLoop|human oversight|inference events logged|Risk Level:|Limited risk|not legal conformity|technical readiness|transparencyGaps|highRiskIndicators|aiSystemIndicators|documentationArtifacts|legal conformity|Disclaimer:/i;

function isTestOrFixturePath(normalized) {
  return /(?:^|\/)(__tests__|tests?|fixtures?|mocks?)(?:\/|$)/i.test(normalized)
    || /\.(test|spec)\.[a-z0-9]+$/i.test(normalized);
}

function isComplianceToolingPath(normalized) {
  return /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|lib|mcp|analyzers)\//i.test(normalized)
    || /eu-ai-act|scanner-patterns|scanner-engine|compliance-mapper|credential-pattern-scanner|enterprise-guardrail|llm-slop-catalog/i.test(normalized);
}

function shouldSkipAnalyzerLine(name, filePath, line) {
  const normalized = filePath.replace(/\\/g, '/');
  if (IGNORE_LINE_RE.test(line)) return true;
  if (name === 'credentials') {
    if (isTestOrFixturePath(normalized) || CREDENTIAL_ALLOWLIST.test(line)) return true;
  }
  if (name === 'euAiAct') {
    if (isComplianceToolingPath(normalized) || EU_AI_ACT_COMPLIANCE_LINE_RE.test(line)) return true;
  }
  return false;
}

function shouldSkipAnalyzerFile(name, filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (name === 'credentials' && isTestOrFixturePath(normalized)) return true;
  if (name === 'euAiAct' && isComplianceToolingPath(normalized)) return true;
  return false;
}

function detectFileLanguage(path) {
  const ext = (path.match(/\.([^.]+)$/) || [null, ''])[1].toLowerCase();
  for (const [langKey, config] of Object.entries(LANGUAGE_REGISTRY)) {
    if (config.extensions.includes(ext)) return langKey;
  }
  return null;
}

function getAnalyzersForLanguage(langKey) {
  return Object.entries(PATTERN_REGISTRY)
    .filter(([, entry]) => entry.appliesTo.includes(langKey))
    .map(([id]) => id);
}

function extractMatches(text, pattern, max = 3, lineFilter = null) {
  const matches = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && matches.length < max; i++) {
    const line = lines[i];
    if (lineFilter && lineFilter(line)) continue;
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      matches.push({ line: i + 1, snippet: line.trim().slice(0, 120) });
    }
  }
  return matches;
}

function shouldSkipFile(path, deepScan) {
  const normalized = path.replace(/\\/g, '/');
  if (/(^|[\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp)([\/]|$)/i.test(normalized)) return true;
  if (!deepScan && /(^|[\/])(docs\/|doc\/|third_party\/|thirdparty\/|geedocs\/|mapfiles\/|vendor\/)/i.test(normalized)) return true;
  if (!deepScan && /\.min\.js$|\.pack\.js$|\.bundle\.js$|\.map$/i.test(normalized)) return true;
  return false;
}

function isBinary(path) {
  return BINARY_EXTENSIONS.test(path);
}

function isBinaryOrLarge(path, size) {
  return isBinary(path) || size > LARGE_FILE_THRESHOLD;
}

function runAnalyzer(name, text, filePath) {
  const results = [];
  const reg = PATTERN_REGISTRY[name];
  if (shouldSkipAnalyzerFile(name, filePath)) return results;
  if (reg && reg.pattern) {
    const lineFilter = (line) => shouldSkipAnalyzerLine(name, filePath, line);
    const matches = extractMatches(text, reg.pattern, 5, lineFilter);
    if (matches.length > 0) {
      results.push({
        analyzer: name,
        filePath,
        matches,
        count: matches.length
      });
    }
  }
  return results;
}

async function resolveFile(fileEntry) {
  const fileObj = fileEntry.fileObj || fileEntry;
  if (typeof fileObj.getFile === 'function') {
    return fileObj.getFile();
  }
  return fileObj;
}

async function analyzeWithTextPatterns(file, filePath) {
  const text = await file.text();
  const fileLang = detectFileLanguage(filePath);
  if (!fileLang) return [];
  const analyzers = getAnalyzersForLanguage(fileLang);
  const issues = [];
  for (const name of analyzers) {
    const results = runAnalyzer(name, text, filePath);
    for (const r of results) {
      if (r.matches && r.matches.length > 0) {
        issues.push({
          severity: SEVERITY_MAP[name] || 'medium',
          filePath: r.filePath,
          rule: name,
          line: r.matches[0].line,
          impact: `${r.count} ${name} finding(s) detected`,
          fix: 'Review and remediate before next release.',
          count: r.count,
          matches: r.matches
        });
      }
    }
  }
  return issues;
}

async function scanFiles(files, deepScan) {
  const allResults = [];
  const issues = [];
  let processed = 0;
  let textErrors = 0;
  let chunkAnalyzed = 0;
  let binarySkipped = 0;

  for (const file of files) {
    if (shouldSkipFile(file.path, deepScan)) continue;
    try {
      const fileObj = await resolveFile(file);
      if (!fileObj || typeof fileObj.slice !== 'function') {
        textErrors++;
        continue;
      }

      const size = fileObj.size || 0;
      if (isBinary(file.path)) {
        binarySkipped += 1;
        processed++;
        continue;
      }
      if (size > LARGE_FILE_THRESHOLD) {
        const results = await analyzeFileChunks(fileObj, file.path);
        chunkAnalyzed += 1;
        const chunkIssues = findingsToIssues(results, file.path);
        if (chunkIssues.length > 0) {
          issues.push(...chunkIssues);
          allResults.push({
            analyzer: 'chunkAnalyzer',
            filePath: file.path,
            matches: chunkIssues.map((i) => ({ line: i.line, snippet: i.impact })),
            count: chunkIssues.length
          });
        }
      } else {
        const textIssues = await analyzeWithTextPatterns(fileObj, file.path);
        issues.push(...textIssues);
      }

      processed++;
      if (processed % 50 === 0) {
        self.postMessage({ type: 'progress', processed, total: files.length });
      }
    } catch (err) {
      textErrors++;
    }
  }
  self.postMessage({ type: 'progress', processed, total: files.length });
  return { processed, totalFiles: files.length, findings: allResults, issues, issueCount: issues.length, chunkAnalyzed, binarySkipped };
}

self.onmessage = async (e) => {
  const { type, files, scanId } = e.data;
  if (type === 'scan') {
    self.postMessage({ type: 'started', scanId, totalFiles: files.length });
    try {
      const results = await scanFiles(files, e.data.deepScan);
      self.postMessage({ type: 'complete', scanId, ...results });
    } catch (err) {
      self.postMessage({ type: 'error', scanId, error: err.message });
    }
  }
};
