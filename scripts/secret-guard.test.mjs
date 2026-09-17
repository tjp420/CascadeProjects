import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compilePatterns, findMatchesInText } from './secret-guard.js';

describe('secret pattern extractor', () => {
  it('compiles and matches simple patterns', () => {
    const patterns = ['sk_live_', "-----BEGIN PRIVATE KEY-----", "\\.env"];
    const regexes = compilePatterns(patterns);
    const sample = 'here is sk_live_ABCDEF and a file .env and -----BEGIN PRIVATE KEY-----MATERIAL';
    const matches = findMatchesInText(regexes, sample);
    assert.ok(matches.length >= 3);
  });

  it('finds multiple occurrences', () => {
    const patterns = ['PASSWORD', 'API_KEY'];
    const regexes = compilePatterns(patterns);
    const sample = 'PASSWORD=secret\nAPI_KEY=123\npassword=lower';
    const matches = findMatchesInText(regexes, sample);
    assert.ok(matches.length >= 3);
  });
});
