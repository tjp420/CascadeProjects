(function () {
  'use strict';

  var cfg = window.SIMPLEBEACON_SITE || {};
  var closedSource = cfg.closedSource !== false;

  function auditEmail() {
    return cfg.auditEmail || 'audit@simplebeacon.ai';
  }

  function isStripeUrl(url) {
    return /^https:\/\/buy\.stripe\.com\//i.test(String(url || '').trim());
  }

  function clearLinkHandlers(el) {
    el.removeAttribute('target');
    el.removeAttribute('rel');
    el.removeAttribute('role');
    el.onclick = null;
  }

  function wireStripe(el, url) {
    el.href = url;
    clearLinkHandlers(el);
  }

  function wireBookingForm(el) {
    el.href = '#auditBookingForm';
    clearLinkHandlers(el);
  }

  function applyCheckoutLinks() {
    var auditLink = String(cfg.stripePaymentLink || '').trim();
    var projectLink = String(cfg.agencyProjectPackLink || '').trim();
    var growthLink = String(cfg.agencyGrowthPackLink || '').trim();

    document.querySelectorAll('a.checkout-audit, [data-stripe-checkout]').forEach(function (el) {
      if (isStripeUrl(auditLink)) wireStripe(el, auditLink);
      else wireBookingForm(el);
    });

    document.querySelectorAll('[data-agency-checkout="agency_project_pack"], a.checkout-agency-project').forEach(function (el) {
      if (isStripeUrl(projectLink)) wireStripe(el, projectLink);
      else el.href = contactPageHref('agency');
    });

    document.querySelectorAll('[data-agency-checkout="agency_growth_pack"], a.checkout-agency-growth').forEach(function (el) {
      if (isStripeUrl(growthLink)) wireStripe(el, growthLink);
      else el.href = contactPageHref('agency');
    });

    var euAiActLink = String(cfg.euAiActPackLink || '').trim();
    document.querySelectorAll('[data-eu-ai-checkout], a.checkout-eu-ai-act').forEach(function (el) {
      if (isStripeUrl(euAiActLink)) wireStripe(el, euAiActLink);
      else el.href = contactPageHref('eu-ai-act');
    });

    document.querySelectorAll('a.checkout-direct').forEach(function (el) {
      if (el.hasAttribute('data-agency-checkout')) return;
      var href = String(el.getAttribute('href') || '');
      if (isStripeUrl(href) && !isStripeUrl(auditLink) && !isStripeUrl(projectLink) && !isStripeUrl(growthLink)) {
        wireBookingForm(el);
      }
    });
  }

  function applyDataTierCheckoutLinks() {
    var pricing = cfg.pricing || {};
    var isStaging = cfg.stagingMode === true || cfg.env !== 'production';

    document.querySelectorAll('.checkout-btn[data-tier]').forEach(function (el) {
      var tierKey = el.getAttribute('data-tier');
      var tierData = pricing[tierKey];
      if (!tierData) return;

      // For anchor tags, set href directly
      if (el.tagName === 'A') {
        var url = isStaging ? (tierData.testStripeLink || tierData.stripeLink) : tierData.stripeLink;
        if (isStripeUrl(url)) {
          wireStripe(el, url);
        } else if (tierKey === 'free') {
          el.href = 'index.html#audit';
        } else {
          el.href = contactPageHref(tierKey);
        }
        return;
      }

      // For buttons, attach click handler
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var url = isStaging ? (tierData.testStripeLink || tierData.stripeLink) : tierData.stripeLink;
        // URL validated: only Stripe payment links or internal anchors allowed
        if (isStripeUrl(url)) {
          window.location.href = url;
        } else if (tierKey === 'free') {
          window.location.href = 'index.html#audit';
        } else {
          window.location.href = contactPageHref(tierKey);
        }
      });
    });
  }

  function applyStagingCheckoutSwap() {
    if (!cfg.stagingMode) return;
    var testStripe = String(cfg.stripePaymentLink || '').trim();
    if (!/^https:\/\/buy\.stripe\.com\/test_/i.test(testStripe)) return;
    document.querySelectorAll('a.checkout-audit, [data-stripe-checkout]').forEach(function (el) {
      wireStripe(el, testStripe);
    });
  }

  function applySampleReportLinks() {
    var sampleUrl = String(cfg.sampleReportUrl || 'sample-report.html').trim();
    // Don't force leading slash for file:// protocol (local development)
    if (!sampleUrl.startsWith('/') && window.location.protocol !== 'file:') {
      sampleUrl = '/' + sampleUrl.replace(/^\/+/, '');
    }
    document.querySelectorAll('[data-sample-report]').forEach(function (el) {
      el.href = sampleUrl;
      clearLinkHandlers(el);
    });
    var euSampleUrl = cfg.sampleEuAiActReportUrl ? String(cfg.sampleEuAiActReportUrl).trim() : '';
    if (euSampleUrl) {
      // Don't force leading slash for file:// protocol (local development)
      if (!euSampleUrl.startsWith('/') && window.location.protocol !== 'file:') {
        euSampleUrl = '/' + euSampleUrl.replace(/^\/+/, '');
      }
      document.querySelectorAll('[data-eu-ai-sample-report]').forEach(function (el) {
        el.href = euSampleUrl;
        clearLinkHandlers(el);
      });
    }
  }

  function contactPageHref(topic) {
    var base = String(cfg.contactPageUrl || 'contact.html').trim();
    if (!topic) return base;
    var sep = base.indexOf('?') >= 0 ? '&' : '?';
    return base + sep + 'topic=' + encodeURIComponent(topic);
  }

  function applyAuditEmailLinks() {
    var email = auditEmail();
    document.querySelectorAll('[data-audit-email-display]').forEach(function (el) {
      el.textContent = email;
    });
    document.querySelectorAll('[data-audit-email-link]').forEach(function (el) {
      if (el.tagName !== 'A') return;
      if (el.hasAttribute('data-audit-email-mailto')) {
        var subject = String(el.getAttribute('data-audit-email-subject') || 'SimpleBeacon inquiry').trim();
        el.href = 'mailto:' + email + '?subject=' + encodeURIComponent(subject);
        el.textContent = el.getAttribute('data-audit-email-label') || email;
      } else {
        var topic = String(el.getAttribute('data-audit-email-topic') || 'audit').trim();
        el.href = contactPageHref(topic);
        el.textContent = el.getAttribute('data-audit-email-label') || 'Contact us';
      }
      clearLinkHandlers(el);
    });
    document.querySelectorAll('[data-contact-link]').forEach(function (el) {
      if (el.tagName !== 'A') return;
      var topic = el.getAttribute('data-contact-topic') || '';
      el.href = contactPageHref(topic);
      clearLinkHandlers(el);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function applyEnvironmentBanner() {
    if (document.getElementById('stagingBanner') || !cfg.stagingMode) return;

    var banner = document.createElement('div');
    banner.id = 'stagingBanner';
    banner.className = 'staging-banner';
    banner.setAttribute('role', 'status');
    const STRIPE_TEST_CARD_PREFIX = '4242';
    banner.innerHTML =
      '<strong>Staging / test environment</strong> — Stripe test checkout only (card ' + STRIPE_TEST_CARD_PREFIX + '…). ' +
      'Live billing activates only on <code>simplebeacon.ai</code>.';
    document.body.insertBefore(banner, document.body.firstChild);
    document.documentElement.setAttribute('data-staging-mode', 'true');
  }

  applyCheckoutLinks();
  applyDataTierCheckoutLinks();
  applyStagingCheckoutSwap();
  applySampleReportLinks();
  applyAuditEmailLinks();
  applyEnvironmentBanner();

  if (closedSource) {
    document.documentElement.setAttribute('data-closed-source', 'true');
  }
})();