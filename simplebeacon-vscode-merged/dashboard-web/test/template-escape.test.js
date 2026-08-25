import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Scan view JS files for template literal interpolations inside HTML templates
// and ensure that interpolated expressions are escaped via escapeHtml(...)

const VIEW_DIRS = [
  path.join(process.cwd(), 'dashboard-web', 'js', 'views'),
  path.join(process.cwd(), 'dashboard-web', 'js-es2018', 'views'),
];

function findFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...findFiles(full));
    } else if (name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function rangeOfMatchingBrace(s, start) {
  // start points at the index of '${'
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function analyzeFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const problems = [];

  // find all backtick template literals that contain '<' (heuristic for HTML templates)
  const backtickRegex = /`([\s\S]*?)`/g;
  let m;
  while ((m = backtickRegex.exec(src)) !== null) {
    const tpl = m[1];
    if (!tpl.includes('<') && !tpl.includes('>')) continue; // not an HTML-ish template
    const tplStart = m.index;

    // scan for ${...} inside tpl
    let idx = 0;
    while ((idx = tpl.indexOf('${', idx)) !== -1) {
      const absIdx = tplStart + 1 + idx; // position of '${' in full source (approx)
      const endRel = rangeOfMatchingBrace(tpl, idx + 2);
      if (endRel === -1) break;
      const expr = tpl.slice(idx + 2, endRel).trim();

      // heuristics: consider safe if expression contains escapeHtml( or sanitize or String(...) or Number(...)
      const safePatterns = ['escapeHtml(', 'sanitize', 'DOMPurify', 'String(', 'Number(', 'formatNumber('];
      const isSafe = safePatterns.some((p) => expr.includes(p));

      if (!isSafe) {
        problems.push({ expr, location: `${file}:${m.index + 1}` });
      }

      idx = endRel + 1;
    }
  }

  return problems;
}

const files = VIEW_DIRS.flatMap(findFiles);
const allProblems = [];
for (const f of files) {
  const probs = analyzeFile(f);
  if (probs.length) {
    allProblems.push({ file: f, problems: probs });
  }
}

if (allProblems.length) {
  let msg = '\nUnescaped template interpolations found in HTML-like templates:\n';
  for (const p of allProblems) {
    msg += `\nFile: ${p.file}\n`;
    for (const pr of p.problems) msg += `  - ${pr.expr} (approx at ${pr.location})\n`;
  }
  msg +=
    '\nRules: Interpolations inside backtick templates that look like HTML should be escaped with escapeHtml(...) or otherwise sanitized.\n';
  throw new Error(msg);
}

// otherwise pass silently
console.log('template-escape.test: OK — no unescaped interpolations detected');
