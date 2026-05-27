/**
 * AI Roadmap Report Page — self-contained GGUF-powered roadmap dashboard
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ax';
    const SAMPLE_URL = `/data/ai-roadmap-sample.json?v=${SAMPLE_CACHE_BUST}`;

    function formatConfidencePercent(value) {
        if (value == null || value === '') return '—';
        return `${value}%`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeRoadmapSource(report) {
        if (!report || typeof report !== 'object') return report;
        const hasLegacyPhases = Array.isArray(report.phases) && report.phases.length > 0;
        const missingDevelopmentPhases = !Array.isArray(report.developmentPhases) || report.developmentPhases.length === 0;
        const needsLegacyNormalize = report.type === 'gguf-development-roadmap-report'
            || (hasLegacyPhases && missingDevelopmentPhases);

        if (needsLegacyNormalize && typeof window.RoadmapDataService === 'function') {
            return new window.RoadmapDataService().normalizeRoadmapData(report);
        }
        return report;
    }

    function buildProjectOverviewFromPhases(source) {
        const phases = source.developmentPhases || [];
        const useDerived = source.dataSource === 'repository-audit' || source.dataSource === 'live-analyze';

        if (!useDerived || !phases.length) {
            const overview = source.projectOverview || {};
            return {
                ...overview,
                completionRate: parseCompletionRate(overview.completionRate)
            };
        }

        const overview = source.projectOverview || {};
        if (source.dataSource === 'repository-audit'
            && overview.totalFeatures != null
            && overview.completedFeatures != null
            && overview.completionRate != null) {
            return {
                ...overview,
                completionRate: parseCompletionRate(overview.completionRate)
            };
        }

        let completed = 0;
        let inProgress = 0;
        let planned = 0;
        let weightedComplete = 0;
        phases.forEach((phase) => {
            const count = (phase.features || []).length || 1;
            const status = String(phase.status || '').toLowerCase();
            const progress = Math.min(100, Math.max(0, Number(phase.progress) || 0)) / 100;
            if (status === 'completed') {
                completed += count;
                weightedComplete += 1;
            } else if (status === 'in-progress' || status === 'current') {
                inProgress += count;
                weightedComplete += progress;
            } else {
                planned += count;
            }
        });
        const phaseUnits = phases.length || 1;
        const total = completed + inProgress + planned;
        const completionRate = Math.round((weightedComplete / phaseUnits) * 1000) / 10;

        return {
            ...overview,
            totalFeatures: overview.totalFeatures ?? total,
            completedFeatures: overview.completedFeatures ?? completed,
            inProgressFeatures: overview.inProgressFeatures ?? inProgress,
            plannedFeatures: overview.plannedFeatures ?? planned,
            completionRate: overview.completionRate != null
                ? parseCompletionRate(overview.completionRate)
                : completionRate
        };
    }

    function normalizeGgufReport(report) {
        const source = normalizeRoadmapSource(report);
        if (!source?.projectOverview || !Array.isArray(source.developmentPhases)) return null;
        const projectOverview = buildProjectOverviewFromPhases(source);
        return {
            type: source.type || 'ai-roadmap-report-model',
            title: source.title || 'GGUF Roadmap Report (Measured Baseline)',
            dataSource: source.dataSource || null,
            generatedAt: source.generatedAt || new Date().toISOString(),
            generatedBy: source.generatedBy || 'GGUF AI',
            modelInfo: source.modelInfo || {},
            projectOverview,
            developmentPhases: source.developmentPhases || [],
            predictions: source.predictions || [],
            risks: source.risks || [],
            recommendations: source.recommendations || { priority: [], optimization: [] },
            insights: source.insights || [],
            actionPlan: source.actionPlan || [],
            performanceMetrics: source.performanceMetrics || [],
            healthSummary: source.healthSummary || null,
            deprecatedNarrative: source.deprecatedNarrative || null
        };
    }

    function isRoadmapModel(payload) {
        if (payload?.type === 'gguf-development-roadmap-report') return true;
        if (Array.isArray(payload?.phases) && payload.phases.length && payload.metadata) return true;
        if (!payload?.projectOverview || !Array.isArray(payload.developmentPhases)) return false;
        if (/development roadmap report/i.test(payload.title || '')) return true;
        return Boolean(
            Array.isArray(payload.predictions)
            || Array.isArray(payload.risks)
            || Array.isArray(payload.actionPlan)
            || payload.recommendations
        );
    }

    function parseCompletionRate(value) {
        if (typeof value === 'number') return value;
        const match = String(value || '').match(/[\d.]+/);
        return match ? parseFloat(match[0]) : 0;
    }

    function normalizeModel(payload) {
        const raw = payload?.data && (isRoadmapModel(payload.data) || payload.data.type === 'gguf-development-roadmap-report')
            ? payload.data
            : payload;

        if (raw?.type === 'gguf-development-roadmap-report' || raw?.type === 'ai-roadmap-report-model') {
            const fromGguf = normalizeGgufReport(raw);
            if (fromGguf) return fromGguf;
        }

        if (raw?.type === 'dynamic-project-roadmap-analysis') {
            const fromScan = normalizeDynamicAnalysisReport(raw);
            if (fromScan) return fromScan;
        }

        if (isRoadmapModel(raw)) {
            return normalizeGgufReport(raw);
        }
        return null;
    }

    function _enrichMinimalModel(model) {
        return model;
    }

    function hasPageSampleProgressMarker(features) {
        return (features || []).some((f) => {
            const text = String(f);
            return text.includes('38/38') || text.includes('35/35') || text.includes('34/34');
        });
    }

    function normalizeDynamicAnalysisReport(raw) {
        if (raw?.type !== 'dynamic-project-roadmap-analysis') return null;
        const es = raw.executiveSummary || {};
        return normalizeGgufReport({
            ...raw,
            type: 'ai-roadmap-report-model',
            title: raw.projectTitle || raw.title || 'GGUF Roadmap Report (Path Scan)',
            dataSource: raw.dataSource || 'filesystem-scan',
            projectOverview: raw.projectOverview || {
                projectName: raw.projectName || raw.projectTitle,
                totalFeatures: es.totalFeatures,
                completedFeatures: es.completedFeatures,
                inProgressFeatures: es.inProgressFeatures,
                plannedFeatures: es.plannedFeatures,
                completionRate: es.completionRate,
                projectHealth: es.projectHealth,
                aiConfidence: es.aiConfidence
            },
            recommendations: Array.isArray(raw.recommendations?.priority)
                ? raw.recommendations
                : {
                    priority: (raw.recommendations?.priorities?.high || raw.recommendations?.immediate || []).map((item) => (
                        typeof item === 'string' ? { title: item, description: item } : item
                    )),
                    optimization: (raw.recommendations?.shortTerm || []).map((item) => (
                        typeof item === 'string' ? { title: item, description: item } : item
                    ))
                }
        });
    }

    function loadCachedGeneratorRoadmapModel() {
        try {
            const raw = sessionStorage.getItem('codeRoadmapGeneratorSnapshot');
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (Date.now() - cached.at > 60 * 60 * 1000) return null;
            const model = normalizeDynamicAnalysisReport(cached.roadmap)
                || normalizeModel(cached.roadmap);
            if (model && !isStaleAIRoadmapModel(model)) return model;
        } catch {
            /* ignore */
        }
        return null;
    }

    function isStaleAIRoadmapModel(model) {
        if (model?.generatedBy === 'code-roadmap-generator') return false;
        if (model?.roadmapExportProfile === 'filtered-v3.1') return false;
        if (model?.dataSource === 'repository-audit' || model?.dataSource === 'live-analyze') {
            const p = model?.projectOverview || {};
            const completion = parseCompletionRate(p.completionRate);
            const risks = model?.risks || [];
            const recs = model?.recommendations?.priority || [];
            const insights = model?.insights || [];
            const sprint3 = (model?.developmentPhases || []).find((phase) =>
                String(phase.phase || '').includes('Sprint 3')
            );

            if (sprint3?.progress === 60) return true;
            if ((sprint3?.milestones || []).includes('Remaining stub pages')) return true;
            if ((sprint3?.features || []).includes('Sample telemetry cleanup')
                && !(sprint3?.features || []).some((f) => String(f).includes('33/33'))) {
                return true;
            }
            if (completion === 50 || (p.completedFeatures === 4 && p.totalFeatures === 8)) return true;
            if (p.totalFeatures === 9 && (completion === 44.4 || completion === 44)) return true;
            if (p.completedFeatures === 4 && p.totalFeatures === 9) return true;
            if (Math.abs(completion - 44.4) < 0.1 && (model.performanceMetrics || []).some((m) =>
                String(m.trend || '').includes('5/8')
            )) {
                return true;
            }
            if (risks.some((risk) =>
                risk.title === 'Template Fiction in Cache'
                || risk.title === 'CI Coverage Gap'
                || (risk.title === 'Sample Telemetry Gap' && String(risk.description || '').includes('Several dashboard'))
            )) {
                return true;
            }
            if (sprint3?.progress === 75
                && !hasPageSampleProgressMarker(sprint3?.features)) {
                return true;
            }
            if (sprint3?.progress === 80
                && !hasPageSampleProgressMarker(sprint3?.features)) {
                return true;
            }
            if (p.totalFeatures === 8 && (completion === 62 || completion === 69)) return true;
            if ((model.performanceMetrics || []).some((metric) =>
                String(metric.value) === '502' || String(metric.value) === '533'
            )) {
                return true;
            }
            if ((model.healthSummary?.highlights || []).some((highlight) =>
                String(highlight).includes('502/502')
                || String(highlight).includes('533/533')
                || String(highlight).includes('33/33')
                || String(highlight).includes('36/36')
                || (String(highlight).includes('35/35') && !String(highlight).includes('38/38'))
            )) {
                return true;
            }
            if (recs.some((item) => String(item.title || '').includes('Finish Sample Telemetry Cleanup'))) {
                return true;
            }
            if (insights.some((item) => String(item.description || '').includes('50% completion = 4 of 8'))) {
                return true;
            }
            if ((model.actionPlan || []).some((step) => String(step.description || '').includes('498 Jest'))) {
                return true;
            }
            if ((model.predictions || []).some((prediction) =>
                (prediction.factors || []).some((factor) =>
                    String(factor.text || '').includes('agi-chatbot-test')
                )
            )) {
                return true;
            }
            if ((model.healthSummary?.highlights || []).some((highlight) =>
                String(highlight).includes('500/500')
            )) {
                return true;
            }
            if ((model.performanceMetrics || []).some((metric) =>
                String(metric.value) === '500'
                || String(metric.trend || '').includes('17 suites')
            )) {
                return true;
            }
            if ((model.developmentPhases || []).some((phase) =>
                (phase.features || []).some((feature) =>
                    String(feature).includes('500 Jest') && !String(feature).includes('502')
                )
            )) {
                return true;
            }
            return false;
        }

        const p = model?.projectOverview || {};
        const completion = parseCompletionRate(p.completionRate);

        if (model?.type === 'ai-powered-roadmap-report') return true;
        if (model?.generatedBy === 'AI Analysis Engine') return true;
        if (model?.generatedBy === 'RoadmapDataAnalyzer') return true;

        return p.totalFeatures === 47
            || p.completedFeatures === 31
            || completion === 66
            || (p.totalFeatures === 8 && (completion === 62 || completion === 69))
            || (p.completedFeatures === 5 && p.totalFeatures === 8)
            || p.projectHealth === 'Excellent'
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.generatedBy === 'Cascade AI Platform'
            || (model.healthSummary?.highlights || []).some((h) => String(h).includes('1,247'));
    }

    async function loadBaselineRoadmap() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) return null;
            const model = normalizeModel(await response.json());
            if (model && !isStaleAIRoadmapModel(model)) return model;
        } catch (error) {
            console.warn('AI roadmap baseline sample failed:', error.message);
        }
        return null;
    }

    function buildRoadmapModel(report, baseline, analyzePayload = {}) {
        const baselineModel = baseline || {
            developmentPhases: [],
            predictions: [],
            risks: [],
            recommendations: { priority: [], optimization: [] },
            insights: [],
            actionPlan: [],
            performanceMetrics: [],
            projectOverview: {},
            healthSummary: null
        };

        const quality = report?.qualityMetrics || {};
        const overview = report?.analysisOverview || {};
        const activeModel = analyzePayload.activeModel || {};
        const modelInfo = {
            ...(baselineModel.modelInfo || {}),
            ...(report?.modelInfo || {}),
            name: report?.modelInfo?.name || activeModel.name || baselineModel.modelInfo?.name,
            inferenceMode: report?.inferenceMeta?.mode || analyzePayload.inferenceMode || baselineModel.modelInfo?.inferenceMode
        };
        const schemaCompliance = Math.round(
            quality.schemaCompliance ?? quality.overallQuality ?? baselineModel.projectOverview?.completionRate ?? 67
        );
        const issueCount = overview.issuesDetected
            ?? (report?.detectedIssues || []).reduce((sum, item) => sum + (item.count || 1), 0);
        const scannedFiles = overview.filesAnalyzed
            ?? report?.inferenceMeta?.scannedFiles
            ?? analyzePayload.scanSummary?.totalFiles;

        const risksFromIssues = (report?.detectedIssues || []).slice(0, 4).map((issue, index) => ({
            title: issue.type || `Detected Issue ${index + 1}`,
            level: issue.severity === 'high' ? 'high' : issue.severity === 'medium' ? 'medium' : 'low',
            score: issue.severity === 'high' ? 70 : issue.severity === 'medium' ? 50 : 30,
            description: issue.description || issue.recommendedAction || 'Detected during mock data scan'
        }));

        return normalizeGgufReport({
            ...baselineModel,
            type: 'ai-roadmap-report-model',
            title: 'AI Roadmap Report (Live Analyze)',
            generatedAt: report?.generatedAt || new Date().toISOString(),
            generatedBy: report?.generatedBy || `Active model analyze (${modelInfo.name || 'local'})`,
            dataSource: 'live-analyze',
            modelInfo,
            projectOverview: {
                ...(baselineModel.projectOverview || {}),
                completionRate: schemaCompliance,
                projectHealth: schemaCompliance >= 80 ? 'Excellent' : schemaCompliance >= 65 ? 'Good' : 'Fair',
                aiConfidence: Math.min(95, Math.round(schemaCompliance * 0.9))
            },
            risks: risksFromIssues.length
                ? [...risksFromIssues, ...(baselineModel.risks || []).slice(0, 2)]
                : baselineModel.risks,
            performanceMetrics: [
                {
                    icon: '🔍',
                    value: String(scannedFiles ?? '—'),
                    label: 'Files Scanned',
                    trend: modelInfo.inferenceMode || 'filesystem',
                    trendType: 'neutral'
                },
                {
                    icon: '⚠️',
                    value: String(issueCount),
                    label: 'Issues Detected',
                    trend: 'from analyze',
                    trendType: issueCount > 50 ? 'negative' : 'neutral'
                },
                ...(baselineModel.performanceMetrics || []).slice(0, 2)
            ],
            healthSummary: {
                ...(baselineModel.healthSummary || {}),
                status: schemaCompliance >= 75 ? 'GOOD' : 'FAIR',
                assessment: `Merged live analyze output (${modelInfo.inferenceMode || 'filesystem'}) with repository baseline. Schema compliance: ${schemaCompliance}%.`
            },
            insights: [
                {
                    icon: '🤖',
                    title: 'Live Analyze Source',
                    description: `Roadmap KPIs updated from POST /api/models/active/analyze at ${new Date().toLocaleString()}.`
                },
                ...(baselineModel.insights || []).slice(0, 3)
            ]
        });
    }

    async function fetchRoadmapData() {
        const cachedGenerator = loadCachedGeneratorRoadmapModel();
        if (cachedGenerator) return cachedGenerator;

        const baseline = await loadBaselineRoadmap();
        if (baseline) return baseline;

        const apiSources = [
            '/api/ai-roadmap/report',
            '/api/development-roadmap/data'
        ];
        for (const url of apiSources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                const model = normalizeModel(payload?.data ? payload : payload);
                if (model && !isStaleAIRoadmapModel(model)) return model;
            } catch (error) {
                console.warn('AI roadmap source failed:', url, error.message);
            }
        }

        try {
            const analyzeResponse = await fetch('/api/models/active/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (analyzeResponse.ok) {
                const analyzePayload = await analyzeResponse.json();
                const report = analyzePayload.report || analyzePayload.data?.report;
                if (report?.analysisOverview || report?.detectedIssues?.length) {
                    const model = buildRoadmapModel(report, baseline, analyzePayload);
                    if (model && !isStaleAIRoadmapModel(model)) return model;
                }
            }
        } catch (error) {
            console.warn('Active model analyze for roadmap failed:', error.message);
        }

        return null;
    }

    function phaseStatusClass(status) {
        if (status === 'completed') return 'completed';
        if (status === 'in-progress') return 'in-progress';
        return 'planned';
    }

    function renderModel(model) {
        renderHeader(model);
        renderModelAssessment(model);
        renderPhases(model);
        renderPredictions(model);
        renderRisks(model);
        renderRecommendations(model);
        renderInsights(model);
        renderActionPlan(model);
        renderPerformanceMetrics(model);
        renderHealthSummary(model);
    }

    function renderHeader(model) {
        const p = model.projectOverview;
        const pageTitle = document.getElementById('ai-roadmap-page-title');
        const pageLead = document.getElementById('ai-roadmap-page-lead');
        if (pageTitle) pageTitle.textContent = model.title ? `🤖 ${model.title}` : '🤖 AI-Powered Roadmap Report';
        if (pageLead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Comprehensive AI-generated project insights and executive analysis';
            pageLead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — measured baseline, not live GGUF inference.`
                : base;
        }

        const badgeRow = document.querySelector('#ai-roadmap-root .ai-roadmap-badge-row');
        if (badgeRow && p) {
            const modelName = model.dataSource === 'repository-audit'
                ? 'platform-checklist'
                : (model.modelInfo?.name || 'GGUF AI');
            badgeRow.innerHTML = `
                <span class="badge bg-primary">📊 ${escapeHtml(p.projectName || 'Cascade AI Platform')}</span>
                <span class="badge bg-success">🤖 ${escapeHtml(modelName)}</span>
                <span class="badge bg-info">${p.totalFeatures ?? 0} Features</span>
                <span class="badge bg-warning">${model.developmentPhases?.length || 0} Phases</span>`;
        }

        const map = {
            'ai-roadmap-completion': `${p.completionRate}%`,
            'ai-roadmap-features': `${p.completedFeatures}/${p.totalFeatures}`,
            'ai-roadmap-health': p.projectHealth || '—',
            'ai-roadmap-confidence': formatConfidencePercent(model.modelInfo?.confidence ?? p.aiConfidence),
            'ai-roadmap-progress-bar': null,
            'ai-roadmap-progress-label': `${p.completionRate}% Complete`,
            'ai-roadmap-project-name': p.projectName || 'AI Platform'
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (!el || value === null) return;
            el.textContent = value;
        });
        const bar = document.getElementById('ai-roadmap-progress-bar');
        if (bar) bar.style.width = `${p.completionRate}%`;
    }

    function renderModelAssessment(model) {
        const panel = document.getElementById('ai-roadmap-model-panel');
        const container = document.getElementById('ai-roadmap-model-info');
        const info = model.modelInfo;
        if (!panel || !container || !info) return;
        panel.removeAttribute('hidden');
        container.innerHTML = `
            <div class="ai-roadmap-model-card">
                <div><strong>Model</strong><p>${escapeHtml(info.name)} (${escapeHtml(info.type || 'GGUF')})</p></div>
                <div><strong>Size</strong><p>${escapeHtml(info.size || '—')}</p></div>
                <div><strong>Confidence</strong><p>${formatConfidencePercent(info.confidence ?? model.projectOverview?.aiConfidence)}</p></div>
                <div><strong>Status</strong><p>${escapeHtml(info.status || 'active')}</p></div>
            </div>`;
    }

    function renderHealthSummary(model) {
        const panel = document.getElementById('ai-roadmap-health-panel');
        const container = document.getElementById('ai-roadmap-health-summary');
        if (!panel || !container || !model.healthSummary) {
            panel?.setAttribute('hidden', '');
            return;
        }
        panel.removeAttribute('hidden');
        const summary = model.healthSummary;
        container.innerHTML = `
            <div class="ai-roadmap-health-status">${escapeHtml(summary.status || 'GOOD')}</div>
            <p class="ai-roadmap-health-assessment">${escapeHtml(summary.assessment || '')}</p>
            <ul class="ai-roadmap-health-list">${(summary.highlights || []).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`;
    }

    function renderPhases(model) {
        const container = document.getElementById('ai-roadmap-phases');
        if (!container) return;
        container.innerHTML = model.developmentPhases.map(phase => `
            <div class="ai-roadmap-phase-card ${phaseStatusClass(phase.status)}">
                <div class="ai-roadmap-phase-top">
                    <h4>${escapeHtml(phase.phase)}</h4>
                    <span class="ai-roadmap-status-badge ${phaseStatusClass(phase.status)}">${escapeHtml((phase.status || '').replace('-', ' '))}</span>
                </div>
                <div class="ai-roadmap-phase-progress"><span style="width:${phase.progress || 0}%"></span></div>
                <div class="ai-roadmap-phase-meta">${phase.progress || 0}% · ${escapeHtml(phase.startDate || '')} → ${escapeHtml(phase.endDate || '')}</div>
                <p>${escapeHtml(phase.description || '')}</p>
                <div class="ai-roadmap-feature-tags">${(phase.features || []).map(f => `<span>${escapeHtml(f)}</span>`).join('')}</div>
                <ul class="ai-roadmap-milestones">${(phase.milestones || []).map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
            </div>
        `).join('');
    }

    function renderPredictions(model) {
        const container = document.getElementById('ai-roadmap-predictions');
        if (!container) return;
        container.innerHTML = model.predictions.map(item => `
            <div class="ai-roadmap-prediction-card">
                <div class="ai-roadmap-prediction-top">
                    <span class="ai-roadmap-prediction-icon">${escapeHtml(item.icon || '🔮')}</span>
                    <div>
                        <h4>${escapeHtml(item.title)}</h4>
                        <span class="ai-roadmap-confidence-chip">${item.confidence}% Confidence</span>
                    </div>
                </div>
                <p>${escapeHtml(item.summary)}</p>
                <div class="ai-roadmap-factor-row">${(item.factors || []).map(f => `<span class="factor ${escapeHtml(f.type)}">${escapeHtml(f.text)}</span>`).join('')}</div>
            </div>
        `).join('');
    }

    function renderRisks(model) {
        const container = document.getElementById('ai-roadmap-risks');
        if (!container) return;
        container.innerHTML = model.risks.map(risk => `
            <div class="ai-roadmap-risk-item ${escapeHtml(risk.level)}">
                <div class="ai-roadmap-risk-top">
                    <span>${escapeHtml(risk.title)}</span>
                    <span class="ai-roadmap-status-badge ${escapeHtml(risk.level)}">${escapeHtml(risk.level)}</span>
                </div>
                <div class="ai-roadmap-risk-bar"><span style="width:${risk.score || 0}%"></span></div>
                <p>${escapeHtml(risk.description)}</p>
            </div>
        `).join('');
    }

    function renderRecommendationList(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = items.map(item => `
            <div class="ai-roadmap-rec-card">
                <div class="ai-roadmap-rec-top">
                    <h4>${escapeHtml(item.title)}</h4>
                    <span>${escapeHtml(item.impact)}</span>
                </div>
                <p>${escapeHtml(item.description)}</p>
                <div class="ai-roadmap-rec-benefits">${(item.benefits || []).map(b => `<span>${escapeHtml(b)}</span>`).join('')}</div>
            </div>
        `).join('');
    }

    function renderRecommendations(model) {
        renderRecommendationList(model.recommendations.priority || [], 'ai-roadmap-rec-priority');
        renderRecommendationList(model.recommendations.optimization || [], 'ai-roadmap-rec-optimization');
    }

    function renderInsights(model) {
        const container = document.getElementById('ai-roadmap-insights');
        if (!container) return;
        container.innerHTML = model.insights.map(item => `
            <div class="ai-roadmap-insight-card">
                <span class="ai-roadmap-insight-icon">${escapeHtml(item.icon || '💡')}</span>
                <div>
                    <h5>${escapeHtml(item.title)}</h5>
                    <p>${escapeHtml(item.description)}</p>
                </div>
            </div>
        `).join('');
    }

    function actionStepStatusClass(status) {
        const normalized = String(status || 'upcoming').toLowerCase();
        if (normalized === 'completed') return 'completed';
        if (normalized === 'current' || normalized === 'in-progress') return 'current';
        return 'upcoming';
    }

    function renderActionPlan(model) {
        const container = document.getElementById('ai-roadmap-action-plan');
        if (!container) return;
        container.innerHTML = model.actionPlan.map(step => `
            <div class="ai-roadmap-action-step ${actionStepStatusClass(step.status)}">
                <div class="ai-roadmap-step-num">${step.step}</div>
                <div class="ai-roadmap-step-body">
                    <h4>${escapeHtml(step.title)}</h4>
                    <p>${escapeHtml(step.description)}</p>
                    <div class="ai-roadmap-step-timeline">${escapeHtml(step.timeline || '')}</div>
                    ${step.progress != null ? `<div class="ai-roadmap-phase-progress"><span style="width:${step.progress}%"></span></div>` : ''}
                </div>
            </div>
        `).join('');
    }

    function renderPerformanceMetrics(model) {
        const container = document.getElementById('ai-roadmap-performance');
        if (!container) return;
        container.innerHTML = model.performanceMetrics.map(metric => `
            <div class="stat-card ${metric.trendType === 'positive' ? 'success' : ''}">
                <div class="stat-value">${escapeHtml(metric.icon)} ${escapeHtml(metric.value)}</div>
                <div class="stat-label">${escapeHtml(metric.label)}</div>
                <div class="ai-roadmap-metric-trend ${escapeHtml(metric.trendType || 'neutral')}">${escapeHtml(metric.trend || '')}</div>
            </div>
        `).join('');
    }

    function bindActions() {
        if (window.__aiRoadmapBound) return;
        window.__aiRoadmapBound = true;

        document.getElementById('ai-roadmap-load-sample')?.addEventListener('click', () => loadAIRoadmapSample());
        document.getElementById('ai-roadmap-import-json')?.addEventListener('click', () => document.getElementById('ai-roadmap-import-file')?.click());
        document.getElementById('ai-roadmap-export-report')?.addEventListener('click', () => {
            const model = window.__aiRoadmapModel;
            if (!model) return;
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-roadmap-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ AI roadmap report downloaded', 'success');
        });
        document.getElementById('ai-roadmap-refresh-data')?.addEventListener('click', async () => {
            await initializeAIRoadmapPage(true);
        });
        document.getElementById('ai-roadmap-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyAIRoadmapModel(JSON.parse(await file.text()), file.name);
                window.showNotification?.('✅ AI roadmap data imported', 'success');
            } catch {
                window.showNotification?.('❌ Invalid AI roadmap JSON', 'error');
            } finally {
                event.target.value = '';
            }
        });
    }

    function applyAIRoadmapModel(payload, sourceLabel, options = {}) {
        const { navigate = true, syncMock = true, syncRoadmap = true } = options;
        const model = normalizeModel(payload);
        if (!model) throw new Error('Unrecognized AI roadmap payload');
        if (isStaleAIRoadmapModel(model)) {
            throw new Error('Stale AI roadmap fiction rejected — load repository-audit sample');
        }
        window.__aiRoadmapModel = model;
        renderModel(model);
        bindActions();

        if (navigate && typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'ai-roadmap'\"]");
            const sectionEl = document.getElementById('ai-roadmap-section');
            if (!sectionEl?.classList.contains('active')) {
                window.showSection('ai-roadmap', navLink);
            }
        }

        if (syncRoadmap && model.developmentPhases?.length) {
            const syncPayload = typeof window.RoadmapDataService === 'function'
                ? new window.RoadmapDataService().normalizeRoadmapData({ ...payload, ...model })
                : model;
            queueMicrotask(() => {
                if (typeof window.applyGeneratedRoadmapToDashboard !== 'function') return;
                try {
                    window.applyGeneratedRoadmapToDashboard(syncPayload, sourceLabel || 'AI Roadmap Report');
                } catch (error) {
                    console.warn('Development roadmap sync failed:', error);
                }
            });
        }

        if (syncMock && typeof window.syncMockAnalysisFromRoadmapReport === 'function' && payload?.analysisOverview) {
            window.syncMockAnalysisFromRoadmapReport(payload, sourceLabel).catch((error) => {
                console.warn('Embedded mock analysis sync failed:', error);
            });
        }

        try {
            localStorage.setItem('lastAIRoadmapModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported roadmap',
                savedAt: new Date().toISOString()
            }));
        } catch (error) {
            /* ignore storage errors */
        }
    }

    function restoreSavedAIRoadmapModel() {
        try {
            const raw = localStorage.getItem('lastAIRoadmapModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.developmentPhases?.length || isStaleAIRoadmapModel(model)) {
                localStorage.removeItem('lastAIRoadmapModel');
                return false;
            }
            window.__aiRoadmapModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch (error) {
            return false;
        }
    }

    async function loadAIRoadmapSample() {
        const root = document.getElementById('ai-roadmap-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyAIRoadmapModel(await response.json(), 'ai-roadmap-sample.json');
            window.showNotification?.('✅ Loaded AI roadmap sample', 'success');
        } catch (error) {
            console.error('Failed to load AI roadmap sample:', error);
            window.showNotification?.('❌ Failed to load AI roadmap sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeAIRoadmapPage(forceRefresh = false) {
        const root = document.getElementById('ai-roadmap-root');
        if (!root) return;

        if (window.__aiRoadmapModel && !forceRefresh) {
            if (isStaleAIRoadmapModel(window.__aiRoadmapModel)) {
                window.__aiRoadmapModel = null;
                try { localStorage.removeItem('lastAIRoadmapModel'); } catch { /* ignore */ }
            } else {
                renderModel(window.__aiRoadmapModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            window.__aiRoadmapModel = null;
            try {
                localStorage.removeItem('lastAIRoadmapModel');
            } catch (e) {
                /* ignore */
            }
        } else {
            const baseline = await loadBaselineRoadmap();
            const cachedGenerator = loadCachedGeneratorRoadmapModel();
            if (cachedGenerator) {
                window.__aiRoadmapModel = cachedGenerator;
                renderModel(cachedGenerator);
                bindActions();
                return;
            }
            if (baseline) {
                window.__aiRoadmapModel = baseline;
                renderModel(baseline);
                bindActions();
                return;
            }
        }

        if (!forceRefresh && restoreSavedAIRoadmapModel()) {
            return;
        }

        root.classList.add('loading');
        try {
            const model = await fetchRoadmapData();
            if (!model) {
                await loadAIRoadmapSample();
                return;
            }
            window.__aiRoadmapModel = model;
            renderModel(model);
            bindActions();
        } catch (error) {
            console.error('Failed to initialize AI roadmap page:', error);
            try {
                await loadAIRoadmapSample();
            } catch {
                window.showNotification?.('❌ Failed to load AI roadmap data', 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeAIRoadmapPage = initializeAIRoadmapPage;
    window.loadAIRoadmapSample = loadAIRoadmapSample;
    window.applyAIRoadmapModel = applyAIRoadmapModel;
    window.applyGgufDevelopmentRoadmapReport = applyAIRoadmapModel;
})();
