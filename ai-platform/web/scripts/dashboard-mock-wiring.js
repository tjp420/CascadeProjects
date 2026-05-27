/**
 * dashboard.html mock-data wiring — connects static markup to live APIs.
 */
(function () {
    const ROOT = '#mock-analyzer-content';
    const SAMPLE_URL = '/data/gguf-mock-analysis-sample.json?v=20260525';

    let cachedReport = null;
    let cachedScan = null;

    function notify(message, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    function setStatus(html) {
        const el = document.getElementById('mock-dashboard-status');
        if (el) el.innerHTML = html;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function loadProjectStructureStats() {
        try {
            const response = await fetch('/api/project-structure');
            if (!response.ok) {
                throw new Error(`GET /api/project-structure failed (${response.status})`);
            }
            const payload = await response.json();
            const entries = Object.values(payload.files || {});
            const totalFiles = entries.length;
            const completed = entries.filter((f) => f.status === 'completed').length;
            const inProgress = entries.filter((f) => f.status === 'in-progress').length;
            const qualityPct = totalFiles > 0
                ? Math.round((completed / totalFiles) * 100)
                : 0;
            const totalBytes = entries.reduce((sum, f) => sum + (f.size || 0), 0);

            renderDefaultStats({
                totalFiles,
                qualityPct,
                totalBytes,
                activeTasks: inProgress
            });
        } catch (error) {
            console.warn('Project structure stats unavailable:', error.message);
        }
    }

    function formatBytes(bytes) {
        if (!bytes) return '—';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit += 1;
        }
        return `${value.toFixed(unit === 0 ? 0 : 1)}${units[unit]}`;
    }

    function renderDefaultStats(data) {
        const grid = document.getElementById('default-stats-grid');
        if (!grid) return;
        const stats = grid.querySelectorAll('.stat-value');
        if (stats[0]) stats[0].textContent = formatCount(data.totalFiles);
        if (stats[1]) stats[1].textContent = `${data.qualityPct}%`;
        if (stats[2]) stats[2].textContent = formatBytes(data.totalBytes);
        if (stats[3]) stats[3].textContent = formatCount(data.activeTasks);
    }

    window.loadProjectStructureStats = loadProjectStructureStats;

    function countBacklogMarkers(items) {
        const counts = { todo: 0, fixme: 0, other: 0 };
        (items || []).forEach((item) => {
            const marker = String(item.title || item.type || '').toUpperCase();
            if (marker.includes('FIXME')) {
                counts.fixme += 1;
            } else if (marker.includes('TODO')) {
                counts.todo += 1;
            } else if (item.priority === 'high') {
                counts.fixme += 1;
            } else if (item.priority === 'medium') {
                counts.todo += 1;
            } else {
                counts.other += 1;
            }
        });
        return counts;
    }

    function renderBacklogIssueCounts(counts) {
        const renderItem = (selector, label, count) => {
            const container = document.querySelector(`${ROOT} ${selector} .issue-list`);
            if (!container) return;
            const first = container.querySelector('.issue-item');
            if (!first) return;
            first.innerHTML = `
                <span class="issue-type">${escapeHtml(label)}</span>
                <span class="issue-count">${formatCount(count)} items</span>
                <button class="ai-fix-btn" onclick="analyzeMockData()">🤖 Review</button>`;
        };

        renderItem('.issue-category:nth-child(1)', 'FIXME Markers', counts.fixme);
        renderItem('.issue-category:nth-child(2)', 'TODO Markers', counts.todo);
        renderItem('.issue-category:nth-child(3)', 'Other Backlog Notes', counts.other);
    }

    async function loadBacklogStats() {
        try {
            const response = await fetch('/api/backlog');
            if (!response.ok) {
                throw new Error(`GET /api/backlog failed (${response.status})`);
            }
            const payload = await response.json();
            const items = Array.isArray(payload) ? payload : (payload.items || []);
            const counts = countBacklogMarkers(items);
            renderBacklogIssueCounts(counts);
            return { totalItems: items.length, ...counts };
        } catch (error) {
            console.warn('Backlog stats unavailable:', error.message);
            return null;
        }
    }

    window.loadBacklogStats = loadBacklogStats;

    function scopedStatValues() {
        const grid = document.getElementById('mock-analyzer-stats-grid');
        if (!grid) return [];
        return Array.from(grid.querySelectorAll('.stat-value'));
    }

    function normalizeFromReport(report) {
        const overview = report?.analysisOverview || {};
        return {
            totalFiles: overview.totalMockFiles ?? 0,
            dataQualityScore: overview.dataQualityScore ?? 0,
            totalMockDataSize: overview.totalMockDataSize || '—',
            issuesDetected: overview.issuesDetected ?? 0,
            categories: report?.mockDataCategories || [],
            issues: report?.detectedIssues || [],
            source: 'model-analyze'
        };
    }

    function normalizeFromScan(payload) {
        return {
            totalFiles: payload.filesFound ?? payload.summary?.filesFound ?? 0,
            dataQualityScore: payload.dataQualityScore ?? payload.summary?.dataQualityScore ?? 0,
            totalMockDataSize: payload.totalMockDataSize || '—',
            issuesDetected: payload.issuesDetected ?? payload.summary?.issuesDetected ?? 0,
            categories: groupScanFiles(payload.files || []),
            issues: payload.issues || [],
            source: 'mock-analysis'
        };
    }

    function groupScanFiles(files) {
        const buckets = {};
        files.forEach((file) => {
            const ext = (file.name || file.path || '').split('.').pop()?.toLowerCase() || 'other';
            const key = ext === 'json' ? 'JSON Files' : `${ext.toUpperCase()} Files`;
            if (!buckets[key]) {
                buckets[key] = { category: key, fileCount: 0, totalSize: '—', qualityScore: null, issues: 0, description: `${key} from repository scan` };
            }
            buckets[key].fileCount += 1;
        });
        return Object.values(buckets);
    }

    async function fetchModelReport() {
        const response = await fetch('/api/models/active/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!response.ok) {
            throw new Error(`POST /api/models/active/analyze failed (${response.status})`);
        }
        const payload = await response.json();
        if (!payload.report) {
            throw new Error('Analyze response did not include a report');
        }
        cachedReport = payload.report;
        return normalizeFromReport(payload.report);
    }

    async function fetchScanPayload() {
        const response = await fetch('/api/mock-analysis');
        if (!response.ok) {
            throw new Error(`GET /api/mock-analysis failed (${response.status})`);
        }
        const payload = await response.json();
        cachedScan = payload;
        return normalizeFromScan(payload);
    }

    async function loadMockDashboardData(options = {}) {
        const silent = Boolean(options.silent);
        if (!silent) {
            setStatus('<span style="color:#60a5fa;">⏳ Loading mock data metrics…</span>');
        }

        try {
            let model = null;
            try {
                model = await fetchModelReport();
            } catch (modelError) {
                console.warn('Model analyze unavailable, falling back to mock-analysis scan:', modelError.message);
            }

            const scan = await fetchScanPayload();
            const merged = {
                ...scan,
                ...(model || {}),
                totalFiles: model?.totalFiles || scan.totalFiles,
                dataQualityScore: model?.dataQualityScore ?? scan.dataQualityScore,
                totalMockDataSize: model?.totalMockDataSize !== '—' ? model?.totalMockDataSize : scan.totalMockDataSize,
                issuesDetected: model?.issuesDetected ?? scan.issuesDetected,
                categories: (model?.categories?.length ? model.categories : scan.categories) || []
            };

            renderMockDashboard(merged);
            if (!silent) {
                setStatus(`<span style="color:#34d399;">✅ Loaded ${merged.totalFiles} files — ${merged.dataQualityScore}% quality (${merged.source})</span>`);
            }
            return merged;
        } catch (error) {
            console.error('loadMockDashboardData failed:', error);
            renderMockDashboard({
                totalFiles: '—',
                dataQualityScore: '—',
                totalMockDataSize: '—',
                issuesDetected: '—',
                categories: [],
                issues: [],
                source: 'error'
            });
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            throw error;
        }
    }

    function renderMockDashboard(data) {
        const stats = scopedStatValues();
        if (stats[0]) stats[0].textContent = formatCount(data.totalFiles);
        if (stats[1]) stats[1].textContent = formatPercent(data.dataQualityScore);
        if (stats[2]) stats[2].textContent = data.totalMockDataSize || '—';
        if (stats[3]) stats[3].textContent = formatCount(data.issuesDetected);

        renderMockSources(data.categories, data);
        updatePipelineSteps(data);
        updateIssuesGrid(data.issues);
    }

    function formatCount(value) {
        if (value === '—' || value == null) return '—';
        const num = Number(value);
        return Number.isFinite(num) ? num.toLocaleString() : String(value);
    }

    function formatPercent(value) {
        if (value === '—' || value == null) return '—';
        const text = String(value);
        return text.includes('%') ? text : `${text}%`;
    }

    function renderMockSources(categories, data) {
        const grid = document.querySelector(`${ROOT} .mock-sources-grid`);
        if (!grid) return;

        const items = Array.isArray(categories) ? categories : [];
        if (items.length === 0) {
            grid.innerHTML = `
                <div class="source-item ai-enhanced">
                    <div class="source-header">
                        <h4>📂 Scan Results</h4>
                        <span class="source-count">${formatCount(data.totalFiles)} files</span>
                    </div>
                    <div class="source-details">
                        <p>No category breakdown returned — totals reflect the latest API scan.</p>
                        <div class="source-stats">
                            <span>Quality: ${formatPercent(data.dataQualityScore)}</span>
                            <span>Size: ${escapeHtml(data.totalMockDataSize || '—')}</span>
                            <span>Issues: ${formatCount(data.issuesDetected)}</span>
                        </div>
                    </div>
                </div>`;
            return;
        }

        grid.innerHTML = items.map((cat) => `
            <div class="source-item ai-enhanced">
                <div class="source-header">
                    <h4>${escapeHtml(cat.category || 'Category')} <span class="ai-badge">🤖 Live</span></h4>
                    <span class="source-count">${formatCount(cat.fileCount)} files</span>
                </div>
                <div class="source-details">
                    <p>${escapeHtml(cat.description || 'Mock data discovered during repository scan')}</p>
                    <div class="source-stats">
                        <span>Quality: ${cat.qualityScore != null ? `${cat.qualityScore}%` : formatPercent(data.dataQualityScore)}</span>
                        <span>Size: ${escapeHtml(cat.totalSize || '—')}</span>
                        <span>Issues: ${formatCount(cat.issues ?? 0)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function updatePipelineSteps(data) {
        const steps = document.querySelectorAll(`${ROOT} .pipeline-step`);
        if (steps[0]) {
            const small = steps[0].querySelector('.step-content small');
            if (small) small.textContent = `Status: Completed - Found ${formatCount(data.totalFiles)} mock files`;
        }
        if (steps[1]) {
            const small = steps[1].querySelector('.step-content small');
            if (small) small.textContent = `Status: Completed - ${formatPercent(data.dataQualityScore)} quality score`;
        }
        if (steps[2]) {
            const small = steps[2].querySelector('.step-content small');
            if (small) small.textContent = `Status: In Progress - ${formatCount(data.issuesDetected)} issues detected`;
        }
    }

    function updateIssuesGrid(issues) {
        if (!Array.isArray(issues) || issues.length === 0) return;

        const bySeverity = { high: [], medium: [], low: [] };
        issues.forEach((issue) => {
            const severity = issue.severity || 'low';
            if (!bySeverity[severity]) bySeverity[severity] = [];
            bySeverity[severity].push(issue);
        });

        const renderList = (selector, list, emptyLabel) => {
            const container = document.querySelector(`${ROOT} ${selector}`);
            if (!container) return;
            container.innerHTML = list.length
                ? list.slice(0, 6).map((issue) => `
                    <div class="issue-item">
                        <span class="issue-type">${escapeHtml(issue.type || issue.description || 'Issue')}</span>
                        <span class="issue-count">${formatCount(issue.count || 1)} files</span>
                    </div>`).join('')
                : `<div class="issue-item"><span class="issue-type">${emptyLabel}</span><span class="issue-count">0 files</span></div>`;
        };

        renderList('.issue-category:nth-child(1) .issue-list', bySeverity.high, 'No critical issues');
        renderList('.issue-category:nth-child(2) .issue-list', bySeverity.medium, 'No warnings');
        renderList('.issue-category:nth-child(3) .issue-list', bySeverity.low, 'No info issues');
    }

    async function analyzeMockData() {
        notify('🔍 Analyzing mock data…', 'info');
        setStatus('<span style="color:#60a5fa;">⏳ Running POST /api/models/active/analyze…</span>');
        try {
            if (typeof window.showContent === 'function') {
                window.showContent('mock-analyzer-content');
            } else {
                const section = document.getElementById('mock-analyzer-content');
                if (section) section.style.display = 'block';
            }

            const data = await loadMockDashboardData({ silent: true });
            notify(`✅ Analysis complete — ${data.totalFiles} files, ${formatPercent(data.dataQualityScore)} quality`, 'success');
            setStatus(`<span style="color:#34d399;">✅ Analysis complete — ${data.issuesDetected} issues in ${data.totalFiles} files</span>`);
        } catch (error) {
            notify(`❌ Analysis failed: ${error.message}`, 'error');
        }
    }

    async function convertMockData() {
        notify('🔄 Converting mock data…', 'info');
        setStatus('<span style="color:#60a5fa;">⏳ Calling GET /api/mock-conversion…</span>');
        try {
            const response = await fetch('/api/mock-conversion');
            if (!response.ok) {
                throw new Error(`GET /api/mock-conversion failed (${response.status})`);
            }
            const payload = await response.json();
            const converted = payload.filesConverted ?? payload.summary?.filesConverted ?? 0;
            const successRate = payload.conversionsSuccessful ?? payload.summary?.conversionsSuccessful ?? '—';

            if (typeof window.updateConversionStats === 'function') {
                window.updateConversionStats(payload);
            }

            setStatus(`<span style="color:#34d399;">✅ Conversion complete — ${converted} files (${successRate} success)</span>`);
            notify(`✅ Converted ${converted} files (${successRate} success rate)`, 'success');
        } catch (error) {
            console.error('convertMockData failed:', error);
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            notify(`❌ Conversion failed: ${error.message}`, 'error');
        }
    }

    async function validateMockData() {
        notify('✅ Validating mock data…', 'info');
        setStatus('<span style="color:#60a5fa;">⏳ Calling GET /api/mock-validation…</span>');
        try {
            const response = await fetch('/api/mock-validation');
            if (!response.ok) {
                throw new Error(`GET /api/mock-validation failed (${response.status})`);
            }
            const payload = await response.json();
            const score = payload.summary?.averageScore ?? payload.validationSummary?.averageScore ?? payload.dataQualityScore ?? '—';
            const passed = payload.summary?.validationPassed ?? payload.validationSummary?.successfulValidations ?? '—';

            if (typeof window.updateValidationStats === 'function') {
                window.updateValidationStats(payload);
            }

            setStatus(`<span style="color:#34d399;">✅ Validation complete — score ${score}, passed ${passed}</span>`);
            notify(`✅ Validation complete`, 'success');
        } catch (error) {
            console.error('validateMockData failed:', error);
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            notify(`❌ Validation failed: ${error.message}`, 'error');
        }
    }

    async function generateMockData() {
        notify('🎲 Generating mock data template…', 'info');
        setStatus('<span style="color:#60a5fa;">⏳ Fetching sample template…</span>');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) {
                throw new Error(`Sample template unavailable (${response.status})`);
            }
            const payload = await response.json();
            const blob = new Blob([JSON.stringify(payload.data || payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'gguf-mock-analysis-sample.json';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            setStatus('<span style="color:#34d399;">✅ Sample template downloaded</span>');
            notify('✅ Sample template downloaded', 'success');
        } catch (error) {
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            notify(`❌ Generation failed: ${error.message}`, 'error');
        }
    }

    async function cleanMockData() {
        notify('🧹 Scanning for fixable issues…', 'info');
        setStatus('<span style="color:#60a5fa;">⏳ Calling GET /api/mock-cleaning…</span>');
        try {
            const response = await fetch('/api/mock-cleaning');
            if (!response.ok) {
                throw new Error(`GET /api/mock-cleaning failed (${response.status})`);
            }
            const payload = await response.json();
            const cleaned = payload.summary?.filesCleaned ?? payload.filesCleaned ?? 0;
            setStatus(`<span style="color:#34d399;">✅ Cleaning scan complete — ${cleaned} files processed</span>`);
            notify(`✅ Cleaning scan complete`, 'success');
            await loadMockDashboardData({ silent: true });
        } catch (error) {
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            notify(`❌ Cleaning failed: ${error.message}`, 'error');
        }
    }

    async function exportMockData() {
        notify('📤 Exporting mock data…', 'info');
        try {
            const report = cachedReport || cachedScan;
            if (!report) {
                await loadMockDashboardData({ silent: true });
            }
            const exportPayload = cachedReport || cachedScan;
            if (!exportPayload) {
                throw new Error('No analysis data available to export — run Analyze first');
            }
            const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `mock-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            notify('✅ Export downloaded', 'success');
        } catch (error) {
            notify(`❌ Export failed: ${error.message}`, 'error');
        }
    }

    window.analyzeMockData = analyzeMockData;
    window.convertMockData = convertMockData;
    window.validateMockData = validateMockData;
    window.generateMockData = generateMockData;
    window.cleanMockData = cleanMockData;
    window.exportMockData = exportMockData;
    window.loadMockDashboardData = loadMockDashboardData;

    document.addEventListener('DOMContentLoaded', () => {
        loadProjectStructureStats().catch(() => {
            /* default grid keeps static placeholders until API succeeds */
        });
        loadBacklogStats().catch(() => {
            /* issue grid keeps static placeholders until API succeeds */
        });

        const section = document.getElementById('mock-analyzer-content');
        if (!section) return;
        loadMockDashboardData({ silent: true }).catch(() => {
            /* error surfaced in status banner */
        });
    });
})();
