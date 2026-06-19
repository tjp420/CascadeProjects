/**
 * Budget-as-Code scanner — validates simplebeacon.budget.json and inline budget configs.
 * Ensures AI API usage is constrained by declared spend and rate limits.
 */

const fs = require('fs');
const path = require('path');
const { access, readFile } = fs.promises;

const RULE_CATALOG = [
    {
        id: 'SB-ENT-006',
        category: 'budget-as-code',
        severity: 'medium',
        description: 'Missing simplebeacon.budget.json or inline budget config for LLM usage'
    },
    {
        id: 'SB-ENT-006a',
        category: 'budget-as-code',
        severity: 'medium',
        description: 'LLM call max_tokens exceeds budget config maxTokensPerRequest'
    },
    {
        id: 'SB-ENT-006b',
        category: 'budget-as-code',
        severity: 'high',
        description: 'Budget config missing maxMonthlySpend or maxTokensPerRequest'
    }
];

const BUDGET_FILE_NAMES = ['simplebeacon.budget.json', '.simplebeacon.budget.json'];
const LLM_INVOCATION_PATTERNS = [
    /chat\.completions\.create\s*\(/i,
    /\.messages\.create\s*\(/i,
    /\.completions\.create\s*\(/i,
    /\.responses\.create\s*\(/i,
    /\.embeddings\.create\s*\(/i,
    /(?:openai|anthropic|bedrock|vertexai|generativeai)\.[a-z0-9_.]+\.(?:create|generate|invoke|stream)\s*\(/i
];

const MAX_TOKENS_RE = /\bmax_(?:completion_)?tokens\b\s*[:=]\s*(\d+)/i;

async function findBudgetConfig(baseDir) {
    for (const name of BUDGET_FILE_NAMES) {
        const fullPath = path.join(baseDir, name);
        try {
            await access(fullPath);
            return JSON.parse(await readFile(fullPath, 'utf8'));
        } catch {
            // file doesn't exist or can't be parsed, try next
        }
    }
    return null;
}

function lineHasLlmInvocation(line) {
    return LLM_INVOCATION_PATTERNS.some((re) => re.test(line));
}

function scanBudgetCompliance(relativePath, content, budgetConfig) {
    const findings = [];
    if (!budgetConfig) {
        findings.push({
            id: `enterprise-SB-ENT-006-${relativePath}-1`,
            severity: 'medium',
            severityBand: 'medium',
            type: 'Budget-as-Code Missing',
            filePath: relativePath,
            file: relativePath,
            line: 1,
            pattern: 'SB-ENT-006',
            count: 1,
            description: `${relativePath}: no simplebeacon.budget.json found — LLM usage is unconstrained by declared budget`,
            recommendedAction: 'Create simplebeacon.budget.json with maxMonthlySpend, maxTokensPerRequest, and maxRequestsPerMinute',
            affectedFiles: [relativePath],
            metadata: {
                ruleId: 'SB-ENT-006',
                category: 'budget-as-code'
            }
        });
        return findings;
    }

    if (!budgetConfig.maxMonthlySpend || !budgetConfig.maxTokensPerRequest) {
        findings.push({
            id: `enterprise-SB-ENT-006b-${relativePath}-1`,
            severity: 'high',
            severityBand: 'high',
            type: 'Budget Config Incomplete',
            filePath: relativePath,
            file: relativePath,
            line: 1,
            pattern: 'SB-ENT-006b',
            count: 1,
            description: `${relativePath}: budget config missing required fields (maxMonthlySpend or maxTokensPerRequest)`,
            recommendedAction: 'Add maxMonthlySpend (USD) and maxTokensPerRequest to simplebeacon.budget.json',
            affectedFiles: [relativePath],
            metadata: {
                ruleId: 'SB-ENT-006b',
                category: 'budget-as-code',
                config: budgetConfig
            }
        });
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!lineHasLlmInvocation(line)) continue;
        const match = MAX_TOKENS_RE.exec(line);
        if (!match) continue;
        const value = parseInt(match[1], 10);
        if (budgetConfig.maxTokensPerRequest && value > budgetConfig.maxTokensPerRequest) {
            findings.push({
                id: `enterprise-SB-ENT-006a-${relativePath}-${i + 1}`,
                severity: 'medium',
                severityBand: 'medium',
                type: 'Budget Config Violation',
                filePath: relativePath,
                file: relativePath,
                line: i + 1,
                pattern: 'SB-ENT-006a',
                count: 1,
                description: `${relativePath}:${i + 1} — max_tokens (${value}) exceeds budget config limit (${budgetConfig.maxTokensPerRequest})`,
                recommendedAction: `Reduce max_tokens to <= ${budgetConfig.maxTokensPerRequest} or update simplebeacon.budget.json`,
                affectedFiles: [relativePath],
                metadata: {
                    ruleId: 'SB-ENT-006a',
                    category: 'budget-as-code',
                    maxTokens: value,
                    budgetLimit: budgetConfig.maxTokensPerRequest
                }
            });
        }
    }

    return findings;
}

async function scanBudgetConfig(baseDir, options = {}) {
    const budgetConfig = await findBudgetConfig(baseDir);
    const findings = [];
    const scannedFiles = options.files || [];

    for (const file of scannedFiles) {
        const relativePath = path.relative(baseDir, file.path).split(path.sep).join('/');
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }
        findings.push(...scanBudgetCompliance(relativePath, content, budgetConfig));
    }

    return {
        scanned: scannedFiles.length,
        findings: findings.length,
        issues: findings,
        patterns: RULE_CATALOG.map((r) => r.id),
        budgetConfig
    };
}

module.exports = {
    RULE_CATALOG,
    scanBudgetCompliance,
    scanBudgetConfig,
    findBudgetConfig
};
