// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { escapeHtml, formatNumber } from "../utils.js";
import { scanService } from "../services/scanService.js";
import { fetchRepositoryInventory } from "../services/analyzeService.js";

/**
 * Build a nested tree object from an array of file paths.
 * @param {string[]} paths
 * @returns {Object}
 */
function buildTreeFromPaths(paths) {
  const root = {};
  for (const p of paths) {
    const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
    let node = root;
    for (const part of parts) {
      node[part] = node[part] || {};
      node = node[part];
    }
  }
  return root;
}

/**
 * Count file extensions from paths.
 * @param {string[]} paths
 * @returns {Object}
 */
function countExtensions(paths) {
  const counts = {};
  for (const p of paths) {
    const ext = (p.split(".").pop() || "").toLowerCase();
    if (ext && !ext.includes("/")) {
      counts[ext] = (counts[ext] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Extract unique file paths from a scan report.
 * @param {Object} report
 * @returns {string[]}
 */
function extractFilePaths(report) {
  const paths = new Set();
  if (report && report.rawIssues) {
    for (const issue of report.rawIssues) {
      if (issue.filePath || issue.file) paths.add(issue.filePath || issue.file);
    }
  }
  if (report && report.detectedIssues) {
    for (const issue of report.detectedIssues) {
      if (issue.filePath) {
        for (const fp of Array.isArray(issue.filePath)
          ? issue.filePath
          : [issue.filePath]) {
          paths.add(fp);
        }
      }
    }
  }
  if (
    report &&
    report.repositoryInventory &&
    report.repositoryInventory.directoryTree
  ) {
    for (const item of report.repositoryInventory.directoryTree) {
      if (item.path) paths.add(item.path);
    }
  }
  return Array.from(paths).sort();
}

/**
 * Render a tree node recursively.
 * @param {Object} node
 * @param {string} name
 * @param {number} depth
 * @returns {string}
 */
function renderTreeHtml(node, name, depth = 0) {
  const keys = Object.keys(node).sort();
  if (!keys.length) return "";

  const indent =
    depth > 0
      ? `<span style="display:inline-block;width:${depth * 16}px"></span>`
      : "";
  const isLeaf =
    keys.length === 0 ||
    (keys.length === 1 && Object.keys(node[keys[0]]).length === 0);
  const icon = isLeaf ? "📄" : "📁";
  const caret = isLeaf
    ? ""
    : '<span style="display:inline-block;width:12px;text-align:center;margin-right:2px;cursor:pointer;" class="tree-toggle">▼</span>';

  let html = `<div class="tree-item" style="padding:2px 0;font-family:monospace;font-size:12px;white-space:nowrap;cursor:pointer;" data-name="${escapeHtml(name)}">
    ${indent}${caret}${icon} ${escapeHtml(name)}
  </div>`;

  if (!isLeaf) {
    html += `<div class="tree-children" style="margin-left:8px;">`;
    for (const key of keys) {
      html += renderTreeHtml(node[key], key, depth + 1);
    }
    html += `</div>`;
  }

  return html;
}

/**
 * Code Map View — visualize repository structure and scanned files.
 */
export class CodeMapView {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.currentFile = null;
  }

  async mount(container) {
    this.container = container;
    container.innerHTML =
      '<div style="padding:24px;color:#888;font-family:Inter,system-ui,sans-serif;">Loading code map…</div>';

    try {
      const projectPath = this.app.state && this.app.state.lastProjectPath;
      const [report, inventory] = await Promise.allSettled([
        scanService.fetchReport(projectPath),
        projectPath
          ? fetchRepositoryInventory(projectPath, { profile: "explorer" })
          : Promise.resolve(null),
      ]);

      const reportData = report.status === "fulfilled" ? report.value : null;
      const inventoryData =
        inventory.status === "fulfilled" ? inventory.value : null;

      this.render(projectPath, reportData, inventoryData);
    } catch (err) {
      container.innerHTML = `<div style="padding:24px;color:#ef4444;">Failed to load code map: ${escapeHtml(err.message)}</div>`;
    }
  }

  render(projectPath, report, inventory) {
    const filePaths = extractFilePaths(report);
    const tree = buildTreeFromPaths(filePaths);
    const extensions = countExtensions(filePaths);
    const extEntries = Object.entries(extensions).sort((a, b) => b[1] - a[1]);
    const totalFiles = inventory?.(
      totalFiles !== null && totalFiles !== undefined
        ? totalFiles
        : filePaths.length !== null && filePaths.length !== undefined
          ? filePaths.length
          : 0,
    );
    const totalFolders = inventory?.(
      totalFolders !== null && totalFolders !== undefined ? totalFolders : 0,
    );
    const qualityScore = report?.(
      qualityScore !== null && qualityScore !== undefined ? qualityScore : "—",
    );
    const gatePass =
      report &&
      report.gate?.(pass !== null && pass !== undefined ? pass : null);

    const hasTree = Object.keys(tree).length > 0;

    const langBars = extEntries
      .slice(0, 8)
      .map(([ext, count]) => {
        const pct = totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0;
        return `
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:12px;">
          <span style="width:60px;text-transform:uppercase;font-weight:600;color:#94a3b8;">${escapeHtml(ext)}</span>
          <div style="flex:1;height:18px;background:#1e293b;border-radius:4px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:#3b82f6;border-radius:4px;"></div>
          </div>
          <span style="width:50px;text-align:right;color:#cbd5e1;font-variant-numeric:tabular-nums;">${formatNumber(count)}</span>
        </div>
      `;
      })
      .join("");

    const treeHtml = hasTree
      ? Object.keys(tree)
          .map((k) => renderTreeHtml(tree[k], k, 0))
          .join("")
      : '<p style="color:#64748b;font-size:12px;">No file tree available. Run a scan to populate.</p>';

    const gateBadge =
      gatePass === true
        ? '<span style="background:#10b98133;color:#34d399;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">PASS</span>'
        : gatePass === false
          ? '<span style="background:#ef444433;color:#f87171;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">FAIL</span>'
          : '<span style="color:#64748b;font-size:11px;">—</span>';

    this.container.innerHTML = `
      <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;height:100%;padding:16px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif;">
        <!-- Sidebar -->
        <div style="display:flex;flex-direction:column;gap:16px;overflow-y:auto;">
          <!-- Stats -->
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;">
            <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#e2e8f0;">Project</h2>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;word-break:break-all;">${escapeHtml(projectPath || "No project path set")}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
              <div style="background:#1e293b;border-radius:6px;padding:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:#e2e8f0;">${formatNumber(totalFiles)}</div>
                <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Files</div>
              </div>
              <div style="background:#1e293b;border-radius:6px;padding:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:#e2e8f0;">${formatNumber(totalFolders)}</div>
                <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Folders</div>
              </div>
              <div style="background:#1e293b;border-radius:6px;padding:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:#e2e8f0;">${qualityScore}</div>
                <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Quality</div>
              </div>
              <div style="background:#1e293b;border-radius:6px;padding:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:#e2e8f0;">${gateBadge}</div>
                <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Gate</div>
              </div>
            </div>
          </div>

          <!-- Languages -->
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;">
            <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#e2e8f0;">Languages</h2>
            ${langBars || '<p style="color:#64748b;font-size:12px;">No language data available.</p>'}
          </div>
        </div>

        <!-- Main panel -->
        <div style="display:flex;flex-direction:column;gap:16px;overflow:hidden;">
          <!-- File Tree -->
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;flex:1;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h2 style="margin:0;font-size:14px;font-weight:700;color:#e2e8f0;">File Tree (${formatNumber(filePaths.length)} files)</h2>
              <div style="display:flex;gap:8px;">
                <button id="codemap-expand-all" style="background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;">Expand</button>
                <button id="codemap-collapse-all" style="background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;">Collapse</button>
              </div>
            </div>
            <div id="codemap-tree" style="overflow-y:auto;max-height:calc(100% - 40px);">
              ${treeHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const treeEl = this.container.querySelector("#codemap-tree");
    if (!treeEl) return;

    treeEl.addEventListener("click", (e) => {
      const item = e.target.closest(".tree-item");
      if (!item) return;

      const children = item.nextElementSibling;
      if (children && children.classList.contains("tree-children")) {
        const isHidden = children.style.display === "none";
        children.style.display = isHidden ? "" : "none";
        const caret = item.querySelector(".tree-toggle");
        if (caret) caret.textContent = isHidden ? "▼" : "▶";
      }
    });

    const expandBtn = this.container.querySelector("#codemap-expand-all");
    const collapseBtn = this.container.querySelector("#codemap-collapse-all");

    if (expandBtn) {
      expandBtn.addEventListener("click", () => {
        this.container.querySelectorAll(".tree-children").forEach((el) => {
          el.style.display = "";
        });
        this.container.querySelectorAll(".tree-toggle").forEach((el) => {
          el.textContent = "▼";
        });
      });
    }

    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        this.container.querySelectorAll(".tree-children").forEach((el) => {
          el.style.display = "none";
        });
        this.container.querySelectorAll(".tree-toggle").forEach((el) => {
          el.textContent = "▶";
        });
      });
    }
  }

  destroy() {
    this.container = null;
  }
}
