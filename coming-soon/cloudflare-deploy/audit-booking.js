(function () {
  'use strict';

  var cfg = window.SIMPLEBEACON_SITE || {};
  var form = document.getElementById('auditBookingForm');
  if (!form) return;

  var statusEl = form.querySelector('.audit-booking-status');
  var submitBtn = form.querySelector('.audit-booking-submit');
  var apiUrl = String(cfg.auditBookingApi || '/api/audit-booking').trim();

  function setStatus(message, kind) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.className = 'audit-booking-status' + (kind ? ' is-' + kind : '');
  }

  function scrollToForm(source) {
    var sourceInput = form.querySelector('input[name="source"]');
    if (sourceInput && source) sourceInput.value = source;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var first = form.querySelector('input[name="contactEmail"]');
    if (first) first.focus();
  }

  window.SIMPLEBEACON_SCROLL_TO_BOOKING = scrollToForm;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus('', '');

    var data = new FormData(form);
    if (String(data.get('website') || '').trim()) return;

    var payload = {
      contactEmail: String(data.get('contactEmail') || '').trim(),
      company: String(data.get('company') || '').trim(),
      repository: String(data.get('repository') || '').trim(),
      branch: String(data.get('branch') || 'main').trim(),
      handoffDate: String(data.get('handoffDate') || '').trim(),
      notes: String(data.get('notes') || '').trim(),
      source: String(data.get('source') || 'pricing').trim(),
      paymentsEnabled: cfg.paymentsEnabled === true
    };

    if (!payload.contactEmail || !payload.company || !payload.repository) {
      setStatus('Please fill in your email, company, and repository details.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (result.body && result.body.ok && result.body.saved) {
          form.reset();
          var sourceInput = form.querySelector('input[name="source"]');
          if (sourceInput) sourceInput.value = 'pricing';
          var inbox = String((result.body.operatorInboxUrl || cfg.operatorInboxUrl || '/operator/bookings')).trim();
          if (result.body.emailSent) {
            setStatus('Booking #' + result.body.bookingId + ' saved and emailed. View all requests: ' + inbox, 'success');
          } else {
            statusEl.innerHTML = 'Booking #' + result.body.bookingId + ' saved on this server. '
              + '<a href="' + inbox + '">Open operator inbox</a> to see it (this is not your email inbox — email needs Resend).';
            statusEl.hidden = false;
            statusEl.className = 'audit-booking-status is-success';
          }
          return;
        }

        if (result.ok && result.body && result.body.ok) {
          form.reset();
          setStatus('Request sent — check your inbox for our confirmation reply.', 'success');
          return;
        }

        if (result.status === 401 || (result.body && result.body.error === 'Authentication failed')) {
          setStatus('Server blocked the request (auth). Stop the server (Ctrl+C), run npm run staging:paywall again, hard refresh, then retry.', 'error');
          return;
        }

        if (result.body && result.body.error === 'email_failed') {
          setStatus(result.body.message || 'Email provider rejected the send.', 'error');
          return;
        }

        setStatus((result.body && result.body.message) || 'Could not send request. Try again or email us directly.', 'error');
      })
      .catch(function () {
        setStatus('Network error — is the local server running? On production, deploy the functions/ folder to Cloudflare Pages.', 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send booking request';
        }
      });
  });
})();
