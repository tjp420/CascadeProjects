import { escapeHtml } from '../utils.js';
/**
 * Render zscript report panel.
 * @param {number} zscriptReport
 * @param {Object} options
 * @returns {any}
 */
export function renderZscriptReportPanel(zscriptReport, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const report = (zscriptReport === null || zscriptReport === void 0 ? void 0 : zscriptReport.report) || zscriptReport;
  if (!report || report.type !== 'zscript-mod-report') {
    if (options.error) {
      return `<div class="card mb-4"><p class="text-muted" style="margin:0;">ZScript report: ${escapeHtml(options.error)}</p></div>`;
    }
    return '';
  }
  const diagnosis = report.problem_diagnosis || {};
  const cvars = ((_a = report.cvars) === null || _a === void 0 ? void 0 : _a.cvars) || {};
  const cvarNames = Object.keys(cvars);
  const intensityCvars =
    ((_b = report.cvars) === null || _b === void 0 ? void 0 : _b.intensityCvars) || diagnosis.cvar_candidates || [];
  const fnKeys = Object.keys(report.function_analysis || {}).slice(0, 6);
  return `
    <div class="card mb-4">
      <p class="text-muted mb-2" style="margin-top: 0; font-size: var(--font-size-xs);">
        ZScript mod report · focus ${escapeHtml(report.focus || 'lighting-intensity')}
        · ${(_d = (_c = report.structure) === null || _c === void 0 ? void 0 : _c.filesScanned) !== null && _d !== void 0 ? _d : '—'} .zs file(s)
      </p>
      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${cvarNames.length}</strong> CVARs</div>
        <div class="metric-chip"><strong>${intensityCvars.length}</strong> intensity CVARs</div>
        <div class="metric-chip"><strong>${(_g = (_f = (_e = report.structure) === null || _e === void 0 ? void 0 : _e.class_hierarchy) === null || _f === void 0 ? void 0 : _f.classCount) !== null && _g !== void 0 ? _g : '—'}</strong> classes</div>
        <div class="metric-chip"><strong>${fnKeys.length}</strong> traced functions</div>
      </div>
      ${
        diagnosis.problem
          ? `
        <h3 class="mb-2" style="font-size: var(--font-size-base);">Problem diagnosis</h3>
        <p style="font-size: var(--font-size-sm);"><strong>${escapeHtml(diagnosis.problem)}</strong></p>
        ${
          (diagnosis.suspected_root_causes || []).length
            ? `
          <ul style="margin: var(--space-2) 0; padding-left: 1.25rem; font-size: var(--font-size-sm);">
            ${diagnosis.suspected_root_causes.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('')}
          </ul>
        `
            : ''
        }
        ${
          (diagnosis.recommended_validation || []).length
            ? `
          <p class="text-muted" style="font-size: var(--font-size-xs); margin-bottom: 0;">
            Validation: ${diagnosis.recommended_validation.map((item) => escapeHtml(String(item))).join(' · ')}
          </p>
        `
            : ''
        }
      `
          : ''
      }
      ${
        intensityCvars.length
          ? `
        <h3 class="mb-2 mt-4" style="font-size: var(--font-size-base);">Intensity CVARs</h3>
        <div class="consolidation-list">
          ${intensityCvars
            .slice(0, 8)
            .map((name) => {
              var _a, _b;
              const entry = cvars[name] || {};
              return `
              <div class="consolidation-card card">
                <div class="consolidation-meta"><code>${escapeHtml(name)}</code></div>
                <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">
                  default ${escapeHtml(String((_b = (_a = entry.defaultValue) !== null && _a !== void 0 ? _a : entry.current_value) !== null && _b !== void 0 ? _b : '—'))}
                  · used in ${(entry.usedIn || []).length} file(s)
                </p>
              </div>
            `;
            })
            .join('')}
        </div>
      `
          : ''
      }
      ${
        fnKeys.length
          ? `
        <h3 class="mb-2 mt-4" style="font-size: var(--font-size-base);">Function flow</h3>
        <div class="consolidation-list">
          ${fnKeys
            .map((key) => {
              const fn = report.function_analysis[key];
              return `
              <div class="consolidation-card card">
                <div class="consolidation-meta"><code>${escapeHtml(key)}</code></div>
                <p style="font-size: var(--font-size-sm); margin: var(--space-1) 0 0;">
                  ${escapeHtml(fn.purpose || 'ZScript method')}
                </p>
                ${
                  (fn.currentLogic || []).length
                    ? `
                  <ul style="margin: var(--space-1) 0 0; padding-left: 1.25rem; font-size: var(--font-size-xs);">
                    ${fn.currentLogic.map((step) => `<li>${escapeHtml(String(step))}</li>`).join('')}
                  </ul>
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
 * Build zscript conclusion.
 * @param {number} zscriptReport
 * @returns {any}
 */
export function buildZscriptConclusion(zscriptReport) {
  var _a;
  const report = (zscriptReport === null || zscriptReport === void 0 ? void 0 : zscriptReport.report) || zscriptReport;
  if (
    !((_a = report === null || report === void 0 ? void 0 : report.problem_diagnosis) === null || _a === void 0
      ? void 0
      : _a.problem)
  )
    return '';
  const cvars = (report.problem_diagnosis.cvar_candidates || []).join(', ');
  return `${report.problem_diagnosis.problem}${cvars ? ` — check CVARs: ${cvars}` : ''}.`;
}
