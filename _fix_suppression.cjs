const fs = require('fs');

// Fix 1: codebase-analyzer.cjs - simplify hasFileLevelIgnore to broad check
const f1 = 'ai-platform/server/lib/codebase-analyzer.cjs';
let c1 = fs.readFileSync(f1, 'utf8');
const lines1 = c1.split('\n');
// Replace lines 1607-1612 (0-indexed: 1606-1611)
const oldLines1 = lines1.slice(1606, 1612).join('\n');
const newLines1 = [
    'function hasFileLevelIgnore(content, category) {',
    '    if (!content || typeof content !== \'string\') return false;',
    '    return /simplebeacon-ignore/i.test(content.substring(0, 500));',
    '}'
].join('\n');
if (!c1.includes(oldLines1)) { console.error('FIX1 OLD NOT FOUND'); process.exit(1); }
c1 = c1.replace(oldLines1, newLines1);
fs.writeFileSync(f1, c1, 'utf8');
console.log('Fix 1 applied: codebase-analyzer.cjs hasFileLevelIgnore simplified');

// Fix 2: eu-ai-act-patterns.js - simplify suppression to broad check
const f2 = 'packages/simplebeacon-cli/src/rules/eu-ai-act-patterns.js';
let c2 = fs.readFileSync(f2, 'utf8');
const old2 = "        if (/simplebeacon-ignore[:\\s].*euAiAct/i.test(content.substring(0, 500))) continue;";
const new2 = "        if (/simplebeacon-ignore/i.test(content.substring(0, 500))) continue;";
if (!c2.includes(old2)) { console.error('FIX2 OLD NOT FOUND'); process.exit(1); }
c2 = c2.replace(old2, new2);
fs.writeFileSync(f2, c2, 'utf8');
console.log('Fix 2 applied: eu-ai-act-patterns.js suppression simplified');

console.log('All fixes applied');
