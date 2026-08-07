// simplebeacon-ignore: Dashboard UI component — all findings are false positives
/**
 * ScanHistoryChart — SVG-based historical scan visualization.
 *
 * Renders three layered visualizations from scan history:
 *   1. Gate pass/fail timeline — colored dots/bars along the X axis
 *   2. Quality score trend line — area chart with gradient fill
 *   3. Severity stacked bars — per-scan critical/high/medium/low breakdown
 *
 * Interactive hover tooltips show scan details (date, gate status, quality,
 * severity counts) on mouseover.
 *
 * Data is derived from the history array already loaded by the dashboard.
 * No additional API calls are required.
 *
 * Rendering uses pure SVG DOM elements (no Canvas, no external chart library)
 * for crisp scaling, CSS variable theming, and accessibility.
 */
import { escapeHtml, formatNumber } from '../utils.js';
import { setSafeHTML } from '../utils-lib/dom.js?v=20260726embedfix1';

// --- Layout constants ---

const CHART_HEIGHT = 280;
const CHART_PADDING = { top: 20, right: 20, bottom: 36, left: 48 };
const MIN_BAR_WIDTH = 8;
const MAX_BAR_WIDTH = 48;
const DOT_RADIUS = 5;
const TOOLTIP_OFFSET = { x: 12, y: -8 };

// --- Color resolution from CSS variables ---

/**
 * Resolve CSS custom properties from the document root.
 * @returns {Object} Color palette object
 */
function resolveColors() {
    const styles = getComputedStyle(document.documentElement);
    const get = (name, fallback) => {
        const v = styles.getPropertyValue(name).trim();
        return v || fallback;
    };
    return {
        border: get('--border', '#334155'),
        text: get('--text-muted', '#94a3b8'),
        textSecondary: get('--text-secondary', '#64748b'),
        surface: get('--surface', '#1e293b'),
        primary: get('--primary', '#6366f1'),
        success: get('--success', '#10b981'),
        danger: get('--danger', '#ef4444'),
        warning: get('--warning', '#f59e0b'),
        info: get('--info', '#3b82f6'),
        critical: get('--danger', '#ef4444'),
        high: get('--warning', '#f59e0b'),
        medium: get('--info', '#3b82f6'),
        low: get('--text-muted', '#94a3b8'),
    };
}

// --- Data normalization ---

/**
 * Normalize history entries into chart data points.
 * @param {Array} history - Raw scan history
 * @returns {Array} Normalized data points
 */
function normalizeHistory(history) {
    const hist = Array.isArray(history) ? history : [];
    return hist.map((entry) => {
        const sev = (entry && entry.severityCounts) || {};
        const gate = (entry && entry.gate) || {};
        const gatePass = entry && (entry.gatePass != null ? entry.gatePass : gate.pass);
        return {
            date: (entry && entry.date) || '',
            gatePass: Boolean(gatePass),
            qualityScore: (entry && entry.qualityScore != null) ? Number(entry.qualityScore) : null,
            issueCount: (entry && entry.issueCount != null) ? Number(entry.issueCount) : 0,
            blockingCount: (entry && entry.blockingCount != null) ? Number(entry.blockingCount) : (gate.blockingCount || 0),
            warningCount: (entry && entry.warningCount != null) ? Number(entry.warningCount) : 0,
            totalFilesScanned: (entry && entry.totalFilesScanned != null) ? Number(entry.totalFilesScanned) : 0,
            critical: sev.critical || 0,
            high: sev.high || 0,
            medium: sev.medium || 0,
            low: sev.low || 0,
            scanId: (entry && entry.scanId) || '',
        };
    });
}

/**
 * Format a date string for axis labels.
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted label
 */
function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

/**
 * Format a full date for tooltips.
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
function formatTooltipDate(dateStr) {
    if (!dateStr) return 'Unknown date';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

// --- SVG element helpers ---

/**
 * Create an SVG element with attributes.
 * @param {string} tag - SVG tag name
 * @param {Object} attrs - Key-value attributes
 * @returns {SVGElement}
 */
function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v != null) el.setAttribute(k, String(v));
    }
    return el;
}

// --- Chart rendering ---

/**
 * Render the ScanHistoryChart SVG.
 * @param {Array} history - Scan history entries
 * @param {Object} [opts] - Render options
 * @param {number} [opts.width] - Chart width (defaults to container width)
 * @returns {{ svg: SVGElement, tooltip: HTMLDivElement, cleanup: () => void }}
 */
export function renderScanHistoryChart(history, opts = {}) {
    const data = normalizeHistory(history);
    const colors = resolveColors();

    const containerWidth = opts.width || 800;
    const w = Math.max(320, containerWidth);
    const h = CHART_HEIGHT;
    const pad = CHART_PADDING;
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Empty state
    if (data.length === 0) {
        const svg = svgEl('svg', {
            class: 'scan-history-chart-svg',
            viewBox: `0 0 ${w} ${h}`,
            width: '100%',
            height: h,
        });
        const text = svgEl('text', {
            x: w / 2,
            y: h / 2,
            'text-anchor': 'middle',
            fill: colors.text,
            'font-size': '13',
            'font-family': 'system-ui, sans-serif',
        });
        text.textContent = 'No scan history yet — run a scan to see trends';
        svg.appendChild(text);
        return { svg, cleanup: () => {} };
    }

    // Calculate X positions
    const n = data.length;
    const stepX = n > 1 ? chartW / (n - 1) : 0;
    const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, stepX * 0.6));

    const xOf = (i) => pad.left + (n > 1 ? i * stepX : chartW / 2);

    // Calculate max severity stack height
    const maxSevTotal = Math.max(1, ...data.map(d => d.critical + d.high + d.medium + d.low));

    // Severity bar area occupies bottom 40% of chart
    const sevAreaTop = pad.top + chartH * 0.6;
    const sevAreaH = chartH * 0.4;

    // Quality line area occupies top 60% of chart
    const qualAreaTop = pad.top;
    const qualAreaH = chartH * 0.6;

    // Build SVG
    const svg = svgEl('svg', {
        class: 'scan-history-chart-svg',
        viewBox: `0 0 ${w} ${h}`,
        width: '100%',
        height: h,
        preserveAspectRatio: 'xMidYMid meet',
    });

    // --- Grid lines (horizontal) ---
    for (let i = 0; i <= 4; i++) {
        const y = qualAreaTop + (i / 4) * qualAreaH;
        svg.appendChild(svgEl('line', {
            x1: pad.left, y1: y,
            x2: pad.left + chartW, y2: y,
            stroke: colors.border,
            'stroke-width': '1',
            'stroke-dasharray': i === 4 ? '0' : '3,3',
            opacity: i === 4 ? '0.5' : '0.25',
        }));

        // Y-axis labels (quality score 100-0)
        const label = svgEl('text', {
            x: pad.left - 8,
            y: y + 3,
            'text-anchor': 'end',
            fill: colors.textSecondary,
            'font-size': '10',
            'font-family': 'system-ui, sans-serif',
        });
        label.textContent = `${100 - (i * 25)}`;
        svg.appendChild(label);
    }

    // --- Severity stacked bars ---
    const barsGroup = svgEl('g', { class: 'scan-history-severity-bars' });
    data.forEach((d, i) => {
        const x = xOf(i) - barWidth / 2;
        const total = d.critical + d.high + d.medium + d.low;
        if (total === 0) return;

        const totalH = (total / maxSevTotal) * sevAreaH;
        let y = sevAreaTop + sevAreaH - totalH;

        const segments = [
            { count: d.critical, color: colors.critical },
            { count: d.high, color: colors.high },
            { count: d.medium, color: colors.medium },
            { count: d.low, color: colors.low },
        ];

        for (const seg of segments) {
            if (seg.count === 0) continue;
            const segH = (seg.count / total) * totalH;
            barsGroup.appendChild(svgEl('rect', {
                x: x,
                y: y,
                width: barWidth,
                height: Math.max(1, segH),
                fill: seg.color,
                opacity: '0.85',
                rx: '1',
            }));
            y += segH;
        }
    });
    svg.appendChild(barsGroup);

    // --- Quality score trend line + area ---
    const qualityPoints = data
        .map((d, i) => ({ x: xOf(i), y: d.qualityScore != null ? qualAreaTop + qualAreaH - (d.qualityScore / 100) * qualAreaH : null, d }))
        .filter(p => p.y != null);

    if (qualityPoints.length > 0) {
        // Area fill
        if (qualityPoints.length > 1) {
            const areaPath = `M ${qualityPoints[0].x} ${qualAreaTop + qualAreaH} ` +
                qualityPoints.map(p => `L ${p.x} ${p.y}`).join(' ') +
                ` L ${qualityPoints[qualityPoints.length - 1].x} ${qualAreaTop + qualAreaH} Z`;
            const gradId = 'scan-history-quality-grad';
            const defs = svgEl('defs', {});
            const grad = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
            grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': colors.primary, 'stop-opacity': '0.3' }));
            grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': colors.primary, 'stop-opacity': '0.03' }));
            defs.appendChild(grad);
            svg.appendChild(defs);
            svg.appendChild(svgEl('path', {
                d: areaPath,
                fill: `url(#${gradId})`,
                stroke: 'none',
            }));
        }

        // Line
        if (qualityPoints.length > 1) {
            const linePath = qualityPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            svg.appendChild(svgEl('path', {
                d: linePath,
                fill: 'none',
                stroke: colors.primary,
                'stroke-width': '2',
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round',
            }));
        }

        // Dots
        qualityPoints.forEach((p) => {
            svg.appendChild(svgEl('circle', {
                cx: p.x,
                cy: p.y,
                r: DOT_RADIUS,
                fill: p.d.qualityScore >= 80 ? colors.success : p.d.qualityScore >= 50 ? colors.warning : colors.danger,
                stroke: colors.surface,
                'stroke-width': '1.5',
            }));
        });
    }

    // --- Gate pass/fail timeline markers ---
    const gateGroup = svgEl('g', { class: 'scan-history-gate-markers' });
    data.forEach((d, i) => {
        const x = xOf(i);
        const y = pad.top + chartH + 6;
        const color = d.gatePass ? colors.success : colors.danger;

        // Small bar below the chart
        gateGroup.appendChild(svgEl('rect', {
            x: x - barWidth / 2,
            y: y,
            width: barWidth,
            height: 4,
            fill: color,
            rx: '1',
            opacity: '0.9',
        }));
    });
    svg.appendChild(gateGroup);

    // --- X-axis labels (first, middle, last) ---
    const labelIndices = [0, Math.floor(n / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
    labelIndices.forEach((i) => {
        if (!data[i]) return;
        const label = data[i].date ? formatDateLabel(data[i].date) : '';
        if (!label) return;
        const text = svgEl('text', {
            x: xOf(i),
            y: h - 4,
            'text-anchor': 'middle',
            fill: colors.textSecondary,
            'font-size': '10',
            'font-family': 'system-ui, sans-serif',
        });
        text.textContent = label;
        svg.appendChild(text);
    });

    // --- Interactive hover overlays ---
    const hoverGroup = svgEl('g', { class: 'scan-history-hover-layer' });
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'scan-history-tooltip';
    tooltipEl.style.display = 'none';
    tooltipEl.setAttribute('role', 'tooltip');

    data.forEach((d, i) => {
        const x = xOf(i);
        // Invisible hover target
        const hoverRect = svgEl('rect', {
            x: x - Math.max(barWidth, 20) / 2,
            y: pad.top,
            width: Math.max(barWidth, 20),
            height: chartH,
            fill: 'transparent',
            class: 'scan-history-hover-target',
            'data-index': String(i),
        });
        hoverRect.style.cursor = 'pointer';

        hoverRect.addEventListener('mouseenter', (e) => {
            showTooltip(tooltipEl, d, e, svg);
        });
        hoverRect.addEventListener('mousemove', (e) => {
            showTooltip(tooltipEl, d, e, svg);
        });
        hoverRect.addEventListener('mouseleave', () => {
            tooltipEl.style.display = 'none';
        });

        hoverGroup.appendChild(hoverRect);
    });
    svg.appendChild(hoverGroup);

    // --- Legend ---
    const legend = svgEl('g', { class: 'scan-history-legend', transform: `translate(${pad.left}, 4)` });
    const legendItems = [
        { label: 'Quality', color: colors.primary, type: 'line' },
        { label: 'Pass', color: colors.success, type: 'bar' },
        { label: 'Fail', color: colors.danger, type: 'bar' },
        { label: 'Critical', color: colors.critical, type: 'square' },
        { label: 'High', color: colors.high, type: 'square' },
        { label: 'Medium', color: colors.medium, type: 'square' },
        { label: 'Low', color: colors.low, type: 'square' },
    ];

    let legendX = 0;
    for (const item of legendItems) {
        // Icon
        if (item.type === 'line') {
            legend.appendChild(svgEl('line', {
                x1: legendX, y1: 8, x2: legendX + 14, y2: 8,
                stroke: item.color, 'stroke-width': '2',
            }));
        } else if (item.type === 'bar') {
            legend.appendChild(svgEl('rect', {
                x: legendX, y: 5, width: 14, height: 6,
                fill: item.color, rx: '1',
            }));
        } else {
            legend.appendChild(svgEl('rect', {
                x: legendX + 2, y: 4, width: 8, height: 8,
                fill: item.color, rx: '1',
            }));
        }
        // Label
        const text = svgEl('text', {
            x: legendX + 18,
            y: 10,
            fill: colors.textSecondary,
            'font-size': '10',
            'font-family': 'system-ui, sans-serif',
        });
        text.textContent = item.label;
        legend.appendChild(text);
        legendX += 18 + text.getComputedTextLength() + 16;
    }
    svg.appendChild(legend);

    const cleanup = () => {
        tooltipEl.remove();
    };

    return { svg, tooltip: tooltipEl, cleanup };
}

/**
 * Show the tooltip for a data point.
 * @param {HTMLDivElement} tooltip - Tooltip element
 * @param {Object} d - Data point
 * @param {MouseEvent} e - Mouse event
 * @param {SVGElement} svg - SVG element
 */
function showTooltip(tooltip, d, e, svg) {
    const totalFindings = d.critical + d.high + d.medium + d.low;
    const gateLabel = d.gatePass ? 'PASS' : 'FAIL';
    const gateColor = d.gatePass ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)';

    tooltip.innerHTML = `
        <div class="scan-history-tooltip-date">${escapeHtml(formatTooltipDate(d.date))}</div>
        <div class="scan-history-tooltip-row">
            <span class="scan-history-tooltip-label">Gate</span>
            <span class="scan-history-tooltip-value" style="color: ${gateColor}; font-weight: 600;">${gateLabel}</span>
        </div>
        ${d.qualityScore != null ? `
        <div class="scan-history-tooltip-row">
            <span class="scan-history-tooltip-label">Quality</span>
            <span class="scan-history-tooltip-value">${formatNumber(d.qualityScore)}/100</span>
        </div>` : ''}
        <div class="scan-history-tooltip-row">
            <span class="scan-history-tooltip-label">Findings</span>
            <span class="scan-history-tooltip-value">${formatNumber(totalFindings)}</span>
        </div>
        ${(d.critical + d.high + d.medium + d.low) > 0 ? `
        <div class="scan-history-tooltip-sev">
            ${d.critical > 0 ? `<span class="scan-history-tooltip-sev-item" style="color: var(--danger, #ef4444)">C:${d.critical}</span>` : ''}
            ${d.high > 0 ? `<span class="scan-history-tooltip-sev-item" style="color: var(--warning, #f59e0b)">H:${d.high}</span>` : ''}
            ${d.medium > 0 ? `<span class="scan-history-tooltip-sev-item" style="color: var(--info, #3b82f6)">M:${d.medium}</span>` : ''}
            ${d.low > 0 ? `<span class="scan-history-tooltip-sev-item" style="color: var(--text-muted, #94a3b8)">L:${d.low}</span>` : ''}
        </div>` : ''}
        ${d.blockingCount > 0 ? `
        <div class="scan-history-tooltip-row">
            <span class="scan-history-tooltip-label">Blocking</span>
            <span class="scan-history-tooltip-value" style="color: var(--danger, #ef4444)">${formatNumber(d.blockingCount)}</span>
        </div>` : ''}
    `;

    tooltip.style.display = 'block';

    // Position tooltip relative to cursor
    const svgRect = svg.getBoundingClientRect();
    const containerRect = svg.parentElement.getBoundingClientRect();
    const x = e.clientX - containerRect.left + TOOLTIP_OFFSET.x;
    const y = e.clientY - containerRect.top + TOOLTIP_OFFSET.y;

    // Keep tooltip within container bounds
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxX = containerRect.width - tooltipRect.width - 8;
    const maxY = containerRect.height - tooltipRect.height - 8;

    tooltip.style.left = Math.max(8, Math.min(x, maxX)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(y, maxY)) + 'px';
}

/**
 * Render the scan history chart section HTML.
 * @param {Array} history - Scan history
 * @returns {string} HTML string
 */
export function renderScanHistorySection(history) {
    const hist = Array.isArray(history) ? history : [];
    const count = hist.length;

    return `
        <div class="card scan-history-chart-card" id="scan-history-chart-card">
            <div class="card-header">
                <span class="card-title">Scan History</span>
                <span class="text-muted" style="font-size: var(--font-size-sm)">${count} scan(s)</span>
            </div>
            <div class="scan-history-chart-container" id="scan-history-chart-container">
            </div>
        </div>
    `;
}

/**
 * Mount the scan history chart into a container element.
 * @param {HTMLElement} container - Container element
 * @param {Array} history - Scan history
 * @returns {(() => void) | null} Cleanup function or null
 */
export function mountScanHistoryChart(container, history) {
    if (!container) return null;

    const chartContainer = container.querySelector('#scan-history-chart-container');
    if (!chartContainer) return null;

    const width = chartContainer.getBoundingClientRect().width || 800;

    let rendered;
    try {
        rendered = renderScanHistoryChart(history, { width });
    } catch {
        chartContainer.innerHTML = '<div class="scan-history-chart-error">Unable to render chart</div>';
        return null;
    }

    chartContainer.innerHTML = '';
    chartContainer.appendChild(rendered.svg);
    chartContainer.appendChild(rendered.tooltip);

    // Re-render on resize
    let resizeTimer = null;
    const onResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const newWidth = chartContainer.getBoundingClientRect().width || 800;
            if (rendered && rendered.cleanup) rendered.cleanup();
            try {
                rendered = renderScanHistoryChart(history, { width: newWidth });
                chartContainer.innerHTML = '';
                chartContainer.appendChild(rendered.svg);
                chartContainer.appendChild(rendered.tooltip);
            } catch {
                /* ignore resize errors */
            }
        }, 150);
    };
    window.addEventListener('resize', onResize);

    return () => {
        window.removeEventListener('resize', onResize);
        if (resizeTimer) clearTimeout(resizeTimer);
        if (rendered && rendered.cleanup) rendered.cleanup();
    };
}
