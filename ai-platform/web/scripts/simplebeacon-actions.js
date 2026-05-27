/**
 * Simplebeacon runnable actions on the platform dashboard (dev-tools page).
 */
(function () {
    function notify(message, type) {
        window.showNotification?.(message, type);
    }

    function setOutput(html) {
        const el = document.getElementById('simplebeacon-action-output');
        if (!el) return;
        el.hidden = !html;
        el.innerHTML = html || '';
    }

    function setLoading(action, loading) {
        const btn = document.querySelector(`[data-sb-action="${action}"]`);
        if (btn) btn.classList.toggle('is-loading', Boolean(loading));
    }

    async function runScan() {
        setLoading('scan', true);
        setOutput('<span class="text-muted">Running Simplebeacon scan…</span>');
        notify('Running Simplebeacon scan…', 'info');
        try {
            const res = await fetch('/api/simplebeacon/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.message || 'Scan failed');
            const gate = data.report?.gate?.pass ? 'PASS' : 'REVIEW';
            setOutput(`<span style="color:#34d399;">✅ Scan complete — gate ${gate}. <a href="/">Open Simplebeacon dashboard</a></span>`);
            notify('Simplebeacon scan complete', 'success');
        } catch (error) {
            setOutput(`<span style="color:#f87171;">❌ ${error.message}</span>`);
            notify(`Scan failed: ${error.message}`, 'error');
        } finally {
            setLoading('scan', false);
        }
    }

    async function syncBaseline() {
        setLoading('baseline', true);
        setOutput('<span class="text-muted">Syncing baseline…</span>');
        try {
            const res = await fetch('/api/simplebeacon/tools/baseline-sync', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Baseline sync failed');
            const label = data.baseline?.jestTestsLabel || 'OK';
            setOutput(`<span style="color:#34d399;">✅ Baseline synced — ${label}</span>`);
            notify('Baseline synced', 'success');
        } catch (error) {
            setOutput(`<span style="color:#f87171;">❌ ${error.message}</span>`);
            notify(`Baseline sync failed: ${error.message}`, 'error');
        } finally {
            setLoading('baseline', false);
        }
    }

    async function runNpmAudit() {
        setLoading('audit', true);
        setOutput('<span class="text-muted">Running npm audit…</span>');
        try {
            window.showSection?.('security', null);
            if (typeof window.runSecurityNpmAudit === 'function') {
                await window.runSecurityNpmAudit();
            } else {
                const res = await fetch('/api/security/npm-audit');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'npm audit failed');
            }
            setOutput('<span style="color:#34d399;">✅ npm audit complete — see Security dashboard</span>');
            notify('npm audit complete', 'success');
        } catch (error) {
            setOutput(`<span style="color:#f87171;">❌ ${error.message}</span>`);
            notify(`npm audit failed: ${error.message}`, 'error');
        } finally {
            setLoading('audit', false);
        }
    }

    async function exportReport() {
        setLoading('export', true);
        try {
            const res = await fetch('/api/simplebeacon/report');
            if (!res.ok) throw new Error('Report not available');
            const report = await res.json();
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `simplebeacon-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setOutput('<span style="color:#34d399;">✅ Report downloaded</span>');
            notify('Report exported', 'success');
        } catch (error) {
            setOutput(`<span style="color:#f87171;">❌ ${error.message}</span>`);
            notify(`Export failed: ${error.message}`, 'error');
        } finally {
            setLoading('export', false);
        }
    }

    function bindSimplebeaconActions() {
        const root = document.getElementById('simplebeacon-actions-panel');
        if (!root || root.dataset.bound === 'true') return;
        root.dataset.bound = 'true';

        const handlers = {
            scan: runScan,
            baseline: syncBaseline,
            audit: runNpmAudit,
            export: exportReport
        };

        root.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-sb-action]');
            if (!btn || btn.classList.contains('is-loading')) return;
            handlers[btn.dataset.sbAction]?.();
        });
    }

    window.bindSimplebeaconActions = bindSimplebeaconActions;
    document.addEventListener('DOMContentLoaded', bindSimplebeaconActions);
})();
