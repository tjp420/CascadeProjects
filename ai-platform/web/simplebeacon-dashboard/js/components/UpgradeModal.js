const GITHUB_REPO = 'https://github.com/tjp420/simplebeacon';

export function renderUpgradeModal({ onDismiss } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay upgrade-modal-overlay';
  overlay.id = 'upgrade-modal';
  overlay.innerHTML = `
    <div class="modal card upgrade-modal" role="dialog" aria-labelledby="upgrade-modal-title">
      <div class="card-header">
        <h2 id="upgrade-modal-title" class="upgrade-modal-title">Use the free CLI</h2>
        <button type="button" class="icon-btn upgrade-modal-close" aria-label="Close">✕</button>
      </div>
      <p class="upgrade-modal-lead">
        Simplebeacon is an open-source, local-first scanner. No subscription required for CI gates or pre-commit hooks.
      </p>
      <div class="about-install-block" style="margin:var(--space-4) 0">
        <code>npx simplebeacon init</code>
        <code>npx simplebeacon scan --gate</code>
      </div>
      <div class="upgrade-modal-actions">
        <button type="button" class="btn btn-secondary upgrade-dismiss">Close</button>
        <a class="btn btn-primary" href="${GITHUB_REPO}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <button type="button" class="btn btn-ghost upgrade-about">About the project</button>
      </div>
    </div>
  `;

  const close = (dismissAction) => {
    overlay.remove();
    onDismiss?.(dismissAction);
  };

  overlay.querySelector('.upgrade-modal-close')?.addEventListener('click', () => close('dismiss'));
  overlay.querySelector('.upgrade-dismiss')?.addEventListener('click', () => close('dismiss'));
  overlay.querySelector('.upgrade-about')?.addEventListener('click', () => {
    close();
    window.location.hash = '#/about';
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return overlay;
}

export function showUpgradeModal(options) {
  const existing = document.getElementById('upgrade-modal');
  if (existing) existing.remove();
  const overlay = renderUpgradeModal(options);
  document.body.appendChild(overlay);
  return overlay;
}

