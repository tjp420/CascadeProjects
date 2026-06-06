(function () {
  'use strict';

  var cfg = window.SIMPLEBEACON_SITE || {};
  var form = document.getElementById('contactForm');
  if (!form) return;

  var statusEl = form.querySelector('.contact-form-status');
  var submitBtn = form.querySelector('.contact-form-submit');

  var TOPIC_LABELS = {
    'free-audit': 'Free AI Slop Audit request',
    certificate: 'Executive Risk Certificate ($499)',
    'eu-ai-act': 'EU AI Act Readiness Sprint ($2,499)',
    enterprise: 'Enterprise contract ($50,000+ annual)',
    quarterly: 'Quarterly / Annual Protection Pack',
    general: 'General compliance question'
  };

  function setStatus(message, kind) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.className = 'contact-form-status' + (kind ? ' is-' + kind : '');
  }

  function applyTopicFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var topic = String(params.get('topic') || params.get('subject') || '').trim().toLowerCase();
    var select = form.querySelector('select[name="topic"]');
    if (!select || !topic) return;
    if (TOPIC_LABELS[topic]) select.value = topic;
  }

  applyTopicFromQuery();

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus('', '');

    var data = new FormData(form);
    if (String(data.get('website') || '').trim()) return;

    var payload = {
      contactEmail: String(data.get('contactEmail') || '').trim(),
      name: String(data.get('name') || '').trim(),
      company: String(data.get('company') || '').trim(),
      title: String(data.get('title') || '').trim(),
      topic: String(data.get('topic') || 'general').trim(),
      message: String(data.get('message') || '').trim(),
      source: String(data.get('source') || 'contact-page').trim()
    };

    if (!payload.contactEmail) {
      setStatus('Please enter your email address.', 'error');
      return;
    }
    if (!payload.message || payload.message.length < 10) {
      setStatus('Please write a message (at least 10 characters).', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    // Check if Formspree is configured
    var formAction = form.getAttribute('action');
    if (!formAction || formAction.includes('YOUR_FORMSPREE_ID')) {
      setTimeout(function() {
        setStatus('Formspree is not configured. Please set up a Formspree account and add your Form ID to the contact form.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send message';
        }
      }, 500);
      return;
    }

    // Submit to Formspree using AJAX
    fetch(formAction, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          applyTopicFromQuery();
          setStatus('Message sent — we reply within one business day. Check your inbox for our response.', 'success');
          return;
        }
        return res.json().then(function (data) {
          throw new Error(data.error || 'Submission failed');
        });
      })
      .catch(function (error) {
        setStatus('Could not send your message. Please try again or contact us directly at your email.', 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send message';
        }
      });
  });
})();