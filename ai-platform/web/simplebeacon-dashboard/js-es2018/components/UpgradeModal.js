const GITHUB_REPO = 'https://github.com/tjp420/simplebeacon';
/**
 * Render upgrade modal.
 * @param {Object} options
 * @returns {any}
 */
export function renderUpgradeModal({ onDismiss } = {}) {
    var _a, _b, _c;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay upgrade-modal-overlay';
    overlay.id = 'upgrade-modal';
    const modal = document.createElement('div');
    modal.className = 'modal card upgrade-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'upgrade-modal-title');
    const header = document.createElement('div');
    header.className = 'card-header';
    const title = document.createElement('h2');
    title.id = 'upgrade-modal-title';
    title.className = 'upgrade-modal-title';
    title.textContent = 'Use the free CLI';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'icon-btn upgrade-modal-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    header.appendChild(title);
    header.appendChild(closeBtn);
    const lead = document.createElement('p');
    lead.className = 'upgrade-modal-lead';
    lead.textContent = 'Simplebeacon is an open-source, local-first scanner. No subscription required for CI gates or pre-commit hooks.';
    const installBlock = document.createElement('div');
    installBlock.className = 'about-install-block';
    installBlock.style.margin = 'var(--space-4) 0';
    const code1 = document.createElement('code');
    code1.textContent = 'npx simplebeacon init';
    const code2 = document.createElement('code');
    code2.textContent = 'npx simplebeacon scan --gate';
    installBlock.appendChild(code1);
    installBlock.appendChild(code2);
    const actions = document.createElement('div');
    actions.className = 'upgrade-modal-actions';
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'btn btn-secondary upgrade-dismiss';
    dismissBtn.textContent = 'Close';
    const githubLink = document.createElement('a');
    githubLink.className = 'btn btn-primary';
    githubLink.href = GITHUB_REPO;
    githubLink.target = '_blank';
    githubLink.rel = 'noopener noreferrer';
    githubLink.textContent = 'GitHub';
    const aboutBtn = document.createElement('button');
    aboutBtn.type = 'button';
    aboutBtn.className = 'btn btn-ghost upgrade-about';
    aboutBtn.textContent = 'About the project';
    actions.appendChild(dismissBtn);
    actions.appendChild(githubLink);
    actions.appendChild(aboutBtn);
    modal.appendChild(header);
    modal.appendChild(lead);
    modal.appendChild(installBlock);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    const close = (dismissAction) => {
        overlay.remove();
        onDismiss === null || onDismiss === void 0 ? void 0 : onDismiss(dismissAction);
    };
    (_a = overlay.querySelector('.upgrade-modal-close')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => close('dismiss'));
    (_b = overlay.querySelector('.upgrade-dismiss')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => close('dismiss'));
    (_c = overlay.querySelector('.upgrade-about')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
        close();
        if (window.__SB_DASHBOARD_APP__) { window.__SB_DASHBOARD_APP__.navigate('about'); }
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay)
            close();
    });
    return overlay;
}
/**
 * Show upgrade modal.
 * @param {Object} options
 * @returns {any}
 */
export function showUpgradeModal(options) {
    const existing = document.getElementById('upgrade-modal');
    if (existing)
        existing.remove();
    const overlay = renderUpgradeModal(options);
    document.body.appendChild(overlay);
    return overlay;
}
