#!/usr/bin/env python3
"""Extract inline development roadmap JS from dashboard-new.html."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'web' / 'dashboard-new.html'
OUT = ROOT / 'web' / 'scripts' / 'development-roadmap-core.js'

content = HTML.read_text(encoding='utf-8')
lines = content.splitlines(keepends=True)

# 1-based inclusive line numbers from prior analysis
CORE_START = 14786
CORE_END = 17031
AUX_START = 17034
AUX_END = 17376
INLINE_SERVICE_START = 17633
INLINE_SERVICE_END = 18092

core_body = ''.join(lines[CORE_START - 1:CORE_END])
aux_body = ''.join(lines[AUX_START - 1:AUX_END])

header = """/**
 * Development Roadmap core — path builder, import/export, rendering, component init
 */
(function () {
    const showNotification = (...args) => window.showNotification?.(...args);

"""

footer = """
    window.downloadDevelopmentRoadmapReport = downloadDevelopmentRoadmapReport;
    window.buildRoadmapFromPath = buildRoadmapFromPath;
    window.loadSampleRoadmapJson = loadSampleRoadmapJson;
    window.loadGgufSampleRoadmapJson = loadGgufSampleRoadmapJson;
    window.applyImportedRoadmapJson = applyImportedRoadmapJson;
    window.applyGeneratedRoadmapToDashboard = applyGeneratedRoadmapToDashboard;
    window.restoreSavedDynamicRoadmap = restoreSavedDynamicRoadmap;
    window.downloadGeneratedRoadmapJson = downloadGeneratedRoadmapJson;
    window.downloadComparisonReport = downloadComparisonReport;
    window.importRoadmapJsonFile = importRoadmapJsonFile;
    window.showExportMenu = showExportMenu;
    window.initializeExportMenu = initializeExportMenu;
    window.initializeRoadmapWhenReady = initializeWhenReady;
    window.initializeRoadmapTimeline = initializeRoadmapTimeline;
    window.initializeComparisonDashboard = initializeComparisonDashboard;
    window.initializeOptimizationEngine = initializeOptimizationEngine;
    window.initializeAnalyticsPerformanceDashboard = initializeAnalyticsPerformanceDashboard;
    window.initializePatternAnalyzer = initializePatternAnalyzer;
    window.togglePhaseDetails = togglePhaseDetails;
    window.highlightPhase = highlightPhase;
    window.unhighlightPhase = unhighlightPhase;
    window.loadBlobDrivenRoadmap = loadBlobDrivenRoadmap;
})();
"""

OUT.write_text(header + core_body + '\n' + aux_body + footer, encoding='utf-8')

# Remove core block from first script section
new_lines = lines[:CORE_START - 1] + lines[CORE_END:]

# Adjust indices after first deletion
removed = CORE_END - CORE_START + 1
aux_start = AUX_START - removed
aux_end = AUX_END - removed
inline_start = INLINE_SERVICE_START - removed
inline_end = INLINE_SERVICE_END - removed

# Remove aux block (export + component inits)
new_lines = new_lines[:aux_start - 1] + new_lines[aux_end:]

removed2 = aux_end - aux_start + 1
inline_start -= removed2
inline_end -= removed2

# Replace inline RoadmapDataService block with script includes
replacement = """    <!-- Development Roadmap modules -->
    <script src="/scripts/roadmap-data-service.js"></script>
    <script src="/scripts/roadmap-comparison-analyzer.js"></script>
    <script src="/scripts/roadmap-export-system.js"></script>
    <script src="/scripts/development-roadmap-core.js"></script>
    <script src="/scripts/development-roadmap-page.js"></script>
"""
new_lines = new_lines[:inline_start - 1] + [replacement] + new_lines[inline_end:]

HTML.write_text(''.join(new_lines), encoding='utf-8')
print(f'Wrote {OUT.name} ({OUT.stat().st_size} bytes)')
print('Updated dashboard-new.html')
