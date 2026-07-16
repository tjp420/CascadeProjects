// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { billingService } from '../services/billingService.js';
import { authService } from '../services/authService.js?v=20260716cachefix1';
import { showToast } from '../utils.js';

// Marketplace listing is not live yet — link to the public action repo (see github-action/MARKETPLACE-CHECKLIST.md).
const GITHUB_ACTION_URL = 'https://github.com/simplebeacon/guardrails';
const QUICKSTART_URL = 'https://github.com/simplebeacon/guardrails#readme';

/**
 * Team pricing + self-serve Stripe checkout for AI Guardrails CI tier.
 */
export class PricingView {
    constructor(app) {
        this.app = app;
    }

    mount(container) {
        container.innerHTML = `
      <div class="page-header">
        <h1>Team Pricing</h1>
        <p class="page-subtitle">
          Free community guardrails for every repo. Upgrade when you need team dashboards, CI telemetry, and multi-repo ROI reporting.
        </p>
      </div>

      <div class="card notice-card mb-4">
        <p style="margin:0">
          <strong>Community stays free.</strong> Install the GitHub Action with no token — PR comments and merge gates work on every pull request.
          Team tier adds centralized metrics like <em>Merges Blocked This Week</em>.
        </p>
      </div>

      <div class="pricing-grid mb-6">
        <div class="pricing-card card">
          <h2>Community</h2>
          <p class="pricing-tier-label">Open source · no account</p>
          <p class="pricing-price">$0</p>
          <ul class="pricing-features">
            <li>PR diff scan + merge gate</li>
            <li>Structured AI Circuit Breaker comments</li>
            <li>Fail-open if license server is down</li>
            <li><code>npx simplebeacon scan --gate --diff</code></li>
          </ul>
          <a class="btn btn-secondary" href="${GITHUB_ACTION_URL}" target="_blank" rel="noopener noreferrer">Install GitHub Action</a>
        </div>

        <div class="pricing-card card pricing-card-featured">
          <h2>Team Guardrails</h2>
          <p class="pricing-tier-label">For engineering leads</p>
          <p class="pricing-price">$49<span class="pricing-period">/mo</span></p>
          <ul class="pricing-features">
            <li>Everything in Community</li>
            <li>License token for CI + dashboard</li>
            <li>Team dashboard &amp; gate telemetry</li>
            <li>Email delivery in under 60 seconds</li>
          </ul>
          <button type="button" class="btn btn-primary" data-checkout="startup_monthly">Start Team — $49/mo</button>
        </div>

        <div class="pricing-card card">
          <h2>Team Growth</h2>
          <p class="pricing-tier-label">Multi-repo engineering orgs</p>
          <p class="pricing-price">$149<span class="pricing-period">/mo</span></p>
          <ul class="pricing-features">
            <li>Everything in Team Guardrails</li>
            <li>Consolidated multi-repo metrics</li>
            <li>Compliance trend reporting</li>
            <li>Priority support</li>
          </ul>
          <button type="button" class="btn btn-primary" data-checkout="growth_monthly">Start Growth — $149/mo</button>
        </div>
      </div>

      <div class="card mb-6">
        <h3 class="h5 mb-2">Self-serve checkout</h3>
        <p class="text-muted text-sm mb-3">Pay on Stripe → receive your license token by email → paste into <code>SIMPLEBEACON_LICENSE_TOKEN</code> in GitHub secrets.</p>
        <p class="text-muted text-sm mb-3">Need an account first? <button type="button" class="btn btn-ghost btn-sm" id="pricing-goto-register" data-auth-action="register">Create a free account</button></p>
        <label class="form-label" for="checkout-email">Work email</label>
        <div class="d-flex gap-2 flex-wrap align-items-center">
          <input type="email" id="checkout-email" class="form-input" placeholder="lead@yourcompany.com" autocomplete="email" style="max-width:320px">
          <span class="text-muted text-xs">Token also appears in Settings after payment.</span>
        </div>
      </div>

      <div class="card">
        <h3 class="h5 mb-2">Quickstart after purchase</h3>
        <pre class="code-block text-sm"><code>- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- uses: simplebeacon/guardrails@v1
  with:
    license-token: \${{ secrets.SIMPLEBEACON_LICENSE_TOKEN }}
    fail-on: high</code></pre>
        <a class="btn btn-ghost btn-sm mt-2" href="${QUICKSTART_URL}" target="_blank" rel="noopener noreferrer">Full docs</a>
      </div>
    `;

        const emailInput = container.querySelector('#checkout-email');
        const stored = billingService.getEmail() || authService.getUser()?.email || '';
        if (emailInput && stored) {
            emailInput.value = stored;
        }

        container.querySelector('#pricing-goto-register')?.addEventListener('click', () => {
            this.app.navigate('register');
        });

        container.querySelectorAll('[data-checkout]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const product = btn.getAttribute('data-checkout');
                const email = (emailInput?.value || billingService.getEmail() || '').trim();
                if (!email || !email.includes('@')) {
                    showToast('Enter your work email before checkout', 'error');
                    emailInput?.focus();
                    return;
                }
                btn.disabled = true;
                try {
                    await billingService.startCheckout(product, email);
                }
                catch (err) {
                    showToast(err.message || 'Checkout unavailable', 'error');
                }
                finally {
                    btn.disabled = false;
                }
            });
        });

        const params = new URLSearchParams(window.location.search);
        if (params.get('canceled') === 'true') {
            showToast('Checkout canceled — Community tier is still free', 'info');
        }
    }

    destroy() { }
}
