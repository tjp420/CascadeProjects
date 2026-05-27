/**
 * Local AI Models Page — register, upload, and activate personal local models.
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ah';
    const SAMPLE_URL = `/data/local-models-sample.json?v=${SAMPLE_CACHE_BUST}`;
    const MAX_UPLOAD_BYTES = Number(window.MAX_GGUF_UPLOAD_BYTES || 8 * 1024 * 1024 * 1024);
    let registry = null;
    let uploadInProgress = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function providerLabel(provider) {
        const map = {
            demo: 'Demo',
            path: 'Local path',
            upload: 'Uploaded',
            ollama: 'Ollama'
        };
        return map[provider] || provider;
    }

    function statusBadge(status) {
        const cls = status === 'active' || status === 'healthy' ? 'success' : status === 'unhealthy' ? 'danger' : 'secondary';
        return `<span class="badge bg-${cls}">${escapeHtml(status || 'unknown')}</span>`;
    }

    function formatHashShort(hash) {
        if (!hash) return '';
        const value = String(hash).replace(/^sha256-/i, '');
        if (value.length <= 16) return value;
        return `${value.slice(0, 12)}…${value.slice(-8)}`;
    }

    function buildHashCounts(models) {
        const counts = {};
        for (const model of models || []) {
            if (model.hash) counts[model.hash] = (counts[model.hash] || 0) + 1;
        }
        return counts;
    }

    function renderHashLine(model, hashCounts) {
        if (!model.path && !model.hash) return '';
        const duplicateCount = model.hash ? hashCounts[model.hash] || 0 : 0;
        const duplicateBadge = duplicateCount > 1
            ? `<span class="badge bg-warning text-dark" title="Same SHA256 as ${duplicateCount - 1} other model(s)">duplicate ×${duplicateCount}</span>`
            : '';
        if (model.hash) {
            return `
                <div class="lm-model-hash">
                    <span class="lm-hash-label">SHA256</span>
                    <code class="lm-hash-value" title="${escapeHtml(model.hash)}">${escapeHtml(formatHashShort(model.hash))}</code>
                    <button type="button" class="btn btn-sm btn-link lm-hash-copy" data-action="copy-hash" data-hash="${escapeHtml(model.hash)}" title="Copy full SHA256">Copy</button>
                    ${duplicateBadge}
                </div>`;
        }
        return `
            <div class="lm-model-hash">
                <span class="text-muted">SHA256 not computed</span>
                <button type="button" class="btn btn-sm btn-outline-light" data-action="compute-hash" data-model-id="${escapeHtml(model.id)}">Compute</button>
            </div>`;
    }

    async function hashFilePreview(file) {
        if (!window.crypto?.subtle || !file) return null;
        const maxPreviewBytes = 256 * 1024 * 1024;
        if (file.size > maxPreviewBytes) return null;
        const buffer = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
        return `sha256-${hex}`;
    }

    function isStaleLocalModelsSample(sample) {
        const overview = sample?.overview || {};
        if (overview.registeredName === 'agi-chatbot-test') return true;
        if (Number(overview.totalModels) === 1 && overview.registeredName !== 'phi-2.Q4_K_M.gguf') return true;
        return false;
    }

    function buildSampleRegistryFallback(sample) {
        const overview = sample?.overview || {};
        const models = (sample?.models || []).map((model) => ({
            ...model,
            isDemo: model.provider === 'demo'
        }));
        const activeModelId = sample?.activeModelId
            || models.find((model) => model.status === 'active')?.id
            || models[0]?.id;
        const activeModel = models.find((model) => model.id === activeModelId)
            || models.find((model) => model.status === 'active')
            || models[0]
            || null;

        if (models.length) {
            return {
                success: true,
                activeModelId,
                ollamaBaseUrl: sample?.ollamaBaseUrl || 'http://127.0.0.1:11434',
                models,
                activeModel,
                isSampleFallback: true
            };
        }

        const modelName = overview.registeredName || 'phi-2.Q4_K_M.gguf';
        return {
            success: true,
            activeModelId: 'sample-fallback',
            ollamaBaseUrl: sample?.ollamaBaseUrl || 'http://127.0.0.1:11434',
            models: [{
                id: 'sample-fallback',
                name: modelName,
                provider: 'upload',
                type: 'GGUF',
                status: 'active',
                size: overview.registeredSize || '1.7GB',
                description: overview.inferenceMode
                    ? `${overview.inferenceMode} — start server for live registry`
                    : 'Sample fallback — start server for live registry',
                isDefault: false,
                testStatus: 'sample',
                isDemo: true
            }],
            activeModel: {
                id: 'sample-fallback',
                name: modelName,
                provider: 'upload',
                type: 'GGUF',
                status: 'active',
                size: overview.registeredSize || '1.7GB',
                isDemo: true
            },
            isSampleFallback: true
        };
    }

    async function fetchRegistry(forceApi = false) {
        try {
            const response = await fetch('/api/models');
            if (response.ok) {
                registry = await response.json();
                return registry;
            }
        } catch (error) {
            if (forceApi) console.warn('Models API refresh failed:', error.message);
        }

        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const sample = await response.json();
                if (!isStaleLocalModelsSample(sample)) {
                    return buildSampleRegistryFallback(sample);
                }
            }
        } catch (error) {
            console.warn('Local models sample failed:', error.message);
        }

        return buildSampleRegistryFallback({
            overview: {
                registeredName: 'phi-2.Q4_K_M.gguf',
                registeredSize: '1.7GB',
                inferenceMode: 'filesystem+gguf-path'
            },
            activeModelId: 'phi-2-q4-k-m-gguf-mpi2xzy1',
            models: [
                {
                    id: 'phi-2-q4-k-m-gguf-mpi2xzy1',
                    name: 'phi-2.Q4_K_M.gguf',
                    provider: 'upload',
                    type: 'GGUF',
                    status: 'active',
                    size: '1.7GB',
                    description: 'Sample fallback — start server for live registry',
                    testStatus: 'sample'
                }
            ]
        });
    }

    function renderPage(data) {
        registry = data;
        renderHeader(data);
        renderActiveModel(data.activeModel, data.models || []);
        renderModels(data.models || [], data.activeModelId);
        renderProviders();
        fetchOrphanedUploads().then(renderOrphanedUploads);
    }

    function renderHeader(data) {
        const active = data.activeModel;
        const lead = document.getElementById('local-models-page-lead');
        if (lead) {
            lead.textContent = active
                ? `Active model: ${active.name} (${providerLabel(active.provider)})`
                : 'Register and activate your personal local AI models';
        }
        const badge = document.getElementById('local-models-active-badge');
        if (badge && active) {
            badge.textContent = active.isDemo
                ? `🛡️ ${active.name} • sample fallback`
                : `🧠 ${active.name} • ${providerLabel(active.provider)}`;
        }
        const ollamaInput = document.getElementById('lm-ollama-url');
        if (ollamaInput && data.ollamaBaseUrl) ollamaInput.value = data.ollamaBaseUrl;
        const countEl = document.getElementById('lm-stat-total');
        if (countEl) countEl.textContent = String((data.models || []).length);
        const hashCountEl = document.getElementById('lm-stat-hashed');
        if (hashCountEl) {
            const hashed = (data.models || []).filter((m) => m.hash).length;
            hashCountEl.textContent = String(hashed);
        }
    }

    function renderActiveModel(active, models) {
        const panel = document.getElementById('lm-active-panel');
        if (!panel) return;
        const hashCounts = buildHashCounts(models);
        if (!active) {
            panel.innerHTML = '<p class="text-muted">No active model selected.</p>';
            return;
        }
        panel.innerHTML = `
            <div class="gguf-model-card">
                <div class="gguf-model-avatar">🧠</div>
                <div class="gguf-model-body">
                    <h3>${escapeHtml(active.name)} ${active.isDemo ? '<span class="badge bg-info">Demo</span>' : ''}</h3>
                    <p>${escapeHtml(providerLabel(active.provider))} • ${escapeHtml(active.type || 'GGUF')} ${active.size ? `• ${escapeHtml(active.size)}` : ''}</p>
                    <div class="gguf-model-meta">
                        ${active.path ? `<span>Path: <code>${escapeHtml(active.path)}</code></span>` : ''}
                        ${active.ollamaModel ? `<span>Ollama: <code>${escapeHtml(active.ollamaModel)}</code></span>` : ''}
                    </div>
                    ${renderHashLine(active, hashCounts)}
                </div>
                <div>${statusBadge(active.status || 'active')}</div>
            </div>`;
    }

    function renderModels(models, activeModelId) {
        const grid = document.getElementById('lm-models-grid');
        if (!grid) return;
        const hashCounts = buildHashCounts(models);
        if (!models.length) {
            grid.innerHTML = '<p class="text-muted">No models registered yet.</p>';
            return;
        }
        grid.innerHTML = models.map((model) => `
            <div class="action-card ${model.id === activeModelId ? 'is-active' : ''}">
                <div class="action-icon">${model.provider === 'ollama' ? '🦙' : model.provider === 'upload' ? '⬆️' : model.provider === 'path' ? '📁' : '🤖'}</div>
                <h5>${escapeHtml(model.name)} ${model.id === activeModelId ? '<span class="badge bg-success">Active</span>' : ''}</h5>
                <p>${escapeHtml(model.description || providerLabel(model.provider))}</p>
                <div class="lm-model-meta">${statusBadge(model.testStatus || model.status)} ${model.size ? `<span class="badge bg-dark">${escapeHtml(model.size)}</span>` : ''}</div>
                ${renderHashLine(model, hashCounts)}
                <div class="lm-model-actions">
                    <button type="button" class="btn btn-sm btn-primary" data-action="activate" data-model-id="${escapeHtml(model.id)}">Activate</button>
                    <button type="button" class="btn btn-sm btn-outline-light" data-action="test" data-model-id="${escapeHtml(model.id)}">Test</button>
                    ${model.isDefault ? '' : `<button type="button" class="btn btn-sm btn-outline-danger" data-action="remove" data-model-id="${escapeHtml(model.id)}">Remove</button>`}
                </div>
            </div>`).join('');
    }

    function renderProviders() {
        const list = document.getElementById('lm-providers-list');
        if (!list) return;
        list.innerHTML = `
            <div class="lm-provider-item"><span>📁</span><div><strong>Local path</strong><p>Register a .gguf file already on disk</p></div></div>
            <div class="lm-provider-item"><span>⬆️</span><div><strong>Upload</strong><p>Store models in data-central/ai-tools/ai-models/uploads</p></div></div>
            <div class="lm-provider-item"><span>🦙</span><div><strong>Ollama</strong><p>Use models served by your local Ollama instance</p></div></div>`;
    }

    async function fetchOrphanedUploads() {
        try {
            const response = await fetch('/api/models/uploads/orphans');
            if (!response.ok) return [];
            const payload = await response.json();
            return payload.orphans || [];
        } catch {
            return [];
        }
    }

    function parseOrphanTimestamp(filename) {
        const match = String(filename || '').match(/^(\d{10,})-/);
        if (!match) return null;
        const value = Number(match[1]);
        if (!Number.isFinite(value)) return null;
        return new Date(value);
    }

    function formatOrphanDate(orphan) {
        const uploadedAt = parseOrphanTimestamp(orphan.filename);
        const modifiedAt = orphan.modifiedAt ? new Date(orphan.modifiedAt) : null;
        const date = uploadedAt || modifiedAt;
        if (!date || Number.isNaN(date.getTime())) return 'Unknown upload time';
        return date.toLocaleString();
    }

    function groupOrphanedUploads(orphans) {
        const groups = new Map();
        for (const orphan of orphans) {
            const key = `${orphan.displayName || orphan.filename}|${orphan.bytes || 0}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(orphan);
        }

        return [...groups.values()]
            .map((copies) => {
                const sorted = copies.slice().sort((a, b) => {
                    const aTime = parseOrphanTimestamp(a.filename)?.getTime()
                        || new Date(a.modifiedAt || 0).getTime()
                        || 0;
                    const bTime = parseOrphanTimestamp(b.filename)?.getTime()
                        || new Date(b.modifiedAt || 0).getTime()
                        || 0;
                    return bTime - aTime;
                });
                return {
                    primary: sorted[0],
                    copies: sorted,
                    count: sorted.length
                };
            })
            .sort((a, b) => (b.primary.bytes || 0) - (a.primary.bytes || 0));
    }

    function renderOrphanSummary(orphans, groups) {
        const summary = document.getElementById('lm-orphans-summary');
        const toolbar = document.getElementById('lm-orphans-toolbar');
        const countEl = document.getElementById('lm-orphans-count');
        const footnote = document.getElementById('lm-orphans-footnote');
        if (!summary || !toolbar || !countEl || !footnote) return;

        const totalBytes = orphans.reduce((sum, item) => sum + (item.bytes || 0), 0);
        const duplicateFiles = Math.max(0, orphans.length - groups.length);

        summary.innerHTML = `
            <span class="lm-orphans-chip">${orphans.length} file${orphans.length === 1 ? '' : 's'}</span>
            <span class="lm-orphans-chip">${groups.length} unique model${groups.length === 1 ? '' : 's'}</span>
            <span class="lm-orphans-chip">${formatBytesLabel(totalBytes)} on disk</span>`;

        countEl.textContent = duplicateFiles > 0
            ? `${duplicateFiles} duplicate upload${duplicateFiles === 1 ? '' : 's'} hidden by grouping`
            : 'No duplicate uploads detected';
        toolbar.hidden = false;

        if (orphans.length > 12) {
            footnote.hidden = false;
            footnote.textContent = `Showing the ${Math.min(groups.length, 12)} largest unique models. ${orphans.length - 12} additional unregistered file(s) remain in uploads/.`;
        } else if (duplicateFiles > 0) {
            footnote.hidden = false;
            footnote.textContent = 'Register the latest copy for each model. Older duplicate files can be deleted manually from uploads/ after registration.';
        } else {
            footnote.hidden = true;
            footnote.textContent = '';
        }
    }

    function renderOrphanCopyList(copies) {
        return copies.map((copy) => `
            <div class="lm-orphan-copy-row">
                <code>${escapeHtml(copy.filename)}</code>
                <button type="button" class="btn btn-sm btn-outline-light" data-action="recover-upload" data-filename="${escapeHtml(copy.filename)}">Register</button>
            </div>`).join('');
    }

    function renderOrphanCard(group) {
        const { primary, copies, count } = group;
        const displayName = primary.displayName || primary.filename;
        const latestLabel = formatOrphanDate(primary);
        const duplicateBadge = count > 1
            ? `<span class="badge bg-warning text-dark">${count} copies</span>`
            : '';
        const registerLabel = count > 1 ? 'Register latest' : 'Register';
        const copiesBlock = count > 1
            ? `<details class="lm-orphan-copies">
                    <summary>Show ${count - 1} older duplicate${count - 1 === 1 ? '' : 's'}</summary>
                    <div class="lm-orphan-copy-list">${renderOrphanCopyList(copies.slice(1))}</div>
               </details>`
            : '';

        return `
            <article class="lm-orphan-card" role="listitem">
                <div class="lm-orphan-card-main">
                    <div class="lm-orphan-file-icon" aria-hidden="true">📦</div>
                    <div class="lm-orphan-body">
                        <div class="lm-orphan-title-row">
                            <strong>${escapeHtml(displayName)}</strong>
                            ${duplicateBadge}
                        </div>
                        <div class="lm-orphan-meta">${escapeHtml(primary.size || formatBytesLabel(primary.bytes || 0))}${count > 1 ? ' each' : ''} · latest ${escapeHtml(latestLabel)}</div>
                        <div class="lm-orphan-path">${escapeHtml(primary.filename)}</div>
                    </div>
                    <div class="lm-orphan-actions">
                        <button type="button" class="btn btn-sm btn-outline-light lm-orphan-register" data-action="recover-upload" data-filename="${escapeHtml(primary.filename)}">${registerLabel}</button>
                    </div>
                </div>
                ${copiesBlock}
            </article>`;
    }

    function renderOrphanedUploads(orphans) {
        const panel = document.getElementById('lm-orphans-panel');
        const list = document.getElementById('lm-orphans-list');
        if (!panel || !list) return;
        if (!orphans.length) {
            panel.hidden = true;
            list.innerHTML = '';
            document.getElementById('lm-orphans-summary')?.replaceChildren();
            document.getElementById('lm-orphans-toolbar')?.setAttribute('hidden', '');
            document.getElementById('lm-orphans-footnote')?.setAttribute('hidden', '');
            return;
        }

        const groups = groupOrphanedUploads(orphans);
        panel.hidden = false;
        renderOrphanSummary(orphans, groups);
        list.innerHTML = groups.slice(0, 12).map(renderOrphanCard).join('');
    }

    function setStatus(message, type = 'info') {
        const el = document.getElementById('lm-status');
        if (el) {
            const color = type === 'success' ? '#34d399' : type === 'error' ? '#f87171' : '#60a5fa';
            el.innerHTML = `<span style="color:${color}">${escapeHtml(message)}</span>`;
        }
        window.showNotification?.(message, type === 'error' ? 'error' : type);
    }

    async function refreshRegistry() {
        const root = document.getElementById('local-models-root');
        root?.classList.add('loading');
        try {
            const data = await fetchRegistry(true);
            if (!data) throw new Error('Could not load model registry');
            renderPage(data);
            setStatus('Registry refreshed', 'success');
        } catch (error) {
            setStatus(error.message, 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function activateModelById(modelId) {
        const response = await fetch(`/api/models/${encodeURIComponent(modelId)}/activate`, { method: 'POST' });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Activate failed');
        window.dispatchEvent(new CustomEvent('active-model-changed', { detail: payload.activeModel }));
        await refreshRegistry();
        setStatus(`Activated ${payload.activeModel.name}`, 'success');
    }

    async function testModelById(modelId) {
        const response = await fetch(`/api/models/${encodeURIComponent(modelId)}/test`, { method: 'POST' });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Test failed');
        setStatus(payload.message || 'Test complete', payload.ok ? 'success' : 'error');
        await refreshRegistry();
    }

    async function computeModelHash(modelId) {
        setStatus('Computing SHA256…', 'info');
        const response = await fetch(`/api/models/${encodeURIComponent(modelId)}/hash`, { method: 'POST' });
        const payload = await parseJsonResponse(response);
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Hash computation failed');
        await refreshRegistry();
        setStatus(`SHA256: ${formatHashShort(payload.hash)}`, 'success');
    }

    async function copyModelHash(hash) {
        if (!hash) return;
        await navigator.clipboard.writeText(hash);
        setStatus('SHA256 copied to clipboard', 'success');
    }

    async function removeModelById(modelId) {
        const response = await fetch(`/api/models/${encodeURIComponent(modelId)}`, { method: 'DELETE' });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Remove failed');
        await refreshRegistry();
        setStatus('Model removed', 'success');
    }

    async function registerPathModel() {
        const name = document.getElementById('lm-path-name')?.value.trim();
        const filePath = document.getElementById('lm-path-file')?.value.trim();
        const description = document.getElementById('lm-path-description')?.value.trim();
        if (!name) throw new Error('Display name is required');
        if (!filePath) throw new Error('Local file path is required');
        const response = await fetch('/api/models/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, path: filePath, provider: 'path', description })
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Registration failed');
        await refreshRegistry();
        setStatus(
            payload.deduplicated
                ? `${payload.model.name} already registered (same SHA256)`
                : `Registered ${payload.model.name}${payload.model.hash ? ` — ${formatHashShort(payload.model.hash)}` : ''}`,
            'success'
        );
    }

    async function registerOllamaModel() {
        const name = document.getElementById('lm-ollama-name')?.value.trim();
        const ollamaModel = document.getElementById('lm-ollama-model')?.value.trim();
        const ollamaBaseUrl = document.getElementById('lm-ollama-url')?.value.trim();
        const description = document.getElementById('lm-ollama-description')?.value.trim();
        if (!name) throw new Error('Display name is required for Ollama registration');
        if (!ollamaModel) throw new Error('Ollama model name is required (e.g. llama3.2)');
        const response = await fetch('/api/models/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ollamaModel, provider: 'ollama', ollamaBaseUrl, description })
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Ollama registration failed');
        await refreshRegistry();
        setStatus(`Registered Ollama model ${payload.model.name}`, 'success');
    }

    async function recoverOrphanedUpload(filename, button) {
        button?.classList.add('is-busy');
        if (button) button.textContent = 'Registering…';
        try {
            const response = await fetch('/api/models/uploads/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            const payload = await parseJsonResponse(response);
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Recovery failed');
            await refreshRegistry();
            const label = payload.deduplicated ? 'already registered' : 'registered';
            setStatus(`${payload.model.name} ${label}`, 'success');
        } finally {
            if (button) {
                button.classList.remove('is-busy');
                button.textContent = button.dataset.defaultLabel || 'Register';
            }
        }
    }

    async function refreshOrphanedUploads() {
        renderOrphanedUploads(await fetchOrphanedUploads());
    }

    function formatBytesLabel(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit += 1;
        }
        return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
    }

    async function parseJsonResponse(response) {
        const text = await response.text();
        try {
            return text ? JSON.parse(text) : {};
        } catch {
            throw new Error(text?.slice(0, 180) || `Upload failed (${response.status})`);
        }
    }

    function setUploadBusy(isBusy, label) {
        uploadInProgress = isBusy;
        const btn = document.getElementById('lm-upload-btn');
        const root = document.getElementById('local-models-root');
        if (btn) {
            btn.disabled = isBusy;
            btn.textContent = isBusy ? (label || 'Uploading…') : 'Upload model';
        }
        root?.classList.toggle('loading', isBusy);
    }

    async function uploadModelFile() {
        if (uploadInProgress) return;
        const fileInput = document.getElementById('lm-upload-file');
        const file = fileInput?.files?.[0];
        if (!file) throw new Error('Choose a .gguf file to upload');
        if (!/\.gguf$/i.test(file.name)) throw new Error('Only .gguf model files are supported');
        if (file.size > MAX_UPLOAD_BYTES) {
            throw new Error(`File is ${formatBytesLabel(file.size)} — max upload is ${formatBytesLabel(MAX_UPLOAD_BYTES)}. Use Register local path instead.`);
        }

        const form = new FormData();
        form.append('model', file);
        form.append('name', document.getElementById('lm-upload-name')?.value.trim() || file.name.replace(/\.gguf$/i, ''));
        form.append('description', document.getElementById('lm-upload-description')?.value.trim() || '');

        setUploadBusy(true, `Uploading ${formatBytesLabel(file.size)}…`);
        setStatus(`Uploading ${file.name} (${formatBytesLabel(file.size)})…`, 'info');
        try {
            const response = await fetch('/api/models/upload', { method: 'POST', body: form });
            const payload = await parseJsonResponse(response);
            if (!response.ok || !payload.success) {
                const hint = /2 GiB|greater than 2/i.test(payload.error || '')
                    ? ' Restart the dashboard server and hard-refresh (Ctrl+Shift+R), or use Register local path / Recover uploads below.'
                    : '';
                throw new Error((payload.error || 'Upload failed') + hint);
            }
            fileInput.value = '';
            await refreshRegistry();
            setStatus(
                payload.deduplicated
                    ? `${payload.model.name} is already registered — skipped duplicate upload`
                    : `Uploaded ${payload.model.name}${payload.model.hash ? ` — ${formatHashShort(payload.model.hash)}` : ''}`,
                'success'
            );
        } finally {
            setUploadBusy(false);
        }
    }

    function bindActions() {
        if (window.__localModelsBound) return;
        window.__localModelsBound = true;

        document.getElementById('local-models-root')?.addEventListener('click', async (event) => {
            const btn = event.target.closest('[data-action]');
            if (!btn) return;
            try {
                if (btn.dataset.action === 'activate') await activateModelById(btn.dataset.modelId);
                if (btn.dataset.action === 'test') await testModelById(btn.dataset.modelId);
                if (btn.dataset.action === 'remove') await removeModelById(btn.dataset.modelId);
                if (btn.dataset.action === 'recover-upload') {
                    if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent.trim();
                    await recoverOrphanedUpload(btn.dataset.filename, btn);
                }
                if (btn.dataset.action === 'compute-hash') await computeModelHash(btn.dataset.modelId);
                if (btn.dataset.action === 'copy-hash') await copyModelHash(btn.dataset.hash);
            } catch (error) {
                setStatus(error.message, 'error');
            }
        });

        document.getElementById('lm-refresh')?.addEventListener('click', () => refreshRegistry());
        document.getElementById('lm-orphans-refresh')?.addEventListener('click', () => {
            refreshOrphanedUploads().catch((error) => setStatus(error.message, 'error'));
        });
        document.getElementById('lm-run-analysis')?.addEventListener('click', async () => {
            try {
                if (typeof window.runGgufModelAnalysis === 'function') {
                    const payload = await window.runGgufModelAnalysis('active');
                    setStatus(
                        `Analysis complete (${payload.inferenceMode}) — ${payload.scanSummary?.totalFiles ?? 0} files`,
                        'success'
                    );
                    const navLink = document.querySelector(".nav-link[onclick*=\"'gguf-analysis'\"]");
                    window.showSection?.('gguf-analysis', navLink);
                } else {
                    throw new Error('GGUF analysis page is not loaded');
                }
            } catch (error) {
                setStatus(error.message, 'error');
            }
        });
        document.getElementById('lm-register-path')?.addEventListener('click', () => registerPathModel().catch((e) => setStatus(e.message, 'error')));
        document.getElementById('lm-register-ollama')?.addEventListener('click', () => registerOllamaModel().catch((e) => setStatus(e.message, 'error')));
        document.getElementById('lm-upload-btn')?.addEventListener('click', () => uploadModelFile().catch((e) => setStatus(e.message, 'error')));
        document.getElementById('lm-upload-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            const previewEl = document.getElementById('lm-upload-hash-preview');
            if (!previewEl) return;
            if (!file) {
                previewEl.textContent = '';
                return;
            }
            previewEl.textContent = 'Reading SHA256…';
            try {
                const hash = await hashFilePreview(file);
                previewEl.textContent = hash
                    ? `Client SHA256: ${formatHashShort(hash)} (full hash computed on server after upload)`
                    : `SHA256 will be computed on the server (${formatBytesLabel(file.size)} file)`;
            } catch {
                previewEl.textContent = 'SHA256 will be computed on the server after upload';
            }
        });
        document.getElementById('lm-test-ollama')?.addEventListener('click', async () => {
            const response = await fetch('/api/models/test-ollama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ollamaBaseUrl: document.getElementById('lm-ollama-url')?.value.trim() })
            });
            const payload = await response.json();
            setStatus(payload.message, payload.ok ? 'success' : 'error');
        });
        document.getElementById('lm-save-ollama-url')?.addEventListener('click', async () => {
            const response = await fetch('/api/models/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ollamaBaseUrl: document.getElementById('lm-ollama-url')?.value.trim() })
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Save failed');
            setStatus('Ollama URL saved', 'success');
        });
        document.getElementById('lm-open-analyzer')?.addEventListener('click', () => {
            const navLink = document.querySelector(".nav-link[onclick*=\"'gguf-analysis'\"]");
            window.showSection?.('gguf-analysis', navLink);
        });
    }

    async function initializeLocalModelsPage(forceRefresh = false) {
        const root = document.getElementById('local-models-root');
        if (!root) return;
        if (registry && !forceRefresh) {
            renderPage(registry);
            bindActions();
            return;
        }
        root.classList.add('loading');
        try {
            const data = await fetchRegistry(forceRefresh);
            if (!data) throw new Error('No local models data available');
            renderPage(data);
            bindActions();
        } catch (error) {
            setStatus(error.message, 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.initializeLocalModelsPage = initializeLocalModelsPage;
    window.refreshLocalModelsRegistry = refreshRegistry;
    window.fetchActiveModelInfo = async function fetchActiveModelInfo() {
        try {
            const response = await fetch('/api/models/active');
            if (!response.ok) return null;
            const payload = await response.json();
            return payload.activeModel || null;
        } catch {
            return null;
        }
    };
})();
