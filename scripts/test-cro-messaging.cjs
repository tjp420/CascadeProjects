'use strict';

/**
 * Tests for CRO/DX messaging consistency across marketing pages.
 *
 * Verifies that the four CRO improvements are correctly implemented:
 * 1. Feature contradiction fix: deterministic gate vs optional AI-assisted VS Code layer
 * 2. Audit sandbox split-choice layout: Browser Triage vs Deep Scan
 * 3. Homepage hero rewrite: concrete case study language
 * 4. Pricing tier restructure: organizational liability framing
 *
 * Run: node --test scripts/test-cro-messaging.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

function readFile(relPath) {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

// ═══════════════════════════════════════════════
// 1. Feature Contradiction Fix
// ═══════════════════════════════════════════════

describe('Feature contradiction fix (homepage)', () => {

    test('homepage clarifies deterministic gate vs optional AI layer', () => {
        const html = readFile('coming-soon/public/index.html');
        // Must mention deterministic
        assert.match(html, /deterministic/i);
        // Must mention the VS Code extension has optional AI
        assert.match(html, /optional.*AI.*assisted/i);
        // Must clarify the boundary
        assert.match(html, /gate.*compliance.*deterministic/i);
    });

    test('homepage does not claim absolute offline isolation without scoping', () => {
        const html = readFile('coming-soon/public/index.html');
        // The old unscoped "Absolute offline isolation" should be replaced
        // with a scoped statement about the gate scanner
        assert.doesNotMatch(html, /Absolute offline isolation with zero network overhead/);
    });

    test('homepage mentions VS Code extension requires explicit opt-in', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /explicit opt-in/i);
    });

    test('homepage states no source code sent to external LLMs', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /never sends source code to external LLMs/i);
    });

    test('audit page clarifies deterministic boundary', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /100% deterministic/i);
        assert.match(html, /no LLM.*no external calls/i);
    });
});

// ═══════════════════════════════════════════════
// 2. Audit Sandbox Split-Choice Layout
// ═══════════════════════════════════════════════

describe('Audit sandbox split-choice layout', () => {

    test('audit page has Browser Triage column', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /Browser Triage/i);
    });

    test('audit page has Deep Scan column', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /Deep Scan/i);
    });

    test('Browser Triage mentions drag and drop', () => {
        const html = readFile('coming-soon/public/audit.html');
        // Match the h3 tag content, then capture the following content
        const triageSection = html.match(/<h3[^>]*>Browser Triage<\/h3>[\s\S]{0,600}/i);
        assert.ok(triageSection, 'Browser Triage section must exist');
        assert.match(triageSection[0], /drag/i);
    });

    test('Browser Triage mentions 100% local', () => {
        const html = readFile('coming-soon/public/audit.html');
        const triageSection = html.match(/<h3[^>]*>Browser Triage<\/h3>[\s\S]{0,600}/i);
        assert.ok(triageSection);
        assert.match(triageSection[0], /100% local/i);
    });

    test('Deep Scan mentions AST parsing', () => {
        const html = readFile('coming-soon/public/audit.html');
        const deepSection = html.match(/<h3[^>]*>Deep Scan[\s\S]{0,600}/i);
        assert.ok(deepSection);
        assert.match(deepSection[0], /AST/i);
    });

    test('Deep Scan mentions npm audit', () => {
        const html = readFile('coming-soon/public/audit.html');
        const deepSection = html.match(/<h3[^>]*>Deep Scan[\s\S]{0,600}/i);
        assert.ok(deepSection);
        assert.match(deepSection[0], /npm audit/i);
    });

    test('Deep Scan mentions CLI command', () => {
        const html = readFile('coming-soon/public/audit.html');
        const deepSection = html.match(/<h3[^>]*>Deep Scan[\s\S]{0,600}/i);
        assert.ok(deepSection);
        assert.match(deepSection[0], /npx simplebeacon/i);
    });

    test('split-choice uses grid layout', () => {
        const html = readFile('coming-soon/public/audit.html');
        // Check for grid-template-columns near the split-choice
        assert.match(html, /grid-template-columns:\s*1fr\s*1fr/i);
    });

    test('Low Friction label exists for Browser Triage', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /Low Friction/i);
    });

    test('Full Power label exists for Deep Scan', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /Full Power/i);
    });
});

// ═══════════════════════════════════════════════
// 3. Homepage Hero Rewrite
// ═══════════════════════════════════════════════

describe('Homepage hero rewrite with case study language', () => {

    test('hero mentions SAST tools missing AI slop', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /SAST tools miss/i);
    });

    test('hero mentions traditional linting', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /traditional linting/i);
    });

    test('hero mentions code debt', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /code debt/i);
    });

    test('hero mentions concrete examples (comment, placeholder, metric)', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /comment/i);
        assert.match(html, /placeholder/i);
        assert.match(html, /hardcoded metric/i);
    });

    test('hero mentions 52 deterministic engines', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /52 deterministic/i);
    });

    test('hero mentions no LLM', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /no LLM/i);
    });

    test('hero mentions no false positives', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /no false positives/i);
    });

    test('hero badge mentions deterministic engines', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /Deterministic Engines/i);
    });

    test('page title reflects new hero messaging', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /<title>[^<]*Catch AI Code Debt[^<]*<\/title>/i);
    });

    test('meta description reflects new hero messaging', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /SAST tools miss AI-generated slop/i);
    });

    test('old hero copy is removed', () => {
        const html = readFile('coming-soon/public/index.html');
        // The old abstract copy should be gone
        assert.doesNotMatch(html, /Auto-Remediate AI Code Debt Before It Becomes Audit Risk/);
    });
});

// ═══════════════════════════════════════════════
// 4. Pricing Tier Restructure
// ═══════════════════════════════════════════════

describe('Pricing tier restructure by organizational liability', () => {

    test('pricing hero mentions organizational liability', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /Organizational Liability/i);
    });

    test('Developer tier framed as individual hygiene', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /Keep your local branches clean before peer review/i);
    });

    test('Team Pro tier framed as shared team rule-sets', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /Shared team rule-sets/i);
    });

    test('Team Pro tier mentions CI/CD pipeline integration', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /CI\/CD pipeline integration/i);
    });

    test('Enterprise tier renamed to Corporate Governance', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /Corporate Governance/i);
    });

    test('Corporate Governance tier mentions SOC 2-ready exports', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /SOC 2-ready exports/i);
    });

    test('Corporate Governance tier mentions EU AI Act compliance auditing', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /EU AI Act compliance auditing/i);
    });

    test('Corporate Governance tier mentions air-gapped deployment', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /air-gapped deployment/i);
    });

    test('pricing page title reflects new framing', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /Individual.*Team.*Corporate Governance/i);
    });

    test('old pricing hero headline is removed', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.doesNotMatch(html, /B2B AI Code Debt &amp; Slop Remediation/);
    });
});

// ═══════════════════════════════════════════════
// 5. Mirror file consistency
// ═══════════════════════════════════════════════

describe('Mirror pricing.html consistency', () => {

    test('mirror has same hero headline', () => {
        const pub = readFile('coming-soon/public/pricing.html');
        const mirror = readFile('coming-soon/pricing.html');
        const pubMatch = pub.match(/<h1>([^<]+)<\/h1>/);
        const mirrorMatch = mirror.match(/<h1>([^<]+)<\/h1>/);
        assert.ok(pubMatch && mirrorMatch);
        assert.equal(pubMatch[1], mirrorMatch[1]);
    });

    test('mirror has Corporate Governance tier', () => {
        const mirror = readFile('coming-soon/pricing.html');
        assert.match(mirror, /Corporate Governance/i);
    });

    test('mirror has organizational liability framing', () => {
        const mirror = readFile('coming-soon/pricing.html');
        assert.match(mirror, /Organizational Liability/i);
    });

    test('mirror has Developer tier individual hygiene framing', () => {
        const mirror = readFile('coming-soon/pricing.html');
        assert.match(mirror, /Keep your local branches clean/i);
    });

    test('mirror has Team Pro shared rule-sets framing', () => {
        const mirror = readFile('coming-soon/pricing.html');
        assert.match(mirror, /Shared team rule-sets/i);
    });
});

// ═══════════════════════════════════════════════
// 6. Cross-page messaging consistency
// ═══════════════════════════════════════════════

describe('Cross-page messaging consistency', () => {

    test('all pages mention 100% local/private scanning', () => {
        const home = readFile('coming-soon/public/index.html');
        const audit = readFile('coming-soon/public/audit.html');
        const pricing = readFile('coming-soon/public/pricing.html');
        assert.match(home, /100%.*local/i);
        assert.match(audit, /100%.*local/i);
        assert.match(pricing, /100%.*local/i);
    });

    test('all pages mention deterministic scanning', () => {
        const home = readFile('coming-soon/public/index.html');
        const audit = readFile('coming-soon/public/audit.html');
        assert.match(home, /deterministic/i);
        assert.match(audit, /deterministic/i);
    });

    test('homepage and audit page both clarify the AI boundary', () => {
        const home = readFile('coming-soon/public/index.html');
        const audit = readFile('coming-soon/public/audit.html');
        // Both should mention the VS Code extension is optional/separate
        assert.match(home, /VS Code extension/i);
        assert.match(audit, /VS Code/i);
    });
});
