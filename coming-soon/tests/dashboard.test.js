// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const { test, describe } = require('node:test');
const assert = require('node:assert');

// ============================================================================
// buildEuAiActControls — from scanner-engine.js / ui-renderer.js
// ============================================================================
function buildEuAiActControls(aiHits, licenseFiles, securityFiles) {
    const controls = [];
    const docCount = (licenseFiles?.length || 0) + (securityFiles?.length || 0);
    const hasDocs = docCount > 0;
    const aiCount = aiHits?.length || 0;

    controls.push({
        controlId: 'EU-AIA-ART-5',
        title: 'Prohibited AI Practices Audit',
        article: 'Regulation (EU) 2024/1689, Article 5',
        status: aiCount > 0 ? 'WARN' : 'PASS',
        severity: aiCount > 0 ? 'critical' : 'low',
        description: aiCount > 0 ? 'Article 5 prohibits...' : 'No AI SDK imports...',
        evidence: aiCount > 0 ? `${aiCount} file(s) with AI SDK imports` : 'None detected',
        action: aiCount > 0 ? 'Conduct legal review...' : 'No action needed...'
    });
    controls.push({
        controlId: 'EU-AIA-ART-6',
        title: 'AI System Classification (Annex III)',
        article: 'Regulation (EU) 2024/1689, Article 6 & Annex III',
        status: aiCount > 0 ? 'REVIEW' : 'PASS',
        severity: aiCount > 0 ? 'medium' : 'low',
        description: aiCount > 0 ? 'Annex III lists...' : 'No AI system indicators...',
        evidence: aiCount > 0 ? `${aiCount} AI indicator(s); ${hasDocs ? docCount + ' governance doc(s) present' : '0 governance docs'}` : 'None detected',
        action: aiCount > 0 ? (hasDocs ? 'Review existing governance docs...' : 'Add risk-assessment.md...') : 'No action needed.'
    });
    controls.push({
        controlId: 'EU-AIA-ART-50',
        title: 'Transparency Obligations',
        article: 'Regulation (EU) 2024/1689, Article 50',
        status: aiCount > 0 ? 'WARN' : 'PASS',
        severity: aiCount > 0 ? 'medium' : 'low',
        description: aiCount > 0 ? 'Article 50 requires...' : 'No AI indicators...',
        evidence: aiCount > 0 ? `${aiCount} AI indicator(s) detected` : 'None detected',
        action: aiCount > 0 ? 'Verify UI/UX includes...' : 'No action needed.'
    });
    controls.push({
        controlId: 'EU-AIA-ART-9',
        title: 'Risk Management System',
        article: 'Regulation (EU) 2024/1689, Article 9',
        status: aiCount > 0 ? (hasDocs ? 'REVIEW' : 'WARN') : 'PASS',
        severity: aiCount > 0 ? (hasDocs ? 'medium' : 'high') : 'low',
        description: aiCount > 0 ? 'High-risk AI systems...' : 'No AI indicators...',
        evidence: aiCount > 0 ? `${hasDocs ? docCount + ' doc(s) present' : 'No risk management documentation detected'}` : 'None detected',
        action: aiCount > 0 ? 'Create or update risk-assessment.md...' : 'No action needed.'
    });
    return controls;
}

// ============================================================================
// buildAnalyzerSections — from scanner-engine.js
// ============================================================================
const REPORT_SECTION_SCHEMA = [
    { section: 'aiResidue', hitsVar: 'aiResidueHits', findingsVar: 'aiResidueFindings', label: 'AI residue pattern', detail: 'stubs, deprecated APIs, error swallowing, dead code' },
    { section: 'performance', hitsVar: 'perfHits', findingsVar: 'perfFindings', label: 'performance anti-pattern', detail: 'nested loops, leaked listeners, inefficient regex' },
    { section: 'complexity', hitsVar: 'complexityHits', findingsVar: 'complexityFindings', label: 'high complexity pattern', detail: 'over-long functions, deep nesting' }
];

function buildAnalyzerSections(ctx, allowedSections) {
    const result = {};
    for (const s of REPORT_SECTION_SCHEMA) {
        if (!allowedSections.includes(s.section)) continue;
        const hits = ctx[s.hitsVar] || 0;
        const findings = ctx[s.findingsVar] || [];
        result[s.section] = {
            [`${s.section}Hits`]: hits,
            [`${s.section}Findings`]: findings.slice(0, 5).map(f => ({
                file: f.file,
                type: f.type,
                matches: f.matches.slice(0, 3).map(m => ({ line: m.line, snippet: m.snippet }))
            })),
            summary: hits > 0 ? `${hits} ${s.label}(s) detected (${s.detail}).` : `No ${s.label}s detected.`
        };
    }
    return result;
}

// ============================================================================
// generateZipModuleMarkdown — from certificate-module.js
// ============================================================================
function generateZipModuleMarkdown(zip, allowedModules, filteredReport, projectName, dateStr, template) {
    if (!allowedModules.includes(template.moduleId)) return;
    const data = filteredReport[template.section] || {};
    const hits = data[`${template.section}Hits`] || 0;
    const list = (data[`${template.section}Findings`] || []).slice(0, 10);
    const md = `# ${template.title} Report\n\n**Project:** ${projectName}\n**Date:** ${dateStr}\n\n| Metric | Value |\n|---|---|\n| ${template.metricLabel} | ${hits} |\n\n${list.length ? `## Findings\n\n${list.map(f => `- ${f.file} (${f.type})`).join('\n')}\n` : ''}> ${template.advice}\n`;
    zip.file(template.filename, md);
}

// ============================================================================
// decodeJwtPayload — from main.js / token-manager.js
// ============================================================================
function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2 && parts.length !== 3) return null;
    const payloadBase64url = parts.length === 2 ? parts[0] : parts[1];
    if (!payloadBase64url) return null;
    const base64 = payloadBase64url.replace(/-/g, '+').replace(/_/g, '/');
    const rem = base64.length % 4;
    if (rem === 1) return null;
    const padded = base64 + '='.repeat((4 - rem) % 4);
    try {
        const binary = Buffer.from(padded, 'base64').toString('binary');
        let decoded;
        if (typeof TextDecoder !== 'undefined') {
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            decoded = new TextDecoder().decode(bytes);
        } else {
            decoded = decodeURIComponent(escape(binary));
        }
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

// ============================================================================
// Tests
// ============================================================================
describe('EU AI Act Controls', () => {
    test('no AI indicators returns all PASS', () => {
        const controls = buildEuAiActControls([], [], []);
        assert.strictEqual(controls.length, 4);
        assert.ok(controls.every(c => c.status === 'PASS'));
        assert.ok(controls.every(c => c.severity === 'low'));
    });

    test('AI detected with no docs: ART-6 REVIEW (medium), ART-9 WARN (high)', () => {
        const controls = buildEuAiActControls(['file1.js'], [], []);
        const art6 = controls.find(c => c.controlId === 'EU-AIA-ART-6');
        const art9 = controls.find(c => c.controlId === 'EU-AIA-ART-9');
        assert.strictEqual(art6.status, 'REVIEW');
        assert.strictEqual(art6.severity, 'medium');
        assert.strictEqual(art9.status, 'WARN');
        assert.strictEqual(art9.severity, 'high');
    });

    test('AI detected with docs: ART-9 REVIEW (medium)', () => {
        const controls = buildEuAiActControls(['file1.js'], ['LICENSE'], ['SECURITY.md']);
        const art9 = controls.find(c => c.controlId === 'EU-AIA-ART-9');
        assert.strictEqual(art9.status, 'REVIEW');
        assert.strictEqual(art9.severity, 'medium');
    });

    test('ART-5 is WARN critical when AI detected', () => {
        const controls = buildEuAiActControls(['file1.js'], [], []);
        const art5 = controls.find(c => c.controlId === 'EU-AIA-ART-5');
        assert.strictEqual(art5.status, 'WARN');
        assert.strictEqual(art5.severity, 'critical');
    });
});

describe('Analyzer Report Sections', () => {
    test('builds sections only for allowed list', () => {
        const ctx = {
            aiResidueHits: 3,
            aiResidueFindings: [{ file: 'a.js', type: 'stub', matches: [{ line: 1, snippet: 'fn() {}' }] }],
            perfHits: 0,
            perfFindings: [],
            complexityHits: 5,
            complexityFindings: [{ file: 'b.js', type: 'nested', matches: [{ line: 10, snippet: 'if (a) {' }] }]
        };
        const result = buildAnalyzerSections(ctx, ['aiResidue', 'complexity']);
        assert.strictEqual(Object.keys(result).length, 2);
        assert.strictEqual(result.aiResidue.aiResidueHits, 3);
        assert.strictEqual(result.complexity.complexityHits, 5);
        assert.strictEqual(result.aiResidue.aiResidueFindings.length, 1);
        assert.ok(result.aiResidue.summary.includes('3'));
    });

    test('omits disallowed sections', () => {
        const ctx = { aiResidueHits: 1, aiResidueFindings: [] };
        const result = buildAnalyzerSections(ctx, []);
        assert.strictEqual(Object.keys(result).length, 0);
    });

    test('handles missing findings gracefully', () => {
        const ctx = { perfHits: 0 };
        const result = buildAnalyzerSections(ctx, ['performance']);
        assert.strictEqual(result.performance.performanceHits, 0);
        assert.strictEqual(result.performance.performanceFindings.length, 0);
        assert.ok(result.performance.summary.includes('No'));
    });
});

describe('ZIP Markdown Generator', () => {
    test('generates markdown for allowed module', () => {
        const files = {};
        const mockZip = { file: (name, content) => { files[name] = content; } };
        const report = { aiResidue: { aiResidueHits: 2, aiResidueFindings: [{ file: 'x.js', type: 'stub' }] } };
        const template = { moduleId: '17', section: 'aiResidue', title: 'AI Residue', metricLabel: 'AI Residue Hits', advice: 'Clean up.', filename: 'ai-residue.md' };
        generateZipModuleMarkdown(mockZip, ['17'], report, 'MyApp', '2024-01-01', template);
        assert.ok(files['ai-residue.md']);
        assert.ok(files['ai-residue.md'].includes('AI Residue Report'));
        assert.ok(files['ai-residue.md'].includes('2'));
        assert.ok(files['ai-residue.md'].includes('x.js'));
    });

    test('skips disallowed module', () => {
        const files = {};
        const mockZip = { file: (name, content) => { files[name] = content; } };
        const report = {};
        const template = { moduleId: '17', section: 'aiResidue', title: 'AI Residue', metricLabel: 'Hits', advice: 'Clean.', filename: 'ai-residue.md' };
        generateZipModuleMarkdown(mockZip, ['18'], report, 'MyApp', '2024-01-01', template);
        assert.strictEqual(Object.keys(files).length, 0);
    });

    test('renders empty findings correctly', () => {
        const files = {};
        const mockZip = { file: (name, content) => { files[name] = content; } };
        const report = { performance: { performanceHits: 0, performanceFindings: [] } };
        const template = { moduleId: '18', section: 'performance', title: 'Performance', metricLabel: 'Hits', advice: 'Optimize.', filename: 'perf.md' };
        generateZipModuleMarkdown(mockZip, ['18'], report, 'MyApp', '2024-01-01', template);
        assert.ok(files['perf.md']);
        assert.ok(files['perf.md'].includes('0'));
        assert.ok(!files['perf.md'].includes('## Findings'));
    });
});

describe('Token Decoding', () => {
    test('decodes valid 2-part base64url token', () => {
        const payload = { tier: 'executive', features: ['gate', 'roadmap'] };
        const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const token = `${b64}.sig`;
        const result = decodeJwtPayload(token);
        assert.deepStrictEqual(result, payload);
    });

    test('decodes valid 3-part JWT token', () => {
        const header = Buffer.from('{}').toString('base64url');
        const payload = { tier: 'custom', features: ['1', '2', '3'] };
        const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const token = `${header}.${b64}.sig`;
        const result = decodeJwtPayload(token);
        assert.deepStrictEqual(result, payload);
    });

    test('returns null for invalid format', () => {
        assert.strictEqual(decodeJwtPayload(''), null);
        assert.strictEqual(decodeJwtPayload('onlyonepart'), null);
        assert.strictEqual(decodeJwtPayload('a.b.c.d'), null);
    });

    test('returns null for corrupted base64', () => {
        assert.strictEqual(decodeJwtPayload('header.corrupt.sig'), null);
    });
});
