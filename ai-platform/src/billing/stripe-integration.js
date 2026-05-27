/**
 * Stripe Payment Integration for AI Coding Intelligence Dashboard
 *
 * Handles subscription management, checkout flow, and billing operations for the
 * AI Coding Intelligence Dashboard. This class provides a clean interface for Stripe
 * payment processing with proper error handling and fallback mechanisms.
 *
 * @class
 * @description Manages Stripe payment integration including checkout flows,
 * subscription management, and billing portal access
 * @author Technical Debt Analysis Team
 * @since 1.0.0
 * @version 2.0.0 - Refactored for better maintainability
 *
 * @example
 * // Create Stripe manager and initialize
 * const stripeManager = new StripeManager({
 *   stripePublicKey: 'pk_test_your_key',
 *   apiBaseUrl: 'https://api.yourdomain.com/api'
 * });
 *
 * await stripeManager.initialize();
 *
 * // Create checkout session
 * const session = await stripeManager.createCheckoutSession('price_basic_id', 'user@example.com');
 *
 * // Redirect to checkout
 * await stripeManager.redirectToCheckout('basic', 'user@example.com');
 *
 * @see https://stripe.com/docs/js
 */
class StripeManager {
  /**
   * Initialize Stripe Payment Manager with configuration options
   *
   * Sets up the Stripe integration with configurable API endpoints and pricing tiers.
   * The manager handles dynamic Stripe.js loading and provides fallback mechanisms
   * for development environments.
   *
   * @constructor
   * @param {Object} [options] - Optional configuration options
   * @param {string} [options.stripePublicKey] - Stripe publishable key (fallback: pk_test_your_key)
   * @param {string} [options.apiBaseUrl] - API base URL (fallback: https://change_this_api_base_url.com/api)
   * @param {Object} [options.priceIds] - Price ID mappings for different subscription tiers
   * @param {string} [options.priceIds.basic] - Basic tier price ID
   * @param {string} [options.priceIds.pro] - Pro tier price ID
   * @param {string} [options.priceIds.enterprise] - Enterprise tier price ID
   * @property {string} stripePublicKey - Stripe publishable key
   * @property {string} apiBaseUrl - API base URL
   * @property {Object|null} stripe - Stripe instance
   * @property {Object} prices - Price ID mappings
   * @property {boolean} isInitialized - Whether Stripe has been initialized
   * @since 1.0.0
   */
  constructor(options = {}) {
    // Security: Require STRIPE_PUBLIC_KEY environment variable
    this.stripePublicKey =
      options.stripePublicKey ||
      (typeof process !== 'undefined' && process.env?.STRIPE_PUBLIC_KEY
        ? process.env.STRIPE_PUBLIC_KEY
        : null);

    if (!this.stripePublicKey) {
      console.error('ERROR: STRIPE_PUBLIC_KEY environment variable is required');
      throw new Error('STRIPE_PUBLIC_KEY environment variable is required');
    }

    // API base URL - use environment variable or default to localhost
    this.apiBaseUrl =
      options.apiBaseUrl ||
      (typeof process !== 'undefined' && process.env?.API_BASE_URL
        ? process.env.API_BASE_URL
        : 'http://localhost:56742/api');

    // Price ID mappings
    this.prices = {
      basic: options.priceIds?.basic || 'price_basic_id',
      pro: options.priceIds?.pro || 'price_pro_id',
      enterprise: options.priceIds?.enterprise || 'price_enterprise_id',
    };

    this.stripe = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Stripe with publishable key
   *
   * Dynamically loads Stripe.js if not available and initializes the Stripe instance
   * with the configured publishable key. Handles initialization errors gracefully
   * and provides fallback functionality for development environments.
   *
   * @returns {Promise<boolean>} True if initialization successful, false otherwise
   * @throws {Error} When Stripe initialization fails critically
   * @since 1.0.0
   * @example
   * // Initialize Stripe manager
   * const success = await stripeManager.initialize();
   * if (success) {
   *   console.log('Stripe initialized successfully');
   * }
   */
  async initialize() {
    try {
      // Load Stripe.js dynamically if not available
      if (typeof Stripe === 'undefined') {
        await this.loadStripeJS();
      }

      // Initialize Stripe instance
      this.stripe = Stripe(this.stripePublicKey);
      this.isInitialized = true;

      console.log('✅ Stripe initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Stripe initialization error:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Load Stripe.js dynamically
   *
   * Loads the Stripe.js library dynamically by creating a script element and appending
   * it to the document head. Uses Promise-based approach for async loading.
   *
   * @private
   * @returns {Promise<void>} Promise that resolves when Stripe.js is loaded
   * @throws {Error} When Stripe.js fails to load
   * @since 1.0.0
   */
  loadStripeJS() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => {
        console.log('✅ Stripe.js loaded successfully');
        resolve();
      };
      script.onerror = error => {
        console.error('❌ Stripe.js loading error:', error);
        reject(new Error('Failed to load Stripe.js'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Make API request with error handling
   *
   * Generic method for making API requests with proper error handling and response
   * validation. Centralizes API communication logic and provides consistent error handling.
   *
   * @private
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options] - Request options
   * @param {string} [options.method='GET'] - HTTP method
   * @param {Object} [options.headers] - Request headers
   * @param {Object} [options.body] - Request body
   * @returns {Promise<Object>} API response data
   * @throws {Error} When API request fails
   * @since 2.0.0
   */
  async makeApiRequest(endpoint, options = {}) {
    const { method = 'GET', headers = {}, body = null } = options;

    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        method,
        headers,
        body,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request error for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Create checkout session for subscription
   *
   * Creates a Stripe checkout session for the specified price tier and customer email.
   * Uses the API to create the session and returns the session data for further processing.
   *
   * @param {string} priceId - Stripe price ID for the subscription tier
   * @param {string} customerEmail - Customer email address
   * @returns {Promise<Object>} Checkout session data
   * @throws {Error} When checkout session creation fails
   * @since 1.0.0
   * @example
   * // Create checkout session
   * const session = await stripeManager.createCheckoutSession(
   *   'price_basic_id',
   *   'user@example.com'
   * );
   * console.log('Session ID:', session.id);
   */
  async createCheckoutSession(priceId, customerEmail) {
    return this.makeApiRequest('/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        customerEmail,
      }),
    });
  }

  /**
   * Redirect to Stripe checkout
   *
   * Creates a checkout session and redirects the user to the Stripe checkout page.
   * Handles the complete checkout flow from session creation to redirect.
   *
   * @param {string} tier - Subscription tier (basic, pro, enterprise)
   * @param {string} customerEmail - Customer email address
   * @returns {Promise<void>} Promise that resolves when redirect is initiated
   * @throws {Error} When checkout redirect fails
   * @since 1.0.0
   * @example
   * // Redirect to checkout
   * await stripeManager.redirectToCheckout('pro', 'user@example.com');
   */
  async redirectToCheckout(tier, customerEmail) {
    try {
      const priceId = this.prices[tier];
      const session = await this.createCheckoutSession(priceId, customerEmail);

      const result = await this.stripe.redirectToCheckout({
        sessionId: session.id,
      });

      if (result.error) {
        throw new Error(`Stripe checkout error: ${result.error.message}`);
      }

      console.log('✅ Redirected to Stripe checkout');
    } catch (error) {
      console.error('❌ Redirect to checkout error:', error);
      throw error;
    }
  }

  /**
   * Get current subscription status
   *
   * Retrieves the current subscription status from the API. Returns subscription
   * information including status and tier. Provides fallback data when API fails.
   *
   * @returns {Promise<Object>} Subscription status data
   * @throws {Error} When API request fails
   * @since 1.0.0
   * @example
   * // Get subscription status
   * const status = await stripeManager.getSubscriptionStatus();
   * console.log('Subscription status:', status.status);
   * console.log('Current tier:', status.tier);
   */
  async getSubscriptionStatus() {
    try {
      return await this.makeApiRequest('/subscription-status');
    } catch (error) {
      console.error('❌ Subscription status error:', error);
      return { status: 'none', tier: 'free' };
    }
  }

  /**
   * Cancel subscription
   *
   * Cancels the user's active subscription through the API. Handles the cancellation
   * process and returns confirmation data.
   *
   * @returns {Promise<Object>} Cancellation confirmation data
   * @throws {Error} When cancellation fails
   * @since 1.0.0
   * @example
   * // Cancel subscription
   * const result = await stripeManager.cancelSubscription();
   * console.log('Subscription cancelled:', result.success);
   */
  async cancelSubscription() {
    return this.makeApiRequest('/cancel-subscription', {
      method: 'POST',
    });
  }

  /**
   * Update subscription (upgrade/downgrade)
   *
   * Updates the user's subscription to a different tier by changing the price ID.
   * Handles both upgrades and downgrades through the same API endpoint.
   *
   * @param {string} newPriceId - New price ID for the updated subscription
   * @returns {Promise<Object>} Update confirmation data
   * @throws {Error} When subscription update fails
   * @since 1.0.0
   * @example
   * // Update subscription to pro tier
   * const result = await stripeManager.updateSubscription('price_pro_id');
   * console.log('Subscription updated:', result.success);
   */
  async updateSubscription(newPriceId) {
    return this.makeApiRequest('/update-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId: newPriceId }),
    });
  }

  /**
   * Get billing portal URL
   *
   * Retrieves the Stripe billing portal URL for the current customer. This allows users
   * to manage their subscriptions, payment methods, and billing information.
   *
   * @returns {Promise<string>} Billing portal URL
   * @throws {Error} When billing portal access fails
   * @since 1.0.0
   * @example
   * // Get billing portal URL
   * const portalUrl = await stripeManager.getBillingPortalUrl();
   * window.location.href = portalUrl;
   */
  async getBillingPortalUrl() {
    const data = await this.makeApiRequest('/billing-portal');
    return data.url;
  }

  /**
   * Redirect to billing portal
   *
   * Retrieves the billing portal URL and redirects the user to manage their subscription
   * and billing information. Provides seamless integration with Stripe's billing portal.
   *
   * @returns {Promise<void>} Promise that resolves when redirect is initiated
   * @throws {Error} When redirect fails
   * @since 1.0.0
   * @example
   * // Redirect to billing portal
   * await stripeManager.redirectToBillingPortal();
   * console.log('Redirected to billing portal');
   */
  async redirectToBillingPortal() {
    try {
      const url = await this.getBillingPortalUrl();
      window.location.href = url;
      console.log('✅ Redirected to billing portal');
    } catch (error) {
      console.error('❌ Redirect to billing portal error:', error);
      throw error;
    }
  }
}

// Create global Stripe manager instance
const stripeManager = new StripeManager();

// Pricing configuration
const PRICING_TIERS = {
  basic: {
    name: 'Basic',
    price: 29,
    features: ['100 scans/month', 'Basic code analysis', 'Email support', 'Standard reports'],
    stripePriceId: 'price_basic_id',
  },
  pro: {
    name: 'Pro',
    price: 79,
    features: [
      'Unlimited scans',
      'Advanced AI analysis',
      'Priority support',
      'API access',
      'Advanced reports',
      'Custom integrations',
    ],
    stripePriceId: 'price_pro_id',
  },
  enterprise: {
    name: 'Enterprise',
    price: 199,
    features: [
      'Everything in Pro',
      'Dedicated support',
      'SLA guarantees',
      'Custom development',
      'Team collaboration',
      'Advanced analytics',
      'Priority processing',
    ],
    stripePriceId: 'price_enterprise_id',
  },
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StripeManager, stripeManager, PRICING_TIERS };
}
