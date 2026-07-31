#!/usr/bin/env node
"use strict";
const fs = require('fs');
const path = require('path');

// simple argv parser to avoid external dependencies in CI
const rawArgs = process.argv.slice(2);
const argv = {};
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a.startsWith('--')) {
    const k = a.replace(/^--+/, '');
    if (k === 'error-on-missing-fix' || k === 'strict-regex') {
      argv[k] = true;
    } else {
      const val = rawArgs[i+1] && !rawArgs[i+1].startsWith('--') ? rawArgs[++i] : true;
      argv[k] = val;
    }
  }
}
if (!('rules-dir' in argv)) argv['rules-dir'] = './.simplebeacon/rules/';
if (!('error-on-missing-fix' in argv)) argv['error-on-missing-fix'] = false;
if (!('strict-regex' in argv)) argv['strict-regex'] = false;

const rulesDir = path.resolve(process.cwd(), argv['rules-dir']);

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function validateRuleMeta(rule, file) {
  const required = ['id','name','severity','impact','likelihood','category','matcher'];
  const missing = required.filter(k => !(k in rule));
  if (missing.length) {
    throw new Error(`${file}: missing required fields: ${missing.join(', ')}`);
  }
  if (!['low','medium','high'].includes(rule.severity)) throw new Error(`${file}: invalid severity`);
  if (!['low','medium','high'].includes(rule.impact)) throw new Error(`${file}: invalid impact`);
  if (!['low','medium','high'].includes(rule.likelihood)) throw new Error(`${file}: invalid likelihood`);
}

function checkRegexSafety(pattern) {
  // attempt to compile; optionally naive check for nested quantifiers that may lead to catastrophic backtracking
  try {
    new RegExp(pattern);
  } catch (e) {
    throw new Error('invalid regex: ' + e.message);
  }
  // simple heuristic: look for (.+)+ or (.*)+ patterns
  if (/\(\.\+\)\+|\(\.\*\)\+|\(\?:.*\)\+/.test(pattern)) {
    return { risky: true };
  }
  return { risky: false };
}

function loadRuleFile(file) {
  const full = path.join(rulesDir, file);
  delete require.cache[require.resolve(full)];
  return require(full);
}

async function main() {
  if (!fs.existsSync(rulesDir)) {
    console.log(`rules-dir not found: ${rulesDir} — nothing to validate.`);
    return 0;
  }
  const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.mjs'));
  if (files.length === 0) {
    console.log('no rule files found in', rulesDir);
    return 0;
  }

  let errors = 0;
  let warnings = 0;

  for (const f of files) {
    try {
      const ruleModule = loadRuleFile(f);
      const rules = Array.isArray(ruleModule) ? ruleModule : [ruleModule];
      for (const rule of rules) {
        if (!isObject(rule)) throw new Error(`${f}: exported value must be an object or array of objects`);
        validateRuleMeta(rule, f);
        // matcher checks
        if (!isObject(rule.matcher) || !rule.matcher.type) throw new Error(`${f}: matcher.type is required`);
        if (rule.matcher.type === 'regex') {
          const p = rule.matcher.pattern;
          if (!p) throw new Error(`${f}: matcher.pattern required for regex rules`);
          const pat = typeof p === 'string' ? p : p.source || String(p);
          try {
            const res = checkRegexSafety(pat);
            if (res.risky) {
              warnings++;
              console.warn(`WARNING ${f}: regex appears risky for catastrophic backtracking: ${pat}`);
            }
          } catch (e) {
            throw new Error(`${f}: regex compile error: ${e.message}`);
          }
        } else if (rule.matcher.type === 'ast') {
          if (!rule.matcher.language) throw new Error(`${f}: matcher.language required for ast rules`);
          if (!rule.matcher.visitor && !rule.matcher.visitorFile) throw new Error(`${f}: ast matcher requires visitor or visitorFile`);
        }

        if (!rule.id || typeof rule.id !== 'string') throw new Error(`${f}: id must be a string`);

        if (!rule.fix) {
          const msg = `${f}: no 'fix' provided (advisory)`;
          if (argv['error-on-missing-fix']) {
            throw new Error(msg);
          } else {
            warnings++;
            console.warn('ADVISORY', msg);
          }
        }
      }
    } catch (e) {
      errors++;
      console.error('ERROR validating', f, e && e.message ? e.message : e);
    }
  }

  console.log(`Validation complete: ${files.length} file(s), errors=${errors}, warnings=${warnings}`);
  if (errors > 0) process.exit(2);
  if (warnings > 0) process.exit(0);
  return 0;
}

if (require.main === module) main();
