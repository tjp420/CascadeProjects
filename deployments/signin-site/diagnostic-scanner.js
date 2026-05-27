(function () {
  'use strict';

  var MAX_BYTES = 256 * 1024;

  var PATTERNS = [
    { id: 'aws-access-key', category: 'credentials', severity: 'critical', label: 'AWS access key pattern', regex: /\bAKIA[0-9A-Z]{16}\b/g },
    { id: 'openai-key', category: 'credentials', severity: 'critical', label: 'OpenAI-style API key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
    { id: 'github-pat', category: 'credentials', severity: 'critical', label: 'GitHub token pattern', regex: /\bghp_[A-Za-z0-9]{20,}\b/g },
    { id: 'stripe-key', category: 'credentials', severity: 'critical', label: 'Stripe secret key pattern', regex: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{16,}\b/g },
    { id: 'private-key', category: 'credentials', severity: 'critical', label: 'Private key block', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
    { id: 'fiction-metrics', category: 'fiction', severity: 'high', label: 'AI fiction KPI placeholder', regex: /(?:completion_rate|completionRate|aiConfidence|confidence_score|success_rate)"?\s*[:=]\s*["']?(?:98\.5%?|94\.3%?|99\.1%?|87\.5%?)/gi },
    { id: 'mock-path', category: 'mock-leak', severity: 'high', label: 'Production mock/sample path', regex: /(?:['"`][^'"`]*-sample\.json['"`]|\/mock\/|\\mock\\|mockData|fixtures\/)/gi },
    { id: 'generic-secret', category: 'credentials', severity: 'medium', label: 'Hardcoded secret assignment', regex: /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/gi }
  ];

  var ALLOWLIST = [
    'AKIAIOSFODNN7EXAMPLE',
    'your-api-key',
    'your-secret',
    'placeholder',
    'example.com',
    'dummy',
    'changeme',
    'replace_me',
    'not-a-real',
    'pk_test_1234567890abcdef'
  ];

  function isAllowlisted(text, match) {
    var snippet = text.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24).toLowerCase();
    return ALLOWLIST.some(function (allowed) {
      return snippet.indexOf(allowed.toLowerCase()) !== -1;
    });
  }

  function lineAt(text, index) {
    return text.slice(0, Math.max(0, index)).split('\n').length;
  }

  function computeThreatScore(findings) {
    var score = 0;
    findings.forEach(function (finding) {
      if (finding.severity === 'critical') score += 35;
      else if (finding.severity === 'high') score += 22;
      else score += 10;
    });
    return Math.min(100, score);
  }

  function scanText(text) {
    var findings = [];
    var seen = {};

    PATTERNS.forEach(function (pattern) {
      if (findings.length >= 8) return;
      pattern.regex.lastIndex = 0;
      var match;
      while ((match = pattern.regex.exec(text)) !== null) {
        if (findings.length >= 8) break;
        if (isAllowlisted(text, match)) continue;
        var key = pattern.id + ':' + lineAt(text, match.index);
        if (seen[key]) continue;
        seen[key] = true;
        findings.push({
          id: pattern.id,
          category: pattern.category,
          severity: pattern.severity,
          label: pattern.label,
          line: lineAt(text, match.index)
        });
        if (findings.length >= 8) break;
      }
    });

    return findings;
  }

  function severityLabel(severity) {
    if (severity === 'critical') return 'CRITICAL';
    if (severity === 'high') return 'HIGH';
    return 'MEDIUM';
  }

  function blurPreviewLines(findings) {
    return findings.slice(0, 4).map(function (finding) {
      return severityLabel(finding.severity) + ': ' + finding.label + ' near line ' + finding.line + ' — remediation steps locked…';
    });
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
    el.style.display = hidden ? 'none' : '';
  }

  function renderResult(resultEl, findings, threatScore) {
    if (!resultEl) return;
    var critical = findings.filter(function (f) { return f.severity === 'critical'; }).length;
    var high = findings.filter(function (f) { return f.severity === 'high'; }).length;
    resultEl.innerHTML =
      '<div class="diagnostic-score-card' + (threatScore >= 35 ? ' is-danger' : '') + '">' +
        '<p class="diagnostic-score-label">Threat score</p>' +
        '<p class="diagnostic-score-value">' + threatScore + '<span>/100</span></p>' +
        '<p class="diagnostic-score-meta">' + findings.length + ' pattern hit(s) · ' + critical + ' critical · ' + high + ' high</p>' +
      '</div>';
    setHidden(resultEl, false);
  }

  function scanInputText(text) {
    var bundle = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE && window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.parseBundle(text);
    if (bundle) {
      text = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.bundleToScanText(bundle);
    }
    return scanText(text);
  }

  function runLocalDiagnostic() {
    var input = document.getElementById('codeInputField');
    var resultEl = document.getElementById('diagnosticResult');
    var gateEl = document.getElementById('paywallGate');
    var cleanEl = document.getElementById('diagnosticClean');
    var blurEl = document.getElementById('diagnosticBlurPreview');
    var text = input ? input.value : '';

    setHidden(gateEl, true);
    setHidden(cleanEl, true);
    setHidden(resultEl, true);

    if (!text.trim()) {
      window.alert('Paste a code snippet or drop a file to scan.');
      return;
    }

    var findings = scanInputText(text);
    var threatScore = computeThreatScore(findings);
    renderResult(resultEl, findings, threatScore);

    if (findings.length > 0) {
      if (blurEl) {
        blurEl.innerHTML = blurPreviewLines(findings).map(function (line) {
          return '<div class="diagnostic-blur-line">' + line + '</div>';
        }).join('');
      }
      setHidden(gateEl, false);
      if (window.SIMPLEBEACON_APPLY_CHECKOUT) window.SIMPLEBEACON_APPLY_CHECKOUT();
      return;
    }

    setHidden(cleanEl, false);
  }

  function loadTextIntoInput(text) {
    var input = document.getElementById('codeInputField');
    if (!input) return;
    input.value = text.slice(0, MAX_BYTES);
  }

  function handleFiles(files) {
    if (!files || !files.length) return;
    var file = files[0];
    if (file.size > MAX_BYTES * 2) {
      window.alert('File is too large for the snippet diagnostic (max 256 KB bundle). Book a full repo audit for complete coverage.');
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
