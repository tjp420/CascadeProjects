/**
 * Navigation hubs, dashboard sample shortcuts, and first-run welcome modal.
 */
(function () {
    const WELCOME_KEY = 'cascade-welcome-dismissed';

    function openHubTarget(sectionId) {
        if (typeof window.showSection === 'function') {
            window.showSection(sectionId, null);
        }
        if (sectionId === 'roadmap' && typeof window.loadBlobDrivenRoadmap === 'function') {
            window.loadBlobDrivenRoadmap();
        }
    }

    function runSampleShortcut(kind) {
        if (typeof window.analyzeGlobalDataInput === 'function') {
            window.analyzeGlobalDataInput(kind);
            return;
        }
        const input = document.getElementById('global-data-address');
        if (input) {
            input.value = kind;
            document.getElementById('global-data-analyze')?.click();
        }
    }

    window.openHubTarget = openHubTarget;
    window.runSampleShortcut = runSampleShortcut;

    window.closeWelcomeModal = function closeWelcomeModal(dismiss = true) {
        const modal = document.getElementById('welcome-modal');
        if (modal) {
            modal.hidden = true;
            modal.setAttribute('aria-hidden', 'true');
        }
        if (dismiss) {
            try {
                localStorage.setItem(WELCOME_KEY, '1');
            } catch {
                /* ignore storage errors */
            }
        }
    };

    window.showWelcomeModal = function showWelcomeModal() {
        const modal = document.getElementById('welcome-modal');
        if (modal) {
            modal.hidden = false;
            modal.setAttribute('aria-hidden', 'false');
        }
    };

    function bindWelcomeModal() {
        document.getElementById('welcome-modal-get-started')?.addEventListener('click', (event) => {
            event.preventDefault();
            window.closeWelcomeModal(true);
        });

        document.getElementById('welcome-modal-dismiss-only')?.addEventListener('click', (event) => {
            event.preventDefault();
            window.closeWelcomeModal(false);
        });

        document.querySelectorAll('[data-welcome-hub]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                const hubId = btn.dataset.welcomeHub;
                window.closeWelcomeModal(true);
                if (hubId) openHubTarget(hubId);
            });
        });

        document.getElementById('hp-show-tour')?.addEventListener('click', () => window.showWelcomeModal());
        document.getElementById('st-show-tour')?.addEventListener('click', () => window.showWelcomeModal());

        document.getElementById('welcome-modal')?.addEventListener('click', (event) => {
            if (event.target.id === 'welcome-modal') {
                window.closeWelcomeModal(true);
            }
        });
    }

    function bindHubCards() {
        document.addEventListener('click', (event) => {
            const card = event.target.closest('[data-hub-target]');
            if (!card) return;
            event.preventDefault();
            openHubTarget(card.dataset.hubTarget);
        });

        document.addEventListener('click', (event) => {
            const shortcut = event.target.closest('[data-sample-shortcut]');
            if (!shortcut) return;
            event.preventDefault();
            runSampleShortcut(shortcut.dataset.sampleShortcut);
        });
    }

    function maybeShowWelcomeModal() {
        try {
            if (localStorage.getItem(WELCOME_KEY)) return;
        } catch {
            return;
        }
        const modal = document.getElementById('welcome-modal');
        if (modal) {
            modal.hidden = false;
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindHubCards();
        bindWelcomeModal();
        maybeShowWelcomeModal();
    });
})();
