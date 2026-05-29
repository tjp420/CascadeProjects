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
    { id: 'mock-path', category: 'mock-leak', severity: 'high', label: 'Production mock/sample path', regex: /(?:['"`][^'"`]*-sample\.json['"`]|\/mock\/|\\mock\\|(?<![a-zA-Z])mockData(?![a-zA-Z])|fixtures\/)/gi },
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

  var SCANNER_META_FILENAMES = {
    'analyzer-cache.json': true,
    'history.json': true,
    'trust-history.json': true,
    'source-kpi-findings.json': true,
    'source-kpi-findings-with-docs.json': true
  };

  function isScannerMetaFileName(name) {
    var base = String(name || '').split(/[/\\]/).pop().toLowerCase();
    if (SCANNER_META_FILENAMES[base]) return true;
    if (base.indexOf('cleanup-export-') === 0 && base.slice(-5) === '.json') return true;
    return base.slice(-11) === '-cache.json' || /^\.simplebeacon-/.test(base);
  }

  function isAnalyzerCacheJson(parsed) {
    if (!parsed || typeof parsed !== 'object' || !parsed.files || typeof parsed.files !== 'object') return false;
    var entries = Object.keys(parsed.files).map(function (key) { return parsed.files[key]; });
    if (!entries.length) return false;
    return entries.slice(0, 8).every(function (entry) {
      return entry && typeof entry === 'object' && typeof entry.hash === 'string';
    });
  }

  function isCleanupExportJson(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;
    var type = String(parsed.type || '');
    return type === 'simplebeacon-cleanup-export' || type === 'simplebeacon-cleanup-brief';
  }

  function lineTextAt(text, lineNumber) {
    return text.split('\n')[Math.max(0, lineNumber - 1)] || '';
  }

  function isPathRegistryLine(line) {
    var trimmed = String(line || '').trim();
    return /"[^"]+[\\/][^"]+\.(?:js|mjs|cjs|ts|tsx|json)":\s*[\{,]/.test(trimmed);
  }

  function isFindingRegistryLine(line) {
    var trimmed = String(line || '').trim();
    return /"file":\s*"[^"]+"/.test(trimmed);
  }

  function shouldSkipMockPathMatch(text, match) {
    var line = lineTextAt(text, lineAt(text, match.index));
    if (isPathRegistryLine(line)) return true;
    if (isFindingRegistryLine(line)) return true;
    var lower = line.toLowerCase();
    if (/__tests__[/\\]|(?:^|[/\\])tests[/\\]|\/temp\/|\\temp\\|\/\.simplebeacon\/|github-cache[/\\]/i.test(lower)) return true;
    if (/\/scripts\/.*mock/i.test(lower)) return true;
    return false;
  }

  function isScannerMetaText(text) {
    try {
      var parsed = JSON.parse(text);
      return isAnalyzerCacheJson(parsed) || isCleanupExportJson(parsed);
    } catch {
      return false;
    }
  }

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

  function scanText(text, options) {
    options = options || {};
    if (options.fileName && isScannerMetaFileName(options.fileName)) return [];
    if (isScannerMetaText(text)) return [];

    var findings = [];
    var seen = {};

    PATTERNS.forEach(function (pattern) {
      if (findings.length >= 8) return;
      pattern.regex.lastIndex = 0;
      var match;
      while ((match = pattern.regex.exec(text)) !== null) {
        if (findings.length >= 8) break;
        if (isAllowlisted(text, match)) continue;
        if (pattern.id === 'mock-path' && shouldSkipMockPathMatch(text, match)) continue;
        var key = pattern.id + ':' + lineAt(text, match.index);
        if (seen[key]) continue;
        seen[key] = true;
        findings.push({
          id: pattern.id,
          category: pattern.category,
          severity: pattern.severity,
          label: pattern.label,
          line: lineAt(text, match.index),
          match: match[0]
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function redactMatch(raw) {
    if (!raw) return '…';
    var compact = String(raw).replace(/\s+/g, ' ');
    if (/-----BEGIN/.test(compact)) return '-----BEGIN … PRIVATE KEY----- (redacted)';
    if (compact.length <= 14) return compact.slice(0, 4) + '…';
    return compact.slice(0, 10) + '…' + compact.slice(-4);
  }

  function buildFindingPreview(findings) {
    var peekHtml = '';
    var lockedHtml = '';

    findings.slice(0, 2).forEach(function (finding) {
      peekHtml +=
        '<div class="diagnostic-finding-peek">' +
          '<span class="diagnostic-finding-sev diagnostic-finding-sev--' + finding.severity + '">' + severityLabel(finding.severity) + '</span> ' +
          '<strong>' + escapeHtml(finding.label) + '</strong> at line ' + finding.line +
          ' · <code class="diagnostic-finding-match">' + escapeHtml(redactMatch(finding.match)) + '</code>' +
          '<span class="diagnostic-finding-locked-note"> · fix steps in full audit</span>' +
        '</div>';
    });

    if (findings.length > 2) {
      findings.slice(2, 5).forEach(function (finding) {
        lockedHtml +=
          '<div class="diagnostic-blur-line">' +
            severityLabel(finding.severity) + ': ' + finding.label + ' near line ' + finding.line + ' — remediation steps locked…' +
          '</div>';
      });
      if (findings.length > 5) {
        lockedHtml += '<div class="diagnostic-blur-line">' + (findings.length - 5) + ' more hit(s) in full repository audit…</div>';
      }
      return { peekHtml: peekHtml, lockedHtml: lockedHtml, useBlur: true };
    }

    if (findings.length > 0) {
      lockedHtml = '<p class="diagnostic-locked-note">Line-by-line remediation steps ship with the $499 repository audit PDF.</p>';
    }

    return { peekHtml: peekHtml, lockedHtml: lockedHtml, useBlur: false };
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

  function scanInputText(text, options) {
    options = options || {};
    var bundle = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE && window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.parseBundle(text);
    if (bundle) {
      text = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.bundleToScanText(bundle);
    }
    return scanText(text, options);
  }

  function runLocalDiagnostic(options) {
    options = options || {};
    var input = document.getElementById('codeInputField');
    var resultEl = document.getElementById('diagnosticResult');
    var gateEl = document.getElementById('paywallGate');
    var cleanEl = document.getElementById('diagnosticClean');
    var peekEl = document.getElementById('diagnosticFindingPeek');
    var blurEl = document.getElementById('diagnosticBlurPreview');
    var text = input ? input.value : '';

    setHidden(gateEl, true);
    setHidden(cleanEl, true);
    setHidden(resultEl, true);
    setHidden(peekEl, true);
    setHidden(blurEl, true);

    if (options.cacheMeta) {
      setHidden(cleanEl, false);
      if (cleanEl) {
        cleanEl.textContent = 'Scanner cache or export inventory — path keys are not production leak findings.';
      }
      return;
    }

    if (!text.trim()) {
      window.alert('Paste a code snippet or drop a file to scan.');
      return;
    }

    var findings = scanInputText(text, options);
    var threatScore = computeThreatScore(findings);
    renderResult(resultEl, findings, threatScore);

    if (findings.length > 0) {
      var preview = buildFindingPreview(findings);
      if (peekEl) {
        peekEl.innerHTML = preview.peekHtml;
        setHidden(peekEl, !preview.peekHtml);
      }
      if (blurEl) {
        blurEl.innerHTML = preview.lockedHtml;
        blurEl.classList.toggle('diagnostic-blur-preview', preview.useBlur);
        blurEl.classList.toggle('diagnostic-locked-wrap', !preview.useBlur && !!preview.lockedHtml);
        setHidden(blurEl, !preview.lockedHtml);
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
    if (isScannerMetaFileName(file.name)) {
      loadTextIntoInput('');
      runLocalDiagnostic({ fileName: file.name, cacheMeta: true });
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var raw = String(reader.result || '');
      if (isScannerMetaText(raw)) {
        loadTextIntoInput('');
        runLocalDiagnostic({ fileName: file.name, cacheMeta: true });
        return;
      }
      var bundle = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE && window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.parseBundle(raw);
      if (bundle) {
        loadTextIntoInput(window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.bundleToScanText(bundle));
        runLocalDiagnostic({ fileName: file.name });
        return;
      }
      loadTextIntoInput(raw);
      runLocalDiagnostic({ fileName: file.name });
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
