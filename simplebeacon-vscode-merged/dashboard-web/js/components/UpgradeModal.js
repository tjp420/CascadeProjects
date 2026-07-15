// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
const PRICING_URL = '/pricing';

/**
 * Render upgrade modal.
 * @param {Object} options
 * @returns {any}
 */
export function renderUpgradeModal({ onDismiss } = {}) {
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
  title.textContent = 'Upgrade to Pro';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn upgrade-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';
  header.appendChild(title);
  header.appendChild(closeBtn);

  const lead = document.createElement('p');
  lead.className = 'upgrade-modal-lead';
  lead.textContent = 'Unlock all 38 scan engines, unlimited file scans, PDF exports, compliance certificates, and team collaboration tools.';

  const plans = document.createElement('div');
  plans.className = 'upgrade-modal-plans';
  plans.innerHTML = `
    <div class="upgrade-plan-card">
      <h4>Pro</h4>
      <p class="upgrade-plan-price">$29<span>/mo</span></p>
      <ul>
        <li>All 38 engines</li>
        <li>2,500 scans/mo</li>
        <li>PDF reports</li>
        <li>Remote repo scans</li>
      </ul>
    </div>
    <div class="upgrade-plan-card upgrade-plan-highlight">
      <h4>Team</h4>
      <p class="upgrade-plan-price">$79<span>/mo</span></p>
      <ul>
        <li>Everything in Pro</li>
        <li>10,000 scans/mo</li>
        <li>Shared dashboards</li>
        <li>Priority support</li>
      </ul>
    </div>
  `;

  const actions = document.createElement('div');
  actions.className = 'upgrade-modal-actions';
  const pricingLink = document.createElement('a');
  pricingLink.className = 'btn btn-primary upgrade-pricing';
  pricingLink.href = PRICING_URL;
  pricingLink.textContent = 'View Pricing';
  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'btn btn-secondary upgrade-dismiss';
  dismissBtn.textContent = 'Maybe Later';
  actions.appendChild(pricingLink);
  actions.appendChild(dismissBtn);

  modal.appendChild(header);
  modal.appendChild(lead);
  modal.appendChild(plans);
  modal.appendChild(actions);
  overlay.appendChild(modal);

  const close = (dismissAction) => {
    overlay.remove();
    onDismiss?.(dismissAction);
  };

  overlay.querySelector('.upgrade-modal-close')?.addEventListener('click', () => close('dismiss'));
  overlay.querySelector('.upgrade-dismiss')?.addEventListener('click', () => close('dismiss'));
  overlay.querySelector('.upgrade-pricing')?.addEventListener('click', () => close('pricing'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
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
  if (existing) existing.remove();
  const overlay = renderUpgradeModal(options);
  document.body.appendChild(overlay);
  return overlay;
}

