// simplebeacon-ignore i18n
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
  modal.className = 'modal onboarding-modal';
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
    'Scan code for credential leaks, production mock paths, and schema drift',
    'Get a pass/fail gate score and prioritized remediation roadmap',
    'Chat with AI about your findings — local Ollama or cloud providers',
    'Register FIDO2 security keys for passwordless authentication',
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
  const tourBtn = document.createElement('button');
  tourBtn.className = 'btn btn-outline';
  tourBtn.id = 'onboarding-tour';
  tourBtn.textContent = 'Take a Guided Tour';
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'btn btn-secondary';
  dismissBtn.id = 'onboarding-dismiss';
  dismissBtn.textContent = 'Explore Dashboard';
  actions.appendChild(startBtn);
  actions.appendChild(tourBtn);
  actions.appendChild(dismissBtn);
  const footer = document.createElement('div');
  footer.className = 'onboarding-footer';
  const footerLink = document.createElement('a');
  footerLink.href = '/dashboard/getting-started';
  footerLink.id = 'onboarding-getting-started';
  footerLink.textContent = 'New here? Check out the getting started guide →';
  footer.appendChild(footerLink);
  modal.appendChild(title);
  modal.appendChild(desc);
  modal.appendChild(list);
  modal.appendChild(actions);
  modal.appendChild(footer);
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
export function bindOnboarding(overlay, { onStart, onTour, onDismiss }) {
  var _a, _b, _c, _d;
  (_a = overlay.querySelector('#onboarding-start')) === null || _a === void 0
    ? void 0
    : _a.addEventListener('click', () => {
        dismissOnboarding();
        overlay.remove();
        onStart === null || onStart === void 0 ? void 0 : onStart();
      });
  (_b = overlay.querySelector('#onboarding-tour')) === null || _b === void 0
    ? void 0
    : _b.addEventListener('click', () => {
        dismissOnboarding();
        overlay.remove();
        onTour === null || onTour === void 0 ? void 0 : onTour();
      });
  (_c = overlay.querySelector('#onboarding-dismiss')) === null || _c === void 0
    ? void 0
    : _c.addEventListener('click', () => {
        dismissOnboarding();
        overlay.remove();
        onDismiss === null || onDismiss === void 0 ? void 0 : onDismiss();
      });
  (_d = overlay.querySelector('#onboarding-getting-started')) === null || _d === void 0
    ? void 0
    : _d.addEventListener('click', (e) => {
        e.preventDefault();
        dismissOnboarding();
        overlay.remove();
        onDismiss === null || onDismiss === void 0 ? void 0 : onDismiss();
      });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      dismissOnboarding();
      overlay.remove();
      onDismiss === null || onDismiss === void 0 ? void 0 : onDismiss();
    }
  });
}
