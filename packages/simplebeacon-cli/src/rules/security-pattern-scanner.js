// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Security pattern scanner — ports browser security patterns to CLI.
 * Detects eval, XSS, prototype pollution, unvalidated redirects,
 * missing rate limits, insecure random, and secret logging.
 */

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.php', '.rb', '.go', '.java'
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
  'SB-SEC-014': 'hardcoded-payment-key',
  'SB-SEC-015': 'hardcoded-cloud-key'
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
  {
    id: 'SB-SEC-014',
    name: 'Hardcoded Payment Provider Key',
    regex: /(?:sk_live_[a-zA-Z0-9]{24,}|sk_test_[a-zA-Z0-9]{24,}|rk_live_[a-zA-Z0-9]{24,}|pk_live_[a-zA-Z0-9]{24,})/,
    severity: 'critical',
    description: 'Hardcoded Stripe key in source code — rotate immediately and move to env/secret manager',
    skipFiles: /security-pattern-scanner\.js$|simplebeacon-fix-standalone\.cjs$|test-poisoned-pipeline\.cjs$/i
  },
  {
    id: 'SB-SEC-015',
    name: 'Hardcoded Cloud Provider Key',
    regex: /(?:AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{35}|ya29\.[0-9A-Za-z_\-]+)/,
    severity: 'critical',
    description: 'Hardcoded AWS/Google Cloud key in source code — rotate immediately and move to env/secret manager',
    skipFiles: /security-pattern-scanner\.js$|secret-in-comments-scanner\.js$|simplebeacon-fix-standalone\.cjs$|test-poisoned-pipeline\.cjs$/i
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
    const matches = [];
    let match;
    if (rule.pathOnly) {
      matches.push({ line: 1, snippet: relativePath });
    } else {
      const regex = new RegExp(rule.regex.source, rule.regex.flags.replace('g', '') + 'g');
      while ((match = regex.exec(content)) !== null) {
        const line = lineNumberAt(content, match.index);
        const snippet = content.slice(match.index, match.index + 120).split('\n')[0];
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
