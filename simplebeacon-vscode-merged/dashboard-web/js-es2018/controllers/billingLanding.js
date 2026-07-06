import { billingService } from '../services/billingService.js';
import { authService } from '../services/authService.js';
import { showToast } from '../utils.js';
import { PendingActivationCard } from '../components/PendingActivationCard.js';
/**
 * Post-checkout landing controller.
 *
 * Call this when the user lands on /#/billing/success after Stripe redirects.
 * It runs the grace-validation loop so the UI catches webhook-driven upgrades
 * even if the browser was closed during checkout.
 */
export class BillingLandingController {
    constructor(app) {
        this.app = app;
    }
    /**
     * Parse query params from the current hash route.
     * @returns {{sessionId?: string, tier?: string}}
     */
    _getLandingParams() {
        const hash = window.location.hash || '';
        const queryIndex = hash.indexOf('?');
        if (queryIndex === -1)
            return {};
        const params = new URLSearchParams(hash.slice(queryIndex + 1));
        return {
            sessionId: params.get('session_id') || undefined,
            tier: params.get('tier') || undefined
        };
    }
    /**
     * Mount the landing UI into the given container.
     * @param {HTMLElement} container
     */
    mount(container) {
        container.innerHTML = '';
        const { sessionId, tier } = this._getLandingParams();
        const hash = window.location.hash || '';
        const isCancel = hash.includes('billing-cancel');
        if (isCancel) {
            this._renderCancelState(container, { sessionId, tier });
            return;
        }
        // Render the success landing shell
        const el = document.createElement('div');
        el.className = 'fade-in billing-landing';
        el.innerHTML = `
      <style>
        .billing-landing { max-width: 560px; margin: 0 auto; padding: var(--space-8) var(--space-4); text-align: center; }
        .billing-landing h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 var(--space-3); }
        .billing-landing p { color: var(--text-muted); font-size: 0.95rem; margin: 0 auto var(--space-5); max-width: 420px; }
        .billing-spinner { width: 48px; height: 48px; border: 3px solid rgba(148,163,184,0.15); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto var(--space-4); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .billing-status-card { background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-6); margin-top: var(--space-4); }
        .billing-status-card.success { border-color: var(--success); background: rgba(34,197,94,0.06); }
        .billing-status-card.error { border-color: var(--error); background: rgba(239,68,68,0.06); }
        .billing-status-icon { font-size: 2.5rem; margin-bottom: var(--space-3); }
        .billing-actions { display: flex; gap: var(--space-2); justify-content: center; flex-wrap: wrap; margin-top: var(--space-4); }
      </style>

      <div class="billing-landing">
        <div class="billing-spinner" id="billing-spinner"></div>
        <h1 id="billing-title">Confirming your subscription…</h1>
        <p id="billing-body">
          We're synchronizing your license with our billing system.
          This usually takes just a few seconds.
        </p>
        <div class="billing-status-card" id="billing-status-card" style="display:none;">
          <div class="billing-status-icon" id="billing-status-icon"></div>
          <h2 id="billing-status-title"></h2>
          <p id="billing-status-body"></p>
          <div class="billing-actions" id="billing-actions"></div>
        </div>
      </div>
    `;
        container.appendChild(el);
        // Start the grace loop
        this._runGraceLoop(el, { sessionId, tier });
    }
    /**
     * Run the polling grace loop and update the UI.
     * @param {HTMLElement} el
     * @param {{sessionId?: string, tier?: string}} params
     */
    async _runGraceLoop(el, { sessionId, tier }) {
        var _a;
        const spinner = el.querySelector('#billing-spinner');
        const title = el.querySelector('#billing-title');
        const body = el.querySelector('#billing-body');
        const card = el.querySelector('#billing-status-card');
        const icon = el.querySelector('#billing-status-icon');
        const statusTitle = el.querySelector('#billing-status-title');
        const statusBody = el.querySelector('#billing-status-body');
        const actions = el.querySelector('#billing-actions');
        try {
            const upgraded = await billingService.verifySessionEntitlementWithGrace(5);
            spinner.style.display = 'none';
            title.textContent = upgraded ? 'Welcome to Premium' : 'Almost there…';
            body.textContent = upgraded
                ? 'Your subscription is active and premium scan engines are now unlocked.'
                : 'We\u0027ve received your payment. Your account will update automatically in the background.';
            if (upgraded) {
                card.style.display = 'block';
                card.className = 'billing-status-card success';
                icon.textContent = '🎉';
                statusTitle.textContent = 'Payment Confirmed';
                statusBody.textContent = `Session ${sessionId ? sessionId.slice(0, 12) + '…' : ''} processed successfully.`;
                actions.innerHTML = `<a href="#/dashboard" class="btn btn-primary">Go to Dashboard →</a>`;
            }
            else {
                // Render the rich pending-activation fallback card
                card.style.display = 'block';
                card.className = 'billing-status-card';
                card.innerHTML = '';
                const pendingCard = new PendingActivationCard({
                    sessionId,
                    tier: tier || 'premium',
                    onRefresh: async () => {
                        const refreshed = await authService.validateSession();
                        if (!refreshed)
                            return false;
                        const user = authService.getUser() || {};
                        const t = user.tier || user.plan || 'free';
                        return t !== 'free' && t !== 'sandbox' && t !== 'community';
                    },
                    onContactSupport: () => {
                        window.open('mailto:support@simplebeacon.ai?subject=Delayed%20Activation', '_blank');
                    }
                });
                card.appendChild(pendingCard.render());
                actions.innerHTML = '<a href="#/dashboard" class="btn btn-primary">Go to Dashboard →</a>';
            }
        }
        catch (err) {
            console.error('[billing-landing] grace-loop-failed', err);
            spinner.style.display = 'none';
            title.textContent = 'Something went wrong';
            body.textContent = 'We couldn\u0027t verify your subscription status. If you were charged, your account will still update automatically.';
            card.style.display = 'block';
            card.className = 'billing-status-card error';
            icon.textContent = '⚠️';
            statusTitle.textContent = 'Verification Error';
            statusBody.textContent = err.message || 'Please refresh the page or contact support if this persists.';
            actions.innerHTML = `
        <button type="button" class="btn btn-primary" id="billing-retry-btn">Retry</button>
        <a href="#/dashboard" class="btn btn-ghost">Dashboard</a>
      `;
            (_a = actions.querySelector('#billing-retry-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
                spinner.style.display = 'block';
                card.style.display = 'none';
                title.textContent = 'Confirming your subscription…';
                body.textContent = 'We\u0027re synchronizing your license with our billing system. This usually takes just a few seconds.';
                this._runGraceLoop(el, { sessionId, tier });
            });
        }
    }
    /**
     * Render the cancellation state when the user abandons checkout.
     * @param {HTMLElement} container
     * @param {{sessionId?: string, tier?: string}} params
     */
    _renderCancelState(container, { sessionId, tier }) {
        const el = document.createElement('div');
        el.className = 'fade-in billing-landing';
        el.innerHTML = `
      <style>
        .billing-landing { max-width: 560px; margin: 0 auto; padding: var(--space-8) var(--space-4); text-align: center; }
        .billing-landing h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 var(--space-3); }
        .billing-landing p { color: var(--text-muted); font-size: 0.95rem; margin: 0 auto var(--space-5); max-width: 420px; }
        .billing-status-card { background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-6); margin-top: var(--space-4); }
        .billing-status-icon { font-size: 2.5rem; margin-bottom: var(--space-3); }
        .billing-actions { display: flex; gap: var(--space-2); justify-content: center; flex-wrap: wrap; margin-top: var(--space-4); }
      </style>

      <div class="billing-landing">
        <div class="billing-status-card">
          <div class="billing-status-icon">❌</div>
          <h2>Checkout Cancelled</h2>
          <p>You cancelled the checkout process. No payment was processed.</p>
          <div class="billing-actions">
            <a href="#/pricing" class="btn btn-primary">Back to Pricing</a>
            <a href="#/dashboard" class="btn btn-ghost">Dashboard</a>
          </div>
        </div>
      </div>
    `;
        container.appendChild(el);
    }
}
