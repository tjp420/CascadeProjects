/**
 * Shared pricing + Stripe checkout for coming-soon pages.
 */
(function (global) {
  'use strict';

  var state = {
    interval: 'monthly',
    plan: null
  };

  function apiBase() {
    return global.SIMPLEBEACON_API || '';
  }

  function fetchPlan() {
    return fetch(apiBase() + '/api/simplebeacon/billing/plan')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function hydratePlan(plan) {
    if (!plan) return;
    state.plan = plan;

    var founding = plan.foundingMember || {};
    document.querySelectorAll('[data-founding-slots]').forEach(function (el) {
      if (founding.slots) el.textContent = founding.slots;
    });
    document.querySelectorAll('[data-founding-label]').forEach(function (el) {
      if (founding.label) el.textContent = founding.label;
    });
    document.querySelectorAll('.founding-banner').forEach(function (el) {
      el.hidden = founding.active === false;
    });

    var calendly = (plan && plan.calendlyUrl) ? String(plan.calendlyUrl).trim() : '';
    if (global.SIMPLEBEACON_APPLY_AUDIT_BOOKING) {
      global.SIMPLEBEACON_APPLY_AUDIT_BOOKING(calendly);
    }

    var teams = plan.tiers && plan.tiers.cloudTeams;
    if (!teams) return;

    var mo = (teams.monthly && teams.monthly.priceLabel) || '$49/month';
    var yr = (teams.annual && teams.annual.priceLabel) || '$390/year';
    var savings = (teams.annual && teams.annual.savingsLabel) || 'Save $198 vs monthly (20%)';

    document.querySelectorAll('[data-price-monthly]').forEach(function (el) {
      el.innerHTML = formatPriceHtml(mo, 'mo');
    });
    document.querySelectorAll('[data-price-annual]').forEach(function (el) {
      el.innerHTML = formatPriceHtml(yr, 'yr');
    });
    document.querySelectorAll('[data-annual-savings]').forEach(function (el) {
      el.textContent = savings;
    });

    updateIntervalDisplay();
    updateCheckoutButtons(plan);
  }

  function formatPriceHtml(label, unit) {
    var t = String(label || '').trim();
    if (/\/(month|year|mo|yr)\b/i.test(t)) {
      return t.replace(/\/month/i, '<small>/mo</small>').replace(/\/year/i, '<small>/yr</small>');
    }
    return t + '<small>/' + unit + '</small>';
  }

  function updateIntervalDisplay() {
    document.querySelectorAll('[data-interval-display]').forEach(function (el) {
      el.hidden = el.getAttribute('data-interval-display') !== state.interval;
    });
    document.querySelectorAll('[data-interval-btn]').forEach(function (btn) {
      var on = btn.getAttribute('data-interval-btn') === state.interval;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function updateCheckoutButtons(plan) {
    var enabled = plan && plan.enabled;
    var teams = plan && plan.tiers && plan.tiers.cloudTeams;
    var monthlyOk = teams && teams.monthly && teams.monthly.configured;
    var annualOk = teams && teams.annual && teams.annual.configured;
    var product = state.interval === 'annual' ? 'teams_annual' : 'teams_monthly';
    var configured = state.interval === 'annual' ? annualOk : monthlyOk;

    document.querySelectorAll('[data-checkout-btn]').forEach(function (btn) {
      if (enabled && configured) {
        btn.textContent = state.interval === 'annual'
          ? 'Subscribe — $390/yr'
          : 'Subscribe — $49/mo';
        btn.dataset.product = product;
        btn.disabled = false;
      } else if (enabled && !configured) {
        btn.textContent = 'Checkout configuring…';
        btn.disabled = true;
      } else {
        btn.textContent = 'Sign in for Cloud Teams';
        btn.dataset.product = '';
        btn.disabled = false;
      }
    });

    document.querySelectorAll('[data-checkout-hint]').forEach(function (el) {
      if (enabled && configured) {
        el.textContent = 'Secure Stripe checkout · founding launch pricing';
      } else if (enabled) {
        el.textContent = 'Add Stripe Price IDs to enable checkout (see .env.v1-internal.example).';
      } else {
        el.textContent = 'Billing not live yet — join the waitlist or sign in at /app';
      }
    });
  }

  function setInterval(interval) {
    state.interval = interval === 'annual' ? 'annual' : 'monthly';
    updateIntervalDisplay();
    if (state.plan) updateCheckoutButtons(state.plan);
  }

  function bindIntervalToggles(root) {
    (root || document).querySelectorAll('[data-interval-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setInterval(btn.getAttribute('data-interval-btn'));
      });
    });
  }

  function bindCheckoutButtons(root) {
    (root || document).querySelectorAll('[data-checkout-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startCheckout(btn.dataset.product);
      });
    });
  }

  function startCheckout(productOverride) {
    var plan = state.plan;
    var product = productOverride
      || (state.interval === 'annual' ? 'teams_annual' : 'teams_monthly');

    if (!plan || !plan.enabled) {
      var app = global.SIMPLEBEACON_APP || '/app';
      global.location.href = app + '#/signin';
      return;
    }

    var teams = plan.tiers && plan.tiers.cloudTeams;
    var configured = product === 'teams_annual'
      ? teams && teams.annual && teams.annual.configured
      : teams && teams.monthly && teams.monthly.configured;
    if (!configured) {
      global.location.href = '#waitlist';
      return;
    }

    var email = global.prompt('Work email for Cloud Teams checkout:');
    if (!email) return;
    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      global.alert('Enter a valid work email.');
      return;
    }

    fetch(apiBase() + '/api/simplebeacon/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, product: product })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (res.ok && res.body.url) {
          global.location.href = res.body.url;
          return;
        }
        global.alert(res.body.message || 'Checkout unavailable. Join the waitlist or try /app.');
      })
      .catch(function () {
        global.alert('Checkout failed. Email audit@simplebeacon.ai to book your audit.');
      });
  }

  function init(opts) {
    opts = opts || {};
    bindIntervalToggles(opts.root);
    bindCheckoutButtons(opts.root);
    if (opts.interval) setInterval(opts.interval);
    return fetchPlan().then(function (plan) {
      hydratePlan(plan);
      return plan;
    });
  }

  global.SB_Pricing = {
    init: init,
    setInterval: setInterval,
    startCheckout: startCheckout,
    fetchPlan: fetchPlan,
    hydratePlan: hydratePlan
  };
})(window);
