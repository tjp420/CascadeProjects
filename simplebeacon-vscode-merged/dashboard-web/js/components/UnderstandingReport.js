// simplebeacon-ignore documentation
import { escapeHtml } from '../utils.js';

/**
 * Render understanding panel.
 * @param {any} codeUnderstanding
 * @returns {any}
 */
export function renderUnderstandingPanel(codeUnderstanding) {
  if (!codeUnderstanding || codeUnderstanding.mode === 'off') {
    return '';
  }

  const insights = codeUnderstanding.fileInsights || [];
  if (!insights.length && !codeUnderstanding.projectSummary) {
    return `
      <div class="card mb-4">
        <p class="text-muted mb-2" style="margin-top: 0; font-size: var(--font-size-xs);">Code understanding (${escapeHtml(codeUnderstanding.mode || 'deterministic')})</p>
        <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">No file samples were available for semantic analysis.</p>
      </div>
    `;
  }

  return `
    <div class="card mb-4">
      <p class="text-muted mb-2" style="margin-top: 0; font-size: var(--font-size-xs);">
        Code understanding · mode <strong>${escapeHtml(codeUnderstanding.mode || 'deterministic')}</strong>
        · layers ${escapeHtml((codeUnderstanding.layersAvailable || []).join(', ') || '—')}
      </p>
      ${
        codeUnderstanding.projectSummary
          ? `
        <p class="text-muted" style="font-size: var(--font-size-sm);">${escapeHtml(codeUnderstanding.projectSummary)}</p>
      `
          : ''
      }
      ${
        insights.length
          ? `
        <h3 class="mb-2" style="font-size: var(--font-size-base);">File insights</h3>
        <div class="consolidation-list">
          ${insights
            .map((item) => {
              const u = item.understanding || {};
              const semantic = u.layers?.semantic || {};
              const business = u.layers?.semantic?.businessLogic || semantic.businessLogic || {};
              const domains = business.domains || business.primaryDomain || [];
              const domainList = Array.isArray(domains) ? domains : domains ? [domains] : [];
              return `
              <div class="consolidation-card card">
                <div class="consolidation-meta">
                  <code>${escapeHtml(item.filePath || '—')}</code>
                  · ${escapeHtml(u.layers?.static?.languageLabel || u.layers?.static?.language || 'unknown')}
                </div>
                <p style="font-size: var(--font-size-sm); margin: var(--space-2) 0;">
                  ${escapeHtml(u.summary || semantic.purpose || semantic.summary || 'Purpose inferred from structure.')}
                </p>
                ${
                  domainList.length
                    ? `
                  <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0;">
                    Domains: ${domainList.map((d) => escapeHtml(String(d))).join(', ')}
                  </p>
                `
                    : ''
                }
              </div>
            `;
            })
            .join('')}
        </div>
      `
          : ''
      }
    </div>
  `;
}

/**
 * Build understanding conclusion.
 * @param {any} codeUnderstanding
 * @returns {any}
 */
export function buildUnderstandingConclusion(codeUnderstanding) {
  if (!codeUnderstanding || codeUnderstanding.mode === 'off') return '';
  const count = codeUnderstanding.fileInsights?.length || 0;
  if (!count) return 'Code understanding enabled but no sampled files were analyzed.';
  const langs = [
    ...new Set(
      (codeUnderstanding.fileInsights || []).map((i) => i.understanding?.layers?.static?.language).filter(Boolean)
    ),
  ];
  return `Understanding layer sampled ${count} file(s)${langs.length ? ` (${langs.join(', ')})` : ''} using ${codeUnderstanding.mode} mode.`;
}
