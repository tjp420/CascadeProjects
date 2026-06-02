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
    var euSampleUrl = String(cfg.sampleEuAiActReportUrl || 'eu-ai-act-sample-report.html').trim();
    // Don't force leading slash for file:// protocol (local development)
    if (!euSampleUrl.startsWith('/') && window.location.protocol !== 'file:') {
      euSampleUrl = '/' + euSampleUrl.replace(/^\/+/, '');
    }
    document.querySelectorAll('[data-eu-ai-sample-report]').forEach(function (el) {
      el.href = euSampleUrl;
      clearLinkHandlers(el);
    });
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

  function applyPaymentsBanner() {
    if (document.getElementById('paymentsBanner')) return;
    if (cfg.stagingMode) return;
    if (document.getElementById('auditBookingForm')) return;

    var projectLink = String(cfg.agencyProjectPackLink || '').trim();
    var growthLink = String(cfg.agencyGrowthPackLink || '').trim();
    var needsBanner = cfg.paymentsEnabled !== false
      && (!isStripeUrl(projectLink) || !isStripeUrl(growthLink));

    if (!needsBanner) return;

    var banner = document.createElement('div');
    banner.id = 'paymentsBanner';
    banner.className = 'staging-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<strong>Agency pack checkout refreshing</strong> — email ' +
      '<a href="mailto:' + auditEmail() + '">' + auditEmail() + '</a> to purchase.';
    document.body.insertBefore(banner, document.body.firstChild);
    document.documentElement.setAttribute('data-payments-pending', 'true');
  }

  function applyEnvironmentBanner() {
    if (document.getElementById('stagingBanner') || !cfg.stagingMode) return;

    var banner = document.createElement('div');
    banner.id = 'stagingBanner';
    banner.className = 'staging-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<strong>Staging / test environment</strong> — Stripe test checkout only (card 4242…). ' +
      'Live billing activates only on <code>simplebeacon.ai</code>.';
    document.body.insertBefore(banner, document.body.firstChild);
    document.documentElement.setAttribute('data-staging-mode', 'true');
  }

  applyCheckoutLinks();
  applyStagingCheckoutSwap();
  applySampleReportLinks();
  applyAuditEmailLinks();
  applyPaymentsBanner();
  applyEnvironmentBanner();

  if (closedSource) {
    document.documentElement.setAttribute('data-closed-source', 'true');
  }
})();