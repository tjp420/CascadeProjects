// simplebeacon-ignore: Test fixtures for scanner pattern definitions — all findings are false positives
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RULE_CATALOG, DOCUMENTATION_MARKERS, DOCUMENTATION_FILE_NAMES } = require('./regional-ai-safety-patterns.js');

test('RULE_CATALOG has exactly 12 rules (10 frameworks, 2 with dual rules)', () => {
    assert.equal(RULE_CATALOG.length, 12, 'Expected 12 rules in the catalog (10 frameworks, 2 with dual rules)');
});

test('All rule IDs are unique', () => {
    const ids = RULE_CATALOG.map((r) => r.id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, 'Duplicate rule IDs found');
});

test('All rules have required fields', () => {
    for (const rule of RULE_CATALOG) {
        assert.ok(rule.id, `Rule missing id: ${JSON.stringify(rule)}`);
        assert.ok(rule.framework, `Rule ${rule.id} missing framework`);
        assert.ok(rule.category, `Rule ${rule.id} missing category`);
        assert.ok(rule.type, `Rule ${rule.id} missing type`);
        assert.ok(rule.regex instanceof RegExp, `Rule ${rule.id} regex is not a RegExp`);
        assert.ok(rule.severity, `Rule ${rule.id} missing severity`);
        assert.ok(rule.description, `Rule ${rule.id} missing description`);
        assert.ok(rule.fixTemplate, `Rule ${rule.id} missing fixTemplate`);
    }
});

test('Rule severities are valid', () => {
    const validSeverities = new Set(['critical', 'high', 'medium', 'low']);
    for (const rule of RULE_CATALOG) {
        assert.ok(validSeverities.has(rule.severity), `Rule ${rule.id} has invalid severity: ${rule.severity}`);
    }
});

test('All 10 frameworks are represented', () => {
    const frameworks = new Set(RULE_CATALOG.map((r) => r.framework));
    assert.equal(frameworks.size, 10, 'Expected 10 unique frameworks');
    assert.ok(frameworks.has('California SB 1047'));
    assert.ok(frameworks.has('NIST AI RMF 1.0'));
    assert.ok(frameworks.has('Colorado SB 24-205'));
    assert.ok(frameworks.has('Utah SB 149'));
    assert.ok(frameworks.has('NYC Local Law 144'));
    assert.ok(frameworks.has('Canada AIDA'));
    assert.ok(frameworks.has('UK AI Safety Framework'));
    assert.ok(frameworks.has('ISO/IEC 42001'));
    assert.ok(frameworks.has('Singapore Model AI Governance'));
    assert.ok(frameworks.has('Brazil PL 2338/2023'));
});

test('CA-SB1047-001 detects frontier model patterns', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'CA-SB1047-001');
    assert.ok(rule.regex.test('deploy frontier model with critical harm risk'));
    rule.regex.lastIndex = 0;
    assert.ok(rule.regex.test('implement shutdown capability protocol'));
    rule.regex.lastIndex = 0;
});

test('CA-SB1047-002 detects safety evaluation gaps', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'CA-SB1047-002');
    assert.ok(rule.regex.test('we need to run model eval and red team testing'));
    rule.regex.lastIndex = 0;
});

test('NIST-AIRMF-001 detects governance references', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'NIST-AIRMF-001');
    assert.ok(rule.regex.test('establish AI governance framework'));
    rule.regex.lastIndex = 0;
    assert.ok(rule.regex.test('follow NIST AI RMF guidelines'));
    rule.regex.lastIndex = 0;
});

test('CO-SB205-001 detects high-risk AI systems', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'CO-SB205-001');
    assert.ok(rule.regex.test('algorithmic impact assessment for consequential decision'));
    rule.regex.lastIndex = 0;
    assert.ok(rule.regex.test('high-risk AI system deployed'));
    rule.regex.lastIndex = 0;
});

test('UT-SB149-001 detects chatbot without disclosure', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'UT-SB149-001');
    assert.ok(rule.regex.test('deploy chatbot for customer service'));
    rule.regex.lastIndex = 0;
});

test('NYC-LL144-001 detects employment AI tools', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'NYC-LL144-001');
    assert.ok(rule.regex.test('resume screen candidates using AI model'));
    rule.regex.lastIndex = 0;
});

test('CA-AIDA-001 detects high-impact AI systems', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'CA-AIDA-001');
    assert.ok(rule.regex.test('high-impact AI system requires harm assessment'));
    rule.regex.lastIndex = 0;
});

test('UK-DSIT-001 detects capability assessment needs', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'UK-DSIT-001');
    assert.ok(rule.regex.test('conduct capability assessment for dangerous capability'));
    rule.regex.lastIndex = 0;
});

test('ISO-42001-001 detects AIMS references', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'ISO-42001-001');
    assert.ok(rule.regex.test('implement AI management system AIMS'));
    rule.regex.lastIndex = 0;
});

test('SG-MAIGF-001 detects accountability patterns', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'SG-MAIGF-001');
    assert.ok(rule.regex.test('establish accountability and AI ethics board'));
    rule.regex.lastIndex = 0;
});

test('BR-PL2338-001 detects rights protection needs', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'BR-PL2338-001');
    assert.ok(rule.regex.test('conduct rights impact assessment for affected individuals'));
    rule.regex.lastIndex = 0;
});

test('DOCUMENTATION_MARKERS has 10 entries', () => {
    assert.equal(DOCUMENTATION_MARKERS.length, 10);
});

test('DOCUMENTATION_FILE_NAMES has 10 entries', () => {
    assert.equal(DOCUMENTATION_FILE_NAMES.length, 10);
});

test('Documentation markers have required fields', () => {
    for (const marker of DOCUMENTATION_MARKERS) {
        assert.ok(marker.id, `Marker missing id: ${JSON.stringify(marker)}`);
        assert.ok(marker.pattern instanceof RegExp, `Marker ${marker.id} pattern is not a RegExp`);
        assert.ok(marker.label, `Marker ${marker.id} missing label`);
    }
});
