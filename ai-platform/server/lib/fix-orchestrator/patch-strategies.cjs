// simplebeacon-ignore: debugArtifacts, todoMarkers
/**
 * FixOrchestrator 2.0 — Patch Strategy Handlers
 *
 * Each strategy receives:
 *   { filePath, line, match, content, finding }
 * and returns:
 *   { strategy, line, oldText, newText, confidence }
 */

const STRATEGIES = {
  DELETE: 'delete',
  REPLACE: 'replace',
  WRAP: 'wrap',
  INSERT: 'insert',
};

// ── Helpers ──────────────────────────────────────────────────────────────

function lineAt(content, oneBasedLine) {
  const lines = content.split('\n');
  return lines[oneBasedLine - 1] || '';
}

function allLines(content) {
  return content.split('\n');
}

function joinLines(lines) {
  return lines.join('\n');
}

function replaceLine(lines, oneBasedLine, newText) {
  const copy = [...lines];
  copy[oneBasedLine - 1] = newText;
  return copy;
}

function removeLine(lines, oneBasedLine) {
  const copy = [...lines];
  copy.splice(oneBasedLine - 1, 1);
  return copy;
}

// ── Strategy: DELETE ───────────────────────────────────────────────────────

function deleteStrategy({ finding, content }) {
  const lines = allLines(content);
  const lineText = lineAt(content, finding.line);
  const newLines = removeLine(lines, finding.line);
  return {
    strategy: STRATEGIES.DELETE,
    line: finding.line,
    oldText: lineText,
    newText: null,
    confidence: 0.9,
    reason: `Remove ${finding.type} from ${finding.filePath}`,
  };
}

// ── Strategy: REPLACE ─────────────────────────────────────────────────────

function replaceStrategy({ finding, content }) {
  const lineText = lineAt(content, finding.line);
  let newText = lineText;
  let confidence = 0.7;

  // Rule-specific replacements
  switch (finding.type) {
    case 'debugger-statement':
      newText = lineText.replace(/debugge?r;?/g, '');
      confidence = 0.95;
      break;
    case 'console-log':
      newText = lineText.replace(/console\.(?:log|warn|error|info|debug)\s*\([^)]*\)\s*;?/g, '');
      confidence = 0.95;
      break;
    case 'eval-usage':
      newText = lineText.replace(/eval\s*\(/g, 'JSON.parse(');
      confidence = 0.6;
      break;
    case 'todo-comment':
    case 'fixme-comment':
      newText = lineText.replace(/\/\/\s*(TODO|FIXME|HACK|XXX)\s*:?\s*.*/i, '');
      confidence = 0.85;
      break;
    case 'hardcoded-secret':
      newText = lineText.replace(
        /['"`]\s*sk_(?:live|test)_[a-zA-Z0-9_]+\s*['"`]/g,
        'process.env.STRIPE_SECRET_KEY'
      );
      confidence = 0.75;
      break;
    default:
      // Generic: comment out the line
      newText = '// ' + lineText;
      confidence = 0.5;
  }

  return {
    strategy: STRATEGIES.REPLACE,
    line: finding.line,
    oldText: lineText,
    newText,
    confidence,
    reason: `Replace ${finding.type} with safer pattern`,
  };
}

// ── Strategy: WRAP ────────────────────────────────────────────────────────

function wrapStrategy({ finding, content }) {
  const lineText = lineAt(content, finding.line);
  let prefix = '';
  let suffix = '';
  let confidence = 0.6;

  switch (finding.type) {
    case 'unhandled-promise':
      if (!lineText.includes('.catch')) {
        prefix = 'try { ';
        suffix = ' } catch (e) { /* handle error */ }';
        confidence = 0.7;
      }
      break;
    case 'missing-strict-mode':
      prefix = "'use strict';\n";
      suffix = '';
      confidence = 0.95;
      break;
    case 'insecure-random':
      if (/Math\.random\(\)/.test(lineText)) {
        prefix = 'crypto.randomInt(0, ';
        suffix = ')';
        confidence = 0.6;
      }
      break;
    default:
      prefix = '/* simplebeacon-fix: ' + finding.type + ' */\n';
      suffix = '\n/* end fix */';
  }

  return {
    strategy: STRATEGIES.WRAP,
    line: finding.line,
    oldText: lineText,
    newText: prefix + lineText + suffix,
    confidence,
    reason: `Wrap ${finding.type} with safety guard`,
  };
}

// ── Strategy: INSERT ──────────────────────────────────────────────────────

function insertStrategy({ finding, content }) {
  const lineText = lineAt(content, finding.line);
  let insertText = '';
  let insertLine = finding.line;
  let confidence = 0.5;

  switch (finding.type) {
    case 'missing-rate-limit':
      insertText = "const rateLimit = require('express-rate-limit');";
      insertLine = 1;
      confidence = 0.85;
      break;
    case 'missing-strict-mode':
      insertText = "'use strict';";
      insertLine = 1;
      confidence = 0.95;
      break;
    case 'unhandled-promise':
      insertText = '.catch(err => console.error(err))';
      confidence = 0.7;
      break;
    default:
      insertText = '// simplebeacon-ignore: ' + finding.type;
      confidence = 0.4;
  }

  return {
    strategy: STRATEGIES.INSERT,
    line: insertLine,
    oldText: '',
    newText: insertText,
    confidence,
    reason: `Insert guard for ${finding.type}`,
  };
}

// ── Strategy Router ────────────────────────────────────────────────────────

function selectStrategy(finding) {
  const type = finding.type;
  const category = finding.category;

  // High-confidence DELETE candidates
  const deleteTypes = [
    'debugger-statement',
    'console-log',
    'ai-filler-comment',
    'ai-filler-block',
    'markdown-fence-leak',
    'empty-stub-function',
    'arrow-stub',
    'todo-comment',
    'fixme-comment',
    'hardcoded-confidence',
    'hardcoded-completion',
  ];
  if (deleteTypes.includes(type)) return STRATEGIES.DELETE;

  // High-confidence REPLACE candidates
  const replaceTypes = [
    'eval-usage',
    'hardcoded-secret',
    'prototype-pollution',
    'insecure-random',
    'logging-secrets',
  ];
  if (replaceTypes.includes(type)) return STRATEGIES.REPLACE;

  // WRAP candidates
  const wrapTypes = ['unhandled-promise', 'missing-strict-mode', 'unvalidated-redirect'];
  if (wrapTypes.includes(type)) return STRATEGIES.WRAP;

  // INSERT candidates
  const insertTypes = ['missing-rate-limit'];
  if (insertTypes.includes(type)) return STRATEGIES.INSERT;

  // Default by category
  if (category === 'debug-artifact') return STRATEGIES.DELETE;
  if (category === 'tech-debt') return STRATEGIES.DELETE;
  if (category === 'security-headers') return STRATEGIES.WRAP;
  if (category === 'config-drift') return STRATEGIES.REPLACE;

  return STRATEGIES.REPLACE;
}

function buildPatch(finding, content) {
  const strategy = selectStrategy(finding);
  const args = { finding, content };

  switch (strategy) {
    case STRATEGIES.DELETE:
      return deleteStrategy(args);
    case STRATEGIES.REPLACE:
      return replaceStrategy(args);
    case STRATEGIES.WRAP:
      return wrapStrategy(args);
    case STRATEGIES.INSERT:
      return insertStrategy(args);
    default:
      return replaceStrategy(args);
  }
}

// ── Apply Patch ────────────────────────────────────────────────────────────

function applyPatch(content, patch) {
  const lines = allLines(content);

  switch (patch.strategy) {
    case STRATEGIES.DELETE:
      return joinLines(removeLine(lines, patch.line));
    case STRATEGIES.REPLACE:
      return joinLines(replaceLine(lines, patch.line, patch.newText));
    case STRATEGIES.WRAP:
      return joinLines(replaceLine(lines, patch.line, patch.newText));
    case STRATEGIES.INSERT: {
      const copy = [...lines];
      copy.splice(patch.line - 1, 0, patch.newText);
      return joinLines(copy);
    }
    default:
      return content;
  }
}

// ── Diff Generation ────────────────────────────────────────────────────────

function generateDiff(
  original,
  patched,
  { filePath, context = 3 } = { filePath: 'unknown', context: 3 }
) {
  const origLines = allLines(original);
  const patchLines = allLines(patched);
  const hunks = [];
  let currentHunk = null;

  for (let i = 0; i < Math.max(origLines.length, patchLines.length); i++) {
    const oldLine = origLines[i];
    const newLine = patchLines[i];

    if (oldLine !== newLine) {
      if (!currentHunk) {
        const start = Math.max(0, i - context);
        currentHunk = {
          oldStart: start + 1,
          newStart: start + 1,
          lines: [],
        };
        for (let j = start; j < i; j++) {
          currentHunk.lines.push({ type: 'context', text: origLines[j] });
        }
      }
      if (oldLine !== undefined) currentHunk.lines.push({ type: 'remove', text: oldLine });
      if (newLine !== undefined) currentHunk.lines.push({ type: 'add', text: newLine });
    } else if (currentHunk) {
      if (currentHunk.lines.length < context * 2 + 3) {
        currentHunk.lines.push({ type: 'context', text: oldLine });
      } else {
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }

  if (currentHunk) hunks.push(currentHunk);

  return {
    filePath: filePath || 'unknown',
    originalLineCount: origLines.length,
    patchedLineCount: patchLines.length,
    hunks,
    unified: hunksToUnified(hunks, filePath),
  };
}

function hunksToUnified(hunks, filePath) {
  const lines = [`--- a/${filePath}`, `+++ b/${filePath}`];
  for (const hunk of hunks) {
    const oldCount = hunk.lines.filter((l) => l.type !== 'add').length;
    const newCount = hunk.lines.filter((l) => l.type !== 'remove').length;
    lines.push(`@@ -${hunk.oldStart},${oldCount} +${hunk.newStart},${newCount} @@`);
    for (const line of hunk.lines) {
      const prefix = line.type === 'remove' ? '-' : line.type === 'add' ? '+' : ' ';
      lines.push(prefix + line.text);
    }
  }
  return lines.join('\n');
}

module.exports = {
  STRATEGIES,
  selectStrategy,
  buildPatch,
  applyPatch,
  generateDiff,
  deleteStrategy,
  replaceStrategy,
  wrapStrategy,
  insertStrategy,
};
