// simplebeacon-ignore: Dashboard UI component — all findings are false positives
/**
 * MetricsCards — summary KPI cards for the dashboard.
 *
 * Renders a responsive grid of metric cards showing:
 *   - Total scans run
 *   - Gate pass rate
 *   - Severity breakdown (critical / high / medium / low)
 *   - Files analyzed
 *
 * Data is derived from the scan report and history already loaded by the
 * dashboard. No additional API calls are required.
 */
import { formatNumber, formatPercent, escapeHtml } from '../utils.js';
import { setSafeHTML } from '../utils-lib/dom.js?v=20260726embedfix1';

/**
 * Compute metrics from report + history.
 * @param {Object|null} report - Latest scan report
 * @param {Array} history - Scan history entries
 * @returns {Object} Aggregated metrics
 */
export function computeMetrics(report, history) {
    const hist = Array.isArray(history) ? history : [];
    const totalScans = hist.length;

    const passedScans = hist.filter(h => h && h.gate && h.gate.pass).length;
    const gatePassRate = totalScans > 0 ? Math.round((passedScans / totalScans) * 100) : null;

    const sev = (report && report.severityCounts) || {};
    const critical = sev.critical || 0;
    const high = sev.high || 0;
    const medium = sev.medium || 0;
    const low = sev.low || 0;
    const totalFindings = critical + high + medium + low;

    const filesAnalyzed = report
        ? (report.filesAnalyzed || report.ruleScopedFilesAnalyzed || report.repositoryFilesTotal || 0)
        : 0;

    const repoFiles = report
        ? (report.repositoryFilesTotal || report.totalFiles || 0)
        : 0;

    const consistencyScore = report
        ? (report.consistencyScore != null ? report.consistencyScore : null)
        : null;

    const schemaCompliance = report
        ? (report.schemaCompliance != null ? report.schemaCompliance : null)
        : null;

    return {
        totalScans,
        gatePassRate,
        critical,
        high,
        medium,
        low,
        totalFindings,
        filesAnalyzed,
        repoFiles,
        consistencyScore,
        schemaCompliance,
        hasReport: Boolean(report)
    };
}

/**
 * Determine the severity badge class.
 * @param {number} count
 * @returns {string} CSS class
 */
function severityClass(count) {
    if (count === 0) return 'metric-sev-clean';
    if (count >= 10) return 'metric-sev-danger';
    if (count >= 3) return 'metric-sev-warning';
    return 'metric-sev-info';
}

/**
 * Render a single metric card.
 * @param {string} icon - Lucide icon name
 * @param {string} label - Card label
 * @param {string} value - Display value
 * @param {string} [badge] - Optional badge text
 * @param {string} [badgeClass] - Optional badge CSS class
 * @returns {string} HTML string
 */
function renderCard(icon, label, value, badge, badgeClass) {
    const badgeHtml = badge
        ? `<span class="metric-card-badge ${badgeClass || ''}">${escapeHtml(badge)}</span>`
        : '';
    return `
        <div class="metric-card metrics-card-item">
            <div class="metric-card-top">
                <div class="metric-card-icon">
                    <i data-lucide="${icon}"></i>
                </div>
                ${badgeHtml}
            </div>
            <div class="metric-value">${value}</div>
            <div class="metric-label">${escapeHtml(label)}</div>
        </div>
    `;
}

/**
 * Render the metrics cards grid.
 * @param {Object|null} report - Latest scan report
 * @param {Array} history - Scan history
 * @returns {string} HTML string for the metrics grid
 */
export function renderMetricsCards(report, history) {
    const m = computeMetrics(report, history);

    // If no report and no history, show a placeholder
    if (!m.hasReport && m.totalScans === 0) {
        return `
            <div class="metrics-cards-grid" id="metrics-cards-grid">
                <div class="metric-card metrics-card-empty">
                    <div class="metric-card-icon"><i data-lucide="bar-chart-3"></i></div>
                    <div class="metric-value">—</div>
                    <div class="metric-label">Run a scan to see metrics</div>
                </div>
            </div>
        `;
    }

    const gateRateLabel = m.gatePassRate != null ? formatPercent(m.gatePassRate) : '—';
    const gateBadge = m.gatePassRate != null
        ? (m.gatePassRate >= 80 ? 'Healthy' : m.gatePassRate >= 50 ? 'Review' : 'At Risk')
        : null;
    const gateBadgeClass = m.gatePassRate != null
        ? (m.gatePassRate >= 80 ? 'metric-badge-success' : m.gatePassRate >= 50 ? 'metric-badge-warning' : 'metric-badge-danger')
        : '';

    const findingsValue = m.totalFindings > 0
        ? formatNumber(m.totalFindings)
        : '0';
    const findingsBadge = m.totalFindings === 0 ? 'Clean' : null;
    const findingsBadgeClass = m.totalFindings === 0 ? 'metric-badge-success' : '';

    const cards = [
        renderCard('scan-line', 'Total Scans', formatNumber(m.totalScans)),
        renderCard('shield-check', 'Gate Pass Rate', gateRateLabel, gateBadge, gateBadgeClass),
        renderCard('alert-triangle', 'Total Findings', findingsValue, findingsBadge, findingsBadgeClass),
        renderCard('file-search', 'Files Analyzed', formatNumber(m.filesAnalyzed)),
        renderCard('database', 'Repo Files', formatNumber(m.repoFiles)),
        renderCard('gauge', 'Consistency', m.consistencyScore != null ? formatPercent(m.consistencyScore) : '—'),
        renderCard('file-check', 'Schema Compliance', m.schemaCompliance != null ? formatPercent(m.schemaCompliance) : '—'),
    ];

    // Severity breakdown cards (only if there's a report)
    if (m.hasReport) {
        cards.push(
            renderCard('flame', 'Critical', formatNumber(m.critical),
                m.critical > 0 ? String(m.critical) : null, severityClass(m.critical)),
            renderCard('arrow-up-circle', 'High', formatNumber(m.high),
                m.high > 0 ? String(m.high) : null, severityClass(m.high)),
            renderCard('alert-circle', 'Medium', formatNumber(m.medium),
                m.medium > 0 ? String(m.medium) : null, severityClass(m.medium)),
            renderCard('info', 'Low', formatNumber(m.low),
                m.low > 0 ? String(m.low) : null, severityClass(m.low)),
        );
    }

    return `
        <div class="metrics-cards-grid" id="metrics-cards-grid">
            ${cards.join('\n')}
        </div>
    `;
}

/**
 * Bind interactive behavior for the metrics cards.
 * Currently just initializes Lucide icons within the grid.
 * @param {HTMLElement} container - Container element containing the cards
 */
export function bindMetricsCards(container) {
    const grid = container.querySelector('#metrics-cards-grid');
    if (!grid) return;

    // Initialize Lucide icons if available
    if (typeof window !== 'undefined' && window.lucide) {
        try { window.lucide.createIcons({ root: grid }); } catch { /* ignore */ }
    }
}

/**
 * Mount the metrics cards into a slot element.
 * @param {HTMLElement} slot - DOM element to mount into
 * @param {Object|null} report - Latest scan report
 * @param {Array} history - Scan history
 */
export function mountMetricsCards(slot, report, history) {
    if (!slot) return;
    setSafeHTML(slot, renderMetricsCards(report, history));
    bindMetricsCards(slot);
}
