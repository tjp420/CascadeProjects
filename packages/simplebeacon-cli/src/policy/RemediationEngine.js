const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STRUCTURAL_RULES = [
  {
    id: 'SB-FIX-MARKDOWN-FENCE',
    category: 'markdown',
    description: 'Remove stray markdown code fences from source files',
    pattern: /(^```[a-zA-Z]*\r?\n|```\r?\n?$)/g
  },
  {
    id: 'SB-FIX-LLM-PREAMBLE',
    category: 'markdown',
    description: 'Strip LLM prompt preamble headers',
    pattern: /^(here is your updated component|here is the complete code|sure, here is|i have modified the code)[\s\S]*?\r?\n/i
  },
  {
    id: 'SB-FIX-LLM-EPILOGUE',
    category: 'markdown',
    description: 'Strip LLM closing/summary text at end of files',
    pattern: /\r?\n+(let me know|hope this helps|feel free to|this should|note that|important:|a few things|key changes|changes made|in this (updated|modified) version)[^\n]*(\r?\n[^\n]*){0,5}\s*$/i
  },
  {
    id: 'SB-FIX-LLM-EXPLANATION',
    category: 'slop',
    description: 'Strip LLM explanatory block comments at start of functions',
    pattern: /\/\*[\s\S]*?\*\/(?=\s*(function|const|let|var|class|export|async)\s)/g
  },
  {
    id: 'SB-FIX-SLOP-PLACEHOLDER',
    category: 'slop',
    description: 'Remove LLM placeholder TODO comment lines',
    pattern: /\/\/\s*TODO:\s*(implement the rest|add actual validation|your business logic here).*$/gim
  },
  {
    id: 'SB-FIX-DEBUG-CONSOLE',
    category: 'debug',
    description: 'Remove console.log/debug statements from production code',
    pattern: /console\.(log|debug|info|warn)\([^)]*\);?\r?\n?/g
  },
  {
    id: 'SB-FIX-DEBUGGER-STMT',
    category: 'debug',
    description: 'Remove debugger; statements',
    pattern: /^[ \t]*debugger;\r?\n?/gm
  },
  {
    id: 'SB-FIX-EMPTY-CATCH',
    category: 'slop',
    description: 'Flag empty catch blocks with TODO comments',
    pattern: /catch\s*\([^)]*\)\s*\{\s*(\/\/\s*TODO:[^\n]*|\/\/\s*handle[^\n]*)?\s*\}/g
  },
  {
    id: 'SB-FIX-TOKEN-STRIPE',
    category: 'tokens',
    description: 'Quarantine Stripe live secret key',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
    keyType: 'STRIPE_KEY'
  },
  {
    id: 'SB-FIX-TOKEN-AWS',
    category: 'tokens',
    description: 'Quarantine AWS access key ID',
    pattern: /AKIA[0-9A-Z]{16}/g,
    keyType: 'AWS_KEY'
  },
  {
    id: 'SB-FIX-TOKEN-GENERIC',
    category: 'tokens',
    description: 'Quarantine generic secret_key assignment',
    pattern: /secret_key\s*=\s*['"][a-zA-Z0-9_\-]{16,}['"]/g,
    keyType: 'GENERIC_SECRET'
  },
  {
    id: 'SB-FIX-TOKEN-GOOGLE',
    category: 'tokens',
    description: 'Quarantine Google API key',
    pattern: /AIza[0-9A-Za-z_\-]{35}/g,
    keyType: 'GOOGLE_KEY'
  },
  {
    id: 'SB-FIX-TOKEN-SLACK',
    category: 'tokens',
    description: 'Quarantine Slack bot/user token',
    pattern: /xox[abp]-[0-9a-zA-Z]{10,}-[0-9a-zA-Z]{10,}-[0-9a-zA-Z]{10,}/g,
    keyType: 'SLACK_TOKEN'
  }
];

const LEGACY_RULES = [
  {
    id: 'RULE_AI_045',
    category: 'markdown',
    description: 'Remove stray markdown code fences from source files',
    pattern: /^[ \t]*```+[ \t]*\r?$/gm,
    replacement: ''
  },
  {
    id: 'RULE_SEC_020',
    category: 'tokens',
    description: 'Redact hard-coded API tokens and secrets',
    pattern: /\b(sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36,}|glpat-[a-zA-Z0-9-]{20,}|xox[abp]-[a-zA-Z0-9-]+)\b/gi,
    replacement: '<REDACTED>'
  }
];

const DEFAULT_RULES = [...STRUCTURAL_RULES, ...LEGACY_RULES];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function detectLineEnding(content) {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
  if (crlfCount > 0 && lfCount === 0) return 'crlf';
  if (crlfCount === 0 && lfCount > 0) return 'lf';
  if (crlfCount > 0 && lfCount > 0) return 'mixed';
  return 'lf';
}

function restoreLineEndings(content, originalEnding) {
  if (originalEnding === 'crlf') {
    return content.replace(/\r?\n/g, '\r\n');
  }
  return content.replace(/\r\n/g, '\n');
}

class RemediationEngine {
  constructor(rules = DEFAULT_RULES) {
    this.rules = rules;
    this.tokensQuarantined = 0;
  }

  processBuffer(content, fileName = 'buffer') {
    if (typeof content !== 'string') {
      throw new TypeError('content must be a string');
    }
    let result = content;
    const applied = [];
    const matchCounts = {};
    const quarantine = [];
    for (const rule of this.rules) {
      if (rule.enabled === false) continue;
      if (!(rule.pattern instanceof RegExp)) continue;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      if (rule.keyType) {
        const matches = [];
        let match;
        while ((match = regex.exec(result)) !== null) {
          matches.push({ index: match.index, value: match[0] });
          if (match[0].length === 0) {
            regex.lastIndex += 1;
          }
        }
        if (matches.length === 0) continue;
        const base = this.tokensQuarantined;
        for (let i = matches.length - 1; i >= 0; i -= 1) {
          const m = matches[i];
          const idx = base + i;
          const envVarName = `SIMPLEBEACON_QUARANTINE_${rule.keyType}_${idx}`;
          const replacement = `process.env.${envVarName} /* ERROR: ${rule.keyType} removed by simplebeacon fix — set this env var before running */`;
          result = result.slice(0, m.index) + replacement + result.slice(m.index + m.value.length);
          quarantine.push(`${envVarName}="${m.value}"`);
        }
        this.tokensQuarantined += matches.length;
        applied.push(rule.id);
        matchCounts[rule.id] = matches.length;
      } else {
        const replacement = typeof rule.replacement === 'string' ? rule.replacement : '';
        let count = 0;
        const next = result.replace(regex, () => {
          count += 1;
          return replacement;
        });
        if (count > 0) {
          applied.push(rule.id);
          matchCounts[rule.id] = count;
          result = next;
        }
      }
    }
    return {
      fileName,
      original: content,
      content: result,
      changed: result !== content,
      rulesApplied: applied,
      matchCounts,
      quarantine
    };
  }

  renderDiff(original, modified, fileName = 'buffer') {
    const a = original.split(/\r?\n/);
    const b = modified.split(/\r?\n/);
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
    let endA = 0;
    let endB = 0;
    while (endA < a.length - start && endB < b.length - start && a[a.length - 1 - endA] === b[b.length - 1 - endB]) {
      endA += 1;
      endB += 1;
    }
    const removed = a.slice(start, a.length - endA);
    const added = b.slice(start, b.length - endB);
    if (removed.length === 0 && added.length === 0) return '';
    const contextStart = Math.max(0, start - 3);
    const contextEndA = Math.min(a.length, a.length - endA + 3);
    const contextEndB = Math.min(b.length, b.length - endB + 3);
    const RED = String.fromCharCode(27) + '[31m';
    const GREEN = String.fromCharCode(27) + '[32m';
    const RESET = String.fromCharCode(27) + '[0m';
    const hunk = [];
    for (let i = contextStart; i < start; i += 1) hunk.push(' ' + a[i]);
    for (const line of removed) hunk.push(RED + '-' + line + RESET);
    for (const line of added) hunk.push(GREEN + '+' + line + RESET);
    for (let i = a.length - endA; i < contextEndA; i += 1) hunk.push(' ' + a[i]);
    return ['--- a/' + fileName, '+++ b/' + fileName, '@@ ... @@', ...hunk].join(String.fromCharCode(10));
  }

  writeAtomic(filePath, content) {
    const dir = path.dirname(filePath);
    const tmp = path.join(dir, '.' + path.basename(filePath) + '.tmp.' + process.pid + '.' + Date.now());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmp, content, 'utf8');
    const fd = fs.openSync(tmp, 'r+');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmp, filePath);
  }

  verify(filePath, expectedHash) {
    const actual = fs.readFileSync(filePath, 'utf8');
    const actualHash = sha256(actual);
    if (actualHash !== expectedHash) {
      throw new Error('Verification failed for ' + filePath + ': content mismatch after atomic write');
    }
  }

  processFile(filePath, options = {}) {
    const dryRun = !!options.dryRun;
    const original = fs.readFileSync(filePath, 'utf8');
    const originalEnding = detectLineEnding(original);
    const processed = this.processBuffer(original, path.basename(filePath));
    const modified = processed.changed ? restoreLineEndings(processed.content, originalEnding) : original;
    const diff = this.renderDiff(original, modified, filePath);
    if (!processed.changed) {
      return { filePath, changed: false, applied: false, diff: '', rulesApplied: [], matchCounts: {}, quarantine: [] };
    }
    if (dryRun) {
      return { filePath, changed: true, applied: false, diff, rulesApplied: processed.rulesApplied, matchCounts: processed.matchCounts, quarantine: processed.quarantine };
    }
    const expectedHash = sha256(modified);
    this.writeAtomic(filePath, modified);
    this.verify(filePath, expectedHash);
    return { filePath, changed: true, applied: true, diff, rulesApplied: processed.rulesApplied, matchCounts: processed.matchCounts, quarantine: processed.quarantine };
  }

  processFiles(filePaths, options = {}) {
    return filePaths.map(fp => this.processFile(fp, options));
  }
}

module.exports = {
  RemediationEngine,
  DEFAULT_RULES,
  STRUCTURAL_RULES,
  LEGACY_RULES,
  sha256,
  detectLineEnding,
  restoreLineEndings
};
