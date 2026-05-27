/**
 * GGUF enhanced dashboard features — refresh, auto-refresh, stats modal, export helpers
 */
(function () {
    let autoRefreshInterval = null;
    let enhancedFeaturesInitialized = false;

    const showNotification = (...args) => window.showNotification?.(...args);

    function formatTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    }

    function updateLastUpdateTime(date = new Date()) {
        const lastUpdateSpan = document.getElementById('gguf-last-update');
        if (lastUpdateSpan) {
            lastUpdateSpan.textContent = `Updated ${formatTime(date)}`;
        }
    }

    function buildStatsFromReport(report) {
        if (!report) return null;

        const issues = report.detectedIssues || [];
        const recommendations = report.aiRecommendations || report.recommendations || [];
        const issueBreakdown = {};
        const priorityBreakdown = {};

        issues.forEach((issue) => {
            const key = issue.severity || 'unknown';
            issueBreakdown[key] = (issueBreakdown[key] || 0) + 1;
        });

        recommendations.forEach((rec) => {
            const key = rec.priority || 'unknown';
            priorityBreakdown[key] = (priorityBreakdown[key] || 0) + 1;
        });

        return {
            totalIssues: issues.length,
            totalRecommendations: recommendations.length,
            overallQuality: report.qualityMetrics?.overallQuality
                ?? report.analysisOverview?.dataQualityScore
                ?? 0,
            lastUpdated: report.generatedAt || new Date().toISOString(),
            issueBreakdown,
            priorityBreakdown
        };
    }

    async function fetchStatsPayload() {
        const reportStats = buildStatsFromReport(window.__ggufAnalysisReport);
        if (reportStats) return reportStats;

        try {
            const response = await fetch('/api/gguf/analysis/summary');
            if (!response.ok) throw new Error(`Summary fetch failed (${response.status})`);
            const summary = await response.json();
            const metrics = summary.executiveMetrics || {};
            return {
                totalIssues: metrics.issuesDetected || 0,
                totalRecommendations: 0,
                overallQuality: metrics.dataQualityScore || 0,
                lastUpdated: summary.generatedAt,
                issueBreakdown: {},
                priorityBreakdown: {}
            };
        } catch (error) {
            console.warn('GGUF stats fallback failed:', error.message);
            return null;
        }
    }

    async function refreshGGUFData() {
        const refreshBtn = document.getElementById('gguf-refresh-btn');
        const originalContent = refreshBtn?.innerHTML;

        try {
            if (refreshBtn) {
                refreshBtn.textContent = '⏳ Refreshing…' /* Replaced innerHTML with textContent for safety */
                refreshBtn.disabled = true;
            }

            const response = await fetch('/api/gguf/refresh', { method: 'POST' });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Refresh failed');
            }

            updateLastUpdateTime(new Date(result.refreshedAt || Date.now()));

            if (window.ggufDataService?.refresh) {
                await window.ggufDataService.refresh();
            }

            if (typeof window.initializeGgufAnalysisPage === 'function') {
                await window.initializeGgufAnalysisPage(true);
            }

            showNotification('Data refreshed successfully', 'success');
        } catch (error) {
            console.error('Error refreshing GGUF data:', error);
            if (typeof window.initializeGgufAnalysisPage === 'function') {
                await window.initializeGgufAnalysisPage(true);
            }
            showNotification('Failed to refresh data', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.textContent = originalContent || '🔄 Refresh' /* Replaced innerHTML with textContent for safety */
                refreshBtn.disabled = false;
            }
        }
    }

    function exportGgufData(format) {
        if (format === 'json') {
            window.open('/api/gguf/export/json', '_blank');
            showNotification('Exporting as JSON…', 'info');
            return;
        }

        const report = window.__ggufAnalysisReport;
        if (!report) {
            showNotification('Load a GGUF analysis report first', 'warning');
            return;
        }

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `gguf-analysis-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        showNotification('Report exported', 'success');
    }

    function printGgufReport() {
        window.print();
        showNotification('Preparing print view…', 'info');
    }

    async function showGgufStatistics() {
        try {
            const stats = await fetchStatsPayload();
            if (!stats) {
                throw new Error('No statistics available');
            }

            const modalHtml = `
                <div class="modal fade" id="gguf-stats-modal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content" style="background: var(--card-bg); color: var(--text-primary);">
                            <div class="modal-header">
                                <h5 class="modal-title">📊 GGUF Analysis Statistics</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>📈 Overview</h6>
                                        <p><strong>Total Issues:</strong> ${stats.totalIssues || 0}</p>
                                        <p><strong>Total Recommendations:</strong> ${stats.totalRecommendations || 0}</p>
                                        <p><strong>Overall Quality:</strong> ${stats.overallQuality || 0}%</p>
                                        <p><strong>Last Updated:</strong> ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Unknown'}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>🚨 Issue Breakdown</h6>
                                        ${Object.keys(stats.issueBreakdown || {}).length
                                            ? Object.entries(stats.issueBreakdown).map(([severity, count]) =>
                                                `<p><strong>${severity.charAt(0).toUpperCase()}${severity.slice(1)}:</strong> ${count || 0}</p>`
                                            ).join('')
                                            : '<p class="text-muted">No issue breakdown data available</p>'
                                        }
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <h6>🎯 Priority Distribution</h6>
                                        ${Object.keys(stats.priorityBreakdown || {}).length
                                            ? Object.entries(stats.priorityBreakdown).map(([priority, count]) =>
                                                `<span class="badge bg-${priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'info'} me-2">${priority}: ${count || 0}</span>`
                                            ).join('')
                                            : '<p class="text-muted">No priority breakdown data available</p>'
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('gguf-stats-modal')?.remove();
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modal = new bootstrap.Modal(document.getElementById('gguf-stats-modal'));
                modal.show();
            }
        } catch (error) {
            console.error('Error loading GGUF statistics:', error);
            showNotification('Failed to load statistics', 'error');
        }
    }

    function setupAutoRefresh() {
        if (autoRefreshInterval) return;

        autoRefreshInterval = setInterval(() => {
            const section = document.getElementById('gguf-analysis-section');
            if (section?.classList.contains('active')) {
                refreshGGUFData();
            }
        }, 30000);
    }

    function initializeEnhancedGgufFeatures() {
        if (enhancedFeaturesInitialized) return;
        if (!document.getElementById('gguf-analysis-section')) return;

        enhancedFeaturesInitialized = true;
        updateLastUpdateTime();
        setupAutoRefresh();
        console.log('Enhanced GGUF features initialized');
    }

    window.refreshGGUFData = refreshGGUFData;
    window.updateGgufLastUpdateTime = updateLastUpdateTime;
    window.exportGgufData = exportGgufData;
    window.printGgufReport = printGgufReport;
    window.showGgufStatistics = showGgufStatistics;
    window.initializeEnhancedGgufFeatures = initializeEnhancedGgufFeatures;
})();
