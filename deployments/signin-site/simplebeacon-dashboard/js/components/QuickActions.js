export function renderQuickActions({ onRunScan, onExport, onLegacy }) {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Quick Actions</span>
      </div>
      <div class="quick-actions">
        <button class="quick-action-btn" id="action-run-scan" title="Same as Scan — uses the folder in Scan folder above">
          <span class="action-icon">▶</span>
          <span class="action-label">Run Scan</span>
        </button>
        <button class="quick-action-btn" id="action-export">
          <span class="action-icon">📥</span>
          <span class="action-label">Export Report</span>
        </button>
        <button class="quick-action-btn" id="action-legacy">
          <span class="action-icon">📂</span>
          <span class="action-label">Platform Overview</span>
        </button>
      </div>
    </div>
  `;
}

export function bindQuickActions(container, handlers) {
  container.querySelector('#action-run-scan')?.addEventListener('click', handlers.onRunScan);
  container.querySelector('#action-export')?.addEventListener('click', handlers.onExport);
  container.querySelector('#action-legacy')?.addEventListener('click', handlers.onLegacy);
}
