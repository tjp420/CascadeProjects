const ONBOARDING_KEY = 'simplebeacon-onboarding-seen';

export function shouldShowOnboarding() {
  return !localStorage.getItem(ONBOARDING_KEY);
}

export function dismissOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

export function renderOnboarding() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'onboarding-modal';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-labelledby="onboarding-title">
      <h2 id="onboarding-title">🛡️ Welcome to Simplebeacon</h2>
      <p>Your automated code security checkpoint — like airport security for every change before it reaches production.</p>
      <ul class="modal-checklist">
        <li>Scans on commit, push, CI, and on demand</li>
        <li>Credential leaks, production mock paths, schema drift</li>
        <li>Fictional KPIs in sample JSON (62%, 47 features, etc.)</li>
        <li>Blocks high-severity issues; shows exactly what to fix</li>
      </ul>
      <div class="modal-actions">
        <button class="btn btn-primary" id="onboarding-start">Start First Scan</button>
        <button class="btn btn-secondary" id="onboarding-dismiss">Explore Dashboard</button>
      </div>
    </div>
  `;
  return overlay;
}

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
