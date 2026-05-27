import { authService } from './authService.js';

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

  async resolveEntitlement(email = this.getEmail() || '') {
    try {
      const res = await fetch('/api/simplebeacon/entitlements', {
        headers: this.getRequestHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        this.plan = {
          ...COMMUNITY_PLAN,
          auditCheckoutUrl: data.auditCheckoutUrl,
          auditPriceLabel: data.auditPriceLabel || '$499'
        };
        this.status = {
          ...COMMUNITY_STATUS,
          publicGateLocked: Boolean(data.publicGateLocked),
          hasAuditDeliverableAccess: Boolean(data.hasAuditDeliverableAccess),
          bypass: Boolean(data.hasAuditDeliverableAccess)
        };
        return { plan: this.plan, status: this.status, allowed: this.hasCloudTeamsAccess(this.plan, this.status) };
      }
    } catch {
      /* fall through to local defaults */
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
}

export const billingService = new BillingService();
