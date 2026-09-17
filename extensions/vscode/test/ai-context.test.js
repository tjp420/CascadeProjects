const assert = require('assert');
  const { buildContextBrief, buildWorkspaceVerificationPayload } = require('../src/ai-context');

function run() {
  const mockDocument = {
    fileName: 'src/gate.js',
    languageId: 'javascript',
    uri: { fsPath: 'src/gate.js' },
    getText: () => `
                const crypto = require('crypto');
                function authorizeClearance(token) { return true; }
            `
  };

  const brief = buildContextBrief(mockDocument);

  assert.ok(brief.includes('File: src/gate.js'));
  assert.ok(brief.includes("const crypto = require('crypto');"));
  assert.ok(brief.includes('- authorizeClearance'));
  assert.ok(brief.includes('It is descriptive context, not a security verdict.'));

  const facts = buildWorkspaceVerificationPayload(mockDocument, { verifySymbol: 'authorizeClearance' });
  assert.strictEqual(facts.simplebeacon.operation, 'workspace_verification');
  assert.strictEqual(facts.file.exists, true);
  assert.ok(facts.functions.includes('authorizeClearance'));
  assert.strictEqual(facts.verification[0].status, 'found');

  const missing = buildWorkspaceVerificationPayload(mockDocument, { verifySymbol: 'calculateRisk' });
  assert.strictEqual(missing.verification[0].status, 'not_found');

  console.log('ok');
}

try { run(); process.exit(0); } catch (e) { console.error(e); process.exit(1); }
