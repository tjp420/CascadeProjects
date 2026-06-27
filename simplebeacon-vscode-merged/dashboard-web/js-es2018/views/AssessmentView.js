import { escapeHtml, showToast } from '../utils.js';
import { assessmentService } from '../services/assessmentService.js';
import { authService } from '../services/authService.js';
import { showLoginModal } from '../components/LoginModal.js';
/**
 * Assessment view.
 */
export class AssessmentView {
    constructor(app) {
        this.app = app;
        this.busy = false;
        this.report = null;
        this.recent = assessmentService.getRecentAssessments();
        this.form = {
            company: '',
            email: '',
            repoUrl: '',
            projectPath: '',
            assessmentType: 'mna-audit'
        };
        this._editorNotes = { headline: '', summary: '' };
        this._checklistFilter = '';
        this._scanProgress = { phase: 0, label: '', message: '' };
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
    renderReportDetail(assessment) {
        var _a, _b, _c, _d;
        const summary = assessment.executiveSummary || {};
        const checklist = assessment.complianceChecklist || {};
        const rules = checklist.rules || [];
        const isAdmin = authService.isAdmin();
        const filter = this._checklistFilter.toLowerCase();
        const filteredRules = filter
            ? rules.filter((r) => (r.id || '').toLowerCase().includes(filter) ||
                (r.title || '').toLowerCase().includes(filter) ||
                (r.evidence || '').toLowerCase().includes(filter) ||
                (r.status || '').toLowerCase().includes(filter))
            : rules;
        const notesHeadline = this._editorNotes.headline || summary.headline || '';
        const notesSummary = this._editorNotes.summary || summary.executiveNotes || '';
        return `
      <div class="card mt-4 as-print-report">
        <div class="card-header as-print-header">
          <span class="card-title">Assessment report</span>
          <span class="severity-pill ${summary.gateResult === 'PASS' ? 'success' : 'danger'}">${escapeHtml(summary.gateResult || '—')}</span>
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
          <p class="text-muted" style="padding:0 var(--space-4)">${escapeHtml(summary.headline || '—')}</p>
        `}

        <div class="settings-grid" style="padding:var(--space-4)">
          <div class="settings-row"><span class="settings-label">Compliance score</span><span class="settings-value">${(_a = summary.complianceScore) !== null && _a !== void 0 ? _a : '—'}%</span></div>
          <div class="settings-row"><span class="settings-label">Ready for automation</span><span class="settings-value">${summary.complianceReady ? 'Yes' : 'No'}</span></div>
          <div class="settings-row"><span class="settings-label">High issues</span><span class="settings-value">${(_b = summary.highIssues) !== null && _b !== void 0 ? _b : 0}</span></div>
          <div class="settings-row"><span class="settings-label">Expires</span><span class="settings-value">${escapeHtml(((_c = assessment.metadata) === null || _c === void 0 ? void 0 : _c.expiresAt) || '—')}</span></div>
        </div>

        ${rules.length ? `
          <div class="section-heading" style="padding:0 var(--space-4)"><h2>Corporate safety checklist</h2></div>
          <div style="padding:0 var(--space-4) 10px;">
            <input type="text" class="as-v3-input" id="as-checklist-filter" placeholder="🔍 Search rules (e.g. Credentials, Compliance, fail)…" value="${escapeHtml(this._checklistFilter)}">
          </div>
          <table class="as-v3-table" id="as-checklist-table">
            <thead><tr><th>Rule</th><th>Title</th><th>Evidence</th></tr></thead>
            <tbody>${filteredRules.map((r) => this.renderRuleRow(r)).join('')}</tbody>
          </table>
          ${filter && filteredRules.length < rules.length ? `<p class="text-muted" style="padding:0 var(--space-4);font-size:0.78rem;">Showing ${filteredRules.length} of ${rules.length} rules matching &quot;${escapeHtml(filter)}&quot;</p>` : ''}
        ` : ''}

        <div class="card-actions" style="padding:var(--space-4)">
          <a class="btn btn-secondary btn-sm" href="${assessmentService.downloadUrl((_d = assessment.metadata) === null || _d === void 0 ? void 0 : _d.assessmentId)}" download>Download JSON</a>
          <button type="button" class="btn btn-ghost btn-sm" id="as-print-btn">🖨 Print Report</button>
        </div>
      </div>
    `;
    }
    renderRecentList(list = this.recent) {
        if (!list.length) {
            return '<p class="text-muted">No assessments yet — run your first scan above.</p>';
        }
        return `
      <table class="as-v3-table">
        <thead><tr><th>Company</th><th>ID</th><th>When</th><th></th></tr></thead>
        <tbody>
          ${list.map((item) => `
            <tr>
              <td>${escapeHtml(item.company)}</td>
              <td><code>${escapeHtml(item.assessmentId)}</code></td>
              <td>${escapeHtml(new Date(item.createdAt).toLocaleString())}</td>
              <td><button type="button" class="btn btn-ghost btn-sm" data-open-assessment="${escapeHtml(item.assessmentId)}">View</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    }
    renderSampleReport() {
        return `
      <div class="card mt-4 as-print-report">
        <div class="card-header as-print-header">
          <span class="card-title">📋 Sample Assessment Report</span>
          <span class="severity-pill warning">PREVIEW</span>
        </div>
        <p class="text-muted" style="padding:0 var(--space-4)">This is a demonstration of an enterprise compliance deliverable.</p>
        <div class="settings-grid" style="padding:var(--space-4)">
          <div class="settings-row"><span class="settings-label">Compliance score</span><span class="settings-value">87%</span></div>
          <div class="settings-row"><span class="settings-label">Ready for automation</span><span class="settings-value">Yes</span></div>
          <div class="settings-row"><span class="settings-label">High issues</span><span class="settings-value">2</span></div>
          <div class="settings-row"><span class="settings-label">Expires</span><span class="settings-value">2026-07-27</span></div>
        </div>
        <div class="section-heading" style="padding:0 var(--space-4)"><h2>Corporate safety checklist</h2></div>
        <table class="as-v3-table">
          <thead><tr><th>Rule</th><th>Title</th><th>Evidence</th></tr></thead>
          <tbody>
            <tr>
              <td><span class="severity-pill success">✓ AUTH-001</span></td>
              <td>Authentication layer present</td>
              <td>JWT middleware detected</td>
            </tr>
            <tr>
              <td><span class="severity-pill success">✓ SEC-003</span></td>
              <td>No hardcoded secrets in source</td>
              <td>Credential scan clean</td>
            </tr>
            <tr>
              <td><span class="severity-pill danger">✗ DEP-002</span></td>
              <td>Dependency vulnerabilities below threshold</td>
              <td>3 high-severity npm advisories</td>
            </tr>
            <tr>
              <td><span class="severity-pill success">✓ LOG-001</span></td>
              <td>Structured logging enabled</td>
              <td>Winston/Pino configured</td>
            </tr>
            <tr>
              <td><span class="severity-pill warning">○ INF-004</span></td>
              <td>Infrastructure-as-code coverage</td>
              <td>Terraform files found but untested</td>
            </tr>
          </tbody>
        </table>
        <div class="card-actions" style="padding:var(--space-4)">
          <button type="button" class="btn btn-primary btn-sm" id="as-sample-signin-btn">🔐 Sign In to Run Real Assessments</button>
        </div>
      </div>
    `;
    }
    render() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const el = document.createElement('div');
        el.className = 'fade-in';
        const authed = authService.isAuthenticated();
        const isAdmin = authService.isAdmin();
        const user = authService.getUser();
        const userEmail = (user === null || user === void 0 ? void 0 : user.email) || (user === null || user === void 0 ? void 0 : user.sub) || '';
        const selectedId = (_a = this.app.state.routeParams) === null || _a === void 0 ? void 0 : _a.id;
        const visibleRecent = isAdmin
            ? this.recent
            : this.recent.filter((item) => !item.email || item.email === userEmail);
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

      <div class="as-v3-header">
        <div>
          <h1>Assessment Portal</h1>
          <p>Simplebeacon scan → human triage → enterprise deliverable</p>
        </div>
      </div>

      <div class="as-v3-card">
        <div class="as-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">📝 New Client Assessment</h3>
          <span class="as-v3-badge">${authed ? (isAdmin ? 'Admin' : 'Developer') : 'Guest'}</span>
        </div>
        <div class="as-v3-card-bd">
          ${!authed ? `
            <div class="as-v3-form-row">
              <div class="as-v3-input-group">
                <label class="as-v3-input-label">Company</label>
                <input class="as-v3-input" disabled placeholder="Acme Corp" value="Demo Corp">
              </div>
              <div class="as-v3-input-group">
                <label class="as-v3-input-label">Contact Email</label>
                <input class="as-v3-input" disabled type="email" placeholder="cto@acme.com" value="">
              </div>
            </div>
            <div class="as-v3-form-row">
              <div class="as-v3-input-group">
                <label class="as-v3-input-label">Git Repo URL</label>
                <input class="as-v3-input" disabled placeholder="https://github.com/org/repo" value="">
              </div>
              <div class="as-v3-input-group">
                <div class="as-v3-cta">
                  <h4>🔐 Assessment Scanning Requires Sign-In</h4>
                  <p>Sign in to run enterprise-grade compliance scans, generate client deliverables, and access the corporate safety checklist.</p>
                  <button type="button" class="btn btn-primary" id="as-guest-signin-btn">Sign In to Run Assessments</button>
                </div>
              </div>
            </div>
          ` : `
          <form id="assessment-form">
            <div class="as-v3-form-row">
              <div class="as-v3-input-group">
                <label class="as-v3-input-label">Company</label>
                <input class="as-v3-input" name="company" required placeholder="Acme Corp" value="${escapeHtml(this.form.company)}">
              </div>
              <div class="as-v3-input-group">
                <label class="as-v3-input-label">Contact Email</label>
                <input class="as-v3-input" name="email" type="email" placeholder="cto@acme.com" value="${escapeHtml(this.form.email)}">
              </div>
            </div>
            <div class="as-v3-form-row">
              <div class="as-v3-input-group">
                <label class="as-v3-input-label">Git Repo URL (public or signed-in)</label>
                <input class="as-v3-input" name="repoUrl" placeholder="https://github.com/org/repo" value="${escapeHtml(this.form.repoUrl)}">
              </div>
              <div class="as-v3-input-group">
                <label class="as-v3-input-label">Local Project Path</label>
                <input class="as-v3-input" name="projectPath" placeholder="C:\\Projects\\client-repo" value="${escapeHtml(this.form.projectPath)}">
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              <button type="submit" class="btn btn-primary" ${this.busy ? 'disabled' : ''}>
                ${this.busy ? '<span class="loading-spinner"></span> Scanning…' : 'Run Assessment Scan'}
              </button>
            </div>
            ${this.busy && this._scanProgress.phase > 0 ? `
              <div class="as-v3-progress" style="margin-top:14px;">
                <span class="as-v3-progress-label">Phase ${this._scanProgress.phase}/4</span>
                <div class="as-v3-progress-bar"><div class="as-v3-progress-fill" style="width:${(this._scanProgress.phase / 4) * 100}%"></div></div>
                <span class="as-v3-progress-label">${escapeHtml(this._scanProgress.label)}</span>
              </div>
              <p class="text-muted" style="font-size:0.78rem;margin:4px 0 0;">${escapeHtml(this._scanProgress.message)}</p>
            ` : ''}
          </form>
          `}
        </div>
      </div>


      <div class="as-v3-card">
        <div class="as-v3-card-hd">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">📋 Recent Assessments</h3>
          <span class="db-v3-panel-badge">${visibleRecent.length} total</span>
        </div>
        <div class="as-v3-card-bd">${this.renderRecentList(visibleRecent)}</div>
      </div>

      <div id="assessment-detail">${this.report ? this.renderReportDetail(this.report) : (!authed ? this.renderSampleReport() : '')}</div>
    `;
        (_b = el.querySelector('#assessment-form')) === null || _b === void 0 ? void 0 : _b.addEventListener('submit', (e) => this.onSubmit(e));
        (_c = el.querySelector('#as-guest-signin-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => showLoginModal());
        (_d = el.querySelector('#as-sample-signin-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => showLoginModal());
        el.querySelectorAll('[data-open-assessment]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.app.navigate('assessments', { id: btn.dataset.openAssessment });
            });
        });
        // Checklist live filter
        const filterInput = el.querySelector('#as-checklist-filter');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                this._checklistFilter = e.target.value;
                this.app.refreshCurrentView();
            });
        }
        // Print report
        (_e = el.querySelector('#as-print-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
            window.print();
        });
        // Save executive notes
        (_f = el.querySelector('#as-save-notes-btn')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', () => {
            var _a, _b;
            const headline = ((_a = el.querySelector('#as-editor-headline')) === null || _a === void 0 ? void 0 : _a.value) || '';
            const summary = ((_b = el.querySelector('#as-editor-summary')) === null || _b === void 0 ? void 0 : _b.value) || '';
            this._editorNotes = { headline, summary };
            const statusEl = el.querySelector('#as-save-status');
            if (statusEl)
                statusEl.textContent = 'Saved locally — not yet synced to server';
            showToast('Executive notes saved', 'success');
        });
        if (selectedId && ((_h = (_g = this.report) === null || _g === void 0 ? void 0 : _g.metadata) === null || _h === void 0 ? void 0 : _h.assessmentId) === selectedId) {
            // detail rendered inline below
        }
        return el;
    }
    async loadReport(assessmentId) {
        const data = await assessmentService.fetchReport(assessmentId);
        this.report = data.assessment;
        this.app.refreshCurrentView();
    }
    async onSubmit(e) {
        e.preventDefault();
        if (this.busy)
            return;
        const fd = new FormData(e.target);
        const payload = {
            company: String(fd.get('company') || '').trim(),
            email: String(fd.get('email') || '').trim(),
            repoUrl: String(fd.get('repoUrl') || '').trim() || undefined,
            projectPath: String(fd.get('projectPath') || '').trim() || undefined,
            assessmentType: this.form.assessmentType
        };
        if (!payload.repoUrl && !payload.projectPath) {
            showToast('Provide a repo URL or sign in with a local project path', 'error');
            return;
        }
        if (payload.projectPath && !authService.isAuthenticated()) {
            showLoginModal({ onSuccess: () => e.target.requestSubmit() });
            return;
        }
        this.busy = true;
        this.app.refreshCurrentView();
        showToast('Running Simplebeacon assessment…', 'info');
        try {
            const result = await assessmentService.runAssessment(payload);
            this.recent = assessmentService.getRecentAssessments();
            showToast(`Assessment complete — ${result.assessmentId}`, 'success');
            this.app.navigate('assessments', { id: result.assessmentId });
            const data = await assessmentService.fetchReport(result.assessmentId);
            this.report = data.assessment;
        }
        catch (err) {
            if (err.status === 401) {
                showLoginModal({ onSuccess: () => e.target.requestSubmit() });
            }
            else {
                showToast(err.message, 'error');
            }
        }
        finally {
            this.busy = false;
            this.app.refreshCurrentView();
        }
    }
    mount(container) {
        var _a, _b, _c;
        const selectedId = (_a = this.app.state.routeParams) === null || _a === void 0 ? void 0 : _a.id;
        if (selectedId) {
            if (((_c = (_b = this.report) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.assessmentId) !== selectedId) {
                assessmentService.fetchReport(selectedId)
                    .then((data) => {
                    this.report = data.assessment;
                    this.app.refreshCurrentView();
                })
                    .catch((err) => showToast(err.message, 'error'));
            }
        }
        else {
            this.report = null;
        }
        this.recent = assessmentService.getRecentAssessments();
        container.innerHTML = '';
        container.appendChild(this.render());
    }
}
