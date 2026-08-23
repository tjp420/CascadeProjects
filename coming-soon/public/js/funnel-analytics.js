/**
 * SimpleBeacon Funnel Analytics — client-side tracking module.
 * Captures UTM params, session IDs, and fires events to /api/track.
 * Auto-loads on any page that includes this script. No PII collected.
 */
(function () {
  'use strict';

  if (window.__sbAnalyticsLoaded) return;
  window.__sbAnalyticsLoaded = true;

  var API_BASE = (window.SIMPLEBEACON_SITE && window.SIMPLEBEACON_SITE.apiBase) || '';

  // --- Session ID ---
  var SESSION_KEY = 'sb_session_id';
  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  // --- UTM capture ---
  var UTM_KEY = 'sb_utm';
  var utm = {};
  try {
    var params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      var val = params.get(key);
      if (val) utm[key] = val;
    });
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    } else {
      var stored = sessionStorage.getItem(UTM_KEY);
      if (stored) utm = JSON.parse(stored);
    }
  } catch (e) { /* ignore */ }

  // --- Referrer capture ---
  var referrerKey = 'sb_referrer';
  var referrer = '';
  try {
    if (document.referrer && document.referrer.indexOf(window.location.origin) !== 0) {
      referrer = document.referrer;
      sessionStorage.setItem(referrerKey, referrer);
    } else {
      referrer = sessionStorage.getItem(referrerKey) || '';
    }
  } catch (e) { /* ignore */ }

  // --- Track function ---
  function track(event, data) {
    var payload = {
      event: event,
      page: window.location.pathname,
      sessionId: sessionId,
      utm: utm,
      referrer: referrer,
      data: data || {},
      timestamp: new Date().toISOString()
    };
    try {
      navigator.sendBeacon(API_BASE + '/api/track', JSON.stringify(payload));
    } catch (e) {
      // Fallback to fetch if sendBeacon unavailable
      try {
        fetch(API_BASE + '/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function () { /* analytics is best-effort */ });
      } catch (e2) { /* ignore */ }
    }
  }

  // Expose for manual calls
  window.sbTrack = track;

  // --- Auto page view ---
  track('page_view', { title: document.title });

  // --- Auto-track checkout button clicks ---
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]') || e.target.closest('.checkout-btn') || e.target.closest('.cta-btn');
    if (el) {
      var trackId = el.getAttribute('data-track') || el.getAttribute('data-tier') || el.id || 'unknown';
      track('cta_click', { id: trackId, href: el.getAttribute('href') || '', text: (el.textContent || '').trim().slice(0, 80) });
    }
  }, true);

  // --- Auto-track form submissions on checkout-related forms ---
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form && (form.id === 'checkoutForm' || form.className.indexOf('checkout') >= 0)) {
      track('checkout_form_submit', { formId: form.id || 'unknown' });
    }
  }, true);

  // --- Attach UTM params to checkout links ---
  function attachUtmToLinks() {
    if (Object.keys(utm).length === 0) return;
    var links = document.querySelectorAll('a[href*="pricing"], a[href*="checkout"], a[href*="trial"]');
    links.forEach(function (a) {
      try {
        var url = new URL(a.href, window.location.origin);
        Object.keys(utm).forEach(function (key) {
          if (!url.searchParams.has(key)) {
            url.searchParams.set(key, utm[key]);
          }
        });
        a.href = url.toString();
      } catch (e) { /* ignore invalid hrefs */ }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachUtmToLinks);
  } else {
    attachUtmToLinks();
  }
})();
