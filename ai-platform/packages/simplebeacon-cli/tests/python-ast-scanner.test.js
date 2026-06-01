const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    runPythonAstScan,
    resolvePythonExecutable,
    resolveAstScriptPath
} = require('../src/lib/python-ast-scanner');

test('python AST script and interpreter are discoverable', () => {
    assert.ok(resolveAstScriptPath());
    assert.ok(resolvePythonExecutable(), 'Python 3 required for python-ast-patterns');
});

test('python AST scan detects mock string and unbounded LLM call', () => {
    const pythonBin = resolvePythonExecutable();
    if (!pythonBin) {
        console.log('skip: no Python on PATH');
        return;
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-py-ast-'));
    const serverDir = path.join(dir, 'server');
    fs.mkdirSync(serverDir, { recursive: true });
    fs.writeFileSync(path.join(serverDir, 'agent.py'), [
        'import openai',
        'MOCK_PATH = "web/data/users-sample.json"',
        'def run_prompt():',
        '    return openai.chat.completions.create(model="gpt-4o", messages=[])',
        ''
    ].join('\n'));

    const result = runPythonAstScan(dir, {
        productionPaths: ['server/'],
        severity: 'medium'
    });

    assert.equal(result.ok, true, result.error || 'scan failed');
    assert.ok(result.findings >= 2, `expected multiple findings, got ${result.findings}`);
    assert.ok(result.issues.some((i) => i.pattern === 'SB-PY-FICTION-001'));
    assert.ok(result.issues.some((i) => i.pattern === 'SB-PY-TB-001'));
});

test('python AST scan skips files outside production paths', () => {
    const pythonBin = resolvePythonExecutable();
    if (!pythonBin) return;

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-py-out-'));
    const webDir = path.join(dir, 'web');
    fs.mkdirSync(webDir, { recursive: true });
    fs.writeFileSync(path.join(webDir, 'page.py'), 'PLACEHOLDER = "mock_data"\n');

    const result = runPythonAstScan(dir, { productionPaths: ['server/', 'src/'] });
    assert.equal(result.ok, true);
    assert.equal(result.findings, 0);
});
