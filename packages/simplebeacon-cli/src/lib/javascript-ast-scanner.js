// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Optional JavaScript/TypeScript AST analysis — local @babel/parser, no network.
 * Opt-in via config.rules['javascript-ast-patterns'].
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('../rules/production-leak');
const { isExcludedPath, isUnderProductionPaths } = require('../rules/ai-runtime-scan-common');

let _traverse = null;
function getTraverse() { if (!_traverse) { try { _traverse = require('@babel/traverse').default; } catch { return null; } } return _traverse; }
const MAX_SCAN_BYTES = 512000;
const JS_AST_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx']);

const SLOP_PATTERN = /(?:mock_data|sample\.json|test-api|placeholder|todo_truncate_this|dummy-key|(?:\/|\\)mock(?:\/|\\)|-sample\.json)/i;
const HIGH_RISK_PATTERN = /(?:biometric|facial_recognition|credit_score|loan_approval|resume_screen|hiring_filter|polygraph|recidivism)/i;
const TOKEN_LIMIT_KEYS = new Set(['max_tokens', 'max_completion_tokens', 'maxOutputTokens', 'max_tokens_to_sample']);
const LLM_CALLEE_TAIL = new Set(['create', 'generate', 'invoke', 'stream', 'batch', 'streamText', 'generateText']);

const JAVASCRIPT_AST_RULE_CATALOG = [
    {
        id: 'SB-JS-FICTION-001',
        category: 'ai-fiction',
        type: 'AI Slop / Mock Leak',
        severity: 'medium',
        description: 'Hardcoded placeholder or mock-path string (JavaScript AST)'
    },
    {
        id: 'SB-JS-FICTION-002',
        category: 'ai-fiction',
        type: 'Dead / Mock Function',
        severity: 'medium',
        description: 'Function returns only null/undefined — likely AI stub (JavaScript AST)'
    },
    {
        id: 'SB-JS-TB-001',
        category: 'token-bleed',
        type: 'Token Bleed',
        severity: 'medium',
        description: 'LLM call without max_tokens / max_completion_tokens (JavaScript AST)'
    },
    {
        id: 'SB-JS-EU-001',
        category: 'eu-ai-act',
        type: 'EU AI Act — High-Risk Indicator',
        severity: 'high',
        description: 'Identifier or string matches Annex III high-risk term (JavaScript AST)'
    },
    {
        id: 'SB-JS-SQL-001',
        category: 'security-patterns',
        type: 'SQL Injection — Dynamic Concatenation',
        severity: 'critical',
        description: 'SQL string built via template literal or concat inside query executor (JavaScript AST)'
    },
    {
        id: 'SB-JS-SQL-002',
        category: 'security-patterns',
        type: 'SQL Injection — Unparameterized Query',
        severity: 'critical',
        description: 'Non-literal SQL argument passed to query executor without placeholder array (JavaScript AST)'
    }
];

const RECOMMENDATIONS = {
    'SB-JS-FICTION-001': 'Replace mock/sample strings with runtime config or test-scoped fixtures.',
    'SB-JS-FICTION-002': 'Implement the function or remove the AI-generated stub before merge.',
    'SB-JS-TB-001': 'Pass max_tokens, max_completion_tokens, or maxOutputTokens on LLM client calls.',
    'SB-JS-EU-001': 'Document Annex III classification, transparency, and human oversight for this flow.',
    'SB-JS-SQL-001': 'Use parameterized queries with placeholder arrays. Never concatenate variables into SQL strings.',
    'SB-JS-SQL-002': 'Pass query parameters as a separate array to the driver. Do not interpolate user input into SQL.'
};

let babelParser = null;

function loadBabelParser() {
    if (babelParser) return babelParser;
    try {
        babelParser = require('@babel/parser');
        return babelParser;
    } catch (_error) {
        return null;
    }
}

function parserPlugins(ext) {
    const plugins = ['jsx'];
    if (ext === '.ts' || ext === '.tsx') plugins.push('typescript');
    if (ext === '.tsx' || ext === '.jsx') plugins.push('jsx');
    return [...new Set(plugins)];
}

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function makeFinding(rel, line, rule, details) {
    return {
        id: `javascript-ast-${rule.id}-${rel}-${line}`,
        severity: rule.severity,
        severityBand: rule.severity,
        type: rule.type,
        category: rule.category,
        filePath: rel,
        file: rel,
        line,
        pattern: rule.id,
        count: 1,
        description: `${rel}:${line} — ${details}`,
        recommendation: RECOMMENDATIONS[rule.id],
        recommendedAction: RECOMMENDATIONS[rule.id],
        affectedFiles: [path.basename(rel)],
        metadata: {
            patternId: rule.id,
            category: rule.category,
            engine: 'javascript-ast',
            match: details.slice(0, 120)
        }
    };
}

function isStubBody(body) {
    if (!Array.isArray(body) || body.length !== 1) return false;
    const stmt = body[0];
    if (stmt.type === 'ReturnStatement') {
        const val = stmt.argument;
        return val == null
            || (val.type === 'Identifier' && val.name === 'undefined')
            || (val.type === 'NullLiteral');
    }
    if (stmt.type === 'BlockStatement') {
        return isStubBody(stmt.body);
    }
    return false;
}

function calleeLabel(node) {
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression') {
        const prop = node.property.type === 'Identifier' ? node.property.name : '';
        if (node.object.type === 'MemberExpression') {
            return `${calleeLabel(node.object)}.${prop}`;
        }
        const obj = node.object.type === 'Identifier' ? node.object.name : 'obj';
        return `${obj}.${prop}`;
    }
    return 'call';
}

function isLlmCall(node) {
    if (node.type === 'Identifier' && LLM_CALLEE_TAIL.has(node.name)) {
        return true;
    }
    if (node.type !== 'MemberExpression') return false;
    const label = calleeLabel(node);
    if (/openai\.chat\.completions\.create|anthropic\.messages\.create|\.chat\.completions\.create|\.responses\.create/i.test(label)) return true;
    if (!/(?:openai|anthropic|claude|gpt|llm|chat\.completion|completion|embedding|streamtext|generatetext|ai\.)/i.test(label)) return false;
    const prop = node.property.type === 'Identifier' ? node.property.name : '';
    return LLM_CALLEE_TAIL.has(prop);
}

const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|WHERE|FROM|JOIN|TABLE)\b/i;
const QUERY_EXECUTOR_NAMES = new Set(['query', 'execute', 'run', 'all', 'get', 'exec']);

function isQueryExecutor(node) {
    if (node.type === 'Identifier' && QUERY_EXECUTOR_NAMES.has(node.name)) return true;
    if (node.type === 'MemberExpression') {
        const prop = node.property.type === 'Identifier' ? node.property.name : '';
        return QUERY_EXECUTOR_NAMES.has(prop);
    }
    return false;
}

function hasSqlKeywords(node) {
    if (node.type === 'TemplateLiteral') return true; // any template literal in SQL context is suspicious
    if (node.type === 'StringLiteral' && SQL_KEYWORDS.test(node.value)) return true;
    if (node.type === 'BinaryExpression' && node.operator === '+') return true;
    if (node.type === 'Identifier') return true; // variable reference in query executor context
    if (node.type === 'MemberExpression') return true; // object property holding SQL
    return false;
}

function isDynamicSqlArg(node) {
    // Template literal with expressions (e.g., `SELECT ${col}`)
    if (node.type === 'TemplateLiteral' && node.expressions && node.expressions.length > 0) return true;
    // String concatenation (e.g., "SELECT " + col)
    if (node.type === 'BinaryExpression' && node.operator === '+') return true;
    // Identifier or member expression (variable holding SQL)
    if (node.type === 'Identifier' || node.type === 'MemberExpression') return true;
    // Call expression returning SQL string
    if (node.type === 'CallExpression') return true;
    return false;
}

function hasParameterArray(args) {
    // Look for a second argument that is an array (parameter placeholders)
    if (args.length < 2) return false;
    const second = args[1];
    if (second.type === 'ArrayExpression') return true;
    if (second.type === 'Identifier') return true; // assume external array var is params
    return false;
}

function hasTokenLimit(args) {
    for (const arg of args) {
        if (arg.type === 'ObjectExpression') {
            for (const prop of arg.properties) {
                if (prop.type !== 'ObjectProperty' && prop.type !== 'Property') continue;
                const key = prop.key.type === 'Identifier' ? prop.key.name
                    : prop.key.type === 'StringLiteral' ? prop.key.value : null;
                if (key && TOKEN_LIMIT_KEYS.has(key)) return true;
            }
        }
    }
    return false;
}

function scanSourceAst(relativePath, content, ext) {
    const findings = [];
    const seen = new Set();
    const parser = loadBabelParser();
    if (!parser) {
        return { findings, error: '@babel/parser not installed' };
    }

    let ast;
    try {
        ast = parser.parse(content, {
            sourceFilename: relativePath,
            sourceType: 'module',
            plugins: parserPlugins(ext),
            errorRecovery: false
        });
    } catch {
        return { findings, parseError: true };
    }

    const push = (rule, line, details) => {
        const key = `${rule.id}:${line}:${details.slice(0, 40)}`;
        if (seen.has(key)) return;
        seen.add(key);
        findings.push(makeFinding(relativePath, line, rule, details));
    };

    getTraverse()(ast, {
        StringLiteral(pathNode) {
            const val = pathNode.node.value;
            if (SLOP_PATTERN.test(val)) {
                push(JAVASCRIPT_AST_RULE_CATALOG[0], pathNode.node.loc?.start?.line || 1,
                    `Hardcoded placeholder string detected: '${val.slice(0, 80)}'`);
            }
            if (HIGH_RISK_PATTERN.test(val)) {
                push(JAVASCRIPT_AST_RULE_CATALOG[3], pathNode.node.loc?.start?.line || 1,
                    `String literal triggers Annex III review: '${val.slice(0, 80)}'`);
            }
        },
        Identifier(pathNode) {
            if (HIGH_RISK_PATTERN.test(pathNode.node.name)) {
                push(JAVASCRIPT_AST_RULE_CATALOG[3], pathNode.node.loc?.start?.line || 1,
                    `Identifier '${pathNode.node.name}' triggers Annex III review.`);
            }
        },
        FunctionDeclaration(pathNode) {
            if (isStubBody(pathNode.node.body)) {
                push(JAVASCRIPT_AST_RULE_CATALOG[1], pathNode.node.loc?.start?.line || 1,
                    `Function '${pathNode.node.id?.name || 'anonymous'}' returns only null/undefined — likely stub.`);
            }
        },
        FunctionExpression(pathNode) {
            if (pathNode.node.id && isStubBody(pathNode.node.body)) {
                push(JAVASCRIPT_AST_RULE_CATALOG[1], pathNode.node.loc?.start?.line || 1,
                    `Function '${pathNode.node.id.name}' returns only null/undefined — likely stub.`);
            }
        },
        ArrowFunctionExpression(pathNode) {
            const body = pathNode.node.body;
            if (body.type === 'NullLiteral'
                || (body.type === 'Identifier' && body.name === 'undefined')) {
                push(JAVASCRIPT_AST_RULE_CATALOG[1], pathNode.node.loc?.start?.line || 1,
                    'Arrow function returns only null/undefined — likely stub.');
            }
        },
        CallExpression(pathNode) {
            const callee = pathNode.node.callee;
            const args = pathNode.node.arguments || [];
            const line = pathNode.node.loc?.start?.line || 1;

            // LLM token bleed check
            if (isLlmCall(callee)) {
                if (!hasTokenLimit(args)) {
                    push(JAVASCRIPT_AST_RULE_CATALOG[2], line,
                        `Unbounded LLM call via '${calleeLabel(callee)}' — missing token limit.`);
                }
            }

            // SQL injection checks
            if (!isQueryExecutor(callee)) return;
            const firstArg = args[0];
            if (!firstArg) return;

            // SB-JS-SQL-001: Dynamic SQL concatenation
            if (isDynamicSqlArg(firstArg) && hasSqlKeywords(firstArg)) {
                push(JAVASCRIPT_AST_RULE_CATALOG[4], line,
                    `Dynamic SQL in '${calleeLabel(callee)}' — string built via concat/template/interpolation.`);
            }

            // SB-JS-SQL-002: Unparameterized query (non-literal first arg without param array)
            if (firstArg.type !== 'StringLiteral' && !hasParameterArray(args)) {
                push(JAVASCRIPT_AST_RULE_CATALOG[5], line,
                    `Unparameterized query in '${calleeLabel(callee)}' — variable SQL without placeholder array.`);
            }
        }
    });

    return { findings };
}

function scanTextPatterns(relativePath, content, ext, options = {}) {
    if (!JS_AST_EXTENSIONS.has(ext)) return [];
    if (isExcludedPath(relativePath)) return [];
    if (options.productionPathsOnly !== false
        && !isUnderProductionPaths(relativePath, options.productionPaths || ['server/', 'src/', 'app/', 'lib/'])) {
        return [];
    }
    if (content.length > MAX_SCAN_BYTES) return [];
    const { findings } = scanSourceAst(relativePath, content, ext);
    return findings;
}

async function walkProductionSourceFiles(dir, results = [], depth = 0) {
    if (depth > 8) return results;
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    const skip = new Set(['node_modules', '.git', 'coverage', 'dist', 'build', 'tests', 'test', '__tests__', 'docs', 'examples']);
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skip.has(entry.name)) continue;
            await walkProductionSourceFiles(fullPath, results, depth + 1);
            continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!JS_AST_EXTENSIONS.has(ext)) continue;
        try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size > MAX_SCAN_BYTES) continue;
            results.push({ path: fullPath, ext });
        } catch {
            /* skip */
        }
    }
    return results;
}

async function scanJavascriptAstPatterns(baseDir, options = {}) {
    const parser = loadBabelParser();
    if (!parser) {
        return {
            ok: false,
            scanned: 0,
            findings: 0,
            issues: [],
            patterns: JAVASCRIPT_AST_RULE_CATALOG.map((r) => r.id),
            error: '@babel/parser is required for javascript-ast-patterns'
        };
    }

    const productionPaths = options.productionPaths || ['server/', 'src/', 'app/', 'lib/'];
    const ignoreGlobs = options.ignoreGlobs || [];
    const severityDefault = options.severity || 'medium';
    const files = [];

    for (const rel of productionPaths) {
        const abs = path.join(baseDir, ...rel.replace(/\/$/, '').split('/'));
        if (fs.existsSync(abs)) {
            await walkProductionSourceFiles(abs, files);
        }
    }

    const seen = new Set();
    const uniqueFiles = [];
    for (const file of files) {
        if (seen.has(file.path)) continue;
        seen.add(file.path);
        uniqueFiles.push(file);
    }

    const issues = [];
    let scanned = 0;

    for (const file of uniqueFiles) {
        const relativePath = normalizeRel(baseDir, file.path);
        if (ignoreGlobs.some((g) => globMatch(relativePath, g))) continue;
        if (isExcludedPath(relativePath)) continue;
        if (!isUnderProductionPaths(relativePath, productionPaths)) continue;

        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }

        scanned += 1;
        const batch = scanTextPatterns(relativePath, content, file.ext, {
            productionPathsOnly: true,
            productionPaths
        });
        for (const issue of batch) {
            if (!issue.severity) issue.severity = severityDefault;
            issues.push(issue);
        }
    }

    return {
        ok: true,
        scanned,
        findings: issues.length,
        issues,
        patterns: JAVASCRIPT_AST_RULE_CATALOG.map((r) => r.id)
    };
}

function scanJavascriptAstSnippet(projectRoot, relativePath, content, options = {}) {
    const ext = path.extname(relativePath).toLowerCase();
    if (!JS_AST_EXTENSIONS.has(ext)) {
        return { ok: true, findings: 0, issues: [] };
    }
    const issues = scanTextPatterns(relativePath, content, ext, {
        productionPathsOnly: true,
        productionPaths: options.productionPaths || ['server/', 'src/', 'app/', 'lib/']
    });
    const severityDefault = options.severity || 'medium';
    for (const issue of issues) {
        if (!issue.severity) issue.severity = severityDefault;
    }
    return { ok: true, findings: issues.length, issues };
}

module.exports = {
    JAVASCRIPT_AST_RULE_CATALOG,
    JS_AST_EXTENSIONS,
    scanTextPatterns,
    scanJavascriptAstPatterns,
    scanJavascriptAstSnippet,
    loadBabelParser
};
