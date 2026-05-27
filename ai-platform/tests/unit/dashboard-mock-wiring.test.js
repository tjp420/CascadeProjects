const fs = require('fs');
const path = require('path');

const DASHBOARD_HTML = path.join(__dirname, '../../web/dashboard.html');
const WIRING_JS = path.join(__dirname, '../../web/scripts/dashboard-mock-wiring.js');
const INLINE_PART1 = path.join(__dirname, '../../web/scripts/dashboard-inline-core.part1.js');

describe('dashboard.html mock wiring', () => {
    let html;
    let wiring;

    beforeAll(() => {
        html = fs.readFileSync(DASHBOARD_HTML, 'utf8');
        wiring = fs.readFileSync(WIRING_JS, 'utf8');
    });

    test('loads dashboard mock wiring script after inline core', () => {
        const inlineIdx = html.indexOf('dashboard-inline-core.js');
        const wiringIdx = html.indexOf('dashboard-mock-wiring.js');
        expect(inlineIdx).toBeGreaterThan(-1);
        expect(wiringIdx).toBeGreaterThan(inlineIdx);
    });

    test('does not ship hardcoded mock source fiction counts', () => {
        expect(html).not.toContain('347 files');
        expect(html).not.toContain('234 files');
        expect(html).not.toContain('Quality: 92%');
    });

    test('mock analyzer stats start in loading state', () => {
        expect(html).toContain('id="mock-analyzer-stats-grid"');
        expect(html).toContain('id="mock-dashboard-status"');
        expect(html).toMatch(/Mock Files Found[\s\S]*?<div class="stat-value">—<\/div>/);
    });

    test('wiring script exposes onclick handlers and API calls', () => {
        expect(wiring).toContain('window.analyzeMockData = analyzeMockData');
        expect(wiring).toContain('window.convertMockData = convertMockData');
        expect(wiring).toContain('window.validateMockData = validateMockData');
        expect(wiring).toContain("fetch('/api/models/active/analyze'");
        expect(wiring).toContain("fetch('/api/mock-analysis')");
        expect(wiring).toContain("fetch('/api/mock-conversion')");
        expect(wiring).toContain("fetch('/api/mock-validation')");
        expect(wiring).toContain("fetch('/api/project-structure')");
        expect(wiring).toContain("fetch('/api/backlog')");
        expect(wiring).toContain('window.loadBacklogStats = loadBacklogStats');
    });

    test('inline core no longer targets localhost:3001 mock APIs', () => {
        const part1 = fs.readFileSync(INLINE_PART1, 'utf8');
        expect(part1).not.toContain('localhost:3001/api/mock-analysis');
        expect(part1).not.toContain('localhost:3001/api/mock-conversion');
    });

    test('wiring script parses cleanly', () => {
        expect(() => {
            require('child_process').execSync(`node --check "${WIRING_JS}"`, { stdio: 'pipe' });
        }).not.toThrow();
    });
});
