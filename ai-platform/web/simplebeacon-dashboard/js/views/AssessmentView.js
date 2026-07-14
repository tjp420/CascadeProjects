import { escapeHtml, showToast } from '../utils.js';
import { assessmentService } from '../services/assessmentService.js';
import { authService } from '../services/authService.js?v=20260713sync6';
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
    const summary = assessment.executiveSummary || {};
    const checklist = assessment.complianceChecklist || {};
    const rules = checklist.rules || [];

    return `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">Assessment report</span>
          <span class="severity-pill ${summary.gateResult === 'PASS' ? 'success' : 'danger'}">${escapeHtml(summary.gateResult || '—')}</span>
        </div>
        <p class="text-muted" style="padding:0 var(--space-4)">${escapeHtml(summary.headline || '—')}</p>
        <div class="settings-grid" style="padding:var(--space-4)">
          <div class="settings-row"><span class="settings-label">Compliance score</span><span class="settings-value">${summary.complianceScore ?? '—'}%</span></div>
          <div class="settings-row"><span class="settings-label">Ready for automation</span><span class="settings-value">${summary.complianceReady ? 'Yes' : 'No'}</span></div>
          <div class="settings-row"><span class="settings-label">High issues</span><span class="settings-value">${summary.highIssues ?? 0}</span></div>
          <div class="settings-row"><span class="settings-label">Expires</span><span class="settings-value">${escapeHtml(assessment.metadata?.expiresAt || '—')}</span></div>
        </div>
        ${rules.length ? `
          <div class="section-heading" style="padding:0 var(--space-4)"><h2>Corporate safety checklist</h2></div>
          <table class="results-table">
            <thead><tr><th>Rule</th><th>Title</th><th>Evidence</th></tr></thead>
            <tbody>${rules.map((r) => this.renderRuleRow(r)).join('')}</tbody>
          </table>
        ` : ''}
        <div class="card-actions" style="padding:var(--space-4)">
          <a class="btn btn-secondary btn-sm" href="${assessmentService.downloadUrl(assessment.metadata?.assessmentId)}" download>Download JSON</a>
        </div>
      </div>
    `;
  }

  renderRecentList() {
    if (!this.recent.length) {
      return '<p class="text-muted">No assessments yet — run your first scan above.</p>';
    }
    return `
      <table class="results-table">
        <thead><tr><th>Company</th><th>ID</th><th>When</th><th></th></tr></thead>
        <tbody>
          ${this.recent.map((item) => `
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

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    const authed = authService.isAuthenticated();
    const selectedId = this.app.state.routeParams?.id;

    el.innerHTML = `
      <h1 class="page-title">Assessment Portal</h1>
      <p class="page-subtitle">Simplebeacon scan → human triage → enterprise deliverable. Regex gate in minutes; expert review sells the audit.</p>

      <div class="card mb-4">
        <div class="card-header"><span class="card-title">New client assessment</span></div>
        <form id="assessment-form" class="settings-grid" style="padding:var(--space-4)">
          <label class="input-group">
            <span class="input-label">Company</span>
            <input class="input" name="company" required placeholder="Acme Corp" value="${escapeHtml(this.form.company)}">
          </label>
          <label class="input-group">
            <span class="input-label">Contact email</span>
            <input class="input" name="email" type="email" placeholder="cto@acme.com" value="${escapeHtml(this.form.email)}">
          </label>
          <label class="input-group">
            <span class="input-label">Git repo URL ${authed ? '(public or signed-in)' : '(required)'}</span>
            <input class="input" name="repoUrl" placeholder="https://github.com/org/repo" value="${escapeHtml(this.form.repoUrl)}">
          </label>
          ${authed ? `
          <label class="input-group">
            <span class="input-label">Local project path (signed-in only)</span>
            <input class="input" name="projectPath" placeholder="C:\\\\Projects\\\\client-repo" value="${escapeHtml(this.form.projectPath)}">
          </label>` : `
          <p class="text-muted">Sign in to scan a local path on this server instead of cloning a repo.</p>`}
          <div class="card-actions">
            <button type="submit" class="btn btn-primary" ${this.busy ? 'disabled' : ''}>
              ${this.busy ? 'Scanning…' : 'Run assessment scan'}
            </button>
          </div>
        </form>
      </div>

      <div class="card mb-4">
        <div class="card-header"><span class="card-title">Recent assessments</span></div>
        <div style="padding:var(--space-4)">${this.renderRecentList()}</div>
      </div>

      <div id="assessment-detail">${this.report ? this.renderReportDetail(this.report) : ''}</div>
    `;

    el.querySelector('#assessment-form')?.addEventListener('submit', (e) => this.onSubmit(e));
    el.querySelectorAll('[data-open-assessment]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.app.navigate('assessments', { id: btn.dataset.openAssessment });
      });
    });

    if (selectedId && this.report?.metadata?.assessmentId === selectedId) {
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
    if (this.busy) return;

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
    } catch (err) {
      if (err.status === 401) {
        showLoginModal({ onSuccess: () => e.target.requestSubmit() });
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      this.busy = false;
      this.app.refreshCurrentView();
    }
  }

  mount(container) {
    const selectedId = this.app.state.routeParams?.id;
    if (selectedId) {
      if (this.report?.metadata?.assessmentId !== selectedId) {
        assessmentService.fetchReport(selectedId)
          .then((data) => {
            this.report = data.assessment;
            this.app.refreshCurrentView();
          })
          .catch((err) => showToast(err.message, 'error'));
      }
    } else {
      this.report = null;
    }
    this.recent = assessmentService.getRecentAssessments();
    container.innerHTML = '';
    container.appendChild(this.render());
  }
}
