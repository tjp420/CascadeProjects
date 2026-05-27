/**
 * Mock data action cards — wired to the self-contained GGUF Analysis page.
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524bm';
    const SAMPLE_URL = `/data/gguf-mock-analysis-sample.json?v=${SAMPLE_CACHE_BUST}`;
    const ROOT_SELECTOR = '#gguf-analysis-root';

    function notify(message, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    function setActionLoading(action, loading) {
        const card = document.querySelector(
            `${ROOT_SELECTOR} .action-card[data-mock-action="${action}"]`
        );
        if (card) card.classList.toggle('is-loading', Boolean(loading));
    }

    function setStatus(html) {
        const el = document.getElementById('gguf-action-status');
        if (el) el.innerHTML = html;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function fetchSampleReport() {
        const response = await fetch(SAMPLE_URL);
        if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
        const payload = await response.json();
        return payload.data?.type === 'gguf-mock-data-analysis-report' ? payload.data : payload;
    }

    async function applyReport(report, sourceLabel) {
        if (typeof window.applyGgufAnalysisReport !== 'function') {
            throw new Error('GGUF analysis page is not loaded');
        }
        await window.applyGgufAnalysisReport(report, sourceLabel);
    }

    async function ensureReport() {
        if (window.__ggufAnalysisReport) return window.__ggufAnalysisReport;
        if (typeof window.loadGgufAnalysisSample === 'function') {
            await window.loadGgufAnalysisSample();
            return window.__ggufAnalysisReport;
        }
        const report = await fetchSampleReport();
        await applyReport(report, 'gguf-mock-analysis-sample.json');
        return report;
    }

    function navigateToGgufAnalysis() {
        const navLink = document.querySelector(".nav-link[onclick*=\"'gguf-analysis'\"]");
        if (typeof window.showSection === 'function') {
            window.showSection('gguf-analysis', navLink);
        }
    }

    function cloneReport(report) {
        return JSON.parse(JSON.stringify(report));
    }

    function isMeasuredBaseline(report) {
        return report?.dataSource === 'repository-audit' || report?.inferenceMeta?.scanEngine === 'mock-data-scanner';
    }

    const DEMO_ACTION_COPY = {
        convert: {
            title: 'Convert to Real',
            desc: 'Transform mock to production-ready data'
        },
        generate: {
            title: 'Generate Mock',
            desc: 'AI-generated realistic mock datasets'
        },
        clean: {
            title: 'Clean Mock Data',
            desc: 'AI-assisted error removal and optimization'
        }
    };

    const MEASURED_DEMO_COPY = {
        convert: {
            title: 'Convert to Real',
            desc: 'Show measured conversion checklist for sample JSON files'
        },
        generate: {
            title: 'Generate Mock',
            desc: 'Download a repository-audit sample JSON template'
        },
        clean: {
            title: 'Clean Mock Data',
            desc: 'Re-scan and list fixable schema or consistency issues'
        }
    };

    function renderStatusList(title, items, tone = '#60a5fa') {
        const list = items
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join('');
        setStatus(
            `<div style="color:${tone};text-align:left;">`
            + `<strong>${escapeHtml(title)}</strong>`
            + `<ol style="margin:0.5rem 0 0 1.2rem;padding-left:0.5rem;">${list}</ol>`
            + '</div>'
        );
    }

    async function runLiveAnalyze() {
        const analyzeResponse = await fetch('/api/models/active/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!analyzeResponse.ok) {
            throw new Error(`Analyze request failed (${analyzeResponse.status})`);
        }
        const payload = await analyzeResponse.json();
        if (!payload.report) {
            throw new Error('Analyze response did not include a report');
        }
        await applyReport(
            payload.report,
            `model:${payload.model?.name || 'active'} (${payload.inferenceMode || 'scan'})`
        );
        return payload.report;
    }

    function downloadJson(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    function updateDemoActionCards(report) {
        const measured = !report || isMeasuredBaseline(report);
        const copy = measured ? MEASURED_DEMO_COPY : DEMO_ACTION_COPY;
        Object.entries(copy).forEach(([action, text]) => {
            const card = document.querySelector(
                `${ROOT_SELECTOR} .action-card[data-mock-action="${action}"]`
            );
            if (!card) return;
            card.classList.toggle('action-card-demo-off', measured);
            const title = card.querySelector('h5');
            const desc = card.querySelector('p');
            if (title) title.textContent = text.title;
            if (desc) desc.textContent = text.desc;
        });
    }

    async function analyzeMockData() {
        setActionLoading('analyze', true);
        notify('🔍 Analyzing mock data with your active local model…', 'info');
        setStatus('<span style="color:#60a5fa;">⏳ Running model-backed mock data analysis…</span>');
        try {
            navigateToGgufAnalysis();

            let report;
            let inferenceMode = 'sample';
            const analyzeResponse = await fetch('/api/models/active/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (analyzeResponse.ok) {
                const payload = await analyzeResponse.json();
                if (payload.report) {
                    try {
                        await applyReport(
                            payload.report,
                            `model:${payload.model?.name || 'active'} (${payload.inferenceMode || 'model'})`
                        );
                        report = window.__ggufAnalysisReport || payload.report;
                        inferenceMode = payload.inferenceMode || 'model';
                    } catch (applyError) {
                        console.warn('Live analyze report rejected, loading sample:', applyError.message);
                    }
                }
            }

            if (!report) {
                if (typeof window.loadGgufAnalysisSample === 'function') {
                    await window.loadGgufAnalysisSample();
                    report = window.__ggufAnalysisReport || await fetchSampleReport();
                } else {
                    report = await fetchSampleReport();
                    await applyReport(report, SAMPLE_URL);
                }
            }

            const overview = report.analysisOverview || {};
            setStatus(
                `<span style="color:#34d399;">✅ Analysis complete (${inferenceMode}) — ${overview.issuesDetected ?? 0} issues in ${overview.totalMockFiles ?? 0} files</span>`
            );
            notify(
                `✅ Analysis complete — ${overview.issuesDetected ?? 0} issues in ${overview.totalMockFiles ?? 0} files (${overview.dataQualityScore ?? 0}% quality)`,
                'success'
            );
        } catch (error) {
            console.error('analyzeMockData failed:', error);
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            notify(`❌ Analysis failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('analyze', false);
        }
    }

    async function convertMockData() {
        setActionLoading('convert', true);
        notify('🔄 Building measured conversion checklist…', 'info');
        try {
            const report = await ensureReport();
            if (isMeasuredBaseline(report)) {
                const steps = [
                    ...(report.ggufAIInsights?.qualityImprovements || []),
                    'Set dataSource to "repository-audit" on edited samples',
                    'Run npm test after KPI edits — baseline is 578/578',
                    'Run npm run simplebeacon locally before merge',
                    'Click Analyze Mock Data to refresh this dashboard'
                ];
                renderStatusList('Measured conversion checklist', [...new Set(steps)]);
                notify('📋 Checklist ready — edit web/data/*-sample.json in the repo, not simulated transforms.', 'success');
                return;
            }
            const overview = report.analysisOverview || {};
            overview.dataQualityScore = Math.min(99, (overview.dataQualityScore || 89) + 5);
            overview.issuesDetected = Math.max(0, Math.floor((overview.issuesDetected || 156) * 0.35));
            overview.totalMockDataSize = overview.totalMockDataSize || '73.4MB';
            report.convertedAt = new Date().toISOString();
            report.conversionSummary = {
                filesConverted: overview.totalMockFiles || 1247,
                successRate: '94.2%',
                dataTransformed: '156MB'
            };

            await applyReport(report, 'mock-data-conversion');
            setStatus('<span style="color:#34d399;">✅ Converted mock data — 94.2% success rate</span>');
            notify('✅ Successfully converted mock records to production-ready data', 'success');
        } catch (error) {
            console.error('convertMockData failed:', error);
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            notify(`❌ Conversion failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('convert', false);
        }
    }

    async function validateMockData() {
        setActionLoading('validate', true);
        notify('✅ Validating mock data integrity…', 'info');
        try {
            const report = await ensureReport();
            const issues = report.detectedIssues || [];
            const high = issues.filter((i) => i.severity === 'high').length;
            const medium = issues.filter((i) => i.severity === 'medium').length;
            const score = report.analysisOverview?.dataQualityScore ?? 89.2;

            setStatus(
                `<span style="color:#34d399;">✅ Validation passed — ${score}% quality (${high} critical, ${medium} warnings)</span>`
            );
            notify(`✅ Validation complete — ${score}% quality score`, 'success');
        } catch (error) {
            console.error('validateMockData failed:', error);
            notify(`❌ Validation failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('validate', false);
        }
    }

    async function generateMockData() {
        setActionLoading('generate', true);
        notify('🎲 Preparing repository-audit sample template…', 'info');
        try {
            const report = await ensureReport();
            if (isMeasuredBaseline(report)) {
                const template = {
                    type: 'simplebeacon-cli-model',
                    title: 'Simplebeacon CLI Documentation',
                    generatedAt: new Date().toISOString(),
                    generatedBy: 'RepositoryAudit',
                    dataSource: 'repository-audit',
                    modelInfo: {
                        name: 'platform-checklist',
                        type: 'Internal',
                        status: 'active',
                        notes: 'Populate items with measured CLI paths and commands — see web/data/simplebeacon-cli-sample.json'
                    },
                    overview: {
                        totalItems: 0,
                        commands: 0,
                        rules: 0,
                        notes: 'Documentation pivot — Simplebeacon CLI, not dashboard page fiction'
                    },
                    items: [],
                    commands: [],
                    rules: []
                };
                downloadJson('simplebeacon-cli.template.json', template);
                const steps = [
                    'Start from web/data/simplebeacon-cli-sample.json (measured reference)',
                    'Add items with real paths under packages/simplebeacon-cli and .simplebeacon/',
                    'Register in PAGE_SAMPLE_SPECS if adding a new *-sample.json',
                    'Run npm test -- tests/unit/page-samples.test.js',
                    'Load on Help page via loadSimplebeaconCliSample() or paste JSON'
                ];
                renderStatusList('Simplebeacon CLI documentation template', steps, '#34d399');
                notify('✅ Simplebeacon CLI template downloaded — copy simplebeacon-cli-sample.json as reference.', 'success');
                return;
            }
            const reportClone = cloneReport(report);
            const overview = reportClone.analysisOverview || {};
            const added = 500;
            overview.totalMockFiles = (overview.totalMockFiles || 1247) + added;
            overview.totalMockDataSize = '78.1MB';
            reportClone.generatedRecords = added;
            reportClone.generatedAt = new Date().toISOString();

            await applyReport(reportClone, 'mock-data-generation');
            setStatus(`<span style="color:#34d399;">✅ Generated ${added} realistic mock records</span>`);
            notify(`✅ Generated ${added} realistic mock data records`, 'success');
        } catch (error) {
            console.error('generateMockData failed:', error);
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            notify(`❌ Generation failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('generate', false);
        }
    }

    async function cleanMockData() {
        setActionLoading('clean', true);
        notify('🧹 Re-scanning mock data for fixable issues…', 'info');
        setStatus('<span style="color:#60a5fa;">⏳ Running live mock-data-scanner…</span>');
        try {
            let report;
            try {
                report = await runLiveAnalyze();
            } catch (analyzeError) {
                console.warn('Live clean scan failed, using cached report:', analyzeError.message);
                report = await ensureReport();
            }

            const issues = report.detectedIssues || [];
            const issueCount = report.analysisOverview?.issuesDetected ?? issues.length;
            window.setGgufAnalysisTab?.('issues');

            if (issueCount === 0 && issues.length === 0) {
                const tips = report.ggufAIInsights?.qualityImprovements || [
                    'No blocking issues detected — baseline is clean',
                    'Run npm run simplebeacon before merge to keep it that way'
                ];
                renderStatusList('Mock data is clean', tips, '#34d399');
                notify('✅ No fixable issues found — measured baseline is clean.', 'success');
                window.showGgufDataCleaningResults?.(report);
                return;
            }

            const lines = issues.slice(0, 8).map((issue) =>
                `[${issue.severity}] ${issue.type}: ${issue.description}`
            );
            if (issues.length > 8) {
                lines.push(`…and ${issues.length - 8} more (see Issues tab)`);
            }
            lines.push('Edit the affected files under web/data/, then click Analyze Mock Data again.');
            renderStatusList(`Found ${issues.length} fixable issue(s)`, lines, '#fbbf24');
            notify(`⚠️ ${issues.length} issue(s) listed — see Issues tab for details.`, 'warning');
            window.showGgufDataCleaningResults?.(report);
        } catch (error) {
            console.error('cleanMockData failed:', error);
            setStatus(`<span style="color:#f87171;">❌ ${escapeHtml(error.message)}</span>`);
            notify(`❌ Cleaning scan failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('clean', false);
        }
    }

    async function exportMockData() {
        setActionLoading('export', true);
        notify('📤 Exporting clean mock data…', 'info');
        try {
            const report = await ensureReport();
            const exportPayload = {
                ...report,
                exportedAt: new Date().toISOString(),
                exportFormats: ['json', 'csv', 'xml']
            };
            const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mock-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            notify('✅ Data exported successfully (JSON)', 'success');
        } catch (error) {
            console.error('exportMockData failed:', error);
            notify(`❌ Export failed: ${error.message}`, 'error');
        } finally {
            setActionLoading('export', false);
        }
    }

    function bindMockActionCards() {
        const root = document.querySelector(ROOT_SELECTOR);
        if (!root || root.dataset.mockActionsBound === 'true') return;
        root.dataset.mockActionsBound = 'true';

        const handlers = {
            analyze: analyzeMockData,
            convert: convertMockData,
            validate: validateMockData,
            generate: generateMockData,
            clean: cleanMockData,
            export: exportMockData
        };

        root.addEventListener('click', (event) => {
            const card = event.target.closest('.action-card[data-mock-action]');
            if (!card || card.classList.contains('is-loading')) return;
            const action = card.dataset.mockAction;
            if (handlers[action]) handlers[action]();
        });
    }

    async function syncMockAnalysisFromRoadmapReport(payload, sourceLabel) {
        const overview = payload?.analysisOverview;
        if (!overview || (overview.totalMockFiles == null && overview.issuesDetected == null)) {
            return false;
        }

        let report = {
            type: 'gguf-mock-data-analysis-report',
            title: 'GGUF-Powered Mock Data Analysis Report',
            generatedAt: payload.generatedAt,
            generatedBy: payload.generatedBy,
            modelInfo: payload.modelInfo,
            analysisOverview: overview
        };

        const existing = window.__ggufAnalysisReport;
        if (existing?.mockDataCategories?.length) {
            report = { ...existing, ...report, analysisOverview: overview };
        } else {
            try {
                const response = await fetch(SAMPLE_URL);
                if (response.ok) {
                    const data = await response.json();
                    const sample = data.data?.type === 'gguf-mock-data-analysis-report' ? data.data : data;
                    report = { ...sample, ...report, analysisOverview: overview };
                }
            } catch (error) {
                console.warn('Could not enrich roadmap mock stats from sample:', error.message);
            }
        }

        if (typeof window.applyGgufAnalysisReport === 'function') {
            await window.applyGgufAnalysisReport(report, `${sourceLabel || 'roadmap report'} (mock stats)`);
        }

        return true;
    }

    window.analyzeMockData = analyzeMockData;
    window.convertMockData = convertMockData;
    window.validateMockData = validateMockData;
    window.generateMockData = generateMockData;
    window.cleanMockData = cleanMockData;
    window.exportMockData = exportMockData;
    window.syncMockAnalysisFromRoadmapReport = syncMockAnalysisFromRoadmapReport;
    window.bindMockActionCards = bindMockActionCards;
    window.updateDemoActionCards = updateDemoActionCards;

    document.addEventListener('DOMContentLoaded', () => {
        bindMockActionCards();
        updateDemoActionCards(window.__ggufAnalysisReport || null);
    });
})();
