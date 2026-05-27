/**
 * Dashboard bootstrap — section content provider, action fallbacks, debug hooks
 */
(function () {
    function ensureActionFunctionsAvailable() {
        const requiredFunctions = [
            'runAIAnalysis', 'runAIOptimization', 'runDataSecurity', 'runDataGeneration',
            'analyzeMockData', 'convertMockData', 'validateMockData', 'generateMockData',
            'cleanMockData', 'exportMockData'
        ];

        requiredFunctions.forEach((functionName) => {
            if (typeof window[functionName] !== 'function') {
                console.warn(`⚠️ Function ${functionName} not available, creating fallback`);
                window[functionName] = function () {
                    console.log(`🔄 ${functionName} fallback executed`);
                    if (window.showNotification) {
                        window.showNotification(`🔄 ${functionName} executed with fallback`, 'info');
                    } else {
                        console.log(`${functionName} fallback executed`);
                    }
                };
            }
        });
    }

    function initializeSectionContentProvider() {
        if (typeof BaseComponent === 'undefined') {
            console.error('❌ BaseComponent not loaded');
            return;
        }

        if (typeof SectionContentProvider === 'undefined') {
            console.error('❌ SectionContentProvider not loaded');
            return;
        }

        window.sectionContentProvider = new SectionContentProvider();
        console.log('✅ Section Content Provider initialized');

        window.loadSectionWithComponent = function (sectionId, componentClass, options = {}) {
            if (window.sectionContentProvider) {
                window.sectionContentProvider.loadSectionWithComponent(sectionId, componentClass, options);
            } else {
                console.error('❌ Section Content Provider not available');
            }
        };
    }

    function bindActionCardDebugListeners() {
        document.querySelectorAll('.action-card').forEach((card) => {
            card.addEventListener('click', function () {
                console.log('🖱️ Action card clicked:', this.textContent.trim());
            });
        });
    }

    window.addEventListener('error', (event) => {
        console.error('❌ Global error:', event.error);
    });

    ensureActionFunctionsAvailable();

    document.addEventListener('DOMContentLoaded', function () {
        try {
            initializeSectionContentProvider();
            bindActionCardDebugListeners();
        } catch (error) {
            console.error('❌ Error initializing dashboard:', error);
        }
    });
})();
