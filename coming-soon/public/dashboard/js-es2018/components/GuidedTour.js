// simplebeacon-ignore: Dashboard code, i18n

const TOUR_COMPLETED_KEY = 'sb_guided_tour_completed';
const TOUR_STEP_KEY = 'sb_guided_tour_step';

const TOUR_STEPS = [
    {
        route: 'dashboard',
        target: '.dashboard-scan-redesign, .dashboard-quickstart',
        title: 'Dashboard — Mission Control',
        body: 'Your scan results, gate score, and quick actions live here. Run a scan or review findings from this page.'
    },
    {
        route: 'analyze',
        target: '.analyze-page, .analyze-upload-zone, #analyze-path-input',
        title: 'Analyze — Run Scans',
        body: 'Drop a folder, browse, or paste a server path. Enable Privacy mode to scan entirely in your browser — no files leave your machine.'
    },
    {
        route: 'results',
        target: '.results-page, .results-filters, #results-container',
        title: 'Results — Filter Findings',
        body: 'After a scan, filter issues by severity and category. Each finding shows the file, line, and suggested fix.'
    },
    {
        route: 'audit',
        target: '.audit-page, .audit-section, #audit-container',
        title: 'Audit — Compliance Layers',
        body: 'All auditing layers in one view: credentials, fiction KPIs, schema drift, production leaks, and npm audit.'
    },
    {
        route: 'roadmap',
        target: '.roadmap-page, .roadmap-phase, #roadmap-container',
        title: 'Roadmap — Prioritized Fixes',
        body: 'Remediation steps generated from your latest scan, organized by phase and priority so you know exactly what to fix first.'
    },
    {
        route: 'chatbot',
        target: '.chatbot-page, .chatbot-container, #chatbot-messages',
        title: 'Chatbot — AI Assistant',
        body: 'Ask AI about your codebase and scan findings. Connect Ollama for fully local, private AI — or use cloud providers like OpenAI.'
    },
    {
        route: 'profile',
        target: '.profile-page, .security-keys-section, #profile-container',
        title: 'Profile — Security Keys & Account',
        body: 'Manage your account, API keys, and register FIDO2 hardware security keys for passwordless authentication.'
    }
];

function getCompleted() {
    try {
        return localStorage.getItem(TOUR_COMPLETED_KEY) === '1';
    } catch {
        return false;
    }
}

function setCompleted() {
    try {
        localStorage.setItem(TOUR_COMPLETED_KEY, '1');
    } catch {
        /* ignore */
    }
}

function getSavedStep() {
    try {
        const raw = localStorage.getItem(TOUR_STEP_KEY);
        return raw ? parseInt(raw, 10) : 0;
    } catch {
        return 0;
    }
}

function saveStep(step) {
    try {
        localStorage.setItem(TOUR_STEP_KEY, String(step));
    } catch {
        /* ignore */
    }
}

function clearStep() {
    try {
        localStorage.removeItem(TOUR_STEP_KEY);
    } catch {
        /* ignore */
    }
}

export function shouldShowTour() {
    return !getCompleted();
}

export class GuidedTour {
    constructor(app) {
        this.app = app;
        this.currentStep = 0;
        this.overlay = null;
        this.tooltip = null;
        this.active = false;
        this._navigateTimeout = null;
    }

    start(fromStep) {
        if (this.active) return;
        this.active = true;
        this.currentStep = fromStep != null ? fromStep : 0;
        this._createOverlay();
        this._goToStep(this.currentStep);
    }

    stop() {
        this.active = false;
        if (this._navigateTimeout) {
            clearTimeout(this._navigateTimeout);
            this._navigateTimeout = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        clearStep();
    }

    complete() {
        setCompleted();
        this.stop();
    }

    _createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'guided-tour-overlay';
        this.overlay.addEventListener('click', e => {
            if (e.target === this.overlay) {
                this.stop();
            }
        });
        document.body.appendChild(this.overlay);
    }

    _goToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= TOUR_STEPS.length) return;
        this.currentStep = stepIndex;
        saveStep(stepIndex);
        const step = TOUR_STEPS[stepIndex];
        this.app.navigate(step.route);
        this._navigateTimeout = setTimeout(() => {
            this._highlightTarget(step);
        }, 400);
    }

    _highlightTarget(step) {
        let targetEl = null;
        if (step.target) {
            const selectors = step.target.split(',').map(s => s.trim());
            for (const sel of selectors) {
                targetEl = document.querySelector(sel);
                if (targetEl) break;
            }
        }
        this._showTooltip(targetEl, step);
    }

    _showTooltip(targetEl, step) {
        if (this.tooltip) {
            this.tooltip.remove();
        }
        const tooltip = document.createElement('div');
        tooltip.className = 'guided-tour-tooltip';
        tooltip.setAttribute('role', 'dialog');
        tooltip.setAttribute('aria-labelledby', 'tour-title');

        const isLast = this.currentStep === TOUR_STEPS.length - 1;
        const isFirst = this.currentStep === 0;

        const tooltipHtml = `
            <div class="guided-tour-header">
                <span class="guided-tour-step-counter">Step ${this.currentStep + 1} of ${TOUR_STEPS.length}</span>
                <button class="guided-tour-close" id="tour-skip" aria-label="Skip tour">✕</button>
            </div>
            <h3 class="guided-tour-title" id="tour-title">${step.title}</h3>
            <p class="guided-tour-body">${step.body}</p>
            <div class="guided-tour-dots">
                ${TOUR_STEPS.map(
                    (_, i) =>
                        `<span class="guided-tour-dot ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'done' : ''}"></span>`
                ).join('')}
            </div>
            <div class="guided-tour-actions">
                ${!isFirst ? '<button class="btn btn-ghost btn-sm" id="tour-back">Back</button>' : '<span></span>'}
                <div class="guided-tour-actions-right">
                    <button class="btn btn-ghost btn-sm" id="tour-skip-text">Skip tour</button>
                    <button class="btn btn-primary btn-sm" id="tour-next">${isLast ? 'Finish' : 'Next'}</button>
                </div>
            </div>
        `;
        if (typeof window !== 'undefined' && typeof window.setSafeHTML === 'function') {
            window.setSafeHTML(tooltip, tooltipHtml);
        } else {
            tooltip.innerHTML = tooltipHtml;
        }
        // Append hidden, then measure & position in a single rAF to avoid layout thrash.
        tooltip.style.visibility = 'hidden';
        tooltip.style.top = '0px';
        tooltip.style.left = '0px';
        document.body.appendChild(tooltip);
        this.tooltip = tooltip;

        const positionTooltip = () => {
            if (!this.tooltip) return;
            const padding = 12;
            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                let top = rect.bottom + padding;
                let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

                if (top + tooltipRect.height > window.innerHeight - 20) {
                    top = rect.top - tooltipRect.height - padding;
                }
                if (top < 20) top = 20;
                if (left < 20) left = 20;
                if (left + tooltipRect.width > window.innerWidth - 20) {
                    left = window.innerWidth - tooltipRect.width - 20;
                }

                tooltip.style.top = `${top}px`;
                tooltip.style.left = `${left}px`;

                targetEl.classList.add('guided-tour-highlight');
                // scroll into view after positioning so the browser can optimize.
                requestAnimationFrame(() => targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }));
            } else {
                tooltip.style.top = '50%';
                tooltip.style.left = '50%';
                tooltip.style.transform = 'translate(-50%, -50%)';
            }
            tooltip.style.visibility = '';
        };

        requestAnimationFrame(positionTooltip);

        tooltip.querySelector('#tour-next')?.addEventListener('click', () => {
            if (isLast) {
                this.complete();
            } else {
                document
                    .querySelectorAll('.guided-tour-highlight')
                    .forEach(el => el.classList.remove('guided-tour-highlight'));
                this._goToStep(this.currentStep + 1);
            }
        });

        tooltip.querySelector('#tour-back')?.addEventListener('click', () => {
            document
                .querySelectorAll('.guided-tour-highlight')
                .forEach(el => el.classList.remove('guided-tour-highlight'));
            this._goToStep(this.currentStep - 1);
        });

        const skipHandler = () => this.stop();
        tooltip.querySelector('#tour-skip')?.addEventListener('click', skipHandler);
        tooltip.querySelector('#tour-skip-text')?.addEventListener('click', skipHandler);
    }

    destroy() {
        this.stop();
    }
}
