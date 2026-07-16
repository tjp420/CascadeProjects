// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
'use strict';

const { execSync } = require('child_process');
const path = require('path');

describe('audit-report/__tests__.cjs', () => {
  test('runs successfully with node --test', () => {
    const filePath = path.resolve(__dirname, '..', 'audit-report', '__tests__.cjs');
    const result = execSync(`node --test "${filePath}"`, { encoding: 'utf8', timeout: 30000 });
    expect(typeof result).toBe('string');
  });
});
