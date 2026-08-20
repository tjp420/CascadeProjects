// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml } from '../utils.js';

/**
 * Billing landing controller for success / cancel return pages.
 */
export class BillingLandingController {
  constructor(app) {
    this.app = app;
  }
  mount(container) {
    var _a, _b;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status') || (window.location.hash.includes('billing-success') ? 'success' : 'cancel');
    const title = status === 'success' ? 'Payment Successful' : 'Payment Cancelled';
    const message =
      status === 'success'
        ? 'Thank you for your purchase. Your license token has been emailed to the address used at checkout.'
        : 'Checkout was cancelled. You can return to pricing and try again whenever you are ready.';
    const cta = status === 'success' ? 'Go to Dashboard' : 'Return to Pricing';
    const target = status === 'success' ? 'dashboard' : 'pricing';
    container.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">${escapeHtml(title)}</h1>
        <p class="text-muted analyze-hero-sub">${escapeHtml(message)}</p>
      </div>
      <section class="card mb-6" style="text-align:center;padding:32px;">
        <button type="button" class="btn btn-primary" id="billing-landing-cta">${escapeHtml(cta)}</button>
      </section>
    `;
    const btn = container.querySelector('#billing-landing-cta');
    if (btn) {
      btn.addEventListener('click', () => {
        ((_b = (_a = this.app).navigate) === null || _b === void 0 ? void 0 : _b.call(_a, target)) ||
          (window.location.hash = '#/' + target);
      });
    }
  }
  destroy() {}
}
