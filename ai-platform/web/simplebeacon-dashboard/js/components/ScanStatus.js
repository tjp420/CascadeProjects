import { escapeHtml, formatPercent, redactPathForDisplay } from '../utils.js';
import {
  resolveDisplayScore,
  formatScanScopeSummary,
  formatScanInventoryNote
} from '../services/analyzeService.js';

function resolveInitialScanRoot(report, { lastProjectPath, defaultProjectPath } = {}) {
  return lastProjectPath || report?.projectRoot || report?.platformRoot || defaultProjectPath || '';
}

function resolveScanRootFromInput(input, { lastProjectPath, defaultProjectPath } = {}) {
  if (lastProjectPath) return lastProjectPath;
  const trimmed = String(input?.value || '').trim();
  if (!trimmed) return defaultProjectPath || '';
  if (trimmed.startsWith('…')) return defaultProjectPath || '';
  return trimmed;
}

/** Shared path resolution for Dashboard scan controls (Scan button + Quick Actions). */
export function resolveDashboardScanPath(input, { lastProjectPath, defaultProjectPath } = {}) {
  return resolveScanRootFromInput(input, { lastProjectPath, defaultProjectPath });
}

export function runDashboardScanFromInput(input, options = {}) {
  const {
    onRescan,
    defaultProjectPath = '',
    getLastProjectPath = () => '',
    setLastProjectPath = () => {}
  } = options;
  if (!onRescan) return;
  const path = resolveScanRootFromInput(input, {
    lastProjectPath: getLastProjectPath(),
    defaultProjectPath
  });
  if (path) {
    setLastProjectPath(path);
    onRescan(path);
    return;
  }
  onRescan(undefined);
}

function renderScanPathControls(report, options = {}) {
  const { config, lastProjectPath, defaultProjectPath, scanning } = options;
  const initialRoot = resolveInitialScanRoot(report, { lastProjectPath, defaultProjectPath });
  const scanPaths = config?.scanPaths || report?.scanPaths || [];
  const pathCount = scanPaths.length;
  const hasDefault = Boolean(defaultProjectPath);

  return `
    <div class="scan-status-scope">
      <label class="scan-status-scope-label" for="scan-root-input">Scan folder</label>
      <div class="scan-status-path-row">
        <input
          type="text"
          id="scan-root-input"
          class="scan-status-path-input"
          placeholder="e.g. C:\\dev\\my-app"
          value="${escapeHtml(redactPathForDisplay(initialRoot))}"
          spellcheck="false"
          autocomplete="off"
          aria-label="Folder path on the dashboard server"
          ${scanning ? 'disabled' : ''}
        >
        <button type="button" class="btn btn-ghost btn-sm" id="scan-default-btn" ${!hasDefault || scanning ? 'disabled' : ''} title="Use server default folder">Default</button>
        <button type="button" class="scan-status-action" id="rescan-btn" ${scanning ? 'disabled' : ''} title="Run gate scan on this folder">
          ${scanning ? '<span class="loading-spinner"></span> Scanning…' : '▶ Scan'}
        </button>
      </div>
      <p class="scan-status-scope-hint text-muted">
        Path must exist on the machine running the dashboard.
        Deep analysis → <a href="#/analyze" class="scan-status-link">Analyze</a>.
        Gate mock folders → <a href="#/settings" class="scan-status-link">Settings → Scan paths</a>${pathCount ? ` (${pathCount} configured)` : ''}.
      </p>
    </div>
  `;
}

export function renderScanStatus(report, options = {}) {
  const { scanning = false, config } = options;
  const gate = report?.gate || {};
  const gateClass = gate.pass ? 'pass' : gate.blockingCount > 0 ? 'fail' : 'warn';
  const gateLabel = gate.pass ? 'PASS' : gate.blockingCount > 0 ? 'FAIL' : 'WARN';
  const inventoryNote = formatScanInventoryNote(report);

  return `
    <div class="card scan-status-card">
      <div class="scan-status-icon">📊</div>
      <div class="scan-status-content">
        <div class="scan-status-label">Last scan</div>
        <div class="scan-status-value">${escapeHtml(report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'No scan yet')}</div>
        <div class="scan-status-details">
          <span>${escapeHtml(formatScanScopeSummary(report))}</span> •
          <span>${formatPercent(resolveDisplayScore(report))} consistency</span> •
          <span class="gate-badge ${gateClass}">${gateLabel}</span>
        </div>
        ${inventoryNote ? `<div class="scan-status-note text-muted">${escapeHtml(inventoryNote)}</div>` : ''}
        ${renderScanPathControls(report, { ...options, config, scanning })}
      </div>
    </div>
  `;
}

export function bindScanStatus(container, options = {}) {
  const {
    _onRescan,
    defaultProjectPath = '',
    _getLastProjectPath = () => '',
    setLastProjectPath = () => {}
  } = options;

  const input = container.querySelector('#scan-root-input');
  const defaultBtn = container.querySelector('#scan-default-btn');
  const scanBtn = container.querySelector('#rescan-btn');

  const runScan = () => runDashboardScanFromInput(input, options);

  scanBtn?.addEventListener('click', runScan);

  defaultBtn?.addEventListener('click', () => {
    if (!defaultProjectPath || !input) return;
    input.value = redactPathForDisplay(defaultProjectPath);
    setLastProjectPath(defaultProjectPath);
    input.focus();
  });

  input?.addEventListener('input', () => {
    setLastProjectPath('');
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runScan();
    }
  });
}

