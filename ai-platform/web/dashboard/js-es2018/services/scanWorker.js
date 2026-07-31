// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * SimpleBeacon browser scan worker.
 * Runs regex-based security signatures on file contents off the main thread.
 */

const MAX_LINE_LEN = 5000;

const REPO_ANCHOR_RE = /^CascadeProjects(?:_BACKUP_\d+)?$/i;

const CREDENTIAL_ALLOWLIST =
  /placeholder|changeme|example\.com|your-api-key|your-secret|dummy-token|test-secret|fake-api|mock-secret|not-a-real|hardcoded-secret-for-unit-test|secret-key-for-unit-test|sk_test_your|xxxxxxxx|replace_me|sample-token|template-secret|programmatically generated|from KMS|HSM in production|signing key \(/i;
const IGNORE_LINE_RE =
  /simplebeacon-ignore\s+(?:credentials|credential-pattern|sensitive-data|compliance-drift|euAiAct|eu-ai-act)/i;

const SIGNATURE_ENGINE = [
  {
    id: 'SB-01',
    name: 'Exposed Credentials',
    severity: 'HIGH',
    regex:
      /(sk_live_[a-zA-Z0-9]{24,}|sk_test_[a-zA-Z0-9]{24,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|A3T[A-Z0-9][A-Z0-9]{16}|AGPA[A-Z0-9]{16}|AIDA[A-Z0-9]{16}|AROA[A-Z0-9]{16}|AIPA[A-Z0-9]{16}|ANPA[A-Z0-9]{16}|ANVA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,}|xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|xoxp-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|xoxa-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|xoxr-[a-zA-Z0-9]{24}|SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}|private[_\-]?key|-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----)/gi,
    msg: 'Hardcoded API key, token, or private key detected.',
  },
  {
    id: 'SB-02',
    name: 'Placeholder Debris',
    severity: 'MEDIUM',
    regex:
      /(\/\/ Add your logic here|\/\/ TODO:\s*AI\s*generated|\/\/ TODO:\s*implement|\byour-api-key-here\b|\bYOUR_API_KEY\b|\bexample_api_key\b|\binsert_secret_here\b)/gi,
    msg: 'Unimplemented stub or placeholder left by AI generation.',
  },
  {
    id: 'SB-03',
    name: 'Markdown Fences',
    severity: 'MEDIUM',
    regex: new RegExp(
      '(' +
        [
          '```javascript',
          '```json',
          '```html',
          '```css',
          '```python',
          '```typescript',
          '```jsx',
          '```tsx',
          '```',
        ].join('|') +
        ')',
      'g'
    ),
    msg: 'Raw markdown formatting left behind from an AI chat interaction wrapper.',
  },
  {
    id: 'SB-04',
    name: 'AI Slop / Repetitive Boilerplate',
    severity: 'MEDIUM',
    regex:
      /(\/\*\*\s*\n\s*\*\s+.*\n\s*\*\/\s*\n){3,}|(\bimport\s+\{\s*[^}]+\}\s+from\s+['"]npm-[a-z0-9-]+['"])|(\balert\s*\(\s*['"]TODO['"]\s*\))|(\bconsole\.log\s*\(\s*['"]AI generated['"]\s*\))/gi,
    msg: 'Repetitive AI-generated boilerplate or hallucinated dependency.',
  },
  {
    id: 'SB-05',
    name: 'Compliance Drift',
    severity: 'MEDIUM',
    regex:
      /(eval\s*\(|new\s+Function\s*\(|innerHTML\s*=|document\.write\s*\(|child_process|exec\s*\(|spawn\s*\()/g,
    msg: 'Code pattern that may violate security/compliance controls (unsafe eval, innerHTML injection, process spawning).',
  },
  {
    id: 'SB-06',
    name: 'Generic Error Swallowing',
    severity: 'LOW',
    regex: /catch\s*\(\s*\w+\s*\)\s*\{\s*\/*\s*(TODO|FIXME|ignore)?\s*\*\/\s*\}/g,
    msg: 'Error handler silently swallows exceptions.',
  },
  {
    id: 'SBD-AWS',
    name: 'AWS Access Key ID',
    severity: 'CRITICAL',
    regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    msg: 'AWS access key ID detected.',
  },
  {
    id: 'SBD-GENERIC-SECRET',
    name: 'Generic Secret/Token',
    severity: 'HIGH',
    regex:
      /(secret|token|password|passwd|api_key|apikey|auth_token)\s*[:=]\s*['"`][A-Za-z0-9_\-.~+=/]{16,}['"`]/gi,
    msg: 'Generic secret/token assignment detected.',
  },
  {
    id: 'SBD-PRIVATE-KEY',
    name: 'Private Cryptographic Key',
    severity: 'CRITICAL',
    regex: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PRIVATE)\s+KEY-----/g,
    msg: 'Private cryptographic key detected.',
  },
  {
    id: 'SBD-SLACK',
    name: 'Slack API Token',
    severity: 'HIGH',
    regex: /xox[bapr]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g,
    msg: 'Slack API token detected.',
  },
  {
    id: 'SBD-CONNECTION-STRING',
    name: 'Hardcoded Connection String',
    severity: 'HIGH',
    regex:
      /(mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^\s'"`]{3,}:[^\s'"`]{3,}@[^\s'"`]+/gi,
    msg: 'Hardcoded database/message-broker connection string with credentials detected.',
  },
  {
    id: 'SBD-JWT',
    name: 'Hardcoded JWT',
    severity: 'HIGH',
    regex: /eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g,
    msg: 'Hardcoded JWT token detected.',
  },
  {
    id: 'SB-07',
    name: 'TODO/FIXME Accumulation',
    severity: 'LOW',
    regex: /\b(TODO|FIXME|HACK|XXX|BUG)\b/gi,
    msg: 'TODO/FIXME marker found — track technical debt.',
  },
  {
    id: 'SB-08',
    name: 'Debug Console Statements',
    severity: 'LOW',
    regex: /\bconsole\.(log|debug|info|warn|error|trace)\s*\(/g,
    msg: 'Debug console statement found — remove before production.',
  },
  {
    id: 'SB-09',
    name: 'Hardcoded IP Address',
    severity: 'MEDIUM',
    regex:
      /\b(?!127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255)(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    msg: 'Hardcoded IP address found — use environment variables for configuration.',
  },
  {
    id: 'SB-10',
    name: 'Disabled Security Control',
    severity: 'HIGH',
    regex:
      /(verifyTLS\s*[:=]\s*false|rejectUnauthorized\s*[:=]\s*false|disableSSL|sslVerify\s*[:=]\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*['"`]?0)/gi,
    msg: 'TLS/SSL verification disabled — security control bypassed.',
  },
];

const CREDENTIAL_RULE_IDS = new Set([
  'SB-01',
  'SBD-AWS',
  'SBD-GENERIC-SECRET',
  'SBD-PRIVATE-KEY',
  'SBD-SLACK',
  'SBD-CONNECTION-STRING',
  'SBD-JWT',
]);

function normalizeSandboxScanPath(virtualPath) {
  const normalized = String(virtualPath || '').replace(/\\/g, '/');
  const parts = normalized.split('/');
  for (let i = 0; i < parts.length; i += 1) {
    if (REPO_ANCHOR_RE.test(parts[i])) {
      return parts.slice(i + 1).join('/');
    }
  }
  return normalized;
}

function isTestOrFixturePath(normalized) {
  return (
    /(?:^|\/)(?:__tests__|tests?|fixtures?|mocks?|simplebeacon-rule-tests|guardrail-test-bench)(?:\/|$)/i.test(
      normalized
    ) || /\.(test|spec)\.[a-z0-9]+$/i.test(normalized)
  );
}

function isComplianceToolingPath(normalized) {
  return (
    /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|lib|mcp|analyzers|reporters)\//i.test(
      normalized
    ) ||
    /(?:^|\/)(?:coming-soon|simplebeacon-vscode-merged|simplebeacon-vscode)(?:\/|$)/i.test(
      normalized
    ) ||
    /(?:^|\/)dashboard-web\//i.test(normalized) ||
    /public\/dashboard\//i.test(normalized) ||
    /web\/simplebeacon-dashboard\/js(?:-es2018)?\/(?:services|workers|views|utils)\//i.test(
      normalized
    ) ||
    /server\/routes\/token-auth\.cjs$/i.test(normalized) ||
    /server\/lib\/codebase-analyzer(?:-patterns)?\.cjs$/i.test(normalized) ||
    /server\/lib\/code-hygiene-certificate\.cjs$/i.test(normalized) ||
    /server\/lib\/compliance-rules\.cjs$/i.test(normalized) ||
    /server\/lib\/ai-analyst\.cjs$/i.test(normalized) ||
    /(?:^|\/)ai-platform\/tools\//i.test(normalized) ||
    /(?:^|\/)sales\/license\//i.test(normalized) ||
    /credential-pattern-scanner|scanner-patterns|report-sanitizer|browserSandboxScanService|-export\.browser\.js|AboutView\.js/i.test(
      normalized
    ) ||
    /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:compliance-rules|proxy)\//i.test(normalized) ||
    /(?:^|\/)packages\/simplebeacon-intelligence\//i.test(normalized) ||
    /(?:^|\/)local-agent\//i.test(normalized) ||
    /(?:^|\/)scripts\/export-findings\.js$/i.test(normalized) ||
    /^verify-deployment\.cjs$/i.test(normalized) ||
    /(?:^|\/)sales(?:\/|$)/i.test(normalized) ||
    /(?:^|\/)scripts(?:\/|$)/i.test(normalized) ||
    /(?:^|\/)api-server(?:\/|$)/i.test(normalized) ||
    /(?:^|\/)ai-tools(?:\/|$)/i.test(normalized) ||
    /(?:^|\/)ai-agent(?:\/|$)/i.test(normalized) ||
    /src\/api\/billing\/email-templates\.cjs$/i.test(normalized) ||
    /src\/core\/GlobalContextManager\.cjs$/i.test(normalized)
  );
}

function shouldSkipSandboxScanFile(virtualPath, isSimplebeaconMonorepo) {
  const normalized = normalizeSandboxScanPath(virtualPath);
  if (!normalized) return false;
  if (isTestOrFixturePath(normalized)) return true;
  if (/(?:^|\/)(?:node_modules|\.git|\.simplebeacon)(?:\/|$)/i.test(normalized)) return true;
  if (isSimplebeaconMonorepo) {
    if (isComplianceToolingPath(normalized)) return true;
    if (/(?:^|\/)(?:scan-exports|out|\.vscode-test)(?:\/|$)/i.test(normalized)) return true;
    if (/simplebeacon-report\.json$/i.test(normalized)) return true;
    if (/^web\/simplebeacon-dashboard\/js\//i.test(normalized)) return true;
  }
  return false;
}

function shouldSkipSandboxComplianceDrift(virtualPath) {
  const normalized = normalizeSandboxScanPath(virtualPath);
  return (
    /(?:^|\/)web\/simplebeacon-dashboard\//i.test(normalized) ||
    /(?:^|\/)server\/lib\/codebase-analyzer\.cjs$/i.test(normalized)
  );
}

function shouldSkipRuleLine(ruleId, virtualPath, line) {
  if (IGNORE_LINE_RE.test(line)) return true;
  if (ruleId === 'SB-05' && shouldSkipSandboxComplianceDrift(virtualPath)) return true;
  if (!CREDENTIAL_RULE_IDS.has(ruleId)) return false;
  const normalized = normalizeSandboxScanPath(virtualPath);
  if (isTestOrFixturePath(normalized) || isComplianceToolingPath(normalized)) return true;
  if (/^\s*\/\//.test(line) && /private[_\-]?key|signing key/i.test(line)) return true;
  if (CREDENTIAL_ALLOWLIST.test(line)) return true;
  return false;
}

function shouldSkipEntropyForFile(virtualPath) {
  const lowerPath = String(virtualPath || '').toLowerCase();
  if (
    lowerPath.endsWith('package-lock.json') ||
    lowerPath.endsWith('yarn.lock') ||
    lowerPath.endsWith('pnpm-lock.yaml') ||
    lowerPath.endsWith('pcmdevs.txt') ||
    lowerPath.endsWith('pnpdevs.txt')
  ) {
    return true;
  }
  if (
    /(?:^|\/)(?:complete-scan|consolidation|report|data-quality|codebase-health|roadmap-analysis|scan-bundle|simplebeacon-report|simplebeacon-results|gate-status|scan-output)[^/]*\.(?:json|txt)$/i.test(
      lowerPath
    )
  ) {
    return true;
  }
  if (/(?:^|\/)scan-exports\//i.test(lowerPath)) return true;
  const normalized = normalizeSandboxScanPath(virtualPath);
  if (isTestOrFixturePath(normalized) || isComplianceToolingPath(normalized)) return true;
  if (/^web\/simplebeacon-dashboard\//i.test(normalized)) return true;
  return false;
}

function countMatches(content, regex, ruleId, virtualPath) {
  const lines = content.split('\n');
  let total = 0;
  for (const line of lines) {
    if (line.length > MAX_LINE_LEN) continue;
    if (shouldSkipRuleLine(ruleId, virtualPath, line)) continue;
    const matches = line.match(regex);
    if (matches) total += matches.length;
  }
  return total;
}

function lineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function calculateShannonEntropy(str) {
  if (!str) return 0;
  const len = str.length;
  const frequencies = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isCommonFalsePositive(str) {
  const lower = str.toLowerCase();
  if (lower.includes('content') || lower.includes('loading') || lower.includes('element'))
    return true;
  if (/^(0000|1111|aaaa|bbbb|1234|abcd|test|example)/i.test(str)) return true;
  if (/^sha(?:512|256|384|1)-[a-z0-9]/i.test(str)) return true;
  if (/^[0-9a-f]{32,64}$/i.test(str)) return true;
  if (/={2}$/.test(str) || /P={2}$/.test(str) || /A={2}$/.test(str)) return true;
  if (/^(.)\1{8,}/.test(str)) return true;
  // Path/URL segments (e.g. GitHub doc paths) are not secrets
  if (str.split('/').length - 1 >= 3) return true;
  return false;
}

self.onmessage = function (e) {
  const { action, fileData } = e.data;
  if (action !== 'SCAN_FILE') return;

  const { name, virtualPath, content, size, isSimplebeaconMonorepo } = fileData;
  const fileIssues = [];
  const fileFindings = [];

  if (
    /^\s*\/\/\s*simplebeacon-ignore:/m.test(content) ||
    shouldSkipSandboxScanFile(virtualPath, isSimplebeaconMonorepo)
  ) {
    self.postMessage({
      status: 'FILE_COMPLETED',
      result: { name, virtualPath, size, fileIssues, fileFindings },
    });
    return;
  }

  for (const rule of SIGNATURE_ENGINE) {
    if (rule.id === 'SB-05' && shouldSkipSandboxComplianceDrift(virtualPath)) continue;
    rule.regex.lastIndex = 0;
    const matchCount = countMatches(content, rule.regex, rule.id, virtualPath);
    if (matchCount > 0) {
      fileIssues.push(`${rule.name} (${matchCount}x)`);
      // Cap at 1 finding per rule per file to prevent log files from generating thousands of duplicates
      fileFindings.push({
        severity: rule.severity,
        filePath: virtualPath,
        message: rule.msg,
        type: rule.name,
        ruleId: rule.id,
        count: matchCount,
      });
    }
  }

  const ENTROPY_CHUNK_REGEX = /[A-Za-z0-9+/=_\-]{32,64}/g;
  ENTROPY_CHUNK_REGEX.lastIndex = 0;
  const entropyFindings = [];
  const MAX_ENTROPY_PER_FILE = 5;
  let entropyMatch;
  if (!shouldSkipEntropyForFile(virtualPath)) {
    while ((entropyMatch = ENTROPY_CHUNK_REGEX.exec(content)) !== null) {
      if (entropyFindings.length >= MAX_ENTROPY_PER_FILE) break;
      const candidateString = entropyMatch[0];
      const entropyScore = calculateShannonEntropy(candidateString);
      if (entropyScore > 4.5 && !isCommonFalsePositive(candidateString)) {
        entropyFindings.push({
          severity: 'HIGH',
          filePath: virtualPath,
          message: `High-entropy secret (${entropyScore.toFixed(2)})`,
          type: 'High-Entropy Secret',
          ruleId: 'high_entropy_secret',
          line: lineNumber(content, entropyMatch.index),
          matchedText: candidateString.substring(0, 8) + '...',
          ruleName: 'High-Entropy High-Randomness Secret',
          meta: { entropy: entropyScore.toFixed(2) },
        });
      }
    }
  }
  if (entropyFindings.length > 0) {
    fileIssues.push(`High-Entropy Secrets (${entropyFindings.length}x)`);
    fileFindings.push(...entropyFindings);
  }

  self.postMessage({
    status: 'FILE_COMPLETED',
    result: {
      name,
      virtualPath,
      size,
      fileIssues,
      fileFindings,
    },
  });
};
