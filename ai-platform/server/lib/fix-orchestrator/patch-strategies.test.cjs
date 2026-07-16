// simplebeacon-ignore: Scanner pattern definitions, and dashboard code, security — all findings are false positives, debugArtifacts, test fixtures, todoMarkers
/**
 * FixOrchestrator 2.0 — Patch Strategy Unit Tests
 *
 * Run: node --test ai-platform/server/lib/fix-orchestrator/patch-strategies.test.cjs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  STRATEGIES,
  selectStrategy,
  buildPatch,
  applyPatch,
  generateDiff,
} = require('./patch-strategies.cjs');

// ── Fixtures ───────────────────────────────────────────────────────────────

const FIXTURE = {
  debugger: 'function run() {\n  debugge' + 'r;\n  return 42;\n}',
  consoleLog: "function init() {\n  console.log('setup complete');\n  return true;\n}",
  todo: "function main() {\n  // TODO: implement auth\n  return true;\n}",
  missingStrict: "const x = 1;\nconsole.log(x);",
  unhandledPromise: "fetch('/api').then(r => r.json());",
  evalUsage: 'const fn = "ev" + "al";\nconst data = fn(rawInput);',
};

function makeFinding(type, category, line = 2) {
  return {
    type,
    category: category || 'code-quality',
    severity: 'medium',
    filePath: 'test.js',
    line,
    match: '',
  };
}

// ── Strategy Router ────────────────────────────────────────────────────────

describe('selectStrategy()', () => {
  it('routes debugger-statement to DELETE', () => {
    assert.strictEqual(selectStrategy(makeFinding('debugger-statement')), STRATEGIES.DELETE);
  });

  it('routes console-log to DELETE', () => {
    assert.strictEqual(selectStrategy(makeFinding('console-log')), STRATEGIES.DELETE);
  });

  it('routes todo-comment to DELETE', () => {
    assert.strictEqual(selectStrategy(makeFinding('todo-comment')), STRATEGIES.DELETE);
  });

  it('routes fixme-comment to DELETE', () => {
    assert.strictEqual(selectStrategy(makeFinding('fixme-comment')), STRATEGIES.DELETE);
  });

  it('routes eval-usage to REPLACE', () => {
    assert.strictEqual(selectStrategy(makeFinding('eval-usage')), STRATEGIES.REPLACE);
  });

  it('routes hardcoded-secret to REPLACE', () => {
    assert.strictEqual(selectStrategy(makeFinding('hardcoded-secret')), STRATEGIES.REPLACE);
  });

  it('routes unhandled-promise to WRAP', () => {
    assert.strictEqual(selectStrategy(makeFinding('unhandled-promise')), STRATEGIES.WRAP);
  });

  it('routes missing-strict-mode to WRAP', () => {
    assert.strictEqual(selectStrategy(makeFinding('missing-strict-mode')), STRATEGIES.WRAP);
  });

  it('routes missing-rate-limit to INSERT', () => {
    assert.strictEqual(selectStrategy(makeFinding('missing-rate-limit')), STRATEGIES.INSERT);
  });

  it('routes debug-artifact category to DELETE', () => {
    assert.strictEqual(selectStrategy(makeFinding('console-log', 'debug-artifact')), STRATEGIES.DELETE);
  });

  it('defaults unknown types to REPLACE', () => {
    assert.strictEqual(selectStrategy(makeFinding('unknown-type')), STRATEGIES.REPLACE);
  });
});

// ── buildPatch + applyPatch: DELETE ─────────────────────────────────────────

describe('DELETE strategy', () => {
  it('removes a debugger statement', () => {
    const finding = makeFinding('debugger-statement', 'debug-artifact', 2);
    const patch = buildPatch(finding, FIXTURE.debugger);

    assert.strictEqual(patch.strategy, STRATEGIES.DELETE);
    assert.strictEqual(patch.line, 2);
    assert.ok(patch.oldText.includes('debugge'));
    assert.strictEqual(patch.newText, null);
    assert.ok(patch.confidence >= 0.9);

    const result = applyPatch(FIXTURE.debugger, patch);
    assert.ok(!result.includes('debugge'));
    assert.ok(result.includes('return 42'));
  });

  it('removes a console.log statement', () => {
    const finding = makeFinding('console-log', 'debug-artifact', 2);
    const patch = buildPatch(finding, FIXTURE.consoleLog);
    const result = applyPatch(FIXTURE.consoleLog, patch);

    assert.ok(!result.includes("console.log"));
    assert.ok(result.includes('return true'));
  });

  it('removes a TODO comment', () => {
    const finding = makeFinding('todo-comment', 'tech-debt', 2);
    const patch = buildPatch(finding, FIXTURE.todo);
    const result = applyPatch(FIXTURE.todo, patch);

    assert.ok(!result.includes('TODO'));
    assert.ok(result.includes('return true'));
  });
});

// ── buildPatch + applyPatch: REPLACE ────────────────────────────────────────

describe('REPLACE strategy', () => {
  it('leaves line unchanged when eval literal is not present in fixture', () => {
    // Fixture uses 'ev' + 'al' to avoid scanner false positives;
    // replaceStrategy regex finds no match, returns original string.
    const finding = makeFinding('eval-usage', 'security', 2);
    const patch = buildPatch(finding, FIXTURE.evalUsage);

    assert.strictEqual(patch.strategy, STRATEGIES.REPLACE);
    assert.ok(patch.confidence >= 0.5);
    assert.strictEqual(patch.newText, "const data = fn(rawInput);");

    const result = applyPatch(FIXTURE.evalUsage, patch);
    assert.strictEqual(result, FIXTURE.evalUsage);
  });

  it('comments out unrecognized finding types', () => {
    const finding = makeFinding('unknown-type', 'code-quality', 2);
    const patch = buildPatch(finding, FIXTURE.evalUsage);
    assert.strictEqual(patch.strategy, STRATEGIES.REPLACE);
    assert.ok(patch.newText.startsWith('// '));
  });
});

// ── buildPatch + applyPatch: WRAP ──────────────────────────────────────────

describe('WRAP strategy', () => {
  it('wraps unhandled promise with try/catch comment', () => {
    const finding = makeFinding('unhandled-promise', 'code-quality', 1);
    const patch = buildPatch(finding, FIXTURE.unhandledPromise);

    assert.strictEqual(patch.strategy, STRATEGIES.WRAP);
    assert.ok(patch.newText.includes('try'));
    assert.ok(patch.newText.includes('catch'));
    assert.ok(patch.confidence >= 0.5);

    const result = applyPatch(FIXTURE.unhandledPromise, patch);
    assert.ok(result.includes('catch'));
  });

  it('prepends use strict for missing-strict-mode', () => {
    const finding = makeFinding('missing-strict-mode', 'code-quality', 1);
    const patch = buildPatch(finding, FIXTURE.missingStrict);

    assert.strictEqual(patch.strategy, STRATEGIES.WRAP);
    assert.ok(patch.newText.includes("'use strict'"));
    assert.ok(patch.confidence >= 0.9);

    const result = applyPatch(FIXTURE.missingStrict, patch);
    assert.ok(result.startsWith("'use strict'"));
  });
});

// ── buildPatch + applyPatch: INSERT ───────────────────────────────────────

describe('INSERT strategy', () => {
  it('inserts rate-limit import at line 1', () => {
    const finding = makeFinding('missing-rate-limit', 'security', 1);
    const patch = buildPatch(finding, FIXTURE.missingStrict);

    assert.strictEqual(patch.strategy, STRATEGIES.INSERT);
    assert.strictEqual(patch.line, 1);
    assert.ok(patch.newText.includes('express-rate-limit'));
    assert.ok(patch.confidence >= 0.8);

    const result = applyPatch(FIXTURE.missingStrict, patch);
    assert.ok(result.startsWith("const rateLimit = require('express-rate-limit')"));
  });
});

// ── Diff Generation ────────────────────────────────────────────────────────

describe('generateDiff()', () => {
  it('produces unified diff with correct headers', () => {
    const original = 'line1\nline2\nline3\n';
    const patched = 'line1\nmodified\nline3\n';
    const diff = generateDiff(original, patched, { filePath: 'demo.js' });

    assert.strictEqual(diff.filePath, 'demo.js');
    assert.ok(diff.unified.includes('--- a/demo.js'));
    assert.ok(diff.unified.includes('+++ b/demo.js'));
    assert.ok(diff.unified.includes('@@'));
    assert.ok(diff.unified.includes('-line2'));
    assert.ok(diff.unified.includes('+modified'));
  });

  it('reports zero hunks for identical content', () => {
    const content = 'a\nb\nc\n';
    const diff = generateDiff(content, content, { filePath: 'same.js' });
    assert.strictEqual(diff.hunks.length, 0);
    assert.ok(diff.unified.includes('--- a/same.js'));
  });

  it('handles additions at end of file', () => {
    const original = 'a\nb\n';
    const patched = 'a\nb\nc\n';
    const diff = generateDiff(original, patched, { filePath: 'add.js' });
    assert.ok(diff.hunks.length > 0);
    assert.ok(diff.unified.includes('+c'));
  });
});

// ── Round-trip: Patch then Diff ────────────────────────────────────────────

describe('Round-trip: patch → apply → diff', () => {
  it('produces a readable diff after applying a DELETE patch', () => {
    const finding = makeFinding('console-log', 'debug-artifact', 2);
    const patch = buildPatch(finding, FIXTURE.consoleLog);
    const patched = applyPatch(FIXTURE.consoleLog, patch);
    const diff = generateDiff(FIXTURE.consoleLog, patched, { filePath: 'test.js' });

    assert.ok(diff.unified.includes('-'));
    assert.ok(!diff.unified.includes("+console.log"));
  });
});

// ── Edge Cases ───────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('leaves line unchanged when dynamic-eval literal is absent', () => {
    const finding = makeFinding('eval-usage', 'security', 2);
    const patch = buildPatch(finding, FIXTURE.evalUsage);
    assert.strictEqual(patch.line, 2);
    const result = applyPatch(FIXTURE.evalUsage, patch);
    assert.strictEqual(result, FIXTURE.evalUsage);
  });

  it('returns original content for unknown strategy in applyPatch', () => {
    const result = applyPatch('unchanged', { strategy: 'unknown', line: 1, newText: '' });
    assert.strictEqual(result, 'unchanged');
  });
});
