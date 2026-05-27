/**
 * GGUF AI Analysis Page — self-contained mock data analysis dashboard
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524be';
    const SAMPLE_URL = `/data/gguf-mock-analysis-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let activeTab = 'overview';
    let searchQuery = '';
    let severityFilter = 'all';
    let cachedActiveModel = null;

    async function loadActiveModelInfo() {
        if (typeof window.fetchActiveModelInfo === 'function') {
            cachedActiveModel = await window.fetchActiveModelInfo();
        }
        return cachedActiveModel;
    }

    function mergeActiveModelIntoReport(report) {
        if (report?.dataSource === 'repository-audit') return report;
        if (!cachedActiveModel || !report) return report;
        return {
            ...report,
            modelInfo: {
                ...report.modelInfo,
                name: cachedActiveModel.name || report.modelInfo?.name,
                type: cachedActiveModel.type || report.modelInfo?.type,
                size: cachedActiveModel.size || report.modelInfo?.size,
                confidence: cachedActiveModel.confidence ?? report.modelInfo?.confidence,
                hash: cachedActiveModel.hash || report.modelInfo?.hash,
                status: cachedActiveModel.status || report.modelInfo?.status,
                provider: cachedActiveModel.provider,
                isDemo: cachedActiveModel.isDemo
            },
            generatedBy: cachedActiveModel.isDemo
                ? report.generatedBy
                : `Local model (${cachedActiveModel.provider}): ${cachedActiveModel.name}`
        };
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function severityClass(severity) {
        if (severity === 'high') return 'high';
        if (severity === 'medium') return 'medium';
        return 'low';
    }

    function isGgufReport(payload) {
        return Boolean(
            payload
            && (payload.type === 'gguf-mock-data-analysis-report' || payload.analysisOverview?.issuesDetected != null)
        );
    }

    function normalizeReport(payload) {
        if (!payload || typeof payload !== 'object') return null;
        if (payload.data && isGgufReport(payload.data)) return reconcileReport(payload.data);
        if (isGgufReport(payload)) return reconcileReport(payload);
        return null;
    }

    function reconcileReport(report) {
        if (!report?.analysisOverview) return report;
        const overview = { ...report.analysisOverview };
        const detected = report.detectedIssues || [];
        if (overview.issuesDetected == null) {
            overview.issuesDetected = detected.reduce((sum, issue) => sum + (issue.count || 0), 0) || detected.length;
        }
        return {
            ...report,
            dataSource: report.dataSource || null,
            analysisOverview: overview,
            deprecatedNarrative: report.deprecatedNarrative || null
        };
    }

    function hasFictionDataPatterns(report) {
        const patterns = report?.ggufAIInsights?.dataPatterns || [];
        const fictionMarkers = [
            'User authentication flows with session management',
            'API response structures following REST conventions',
            'Analytics metrics with time-series data patterns',
            'Configuration objects with environment-specific settings',
            'Test scenarios covering edge cases and boundary conditions'
        ];
        return patterns.some((pattern) =>
            fictionMarkers.some((marker) => String(pattern).includes(marker))
        );
    }

    function isStaleGgufReport(report) {
        if (report?.dataSource === 'repository-audit') {
            const overview = report?.analysisOverview || {};
            const recs = report?.ggufAIInsights?.optimizationRecommendations || [];
            const hasOpenStaleRec = recs.some((item) => {
                const action = String(item.action || '');
                const desc = String(item.description || '');
                const impact = String(item.impact || '').toLowerCase();
                if (impact === 'complete' || /closed|wired|resolved/i.test(action)) return false;
                return action.includes('Wire npm audit') || desc.includes('not surfaced yet');
            });
            if (hasOpenStaleRec) return true;
            if (overview.totalMockFiles === 35 && overview.issuesDetected === 0) return true;
            if (overview.totalMockDataSize === '212.7KB') return true;
            if ((report.detectedIssues || []).some((issue) =>
                issue.type === 'Jest Count Mismatch'
                && /expected 545\/545|expected 558\/558|sync sample KPIs to 545/i.test(String(issue.description || issue.recommendedAction || ''))
            )) {
                return true;
            }
            if (report.qualityMetrics?.crossSampleConsistency === 33
                && (report.detectedIssues || []).some((issue) => issue.type === 'Jest Count Mismatch')) {
                return true;
            }
            return false;
        }
        if (report?.inferenceMeta?.scanEngine === 'mock-data-scanner'
            && Number(report?.inferenceMeta?.scannedFiles) >= 36
            && Number(report?.analysisOverview?.issuesDetected) === 0) {
            return false;
        }
        const overview = report?.analysisOverview || {};
        if (hasFictionDataPatterns(report)) return true;
        return overview.totalMockFiles === 1247
            || overview.issuesDetected === 156
            || overview.dataQualityScore === 89.2
            || report.modelInfo?.name === 'unbreakable-oracle'
            || report.modelInfo?.confidence === 98.5
            || (report.generatedBy || '').includes('unbreakable-oracle')
            || (report.detectedIssues || []).some((issue) =>
                (issue.affectedFiles || []).some((file) => /^mock_data_\d+\.json$/.test(file))
            );
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    function isRepositoryAuditReport(report) {
        return report?.dataSource === 'repository-audit';
    }

    function hasLiveScan(report) {
        return report?.inferenceMeta?.scannedFiles != null
            || Boolean(report?.inferenceMeta?.scanEngine)
            || Boolean(report?.inferenceMeta?.scanPaths?.length);
    }

    function isCleanLiveScan(report) {
        return hasLiveScan(report) && (report.analysisOverview?.issuesDetected ?? 0) === 0;
    }

    function isPartialReport(report) {
        const needsIssueRows = !isCleanLiveScan(report) && !report.detectedIssues?.length;
        const needsQuality = !report.qualityMetrics?.measuredFromScan && !report.qualityMetrics?.overallQuality;
        return !report.mockDataCategories?.length
            || needsIssueRows
            || needsQuality
            || !report.ggufAIInsights;
    }

    async function enrichPartialReport(report) {
        if (isRepositoryAuditReport(report) && report.mockDataCategories?.length && report.detectedIssues?.length) {
            return report;
        }
        if (!isPartialReport(report)) return report;
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) return report;
            const sample = normalizeReport(await response.json());
            if (!sample) return report;
            const keepScanIssues = hasLiveScan(report);
            return {
                ...sample,
                ...report,
                type: report.type || sample.type,
                title: report.title || sample.title,
                generatedAt: report.generatedAt || sample.generatedAt,
                generatedBy: report.generatedBy || sample.generatedBy,
                modelInfo: { ...sample.modelInfo, ...report.modelInfo },
                analysisOverview: { ...sample.analysisOverview, ...report.analysisOverview },
                mockDataCategories: report.mockDataCategories?.length ? report.mockDataCategories : sample.mockDataCategories,
                detectedIssues: keepScanIssues
                    ? (report.detectedIssues || [])
                    : (report.detectedIssues?.length ? report.detectedIssues : sample.detectedIssues),
                qualityMetrics: hasLiveScan(report)
                    ? report.qualityMetrics
                    : (report.qualityMetrics || sample.qualityMetrics),
                ggufAIInsights: report.ggufAIInsights || sample.ggufAIInsights,
                performanceMetrics: report.performanceMetrics || sample.performanceMetrics,
                nextSteps: report.nextSteps?.length ? report.nextSteps : sample.nextSteps,
                privacyAndSecurity: report.privacyAndSecurity || sample.privacyAndSecurity
            };
        } catch (error) {
            console.warn('Could not enrich partial GGUF report:', error.message);
            return report;
        }
    }

    function restoreSavedGgufReport() {
        try {
            const raw = localStorage.getItem('lastGgufAnalysisReport');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const report = normalizeReport(saved.report || saved);
            if (!report || isStaleGgufReport(report)) {
                localStorage.removeItem('lastGgufAnalysisReport');
                return false;
            }
            window.__ggufAnalysisReport = report;
            renderReport(report);
            bindActions();
        if (typeof window.bindMockActionCards === 'function') {
            window.bindMockActionCards();
        }
            const status = document.getElementById('gguf-source-label');
            if (status && saved.sourceLabel) status.textContent = `Source: ${saved.sourceLabel}`;
            return true;
        } catch (error) {
            return false;
        }
    }

    async function fetchReportData() {
        const sources = [
            SAMPLE_URL,
            '/api/gguf/analysis',
            '/api/gguf/mock-analysis-report',
            '/data/gguf-mock-analysis-sample.json'
        ];

        for (const url of sources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                const report = normalizeReport(payload);
                if (report && !isStaleGgufReport(report)) return report;
            } catch (error) {
                console.warn('GGUF analysis source failed:', url, error.message);
            }
        }

        try {
            const response = await fetch('/api/models/active/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (response.ok) {
                const payload = await response.json();
                if (payload.report) {
                    const report = normalizeReport(payload.report);
                    if (report && !isStaleGgufReport(report)) return report;
                }
            }
        } catch (error) {
            console.warn('Active model analyze failed, falling back:', error.message);
        }

        return null;
    }

    function filteredIssues(report) {
        const issues = report.detectedIssues || [];
        return issues.filter((issue) => {
            const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
            const haystack = `${issue.type} ${issue.description} ${(issue.affectedFiles || []).join(' ')}`.toLowerCase();
            const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
            return matchesSeverity && matchesSearch;
        });
    }

    function renderReport(report) {
        const merged = mergeActiveModelIntoReport(report);
        renderHeader(merged);
        renderStats(merged);
        renderActiveTab(merged);
        updateMeta(merged);
        window.updateDemoActionCards?.(merged);
    }

    function renderHeader(report) {
        const overview = report.analysisOverview || {};
        const model = report.modelInfo || {};
        const useAudit = isRepositoryAuditReport(report);
        const titleEl = document.getElementById('gguf-report-title');
        const subtitleEl = document.getElementById('gguf-report-subtitle');
        const badgeRow = document.getElementById('gguf-badge-row');

        if (titleEl) {
            titleEl.textContent = report.title || (useAudit
                ? 'Mock Data Analysis (Measured Baseline)'
                : 'GGUF-Powered Mock Data Analysis');
        }
        if (subtitleEl) {
            const base = `Generated by ${report.generatedBy || model.name || 'GGUF AI'} • ${new Date(report.generatedAt || Date.now()).toLocaleString()}`;
            subtitleEl.textContent = useAudit
                ? `${base} — mock-data-scanner filesystem audit, not 1,247-file fiction.`
                : base;
        }
        if (badgeRow) {
            if (useAudit) {
                badgeRow.innerHTML = `
                    <span class="gguf-badge model">🛡️ ${escapeHtml(model.name || 'platform-checklist')}</span>
                    <span class="gguf-badge active">● ${escapeHtml(model.status || 'active')}</span>
                    <span class="gguf-badge issues">⚠ ${(overview.issuesDetected || 0).toLocaleString()} issues</span>
                    <span class="gguf-badge confidence">${formatMetric(overview.schemaPassRate, '%')} schema pass</span>
                `;
            } else {
                const providerNote = model.provider && model.provider !== 'demo'
                    ? `<span class="gguf-badge">🔌 ${escapeHtml(model.provider)}</span>`
                    : '';
                badgeRow.innerHTML = `
                    <span class="gguf-badge model">🧠 ${escapeHtml(model.name || 'unbreakable-oracle')}</span>
                    <span class="gguf-badge active">● ${escapeHtml(model.status || 'active')}</span>
                    ${providerNote}
                    <span class="gguf-badge issues">⚠ ${(overview.issuesDetected || 0).toLocaleString()} issues</span>
                    <span class="gguf-badge confidence">${(overview.aiConfidence || model.confidence || 98)}% confidence</span>
                `;
            }
        }
    }

    function renderStats(report) {
        const overview = report.analysisOverview || {};
        const useAudit = isRepositoryAuditReport(report);
        const labelMap = useAudit
            ? {
                'gguf-stat-files': 'Scanned Files',
                'gguf-stat-quality': 'Data Quality',
                'gguf-stat-issues': 'Issues Detected',
                'gguf-stat-confidence': 'Schema Pass'
            }
            : {
                'gguf-stat-files': 'Mock Files',
                'gguf-stat-quality': 'Data Quality',
                'gguf-stat-issues': 'Issues Detected',
                'gguf-stat-confidence': 'AI Confidence'
            };

        Object.entries(labelMap).forEach(([id, label]) => {
            const card = document.getElementById(id)?.closest('.stat-card');
            const labelEl = card?.querySelector('.stat-label');
            if (labelEl) labelEl.textContent = label;
        });

        const map = useAudit
            ? {
                'gguf-stat-files': `${(overview.totalMockFiles || 0).toLocaleString()}`,
                'gguf-stat-quality': `${overview.dataQualityScore ?? 0}%`,
                'gguf-stat-issues': `${(overview.issuesDetected || 0).toLocaleString()}`,
                'gguf-stat-confidence': formatMetric(overview.schemaPassRate, '%')
            }
            : {
                'gguf-stat-files': `${(overview.totalMockFiles || 0).toLocaleString()}`,
                'gguf-stat-quality': `${overview.dataQualityScore ?? 0}%`,
                'gguf-stat-issues': `${(overview.issuesDetected || 0).toLocaleString()}`,
                'gguf-stat-confidence': `${overview.aiConfidence || report.modelInfo?.confidence || 98}%`
            };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function updateMeta(report) {
        const el = document.getElementById('gguf-last-update');
        if (el) {
            el.textContent = `Updated ${new Date(report.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
    }

    function renderActiveTab(report) {
        const panels = {
            overview: () => renderOverview(report),
            issues: () => renderIssues(report),
            recommendations: () => renderRecommendations(report),
            quality: () => renderQuality(report)
        };
        panels[activeTab]?.(report);
    }

    function renderOverview(report) {
        const panel = document.getElementById('gguf-tab-overview');
        if (!panel) return;

        const model = report.modelInfo || {};
        const overview = report.analysisOverview || {};
        const perf = report.performanceMetrics || {};
        const inference = report.inferenceMeta || {};
        const useAudit = isRepositoryAuditReport(report);
        const patterns = report.ggufAIInsights?.dataPatterns || [];
        const categories = report.mockDataCategories || [];
        const scanPaths = Array.isArray(inference.scanPaths) ? inference.scanPaths : [];

        panel.innerHTML = `
            <div class="gguf-model-card">
                <div class="gguf-model-avatar">${useAudit ? '🛡️' : '🧠'}</div>
                <div class="gguf-model-body">
                    <h3>${escapeHtml(model.name || (useAudit ? 'platform-checklist' : 'unbreakable-oracle'))}</h3>
                    <p>${useAudit
                        ? `Internal audit • ${escapeHtml(inference.scanEngine || 'mock-data-scanner')} • ${overview.pageSampleSpecsLabel || `${overview.schemaFilesPassed ?? '—'}/${overview.schemaFilesChecked ?? '—'}`} PAGE_SAMPLE_SPECS`
                        : `${escapeHtml(model.type || 'GGUF')} • ${escapeHtml(model.size || '1.88GB')} • ${model.confidence || 98.5}% model confidence`}</p>
                    <div class="gguf-model-meta">
                        ${useAudit ? `
                            <span>Engine: <code>${escapeHtml(inference.scanEngine || 'mock-data-scanner')}</code></span>
                            <span>Dataset: ${escapeHtml(overview.totalMockDataSize || '—')}</span>
                            <span>Mode: ${escapeHtml(inference.mode || 'repository-audit')}</span>
                        ` : `
                            <span>Hash: <code>${escapeHtml((model.hash || '').slice(0, 18))}…</code></span>
                            <span>Speed: ${escapeHtml(overview.analysisSpeed || `${perf.filesProcessedPerSecond || 1559} files/s`)}</span>
                            <span>Memory: ${escapeHtml(overview.memoryUsage || '288MB')}</span>
                        `}
                    </div>
                </div>
                <div class="gguf-confidence-ring" style="--confidence:${useAudit ? (overview.schemaPassRate || overview.dataQualityScore || 95) : (model.confidence || 98.5)}">
                    <span>${useAudit ? formatMetric(overview.schemaPassRate ?? overview.dataQualityScore, '%') : `${model.confidence || 98.5}%`}</span>
                </div>
            </div>

            ${scanPaths.length || inference.mode ? `
                <div class="gguf-panel" style="margin-bottom: 1rem">
                    <h3>Scan Details</h3>
                    <div class="gguf-kv-grid">
                        ${inference.mode ? `<div><span>Mode</span><strong>${escapeHtml(inference.mode)}</strong></div>` : ''}
                        ${inference.scannedFiles != null ? `<div><span>Files scanned</span><strong>${Number(inference.scannedFiles).toLocaleString()}</strong></div>` : ''}
                        ${inference.durationMs != null ? `<div><span>Duration</span><strong>${inference.durationMs}ms</strong></div>` : ''}
                        ${inference.provider ? `<div><span>Provider</span><strong>${escapeHtml(inference.provider)}</strong></div>` : ''}
                        ${model.ollamaBaseUrl ? `<div><span>Ollama</span><strong>${escapeHtml(model.ollamaBaseUrl)}</strong></div>` : ''}
                    </div>
                    ${scanPaths.length ? `
                        <div class="gguf-section-title" style="margin-top: 1rem;">Scan Paths</div>
                        <ul class="gguf-pattern-list">
                            ${scanPaths.map((scanPath) => `<li><code>${escapeHtml(scanPath)}</code></li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            ` : ''}

            <div class="gguf-section-title">${useAudit ? 'Scanned Categories' : 'Mock Data Categories'}</div>
            <div class="gguf-category-grid">
                ${categories.map((cat) => `
                    <div class="gguf-category-card">
                        <div class="gguf-category-top">
                            <h4>${escapeHtml(cat.category)}</h4>
                            <span class="gguf-pill">${cat.issues || 0} issues</span>
                        </div>
                        <div class="gguf-category-score">${cat.qualityScore || 0}% quality</div>
                        <p>${escapeHtml(cat.description || '')}</p>
                        <div class="gguf-category-foot">
                            <span>${(cat.fileCount || 0).toLocaleString()} files</span>
                            <span>${escapeHtml(cat.totalSize || '')}</span>
                            <span>${cat.confidence || 0}% ${useAudit ? 'scan' : 'AI'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="gguf-two-col">
                <div class="gguf-panel">
                    <h3>Performance Metrics</h3>
                    <div class="gguf-kv-grid">
                        <div><span>Analysis duration</span><strong>${escapeHtml(perf.analysisDuration || '0.8 seconds')}</strong></div>
                        <div><span>Files / second</span><strong>${(perf.filesProcessedPerSecond || 1559).toLocaleString()}</strong></div>
                        <div><span>Memory efficiency</span><strong>${escapeHtml(perf.memoryEfficiency || 'High')}</strong></div>
                        <div><span>CPU optimization</span><strong>${escapeHtml(perf.cpuOptimization || 'Excellent')}</strong></div>
                        <div><span>Scalability</span><strong>${escapeHtml(perf.scalabilityRating || 'Very Good')}</strong></div>
                        <div><span>Dataset size</span><strong>${escapeHtml(overview.totalMockDataSize || '73.4MB')}</strong></div>
                    </div>
                </div>
                <div class="gguf-panel">
                    <h3>Data Patterns Detected</h3>
                    <ul class="gguf-pattern-list">
                        ${patterns.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    function renderIssues(report) {
        const panel = document.getElementById('gguf-tab-issues');
        const countEl = document.getElementById('gguf-issues-count');
        if (!panel) return;

        const issues = filteredIssues(report);
        if (countEl) countEl.textContent = `${issues.length} shown`;

        if (isCleanLiveScan(report)) {
            const scannedFiles = Number(
                report.inferenceMeta?.scannedFiles ?? report.analysisOverview?.totalMockFiles ?? 0
            ).toLocaleString();
            panel.innerHTML = `
                <div class="gguf-panel" style="border-left: 4px solid #22c55e;">
                    <h3 style="margin-top:0;color:var(--text-primary);">No issues detected</h3>
                    <p style="margin:0 0 0.75rem;color:var(--text-secondary);">
                        Live scan found no issues in ${scannedFiles} files.
                        Results come from <code>mock-data-scanner</code>, not template fiction.
                    </p>
                    <p style="margin:0;color:var(--text-secondary);">
                        Use <strong>Load Sample</strong> if you want to view the legacy demo issue catalog.
                    </p>
                </div>
            `;
            return;
        }

        panel.innerHTML = `
            <div class="gguf-table-wrap">
                <table class="gguf-table">
                    <thead>
                        <tr>
                            <th>Severity</th>
                            <th>Type</th>
                            <th>Count</th>
                            <th>Description</th>
                            <th>Affected Files</th>
                            <th>Recommended Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${issues.length ? issues.map((issue) => `
                            <tr>
                                <td><span class="gguf-severity ${severityClass(issue.severity)}">${escapeHtml(issue.severity)}</span></td>
                                <td>${escapeHtml(issue.type)}</td>
                                <td>${(issue.count || 0).toLocaleString()}</td>
                                <td>${escapeHtml(issue.description)}</td>
                                <td>${(issue.affectedFiles || []).slice(0, 3).map((f) => `<code>${escapeHtml(f)}</code>`).join('<br>')}</td>
                                <td>${escapeHtml(issue.recommendedAction || '')}</td>
                            </tr>
                        `).join('') : `
                            <tr><td colspan="6" class="gguf-empty">No issues match the current filters.</td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderRecommendations(report) {
        const panel = document.getElementById('gguf-tab-recommendations');
        if (!panel) return;

        const recs = report.ggufAIInsights?.optimizationRecommendations || [];
        const improvements = report.ggufAIInsights?.qualityImprovements || [];
        const nextSteps = report.nextSteps || [];

        panel.innerHTML = `
            <div class="gguf-rec-grid">
                ${recs.map((item) => `
                    <div class="gguf-rec-card priority-${escapeHtml(item.priority || 'medium')}">
                        <div class="gguf-rec-priority">${escapeHtml(item.priority || 'medium')} priority</div>
                        <h4>${escapeHtml(item.action)}</h4>
                        <p>${escapeHtml(item.description)}</p>
                        <div class="gguf-rec-foot">
                            <span>${escapeHtml(item.potentialSavings || '')}</span>
                            <span>${escapeHtml(item.impact || '')} impact</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="gguf-two-col">
                <div class="gguf-panel">
                    <h3>Quality Improvements</h3>
                    <ul class="gguf-pattern-list">
                        ${improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
                <div class="gguf-panel">
                    <h3>Next Steps</h3>
                    <ol class="gguf-steps-list">
                        ${nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ol>
                </div>
            </div>
        `;
    }

    function renderQuality(report) {
        const panel = document.getElementById('gguf-tab-quality');
        if (!panel) return;

        const metrics = report.qualityMetrics || {};
        const measured = metrics.measuredFromScan === true || hasLiveScan(report);
        const entries = [
            ['Data Integrity', metrics.dataIntegrity],
            ['Schema Compliance', metrics.schemaCompliance],
            ['Consistency', metrics.consistencyScore],
            ['Completeness', metrics.completenessScore],
            ['Overall Quality', metrics.overallQuality]
        ].filter(([, value]) => value != null);

        panel.innerHTML = `
            ${measured ? `
                <p style="margin:0 0 1rem;color:var(--text-secondary);">
                    Metrics below are computed by <code>mock-data-scanner</code>
                    (${Number(report.inferenceMeta?.scannedFiles ?? report.analysisOverview?.totalMockFiles ?? 0).toLocaleString()} files).
                    Accuracy is omitted because it is not measured from filesystem scans.
                </p>
            ` : ''}
            <div class="gguf-quality-grid">
                ${entries.map(([label, value]) => `
                    <div class="gguf-quality-item">
                        <div class="gguf-quality-label">${escapeHtml(label)}</div>
                        <div class="gguf-quality-bar"><span style="width:${value}%"></span></div>
                        <div class="gguf-quality-value">${value}%</div>
                    </div>
                `).join('')}
            </div>
            ${report.privacyAndSecurity ? `
                <div class="gguf-panel" style="margin-top: 1rem">
                    <h3>Privacy & Security</h3>
                    <p style="margin:0 0 0.75rem;color:var(--text-secondary);font-size:0.9rem;">
                        Platform architecture facts — not scan-derived quality scores.
                    </p>
                    <div class="gguf-kv-grid">
                        ${Object.entries(report.privacyAndSecurity).map(([key, value]) => `
                            <div><span>${escapeHtml(key.replace(/([A-Z])/g, ' $1'))}</span><strong>${escapeHtml(String(value))}</strong></div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    function switchTab(tabName) {
        activeTab = tabName;
        document.querySelectorAll('#gguf-analysis-root .gguf-tab-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('#gguf-analysis-root .gguf-tab-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.dataset.tabPanel === tabName);
        });
        if (window.__ggufAnalysisReport) {
            renderActiveTab(window.__ggufAnalysisReport);
        }
    }

    window.setGgufAnalysisTab = switchTab;

    function bindActions() {
        if (window.__ggufAnalysisBound) return;
        window.__ggufAnalysisBound = true;

        document.getElementById('gguf-analysis-root')?.addEventListener('click', (event) => {
            const tabBtn = event.target.closest('.gguf-tab-btn');
            if (tabBtn?.dataset.tab) {
                switchTab(tabBtn.dataset.tab);
                return;
            }

            const severityChip = event.target.closest('[data-severity-filter]');
            if (severityChip) {
                severityFilter = severityChip.dataset.severityFilter;
                document.querySelectorAll('[data-severity-filter]').forEach((chip) => {
                    chip.classList.toggle('active', chip.dataset.severityFilter === severityFilter);
                });
                if (window.__ggufAnalysisReport) renderIssues(window.__ggufAnalysisReport);
            }
        });

        document.getElementById('gguf-search-input')?.addEventListener('input', (event) => {
            searchQuery = event.target.value.trim();
            if (window.__ggufAnalysisReport) renderIssues(window.__ggufAnalysisReport);
        });

        document.getElementById('gguf-refresh-btn')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastGgufAnalysisReport');
            } catch { /* ignore */ }
            window.__ggufAnalysisReport = null;
            if (typeof window.refreshGGUFData === 'function') {
                window.refreshGGUFData();
                return;
            }
            await loadGgufAnalysisSample();
        });
        document.getElementById('gguf-manage-models')?.addEventListener('click', () => {
            const navLink = document.querySelector(".nav-link[onclick*=\"'local-models'\"]");
            window.showSection?.('local-models', navLink);
        });
        document.getElementById('gguf-load-sample')?.addEventListener('click', () => loadGgufAnalysisSample());
        document.getElementById('gguf-import-json')?.addEventListener('click', () => {
            document.getElementById('gguf-import-file')?.click();
        });
        document.getElementById('gguf-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                await applyGgufAnalysisReport(JSON.parse(text), file.name);
                window.showNotification?.('✅ GGUF analysis report imported', 'success');
            } catch (error) {
                window.showNotification?.(`❌ Import failed: ${error.message}`, 'error');
            } finally {
                event.target.value = '';
            }
        });
        document.getElementById('gguf-export-json')?.addEventListener('click', () => {
            const report = window.__ggufAnalysisReport;
            if (!report) return;
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gguf-analysis-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ GGUF analysis report exported', 'success');
        });
    }

    async function applyGgufAnalysisReport(payload, sourceLabel) {
        const normalized = normalizeReport(payload);
        if (!normalized) throw new Error('JSON must be a gguf-mock-data-analysis-report object');
        if (isStaleGgufReport(normalized)) {
            throw new Error('Stale mock analysis baseline rejected — load repository-audit sample');
        }

        const root = document.getElementById('gguf-analysis-root');
        root?.classList.add('loading');
        let report;
        try {
            report = await enrichPartialReport(normalized);
        } finally {
            root?.classList.remove('loading');
        }

        window.__ggufAnalysisReport = report;
        renderReport(report);
        bindActions();
        window.initializeEnhancedGgufFeatures?.();
        if (typeof window.bindMockActionCards === 'function') {
            window.bindMockActionCards();
        }

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'gguf-analysis'\"]");
            window.showSection('gguf-analysis', navLink);
        }

        if (sourceLabel) {
            const status = document.getElementById('gguf-source-label');
            if (status) {
                const enriched = isPartialReport(normalized) ? `${sourceLabel} (enriched)` : sourceLabel;
                status.textContent = `Source: ${enriched}`;
            }
        }
        try {
            localStorage.setItem('lastGgufAnalysisReport', JSON.stringify({
                report,
                sourceLabel: sourceLabel || 'Imported analysis',
                savedAt: new Date().toISOString()
            }));
        } catch (error) {
            /* ignore storage errors */
        }
    }

    async function loadGgufAnalysisSample() {
        const root = document.getElementById('gguf-analysis-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyGgufAnalysisReport(await response.json(), 'gguf-mock-analysis-sample.json');
            window.showNotification?.('✅ Loaded GGUF analysis sample', 'success');
        } catch (error) {
            console.error('Failed to load GGUF analysis sample:', error);
            window.showNotification?.('❌ Failed to load GGUF analysis sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeGgufAnalysisPage(forceRefresh = false) {
        const root = document.getElementById('gguf-analysis-root');
        if (!root) return;

        await loadActiveModelInfo();
        window.initializeEnhancedGgufFeatures?.();

        if (window.__ggufAnalysisReport && !forceRefresh) {
            if (isStaleGgufReport(window.__ggufAnalysisReport)) {
                window.__ggufAnalysisReport = null;
                try { localStorage.removeItem('lastGgufAnalysisReport'); } catch { /* ignore */ }
            } else {
                renderReport(window.__ggufAnalysisReport);
                bindActions();
                if (typeof window.bindMockActionCards === 'function') {
                    window.bindMockActionCards();
                }
                return;
            }
        }

        if (forceRefresh) {
            window.__ggufAnalysisReport = null;
            try {
                localStorage.removeItem('lastGgufAnalysisReport');
            } catch { /* ignore */ }
        }

        root.classList.add('loading');
        try {
            const report = await fetchReportData();
            if (report) {
                window.__ggufAnalysisReport = report;
                renderReport(report);
                bindActions();
                if (typeof window.bindMockActionCards === 'function') {
                    window.bindMockActionCards();
                }
                return;
            }

            if (!forceRefresh && restoreSavedGgufReport()) {
                return;
            }

            await loadGgufAnalysisSample();
        } catch (error) {
            console.error('Failed to initialize GGUF analysis page:', error);
            try {
                await loadGgufAnalysisSample();
            } catch {
                window.showNotification?.(`❌ Failed to load GGUF analysis: ${error.message}`, 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    async function runGgufModelAnalysis(modelId = 'active') {
        const root = document.getElementById('gguf-analysis-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(`/api/models/${encodeURIComponent(modelId)}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || 'Model analysis failed');
            }
            await applyGgufAnalysisReport(
                payload.report,
                `${payload.model?.name || 'model'} (${payload.inferenceMode || 'inference'})`
            );
            window.showNotification?.(
                `✅ Analysis via ${payload.inferenceMode || 'model'} — ${payload.scanSummary?.totalFiles ?? 0} files scanned`,
                'success'
            );
            return payload;
        } finally {
            root?.classList.remove('loading');
        }
    }

    window.initializeGgufAnalysisPage = initializeGgufAnalysisPage;
    window.loadGgufAnalysisSample = loadGgufAnalysisSample;
    window.applyGgufAnalysisReport = applyGgufAnalysisReport;
    window.runGgufModelAnalysis = runGgufModelAnalysis;

    window.addEventListener('active-model-changed', async (event) => {
        cachedActiveModel = event.detail || await loadActiveModelInfo();
        if (window.__ggufAnalysisReport) {
            renderReport(window.__ggufAnalysisReport);
        }
    });
})();
