const fs = require('fs');
const path = require('path');

const roots = [
  'ai-platform/web/simplebeacon-dashboard/js-es2018/views',
  'ai-platform/web/simplebeacon-dashboard/js/views',
  'coming-soon/public/dashboard/js-es2018/views',
  'coming-soon/public/dashboard/js/views',
  'simplebeacon-vscode-merged/dashboard-web/js-es2018/views',
  'simplebeacon-vscode-merged/dashboard-web/js/views'
];

function walk(dir) {
  let files = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) files = files.concat(walk(p));
      else files.push(p);
    }
  } catch (e) {
    return files;
  }
  return files;
}

let modified = 0;
let touched = [];
for (const root of roots) {
  const fullRoot = path.join(process.cwd(), root.replace(/\//g, path.sep));
  const all = walk(fullRoot).filter(f => f.endsWith('.js'));
  for (const file of all) {
    let s = fs.readFileSync(file, 'utf8');
    // Skip files that already reference setSafeHTML
    if (s.includes('setSafeHTML(') || s.includes('window.setSafeHTML')) continue;
    let newS = s;
    // Quick replacement: empty string assignments -> setSafeHTML(el, '')
    newS = newS.replace(/([\w\$\.\)\]\-\_]+)\.innerHTML\s*=\s*''\s*;/g, (m, left) => {
      return `window.setSafeHTML(${left}, '')`; 
    });
    newS = newS.replace(/([\w\$\.\)\]\-\_]+)\.innerHTML\s*=\s*""\s*;/g, (m, left) => {
      return `window.setSafeHTML(${left}, '')`; 
    });
    newS = newS.replace(/([\w\$\.\)\]\-\_]+)\.innerHTML\s*=\s*``\s*;/g, (m, left) => {
      return `window.setSafeHTML(${left}, '')`; 
    });
    let offset = 0;
    while (true) {
      const idx = newS.indexOf('.innerHTML', offset);
      if (idx === -1) break;
      // find left expression start
      let leftStart = idx - 1;
      while (leftStart >= 0 && /[\s\S]/.test(newS[leftStart])) {
        if (/\s/.test(newS[leftStart])) { leftStart++; break; }
        leftStart--;
      }
      if (leftStart < 0) leftStart = 0;
      // find dot preceding innerHTML
      const dotIdx = newS.lastIndexOf('.', idx);
      const leftExpr = newS.slice(leftStart, dotIdx);
      // find '=' after innerHTML
      const after = newS.slice(idx + '.innerHTML'.length);
      const eqMatch = after.match(/\s*=\s*/);
      if (!eqMatch) { offset = idx + 9; continue; }
      const eqIdx = idx + '.innerHTML'.length + after.indexOf(eqMatch[0]) + eqMatch[0].length;
      // next char should be quote/backtick
      const nextChar = newS[eqIdx];
      if (!nextChar || !['\'','"','`'].includes(nextChar)) { offset = eqIdx; continue; }
      // parse literal until matching quote, respecting escapes
      let i = eqIdx + 1;
      let closed = false;
      while (i < newS.length) {
        const ch = newS[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === nextChar) { closed = true; i++; break; }
        // for template literals, skip ${...} blocks
        if (nextChar === '`' && ch === '$' && newS[i + 1] === '{') {
          // find matching }
          i += 2;
          let depth = 1;
          while (i < newS.length && depth > 0) {
            if (newS[i] === '{') depth++;
            else if (newS[i] === '}') depth--;
            else if (newS[i] === '\\') i++;
            i++;
          }
          continue;
        }
        i++;
      }
      if (!closed) { offset = eqIdx + 1; continue; }
      const literal = newS.slice(eqIdx, i);
      // skip if template contains ${ (dynamic)
      if (literal.startsWith('`') && /\$\{/.test(literal)) { offset = i; continue; }
      // perform replacement
      const leftSelectorStart = newS.lastIndexOf('\n', leftStart) + 1;
      const leftExprTrim = newS.slice(leftSelectorStart, dotIdx).trim();
      const replacement = `window.setSafeHTML(${leftExprTrim}, ${literal})`;
      newS = newS.slice(0, leftSelectorStart) + newS.slice(leftSelectorStart, dotIdx).replace(leftExprTrim, leftExprTrim) + newS.slice(dotIdx + ('.innerHTML'.length));
      // simpler: replace the whole segment from leftExprTrim + '.innerHTML' to i with call
      const segStart = newS.lastIndexOf(leftExprTrim, dotIdx);
      const segEnd = i;
      newS = newS.slice(0, segStart) + replacement + newS.slice(segEnd);
      offset = segStart + replacement.length;
    }
    if (newS !== s) {
      fs.writeFileSync(file, newS, 'utf8');
      modified++;
      touched.push(file.replace(process.cwd() + path.sep, ''));
    }
  }
}
console.log('Modified files:', modified);
if (touched.length) console.log(touched.join('\n'));
process.exit(0);
