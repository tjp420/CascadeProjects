#!/usr/bin/env node
/**
 * Scan source files for placeholder/fiction KPI text patterns.
 * Writes findings to .simplebeacon/source-kpi-findings.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.simplebeacon');
const INCLUDE_DOCS = process.argv.includes('--include-docs');
const OUT_FILE = path.join(
    OUT_DIR,
    INCLUDE_DOCS ? 'source-kpi-findings-with-docs.json' : 'source-kpi-findings.json'
);

const SOURCE_SCOPE = process.argv.includes('--source-scope');
const SOURCED_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx']);
const SOURCE_SCOPE_DIRS = new Set(['server', 'web', 'src', 'packages', 'tools']);

const TARGET_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.md', '.html', '.json']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'coverage', 'htmlcov', '.next', 'dist', 'build', '.simplebeacon', 'archive']);
if (!INCLUDE_DOCS) SKIP_DIRS.add('docs');

const PATTERNS = [
    { id: 'kpi-985-percent', regex: /\b98\.5%\b/gi },
    { id: 'kpi-943-percent', regex: /\b94\.3%\b/gi },
    { id: 'kpi-7417-percent', regex: /\b74\.17%\b/gi },
    { id: 'kpi-87-percent', regex: /\b87%\b/gi },
    { id: 'kpi-66-percent', regex: /\b66(?:\.0)?%\b/gi },
    { id: 'kpi-62-percent', regex: /\b62(?:\.0)?%\b/gi },
    { id: 'kpi-100-percent', regex: /\b100%\b/gi },
    { id: 'kpi-feature-count-47', regex: /\b(?:totalFeatures|featuresTracked|aiOptimizationsApplied)\s*[:=]\s*["']?47\b/gi },
    { id: 'kpi-open-issues-156', regex: /\b(?:issuesDetected|issuesFound|patternsIdentified|duplicatesRemoved|openIssues)\s*[:=]\s*["']?156\b/gi },
    { id: 'placeholder-coming-soon', regex: /\bcoming soon\b/gi },
    { id: 'placeholder-tbd', regex: /\bTBD\b/gi },
    { id: 'placeholder-todo', regex: /\bTODO\b/gi }
];

function walk(dir, acc = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(full, acc);
            continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (entry.isFile() && TARGET_EXTS.has(ext)) {
            if (SOURCE_SCOPE) {
                const firstSegment = rel.split('/')[0];
                if (!SOURCE_SCOPE_DIRS.has(firstSegment)) continue;
                if (!SOURCED_EXTS.has(ext)) continue;
            }
            acc.push({ full, rel });
        }
    }
    return acc;
}

function main() {
    const files = walk(ROOT);
    const findings = [];

    for (const file of files) {
        let content;
        try {
            content = fs.readFileSync(file.full, 'utf8');
        } catch {
            continue;
        }

        for (const pattern of PATTERNS) {
            pattern.regex.lastIndex = 0;
            const matches = content.match(pattern.regex);
            if (!matches || matches.length === 0) continue;
            findings.push({
                file: file.rel,
                pattern: pattern.id,
                count: matches.length
            });
        }
    }

    const summaryByPattern = {};
    for (const f of findings) {
        summaryByPattern[f.pattern] = (summaryByPattern[f.pattern] || 0) + f.count;
    }

    const result = {
        generatedAt: new Date().toISOString(),
        includeDocs: INCLUDE_DOCS,
        sourceScope: SOURCE_SCOPE,
        filesScanned: files.length,
        findingFiles: new Set(findings.map((f) => f.file)).size,
        totalFindings: findings.reduce((sum, f) => sum + f.count, 0),
        summaryByPattern,
        findings,
        byFile: findings.reduce((acc, finding) => {
            if (!acc[finding.file]) acc[finding.file] = {};
            acc[finding.file][finding.pattern] = (acc[finding.file][finding.pattern] || 0) + finding.count;
            return acc;
        }, {})
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

    console.log(`Source files scanned: ${result.filesScanned}`);
    console.log(`Files with findings: ${result.findingFiles}`);
    console.log(`Total pattern hits: ${result.totalFindings}`);
    console.log(`Report: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);
}

main();
