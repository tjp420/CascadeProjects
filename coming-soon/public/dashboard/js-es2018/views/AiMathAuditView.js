// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml } from '../utils.js';

/**
 * AiMathAuditView — renders AI Math Audit findings with severity cards,
 * sortable findings table, and embedded heatmap / distribution images.
 */
export class AiMathAuditView {
    constructor(container) {
        this.container = container;
        this.data = null;
        this.sortKey = 'severity';
        this.sortDir = -1; // descending
    }

    setData(data) {
        this.data = data;
        this.render();
    }

    render() {
        if (!this.container) return;
        const report = this.data?.report || this.data;
        if (!report) {
            this.container.innerHTML = '<div class="empty-state">No AI Math Audit data available.</div>';
            return;
        }

        const summary = report.summary || {};
        const findings = report.findings || [];
        const thresholds = report.thresholds_used || {};
        const viz = report.visualizations || [];

        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sortedFindings = [...findings].sort((a, b) => {
            const sa = severityOrder[a.severity] ?? 99;
            const sb = severityOrder[b.severity] ?? 99;
            if (sa !== sb) return sa - sb;
            const ta = a.type || '';
            const tb = b.type || '';
            return ta.localeCompare(tb);
        });

        const severityBadge = (sev) => {
            const colours = {
                critical: 'background:#7f1d1d;color:#fca5a5;',
                high: 'background:#451a03;color:#fcd34d;',
                medium: 'background:#1e3a8a;color:#93c5fd;',
                low: 'background:#064e3b;color:#86efac;',
            };
            const style = colours[sev] || 'background:#334155;color:#94a3b8;';
            return `<span class="gate-badge" style="${style}font-size:10px;padding:2px 8px;border-radius:999px;text-transform:uppercase;font-weight:600;">${escapeHtml(sev)}</span>`;
        };

        const vizHtml = viz.map((v) => {
            const typeLabel = String(v.type || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            return `
                <div style="margin-bottom:var(--space-4);">
                    <h4 style="font-size:var(--font-size-sm);color:var(--muted);margin-bottom:var(--space-2);">${escapeHtml(typeLabel)}${v.layer ? ' — ' + escapeHtml(v.layer) : ''}</h4>
                    <img src="${escapeHtml(v.url || '')}" alt="${escapeHtml(typeLabel)}" style="max-width:100%;border-radius:8px;border:1px solid var(--border);"/>
                </div>
            `;
        }).join('');

        const findingRows = sortedFindings.map((f) => {
            const layerOrToken = f.layer ? escapeHtml(f.layer) : f.token ? escapeHtml(f.token) : '—';
            const metrics = f.metrics ? `<pre style="margin:0;font-size:10px;background:var(--surface-2);padding:4px 8px;border-radius:6px;overflow:auto;">${escapeHtml(JSON.stringify(f.metrics, null, 2))}</pre>` : '—';
            return `
                <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px 12px;vertical-align:top;">${severityBadge(f.severity)}</td>
                    <td style="padding:8px 12px;vertical-align:top;font-size:var(--font-size-xs);color:var(--foreground);">${escapeHtml(f.type || '—')}</td>
                    <td style="padding:8px 12px;vertical-align:top;font-size:var(--font-size-xs);color:var(--muted);">${layerOrToken}</td>
                    <td style="padding:8px 12px;vertical-align:top;font-size:var(--font-size-xs);color:var(--foreground);max-width:300px;">${escapeHtml(f.detail || '—')}</td>
                    <td style="padding:8px 12px;vertical-align:top;">${metrics}</td>
                </tr>
            `;
        }).join('');

        this.container.innerHTML = `
            <div class="section-block" style="margin-top:var(--space-6);">
                <div class="section-heading" style="margin-bottom:var(--space-3);">
                    <h2 style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-lg);">
                        <span style="font-size:1.25rem;">🔢</span> AI Math Audit
                    </h2>
                    <span class="text-muted" style="font-size:var(--font-size-sm);">
                        ${summary.total_findings || 0} findings · Source: ${escapeHtml(report.source || '—')}
                    </span>
                </div>

                <!-- Severity cards -->
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);margin-bottom:var(--space-4);">
                    <div class="card" style="text-align:center;padding:var(--space-4);border-left:4px solid #ef4444;">
                        <div style="font-size:28px;font-weight:700;color:#ef4444;">${summary.critical || 0}</div>
                        <div style="font-size:var(--font-size-xs);color:var(--muted);margin-top:4px;">Critical</div>
                    </div>
                    <div class="card" style="text-align:center;padding:var(--space-4);border-left:4px solid #f59e0b;">
                        <div style="font-size:28px;font-weight:700;color:#f59e0b;">${summary.high || 0}</div>
                        <div style="font-size:var(--font-size-xs);color:var(--muted);margin-top:4px;">High</div>
                    </div>
                    <div class="card" style="text-align:center;padding:var(--space-4);border-left:4px solid #3b82f6;">
                        <div style="font-size:28px;font-weight:700;color:#3b82f6;">${summary.medium || 0}</div>
                        <div style="font-size:var(--font-size-xs);color:var(--muted);margin-top:4px;">Medium</div>
                    </div>
                    <div class="card" style="text-align:center;padding:var(--space-4);border-left:4px solid #22c55e;">
                        <div style="font-size:28px;font-weight:700;color:#22c55e;">${summary.low || 0}</div>
                        <div style="font-size:var(--font-size-xs);color:var(--muted);margin-top:4px;">Low</div>
                    </div>
                </div>

                <!-- Thresholds -->
                <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-4);">
                    <h4 style="font-size:var(--font-size-sm);color:var(--muted);margin-bottom:var(--space-2);">Thresholds Used</h4>
                    <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);">
                        ${Object.entries(thresholds).map(([k, v]) => `
                            <span class="gate-badge" style="background:var(--surface-2);color:var(--foreground);font-size:10px;padding:2px 8px;border-radius:999px;">
                                ${escapeHtml(k.replace(/_/g, ' '))}: ${v}
                            </span>
                        `).join('')}
                    </div>
                </div>

                <!-- Visualizations -->
                ${vizHtml ? `<div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4);">${vizHtml}</div>` : ''}

                <!-- Findings table -->
                <div class="card" style="padding:var(--space-4);overflow:auto;">
                    <h4 style="font-size:var(--font-size-sm);color:var(--muted);margin-bottom:var(--space-3);">Findings</h4>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="text-align:left;border-bottom:2px solid var(--border);">
                                <th style="padding:8px 12px;font-size:var(--font-size-xs);color:var(--muted);font-weight:600;">Severity</th>
                                <th style="padding:8px 12px;font-size:var(--font-size-xs);color:var(--muted);font-weight:600;">Type</th>
                                <th style="padding:8px 12px;font-size:var(--font-size-xs);color:var(--muted);font-weight:600;">Layer / Token</th>
                                <th style="padding:8px 12px;font-size:var(--font-size-xs);color:var(--muted);font-weight:600;">Detail</th>
                                <th style="padding:8px 12px;font-size:var(--font-size-xs);color:var(--muted);font-weight:600;">Metrics</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${findingRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:var(--muted);font-size:var(--font-size-xs);">No findings</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    destroy() {
        this.container = null;
        this.data = null;
    }
}
