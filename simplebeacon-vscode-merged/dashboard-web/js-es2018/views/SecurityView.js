import { escapeHtml } from '../utils/string.js';
import { showToast, downloadJson, renderEmptyState } from '../utils/dom.js';
import { redactPathForDisplay } from '../utils/format.js';
import { formatNumber } from '../utils/number.js';
import { apiUrl } from '../utils/url.js';
import { extractSecurityFindings, buildSecuritySummary, buildSecurityExportPayload, fetchComplianceHeadline } from '../services/securityService.js';
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
        this._container = null;
    }
    _getVscodeApi() {
        if (this._vscodeApiCached)
            return this._vscodeApiCached;
        if (typeof window === 'undefined' || typeof window.acquireVsCodeApi !== 'function')
            return null;
        try {
            this._vscodeApiCached = window.acquireVsCodeApi();
            return this._vscodeApiCached;
        }
        catch (_a) {
            return null;
        }
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
    _escapeHtml(text) {
        return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    maskSensitiveData(rawText) {
        if (!rawText)
            return '';
        const patterns = [
            { regex: /(amzn\.sk\.[a-zA-Z0-9-_]{0,8})([a-zA-Z0-9-_]+)/gi, name: 'AWS session key' },
            { regex: /(AKIA[0-9A-Z]{0,12})([0-9A-Z]+)/g, name: 'AWS access key' },
            { regex: /(sk-or-v1-[a-zA-Z0-9-_]{0,8})([a-zA-Z0-9-_]+)/g, name: 'OpenRouter key' },
            { regex: /(sk-[a-zA-Z0-9]{0,12})([a-zA-Z0-9]+)/g, name: 'OpenAI key' },
            { regex: /(ghp_[a-zA-Z0-9]{0,8})([a-zA-Z0-9]+)/g, name: 'GitHub token' },
            { regex: /(xoxb-[a-zA-Z0-9-]{0,12})([a-zA-Z0-9-]+)/g, name: 'Slack bot token' }
        ];
        let maskedText = this._escapeHtml(rawText);
        let matched = false;
        for (const { regex } of patterns) {
            maskedText = maskedText.replace(regex, (match, prefix, secretPart) => {
                matched = true;
                return `${this._escapeHtml(prefix)}<span class="secret-beads" aria-hidden="true">••••••••••••••••</span>`;
            });
        }
        if (!matched && rawText.length > 8) {
            const quarter = Math.floor(rawText.length / 4);
            const prefix = this._escapeHtml(rawText.substring(0, quarter));
            const suffix = this._escapeHtml(rawText.substring(rawText.length - quarter));
            return `${prefix}<span class="secret-beads" aria-hidden="true">••••••••••••••••</span>${suffix}`;
        }
        return maskedText;
    }
    getRotationPlaybook(type, file) {
        const playbooks = {
            'AWS Secret Key': {
                provider: 'Amazon Web Services',
                docsLink: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
                steps: [
                    'Open the AWS IAM console and locate the exposed identity or credentials profile.',
                    'Create a new access key pair to replace the compromised key.',
                    'Update your local environment variables or secret vault with the new key.',
                    'Deactivate and permanently delete the exposed legacy access key.',
                    'Verify downstream services are using the rotated credentials.'
                ],
                cliSnippet: 'aws iam update-access-key --access-key-id YOUR_KEY_ID --status Inactive\naws iam delete-access-key --access-key-id YOUR_KEY_ID'
            },
            'OpenAI API Key': {
                provider: 'OpenAI',
                docsLink: 'https://platform.openai.com/account/api-keys',
                steps: [
                    'Open the OpenAI Platform API keys dashboard.',
                    'Find the matching key and click Revoke Key.',
                    'Generate a fresh API key and store it in a secret vault.',
                    'Update your application environment variables and redeploy.'
                ],
                cliSnippet: '# Revoke and regenerate at https://platform.openai.com/account/api-keys'
            },
            'GitHub Token': {
                provider: 'GitHub',
                docsLink: 'https://github.com/settings/tokens',
                steps: [
                    'Open your GitHub account developer settings.',
                    'Locate the Personal Access Token matching the exposed prefix.',
                    'Click Revoke or Delete to immediately disable the token.',
                    'Generate a fresh fine-grained token with minimal repository permissions.'
                ],
                cliSnippet: 'curl -X DELETE -H "Authorization: token GITHUB_TOKEN" https://api.github.com/applications/Iv23lixxx/token'
            },
            'Slack Bot Token': {
                provider: 'Slack',
                docsLink: 'https://api.slack.com/apps',
                steps: [
                    'Open the Slack app management dashboard.',
                    'Select the app associated with the exposed bot token.',
                    'Navigate to OAuth & Permissions and revoke the token.',
                    'Reinstall the app to generate a new token and update your environment.'
                ],
                cliSnippet: '# Revoke at https://api.slack.com/apps > OAuth & Permissions'
            }
        };
        return playbooks[type] || {
            provider: 'Generic Credential Provider',
            docsLink: 'https://owasp.org/www-project-top-ten/',
            steps: [
                'Immediately invalidate or revoke this secret in its platform management console.',
                `Remove the raw plaintext secret from the source file at ${this._escapeHtml(file)}.`,
                'Externalize the secret using environment variables or a secure secret vault.',
                'Add the file path to .gitignore to prevent future accidental commits.'
            ],
            cliSnippet: '# Invalidate secret on host provider dashboard console'
        };
    }
    renderSecureReveal(rawText) {
        const masked = this.maskSensitiveData(rawText);
        const escaped = this._escapeHtml(rawText);
        return `
      <div class="secure-reveal-wrapper">
        <div class="secret-display-canvas">
          <span class="masked-view">${masked}</span>
          <span class="unmasked-view raw-code-text">${escaped}</span>
        </div>
        <button class="secret-toggle-visibility-btn" type="button" aria-label="Toggle secret visibility" title="Reveal credential text (over-the-shoulder privacy protected)">
          <span class="eye-icon-open"><i data-lucide="eye" class="icon-14"></i></span>
          <span class="eye-icon-closed"><i data-lucide="eye-off" class="icon-14"></i></span>
        </button>
      </div>
    `;
    }
    renderSeverityBand(label, count, className) {
        return `
      <div class="card insight-stat">
        <div class="insight-stat-value ${className}">${formatNumber(count)}</div>
        <div class="insight-stat-label">${escapeHtml(label)}</div>
      </div>
    `;
    }
    renderFindingsList(findings) {
        if (!findings.length) {
            return renderEmptyState({
                icon: '🛡️',
                title: 'No security findings',
                body: 'Credential and production-leak rules reported clean on the last scan.',
                iconWrapper: 'emoji'
            });
        }
        const severityTint = {
            critical: 'rgba(239,68,68,0.06)',
            high: 'rgba(249,115,22,0.04)',
            medium: 'rgba(234,179,8,0.03)',
            low: 'rgba(59,130,246,0.03)'
        };
        return `
      <div class="sec-v3-list">
        ${findings.map((finding, index) => {
            const playbook = this.getRotationPlaybook(finding.type, finding.file);
            return `
          <div class="sec-v3-row" data-severity="${escapeHtml(finding.severity)}" style="--row-tint:${severityTint[finding.severity] || 'transparent'};" data-index="${index}">
            <div class="sec-v3-row-main">
              <div class="sec-v3-col-sev">
                <span class="severity-pill ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
              </div>
              <div class="sec-v3-col-type">
                <span class="sec-v3-type">${escapeHtml(finding.type)}</span>
              </div>
              <div class="sec-v3-col-file">
                <code class="sec-v3-file">${escapeHtml(redactPathForDisplay(finding.file) || '—')}</code>
                ${finding.line ? `<span class="sec-v3-line">:${finding.line}</span>` : ''}
              </div>
              <div class="sec-v3-col-desc">
                ${this.renderSecureReveal(finding.description || '—')}
              </div>
              <div class="sec-v3-col-rec">
                ${this.renderSecureReveal(finding.recommendation || '—')}
              </div>
              <div class="sec-v3-col-actions">
                <button type="button" class="sec-v3-expand-btn" data-index="${index}" title="Show remediation playbook">📖</button>
              </div>
            </div>
            <div class="sec-v3-drawer" id="sec-drawer-${index}">
              <div class="sec-v3-drawer-inner">
                <div class="playbook-header">
                  <h4><span class="provider-badge">${escapeHtml(playbook.provider)}</span> Response Playbook</h4>
                  <a href="${escapeHtml(playbook.docsLink)}" target="_blank" rel="noopener noreferrer" class="playbook-docs-link">
                    Official Docs <i data-lucide="external-link" class="icon-12"></i>
                  </a>
                </div>
                <div class="playbook-body-grid">
                  <div class="playbook-steps-column">
                    <h5>Remediation Steps</h5>
                    <ol class="playbook-steps-list">
                      ${playbook.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
                    </ol>
                  </div>
                  <div class="playbook-actions-column">
                    <h5>Recovery CLI / Reference</h5>
                    <div class="code-terminal-box">
                      <pre><code>${escapeHtml(playbook.cliSnippet)}</code></pre>
                    </div>
                    <div class="drawer-action-footer">
                      <span class="remediation-status-tag pending">Status: Unresolved</span>
                    </div>
                  </div>
                </div>
                <div class="sec-v3-drawer-actions">
                  <button type="button" class="btn btn-primary btn-sm sec-v3-triage-btn" data-index="${index}">Mark Triaged</button>
                  <button type="button" class="btn btn-ghost btn-sm sec-v3-copy-btn" data-index="${index}">Copy Path</button>
                </div>
              </div>
            </div>
          </div>
        `;
        }).join('')}
      </div>
    `;
    }
    render() {
        var _a, _b, _c, _d, _e, _f;
        const el = document.createElement('div');
        el.className = 'fade-in security-redesign';
        if (this.loading && !this.getReport()) {
            el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Security Scanner</h1><p class="text-muted analyze-hero-sub">Loading security findings…</p></div>
        ${renderEmptyState({
                icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
                title: 'Loading scan report…',
                body: '<div class="loading-spinner" style="width:32px;height:32px;margin:0 auto var(--space-4)"></div>'
            })}
      `;
            return el;
        }
        if (this.error && !this.getReport()) {
            el.innerHTML = `
        <div class="analyze-hero"><h1 class="page-title">Security Scanner</h1><p class="text-muted analyze-hero-sub">Security scan unavailable</p></div>
        ${renderEmptyState({
                icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
                title: 'Security scan unavailable',
                body: escapeHtml(this.error),
                actions: [{ label: 'Retry', id: 'security-retry', className: 'btn-primary' }]
            })}
      `;
            (_a = el.querySelector('#security-retry')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => this.loadReport(this._container));
            return el;
        }
        const _report = this.getReport();
        const findings = this.getFindings();
        const summary = this.getSummary();
        const gateLabel = summary.gatePass ? 'PASS' : summary.gatePass === false ? 'REVIEW' : '—';
        const gateClass = summary.gatePass ? 'success' : 'danger';
        const lastScan = summary.generatedAt
            ? new Date(summary.generatedAt).toLocaleString()
            : 'Never';
        el.innerHTML = `
      <style>
        .security-redesign .security-hero { text-align: center; margin: var(--space-6) 0 var(--space-5); }
        .security-redesign .security-hero h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
        .security-redesign .security-hero p { color: var(--text-muted); font-size: 0.95rem; max-width: 560px; margin: 0 auto; }
        .security-redesign .security-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: var(--space-5); padding: var(--space-3); background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); }
        .security-redesign .security-meta { font-size: 0.8rem; color: var(--text-muted); }
        .security-redesign .security-scanning { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: var(--space-5); font-size: 0.85rem; color: var(--text-muted); }
        .security-redesign .security-summary { background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-4); margin-bottom: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
        .security-redesign .security-summary-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
        .security-redesign .security-gate { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg); font-size: var(--font-size-lg); font-weight: 800; background: var(--surface); border: 1px solid var(--border); }
        .security-redesign .security-gate.success { color: var(--success); border-color: rgba(5, 150, 105, 0.3); background: rgba(5, 150, 105, 0.08); }
        .security-redesign .security-gate.danger { color: var(--danger); border-color: rgba(220, 38, 38, 0.3); background: rgba(220, 38, 38, 0.08); }
        .security-redesign .security-metrics { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .security-redesign .security-metric { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); font-size: 0.8rem; color: var(--text-muted); }
        .security-redesign .security-metric strong { color: var(--text-primary); font-size: 0.95rem; }
        .security-redesign .security-severity-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--space-2); }
        .security-redesign .security-severity-stat { display: flex; flex-direction: column; align-items: center; padding: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); text-align: center; }
        .security-redesign .security-severity-stat.critical { border-top: 3px solid #dc2626; }
        .security-redesign .security-severity-stat.high { border-top: 3px solid var(--danger); }
        .security-redesign .security-severity-stat.medium { border-top: 3px solid var(--warning); }
        .security-redesign .security-severity-stat.low { border-top: 3px solid var(--info); }
        .security-redesign .ssv-count { font-size: var(--font-size-xl); font-weight: 800; color: var(--text-primary); }
        .security-redesign .ssv-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .security-redesign .security-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--border); }
        .security-redesign .security-bar-segment.critical { background: #dc2626; }
        .security-redesign .security-bar-segment.high { background: var(--danger); }
        .security-redesign .security-bar-segment.medium { background: var(--warning); }
        .security-redesign .security-bar-segment.low { background: var(--info); }
        .security-redesign .security-score { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); font-size: var(--font-size-sm); }
        .security-redesign .security-score strong { font-size: var(--font-size-lg); font-weight: 800; color: var(--text-primary); }
        .security-redesign .security-engine-row { display: flex; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-5); }
        .security-redesign .security-engine { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--surface-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); flex: 1; min-width: 220px; }
        .security-redesign .security-engine-icon { width: 40px; height: 40px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; background: rgba(99,102,241,0.1); }
        .security-redesign .security-engine-icon.leak { background: rgba(245,158,11,0.1); }

        /* Secure reveal / secret masking */
        .secure-reveal-wrapper { display: inline-flex; align-items: center; gap: 10px; background: var(--surface); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); max-width: 100%; min-width: 0; }
        .secret-display-canvas { position: relative; font-family: var(--font-mono); font-size: 0.85rem; overflow: hidden; min-width: 0; }
        .secure-reveal-wrapper .masked-view { display: inline-block; }
        .secure-reveal-wrapper .unmasked-view { display: none; color: #f87171; background: rgba(239,68,68,0.08); padding: 2px 4px; border-radius: 4px; }
        .secret-beads { color: rgba(239,68,68,0.8); letter-spacing: 2px; font-weight: 700; padding: 0 4px; }
        .secure-reveal-wrapper[data-revealed="true"] .masked-view { display: none; }
        .secure-reveal-wrapper[data-revealed="true"] .unmasked-view { display: inline-block; animation: quickFadeIn 0.15s ease-out; }
        .secret-toggle-visibility-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s, color 0.15s; }
        .secret-toggle-visibility-btn:hover { background: rgba(255,255,255,0.15); color: var(--text-primary); }
        .secure-reveal-wrapper[data-revealed="true"] .eye-icon-open { display: none; }
        .secure-reveal-wrapper[data-revealed="true"] .eye-icon-closed { display: inline-flex; }
        .secure-reveal-wrapper:not([data-revealed="true"]) .eye-icon-closed { display: none; }
        .secure-reveal-wrapper:not([data-revealed="true"]) .eye-icon-open { display: inline-flex; }
        @keyframes quickFadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }

        /* Rotation playbook drawer */
        .sec-v3-drawer.is-open { animation: slideDownDrawer 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .sec-v3-drawer.is-open .sec-v3-drawer-inner { padding: 16px; margin: 8px 12px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-elevated); }
        .playbook-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
        .playbook-header h4 { margin: 0; font-size: 1rem; }
        .provider-badge { background: rgba(59,130,246,0.15); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; margin-right: 6px; }
        .playbook-docs-link { font-size: 0.8rem; color: var(--text-muted); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
        .playbook-docs-link:hover { color: var(--text-primary); text-decoration: underline; }
        .playbook-body-grid { display: flex; gap: 20px; flex-wrap: wrap; }
        .playbook-steps-column { flex: 3; min-width: 240px; }
        .playbook-actions-column { flex: 2; min-width: 220px; display: flex; flex-direction: column; }
        .playbook-steps-list { margin: 0; padding-left: 20px; font-size: 0.85rem; line-height: 1.6; color: var(--text-secondary); }
        .playbook-steps-list li { margin-bottom: 8px; }
        .code-terminal-box { background: #000; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px; overflow-x: auto; font-family: var(--font-mono); font-size: 0.75rem; color: #34d399; margin-bottom: 12px; }
        .code-terminal-box pre { margin: 0; }
        .drawer-action-footer { display: flex; justify-content: flex-end; }
        .remediation-status-tag { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 4px 8px; border-radius: 12px; }
        .remediation-status-tag.pending { background: rgba(245,158,11,0.15); color: #fbbf24; }
        .remediation-status-tag.resolved { background: rgba(16,185,129,0.15); color: #4ade80; }
        @keyframes slideDownDrawer { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        /* v3 high-density findings feed */
        .sec-v3-list { display: flex; flex-direction: column; gap: 8px; }
        .sec-v3-row { background: linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.5)); border: 1px solid rgba(148,163,184,0.06); border-radius: 14px; overflow: hidden; transition: box-shadow 0.2s, transform 0.15s; position: relative; }
        [data-theme='light'] .sec-v3-row { background: linear-gradient(145deg, rgba(255,255,255,0.8), rgba(248,250,252,0.9)); border-color: rgba(148,163,184,0.1); }
        .sec-v3-row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--row-accent, transparent); opacity: 0.7; }
        .sec-v3-row[data-severity='critical'] { --row-accent: #ef4444; background: linear-gradient(145deg, rgba(239,68,68,0.08), rgba(30,41,59,0.6)); }
        .sec-v3-row[data-severity='high'] { --row-accent: #f97316; }
        .sec-v3-row[data-severity='medium'] { --row-accent: #eab308; }
        .sec-v3-row[data-severity='low'] { --row-accent: #3b82f6; }
        .sec-v3-row:hover { box-shadow: 0 4px 20px rgba(2,8,20,0.3); transform: translateY(-2px); }
        .sec-v3-row.is-triaged { opacity: 0.5; }
        .sec-v3-row.is-triaged .sec-v3-row-main::after { content: '✅ TRIAGED'; position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 0.68rem; font-weight: 700; color: #22c55e; background: rgba(34,197,94,0.1); padding: 3px 10px; border-radius: 6px; letter-spacing: 0.06em; }
        .sec-v3-row-main { display: grid; grid-template-columns: 90px 130px minmax(140px, 1fr) 1fr 1fr 44px; gap: 12px; align-items: center; padding: 12px 18px; position: relative; }
        @media (max-width: 960px) { .sec-v3-row-main { grid-template-columns: 90px 130px 1fr 44px; } .sec-v3-col-desc, .sec-v3-col-rec { display: none; } }
        @media (max-width: 560px) { .sec-v3-row-main { grid-template-columns: 80px 1fr 44px; } .sec-v3-col-type { display: none; } }
        .sec-v3-col-sev { display: flex; align-items: center; }
        .sec-v3-col-type .sec-v3-type { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; }
        .sec-v3-col-file { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .sec-v3-file { font-size: 0.78rem; background: rgba(148,163,184,0.08); padding: 2px 8px; border-radius: 6px; color: var(--text-primary); }
        .sec-v3-line { font-size: 0.68rem; color: var(--text-muted); }
        .sec-v3-col-desc, .sec-v3-col-rec { min-width: 0; overflow: hidden; }
        .sec-v3-col-actions { display: flex; justify-content: flex-end; }
        .sec-v3-expand-btn { background: rgba(148,163,184,0.06); border: 1px solid rgba(148,163,184,0.1); border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1rem; transition: all 0.15s; }
        .sec-v3-expand-btn:hover { background: rgba(148,163,184,0.12); transform: scale(1.05); }
        .sec-v3-expand-btn.is-open { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.25); }
        .sec-v3-drawer { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; }
        .sec-v3-drawer.is-open { max-height: 300px; }
        .sec-v3-drawer-inner { padding: 0 18px 16px; border-top: 1px solid rgba(148,163,184,0.06); }
        .sec-v3-drawer-inner h4 { margin: 14px 0 6px; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.06em; }
        .sec-v3-drawer-inner p { margin: 0 0 12px; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; }
        .sec-v3-drawer-actions { display: flex; gap: 8px; }
      </style>

      <div class="security-hero">
        <h1>Security Scanner</h1>
        <p>Credential patterns, production leaks, and secret detection.</p>
      </div>

      <div class="security-actions">
        <div class="security-meta">Last scan: ${escapeHtml(lastScan)}</div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" id="security-run-scan" type="button" ${this.scanning ? 'disabled' : ''}>
            ${this.scanning ? 'Scanning…' : 'Run security scan'}
          </button>
          <button class="btn btn-secondary btn-sm" id="security-export-json" type="button">Export JSON</button>
          <button class="btn btn-ghost btn-sm" id="security-send-ai-btn" type="button" title="Send security findings to AI coding agent">🤖 Send to AI</button>
        </div>
      </div>

      ${this.scanning ? `
        <div class="security-scanning">
          <span class="loading-spinner" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"></span>
          Running Simplebeacon scan (credential + production-leak rules)…
        </div>
      ` : ''}

      <div class="security-summary">
        <div class="security-summary-top">
          <div class="security-gate ${gateClass}">
            <i data-lucide="shield-check" class="icon-20"></i>
            <span>${gateLabel}</span>
          </div>
          <div class="security-metrics">
            <div class="security-metric"><strong>${formatNumber(summary.credentialScanned + summary.productionLeakScanned)}</strong> files checked</div>
            <div class="security-metric"><strong>${formatNumber(summary.totalFindings)}</strong> findings</div>
            <div class="security-metric"><strong>${(_c = (_b = this.compliance) === null || _b === void 0 ? void 0 : _b.securityScore) !== null && _c !== void 0 ? _c : '—'}</strong> compliance score</div>
          </div>
        </div>
        <div class="security-severity-grid">
          <div class="security-severity-stat critical"><span class="ssv-count">${formatNumber(summary.severityCounts.critical)}</span><span class="ssv-label">Critical</span></div>
          <div class="security-severity-stat high"><span class="ssv-count">${formatNumber(summary.severityCounts.high)}</span><span class="ssv-label">High</span></div>
          <div class="security-severity-stat medium"><span class="ssv-count">${formatNumber(summary.severityCounts.medium)}</span><span class="ssv-label">Medium</span></div>
          <div class="security-severity-stat low"><span class="ssv-count">${formatNumber(summary.severityCounts.low)}</span><span class="ssv-label">Low</span></div>
        </div>
        <div class="security-bar">
          ${summary.severityCounts.critical ? `<div class="security-bar-segment critical" style="width:${Math.min(100, (summary.severityCounts.critical / Math.max(summary.totalFindings, 1)) * 100)}%"></div>` : ''}
          ${summary.severityCounts.high ? `<div class="security-bar-segment high" style="width:${Math.min(100, (summary.severityCounts.high / Math.max(summary.totalFindings, 1)) * 100)}%"></div>` : ''}
          ${summary.severityCounts.medium ? `<div class="security-bar-segment medium" style="width:${Math.min(100, (summary.severityCounts.medium / Math.max(summary.totalFindings, 1)) * 100)}%"></div>` : ''}
          ${summary.severityCounts.low ? `<div class="security-bar-segment low" style="width:${Math.min(100, (summary.severityCounts.low / Math.max(summary.totalFindings, 1)) * 100)}%"></div>` : ''}
        </div>
        <div class="security-score">
          <span class="text-muted">Security posture</span>
          <strong>${summary.gatePass ? 'Gate passed' : summary.gatePass === false ? 'Review required' : 'No scan data'}</strong>
        </div>
      </div>

      <div class="security-engine-row">
        <div class="security-engine">
          <div class="security-engine-icon">🔑</div>
          <div>
            <div style="font-size:0.95rem;font-weight:600;">${formatNumber(summary.credentialScanned)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Credentials scanned</div>
          </div>
        </div>
        <div class="security-engine">
          <div class="security-engine-icon leak">🏭</div>
          <div>
            <div style="font-size:0.95rem;font-weight:600;">${formatNumber(summary.productionLeakScanned)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Production leaks scanned</div>
          </div>
        </div>
      </div>

      <div style="margin-bottom: var(--space-5);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h2 style="margin:0;font-size:1rem;font-weight:700;">🔍 Findings (${findings.length})</h2>
          <span class="db-v3-panel-badge">${findings.length} items</span>
        </div>
        ${this.renderFindingsList(findings)}
      </div>
    `;
        (_d = el.querySelector('#security-run-scan')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => this.runScan(this._container));
        (_e = el.querySelector('#security-export-json')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => this.exportResults());
        // Secret reveal toggles
        el.querySelectorAll('.secret-toggle-visibility-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wrapper = btn.closest('.secure-reveal-wrapper');
                if (!wrapper)
                    return;
                const isRevealed = wrapper.getAttribute('data-revealed') === 'true';
                wrapper.setAttribute('data-revealed', isRevealed ? 'false' : 'true');
                btn.blur();
            });
        });
        // Expand/collapse playbook drawer
        el.querySelectorAll('.sec-v3-expand-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.index;
                const drawer = el.querySelector(`#sec-drawer-${idx}`);
                const isOpen = drawer === null || drawer === void 0 ? void 0 : drawer.classList.contains('is-open');
                drawer === null || drawer === void 0 ? void 0 : drawer.classList.toggle('is-open', !isOpen);
                btn.classList.toggle('is-open', !isOpen);
            });
        });
        // Mark triaged
        el.querySelectorAll('.sec-v3-triage-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.index;
                const row = el.querySelector(`.sec-v3-row[data-index="${idx}"]`);
                if (row) {
                    row.classList.add('is-triaged');
                    btn.textContent = 'Triaged';
                    btn.disabled = true;
                    showToast('Finding marked as triaged', 'success');
                }
            });
        });
        // Copy path
        el.querySelectorAll('.sec-v3-copy-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.index;
                const finding = findings[idx];
                if (finding === null || finding === void 0 ? void 0 : finding.file) {
                    navigator.clipboard.writeText(finding.file).then(() => showToast('File path copied', 'success'));
                }
            });
        });
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
            const vscode = this._getVscodeApi();
            if (vscode) {
                try {
                    vscode.postMessage({ command: 'sendToAI', data: payload });
                    showToast('Security findings sent to AI agent', 'success');
                    return;
                }
                catch (err) {
                    console.warn('[Security-AI] vscode.postMessage failed:', err);
                } // simplebeacon-ignore ai-residue — intentional error handling for VS Code API
            }
            try {
                const res = await fetch(apiUrl('/api/ai-context'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
        container.innerHTML = '';
        container.appendChild(this.render());
    }
    async runScan(container) {
        if (this.scanning)
            return;
        this.scanning = true;
        this.error = null;
        this.paint(container);
        try {
            this.app.navigate('analyze');
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
            return;
        }
        void this.loadReport(container);
        void this.loadCompliance();
    }
}
