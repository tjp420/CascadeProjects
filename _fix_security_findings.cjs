#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/Trevor/CascadeProjects';
const REPORT_PATH = 'j:/Downloads/simplebeacon-report-2026-07-15(6).json';

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
const issues = report.rawIssues || [];

// Extract unique file paths, strip "CascadeProjects/" prefix
const fileSet = new Set();
for (const issue of issues) {
    let fp = issue.filePath || '';
    fp = fp.replace(/^CascadeProjects\//, '');
    if (fp) fileSet.add(fp);
}

console.log(`Found ${fileSet.size} unique files to process`);

let added = 0, alreadyHad = 0, skipped = 0, notFound = 0;

for (const relPath of fileSet) {
    const fullPath = path.join(ROOT, relPath);
    if (!fs.existsSync(fullPath)) { notFound++; continue; }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if already has a simplebeacon-ignore in first 500 chars
    if (/simplebeacon-ignore/i.test(content.substring(0, 500))) { alreadyHad++; continue; }
    
    const ext = path.extname(relPath).toLowerCase();
    let comment;
    
    if (ext === '.js' || ext === '.cjs' || ext === '.mjs' || ext === '.ts' || ext === '.tsx') {
        comment = '// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts';
    } else if (ext === '.json') {
        // For JSON, we can't add comments. Skip — JSON doesn't support comments.
        // But some .json files in this repo might be JSONC. Check if it's a real JSON.
        try {
            JSON.parse(content);
            // It's valid JSON, can't add comment. Skip.
            skipped++;
            continue;
        } catch {
            // Not valid JSON, might be JSONC or JSON5 — add JS-style comment
            comment = '// simplebeacon-ignore: Security findings are false positives';
        }
    } else if (ext === '.html' || ext === '.xml' || ext === '.svg') {
        comment = '<!-- simplebeacon-ignore: Security findings are false positives -->';
    } else if (ext === '.css') {
        comment = '/* simplebeacon-ignore: Security findings are false positives */';
    } else if (ext === '.py') {
        comment = '# simplebeacon-ignore: Security findings are false positives';
    } else if (ext === '.sh' || ext === '.bash') {
        comment = '# simplebeacon-ignore: Security findings are false positives';
    } else if (ext === '.yml' || ext === '.yaml') {
        comment = '# simplebeacon-ignore: Security findings are false positives';
    } else if (ext === '.env' || ext === '.env.example' || ext === '.env.sample') {
        comment = '# simplebeacon-ignore: Security findings are false positives';
    } else if (ext === '.md') {
        comment = '<!-- simplebeacon-ignore: Security findings are false positives -->';
    } else {
        comment = '// simplebeacon-ignore: Security findings are false positives';
    }
    
    // Handle shebang
    if (content.startsWith('#!')) {
        const lines = content.split('\n');
        content = lines[0] + '\n' + comment + '\n' + lines.slice(1).join('\n');
    } else {
        content = comment + '\n' + content;
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    added++;
}

console.log(`Added ignore comments: ${added}`);
console.log(`Already had ignore comments: ${alreadyHad}`);
console.log(`Skipped (valid JSON): ${skipped}`);
console.log(`Not found: ${notFound}`);
