import { escapeHtml, formatNumber, showToast, renderEmptyState } from '../utils.js';
import { getScanFileMetrics, resolveDisplayScore } from '../services/analyzeService.js';
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
/**
 * Get remediation plan.
 * @param {boolean} issue
 * @returns {any}
 */
function getRemediationPlan(issue) {
    const type = (issue.type || '').toLowerCase();
    const ruleId = (issue.ruleId || issue.id || '').toLowerCase();
    const description = (issue.description || '').toLowerCase();
    if (ruleId.includes('deploy') || type.includes('deploy leak') || type.includes('deploy-leak')) {
        return { action: 'Move URLs to environment config or dynamic injection', effort: '10 min', category: 'Security' };
    }
    if (ruleId.includes('debug-artifact') || type.includes('debug')) {
        return { action: 'Remove debug statements', effort: '5 min', category: 'Cleanup' };
    }
    if (ruleId.includes('config-drift') || type.includes('config')) {
        return { action: 'Move to environment variables', effort: '15 min', category: 'Security' };
    }
    if (ruleId.includes('sample-json-ref') || ruleId.includes('production-leak') || type.includes('sample') || type.includes('mock')) {
        return { action: 'Replace with runtime data sources', effort: '30 min', category: 'Data' };
    }
    if (ruleId.includes('missing-security-header') || type.includes('security header')) {
        return { action: 'Add helmet/CSP middleware', effort: '20 min', category: 'Security' };
    }
    if (ruleId.includes('governance-marker') || type.includes('license')) {
        return { action: 'Review license compatibility', effort: '10 min', category: 'Legal' };
    }
    if (ruleId.includes('multi-lang-debug')) {
        return { action: 'Remove multi-language debug output', effort: '5 min', category: 'Cleanup' };
    }
    if (type.includes('credential') || type.includes('secret')) {
        return { action: 'Rotate secrets && use env vars', effort: '30 min', category: 'Security' };
    }
    if (type.includes('eslint') || type.includes('lint')) {
        return { action: 'Fix linting violations', effort: '10 min', category: 'Quality' };
    }
    if (type.includes('empty file')) {
        return { action: 'Remove or populate empty files', effort: '5 min', category: 'Cleanup' };
    }
    if (type.includes('invalid json')) {
        return { action: 'Fix JSON syntax errors', effort: '10 min', category: 'Quality' };
    }
    if (type.includes('todo') || type.includes('fixme')) {
        return { action: 'Address technical debt marker', effort: '20 min', category: 'Debt' };
    }
    if (type.includes('missing-env-key')) {
        return { action: 'Add missing key to .env file', effort: '5 min', category: 'Config' };
    }
    if (type.includes('build-artifact')) {
        return { action: 'Add to .gitignore or remove from repo', effort: '5 min', category: 'Cleanup' };
    }
    if (description.includes('placeholder') || description.includes('fictional') || description.includes('mock')) {
        return { action: 'Replace with production data', effort: '20 min', category: 'Data' };
    }
    return { action: issue.recommendedAction || 'Review && remediate', effort: '20 min', category: 'General' };
}
/**
 * Group issues by category.
 * @param {Array} issues
 * @returns {any}
 */
function groupIssuesByCategory(issues) {
    const groups = {};
    for (const issue of issues) {
        const plan = getRemediationPlan(issue);
        const cat = plan.category;
        if (!groups[cat])
            groups[cat] = [];
        groups[cat].push({ ...issue, plan });
    }
    return groups;
}
/**
 * Sort by severity.
 * @param {Array} issues
 * @returns {any}
 */
function sortBySeverity(issues) {
    return [...issues].sort((a, b) => {
        var _a, _b;
        const sa = (_a = SEVERITY_ORDER[a.severity]) !== null && _a !== void 0 ? _a : 99;
        const sb = (_b = SEVERITY_ORDER[b.severity]) !== null && _b !== void 0 ? _b : 99;
        if (sa !== sb)
            return sa - sb;
        return (a.filePath || '').localeCompare(b.filePath || '');
    });
}
/**
 * Convert phases to issues.
 * @param {Array} phases
 * @param {any} summary
 * @returns {any}
 */
function convertPhasesToIssues(phases, summary) {
    const issues = [];
    let idx = 0;
    for (const phase of phases || []) {
        // Structured task-based phases (remediation export / manual input)
        if (Array.isArray(phase.tasks) && phase.tasks.length) {
            for (const task of phase.tasks) {
                issues.push({
                    id: 'roadmap-' + (phase.id || idx) + '-' + idx++,
                    severity: ['critical', 'high', 'medium', 'low', 'info'].includes(phase.severity) ? phase.severity : 'medium',
                    type: phase.id || phase.phase || 'phase',
                    category: (phase.title || '').replace(/^Phase \d+:\s*/, '') || phase.id || phase.phase || 'Phase',
                    description: task.description,
                    filePath: task.location || '-',
                    action: task.type === 'fix' ? 'Fix required' : task.type === 'verify' ? 'Verify' : task.type === 'audit' ? 'Audit' : task.type === 'doc' ? 'Document' : 'Review',
                    _phaseId: phase.id,
                    _phaseTitle: phase.title,
                    _phaseDependsOn: phase.dependsOn,
                    _phaseDescription: phase.description,
                    _taskType: task.type,
                    _codeSnippet: task.codeSnippet,
                    _isStructured: task.isStructured,
                    effort: phase.effort || '20 min',
                    completed: task.done || false
                });
            }
            continue;
        }
        // Sprint-model developmentPhases (code-roadmap-generator output)
        const phaseLabel = phase.phase || phase.name || phase.title || 'Phase';
        const severity = phase.status === 'completed' ? 'info'
            : phase.status === 'in-progress' ? 'medium'
                : phase.progress >= 50 ? 'medium' : 'low';
        const descriptionParts = [phase.description].filter(Boolean);
        if (Array.isArray(phase.features) && phase.features.length) {
            descriptionParts.push('Features: ' + phase.features.join('; '));
        }
        if (Array.isArray(phase.milestones) && phase.milestones.length) {
            descriptionParts.push('Milestones: ' + phase.milestones.join('; '));
        }
        const action = phase.status === 'completed' ? 'Completed'
            : phase.status === 'in-progress' ? 'In progress'
                : 'Planned';
        issues.push({
            id: 'roadmap-' + (phase.id || slugify(phaseLabel)) + '-' + idx++,
            severity,
            type: phase.id || slugify(phaseLabel),
            category: phaseLabel.replace(/^Phase \d+:\s*/, ''),
            description: descriptionParts.join(' — ') || phaseLabel,
            filePath: '-',
            action,
            _phaseId: phase.id,
            _phaseTitle: phaseLabel,
            _phaseDescription: phase.description,
            _phaseProgress: phase.progress,
            _phaseStatus: phase.status,
            effort: '—',
            completed: phase.status === 'completed' || phase.progress >= 100
        });
    }
    return { issues, exportedAt: (summary === null || summary === void 0 ? void 0 : summary.exportedAt) || null };
}
/**
 * Slugify.
 * @param {string} text
 * @returns {any}
 */
function slugify(text) {
    return String(text || 'phase')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
/**
 * Remediation roadmap view.
 */
export class RemediationRoadmapView {
    constructor(app) {
        this.app = app;
        this._mountRoot = null;
        this._hasPainted = false;
        this.selectedCategory = 'all';
        this.showCompleted = false;
        this.searchQuery = '';
        this.currentPage = 1;
        this.pageSize = 25;
        this.completed = new Set(JSON.parse(localStorage.getItem('sb-remediation-completed') || '[]'));
        this.importedIssues = JSON.parse(localStorage.getItem('sb-remediation-imported') || '[]');
        this.importedAt = localStorage.getItem('sb-remediation-imported-at') || null;
    }
    getIssues() {
        const report = this.app.state.report;
        const raw = report === null || report === void 0 ? void 0 : report.rawIssues;
        const detected = report === null || report === void 0 ? void 0 : report.detectedIssues;
        const source = (Array.isArray(raw) && raw.length) ? raw
            : (Array.isArray(detected) && detected.length) ? detected
                : [];
        const liveIssues = source.map((issue, index) => {
            var _a, _b;
            return ({
                ...issue,
                id: issue.id || `${issue.severity}|${issue.type}|${issue.description}|${index}`,
                filePath: issue.filePath || ((_a = issue.filePaths) === null || _a === void 0 ? void 0 : _a[0]) || ((_b = issue.affectedFiles) === null || _b === void 0 ? void 0 : _b[0]) || '—'
            });
        });
        // Merge imported issues that no longer appear in live scan
        const liveIds = new Set(liveIssues.map(i => i.id));
        const merged = [...liveIssues];
        for (const imp of this.importedIssues) {
            if (!liveIds.has(imp.id)) {
                merged.push(imp);
                // Auto-complete fixed deploy leaks
                if ((imp.type || '').toLowerCase().includes('deploy leak')) {
                    this.completed.add(imp.id);
                }
            }
        }
        return merged;
    }
    async ensureReportFresh() {
        var _a, _b;
        const report = this.app.state.report;
        const hasLive = (Array.isArray(report === null || report === void 0 ? void 0 : report.rawIssues) && report.rawIssues.length > 0)
            || (Array.isArray(report === null || report === void 0 ? void 0 : report.detectedIssues) && report.detectedIssues.length > 0);
        if (hasLive)
            return;
        try {
            const fresh = await this.app.scanService.fetchReport();
            if (fresh && (((_a = fresh.rawIssues) === null || _a === void 0 ? void 0 : _a.length) || ((_b = fresh.detectedIssues) === null || _b === void 0 ? void 0 : _b.length))) {
                this.app.state.report = fresh;
            }
        }
        catch (_c) {
            // No report on disk yet — keep current state
        }
    }
    getSummaryStats(issues) {
        const total = issues.length;
        const completed = issues.filter(i => this.completed.has(i.id)).length;
        const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        const byCategory = {};
        let totalEffortMin = 0;
        for (const issue of issues) {
            bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
            const plan = getRemediationPlan(issue);
            byCategory[plan.category] = (byCategory[plan.category] || 0) + 1;
            const mins = parseInt(plan.effort, 10) || 20;
            if (!this.completed.has(issue.id))
                totalEffortMin += mins;
        }
        return { total, completed, remaining: total - completed, bySeverity, byCategory, totalEffortMin };
    }
    renderProgressBar(completed, total) {
        if (!total)
            return '';
        const pct = Math.round((completed / total) * 100);
        return `
      <div class="rm-v3-card" style="padding:18px 22px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-weight:700;font-size:0.85rem;color:var(--text-primary);">📊 Progress: ${completed}/${total} completed</span>
          <span style="font-weight:800;font-size:1.1rem;color:#22c55e;">${pct}%</span>
        </div>
        <div class="rm-v3-progress-bg">
          <div class="rm-v3-progress-fill" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
    }
    renderCategoryFilter(categories) {
        const items = ['all', ...Object.keys(categories).sort()];
        return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">
        ${items.map(cat => `
          <button class="rm-v3-filter-chip ${cat === this.selectedCategory ? 'active' : ''}" data-filter="${escapeHtml(cat)}">
            ${escapeHtml(cat === 'all' ? 'All Categories' : cat)} ${cat !== 'all' ? `(${categories[cat]})` : ''}
          </button>
        `).join('')}
        <label for="show-completed" style="display:flex;align-items:center;gap:6px;margin-left:auto;font-size:0.78rem;color:var(--text-secondary);cursor:pointer;">
          <input type="checkbox" id="show-completed" aria-label="Show completed" ${this.showCompleted ? 'checked' : ''}>
          Show completed
        </label>
      </div>
    `;
    }
    renderPhaseHeader(phaseId, phaseTitle, phaseDescription, phaseDependsOn) {
        if (!phaseId)
            return '';
        const blocked = phaseDependsOn ? `<span class="pill" style="background:rgba(245,158,11,0.15);color:#fbbf24;font-size:0.72rem;">⚠️ Blocked by ${escapeHtml(phaseDependsOn)}</span>` : '';
        return `
      <div class="rm-v3-phase">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong style="font-size:0.85rem;color:var(--text-primary);">${escapeHtml(phaseTitle || phaseId)}</strong>
          ${blocked}
        </div>
        ${phaseDescription ? `<p style="margin:6px 0 0;font-size:0.75rem;color:var(--text-muted);line-height:1.4;">${escapeHtml(phaseDescription)}</p>` : ''}
      </div>
    `;
    }
    renderIssueCard(issue) {
        const plan = getRemediationPlan(issue);
        const isDone = this.completed.has(issue.id);
        const sevClass = issue.severity || 'low';
        const sevColor = sevClass === 'critical' ? '#ef4444' : sevClass === 'high' ? '#f97316' : sevClass === 'medium' ? '#eab308' : sevClass === 'low' ? '#3b82f6' : '#22c55e';
        return `
      <div class="rm-v3-issue severity-${sevClass} ${isDone ? 'completed' : ''}" data-id="${escapeHtml(issue.id)}">
        <div style="padding:14px 16px;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <input type="checkbox" class="roadmap-check" data-id="${escapeHtml(issue.id)}" ${isDone ? 'checked' : ''}
              style="width:20px;height:20px;margin-top:2px;cursor:pointer;accent-color:var(--accent);flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <span class="pill ${sevClass}">${escapeHtml(issue.severity || 'info')}</span>
                <span class="pill" style="background:rgba(148,163,184,0.1);color:var(--text-secondary);">${escapeHtml(plan.category)}</span>
                <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto;font-weight:600;">${escapeHtml(plan.effort)}</span>
              </div>
              <div style="font-weight:700;margin-bottom:4px;word-break:break-word;color:var(--text-primary);font-size:0.9rem;">${escapeHtml(issue.type || 'Issue')}</div>
              <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:4px;line-height:1.5;">${escapeHtml(issue.description || '')}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);background:rgba(148,163,184,0.04);padding:4px 8px;border-radius:6px;display:inline-block;">${escapeHtml(issue.filePath || '—')}</div>
              ${issue._codeSnippet ? `<pre style="margin:10px 0 0;padding:10px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(148,163,184,0.1);border-radius:10px;font-size:0.72rem;font-family:var(--font-mono);overflow-x:auto;"><code>${escapeHtml(issue._codeSnippet)}</code></pre>` : ''}
            </div>
          </div>
        </div>
        <div style="padding:10px 16px;border-top:1px dashed rgba(148,163,184,0.1);font-size:0.82rem;color:var(--text-secondary);background:rgba(148,163,184,0.02);">
          <strong style="color:${sevColor};">Action:</strong> ${escapeHtml(plan.action)}
        </div>
      </div>
    `;
    }
    exportToJson(issues) {
        const payload = {
            exportedAt: new Date().toISOString(),
            totalIssues: issues.length,
            completed: [...this.completed],
            issues: issues.map(issue => {
                const plan = getRemediationPlan(issue);
                return {
                    id: issue.id,
                    severity: issue.severity,
                    type: issue.type,
                    category: plan.category,
                    description: issue.description,
                    filePath: issue.filePath,
                    action: plan.action,
                    effort: plan.effort,
                    completed: this.completed.has(issue.id)
                };
            })
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `remediation-roadmap-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Remediation roadmap exported as JSON');
    }
    compileMarkdownPRSummary() {
        const issues = this.getIssues();
        const completedList = issues.filter((item) => this.completed.has(item.id));
        const remainingList = issues.filter((item) => !this.completed.has(item.id));
        const totalCount = issues.length;
        const completedCount = completedList.length;
        const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        completedList.forEach((item) => {
            const sev = (item.severity || 'low').toLowerCase();
            if (counts[sev] !== undefined)
                counts[sev]++;
        });
        let md = '## 🛡️ SimpleBeacon Code Hygiene Summary\n\n';
        md += '> **Automated Code Check Verification Gate**\n';
        md += `> 📊 **Remediation Progress:** ${completedCount} / ${totalCount} Tasks Resolved (${progressPercent}% Plan Cleared)\n\n`;
        md += '### 📈 Cleanup Resolution Impact\n';
        md += '```text\n';
        md += `🚨 Critical Fixed : ${counts.critical || 0}\n`;
        md += `🔥 High Fixed     : ${counts.high || 0}\n`;
        md += `⚠️ Medium Fixed   : ${counts.medium || 0}\n`;
        md += `💡 Low/Info Fixed : ${counts.low || 0}\n`;
        md += '```\n\n';
        md += '### ✅ Resolved Codebase Tasks\n';
        if (completedList.length === 0) {
            md += '- *No tasks flagged as completed during this remediation window.*\n';
        }
        else {
            completedList.forEach((item) => {
                const displayPath = item.filePath ? ` \`@ ${item.filePath}\`` : '';
                md += `- [x] **[${(item.severity || 'INFO').toUpperCase()}]** ${escapeHtml(item.title || item.type || 'Issue')} — *${escapeHtml(item.description || '')}*${displayPath}\n`;
            });
        }
        md += '\n';
        md += '### ⏳ Deferred Workspace Contexts (Remaining Backlog)\n';
        if (remainingList.length === 0) {
            md += '- [x] **All identified hygiene targets fully cleared! Baseline is deployment-ready.** 🚀\n';
        }
        else {
            remainingList.forEach((item) => {
                const displayPath = item.filePath ? ` \`@ ${item.filePath}\`` : '';
                md += `- [ ] **[${(item.severity || 'INFO').toUpperCase()}]** ${escapeHtml(item.title || item.type || 'Issue')} — *${escapeHtml(item.description || '')}*${displayPath}\n`;
            });
            md += '\n*Note: Remaining issues are non-blocking or scheduled for optimization within the next sprint allocation matrix.*';
        }
        md += '\n\n---\n*Generated via **SimpleBeacon AI** vsix-merged telemetry portal dashboard.*';
        return md;
    }
    showPRPreviewDrawer(markdownContent) {
        var _a, _b;
        const existing = document.getElementById('pr-summary-preview-drawer-wrapper');
        if (existing)
            existing.remove();
        const wrapper = document.createElement('div');
        wrapper.id = 'pr-summary-preview-drawer-wrapper';
        wrapper.innerHTML = `
      <div class="pr-drawer-overlay"></div>
      <div class="pr-preview-drawer-content">
        <div class="drawer-header-bar">
          <div class="header-title">
            <i data-lucide="git-pull-request" class="icon-16"></i>
            <h4>Git Pull Request Description Preview</h4>
          </div>
          <button type="button" class="close-drawer-btn" id="close-pr-drawer-btn">×</button>
        </div>
        <p class="drawer-instruction-text">Copy this markdown template block straight into your GitHub, GitLab, or Bitbucket pull request text fields.</p>
        <div class="pr-markdown-scroll-box">
          <pre><code id="pr-summary-raw-pre">${escapeHtml(markdownContent)}</code></pre>
        </div>
        <div class="drawer-footer-actions">
          <button type="button" class="btn btn-primary" id="copy-pr-snippet-inner-btn">
            <i data-lucide="copy" class="icon-14"></i> Copy to Clipboard
          </button>
        </div>
      </div>
    `;
        document.body.appendChild(wrapper);
        const closeDrawer = () => wrapper.remove();
        (_a = wrapper.querySelector('.pr-drawer-overlay')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', closeDrawer);
        (_b = wrapper.querySelector('#close-pr-drawer-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', closeDrawer);
        const copyBtn = wrapper.querySelector('#copy-pr-snippet-inner-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const raw = wrapper.querySelector('#pr-summary-raw-pre');
                if (!raw)
                    return;
                navigator.clipboard.writeText(raw.innerText).then(() => {
                    copyBtn.innerHTML = `<i data-lucide="check" class="icon-14"></i> Copied!`;
                    copyBtn.classList.add('success');
                    setTimeout(() => {
                        copyBtn.innerHTML = `<i data-lucide="copy" class="icon-14"></i> Copy to Clipboard`;
                        copyBtn.classList.remove('success');
                    }, 1800);
                }).catch(() => showToast('Clipboard unavailable', 'error'));
            });
        }
    }
    importFromJson(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.importFromText(e.target.result);
            }
            catch (err) {
                showToast('Failed to parse JSON: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }
    async importFromZip(file) {
        if (typeof window.JSZip === 'undefined') {
            showToast('ZIP support not available — please extract the JSON file manually', 'error');
            return;
        }
        try {
            const zip = await window.JSZip.loadAsync(file);
            const jsonFiles = [];
            zip.forEach((relativePath, zipEntry) => {
                if (relativePath.toLowerCase().endsWith('.json') && !zipEntry.dir) {
                    jsonFiles.push(zipEntry);
                }
            });
            if (!jsonFiles.length) {
                showToast('No JSON files found in ZIP', 'error');
                return;
            }
            // Prioritize known report filenames, then pick the largest JSON
            const priorityNames = ['report', 'scan', 'roadmap', 'simplebeacon', 'complete'];
            jsonFiles.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aPriority = priorityNames.some(p => aName.includes(p)) ? 1 : 0;
                const bPriority = priorityNames.some(p => bName.includes(p)) ? 1 : 0;
                if (aPriority !== bPriority)
                    return bPriority - aPriority;
                return (b._data.uncompressedSize || 0) - (a._data.uncompressedSize || 0);
            });
            let importedCount = 0;
            for (const entry of jsonFiles) {
                const text = await entry.async('text');
                try {
                    const data = JSON.parse(text.trim());
                    // Skip manifest-only files and tiny metadata JSONs
                    if (data.manifest && Object.keys(data).length === 1)
                        continue;
                    this.importFromText(text);
                    importedCount++;
                    // Only import the first matching report
                    break;
                }
                catch (_a) {
                    // Continue to next file
                }
            }
            if (!importedCount) {
                showToast('Could not import any report from ZIP', 'error');
            }
        }
        catch (err) {
            showToast('Failed to read ZIP: ' + err.message, 'error');
        }
    }
    importFromText(text) {
        var _a, _b, _c, _d, _e, _f;
        try {
            let data = JSON.parse(text.trim());
            let issues = [];
            let metaExportedAt = null;
            // Normalize step-level wrapper: { id: 'roadmap', data: { roadmap: {...} } }
            if (data.id === 'roadmap' && ((_a = data.data) === null || _a === void 0 ? void 0 : _a.roadmap)) {
                data = data.data;
            }
            // Normalize data-level wrapper: { roadmap: {...} }
            if (data.roadmap && !data.type && !Array.isArray(data.issues) && !Array.isArray(data.phases)) {
                data = data.roadmap;
            }
            // Normalize complete-scan wrapper to extract roadmap
            if (data.type === 'simplebeacon-complete-scan' && ((_b = data.results) === null || _b === void 0 ? void 0 : _b.roadmap)) {
                const roadmap = data.results.roadmap;
                if (Array.isArray(roadmap.phases) && roadmap.phases.length) {
                    data = { phases: roadmap.phases, summary: roadmap.summary || data.summary };
                }
                else if (Array.isArray(roadmap.developmentPhases) && roadmap.developmentPhases.length) {
                    data = { phases: roadmap.developmentPhases, summary: roadmap.summary || data.summary };
                }
                else if (Array.isArray(roadmap.implementationPhases) && roadmap.implementationPhases.length) {
                    data = { phases: roadmap.implementationPhases, summary: roadmap.summary || data.summary };
                }
                else if (Array.isArray(roadmap.issues) && roadmap.issues.length) {
                    data = { issues: roadmap.issues, metadata: { exportedAt: data.generatedAt } };
                }
            }
            // Normalize raw simplebeacon report with issues
            if (data.type === 'simplebeacon-report') {
                const sourceIssues = ((_c = data.rawIssues) === null || _c === void 0 ? void 0 : _c.length) ? data.rawIssues : (data.detectedIssues || []);
                if (sourceIssues.length) {
                    data = { issues: sourceIssues, metadata: { exportedAt: data.generatedAt || data.scannedAt } };
                }
            }
            // Normalize complete-scan wrapper to extract simplebeacon rawIssues when no roadmap
            if (data.type === 'simplebeacon-complete-scan' && !data.issues && !data.phases) {
                const sb = (_d = data.results) === null || _d === void 0 ? void 0 : _d.simplebeacon;
                if (sb) {
                    const sourceIssues = ((_e = sb.rawIssues) === null || _e === void 0 ? void 0 : _e.length) ? sb.rawIssues : (sb.detectedIssues || []);
                    if (sourceIssues.length) {
                        data = { issues: sourceIssues, metadata: { exportedAt: data.generatedAt } };
                    }
                }
            }
            if (Array.isArray(data.issues) && data.issues.length) {
                issues = data.issues;
                metaExportedAt = (_f = data.metadata) === null || _f === void 0 ? void 0 : _f.exportedAt;
            }
            else if (Array.isArray(data.phases) && data.phases.length) {
                const converted = convertPhasesToIssues(data.phases, data.summary);
                issues = converted.issues;
                metaExportedAt = converted.exportedAt;
            }
            else if (Array.isArray(data.developmentPhases) && data.developmentPhases.length) {
                const converted = convertPhasesToIssues(data.developmentPhases, data.summary);
                issues = converted.issues;
                metaExportedAt = converted.exportedAt;
            }
            else if (Array.isArray(data.implementationPhases) && data.implementationPhases.length) {
                const converted = convertPhasesToIssues(data.implementationPhases, data.summary);
                issues = converted.issues;
                metaExportedAt = converted.exportedAt;
            }
            else {
                showToast('Invalid roadmap JSON — missing issues or phases array', 'error');
                return;
            }
            this.importedIssues = issues.map(issue => ({
                id: issue.id,
                severity: issue.severity,
                type: issue.type,
                category: issue.category,
                description: issue.description,
                filePath: issue.filePath,
                action: issue.action,
                effort: issue.effort,
                completed: issue.completed || false
            }));
            this.importedAt = metaExportedAt || data.exportedAt || new Date().toISOString();
            localStorage.setItem('sb-remediation-imported', JSON.stringify(this.importedIssues));
            localStorage.setItem('sb-remediation-imported-at', this.importedAt);
            for (const issue of this.importedIssues) {
                if (issue.completed)
                    this.completed.add(issue.id);
            }
            localStorage.setItem('sb-remediation-completed', JSON.stringify([...this.completed]));
            showToast(`Imported ${this.importedIssues.length} issues from JSON text`);
            this.refreshView();
        }
        catch (err) {
            showToast('Failed to parse JSON: ' + err.message, 'error');
        }
    }
    renderSearchBar() {
        return `
      <div style="margin-bottom:14px;">
        <input type="text" id="remediation-search" class="rm-v3-search"
          placeholder="🔍 Search tasks by type, file, or description…"
          value="${escapeHtml(this.searchQuery)}"
          aria-label="Search remediation tasks">
      </div>
    `;
    }
    renderPagination(totalItems, currentPage, totalPages) {
        if (totalPages <= 1)
            return '';
        const start = (currentPage - 1) * this.pageSize + 1;
        const end = Math.min(currentPage * this.pageSize, totalItems);
        const prevDisabled = currentPage <= 1 ? 'disabled' : '';
        const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
        return `
      <div class="roadmap-pagination" style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-3);padding:var(--space-2) 0;border-top:1px solid var(--border);">
        <span style="font-size:var(--font-size-sm);color:var(--text-muted);">Showing <strong>${formatNumber(start)}–${formatNumber(end)}</strong> of <strong>${formatNumber(totalItems)}</strong></span>
        <div style="display:flex;gap:var(--space-2);">
          <button class="btn btn-secondary btn-sm" id="remediation-prev-page" ${prevDisabled} style="min-width:80px;">← Prev</button>
          <span style="font-size:var(--font-size-sm);color:var(--text-secondary);align-self:center;">Page ${formatNumber(currentPage)} / ${formatNumber(totalPages)}</span>
          <button class="btn btn-secondary btn-sm" id="remediation-next-page" ${nextDisabled} style="min-width:80px;">Next →</button>
        </div>
      </div>
    `;
    }
    renderBottomTotals(stats) {
        const effortHours = Math.ceil(stats.totalEffortMin / 60);
        const effortLabel = effortHours < 1 ? `${stats.totalEffortMin} min` : `~${effortHours}h`;
        return `
      <div class="rm-v3-bottom">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div style="display:grid;grid-template-columns:repeat(4,auto);gap:14px;">
            <div class="rm-v3-kpi" style="margin-bottom:0;">
              <div class="rm-v3-kpi-icon" style="background:rgba(99,102,241,0.15);color:#a78bfa;">📋</div>
              <div><div class="rm-v3-kpi-val">${formatNumber(stats.total)}</div><div class="rm-v3-kpi-label">Total</div></div>
            </div>
            <div class="rm-v3-kpi" style="margin-bottom:0;">
              <div class="rm-v3-kpi-icon" style="background:rgba(34,197,94,0.15);color:#4ade80;">✅</div>
              <div><div class="rm-v3-kpi-val" style="color:#4ade80;">${formatNumber(stats.completed)}</div><div class="rm-v3-kpi-label">Completed</div></div>
            </div>
            <div class="rm-v3-kpi" style="margin-bottom:0;">
              <div class="rm-v3-kpi-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24;">⏳</div>
              <div><div class="rm-v3-kpi-val" style="color:#fbbf24;">${formatNumber(stats.remaining)}</div><div class="rm-v3-kpi-label">Remaining</div></div>
            </div>
            <div class="rm-v3-kpi" style="margin-bottom:0;">
              <div class="rm-v3-kpi-icon" style="background:rgba(6,182,212,0.15);color:#67e8f9;">⏱️</div>
              <div><div class="rm-v3-kpi-val">${effortLabel}</div><div class="rm-v3-kpi-label">Est. Effort</div></div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${stats.bySeverity.critical ? `<span class="pill critical" style="font-size:0.72rem;">${formatNumber(stats.bySeverity.critical)} critical</span>` : ''}
            ${stats.bySeverity.high ? `<span class="pill high" style="font-size:0.72rem;">${formatNumber(stats.bySeverity.high)} high</span>` : ''}
            ${stats.bySeverity.medium ? `<span class="pill medium" style="font-size:0.72rem;">${formatNumber(stats.bySeverity.medium)} medium</span>` : ''}
            ${stats.bySeverity.low ? `<span class="pill low" style="font-size:0.72rem;">${formatNumber(stats.bySeverity.low)} low</span>` : ''}
            ${stats.bySeverity.info ? `<span class="pill info" style="font-size:0.72rem;">${formatNumber(stats.bySeverity.info)} info</span>` : ''}
          </div>
        </div>
      </div>
    `;
    }
    openImportPopup() {
        if (document.getElementById('sb-import-modal-overlay'))
            return;
        const self = this;
        const overlay = document.createElement('div');
        overlay.id = 'sb-import-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;';
        const panel = document.createElement('div');
        panel.style.cssText = 'width:90%;max-width:840px;max-height:90vh;overflow:auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:30px;color:#e6edf3;font-family:sans-serif;font-size:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5);';
        panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:1.1rem;color:#e6edf3;">Import Remediation Data</h3>
        <button id="sb-import-close" style="background:none;border:none;color:#8b949e;cursor:pointer;font-size:1.2rem;line-height:1;">&times;</button>
      </div>
      <label style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#8b949e;margin-bottom:8px;display:block;">Paste JSON directly</label>
      <textarea id="sb-import-json" placeholder='{"issues": [{"id":"1","severity":"high","type":"Credential leak","category":"Security","description":"...","filePath":"...","action":"...","effort":"30 min","completed":false}]}'
        style="width:100%;min-height:180px;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:10px;color:#e6edf3;font-family:monospace;font-size:12px;resize:vertical;box-sizing:border-box;"></textarea>
      <div id="sb-import-dropzone" style="margin-top:12px;padding:16px;border:2px dashed #30363d;border-radius:8px;text-align:center;cursor:pointer;transition:border-color 0.2s;">
        <strong>Drag &amp; drop</strong> a JSON or ZIP file here
        <div style="color:#8b949e;font-size:12px;margin-top:4px;">Supports scan report JSON and export-bundle ZIP files</div>
      </div>
      <input type="file" id="sb-import-file" accept=".json,.zip" style="display:none;">
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
        <button id="sb-import-choose" style="padding:6px 14px;border:1px solid #30363d;border-radius:8px;background:#0d1117;color:#e6edf3;cursor:pointer;font-size:13px;">Choose File</button>
        <button id="sb-import-submit" style="padding:6px 14px;border:1px solid #58a6ff;border-radius:8px;background:#58a6ff;color:#fff;cursor:pointer;font-size:13px;">Import from JSON</button>
      </div>
      <p style="color:#8b949e;font-size:12px;margin-top:12px;">Tip: Use the <strong>Analyze</strong> page to run a scan, then drag the downloaded file here.</p>
    `;
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        const closeBtn = panel.querySelector('#sb-import-close');
        const dropZone = panel.querySelector('#sb-import-dropzone');
        const fileInput = panel.querySelector('#sb-import-file');
        const jsonInput = panel.querySelector('#sb-import-json');
        const importBtn = panel.querySelector('#sb-import-submit');
        const chooseBtn = panel.querySelector('#sb-import-choose');
        function close() { overlay.remove(); }
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay)
            close(); });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#58a6ff'; });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.style.borderColor = '#30363d'; });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#30363d';
            const file = e.dataTransfer.files[0];
            if (!file)
                return;
            close();
            if (file.name.toLowerCase().endsWith('.zip'))
                self.importFromZip(file);
            else if (file.name.toLowerCase().endsWith('.json'))
                self.importFromJson(file);
            else
                showToast('Please drop a .json or .zip file', 'warning');
        });
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file)
                return;
            close();
            if (file.name.toLowerCase().endsWith('.zip'))
                self.importFromZip(file);
            else if (file.name.toLowerCase().endsWith('.json'))
                self.importFromJson(file);
        });
        chooseBtn.addEventListener('click', () => fileInput.click());
        importBtn.addEventListener('click', () => {
            const text = jsonInput.value.trim();
            if (!text) {
                showToast('Paste JSON data first', 'warning');
                return;
            }
            close();
            self.importFromText(text);
        });
        jsonInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                importBtn.click();
            }
        });
    }
    renderJsonPasteBox() {
        return `
      <div class="roadmap-json-paste" style="margin-bottom:var(--space-3);padding:var(--space-3);background:var(--surface-elevated);border:1px solid var(--border);border-radius:var(--radius-md);text-align:center;">
        <button class="btn btn-secondary" id="open-import-modal-btn" style="display:inline-flex;align-items:center;gap:var(--space-2);">
          <span>&#128206;</span> Import Scan Data
        </button>
        <p style="font-size:var(--font-size-xs);color:var(--text-muted);margin:var(--space-2) 0 0 0;">
          Paste JSON or drag & drop a scan report file to generate your remediation roadmap.
        </p>
      </div>
    `;
    }
    renderRoadmap(issues) {
        if (!issues.length) {
            return `
        ${renderEmptyState({
                icon: '🗺️',
                title: 'No scan report loaded',
                body: 'Run Simplebeacon Scan to generate a remediation roadmap.',
                iconWrapper: 'emoji'
            })}
      `;
        }
        const stats = this.getSummaryStats(issues);
        const grouped = groupIssuesByCategory(issues);
        let filtered = this.selectedCategory === 'all'
            ? issues
            : (grouped[this.selectedCategory] || []);
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(i => (i.type || '').toLowerCase().includes(q) ||
                (i.description || '').toLowerCase().includes(q) ||
                (i.filePath || '').toLowerCase().includes(q) ||
                (i.category || '').toLowerCase().includes(q));
        }
        const visible = this.showCompleted ? filtered : filtered.filter(i => !this.completed.has(i.id));
        const sorted = sortBySeverity(visible);
        const totalPages = Math.max(1, Math.ceil(sorted.length / this.pageSize));
        const safePage = Math.min(this.currentPage, totalPages);
        if (safePage !== this.currentPage)
            this.currentPage = safePage;
        const startIndex = (safePage - 1) * this.pageSize;
        const paginated = sorted.slice(startIndex, startIndex + this.pageSize);
        const effortHours = Math.ceil(stats.totalEffortMin / 60);
        const effortLabel = effortHours < 1 ? `${stats.totalEffortMin} min` : `~${effortHours}h`;
        const importBadge = this.importedAt
            ? `<span class="badge badge-info" style="font-size:var(--font-size-xs);">Imported ${new Date(this.importedAt).toLocaleDateString()}</span>`
            : '';
        const searchHits = this.searchQuery
            ? `<span class="text-muted" style="font-size:var(--font-size-xs);">Showing ${formatNumber(sorted.length)} of ${formatNumber(issues.length)} issues</span>`
            : '';
        return `
      ${this.renderProgressBar(stats.completed, stats.total)}

      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px;">
        <div class="rm-v3-kpi" style="margin-bottom:0;">
          <div class="rm-v3-kpi-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24;">⏳</div>
          <div><div class="rm-v3-kpi-val">${formatNumber(stats.remaining)}</div><div class="rm-v3-kpi-label">Remaining</div></div>
        </div>
        <div class="rm-v3-kpi" style="margin-bottom:0;">
          <div class="rm-v3-kpi-icon" style="background:rgba(99,102,241,0.15);color:#a78bfa;">📋</div>
          <div><div class="rm-v3-kpi-val">${formatNumber(stats.total)}</div><div class="rm-v3-kpi-label">Total</div></div>
        </div>
        <div class="rm-v3-kpi" style="margin-bottom:0;">
          <div class="rm-v3-kpi-icon" style="background:rgba(239,68,68,0.15);color:#f87171;">🔴</div>
          <div><div class="rm-v3-kpi-val" style="color:#f87171;">${formatNumber(stats.bySeverity.critical || 0)}</div><div class="rm-v3-kpi-label">Critical</div></div>
        </div>
        <div class="rm-v3-kpi" style="margin-bottom:0;">
          <div class="rm-v3-kpi-icon" style="background:rgba(249,115,22,0.15);color:#fb923c;">🟠</div>
          <div><div class="rm-v3-kpi-val" style="color:#fb923c;">${formatNumber(stats.bySeverity.high || 0)}</div><div class="rm-v3-kpi-label">High</div></div>
        </div>
        <div class="rm-v3-kpi" style="margin-bottom:0;">
          <div class="rm-v3-kpi-icon" style="background:rgba(234,179,8,0.15);color:#facc15;">🟡</div>
          <div><div class="rm-v3-kpi-val" style="color:#facc15;">${formatNumber(stats.bySeverity.medium || 0)}</div><div class="rm-v3-kpi-label">Medium</div></div>
        </div>
        <div class="rm-v3-kpi" style="margin-bottom:0;">
          <div class="rm-v3-kpi-icon" style="background:rgba(6,182,212,0.15);color:#67e8f9;">⏱️</div>
          <div><div class="rm-v3-kpi-val">${effortLabel}</div><div class="rm-v3-kpi-label">Est. Effort</div></div>
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" id="open-import-modal-btn" style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">
          <span>&#128206;</span> Import
        </button>
        ${importBadge}
        ${searchHits}
        <div style="display:flex;gap:6px;margin-left:auto;">
          <button class="btn btn-ghost btn-sm" id="export-remediation-markdown" style="white-space:nowrap;">Copy Markdown</button>
          <button class="btn btn-ghost btn-sm" id="export-remediation-summary" style="white-space:nowrap;">Copy Summary</button>
          <button class="btn btn-primary btn-sm" id="generate-pr-summary-btn" style="white-space:nowrap;">Generate PR Summary</button>
          <button class="btn btn-secondary btn-sm" id="export-remediation-json" style="white-space:nowrap;">Export JSON</button>
        </div>
      </div>

      ${this.renderSearchBar()}
      ${this.renderCategoryFilter(Object.fromEntries(Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])))}

      <div class="roadmap-list">
        ${paginated.length ? (() => {
            let lastPhaseId = null;
            return paginated.map(i => {
                const header = i._phaseId && i._phaseId !== lastPhaseId
                    ? this.renderPhaseHeader(i._phaseId, i._phaseTitle, i._phaseDescription, i._phaseDependsOn)
                    : '';
                lastPhaseId = i._phaseId || lastPhaseId;
                return header + this.renderIssueCard(i);
            }).join('');
        })() : '<p class="text-muted" style="text-align:center;padding:30px;">All issues in this category are completed 🎉</p>'}
      </div>

      ${this.renderPagination(sorted.length, safePage, totalPages)}
      ${this.renderBottomTotals(stats)}
    `;
    }
    render() {
        const issues = this.getIssues();
        const el = document.createElement('div');
        el.className = this._hasPainted ? '' : 'fade-in';
        el.innerHTML = `
      <style>
        @keyframes rm-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .rm-v3 { animation:rm-fade-up .5s ease both; }
        .rm-v3-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:20px; }
        .rm-v3-header h1 { font-size:2.2rem; font-weight:800; margin:0; letter-spacing:-0.03em; background:linear-gradient(135deg,var(--text-primary) 0%,var(--accent) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .rm-v3-header p { color:var(--text-muted); font-size:0.9rem; margin:6px 0 0; }
        .rm-v3-card { background:linear-gradient(145deg, rgba(30,41,59,0.7), rgba(15,23,42,0.6)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; overflow:hidden; backdrop-filter:blur(12px); transition:box-shadow .3s ease; margin-bottom:16px; }
        [data-theme='light'] .rm-v3-card { background:linear-gradient(145deg, rgba(255,255,255,0.85), rgba(248,250,252,0.9)); border-color:rgba(148,163,184,0.15); }
        .rm-v3-card:hover { box-shadow:0 8px 32px rgba(2,8,20,0.35); }
        [data-theme='light'] .rm-v3-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.08); }
        .rm-v3-progress-bg { background:rgba(148,163,184,0.12); border-radius:10px; height:10px; overflow:hidden; }
        .rm-v3-progress-fill { height:100%; background:linear-gradient(90deg,#22c55e,#4ade80); border-radius:10px; transition:width .4s ease; }
        .rm-v3-kpi { background:rgba(148,163,184,0.05); border:1px solid rgba(148,163,184,0.06); border-radius:14px; padding:14px 18px; display:flex; align-items:center; gap:10px; transition:transform .2s; }
        .rm-v3-kpi:hover { transform:translateY(-2px); }
        .rm-v3-kpi-icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; }
        .rm-v3-kpi-val { font-size:1.3rem; font-weight:800; color:var(--text-primary); }
        .rm-v3-kpi-label { font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; }
        .rm-v3-search { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:10px 16px; font-size:0.85rem; color:var(--text-primary); width:100%; transition:border-color .2s,box-shadow .2s; }
        .rm-v3-search:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .rm-v3-filter-chip { background:rgba(148,163,184,0.06); border:1px solid rgba(148,163,184,0.1); border-radius:999px; padding:6px 14px; font-size:0.78rem; font-weight:600; color:var(--text-secondary); cursor:pointer; transition:all .2s; }
        .rm-v3-filter-chip:hover { background:rgba(148,163,184,0.12); }
        .rm-v3-filter-chip.active { background:var(--accent); color:#fff; border-color:var(--accent); }
        .rm-v3-issue { background:linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.4)); border:1px solid rgba(148,163,184,0.08); border-radius:16px; overflow:hidden; margin-bottom:10px; transition:box-shadow .2s; }
        [data-theme='light'] .rm-v3-issue { background:linear-gradient(145deg, rgba(255,255,255,0.7), rgba(248,250,252,0.8)); }
        .rm-v3-issue:hover { box-shadow:0 4px 20px rgba(2,8,20,0.25); }
        .rm-v3-issue.severity-critical { border-left:4px solid #ef4444; }
        .rm-v3-issue.severity-high { border-left:4px solid #f97316; }
        .rm-v3-issue.severity-medium { border-left:4px solid #eab308; }
        .rm-v3-issue.severity-low { border-left:4px solid #3b82f6; }
        .rm-v3-issue.severity-info { border-left:4px solid #22c55e; }
        .rm-v3-issue.completed { opacity:.55; }
        .rm-v3-phase { background:rgba(148,163,184,0.04); border:1px solid rgba(148,163,184,0.08); border-radius:12px; padding:12px 16px; margin:16px 0 10px; border-left:3px solid var(--accent); }
        .rm-v3-bottom { background:linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.5)); border:1px solid rgba(148,163,184,0.08); border-radius:20px; padding:18px 22px; margin-top:16px; }
        [data-theme='light'] .rm-v3-bottom { background:linear-gradient(145deg, rgba(255,255,255,0.8), rgba(248,250,252,0.85)); }

        /* PR summary preview drawer */
        #pr-summary-preview-drawer-wrapper { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1100; display: flex; justify-content: flex-end; }
        .pr-drawer-overlay { position: absolute; width: 100%; height: 100%; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); transition: opacity 0.25s ease; }
        .pr-preview-drawer-content { position: relative; width: 520px; height: 100%; background: rgba(13,18,30,0.85); border-left: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; padding: 24px; box-shadow: -10px 0 40px rgba(0,0,0,0.5); animation: slideInFromRight 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        [data-theme='light'] .pr-preview-drawer-content { background: rgba(255,255,255,0.95); border-left-color: rgba(0,0,0,0.08); }
        .drawer-header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .drawer-header-bar .header-title { display: flex; align-items: center; gap: 8px; color: var(--text-primary); }
        .drawer-header-bar h4 { margin: 0; font-size: 1.1rem; }
        .close-drawer-btn { background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; line-height: 1; }
        .close-drawer-btn:hover { color: var(--text-primary); }
        .drawer-instruction-text { font-size: 0.8rem; color: var(--text-muted); margin: 0 0 16px 0; line-height: 1.4; }
        .pr-markdown-scroll-box { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 16px; overflow-y: auto; margin-bottom: 20px; }
        .pr-markdown-scroll-box pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
        .pr-markdown-scroll-box code { font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; }
        .drawer-footer-actions { display: flex; justify-content: flex-end; }
        @keyframes slideInFromRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      </style>

      <div class="rm-v3-header">
        <div>
          <h1>Remediation Roadmap</h1>
          <p>Prioritized action plan from scan findings — check items off as you fix them</p>
        </div>
      </div>

      <div class="rm-v3">
        ${this.renderRoadmap(issues)}
      </div>
    `;
        this.bindEvents(el);
        return el;
    }
    bindEvents(el) {
        el.querySelectorAll('.filter-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedCategory = btn.dataset.filter;
                this.currentPage = 1;
                this.refreshView();
            });
        });
        const showCompletedCheckbox = el.querySelector('#show-completed');
        showCompletedCheckbox === null || showCompletedCheckbox === void 0 ? void 0 : showCompletedCheckbox.addEventListener('change', (e) => {
            this.showCompleted = e.target.checked;
            this.currentPage = 1;
            this.refreshView();
        });
        el.querySelectorAll('.roadmap-check').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = cb.dataset.id;
                if (e.target.checked) {
                    this.completed.add(id);
                }
                else {
                    this.completed.delete(id);
                }
                localStorage.setItem('sb-remediation-completed', JSON.stringify([...this.completed]));
                this.refreshView();
            });
        });
        const prevBtn = el.querySelector('#remediation-prev-page');
        prevBtn === null || prevBtn === void 0 ? void 0 : prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage -= 1;
                this.refreshView();
            }
        });
        const nextBtn = el.querySelector('#remediation-next-page');
        nextBtn === null || nextBtn === void 0 ? void 0 : nextBtn.addEventListener('click', () => {
            this.currentPage += 1;
            this.refreshView();
        });
        const exportBtn = el.querySelector('#export-remediation-json');
        exportBtn === null || exportBtn === void 0 ? void 0 : exportBtn.addEventListener('click', async () => {
            await this.ensureReportFresh();
            this.exportToJson(this.getIssues());
        });
        const importBtn = el.querySelector('#import-remediation-btn');
        const importFile = el.querySelector('#import-remediation-file');
        importBtn === null || importBtn === void 0 ? void 0 : importBtn.addEventListener('click', () => importFile === null || importFile === void 0 ? void 0 : importFile.click());
        importFile === null || importFile === void 0 ? void 0 : importFile.addEventListener('change', (e) => {
            var _a;
            const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
            if (file) {
                if (file.name.toLowerCase().endsWith('.zip')) {
                    this.importFromZip(file);
                }
                else {
                    this.importFromJson(file);
                }
                importFile.value = '';
            }
        });
        // Import popup
        const openModalBtn = el.querySelector('#open-import-modal-btn');
        openModalBtn === null || openModalBtn === void 0 ? void 0 : openModalBtn.addEventListener('click', () => this.openImportPopup());
        // Drag-and-drop handlers on main page (fallback)
        const dropZone = el.querySelector('#remediation-drop-zone');
        if (dropZone) {
            /**
             * Handle drag over.
             * @param {any} e
             * @returns {any}
             */
            const handleDragOver = (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.style.borderColor = 'var(--accent)';
                dropZone.style.background = 'rgba(56, 189, 248, 0.05)';
            };
            /**
             * Handle drag leave.
             * @param {any} e
             * @returns {any}
             */
            const handleDragLeave = (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.style.borderColor = 'var(--border)';
                dropZone.style.background = '';
            };
            /**
             * Handle drop.
             * @param {any} e
             * @returns {any}
             */
            const handleDrop = (e) => {
                var _a, _b;
                e.preventDefault();
                e.stopPropagation();
                dropZone.style.borderColor = 'var(--border)';
                dropZone.style.background = '';
                const file = (_b = (_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b[0];
                if (!file)
                    return;
                if (file.name.toLowerCase().endsWith('.zip')) {
                    this.importFromZip(file);
                }
                else if (file.name.toLowerCase().endsWith('.json')) {
                    this.importFromJson(file);
                }
                else {
                    showToast('Please drop a .json or .zip file', 'warning');
                }
            };
            dropZone.addEventListener('dragover', handleDragOver);
            dropZone.addEventListener('dragleave', handleDragLeave);
            dropZone.addEventListener('drop', handleDrop);
            // Also allow clicking the drop zone to open file picker
            dropZone.addEventListener('click', () => importFile === null || importFile === void 0 ? void 0 : importFile.click());
        }
        const generateBtn = el.querySelector('#generate-from-json-btn');
        const jsonInput = el.querySelector('#json-paste-input');
        generateBtn === null || generateBtn === void 0 ? void 0 : generateBtn.addEventListener('click', () => {
            const text = (jsonInput === null || jsonInput === void 0 ? void 0 : jsonInput.value) || '';
            if (!text.trim()) {
                showToast('Paste JSON data first', 'warning');
                return;
            }
            this.importFromText(text);
        });
        jsonInput === null || jsonInput === void 0 ? void 0 : jsonInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                generateBtn === null || generateBtn === void 0 ? void 0 : generateBtn.click();
            }
        });
        const searchInput = el.querySelector('#remediation-search');
        searchInput === null || searchInput === void 0 ? void 0 : searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.currentPage = 1;
            this.refreshView();
        });
        const markdownBtn = el.querySelector('#export-remediation-markdown');
        markdownBtn === null || markdownBtn === void 0 ? void 0 : markdownBtn.addEventListener('click', () => {
            this.copyMarkdown(this.getIssues());
        });
        const summaryBtn = el.querySelector('#export-remediation-summary');
        summaryBtn === null || summaryBtn === void 0 ? void 0 : summaryBtn.addEventListener('click', () => {
            this.copySummary(this.getIssues());
        });
        const prSummaryBtn = el.querySelector('#generate-pr-summary-btn');
        prSummaryBtn === null || prSummaryBtn === void 0 ? void 0 : prSummaryBtn.addEventListener('click', () => {
            const md = this.compileMarkdownPRSummary();
            this.showPRPreviewDrawer(md);
        });
    }
    copyMarkdown(issues) {
        const stats = this.getSummaryStats(issues);
        const lines = ['# Remediation Roadmap', '', `**Total:** ${stats.total} | **Remaining:** ${stats.remaining} | **Completed:** ${stats.completed}`, ''];
        const grouped = groupIssuesByCategory(issues);
        for (const [cat, items] of Object.entries(grouped)) {
            lines.push(`## ${escapeHtml(cat)}`);
            for (const issue of sortBySeverity(items)) {
                const plan = getRemediationPlan(issue);
                const done = this.completed.has(issue.id) ? 'x' : ' ';
                lines.push(`- [${done}] ${escapeHtml(issue.type || 'Issue')} — ${escapeHtml(plan.action)} (${escapeHtml(plan.effort)})`);
            }
            lines.push('');
        }
        navigator.clipboard.writeText(lines.join('\n'))
            .then(() => showToast('Markdown copied to clipboard', 'success'))
            .catch(() => showToast('Clipboard unavailable', 'error'));
    }
    copySummary(issues) {
        const stats = this.getSummaryStats(issues);
        const lines = [
            'SimpleBeacon Remediation Summary',
            `Total: ${stats.total} | Remaining: ${stats.remaining} | Completed: ${stats.completed}`,
            `Critical: ${stats.bySeverity.critical || 0} | High: ${stats.bySeverity.high || 0} | Medium: ${stats.bySeverity.medium || 0}`,
            ''
        ];
        const grouped = groupIssuesByCategory(issues);
        for (const [cat, items] of Object.entries(grouped)) {
            const remaining = items.filter(i => !this.completed.has(i.id)).length;
            lines.push(`${cat}: ${remaining}/${items.length} remaining`);
        }
        navigator.clipboard.writeText(lines.join('\n'))
            .then(() => showToast('Summary copied to clipboard', 'success'))
            .catch(() => showToast('Clipboard unavailable', 'error'));
    }
    refreshView() {
        if (this._mountRoot && this.app.currentView === this) {
            this._paint(this._mountRoot);
        }
    }
    _paint(container) {
        container.innerHTML = '';
        container.appendChild(this.render());
        this._hasPainted = true;
    }
    async mount(container) {
        this._mountRoot = container;
        // Auto-load server-side roadmap if no local import exists
        if (!this.importedIssues.length && !this.importedAt) {
            /**
             * Try load.
             * @param {string} url
             * @returns {any}
             */
            const tryLoad = async (url) => {
                var _a, _b, _c, _d, _e, _f;
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok)
                    return false;
                let data = await res.json();
                let issues = [];
                let metaExportedAt = null;
                // Normalize step-level wrapper: { id: 'roadmap', data: { roadmap: {...} } }
                if (data.id === 'roadmap' && ((_a = data.data) === null || _a === void 0 ? void 0 : _a.roadmap)) {
                    data = data.data;
                }
                // Normalize data-level wrapper: { roadmap: {...} }
                if (data.roadmap && !data.type && !Array.isArray(data.issues) && !Array.isArray(data.phases)) {
                    data = data.roadmap;
                }
                // Normalize complete-scan wrapper to extract roadmap
                if (data.type === 'simplebeacon-complete-scan' && ((_b = data.results) === null || _b === void 0 ? void 0 : _b.roadmap)) {
                    const roadmap = data.results.roadmap;
                    if (Array.isArray(roadmap.phases) && roadmap.phases.length) {
                        data = { phases: roadmap.phases, summary: roadmap.summary || data.summary };
                    }
                    else if (Array.isArray(roadmap.developmentPhases) && roadmap.developmentPhases.length) {
                        data = { phases: roadmap.developmentPhases, summary: roadmap.summary || data.summary };
                    }
                    else if (Array.isArray(roadmap.implementationPhases) && roadmap.implementationPhases.length) {
                        data = { phases: roadmap.implementationPhases, summary: roadmap.summary || data.summary };
                    }
                    else if (Array.isArray(roadmap.issues) && roadmap.issues.length) {
                        data = { issues: roadmap.issues, metadata: { exportedAt: data.generatedAt } };
                    }
                }
                // Normalize raw simplebeacon report with issues
                if (data.type === 'simplebeacon-report') {
                    const sourceIssues = ((_c = data.rawIssues) === null || _c === void 0 ? void 0 : _c.length) ? data.rawIssues : (data.detectedIssues || []);
                    if (sourceIssues.length) {
                        data = { issues: sourceIssues, metadata: { exportedAt: data.generatedAt || data.scannedAt } };
                    }
                }
                // Normalize complete-scan wrapper to extract simplebeacon rawIssues when no roadmap
                if (data.type === 'simplebeacon-complete-scan' && !data.issues && !data.phases) {
                    const sb = (_d = data.results) === null || _d === void 0 ? void 0 : _d.simplebeacon;
                    if (sb) {
                        const sourceIssues = ((_e = sb.rawIssues) === null || _e === void 0 ? void 0 : _e.length) ? sb.rawIssues : (sb.detectedIssues || []);
                        if (sourceIssues.length) {
                            data = { issues: sourceIssues, metadata: { exportedAt: data.generatedAt } };
                        }
                    }
                }
                if (Array.isArray(data.issues) && data.issues.length) {
                    issues = data.issues;
                    metaExportedAt = (_f = data.metadata) === null || _f === void 0 ? void 0 : _f.exportedAt;
                }
                else if (Array.isArray(data.phases) && data.phases.length) {
                    const converted = convertPhasesToIssues(data.phases, data.summary);
                    issues = converted.issues;
                    metaExportedAt = converted.exportedAt;
                }
                else if (Array.isArray(data.developmentPhases) && data.developmentPhases.length) {
                    const converted = convertPhasesToIssues(data.developmentPhases, data.summary);
                    issues = converted.issues;
                    metaExportedAt = converted.exportedAt;
                }
                else if (Array.isArray(data.implementationPhases) && data.implementationPhases.length) {
                    const converted = convertPhasesToIssues(data.implementationPhases, data.summary);
                    issues = converted.issues;
                    metaExportedAt = converted.exportedAt;
                }
                if (!issues.length)
                    return false;
                this.importedIssues = issues.map(issue => ({
                    id: issue.id,
                    severity: issue.severity,
                    type: issue.type,
                    category: issue.category,
                    description: issue.description,
                    filePath: issue.filePath,
                    action: issue.action,
                    effort: issue.effort,
                    completed: issue.completed || false
                }));
                this.importedAt = metaExportedAt || new Date().toISOString();
                localStorage.setItem('sb-remediation-imported', JSON.stringify(this.importedIssues));
                localStorage.setItem('sb-remediation-imported-at', this.importedAt);
                for (const issue of this.importedIssues) {
                    if (issue.completed)
                        this.completed.add(issue.id);
                }
                localStorage.setItem('sb-remediation-completed', JSON.stringify([...this.completed]));
                return true;
            };
            if (!this._autoLoadAttempted) {
                this._autoLoadAttempted = true;
                // Skip auto-load when served from a static file server without /data/
                if (window.location.protocol === 'file:')
                    return;
                const isLikelyDashboardServer = window.location.pathname.startsWith('/simplebeacon-dashboard/')
                    || window.location.port === '3000'
                    || window.location.port === '3002'
                    || window.location.port === '3001';
                if (!isLikelyDashboardServer)
                    return;
                try {
                    const loaded = await tryLoad('/data/complete-scan-ai-platform-2026-06-12.json')
                        || await tryLoad('/data/roadmap-from-scan-ai-platform-2026-06-12.json')
                        || await tryLoad('/data/roadmap-from-scan-cascadeprojects-2026-06-12-v2.json')
                        || await tryLoad('/data/roadmap-from-scan-cascadeprojects-2026-06-12.json')
                        || await tryLoad('/data/roadmap-from-scan-ai-agent-2026-06-12.json')
                        || await tryLoad('/data/roadmap-from-scan-2026-06-11.json')
                        || await tryLoad('/data/roadmap-ai-agent-complete-2026-06-11.json')
                        || await tryLoad('/data/roadmap-ai_agent-merged-2026-06-11.json');
                    if (!loaded) {
                        // Silent — user can import manually
                    }
                }
                catch (_a) {
                    // Silent fail — user can import manually
                }
            }
        }
        this._paint(container);
    }
    destroy() {
        this._mountRoot = null;
    }
}
