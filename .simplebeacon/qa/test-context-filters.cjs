'use strict';
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('coming-soon/public/js-es2018/dashboard/scanner-patterns.js', 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(code + '\nthis.PATTERN_REGISTRY = PATTERN_REGISTRY;', sandbox);
const reg = sandbox.PATTERN_REGISTRY;
const tests = [
  { id: 'weakCryptography', snippet: "algorithm: 'des-ede',", path: 'expand-cpe-tests.cjs' },
  { id: 'weakCryptography', snippet: "expect(() => engine.validate('t1', 'enclave', { enclaveCipher: 'des' })).toThrow(HsmAdapterError);", path: 'expand-cpe-tests.cjs' },
  { id: 'loggingSecrets', snippet: "console.error('[apollo] ERROR: APOLLO_API_KEY environment variable is required.');", path: 'marketing/outreach/apollo-lead-ingestion.js' },
  { id: 'loggingSecrets', snippet: "console.error('[apollo] Set it via: export APOLLO_API_KEY=xxx  (Unix)  or  set APOLLO_API_KEY=xxx  (Windows)');", path: 'marketing/outreach/apollo-lead-ingestion.js' },
  { id: 'missingStrictMode', snippet: '#!/usr/bin/env node', path: 'marketing/outreach/apollo-lead-ingestion.js' },
];
for (const t of tests) {
  const r = reg[t.id];
  const keep = r.contextFilter ? r.contextFilter(t.snippet, t.path, []) : true;
  const patMatch = r.pattern.test(t.snippet);
  console.log(`${t.id}: pattern=${patMatch} keep=${keep} => ${patMatch && keep ? 'BLOCK' : 'SKIP'}`);
}
