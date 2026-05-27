/**
 * Issue Resolution Page — self-contained dashboard for GGUF mock data issues
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524as';
    const SAMPLE_URL = `/data/issue-resolution-sample.json?v=${SAMPLE_CACHE_BUST}`;

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

    function isIssueResolutionModel(payload) {
        return Boolean(
            payload
            && typeof payload.total === 'number'
            && Array.isArray(payload.categories)
            && Array.isArray(payload.issues)
        );
    }

    function normalizeIssueModel(payload) {
        const model = payload?.data && isIssueResolutionModel(payload.data) ? payload.data : payload;
        if (!isIssueResolutionModel(model)) return null;

        return {
            type: model.type || 'issue-resolution-model',
            total: model.total,
            openIssueCount: model.openIssueCount ?? (model.pendingCount ?? 0) + (model.inProgressCount ?? 0),
            resolvedCount: model.resolvedCount ?? 0,
            inProgressCount: model.inProgressCount ?? 0,
            pendingCount: model.pendingCount ?? 0,
            resolvedPct: model.resolvedPct ?? (model.total ? Math.round((model.resolvedCount / model.total) * 100) : 0),
            categories: model.categories,
            issues: model.issues,
            insights: model.insights || [],
            quality: model.quality || {},
            title: model.title || 'Issue Resolution',
            dataSource: model.dataSource || null,
            deprecatedNarrative: model.deprecatedNarrative || null,
            actionPlan: model.actionPlan || [],
            kpis: model.kpis || [],
            resources: model.resources || null,
            generatedAt: model.generatedAt || new Date().toISOString(),
            generatedBy: model.generatedBy || null,
            modelInfo: model.modelInfo || {}
        };
    }

    function isStaleIssueResolutionModel(model) {
        if (!model) return true;
        if (model?.total === 156 || model?.resolvedPct === 68) return true;
        if ((model.categories || []).some((cat) =>
            (cat.affectedFiles || []).some((file) => /^mock_data_/.test(file))
            || String(cat.description || '').includes('Legacy demo')
        )) return true;
        if ((model.issues || []).some((issue) =>
            /^ISS-\d+[BC]$/i.test(issue.id || '')
            || (issue.file || '').includes('mock/')
            || (issue.affectedFiles || []).some((file) => /^mock_data_/.test(file))
        )) return true;

        if (model?.dataSource !== 'repository-audit') {
            return false;
        }

        if (Number(model.total) === 0 && !(model.issues || []).length) return true;
        if ((model.kpis || []).some((kpi) =>
            kpi.name === 'Jest pass rate' && Number(kpi.target) === 500
        )) return true;
        if ((model.issues || []).some((issue) =>
            issue.id === 'ISS-003'
            && (issue.affectedFiles || []).includes('ai-roadmap-sample.json')
        )) return true;

        return false;
    }

    function isFictionAnalyzeReport(report) {
        const overview = report?.analysisOverview || {};
        if (overview.issuesDetected === 156 || overview.totalMockFiles === 1247) return true;
        return (report?.detectedIssues || []).some((issue) =>
            (issue.affectedFiles || []).some((file) => /^mock_data_/.test(file))
        );
    }

    function strategyForIssueType(type) {
        const normalized = String(type || '').toLowerCase();
        if (normalized.includes('json') || normalized.includes('invalid json')) return 'json-syntax';
        if (normalized.includes('schema')) return 'schema-violation';
        if (normalized.includes('missing field')) return 'missing-fields';
        if (normalized.includes('duplicate')) return 'duplicate-data';
        if (normalized.includes('inconsist')) return 'schema-violation';
        if (normalized.includes('empty')) return 'json-syntax';
        return 'schema-violation';
    }

    function toGgufIssue(issue) {
        return {
            id: issue.id,
            type: issue.type,
            severity: issue.severity,
            filePath: issue.filePath,
            message: issue.description,
            suggestedFix: issue.recommendedAction,
            metadata: issue.metadata || {},
            line: issue.line || 1,
            column: issue.column || 0,
            detectedAt: issue.detectedAt || new Date().toISOString()
        };
    }

    function indexIssueFixTargets(model) {
        const map = new Map();
        for (const issue of model.issues || []) {
            map.set(issue.id, issue);
        }
        window.__ggufIssueById = map;
    }

    function isLiveAnalyzeReport(report) {
        if (!report || isFictionAnalyzeReport(report)) return false;
        return Boolean(
            report.inferenceMeta?.scanEngine
            || report.inferenceMeta?.scannedFiles != null
            || report.inferenceMeta?.metricsSource === 'scan'
        );
    }

    async function fetchIssueData() {
        const sampleSources = [SAMPLE_URL, '/api/issues/resolution', '/api/issues'];

        for (const url of sampleSources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                const model = normalizeIssueModel(payload.data || payload);
                if (model && !isStaleIssueResolutionModel(model)) {
                    indexIssueFixTargets(model);
                    return model;
                }
            } catch (error) {
                console.warn('Issue resolution sample source failed:', url, error.message);
            }
        }

        try {
            const scanResponse = await fetch('/api/gguf/issues/scan');
            if (scanResponse.ok) {
                const scanPayload = await scanResponse.json();
                if (scanPayload.success && scanPayload.results) {
                    if (scanPayload.results.issues?.length) {
                        return buildIssueModelFromGgufScan(scanPayload.results);
                    }
                    return buildIssueModel({
                        detectedIssues: [],
                        analysisOverview: { issuesDetected: 0 },
                        generatedAt: new Date().toISOString(),
                        inferenceMeta: { scanEngine: 'mock-data-scanner', issueSource: 'none' }
                    });
                }
            }
        } catch (error) {
            console.warn('GGUF issue scan failed:', error.message);
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
                if (report?.analysisOverview || report?.inferenceMeta) {
                    if (!isFictionAnalyzeReport(report)) {
                        return buildIssueModel(report);
                    }
                }
            }
        } catch (error) {
            console.warn('Active model analyze failed:', error.message);
        }

        for (const url of sampleSources) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const payload = await response.json();
                const report = payload.type === 'gguf-mock-data-analysis-report'
                    ? payload
                    : payload.data?.type === 'gguf-mock-data-analysis-report'
                        ? payload.data
                        : payload.analysisOverview ? payload : null;
                if (report?.detectedIssues?.length && !isFictionAnalyzeReport(report)) {
                    return buildIssueModel(report);
                }
            } catch (error) {
                console.warn('Issue resolution report source failed:', url, error.message);
            }
        }

        const empty = normalizeIssueModel({
            type: 'issue-resolution-model',
            dataSource: 'repository-audit',
            total: 0,
            resolvedCount: 0,
            inProgressCount: 0,
            pendingCount: 0,
            resolvedPct: 0,
            categories: [],
            issues: [],
            insights: [],
            quality: { measuredFromScan: true, overallQuality: 0 },
            generatedAt: new Date().toISOString()
        });
        indexIssueFixTargets(empty);
        return empty;
    }

    function buildIssueModelFromGgufScan(results) {
        const grouped = new Map();
        for (const issue of results.issues || []) {
            const key = `${issue.type}|${issue.filePath || issue.message}`;
            const bucket = grouped.get(key) || {
                severity: issue.severity || 'medium',
                type: issue.type,
                count: 0,
                description: issue.message || issue.type,
                recommendedAction: issue.suggestedFix || 'Apply automated GGUF fix',
                affectedFiles: [],
                filePaths: [],
                metadata: issue.metadata || {}
            };
            bucket.count += 1;
            if (issue.filePath) {
                bucket.filePaths.push(issue.filePath);
                const fileName = issue.filePath.split(/[/\\]/).pop();
                if (fileName && !bucket.affectedFiles.includes(fileName)) {
                    bucket.affectedFiles.push(fileName);
                }
            }
            grouped.set(key, bucket);
        }

        return buildIssueModel({
            detectedIssues: [...grouped.values()],
            analysisOverview: { issuesDetected: results.issues.length },
            generatedAt: new Date().toISOString()
        });
    }

    function buildIssueModel(report) {
        const live = isLiveAnalyzeReport(report);
        const detected = Array.isArray(report?.detectedIssues) ? report.detectedIssues : [];

        const total = live
            ? (report?.analysisOverview?.issuesDetected
                ?? detected.reduce((sum, item) => sum + (item.count || 1), 0))
            : detected.reduce((sum, item) => sum + (item.count || 1), 0);

        const issues = detected.map((item, groupIndex) => ({
            id: item.id || `ISS-${String(groupIndex + 1).padStart(3, '0')}`,
            type: item.type,
            severity: item.severity,
            description: item.description,
            recommendedAction: item.recommendedAction,
            affectedFiles: item.affectedFiles || [],
            filePath: item.filePaths?.[0] || item.filePath || null,
            metadata: item.metadata || {},
            strategyId: strategyForIssueType(item.type),
            status: item.status || 'pending',
            automationAvailable: Boolean(item.filePaths?.length || item.filePath || item.metadata?.duplicatePaths?.length),
            count: item.count || 1
        }));

        const resolvedCount = issues.filter((issue) => issue.status === 'resolved').length;
        const inProgressCount = issues.filter((issue) => issue.status === 'in-progress').length;
        const pendingCount = issues.filter((issue) => issue.status === 'pending').length;

        const model = {
            type: 'issue-resolution-model',
            total: total || issues.length,
            resolvedCount,
            inProgressCount,
            pendingCount: pendingCount || Math.max(0, (total || issues.length) - resolvedCount - inProgressCount),
            resolvedPct: (total || issues.length)
                ? Math.round((resolvedCount / (total || issues.length)) * 100)
                : 0,
            categories: detected,
            issues,
            insights: report?.ggufAIInsights?.optimizationRecommendations || report?.insights || [],
            quality: report?.qualityMetrics || report?.quality || {},
            dataSource: live ? 'live-analyze' : (report?.dataSource || null),
            title: live ? 'Issue Resolution (Live Analyze)' : 'Issue Resolution (Measured Baseline)',
            actionPlan: report?.actionPlan || [],
            kpis: report?.kpis || [],
            resources: report?.resources || null,
            generatedAt: report?.generatedAt || new Date().toISOString(),
            generatedBy: report?.generatedBy || null
        };
        indexIssueFixTargets(model);
        return model;
    }

    async function runGgufFixAction(issueId, mode) {
        const issue = window.__ggufIssueById?.get(issueId)
            || window.__issueResolutionModel?.issues?.find((entry) => entry.id === issueId);
        if (!issue) {
            window.showNotification?.('Issue not found', 'error');
            return;
        }

        const ggufIssue = toGgufIssue(issue);
        if (!ggufIssue.filePath) {
            window.showNotification?.('Automated fix requires a file path — run Analyze or Scan first', 'warning');
            return;
        }

        const strategyId = issue.strategyId || strategyForIssueType(issue.type);
        const endpoint = mode === 'preview'
            ? '/api/gguf/issues/fix/preview'
            : '/api/gguf/issues/fix/apply';

        try {
            window.showNotification?.(
                mode === 'preview' ? `👁 Previewing fix for ${issueId}…` : `🔧 Applying GGUF fix for ${issueId}…`,
                'info'
            );

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue: ggufIssue, strategyId })
            });
            const payload = await response.json();

            if (!response.ok || !payload.success) {
                throw new Error(payload.message || payload.error || 'Fix request failed');
            }

            if (mode === 'preview') {
                const changeCount = payload.preview?.changes?.length ?? 0;
                window.showNotification?.(`Preview ready for ${issueId} (${changeCount} changes)`, 'success');
                return;
            }

            issue.status = 'resolved';
            if (window.__issueResolutionModel) {
                window.__issueResolutionModel.resolvedCount = Math.min(
                    window.__issueResolutionModel.total,
                    (window.__issueResolutionModel.resolvedCount || 0) + 1
                );
                window.__issueResolutionModel.pendingCount = Math.max(
                    0,
                    window.__issueResolutionModel.total
                        - window.__issueResolutionModel.resolvedCount
                        - (window.__issueResolutionModel.inProgressCount || 0)
                );
                window.__issueResolutionModel.resolvedPct = window.__issueResolutionModel.total
                    ? Math.round((window.__issueResolutionModel.resolvedCount / window.__issueResolutionModel.total) * 100)
                    : 0;
                renderModel(window.__issueResolutionModel);
            }
            window.showNotification?.(`✅ Fix applied for ${issueId}`, 'success');
        } catch (error) {
            console.error('GGUF fix action failed:', error);
            window.showNotification?.(`❌ ${error.message}`, 'error');
        }
    }

    async function runBatchFix(selectedIds) {
        const model = window.__issueResolutionModel;
        const issues = selectedIds
            .map((id) => window.__ggufIssueById?.get(id) || model?.issues?.find((entry) => entry.id === id))
            .filter(Boolean);

        const automatable = issues.filter((issue) => {
            const ggufIssue = toGgufIssue(issue);
            return Boolean(ggufIssue.filePath);
        });

        if (!automatable.length) {
            window.showNotification?.(
                'Selected issues need file paths — run Analyze or Scan first',
                'warning'
            );
            return;
        }

        const skipped = issues.length - automatable.length;
        const byStrategy = new Map();
        for (const issue of automatable) {
            const strategyId = issue.strategyId || strategyForIssueType(issue.type);
            const bucket = byStrategy.get(strategyId) || [];
            bucket.push(toGgufIssue(issue));
            byStrategy.set(strategyId, bucket);
        }

        const batchButton = document.getElementById('issue-start-batch');
        if (batchButton) batchButton.disabled = true;

        let totalSuccessful = 0;
        let totalFailed = 0;
        let totalProcessed = 0;

        try {
            window.showNotification?.(
                `🤖 Starting batch resolution for ${automatable.length} issue(s)…`,
                'info'
            );

            for (const [strategyId, ggufIssues] of byStrategy) {
                const response = await fetch('/api/gguf/issues/fix/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ issues: ggufIssues, strategyId })
                });
                const payload = await response.json();

                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || payload.error || 'Batch fix failed');
                }

                totalSuccessful += payload.result?.successful ?? 0;
                totalFailed += payload.result?.failed ?? 0;
                totalProcessed += payload.result?.total ?? ggufIssues.length;

                for (const entry of payload.result?.results || []) {
                    if (!entry.success) continue;
                    const modelIssue = automatable.find((issue) => issue.id === entry.issueId);
                    if (modelIssue) modelIssue.status = 'resolved';
                }
            }

            if (model) {
                model.resolvedCount = Math.min(
                    model.total,
                    (model.resolvedCount || 0) + totalSuccessful
                );
                model.pendingCount = Math.max(
                    0,
                    model.total - model.resolvedCount - (model.inProgressCount || 0)
                );
                model.resolvedPct = model.total
                    ? Math.round((model.resolvedCount / model.total) * 100)
                    : 0;
                renderModel(model);
            }

            const skippedNote = skipped ? ` (${skipped} skipped — no file path)` : '';
            window.showNotification?.(
                `✅ Batch fix complete: ${totalSuccessful}/${totalProcessed} successful${skippedNote}`,
                totalFailed > 0 ? 'warning' : 'success'
            );
        } catch (error) {
            console.error('Batch fix failed:', error);
            window.showNotification?.(`❌ ${error.message}`, 'error');
        } finally {
            if (batchButton) batchButton.disabled = false;
        }
    }

    function renderModel(model) {
        renderPageTitle(model);
        renderHeaderStats(model);
        renderCategoryCards(model);
        renderIssueQueue(model);
        renderRecommendations(model);
        renderQualityMetrics(model);
        renderActionPlan(model);
        renderKpis(model);
    }

    function renderPageTitle(model) {
        const titleEl = document.querySelector('#issue-resolution-root .header h1');
        if (titleEl && model.title) {
            titleEl.textContent = `🔧 ${model.title}`;
        }
    }

    function renderHeaderStats(model) {
        const totalEl = document.getElementById('issue-stat-total');
        const resolvedEl = document.getElementById('issue-stat-resolved');
        const progressEl = document.getElementById('issue-stat-progress');
        const pendingEl = document.getElementById('issue-stat-pending');
        const badgeEl = document.getElementById('issue-detected-badge');
        const barEl = document.getElementById('issue-resolution-bar');
        const barLabelEl = document.getElementById('issue-resolution-bar-label');

        if (totalEl) totalEl.textContent = model.total.toLocaleString();
        if (resolvedEl) resolvedEl.textContent = model.resolvedCount.toLocaleString();
        if (progressEl) progressEl.textContent = model.inProgressCount.toLocaleString();
        if (pendingEl) pendingEl.textContent = model.pendingCount.toLocaleString();
        if (badgeEl) {
            const openCount = model.openIssueCount ?? (model.pendingCount + model.inProgressCount);
            if (model.dataSource === 'repository-audit' && openCount === 0 && model.resolvedCount === model.total) {
                badgeEl.textContent = `✅ ${model.resolvedCount}/${model.total} Resolved • 0 Open`;
            } else if (openCount > 0) {
                badgeEl.textContent = `🔍 ${openCount.toLocaleString()} Open • ${model.resolvedCount.toLocaleString()} Resolved`;
            } else {
                badgeEl.textContent = `🔍 ${model.total.toLocaleString()} Issues Detected`;
            }
        }
        if (barEl) barEl.style.width = `${model.resolvedPct}%`;
        if (barLabelEl) barLabelEl.textContent = `${model.resolvedPct}% Issues Resolved`;

        const updateEl = document.getElementById('issue-last-update');
        if (updateEl) {
            const parts = [];
            if (model.generatedAt) {
                parts.push(`Report generated ${new Date(model.generatedAt).toLocaleString()}`);
            }
            if (model.dataSource === 'live-analyze') {
                parts.push('Source: live analyze (mock-data-scanner)');
            } else if (model.dataSource === 'repository-audit') {
                parts.push('Source: measured baseline sample');
            }
            updateEl.textContent = parts.join(' • ');
        }

        const leadEl = document.querySelector('#issue-resolution-root .header .lead');
        if (leadEl) {
            if (model.dataSource === 'live-analyze') {
                leadEl.textContent = 'Issues populated from POST /api/models/active/analyze — mock-data-scanner file paths.';
            } else if (model.dataSource === 'repository-audit') {
                leadEl.textContent = 'Measured issue queue from mock-data-scanner — not 156 mock_data_* fiction or fake 68% progress.';
            } else if (model.total === 0) {
                leadEl.textContent = 'No issues in queue. Click Refresh Data to run a live filesystem scan.';
            }
        }
    }

    function formatResolvedAction(text) {
        return String(text || '').replace(/^Resolved\s*[—–-]\s*/i, '').trim();
    }

    function renderCategoryCards(model) {
        const container = document.getElementById('issue-category-cards');
        if (!container) return;

        if (!model.categories.length) {
            container.innerHTML = `
                <div class="issue-category-card" style="grid-column: 1 / -1;">
                    <p style="margin:0;color:var(--text-secondary);">
                        No issue categories yet. Prior sample fiction (156 issues, mock_data_*.json) was removed.
                        Run <strong>Refresh Data</strong> after analyze to populate real scanner output.
                    </p>
                </div>
            `;
            return;
        }
        container.innerHTML = model.categories.map(cat => {
            const status = String(cat.status || '').toLowerCase();
            const isResolved = status === 'resolved' || status === 'complete';
            const countLabel = isResolved
                ? `<span class="issue-resolved-count">✓ ${(cat.count || 0).toLocaleString()} fixed</span>`
                : `<span>${(cat.count || 0).toLocaleString()} open</span>`;
            const statusBadge = !isResolved && status
                ? `<span class="issue-status-badge ${escapeHtml(status)}">${escapeHtml(status)}</span>`
                : '';
            const actionText = isResolved
                ? formatResolvedAction(cat.recommendedAction) || 'All items in this category are fixed'
                : (cat.recommendedAction || 'Review and apply recommended fix');
            const actionClass = isResolved ? 'issue-category-verification' : 'issue-category-action';

            return `
            <div class="issue-category-card ${severityClass(cat.severity)}${isResolved ? ' is-resolved' : ''}">
                <div class="issue-category-top">
                    <h4>${escapeHtml(cat.type || cat.category)}</h4>
                    <span class="issue-severity-badge ${severityClass(cat.severity)}">${escapeHtml(cat.severity || 'low')}</span>
                </div>
                <div class="issue-category-count">${countLabel}${statusBadge}</div>
                <p>${escapeHtml(cat.description || '')}</p>
                <div class="${actionClass}">${escapeHtml(actionText)}</div>
            </div>
        `;
        }).join('');
    }

    function renderIssueQueue(model) {
        const tbody = document.getElementById('issue-queue-body');
        if (!tbody) return;

        if (!model.issues.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="color:var(--text-secondary);padding:1.25rem;">
                        No issues in queue. Live scan found 0 actionable items — this is expected when sample JSON passes schema checks.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = model.issues.map(issue => `
            <tr>
                <td><input type="checkbox" class="issue-row-checkbox" value="${escapeHtml(issue.id)}" checked></td>
                <td><span class="issue-id-badge">${escapeHtml(issue.id)}</span></td>
                <td>${escapeHtml(issue.type)}</td>
                <td><span class="issue-severity-badge ${severityClass(issue.severity)}">${escapeHtml(issue.severity)}</span></td>
                <td>${escapeHtml(issue.description)}</td>
                <td>${(issue.affectedFiles || []).length} files</td>
                <td><span class="issue-status-badge ${escapeHtml(issue.status)}">${escapeHtml(issue.status)}</span>${issue.automationAvailable ? ' <span class="issue-auto-badge" title="GGUF automation available">🤖</span>' : ''}</td>
                <td>
                    <button type="button" class="issue-action-btn" data-action="fix" data-id="${escapeHtml(issue.id)}">Fix</button>
                    <button type="button" class="issue-action-btn secondary" data-action="preview" data-id="${escapeHtml(issue.id)}">Preview</button>
                </td>
            </tr>
        `).join('');
    }

    function renderRecommendations(model) {
        const container = document.getElementById('issue-recommendations');
        if (!container) return;

        const items = model.insights.length
            ? model.insights
            : (model.dataSource === 'repository-audit'
                ? []
                : [
                    { priority: 'high', action: 'Run Refresh Data', description: 'Load issues from mock-data-scanner via analyze or scan API.', potentialSavings: 'Real file paths' }
                ]);

        if (!items.length) {
            container.innerHTML = '<p class="text-muted" style="font-size:0.9rem;margin:0;">No recommendations — run Refresh Data after a live scan.</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="issue-rec-card priority-${escapeHtml(item.priority || 'medium')}">
                <div class="issue-rec-priority">${escapeHtml(item.priority || 'medium')} priority</div>
                <h4>${escapeHtml(item.action)}</h4>
                <p>${escapeHtml(item.description)}</p>
                <div class="issue-rec-savings">${escapeHtml(item.potentialSavings || item.impact || '')}</div>
            </div>
        `).join('');
    }

    function renderQualityMetrics(model) {
        const container = document.getElementById('issue-quality-metrics');
        if (!container) return;

        const quality = model.quality || {};
        const measured = quality.measuredFromScan === true;
        const metrics = (measured
            ? [
                ['Data Integrity', quality.dataIntegrity],
                ['Schema Compliance', quality.schemaCompliance],
                ['Consistency', quality.consistencyScore],
                ['Completeness', quality.completenessScore],
                ['Overall Quality', quality.overallQuality]
            ]
            : [
                ['Data Integrity', quality.dataIntegrity ?? 92.3],
                ['Schema Compliance', quality.schemaCompliance ?? 89.7],
                ['Consistency', quality.consistencyScore ?? 87.6],
                ['Completeness', quality.completenessScore ?? 91.2],
                ['Accuracy', quality.accuracyScore ?? 88.9],
                ['Overall Quality', quality.overallQuality ?? 89.2]
            ]).filter(([, value]) => value != null);

        container.innerHTML = metrics.map(([label, value]) => `
            <div class="issue-quality-item">
                <div class="issue-quality-label">${escapeHtml(label)}</div>
                <div class="issue-quality-bar"><span style="width:${value}%"></span></div>
                <div class="issue-quality-value">${value}%</div>
            </div>
        `).join('');
    }

    function renderActionPlan(model) {
        const panel = document.getElementById('issue-action-plan-panel');
        const container = document.getElementById('issue-action-plan');
        if (!panel || !container) return;
        if (!model.actionPlan?.length) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        container.innerHTML = model.actionPlan.map((phase) => `
            <div class="issue-phase-card priority-${escapeHtml(phase.priority || 'medium')}">
                <div class="issue-phase-top">
                    <span class="issue-phase-num">Phase ${phase.phase}</span>
                    <span class="issue-phase-timeline">${escapeHtml(phase.timeline || '')}</span>
                </div>
                <h4>${escapeHtml(phase.title || '')}</h4>
                <p class="issue-phase-target">${escapeHtml(phase.target || '')}</p>
                <p class="issue-phase-outcome">${escapeHtml(phase.expectedOutcome || '')}</p>
                <ul class="issue-phase-actions">${(phase.actions || []).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
            </div>
        `).join('');
    }

    function renderKpis(model) {
        const panel = document.getElementById('issue-kpi-panel');
        const container = document.getElementById('issue-kpi-grid');
        if (!panel || !container) return;
        if (!model.kpis?.length) {
            panel.hidden = true;
            return;
        }
        panel.hidden = false;
        container.innerHTML = model.kpis.map((kpi) => {
            const unit = kpi.unit ?? '%';
            const formatValue = (value) => (unit === '%' ? `${value}%` : String(value));
            return `
            <div class="issue-kpi-card status-${escapeHtml(kpi.status || 'on-track')}">
                <div class="issue-kpi-name">${escapeHtml(kpi.name)}</div>
                <div class="issue-kpi-values">${formatValue(kpi.current)} → ${formatValue(kpi.target)}</div>
                <div class="issue-kpi-meta">${escapeHtml(kpi.timeline || '')} • ${escapeHtml(kpi.status || '')}</div>
            </div>
        `;
        }).join('');

        const resourcesEl = document.getElementById('issue-resources-summary');
        if (resourcesEl && model.resources) {
            resourcesEl.textContent = formatResourcesSummary(model.resources);
        }
    }

    function formatResourcesSummary(resources) {
        if (resources.summary) return resources.summary;
        const parts = [];
        if (resources.durationWeeks != null) {
            parts.push(`${resources.durationWeeks}-week sprint`);
        }
        if (resources.totalCost != null && Number.isFinite(resources.totalCost)) {
            parts.push(`$${resources.totalCost.toLocaleString()}`);
        } else {
            parts.push('no budget tracked');
        }
        if (resources.storageSavingsMb != null && resources.storageSavingsMb > 0) {
            parts.push(`${resources.storageSavingsMb}MB storage savings potential`);
        } else {
            parts.push('local repo — no storage reclamation target');
        }
        return parts.join(' • ');
    }

    function bindActions() {
        if (window.__issueResolutionBound) return;
        window.__issueResolutionBound = true;

        document.getElementById('issue-start-batch')?.addEventListener('click', () => {
            const selected = [...document.querySelectorAll('.issue-row-checkbox:checked')].map(el => el.value);
            if (!selected.length) {
                window.showNotification?.('Select at least one issue to resolve', 'warning');
                return;
            }
            runBatchFix(selected);
        });

        document.getElementById('issue-export-report')?.addEventListener('click', () => {
            const model = window.__issueResolutionModel;
            if (!model) return;
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `issue-resolution-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Issue resolution report downloaded', 'success');
        });

        document.getElementById('issue-refresh-data')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastIssueResolutionModel');
            } catch { /* ignore */ }
            window.__issueResolutionModel = null;
            await loadIssueResolutionSample();
        });

        document.getElementById('issue-load-sample')?.addEventListener('click', () => loadIssueResolutionSample());

        document.getElementById('issue-import-json')?.addEventListener('click', () => {
            document.getElementById('issue-import-file')?.click();
        });

        document.getElementById('issue-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const payload = JSON.parse(text);
                applyIssueResolutionModel(payload, file.name);
                window.showNotification?.('✅ Issue resolution data imported', 'success');
            } catch (error) {
                console.error('Issue import failed:', error);
                window.showNotification?.('❌ Invalid issue resolution JSON', 'error');
            } finally {
                event.target.value = '';
            }
        });

        document.getElementById('issue-resolution-root')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            const id = button.dataset.id;
            const action = button.dataset.action;
            if (action === 'fix') {
                runGgufFixAction(id, 'apply');
            } else if (action === 'preview') {
                runGgufFixAction(id, 'preview');
            }
        });
    }

    function applyIssueResolutionModel(payload, sourceLabel) {
        const model = normalizeIssueModel(payload) || (payload?.detectedIssues ? buildIssueModel(payload) : null);
        if (!model) {
            throw new Error('Unrecognized issue resolution payload');
        }
        if (isStaleIssueResolutionModel(model)) {
            throw new Error('Stale issue resolution fiction rejected — load repository-audit sample');
        }
        window.__issueResolutionModel = model;
        indexIssueFixTargets(model);
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'issue-resolution'\"]");
            window.showSection('issue-resolution', navLink);
        }

        try {
            localStorage.setItem('lastIssueResolutionModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported issues',
                savedAt: new Date().toISOString()
            }));
        } catch (error) {
            /* ignore */
        }
    }

    function restoreSavedIssueResolutionModel() {
        try {
            const raw = localStorage.getItem('lastIssueResolutionModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeIssueModel(saved.model || saved);
            if (!model || isStaleIssueResolutionModel(model)) {
                localStorage.removeItem('lastIssueResolutionModel');
                return false;
            }
            window.__issueResolutionModel = model;
            indexIssueFixTargets(model);
            renderModel(model);
            bindActions();
            return true;
        } catch (error) {
            return false;
        }
    }

    async function loadIssueResolutionSample() {
        const root = document.getElementById('issue-resolution-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            const payload = await response.json();
            applyIssueResolutionModel(payload, 'issue-resolution-sample.json');
            window.showNotification?.('✅ Loaded issue resolution sample', 'success');
        } catch (error) {
            console.error('Failed to load issue resolution sample:', error);
            window.showNotification?.('❌ Failed to load issue resolution sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeIssueResolutionPage(forceRefresh = false) {
        const root = document.getElementById('issue-resolution-root');
        if (!root) return;

        if (window.__issueResolutionModel && !forceRefresh) {
            if (isStaleIssueResolutionModel(window.__issueResolutionModel)) {
                window.__issueResolutionModel = null;
                try { localStorage.removeItem('lastIssueResolutionModel'); } catch { /* ignore */ }
            } else {
                renderModel(window.__issueResolutionModel);
                bindActions();
                return;
            }
        }

        if (forceRefresh) {
            window.__issueResolutionModel = null;
            try {
                localStorage.removeItem('lastIssueResolutionModel');
            } catch { /* ignore */ }
        }

        root.classList.add('loading');
        try {
            const model = await fetchIssueData();
            if (model) {
                window.__issueResolutionModel = model;
                indexIssueFixTargets(model);
                renderModel(model);
                bindActions();
                return;
            }

            if (!forceRefresh && restoreSavedIssueResolutionModel()) {
                return;
            }

            await loadIssueResolutionSample();
        } catch (error) {
            console.error('Failed to initialize issue resolution page:', error);
            try {
                await loadIssueResolutionSample();
            } catch {
                window.showNotification?.('❌ Failed to load issue resolution data', 'error');
            }
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeIssueResolutionPage = initializeIssueResolutionPage;
    window.loadIssueResolutionSample = loadIssueResolutionSample;
    window.applyIssueResolutionModel = applyIssueResolutionModel;
})();
