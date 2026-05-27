/**
 * Development Roadmap Page — lazy init for the legacy roadmap dashboard shell
 */
(function () {
    let initPromise = null;

    function waitFor(fnName, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            (function poll() {
                if (typeof window[fnName] === 'function') {
                    resolve();
                    return;
                }
                if (Date.now() - started > timeoutMs) {
                    reject(new Error(`${fnName} not available`));
                    return;
                }
                setTimeout(poll, 50);
            })();
        });
    }

    async function loadRoadmapFromUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const roadmapParam = params.get('roadmap');
        if (roadmapParam === 'master' && typeof window.loadMasterRoadmapSampleJson === 'function') {
            await window.loadMasterRoadmapSampleJson();
            return true;
        }
        if (roadmapParam === 'sample' && typeof window.loadSampleRoadmapJson === 'function') {
            await window.loadSampleRoadmapJson();
            return true;
        }
        if (roadmapParam === 'gguf-sample' && typeof window.loadGgufSampleRoadmapJson === 'function') {
            await window.loadGgufSampleRoadmapJson();
            return true;
        }
        if (roadmapParam && roadmapParam.endsWith('.json') && typeof window.applyImportedRoadmapJson === 'function') {
            const response = await fetch(roadmapParam.startsWith('/') ? roadmapParam : `/${roadmapParam}`);
            const data = await response.json();
            window.applyImportedRoadmapJson(data, roadmapParam);
            return true;
        }
        return false;
    }

    async function ensureRoadmapReady() {
        try {
            await waitFor('initializeRoadmapWhenReady', 15000);
            await window.initializeRoadmapWhenReady();
            return;
        } catch (error) {
            console.warn('Roadmap component init unavailable, using sample fallback:', error.message);
        }

        if (typeof window.loadSampleRoadmapJson === 'function') {
            await window.loadSampleRoadmapJson();
            return;
        }

        throw new Error('No roadmap loader available');
    }

    async function initializeRoadmapPage(forceRefresh = false) {
        const root = document.getElementById('development-roadmap-root');
        if (!root) return;

        if (initPromise && !forceRefresh) {
            return initPromise;
        }

        root.classList.add('loading');
        initPromise = (async () => {
            try {
                await ensureRoadmapReady();

                if (await loadRoadmapFromUrlParams()) {
                    return;
                }

                if (forceRefresh && typeof window.loadLiveRoadmapFromGenerator === 'function') {
                    const loaded = await window.loadLiveRoadmapFromGenerator({ force: true });
                    if (loaded) return;
                    if (typeof window.loadSampleRoadmapJson === 'function') {
                        await window.loadSampleRoadmapJson();
                    }
                    return;
                }

                if (typeof window.loadLiveRoadmapFromGenerator === 'function') {
                    const cached = await window.loadLiveRoadmapFromGenerator({ silent: true });
                    if (cached) return;
                }

                if (window.__lastGeneratedRoadmap && typeof window.applyGeneratedRoadmapToDashboard === 'function') {
                    if (typeof window.isStaleDevelopmentRoadmap === 'function'
                        && window.isStaleDevelopmentRoadmap(
                            window.__lastGeneratedRoadmap,
                            window.__lastGeneratedRoadmapPath
                        )) {
                        window.__lastGeneratedRoadmap = null;
                        window.__lastGeneratedRoadmapPath = null;
                    } else {
                        window.applyGeneratedRoadmapToDashboard(
                            window.__lastGeneratedRoadmap,
                            window.__lastGeneratedRoadmapPath || 'Saved analysis'
                        );
                        return;
                    }
                }

                if (typeof window.loadBaselineDevelopmentRoadmap === 'function') {
                    const loaded = await window.loadBaselineDevelopmentRoadmap();
                    if (loaded) return;
                }

                if (typeof window.restoreSavedDynamicRoadmap === 'function' && window.restoreSavedDynamicRoadmap()) {
                    return;
                }

                if (typeof window.loadSampleRoadmapJson === 'function') {
                    await window.loadSampleRoadmapJson();
                }
            } catch (error) {
                console.error('Failed to initialize development roadmap page:', error);
                window.showNotification?.(`❌ Roadmap init failed: ${error.message}`, 'error');
            } finally {
                root.classList.remove('loading');
            }
        })();

        return initPromise;
    }

    window.initializeRoadmapPage = initializeRoadmapPage;
})();
