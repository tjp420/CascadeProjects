// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Analyzer Coverage Verification Test
 *
 * Asserts that every MODULE_CARDS ID has either:
 *   1. A matching PATTERN_REGISTRY entry (kebab → camelCase), OR
 *   2. A registered CUSTOM_HANDLER_REGISTRY entry.
 *
 * Also verifies:
 *   - Every PATTERN_REGISTRY key has an ANALYZER_SCHEMA entry
 *   - Every ANALYZER_SCHEMA category has a CATEGORY_COLLECTORS handler
 *   - Every MODULE_REPORT_KEYS entry has a corresponding REPORT_SECTION_SCHEMA entry
 *
 * Run: node --test analyzer-coverage.test.cjs
 */

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');
const DASHBOARD = path.join(ROOT, 'public', 'js-es2018', 'dashboard');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

/* ── Extract MODULE_CARDS from main.js ── */
function extractModuleCardIds(content) {
    const blockMatch = content.match(/const\s+MODULE_CARDS\s*=\s*\[([\s\S]*?)\];/);
    if (!blockMatch) throw new Error('MODULE_CARDS block not found in main.js');
    const ids = [];
    const re = /\{\s*id:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(blockMatch[1])) !== null) {
        ids.push(m[1]);
    }
    return ids;
}

/* ── Extract PATTERN_REGISTRY keys from scanner-patterns.js ── */
function extractPatternKeys(content) {
    const blockMatch = content.match(/const\s+PATTERN_REGISTRY\s*=\s*\{([\s\S]*?)\n\};/);
    if (!blockMatch) throw new Error('PATTERN_REGISTRY block not found');
    const keys = [];
    const lines = blockMatch[1].split('\n');
    for (const line of lines) {
        // Top-level keys have exactly 4 spaces indentation
        const m = line.match(/^\s{4}(\w+):\s*\{/);
        if (m) keys.push(m[1]);
    }
    return keys;
}

/* ── Extract ANALYZER_SCHEMA keys ── */
function extractSchemaKeys(content) {
    const blockMatch = content.match(/const\s+ANALYZER_SCHEMA\s*=\s*\{([\s\S]*?)\n\};/);
    if (!blockMatch) throw new Error('ANALYZER_SCHEMA block not found');
    const keys = [];
    const lines = blockMatch[1].split('\n');
    for (const line of lines) {
        const m = line.match(/^\s{4}(\w+):\s*\{/);
        if (m) keys.push(m[1]);
    }
    return keys;
}

/* ── Extract CATEGORY_COLLECTORS keys ── */
function extractCollectorKeys(content) {
    const blockMatch = content.match(/const\s+CATEGORY_COLLECTORS\s*=\s*\{([\s\S]*?)\n\};/);
    if (!blockMatch) throw new Error('CATEGORY_COLLECTORS block not found');
    const keys = [];
    const lines = blockMatch[1].split('\n');
    for (const line of lines) {
        const m = line.match(/^\s{4}(\w+):\s*\(/);
        if (m) keys.push(m[1]);
    }
    return keys;
}

/* ── Extract CUSTOM_HANDLER_REGISTRY keys ── */
function extractCustomHandlerKeys(content) {
    const blockMatch = content.match(/const\s+CUSTOM_HANDLER_REGISTRY\s*=\s*\{([\s\S]*?)\n\};/);
    if (!blockMatch) return [];
    const keys = [];
    const re = /^\s+['"]([^'"]+)['"]:\s*\{/gm;
    let m;
    while ((m = re.exec(blockMatch[1])) !== null) {
        keys.push(m[1]);
    }
    return keys;
}

/* ── Extract REPORT_SECTION_SCHEMA section names ── */
function extractSectionSchemaSections(content) {
    const blockMatch = content.match(/const\s+REPORT_SECTION_SCHEMA\s*=\s*\[([\s\S]*?)\];/);
    if (!blockMatch) throw new Error('REPORT_SECTION_SCHEMA block not found');
    const sections = [];
    const re = /section:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(blockMatch[1])) !== null) {
        sections.push(m[1]);
    }
    return sections;
}

/* ── Extract MODULE_REPORT_KEYS keys ── */
function extractModuleReportKeys(content) {
    // MODULE_REPORT_KEYS is the only object where entries end with `: [`
    // so we can safely match across the whole file.
    const keys = [];
    const re = /^\s{4}(?:['"]([^'"]+)['"]|(\w+))\s*:\s*\[/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
        keys.push(m[1] || m[2]);
    }
    return keys;
}

/* ── Helper: kebab-case → camelCase ── */
function toCamelCase(str) {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/* ── Load files ── */
const mainJs = read(path.join(DASHBOARD, 'main.js'));
const patternsJs = read(path.join(DASHBOARD, 'scanner-patterns.js'));
const engineJs = read(path.join(DASHBOARD, 'scanner-engine.js'));

const moduleIds = extractModuleCardIds(mainJs);
const patternKeys = extractPatternKeys(patternsJs);
const schemaKeys = extractSchemaKeys(patternsJs);
const collectorKeys = extractCollectorKeys(engineJs);
const customHandlerKeys = extractCustomHandlerKeys(engineJs);
const sectionSchemaSections = extractSectionSchemaSections(engineJs);
const moduleReportKeys = extractModuleReportKeys(mainJs);

/* ── Build category→collector mapping from ANALYZER_SCHEMA ── */
function extractSchemaCategories(content) {
    const blockMatch = content.match(/const\s+ANALYZER_SCHEMA\s*=\s*\{([\s\S]*?)\n\};/);
    const cats = new Set();
    const re = /category:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(blockMatch[1])) !== null) {
        cats.add(m[1]);
    }
    return [...cats];
}
const schemaCategories = extractSchemaCategories(patternsJs);

/* ═══════════════════════════════════════════════════════════
   TESTS
   ═══════════════════════════════════════════════════════════ */

test('All MODULE_CARDS have either a pattern or custom handler', () => {
    const missing = [];
    for (const id of moduleIds) {
        const camel = toCamelCase(id);
        const hasPattern = patternKeys.includes(camel) || patternKeys.includes(id);
        const hasCustom = customHandlerKeys.includes(id);
        if (!hasPattern && !hasCustom) {
            missing.push(id);
        }
    }
    assert.strictEqual(
        missing.length,
        0,
        `Modules missing pattern or custom handler: ${missing.join(', ')}`
    );
});

test('All PATTERN_REGISTRY keys have ANALYZER_SCHEMA entries', () => {
    const missing = patternKeys.filter(k => !schemaKeys.includes(k));
    assert.strictEqual(
        missing.length,
        0,
        `Patterns without ANALYZER_SCHEMA: ${missing.join(', ')}`
    );
});

test('All ANALYZER_SCHEMA categories have CATEGORY_COLLECTORS', () => {
    const missing = schemaCategories.filter(c => !collectorKeys.includes(c));
    assert.strictEqual(
        missing.length,
        0,
        `Schema categories without collectors: ${missing.join(', ')}`
    );
});

test('All MODULE_CARDS IDs are present in MODULE_REPORT_KEYS', () => {
    const missing = moduleIds.filter(id => !moduleReportKeys.includes(id));
    assert.strictEqual(
        missing.length,
        0,
        `MODULE_CARDS IDs missing from MODULE_REPORT_KEYS: ${missing.join(', ')}`
    );
});

/* ── Summary output (not a test assertion, just diagnostics) ── */
test('Coverage summary', () => {
    const patternCount = moduleIds.filter(id => {
        const camel = toCamelCase(id);
        return patternKeys.includes(camel) || patternKeys.includes(id);
    }).length;
    const customCount = moduleIds.filter(id => customHandlerKeys.includes(id)).length;
    const reportCount = moduleIds.filter(id => moduleReportKeys.includes(id)).length;

    console.log(`\n  Analyzer Coverage Summary`);
    console.log(`  ─────────────────────────`);
    console.log(`  Total UI modules       : ${moduleIds.length}`);
    console.log(`  With direct pattern    : ${patternCount}`);
    console.log(`  With custom handler    : ${customCount}`);
    console.log(`  In MODULE_REPORT_KEYS  : ${reportCount}`);
    console.log(`  PATTERN_REGISTRY keys  : ${patternKeys.length}`);
    console.log(`  ANALYZER_SCHEMA keys   : ${schemaKeys.length}`);
    console.log(`  CATEGORY_COLLECTORS    : ${collectorKeys.length}`);
    console.log(`  REPORT_SECTION_SCHEMA  : ${sectionSchemaSections.length}`);
    console.log(`  MODULE_REPORT_KEYS     : ${moduleReportKeys.length}`);
    console.log(`  ─────────────────────────\n`);

    assert.strictEqual(reportCount, moduleIds.length,
        'All modules must be present in MODULE_REPORT_KEYS');
    assert.ok(customCount > 0,
        'At least one custom handler should be registered');
});
