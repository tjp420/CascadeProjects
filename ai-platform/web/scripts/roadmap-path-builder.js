/**
 * Roadmap path builder — custom scan options, streaming progress UI, analysis history
 */
(function () {
    const HISTORY_KEY = 'roadmapAnalysisHistory';
    const HISTORY_PAYLOADS_KEY = 'roadmapAnalysisHistoryPayloads';
    const SCAN_PHASES = [
        { pct: 12, label: 'Validating project path…' },
        { pct: 32, label: 'Scanning directory structure…' },
        { pct: 52, label: 'Analyzing codebase metrics…' },
        { pct: 72, label: 'Detecting sprints and API routes…' },
        { pct: 88, label: 'Phase 2: cycles, fuzzy match, resources…' }
    ];

    let progressTimer = null;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    async function parseApiJsonResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        if (!contentType.includes('application/json')) {
            const htmlHint = text.trimStart().startsWith('<!')
                ? 'Server returned HTML instead of JSON. Run start-localhost.bat (port 54355) or restart your server after updating.'
                : 'Server returned a non-JSON response';
            throw new Error(`${htmlHint} (HTTP ${response.status})`);
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error('Invalid JSON from server: ' + error.message);
        }
    }

    function parseCsvList(value) {
        return String(value || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function readScanOptions() {
        return {
            includePaths: parseCsvList(document.getElementById('roadmap-include-paths')?.value),
            excludePatterns: parseCsvList(document.getElementById('roadmap-exclude-patterns')?.value)
        };
    }

    function persistScanOptions(options) {
        try {
            localStorage.setItem('roadmapScanOptions', JSON.stringify(options));
        } catch (error) {
            /* ignore */
        }
    }

    function restoreScanOptions() {
        try {
            const raw = localStorage.getItem('roadmapScanOptions');
            if (!raw) return;
            const saved = JSON.parse(raw);
            const includeInput = document.getElementById('roadmap-include-paths');
            const excludeInput = document.getElementById('roadmap-exclude-patterns');
            if (includeInput && saved.includePaths?.length) {
                includeInput.value = saved.includePaths.join(', ');
            }
            if (excludeInput && saved.excludePatterns?.length) {
                excludeInput.value = saved.excludePatterns.join(', ');
            }
        } catch (error) {
            /* ignore */
        }
    }

    function showScanProgress(active, phaseIndex = 0) {
        const container = document.getElementById('roadmap-scan-progress');
        const bar = document.getElementById('roadmap-scan-progress-bar');
        const text = document.getElementById('roadmap-scan-progress-text');
        if (!container || !bar || !text) return;

        if (!active) {
            container.style.display = 'none';
            bar.style.width = '0%';
            text.textContent = '';
            if (progressTimer) {
                clearInterval(progressTimer);
                progressTimer = null;
            }
            return;
        }

        container.style.display = 'block';
        const phase = SCAN_PHASES[Math.min(phaseIndex, SCAN_PHASES.length - 1)];
        bar.style.width = `${phase.pct}%`;
        text.textContent = phase.label;
    }

    function startScanProgress() {
        let phaseIndex = 0;
        showScanProgress(true, phaseIndex);
        progressTimer = setInterval(() => {
            phaseIndex = Math.min(phaseIndex + 1, SCAN_PHASES.length - 1);
            showScanProgress(true, phaseIndex);
        }, 1400);
    }

    function completeScanProgress() {
        const bar = document.getElementById('roadmap-scan-progress-bar');
        const text = document.getElementById('roadmap-scan-progress-text');
        if (bar) bar.style.width = '100%';
        if (text) text.textContent = 'Finalizing roadmap…';
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
        setTimeout(() => showScanProgress(false), 600);
    }

    function readLocalHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            return [];
        }
    }

    function writeLocalHistory(entries) {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 25)));
        } catch (error) {
            /* ignore */
        }
    }

    function readHistoryPayloads() {
        try {
            const raw = localStorage.getItem(HISTORY_PAYLOADS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            return {};
        }
    }

    function writeHistoryPayload(id, roadmap) {
        try {
            const payloads = readHistoryPayloads();
            payloads[id] = roadmap;
            const keys = Object.keys(payloads);
            if (keys.length > 25) {
                keys.slice(0, keys.length - 25).forEach((key) => delete payloads[key]);
            }
            localStorage.setItem(HISTORY_PAYLOADS_KEY, JSON.stringify(payloads));
        } catch (error) {
            /* ignore */
        }
    }

    function normalizeProgressPercent(value) {
        if (value == null || value === '') return null;
        const num = Number(value);
        if (Number.isNaN(num)) return null;
        const pct = num <= 1 ? num * 100 : num;
        return Math.round(Math.max(0, Math.min(100, pct)));
    }

    function extractRoadmapHistoryMetrics(roadmap) {
        const progressRaw = roadmap?.executiveSummary?.completionRate
            ?? roadmap?.progressMetrics?.overall
            ?? roadmap?.developmentProgress?.overall
            ?? roadmap?.projectOverview?.completionRate;

        const filesScanned = roadmap?.codeAnalysis?.structure?.totalFiles
            ?? roadmap?.projectStructure?.totalFiles
            ?? null;

        return {
            progressPercent: normalizeProgressPercent(progressRaw),
            filesScanned: filesScanned != null ? Number(filesScanned) : null,
            projectHealth: roadmap?.executiveSummary?.projectHealth
                ?? roadmap?.projectOverview?.projectHealth
                ?? null
        };
    }

    function createHistoryEntry(projectPath, title, roadmap, scanOptions, existingEntry) {
        const metrics = extractRoadmapHistoryMetrics(roadmap);
        return {
            id: existingEntry?.id || `scan-${Date.now()}`,
            projectPath,
            title: title || roadmap?.projectTitle || pathBasename(projectPath),
            timestamp: existingEntry?.timestamp || new Date().toISOString(),
            filesScanned: metrics.filesScanned,
            progressPercent: metrics.progressPercent,
            projectHealth: metrics.projectHealth,
            includePaths: scanOptions.includePaths || [],
            excludePatterns: scanOptions.excludePatterns || []
        };
    }

    function dedupeHistoryEntries(entries) {
        const deduped = [];
        entries.forEach((entry) => {
            const prev = deduped[deduped.length - 1];
            if (!prev) {
                deduped.push(entry);
                return;
            }
            const sameSnapshot = prev.projectPath === entry.projectPath
                && prev.progressPercent === entry.progressPercent
                && prev.filesScanned === entry.filesScanned
                && prev.projectHealth === entry.projectHealth;
            const prevTime = new Date(prev.timestamp).getTime();
            const entryTime = new Date(entry.timestamp).getTime();
            const withinWindow = !Number.isNaN(prevTime) && !Number.isNaN(entryTime)
                && Math.abs(prevTime - entryTime) <= 15 * 60 * 1000;
            if (sameSnapshot && withinWindow) {
                return;
            }
            deduped.push(entry);
        });
        return deduped;
    }

    function reconcileHistoryEntries() {
        const entries = readLocalHistory();
        const payloads = readHistoryPayloads();
        let changed = false;

        const reconciled = entries.map((entry) => {
            const payload = payloads[entry.id];
            if (!payload) return entry;

            const refreshed = createHistoryEntry(
                entry.projectPath,
                entry.title,
                payload,
                {
                    includePaths: entry.includePaths || [],
                    excludePatterns: entry.excludePatterns || []
                },
                entry
            );

            if (refreshed.progressPercent !== entry.progressPercent
                || refreshed.filesScanned !== entry.filesScanned
                || refreshed.projectHealth !== entry.projectHealth) {
                changed = true;
            }
            return refreshed;
        });

        const deduped = dedupeHistoryEntries(reconciled);
        if (changed || deduped.length !== entries.length) {
            writeLocalHistory(deduped);
        }
        return deduped;
    }

    function pathBasename(projectPath) {
        const parts = String(projectPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
        return parts[parts.length - 1] || 'Project';
    }

    async function syncHistoryEntry(entry) {
        try {
            const response = await fetch('/api/dynamic-roadmap/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entry })
            });
            if (response.status === 404) {
                return;
            }
        } catch (error) {
            console.warn('Roadmap history sync failed:', error.message);
        }
    }

    async function mergeServerHistory() {
        try {
            const response = await fetch('/api/dynamic-roadmap/history');
            if (response.status === 404) {
                return;
            }
            if (!response.ok) return;
            const data = await parseApiJsonResponse(response);
            if (!Array.isArray(data.entries) || data.source !== 'postgresql') return;

            const local = readLocalHistory();
            const merged = [...data.entries];
            local.forEach((item) => {
                if (!merged.some((entry) => entry.id === item.id)) {
                    merged.push(item);
                }
            });
            merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            writeLocalHistory(merged.slice(0, 25));
        } catch (error) {
            /* optional server history */
        }
    }

    function isStaleHistoryEntry(entry, roadmap) {
        if (typeof window.isStaleDevelopmentRoadmap === 'function' && roadmap) {
            return window.isStaleDevelopmentRoadmap(roadmap, entry.projectPath);
        }
        return entry.progressPercent === 73 && entry.filesScanned === 187;
    }

    function formatHistoryHealth(health) {
        if (!health) return '';
        const label = String(health);
        const cssClass = label.toLowerCase() === 'healthy'
            ? 'roadmap-history-health roadmap-history-health--healthy'
            : 'roadmap-history-health';
        return `<span class="${cssClass}">${escapeHtml(label)}</span>`;
    }

    function renderAnalysisHistory() {
        const container = document.getElementById('roadmap-history-list');
        if (!container) return;

        const payloads = readHistoryPayloads();
        const entries = reconcileHistoryEntries();
        if (!entries.length) {
            container.innerHTML = '<p class="text-muted" style="margin:0">No analysis history yet — generate a roadmap to see past scans here.</p>';
            return;
        }

        container.innerHTML = entries.map((entry) => {
            const date = new Date(entry.timestamp);
            const formatted = Number.isNaN(date.getTime()) ? entry.timestamp : date.toLocaleString();
            const progress = entry.progressPercent != null ? `${entry.progressPercent}% complete` : 'completion n/a';
            const files = entry.filesScanned != null
                ? `${entry.filesScanned.toLocaleString()} files`
                : 'scan saved';
            const payload = payloads[entry.id];
            const stale = isStaleHistoryEntry(entry, payload);
            const health = stale
                ? '<span class="roadmap-history-health roadmap-history-health--stale">Stale scan</span>'
                : formatHistoryHealth(entry.projectHealth);
            const healthSuffix = health ? ` · ${health}` : '';
            return `
                <button type="button" class="roadmap-history-item${stale ? ' roadmap-history-item--stale' : ''}" data-history-id="${escapeHtml(entry.id)}">
                    <span class="roadmap-history-title">${escapeHtml(entry.title || entry.projectPath)}</span>
                    <span class="roadmap-history-meta">${escapeHtml(formatted)} · ${files} · ${escapeHtml(progress)}${healthSuffix}</span>
                    <code class="roadmap-history-path">${escapeHtml(entry.projectPath)}</code>
                </button>
            `;
        }).join('');
    }

    async function recordAnalysisHistory(projectPath, title, roadmap, scanOptions) {
        const entry = createHistoryEntry(projectPath, title, roadmap, scanOptions);
        const entries = dedupeHistoryEntries(
            [entry, ...readLocalHistory().filter((item) => item.id !== entry.id)]
        ).slice(0, 25);
        writeLocalHistory(entries);
        writeHistoryPayload(entry.id, roadmap);
        renderAnalysisHistory();
        await syncHistoryEntry(entry);
        return entry;
    }

    async function buildRoadmapFromPath() {
        const pathInput = document.getElementById('roadmap-project-path');
        const titleInput = document.getElementById('roadmap-project-title');
        const statusEl = document.getElementById('roadmap-build-status');
        const resultsEl = document.getElementById('roadmap-build-results');

        const projectPath = pathInput?.value?.trim();
        if (!projectPath) {
            window.showNotification?.('Enter the folder path for the software you are building', 'warning');
            return;
        }

        const scanOptions = readScanOptions();
        persistScanOptions(scanOptions);

        try {
            localStorage.setItem('roadmapProjectPath', projectPath);
        } catch (error) {
            /* ignore */
        }

        if (statusEl) {
            statusEl.innerHTML = '<span style="color: #60a5fa">⏳ Scanning project and building AI roadmap…</span>';
        }
        if (resultsEl) {
            resultsEl.style.display = 'none';
            resultsEl.innerHTML = '';
        }

        startScanProgress();
        window.showNotification?.('🤖 Analyzing project and generating roadmap…', 'info');

        try {
            const response = await fetch('/api/dynamic-roadmap/build-from-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath,
                    title: titleInput?.value?.trim() || undefined,
                    includePaths: scanOptions.includePaths,
                    excludePatterns: scanOptions.excludePatterns
                })
            });

            const data = await parseApiJsonResponse(response);
            if (!response.ok || !data.success) {
                throw new Error(data.message || data.error || 'Roadmap generation failed');
            }

            completeScanProgress();

            if (typeof window.applyGeneratedRoadmapToDashboard === 'function') {
                window.applyGeneratedRoadmapToDashboard(data.roadmap, data.projectPath);
            }

            if (typeof window.writeCachedCodeRoadmapGenerator === 'function') {
                window.writeCachedCodeRoadmapGenerator(data.projectPath, data.roadmap);
            } else {
                try {
                    sessionStorage.setItem('codeRoadmapGeneratorSnapshot', JSON.stringify({
                        at: Date.now(),
                        projectPath: data.projectPath,
                        roadmap: data.roadmap
                    }));
                } catch {
                    /* ignore */
                }
            }

            await recordAnalysisHistory(
                data.projectPath,
                titleInput?.value?.trim(),
                data.roadmap,
                scanOptions
            );

            if (statusEl) {
                statusEl.innerHTML = `<span style="color: #34d399">✅ Roadmap generated from <code style="font-size:0.85em;">${escapeHtml(data.projectPath)}</code></span>`;
            }

            window.showNotification?.('✅ AI roadmap generated for your project', 'success');
        } catch (error) {
            console.error('buildRoadmapFromPath:', error);
            showScanProgress(false);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color: #f87171">❌ ${escapeHtml(error.message)}</span>`;
            }
            window.showNotification?.('❌ ' + error.message, 'error');
        }
    }

    function loadRoadmapAnalysisHistoryItem(id) {
        const entries = readLocalHistory();
        const entry = entries.find((item) => item.id === id);
        if (!entry) return;

        const pathInput = document.getElementById('roadmap-project-path');
        const titleInput = document.getElementById('roadmap-project-title');
        const includeInput = document.getElementById('roadmap-include-paths');
        const excludeInput = document.getElementById('roadmap-exclude-patterns');

        if (pathInput) pathInput.value = entry.projectPath || '';
        if (titleInput) titleInput.value = entry.title || '';
        if (includeInput && entry.includePaths?.length) {
            includeInput.value = entry.includePaths.join(', ');
        }
        if (excludeInput && entry.excludePatterns?.length) {
            excludeInput.value = entry.excludePatterns.join(', ');
        }

        const payloads = readHistoryPayloads();
        const roadmap = payloads[id];
        if (roadmap && typeof window.isStaleDevelopmentRoadmap === 'function'
            && window.isStaleDevelopmentRoadmap(roadmap, entry.projectPath)) {
            try {
                delete payloads[id];
                localStorage.setItem(HISTORY_PAYLOADS_KEY, JSON.stringify(payloads));
            } catch (error) {
                /* ignore */
            }
            window.showNotification?.('❌ Stale roadmap history removed — re-run scan or load sample', 'warning');
            return;
        }
        if (roadmap && typeof window.applyGeneratedRoadmapToDashboard === 'function') {
            window.applyGeneratedRoadmapToDashboard(roadmap, entry.projectPath);
            window.showNotification?.('✅ Restored roadmap from analysis history', 'success');
            return;
        }

        window.showNotification?.('Re-running scan for saved path…', 'info');
        buildRoadmapFromPath();
    }

    async function clearRoadmapAnalysisHistory() {
        writeLocalHistory([]);
        try {
            localStorage.removeItem(HISTORY_PAYLOADS_KEY);
        } catch (error) {
            /* ignore */
        }

        try {
            await fetch('/api/dynamic-roadmap/history', { method: 'DELETE' });
        } catch (error) {
            /* optional */
        }

        renderAnalysisHistory();
        window.showNotification?.('Analysis history cleared', 'info');
    }

    function bindRoadmapPathBuilderUi() {
        document.getElementById('roadmap-history-list')?.addEventListener('click', (event) => {
            const item = event.target.closest('[data-history-id]');
            if (item?.dataset.historyId) {
                loadRoadmapAnalysisHistoryItem(item.dataset.historyId);
            }
        });

        document.getElementById('roadmap-clear-history')?.addEventListener('click', () => {
            clearRoadmapAnalysisHistory();
        });

        document.getElementById('roadmap-browse-path-btn')?.addEventListener('click', () => {
            document.getElementById('roadmap-folder-picker')?.click();
        });

        document.getElementById('roadmap-folder-picker')?.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const relative = file.webkitRelativePath || file.name;
            const rootName = relative.split(/[/\\]/)[0];
            const pathInput = document.getElementById('roadmap-project-path');
            if (pathInput && !pathInput.value.trim() && rootName) {
                pathInput.placeholder = `Full path ending in ${rootName} — or drop folder on global data bar`;
            }
            window.showNotification?.(
                `Selected “${rootName}”. Enter the full disk path above, or drop the folder on the global data bar.`,
                'info'
            );
            event.target.value = '';
        });
    }

    function initRoadmapPathBuilder() {
        try {
            const saved = localStorage.getItem('roadmapProjectPath');
            const input = document.getElementById('roadmap-project-path');
            if (input && saved) {
                input.value = saved;
            }
        } catch (error) {
            /* ignore */
        }

        restoreScanOptions();
        bindRoadmapPathBuilderUi();
        mergeServerHistory().finally(renderAnalysisHistory);
    }

    window.buildRoadmapFromPath = buildRoadmapFromPath;
    window.clearRoadmapAnalysisHistory = clearRoadmapAnalysisHistory;
    window.loadRoadmapAnalysisHistoryItem = loadRoadmapAnalysisHistoryItem;
    window.readRoadmapScanOptions = readScanOptions;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRoadmapPathBuilder);
    } else {
        initRoadmapPathBuilder();
    }
})();
