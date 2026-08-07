// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Security pattern scanner — ports browser security patterns to CLI.
 * Detects eval, XSS, prototype pollution, unvalidated redirects,
 * missing rate limits, insecure random, and secret logging.
 */

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.php', '.rb', '.go', '.java',
  '.json', '.yaml', '.yml', '.env', '.sh', '.bash', '.dockerfile', '.tf', '.cfg', '.conf', '.ini'
]);

const MAX_SCAN_BYTES = 512000;

const RULE_TYPE_MAP = {
  'SB-SEC-001': 'eval-danger',
  'SB-SEC-002': 'inner-html-xss',
  'SB-SEC-003': 'prototype-pollution',
  'SB-SEC-004': 'unhandled-promise',
  'SB-SEC-005': 'unvalidated-redirect',
  'SB-SEC-006': 'missing-rate-limit',
  'SB-SEC-007': 'insecure-random',
  'SB-SEC-008': 'logging-secrets',
  'SB-SEC-009': 'config-drift',
  'SB-SEC-010': 'sensitive-data',
  'SB-SEC-011': 'insecure-random',
  'SB-SEC-012': 'performance',
  'SB-SEC-013': 'sensitive-data',
  'SB-SEC-014': 'gcp-service-account',
  'SB-SEC-015': 'azure-key',
  'SB-SEC-016': 'oauth-token',
  'SB-SEC-017': 'docker-privileged',
  'SB-SEC-018': 'docker-root-user',
  'SB-SEC-019': 'docker-exposed-secrets',
  'SB-SEC-020': 'docker-no-healthcheck',
  'SB-SEC-021': 'suspicious-package',
  'SB-SEC-022': 'postinstall-script',
  'SB-SEC-023': 'unpinned-dependency'
};

const SECURITY_RULES = [
  {
    id: 'SB-SEC-001',
    name: 'Dangerous eval() Usage',
    regex: /\beval\s*\(|\bnew\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]|child_process\.exec\s*\(|shell\.exec\s*\(|\bsystem\s*\(/i,
    severity: 'high',
    skipFiles: /security-pattern-scanner\.js$|enhancedAIProvider\.ts$|realtimeMonitor\.ts$|workspaceAnalyzer\.ts$|findingConverter\.ts$|remediationProvider\.ts$|coming-soon|AnalyzeView\.js$|AnalyzeResultsPanel\.js$/i,
    description: 'eval(), new Function(), or dynamic code execution — code injection risk'
  },
  {
    id: 'SB-SEC-002',
    name: 'innerHTML XSS Risk',
    regex: /\.innerHTML\s*=\s*[^'"]/i,
    severity: 'medium',
    skipFiles: /codeMapTreeProvider\.(ts|js)$|simplebeacon-dashboard\/(?:js|js-es2018)\/.*\.js$/i,
    description: 'Assigning to innerHTML without sanitization — XSS risk'
  },
  {
    id: 'SB-SEC-003',
    name: 'Prototype Pollution Risk',
    regex: /Object\.prototype\s*=\s*[^=]|Object\.prototype\.[a-zA-Z_$][\w$]*\s*=\s*[^=]|__proto__\s*[:=]|\['__proto__'\]\s*:/i,
    severity: 'high',
    description: 'Modifying Object.prototype or __proto__ — prototype pollution vulnerability'
  },
  {
    id: 'SB-SEC-004',
    name: 'Unhandled Promise Rejection',
    regex: /\.(then|finally)\s*\((?:[^()\n]|\([^)\n]*\))*\)(?!\s*\.(catch|then|finally))\s*;?\s*\}?$/m,
    severity: 'medium',
    description: 'Promise chain missing .catch() handler — unhandled rejection'
  },
  {
    id: 'SB-SEC-005',
    name: 'Unvalidated Redirect',
    regex: /window\.location\s*=\s*[^'"\s]|window\.location\.href\s*=\s*[^'"\s]|window\.location\.replace\s*\(\s*[^'"\s]|res\.redirect\s*\(\s*(?:\d+\s*,\s*)?[^'"\s]|res\.redirect\s*\(\s*req\.(body|query|params)\.|location\.href\s*=\s*req\./i,
    severity: 'high',
    description: 'Redirect with user-controlled input — open redirect vulnerability'
  },
  {
    id: 'SB-SEC-006',
    name: 'Missing Rate Limiting',
    regex: /app\.(get|post|put|delete|patch)\s*\([^)]*\)(?!.*rateLimit|.*throttle|.*limiter)/is,
    severity: 'medium',
    skipFiles: /local-agent\/agent\.js$|server\/routes\//i,
    description: 'API endpoint without rate limiting — DoS vulnerability'
  },
  {
    id: 'SB-SEC-007',
    name: 'Insecure Random for Security',
    regex: /Math\.random\s*\(\)(?=.*(?:token|password|secret|salt|nonce|uuid|id|key))/i,
    severity: 'high',
    description: 'Math.random() used for crypto/security — predictable values',
    skipFiles: /(?:security-pattern-scanner|weak-crypto-scanner|scanner-patterns)\.(?:js|mjs|cjs)$/i
  },
  {
    id: 'SB-SEC-008',
    name: 'Sensitive Data in Logs',
    regex: /console\.(log|warn|error|info)\s*\([^)]*(?:password\s*[:=]|secret\s*[:=]|apiKey\s*[:=]|api_key\s*[:=]|privateKey\s*[:=]|private_key\s*[:=]|credential\s*[:=]|token\s*[:=])/i,
    severity: 'high',
    description: 'Password, token, or secret value being logged'
  },
  {
    id: 'SB-SEC-009',
    name: 'Committed .env File',
    regex: /./,
    severity: 'critical',
    description: '.env file committed to repository — environment secrets exposed',
    skipFiles: /\.env\.example$|\.env\.sample$|\.env\.template$|\.env\.local\.example$/i,
    pathOnly: true,
    pathRegex: /(^|[\\/])\.env$/
  },
  {
    id: 'SB-SEC-010',
    name: 'Secret in Comment',
    regex: /(?:\/\/|\/\*|\*|#)\s*(?:api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"`]?[a-zA-Z0-9_\-]{16,}/i,
    severity: 'high',
    description: 'Credential or secret value found in code comment'
  },
  {
    id: 'SB-SEC-011',
    name: 'Weak Cryptography',
    regex: /\bmd5\s*\(|\bsha1\s*\(|\bDES\b|\bRC4\b|\bTripleDES\b|\b3DES\b|\bcrypto\.createHash\s*\(\s*['"`][ms]d5['"`]|\bcrypto\.createHash\s*\(\s*['"`]sha1['"`]/i,
    severity: 'high',
    skipFiles: /security-pattern-scanner\.js$/i,
    description: 'Weak hash/cipher (MD5, SHA1, DES, RC4) — use SHA-256+ or AES'
  },
  {
    id: 'SB-SEC-012',
    name: 'ReDoS Risk',
    regex: /\(\[\^\]\]\*\)\*|\(\[\^\]\]\+\)\+|\(\[\^\]\]\*\)\+|\(\[\^\]\]\+\)\*|\(\(\?:\[\^\]\]\*\)\+\)\*|\(\[\^\]\]\*\)\{[0-9,]*\}\*|\(\[\^\]\]\*\)\*\+|\(\[\^\]\]\+\)\*\+|\(\[\^\]\]\*\)\?\*|\(\[\^\]\]\+\)\?\*/i,
    severity: 'medium',
    description: 'Regular expression with nested quantifiers — potential ReDoS'
  },
  {
    id: 'SB-SEC-013',
    name: 'CI/CD Secret Exposure',
    regex: /(?:GITHUB_TOKEN|GH_TOKEN|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|DOCKER_PASSWORD|NPM_TOKEN|SLACK_TOKEN|SONAR_TOKEN)\s*[:=]\s*['"`]?[^\s'"`]{8,}/i,
    severity: 'critical',
    description: 'Hardcoded CI/CD secret in workflow/config file',
    pathRegex: /\.(yml|yaml|json)$/
  },
  // === Advanced Cloud IAM & Secret Detection (ported from browser scanner) ===
  {
    id: 'SB-SEC-014',
    name: 'GCP Service Account Key',
    regex: /"type"\s*:\s*"service_account"|"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----|projects\/\d+\/secrets\/|GOOGLE_APPLICATION_CREDENTIALS\s*[:=]\s*['"`][^'"`]+['"`]/i,
    severity: 'critical',
    description: 'GCP service account key or credentials detected in source',
    skipFiles: /test|spec|fixture|mock|example|sample|placeholder|template/i
  },
  {
    id: 'SB-SEC-015',
    name: 'Azure Storage Key',
    regex: /AccountKey\s*=\s*[A-Za-z0-9+/=]{88}|DefaultEndpointsProtocol.*AccountKey\s*=\s*[A-Za-z0-9+/=]{50,}|AZURE_CLIENT_SECRET\s*[:=]\s*['"`][A-Za-z0-9_\-]{34,}['"`]/i,
    severity: 'critical',
    description: 'Azure storage account key or client secret detected in source',
    skipFiles: /test|spec|fixture|mock|example|sample|placeholder|template/i
  },
  {
    id: 'SB-SEC-016',
    name: 'OAuth Token in Source',
    regex: /(?:access_token|refresh_token|oauth_token)\s*[:=]\s*['"`](?:ya29\.|gh[opsu]_|xox[bpoa]-|sk_live_|rk_live_)[A-Za-z0-9_\-]{10,}/i,
    severity: 'high',
    description: 'Hardcoded OAuth access/refresh token from Google, GitHub, Slack, or Stripe',
    skipFiles: /test|spec|fixture|mock|example|sample|placeholder|template/i
  },
  // === Docker / Container Misconfiguration ===
  {
    id: 'SB-SEC-017',
    name: 'Docker Privileged Mode',
    regex: /privileged\s*:\s*true|--privileged/i,
    severity: 'high',
    description: 'Container running in privileged mode — grants full host access',
    skipFiles: /test|spec|fixture|mock|example/i,
    pathRegex: /docker-compose|compose\.ya?ml|Dockerfile|\.docker/i
  },
  {
    id: 'SB-SEC-018',
    name: 'Docker Root User',
    regex: /USER\s+root\b(?!.*(?:\s+#|\s*&&))/i,
    severity: 'medium',
    description: 'Container running as root user — privilege escalation risk',
    skipFiles: /test|spec|fixture|mock|example/i,
    pathRegex: /Dockerfile|dockerfile|\.docker/i
  },
  {
    id: 'SB-SEC-019',
    name: 'Docker Exposed Secrets',
    regex: /(?:ENV|environment)\s+(?:[A-Z_]*SECRET|[A-Z_]*PASSWORD|[A-Z_]*KEY|[A-Z_]*TOKEN)\s*=\s*['"]?[A-Za-z0-9_\-]{8,}['"]?(?!\s*\$\{)/i,
    severity: 'critical',
    description: 'Hardcoded secret in Docker ENV directive — visible in image layers',
    skipFiles: /test|spec|fixture|mock|example|sample|placeholder/i,
    snippetExclusions: /changeme|example|placeholder|your-secret|replace_me|XXXX/i
  },
  {
    id: 'SB-SEC-020',
    name: 'Docker Missing Health Check',
    regex: /FROM\s+/i,
    severity: 'low',
    description: 'Dockerfile has no HEALTHCHECK instruction — orchestrator cannot monitor container health',
    skipFiles: /test|spec|fixture|mock|example/i,
    pathRegex: /Dockerfile|dockerfile/i,
    negativeRegex: /HEALTHCHECK\s+/i
  },
  // === Supply Chain Checks ===
  {
    id: 'SB-SEC-021',
    name: 'Suspicious Package Install',
    regex: /(?:from\s+['"]|require\s*\(\s*['"]|import\s+['"])(?:[^'"]*npm[^'"]*|[^'"]*typosquat)[^'"]*['"]|(?:npm|yarn|pnpm)\s+install\s+[@a-z0-9_\-]+(?:[a-z0-9_\-]*\.js|\.nodejs|nodejs|nodjs|nodel|node-js)/i,
    severity: 'high',
    description: 'Suspicious npm package name — possible typosquat or malicious package',
    skipFiles: /test|spec|fixture|mock|example|package\.json|package-lock\.json|yarn\.lock/i
  },
  {
    id: 'SB-SEC-022',
    name: 'Malicious postinstall Script',
    regex: /"postinstall"\s*:\s*['"`](?:curl|wget|node\s+-e|python\s+-c|bash\s+-c|powershell|sh\s+-c)/i,
    severity: 'high',
    description: 'postinstall script executes network call or dynamic code — supply chain attack vector',
    skipFiles: /test|spec|fixture|mock|example/i
  },
  {
    id: 'SB-SEC-023',
    name: 'Unpinned Dependency Version',
    regex: /"(?:dependencies|devDependencies)"\s*:\s*\{[^}]*"[a-z@][^"]*"\s*:\s*['"`](?:\^|~|latest|\*|>=)/i,
    severity: 'medium',
    description: 'Dependency uses unpinned version (^, ~, latest, *) — reproducibility and supply chain risk',
    skipFiles: /test|spec|fixture|mock|example/i,
    pathRegex: /package\.json$/i
  }
];

function lineNumberAt(content, index) {
  return content.slice(0, Math.max(0, index)).split('\n').length;
}

function scanSecurityPatterns(relativePath, content, ext) {
  const issues = [];
  if (!SCANNABLE_EXTENSIONS.has(ext)) return issues;
  if (content.length > MAX_SCAN_BYTES) return issues;
  if (/simplebeacon-ignore/i.test(content.substring(0, 500))) return issues;

  const rel = String(relativePath).replace(/\\/g, '/');
  for (const rule of SECURITY_RULES) {
    if (rule.skipFiles && rule.skipFiles.test(rel)) continue;
    if (rule.pathRegex && !rule.pathRegex.test(rel)) continue;
    // negativeRegex: skip file if the negative pattern IS present (e.g., HEALTHCHECK exists)
    if (rule.negativeRegex && rule.negativeRegex.test(content)) continue;
    const matches = [];
    let match;
    if (rule.pathOnly) {
      matches.push({ line: 1, snippet: relativePath });
    } else {
      const regex = new RegExp(rule.regex.source, rule.regex.flags.replace('g', '') + 'g');
      while ((match = regex.exec(content)) !== null) {
        const line = lineNumberAt(content, match.index);
        const snippet = content.slice(match.index, match.index + 120).split('\n')[0];
        // Skip if snippet matches exclusion pattern (e.g., changeme, placeholder)
        if (rule.snippetExclusions && rule.snippetExclusions.test(snippet)) continue;
        matches.push({ line, snippet });
        if (matches.length >= 3) break;
      }
    }
    if (matches.length > 0) {
      issues.push({
        id: `${rule.id}-${relativePath}`,
        severity: rule.severity,
        type: RULE_TYPE_MAP[rule.id] || rule.name,
        filePath: relativePath,
        count: matches.length,
        description: `${relativePath}: ${rule.description}`,
        recommendedAction: 'Review and remediate the security issue',
        affectedFiles: [relativePath],
        matches
      });
    }
  }
  return issues;
}

module.exports = { scanSecurityPatterns, SECURITY_RULES };
