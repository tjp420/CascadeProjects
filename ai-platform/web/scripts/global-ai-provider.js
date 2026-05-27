/**
 * AI provider + analysis mode selectors for the global input bar.
 */
(function () {
    const PROVIDER_KEY = 'cascade-ai-provider';
    const MODE_KEY = 'cascade-analysis-type';

    function getProviderSelect() {
        return document.getElementById('global-ai-provider');
    }

    function getModeSelect() {
        return document.getElementById('global-analysis-type');
    }

    function readStored(key, fallback) {
        try {
            return localStorage.getItem(key) || fallback;
        } catch {
            return fallback;
        }
    }

    function writeStored(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            /* ignore */
        }
    }

    window.getGlobalAnalyzeOptions = function getGlobalAnalyzeOptions() {
        return {
            aiProvider: getProviderSelect()?.value || readStored(PROVIDER_KEY, 'active'),
            analysisType: getModeSelect()?.value || readStored(MODE_KEY, 'auto')
        };
    };

    window.setGlobalAIProvider = function setGlobalAIProvider(providerId) {
        const select = getProviderSelect();
        if (select) select.value = providerId;
        writeStored(PROVIDER_KEY, providerId);
    };

    async function populateProviders() {
        const providerSelect = getProviderSelect();
        if (!providerSelect) return;

        try {
            const response = await fetch('/api/analyze/providers');
            if (!response.ok) return;
            const payload = await response.json();
            const savedProvider = readStored(PROVIDER_KEY, 'active');
            const savedMode = readStored(MODE_KEY, 'auto');

            providerSelect.innerHTML = (payload.providers || []).map((provider) => {
                const suffix = provider.configured ? '' : ' (not configured)';
                return `<option value="${provider.id}"${provider.configured ? '' : ' data-unconfigured="1"'}>${provider.label}${suffix}</option>`;
            }).join('');

            if ([...providerSelect.options].some((opt) => opt.value === savedProvider)) {
                providerSelect.value = savedProvider;
            }

            const modeSelect = getModeSelect();
            if (modeSelect && payload.analysisTypes?.length) {
                modeSelect.innerHTML = payload.analysisTypes.map((mode) =>
                    `<option value="${mode.id}">${mode.label}</option>`
                ).join('');
                if ([...modeSelect.options].some((opt) => opt.value === savedMode)) {
                    modeSelect.value = savedMode;
                }
            }
        } catch (error) {
            console.warn('Failed to load analyze providers:', error.message);
        }
    }

    function bindSelectors() {
        getProviderSelect()?.addEventListener('change', (event) => {
            writeStored(PROVIDER_KEY, event.target.value);
        });
        getModeSelect()?.addEventListener('change', (event) => {
            writeStored(MODE_KEY, event.target.value);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindSelectors();
        populateProviders();
    });
})();
