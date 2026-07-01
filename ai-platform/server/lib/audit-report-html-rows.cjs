const { escapeHtml } = require('./code-roadmap-export.cjs');

function buildCleanScanRemediationMessage(summary = {}) {
  const parts = ['No production-path issues detected under this audit profile.'];
  if (summary.documentationFindings > 0) {
    parts.push(`${Number(summary.documentationFindings).toLocaleString()} documentation-tier marker(s) tracked for hygiene (non-blocking).`);
  }
  if (summary.generalFindings > 0) {
    parts.push(`${Number(summary.generalFindings).toLocaleString()} tooling/script-tier marker(s) in dev paths (non-blocking).`);
  }
  if (summary.codebaseHealth != null && summary.codebaseHealth < 90) {
    parts.push(`Consider addressing hygiene markers to improve code health from ${summary.codebaseHealth}%.`);
  } else if (summary.codebaseHealth != null) {
    parts.push(`Code health ${summary.codebaseHealth}% — production paths are clean.`);
  }
  if (summary.codeFilesAnalyzed != null) {
    parts.push(`${Number(summary.codeFilesAnalyzed).toLocaleString()} code files deep-scanned with zero runtime-path blockers.`);
  }
  return parts.join(' ');
}

function _renderFindingRows(findings, emptyMessage) {
  if (!findings.length) {
    return `<tr><td colspan="5" class="empty">${escapeHtml(emptyMessage)}</td></tr>`;
  }
  return findings.map((f) => `
        <tr>
            <td><span class="sev sev-${escapeHtml(f.severity || 'low')}">${escapeHtml(String(f.severity || 'low').toUpperCase())}</span></td>
            <td>${escapeHtml((f.category || f.type || '—').replace(/-/g, ' '))}</td>
            <td><code>${escapeHtml(f.filePath || '—')}</code>${f.line ? `<div class="meta">line ${escapeHtml(String(f.line))}</div>` : ''}</td>
            <td>${escapeHtml(f.description || f.match || '—')}</td>
            <td class="fix-cell">${escapeHtml(f.recommendedAction || 'Review and remediate before handoff')}</td>
        </tr>
    `).join('');
}

function renderCategoryRollupRows(categories) {
  if (!categories.length) return '<tr><td colspan="5" class="empty">No codebase categories in bundle.</td></tr>';
  return categories.map((c) => `
        <tr>
            <td>${escapeHtml(c.category.replace(/-/g, ' '))}</td>
            <td><strong>${c.count}</strong></td>
            <td>${c.production}</td>
            <td>${c.high || 0}</td>
            <td>${c.medium || 0} / ${c.low || 0}</td>
        </tr>
    `).join('');
}

function renderRecipeHtml(recipe) {
  const safe = escapeHtml(String(recipe || '—'));
  return safe.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderDeveloperRemediationRows(rows, summary = {}) {
  if (!rows.length) {
    return `<tr><td colspan="6" class="empty clean-scan">${escapeHtml(buildCleanScanRemediationMessage(summary))}</td></tr>`;
  }
  return rows.map((row) => `
        <tr>
            <td><span class="sev sev-${escapeHtml(row.severity || 'medium')}">${escapeHtml(String(row.severity || 'medium').toUpperCase())}</span></td>
            <td><code>${escapeHtml(row.location || '—')}</code><code class="snippet">${escapeHtml(row.snippet || '—')}</code></td>
            <td><code>${escapeHtml(row.rule || '—')}</code></td>
            <td class="impact-cell"><span class="impact-badge ${escapeHtml(row.impactClass || 'impact-review')}">${escapeHtml(row.impact || '—')}</span></td>
            <td class="recipe-cell">${renderRecipeHtml(row.recipe)}</td>
        </tr>
    `).join('');
}

module.exports = {
  _renderFindingRows,
  renderCategoryRollupRows,
  renderRecipeHtml,
  renderDeveloperRemediationRows,
  buildCleanScanRemediationMessage
};
