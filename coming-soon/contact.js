(function () {
  'use strict';

  var cfg = window.SIMPLEBEACON_SITE || {};
  var form = document.getElementById('contactForm');
  if (!form) return;

  var statusEl = form.querySelector('.contact-form-status');
  var submitBtn = form.querySelector('.contact-form-submit');
  var topicSelect = form.querySelector('select[name="topic"]');
  var invoiceFields = document.getElementById('invoiceFields');

  var TOPIC_LABELS = {
    'free-audit': 'Free AI Slop Audit request',
    certificate: 'Executive Risk Certificate ($499)',
    'eu-ai-act': 'EU AI Act Readiness Sprint ($2,499)',
    enterprise: 'Enterprise contract ($50,000+ annual)',
    'invoice-w9': 'Request Invoice / W-9',
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
    if (!topicSelect || !topic) return;
    if (TOPIC_LABELS[topic]) topicSelect.value = topic;
  }

  var messageArea = form.querySelector('textarea[name="message"]');

  function toggleInvoiceFields() {
    if (!invoiceFields || !topicSelect) return;
    var isInvoice = topicSelect.value === 'invoice-w9';
    invoiceFields.style.display = isInvoice ? 'block' : 'none';
    if (messageArea) {
      messageArea.placeholder = isInvoice
        ? 'Any special billing instructions, preferred payment method (ACH, wire, check), or additional recipients for the invoice.'
        : 'How can we help? Include your industry, approximate codebase size, and any upcoming regulatory deadlines.';
    }
  }

  applyTopicFromQuery();
  toggleInvoiceFields();
  if (topicSelect) topicSelect.addEventListener('change', toggleInvoiceFields);

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

    if (payload.topic === 'invoice-w9') {
      payload.invoiceType = String(data.get('invoiceType') || '').trim();
      payload.product = String(data.get('product') || '').trim();
      payload.billingAddress = String(data.get('billingAddress') || '').trim();
      payload.billingCity = String(data.get('billingCity') || '').trim();
      payload.billingState = String(data.get('billingState') || '').trim();
      payload.billingZip = String(data.get('billingZip') || '').trim();
      payload.billingCountry = String(data.get('billingCountry') || '').trim();
      payload.taxId = String(data.get('taxId') || '').trim();
      payload.poNumber = String(data.get('poNumber') || '').trim();
    }

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
          toggleInvoiceFields();
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

  // === AI Session Handoff Report Generator ===
  var generateHandoffBtn = document.getElementById('generateHandoffBtn');
  var copyHandoffBtn = document.getElementById('copyHandoffBtn');
  var downloadHandoffBtn = document.getElementById('downloadHandoffBtn');
  var handoffPreview = document.getElementById('handoffPreview');
  var handoffDate = document.getElementById('handoffDate');

  if (handoffDate && !handoffDate.value) {
    handoffDate.valueAsDate = new Date();
  }

  var currentHandoffJSON = '';

  function generateHandoffReport() {
    var files = String(document.getElementById('handoffFiles')?.value || '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    var decisions = String(document.getElementById('handoffDecisions')?.value || '').split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0 && !s.match(/^\s*[-*]\s*$/); });
    var pending = String(document.getElementById('handoffPending')?.value || '').split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0 && !s.match(/^\s*[-*]\s*$/); });
    var notes = String(document.getElementById('handoffNotes')?.value || '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);

    var report = {
      schema: 'ai-handoff-v1',
      generatedAt: new Date().toISOString(),
      sessionDate: handoffDate?.value || new Date().toISOString().slice(0, 10),
      projectRoot: window.location.origin,
      filesModified: files,
      decisionsMade: decisions,
      openTasks: pending,
      notesForNextSession: notes,
      estimatedContextTokens: JSON.stringify({ files: files, decisions: decisions, pending: pending, notes: notes }).length / 4
    };

    currentHandoffJSON = JSON.stringify(report, null, 2);

    if (handoffPreview) {
      handoffPreview.textContent = currentHandoffJSON;
      handoffPreview.style.display = 'block';
    }
    if (copyHandoffBtn) copyHandoffBtn.style.display = '';
    if (downloadHandoffBtn) downloadHandoffBtn.style.display = '';

    return report;
  }

  function copyHandoffToClipboard() {
    if (!currentHandoffJSON) generateHandoffReport();
    navigator.clipboard.writeText(currentHandoffJSON).then(function() {
      setStatus('Handoff JSON copied to clipboard — paste it into your next AI session.', 'success');
      setTimeout(function() { setStatus('', ''); }, 4000);
    }).catch(function() {
      setStatus('Copy failed. Select the JSON below and copy manually.', 'error');
    });
  }

  function downloadHandoffJSON() {
    if (!currentHandoffJSON) generateHandoffReport();
    var blob = new Blob([currentHandoffJSON], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ai-handoff-' + (handoffDate?.value || new Date().toISOString().slice(0, 10)) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (generateHandoffBtn) generateHandoffBtn.addEventListener('click', generateHandoffReport);
  if (copyHandoffBtn) copyHandoffBtn.addEventListener('click', copyHandoffToClipboard);
  if (downloadHandoffBtn) downloadHandoffBtn.addEventListener('click', downloadHandoffJSON);
})();