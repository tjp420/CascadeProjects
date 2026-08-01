// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { escapeHtml, showToast, downloadJson, redactPathForDisplay, formatNumber, renderEmptyState } from '../utils.js';
import { extractSecurityFindings, buildSecuritySummary, buildSecurityExportPayload, fetchComplianceHeadline } from '../services/securityService.js';
import { fetchSecurityTelemetry, buildTelemetrySummary } from '../services/telemetryService.js';
import { fetchKeyStatus, triggerKeyRotation, forceReKeySweep, fetchReKeyStats, generateRandomKey, formatGraceCountdown } from '../services/keyManagementService.js';
import { fetchQuarantineEntries, verifyQuarantineEntry } from '../services/quarantineService.js';
import { getVsCodeApi } from '../utils-lib/dom.js?v=20260725phase3';

const SEVERITY_COLORS = {
    critical: { bg: 'rgba(239,68,68,0.12)', bar: 'var(--danger)', text: 'var(--danger)', icon: '🔴' },
    high: { bg: 'rgba(239,68,68,0.08)', bar: 'var(--danger)', text: 'var(--danger)', icon: '🟠' },
    medium: { bg: 'rgba(245,158,11,0.10)', bar: 'var(--warning)', text: 'var(--warning)', icon: '🟡' },
    low: { bg: 'rgba(148,163,184,0.10)', bar: 'var(--text-muted)', text: 'var(--text-muted)', icon: '⚪' }
};

function severityBar(label, count, total, config) {
    const pct = total > 0 ? Math.min(100, (count / total) * 100) : 0;
    return `
      <div style="display:flex;align-items:center;gap:var(--space-3);">
        <div style="width:72px;font-size:var(--font-size-xs);font-weight:600;color:${config.text};">${escapeHtml(label)}</div>
        <div style="flex:1;height:6px;background:var(--border);border-radius:var(--radius-full);overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${config.bar};border-radius:var(--radius-full);transition:width 600ms cubic-bezier(0.4,0,0.2,1);"></div>
        </div>
        <div style="width:28px;text-align:right;font-size:var(--font-size-sm);font-weight:700;color:${config.text};">${formatNumber(count)}</div>
      </div>`;
}

function statCard(icon, label, value, accentBg) {
    return `
      <div class="card" style="padding:var(--space-5);display:flex;align-items:center;gap:var(--space-4);transition:transform var(--transition),box-shadow var(--transition);">
        <div style="width:44px;height:44px;border-radius:var(--radius-md);background:${accentBg};display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0;">${icon}</div>
        <div style="min-width:0;">
          <div style="font-size:var(--font-size-xl);font-weight:700;line-height:var(--leading-tight);">${escapeHtml(String(value))}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1);">${escapeHtml(label)}</div>
        </div>
      </div>`;
}

/**
 * Security view.
 */
export class SecurityView {
    constructor(app) {
        this.app = app;
        this.scanning = false;
        this.loading = true;
        this.error = null;
        this.compliance = null;
        this.telemetry = null;
        this.telemetryLoading = false;
        this.telemetryError = null;
        this.keyStatus = null;
        this.keyStatusLoading = false;
        this.keyStatusError = null;
        this.reKeyStats = null;
        this.rotating = false;
        this.rekeying = false;
        this.quarantine = null;
        this.quarantineLoading = false;
        this.quarantineError = null;
        this.quarantineAllOrgs = false;
        this.quarantineExpanded = new Set();
        this.quarantineVerifyResults = {};
        this.quarantineVerifying = new Set();
        this._container = null;
    }
    getReport() {
        return this.app.state.report;
    }
    getFindings() {
        return extractSecurityFindings(this.getReport());
    }
    getSummary() {
        return buildSecuritySummary(this.getReport(), this.getFindings());
    }
    renderFindingsTable(findings) {
        if (!findings.length) {
            return renderEmptyState({
                icon: '🛡️',
                title: 'No security findings',
                body: 'Credential and production-leak rules reported clean on the last scan.',
                iconWrapper: 'emoji'
            });
        }
        const rows = findings.map((finding) => {
            const sev = String(finding.severity || 'medium').toLowerCase();
            const cfg = SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium;
            return `
              <tr style="transition:background var(--transition);">
                <td><span style="display:inline-flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-3);border-radius:var(--radius-full);font-size:var(--font-size-xs);font-weight:600;background:${cfg.bg};color:${cfg.text};">${cfg.icon} ${escapeHtml(finding.severity)}</span></td>
                <td><span style="font-size:var(--font-size-xs);font-weight:600;color:var(--text-secondary);">${escapeHtml(finding.type)}</span></td>
                <td><code style="font-size:var(--font-size-xs);color:var(--text-secondary);background:var(--surface-hover);padding:2px var(--space-2);border-radius:var(--radius-sm);">${escapeHtml(redactPathForDisplay(finding.file) || '—')}</code></td>
                <td style="font-size:var(--font-size-sm);color:var(--text-primary);">${escapeHtml(finding.description || '—')}</td>
                <td style="font-size:var(--font-size-sm);color:var(--text-muted);">${escapeHtml(finding.recommendation || '—')}</td>
              </tr>`;
        }).join('');
        return `
      <div class="card" style="padding:0;overflow:hidden;border-radius:var(--radius-lg);">
        <div class="table-scroll-wrapper">
        <table class="results-table">
          <thead>
            <tr>
              <th scope="col" style="width:100px">Severity</th>
              <th scope="col" style="width:130px">Type</th>
              <th scope="col" style="width:220px">File</th>
              <th scope="col">Description</th>
              <th scope="col" style="width:200px">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        </div>
      </div>
    `;
    }
    renderTelemetrySection() {
        if (!this.app.isCurrentUserAdmin || !this.app.isCurrentUserAdmin()) return '';
        if (this.telemetryLoading) {
            return `
        <div class="section-block">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0 0 var(--space-4);;">Security Telemetry</h2>
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <span class="loading-spinner" style="width:24px;height:24px;margin:0 auto var(--space-3);"></span>
            <p class="text-muted" style="font-size:var(--font-size-sm);">Loading telemetry…</p>
          </div>
        </div>`;
        }
        if (this.telemetryError && !this.telemetry) {
            return `
        <div class="section-block">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0 0 var(--space-4);;">Security Telemetry</h2>
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <p style="color:var(--danger);font-size:var(--font-size-sm);margin-bottom:var(--space-3);">${escapeHtml(this.telemetryError)}</p>
            <button class="btn btn-secondary btn-sm" id="telemetry-retry" type="button">Retry</button>
          </div>
        </div>`;
        }
        if (!this.telemetry) {
            return `
        <div class="section-block">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0 0 var(--space-4);;">Security Telemetry</h2>
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <p class="text-muted" style="font-size:var(--font-size-sm);margin-bottom:var(--space-3);">Real-time security metrics from scrubber registry, replay detector, and audit chain.</p>
            <button class="btn btn-primary btn-sm" id="telemetry-load" type="button">Load telemetry</button>
          </div>
        </div>`;
        }
        const s = this.telemetry;
        const chainStatus = s.audit.chainValid ? '✅ Valid' : '⚠️ Broken';
        const chainColor = s.audit.chainValid ? 'var(--success)' : 'var(--danger)';
        return `
      <div class="section-block">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0;">Security Telemetry</h2>
          <button class="btn btn-ghost btn-sm" id="telemetry-refresh" type="button">⟳ Refresh</button>
        </div>

        <!-- Telemetry stat cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-4);margin-bottom:var(--space-6);">
          ${statCard('🧹', 'Active Scrubbers', `${s.scrubber.activeScrubbers}/${s.scrubber.maxScrubbers}`, 'rgba(99,102,241,0.12)')}
          ${statCard('🔄', 'Replays Blocked', formatNumber(s.replay.totalReplays), 'rgba(239,68,68,0.12)')}
          ${statCard('🔗', 'Audit Chain', chainStatus, s.audit.chainValid ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)')}
          ${statCard('🛡️', 'PII Policies', `${s.pii.enabledPolicies}/${s.pii.totalPolicies}`, 'rgba(168,85,247,0.12)')}
        </div>

        <!-- Scrubber details -->
        <div class="card" style="padding:var(--space-5) var(--space-6);margin-bottom:var(--space-4);">
          <div style="font-size:var(--font-size-sm);font-weight:700;margin-bottom:var(--space-3);">Stream Scrubber Registry</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--space-3);">
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Utilization</span><div style="font-weight:700;">${s.scrubber.utilization}%</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Total Created</span><div style="font-weight:700;">${formatNumber(s.scrubber.totalCreated)}</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Evicted (LRU)</span><div style="font-weight:700;">${formatNumber(s.scrubber.totalEvicted)}</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Expired (TTL)</span><div style="font-weight:700;">${formatNumber(s.scrubber.totalExpired)}</div></div>
          </div>
        </div>

        <!-- Replay detector details -->
        <div class="card" style="padding:var(--space-5) var(--space-6);margin-bottom:var(--space-4);">
          <div style="font-size:var(--font-size-sm);font-weight:700;margin-bottom:var(--space-3);">Replay Detection</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--space-3);">
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Total Checked</span><div style="font-weight:700;">${formatNumber(s.replay.totalChecked)}</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Replay Rate</span><div style="font-weight:700;">${s.replay.replayRate}%</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Active Orgs</span><div style="font-weight:700;">${formatNumber(s.replay.orgCount)}</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Tracked Fingerprints</span><div style="font-weight:700;">${formatNumber(s.replay.totalFingerprints)}</div></div>
          </div>
        </div>

        <!-- Audit chain details -->
        <div class="card" style="padding:var(--space-5) var(--space-6);margin-bottom:var(--space-4);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
            <div style="font-size:var(--font-size-sm);font-weight:700;">Audit Log Integrity</div>
            <span style="font-size:var(--font-size-xs);font-weight:600;color:${chainColor};">${chainStatus}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--space-3);">
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Total Entries</span><div style="font-weight:700;">${formatNumber(s.audit.totalEntries)}</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Verified</span><div style="font-weight:700;">${formatNumber(s.audit.verifiedEntries)}</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Broken Links</span><div style="font-weight:700;color:${s.audit.brokenLinks > 0 ? 'var(--danger)' : 'inherit'};">${formatNumber(s.audit.brokenLinks)}</div></div>
            <div><span class="text-muted" style="font-size:var(--font-size-xs);">Quarantined</span><div style="font-weight:700;color:${s.audit.quarantinedCount > 0 ? 'var(--warning)' : 'inherit'};">${formatNumber(s.audit.quarantinedCount)}</div></div>
          </div>
        </div>
      </div>`;
    }
    async loadTelemetry() {
        if (this.telemetryLoading) return;
        this.telemetryLoading = true;
        this.telemetryError = null;
        try {
            const { authService } = await import('../services/authService.js?v=20260722bridgefix1');
            const raw = await fetchSecurityTelemetry(authService.getAuthHeaders());
            this.telemetry = buildTelemetrySummary(raw);
        } catch (err) {
            this.telemetryError = err.message;
        } finally {
            this.telemetryLoading = false;
        }
        if (this._container) this.app.render(this._container);
    }
    renderKeyManagementSection() {
        if (!this.app.isCurrentUserAdmin || !this.app.isCurrentUserAdmin()) return '';
        if (this.keyStatusLoading) {
            return `
        <div class="section-block">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0 0 var(--space-4);">Master Key Rotation & Migration</h2>
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <span class="loading-spinner" style="width:24px;height:24px;margin:0 auto var(--space-3);"></span>
            <p class="text-muted" style="font-size:var(--font-size-sm);">Loading key status…</p>
          </div>
        </div>`;
        }
        if (this.keyStatusError && !this.keyStatus) {
            return `
        <div class="section-block">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0 0 var(--space-4);">Master Key Rotation & Migration</h2>
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <p style="color:var(--danger);font-size:var(--font-size-sm);margin-bottom:var(--space-3);">${escapeHtml(this.keyStatusError)}</p>
            <button class="btn btn-secondary btn-sm" id="key-status-retry" type="button">Retry</button>
          </div>
        </div>`;
        }
        const s = this.keyStatus ? this.keyStatus.status : null;
        const reKey = this.reKeyStats ? this.reKeyStats.stats : null;
        const hasPrevious = s && s.hasPrevious;
        const graceText = hasPrevious ? formatGraceCountdown(s.rotatedAt, s.graceMs) : '—';
        const graceColor = hasPrevious && s.graceExpired ? 'var(--danger)' : (hasPrevious ? 'var(--warning)' : 'var(--text-muted)');
        const activeFp = s && s.activeFingerprint ? s.activeFingerprint : '—';
        const prevFp = s && s.previousFingerprint ? s.previousFingerprint : '—';
        const rotatedDate = s && s.rotatedAt ? new Date(s.rotatedAt).toLocaleString() : '—';
        return `
      <div class="section-block">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0;">Master Key Rotation & Migration</h2>
          <button class="btn btn-ghost btn-sm" id="key-status-refresh" type="button">↻ Refresh</button>
        </div>

        <!-- Keyring status cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-4);margin-bottom:var(--space-6);">
          <div class="card" style="padding:var(--space-5);">
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-bottom:var(--space-1);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Active Key Fingerprint</div>
            <div style="font-family:monospace;font-size:var(--font-size-sm);font-weight:700;color:var(--success);">${escapeHtml(activeFp)}</div>
          </div>
          <div class="card" style="padding:var(--space-5);">
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-bottom:var(--space-1);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Previous Key Fingerprint</div>
            <div style="font-family:monospace;font-size:var(--font-size-sm);font-weight:700;color:${hasPrevious ? 'var(--warning)' : 'var(--text-muted)'};">${escapeHtml(prevFp)}</div>
          </div>
          <div class="card" style="padding:var(--space-5);">
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-bottom:var(--space-1);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Grace Window</div>
            <div style="font-size:var(--font-size-sm);font-weight:700;color:${graceColor};">${escapeHtml(graceText)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1);">Rotated: ${escapeHtml(rotatedDate)}</div>
          </div>
        </div>

        <!-- Rotation form -->
        <div class="card" style="padding:var(--space-5) var(--space-6);margin-bottom:var(--space-6);">
          <div style="font-size:var(--font-size-sm);font-weight:700;margin-bottom:var(--space-3);">Trigger New Key Rotation</div>
          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:flex-end;">
            <div style="flex:1;min-width:280px;">
              <label style="font-size:var(--font-size-xs);color:var(--text-muted);display:block;margin-bottom:var(--space-1);">New Master Key (min 32 characters)</label>
              <input type="password" id="key-rotation-input" placeholder="Paste 32+ char secret or generate…" style="width:100%;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);border:1px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:var(--font-size-sm);font-family:monospace;" autocomplete="off" />
            </div>
            <button class="btn btn-secondary btn-sm" id="key-generate-btn" type="button">🎲 Generate</button>
            <button class="btn btn-primary btn-sm" id="key-rotate-btn" type="button" ${this.rotating ? 'disabled' : ''}>
              ${this.rotating ? '⟳ Rotating…' : '▶ Rotate Key'}
            </button>
          </div>
          <p style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-3);">⚠️ Rotation starts a grace window. Historical data is re-keyed automatically by the background worker.</p>
        </div>

        <!-- Re-keying migration stats -->
        <div class="card" style="padding:var(--space-5) var(--space-6);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
            <div style="font-size:var(--font-size-sm);font-weight:700;">Background Re-Keying Migration</div>
            <button class="btn btn-primary btn-sm" id="rekey-now-btn" type="button" ${this.rekeying ? 'disabled' : ''}>
              ${this.rekeying ? '⟳ Sweeping…' : '⚡ Force Re-Key Sweep'}
            </button>
          </div>
          ${reKey ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--space-3);">
              <div style="text-align:center;padding:var(--space-3);background:var(--surface-hover);border-radius:var(--radius-md);">
                <div style="font-size:var(--font-size-xl);font-weight:700;">${formatNumber(reKey.totalSweeps || 0)}</div>
                <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Total Sweeps</div>
              </div>
              <div style="text-align:center;padding:var(--space-3);background:var(--surface-hover);border-radius:var(--radius-md);">
                <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--success);">${formatNumber(reKey.totalMigrated || 0)}</div>
                <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Migrated</div>
              </div>
              <div style="text-align:center;padding:var(--space-3);background:var(--surface-hover);border-radius:var(--radius-md);">
                <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--text-muted);">${formatNumber(reKey.totalSkipped || 0)}</div>
                <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Skipped</div>
              </div>
              <div style="text-align:center;padding:var(--space-3);background:var(--surface-hover);border-radius:var(--radius-md);">
                <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--danger);">${formatNumber(reKey.totalFailed || 0)}</div>
                <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Failed</div>
              </div>
              <div style="text-align:center;padding:var(--space-3);background:var(--surface-hover);border-radius:var(--radius-md);">
                <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--warning);">${formatNumber(reKey.totalPurged || 0)}</div>
                <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Keys Purged</div>
              </div>
            </div>
          ` : `
            <p style="font-size:var(--font-size-sm);color:var(--text-muted);text-align:center;padding:var(--space-4);">No migration stats available yet. Click "Force Re-Key Sweep" to run a manual migration.</p>
          `}
        </div>
      </div>`;
    }
    async loadKeyStatus() {
        this.keyStatusLoading = true;
        this.keyStatusError = null;
        if (this._container) this.app.render(this._container);
        try {
            const authHeaders = this.app.authService ? this.app.authService.getAuthHeaders() : {};
            this.keyStatus = await fetchKeyStatus(authHeaders);
            // Also load re-key stats
            try {
                this.reKeyStats = await fetchReKeyStats(authHeaders);
            } catch (_a) {
                this.reKeyStats = null;
            }
        } catch (err) {
            this.keyStatusError = err.message;
        } finally {
            this.keyStatusLoading = false;
        }
        if (this._container) this.app.render(this._container);
    }
    async handleKeyRotation() {
        const input = document.getElementById('key-rotation-input');
        if (!input || !input.value) {
            showToast('Enter a new master key (min 32 characters)', 'error');
            return;
        }
        if (input.value.length < 32) {
            showToast('Key must be at least 32 characters', 'error');
            return;
        }
        this.rotating = true;
        if (this._container) this.app.render(this._container);
        try {
            const authHeaders = this.app.authService ? this.app.authService.getAuthHeaders() : {};
            await triggerKeyRotation(input.value, undefined, authHeaders);
            // Clear the input immediately — don't leave the raw key in the DOM
            input.value = '';
            showToast('Master key rotation initialized successfully', 'success');
            await this.loadKeyStatus();
        } catch (err) {
            showToast('Key rotation failed: ' + err.message, 'error');
        } finally {
            this.rotating = false;
            if (this._container) this.app.render(this._container);
        }
    }
    async handleForceReKey() {
        this.rekeying = true;
        if (this._container) this.app.render(this._container);
        try {
            const authHeaders = this.app.authService ? this.app.authService.getAuthHeaders() : {};
            const result = await forceReKeySweep(authHeaders);
            const r = result.result || {};
            showToast(`Re-key sweep complete: ${r.migrated || 0} migrated, ${r.failed || 0} failed`, r.failed > 0 ? 'error' : 'success');
            await this.loadKeyStatus();
        } catch (err) {
            showToast('Re-key sweep failed: ' + err.message, 'error');
        } finally {
            this.rekeying = false;
            if (this._container) this.app.render(this._container);
        }
    }
    handleGenerateKey() {
        const input = document.getElementById('key-rotation-input');
        if (input) {
            input.value = generateRandomKey();
            showToast('Random 256-bit key generated', 'info');
        }
    }
    renderQuarantineInspector() {
        if (!this.app.isCurrentUserAdmin || !this.app.isCurrentUserAdmin()) return '';
        if (this.quarantineLoading) {
            return `
        <div class="section-block">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0 0 var(--space-4);">Quarantine Evidence Inspector</h2>
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <span class="loading-spinner" style="width:24px;height:24px;margin:0 auto var(--space-3);"></span>
            <p class="text-muted" style="font-size:var(--font-size-sm);">Loading quarantine entries…</p>
          </div>
        </div>`;
        }
        if (this.quarantineError && !this.quarantine) {
            return `
        <div class="section-block">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0 0 var(--space-4);">Quarantine Evidence Inspector</h2>
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <p style="color:var(--danger);font-size:var(--font-size-sm);margin-bottom:var(--space-3);">${escapeHtml(this.quarantineError)}</p>
            <button class="btn btn-secondary btn-sm" id="quarantine-retry" type="button">Retry</button>
          </div>
        </div>`;
        }
        const entries = this.quarantine ? (this.quarantine.entries || []) : [];
        const metadata = this.quarantine ? (this.quarantine.metadata || {}) : {};
        const total = this.quarantine ? (this.quarantine.totalEntries || 0) : 0;
        const decryptionError = metadata.decryptionError === true;
        const allOrgsChecked = this.quarantineAllOrgs ? 'checked' : '';
        return `
      <div class="section-block">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0;">Quarantine Evidence Inspector</h2>
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <label style="font-size:var(--font-size-xs);color:var(--text-muted);display:flex;align-items:center;gap:var(--space-2);cursor:pointer;">
              <input type="checkbox" id="quarantine-all-orgs" ${allOrgsChecked} style="cursor:pointer;" />
              All orgs
            </label>
            <button class="btn btn-ghost btn-sm" id="quarantine-refresh" type="button">↻ Refresh</button>
          </div>
        </div>
        ${decryptionError ? `
          <div class="card" style="padding:var(--space-4) var(--space-5);margin-bottom:var(--space-4);border-left:3px solid var(--danger);background:var(--danger-bg);">
            <span style="font-size:var(--font-size-sm);color:var(--danger);">⚠️ Quarantine file could not be decrypted with the current keyring. This may indicate a key rotation is in progress or the data was encrypted with a retired key.</span>
          </div>
        ` : ''}
        ${entries.length === 0 ? `
          <div class="card" style="padding:var(--space-6);text-align:center;">
            <div style="font-size:2rem;margin-bottom:var(--space-2);">📋</div>
            <p style="font-size:var(--font-size-sm);color:var(--text-muted);">No quarantined entries${this.quarantineAllOrgs ? ' across all orgs' : ''}.</p>
            <p style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-2);">Tampered or broken-chain audit entries will appear here after auto-healing runs.</p>
          </div>
        ` : `
          <div class="card" style="padding:0;overflow:hidden;border-radius:var(--radius-lg);">
            <div class="table-scroll-wrapper">
            <table class="results-table">
              <thead>
                <tr>
                  <th scope="col" style="width:40px"></th>
                  <th scope="col" style="width:180px">Entry ID</th>
                  <th scope="col" style="width:120px">Org</th>
                  <th scope="col" style="width:130px">Action</th>
                  <th scope="col" style="width:160px">Timestamp</th>
                  <th scope="col" style="width:140px">Reason</th>
                  <th scope="col" style="width:120px">Verify</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map((entry) => this._renderQuarantineRow(entry)).join('')}
              </tbody>
            </table>
            </div>
          </div>
        `}
      </div>`;
    }
    _renderQuarantineRow(entry) {
        const id = escapeHtml(entry.id || '—');
        const orgId = escapeHtml(entry.orgId || '—');
        const action = escapeHtml(entry.action || '—');
        const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—';
        const reason = entry.quarantineReason || '—';
        const reasonLabel = reason === 'content_tampered' ? 'Tampered' : reason === 'broken_link' ? 'Broken Link' : escapeHtml(reason);
        const isExpanded = this.quarantineExpanded.has(entry.id);
        const verifyResult = this.quarantineVerifyResults[entry.id];
        const isVerifying = this.quarantineVerifying.has(entry.id);
        const rowColor = verifyResult ? (verifyResult.hashMatches ? 'var(--success-bg)' : 'var(--danger-bg)') : '';
        let verifyCell = '';
        if (isVerifying) {
            verifyCell = '<span class="loading-spinner" style="width:14px;height:14px;"></span>';
        } else if (verifyResult) {
            verifyCell = verifyResult.hashMatches
                ? '<span style="color:var(--success);font-size:var(--font-size-sm);font-weight:600;">✅ Hash Match</span>'
                : '<span style="color:var(--danger);font-size:var(--font-size-sm);font-weight:600;">❌ Hash Mismatch</span>';
        } else {
            verifyCell = `<button class="btn btn-secondary btn-sm" id="quarantine-verify-${escapeHtml(entry.id)}" type="button" style="font-size:var(--font-size-xs);">Verify</button>`;
        }
        const detailJson = JSON.stringify(entry, null, 2);
        return `
          <tr style="background:${rowColor};" id="quarantine-row-${id}">
            <td style="text-align:center;cursor:pointer;" id="quarantine-toggle-${escapeHtml(entry.id)}">${isExpanded ? '▼' : '▶'}</td>
            <td><code style="font-size:var(--font-size-xs);color:var(--text-secondary);">${id}</code></td>
            <td><span style="font-size:var(--font-size-xs);font-weight:600;color:var(--text-secondary);">${orgId}</span></td>
            <td><span style="font-size:var(--font-size-xs);font-weight:600;">${action}</span></td>
            <td style="font-size:var(--font-size-xs);color:var(--text-muted);">${escapeHtml(timestamp)}</td>
            <td><span style="font-size:var(--font-size-xs);color:${reason === 'content_tampered' ? 'var(--danger)' : 'var(--warning)'};font-weight:600;">${reasonLabel}</span></td>
            <td>${verifyCell}</td>
          </tr>
          ${isExpanded ? `
            <tr>
              <td colspan="7" style="padding:0;border-top:none;">
                <div style="padding:var(--space-4) var(--space-5);background:var(--surface-hover);">
                  <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--text-muted);margin-bottom:var(--space-2);text-transform:uppercase;letter-spacing:0.05em;">Raw Entry Payload</div>
                  <pre style="margin:0;padding:var(--space-3);background:var(--surface);border-radius:var(--radius-md);font-size:var(--font-size-xs);overflow-x:auto;white-space:pre-wrap;word-break:break-all;max-height:400px;overflow-y:auto;">${escapeHtml(detailJson)}</pre>
                  ${verifyResult ? `
                    <div style="margin-top:var(--space-3);padding:var(--space-3);background:${verifyResult.hashMatches ? 'var(--success-bg)' : 'var(--danger-bg)'};border-radius:var(--radius-md);font-size:var(--font-size-xs);">
                      <div style="font-weight:700;color:${verifyResult.hashMatches ? 'var(--success)' : 'var(--danger)'};margin-bottom:var(--space-1);">Cryptographic Verification Result</div>
                      <div style="color:var(--text-muted);">Expected: <code style="color:var(--text-primary);">${escapeHtml(verifyResult.expectedHash)}</code></div>
                      <div style="color:var(--text-muted);">Actual: <code style="color:var(--text-primary);">${escapeHtml(verifyResult.actualHash)}</code></div>
                      <div style="color:var(--text-muted);margin-top:var(--space-1);">Decryption: ${escapeHtml(verifyResult.decryptionStatus || '—')}</div>
                    </div>
                  ` : ''}
                </div>
              </td>
            </tr>
          ` : ''}`;
    }
    async loadQuarantine() {
        this.quarantineLoading = true;
        this.quarantineError = null;
        if (this._container) this.app.render(this._container);
        try {
            const authHeaders = this.app.authService ? this.app.authService.getAuthHeaders() : {};
            this.quarantine = await fetchQuarantineEntries(this.quarantineAllOrgs, authHeaders);
        } catch (err) {
            this.quarantineError = err.message;
        } finally {
            this.quarantineLoading = false;
        }
        if (this._container) this.app.render(this._container);
    }
    toggleQuarantineEntry(entryId) {
        if (this.quarantineExpanded.has(entryId)) {
            this.quarantineExpanded.delete(entryId);
        } else {
            this.quarantineExpanded.add(entryId);
        }
        if (this._container) this.app.render(this._container);
    }
    async handleVerifyEntry(entryId) {
        this.quarantineVerifying.add(entryId);
        if (this._container) this.app.render(this._container);
        try {
            const authHeaders = this.app.authService ? this.app.authService.getAuthHeaders() : {};
            const result = await verifyQuarantineEntry(entryId, undefined, authHeaders);
            this.quarantineVerifyResults[entryId] = result;
            // Auto-expand the row to show the verification details
            this.quarantineExpanded.add(entryId);
            showToast(result.hashMatches ? 'Entry hash verified — match' : 'Entry hash mismatch detected', result.hashMatches ? 'success' : 'error');
        } catch (err) {
            showToast('Verification failed: ' + err.message, 'error');
        } finally {
            this.quarantineVerifying.delete(entryId);
            if (this._container) this.app.render(this._container);
        }
    }
    render() {
        var _a, _b, _c, _d, _e, _f;
        const el = document.createElement('div');
        el.className = 'fade-in';
        if (this.loading && !this.getReport()) {
            el.innerHTML = `
        <div style="padding:var(--space-10) var(--space-6);text-align:center;">
          <div style="width:56px;height:56px;margin:0 auto var(--space-4);border-radius:var(--radius-lg);background:var(--primary-subtle);display:flex;align-items:center;justify-content:center;font-size:1.75rem;">🛡️</div>
          <h1 class="page-title" style="margin-bottom:var(--space-2);">Security Scanner</h1>
          <p class="text-muted" style="margin-bottom:var(--space-6);">Loading security findings…</p>
          <div class="loading-spinner" style="width:32px;height:32px;margin:0 auto;"></div>
        </div>`;
            return el;
        }
        if (this.error && !this.getReport()) {
            el.innerHTML = `
        <div style="padding:var(--space-10) var(--space-6);text-align:center;">
          <div style="width:56px;height:56px;margin:0 auto var(--space-4);border-radius:var(--radius-lg);background:var(--danger-bg);display:flex;align-items:center;justify-content:center;font-size:1.75rem;">⚠️</div>
          <h1 class="page-title" style="margin-bottom:var(--space-2);">Security Scanner</h1>
          <p class="text-muted" style="margin-bottom:var(--space-6);">${escapeHtml(this.error)}</p>
          <button class="btn btn-primary" id="security-retry" type="button">Retry</button>
        </div>`;
            (_a = el.querySelector('#security-retry')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => this.loadReport(this._container));
            return el;
        }
        const _report = this.getReport();
        const findings = this.getFindings();
        const summary = this.getSummary();
        const gateLabel = summary.gatePass ? 'PASS' : summary.gatePass === false ? 'REVIEW' : '—';
        const gateColor = summary.gatePass ? 'var(--success)' : 'var(--danger)';
        const gateBg = summary.gatePass ? 'var(--success-bg)' : 'var(--danger-bg)';
        const gateIcon = summary.gatePass ? '✅' : summary.gatePass === false ? '⚠️' : '❓';
        const lastScan = summary.generatedAt
            ? new Date(summary.generatedAt).toLocaleString()
            : 'Never';
        const complianceScore = (_c = (_b = this.compliance) === null || _b === void 0 ? void 0 : _b.securityScore) !== null && _c !== void 0 ? _c : null;
        const totalScanned = (summary.credentialScanned || 0) + (summary.productionLeakScanned || 0);
        el.innerHTML = `
      <!-- Hero -->
      <div style="margin-bottom:var(--space-8);">
        <div style="display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-2);">
          <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:var(--primary-subtle);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">🛡️</div>
          <div>
            <h1 class="page-title" style="margin:0;">Security Scanner</h1>
            <p class="text-muted" style="margin:var(--space-1) 0 0;font-size:var(--font-size-sm);">Credential patterns, production leaks, and secret detection</p>
          </div>
        </div>
      </div>

      <!-- Action bar -->
      <div class="card" style="padding:var(--space-4) var(--space-5);margin-bottom:var(--space-6);display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="width:8px;height:8px;border-radius:50%;background:${gateColor};flex-shrink:0;"></div>
          <span class="text-muted" style="font-size:var(--font-size-sm);">Last scan: <strong style="color:var(--text-primary);font-weight:600;">${escapeHtml(lastScan)}</strong></span>
        </div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="security-run-scan" type="button" ${this.scanning ? 'disabled' : ''}>
            ${this.scanning ? '⟳ Scanning…' : '▶ Run security scan'}
          </button>
          <button class="btn btn-secondary btn-sm" id="security-export-json" type="button">
            ⬇ Export JSON
          </button>
          ${this.app.isCurrentUserAdmin() ? '<button class="btn btn-ghost btn-sm" id="security-send-ai-btn" type="button" title="Send security findings to AI coding agent">🤖 Send to AI</button>' : ''}
        </div>
      </div>

      ${this.scanning ? `
        <div class="card" style="padding:var(--space-4) var(--space-5);margin-bottom:var(--space-6);display:flex;align-items:center;gap:var(--space-3);border-left:3px solid var(--primary);">
          <span class="loading-spinner" style="width:16px;height:16px;flex-shrink:0;"></span>
          <span style="font-size:var(--font-size-sm);color:var(--text-secondary);">Running Simplebeacon scan — credential + production-leak rules…</span>
        </div>
      ` : ''}

      <!-- Gate status banner -->
      <div class="card" style="padding:var(--space-5) var(--space-6);margin-bottom:var(--space-6);background:${gateBg};border:1px solid ${gateColor}33;display:flex;align-items:center;gap:var(--space-5);flex-wrap:wrap;">
        <div style="width:52px;height:52px;border-radius:var(--radius-md);background:${gateColor}20;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">${gateIcon}</div>
        <div style="flex:1;min-width:180px;">
          <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-bottom:var(--space-1);text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Gate Status</div>
          <div style="font-size:var(--font-size-2xl);font-weight:800;color:${gateColor};line-height:1;">${gateLabel}</div>
        </div>
        <div style="display:flex;gap:var(--space-6);flex-wrap:wrap;">
          <div style="text-align:center;">
            <div style="font-size:var(--font-size-xl);font-weight:700;">${formatNumber(totalScanned)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Files Checked</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${summary.totalFindings > 0 ? 'var(--danger)' : 'var(--success)'};">${formatNumber(summary.totalFindings)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Findings</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:var(--font-size-xl);font-weight:700;">${complianceScore !== null && complianceScore !== void 0 ? complianceScore : '—'}<span style="font-size:var(--font-size-sm);color:var(--text-muted);font-weight:400;">/100</span></div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Compliance</div>
          </div>
        </div>
      </div>

      <!-- Stat cards row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-4);margin-bottom:var(--space-6);">
        ${statCard('🔑', 'Credentials Scanned', formatNumber(summary.credentialScanned || 0), 'rgba(99,102,241,0.12)')}
        ${statCard('🏭', 'Production Leaks Scanned', formatNumber(summary.productionLeakScanned || 0), 'rgba(245,158,11,0.12)')}
        ${statCard('🔍', 'Credential Findings', formatNumber(summary.credentialFindings || 0), 'rgba(239,68,68,0.12)')}
        ${statCard('🚧', 'Production Leak Findings', formatNumber(summary.productionLeakFindings || 0), 'rgba(239,68,68,0.12)')}
      </div>

      <!-- Severity breakdown -->
      <div class="card" style="padding:var(--space-5) var(--space-6);margin-bottom:var(--space-6);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
          <div style="font-size:var(--font-size-sm);font-weight:700;color:var(--text-primary);">Findings by Severity</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-muted);">${formatNumber(summary.totalFindings)} total</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3);">
          ${severityBar('Critical', summary.severityCounts.critical, summary.totalFindings, SEVERITY_COLORS.critical)}
          ${severityBar('High', summary.severityCounts.high, summary.totalFindings, SEVERITY_COLORS.high)}
          ${severityBar('Medium', summary.severityCounts.medium, summary.totalFindings, SEVERITY_COLORS.medium)}
          ${severityBar('Low', summary.severityCounts.low, summary.totalFindings, SEVERITY_COLORS.low)}
        </div>
      </div>

      <!-- Findings table -->
      <div class="section-block">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
          <h2 style="font-size:var(--font-size-lg);font-weight:700;margin:0;">Findings</h2>
          <span style="font-size:var(--font-size-sm);color:var(--text-muted);padding:var(--space-1) var(--space-3);background:var(--surface-hover);border-radius:var(--radius-full);font-weight:600;">${findings.length}</span>
        </div>
        ${this.renderFindingsTable(findings)}
      </div>

      ${this.renderTelemetrySection()}

      ${this.renderKeyManagementSection()}

      ${this.renderQuarantineInspector()}
    `;
        (_d = el.querySelector('#security-run-scan')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => this.runScan(this._container));
        (_e = el.querySelector('#security-export-json')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => this.exportResults());
        // Telemetry button listeners
        const _tlLoad = el.querySelector('#telemetry-load');
        const _tlRefresh = el.querySelector('#telemetry-refresh');
        const _tlRetry = el.querySelector('#telemetry-retry');
        if (_tlLoad) _tlLoad.addEventListener('click', () => this.loadTelemetry());
        if (_tlRefresh) _tlRefresh.addEventListener('click', () => this.loadTelemetry());
        if (_tlRetry) _tlRetry.addEventListener('click', () => this.loadTelemetry());
        (_f = el.querySelector('#security-send-ai-btn')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', async () => {
            var _a, _b;
            const report = this.getReport();
            const findings = this.getFindings();
            if (!findings.length) {
                showToast('No security findings to send', 'error');
                return;
            }
            const summary = this.getSummary();
            const payload = {
                projectPath: (report === null || report === void 0 ? void 0 : report.projectRoot) || (report === null || report === void 0 ? void 0 : report.projectPath) || window.location.origin,
                reportType: 'security-scan',
                reportSummary: {
                    totalFindings: summary.totalFindings,
                    credentialCount: summary.credentialCount,
                    productionLeakCount: summary.productionLeakCount,
                    complianceScore: (_b = (_a = this.compliance) === null || _a === void 0 ? void 0 : _a.securityScore) !== null && _b !== void 0 ? _b : 'N/A'
                },
                notes: 'Security Scanner findings — credential patterns and production leaks'
            };
            const vscode = getVsCodeApi();
            if (vscode) {
                try {
                    vscode.postMessage({ command: 'sendToAI', data: payload });
                    showToast('Security findings sent to AI agent', 'success');
                    return;
                }
                catch (err) {
                    window["console"]["warn"]('[Security-AI] vscode.postMessage failed:', err);
                } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
            }
            try {
                const res = await fetch('/api/ai-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const json = await res.json();
                if (json.success && json.content) {
                    await navigator.clipboard.writeText(json.content);
                    showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success');
                }
                else {
                    showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success');
                }
            }
            catch (err) {
                showToast('Failed to send: ' + err.message, 'error');
            }
        });
        // Key management button listeners
        const _kmRefresh = el.querySelector('#key-status-refresh');
        const _kmRetry = el.querySelector('#key-status-retry');
        const _kmRotate = el.querySelector('#key-rotate-btn');
        const _kmGenerate = el.querySelector('#key-generate-btn');
        const _kmRekeyNow = el.querySelector('#rekey-now-btn');
        if (_kmRefresh) _kmRefresh.addEventListener('click', () => this.loadKeyStatus());
        if (_kmRetry) _kmRetry.addEventListener('click', () => this.loadKeyStatus());
        if (_kmRotate) _kmRotate.addEventListener('click', () => this.handleKeyRotation());
        if (_kmGenerate) _kmGenerate.addEventListener('click', () => this.handleGenerateKey());
        if (_kmRekeyNow) _kmRekeyNow.addEventListener('click', () => this.handleForceReKey());
        // Quarantine inspector button listeners
        const _qRefresh = el.querySelector('#quarantine-refresh');
        const _qRetry = el.querySelector('#quarantine-retry');
        const _qAllOrgs = el.querySelector('#quarantine-all-orgs');
        if (_qRefresh) _qRefresh.addEventListener('click', () => this.loadQuarantine());
        if (_qRetry) _qRetry.addEventListener('click', () => this.loadQuarantine());
        if (_qAllOrgs) _qAllOrgs.addEventListener('change', (e) => {
            this.quarantineAllOrgs = e.target.checked;
            this.loadQuarantine();
        });
        // Wire up per-entry toggle and verify buttons
        if (this.quarantine && this.quarantine.entries) {
            for (const entry of this.quarantine.entries) {
                const toggleBtn = el.querySelector(`#quarantine-toggle-${CSS.escape(entry.id)}`);
                if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleQuarantineEntry(entry.id));
                const verifyBtn = el.querySelector(`#quarantine-verify-${CSS.escape(entry.id)}`);
                if (verifyBtn) verifyBtn.addEventListener('click', () => this.handleVerifyEntry(entry.id));
            }
        }
        return el;
    }
    exportResults() {
        const report = this.getReport();
        const findings = this.getFindings();
        if (!findings.length) {
            showToast('No security findings to export', 'info');
            return;
        }
        const payload = buildSecurityExportPayload(report, findings, this.compliance);
        downloadJson(payload, `security-scan-${new Date().toISOString().slice(0, 10)}.json`);
        showToast('Security scan JSON downloaded', 'success');
    }
    paint(container = this._container) {
        if (!container)
            return;
        this._container = container;
        window.setSafeHTML(container, '');
        container.appendChild(this.render());
    }
    async runScan(container) {
        if (this.scanning)
            return;
        this.scanning = true;
        this.error = null;
        this.paint(container);
        try {
            await this.app.runScan();
            showToast('Security scan complete', 'success');
        }
        catch (err) {
            this.error = err.message;
            showToast(err.message, 'error');
        }
        finally {
            this.scanning = false;
            this.loading = false;
            this.paint(container);
        }
    }
    async loadReport(container) {
        this._container = container;
        this.loading = true;
        this.error = null;
        this.paint(container);
        try {
            if (!this.getReport()) {
                await this.app.scanService.fetchReport();
                this.app.state.report = this.app.scanService.report;
            }
        }
        catch (err) {
            this.error = err.message;
        }
        finally {
            this.loading = false;
            this.paint(container);
        }
    }
    async loadCompliance() {
        try {
            this.compliance = await fetchComplianceHeadline();
        }
        catch (_a) {
            this.compliance = null;
        }
        if (this._container && this.app.currentView === this) {
            this.paint(this._container);
        }
    }
    mount(container) {
        this._container = container;
        if (this.getReport()) {
            this.loading = false;
            this.paint(container);
            void this.loadCompliance();
            if (this.app.isCurrentUserAdmin && this.app.isCurrentUserAdmin()) {
                void this.loadKeyStatus();
                void this.loadQuarantine();
            }
            return;
        }
        void this.loadReport(container);
        void this.loadCompliance();
        if (this.app.isCurrentUserAdmin && this.app.isCurrentUserAdmin()) {
            void this.loadKeyStatus();
            void this.loadQuarantine();
        }
    }
}
