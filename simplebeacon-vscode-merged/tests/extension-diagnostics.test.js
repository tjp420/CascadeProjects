const test = require('node:test');
const assert = require('node:assert');

const mockVscode = {
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  Range: class {
    constructor(startLine, startChar, endLine, endChar) {
      this.start = { line: startLine, character: startChar };
      this.end = { line: endLine, character: endChar };
    }
  },
  Diagnostic: class {
    constructor(range, message, severity) {
      this.range = range;
      this.message = message;
      this.severity = severity;
      this.code = null;
    }
  }
};

class MockTextDocument {
  constructor(contents, fileName = 'test.js') {
    this.text = contents;
    this.fileName = fileName;
  }

  getText() {
    return this.text;
  }

  positionAt(offset) {
    const lines = this.text.substring(0, offset).split('\n');
    return { line: lines.length - 1, character: lines[lines.length - 1].length };
  }
}

function runLocalTextScan(document, vscodeInstance) {
  const text = document.getText();
  const diagnostics = [];

  const markdownRegex = /(```[a-z]*\n[\s\S]*?\n```)/g;
  let match;
  while ((match = markdownRegex.exec(text)) !== null) {
    const startPos = document.positionAt(match.index);
    const endPos = document.positionAt(match.index + match.length);
    const range = new vscodeInstance.Range(startPos.line, startPos.character, endPos.line, endPos.character);
    const diagnostic = new vscodeInstance.Diagnostic(
      range,
      '[SimpleBeacon] AI Prompt Debris: Residual markdown block boundary fences detected inside production source code.',
      vscodeInstance.DiagnosticSeverity.Warning
    );
    diagnostic.code = 'RULE_AI_045';
    diagnostics.push(diagnostic);
  }

  const fallbackRegex = /(simplebeacon-dev-insecure)/g;
  while ((match = fallbackRegex.exec(text)) !== null) {
    const startPos = document.positionAt(match.index);
    const endPos = document.positionAt(match.index + match.length);
    const range = new vscodeInstance.Range(startPos.line, startPos.character, endPos.line, endPos.character);
    const diagnostic = new vscodeInstance.Diagnostic(
      range,
      '[SimpleBeacon CRITICAL] Hardcoded Token Exposure: Local development authentication fallback string left inside active path.',
      vscodeInstance.DiagnosticSeverity.Error
    );
    diagnostic.code = 'RULE_SEC_020';
    diagnostics.push(diagnostic);
  }

  return diagnostics;
}

test('flags residual AI markdown fences', () => {
  const faultyCode = `function calculateTotal() {\n  const rate = 1.05;\n\`\`\`javascript\n  return price * rate;\n\`\`\`\n}`;
  const doc = new MockTextDocument(faultyCode);

  const findings = runLocalTextScan(doc, mockVscode);

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].code, 'RULE_AI_045');
  assert.strictEqual(findings[0].severity, mockVscode.DiagnosticSeverity.Warning);
});

test('flags hardcoded developer insecure secrets', () => {
  const vulnerableCode = `const LICENSE_SECRET = process.env.SECRET || "simplebeacon-dev-insecure";`;
  const doc = new MockTextDocument(vulnerableCode);

  const findings = runLocalTextScan(doc, mockVscode);

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].code, 'RULE_SEC_020');
  assert.strictEqual(findings[0].severity, mockVscode.DiagnosticSeverity.Error);
});

test('returns clean array on compliance-clean files', () => {
  const productionReadyCode = `const LICENSE_SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET;\nif(!LICENSE_SECRET) { throw new Error("Fail closed"); }`;
  const doc = new MockTextDocument(productionReadyCode);

  const findings = runLocalTextScan(doc, mockVscode);

  assert.strictEqual(findings.length, 0);
});