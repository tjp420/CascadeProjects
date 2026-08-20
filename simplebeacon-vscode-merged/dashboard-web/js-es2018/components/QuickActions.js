/**
 * Render quick actions.
 * @param {Object} options
 * @param {number} _onExport
 * @param {any} _onLegacy }
 * @returns {any}
 */
export function renderQuickActions({ _onRunScan, _onExport, _onLegacy, _onSendAi, showSendAi = true }) {
  const sendAiBtn = showSendAi
    ? `<button class="dashboard-action-btn" id="action-send-ai" title="Send current scan report to AI coding agent" style="background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.3);">
        <span style="font-size:1.1rem;">🤖</span>
        <span>Send to AI</span>
      </button>`
    : '';
  return `
    <div class="dashboard-quick-actions">
      <button class="dashboard-action-btn dashboard-action-primary" id="action-run-scan" title="Run gate scan on the configured folder">
        <i data-lucide="play" class="icon-18"></i>
        <span>Run Scan</span>
      </button>
      <button class="dashboard-action-btn" id="action-export" title="Export the current scan report as JSON">
        <i data-lucide="download" class="icon-18"></i>
        <span>Export Report</span>
      </button>
      ${sendAiBtn}
      <button class="dashboard-action-btn" id="action-legacy" title="View platform overview and statistics">
        <i data-lucide="layout-dashboard" class="icon-18"></i>
        <span>Platform Overview</span>
      </button>
    </div>
  `;
}
/**
 * Bind quick actions.
 * @param {any} container
 * @param {Array} handlers
 * @returns {any}
 */
export function bindQuickActions(container, handlers) {
  var _a, _b, _c, _d;
  (_a = container.querySelector('#action-run-scan')) === null || _a === void 0
    ? void 0
    : _a.addEventListener('click', handlers.onRunScan);
  (_b = container.querySelector('#action-export')) === null || _b === void 0
    ? void 0
    : _b.addEventListener('click', handlers.onExport);
  (_c = container.querySelector('#action-send-ai')) === null || _c === void 0
    ? void 0
    : _c.addEventListener('click', handlers.onSendAi || (() => {}));
  (_d = container.querySelector('#action-legacy')) === null || _d === void 0
    ? void 0
    : _d.addEventListener('click', handlers.onLegacy);
}
