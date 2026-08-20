// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import {
  escapeHtml,
  formatNumber,
  showToast,
  renderEmptyState,
  downloadJson,
} from "../utils.js";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * Get remediation plan.
 * @param {boolean} issue
 * @returns {any}
 */
function getRemediationPlan(issue) {
  const type = (issue.type || "").toLowerCase();
  const ruleId = (issue.ruleId || issue.id || "").toLowerCase();
  const description = (issue.description || "").toLowerCase();

  if (
    ruleId.includes("deploy") ||
    type.includes("deploy leak") ||
    type.includes("deploy-leak")
  ) {
    return {
      action: "Move URLs to environment config or dynamic injection",
      effort: "10 min",
      category: "Security",
    };
  }
  if (ruleId.includes("debug-artifact") || type.includes("debug")) {
    return {
      action: "Remove debug statements",
      effort: "5 min",
      category: "Cleanup",
    };
  }
  if (ruleId.includes("config-drift") || type.includes("config")) {
    return {
      action: "Move to environment variables",
      effort: "15 min",
      category: "Security",
    };
  }
  if (
    ruleId.includes("sample-json-ref") ||
    ruleId.includes("production-leak") ||
    type.includes("sample") ||
    type.includes("mock")
  ) {
    return {
      action: "Replace with runtime data sources",
      effort: "30 min",
      category: "Data",
    };
  }
  if (
    ruleId.includes("missing-security-header") ||
    type.includes("security header")
  ) {
    return {
      action: "Add helmet/CSP middleware",
      effort: "20 min",
      category: "Security",
    };
  }
  if (ruleId.includes("governance-marker") || type.includes("license")) {
    return {
      action: "Review license compatibility",
      effort: "10 min",
      category: "Legal",
    };
  }
  if (ruleId.includes("multi-lang-debug")) {
    return {
      action: "Remove multi-language debug output",
      effort: "5 min",
      category: "Cleanup",
    };
  }
  if (type.includes("credential") || type.includes("secret")) {
    return {
      action: "Rotate secrets && use env vars",
      effort: "30 min",
      category: "Security",
    };
  }
  if (type.includes("eslint") || type.includes("lint")) {
    return {
      action: "Fix linting violations",
      effort: "10 min",
      category: "Quality",
    };
  }
  if (type.includes("empty file")) {
    return {
      action: "Remove or populate empty files",
      effort: "5 min",
      category: "Cleanup",
    };
  }
  if (type.includes("invalid json")) {
    return {
      action: "Fix JSON syntax errors",
      effort: "10 min",
      category: "Quality",
    };
  }
  if (type.includes("todo") || type.includes("fixme")) {
    return {
      action: "Address technical debt marker",
      effort: "20 min",
      category: "Debt",
    };
  }
  if (type.includes("missing-env-key")) {
    return {
      action: "Add missing key to .env file",
      effort: "5 min",
      category: "Config",
    };
  }
  if (type.includes("build-artifact")) {
    return {
      action: "Add to .gitignore or remove from repo",
      effort: "5 min",
      category: "Cleanup",
    };
  }
  if (
    description.includes("placeholder") ||
    description.includes("fictional") ||
    description.includes("mock")
  ) {
    return {
      action: "Replace with production data",
      effort: "20 min",
      category: "Data",
    };
  }

  return {
    action: issue.recommendedAction || "Review && remediate",
    effort: "20 min",
    category: "General",
  };
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
    if (!groups[cat]) groups[cat] = [];
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
    const sa = SEVERITY_ORDER[a.severity] ?? 99;
    const sb = SEVERITY_ORDER[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.filePath || "").localeCompare(b.filePath || "");
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
          id: "roadmap-" + (phase.id || idx) + "-" + idx++,
          severity: ["critical", "high", "medium", "low", "info"].includes(
            phase.severity,
          )
            ? phase.severity
            : "medium",
          type: phase.id || phase.phase || "phase",
          category:
            (phase.title || "").replace(/^Phase \d+:\s*/, "") ||
            phase.id ||
            phase.phase ||
            "Phase",
          description: task.description,
          filePath: task.location || "-",
          action:
            task.type === "fix"
              ? "Fix required"
              : task.type === "verify"
                ? "Verify"
                : task.type === "audit"
                  ? "Audit"
                  : task.type === "doc"
                    ? "Document"
                    : "Review",
          _phaseId: phase.id,
          _phaseTitle: phase.title,
          _phaseDependsOn: phase.dependsOn,
          _phaseDescription: phase.description,
          _taskType: task.type,
          _codeSnippet: task.codeSnippet,
          _isStructured: task.isStructured,
          effort: phase.effort || "20 min",
          completed: task.done || false,
        });
      }
      continue;
    }

    // Sprint-model developmentPhases (code-roadmap-generator output)
    const phaseLabel = phase.phase || phase.name || phase.title || "Phase";
    const severity =
      phase.status === "completed"
        ? "info"
        : phase.status === "in-progress"
          ? "medium"
          : phase.progress >= 50
            ? "medium"
            : "low";
    const descriptionParts = [phase.description].filter(Boolean);
    if (Array.isArray(phase.features) && phase.features.length) {
      descriptionParts.push("Features: " + phase.features.join("; "));
    }
    if (Array.isArray(phase.milestones) && phase.milestones.length) {
      descriptionParts.push("Milestones: " + phase.milestones.join("; "));
    }
    const action =
      phase.status === "completed"
        ? "Completed"
        : phase.status === "in-progress"
          ? "In progress"
          : "Planned";
    issues.push({
      id: "roadmap-" + (phase.id || slugify(phaseLabel)) + "-" + idx++,
      severity,
      type: phase.id || slugify(phaseLabel),
      category: phaseLabel.replace(/^Phase \d+:\s*/, ""),
      description: descriptionParts.join(" — ") || phaseLabel,
      filePath: "-",
      action,
      _phaseId: phase.id,
      _phaseTitle: phaseLabel,
      _phaseDescription: phase.description,
      _phaseProgress: phase.progress,
      _phaseStatus: phase.status,
      effort: "—",
      completed: phase.status === "completed" || phase.progress >= 100,
    });
  }
  return { issues, exportedAt: summary?.exportedAt || null };
}

/**
 * Slugify.
 * @param {string} text
 * @returns {any}
 */
function slugify(text) {
  return String(text || "phase")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Remediation roadmap view.
 */
export class RemediationRoadmapView {
  constructor(app) {
    this.app = app;
    this._mountRoot = null;
    this._hasPainted = false;
    this.selectedCategory = "all";
    this.showCompleted = false;
    this.searchQuery = "";
    this.currentPage = 1;
    this.pageSize = 25;
    this.completed = new Set(
      JSON.parse(localStorage.getItem("sb-remediation-completed") || "[]"),
    );
    this.importedIssues = JSON.parse(
      localStorage.getItem("sb-remediation-imported") || "[]",
    );
    this.importedAt =
      localStorage.getItem("sb-remediation-imported-at") || null;
  }

  getIssues() {
    const report = this.app.state.report;
    const raw = report?.rawIssues;
    const detected = report?.detectedIssues;
    const source =
      Array.isArray(raw) && raw.length
        ? raw
        : Array.isArray(detected) && detected.length
          ? detected
          : [];
    const liveIssues = source.map((issue, index) => ({
      ...issue,
      id:
        issue.id ||
        `${issue.severity}|${issue.type}|${issue.description}|${index}`,
      filePath:
        issue.filePath ||
        issue.filePaths?.[0] ||
        issue.affectedFiles?.[0] ||
        "—",
    }));

    // Merge imported issues that no longer appear in live scan
    const liveIds = new Set(liveIssues.map((i) => i.id));
    const merged = [...liveIssues];
    for (const imp of this.importedIssues) {
      if (!liveIds.has(imp.id)) {
        merged.push(imp);
        // Auto-complete fixed deploy leaks
        if ((imp.type || "").toLowerCase().includes("deploy leak")) {
          this.completed.add(imp.id);
        }
      }
    }

    return merged;
  }

  async ensureReportFresh() {
    const report = this.app.state.report;
    const hasLive =
      (Array.isArray(report?.rawIssues) && report.rawIssues.length > 0) ||
      (Array.isArray(report?.detectedIssues) &&
        report.detectedIssues.length > 0);
    if (hasLive) return;

    try {
      const fresh = await this.app.scanService.fetchReport();
      if (fresh && (fresh.rawIssues?.length || fresh.detectedIssues?.length)) {
        this.app.state.report = fresh;
      }
    } catch {
      // No report on disk yet — keep current state
    }
  }

  getSummaryStats(issues) {
    const total = issues.length;
    const completed = issues.filter((i) => this.completed.has(i.id)).length;
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const byCategory = {};
    let totalEffortMin = 0;

    for (const issue of issues) {
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      const plan = getRemediationPlan(issue);
      byCategory[plan.category] = (byCategory[plan.category] || 0) + 1;
      const mins = parseInt(plan.effort, 10) || 20;
      if (!this.completed.has(issue.id)) totalEffortMin += mins;
    }

    return {
      total,
      completed,
      remaining: total - completed,
      bySeverity,
      byCategory,
      totalEffortMin,
    };
  }

  renderProgressBar(completed, total) {
    if (!total) return "";
    const pct = Math.round((completed / total) * 100);
    return `
      <div class="roadmap-progress" style="margin: 0 0 16px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:600;font-size:var(--font-size-sm);">Progress: ${completed}/${total} completed</span>
          <span style="font-weight:700;color:var(--accent);">${pct}%</span>
        </div>
        <div style="background:var(--border);border-radius:6px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:var(--accent);border-radius:6px;transition:width 0.3s;"></div>
        </div>
      </div>
    `;
  }

  renderCategoryFilter(categories) {
    const items = ["all", ...Object.keys(categories).sort()];
    return `
      <div class="roadmap-filters" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        ${items
          .map(
            (cat) => `
          <button class="filter-chip ${cat === this.selectedCategory ? "active" : ""}" data-filter="${escapeHtml(cat)}">
            ${escapeHtml(cat === "all" ? "All Categories" : cat)} ${cat !== "all" ? `(${categories[cat]})` : ""}
          </button>
        `,
          )
          .join("")}
        <label for="show-completed" style="display:flex;align-items:center;gap:6px;margin-left:auto;font-size:var(--font-size-sm);cursor:pointer;">
          <input type="checkbox" id="show-completed" aria-label="Show completed" ${this.showCompleted ? "checked" : ""}>
          Show completed
        </label>
      </div>
    `;
  }

  renderPhaseHeader(phaseId, phaseTitle, phaseDescription, phaseDependsOn) {
    if (!phaseId) return "";
    const blocked = phaseDependsOn
      ? `<span class="pill" style="background:rgba(245,158,11,0.15);color:var(--warning);">Blocked by ${escapeHtml(phaseDependsOn)}</span>`
      : "";
    return `
      <div class="roadmap-phase-header" style="
        margin: var(--space-4) 0 var(--space-2);
        padding: var(--space-3) var(--space-4);
        background: var(--surface-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        border-left: 3px solid var(--primary);">
        <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">
          <strong style="font-size:var(--font-size-sm);color:var(--text-primary);">${escapeHtml(phaseTitle || phaseId)}</strong>
          ${blocked}
        </div>
        ${phaseDescription ? `<p style="margin:4px 0 0;font-size:var(--font-size-xs);color:var(--text-muted);">${escapeHtml(phaseDescription)}</p>` : ""}
      </div>
    `;
  }

  renderIssueCard(issue) {
    const plan = getRemediationPlan(issue);
    const isDone = this.completed.has(issue.id);
    const sevClass = issue.severity || "low";
    return `
      <div class="roadmap-card ${isDone ? "completed" : ""}" data-id="${escapeHtml(issue.id)}" style="
        border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:10px;
        background:var(--surface);opacity:${isDone ? 0.6 : 1};transition:opacity 0.2s;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <input type="checkbox" class="roadmap-check" data-id="${escapeHtml(issue.id)}" ${isDone ? "checked" : ""}
            style="width:18px;height:18px;margin-top:2px;cursor:pointer;accent-color:var(--accent);">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <span class="pill ${sevClass}">${escapeHtml(issue.severity || "info")}</span>
              <span class="pill" style="background:var(--surface-2);color:var(--text-secondary);">${escapeHtml(plan.category)}</span>
              <span style="font-size:var(--font-size-sm);color:var(--text-muted);margin-left:auto;">${escapeHtml(plan.effort)}</span>
            </div>
            <div style="font-weight:500;margin-bottom:3px;word-break:break-word;">${escapeHtml(issue.type || "Issue")}</div>
            <div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:4px;">${escapeHtml(issue.description || "")}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(issue.filePath || "—")}</div>
            ${issue._codeSnippet ? `<pre style="margin:8px 0 0;padding:8px 10px;background:var(--background);border:1px solid var(--border);border-radius:var(--radius-md);font-size:var(--font-size-xs);font-family:var(--font-mono);overflow-x:auto;"><code>${escapeHtml(issue._codeSnippet)}</code></pre>` : ""}
          </div>
        </div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:var(--font-size-sm);color:var(--text-secondary);">
          <strong>Action:</strong> ${escapeHtml(plan.action)}
        </div>
      </div>
    `;
  }

  exportToJson(issues) {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalIssues: issues.length,
      completed: [...this.completed],
      issues: issues.map((issue) => {
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
          completed: this.completed.has(issue.id),
        };
      }),
    };
    downloadJson(
      payload,
      `remediation-roadmap-${new Date().toISOString().slice(0, 10)}.json`,
    );
    showToast("Remediation roadmap exported as JSON");
  }

  importFromJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        this.importFromText(e.target.result);
      } catch (err) {
        showToast("Failed to parse JSON: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  }

  async importFromZip(file) {
    if (typeof window.JSZip === "undefined") {
      showToast(
        "ZIP support not available — please extract the JSON file manually",
        "error",
      );
      return;
    }
    try {
      const zip = await window.JSZip.loadAsync(file);
      const jsonFiles = [];
      zip.forEach((relativePath, zipEntry) => {
        if (relativePath.toLowerCase().endsWith(".json") && !zipEntry.dir) {
          jsonFiles.push(zipEntry);
        }
      });
      if (!jsonFiles.length) {
        showToast("No JSON files found in ZIP", "error");
        return;
      }
      // Prioritize known report filenames, then pick the largest JSON
      const priorityNames = [
        "report",
        "scan",
        "roadmap",
        "simplebeacon",
        "complete",
      ];
      jsonFiles.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aPriority = priorityNames.some((p) => aName.includes(p)) ? 1 : 0;
        const bPriority = priorityNames.some((p) => bName.includes(p)) ? 1 : 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        return (
          (b._data.uncompressedSize || 0) - (a._data.uncompressedSize || 0)
        );
      });
      let importedCount = 0;
      for (const entry of jsonFiles) {
        const text = await entry.async("text");
        try {
          const data = JSON.parse(text.trim());
          // Skip manifest-only files and tiny metadata JSONs
          if (data.manifest && Object.keys(data).length === 1) continue;
          this.importFromText(text);
          importedCount++;
          // Only import the first matching report
          break;
        } catch {
          // Continue to next file
        }
      }
      if (!importedCount) {
        showToast("Could not import any report from ZIP", "error");
      }
    } catch (err) {
      showToast("Failed to read ZIP: " + err.message, "error");
    }
  }

  importFromText(text) {
    try {
      let data = JSON.parse(text.trim());
      let issues = [];
      let metaExportedAt = null;

      // Normalize step-level wrapper: { id: 'roadmap', data: { roadmap: {...} } }
      if (data.id === "roadmap" && data.data?.roadmap) {
        data = data.data;
      }
      // Normalize data-level wrapper: { roadmap: {...} }
      if (
        data.roadmap &&
        !data.type &&
        !Array.isArray(data.issues) &&
        !Array.isArray(data.phases)
      ) {
        data = data.roadmap;
      }

      // Normalize complete-scan wrapper to extract roadmap
      if (data.type === "simplebeacon-complete-scan" && data.results?.roadmap) {
        const roadmap = data.results.roadmap;
        if (Array.isArray(roadmap.phases) && roadmap.phases.length) {
          data = {
            phases: roadmap.phases,
            summary: roadmap.summary || data.summary,
          };
        } else if (
          Array.isArray(roadmap.developmentPhases) &&
          roadmap.developmentPhases.length
        ) {
          data = {
            phases: roadmap.developmentPhases,
            summary: roadmap.summary || data.summary,
          };
        } else if (
          Array.isArray(roadmap.implementationPhases) &&
          roadmap.implementationPhases.length
        ) {
          data = {
            phases: roadmap.implementationPhases,
            summary: roadmap.summary || data.summary,
          };
        } else if (Array.isArray(roadmap.issues) && roadmap.issues.length) {
          data = {
            issues: roadmap.issues,
            metadata: { exportedAt: data.generatedAt },
          };
        }
      }

      // Normalize raw simplebeacon report with issues
      if (data.type === "simplebeacon-report") {
        const sourceIssues = data.rawIssues?.length
          ? data.rawIssues
          : data.detectedIssues || [];
        if (sourceIssues.length) {
          data = {
            issues: sourceIssues,
            metadata: { exportedAt: data.generatedAt || data.scannedAt },
          };
        }
      }

      // Normalize complete-scan wrapper to extract simplebeacon rawIssues when no roadmap
      if (
        data.type === "simplebeacon-complete-scan" &&
        !data.issues &&
        !data.phases
      ) {
        const sb = data.results?.simplebeacon;
        if (sb) {
          const sourceIssues = sb.rawIssues?.length
            ? sb.rawIssues
            : sb.detectedIssues || [];
          if (sourceIssues.length) {
            data = {
              issues: sourceIssues,
              metadata: { exportedAt: data.generatedAt },
            };
          }
        }
      }

      if (Array.isArray(data.issues) && data.issues.length) {
        issues = data.issues;
        metaExportedAt = data.metadata?.exportedAt;
      } else if (Array.isArray(data.phases) && data.phases.length) {
        const converted = convertPhasesToIssues(data.phases, data.summary);
        issues = converted.issues;
        metaExportedAt = converted.exportedAt;
      } else if (
        Array.isArray(data.developmentPhases) &&
        data.developmentPhases.length
      ) {
        const converted = convertPhasesToIssues(
          data.developmentPhases,
          data.summary,
        );
        issues = converted.issues;
        metaExportedAt = converted.exportedAt;
      } else if (
        Array.isArray(data.implementationPhases) &&
        data.implementationPhases.length
      ) {
        const converted = convertPhasesToIssues(
          data.implementationPhases,
          data.summary,
        );
        issues = converted.issues;
        metaExportedAt = converted.exportedAt;
      } else {
        showToast(
          "Invalid roadmap JSON — missing issues or phases array",
          "error",
        );
        return;
      }

      this.importedIssues = issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        type: issue.type,
        category: issue.category,
        description: issue.description,
        filePath: issue.filePath,
        action: issue.action,
        effort: issue.effort,
        completed: issue.completed || false,
      }));
      this.importedAt =
        metaExportedAt || data.exportedAt || new Date().toISOString();
      localStorage.setItem(
        "sb-remediation-imported",
        JSON.stringify(this.importedIssues),
      );
      localStorage.setItem("sb-remediation-imported-at", this.importedAt);
      for (const issue of this.importedIssues) {
        if (issue.completed) this.completed.add(issue.id);
      }
      localStorage.setItem(
        "sb-remediation-completed",
        JSON.stringify([...this.completed]),
      );
      showToast(`Imported ${this.importedIssues.length} issues from JSON text`);
      this.refreshView();
    } catch (err) {
      showToast("Failed to parse JSON: " + err.message, "error");
    }
  }

  renderSearchBar() {
    return `
      <div class="roadmap-search" style="margin-bottom:var(--space-3);">
        <input type="text" id="remediation-search" class="analyze-path-input"
          placeholder="🔍 Search tasks by type, file, or description…"
          value="${escapeHtml(this.searchQuery)}"
          aria-label="Search remediation tasks"
          style="width:100%;">
      </div>
    `;
  }

  renderPagination(totalItems, currentPage, totalPages) {
    if (totalPages <= 1) return "";
    const start = (currentPage - 1) * this.pageSize + 1;
    const end = Math.min(currentPage * this.pageSize, totalItems);
    const prevDisabled = currentPage <= 1 ? "disabled" : "";
    const nextDisabled = currentPage >= totalPages ? "disabled" : "";
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
    const effortLabel =
      effortHours < 1 ? `${stats.totalEffortMin} min` : `~${effortHours}h`;
    return `
      <div class="roadmap-bottom-totals" style="margin-top:var(--space-4);padding:var(--space-3);background:var(--surface-elevated);border:1px solid var(--border);border-radius:var(--radius-md);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-2);">
          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;">
            <span style="font-size:var(--font-size-sm);"><strong>${formatNumber(stats.total)}</strong> total</span>
            <span style="font-size:var(--font-size-sm);color:var(--success);"><strong>${formatNumber(stats.completed)}</strong> completed</span>
            <span style="font-size:var(--font-size-sm);color:var(--accent);"><strong>${formatNumber(stats.remaining)}</strong> remaining</span>
            <span style="font-size:var(--font-size-sm);"><strong>${effortLabel}</strong> est. effort</span>
          </div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
            ${stats.bySeverity.critical ? `<span class="pill critical" style="font-size:var(--font-size-xs);">${formatNumber(stats.bySeverity.critical)} critical</span>` : ""}
            ${stats.bySeverity.high ? `<span class="pill high" style="font-size:var(--font-size-xs);">${formatNumber(stats.bySeverity.high)} high</span>` : ""}
            ${stats.bySeverity.medium ? `<span class="pill medium" style="font-size:var(--font-size-xs);">${formatNumber(stats.bySeverity.medium)} medium</span>` : ""}
            ${stats.bySeverity.low ? `<span class="pill low" style="font-size:var(--font-size-xs);">${formatNumber(stats.bySeverity.low)} low</span>` : ""}
            ${stats.bySeverity.info ? `<span class="pill info" style="font-size:var(--font-size-xs);">${formatNumber(stats.bySeverity.info)} info</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  openImportPopup() {
    if (document.getElementById("sb-import-modal-overlay")) return;
    const self = this;

    const overlay = document.createElement("div");
    overlay.id = "sb-import-modal-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;";

    const panel = document.createElement("div");
    panel.style.cssText =
      "width:90%;max-width:840px;max-height:90vh;overflow:auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:30px;color:#e6edf3;font-family:sans-serif;font-size:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5);";

    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
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

    const closeBtn = panel.querySelector("#sb-import-close");
    const dropZone = panel.querySelector("#sb-import-dropzone");
    const fileInput = panel.querySelector("#sb-import-file");
    const jsonInput = panel.querySelector("#sb-import-json");
    const importBtn = panel.querySelector("#sb-import-submit");
    const chooseBtn = panel.querySelector("#sb-import-choose");

    function close() {
      overlay.remove();
    }
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#58a6ff";
    });
    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#30363d";
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#30363d";
      const file = e.dataTransfer.files[0];
      if (!file) return;
      close();
      if (file.name.toLowerCase().endsWith(".zip")) self.importFromZip(file);
      else if (file.name.toLowerCase().endsWith(".json"))
        self.importFromJson(file);
      else showToast("Please drop a .json or .zip file", "warning");
    });
    dropZone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      close();
      if (file.name.toLowerCase().endsWith(".zip")) self.importFromZip(file);
      else if (file.name.toLowerCase().endsWith(".json"))
        self.importFromJson(file);
    });

    chooseBtn.addEventListener("click", () => fileInput.click());

    importBtn.addEventListener("click", () => {
      const text = jsonInput.value.trim();
      if (!text) {
        showToast("Paste JSON data first", "warning");
        return;
      }
      close();
      self.importFromText(text);
    });

    jsonInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
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
          icon: "🗺️",
          title: "No scan report loaded",
          body: "Run Simplebeacon Scan to generate a remediation roadmap.",
          iconWrapper: "emoji",
        })}
      `;
    }

    const stats = this.getSummaryStats(issues);
    const grouped = groupIssuesByCategory(issues);
    let filtered =
      this.selectedCategory === "all"
        ? issues
        : grouped[this.selectedCategory] || [];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          (i.type || "").toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q) ||
          (i.filePath || "").toLowerCase().includes(q) ||
          (i.category || "").toLowerCase().includes(q),
      );
    }
    const visible = this.showCompleted
      ? filtered
      : filtered.filter((i) => !this.completed.has(i.id));
    const sorted = sortBySeverity(visible);

    const totalPages = Math.max(1, Math.ceil(sorted.length / this.pageSize));
    const safePage = Math.min(this.currentPage, totalPages);
    if (safePage !== this.currentPage) this.currentPage = safePage;
    const startIndex = (safePage - 1) * this.pageSize;
    const paginated = sorted.slice(startIndex, startIndex + this.pageSize);

    const effortHours = Math.ceil(stats.totalEffortMin / 60);
    const effortLabel =
      effortHours < 1 ? `${stats.totalEffortMin} min` : `~${effortHours}h`;

    const importBadge = this.importedAt
      ? `<span class="badge badge-info" style="font-size:var(--font-size-xs);">Imported ${new Date(this.importedAt).toLocaleDateString()}</span>`
      : "";

    const searchHits = this.searchQuery
      ? `<span class="text-muted" style="font-size:var(--font-size-xs);">Showing ${formatNumber(sorted.length)} of ${formatNumber(issues.length)} issues</span>`
      : "";

    return `
      ${this.renderProgressBar(stats.completed, stats.total)}

      <div class="roadmap-actions" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div class="metrics-row" style="margin:0;">
          <div class="metric-chip"><strong>${formatNumber(stats.remaining)}</strong> remaining</div>
          <div class="metric-chip"><strong>${formatNumber(stats.total)}</strong> total</div>
          <div class="metric-chip"><strong>${formatNumber(stats.bySeverity.critical || 0)}</strong> critical</div>
          <div class="metric-chip"><strong>${formatNumber(stats.bySeverity.high || 0)}</strong> high</div>
          <div class="metric-chip"><strong>${formatNumber(stats.bySeverity.medium || 0)}</strong> medium</div>
          <div class="metric-chip"><strong>${effortLabel}</strong> est. effort</div>
        </div>
        <div style="display:flex;gap:var(--space-2);align-items:center;">
          <button class="btn btn-secondary btn-sm" id="open-import-modal-btn" style="display:inline-flex;align-items:center;gap:var(--space-2);white-space:nowrap;">
            <span>&#128206;</span> Import Scan Data
          </button>
          ${importBadge}
          ${searchHits}
          <button class="btn btn-ghost btn-sm" id="export-remediation-markdown" style="white-space:nowrap;">Copy Markdown</button>
          <button class="btn btn-ghost btn-sm" id="export-remediation-summary" style="white-space:nowrap;">Copy Summary</button>
          <button class="btn btn-sm" id="export-remediation-json" style="white-space:nowrap;">Export JSON</button>
        </div>
      </div>

      ${this.renderSearchBar()}
      ${this.renderCategoryFilter(Object.fromEntries(Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])))}

      <div class="roadmap-list">
        ${
          paginated.length
            ? (() => {
                let lastPhaseId = null;
                return paginated
                  .map((i) => {
                    const header =
                      i._phaseId && i._phaseId !== lastPhaseId
                        ? this.renderPhaseHeader(
                            i._phaseId,
                            i._phaseTitle,
                            i._phaseDescription,
                            i._phaseDependsOn,
                          )
                        : "";
                    lastPhaseId = i._phaseId || lastPhaseId;
                    return header + this.renderIssueCard(i);
                  })
                  .join("");
              })()
            : '<p class="text-muted card">All issues in this category are completed 🎉</p>'
        }
      </div>

      ${this.renderPagination(sorted.length, safePage, totalPages)}
      ${this.renderBottomTotals(stats)}
    `;
  }

  render() {
    const issues = this.getIssues();
    const el = document.createElement("div");
    el.className = this._hasPainted ? "" : "fade-in";
    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Remediation Roadmap</h1>
        <p class="text-muted analyze-hero-sub">Prioritized action plan from scan findings. Check items off as you fix them.</p>
      </div>

      <div class="section-block">
        <div class="section-heading"><h2>Action Plan</h2></div>
        ${this.renderRoadmap(issues)}
      </div>
    `;

    this.bindEvents(el);
    return el;
  }

  bindEvents(el) {
    el.querySelectorAll(".filter-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectedCategory = btn.dataset.filter;
        this.currentPage = 1;
        this.refreshView();
      });
    });

    const showCompletedCheckbox = el.querySelector("#show-completed");
    showCompletedCheckbox?.addEventListener("change", (e) => {
      this.showCompleted = e.target.checked;
      this.currentPage = 1;
      this.refreshView();
    });

    el.querySelectorAll(".roadmap-check").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const id = cb.dataset.id;
        if (e.target.checked) {
          this.completed.add(id);
        } else {
          this.completed.delete(id);
        }
        localStorage.setItem(
          "sb-remediation-completed",
          JSON.stringify([...this.completed]),
        );
        this.refreshView();
      });
    });

    const prevBtn = el.querySelector("#remediation-prev-page");
    prevBtn?.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage -= 1;
        this.refreshView();
      }
    });

    const nextBtn = el.querySelector("#remediation-next-page");
    nextBtn?.addEventListener("click", () => {
      this.currentPage += 1;
      this.refreshView();
    });

    const exportBtn = el.querySelector("#export-remediation-json");
    exportBtn?.addEventListener("click", async () => {
      await this.ensureReportFresh();
      this.exportToJson(this.getIssues());
    });

    const importBtn = el.querySelector("#import-remediation-btn");
    const importFile = el.querySelector("#import-remediation-file");
    importBtn?.addEventListener("click", () => importFile?.click());
    importFile?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          this.importFromZip(file);
        } else {
          this.importFromJson(file);
        }
        importFile.value = "";
      }
    });

    // Import popup
    const openModalBtn = el.querySelector("#open-import-modal-btn");
    openModalBtn?.addEventListener("click", () => this.openImportPopup());

    // Drag-and-drop handlers on main page (fallback)
    const dropZone = el.querySelector("#remediation-drop-zone");
    if (dropZone) {
      /**
       * Handle drag over.
       * @param {any} e
       * @returns {any}
       */
      const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = "var(--accent)";
        dropZone.style.background = "rgba(56, 189, 248, 0.05)";
      };
      /**
       * Handle drag leave.
       * @param {any} e
       * @returns {any}
       */
      const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = "var(--border)";
        dropZone.style.background = "";
      };
      /**
       * Handle drop.
       * @param {any} e
       * @returns {any}
       */
      const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = "var(--border)";
        dropZone.style.background = "";
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (file.name.toLowerCase().endsWith(".zip")) {
          this.importFromZip(file);
        } else if (file.name.toLowerCase().endsWith(".json")) {
          this.importFromJson(file);
        } else {
          showToast("Please drop a .json or .zip file", "warning");
        }
      };
      dropZone.addEventListener("dragover", handleDragOver);
      dropZone.addEventListener("dragleave", handleDragLeave);
      dropZone.addEventListener("drop", handleDrop);
      // Also allow clicking the drop zone to open file picker
      dropZone.addEventListener("click", () => importFile?.click());
    }

    const generateBtn = el.querySelector("#generate-from-json-btn");
    const jsonInput = el.querySelector("#json-paste-input");
    generateBtn?.addEventListener("click", () => {
      const text = jsonInput?.value || "";
      if (!text.trim()) {
        showToast("Paste JSON data first", "warning");
        return;
      }
      this.importFromText(text);
    });
    jsonInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        generateBtn?.click();
      }
    });

    const searchInput = el.querySelector("#remediation-search");
    searchInput?.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.trim();
      this.currentPage = 1;
      this.refreshView();
    });

    const markdownBtn = el.querySelector("#export-remediation-markdown");
    markdownBtn?.addEventListener("click", () => {
      this.copyMarkdown(this.getIssues());
    });

    const summaryBtn = el.querySelector("#export-remediation-summary");
    summaryBtn?.addEventListener("click", () => {
      this.copySummary(this.getIssues());
    });
  }

  copyMarkdown(issues) {
    const stats = this.getSummaryStats(issues);
    const lines = [
      "# Remediation Roadmap",
      "",
      `**Total:** ${stats.total} | **Remaining:** ${stats.remaining} | **Completed:** ${stats.completed}`,
      "",
    ];
    const grouped = groupIssuesByCategory(issues);
    for (const [cat, items] of Object.entries(grouped)) {
      lines.push(`## ${escapeHtml(cat)}`);
      for (const issue of sortBySeverity(items)) {
        const plan = getRemediationPlan(issue);
        const done = this.completed.has(issue.id) ? "x" : " ";
        lines.push(
          `- [${done}] ${escapeHtml(issue.type || "Issue")} — ${escapeHtml(plan.action)} (${escapeHtml(plan.effort)})`,
        );
      }
      lines.push("");
    }
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => showToast("Markdown copied to clipboard", "success"))
      .catch(() => showToast("Clipboard unavailable", "error"));
  }

  copySummary(issues) {
    const stats = this.getSummaryStats(issues);
    const lines = [
      "SimpleBeacon Remediation Summary",
      `Total: ${stats.total} | Remaining: ${stats.remaining} | Completed: ${stats.completed}`,
      `Critical: ${stats.bySeverity.critical || 0} | High: ${stats.bySeverity.high || 0} | Medium: ${stats.bySeverity.medium || 0}`,
      "",
    ];
    const grouped = groupIssuesByCategory(issues);
    for (const [cat, items] of Object.entries(grouped)) {
      const remaining = items.filter((i) => !this.completed.has(i.id)).length;
      lines.push(`${cat}: ${remaining}/${items.length} remaining`);
    }
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => showToast("Summary copied to clipboard", "success"))
      .catch(() => showToast("Clipboard unavailable", "error"));
  }

  refreshView() {
    if (this._mountRoot && this.app.currentView === this) {
      this._paint(this._mountRoot);
    }
  }

  _paint(container) {
    // TODO(security): review innerHTML usage here and sanitize dynamic content where applicable.
    container.innerHTML = "";
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
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return false;
        let data = await res.json();

        let issues = [];
        let metaExportedAt = null;

        // Normalize step-level wrapper: { id: 'roadmap', data: { roadmap: {...} } }
        if (data.id === "roadmap" && data.data?.roadmap) {
          data = data.data;
        }
        // Normalize data-level wrapper: { roadmap: {...} }
        if (
          data.roadmap &&
          !data.type &&
          !Array.isArray(data.issues) &&
          !Array.isArray(data.phases)
        ) {
          data = data.roadmap;
        }

        // Normalize complete-scan wrapper to extract roadmap
        if (
          data.type === "simplebeacon-complete-scan" &&
          data.results?.roadmap
        ) {
          const roadmap = data.results.roadmap;
          if (Array.isArray(roadmap.phases) && roadmap.phases.length) {
            data = {
              phases: roadmap.phases,
              summary: roadmap.summary || data.summary,
            };
          } else if (
            Array.isArray(roadmap.developmentPhases) &&
            roadmap.developmentPhases.length
          ) {
            data = {
              phases: roadmap.developmentPhases,
              summary: roadmap.summary || data.summary,
            };
          } else if (
            Array.isArray(roadmap.implementationPhases) &&
            roadmap.implementationPhases.length
          ) {
            data = {
              phases: roadmap.implementationPhases,
              summary: roadmap.summary || data.summary,
            };
          } else if (Array.isArray(roadmap.issues) && roadmap.issues.length) {
            data = {
              issues: roadmap.issues,
              metadata: { exportedAt: data.generatedAt },
            };
          }
        }

        // Normalize raw simplebeacon report with issues
        if (data.type === "simplebeacon-report") {
          const sourceIssues = data.rawIssues?.length
            ? data.rawIssues
            : data.detectedIssues || [];
          if (sourceIssues.length) {
            data = {
              issues: sourceIssues,
              metadata: { exportedAt: data.generatedAt || data.scannedAt },
            };
          }
        }

        // Normalize complete-scan wrapper to extract simplebeacon rawIssues when no roadmap
        if (
          data.type === "simplebeacon-complete-scan" &&
          !data.issues &&
          !data.phases
        ) {
          const sb = data.results?.simplebeacon;
          if (sb) {
            const sourceIssues = sb.rawIssues?.length
              ? sb.rawIssues
              : sb.detectedIssues || [];
            if (sourceIssues.length) {
              data = {
                issues: sourceIssues,
                metadata: { exportedAt: data.generatedAt },
              };
            }
          }
        }

        if (Array.isArray(data.issues) && data.issues.length) {
          issues = data.issues;
          metaExportedAt = data.metadata?.exportedAt;
        } else if (Array.isArray(data.phases) && data.phases.length) {
          const converted = convertPhasesToIssues(data.phases, data.summary);
          issues = converted.issues;
          metaExportedAt = converted.exportedAt;
        } else if (
          Array.isArray(data.developmentPhases) &&
          data.developmentPhases.length
        ) {
          const converted = convertPhasesToIssues(
            data.developmentPhases,
            data.summary,
          );
          issues = converted.issues;
          metaExportedAt = converted.exportedAt;
        } else if (
          Array.isArray(data.implementationPhases) &&
          data.implementationPhases.length
        ) {
          const converted = convertPhasesToIssues(
            data.implementationPhases,
            data.summary,
          );
          issues = converted.issues;
          metaExportedAt = converted.exportedAt;
        }

        if (!issues.length) return false;

        this.importedIssues = issues.map((issue) => ({
          id: issue.id,
          severity: issue.severity,
          type: issue.type,
          category: issue.category,
          description: issue.description,
          filePath: issue.filePath,
          action: issue.action,
          effort: issue.effort,
          completed: issue.completed || false,
        }));
        this.importedAt = metaExportedAt || new Date().toISOString();
        localStorage.setItem(
          "sb-remediation-imported",
          JSON.stringify(this.importedIssues),
        );
        localStorage.setItem("sb-remediation-imported-at", this.importedAt);
        for (const issue of this.importedIssues) {
          if (issue.completed) this.completed.add(issue.id);
        }
        localStorage.setItem(
          "sb-remediation-completed",
          JSON.stringify([...this.completed]),
        );
        return true;
      };

      if (!this._autoLoadAttempted) {
        this._autoLoadAttempted = true;
        // Skip auto-load when served from a static file server without /data/
        if (window.location.protocol === "file:") return;
        const isLikelyDashboardServer =
          window.location.pathname.startsWith("/simplebeacon-dashboard/") ||
          window.location.port === "3000" ||
          window.location.port === "3002" ||
          window.location.port === "3001";
        if (!isLikelyDashboardServer) return;
        try {
          const loaded =
            (await tryLoad(
              "/data/complete-scan-ai-platform-2026-06-12.json",
            )) ||
            (await tryLoad(
              "/data/roadmap-from-scan-ai-platform-2026-06-12.json",
            )) ||
            (await tryLoad(
              "/data/roadmap-from-scan-cascadeprojects-2026-06-12-v2.json",
            )) ||
            (await tryLoad(
              "/data/roadmap-from-scan-cascadeprojects-2026-06-12.json",
            )) ||
            (await tryLoad(
              "/data/roadmap-from-scan-ai-agent-2026-06-12.json",
            )) ||
            (await tryLoad("/data/roadmap-from-scan-2026-06-11.json")) ||
            (await tryLoad(
              "/data/roadmap-ai-agent-complete-2026-06-11.json",
            )) ||
            (await tryLoad("/data/roadmap-ai_agent-merged-2026-06-11.json"));
          if (!loaded) {
            // Silent — user can import manually
          }
        } catch {
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
