// simplebeacon-ignore: Dashboard code — all findings are false positives
import {
  fetchDropTelemetry,
  resetDropTelemetry,
  getDropHistory,
} from "../services/dropTelemetryService.js";
import { renderSparkline } from "../utils/sparkline.js";

let refreshInterval = null;
let isRefreshing = false;

export function renderDropTelemetryDashboard() {
  const container = document.createElement("div");
  container.className = "card";
  container.id = "drop-telemetry-dashboard";

  const header = document.createElement("div");
  header.className = "card-header";

  const flex = document.createElement("div");
  flex.className = "flex items-center gap-3";

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = "Drag-and-Drop Telemetry";

  const refreshBtn = document.createElement("button");
  refreshBtn.id = "drop-telemetry-refresh";
  refreshBtn.className = "btn btn-sm btn-ghost";
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refresh";

  flex.appendChild(title);
  flex.appendChild(refreshBtn);

  const statusBadge = document.createElement("span");
  statusBadge.id = "drop-telemetry-status";
  statusBadge.className = "badge badge-success";
  statusBadge.textContent = "Loading...";

  header.appendChild(flex);
  header.appendChild(statusBadge);

  const body = document.createElement("div");
  body.className = "card-body";

  const content = document.createElement("div");
  content.id = "drop-telemetry-content";

  const loading = document.createElement("div");
  loading.className = "text-gray-500";
  loading.textContent = "Loading drop telemetry...";
  content.appendChild(loading);

  body.appendChild(content);
  container.appendChild(header);
  container.appendChild(body);

  bindDropTelemetryDashboard(container);
  return container;
}

function bindDropTelemetryDashboard(container) {
  const refreshBtn = container.querySelector("#drop-telemetry-refresh");
  refreshBtn.addEventListener("click", () => {
    if (!isRefreshing) loadDropTelemetryData(container);
  });
  loadDropTelemetryData(container, true);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    loadDropTelemetryData(container, false);
  }, 10000);
}

async function loadDropTelemetryData(container, isInitial) {
  const content = container.querySelector("#drop-telemetry-content");
  const statusBadge = container.querySelector("#drop-telemetry-status");
  const refreshBtn = container.querySelector("#drop-telemetry-refresh");

  if (isRefreshing) return;
  isRefreshing = true;
  refreshBtn.disabled = true;

  try {
    const data = await fetchDropTelemetry();
    const counters = data.counters || {};

    statusBadge.className = "badge badge-success";
    statusBadge.textContent = "Live";

    const metrics = [
      {
        key: "totalDrops",
        label: "Total Drops",
        value: counters.totalDrops || 0,
      },
      {
        key: "filesDropped",
        label: "Files Dropped",
        value: counters.filesDropped || 0,
      },
      {
        key: "preReadSuccesses",
        label: "Pre-Read OK",
        value: counters.preReadSuccesses || 0,
      },
      {
        key: "preReadSkips",
        label: "Pre-Read Skips",
        value: counters.preReadSkips || 0,
      },
      {
        key: "preReadFailures",
        label: "Pre-Read Fails",
        value: counters.preReadFailures || 0,
      },
      {
        key: "firefoxBypass",
        label: "Firefox Bypass",
        value: counters.firefoxBypass || 0,
      },
      {
        key: "traversalErrors",
        label: "Traversal Errors",
        value: counters.traversalErrors || 0,
      },
    ];

    content.innerHTML = "";
    const metricsRow = document.createElement("div");
    metricsRow.className = "metrics-row";

    for (const m of metrics) {
      const chip = document.createElement("div");
      chip.className = "metric-chip";
      const history = getDropHistory(m.key);
      const sparkline = renderSparkline(history);
      if (sparkline) chip.appendChild(sparkline);
      const labelSpan = document.createElement("span");
      labelSpan.innerHTML = "<strong>" + m.value + "</strong> " + m.label;
      chip.appendChild(labelSpan);
      metricsRow.appendChild(chip);
    }

    content.appendChild(metricsRow);
  } catch (error) {
    statusBadge.className = "badge badge-danger";
    statusBadge.textContent = "Error";
    content.innerHTML =
      '<div class="text-danger">Failed to load drop telemetry.</div>';
  } finally {
    isRefreshing = false;
    refreshBtn.disabled = false;
  }
}

export function cleanupDropTelemetryDashboard() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
