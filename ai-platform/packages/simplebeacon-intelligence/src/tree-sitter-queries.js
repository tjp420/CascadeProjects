/**
 * Tree-sitter query helpers — extract function scopes for intent analysis.
 */

import { analyzeFunctionBlock, scanCredentialDictStubs } from './structural-intent-scanner.js';
import { INTENT_RULE_IDS } from './constants.js';
import { parseWithTreeSitter, getTreeSitterStatus } from './tree-sitter-loader.js';
import { scanStructuralIntent } from './structural-intent-scanner.js';

const FUNCTION_NODE_TYPES = {
    javascript: ['function_declaration', 'arrow_function', 'method_definition', 'generator_function_declaration'],
    typescript: ['function_declaration', 'arrow_function', 'method_definition', 'generator_function_declaration'],
    python: ['function_definition'],
    go: ['function_declaration', 'method_declaration']
};

/**
 * Walk nodes.
 * @param {any} node
 * @param {any} typeSet
 * @param {Array} results
 * @returns {any}
 */
function walkNodes(node, typeSet, results) {
    if (!node) return;
    if (typeSet.has(node.type)) {
        results.push(node);
    }
    for (let i = 0; i < node.childCount; i += 1) {
        walkNodes(node.child(i), typeSet, results);
    }
}

/**
 * Node line.
 * @param {any} node
 * @returns {any}
 */
function nodeLine(node) {
    return (node.startPosition?.row ?? 0) + 1;
}

/**
 * Node name.
 * @param {any} node
 * @param {any} content
 * @returns {any}
 */
function nodeName(node, content) {
    const nameNode = node.childForFieldName('name')
        || node.namedChildren?.find((c) => c.type === 'identifier' || c.type === 'property_identifier');
    if (nameNode?.text) return nameNode.text;
    if (nameNode) {
        return content.slice(nameNode.startIndex, nameNode.endIndex);
    }
    return 'anonymous';
}

/**
 * Node body text.
 * @param {any} node
 * @param {any} content
 * @returns {any}
 */
function nodeBodyText(node, content) {
    const bodyNode = node.childForFieldName('body') || node.namedChildren?.find((c) => c.type === 'statement_block');
    if (bodyNode) {
        return content.slice(bodyNode.startIndex, bodyNode.endIndex);
    }
    return content.slice(node.startIndex, node.endIndex);
}

/**
 * Extract functions from tree.
 * @param {any} rootNode
 * @param {any} content
 * @param {any} language
 * @returns {any}
 */
function extractFunctionsFromTree(rootNode, content, language) {
    const types = FUNCTION_NODE_TYPES[language] || FUNCTION_NODE_TYPES.javascript;
    const typeSet = new Set(types);
    const nodes = [];
    walkNodes(rootNode, typeSet, nodes);

    return nodes.map((node) => ({
        name: nodeName(node, content),
        startLine: nodeLine(node),
        body: nodeBodyText(node, content)
    }));
}

/**
 * Scan structural from tree.
 * @param {any} content
 * @param {Object} options
 * @returns {any}
 */
function scanStructuralFromTree(content, options = {}) {
    const filePath = options.filePath || 'snippet.txt';
    const language = options.language || 'javascript';
    const findings = [];
    const functions = options.functions || [];

    for (const fn of functions) {
        findings.push(...analyzeFunctionBlock(fn, filePath, options).map((f) => ({
            ...f,
            metadata: { ...f.metadata, engine: 'tree-sitter' }
        })));
    }

    findings.push(...scanCredentialDictStubs(content, filePath, language).map((f) => ({
        ...f,
        metadata: { ...f.metadata, engine: 'tree-sitter' }
    })));

    return findings;
}

/**
 * Scan with tree sitter.
 * @param {any} content
 * @param {Object} options
 * @returns {any}
 */
async function scanWithTreeSitter(content, options = {}) {
    const language = options.language || 'javascript';

    const status = getTreeSitterStatus(options);
    if (!status.ready) {
        return {
            engine: 'structural-fallback',
            treeSitterUsed: false,
            reason: status.webTreeSitterInstalled
                ? 'Grammar WASM files missing'
                : 'web-tree-sitter not installed',
            findings: scanStructuralIntent(content, options)
        };
    }

    const parsed = await parseWithTreeSitter(content, language, options);
    if (!parsed.ok) {
        return {
            engine: 'structural-fallback',
            treeSitterUsed: false,
            reason: parsed.reason,
            findings: scanStructuralIntent(content, options)
        };
    }

    const functions = extractFunctionsFromTree(parsed.tree.rootNode, content, language);
    const findings = functions.length
        ? scanStructuralFromTree(content, { ...options, functions })
        : scanStructuralIntent(content, options);

    return {
        engine: 'tree-sitter+structural',
        treeSitterUsed: true,
        functionNodesExtracted: functions.length,
        findings
    };
}

export {
    FUNCTION_NODE_TYPES,
    extractFunctionsFromTree,
    scanStructuralFromTree,
    scanWithTreeSitter
}
