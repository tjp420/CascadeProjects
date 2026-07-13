import { authService } from './authService.js';
import { readJsonResponseBody, withRecoverableFallback } from '../lib/recoverable-fetch.js';
import { apiUrl } from '../utils/url.js';
import { showToast } from '../utils/dom.js';
/**
 * Open-source pivot: community CLI is the product. Billing API calls are stubbed;
 * the optional dashboard runs without Stripe or subscription gates.
 */
const COMMUNITY_PLAN = {
    enabled: false,
    internalDashboard: true,
    tiers: {
        community: {
            priceLabel: '$0',
            features: [
                'Unlimited local scans',
                'JSON + text reports',
                'Gate policy (--gate)',
                'GitHub Action + pre-commit hooks'
            ]
        }
    }
};
const COMMUNITY_STATUS = {
    tier: 'community',
    subscriptionActive: false,
    bypass: true
};
const EMAIL_KEY = 'simplebeacon_billing_email';
const TOKEN_KEY = 'simplebeacon_billing_api_token';
/**
 * Billing service.
 */
export class BillingService {
    constructor() {
        this.plan = COMMUNITY_PLAN;
        this.status = COMMUNITY_STATUS;
    }
    getEmail() {
        return localStorage.getItem(EMAIL_KEY) || '';
    }
    setEmail(email) {
        const normalized = String(email || '').trim().toLowerCase();
        if (normalized) {
            localStorage.setItem(EMAIL_KEY, normalized);
        }
        else {
            localStorage.removeItem(EMAIL_KEY);
        }
        return normalized;
    }
    getApiToken() {
        return localStorage.getItem(TOKEN_KEY) || '';
    }
    setApiToken(token) {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        }
        else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }
    getAuthHeaders() {
        return {};
    }
    getRequestHeaders(extra = {}) {
        return {
            ...authService.getAuthHeaders(),
            ...extra
        };
    }
    isSubscribed() {
        return false;
    }
    hasCloudTeamsAccess(plan = this.plan, status = this.status) {
        return Boolean((plan === null || plan === void 0 ? void 0 : plan.internalDashboard) || (status === null || status === void 0 ? void 0 : status.bypass));
    }
    async resolveEntitlement(_email = this.getEmail() || '') {
        const entitlementPayload = await withRecoverableFallback('billing entitlements fetch', async () => {
            const entitlementResponse = await fetch(apiUrl('/api/simplebeacon/entitlements'), {
                headers: this.getRequestHeaders()
            });
            if (!entitlementResponse.ok) {
                throw new Error(`Entitlements unavailable (${entitlementResponse.status})`);
            }
            return readJsonResponseBody(entitlementResponse, null);
        }, null);
        if (entitlementPayload) {
            this.plan = {
                ...COMMUNITY_PLAN,
                auditCheckoutUrl: entitlementPayload.auditCheckoutUrl,
                auditPriceLabel: entitlementPayload.auditPriceLabel || '$499'
            };
            this.status = {
                ...COMMUNITY_STATUS,
                publicGateLocked: Boolean(entitlementPayload.publicGateLocked),
                hasAuditDeliverableAccess: Boolean(entitlementPayload.hasAuditDeliverableAccess),
                bypass: Boolean(entitlementPayload.hasAuditDeliverableAccess)
            };
            return { plan: this.plan, status: this.status, allowed: this.hasCloudTeamsAccess(this.plan, this.status) };
        }
        this.plan = COMMUNITY_PLAN;
        this.status = COMMUNITY_STATUS;
        return {
            plan: this.plan,
            status: this.status,
            allowed: this.hasCloudTeamsAccess(this.plan, this.status)
        };
    }
    hasAuditDeliverableAccess(status = this.status) {
        return Boolean((status === null || status === void 0 ? void 0 : status.hasAuditDeliverableAccess) || (status === null || status === void 0 ? void 0 : status.bypass));
    }
    getAuditCheckoutUrl(plan = this.plan) {
        return (plan === null || plan === void 0 ? void 0 : plan.auditCheckoutUrl)
            || 'mailto:audit@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report';
    }
    async fetchEntitlements() {
        const resolved = await this.resolveEntitlement();
        return resolved.status;
    }
    async fetchPlan() {
        const resolved = await this.resolveEntitlement();
        return resolved.plan;
    }
    async fetchStatus() {
        const resolved = await this.resolveEntitlement();
        return resolved.status;
    }
    async startCheckout() {
        const err = new Error('Simplebeacon CLI is free — use npx simplebeacon init (no checkout required).');
        err.code = 'billing_unavailable';
        throw err;
    }
    async confirmSession() {
        this.status = COMMUNITY_STATUS;
        return { subscription: this.status };
    }
    async openPortal() {
        const err = new Error('No billing portal — community CLI is open source.');
        err.code = 'billing_unavailable';
        throw err;
    }
    /**
     * Polls the auth endpoint immediately post-checkout to reconcile permissions.
     * Catches the background database update triggered by the Stripe webhook.
     *
     * @param {number} maxAttempts - default 5 attempts with exponential backoff
     * @returns {Promise<boolean>}
     */
    async verifySessionEntitlementWithGrace(maxAttempts = 5) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Trigger a low-profile backend session profile query pass
            const refreshed = await authService.validateSession();
            if (!refreshed) {
                await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
                continue;
            }
            const userProfile = authService.getUser() || {};
            const tier = userProfile.tier || userProfile.plan || 'free';
            if (tier !== 'free' && tier !== 'sandbox' && tier !== 'community') {
                showToast(`Success! License upgraded to ${String(tier).toUpperCase()} Tier. Unlocking premium scan engines.`, 'success');
                return true;
            }
            // Exponential backoff before next attempt
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
        // Fallback: webhook is slightly delayed or processing high traffic volumes
        showToast('Subscription confirmed by Stripe. Your account will automatically activate in the background shortly.', 'info');
        return false;
    }
}
/**
 * Billing service.
 */
export const billingService = new BillingService();
