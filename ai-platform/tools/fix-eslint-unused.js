#!/usr/bin/env node
/**
 * Prefix unused vars/args reported by ESLint JSON output with _.
 * Usage: node tools/fix-eslint-unused.js [.simplebeacon/lint-warnings.json]
 */
const fs = require('fs');
const path = require('path');

const reportPath = path.resolve(process.argv[2] || path.join(__dirname, '../.simplebeacon/lint-warnings.json'));
if (!fs.existsSync(reportPath)) {
    console.error('Missing report:', reportPath);
    process.exit(1);
}

const reports = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const editsByFile = new Map();

for (const fileReport of reports) {
    for (const msg of fileReport.messages || []) {
        if (msg.ruleId !== 'no-unused-vars' || msg.severity !== 1) continue;
        const match = msg.message.match(/^'([^']+)'/);
        if (!match) continue;
        const name = match[1];
        if (name.startsWith('_')) continue;
        const list = editsByFile.get(fileReport.filePath) || [];
        list.push({ line: msg.line, column: msg.column, name });
        editsByFile.set(fileReport.filePath, list);
    }
}

let changedFiles = 0;
let changedNames = 0;

for (const [filePath, edits] of editsByFile.entries()) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const sorted = edits.sort((a, b) => b.line - a.line || b.column - a.column);
    for (const edit of sorted) {
        const idx = edit.line - 1;
        if (idx < 0 || idx >= lines.length) continue;
        const line = lines[idx];
        const col = Math.max(0, edit.column - 1);
        const slice = line.slice(col);
        const re = new RegExp(`\\b${edit.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (!re.test(slice)) continue;
        lines[idx] = line.slice(0, col) + slice.replace(re, `_${edit.name}`);
        changedNames += 1;
    }
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
    changedFiles += 1;
}

console.log(`Updated ${changedNames} identifiers across ${changedFiles} files.`);
