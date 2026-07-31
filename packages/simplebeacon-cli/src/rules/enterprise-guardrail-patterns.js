// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Enterprise AI technical risk guardrails — local pattern scan only.
 * Data leakage in LLM-bound strings and unbounded token spend on model API calls.
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('./production-leak');

const DEFAULT_SOURCE_PATHS = ['server', 'src', 'web', 'lib', 'packages', 'app', 'api', 'services'];
const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.go',
  '.rs',
]);
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  'archive',
  '.simplebeacon',
  'tests',
  'test',
  '__tests__',
  'fixtures',
  'examples',
  'simplebeacon-rule-tests',
  'simplebeacon-frameworkless',
  'marketing-content-test',
]);
const MAX_SCAN_BYTES = 512000;
const CALL_BLOCK_MAX_LINES = 48;

const DEFAULT_LEAK_TOKENS = [
  'internal_db_password',
  'prod_api_secret',
  'customer_ssn',
  'pii_payload',
  'auth_token',
];

const RULE_CATALOG = [
  {
    id: 'SB-ENT-001',
    category: 'data-leakage',
    severity: 'critical',
    description:
      'Hardcoded internal/corporate identifier in a string bound for AI or secrets context',
  },
  {
    id: 'SB-ENT-002',
    category: 'token-budget',
    severity: 'high',
    description:
      'LLM API call without explicit max_tokens / max_completion_tokens / maxOutputTokens cap',
  },
  {
    id: 'SB-ENT-002b',
    category: 'token-budget',
    severity: 'medium',
    description: 'max_tokens value exceeds safe threshold (>16,384) — risk of oversized billing',
  },
  {
    id: 'SB-ENT-003',
    category: 'loop-budget',
    severity: 'medium',
    description:
      'LLM API call inside unbounded loop (for/while/forEach/map) without explicit iteration cap',
  },
  {
    id: 'SB-ENT-004',
    category: 'resilience',
    severity: 'medium',
    description: 'LLM SDK client instantiated without explicit maxRetries or timeout configuration',
  },
  {
    id: 'SB-ENT-005',
    category: 'stream-safety',
    severity: 'medium',
    description: 'Streaming LLM call without AbortController or explicit stream timeout',
  },
];

const LLM_INVOCATION_PATTERNS = [
  /chat\.completions\.(?:create|stream)\s*\(/i,
  /\.messages\.(?:create|stream)\s*\(/i,
  /\.completions\.(?:create|stream)\s*\(/i,
  /\.responses\.(?:create|stream)\s*\(/i,
  /\.beta\.threads\.runs\.(?:create|stream)\s*\(/i,
  /\.embeddings\.create\s*\(/i,
  /(?:openai|anthropic|bedrock|vertexai|generativeai)\.[a-z0-9_.]+\.(?:create|generate|invoke|stream)\s*\(/i,
  /\.invoke\s*\(/i,
];

function lineHasLlmInvocation(line) {
  if (line.length > 8000) return false;
  if (
    /Object\.create\s*\(/.test(line) &&
    !/completions|\.messages\.|openai|anthropic|bedrock/i.test(line)
  ) {
    return false;
  }
  return LLM_INVOCATION_PATTERNS.some((re) => re.test(line));
}

const TOKEN_CAP_RE = /\bmax_(?:completion_)?tokens\b|\bmaxOutputTokens\b|\bmax_tokens_to_sample\b/i;
const MAX_TOKENS_THRESHOLD = 16384;
const HIGH_MAX_TOKENS_RE = /\bmax_(?:completion_)?tokens\b\s*:\s*(\d{5,}|[2-9]\d{4}|1[7-9]\d{3})/i;

const LOOP_START_RE = /\b(for\s*\(|while\s*\(|\.forEach\s*\(|\.map\s*\(|\.flatMap\s*\()/i;
const LOOP_BOUNDED_RE =
  /\b(for\s*\(|while\s*\(|\.forEach\s*\(|\.map\s*\()[^)]*\blength\b|\blimit\b|\bcount\b|\bslice\b|\btake\b/i;
const LOOP_BLOCK_MAX_LINES = 80;

const LLM_CLIENT_NEW_RE =
  /\bnew\s+(OpenAI|Anthropic|Bedrock|VertexAI|GenerativeAI|Ollama|AI21|Cohere)\b/i;
const RETRY_CONFIG_RE = /\bmaxRetries\b|\btimeout\b|\brequestTimeout\b/i;

const STREAM_CALL_RE = /\.stream\s*\(|stream\s*:\s*true/i;
const ABORT_CONTROLLER_RE = /\bAbortController\b|\bsignal\b|\babort\b/i;
const STREAM_TIMEOUT_RE = /\bsetTimeout\b|\btimer\b|\bdeadline\b/i;

const ALLOWLIST_SNIPPETS = [
  'enterprise-guardrail-patterns.js',
  'enterprise-guardrail-patterns.test.js',
  'eu-ai-act-patterns.test.js',
  'example.com',
  'placeholder',
  'your-api-key',
  'not-a-real',
  'test-only',
  'changeme',
];

const SCANNER_IMPL_PATH_RE =
  /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|lib|mcp)(?:\/|$)|(?:^|\/)src\/rules\/enterprise-guardrail/i;

function escapeRegexToken(token) {
  return String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLeakPattern(extraTokens = []) {
  const tokens = [
    ...new Set(
      [...DEFAULT_LEAK_TOKENS, ...(Array.isArray(extraTokens) ? extraTokens : [])]
        .map((t) =>
          String(t || '')
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    ),
  ];
  if (!tokens.length) return null;
  return new RegExp(`\\b(?:${tokens.map(escapeRegexToken).join('|')})\\b`, 'gi');
}

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function isIgnored(relativePath, ignoreGlobs) {
  return (ignoreGlobs || []).some((pattern) => globMatch(relativePath, pattern));
}

function isExcludedPath(relativePath, options = {}) {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  if (/(?:^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
  if (/(?:^|\/)marketing-content-test\//.test(normalized)) return true;
  if (options.universal) {
    return false;
  }

  if (/\.(test|spec)\.[jt]sx?$/.test(normalized)) return true;
  if (/\/tests?\//.test(normalized)) return true;
  if (/\/fixtures?\//.test(normalized)) return true;
  if (/\.example\.[-a-z0-9]+$/i.test(normalized)) return true;
  if (/\/\.cursor\//.test(normalized)) return true;
  if (SCANNER_IMPL_PATH_RE.test(normalized)) return true;
  return false;
}

function isAllowlisted(line, matchText) {
  const snippet = `${line} ${matchText}`.toLowerCase();
  return ALLOWLIST_SNIPPETS.some((token) => snippet.includes(token));
}

function lineHasStringContext(line) {
  return /['"`]/.test(line) || /=>\s*['"`]/.test(line) || /:\s*['"`]/.test(line);
}

function scanDataLeakLines(relativePath, content, leakPattern) {
  const findings = [];
  if (!leakPattern) return findings;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    leakPattern.lastIndex = 0;
    let match;
    while ((match = leakPattern.exec(line)) !== null) {
      if (!lineHasStringContext(line)) continue;
      if (isAllowlisted(line, match[0])) continue;
      findings.push({
        id: `enterprise-SB-ENT-001-${relativePath}-${i + 1}`,
        severity: 'critical',
        severityBand: 'critical',
        type: 'Enterprise Data Leakage Risk',
        filePath: relativePath,
        file: relativePath,
        line: i + 1,
        pattern: 'SB-ENT-001',
        count: 1,
        description: `${relativePath}:${i + 1} — hardcoded corporate/internal identifier "${match[0]}" in static string`,
        recommendedAction:
          'Remove secret or PII from source; load from vault/env at runtime; never embed in LLM prompts',
        affectedFiles: [relativePath],
        metadata: {
          ruleId: 'SB-ENT-001',
          category: 'data-leakage',
          match: match[0],
        },
      });
    }
  }
  return findings;
}

function callBlockHasTokenCap(lines, startLineIndex) {
  const block = lines.slice(startLineIndex, startLineIndex + CALL_BLOCK_MAX_LINES).join('\n');
  return TOKEN_CAP_RE.test(block);
}

function scanTokenBudgetLines(relativePath, content) {
  const findings = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!lineHasLlmInvocation(line)) continue;
    if (TOKEN_CAP_RE.test(line)) continue;
    if (isAllowlisted(line, '')) continue;
    if (callBlockHasTokenCap(lines, i)) continue;

    findings.push({
      id: `enterprise-SB-ENT-002-${relativePath}-${i + 1}`,
      severity: 'high',
      severityBand: 'high',
      type: 'Enterprise Token Budget Bleed',
      filePath: relativePath,
      file: relativePath,
      line: i + 1,
      pattern: 'SB-ENT-002',
      count: 1,
      description: `${relativePath}:${i + 1} — LLM call missing explicit token cap (max_tokens / max_completion_tokens / maxOutputTokens)`,
      recommendedAction:
        'Set max_tokens or max_completion_tokens on every production LLM call to prevent runaway billing',
      affectedFiles: [relativePath],
      metadata: {
        ruleId: 'SB-ENT-002',
        category: 'token-budget',
      },
    });
  }
  return findings;
}

function scanHighMaxTokens(relativePath, content) {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!lineHasLlmInvocation(line)) continue;
    const match = HIGH_MAX_TOKENS_RE.exec(line);
    if (!match) continue;
    const value = parseInt(match[1], 10);
    if (isNaN(value) || value <= MAX_TOKENS_THRESHOLD) continue;
    findings.push({
      id: `enterprise-SB-ENT-002b-${relativePath}-${i + 1}`,
      severity: 'medium',
      severityBand: 'medium',
      type: 'Enterprise Token Budget Exceeds Threshold',
      filePath: relativePath,
      file: relativePath,
      line: i + 1,
      pattern: 'SB-ENT-002b',
      count: 1,
      description: `${relativePath}:${i + 1} — max_tokens set to ${value}, exceeds safe threshold of ${MAX_TOKENS_THRESHOLD}`,
      recommendedAction: `Reduce max_tokens to <= ${MAX_TOKENS_THRESHOLD} or justify the higher value in a budget config`,
      affectedFiles: [relativePath],
      metadata: {
        ruleId: 'SB-ENT-002b',
        category: 'token-budget',
        maxTokens: value,
      },
    });
  }
  return findings;
}

function scanUnboundedLoops(relativePath, content) {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!LOOP_START_RE.test(line)) continue;
    if (LOOP_BOUNDED_RE.test(line)) continue;
    const blockEnd = Math.min(lines.length, i + LOOP_BLOCK_MAX_LINES);
    let foundLlmCall = false;
    for (let j = i + 1; j < blockEnd; j++) {
      if (lineHasLlmInvocation(lines[j])) {
        foundLlmCall = true;
        break;
      }
      if (/^\s*[})]\s*$/.test(lines[j])) break;
    }
    if (!foundLlmCall) continue;
    findings.push({
      id: `enterprise-SB-ENT-003-${relativePath}-${i + 1}`,
      severity: 'medium',
      severityBand: 'medium',
      type: 'Enterprise Loop Budget Risk',
      filePath: relativePath,
      file: relativePath,
      line: i + 1,
      pattern: 'SB-ENT-003',
      count: 1,
      description: `${relativePath}:${i + 1} — unbounded loop contains LLM API call without explicit iteration cap`,
      recommendedAction:
        'Add an explicit iteration limit (e.g., slice, take, count) or move LLM call outside the loop',
      affectedFiles: [relativePath],
      metadata: {
        ruleId: 'SB-ENT-003',
        category: 'loop-budget',
      },
    });
  }
  return findings;
}

function scanMissingRetryConfig(relativePath, content) {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!LLM_CLIENT_NEW_RE.test(line)) continue;
    const block = lines.slice(i, i + CALL_BLOCK_MAX_LINES).join('\n');
    if (RETRY_CONFIG_RE.test(block)) continue;
    findings.push({
      id: `enterprise-SB-ENT-004-${relativePath}-${i + 1}`,
      severity: 'medium',
      severityBand: 'medium',
      type: 'Enterprise Resilience Gap',
      filePath: relativePath,
      file: relativePath,
      line: i + 1,
      pattern: 'SB-ENT-004',
      count: 1,
      description: `${relativePath}:${i + 1} — LLM SDK client created without maxRetries or timeout`,
      recommendedAction:
        'Set maxRetries and timeout on LLM client constructors to prevent runaway retry storms',
      affectedFiles: [relativePath],
      metadata: {
        ruleId: 'SB-ENT-004',
        category: 'resilience',
      },
    });
  }
  return findings;
}

function scanUnsafeStreamCalls(relativePath, content) {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!STREAM_CALL_RE.test(line)) continue;
    if (!lineHasLlmInvocation(line)) continue;
    const block = lines.slice(i, i + CALL_BLOCK_MAX_LINES).join('\n');
    if (ABORT_CONTROLLER_RE.test(block) || STREAM_TIMEOUT_RE.test(block)) continue;
    findings.push({
      id: `enterprise-SB-ENT-005-${relativePath}-${i + 1}`,
      severity: 'medium',
      severityBand: 'medium',
      type: 'Enterprise Stream Safety Gap',
      filePath: relativePath,
      file: relativePath,
      line: i + 1,
      pattern: 'SB-ENT-005',
      count: 1,
      description: `${relativePath}:${i + 1} — streaming LLM call without AbortController or stream timeout`,
      recommendedAction:
        'Attach an AbortController signal or set a stream timeout to prevent indefinite stream hangs',
      affectedFiles: [relativePath],
      metadata: {
        ruleId: 'SB-ENT-005',
        category: 'stream-safety',
      },
    });
  }
  return findings;
}

function scanEnterpriseGuardrailContent(relativePath, content, options = {}) {
  if (isExcludedPath(relativePath)) return [];
  const leakPattern = buildLeakPattern(options.extraLeakTokens);
  return [
    ...scanDataLeakLines(relativePath, content, leakPattern),
    ...scanTokenBudgetLines(relativePath, content),
    ...scanHighMaxTokens(relativePath, content),
    ...scanUnboundedLoops(relativePath, content),
    ...scanMissingRetryConfig(relativePath, content),
    ...scanUnsafeStreamCalls(relativePath, content),
  ];
}

async function walkFiles(dir, results = [], options = {}, depth = 0) {
  if (depth > 12) return results;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkFiles(fullPath, results, options, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

    const relativePath = normalizeRel(options.baseDir, fullPath);
    if (isExcludedPath(relativePath)) continue;
    if (isIgnored(relativePath, options.ignoreGlobs)) continue;

    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.size > MAX_SCAN_BYTES) continue;
      results.push({ path: fullPath, relativePath, ext, size: stat.size });
    } catch {
      /* skip */
    }
  }
  return results;
}

async function scanEnterpriseGuardrailPatterns(baseDir, options = {}) {
  const sourcePaths = options.sourcePaths || DEFAULT_SOURCE_PATHS;
  const productionPaths = options.productionPaths || sourcePaths;
  const pathsToWalk = [...new Set([...sourcePaths, ...productionPaths])];
  const ignoreGlobs = options.ignoreGlobs || [];

  const files = [];
  for (const rel of pathsToWalk) {
    const abs = path.isAbsolute(rel) ? rel : path.join(baseDir, ...rel.split('/'));
    if (fs.existsSync(abs)) {
      await walkFiles(abs, files, { baseDir, ignoreGlobs });
    }
  }

  const issues = [];
  for (const file of files) {
    let content;
    try {
      content = await fs.promises.readFile(file.path, 'utf8');
    } catch {
      continue;
    }
    const hits = scanEnterpriseGuardrailContent(file.relativePath, content, {
      extraLeakTokens: options.extraLeakTokens,
    });
    const tokenSeverity = options.tokenCapSeverity || 'high';
    for (const issue of hits) {
      if (issue.pattern === 'SB-ENT-002') {
        issue.severity = tokenSeverity;
        issue.severityBand = tokenSeverity;
      }
      if (options.severity && issue.pattern === 'SB-ENT-001') {
        issue.severity = options.severity;
        issue.severityBand = options.severity;
      }
    }
    issues.push(...hits);
  }

  return {
    scanned: files.length,
    findings: issues.length,
    issues,
    patterns: RULE_CATALOG.map((r) => r.id),
  };
}

module.exports = {
  RULE_CATALOG,
  DEFAULT_LEAK_TOKENS,
  MAX_TOKENS_THRESHOLD,
  buildLeakPattern,
  scanEnterpriseGuardrailContent,
  scanEnterpriseGuardrailPatterns,
  scanDataLeakLines,
  scanTokenBudgetLines,
  scanHighMaxTokens,
  scanUnboundedLoops,
  scanMissingRetryConfig,
  scanUnsafeStreamCalls,
};
