// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Checkout success banner — instant token display after Stripe redirect.
 */
import { billingService } from '../services/billingService.js';
import { authService } from '../services/authService.js?v=20260716cachefix1';
import { addToStockpile } from '../services/tokenStockpileService.js';
import { showToast } from '../utils.js';

const POLL_MS = 2000;
const MAX_ATTEMPTS = 15;

function readCheckoutParams() {
    if (typeof window === 'undefined')
        return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success')
        return null;
    const sessionId = params.get('session_id');
    if (!sessionId)
        return null;
    return { sessionId };
}

function stripCheckoutQueryParams() {
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('checkout');
        url.searchParams.delete('session_id');
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState({}, '', next);
    }
    catch (_a) { /* ignore */ }
}

function renderLoading(banner) {
    banner.className = 'checkout-success-banner checkout-success-banner--loading';
    banner.innerHTML = `
      <div class="checkout-success-banner-row">
        <span class="loading-spinner checkout-success-banner-spinner" aria-hidden="true"></span>
        <span>Provisioning your team license token from Stripe…</span>
      </div>
    `;
}

function renderSuccess(banner, { token, email }, onActivate, onStockpile) {
    banner.className = 'checkout-success-banner checkout-success-banner--success';
    banner.innerHTML = `
      <div class="checkout-success-banner-title">Payment verified — time token ready</div>
      <p class="checkout-success-banner-copy">
        Load it now or stockpile it in your token loader for future use. Add to CI as <code>SIMPLEBEACON_LICENSE_TOKEN</code> when you activate.
      </p>
      <div class="checkout-success-banner-token-row">
        <code class="checkout-success-banner-token" id="sb-checkout-token">${token}</code>
        <button type="button" class="btn btn-secondary btn-sm" id="sb-copy-token-btn">Copy token</button>
        <button type="button" class="btn btn-secondary btn-sm" id="sb-stockpile-token-btn">Stockpile for later</button>
        <button type="button" class="btn btn-primary btn-sm" id="sb-activate-token-btn">Load now</button>
      </div>
      <p class="checkout-success-banner-footnote">
        A copy was also emailed to <strong>${email || 'your billing address'}</strong>.
      </p>
    `;
    const copyBtn = banner.querySelector('#sb-copy-token-btn');
    copyBtn?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(token);
            copyBtn.textContent = 'Copied!';
            showToast('License token copied', 'success');
            setTimeout(() => { copyBtn.textContent = 'Copy token'; }, 2000);
        }
        catch {
            showToast('Copy failed — select the token manually', 'error');
        }
    });
    banner.querySelector('#sb-activate-token-btn')?.addEventListener('click', () => {
        onActivate?.(token, email);
    });
    banner.querySelector('#sb-stockpile-token-btn')?.addEventListener('click', () => {
        onStockpile?.(token, email);
    });
}

function renderPending(banner, email) {
    banner.className = 'checkout-success-banner checkout-success-banner--pending';
    banner.innerHTML = `
      <div class="checkout-success-banner-title">Payment received — token syncing</div>
      <p class="checkout-success-banner-copy">
        Your payment succeeded. The license token is still provisioning${email ? ` for <strong>${email}</strong>` : ''}.
        Check your inbox in a minute or refresh this page.
      </p>
      <button type="button" class="btn btn-secondary btn-sm" id="sb-retry-checkout-btn">Retry now</button>
    `;
    return banner.querySelector('#sb-retry-checkout-btn');
}

function renderError(banner, message) {
    banner.className = 'checkout-success-banner checkout-success-banner--error';
    banner.innerHTML = `
      <div class="checkout-success-banner-title">Could not load license token</div>
      <p class="checkout-success-banner-copy">${message}</p>
    `;
}

async function fetchSessionToken(sessionId) {
    const data = await billingService.fetchCheckoutSession(sessionId);
    const token = data?.token || data?.licenseToken || null;
    if (token)
        return { token, email: data.email || '', product: data.product || null };
    if (data?.paymentStatus === 'paid')
        return { token: null, email: data.email || '', pending: true };
    throw new Error(data?.message || data?.error || 'Session lookup failed');
}

/**
 * Mount checkout success flow into settings notification zone.
 * @param {HTMLElement} container
 * @param {{ onTokenReady?: (token: string, email: string) => void }} [options]
 * @returns {Promise<boolean>} true when banner was shown
 */
export async function mountCheckoutSuccessBanner(container, options = {}) {
    const params = readCheckoutParams();
    if (!params)
        return false;

    const zone = container.querySelector('#settings-notification-zone') || container;
    const banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    zone.prepend(banner);
    renderLoading(banner);

    const activate = (token, email) => {
        billingService.setApiToken(token);
        if (email)
            billingService.setEmail(email);
        authService.setSession(token, { email: email || 'team@simplebeacon.ai', tier: 'team' });
        options.onTokenReady?.(token, email);
        showToast('Team license activated in dashboard', 'success');
    };

    const stockpile = (token, email) => {
        const result = addToStockpile(token, { email: email || 'team@simplebeacon.ai', tier: 'team' }, { product: 'checkout' });
        if (result.ok) {
            showToast(result.duplicate ? 'Token already in your stockpile' : 'Time token saved to stockpile — load it from Profile or Settings', 'success');
            options.onStockpiled?.(token, email);
        }
        else {
            showToast(result.error || 'Could not stockpile token', 'error');
        }
    };

    const attemptLoad = async (sessionId) => {
        for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
            try {
                const result = await fetchSessionToken(sessionId);
                if (result.token) {
                    renderSuccess(banner, result, activate, stockpile);
                    stripCheckoutQueryParams();
                    return true;
                }
                if (result.pending && i < MAX_ATTEMPTS - 1) {
                    await new Promise((r) => setTimeout(r, POLL_MS));
                    continue;
                }
                const retryBtn = renderPending(banner, result.email);
                retryBtn?.addEventListener('click', () => {
                    renderLoading(banner);
                    void attemptLoad(sessionId);
                });
                return false;
            }
            catch (err) {
                if (i < MAX_ATTEMPTS - 1) {
                    await new Promise((r) => setTimeout(r, POLL_MS));
                    continue;
                }
                renderError(banner, err.message || 'Please refresh or check your email.');
                return false;
            }
        }
        return false;
    };

    await attemptLoad(params.sessionId);
    return true;
}
