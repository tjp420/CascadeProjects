/**
 * Neutralize hardcoded KPI text in stat cards until page scripts hydrate live data.
 */
(function () {
    'use strict';

    var EM_DASH = '\u2014';
    var PRESERVE = /^(GGUF|Good|Improving|Pending schedule|engineering-track|filesystem\+gguf-path|scan-derived)$/i;

    function shouldNeutralize(text) {
        if (!text || text === EM_DASH || text === '—') return false;
        if (PRESERVE.test(text)) return false;
        if (/\d/.test(text)) return true;
        if (/^[$~]/.test(text)) return true;
        return false;
    }

    function neutralizeStatPlaceholders(root) {
        if (!root || !root.querySelectorAll) return;
        root.querySelectorAll('.stat-value[id]').forEach(function (el) {
            var text = (el.textContent || '').trim();
            if (!shouldNeutralize(text)) return;
            el.setAttribute('data-static-kpi', text);
            el.textContent = EM_DASH;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            neutralizeStatPlaceholders(document);
        });
    } else {
        neutralizeStatPlaceholders(document);
    }

    window.neutralizeDashboardStatPlaceholders = neutralizeStatPlaceholders;
})();
