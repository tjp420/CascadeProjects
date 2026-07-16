// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Lightweight structure hints for Tier-1 universal analysis (regex, not AST).
 */

const STRUCTURE_PATTERNS = {
    functions: [
        /\bfunction\s+[A-Za-z_$][\w$]*\s*\(/g,
        /\b(?:void|int|float|double|bool|string|auto|func|fn|def|sub|procedure)\s+[A-Za-z_][\w]*\s*\(/g,
        /\b[A-Za-z_][\w]*\s*\([^)]*\)\s*(?:\{|:)/g
    ],
    classes: [
        /\bclass\s+[A-Za-z_][\w]*/g,
        /\b(?:struct|interface|trait|enum|type)\s+[A-Za-z_][\w]*/g,
        /\b(?:module|namespace)\s+[A-Za-z_][\w]*/g
    ],
    imports: [
        /\b(?:import|from|require|include|use)\s+[\w"'./-]+/g,
        /#include\s+[<"][^>"]+[>"]/g
    ]
};

/**
 * Count pattern matches.
 * @param {any} content
 * @param {Array} patterns
 * @param {number} limit
 * @returns {any}
 */
function countPatternMatches(content, patterns, limit = 40) {
    let total = 0;
    for (const pattern of patterns) {
        const re = new RegExp(pattern.source, pattern.flags);
        while (re.exec(content) !== null) {
            total += 1;
            if (total >= limit) return total;
        }
    }
    return total;
}

/**
 * Extract generic structure hints.
 * @param {any} content
 * @param {string} context
 * @returns {any}
 */
function extractGenericStructureHints(content, context = {}) {
    const text = String(content || '');
    const lines = text.split(/\r?\n/).length;
    const functionCount = countPatternMatches(text, STRUCTURE_PATTERNS.functions, 30);
    const classCount = countPatternMatches(text, STRUCTURE_PATTERNS.classes, 20);
    const importCount = countPatternMatches(text, STRUCTURE_PATTERNS.imports, 20);

    let complexity = 'low';
    if (lines > 400 || functionCount > 15 || classCount > 8) complexity = 'high';
    else if (lines > 120 || functionCount > 5 || classCount > 2) complexity = 'medium';

    return {
        language: context.language || 'generic',
        filePath: context.filePath || null,
        lineCount: lines,
        approximateFunctions: functionCount,
        approximateClasses: classCount,
        importOrIncludeCount: importCount,
        complexity,
        tier: 'baseline'
    };
}

module.exports = {
    extractGenericStructureHints,
    STRUCTURE_PATTERNS
};
