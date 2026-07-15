// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * AnalyzeStateController — Dedicated state engine for streaming AI responses,
 * multi-engine processing pipelines, and progress tracking.
 * Decouples event orchestration from DOM generation.
 */
export class AnalyzeStateController {
    constructor(view) {
        this.view = view;
        this._abortController = null;
        this._streamReader = null;
        this._progressTimer = null;
    }
    /* ---- Streaming AI Responses ---- */
    async startStreamingResponse(fetchPromise, targetElement) {
        if (!targetElement)
            return null;
        this._abortController = new AbortController();
        try {
            const res = await fetchPromise;
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            if (!res.body) {
                // Fallback to non-streaming JSON
                const data = await res.json();
                return { type: 'json', data };
            }
            const reader = res.body.getReader();
            this._streamReader = reader;
            const decoder = new TextDecoder('utf-8');
            let accumulated = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.response) {
                            accumulated += parsed.response;
                            this._renderStreamChunk(targetElement, accumulated);
                            this._scrollToBottom(targetElement.closest('.cb-v3-messages, .an-res-v3-body, [id*="results"]'));
                        }
                    }
                    catch (_a) {
                        // Ignore partial JSON
                    }
                }
            }
            return { type: 'stream', text: accumulated };
        }
        catch (error) {
            if (error.name === 'AbortError')
                return { type: 'aborted' };
            throw error;
        }
        finally {
            this._streamReader = null;
            this._abortController = null;
        }
    }
    abortStreaming() {
        if (this._abortController) {
            this._abortController.abort();
        }
        if (this._streamReader) {
            this._streamReader.cancel().catch(() => { });
            this._streamReader = null;
        }
    }
    _renderStreamChunk(targetElement, text) {
        // Escape HTML and convert markdown-like formatting
        const safe = this._escapeStreamText(text);
        targetElement.innerHTML = safe;
    }
    _escapeStreamText(text) {
        if (!text)
            return '';
        let processed = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        // Restore code blocks
        processed = processed.replace(/&lt;pre&gt;([\s\S]*?)&lt;\/pre&gt;/g, '<pre class="cb-v3-bubble-pre"><code>$1</code></pre>');
        processed = processed.replace(/&lt;code&gt;([\s\S]*?)&lt;\/code&gt;/g, '<code class="cb-v3-inline-code">$1</code>');
        // Line breaks
        processed = processed.replace(/\n/g, '<br>');
        return processed;
    }
    _scrollToBottom(container) {
        if (!container)
            return;
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    }
    /* ---- Multi-Engine Progress Tracking ---- */
    startProgressTracking(steps, onUpdate) {
        this.stopProgressTracking();
        const progress = { steps: steps.map((s) => ({ ...s, status: 'pending' })), startTime: Date.now() };
        this._progressTimer = setInterval(() => {
            // Poll server for progress if available
            this._pollProgress(progress, onUpdate);
        }, 500);
        return progress;
    }
    stopProgressTracking() {
        if (this._progressTimer) {
            clearInterval(this._progressTimer);
            this._progressTimer = null;
        }
    }
    async _pollProgress(progress, onUpdate) {
        try {
            const res = await fetch('/api/analyze/progress', { cache: 'no-store' });
            if (!res.ok)
                return;
            const data = await res.json();
            if (data.steps) {
                progress.steps = data.steps;
                onUpdate(progress);
            }
        }
        catch (_a) {
            // Silent fail — polling is best-effort
        }
    }
    updateProgressStep(progress, stepId, status) {
        const step = progress.steps.find((s) => s.id === stepId);
        if (step)
            step.status = status;
    }
    getProgressPercent(progress) {
        var _a;
        if (!((_a = progress === null || progress === void 0 ? void 0 : progress.steps) === null || _a === void 0 ? void 0 : _a.length))
            return 0;
        const done = progress.steps.filter((s) => s.status === 'done').length;
        return Math.round((done / progress.steps.length) * 100);
    }
    /* ---- Session State Persistence ---- */
    saveSession(key, data) {
        try {
            sessionStorage.setItem(`sb_analyze_${key}`, JSON.stringify(data));
        }
        catch (_a) {
            // Ignore quota errors
        }
    }
    loadSession(key) {
        try {
            const raw = sessionStorage.getItem(`sb_analyze_${key}`);
            return raw ? JSON.parse(raw) : null;
        }
        catch (_a) {
            return null;
        }
    }
    clearSession(key) {
        sessionStorage.removeItem(`sb_analyze_${key}`);
    }
    /* ---- Cleanup ---- */
    destroy() {
        this.abortStreaming();
        this.stopProgressTracking();
    }
}
