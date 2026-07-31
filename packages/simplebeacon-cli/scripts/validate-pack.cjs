#!/usr/bin/env node
/**
 * Pre-pack validation — ensures no stray .patch-fix or .test files
 * are included in the npm tarball.
 *
 * Runs automatically via the "prepack" npm script before `npm pack`/`npm publish`.
 */
const { execSync } = require('child_process');

let ok = true;

try {
  const out = execSync('npm pack --dry-run --ignore-scripts 2>&1', { encoding: 'utf8' });
  const lines = out.split('\n');
  const stray = lines.filter(l =>
    l.includes('.patch-fix') || l.includes('.test.') || l.includes('.spec.')
  );

  if (stray.length > 0) {
    console.error('FAIL: Stray files detected in npm pack output:');
    for (const l of stray) {
      console.error('  ' + l.trim());
    }
    ok = false;
  } else {
    console.log('PASS: Pack contents clean — no .patch-fix or test files.');
  }
} catch (err) {
  console.error('FAIL: npm pack --dry-run failed:', err.message);
  ok = false;
}

process.exit(ok ? 0 : 1);
