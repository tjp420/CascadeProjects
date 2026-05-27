/**
 * Browser-only snippet scanner for the Simplebeacon landing page.
 * Runs locally — nothing is uploaded. Patterns mirror community CLI rules at a
 * lightweight subset (credentials, mock paths, fiction KPIs).
 *
 * Sample snippets for manual testing:
 *   const key = "AKIAIOSFODNN7EXAMPLE";
 *   import stats from "../../web/data/dashboard-sample.json";
 *   completionRate: 98.5%, confidence_score: 94.3%
 */

const CREDENTIAL_PATTERNS = [
  { id: 'aws-access-key', label: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'critical' },
  { id: 'openai-key', label: 'OpenAI-style key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g, severity: 'critical' },
  { id: 'stripe-key', label: 'Stripe secret key', regex: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{16,}\b/g, severity: 'critical' },
  { id: 'jwt-token', label: 'JWT token', regex: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, severity: 'high' },
  { id: 'generic-secret', label: 'Hardcoded secret assignment', regex: /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/gi, severity: 'medium' }
];

const MOCK_PATH_PATTERNS = [
  { id: 'sample-json', label: 'Sample JSON path in code', regex: /['"`][^'"`]*-sample\.json['"`]/gi, severity: 'high' },
  { id: 'mock-dir', label: 'Mock directory reference', regex: /['"`][^'"`]*(?:\/|\\)mock(?:\/|\\)[^'"`]+['"`]/gi, severity: 'high' },
  { id: 'web-data-sample', label: 'web/data fixture path', regex: /['"`][^'"`]*web(?:\/|\\)data[^'"`]*['"`]/gi, severity: 'high' }
];

const FICTION_PATTERNS = [
  { id: 'fiction-completion', label: 'Fiction completion rate', regex: /\b(?:completion[_-]?rate|completionRate)\s*[:=]?\s*["']?(?:62|75|98\.5)\s*%/gi, severity: 'medium' },
  { id: 'fiction-confidence', label: 'Fiction AI confidence score', regex: /\b(?:confidence[_-]?score|aiConfidence)\s*[:=]?\s*["']?(?:94\.3|96\.2)\b/gi, severity: 'medium' },
  { id: 'fiction-features', label: 'Fiction feature count', regex: /\b(?:totalFeatures|featuresTracked)\s*[:=]\s*["']?(?:47|8)\b/gi, severity: 'medium' }
];

const ALLOWLIST_SNIPPETS = [
  'your-api-key-here',
  'your-secret-key',
  'placeholder',
  'example.com',
  'replace_me',
  'changeme',
  'dummy',
  'not-a-real',
  'AKIAIOSFODNN7EXAMPLE',
  'sk_test_your',
  'pk_test_1234567890abcdef'
];

function lineNumberAt(content, index) {
  return content.slice(0, Math.max(0, index)).split('\n').length;
}

function snippetAround(content, index, matchLength) {
  const start = Math.max(0, index - 20);
  const end = Math.min(content.length, index + matchLength + 20);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

function isAllowlisted(match, content) {
  const windowText = content.slice(
    Math.max(0, match.index - 24),
    match.index + match[0].length + 24
  ).toLowerCase();
  return ALLOWLIST_SNIPPETS.some((token) => windowText.includes(token.toLowerCase()));
}

function scanPatternGroup(content, patterns, category) {
  const findings = [];

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      if (isAllowlisted(match, content)) continue;
      findings.push({
        category,
        id: pattern.id,
        label: pattern.label,
        severity: pattern.severity,
        line: lineNumberAt(content, match.index),
        match: match[0],
        snippet: snippetAround(content, match.index, match[0].length)
      });
    }
  }

  return findings;
}

function scanSnippet(content) {
  const text = String(content || '');
  if (!text.trim()) {
    return { findings: [], summary: { critical: 0, high: 0, medium: 0, total: 0 } };
  }

  const findings = [
    ...scanPatternGroup(text, CREDENTIAL_PATTERNS, 'credentials'),
    ...scanPatternGroup(text, MOCK_PATH_PATTERNS, 'mock-paths'),
    ...scanPatternGroup(text, FICTION_PATTERNS, 'fiction-kpi')
  ];

  const summary = { critical: 0, high: 0, medium: 0, total: findings.length };
  for (const finding of findings) {
    summary[finding.severity] = (summary[finding.severity] || 0) + 1;
  }

  return { findings, summary };
}

function formatFindingRows(findings) {
  if (!findings.length) {
    return '<p class="diagnostic-clean">No credential, mock-path, or fiction KPI patterns detected in this snippet.</p>';
  }

  return findings.map((finding) => (
    `<div class="diagnostic-finding diagnostic-severity-${finding.severity}">` +
    `<div class="diagnostic-finding-head"><strong>${finding.label}</strong>` +
    `<span class="diagnostic-badge">${finding.severity}</span></div>` +
    `<div class="diagnostic-meta">Line ${finding.line} · ${finding.category}</div>` +
    `<code class="diagnostic-snippet">${escapeHtml(finding.snippet)}</code>` +
    `</div>`
  )).join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initHomepageDiagnostic(root = document) {
  const form = root.getElementById('diagnostic-form');
  const textarea = root.getElementById('diagnostic-input');
  const results = root.getElementById('diagnostic-results');
  const summary = root.getElementById('diagnostic-summary');
  const premiumPanel = root.getElementById('diagnostic-premium-panel');

  if (!form || !textarea || !results || !summary) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const report = scanSnippet(textarea.value);
    summary.textContent = report.findings.length
      ? `${report.summary.total} pattern${report.summary.total === 1 ? '' : 's'} detected` +
        ` (${report.summary.critical} critical, ${report.summary.high} high, ${report.summary.medium} medium)`
      : 'Clean snippet — no blocking patterns in this preview scan.';
    results.innerHTML = formatFindingRows(report.findings);
    if (premiumPanel) {
      premiumPanel.hidden = report.findings.length === 0;
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scanSnippet, formatFindingRows, initHomepageDiagnostic };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initHomepageDiagnostic());
}
