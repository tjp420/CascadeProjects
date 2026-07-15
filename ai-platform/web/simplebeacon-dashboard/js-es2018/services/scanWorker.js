// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * SimpleBeacon browser scan worker.
 * Runs regex-based security signatures on file contents off the main thread.
 */

const MAX_LINE_LEN = 5000;

const SIGNATURE_ENGINE = [
  {
    id: 'SB-01',
    name: 'Exposed Credentials',
    severity: 'HIGH',
    regex: /(sk_live_[a-zA-Z0-9]{24,}|sk_test_[a-zA-Z0-9]{24,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|A3T[A-Z0-9][A-Z0-9]{16}|AGPA[A-Z0-9]{16}|AIDA[A-Z0-9]{16}|AROA[A-Z0-9]{16}|AIPA[A-Z0-9]{16}|ANPA[A-Z0-9]{16}|ANVA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,}|xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|xoxp-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|xoxa-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}|xoxr-[a-zA-Z0-9]{24}|SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}|private[_\-]?key|-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----)/gi,
    msg: 'Hardcoded API key, token, or private key detected.'
  },
  {
    id: 'SB-02',
    name: 'Placeholder Debris',
    severity: 'MEDIUM',
    regex: /(\/\/ Add your logic here|\/\/ TODO:\s*AI\s*generated|\/\/ TODO:\s*implement|\byour-api-key-here\b|\bYOUR_API_KEY\b|\bexample_api_key\b|\binsert_secret_here\b)/gi,
    msg: 'Unimplemented stub or placeholder left by AI generation.'
  },
  {
    id: 'SB-03',
    name: 'Markdown Fences',
    severity: 'MEDIUM',
    regex: new RegExp('(' + ['```javascript', '```json', '```html', '```css', '```python', '```typescript', '```jsx', '```tsx', '```'].join('|') + ')', 'g'),
    msg: 'Raw markdown formatting left behind from an AI chat interaction wrapper.'
  },
  {
    id: 'SB-04',
    name: 'AI Slop / Repetitive Boilerplate',
    severity: 'MEDIUM',
    regex: /(\/\*\*\s*\n\s*\*\s+.*\n\s*\*\/\s*\n){3,}|(\bimport\s+\{\s*[^}]+\}\s+from\s+['"]npm-[a-z0-9-]+['"])|(\balert\s*\(\s*['"]TODO['"]\s*\))|(\bconsole\.log\s*\(\s*['"]AI generated['"]\s*\))/gi,
    msg: 'Repetitive AI-generated boilerplate or hallucinated dependency.'
  },
  {
    id: 'SB-05',
    name: 'Compliance Drift',
    severity: 'MEDIUM',
    regex: /(eval\s*\(|new\s+Function\s*\(|innerHTML\s*=|document\.write\s*\(|child_process|exec\s*\(|spawn\s*\()/g,
    msg: 'Code pattern that may violate security/compliance controls (unsafe eval, innerHTML injection, process spawning).'
  },
  {
    id: 'SB-06',
    name: 'Generic Error Swallowing',
    severity: 'LOW',
    regex: /catch\s*\(\s*\w+\s*\)\s*\{\s*\/*\s*(TODO|FIXME|ignore)?\s*\*\/\s*\}/g,
    msg: 'Error handler silently swallows exceptions.'
  },
  {
    id: 'SBD-AWS',
    name: 'AWS Access Key ID',
    severity: 'CRITICAL',
    regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    msg: 'AWS access key ID detected.'
  },
  {
    id: 'SBD-GENERIC-SECRET',
    name: 'Generic Secret/Token',
    severity: 'HIGH',
    regex: /(secret|token|password|passwd|api_key|apikey|auth_token)\s*[:=]\s*['"`][A-Za-z0-9_\-.~+=/]{16,}['"`]/gi,
    msg: 'Generic secret/token assignment detected.'
  },
  {
    id: 'SBD-PRIVATE-KEY',
    name: 'Private Cryptographic Key',
    severity: 'CRITICAL',
    regex: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PRIVATE)\s+KEY-----/g,
    msg: 'Private cryptographic key detected.'
  },
  {
    id: 'SBD-SLACK',
    name: 'Slack API Token',
    severity: 'HIGH',
    regex: /xox[bapr]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g,
    msg: 'Slack API token detected.'
  }
];

function countMatches(content, regex) {
  const lines = content.split('\n');
  let total = 0;
  for (const line of lines) {
    if (line.length > MAX_LINE_LEN) continue;
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
  if (lower.includes('content') || lower.includes('loading') || lower.includes('element')) return true;
  if (/^(0000|1111|aaaa|bbbb|1234|abcd|test|example)/i.test(str)) return true;
  // npm integrity hashes: sha512-XXXX, sha256-XXXX
  if (/^sha(?:512|256|384|1)-[a-z0-9]/i.test(str)) return true;
  // Hex-only strings (device IDs, hash digests) — no mixed-case alpha
  if (/^[0-9a-f]{32,64}$/i.test(str)) return true;
  // Base64 padding-heavy strings (JSON content blocks)
  if (/={2}$/.test(str) || /P={2}$/.test(str) || /A={2}$/.test(str)) return true;
  // Repeated character patterns (device ID fragments)
  if (/^(.)\1{8,}/.test(str)) return true;
  return false;
}

self.onmessage = function (e) {
  const { action, fileData } = e.data;
  if (action !== 'SCAN_FILE') return;

  const { name, virtualPath, content, size } = fileData;
  const fileIssues = [];
  const fileFindings = [];

  for (const rule of SIGNATURE_ENGINE) {
    rule.regex.lastIndex = 0;
    const matchCount = countMatches(content, rule.regex);
    if (matchCount > 0) {
      fileIssues.push(`${rule.name} (${matchCount}x)`);
      for (let i = 0; i < matchCount; i += 1) {
        fileFindings.push({
          severity: rule.severity,
          filePath: virtualPath,
          message: rule.msg
        });
      }
    }
  }

  // Entropy-based secret detection for high-randomness strings that rigid
  // regexes typically miss.
  // Skip entropy scanning for file types that are predominantly high-entropy data
  // (lock files, prior scan reports, Windows device ID text files).
  const lowerPath = (virtualPath || '').toLowerCase();
  const skipEntropyForFile =
    lowerPath.endsWith('package-lock.json') ||
    lowerPath.endsWith('yarn.lock') ||
    lowerPath.endsWith('pnpm-lock.yaml') ||
    lowerPath.endsWith('pcmdevs.txt') ||
    lowerPath.endsWith('pnpdevs.txt') ||
    /(?:^|\/)(?:complete-scan|consolidation|report|data-quality|codebase-health|roadmap-analysis|scan-bundle)[^/]*\.json$/i.test(lowerPath);
  const ENTROPY_CHUNK_REGEX = /[A-Za-z0-9+/=_\-]{32,64}/g;
  ENTROPY_CHUNK_REGEX.lastIndex = 0;
  const entropyFindings = [];
  const MAX_ENTROPY_PER_FILE = 5;
  let entropyMatch;
  if (!skipEntropyForFile) {
  while ((entropyMatch = ENTROPY_CHUNK_REGEX.exec(content)) !== null) {
    if (entropyFindings.length >= MAX_ENTROPY_PER_FILE) break;
    const candidateString = entropyMatch[0];
    const entropyScore = calculateShannonEntropy(candidateString);
    if (entropyScore > 4.5 && !isCommonFalsePositive(candidateString)) {
      entropyFindings.push({
        severity: 'HIGH',
        filePath: virtualPath,
        message: `High-entropy secret (${entropyScore.toFixed(2)})`,
        line: lineNumber(content, entropyMatch.index),
        matchedText: candidateString.substring(0, 8) + '...',
        ruleId: 'high_entropy_secret',
        ruleName: 'High-Entropy High-Randomness Secret',
        meta: { entropy: entropyScore.toFixed(2) }
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
      fileFindings
    }
  });
};
