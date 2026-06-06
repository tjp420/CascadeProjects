// SimpleBeacon Site Configuration
window.SIMPLEBEACON_SITE = window.SIMPLEBEACON_SITE || {
  env: 'production',
  githubUrl: 'https://github.com/tjp420/simplebeacon',
  sampleReportUrl: 'sample-report.html',
  sampleCertificateUrl: 'sample-certificate.html',
  sampleEuAiActReportUrl: null,
  pricingUrl: 'pricing.html',
  communityUrl: 'community.html',
  contactUrl: 'contact.html',
  contactPageUrl: 'contact.html',
  termsUrl: 'terms.html',
  privacyUrl: 'privacy.html',
  refundUrl: 'refund.html',
  cloudTeamsUrl: null,
  auditEmail: 'audit@simplebeacon.ai',

  // Unified pricing source of truth
  pricing: {
    free: {
      name: 'Free AI Slop Audit',
      price: 0,
      stripeLink: null,
      testStripeLink: null
    },
    instant: {
      name: 'Instant Website Report',
      price: 19,
      stripeLink: 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07',
      testStripeLink: null
    },
    executive: {
      name: 'Executive Risk Certificate',
      price: 499,
      stripeLink: 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05',
      testStripeLink: null
    },
    euSprint: {
      name: 'EU AI Act Sprint',
      price: 2499,
      stripeLink: 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06',
      testStripeLink: null
    }
  },

  // Legacy aliases for backward compatibility
  instantReportLink: 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07',
  stripePaymentLink: 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05',
  euAiActPackLink: 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06',

  apiBase: (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://simplebeacon.onrender.com',
  stagingMode: false,
  paymentsEnabled: true,
  closedSource: false
};

// Override Stripe links from server environment configuration (falls back to hardcoded values above)
(function () {
  try {
    var apiBase = window.SIMPLEBEACON_SITE.apiBase || '';
    fetch(apiBase + '/api/config/pricing')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.success || !data.pricing) return;
        var cfg = window.SIMPLEBEACON_SITE;
        var p = data.pricing;
        if (p.instant && p.instant.stripeLink) {
          cfg.pricing.instant.stripeLink = p.instant.stripeLink;
          cfg.instantReportLink = p.instant.stripeLink;
        }
        if (p.executive && p.executive.stripeLink) {
          cfg.pricing.executive.stripeLink = p.executive.stripeLink;
          cfg.stripePaymentLink = p.executive.stripeLink;
        }
        if (p.euSprint && p.euSprint.stripeLink) {
          cfg.pricing.euSprint.stripeLink = p.euSprint.stripeLink;
          cfg.euAiActPackLink = p.euSprint.stripeLink;
        }
      })
      .catch(function () { /* ignore — fall back to hardcoded values */ });
  } catch (e) { /* ignore */ }
})();