const assert = require('assert');
const test = require('node:test');
const {
  scanText,
  sha256Hex,
  maskPreview,
  shouldSkipPath,
} = require('../scripts/secret-scanner');

// Assemble fixture tokens at runtime so GitHub push protection does not
// treat the committed test source as a live credential leak.
const FAKE_AWS_ACCESS = 'AKIA' + '1234567890ABCD';
const FAKE_AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCY' + 'EXAMPLEKEY';
const FAKE_STRIPE = ['sk', 'live', 'abcdefghijklmnopqrstuVWXYZ123456'].join('_');
const FAKE_PEM_BEGIN = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
const FAKE_PEM_END = ['-----END', 'PRIVATE KEY-----'].join(' ');

const sample = [
  '// sample config',
  `const AWS_ACCESS_KEY_ID = "${FAKE_AWS_ACCESS}";`,
  `const AWS_SECRET_ACCESS_KEY = "${FAKE_AWS_SECRET}";`,
  `const STRIPE = "${FAKE_STRIPE}";`,
  '/* PEM KEY */',
  FAKE_PEM_BEGIN,
  'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD',
  FAKE_PEM_END,
  '',
].join('\n');

test('detects and masks known secrets without leaking raw values', () => {
  const findings = scanText(sample, 'sample.js');
  assert(findings.length >= 3, 'expected at least 3 findings');
  for (const f of findings) {
    assert(f.masked_preview, 'masked_preview present');
    assert(
      f.fingerprint && f.fingerprint.startsWith('sha256:'),
      'fingerprint present',
    );
    assert(
      !/AKIA/.test(f.masked_preview),
      'masked preview should not contain raw AKIA',
    );
    assert(
      !/BEGIN PRIVATE KEY/.test(f.masked_preview),
      'masked preview should not contain PEM header',
    );
  }
});

test('fingerprints are stable and deterministic', () => {
  const secret = FAKE_STRIPE;
  const fp = sha256Hex(secret).slice(0, 12);
  const masked = maskPreview(secret);
  assert(
    masked.startsWith(secret.slice(0, 6)),
    'masked preview keeps prefix',
  );
  assert(typeof fp === 'string' && fp.length === 12);
});

test('shouldSkipPath ignores test and fixture trees', () => {
  assert.equal(shouldSkipPath('packages/simplebeacon-cli/tests/foo.js'), true);
  assert.equal(shouldSkipPath('src/app.test.js'), true);
  assert.equal(
    shouldSkipPath(
      'packages/simplebeacon-cli/src/rules/security-pattern-scanner.js',
    ),
    false,
  );
});
