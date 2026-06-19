/**
 * Security pattern scanner — ports browser security patterns to CLI.
 * Detects eval, XSS, prototype pollution, unvalidated redirects,
 * missing rate limits, insecure random, and secret logging.
 */

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.php', '.rb', '.go', '.java'
]);

const MAX_SCAN_BYTES = 512000;

const SECURITY_RULES = [
  {
    id: 'SB-SEC-001',
    name: 'Dangerous eval() Usage',
    regex: /\beval\s*\(|\bnew\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]|child_process\.exec\s*\(|shell\.exec\s*\(|\bsystem\s*\(/i,
    severity: 'high',
    skipFiles: /security-pattern-scanner\.js$|enhancedAIProvider\.ts$/i,
    description: 'eval(), new Function(), or dynamic code execution — code injection risk'
  },
  {
    id: 'SB-SEC-002',
    name: 'innerHTML XSS Risk',
    regex: /\.innerHTML\s*=\s*[^'"]/i,
    severity: 'medium',
    description: 'Assigning to innerHTML without sanitization — XSS risk'
  },
  {
    id: 'SB-SEC-003',
    name: 'Prototype Pollution Risk',
    regex: /Object\.prototype\.|__proto__\s*[:=]|\['__proto__'\]\s*:/i,
    severity: 'high',
    description: 'Modifying Object.prototype or __proto__ — prototype pollution vulnerability'
  },
  {
    id: 'SB-SEC-004',
    name: 'Unhandled Promise Rejection',
    regex: /\.(then|catch|finally)\s*\([^)]*\)(?!\s*\.(catch|then|finally))\s*;?\s*$/m,
    severity: 'medium',
    description: 'Promise chain missing .catch() handler — unhandled rejection'
  },
  {
    id: 'SB-SEC-005',
    name: 'Unvalidated Redirect',
    regex: /window\.location\s*=\s*[^'"]|window\.location\.href\s*=\s*[^'"]|window\.location\.replace\s*\(\s*[^'"]|res\.redirect\s*\(\s*[^'"']|res\.redirect\s*\(\s*req\.(body|query|params)\.|location\.href\s*=\s*req\./i,
    severity: 'high',
    description: 'Redirect with user-controlled input — open redirect vulnerability'
  },
  {
    id: 'SB-SEC-006',
    name: 'Missing Rate Limiting',
    regex: /app\.(get|post|put|delete|patch)\s*\([^)]*\)(?!.*rateLimit|.*throttle|.*limiter)/i,
    severity: 'medium',
    description: 'API endpoint without rate limiting — DoS vulnerability'
  },
  {
    id: 'SB-SEC-007',
    name: 'Insecure Random for Security',
    regex: /Math\.random\s*\(\)(?=.*(?:token|password|secret|salt|nonce|uuid|id|key))/i,
    severity: 'high',
    description: 'Math.random() used for crypto/security — predictable values',
    skipFiles: /security-pattern-scanner\.js$/i
  },
  {
    id: 'SB-SEC-008',
    name: 'Sensitive Data in Logs',
    regex: /console\.(log|warn|error|info)\s*\([^)]*(?:password\s*[:=]|secret\s*[:=]|apiKey\s*[:=]|api_key\s*[:=]|privateKey\s*[:=]|private_key\s*[:=]|credential\s*[:=]|token\s*[:=])/i,
    severity: 'high',
    description: 'Password, token, or secret value being logged'
  }
];

function lineNumberAt(content, index) {
  return content.slice(0, Math.max(0, index)).split('\n').length;
}

function scanSecurityPatterns(relativePath, content, ext) {
  const issues = [];
  if (!SCANNABLE_EXTENSIONS.has(ext)) return issues;
  if (content.length > MAX_SCAN_BYTES) return issues;

  for (const rule of SECURITY_RULES) {
    if (rule.skipFiles && rule.skipFiles.test(relativePath)) continue;
    const matches = [];
    let match;
    const regex = new RegExp(rule.regex.source, rule.regex.flags.replace('g', '') + 'g');
    while ((match = regex.exec(content)) !== null) {
      const line = lineNumberAt(content, match.index);
      const snippet = content.slice(match.index, match.index + 120).split('\n')[0];
      matches.push({ line, snippet });
      if (matches.length >= 3) break;
    }
    if (matches.length > 0) {
      issues.push({
        id: `${rule.id}-${relativePath}`,
        severity: rule.severity,
        type: rule.name,
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
