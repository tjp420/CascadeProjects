/**
 * Phase 1 client-side diagnostic patterns — browser only, no upload.
 * Do not import server scan.js; patterns stay in this file.
 */
(function () {
  'use strict';

  var MAX_SCAN_BYTES = 50 * 1024;

  var BASIC_PATTERNS = {
    awsKey: /AKIA[0-9A-Z]{16}/g,
    stripeKey: /sk_[a-zA-Z0-9]{24,}/g,
    stripeProj: /sk-proj-[a-zA-Z0-9_-]{20,}/g,
    githubPat: /ghp_[a-zA-Z0-9]{20,}/g,
    bearerToken: /Bearer\s+[A-Za-z0-9._~-]{20,}/g,
    mockPath: /-sample\.json|data\/mock\//g,
    mockSlash: /\/mock\//g,
    fixture: /\bfixtures?\b/i,
    aiPlaceholder: /(98\.5%|94\.3%|unbreakable-oracle)/gi,
    demoOracle: /demo-oracle/i,
    envVariable: /API_KEY|SECRET|PASSWORD/gi
  };

  var PATTERN_META = {
    awsKey: { label: 'AWS access key', severity: 'critical', category: 'credentials' },
    stripeKey: { label: 'Stripe secret key', severity: 'critical', category: 'credentials' },
    stripeProj: { label: 'Stripe project key', severity: 'critical', category: 'credentials' },
    githubPat: { label: 'GitHub personal access token', severity: 'critical', category: 'credentials' },
    bearerToken: { label: 'Bearer token', severity: 'critical', category: 'credentials' },
    mockPath: { label: 'Mock/sample data path', severity: 'high', category: 'mock-leak' },
    mockSlash: { label: 'Mock directory path', severity: 'high', category: 'mock-leak' },
    fixture: { label: 'Fixture/test data reference', severity: 'medium', category: 'mock-leak' },
    aiPlaceholder: { label: 'AI fiction KPI placeholder', severity: 'high', category: 'fiction' },
    demoOracle: { label: 'Demo oracle placeholder', severity: 'high', category: 'fiction' },
    envVariable: { label: 'Sensitive env variable name', severity: 'medium', category: 'credentials' }
  };

  var ALLOWLIST = [
    'AKIA000000000000EXAMPLE',
    'your-api-key',
    'your-secret',
    'placeholder',
    'example.com',
    'dummy',
    'changeme',
    'replace_me',
    'not-a-real',
    'pk_test_1234567890abcdef',
    'process.env',
    '# password',
    'password field',
    'forgot password'
  ];

  var FAKE_BLUR_LINES = [
    'CRITICAL: Live credential shape — src/config/secrets.env · line ███',
    'HIGH: Production mock path — server/routes/billing.js · line ███',
    'HIGH: AI-fiction KPI block — reports/executive-summary.json · line ███',
    'MEDIUM: Hardcoded secret assignment — lib/auth/client.js · line ███'
  ];

  var SAFE_MESSAGE = '✅ No immediate risks detected in this snippet';

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

    Object.keys(BASIC_PATTERNS).forEach(function (id) {
      if (findings.length >= 8) return;
      var regex = BASIC_PATTERNS[id];
      var meta = PATTERN_META[id] || { label: id, severity: 'medium', category: 'unknown' };
      regex.lastIndex = 0;
      var match;
      while ((match = regex.exec(text)) !== null) {
        if (findings.length >= 8) break;
        if (isAllowlisted(text, match)) continue;
        var key = id + ':' + lineAt(text, match.index);
        if (seen[key]) continue;
        seen[key] = true;
        findings.push({
          id: id,
          category: meta.category,
          severity: meta.severity,
          label: meta.label,
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
    var real = findings.slice(0, 3).map(function (finding) {
      return severityLabel(finding.severity) + ': ' + finding.label + ' near line ' + finding.line + ' — remediation steps locked…';
    });
    var fake = FAKE_BLUR_LINES.slice(0, Math.max(2, 4 - real.length));
    return real.concat(fake).slice(0, 4);
  }

  function clampInput(text) {
    return String(text || '').slice(0, MAX_SCAN_BYTES);
  }

  window.SIMPLEBEACON_DIAGNOSTIC_HOOK = {
    MAX_SCAN_BYTES: MAX_SCAN_BYTES,
    BASIC_PATTERNS: BASIC_PATTERNS,
    SAFE_MESSAGE: SAFE_MESSAGE,
    scanText: scanText,
    computeThreatScore: computeThreatScore,
    blurPreviewLines: blurPreviewLines,
    clampInput: clampInput
  };
})();
