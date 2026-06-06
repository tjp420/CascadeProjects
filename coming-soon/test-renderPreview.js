// Minimal DOM mock for testing renderPreview
const mockElements = {};
class MockElement {
    constructor() { this.style = {}; this.dataset = {}; this.classList = { add: ()=>{}, remove: ()=>{} }; }
    get textContent() { return this._text || ''; }
    set textContent(v) { this._text = v; }
    get innerHTML() { return this._html || ''; }
    set innerHTML(v) { this._html = v; }
    get value() { return this._value || ''; }
    set value(v) { this._value = v; }
    addEventListener() {}
    querySelector() { return new MockElement(); }
    querySelectorAll() { return []; }
    appendChild() {}
    remove() {}
    focus() {}
    scrollIntoView() {}
    click() {}
}

global.document = {
    getElementById: (id) => mockElements[id] || (mockElements[id] = new MockElement()),
    addEventListener: () => {},
    createElement: () => new MockElement(),
    body: { appendChild: () => {}, removeChild: () => {} },
    activeElement: null
};
global.window = { location: { search: '' }, addEventListener: () => {} };
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };

// Minimal dependencies
const API_BASE = '';
let reportData = null;
const licenseInput = { value: '' };

// Stub functions referenced by renderPreview
function showStatus() {}
function showToast() {}
function updateStepper() {}
function saveToLocalStorage() {}
function validateTokenVisual() {}

// Inline renderPreview from upload.html
function renderPreview(data) {
    const scanPreview = document.getElementById('scanPreview');
    scanPreview.style.display = 'block';
    const hasToken = licenseInput.value.trim().length > 10;

    if (data.type === 'simplebeacon-npm-audit' && !data.gate) {
        const h = data.hygieneSummary || {};
        data.gate = { pass: h.gatePass ?? true, blockingCount: (h.critical || 0) + (h.high || 0), warningCount: (h.moderate || 0) + (h.low || 0) };
        data.qualityScore = h.gatePass === true ? 100 : Math.max(0, 100 - ((h.critical || 0) * 20 + (h.high || 0) * 10 + (h.moderate || 0) * 5 + (h.low || 0) * 2));
        data.totalFiles = data.packageJsonCount ?? 0;
        data.npmAudit = { packageJsonCount: data.packageJsonCount ?? 0, dependencyCount: data.dependencyCount ?? 0, summary: `${data.packageJsonCount ?? 0} package.json files found with ${data.dependencyCount ?? 0} total dependencies.` };
    }

    if (data.type === 'simplebeacon-public-summary' && !data.gate) {
        const s = data.summary || {};
        data.gate = {
            pass: s.gatePass ?? null,
            blockingCount: (data.severityCounts?.critical || 0) + (data.severityCounts?.high || 0),
            warningCount: (data.severityCounts?.medium || 0) + (data.severityCounts?.low || 0)
        };
        data.qualityScore = s.qualityScore ?? 0;
        data.totalFiles = s.filesScanned ?? 0;
        data.issueCount = s.totalIssuesFound ?? 0;
        data.detectedIssues = [];
    }

    if (data.type === 'simplebeacon-re-attestation-note' && !data.gate) {
        const isRef = data.workflowStatus === 'reference-only' || data.currentGate === null;
        const cg = data.currentGate || {};
        data.gate = {
            pass: isRef ? null : (cg.pass ?? false),
            blockingCount: isRef ? null : (cg.blockingCount ?? 0),
            warningCount: 0
        };
        data.qualityScore = cg.qualityScore ?? 0;
        data.totalFiles = cg.repositoryFilesTotal ?? 0;
        data.issueCount = 0;
    }

    if (!data.gate) {
        if (data.packageJsonCount !== undefined || data.dependencyCount !== undefined) {
            const pkgCount = data.packageJsonCount ?? 0;
            const depCount = data.dependencyCount ?? 0;
            const h = data.hygieneSummary || {};
            const critical = h.critical || 0;
            const high = h.high || 0;
            const moderate = h.moderate || 0;
            const low = h.low || 0;
            data.gate = { pass: h.gatePass ?? true, blockingCount: critical + high, warningCount: moderate + low };
            data.qualityScore = h.gatePass === true ? 100 : Math.max(0, 100 - (critical * 20 + high * 10 + moderate * 5 + low * 2));
            data.totalFiles = pkgCount;
            data.npmAudit = { packageJsonCount: pkgCount, dependencyCount: depCount, summary: `${pkgCount} package.json files found with ${depCount} total dependencies.` };
        } else {
            const debugCount = data.debugArtifactCount || 0;
            const mockCount = data.mockSampleFiles || 0;
            const credHits = data.credentialFindings || 0;
            const totalIssues = debugCount + mockCount + credHits + (data.issueCount || 0);
            data.gate = { pass: credHits === 0, blockingCount: credHits, warningCount: totalIssues - credHits };
            data.qualityScore = data.qualityScore ?? (totalIssues === 0 ? 100 : Math.max(0, 100 - totalIssues * 2));
            data.totalFiles = data.totalFiles ?? data.filesAnalyzed ?? 0;
        }
    }

    const gate = data.gate || data.results?.simplebeacon?.gate || {};
    const gatePass = gate.pass;
    const gateStatus = gatePass === true ? 'pass' : gatePass === false ? 'fail' : 'review';
    const detectedIssues = Array.isArray(data.detectedIssues) ? data.detectedIssues : (Array.isArray(data.rawIssues) ? data.rawIssues : []);
    const rawIssues = Array.isArray(data.rawIssues) ? data.rawIssues : detectedIssues;
    const quality = data.qualityScore ?? data.results?.simplebeacon?.qualityScore ?? (rawIssues.length ? Math.max(0, 100 - rawIssues.length * 2) : 0);
    const files = data.totalFiles ?? data.filesAnalyzed ?? data.repositoryFilesTotal ?? data.summary?.files ?? 0;
    const issues = data.issueCount ?? gate.blockingCount ?? detectedIssues.length ?? 0;
    const project = data.projectRoot || data.scanTargetRoot || (Array.isArray(data.scanPaths) ? data.scanPaths[0] : null) || 'Unknown Project';
    const grade = quality >= 90 ? 'A' : quality >= 80 ? 'B' : quality >= 70 ? 'C' : quality >= 60 ? 'D' : 'F';
    const gradeColor = quality >= 80 ? '#10B981' : quality >= 60 ? '#F59E0B' : '#EF4444';

    return { gatePass, gateStatus, quality, files, issues, project, grade, gradeColor, hasToken };
}

const tests = [
    { name: 'Complete scan preview', input: { type: 'simplebeacon-report', gate: { pass: true }, qualityScore: 85, totalFiles: 100, detectedIssues: [] }, expect: { gatePass: true, quality: 85, files: 100, grade: 'B' } },
    { name: 'Public summary preview', input: { type: 'simplebeacon-public-summary', summary: { gatePass: false, qualityScore: 55, filesScanned: 40 } }, expect: { gatePass: false, quality: 55, files: 40, grade: 'F' } },
    { name: 'Re-attestation null gate', input: { type: 'simplebeacon-re-attestation-note', gate: { pass: null }, qualityScore: 70, totalFiles: 200 }, expect: { gatePass: null, quality: 70, files: 200, grade: 'C' } },
    { name: 'npm-audit preview', input: { type: 'simplebeacon-npm-audit', packageJsonCount: 245, dependencyCount: 1981, hygieneSummary: { gatePass: true } }, expect: { gatePass: true, quality: 100, files: 245, grade: 'A' } },
    { name: 'Generic cleanup preview', input: { debugArtifactCount: 3, credentialFindings: 1 }, expect: { gatePass: false, quality: 92, files: 0, grade: 'A' } },
];

let passed = 0, failed = 0;
tests.forEach(t => {
    const r = renderPreview(t.input);
    const errors = [];
    if (t.expect.gatePass !== undefined && r.gatePass !== t.expect.gatePass) errors.push(`gatePass: got ${r.gatePass}, expected ${t.expect.gatePass}`);
    if (t.expect.quality !== undefined && r.quality !== t.expect.quality) errors.push(`quality: got ${r.quality}, expected ${t.expect.quality}`);
    if (t.expect.files !== undefined && r.files !== t.expect.files) errors.push(`files: got ${r.files}, expected ${t.expect.files}`);
    if (t.expect.grade !== undefined && r.grade !== t.expect.grade) errors.push(`grade: got ${r.grade}, expected ${t.expect.grade}`);
    if (errors.length) { console.log('FAIL:', t.name, '|', errors.join('; ')); failed++; }
    else { console.log('PASS:', t.name); passed++; }
});
console.log(`\nTotal: ${passed} passed, ${failed} failed`);
