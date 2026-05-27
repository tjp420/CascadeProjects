#!/usr/bin/env node
/**
 * Lightweight fiction KPI guard for JSON/docs content.
 * Default mode is non-blocking (warn-only). Use --strict or FICTION_GUARD_STRICT=true to fail.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.next',
    '.simplebeacon',
    'archive',
    'assessments',
    'reports'
]);
const TARGET_EXTS = new Set(['.json', '.md']);
const MAX_FILE_BYTES = 1024 * 1024; // 1 MB

const PATTERNS = [
    { id: 'completion-7417', regex: /\b74\.17(?:%|)\b/g },
    { id: 'completion-87', regex: /\b87(?:\.0+)?(?:%|)\b/g },
    { id: 'completion-943', regex: /\b94\.3(?:%|)\b/g },
    { id: 'completion-66', regex: /\b66(?:\.0+)?(?:%|)\b/g },
    { id: 'completion-62', regex: /\b62(?:\.0+)?(?:%|)\b/g },
    { id: 'feature-47-context', regex: /\b(totalFeatures|featuresTracked|aiOptimizationsApplied)\b[\s\S]{0,32}\b47\b/gi },
    { id: 'feature-100-context', regex: /\b(totalFeatures|featuresTracked|aiOptimizationsApplied)\b[\s\S]{0,32}\b100\b/gi },
    { id: 'feature-156-context', regex: /\b(totalFeatures|featuresTracked|aiOptimizationsApplied)\b[\s\S]{0,32}\b156\b/gi },
    { id: 'feature-8-context', regex: /\b(totalFeatures|featuresTracked|aiOptimizationsApplied)\b[\s\S]{0,32}\b8\b/gi },
    { id: 'feature-9-context', regex: /\b(totalFeatures|featuresTracked|aiOptimizationsApplied)\b[\s\S]{0,32}\b9\b/gi },
    { id: 'ai-confidence-985', regex: /\b(confidence|aiConfidence|previousConfidence)\b[\s\S]{0,32}\b98\.5\b/gi },
    { id: 'ai-confidence-943', regex: /\b(confidence|aiConfidence|previousConfidence)\b[\s\S]{0,32}\b94\.3\b/gi },
    { id: 'open-issues-999', regex: /\b(openIssues|issuesDetected|issuesFound)\b[\s\S]{0,32}\b999\b/gi }
];

function parseArgs(argv) {
    const args = argv.slice(2);
    const pathArgIndex = args.indexOf('--paths');
    const rawPaths = pathArgIndex >= 0 && args[pathArgIndex + 1]
        ? args[pathArgIndex + 1].split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    return {
        staged: args.includes('--staged'),
        strict: args.includes('--strict') || String(process.env.FICTION_GUARD_STRICT || '').toLowerCase() === 'true',
        ci: args.includes('--ci'),
        paths: rawPaths,
        reportPath: (() => {
            const idx = args.indexOf('--report');
            return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
        })()
    };
}

function normalizeRel(p) {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function shouldScan(relPath) {
    const normalized = normalizeRel(relPath);
    const segments = normalized.split('/');
    if (segments.some((s) => SKIP_DIRS.has(s))) return false;
    const ext = path.extname(normalized).toLowerCase();
    return TARGET_EXTS.has(ext);
}

function listAllFiles(dir, acc = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = normalizeRel(path.relative(ROOT, full));
        if (entry.isDirectory()) {
            if (!shouldScan(rel + '/dummy.json') && SKIP_DIRS.has(entry.name)) continue;
            listAllFiles(full, acc);
            continue;
        }
        if (!entry.isFile()) continue;
        if (!shouldScan(rel)) continue;
        acc.push(rel);
    }
    return acc;
}

function fileWithinTargets(relPath, targets) {
    if (!targets || targets.length === 0) return true;
    const normalized = normalizeRel(relPath);
    return targets.some((target) => {
        const t = normalizeRel(target).replace(/\/+$/, '');
        return normalized === t || normalized.startsWith(`${t}/`);
    });
}

function listStagedFiles() {
    try {
        const raw = execSync('git diff --cached --name-only --diff-filter=ACMR', {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf8'
        });
        return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(normalizeRel).filter(shouldScan);
    } catch {
        return [];
    }
}

function scanFile(relPath) {
    const abs = path.join(ROOT, relPath);
    let stat;
    try {
        stat = fs.statSync(abs);
    } catch {
        return null;
    }
    if (stat.size > MAX_FILE_BYTES) return null;

    let content;
    try {
        content = fs.readFileSync(abs, 'utf8');
    } catch {
        return null;
    }

    const findings = [];
    for (const pattern of PATTERNS) {
        pattern.regex.lastIndex = 0;
        const matches = content.match(pattern.regex);
        if (!matches || matches.length === 0) continue;
        findings.push({ pattern: pattern.id, count: matches.length });
    }

    if (!findings.length) return null;
    return { file: relPath, findings };
}

function main() {
    const opts = parseArgs(process.argv);
    const discovered = opts.staged ? listStagedFiles() : listAllFiles(ROOT);
    const files = discovered.filter((rel) => fileWithinTargets(rel, opts.paths));
    const hitFiles = [];
    for (const rel of files) {
        const result = scanFile(rel);
        if (result) hitFiles.push(result);
    }

    const totalFindings = hitFiles.reduce(
        (sum, file) => sum + file.findings.reduce((s, f) => s + f.count, 0),
        0
    );
    const summary = {
        generatedAt: new Date().toISOString(),
        mode: opts.staged ? 'staged' : 'workspace',
        strict: opts.strict,
        ci: opts.ci,
        filesScanned: files.length,
        filesWithFindings: hitFiles.length,
        totalFindings,
        findings: hitFiles
    };

    if (opts.reportPath) {
        const outPath = path.isAbsolute(opts.reportPath)
            ? opts.reportPath
            : path.join(ROOT, opts.reportPath);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    }

    if (hitFiles.length > 0) {
        console.error(`[fiction-kpi-guard] ${hitFiles.length} file(s), ${totalFindings} finding(s).`);
        for (const item of hitFiles.slice(0, 20)) {
            const details = item.findings.map((f) => `${f.pattern} x${f.count}`).join(', ');
            console.error(` - ${item.file}: ${details}`);
        }
        if (opts.strict) process.exit(2);
    } else {
        console.error('[fiction-kpi-guard] no risky fiction KPI patterns detected.');
    }
}

main();
