const { test, skip } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    resolveAstScriptPath,
    resolvePythonExecutable,
    runPythonAstScan
} = require('../src/lib/python-ast-scanner');

test('resolveAstScriptPath finds the packaged sidecar', () => {
    const script = resolveAstScriptPath();
    assert.ok(script, 'python/simplebeacon_ast_scan.py should exist in the CLI package');
    assert.ok(fs.existsSync(script));
});

test('Python AST scan reports stubs, placeholders, and unbounded LLM calls', () => {
    const pythonBin = resolvePythonExecutable();
    if (!pythonBin) {
        skip('Python executable not available');
        return;
    }

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-py-ast-'));
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
        path.join(srcDir, 'stubs.py'),
        [
            'PLACEHOLDER = "mock_data/sample.json"',
            '',
            'def not_ready():',
            '    return None',
            '',
            'def score_applicant(resume_screen):',
            '    return resume_screen',
            '',
            'def ask(client, prompt):',
            '    return client.chat.completions.create(model="gpt-4", messages=[{"role":"user","content":prompt}])',
            ''
        ].join('\n'),
        'utf8'
    );

    const result = runPythonAstScan(root, { productionPaths: ['src/'] });
    assert.equal(result.ok, true, result.error || 'scan should succeed');
    const ids = (result.issues || []).map((i) => i.pattern);
    assert.ok(ids.includes('SB-PY-FICTION-001'), `expected placeholder finding, got ${ids.join(',')}`);
    assert.ok(ids.includes('SB-PY-FICTION-002'), `expected stub finding, got ${ids.join(',')}`);
    assert.ok(ids.includes('SB-PY-TB-001'), `expected token-limit finding, got ${ids.join(',')}`);
    assert.ok(ids.includes('SB-PY-EU-001'), `expected annex-III finding, got ${ids.join(',')}`);
});
