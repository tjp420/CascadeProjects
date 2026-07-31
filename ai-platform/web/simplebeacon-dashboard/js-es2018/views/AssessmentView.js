// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml, showToast } from '../utils.js';
import { assessmentService } from '../services/assessmentService.js';
import { authService } from '../services/authService.js?v=20260722bridgefix1';
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
      assessmentType: 'mna-audit',
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
    var _a, _b, _c, _d;
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
          <div class="settings-row"><span class="settings-label">Compliance score</span><span class="settings-value">${(_a = summary.complianceScore) !== null && _a !== void 0 ? _a : '—'}%</span></div>
          <div class="settings-row"><span class="settings-label">Ready for automation</span><span class="settings-value">${summary.complianceReady ? 'Yes' : 'No'}</span></div>
          <div class="settings-row"><span class="settings-label">High issues</span><span class="settings-value">${(_b = summary.highIssues) !== null && _b !== void 0 ? _b : 0}</span></div>
          <div class="settings-row"><span class="settings-label">Expires</span><span class="settings-value">${escapeHtml(((_c = assessment.metadata) === null || _c === void 0 ? void 0 : _c.expiresAt) || '—')}</span></div>
        </div>
        ${
          rules.length
            ? `
          <div class="section-heading" style="padding:0 var(--space-4)"><h2>Corporate safety checklist</h2></div>
          <div class="table-scroll-wrapper">
          <table class="results-table">
            <thead><tr><th scope="col">Rule</th><th scope="col">Title</th><th scope="col">Evidence</th></tr></thead>
            <tbody>${rules.map((r) => this.renderRuleRow(r)).join('')}</tbody>
          </table>
          </div>
        `
            : ''
        }
        <div class="card-actions" style="padding:var(--space-4)">
          <a class="btn btn-secondary btn-sm" href="${assessmentService.downloadUrl((_d = assessment.metadata) === null || _d === void 0 ? void 0 : _d.assessmentId)}" download>Download JSON</a>
        </div>
      </div>
    `;
  }
  renderRecentList() {
    if (!this.recent.length) {
      return '<p class="text-muted">No assessments yet — run your first scan above.</p>';
    }
    return `
      <div class="table-scroll-wrapper">
      <table class="results-table">
        <thead><tr><th scope="col">Company</th><th scope="col">ID</th><th scope="col">When</th><th scope="col"></th></tr></thead>
        <tbody>
          ${this.recent
            .map(
              (item) => `
            <tr>
              <td>${escapeHtml(item.company)}</td>
              <td><code>${escapeHtml(item.assessmentId)}</code></td>
              <td>${escapeHtml(new Date(item.createdAt).toLocaleString())}</td>
              <td><button type="button" class="btn btn-ghost btn-sm" data-open-assessment="${escapeHtml(item.assessmentId)}">View</button></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      </div>
    `;
  }
  render() {
    var _a, _b, _c, _d;
    const el = document.createElement('div');
    el.className = 'fade-in';
    const authed = authService.isAuthenticated();
    const selectedId = (_a = this.app.state.routeParams) === null || _a === void 0 ? void 0 : _a.id;
    el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Assessment Portal</h1>
        <p class="text-muted analyze-hero-sub">Simplebeacon scan → human triage → enterprise deliverable. Regex gate in minutes; expert review sells the audit.</p>
      </div>

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
          ${
            authed
              ? `
          <label class="input-group">
            <span class="input-label">Local project path (signed-in only)</span>
            <input class="input" name="projectPath" placeholder="C:\\\\Projects\\\\client-repo" value="${escapeHtml(this.form.projectPath)}">
          </label>`
              : `
          <p class="text-muted">Sign in to scan a local path on this server instead of cloning a repo.</p>`
          }
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

      <div id="assessment-detail">${this.busy ? '<div class="card" style="padding:var(--space-4);text-align:center;"><span class="loading-spinner"></span> <span class="text-muted">Running assessment scan…</span></div>' : this.report ? this.renderReportDetail(this.report) : ''}</div>
    `;
    (_b = el.querySelector('#assessment-form')) === null || _b === void 0
      ? void 0
      : _b.addEventListener('submit', (e) => this.onSubmit(e));
    el.querySelectorAll('[data-open-assessment]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.app.navigate('assessments', { id: btn.dataset.openAssessment });
      });
    });
    if (
      selectedId &&
      ((_d = (_c = this.report) === null || _c === void 0 ? void 0 : _c.metadata) === null ||
      _d === void 0
        ? void 0
        : _d.assessmentId) === selectedId
    ) {
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
      assessmentType: this.form.assessmentType,
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
    var _a, _b, _c;
    if (!authService.isAdmin()) {
      window.setSafeHTML(
        container,
        '\n                <div class="page-header"><h1>Assessments</h1></div>\n                <div class="card notice-card"><p>Admin access required.</p></div>\n            '
      );
      return;
    }
    const selectedId = (_a = this.app.state.routeParams) === null || _a === void 0 ? void 0 : _a.id;
    if (selectedId) {
      if (
        ((_c = (_b = this.report) === null || _b === void 0 ? void 0 : _b.metadata) === null ||
        _c === void 0
          ? void 0
          : _c.assessmentId) !== selectedId
      ) {
        assessmentService
          .fetchReport(selectedId)
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
    window.setSafeHTML(container, '');
    container.appendChild(this.render());
  }
}
