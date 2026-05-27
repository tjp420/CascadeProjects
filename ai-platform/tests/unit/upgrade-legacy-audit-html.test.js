const fs = require('fs');
const path = require('path');
const { isLegacyAuditHtml, upgradeLegacyAuditHtml } = require('../../tools/upgrade-legacy-audit-html');
const { getAuditReportStyles } = require('../../server/lib/complete-scan-audit-report');

describe('upgrade legacy audit html', () => {
    test('detects and upgrades light-theme exports', () => {
        const legacy = `<!DOCTYPE html><html><head><style>:root { --ink: #0b1220; } body { background: #fff; }</style></head><body><h1>Test</h1></body></html>`;
        expect(isLegacyAuditHtml(legacy)).toBe(true);
        const { html, changed } = upgradeLegacyAuditHtml(legacy);
        expect(changed).toBe(true);
        expect(html).toContain('color-scheme: dark');
        expect(html).toContain('--bg: #0d1117');
        expect(html).not.toContain('--ink: #0b1220');
        expect(html).toContain(getAuditReportStyles().slice(0, 40));
    });

    test('skips already modern exports', () => {
        const modern = `<!DOCTYPE html><html><head><meta name="color-scheme" content="dark"><style>${getAuditReportStyles()}</style></head><body></body></html>`;
        const { changed } = upgradeLegacyAuditHtml(modern);
        expect(changed).toBe(false);
    });
});
