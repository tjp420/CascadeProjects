// simplebeacon-ignore: Dashboard code — all findings are false positives
import { fetchDropTelemetry, resetDropTelemetry } from '../services/dropTelemetryService.js';

let refreshInterval = null;

/**
 * Render drop telemetry dashboard.
 * @returns {HTMLElement}
 */
export function renderDropTelemetryDashboard() {
    const container = document.createElement('div');
    container.className = 'card';
    container.id = 'drop-telemetry-dashboard';

    const header = document.createElement('div');
    header.className = 'card-header';

    const flex = document.createElement('div');
    flex.className = 'flex items-center gap-3';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = 'Drag-and-Drop Telemetry';

    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'drop-telemetry-refresh';
    refreshBtn.className = 'btn btn-sm btn-ghost';
    refreshBtn.textContent = 'Refresh';

    flex.appendChild(title);
    flex.appendChild(refreshBtn);

    const resetBtn = document.createElement('button');
    resetBtn.id = 'drop-telemetry-reset';
    resetBtn.className = 'btn btn-sm btn-ghost';
    resetBtn.textContent = 'Reset';

    header.appendChild(flex);
    header.appendChild(resetBtn);

    const body = document.createElement('div');
    body.className = 'card-body';

    const content = document.createElement('div');
    content.id = 'drop-telemetry-content';

    body.appendChild(content);
    container.appendChild(header);
    container.appendChild(body);

    bindDropTelemetryDashboard(container);
    return container;
}

/**
 * Bind drop telemetry dashboard events.
 * @param {HTMLElement} container
 */
function bindDropTelemetryDashboard(container) {
    const refreshBtn = container.querySelector('#drop-telemetry-refresh');
    const resetBtn = container.querySelector('#drop-telemetry-reset');

    refreshBtn.addEventListener('click', () => {
        loadDropTelemetryData(container);
    });

    resetBtn.addEventListener('click', () => {
        resetDropTelemetry();
        loadDropTelemetryData(container);
    });

    loadDropTelemetryData(container);

    // Set up 10-second polling (faster than recovery telemetry since drops are interactive)
    if (refreshInterval)
        clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadDropTelemetryData(container);
    }, 10000);
}

/**
 * Load drop telemetry data.
 * @param {HTMLElement} container
 */
function loadDropTelemetryData(container) {
    const content = container.querySelector('#drop-telemetry-content');

    try {
        const data = fetchDropTelemetry();

        const metricDefs = [
            { key: 'totalDrops', label: 'Total Drops' },
            { key: 'totalFilesDropped', label: 'Files Dropped' },
            { key: 'preReadSuccess', label: 'Pre-Read OK' },
            { key: 'preReadSkipped', label: 'Pre-Read Skipped (>2MB)' },
            { key: 'preReadFailed', label: 'Pre-Read Failed' },
            { key: 'firefoxBypassUsed', label: 'Firefox Bypass Used' },
            { key: 'traversalErrors', label: 'Traversal Errors' },
        ];

        content.innerHTML = '';

        const metricsRow = document.createElement('div');
        metricsRow.className = 'metrics-row';

        for (const def of metricDefs) {
            const chip = document.createElement('div');
            chip.className = 'metric-chip';
            const value = data[def.key] !== undefined ? data[def.key] : 0;
            chip.innerHTML = '<strong>' + value + '</strong> ' + def.label;
            metricsRow.appendChild(chip);
        }

        content.appendChild(metricsRow);

        // Show a summary line
        const summary = document.createElement('p');
        summary.className = 'text-muted';
        summary.style.fontSize = 'var(--font-size-xs)';
        summary.style.margin = '8px 0 0 0';
        const successRate = data.preReadSuccess + data.preReadSkipped + data.preReadFailed > 0
            ? Math.round((data.preReadSuccess / (data.preReadSuccess + data.preReadSkipped + data.preReadFailed)) * 100)
            : 0;
        summary.textContent = `Pre-read success rate: ${successRate}% · Client-side only (no server data)`;
        content.appendChild(summary);
    } catch (error) {
        content.innerHTML = '<div class="text-danger">Failed to load drop telemetry.</div>';
    }
}

/**
 * Cleanup drop telemetry dashboard.
 */
export function cleanupDropTelemetryDashboard() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}
