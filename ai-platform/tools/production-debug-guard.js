#!/usr/bin/env node
/**
 * Detect production debug artifacts in high-signal source paths.
 * Non-disruptive by default; strict mode optional.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const reportArgIndex = args.indexOf('--report');
const reportPath = reportArgIndex >= 0 && args[reportArgIndex + 1]
    ? args[reportArgIndex + 1]
    : '.simplebeacon/debug-artifact-guard-report.json';

const SOURCE_ROOTS = ['server', 'src', 'web/api'];
const ALLOWED_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx']);
const SKIP_SEGMENTS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__', 'tests', '.venv']);
const MAX_BYTES = 1024 * 1024;

const PATTERNS = [
    { id: 'debugger-statement', regex: /\bdebugger\b/g },
    { id: 'console-log', regex: /console\.log\(/g },
    { id: 'console-debug', regex: /console\.debug\(/g }
];

function normalize(rel) {
    return rel.replace(/\\/g, '/');
}

function shouldSkip(rel) {
    const parts = normalize(rel).split('/');
    return parts.some((p) => SKIP_SEGMENTS.has(p));
}

function walk(dir, acc = []) {
    if (!fs.existsSync(dir)) return acc;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        const rel = normalize(path.relative(ROOT, abs));
        if (entry.isDirectory()) {
            if (shouldSkip(rel)) continue;
            walk(abs, acc);
            continue;
        }
        if (!entry.isFile()) continue;
        if (shouldSkip(rel)) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_EXTS.has(ext)) continue;
        acc.push(rel);
    }
    return acc;
}

function normalizeCodeLine(line) {
    let normalized = line;
    const commentIndex = normalized.indexOf('//');
    if (commentIndex >= 0) {
        normalized = normalized.slice(0, commentIndex);
    }
    return normalized.trim();
}

function isExcludedDebugLine(content, lineIndex) {
    const lines = content.split('\n');
    const normalized = normalizeCodeLine(lines[lineIndex] || '');
    if (!normalized) return true;
    if (/\.includes\s*\(\s*['"]debugger['"]\s*\)/.test(normalized)) return true;
    if (/\.includes\s*\(\s*['"]console\.log['"]\s*\)/.test(normalized)) return true;
    if (/includes\s*\(\s*['"]debugger['"]\s*\)/.test(normalized)) return true;
    if (/includes\s*\(\s*['"]console\.log['"]\s*\)/.test(normalized)) return true;
    if (/content\.includes\s*\(\s*['"]debugger['"]\s*\)/.test(normalized)) return true;
    if (/content\.includes\s*\(\s*['"]console\.log['"]\s*\)/.test(normalized)) return true;
    if (/console-log\('/.test(normalized)) return true;
    if (/\bid:\s*['"]debugger['"]/.test(normalized)) return true;
    if (/label:\s*['"]debugger statement['"]/.test(normalized)) return true;
    if (/DEBUG_PATTERNS|PLACEHOLDER_PATTERNS|TECH_DEBT_PATTERNS|debugger-statement/.test(normalized)) return true;
    if (/pattern:\s*\//.test(normalized) && /\bdebugger\b/.test(normalized)) return true;
    if (/pattern:\s*\//.test(normalized) && /console\.(log|debug|info)\s*\(/.test(normalized)) return true;
    if (/\/[^/]*\bdebugger\b[^/]*\/[gimsuy]*/.test(normalized)) return true;
    if (/\bdebugger\s*statement\b/i.test(normalized) && !/^\s*debugger\s*;?\s*$/.test(normalized)) return true;
    if (/Remove debugger|debug-artifact|debug logging \/ debugger|neutraliz|remediation|hardcoded-perfect|fiction.kpi/.test(normalized)) return true;
    if (/console\.log statements found|console_statements/.test(normalized)) return true;
    if (/no-debugger|no-console|app-logger|logger\.(debug|info|warn|error)\(/.test(normalized)) return true;
    if (/process\.env\.[A-Z0-9_]*DEBUG|_DEBUG\s*===|LOG_LEVEL/.test(normalized)) return true;
    if (/__resolveAppLogger|src\/lib\/app-logger/.test(normalized)) return true;
    if (/\bhasDebugger\b/.test(normalized)) return true;
    if (/if\s*\(\s*DEBUG\s*\)|if\s*\(\s*\w*DEBUG\w*\s*\)/.test(normalized)) return true;
    if (/NODE_ENV\s*!==\s*['"]production['"]/.test(normalized)) return true;
    if (/isDebugScanPath|detectDebugArtifacts|isExcludedDebugLine|calculateFileQuality/.test(normalized)) return true;
    const prev = normalizeCodeLine(lines[lineIndex - 1] || '');
    if (/process\.env\.[A-Z0-9_]*DEBUG|_DEBUG\s*===|if\s*\(\s*debug/i.test(prev)) return true;
    return false;
}

function scanFile(rel) {
    const abs = path.join(ROOT, rel);
    let stat;
    try {
        stat = fs.statSync(abs);
    } catch {
        return null;
    }
    if (!stat.isFile() || stat.size > MAX_BYTES) return null;

    let content = '';
    try {
        content = fs.readFileSync(abs, 'utf8');
    } catch {
        return null;
    }

    const hits = [];
    const lines = content.split('\n');
    for (const pattern of PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
            const lineIndex = content.slice(0, match.index).split('\n').length - 1;
            if (isExcludedDebugLine(content, lineIndex)) continue;
            const existing = hits.find((h) => h.pattern === pattern.id);
            if (existing) existing.count += 1;
            else hits.push({ pattern: pattern.id, count: 1 });
        }
    }
    return hits.length ? { file: rel, hits } : null;
}

function main() {
    const files = [];
    for (const root of SOURCE_ROOTS) walk(path.join(ROOT, root), files);
    const findings = [];
    for (const rel of files) {
        const hit = scanFile(rel);
        if (hit) findings.push(hit);
    }

    const totalFindings = findings.reduce(
        (sum, file) => sum + file.hits.reduce((s, hit) => s + hit.count, 0),
        0
    );

    const report = {
        generatedAt: new Date().toISOString(),
        strict,
        roots: SOURCE_ROOTS,
        filesScanned: files.length,
        filesWithFindings: findings.length,
        totalFindings,
        findings
    };

    const absReport = path.isAbsolute(reportPath) ? reportPath : path.join(ROOT, reportPath);
    fs.mkdirSync(path.dirname(absReport), { recursive: true });
    fs.writeFileSync(absReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (findings.length) {
        console.error(`[production-debug-guard] ${findings.length} file(s), ${totalFindings} finding(s).`);
        for (const item of findings.slice(0, 30)) {
            const details = item.hits.map((h) => `${h.pattern} x${h.count}`).join(', ');
            console.error(` - ${item.file}: ${details}`);
        }
        if (strict) process.exit(2);
    } else {
        console.error('[production-debug-guard] no debug artifacts detected in scoped source paths.');
    }
}

main();
