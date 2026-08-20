// simplebeacon-ignore governance-marker
import { authService } from './authService.js?v=20260722bridgefix1';
import { readJsonResponseBody, withRecoverableFallback } from '../lib/recoverable-fetch.js';
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
        'GitHub Action + pre-commit hooks',
      ],
    },
  },
};
const COMMUNITY_STATUS = {
  tier: 'community',
  subscriptionActive: false,
  bypass: true,
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
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (normalized) {
      localStorage.setItem(EMAIL_KEY, normalized);
    } else {
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
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
  getAuthHeaders() {
    return {};
  }
  getRequestHeaders(extra = {}) {
    return {
      ...authService.getAuthHeaders(),
      ...extra,
    };
  }
  isSubscribed() {
    return false;
  }
  hasCloudTeamsAccess(plan = this.plan, status = this.status) {
    return Boolean(
      (plan === null || plan === void 0 ? void 0 : plan.internalDashboard) ||
      (status === null || status === void 0 ? void 0 : status.bypass)
    );
  }
  async resolveEntitlement(_email = this.getEmail() || '') {
    const entitlementPayload = await withRecoverableFallback(
      'billing entitlements fetch',
      async () => {
        const entitlementResponse = await fetch('/api/simplebeacon/entitlements', {
          headers: this.getRequestHeaders(),
        });
        if (!entitlementResponse.ok) {
          throw new Error(`Entitlements unavailable (${entitlementResponse.status})`);
        }
        return readJsonResponseBody(entitlementResponse, null);
      },
      null
    );
    if (entitlementPayload) {
      this.plan = {
        ...COMMUNITY_PLAN,
        auditCheckoutUrl: entitlementPayload.auditCheckoutUrl,
        auditPriceLabel: entitlementPayload.auditPriceLabel || '$499',
      };
      this.status = {
        ...COMMUNITY_STATUS,
        publicGateLocked: Boolean(entitlementPayload.publicGateLocked),
        hasAuditDeliverableAccess: Boolean(entitlementPayload.hasAuditDeliverableAccess),
        bypass: Boolean(entitlementPayload.hasAuditDeliverableAccess),
      };
      return { plan: this.plan, status: this.status, allowed: this.hasCloudTeamsAccess(this.plan, this.status) };
    }
    this.plan = COMMUNITY_PLAN;
    this.status = COMMUNITY_STATUS;
    return {
      plan: this.plan,
      status: this.status,
      allowed: this.hasCloudTeamsAccess(this.plan, this.status),
    };
  }
  hasAuditDeliverableAccess(status = this.status) {
    return Boolean(
      (status === null || status === void 0 ? void 0 : status.hasAuditDeliverableAccess) ||
      (status === null || status === void 0 ? void 0 : status.bypass)
    );
  }
  getAuditCheckoutUrl(plan = this.plan) {
    return (
      (plan === null || plan === void 0 ? void 0 : plan.auditCheckoutUrl) ||
      'mailto:admin@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report'
    );
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
  async startCheckout(product = 'startup_monthly', email = '') {
    const normalizedEmail = this.setEmail(email || this.getEmail());
    if (!normalizedEmail) {
      const err = new Error('Email is required for checkout');
      err.code = 'email_required';
      throw err;
    }
    const response = await fetch('/api/simplebeacon/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getRequestHeaders(),
      },
      body: JSON.stringify({ email: normalizedEmail, product }),
    });
    const data = await readJsonResponseBody(response, {});
    if (!response.ok) {
      const err = new Error(data.message || data.error || 'Checkout failed');
      err.code = data.error || 'checkout_failed';
      throw err;
    }
    if (data.url) {
      window.location.href = data.url;
      return data;
    }
    throw new Error('Stripe checkout URL missing — set STRIPE_PRICE_ID_STARTUP_MONTHLY on server');
  }

  async fetchCheckoutSession(sessionId) {
    const response = await fetch(`/api/simplebeacon/billing/session?session_id=${encodeURIComponent(sessionId)}`, {
      headers: {
        Accept: 'application/json',
        ...this.getRequestHeaders(),
      },
    });
    const data = await readJsonResponseBody(response, {});
    if (!response.ok) {
      const err = new Error(data.message || data.error || 'Session lookup failed');
      err.code = data.error || 'session_lookup_failed';
      throw err;
    }
    return data;
  }

  async confirmSession(sessionId) {
    if (!sessionId) {
      return { subscription: this.status };
    }
    const data = await this.fetchCheckoutSession(sessionId);
    const token = data?.token || data?.licenseToken;
    if (token) {
      this.setApiToken(token);
      if (data.email) {
        this.setEmail(data.email);
      }
      this.status = {
        ...COMMUNITY_STATUS,
        tier: data.tier || data.subscription?.tier || 'team',
        subscriptionActive: true,
        bypass: false,
      };
    }
    return { subscription: this.status, ...data };
  }

  async openPortal() {
    const err = new Error('No billing portal — community CLI is open source.');
    err.code = 'billing_unavailable';
    throw err;
  }
}
/**
 * Billing service.
 */
export const billingService = new BillingService();
