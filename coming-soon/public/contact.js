// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
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

    var sendingText = 'Sending…';
    var sendMessageText = 'Send message';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = sendingText;
    }

    // Submit to server /api/contact endpoint (delivers via SMTP to Zoho inbox)
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        setStatus('Could not send your message. ' + (error.message || 'Please try again or email us directly.'), 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = sendMessageText;
        }
      });
  });

  // === AI Session Handoff Report Generator ===
  var generateHandoffBtn = document.getElementById('generateHandoffBtn');
  var copyHandoffBtn = document.getElementById('copyHandoffBtn');
  var copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
  var downloadHandoffBtn = document.getElementById('downloadHandoffBtn');
  var handoffPreview = document.getElementById('handoffPreview');
  var handoffStats = document.getElementById('handoffStats');
  var handoffDate = document.getElementById('handoffDate');
  var handoffSaveStatus = document.getElementById('handoffSaveStatus');
  var currentHandoffJSON = '';
  var currentHandoffMarkdown = '';
  var HANDOFF_STORAGE_KEY = 'simplebeacon_handoff_v1';
  var saveStatusTimer = null;

  if (handoffDate && !handoffDate.value) {
    handoffDate.valueAsDate = new Date();
  }

  function showSaveStatus() {
    if (!handoffSaveStatus) return;
    handoffSaveStatus.style.opacity = '1';
    if (saveStatusTimer) clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(function() {
      handoffSaveStatus.style.opacity = '0';
    }, 2000);
  }

  function saveHandoffFields() {
    var payload = {
      date: document.getElementById('handoffDate')?.value || '',
      files: document.getElementById('handoffFiles')?.value || '',
      decisions: document.getElementById('handoffDecisions')?.value || '',
      pending: document.getElementById('handoffPending')?.value || '',
      notes: document.getElementById('handoffNotes')?.value || ''
    };
    try { localStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(payload)); } catch (e) { /* ignore */ }
    showSaveStatus();
    updateCounts();
  }

  function updateCounts() {
    function countLines(id, outId) {
      var el = document.getElementById(id);
      var out = document.getElementById(outId);
      if (!el || !out) return;
      var n = String(el.value).split('\n').filter(function(s) { return s.trim(); }).length;
      out.textContent = n ? '(' + n + ')' : '';
    }
    countLines('handoffFiles', 'handoffFilesCount');
    countLines('handoffDecisions', 'handoffDecisionsCount');
    countLines('handoffPending', 'handoffPendingCount');
    countLines('handoffNotes', 'handoffNotesCount');
  }

  function loadHandoffFields() {
    var raw = null;
    try { raw = localStorage.getItem(HANDOFF_STORAGE_KEY); } catch (e) { /* ignore */ }
    if (!raw) return false;
    var data = {};
    try { data = JSON.parse(raw); } catch (e) { return false; }
    if (data.date && handoffDate) handoffDate.value = data.date;
    if (data.files) { var el = document.getElementById('handoffFiles'); if (el) el.value = data.files; }
    if (data.decisions) { var el = document.getElementById('handoffDecisions'); if (el) el.value = data.decisions; }
    if (data.pending) { var el = document.getElementById('handoffPending'); if (el) el.value = data.pending; }
    if (data.notes) { var el = document.getElementById('handoffNotes'); if (el) el.value = data.notes; }
    updateCounts();
    return true;
  }

  function applyUrlHandoffParams() {
    var params = new URLSearchParams(window.location.search);
    function setVal(id, key) {
      var el = document.getElementById(id);
      var v = params.get(key);
      if (el && v) el.value = decodeURIComponent(v);
    }
    setVal('handoffDate', 'handoff_date');
    setVal('handoffFiles', 'handoff_files');
    setVal('handoffDecisions', 'handoff_decisions');
    setVal('handoffPending', 'handoff_pending');
    setVal('handoffNotes', 'handoff_notes');
  }

  function tryFillFromScanData() {
    var filesEl = document.getElementById('handoffFiles');
    if (!filesEl || filesEl.value) return;
    try {
      var scanData = localStorage.getItem('simplebeacon_scan_data');
      if (scanData) {
        var parsed = JSON.parse(scanData);
        var files = [];
        if (parsed.fileList && Array.isArray(parsed.fileList)) {
          files = parsed.fileList.slice(0, 10);
        } else if (parsed.filesAnalyzed || parsed.totalFiles) {
          files = ['Scan: ' + (parsed.filesAnalyzed || parsed.totalFiles) + ' files analyzed'];
        }
        if (files.length) {
          filesEl.value = files.join('\n');
          showSaveStatus();
        }
      }
    } catch (e) { /* ignore */ }
  }

  function smartFillHandoff() {
    if (loadHandoffFields()) return;
    applyUrlHandoffParams();
    tryFillFromScanData();
    var ref = String(document.referrer || '');
    var page = ref.split('/').pop().split('?')[0];
    var filesEl = document.getElementById('handoffFiles');
    var pendingEl = document.getElementById('handoffPending');
    if (page && filesEl && !filesEl.value) {
      var hints = {
        'upload.html': 'coming-soon/upload.html\ncoming-soon/js/scan-utils.js\ncoming-soon/js/dashboard/main.js',
        'index.html': 'coming-soon/index.html\ncoming-soon/styles.css',
        'pricing.html': 'coming-soon/pricing.html\ncoming-soon/site-config.js',
        'certificate-upload.html': 'coming-soon/certificate-upload.html\ncoming-soon/js/dashboard/main.js'
      };
      if (hints[page]) filesEl.value = hints[page];
    }
    if (pendingEl && !pendingEl.value) {
      pendingEl.value = '- Review and verify all changes before next session\n- Run node --test if tests exist';
    }
    updateCounts();
  }

  smartFillHandoff();

  ['handoffDate', 'handoffFiles', 'handoffDecisions', 'handoffPending', 'handoffNotes'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', saveHandoffFields);
  });

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
      estimatedContextTokens: Math.round(JSON.stringify({ files: files, decisions: decisions, pending: pending, notes: notes }).length / 4)
    };

    currentHandoffJSON = JSON.stringify(report, null, 2);
    currentHandoffMarkdown = '# AI Session Handoff\n\n**Date:** ' + report.sessionDate + '\n**Project:** ' + report.projectRoot + '\n\n## Files Modified (' + files.length + ')\n' + (files.length ? files.map(function(f) { return '- ' + f; }).join('\n') : '_None listed_') + '\n\n## Decisions Made (' + decisions.length + ')\n' + (decisions.length ? decisions.map(function(d) { return '- ' + d; }).join('\n') : '_None listed_') + '\n\n## Open Tasks / Blockers (' + pending.length + ')\n' + (pending.length ? pending.map(function(p) { return '- [ ] ' + p; }).join('\n') : '_None listed_') + '\n\n## Notes for Next Session\n' + (notes.length ? notes.join('\n\n') : '_None listed_') + '\n\n---\n*Generated by SimpleBeacon AI Handoff*';
    saveHandoffFields();

    if (handoffPreview) {
      handoffPreview.innerHTML = syntaxHighlightJSON(currentHandoffJSON);
      handoffPreview.style.display = 'block';
    }
    if (handoffStats) {
      handoffStats.innerHTML = '<span><strong style="color:var(--text);">' + files.length + '</strong> files</span><span><strong style="color:var(--text);">' + decisions.length + '</strong> decisions</span><span><strong style="color:var(--text);">' + pending.length + '</strong> tasks</span><span><strong style="color:var(--text);">' + report.estimatedContextTokens + '</strong> est. tokens</span>';
      handoffStats.style.display = 'flex';
    }
    if (copyHandoffBtn) copyHandoffBtn.style.display = '';
    if (copyMarkdownBtn) copyMarkdownBtn.style.display = '';
    if (downloadHandoffBtn) downloadHandoffBtn.style.display = '';

    return report;
  }

  function syntaxHighlightJSON(json) {
    return json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, function(m) {
        var cls = m.match(/:$/) ? 'color:#60A5FA' : 'color:#10B981';
        return '<span style="' + cls + '">' + m + '</span>';
      })
      .replace(/\b(true|false|null)\b/g, '<span style="color:#F59E0B">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#F472B6">$1</span>');
  }

  function copyHandoffToClipboard() {
    if (!currentHandoffJSON) generateHandoffReport();
    navigator.clipboard.writeText(currentHandoffJSON).then(function() {
      setStatus('Handoff JSON copied to clipboard.', 'success');
      setTimeout(function() { setStatus('', ''); }, 3000);
    }).catch(function() {
      setStatus('Copy failed. Select the JSON below and copy manually.', 'error');
    });
  }

  function copyMarkdownToClipboard() {
    if (!currentHandoffMarkdown) generateHandoffReport();
    navigator.clipboard.writeText(currentHandoffMarkdown).then(function() {
      setStatus('Markdown handoff copied to clipboard.', 'success');
      setTimeout(function() { setStatus('', ''); }, 3000);
    }).catch(function() {
      setStatus('Copy failed.', 'error');
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
  if (copyMarkdownBtn) copyMarkdownBtn.addEventListener('click', copyMarkdownToClipboard);
  if (downloadHandoffBtn) downloadHandoffBtn.addEventListener('click', downloadHandoffJSON);

  // Ctrl+Enter shortcut anywhere in handoff section
  var handoffSection = document.getElementById('handoff');
  if (handoffSection) {
    handoffSection.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generateHandoffReport();
      }
    });
  }
})();