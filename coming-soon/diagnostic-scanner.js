// SimpleBeacon Diagnostic Scanner
// Local browser-based diagnostic tool for credential patterns, sample paths, and AI-fiction KPIs
// Based on the live site implementation

(function() {
  'use strict';

  var MAX_BYTES = 256 * 1024;

  // Enhanced patterns with categories, severity, and labels
  var PATTERNS = [
    {
      id: 'aws-access-key',
      category: 'credentials',
      severity: 'critical',
      label: 'AWS access key pattern',
      regex: /\bAKIA[0-9A-Z]{16}\b/g
    },
    {
      id: 'openai-key',
      category: 'credentials',
      severity: 'critical',
      label: 'OpenAI-style API key',
      regex: /\bsk-[A-Za-z0-9]{20,}\b/g
    },
    {
      id: 'github-pat',
      category: 'credentials',
      severity: 'critical',
      label: 'GitHub token pattern',
      regex: /\bghp_[A-Za-z0-9]{20,}\b/g
    },
    {
      id: 'stripe-key',
      category: 'credentials',
      severity: 'critical',
      label: 'Stripe secret key pattern',
      regex: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{16,}\b/g
    },
    {
      id: 'private-key',
      category: 'credentials',
      severity: 'critical',
      label: 'Private key block',
      regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g
    },
    {
      id: 'fiction-mock-report',
      category: 'fiction',
      severity: 'high',
      label: 'Embedded mock analysis report',
      regex: /\b(?:gguf[-\s]mock(?:[-\s]data)?|mock-data-analysis-report|unbreakable-oracle|Mock Data Analysis Report|IMPLEMENTATION_REPORT)\b/gi
    },
    {
      id: 'mock-path',
      category: 'mock-leak',
      severity: 'high',
      label: 'Production mock/sample path',
      regex: /(?:['"`][^'"`]*-sample\.json['"`]|['"`][^'"`]*web(?:\/|\\)data[^'"`]*['"`]|['"`][^'"`]*(?:\/||\.\/)(?:sample|mock|fixture|stub|demo|example)(?:\/|\\|\.))[^'"`]*['"`]/gi
    },
    {
      id: 'sample-json-import',
      category: 'mock-leak',
      severity: 'high',
      label: 'Sample JSON import in production',
      regex: /(?:import|require|from)\s*['"`][^'"`]*-sample\.json['"`]/gi
    },
    {
      id: 'web-data-path',
      category: 'mock-leak',
      severity: 'high',
      label: 'Web/data static path in production',
      regex: /(?:['"`][^'"`]*web(?:\/|\\)data[^'"`]*['"`]|['"`][^'"`]*data(?:\/|\\)(?:sample|mock|fixture)[^'"`]*['"`])/gi
    },
    {
      id: 'fiction-kpi-perfect',
      category: 'fiction',
      severity: 'medium',
      label: 'Unrealistic perfect KPI',
      regex: /\b(100%|99\.9%|99\.8%|99\.7%)\s*(success|completion|accuracy|efficiency|performance|score|metric|rate)\b/gi
    },
    {
      id: 'fiction-kpi-generic',
      category: 'fiction',
      severity: 'medium',
      label: 'Generic fiction KPI pattern',
      regex: /\b(74\.17|98\.5|94\.3|87|66|62|47|156|8|9)\s*(%|percent|completion|success|rate|accuracy|efficiency|performance|score|metric)\b/gi
    },
    {
      id: 'fiction-all-users',
      category: 'fiction',
      severity: 'medium',
      label: 'Unrealistic "all users" claim',
      regex: /\b(all|every|100%)\s*(of the|of our|of your|of the team|of users|of customers|of clients)\b/gi
    },
    {
      id: 'password-assignment',
      category: 'credentials',
      severity: 'high',
      label: 'Hardcoded password assignment',
      regex: /password\s*[:=]\s*['"][^'"]{4,}['"]/gi
    },
    {
      id: 'api-key-assignment',
      category: 'credentials',
      severity: 'high',
      label: 'Hardcoded API key assignment',
      regex: /api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/gi
    },
    {
      id: 'secret-assignment',
      category: 'credentials',
      severity: 'high',
      label: 'Hardcoded secret assignment',
      regex: /secret\s*[:=]\s*['"][^'"]{8,}['"]/gi
    }
  ];

  // Allowlist patterns to filter false positives
  var ALLOWLIST = [
    /\/\/.*password\s*[:=]/gi,
    /\/\*[\s\S]*?\*\//g,
    /<!--[\s\S]*?-->/g,
    /#[\s\S]*?$/gm,
    /["'].*password.*["']\s*[:=]\s*["'][^"']*["']/gi,
    /example\.com|test\.com|localhost|127\.0\.0\.1/gi,
    /sample|example|test|mock|demo|stub|fixture/gi
  ];

  function isAllowlisted(text, match) {
    var before = text.substring(Math.max(0, match.index - 50), match.index);
    var after = text.substring(match.index, Math.min(text.length, match.index + 50));
    var context = before + match[0] + after;
    
    for (var i = 0; i < ALLOWLIST.length; i++) {
      if (ALLOWLIST[i].test(context)) {
        return true;
      }
    }
    return false;
  }

  function lineAt(text, index) {
    var before = text.substring(0, index);
    return before.split('\n').length;
  }

  function computeThreatScore(findings) {
    if (findings.length === 0) return 0;
    
    var score = 0;
    findings.forEach(function(finding) {
      if (finding.severity === 'critical') score += 25;
      else if (finding.severity === 'high') score += 15;
      else score += 5;
    });
    
    return Math.min(100, score);
  }

  function scanText(text) {
    var findings = [];
    var seen = {};
    
    PATTERNS.forEach(function(pattern) {
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
    
    findings.slice(0, 2).forEach(function(finding) {
      peekHtml += '<div class="diagnostic-finding-peek-item">' +
        '<span class="finding-severity">' + severityLabel(finding.severity) + '</span> ' +
        '<span class="finding-label">' + escapeHtml(finding.label) + '</span> ' +
        'at line ' + finding.line + ' · ' +
        '<code>' + escapeHtml(redactMatch(finding.match)) + '</code>' +
        '</div>';
    });
    
    if (findings.length > 2) {
      findings.slice(2, 5).forEach(function(finding) {
        lockedHtml += '<div class="diagnostic-locked-item">' +
          severityLabel(finding.severity) + ': ' + finding.label + 
          ' near line ' + finding.line + ' — developer remediations in full clearance…' +
          '</div>';
      });
      
      if (findings.length > 5) {
        lockedHtml += '<div class="diagnostic-locked-item">' +
          (findings.length - 5) + ' more hit(s) in full branch clearance…' +
          '</div>';
      }
    }
    
    if (findings.length > 0) {
      lockedHtml += '<div class="diagnostic-locked-note">' +
        'Line-by-line developer remediations and the executive pass/fail PDF ship with the $499 pre-launch clearance.' +
        '</div>';
    }
    
    return {
      peekHtml: peekHtml,
      lockedHtml: lockedHtml,
      useBlur: true
    };
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
    el.style.display = hidden ? 'none' : '';
  }

  function renderResult(resultEl, findings, threatScore) {
    if (!resultEl) return;
    
    var critical = findings.filter(function(f) { return f.severity === 'critical'; }).length;
    var high = findings.filter(function(f) { return f.severity === 'high'; }).length;
    
    resultEl.innerHTML = 
      '<div class="diagnostic-score-card">' +
        '<p class="diagnostic-score-label">Handoff risk score</p>' +
        '<p class="diagnostic-score-value">' + threatScore + '<span>/100</span></p>' +
        '<p class="diagnostic-score-meta">' + findings.length + ' pattern hit(s) · ' + 
        critical + ' critical · ' + high + ' high · shield your team before the client walkthrough</p>' +
      '</div>';
    
    setHidden(resultEl, false);
  }

  function scanInputText(text) {
    var bundle = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE && 
                 window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.parseBundle(text);
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
    var peekEl = document.getElementById('diagnosticFindingPeek');
    var blurEl = document.getElementById('diagnosticBlurPreview');
    
    var text = input ? input.value : '';
    
    setHidden(gateEl, true);
    setHidden(cleanEl, true);
    setHidden(resultEl, true);
    setHidden(peekEl, true);
    setHidden(blurEl, true);
    
    if (!text.trim()) {
      window.alert('Paste a code snippet or drop a file to scan.');
      return;
    }
    
    // Show scanning animation
    showScanningAnimation();
    
    // Simulate scanning delay for better UX
    setTimeout(function() {
      var findings = scanInputText(text);
      var threatScore = computeThreatScore(findings);
      
      renderResult(resultEl, findings, threatScore);
      
      // Highlight code with findings
      highlightCodeWithFindings(input, findings);
      
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
    }, 800); // 800ms scanning delay for better UX
  }
  
  function showScanningAnimation() {
    var input = document.getElementById('codeInputField');
    if (!input) return;
    
    var originalPlaceholder = input.placeholder;
    var messages = ['Scanning for credential patterns...', 'Checking sample path leaks...', 'Analyzing AI-fiction KPIs...', 'Compiling results...'];
    var index = 0;
    
    input.placeholder = messages[0];
    
    var interval = setInterval(function() {
      index++;
      if (index < messages.length) {
        input.placeholder = messages[index];
      } else {
        clearInterval(interval);
        input.placeholder = originalPlaceholder;
      }
    }, 200);
  }
  
  function highlightCodeWithFindings(input, findings) {
    if (!input || findings.length === 0) return;
    
    // Create overlay for highlighting
    var overlay = document.createElement('div');
    overlay.className = 'diagnostic-highlight-overlay';
    overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;font-family:monospace;font-size:inherit;line-height:inherit;padding:inherit;white-space:pre-wrap;word-break:break-all;';
    
    var text = input.value;
    var highlightedText = text;
    
    // Sort findings by position to apply highlights correctly
    var sortedFindings = findings.sort(function(a, b) {
      return (a.match || '').indexOf - (b.match || '').indexOf;
    });
    
    // Apply highlights (simple version - marks problematic areas)
    sortedFindings.forEach(function(finding) {
      var match = finding.match;
      if (match) {
        var color = finding.severity === 'critical' ? '#ff6b6b' : 
                    finding.severity === 'high' ? '#d29922' : '#58a6ff';
        highlightedText = highlightedText.replace(match, '###HIGHLIGHT###' + match + '###END###');
      }
    });
    
    // Replace highlight markers with spans
    highlightedText = highlightedText.replace(/###HIGHLIGHT###(.*?)###END###/g, function(match, content) {
      return '<span style="background:rgba(255,107,107,0.3);color:#ff6b6b;padding:2px 4px;border-radius:4px;">' + content + '</span>';
    });
    
    overlay.innerHTML = highlightedText;
    
    // Add overlay to input container
    var container = input.parentElement;
    if (container) {
      container.style.position = 'relative';
      container.appendChild(overlay);
    }
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
      window.alert('File is too large for the snippet diagnostic (max 256 KB bundle). Book a full branch clearance for complete coverage.');
      return;
    }
    
    var reader = new FileReader();
    reader.onload = function() {
      var raw = String(reader.result || '');
      var bundle = window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE && 
                   window.SIMPLEBEACON_DIAGNOSTIC_BUNDLE.parseBundle(raw);
      
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
      input.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          runLocalDiagnostic();
        }
      });
    }
    
    if (dropzone) {
      dropzone.addEventListener('dragover', function(event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      
      dropzone.addEventListener('dragleave', function() {
        dropzone.classList.remove('is-dragover');
      });
      
      dropzone.addEventListener('drop', function(event) {
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
