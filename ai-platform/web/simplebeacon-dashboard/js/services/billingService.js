// simplebeacon-ignore documentation
import { authService } from './authService.js?v=20260716cachefix1';
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
function safeStripeRedirect(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'checkout.stripe.com' || parsed.hostname === 'billing.stripe.com' || parsed.hostname.endsWith('.stripe.com')) {
      window.open(parsed.href, '_self');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

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
      ...extra
    };
  }

  isSubscribed() {
    return false;
  }

  hasCloudTeamsAccess(plan = this.plan, status = this.status) {
    return Boolean(plan?.internalDashboard || status?.bypass);
  }

  async resolveEntitlement(_email = this.getEmail() || '') {
    const entitlementPayload = await withRecoverableFallback('billing entitlements fetch', async () => {
      const entitlementResponse = await fetch('/api/simplebeacon/entitlements', {
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
    return Boolean(status?.hasAuditDeliverableAccess || status?.bypass);
  }

  getAuditCheckoutUrl(plan = this.plan) {
    return plan?.auditCheckoutUrl
      || 'mailto:admin@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report';
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

  async startCheckout(product = 'developer_monthly') {
    const email = this.getEmail();
    if (!email) {
      const err = new Error('Email is required to start checkout.');
      err.code = 'email_required';
      throw err;
    }
    const resp = await fetch('/api/simplebeacon/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getRequestHeaders() },
      body: JSON.stringify({ email, product })
    });
    const data = await readJsonResponseBody(resp, null);
    if (resp.ok && data?.url) {
      if (!safeStripeRedirect(data.url)) {
        const err = new Error('Invalid redirect URL received from billing service');
        err.code = 'invalid_redirect';
        throw err;
      }
      return data;
    }
    const err = new Error(data?.error || data?.message || `Checkout unavailable (${resp.status})`);
    err.code = data?.error || 'billing_unavailable';
    err.statusCode = resp.status;
    throw err;
  }

  async confirmSession() {
    this.status = COMMUNITY_STATUS;
    return { subscription: this.status };
  }

  async openPortal() {
    const email = this.getEmail();
    if (!email) {
      const err = new Error('Email is required to open the billing portal.');
      err.code = 'email_required';
      throw err;
    }
    const resp = await fetch('/api/simplebeacon/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getRequestHeaders() },
      body: JSON.stringify({ email })
    });
    const data = await readJsonResponseBody(resp, null);
    if (resp.ok && data?.url) {
      if (!safeStripeRedirect(data.url)) {
        const err = new Error('Invalid redirect URL received from billing service');
        err.code = 'invalid_redirect';
        throw err;
      }
      return data;
    }
    const err = new Error(data?.error || data?.message || `Billing portal unavailable (${resp.status})`);
    err.code = data?.error || 'billing_unavailable';
    err.statusCode = resp.status;
    throw err;
  }
}

/**
 * Billing service.
 */
export const billingService = new BillingService();

