'use strict';

const fs = require('fs');
const path = require('path');

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'api_key', 'apikey', 'auth_token', 'access_token', 'refresh_token'];
const EXCLUDED_DIRS = ['node_modules', '.git'];
const EXCLUDED_FILES = ['.env.example', '.env.v1-internal.example', 'constants.cjs'];

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      walk(full, callback);
    } else if (/\.(js|cjs|mjs)$/.test(entry.name)) {
      callback(full);
    }
  }
}

const findings = [];

walk('C:/Users/Trevor/CascadeProjects/ai-platform/server', (file) => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    // Skip constants.cjs (legitimate centralization)
    if (EXCLUDED_FILES.some(f => file.endsWith(f))) return;

    // Pattern: key = 'value' or "value" where value looks like a secret
    for (const key of SENSITIVE_KEYS) {
      const regex = new RegExp(`\\b${key}\\s*[:=]\\s*['\"]([^'\"]{4,})['\"]`, 'i');
      const match = trimmed.match(regex);
      if (match) {
        const val = match[1];
        // Skip obviously fake/test values
        if (/^(test|demo|example|fake|mock|placeholder|changeme|your|default|dev|prod)/i.test(val)) return;
        // Skip environment variable references
        if (/^process\.env\./.test(val)) return;
        findings.push({ file: path.relative('C:/Users/Trevor/CascadeProjects', file), line: i + 1, key, value: val.slice(0, 30) });
      }
    }
  });
});

console.log(`Found ${findings.length} potential token-bleed findings:\n`);
findings.forEach(f => console.log(`${f.file}:${f.line}  ${f.key} = '${f.value}...'`));
