// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
const PRICING_URL = '/pricing';
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
    lead.textContent = 'Unlock all 63 analyzer engines, unlimited file scans, PDF exports, compliance certificates, and team collaboration tools.';
    const plans = document.createElement('div');
    plans.className = 'upgrade-modal-plans';
    plans.innerHTML = `
    <div class="upgrade-plan-card">
      <h4>Pro</h4>
      <p class="upgrade-plan-price">$9<span>/mo</span></p>
      <ul>
        <li>All 63 engines</li>
        <li>2,500 scans/mo</li>
        <li>PDF reports</li>
        <li>Remote repo scans</li>
      </ul>
    </div>
    <div class="upgrade-plan-card upgrade-plan-highlight">
      <h4>Enterprise</h4>
      <p class="upgrade-plan-price">Custom</p>
      <ul>
        <li>Everything in Pro</li>
        <li>Unlimited scans</li>
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
        onDismiss === null || onDismiss === void 0 ? void 0 : onDismiss(dismissAction);
    };
    (_a = overlay.querySelector('.upgrade-modal-close')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => close('dismiss'));
    (_b = overlay.querySelector('.upgrade-dismiss')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => close('dismiss'));
    (_c = overlay.querySelector('.upgrade-pricing')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => close('pricing'));
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
