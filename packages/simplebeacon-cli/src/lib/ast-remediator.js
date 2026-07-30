// simplebeacon-ignore: Remediation engine pattern definitions — all findings are false positives
/**
 * Deterministic AST Remediator Engine
 *
 * Generates safe, deterministic search/replace patches for AST-detected
 * patterns without requiring an LLM. Runs as a first-pass before the
 * LLM-based local-remediation.js fallback.
 *
 * Supported pattern fixes:
 *   SB-PY-FICTION-002 / SB-GO-FICTION-002 / SB-JS-FICTION-002: Stub functions
 *   SB-PY-TB-001 / SB-JS-TB-001: LLM calls without token limits
 *   SB-PY-REDUNDANCY-002: Redundant try/except wrappers (Python)
 *   SB-JS-SQL-001: SQL injection via template literal (JavaScript)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Snippet extraction (shared with local-remediation.js but standalone here)
// ---------------------------------------------------------------------------
function extractSnippet(filePath, lineHint, contextLines = 6) {
    if (typeof filePath !== 'string' || !filePath) return null;
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const hint = Number.isFinite(lineHint) ? lineHint : 1;
    const ctx = Number.isFinite(contextLines) && contextLines > 0 ? contextLines : 6;
    const targetLine = Math.max(0, hint - 1);
    const start = Math.max(0, targetLine - ctx);
    const end = Math.min(lines.length, targetLine + ctx + 1);
    return lines.slice(start, end).join('\n');
}

// ---------------------------------------------------------------------------
// Unified diff generator
// ---------------------------------------------------------------------------
function makeDiff(search, replace, fileName) {
    const s = typeof search === 'string' ? search : String(search ?? '');
    const r = typeof replace === 'string' ? replace : String(replace ?? '');
    const name = typeof fileName === 'string' ? fileName : 'unknown';
    const out = [`--- ${name}`, `+++ ${name}`];
    const sLines = s.split('\n');
    const rLines = r.split('\n');
    for (const line of sLines) out.push(`- ${line}`);
    for (const line of rLines) out.push(`+ ${line}`);
    return out.join('\n');
}

// ---------------------------------------------------------------------------
// Fix generators — each returns { search, replace } or null
// ---------------------------------------------------------------------------

/**
 * SB-PY-FICTION-002: Python stub function → raise NotImplementedError
 */
function fixPythonStub(snippet, finding) {
    // Match: def funcname(...):\n    return None  OR  def funcname(...):\n    pass
    const stubRe = /((?:async\s+)?def\s+(\w+)\s*\([^)]*\)[^:]*:\s*\n)((?:\s+return\s+None\s*\n)|(?:\s+pass\s*\n))/;
    const m = snippet.match(stubRe);
    if (!m) return null;
    const funcName = m[2];
    const indent = '    ';
    const search = m[0];
    const replace = `${m[1]}${indent}raise NotImplementedError("Implement: ${funcName}")\n`;
    return { search, replace };
}

/**
 * SB-GO-FICTION-002: Go stub function → panic("implement: ...")
 */
function fixGoStub(snippet, finding) {
    // Match: func funcname(...) ... { return nil } or { } or { panic("not implemented") }
    const stubRe = /func\s+(\w+)\s*\([^)]*\)[^{]*\{\s*(?:return\s+(?:nil|""|0|false)\s*)?(?:panic\("[^"]*"\)\s*)?\}/;
    const m = snippet.match(stubRe);
    if (!m) return null;
    const funcName = m[1];
    const search = m[0];
    const replace = `func ${funcName}() {\n\tpanic("implement: ${funcName}")\n}`;
    return { search, replace };
}

/**
 * SB-JS-FICTION-002: JavaScript stub function → throw new Error
 */
function fixJsStub(snippet, finding) {
    // Match: function funcname(...) { return undefined; } or { return null; } or { return; }
    const stubRe = /((?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{)\s*(?:return\s+(?:undefined|null|void\s+0)\s*;?)?\s*\}/;
    const m = snippet.match(stubRe);
    if (!m) return null;
    const funcName = m[2];
    const search = m[0];
    const replace = `${m[1]}\n  throw new Error('Implement: ${funcName}');\n}`;
    return { search, replace };
}

/**
 * SB-PY-TB-001 / SB-JS-TB-001: LLM call without token limit → add max_tokens
 */
function fixTokenBleed(snippet, finding) {
    // Python: client.chat.completions.create(model="gpt-4", messages=[...])
    //   → add max_tokens=4096 kwarg
    // JavaScript: openai.chat.completions.create({ model: "gpt-4", messages: [...] })
    //   → add max_tokens: 4096 property

    const ext = finding.metadata?.engine === 'javascript-ast' ? 'js' : 'py';

    if (ext === 'py') {
        // Match Python call ending with ) that doesn't have max_tokens
        const callRe = /((?:openai|anthropic|client|llm)\.\w+\.\w+\.(?:create|generate|invoke|stream|batch)\s*\()([\s\S]*?)(\))/;
        const m = snippet.match(callRe);
        if (!m) return null;
        if (/max_tokens|max_completion_tokens/i.test(m[2])) return null; // already has it
        const search = m[0];
        const args = m[2].trim();
        const replace = `${m[1]}${args}${args && !args.endsWith(',') ? ', ' : ''}max_tokens=4096${m[3]}`;
        return { search, replace };
    }

    // JavaScript: object literal argument (handles multi-line)
    const callRe = /((?:openai|anthropic|client|llm)\.\w+\.\w+\.(?:create|generate|invoke|stream|batch)\s*\(\s*\{)([\s\S]*?)(\}\s*\))/;
    const m = snippet.match(callRe);
    if (!m) return null;
    if (/max_tokens|max_completion_tokens|maxOutputTokens/i.test(m[2])) return null;
    const search = m[0];
    const props = m[2].trim();
    const replace = `${m[1]}${props}${props && !props.endsWith(',') ? ', ' : ''}max_tokens: 4096${m[3]}`;
    return { search, replace };
}

/**
 * SB-PY-REDUNDANCY-002: Redundant try/except wrapper → unwrap
 * Only unwraps if the try block has a single statement and the except just passes/logs.
 */
function fixRedundantTryExcept(snippet, finding) {
    // Match: try:\n    <single_statement>\nexcept Exception:\n    pass (or log)
    const tryRe = /try:\s*\n(\s+)(\S[^\n]*)\n\s*except\s+\w+[^:]*:\s*\n\s+(?:pass|logging\.\w+\([^)]*\)|logger\.\w+\([^)]*\))\s*\n/;
    const m = snippet.match(tryRe);
    if (!m) return null;
    const indent = m[1];
    const stmt = m[2];
    const search = m[0];
    const replace = `${indent}${stmt}\n`;
    return { search, replace };
}

/**
 * SB-JS-SQL-001: SQL injection via template literal → parameterized query
 * Transforms: db.query(`SELECT * FROM users WHERE id = ${id}`)
 * Into:       db.query('SELECT * FROM users WHERE id = ?', [id])
 */
function fixSqlInjection(snippet, finding) {
    // Match: executor(`SELECT ... ${var} ...`)
    const sqlRe = /(\w+(?:\.\w+)*)\s*\(\s*`((?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|EXEC)\s[^`]*)`\s*\)/;
    const m = snippet.match(sqlRe);
    if (!m) return null;
    const executor = m[1];
    const template = m[2];

    // Extract ${var} expressions
    const varRe = /\$\{([^}]+)\}/g;
    const params = [];
    let paramMatch;
    while ((paramMatch = varRe.exec(template)) !== null) {
        params.push(paramMatch[1].trim());
    }
    if (params.length === 0) return null;

    // Replace ${var} with ?
    const parameterized = template.replace(varRe, '?');
    const search = m[0];
    const replace = `${executor}('${parameterized}', [${params.join(', ')}])`;
    return { search, replace };
}

/**
 * SB-GO-REDUNDANCY-002: Repeated identical error handlers → consolidate into helper
 * Transforms: if err != nil { return err }
 * Into:       if err != nil { return handleError(err) }
 * (Only applies when the same handler body appears 3+ times in the snippet)
 */
function fixGoRepeatedErrorHandlers(snippet, finding) {
    const errRe = /if\s+err\s*!=\s*nil\s*\{\s*([^\n}]+)\s*\}/g;
    const handlers = [];
    let m;
    while ((m = errRe.exec(snippet)) !== null) {
        handlers.push({ match: m[0], body: m[1].trim() });
    }
    if (handlers.length < 3) return null;

    // Find the most common handler body
    const counts = {};
    for (const h of handlers) {
        counts[h.body] = (counts[h.body] || 0) + 1;
    }
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon[1] < 3) return null;

    const commonBody = mostCommon[0];
    const helperName = 'handleErr';

    // Replace all instances of the common handler with helper call
    let modified = snippet;
    const searchRe = new RegExp(
        `if\\s+err\\s*!=\\s*nil\\s*\\{\\s*${commonBody.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}`,
        'g'
    );
    modified = modified.replace(searchRe, `if err != nil {\n\treturn ${helperName}(err)\n}`);

    // Prepend helper function if not already present
    const helperDef = `func ${helperName}(err error) error {\n\t${commonBody}\n}\n\n`;
    const search = snippet;
    const replace = helperDef + modified;
    return { search, replace };
}

/**
 * SB-GO-REDUNDANCY-003: Deep nesting → suggest guard clause extraction
 * This is a recommendation-only fix (adds a TODO comment with refactor suggestion).
 */
function fixGoDeepNesting(snippet, finding) {
    // Find the function with deep nesting and add a refactor TODO
    const funcRe = /(func\s+(\w+)\s*\([^)]*\)[^{]*\{)/;
    const m = snippet.match(funcRe);
    if (!m) return null;
    const funcName = m[2];
    const search = m[1];
    const replace = `${m[1]}\n\t// TODO(refactor): Extract guard clauses to reduce nesting depth in ${funcName}()`;
    return { search, replace };
}

/**
 * SB-GO-TB-001: Go LLM call without token limit → add MaxTokens field
 */
function fixGoTokenBleed(snippet, finding) {
    // Match Go struct literal call: client.Chat.Create(ctx, &openai.ChatRequest{Model: "gpt-4"})
    const callRe = /((?:openai|anthropic|client|llm)\.(?:Chat|Complete|Generate|Create|Invoke|Stream|Batch)\w*(?:\.\w+)?)\s*\(\s*(\w+)\s*,\s*&(\w+\.\w+\{)([^}]*)(\}\s*\))/;
    const m = snippet.match(callRe);
    if (!m) return null;
    if (/MaxTokens|max_tokens|MaxCompletionTokens/i.test(m[4])) return null;
    const search = m[0];
    const props = m[4].trim();
    const replace = `${m[1]}(${m[2]}, &${m[3]}${props}${props && !props.endsWith(',') ? ', ' : ''}MaxTokens: 4096${m[5]}`;
    return { search, replace };
}

/**
 * SB-GO-REDUNDANCY-001: Duplicate Go function bodies → suggest extraction
 * This is a recommendation-only fix (adds a TODO comment).
 */
function fixGoDuplicateBody(snippet, finding) {
    const funcRe = /(func\s+(\w+)\s*\([^)]*\)[^{]*\{)/;
    const m = snippet.match(funcRe);
    if (!m) return null;
    const funcName = m[2];
    const search = m[1];
    const replace = `${m[1]}\n\t// TODO(refactor): ${funcName}() has a duplicate body — extract shared logic into a helper`;
    return { search, replace };
}

/**
 * SB-JS-SQL-002: Unparameterized SQL query (string variable passed to executor)
 * Transforms: db.query(sqlString) → db.query(sqlString, [])
 * Adds empty params array to signal intent to parameterize.
 */
function fixJsSqlUnparameterized(snippet, finding) {
    // Match: executor(variableName) where variableName is not a template literal or string literal
    const callRe = /(\w+(?:\.\w+)*)\s*\(\s*(sql\w*|query\w*|stmt\w*)\s*\)/;
    const m = snippet.match(callRe);
    if (!m) return null;
    const search = m[0];
    const replace = `${m[1]}(${m[2]}, []) // TODO: Pass query parameters as array, not interpolated string`;
    return { search, replace };
}

/**
 * SB-PY-REDUNDANCY-004: Python deep nesting → suggest guard clause extraction
 * Adds a TODO comment with refactor suggestion.
 */
function fixPythonDeepNesting(snippet, finding) {
    const funcRe = /((?:async\s+)?def\s+(\w+)\s*\([^)]*\)[^:]*:)/;
    const m = snippet.match(funcRe);
    if (!m) return null;
    const funcName = m[2];
    const search = m[1];
    const replace = `${m[1]}\n    # TODO(refactor): Extract guard clauses to reduce nesting depth in ${funcName}()`;
    return { search, replace };
}

/**
 * SB-PY-REDUNDANCY-001: Duplicate Python function bodies → suggest extraction
 * Adds a TODO comment with refactor suggestion.
 */
function fixPythonDuplicateBody(snippet, finding) {
    const funcRe = /((?:async\s+)?def\s+(\w+)\s*\([^)]*\)[^:]*:)/;
    const m = snippet.match(funcRe);
    if (!m) return null;
    const funcName = m[2];
    const search = m[1];
    const replace = `${m[1]}\n    # TODO(refactor): ${funcName}() has a duplicate body — extract shared logic into a helper`;
    return { search, replace };
}

// ---------------------------------------------------------------------------
// Fix registry: pattern ID → fix function
// ---------------------------------------------------------------------------
const FIX_REGISTRY = {
    'SB-PY-FICTION-002': fixPythonStub,
    'SB-GO-FICTION-002': fixGoStub,
    'SB-JS-FICTION-002': fixJsStub,
    'SB-PY-TB-001': fixTokenBleed,
    'SB-JS-TB-001': fixTokenBleed,
    'SB-GO-TB-001': fixGoTokenBleed,
    'SB-PY-REDUNDANCY-002': fixRedundantTryExcept,
    'SB-PY-REDUNDANCY-001': fixPythonDuplicateBody,
    'SB-PY-REDUNDANCY-004': fixPythonDeepNesting,
    'SB-GO-REDUNDANCY-001': fixGoDuplicateBody,
    'SB-GO-REDUNDANCY-002': fixGoRepeatedErrorHandlers,
    'SB-GO-REDUNDANCY-003': fixGoDeepNesting,
    'SB-JS-SQL-001': fixSqlInjection,
    'SB-JS-SQL-002': fixJsSqlUnparameterized,
};

// ---------------------------------------------------------------------------
// Main: attempt deterministic fix for a single finding
// ---------------------------------------------------------------------------
function remediateFinding(finding, options = {}) {
    if (!finding || typeof finding !== 'object') {
        return { applied: false, reason: 'Invalid finding object', engine: 'deterministic' };
    }

    const patternId = finding.pattern || finding.metadata?.patternId;
    const fixFn = FIX_REGISTRY[patternId];
    if (!fixFn) {
        return { applied: false, reason: `No deterministic fix for pattern ${patternId}`, engine: 'deterministic' };
    }

    const filePath = finding.filePath || finding.file || (finding.affectedFiles && finding.affectedFiles[0]);
    if (!filePath) {
        return { applied: false, reason: 'No filePath in finding', engine: 'deterministic' };
    }

    const line = finding.line || finding.metadata?.line || null;
    const ctxLines = patternId === 'SB-GO-REDUNDANCY-002' ? 20 : 8;
    const snippet = extractSnippet(filePath, line, ctxLines);
    if (!snippet) {
        return { applied: false, reason: 'Could not read source file', engine: 'deterministic' };
    }

    let fix;
    try {
        fix = fixFn(snippet, finding);
    } catch (err) {
        return { applied: false, reason: `Fix generator error: ${err.message}`, engine: 'deterministic' };
    }

    if (!fix || !fix.search) {
        return { applied: false, reason: 'Pattern did not match for deterministic fix', engine: 'deterministic' };
    }

    const diff = makeDiff(fix.search, fix.replace, path.basename(filePath));
    const fullPath = path.resolve(filePath);

    if (options.dryRun) {
        return { applied: false, diff, reason: 'dry-run', engine: 'deterministic', search: fix.search, replace: fix.replace };
    }

    // Apply the fix
    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (!content.includes(fix.search)) {
            return { applied: false, diff, reason: 'Search text not found in file (whitespace mismatch?)', engine: 'deterministic' };
        }
        const updated = content.replace(fix.search, fix.replace);
        fs.writeFileSync(fullPath, updated, 'utf8');
        return { applied: true, diff, filePath: fullPath, engine: 'deterministic' };
    } catch (err) {
        return { applied: false, diff, reason: `Write failed: ${err.message}`, engine: 'deterministic' };
    }
}

// ---------------------------------------------------------------------------
// Batch: run deterministic fixes across multiple findings
// ---------------------------------------------------------------------------
function runDeterministicRemediation(findings, options = {}) {
    if (!Array.isArray(findings)) {
        return { total: 0, applied: 0, failed: 0, results: [], engine: 'deterministic' };
    }

    const results = [];
    const maxFixes = Number.isFinite(options.maxFixes) && options.maxFixes > 0 ? options.maxFixes : 20;

    for (let i = 0; i < Math.min(findings.length, maxFixes); i++) {
        const finding = findings[i];
        const result = remediateFinding(finding, options);
        results.push({
            issue: finding.type || finding.pattern || 'unknown',
            patternId: finding.pattern || finding.metadata?.patternId,
            ...result,
        });
    }

    const applied = results.filter((r) => r.applied);
    const failed = results.filter((r) => !r.applied);

    return {
        total: results.length,
        applied: applied.length,
        failed: failed.length,
        results,
        engine: 'deterministic',
    };
}

// ---------------------------------------------------------------------------
// Get list of patterns that have deterministic fixes
// ---------------------------------------------------------------------------
function getSupportedPatterns() {
    return Object.keys(FIX_REGISTRY);
}

module.exports = {
    remediateFinding,
    runDeterministicRemediation,
    extractSnippet,
    makeDiff,
    getSupportedPatterns,
    FIX_REGISTRY,
};
