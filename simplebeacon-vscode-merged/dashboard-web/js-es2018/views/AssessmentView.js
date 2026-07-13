import { escapeHtml } from '../utils/string.js';
import { showToast } from '../utils/dom.js';
import { assessmentService } from '../services/assessmentService.js';
import { authService } from '../services/authService.js';
import { showLoginModal } from '../components/LoginModal.js';
import { renderLockedBadge, renderTierChip } from '../components/TierBadge.js';
/**
 * Assessment view.
 */
export class AssessmentView {
    constructor(app) {
        this.app = app;
        this.userTier = 'guest';
        this.busy = false;
        this.report = null;
        this.recent = assessmentService.getRecentAssessments();
        this.form = {
            company: '',
            email: '',
            repoUrl: '',
            projectPath: '',
            assessmentType: 'mna-audit',
            clientPrice: ''
        };
        this.selectedAssessmentId = null;
        this._editorNotes = { headline: '', summary: '' };
        this._checklistFilter = '';
        this._scanProgress = { phase: 0, label: '', message: '' };
    }
    resolveUserTier() {
        const isAuthenticated = typeof authService !== 'undefined' ? authService.isAuthenticated() : false;
        const currentUser = typeof authService !== 'undefined' ? authService.getUser() : null;
        if (!isAuthenticated || !currentUser) {
            this.userTier = 'guest';
        }
        else if (currentUser.role === 'admin' || currentUser.role === 'auditor') {
            this.userTier = 'admin';
        }
        else {
            const tier = String(currentUser.tier || currentUser.plan || 'developer').toLowerCase();
            this.userTier = ['pro', 'team', 'enterprise', 'startup', 'growth'].includes(tier) ? tier : 'developer';
        }
    }
    renderRuleRow(rule) {
        const icon = rule.status === 'pass' ? '✓' : rule.status === 'fail' ? '✗' : '○';
        const cls = rule.status === 'pass' ? 'success' : rule.status === 'fail' ? 'danger' : '';
        return `
      <tr>
        <td><span class="severity-pill ${cls}">${icon} ${escapeHtml(rule.id)}</span></td>
        <td>${escapeHtml(rule.title)}</td>
        <td>${escapeHtml(rule.evidence || '—')}</td>
      </tr>
    `;
    }
    renderGatedFormSection() {
        if (this.userTier === 'guest') {
            return `
        <div class="as-v3-hint db-v3-glass cta-marketing-lock">
          <div class="cta-lock-icon-group">
            <span class="codicon codicon-lock"></span>
          </div>
          <div class="cta-lock-content">
            <h4>🔒 Active Scanner Workspace Locked</h4>
            <p>Anonymous server-side cloning is restricted. Interact with the <strong>Pre-Baked Live Demo Sandbox</strong> below to explore enterprise corporate deliverables, or sign in to configure your custom project pipeline.</p>
            <button type="button" class="as-v3-action-btn-primary" id="sb-portal-trigger-login-btn">
              Sign In / Create Enterprise Account
            </button>
          </div>
        </div>
      `;
        }
        const showLocalPathInput = this.userTier !== 'guest';
        const showRemoteUrlInput = this.userTier !== 'guest' && authService.isPaidTier();
        const tierLabel = authService.getTierLabel();
        return `
      <h5 style="margin:0 0 16px;font-size:1rem;font-weight:700;">Initialize Client Compliance Assessment ${renderTierChip(tierLabel)}</h5>
      <form id="sb-run-assessment-form-element">
        <div style="margin-bottom:20px;">
          <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Client Information</div>
          <div class="as-v3-form-row" style="grid-template-columns:1fr;margin-bottom:0;">
            <div class="as-v3-input-group" style="margin-bottom:12px;">
              <label class="as-v3-input-label">Target Company *</label>
              <input class="as-v3-input" type="text" name="company" required placeholder="e.g. Acme Corp" value="${escapeHtml(this.form.company)}">
            </div>
            <div class="as-v3-input-group">
              <label class="as-v3-input-label">Contact Email Address</label>
              <input class="as-v3-input" type="email" name="email" placeholder="client@company.com" value="${escapeHtml(this.form.email)}">
            </div>
          </div>
        </div>
        <div style="margin-bottom:20px;">
          <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Assessment Type</div>
          <div class="as-v3-input-group">
            <select class="as-v3-input" name="assessmentType" style="cursor:pointer;">
              <option value="mna-audit" ${this.form.assessmentType === 'mna-audit' ? 'selected' : ''}>M&amp;A Technical Due Diligence</option>
              <option value="security-audit" ${this.form.assessmentType === 'security-audit' ? 'selected' : ''}>Security &amp; Credential Audit</option>
              <option value="compliance-review" ${this.form.assessmentType === 'compliance-review' ? 'selected' : ''}>Regulatory Compliance Review</option>
              <option value="ai-governance" ${this.form.assessmentType === 'ai-governance' ? 'selected' : ''}>AI Governance Assessment</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:20px;">
          <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Scan Target</div>
          <div class="as-v3-form-row" style="grid-template-columns:1fr;margin-bottom:0;">
            <div class="as-v3-input-group" style="margin-bottom:12px;">
              <label class="as-v3-input-label">Remote Git Repository URL ${!showRemoteUrlInput ? renderLockedBadge('Remote Clones', { tier: 'Pro' }) : ''}</label>
              <input class="as-v3-input" type="url" name="repoUrl" placeholder="git@github.com:org/repo.git" value="${escapeHtml(this.form.repoUrl)}" ${!showRemoteUrlInput ? 'disabled' : ''}>
            </div>
            ${showLocalPathInput ? `
            <div class="as-v3-input-group">
              <label class="as-v3-input-label">Local Workspace Directory Path</label>
              <input class="as-v3-input" type="text" name="projectPath" placeholder="C:\\dev\\my-repository" value="${escapeHtml(this.form.projectPath)}">
            </div>` : ''}
          </div>
        </div>
        <div class="form-action-footer" style="display:flex;gap:10px;align-items:center;margin-top:8px;">
          <button type="submit" class="btn btn-primary" id="run-assessment-submit-btn" ${this.busy ? 'disabled' : ''}>
            ${this.busy ? '<span class="loading-spinner"></span> Scanning…' : '<span class="codicon codicon-run"></span> Run Assessment Scan'}
          </button>
          ${this.busy && this._scanProgress.phase > 0 ? `
            <div class="as-v3-progress" style="flex:1;margin:0;">
              <span class="as-v3-progress-label">Phase ${this._scanProgress.phase}/4</span>
              <div class="as-v3-progress-bar"><div class="as-v3-progress-fill" style="width:${(this._scanProgress.phase / 4) * 100}%"></div></div>
              <span class="as-v3-progress-label">${escapeHtml(this._scanProgress.label)}</span>
            </div>
            <p class="text-muted" style="font-size:0.78rem;margin:0;">${escapeHtml(this._scanProgress.message)}</p>
          ` : ''}
        </div>
      </form>
    `;
    }
    renderAssessmentDetailCanvas(assessment) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const detailMount = document.getElementById('assessment-detail-mount');
        if (!detailMount)
            return;
        const summary = assessment.executiveSummary || {};
        const checklist = assessment.complianceChecklist || {};
        const rules = checklist.rules || assessment.checklist || [];
        const isAdmin = this.userTier === 'admin';
        const filter = this._checklistFilter.toLowerCase();
        const filteredRules = filter
            ? rules.filter((r) => (r.id || '').toLowerCase().includes(filter) ||
                (r.title || '').toLowerCase().includes(filter) ||
                (r.evidence || '').toLowerCase().includes(filter) ||
                (r.status || '').toLowerCase().includes(filter))
            : rules;
        const notesHeadline = this._editorNotes.headline || summary.headline || assessment.headline || '';
        const notesSummary = this._editorNotes.summary || summary.executiveNotes || '';
        detailMount.innerHTML = `
      <div class="card mt-4 as-print-report">
        <div class="card-header as-print-header">
          <span class="card-title">Assessment report</span>
          <span class="severity-pill ${summary.gateResult === 'PASS' || ((_a = assessment.metrics) === null || _a === void 0 ? void 0 : _a.gateStatus) === 'PASS' ? 'success' : 'danger'}">${escapeHtml(summary.gateResult || ((_b = assessment.metrics) === null || _b === void 0 ? void 0 : _b.gateStatus) || '—')}</span>
        </div>

        ${isAdmin ? `
          <div style="padding:var(--space-4) var(--space-4) 0;">
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Executive Headline (editable)</div>
            <textarea class="as-v3-textarea" id="as-editor-headline" rows="2" placeholder="Enter custom executive headline…">${escapeHtml(notesHeadline)}</textarea>
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:10px 0 6px;">Executive Notes (editable)</div>
            <textarea class="as-v3-textarea" id="as-editor-summary" rows="4" placeholder="Enter triage notes, exemptions, or risk-acceptance sign-offs…">${escapeHtml(notesSummary)}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button type="button" class="btn btn-primary btn-sm" id="as-save-notes-btn">💾 Save Notes</button>
              <span id="as-save-status" style="font-size:0.72rem;color:var(--text-muted);align-self:center;"></span>
            </div>
          </div>
        ` : `
          <p class="text-muted" style="padding:0 var(--space-4)">${escapeHtml(notesHeadline || '—')}</p>
        `}

        <div class="settings-grid" style="padding:var(--space-4)">
          <div class="settings-row"><span class="settings-label">Compliance score</span><span class="settings-value">${(_e = (_c = summary.complianceScore) !== null && _c !== void 0 ? _c : (_d = assessment.metrics) === null || _d === void 0 ? void 0 : _d.complianceScore) !== null && _e !== void 0 ? _e : '—'}%</span></div>
          <div class="settings-row"><span class="settings-label">Ready for automation</span><span class="settings-value">${summary.complianceReady ? 'Yes' : ((_f = assessment.metrics) === null || _f === void 0 ? void 0 : _f.qualityScore) ? 'Review' : 'No'}</span></div>
          <div class="settings-row"><span class="settings-label">High issues</span><span class="settings-value">${(_j = (_g = summary.highIssues) !== null && _g !== void 0 ? _g : (_h = assessment.metrics) === null || _h === void 0 ? void 0 : _h.highCount) !== null && _j !== void 0 ? _j : 0}</span></div>
          <div class="settings-row"><span class="settings-label">Expires</span><span class="settings-value">${escapeHtml(((_k = assessment.metadata) === null || _k === void 0 ? void 0 : _k.expiresAt) || '—')}</span></div>
        </div>

        ${rules.length ? `
          <div class="section-heading" style="padding:0 var(--space-4)"><h2>Corporate safety checklist</h2></div>
          <div style="padding:0 var(--space-4) 10px;">
            <input type="text" class="as-v3-input" id="as-checklist-filter" placeholder="🔍 Search rules (e.g. Credentials, Compliance, fail)…" value="${escapeHtml(this._checklistFilter)}">
            <p id="as-checklist-filter-status" style="font-size:0.72rem;color:var(--text-muted);margin:4px 0 0;">${rules.length} rules</p>
          </div>
          <table class="as-v3-table" id="as-checklist-table">
            <thead><tr><th>Rule</th><th>Title</th><th>Evidence</th></tr></thead>
            <tbody>${filteredRules.map((r) => this.renderRuleRow(r)).join('')}</tbody>
          </table>
          ${filter && filteredRules.length < rules.length ? `<p class="text-muted" style="padding:0 var(--space-4);font-size:0.78rem;">Showing ${filteredRules.length} of ${rules.length} rules matching &quot;${escapeHtml(filter)}&quot;</p>` : ''}
        ` : ''}

        <div class="card-actions" style="padding:var(--space-4)">
          <a class="btn btn-secondary btn-sm" href="${assessmentService.downloadUrl(((_l = assessment.metadata) === null || _l === void 0 ? void 0 : _l.assessmentId) || assessment.id)}" download>Download JSON</a>
          <button type="button" class="btn btn-ghost btn-sm" id="as-print-btn">🖨 Print Report</button>
        </div>
      </div>
    `;
    }
    loadPreBakedDemoReport() {
        const demoPayload = {
            id: 'sb-demo-verification-9ac',
            assessmentId: 'sb-demo-verification-9ac',
            company: 'Acme Cloud Logistics (Sandbox Demo)',
            createdAt: new Date().toISOString(),
            executiveSummary: {
                headline: 'Codebase satisfies core enterprise security gates. Zero plaintext credentials found.',
                gateResult: 'PASS',
                complianceScore: 100,
                complianceReady: true,
                highIssues: 0
            },
            metadata: { assessmentId: 'sb-demo-verification-9ac', expiresAt: '—' },
            complianceChecklist: {
                rules: [
                    { id: 'RULE-SEC-01', title: 'API Cryptographic Credential Scan', status: 'pass', evidence: 'Checked 14 source directories; 0 credentials leaked.' },
                    { id: 'RULE-REG-02', title: 'EU AI Act Compliance (Art. 15)', status: 'pass', evidence: 'No loose placeholder tokens or placeholder slop detected.' },
                    { id: 'RULE-ARCH-03', title: 'Repository Integrity & Asset Duplicates', status: 'warn', evidence: 'Identified 3 minor redundant static modules.' }
                ]
            }
        };
        this.renderHistoryTable([demoPayload]);
        this.renderAssessmentDetailCanvas(demoPayload);
    }
    canAccessAssessment(record) {
        if (this.userTier === 'admin')
            return true;
        if (this.userTier === 'guest')
            return ((record === null || record === void 0 ? void 0 : record.assessmentId) || (record === null || record === void 0 ? void 0 : record.id)) === 'sb-demo-verification-9ac';
        const currentUser = authService.getUser();
        if (!currentUser)
            return false;
        const recordUserId = (record === null || record === void 0 ? void 0 : record.userId) || (record === null || record === void 0 ? void 0 : record.user_id);
        const recordEmail = (record === null || record === void 0 ? void 0 : record.email) || (record === null || record === void 0 ? void 0 : record.userEmail);
        return (recordUserId === currentUser.id ||
            recordUserId === currentUser.sub ||
            recordEmail === currentUser.email ||
            recordEmail === currentUser.sub);
    }
    _updateChecklistFilter() {
        const table = document.getElementById('as-checklist-table');
        if (!table)
            return;
        const rows = table.querySelectorAll('tbody tr');
        const filter = this._checklistFilter.toLowerCase();
        let visibleCount = 0;
        rows.forEach((row) => {
            const text = row.textContent || '';
            const match = text.toLowerCase().includes(filter);
            row.style.display = match ? '' : 'none';
            if (match)
                visibleCount++;
        });
        const statusEl = document.getElementById('as-checklist-filter-status');
        if (statusEl) {
            statusEl.textContent = filter
                ? `Showing ${visibleCount} of ${rows.length} rules matching "${this._checklistFilter}"`
                : `${rows.length} rules`;
        }
    }
    async refreshHistoryFeed() {
        if (this.userTier === 'guest') {
            this.loadPreBakedDemoReport();
            return;
        }
        try {
            let assessmentsList = this.recent.length ? this.recent : await assessmentService.getRecentAssessments();
            if (this.userTier === 'developer') {
                assessmentsList = assessmentsList.filter((item) => this.canAccessAssessment(item));
            }
            this.recent = assessmentsList;
            this.renderHistoryTable(assessmentsList);
        }
        catch (err) {
            showToast('Failed to load secure assessment history.', 'error');
            this.renderHistoryTable([]);
        }
    }
    renderHistoryTable(records) {
        const mountPoint = document.getElementById('recent-assessments-table-mount');
        if (!mountPoint)
            return;
        if (records.length === 0) {
            mountPoint.innerHTML = `<div class="as-v3-table-empty">No workspace assessments executed yet.</div>`;
            return;
        }
        mountPoint.innerHTML = `
      <table class="as-v3-table">
        <thead>
          <tr>
            <th>Target Client</th>
            <th>Identifier</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((record) => `
            <tr>
              <td><strong>${escapeHtml(record.company)}</strong></td>
              <td><code>${escapeHtml(record.assessmentId || record.id)}</code></td>
              <td>
                <button type="button" class="as-view-detail-btn btn btn-ghost btn-sm" data-id="${escapeHtml(record.assessmentId || record.id)}">
                  Inspect Report
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    }
    bindEvents() {
        var _a, _b;
        if (!this.container)
            return;
        this.container.addEventListener('click', (e) => {
            const loginBtn = e.target.closest('#sb-portal-trigger-login-btn');
            if (!loginBtn)
                return;
            if (typeof showLoginModal === 'function') {
                showLoginModal({
                    message: 'Sign in to deploy SimpleBeacon scanning workers against public or authenticated paths.',
                    onSuccess: () => {
                        this.resolveUserTier();
                        this.render();
                        this.bindEvents();
                        this.refreshHistoryFeed();
                    }
                });
            }
        });
        this.container.addEventListener('click', (e) => {
            const inspectBtn = e.target.closest('.as-view-detail-btn');
            if (!inspectBtn)
                return;
            const recordId = inspectBtn.getAttribute('data-id');
            const record = this.recent.find((r) => (r.assessmentId || r.id) === recordId);
            if (this.userTier === 'guest') {
                if (recordId === 'sb-demo-verification-9ac') {
                    this.loadPreBakedDemoReport();
                }
                else {
                    this.renderAccessDeniedDetail();
                }
                return;
            }
            if (record && !this.canAccessAssessment(record)) {
                this.renderAccessDeniedDetail();
                return;
            }
            this.loadAssessmentDetail(recordId);
        });
        const formElement = this.container.querySelector('#sb-run-assessment-form-element');
        if (formElement) {
            formElement.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (this.userTier === 'guest' || this.busy)
                    return;
                const fd = new FormData(formElement);
                const payload = {
                    company: String(fd.get('company') || '').trim(),
                    email: String(fd.get('email') || '').trim(),
                    repoUrl: String(fd.get('repoUrl') || '').trim() || undefined,
                    projectPath: String(fd.get('projectPath') || '').trim() || undefined,
                    assessmentType: String(fd.get('assessmentType') || 'mna-audit')
                };
                if (!payload.repoUrl && !payload.projectPath) {
                    showToast('Provide a repo URL or a local project path', 'error');
                    return;
                }
                if (payload.projectPath && !authService.isAuthenticated()) {
                    showLoginModal({ onSuccess: () => formElement.requestSubmit() });
                    return;
                }
                if (payload.repoUrl && !authService.isPaidTier()) {
                    showToast('Remote repository cloning is a Pro feature — upgrade to unlock server-side scans.', 'error');
                    return;
                }
                this.setLoadingState(true);
                showToast('Running Simplebeacon assessment…', 'info');
                try {
                    const result = await assessmentService.runAssessment(payload);
                    this.recent = assessmentService.getRecentAssessments();
                    showToast(`Assessment complete — ${result.assessmentId || result.id}`, 'success');
                    this.app.navigate('assessments', { id: result.assessmentId || result.id });
                    const data = await assessmentService.fetchReport(result.assessmentId || result.id);
                    this.report = data.assessment;
                    this.refreshHistoryFeed();
                    this.renderAssessmentDetailCanvas(this.report);
                }
                catch (err) {
                    if (err.status === 401) {
                        showLoginModal({ onSuccess: () => formElement.requestSubmit() });
                    }
                    else {
                        showToast(`Assessment Engine Failure: ${err.message}`, 'error');
                    }
                }
                finally {
                    this.setLoadingState(false);
                }
            });
        }
        const filterInput = this.container.querySelector('#as-checklist-filter');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                this._checklistFilter = e.target.value;
                this._updateChecklistFilter();
            });
        }
        (_a = this.container.querySelector('#as-print-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => window.print());
        (_b = this.container.querySelector('#as-save-notes-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            var _a, _b;
            const headline = ((_a = this.container.querySelector('#as-editor-headline')) === null || _a === void 0 ? void 0 : _a.value) || '';
            const summary = ((_b = this.container.querySelector('#as-editor-summary')) === null || _b === void 0 ? void 0 : _b.value) || '';
            this._editorNotes = { headline, summary };
            const statusEl = this.container.querySelector('#as-save-status');
            if (statusEl)
                statusEl.textContent = 'Saved locally only — server sync not yet implemented';
            showToast('Notes saved locally (not synced to server)', 'info');
        });
        const monetizeSettingsBtn = this.container.querySelector('#as-monetize-settings-btn');
        if (monetizeSettingsBtn) {
            monetizeSettingsBtn.addEventListener('click', () => {
                showToast('Billing settings moved to Settings → Monetization', 'info');
                this.app.navigate('settings');
            });
        }
    }
    setLoadingState(isBusy) {
        var _a;
        this.busy = isBusy;
        const submitBtn = (_a = this.container) === null || _a === void 0 ? void 0 : _a.querySelector('#run-assessment-submit-btn');
        if (submitBtn)
            submitBtn.disabled = isBusy;
    }
    renderAccessDeniedDetail() {
        const detailMount = document.getElementById('assessment-detail-mount');
        if (!detailMount)
            return;
        detailMount.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'card mt-4';
        const header = document.createElement('div');
        header.className = 'card-header';
        const title = document.createElement('span');
        title.className = 'card-title';
        title.textContent = 'Access Restricted';
        header.appendChild(title);
        const body = document.createElement('div');
        body.className = 'card-body';
        body.style.padding = 'var(--space-4)';
        const note = document.createElement('p');
        note.className = 'text-muted';
        note.textContent = 'You do not have permission to view this assessment. Anonymous users are limited to the pre-baked demo sandbox. Developers can only view assessments linked to their own account.';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = 'Open Demo Sandbox';
        btn.addEventListener('click', () => this.loadPreBakedDemoReport());
        body.appendChild(note);
        body.appendChild(btn);
        card.appendChild(header);
        card.appendChild(body);
        detailMount.appendChild(card);
    }
    renderEarningsCard() {
        const isPaid = authService.isPaidTier();
        const assessmentCount = this.recent ? this.recent.length : 0;
        return `
      <div class="as-v3-card" style="margin-bottom:20px;">
        <div class="as-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">� Workspace</h3>
          <span class="as-v3-badge tier-badge-${this.userTier}">${isPaid ? 'ACTIVE' : 'LOCKED'}</span>
        </div>
        <div class="as-v3-card-bd">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div style="text-align:center;padding:10px;background:rgba(99,102,241,0.06);border-radius:10px;">
              <div style="font-size:1.4rem;font-weight:800;color:var(--accent);">${assessmentCount}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);">Assessments</div>
            </div>
            <div style="text-align:center;padding:10px;background:rgba(99,102,241,0.06);border-radius:10px;">
              <div style="font-size:1.4rem;font-weight:800;color:var(--accent);">${isPaid ? 'Pro' : 'Free'}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);">Plan</div>
            </div>
          </div>
          ${!isPaid ? `
            <div class="as-v3-hint" style="margin-bottom:12px;">
              Upgrade to Pro for remote repository cloning and advanced reporting.
            </div>
            <button type="button" class="as-v3-action-btn-primary" id="sb-portal-trigger-login-btn">
              Sign In / Upgrade
            </button>
          ` : `
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" id="as-monetize-settings-btn">⚙️ Settings</button>
            </div>
          `}
        </div>
      </div>
    `;
    }
    async loadAssessmentDetail(assessmentId) {
        try {
            if (this.userTier === 'guest' && assessmentId !== 'sb-demo-verification-9ac') {
                this.renderAccessDeniedDetail();
                return;
            }
            const record = this.recent.find((r) => (r.assessmentId || r.id) === assessmentId);
            if (record && !this.canAccessAssessment(record)) {
                this.renderAccessDeniedDetail();
                return;
            }
            const data = await assessmentService.fetchReport(assessmentId);
            this.report = data.assessment;
            this.renderAssessmentDetailCanvas(this.report);
        }
        catch (err) {
            showToast(err.message, 'error');
        }
    }
    render() {
        this.resolveUserTier();
        const el = document.createElement('div');
        el.className = 'fade-in';
        el.innerHTML = `
      <style>
        @keyframes as-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .as-v3 { animation:as-fade-up .5s ease both; }
        .as-v3-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:24px; }
        .as-v3-header h1 { font-size:2.2rem; font-weight:800; margin:0; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--text-primary) 0%,var(--accent) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .as-v3-header p { color:var(--text-muted); font-size:0.9rem; margin:6px 0 0; }
        .as-v3-card { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; margin-bottom:20px; }
        [data-theme='light'] .as-v3-card { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        .as-v3-card:hover { box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        [data-theme='light'] .as-v3-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.08); }
        .as-v3-card-hd { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(148,163,184,0.08); }
        .as-v3-card-bd { padding:18px 22px; }
        .as-v3-form-row { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:16px; }
        @media (max-width:640px) { .as-v3-form-row { grid-template-columns:1fr; } }
        .as-v3-input-group { display:flex; flex-direction:column; gap:6px; }
        .as-v3-input-label { font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.05em; }
        .as-v3-input { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 14px; font-size:0.85rem; color:var(--text-primary); transition:border-color .2s,box-shadow .2s; }
        .as-v3-input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .as-v3-table { width:100%; border-collapse:separate; border-spacing:0; }
        .as-v3-table th { text-align:left; padding:10px 14px; font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid rgba(148,163,184,0.1); }
        .as-v3-table td { padding:10px 14px; font-size:0.82rem; color:var(--text-secondary); border-bottom:1px solid rgba(148,163,184,0.06); }
        .as-v3-table tr:last-child td { border-bottom:none; }
        .as-v3-table code { background:rgba(148,163,184,0.08); padding:2px 6px; border-radius:4px; font-size:0.78rem; }
        .as-v3-badge { font-size:0.72rem; font-weight:700; padding:4px 12px; border-radius:999px; background:rgba(99,102,241,0.15); color:#a78bfa; }
        .as-v3-hint { font-size:0.78rem; color:var(--text-muted); padding:10px 14px; background:rgba(245,158,11,0.05); border-radius:10px; border:1px solid rgba(245,158,11,0.1); }
        .as-v3-textarea { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 14px; font-size:0.85rem; color:var(--text-primary); font-family:var(--font-mono); line-height:1.5; resize:vertical; transition:border-color .2s,box-shadow .2s; }
        .as-v3-textarea:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .as-v3-progress { display:flex; align-items:center; gap:12px; padding:14px 18px; background:rgba(148,163,184,0.04); border-radius:12px; border:1px solid rgba(148,163,184,0.06); margin-bottom:16px; }
        .as-v3-progress-bar { flex:1; height:6px; background:rgba(148,163,184,0.1); border-radius:3px; overflow:hidden; }
        .as-v3-progress-fill { height:100%; background:linear-gradient(90deg,var(--accent),#818cf8); border-radius:3px; transition:width .4s ease; }
        .as-v3-progress-label { font-size:0.78rem; font-weight:700; color:var(--text-muted); white-space:nowrap; }
        .as-v3-cta { text-align:center; padding:20px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.12); border-radius:14px; }
        .as-v3-cta h4 { margin:0 0 8px; font-size:1rem; color:var(--text-primary); }
        .as-v3-cta p { margin:0 0 14px; font-size:0.82rem; color:var(--text-muted); }
        .cta-marketing-lock { display:flex; align-items:center; gap:20px; padding:24px; background:rgba(99,102,241,0.05) !important; border:1px dashed rgba(99,102,241,0.3) !important; border-radius:12px; margin-bottom:20px; }
        .cta-lock-icon-group { background:rgba(99,102,241,0.15); color:#818cf8; width:56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.6rem; }
        .cta-lock-content { flex:1; }
        .cta-lock-content h4 { margin:0 0 6px 0; font-size:1.1rem; color:var(--text-primary); }
        .cta-lock-content p { margin:0 0 14px 0; font-size:0.85rem; color:var(--text-muted); line-height:1.5; }
        .as-v3-badge.tier-badge-guest { background:rgba(156,163,175,0.15); color:#cbd5e1; }
        .as-v3-badge.tier-badge-developer { background:rgba(59,130,246,0.15); color:#60a5fa; }
        .as-v3-badge.tier-badge-admin { background:rgba(139,92,246,0.2); color:#c084fc; border:1px solid rgba(139,92,246,0.4); }
        .as-v3-table-empty { padding:16px; font-size:0.8rem; color:var(--text-muted); text-align:center; }
        .as-v3-action-btn-primary { background:var(--accent); color:#fff; border:none; border-radius:10px; padding:10px 16px; font-size:0.85rem; font-weight:600; cursor:pointer; transition:opacity .2s; }
        .as-v3-action-btn-primary:hover { opacity:0.9; }
        .assessment-split-workspace { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        @media (max-width:960px) { .assessment-split-workspace { grid-template-columns:1fr; } }
        @media print {
          body * { visibility:hidden; }
          .as-print-report, .as-print-report * { visibility:visible; }
          .as-print-report { position:absolute; left:0; top:0; width:100%; background:#fff !important; color:#000 !important; border:none !important; box-shadow:none !important; }
          .as-print-header { background:#fff !important; border-bottom:2px solid #000 !important; }
          .as-v3-table th { color:#000 !important; border-bottom:1px solid #000 !important; }
          .as-v3-table td { color:#000 !important; border-bottom:1px solid #ccc !important; }
          .card-actions, #as-checklist-filter, .as-v3-input { display:none !important; }
          .settings-grid { page-break-inside:avoid; }
          .as-v3-table { page-break-before:always; }
        }
      </style>

      <div class="as-v3-portal platform-redesign" data-user-tier="${this.userTier}">
        <div class="as-v3-header">
          <div>
            <h1 class="gradient-text">Enterprise Assessment Portal</h1>
            <span class="view-subtitle">Simplebeacon scan → human triage → enterprise deliverable</span>
          </div>
        </div>

        <div class="as-v3-card as-form-card">
          <div class="as-v3-card-bd">
            ${this.renderGatedFormSection()}
          </div>
        </div>

        <div class="assessment-split-workspace">
          <div class="workspace-history-pane">
            ${this.renderEarningsCard()}
            <div class="as-v3-card as-history-card">
              <div class="as-v3-card-hd">
                <h3 style="margin:0;font-size:1rem;font-weight:700;">📋 Recent Assessments</h3>
                <span class="as-v3-badge tier-badge-${this.userTier}">${this.userTier.toUpperCase()} SCOPE</span>
              </div>
              <div class="as-v3-card-bd">
                <div id="recent-assessments-table-mount"></div>
              </div>
            </div>
          </div>

          <div class="workspace-report-detail-pane" id="assessment-detail-mount">
            <!-- Detail canvas populated by renderAssessmentDetailCanvas -->
          </div>
        </div>
      </div>
    `;
        this.container = el;
        this.refreshHistoryFeed();
        return el;
    }
    mount(container) {
        var _a, _b, _c;
        const selectedId = (_a = this.app.state.routeParams) === null || _a === void 0 ? void 0 : _a.id;
        if (selectedId) {
            if (((_c = (_b = this.report) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.assessmentId) !== selectedId) {
                this.loadAssessmentDetail(selectedId)
                    .then(() => this.app.refreshCurrentView())
                    .catch((err) => showToast(err.message, 'error'));
            }
        }
        else {
            this.report = null;
        }
        this.recent = assessmentService.getRecentAssessments();
        container.innerHTML = '';
        container.appendChild(this.render());
        this.bindEvents();
    }
}
