#!/usr/bin/env node
/**
 * Repository-wide credential pattern scan (broad, read-only).
 * Writes findings to .simplebeacon/repo-credential-scan.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.simplebeacon');
const OUT_FILE = path.join(OUT_DIR, 'repo-credential-scan.json');

const TARGET_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.yaml', '.yml', '.env', '.md', '.txt', '.sh', '.ps1', '.html']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'coverage', 'htmlcov', '.next', 'dist', 'build', '.simplebeacon', 'archive']);

const RULES = [
    { id: 'aws-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
    { id: 'stripe-secret-key', regex: /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{16,}\b/g },
    { id: 'stripe-publishable-key', regex: /\bpk_(?:test|live)_[A-Za-z0-9]{16,}\b/g },
    { id: 'jwt-secret-assignment', regex: /\bJWT_SECRET\s*[:=]\s*['"][^'"]{12,}['"]/g },
    { id: 'bearer-token', regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/g },
    { id: 'generic-api-key', regex: /\bapi[_-]?key\s*[:=]\s*['"][^'"]{12,}['"]/gi },
    { id: 'generic-secret', regex: /\b(secret|token|password)\s*[:=]\s*['"][^'"]{12,}['"]/gi }
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
        if (entry.isFile() && (TARGET_EXTS.has(ext) || entry.name.startsWith('.env'))) {
            acc.push({ full, rel });
        }
    }
    return acc;
}

function isLikelyPlaceholder(value) {
    return /(replace|changeme|example|sample|your[_-]?|todo|placeholder|test)/i.test(value);
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

        for (const rule of RULES) {
            rule.regex.lastIndex = 0;
            let match;
            while ((match = rule.regex.exec(content)) !== null) {
                const value = String(match[0]);
                if (isLikelyPlaceholder(value)) continue;
                findings.push({
                    file: file.rel,
                    rule: rule.id,
                    sample: value.slice(0, 80)
                });
            }
        }
    }

    const byRule = {};
    for (const finding of findings) {
        byRule[finding.rule] = (byRule[finding.rule] || 0) + 1;
    }

    const result = {
        generatedAt: new Date().toISOString(),
        filesScanned: files.length,
        findingCount: findings.length,
        findingsByRule: byRule,
        findings
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

    console.log(`Repository files scanned: ${result.filesScanned}`);
    console.log(`Credential findings: ${result.findingCount}`);
    console.log(`Report: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);

    if (findings.length > 0) process.exitCode = 1;
}

main();
