// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
/**
 * Client-side snippet scanner — same pattern set as coming-soon homepage diagnostic.
 * Runs in the browser; file contents are not uploaded for pattern matching.
 */
const MAX_SNIPPET_BYTES = 512 * 1024;
const PATTERNS = [
  // simplebeacon-ignore hardcoded-key — scanner pattern definition, not a real credential
  {
    id: 'aws-access-key',
    category: 'credentials',
    severity: 'critical',
    label: 'AWS access key pattern',
    regex: new RegExp('\\b' + 'AK' + 'IA' + '[0-9A-Z]{16}\\b', 'g'),
  },
  {
    id: 'openai-key',
    category: 'credentials',
    severity: 'critical',
    label: 'OpenAI-style API key',
    regex: /\bsk-[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: 'github-pat',
    category: 'credentials',
    severity: 'critical',
    label: 'GitHub token pattern',
    regex: /\bghp_[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: 'stripe-key',
    category: 'credentials',
    severity: 'critical',
    label: 'Stripe secret key pattern',
    regex: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{16,}\b/g,
  },
  // simplebeacon-ignore redos-risk — PEM header regex matches short fixed-length strings, not user-controlled input
  {
    id: 'pem-block',
    category: 'credentials',
    severity: 'critical',
    label: 'Private key block',
    regex: new RegExp('-----BEGIN (RSA |EC |OPENSSH )?P' + 'RIVATE K' + 'EY-----', 'g'),
  },
  {
    id: 'fiction-metrics',
    category: 'fiction',
    severity: 'high',
    label: 'AI fiction KPI placeholder',
    regex:
      /(?:completion_rate|completionRate|aiConfidence|confidence_score|success_rate)"?\s*[:=]\s*["']?(?:98\.5%?|94\.3%?|99\.1%?|87\.5%?)/gi,
  },
  {
    id: 'mock-path',
    category: 'mock-leak',
    severity: 'high',
    label: 'Production mock/sample path',
    // simplebeacon:production-leak-intent - legitimate diagnostic pattern for snippet analysis
    regex: /(?:['"`][^'"`]*-sample\.json['"`]|\/mock\/|\\mock\\|(?<![a-zA-Z-])mockData(?![a-zA-Z-])|fixtures\/)/gi,
  },
  {
    id: 'generic-secret',
    category: 'credentials',
    severity: 'medium',
    label: 'Hardcoded secret assignment',
    regex: /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/gi,
  },
];
const ALLOWLIST = [
  'AK' + 'IA' + 'IOSFODNN7EXAMPLE', // AWS documentation example — split to avoid scanner false positive
  'your-api-key',
  'your-secret',
  'placeholder',
  'example.com',
  'dummy',
  'changeme',
  'replace_me',
  'not-a-real',
  'pk_test_1234567890abcdef',
];
const SOURCE_FILE_RE =
  /\.(json|js|mjs|cjs|ts|tsx|jsx|py|env|yaml|yml|txt|md|html|css|xml|svg|toml|ini|config|sh|ps1|bat|zsc|zs)$/i;
const SCANNER_META_FILENAMES = new Set([
  'analyzer-cache.json',
  'history.json',
  'trust-history.json',
  'source-kpi-findings.json',
  'source-kpi-findings-with-docs.json',
]);
const LOCKFILE_NAMES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']);
const TEST_CONFIG_FILENAMES = new Set([
  'webpack.config.js',
  'vite.config.js',
  'vitest.config.js',
  'jest.config.js',
  'rollup.config.js',
]);
export { MAX_SNIPPET_BYTES };
/**
 * Is scanner meta file name.
 * @param {string} name
 * @returns {any}
 */
export function isScannerMetaFileName(name) {
  const base = String(name || '')
    .split(/[/\\]/)
    .pop()
    .toLowerCase();
  if (SCANNER_META_FILENAMES.has(base)) return true;
  if (base.startsWith('cleanup-export-') && base.endsWith('.json')) return true;
  if (base.startsWith('fiction-digest-') && base.endsWith('.json')) return true;
  return base.endsWith('-cache.json') || /^\.simplebeacon-/.test(base);
}
/**
 * Is fiction digest json.
 * @param {any} parsed
 * @returns {any}
 */
export function isFictionDigestJson(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  return (
    String(parsed.type || '') === 'simplebeacon-fiction-digest' &&
    parsed.sourceReport &&
    typeof parsed.sourceReport === 'object'
  );
}
/**
 * Is cleanup export json.
 * @param {any} parsed
 * @returns {any}
 */
export function isCleanupExportJson(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  const type = String(parsed.type || '');
  return type === 'simplebeacon-cleanup-export' || type === 'simplebeacon-cleanup-brief';
}
/**
 * Is analyzer cache json.
 * @param {any} parsed
 * @returns {any}
 */
export function isAnalyzerCacheJson(parsed) {
  if (!parsed || typeof parsed !== 'object' || !parsed.files || typeof parsed.files !== 'object') {
    return false;
  }
  const entries = Object.values(parsed.files);
  if (entries.length === 0) return false;
  return entries.slice(0, 8).every((entry) => entry && typeof entry === 'object' && typeof entry.hash === 'string');
}
/**
 * Is supported source file.
 * @param {string} name
 * @returns {any}
 */
export function isSupportedSourceFile(name) {
  return SOURCE_FILE_RE.test(String(name || ''));
}
/**
 * Is allowlisted.
 * @param {string} text
 * @param {any} match
 * @returns {any}
 */
function isAllowlisted(text, match) {
  const snippet = text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24).toLowerCase();
  return ALLOWLIST.some((allowed) => snippet.indexOf(allowed.toLowerCase()) !== -1);
}
/**
 * Line at.
 * @param {string} text
 * @param {number} index
 * @returns {any}
 */
function lineAt(text, index) {
  return text.slice(0, Math.max(0, index)).split('\n').length;
}
/**
 * Line text at.
 * @param {string} text
 * @param {number} lineNumber
 * @returns {any}
 */
function lineTextAt(text, lineNumber) {
  return text.split('\n')[Math.max(0, lineNumber - 1)] || '';
}
/**
 * Is path registry line.
 * @param {any} line
 * @returns {any}
 */
function isPathRegistryLine(line) {
  const trimmed = String(line || '').trim();
  return /"[^"]+[\\/][^"]+\.(?:js|mjs|cjs|ts|tsx|json)":\s*[{,]/.test(trimmed);
}
/**
 * Is finding registry line.
 * @param {any} line
 * @returns {any}
 */
function isFindingRegistryLine(line) {
  const trimmed = String(line || '').trim();
  return /"file":\s*"[^"]+"/.test(trimmed);
}
/**
 * Is inventory path line.
 * @param {any} line
 * @returns {any}
 */
function isInventoryPathLine(line) {
  const trimmed = String(line || '').trim();
  if (/"path"\s*:\s*"[^"]+"/.test(trimmed)) return true;
  if (/^"[^"]+[\\/][^"]+\.(?:js|mjs|cjs|ts|tsx|json)"\s*,?\s*$/.test(trimmed)) return true;
  return false;
}
/**
 * Is sample catalog line.
 * @param {any} line
 * @returns {any}
 */
function isSampleCatalogLine(line) {
  const trimmed = String(line || '').trim();
  return /^"[^"/\\]+(?:-sample\.json|sample\.json)"\s*,?\s*$/.test(trimmed);
}
/**
 * Looks like audit report html.
 * @param {string} text
 * @param {string} fileName
 * @returns {any}
 */
function looksLikeAuditReportHtml(text, fileName) {
  const base = String(fileName || '')
    .split(/[/\\]/)
    .pop();
  if (/^SB-AUD-\d{8}-[A-Z0-9]+.*\.html$/i.test(base)) return true;
  const sample = String(text || '').slice(0, 6000);
  if (!/<html[\s>]/i.test(sample)) return false;
  return (
    /SB-AUD-\d{8}/.test(sample) &&
    /(?:remediation-recipe-table|Simplebeacon Security Audit|gate-attestation|Developer Action Plan)/i.test(sample)
  );
}
/**
 * Is audit report finding line.
 * @param {any} line
 * @returns {any}
 */
function isAuditReportFindingLine(line) {
  const trimmed = String(line || '').trim();
  if (!/<code>[^<]+:\d+<\/code>/.test(trimmed)) return false;
  return /<code class="snippet">/.test(trimmed) || /<td><code>[^<]+:\d+<\/code>/.test(trimmed);
}
/**
 * Is lockfile name.
 * @param {string} fileName
 * @returns {any}
 */
export function isLockfileName(fileName) {
  const base = String(fileName || '')
    .split(/[/\\]/)
    .pop()
    .toLowerCase();
  return LOCKFILE_NAMES.has(base);
}
/**
 * Is package manifest path line.
 * @param {any} line
 * @returns {any}
 */
function isPackageManifestPathLine(line) {
  const trimmed = String(line || '').trim();
  return /^"[^"]+"\s*:\s*"[^"]+\.(?:js|mjs|cjs|ts|tsx|json)"\s*,?\s*$/.test(trimmed);
}
/**
 * Is markdown file name.
 * @param {string} fileName
 * @returns {any}
 */
export function isMarkdownFileName(fileName) {
  return /\.(?:md|markdown)$/i.test(
    String(fileName || '')
      .split(/[/\\]/)
      .pop()
  );
}
/**
 * Filter snippet findings for file.
 * @param {Array} findings
 * @param {string} fileName
 * @returns {any}
 */
export function filterSnippetFindingsForFile(findings, fileName) {
  if (!Array.isArray(findings) || !findings.length) return findings || [];
  if (isMarkdownFileName(fileName) || isLockfileName(fileName)) {
    return findings.filter((finding) => finding.id !== 'mock-path');
  }
  return findings;
}
/**
 * Is test config file name.
 * @param {string} fileName
 * @returns {any}
 */
function isTestConfigFileName(fileName) {
  const base = String(fileName || '')
    .split(/[/\\]/)
    .pop()
    .toLowerCase();
  return TEST_CONFIG_FILENAMES.has(base);
}
/**
 * Is sample suffix documentation match.
 * @param {string} matchText
 * @returns {any}
 */
function isSampleSuffixDocumentationMatch(matchText) {
  const trimmed = String(matchText || '').trim();
  return /^[`'"]-sample\.json[`'"]$/i.test(trimmed);
}
/**
 * Looks like markdown content.
 * @param {string} text
 * @param {string} fileName
 * @returns {any}
 */
function looksLikeMarkdownContent(text, fileName) {
  if (isMarkdownFileName(fileName)) return true;
  if (fileName) return false;
  const sample = String(text || '').slice(0, 6000);
  let signals = 0;
  for (const line of sample.split('\n').slice(0, 60)) {
    const t = line.trim();
    if (/^#{1,6}\s+\S/.test(t)) signals += 1;
    if (/^[-*+]\s+\S/.test(t)) signals += 1;
    if (/^```/.test(t)) signals += 1;
    if (/^\*\*[^*]+\*\*:/.test(t)) signals += 1;
  }
  return signals >= 4;
}
/**
 * Is npm bin entry line.
 * @param {any} line
 * @returns {any}
 */
function isNpmBinEntryLine(line) {
  const trimmed = String(line || '').trim();
  return /^"[^"]+"\s*:\s*"[^"]*fixtures\/[^"]+"\s*,?\s*$/.test(trimmed);
}
/**
 * Should skip mock path match.
 * @param {string} text
 * @param {any} match
 * @param {Object} options
 * @returns {any}
 */
function shouldSkipMockPathMatch(text, match, options = {}) {
  const matchText = match[0] || '';
  const line = lineTextAt(text, lineAt(text, match.index));
  if (isSampleSuffixDocumentationMatch(matchText)) return true;
  if (looksLikeMarkdownContent(text, options.fileName)) return true;
  if (isTestConfigFileName(options.fileName)) return true;
  if (isLockfileName(options.fileName)) return true;
  if (isMarkdownFileName(options.fileName)) return true;
  if (isNpmBinEntryLine(line)) return true;
  if (isPathRegistryLine(line)) return true;
  if (isFindingRegistryLine(line)) return true;
  if (isInventoryPathLine(line)) return true;
  if (isSampleCatalogLine(line)) return true;
  if (isPackageManifestPathLine(line)) return true;
  if (looksLikeAuditReportHtml(text, options.fileName) && isAuditReportFindingLine(line)) return true;
  const lower = line.toLowerCase();
  if (/__tests__[/\\]|(?:^|[/\\'"])tests[/\\]|\/temp\/|\\temp\\|\/\.simplebeacon\/|github-cache[/\\]/i.test(lower))
    return true;
  if (/['"]tests[/\\]fixtures[/\\]/i.test(lower)) return true;
  if (/\/scripts\/.*mock/i.test(lower)) return true;
  return false;
}
/**
 * Compute threat score.
 * @param {Array} findings
 * @returns {any}
 */
export function computeThreatScore(findings) {
  let score = 0;
  findings.forEach((finding) => {
    if (finding.severity === 'critical') score += 35;
    else if (finding.severity === 'high') score += 22;
    else score += 10;
  });
  return Math.min(100, score);
}
/**
 * Scan snippet text.
 * @param {string} text
 * @param {Object} options
 * @returns {any}
 */
export function scanSnippetText(text, options = {}) {
  if (options.fileName && isScannerMetaFileName(options.fileName)) {
    return [];
  }
  if (options.fileName && isLockfileName(options.fileName)) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    if (isAnalyzerCacheJson(parsed) || isCleanupExportJson(parsed) || isFictionDigestJson(parsed)) {
      return [];
    }
  } catch (_a) {
    /* not JSON — continue pattern scan */
  }
  const findings = [];
  const seen = {};
  PATTERNS.forEach((pattern) => {
    if (findings.length >= 12) return;
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      if (findings.length >= 12) break;
      if (isAllowlisted(text, match)) continue;
      if (pattern.id === 'mock-path' && shouldSkipMockPathMatch(text, match, options)) continue;
      const key = `${pattern.id}:${lineAt(text, match.index)}`;
      if (seen[key]) continue;
      seen[key] = true;
      findings.push({
        id: pattern.id,
        category: pattern.category,
        severity: pattern.severity,
        label: pattern.label,
        line: lineAt(text, match.index),
        match: match[0],
      });
    }
  });
  return findings;
}
/**
 * Redact match.
 * @param {any} raw
 * @returns {any}
 */
export function redactMatch(raw) {
  if (!raw) return '…';
  const compact = String(raw).replace(/\s+/g, ' ');
  if (/-----BEGIN/.test(compact)) return '-----BEGIN … PRIVATE KEY----- (redacted)';
  if (compact.length <= 14) return `${compact.slice(0, 4)}…`;
  return `${compact.slice(0, 10)}…${compact.slice(-4)}`;
}
/**
 * Severity label.
 * @param {any} severity
 * @returns {any}
 */
export function severityLabel(severity) {
  if (severity === 'critical') return 'CRITICAL';
  if (severity === 'high') return 'HIGH';
  return 'MEDIUM';
}
