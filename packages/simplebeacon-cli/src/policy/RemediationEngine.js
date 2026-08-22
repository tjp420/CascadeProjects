'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STRUCTURAL_RULES = [
    {
        id: 'SB-FIX-MARKDOWN-FENCE',
        category: 'slop',
        description: 'Remove leading markdown code fence',
        pattern: /^```[\w-]*\r?\n/,
        replacement: ''
    },
    {
        id: 'SB-FIX-MARKDOWN-FENCE',
        category: 'slop',
        description: 'Remove trailing markdown code fence',
        pattern: /```\r?\n?$/,
        replacement: ''
    },
    {
        id: 'SB-FIX-LLM-PREAMBLE',
        category: 'slop',
        description: 'Strip LLM preamble at start of file',
        pattern: /^(?:Here is your updated component:|Sure, here is[^:\n]*:|I have modified the code[^:\n]*:)\s*\r?\n+/i,
        replacement: ''
    },
    {
        id: 'SB-FIX-SLOP-PLACEHOLDER',
        category: 'slop',
        description: 'Remove LLM TODO boilerplate comments',
        pattern: /\/\/\s*TODO:\s*(?:implement the rest(?: of this(?: function| loader)?)?|add actual validation here|your business logic here)[^\n]*\r?\n/gi,
        replacement: ''
    },
    {
        id: 'SB-FIX-TOKEN-STRIPE',
        category: 'tokens',
        description: 'Quarantine Stripe live secret keys',
        pattern: /sk_live_[A-Za-z0-9]{24,}/g,
        keyType: 'STRIPE'
    },
    {
        id: 'SB-FIX-TOKEN-AWS',
        category: 'tokens',
        description: 'Quarantine AWS access key IDs',
        pattern: /AKIA[A-Z0-9]{16}/g,
        keyType: 'AWS'
    },
    {
        id: 'SB-FIX-TOKEN-GENERIC',
        category: 'tokens',
        description: 'Quarantine generic secret_key assignments',
        pattern: /secret_key\s*=\s*["']([^"']{16,})["']/gi,
        keyType: 'GENERIC',
        assignment: true
    }
];

const LEGACY_RULES = [
    {
        id: 'RULE_AI_045',
        category: 'slop',
        description: 'Remove standalone markdown fence lines',
        pattern: /^```[^\n]*\r?\n?/gm,
        replacement: ''
    },
    {
        id: 'RULE_SEC_020',
        category: 'security',
        description: 'Redact known API token formats',
        pattern: /(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36,}|glpat-[A-Za-z0-9]{20,})/g,
        replacement: '<REDACTED>'
    }
];

const DEFAULT_RULES = STRUCTURAL_RULES.concat(LEGACY_RULES);

function sha256(text) {
    return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function detectLineEnding(text) {
    const s = String(text);
    const hasCrLf = s.includes('\r\n');
    const hasLf = /(?<!\r)\n/.test(s);
    if (hasCrLf && hasLf) return 'mixed';
    if (hasCrLf) return 'crlf';
    return 'lf';
}

function restoreLineEndings(text, ending) {
    const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (ending === 'crlf') return normalized.replace(/\n/g, '\r\n');
    return normalized;
}

class RemediationEngine {
    constructor(rules = DEFAULT_RULES) {
        this.rules = Array.isArray(rules) ? rules.slice() : DEFAULT_RULES.slice();
        this.tokensQuarantined = 0;
    }

    processBuffer(input, fileName = 'unknown') {
        if (typeof input !== 'string') {
            throw new TypeError('processBuffer requires string input');
        }
        const lineEnding = detectLineEnding(input);
        let content = input;
        const rulesApplied = [];
        const matchCounts = {};
        const quarantine = [];

        for (const rule of this.rules) {
            if (rule.enabled === false) continue;
            if (!(rule.pattern instanceof RegExp)) continue;

            if (rule.keyType) {
                const before = content;
                content = this._applyTokenRule(content, rule, quarantine, fileName);
                if (content !== before) {
                    if (!rulesApplied.includes(rule.id)) rulesApplied.push(rule.id);
                    matchCounts[rule.id] = (matchCounts[rule.id] || 0) + 1;
                }
                continue;
            }

            const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`;
            const globalPattern = new RegExp(rule.pattern.source, flags);
            const matches = content.match(globalPattern);
            if (!matches || matches.length === 0) continue;

            content = content.replace(globalPattern, rule.replacement != null ? rule.replacement : '');
            if (!rulesApplied.includes(rule.id)) rulesApplied.push(rule.id);
            matchCounts[rule.id] = (matchCounts[rule.id] || 0) + matches.length;
        }

        const changed = content !== input;
        return {
            original: input,
            content,
            changed,
            rulesApplied,
            matchCounts,
            quarantine,
            fileName
        };
    }

    _applyTokenRule(content, rule, quarantine, fileName) {
        const keyType = rule.keyType;
        if (rule.assignment) {
            return content.replace(rule.pattern, (full, secretValue) => {
                const envName = `SIMPLEBEACON_QUARANTINE_${keyType}_SECRET_${this.tokensQuarantined}`;
                const envRef = `process.env.${envName}`;
                quarantine.push(`${envName}="${secretValue}"`);
                this.tokensQuarantined += 1;
                return `secret_key = ${envRef}`;
            });
        }

        return content.replace(rule.pattern, (token) => {
            const suffix = (keyType === 'STRIPE' || keyType === 'AWS') ? '_KEY' : '';
            const envName = `SIMPLEBEACON_QUARANTINE_${keyType}${suffix}_${this.tokensQuarantined}`;
            const envRef = `process.env.${envName}`;
            quarantine.push(`${envName}="${token}"`);
            this.tokensQuarantined += 1;
            return `${envRef} /* ${keyType}_KEY removed by simplebeacon fix */`;
        });
    }

    processFile(filePath, options = {}) {
        const dryRun = !!options.dryRun;
        const original = fs.readFileSync(filePath, 'utf8');
        const result = this.processBuffer(original, path.basename(filePath));
        const diff = result.changed ? this.renderDiff(original, result.content, path.basename(filePath)) : '';

        if (result.changed && !dryRun) {
            const ending = detectLineEnding(original);
            const output = restoreLineEndings(result.content, ending);
            this.writeAtomic(filePath, output);
            const hash = sha256(output);
            this.verify(filePath, hash);
            result.content = output;
            result.applied = true;
        } else {
            result.applied = false;
        }

        result.diff = diff;
        return result;
    }

    processFiles(filePaths, options = {}) {
        if (!Array.isArray(filePaths)) return [];
        return filePaths.map((filePath) => this.processFile(filePath, options));
    }

    renderDiff(original, modified, fileName) {
        if (original === modified) return '';
        const aLines = String(original).split('\n');
        const bLines = String(modified).split('\n');
        const out = [`--- a/${fileName}`, `+++ b/${fileName}`];

        let i = 0;
        while (i < aLines.length || i < bLines.length) {
            const aLine = aLines[i];
            const bLine = bLines[i];
            if (aLine === bLine) {
                i += 1;
                continue;
            }
            let start = Math.max(0, i - 1);
            let endA = i;
            let endB = i;
            while (endA < aLines.length && (endB >= bLines.length || aLines[endA] !== bLines[endB])) {
                endA += 1;
                if (endB < bLines.length && endA < aLines.length && aLines[endA] === bLines[endB]) break;
                if (endB < bLines.length) endB += 1;
            }
            if (endA === i && endB === i) {
                endA = Math.min(i + 1, aLines.length);
                endB = Math.min(i + 1, bLines.length);
            }
            if (start > 0 && aLines[start - 1] === bLines[start - 1]) {
                out.push(` ${aLines[start - 1]}`);
            }
            out.push(`@@ -${start + 1},${endA - start} +${start + 1},${endB - start} @@`);
            for (let k = i; k < endA; k += 1) out.push(`-${aLines[k]}`);
            for (let k = i; k < endB; k += 1) out.push(`+${bLines[k]}`);
            i = Math.max(endA, endB);
        }
        return `${out.join('\n')}\n`;
    }

    writeAtomic(filePath, content) {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        const tmpPath = `${filePath}.sb-tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmpPath, content, 'utf8');
        fs.renameSync(tmpPath, filePath);
    }

    verify(filePath, expectedHash) {
        const actual = sha256(fs.readFileSync(filePath, 'utf8'));
        if (actual !== expectedHash) {
            throw new Error(`Verification failed for ${filePath}`);
        }
    }
}

module.exports = {
    RemediationEngine,
    DEFAULT_RULES,
    STRUCTURAL_RULES,
    LEGACY_RULES,
    sha256,
    detectLineEnding,
    restoreLineEndings
};
