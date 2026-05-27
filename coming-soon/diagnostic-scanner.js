(function () {
  'use strict';

  var hook = window.SIMPLEBEACON_DIAGNOSTIC_HOOK;
  if (!hook) {
    console.error('[diagnostic-scanner] SIMPLEBEACON_DIAGNOSTIC_HOOK not loaded');
    return;
  }

  var MAX_BYTES = hook.MAX_SCAN_BYTES;

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
    el.style.display = hidden ? 'none' : '';
  }

  function renderRiskScore(resultEl, findings, threatScore) {
    if (!resultEl) return;
    var critical = findings.filter(function (f) { return f.severity === 'critical'; }).length;
    var high = findings.filter(function (f) { return f.severity === 'high'; }).length;
    resultEl.innerHTML =
      '<div class="diagnostic-score-card is-danger">' +
        '<p class="diagnostic-score-label">Threat detected</p>' +
        '<p class="diagnostic-score-value">' + threatScore + '<span>/100</span></p>' +
        '<p class="diagnostic-score-meta">' + findings.length + ' pattern hit(s) · ' + critical + ' critical · ' + high + ' high</p>' +
      '</div>';
    setHidden(resultEl, false);
  }

  function renderSafe(cleanEl) {
    if (!cleanEl) return;
    cleanEl.classList.add('is-safe');
    cleanEl.innerHTML =
      '<p class="diagnostic-safe-msg">' + hook.SAFE_MESSAGE + '</p>' +
      '<a href="#" class="sample-report-link" data-stripe-checkout>Book full pre-launch audit — $499</a>';
    setHidden(cleanEl, false);
    if (window.SIMPLEBEACON_APPLY_CHECKOUT) window.SIMPLEBEACON_APPLY_CHECKOUT();
  }

  function scanInputText(text) {
    var bundle = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE && window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.parseBundle(text);
    if (bundle) {
      text = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.bundleToScanText(bundle);
    }
    return hook.scanText(hook.clampInput(text));
  }

  function runLocalDiagnostic() {
    var input = document.getElementById('codeInputField');
    var resultEl = document.getElementById('diagnosticResult');
    var gateEl = document.getElementById('paywallGate');
    var cleanEl = document.getElementById('diagnosticClean');
    var blurEl = document.getElementById('diagnosticBlurPreview');
    var raw = input ? input.value : '';
    var text = hook.clampInput(raw);

    if (input && raw.length > MAX_BYTES) {
      input.value = text;
    }

    setHidden(gateEl, true);
    setHidden(cleanEl, true);
    setHidden(resultEl, true);
    if (cleanEl) cleanEl.classList.remove('is-safe');

    if (!text.trim()) {
      window.alert('Paste a code snippet or drop a file to scan.');
      return;
    }

    var findings = scanInputText(text);
    var threatScore = hook.computeThreatScore(findings);

    if (findings.length > 0) {
      renderRiskScore(resultEl, findings, threatScore);
      if (blurEl) {
        blurEl.innerHTML = hook.blurPreviewLines(findings).map(function (line) {
          return '<div class="diagnostic-blur-line">' + line + '</div>';
        }).join('');
      }
      setHidden(gateEl, false);
      if (window.SIMPLEBEACON_APPLY_CHECKOUT) window.SIMPLEBEACON_APPLY_CHECKOUT();
      return;
    }

    renderSafe(cleanEl);
  }

  function loadTextIntoInput(text) {
    var input = document.getElementById('codeInputField');
    if (!input) return;
    input.value = hook.clampInput(text);
  }

  function handleFiles(files) {
    if (!files || !files.length) return;
    var file = files[0];
    if (file.size > MAX_BYTES) {
      window.alert('File is too large for the snippet diagnostic (max 50 KB). Book a full repo audit for complete coverage.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var raw = String(reader.result || '');
      var bundle = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE && window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.parseBundle(raw);
      if (bundle) {
        loadTextIntoInput(window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.bundleToScanText(bundle));
        runLocalDiagnostic();
        return;
      }
      loadTextIntoInput(raw);
      runLocalDiagnostic();
    };
    reader.readAsText(file);
  }

  function initDiagnosticScanner() {
    var runBtn = document.getElementById('diagnosticRunBtn');
    var dropzone = document.getElementById('diagnosticDropzone');
    var input = document.getElementById('codeInputField');

    if (runBtn) runBtn.addEventListener('click', runLocalDiagnostic);
    if (input) {
      input.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          runLocalDiagnostic();
        }
      });
      input.addEventListener('input', function () {
        if (input.value.length > MAX_BYTES) {
          input.value = hook.clampInput(input.value);
        }
      });
    }
    if (dropzone) {
      dropzone.addEventListener('dragover', function (event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('is-dragover');
      });
      dropzone.addEventListener('drop', function (event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
        handleFiles(event.dataTransfer && event.dataTransfer.files);
      });
    }
  }

  window.runLocalDiagnostic = runLocalDiagnostic;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiagnosticScanner);
  } else {
    initDiagnosticScanner();
  }
})();
