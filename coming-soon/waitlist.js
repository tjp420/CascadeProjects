(function () {
  'use strict';

  var cfg = window.SIMPLEBEACON_SITE || {};
  var FREE = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'proton.me', 'protonmail.com', 'live.com', 'me.com'];

  function track(event, data) {
    var payload = { event: event, data: data || {}, ts: new Date().toISOString() };
    try {
      var rows = JSON.parse(localStorage.getItem('sb_analytics') || '[]');
      rows.push(payload);
      localStorage.setItem('sb_analytics', JSON.stringify(rows.slice(-200)));
    } catch (e) { /* ignore */ }
    var api = window.SIMPLEBEACON_API || '';
    if (!api) return;
    fetch(api + '/api/waitlist/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  function endpoints() {
    var api = (window.SIMPLEBEACON_API || '').replace(/\/$/, '');
    var webhook = (cfg.waitlistWebhook || '').replace(/\/$/, '');
    return { api: api, webhook: webhook };
  }

  function submitEmail(email, source) {
    var body = JSON.stringify({ email: email, source: source, ts: new Date().toISOString() });
    var ep = endpoints();

    function post(url) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      }).then(function (r) {
        if (!r.ok) throw new Error('bad_status');
        return r.json();
      });
    }

    // Prefer same-origin API so localhost and production can work without
    // requiring SIMPLEBEACON_API to be explicitly configured.
    var apiBase = ep.api || '';
    return post(apiBase + '/api/waitlist').catch(function () {
      if (ep.webhook) return post(ep.webhook);
      throw new Error('submit_failed');
    });
  }

  function bindForm(form) {
    if (!form || form.dataset.waitlistBound === '1') return;
    form.dataset.waitlistBound = '1';

    var input = form.querySelector('[data-waitlist-email]');
    var wrap = form.querySelector('[data-waitlist-wrap]');
    var msg = form.querySelector('[data-waitlist-msg]');
    var btn = form.querySelector('[data-waitlist-btn]');
    var source = form.getAttribute('data-waitlist-source') || 'coming-soon';
    var started = false;

    if (!input || !btn) return;

    input.addEventListener('input', function () {
      if (!started && input.value.trim()) {
        started = true;
        track('form_start', { form_id: form.id, source: source });
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (wrap) wrap.classList.remove('invalid');
      if (msg) {
        msg.className = 'waitlist-msg';
        msg.textContent = '';
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (wrap) wrap.classList.add('invalid');
        if (msg) {
          msg.className = 'waitlist-msg err';
          msg.textContent = 'Enter a valid email address.';
        }
        track('form_error', { form_id: form.id, reason: 'invalid_email' });
        return;
      }

      var domain = email.split('@')[1].toLowerCase();
      var isFree = FREE.indexOf(domain) !== -1;
      if (isFree && msg) {
        msg.className = 'waitlist-msg warn';
        msg.textContent = 'Personal email accepted — work email preferred for founding pricing.';
      }

      btn.disabled = true;
      var btnDefault = btn.getAttribute('data-btn-default') || btn.textContent;
      btn.textContent = btn.getAttribute('data-btn-loading') || 'Joining…';
      track('form_submit', { form_id: form.id, source: source, free_email: isFree });

      submitEmail(email, source)
        .then(function () {
          form.dataset.waitlistSubmitted = '1';
          if (msg) {
            msg.className = 'waitlist-msg ok';
            msg.textContent = "You're on the list! We'll email launch updates only.";
          }
          btn.textContent = btn.getAttribute('data-btn-success') || 'On the list ✓';
          track('form_success', { form_id: form.id, source: source });
        })
        .catch(function () {
          if (msg) {
            msg.className = 'waitlist-msg err';
            msg.textContent = 'Signup failed right now. Please try again in a minute.';
          }
          btn.disabled = false;
          btn.textContent = btnDefault;
          track('form_submit_failed', { form_id: form.id, source: source });
        });
    });
  }

  function observeFormViews() {
    if (!('IntersectionObserver' in window)) {
      track('form_view', { form_id: 'waitlist', visible: true });
      return;
    }
    document.querySelectorAll('[data-waitlist-form]').forEach(function (form) {
      var seen = false;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!seen && entry.isIntersecting) {
            seen = true;
            track('form_view', { form_id: form.id, source: form.getAttribute('data-waitlist-source') });
            obs.disconnect();
          }
        });
      }, { threshold: 0.4 });
      obs.observe(form);
    });
  }

  window.SB_Waitlist = { track: track, bindForm: bindForm };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-waitlist-form]').forEach(bindForm);
    observeFormViews();

    window.addEventListener('beforeunload', function () {
      document.querySelectorAll('[data-waitlist-form]').forEach(function (form) {
        var input = form.querySelector('[data-waitlist-email]');
        if (input && input.value.trim() && !form.dataset.waitlistSubmitted) {
          track('form_abandon', { form_id: form.id });
        }
      });
    });
  });
})();
