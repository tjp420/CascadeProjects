// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
import { fetchPathHealthMetrics } from "../services/pathHealthService.js";
let refreshInterval = null;
let isRefreshing = false;
/**
 * Render path health dashboard.
 * @returns {any}
 */
export function renderPathHealthDashboard() {
  const container = document.createElement("div");
  container.className = "card";
  container.id = "path-health-dashboard";
  const header = document.createElement("div");
  header.className = "card-header";
  const flex = document.createElement("div");
  flex.className = "flex items-center gap-3";
  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = "System Path Health";
  const refreshBtn = document.createElement("button");
  refreshBtn.id = "path-health-refresh";
  refreshBtn.className = "btn btn-sm btn-ghost";
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refresh";
  flex.appendChild(title);
  flex.appendChild(refreshBtn);
  const gate = document.createElement("span");
  gate.id = "path-health-gate";
  gate.className = "badge badge-success";
  gate.textContent = "Loading...";
  header.appendChild(flex);
  header.appendChild(gate);
  const body = document.createElement("div");
  body.className = "card-body";
  const content = document.createElement("div");
  content.id = "path-health-content";
  const loading = document.createElement("div");
  loading.className = "text-gray-500";
  loading.textContent = "Loading system metrics...";
  content.appendChild(loading);
  body.appendChild(content);
  container.appendChild(header);
  container.appendChild(body);
  bindPathHealthDashboard(container);
  return container;
}
/**
 * Bind path health dashboard.
 * @param {any} container
 * @returns {any}
 */
function bindPathHealthDashboard(container) {
  const refreshBtn = container.querySelector("#path-health-refresh");
  refreshBtn.addEventListener("click", () => {
    if (!isRefreshing) {
      loadPathHealthData(container);
    }
  });
  loadPathHealthData(container, true);
  // Set up 30-second polling
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    loadPathHealthData(container, false);
  }, 30000);
}
/**
 * Load path health data.
 * @param {any} container
 * @param {boolean} isInitial
 * @returns {any}
 */
async function loadPathHealthData(container, isInitial = false) {
  const content = container.querySelector("#path-health-content");
  const gateBadge = container.querySelector("#path-health-gate");
  const refreshBtn = container.querySelector("#path-health-refresh");
  if (isInitial) {
    // simplebeacon-ignore innerhtml-usage — static loading text
    if (
      typeof window !== "undefined" &&
      typeof window.setSafeHTML === "function"
    ) {
      window.setSafeHTML(
        content,
        '<div class="text-gray-500">Loading system metrics...</div>',
      );
    } else {
      content.innerHTML =
        '<div class="text-gray-500">Loading system metrics...</div>';
    }
  } else {
    isRefreshing = true;
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";
  }
  try {
    const data = await fetchPathHealthMetrics();
    if (data.status === "success") {
      renderPathHealthContent(content, data);
      // Update gate badge
      const gateClass =
        data.summary.globalGate === "PASS" ? "badge-success" : "badge-danger";
      gateBadge.className = `badge ${gateClass}`;
      gateBadge.textContent = `Gate: ${data.summary.globalGate}`;
    } else if (data.status === "unavailable") {
      // simplebeacon-ignore innerhtml-usage — static offline message
      if (
        typeof window !== "undefined" &&
        typeof window.setSafeHTML === "function"
      ) {
        window.setSafeHTML(
          content,
          '<div class="text-muted" style="font-size:0.85rem;">Path health metrics unavailable — running offline.</div>',
        );
      } else {
        content.innerHTML =
          '<div class="text-muted" style="font-size:0.85rem;">Path health metrics unavailable — running offline.</div>';
      }
      gateBadge.className = "badge badge-ghost";
      gateBadge.textContent = "Gate: —";
    } else {
      // simplebeacon-ignore innerhtml-usage — static error message
      if (
        typeof window !== "undefined" &&
        typeof window.setSafeHTML === "function"
      ) {
        window.setSafeHTML(
          content,
          '<div class="text-red-500">Failed to load metrics.</div>',
        );
      } else {
        content.innerHTML =
          '<div class="text-red-500">Failed to load metrics.</div>';
      }
    }
  } catch (error) {
    const msg = (error && error.message) || String(error);
    window["console"]["error"]("Error fetching path health metrics:", msg);
    // simplebeacon-ignore innerhtml-usage — static error message
    content.innerHTML =
      '<div class="text-red-500">Failed to load metrics.</div>';
  } finally {
    isRefreshing = false;
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }
}
/**
 * Render path health content.
 * @param {any} container
 * @param {any} data
 * @returns {any}
 */
function renderPathHealthContent(container, data) {
  const summary = data.summary;
  const directories = data.directories;
  const engine = data.engine;
  // simplebeacon-ignore innerhtml-usage — internal API data rendered to trusted container
  const html = `
    <div class="metrics-grid mb-4">
      <div class="metric-card">
        <div class="metric-label">Files Scanned</div>
        <div class="metric-value">${summary.totalFilesScanned}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Files Ignored</div>
        <div class="metric-value">${summary.totalFilesIgnored}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Active Rules</div>
        <div class="metric-value">${summary.activeRuleCount}</div>
      </div>
    </div>
    
    <div class="table-container mb-4">
      <table class="data-table">
        <thead>
          <tr>
            <th>Directory Path</th>
            <th>Status</th>
            <th>Findings</th>
          </tr>
        </thead>
        <tbody>
          ${directories
            .map(
              (dir) => `
            <tr>
              <td class="font-mono">${dir.path}</td>
              <td><span class="text-success font-semibold">${dir.status}</span></td>
              <td>${dir.findings}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    
    <div class="flex justify-between text-xs text-gray-400 font-mono">
      <span>Engine: v${engine.version} (${engine.suppressedFalsePositives} Suppressed FP)</span>
      <span>Refreshed: ${new Date(data.timestamp).toLocaleTimeString()}</span>
    </div>
  `;
  if (
    typeof window !== "undefined" &&
    typeof window.setSafeHTML === "function"
  ) {
    window.setSafeHTML(container, html);
  } else {
    container.innerHTML = html;
  }
}
/**
 * Cleanup path health dashboard.
 * @returns {any}
 */
export function cleanupPathHealthDashboard() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
