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
      ${codeUnderstanding.projectSummary ? `
        <p class="text-muted" style="font-size: var(--font-size-sm);">${escapeHtml(codeUnderstanding.projectSummary)}</p>
      ` : ''}
      ${insights.length ? `
        <h3 class="mb-2" style="font-size: var(--font-size-base);">File insights</h3>
        <div class="consolidation-list">
          ${insights.map((item) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const u = item.understanding || {};
        const semantic = ((_a = u.layers) === null || _a === void 0 ? void 0 : _a.semantic) || {};
        const business = ((_c = (_b = u.layers) === null || _b === void 0 ? void 0 : _b.semantic) === null || _c === void 0 ? void 0 : _c.businessLogic) || semantic.businessLogic || {};
        const domains = business.domains || business.primaryDomain || [];
        const domainList = Array.isArray(domains) ? domains : (domains ? [domains] : []);
        return `
              <div class="consolidation-card card">
                <div class="consolidation-meta">
                  <code>${escapeHtml(item.filePath || '—')}</code>
                  · ${escapeHtml(((_e = (_d = u.layers) === null || _d === void 0 ? void 0 : _d.static) === null || _e === void 0 ? void 0 : _e.languageLabel) || ((_g = (_f = u.layers) === null || _f === void 0 ? void 0 : _f.static) === null || _g === void 0 ? void 0 : _g.language) || 'unknown')}
                </div>
                <p style="font-size: var(--font-size-sm); margin: var(--space-2) 0;">
                  ${escapeHtml(u.summary || semantic.purpose || semantic.summary || 'Purpose inferred from structure.')}
                </p>
                ${domainList.length ? `
                  <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0;">
                    Domains: ${domainList.map((d) => escapeHtml(String(d))).join(', ')}
                  </p>
                ` : ''}
              </div>
            `;
    }).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
/**
 * Build understanding conclusion.
 * @param {any} codeUnderstanding
 * @returns {any}
 */
export function buildUnderstandingConclusion(codeUnderstanding) {
    var _a;
    if (!codeUnderstanding || codeUnderstanding.mode === 'off')
        return '';
    const count = ((_a = codeUnderstanding.fileInsights) === null || _a === void 0 ? void 0 : _a.length) || 0;
    if (!count)
        return 'Code understanding enabled but no sampled files were analyzed.';
    const langs = [...new Set((codeUnderstanding.fileInsights || [])
            .map((i) => { var _a, _b, _c; return (_c = (_b = (_a = i.understanding) === null || _a === void 0 ? void 0 : _a.layers) === null || _b === void 0 ? void 0 : _b.static) === null || _c === void 0 ? void 0 : _c.language; })
            .filter(Boolean))];
    return `Understanding layer sampled ${count} file(s)${langs.length ? ` (${langs.join(', ')})` : ''} using ${codeUnderstanding.mode} mode.`;
}
