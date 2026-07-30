const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { scanCustomHeuristicRules } = require('../../src/rules/custom-heuristic-scanner');

async function withTempProject(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ast-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('AST rule flags unparameterized db.query with TemplateLiteral argument', async () => {
  const result = await withTempProject({
    '.simplebeacon/custom-rules.json': JSON.stringify([{
      id: 'SB-CUSTOM-AST-001',
      name: 'Enforce Parameterized SQL Queries',
      engine: 'ast',
      astCriteria: {
        nodeType: 'CallExpression',
        callee: 'db.query',
        arguments: { index: 0, type: 'TemplateLiteral' }
      },
      severity: 'high',
      description: 'Direct template literals in db.query calls can introduce SQL injection.',
      recommendation: 'Use parameterized queries with array placeholders.'
    }]),
    'src/data-access.js': 'function getUser(id) {\n  return db.query(`SELECT * FROM users WHERE id = ${id}`);\n}\n'
  }, async (dir) => scanCustomHeuristicRules(dir));

  assert.equal(result.findings, 1);
  assert.equal(result.issues[0].pattern, 'SB-CUSTOM-AST-001');
  assert.equal(result.issues[0].category, 'custom-ast');
  assert.equal(result.issues[0].line, 2);
  assert.equal(result.issues[0].metadata.engine, 'custom-ast');
});

test('AST rule ignores parameterized db.query with string + array', async () => {
  const result = await withTempProject({
    '.simplebeacon/custom-rules.json': JSON.stringify([{
      id: 'SB-CUSTOM-AST-001',
      name: 'Enforce Parameterized SQL Queries',
      engine: 'ast',
      astCriteria: {
        nodeType: 'CallExpression',
        callee: 'db.query',
        arguments: { index: 0, type: 'TemplateLiteral' }
      },
      severity: 'high',
      description: 'Direct template literals in db.query calls can introduce SQL injection.',
      recommendation: 'Use parameterized queries with array placeholders.'
    }]),
    'src/data-access.js': 'function getUser(id) {\n  return db.query("SELECT * FROM users WHERE id = ?", [id]);\n}\n'
  }, async (dir) => scanCustomHeuristicRules(dir));

  assert.equal(result.findings, 0);
});

test('regex engine still works as fallback when engine is omitted', async () => {
  const result = await withTempProject({
    '.simplebeacon/custom-rules.json': JSON.stringify([{
      id: 'SB-CUSTOM-REGEX-001',
      name: 'No console.log',
      pattern: 'console\\.(log|debug|info)\\(',
      patternFlags: 'gi',
      severity: 'medium',
      description: 'Console logging should not be in production code.',
      recommendation: 'Use a proper logger.'
    }]),
    'src/app.js': 'function init() {\n  console.log("starting");\n}\n'
  }, async (dir) => scanCustomHeuristicRules(dir));

  assert.equal(result.findings, 1);
  assert.equal(result.issues[0].pattern, 'SB-CUSTOM-REGEX-001');
  assert.equal(result.issues[0].metadata.engine, 'custom-rules');
});

test('AST and regex rules can coexist in the same custom-rules.json', async () => {
  const result = await withTempProject({
    '.simplebeacon/custom-rules.json': JSON.stringify([
      {
        id: 'SB-CUSTOM-AST-001',
        name: 'Enforce Parameterized SQL Queries',
        engine: 'ast',
        astCriteria: {
          nodeType: 'CallExpression',
          callee: 'db.query',
          arguments: { index: 0, type: 'TemplateLiteral' }
        },
        severity: 'high',
        description: 'Direct template literals in db.query calls can introduce SQL injection.',
        recommendation: 'Use parameterized queries with array placeholders.'
      },
      {
        id: 'SB-CUSTOM-REGEX-001',
        name: 'No console.log',
        pattern: 'console\\.(log|debug|info)\\(',
        patternFlags: 'gi',
        severity: 'medium',
        description: 'Console logging should not be in production code.',
        recommendation: 'Use a proper logger.'
      }
    ]),
    'src/app.js': 'function init() {\n  console.log("starting");\n  db.query(`SELECT * FROM ${table}`);\n}\n'
  }, async (dir) => scanCustomHeuristicRules(dir));

  assert.equal(result.findings, 2);
  const patterns = result.issues.map((i) => i.pattern).sort();
  assert.deepEqual(patterns, ['SB-CUSTOM-AST-001', 'SB-CUSTOM-REGEX-001']);
});

test('AST calleeRegex matches any console method', async () => {
  const result = await withTempProject({
    '.simplebeacon/custom-rules.json': JSON.stringify([{
      id: 'SB-CUSTOM-AST-REGEX-001',
      name: 'No console methods',
      engine: 'ast',
      astCriteria: {
        nodeType: 'CallExpression',
        calleeRegex: '^console\\.(log|warn|error|debug)$'
      },
      severity: 'medium',
      description: 'Console methods should not be in production code.',
      recommendation: 'Use a proper logger.'
    }]),
    'src/app.js': 'function init() {\n  console.warn("starting");\n  console.log("running");\n}\n'
  }, async (dir) => scanCustomHeuristicRules(dir));

  assert.equal(result.findings, 2);
});

test('AST nameRegex matches function declarations starting with get', async () => {
  const result = await withTempProject({
    '.simplebeacon/custom-rules.json': JSON.stringify([{
      id: 'SB-CUSTOM-AST-NAME-001',
      name: 'Getter-style function naming',
      engine: 'ast',
      astCriteria: {
        nodeType: 'FunctionDeclaration',
        nameRegex: '^get'
      },
      severity: 'low',
      description: 'Functions prefixed with get should be reviewed.',
      recommendation: 'Use semantic names.'
    }]),
    'src/app.js': 'function getUser() { return {}; }\nfunction fetchData() { return []; }\n'
  }, async (dir) => scanCustomHeuristicRules(dir));

  assert.equal(result.findings, 1);
  assert.equal(result.issues[0].line, 1);
});

test('AST minArgs and maxArgs filter by call arity', async () => {
  const result = await withTempProject({
    '.simplebeacon/custom-rules.json': JSON.stringify([{
      id: 'SB-CUSTOM-AST-ARITY-001',
      name: 'Binary helper calls',
      engine: 'ast',
      astCriteria: {
        nodeType: 'CallExpression',
        callee: 'add',
        minArgs: 2,
        maxArgs: 2
      },
      severity: 'medium',
      description: 'Calls to add must have exactly two arguments.',
      recommendation: 'Review the call.'
    }]),
    'src/app.js': 'function test() {\n  add(1);\n  add(1, 2);\n  add(1, 2, 3);\n}\n'
  }, async (dir) => scanCustomHeuristicRules(dir));

  assert.equal(result.findings, 1);
  assert.equal(result.issues[0].line, 3);
});
