#!/usr/bin/env python3
"""Extract inline dashboard shell JS from dashboard-new.html."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'web' / 'dashboard-new.html'
SHELL_OUT = ROOT / 'web' / 'scripts' / 'dashboard-shell.js'
CHARTS_OUT = ROOT / 'web' / 'scripts' / 'dashboard-legacy-charts.js'
REPORT_OUT = ROOT / 'web' / 'scripts' / 'ai-roadmap-legacy-report.js'

content = HTML.read_text(encoding='utf-8')
lines = content.splitlines(keepends=True)

# 1-based inclusive line numbers inside the main inline <script> block
SHELL_START = 13834
SHELL_END = 14181
CHARTS_START = 14183
CHARTS_END = 14425
WRAPPERS_START = 14427
WRAPPERS_END = 14508
REPORT_START = 14510
REPORT_END = 14784
SCRIPT_OPEN = 13833
SCRIPT_CLOSE = 14786

shell_body = ''.join(lines[SHELL_START - 1:SHELL_END])
charts_body = ''.join(lines[CHARTS_START - 1:CHARTS_END])
wrappers_body = ''.join(lines[WRAPPERS_START - 1:WRAPPERS_END])

shell_header = """/**
 * Dashboard shell — navigation, headers, notifications, GGUF compatibility wrappers
 */
(function () {
"""
shell_footer = """
    window.showSection = showSection;
    window.toggleSidebar = toggleSidebar;
    window.updateHeader = updateHeader;
    window.SELF_CONTAINED_SECTIONS = SELF_CONTAINED_SECTIONS;
    window.applyImportedMockAnalysisJson = applyImportedMockAnalysisJson;
    window.loadGgufMockAnalysisSample = loadGgufMockAnalysisSample;
    window.loadGGUFModelAnalysis = loadGGUFModelAnalysis;
    window.downloadMockDataReport = downloadMockDataReport;
})();
"""

charts_header = """/**
 * Legacy dashboard charts for hidden roadmap sections (requires Chart.js)
 */
(function () {
    let performanceChart = null;

"""
charts_footer = """
    window.initializeCharts = initializeCharts;
})();
"""

report_header = """/**
 * Legacy AI roadmap report download (hidden ai-roadmap-legacy section)
 */
(function () {
    const showNotification = (...args) => window.showNotification?.(...args);

"""
report_footer = """
    window.downloadReport = downloadReport;
})();
"""

# Replace downloadReport body with sample-based implementation
report_body = """
    async function downloadReport() {
        showNotification('⬇️ Downloading AI-Powered Roadmap Report...', 'info');

        try {
            const response = await fetch('/data/ai-roadmap-sample.json');
            if (!response.ok) {
                throw new Error(`Sample fetch failed (${response.status})`);
            }

            const reportData = await response.json();
            reportData.generatedAt = new Date().toISOString();
            reportData.type = reportData.type || 'ai-powered-roadmap-report';
            reportData.title = reportData.title || 'AI-Powered Roadmap Report';

            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'ai-powered-roadmap-report-' + new Date().toISOString().split('T')[0] + '.json';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);

            showNotification('✅ AI-Powered Roadmap Report downloaded successfully', 'success');
        } catch (error) {
            console.error('Error downloading report:', error);
            showNotification('❌ Error downloading report', 'error');
        }
    }
"""

# Patch shell DOMContentLoaded to use window.initializeCharts
shell_body = shell_body.replace(
    '            initializeCharts();',
    '            window.initializeCharts?.();',
)

SHELL_OUT.write_text(shell_header + shell_body + '\n' + wrappers_body + shell_footer, encoding='utf-8')
CHARTS_OUT.write_text(charts_header + charts_body + charts_footer, encoding='utf-8')
REPORT_OUT.write_text(report_header + report_body + report_footer, encoding='utf-8')

replacement = """    <script src="/scripts/dashboard-legacy-charts.js"></script>
    <script src="/scripts/dashboard-shell.js"></script>
    <script src="/scripts/ai-roadmap-legacy-report.js"></script>
"""
new_lines = lines[:SCRIPT_OPEN] + [replacement] + lines[SCRIPT_CLOSE:]

HTML.write_text(''.join(new_lines), encoding='utf-8')
print(f'Wrote {SHELL_OUT.name} ({SHELL_OUT.stat().st_size} bytes)')
print(f'Wrote {CHARTS_OUT.name} ({CHARTS_OUT.stat().st_size} bytes)')
print(f'Wrote {REPORT_OUT.name} ({REPORT_OUT.stat().st_size} bytes)')
print('Updated dashboard-new.html')
