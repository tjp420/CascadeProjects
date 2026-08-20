// simplebeacon-ignore documentation, i18n
const ONBOARDING_KEY = 'simplebeacon-onboarding-seen';

/**
 * Should show onboarding.
 * @returns {any}
 */
export function shouldShowOnboarding() {
  return !localStorage.getItem(ONBOARDING_KEY);
}

/**
 * Dismiss onboarding.
 * @returns {any}
 */
export function dismissOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

/**
 * Render onboarding.
 * @returns {any}
 */
export function renderOnboarding() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'onboarding-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'onboarding-title');
  const title = document.createElement('h2');
  title.id = 'onboarding-title';
  title.textContent = '🛡️ Welcome to Simplebeacon';
  const desc = document.createElement('p');
  desc.textContent =
    'Your automated code security checkpoint — like airport security for every change before it reaches production.';
  const list = document.createElement('ul');
  list.className = 'modal-checklist';
  [
    'Scans on commit, push, CI, and on demand',
    'Credential leaks, production mock paths, schema drift',
    'Fictional KPIs in sample JSON (62%, 47 features, etc.)',
    'Blocks high-severity issues; shows exactly what to fix',
  ].forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn-primary';
  startBtn.id = 'onboarding-start';
  startBtn.textContent = 'Start First Scan';
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'btn btn-secondary';
  dismissBtn.id = 'onboarding-dismiss';
  dismissBtn.textContent = 'Explore Dashboard';
  actions.appendChild(startBtn);
  actions.appendChild(dismissBtn);
  modal.appendChild(title);
  modal.appendChild(desc);
  modal.appendChild(list);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  return overlay;
}

/**
 * Bind onboarding.
 * @param {any} overlay
 * @param {Object} options
 * @param {any} onDismiss }
 * @returns {any}
 */
export function bindOnboarding(overlay, { onStart, onDismiss }) {
  overlay.querySelector('#onboarding-start')?.addEventListener('click', () => {
    dismissOnboarding();
    overlay.remove();
    onStart?.();
  });
  overlay.querySelector('#onboarding-dismiss')?.addEventListener('click', () => {
    dismissOnboarding();
    overlay.remove();
    onDismiss?.();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      dismissOnboarding();
      overlay.remove();
      onDismiss?.();
    }
  });
}
