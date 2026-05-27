(function () {
  'use strict';

  var cfg = window.SIMPLEBEACON_SITE || {};
  var closedSource = cfg.closedSource !== false;

  function paymentsActive() {
    return cfg.paymentsEnabled !== false && String(cfg.stripePaymentLink || '').trim();
  }

  function auditEmail() {
    return cfg.auditEmail || 'audit@simplebeacon.ai';
  }

  function applyCheckoutButtons() {
    var stripe = paymentsActive() ? String(cfg.stripePaymentLink || '').trim() : '';
    var external = /^https?:\/\//i.test(stripe);

    document.querySelectorAll('[data-stripe-checkout], .cta-billing-btn, .paywall-gate-cta').forEach(function (el) {
      if (paymentsActive() && external) {
        el.href = stripe;
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
        el.removeAttribute('role');
        el.onclick = null;
        if (cfg.productionSite && !el.getAttribute('data-booking-scroll')) {
          el.textContent = el.textContent.replace(/Book Audit/i, 'Pay $499 & book audit');
        }
        return;
      }

      el.href = '#auditBookingForm';
      el.removeAttribute('target');
      el.setAttribute('role', 'button');
      el.onclick = function (event) {
        event.preventDefault();
        var source = el.getAttribute('data-booking-scroll') || 'pricing';
        if (window.SIMPLEBEACON_SCROLL_TO_BOOKING) {
          window.SIMPLEBEACON_SCROLL_TO_BOOKING(source);
        }
      };
    });
  }

  function applySampleReportLinks() {
    var sampleUrl = String(cfg.sampleReportUrl || '/sample-report.html').trim();
    if (!sampleUrl.startsWith('/')) sampleUrl = '/' + sampleUrl.replace(/^\/+/, '');
    document.querySelectorAll('[data-sample-report]').forEach(function (el) {
      el.href = sampleUrl;
    });
  }

  function applyBookingFormVisibility() {
    var form = document.getElementById('auditBookingForm');
    if (!form) return;

    var hideOnLiveCheckout = paymentsActive() && cfg.productionSite;
    form.hidden = hideOnLiveCheckout;

    var intro = form.querySelector('.audit-booking-intro');
    if (intro) {
      if (paymentsActive() && cfg.stagingMode) {
        intro.textContent =
          'Optional on staging — use Stripe test checkout above, or submit here to exercise the booking API.';
      } else if (!paymentsActive()) {
        intro.textContent =
          'Fill in below — saved to the operator inbox immediately (no payment required while testing).';
      }
    }

    document.querySelectorAll('[data-audit-email-display]').forEach(function (el) {
      el.textContent = auditEmail();
    });

    document.querySelectorAll('[data-operator-inbox-link]').forEach(function (el) {
      el.hidden = paymentsActive() && cfg.productionSite;
    });
  }

  function applyEnvironmentBanner() {
    if (document.getElementById('stagingBanner')) return;

    var paymentsOff = !paymentsActive();
    var staging = cfg.stagingMode;
    if (!paymentsOff && !staging) return;

    var banner = document.createElement('div');
    banner.id = 'stagingBanner';
    banner.className = 'staging-banner';
    banner.setAttribute('role', 'status');

    if (paymentsOff) {
      var inbox = String(cfg.operatorInboxUrl || '/operator/bookings').trim();
      banner.innerHTML =
        '<strong>Payments off (testing mode)</strong> — Submit the booking form, then confirm data in the ' +
        '<a href="' + inbox + '">operator inbox</a>. Email via Resend is optional until you enable payments.';
    } else {
      banner.innerHTML =
        '<strong>Staging / test environment</strong> — Stripe test checkout only (card 4242…). ' +
        'Live billing activates only on <code>simplebeacon.ai</code>.';
    }

    document.body.insertBefore(banner, document.body.firstChild);
    if (staging) document.documentElement.setAttribute('data-staging-mode', 'true');
    if (paymentsOff) document.documentElement.setAttribute('data-payments-disabled', 'true');
  }

  window.SIMPLEBEACON_APPLY_CHECKOUT = applyCheckoutButtons;
  applyCheckoutButtons();
  applySampleReportLinks();
  applyBookingFormVisibility();
  applyEnvironmentBanner();

  if (closedSource) {
    document.documentElement.setAttribute('data-closed-source', 'true');
  }
})();
