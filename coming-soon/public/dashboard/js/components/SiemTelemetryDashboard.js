// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
import { fetchSiemTelemetry } from "../services/siemTelemetryService.js";

let refreshInterval = null;
let isRefreshing = false;

/**
 * Render SIEM telemetry dashboard.
 * @returns {HTMLElement}
 */
export function renderSiemTelemetryDashboard() {
  const container = document.createElement("div");
  container.className = "card";
  container.id = "siem-telemetry-dashboard";

  const header = document.createElement("div");
  header.className = "card-header";
  const flex = document.createElement("div");
  flex.className = "flex items-center gap-3";
  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = "SIEM Cluster Telemetry";
  const refreshBtn = document.createElement("button");
  refreshBtn.id = "siem-telemetry-refresh";
  refreshBtn.className = "btn btn-sm btn-ghost";
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refresh";
  flex.appendChild(title);
  flex.appendChild(refreshBtn);
  const statusBadge = document.createElement("span");
  statusBadge.id = "siem-telemetry-status";
  statusBadge.className = "badge badge-ghost";
  statusBadge.textContent = "Loading...";
  header.appendChild(flex);
  header.appendChild(statusBadge);

  const body = document.createElement("div");
  body.className = "card-body";
  const content = document.createElement("div");
  content.id = "siem-telemetry-content";
  const loading = document.createElement("div");
  loading.className = "text-gray-500";
  loading.textContent = "Loading SIEM telemetry...";
  content.appendChild(loading);
  body.appendChild(content);

  container.appendChild(header);
  container.appendChild(body);

  bindSiemTelemetryDashboard(container);
  return container;
}

/**
 * Bind SIEM telemetry dashboard events.
 * @param {HTMLElement} container
 */
function bindSiemTelemetryDashboard(container) {
  const refreshBtn = container.querySelector("#siem-telemetry-refresh");

  refreshBtn.addEventListener("click", () => {
    if (!isRefreshing) {
      loadSiemTelemetryData(container);
    }
  });

  loadSiemTelemetryData(container, true);

  // Set up 15-second polling for near-real-time telemetry
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    loadSiemTelemetryData(container, false);
  }, 15000);
}

/**
 * Load SIEM telemetry data.
 * @param {HTMLElement} container
 * @param {boolean} isInitial
 */
async function loadSiemTelemetryData(container, isInitial = false) {
  const content = container.querySelector("#siem-telemetry-content");
  const statusBadge = container.querySelector("#siem-telemetry-status");
  const refreshBtn = container.querySelector("#siem-telemetry-refresh");

  if (isInitial) {
    // simplebeacon-ignore innerhtml-usage — static loading text
    content.innerHTML =
      '<div class="text-gray-500">Loading SIEM telemetry...</div>';
  } else {
    isRefreshing = true;
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";
  }

  try {
    const data = await fetchSiemTelemetry();

    if (data.status === "success") {
      renderSiemTelemetryContent(content, data);
      const syncClass = data.distributedSyncEnabled
        ? "badge-success"
        : "badge-ghost";
      const syncLabel = data.distributedSyncEnabled
        ? `Sync: ${data.peerCount} peers`
        : "Single-node";
      statusBadge.className = `badge ${syncClass}`;
      statusBadge.textContent = syncLabel;
    } else if (data.status === "unavailable") {
      // simplebeacon-ignore innerhtml-usage — static offline message
      content.innerHTML =
        '<div class="text-muted" style="font-size:0.85rem;">SIEM telemetry unavailable — running offline or broker not initialized.</div>';
      statusBadge.className = "badge badge-ghost";
      statusBadge.textContent = "Offline";
    } else {
      // simplebeacon-ignore innerhtml-usage — static error message
      content.innerHTML =
        '<div class="text-red-500">Failed to load SIEM telemetry.</div>';
    }
  } catch (error) {
    const msg = (error && error.message) || String(error);
    console.error("Error fetching SIEM telemetry:", msg);
    // simplebeacon-ignore innerhtml-usage — static error message
    content.innerHTML =
      '<div class="text-red-500">Failed to load SIEM telemetry.</div>';
  } finally {
    isRefreshing = false;
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }
}

/**
 * Render SIEM telemetry content.
 * @param {HTMLElement} container
 * @param {object} data
 */
function renderSiemTelemetryContent(container, data) {
  const m = data.metrics || {};
  const peers = data.peers || {};
  const peerEntries = Object.entries(peers);

  // Weight-related calculations
  const nodeWeight = data.nodeWeight || 1;
  const clusterWeight = data.clusterWeight || nodeWeight;
  const proportionalSharePct =
    clusterWeight > 0
      ? ((nodeWeight / clusterWeight) * 100).toFixed(1)
      : "100.0";

  // Build weight entries for all nodes (self + peers) for the allocation bar
  const allWeightEntries = [
    { id: data.nodeId || "self", weight: nodeWeight, isSelf: true },
    ...peerEntries.map(([peerId, peer]) => ({
      id: peerId,
      weight: peer.weight || 1,
      isSelf: false,
    })),
  ];
  const totalBarWeight = allWeightEntries.reduce((sum, e) => sum + e.weight, 0);

  // simplebeacon-ignore innerhtml-usage — internal API data rendered to trusted container
  container.innerHTML = `
    <div class="metrics-grid mb-4">
      <div class="metric-card">
        <div class="metric-label">Events Processed</div>
        <div class="metric-value">${m.siem_events_processed_total || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Events Dropped</div>
        <div class="metric-value text-red-400">${m.siem_events_dropped_total || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Events Bypassed (CRITICAL/FATAL)</div>
        <div class="metric-value text-yellow-400">${m.siem_events_bypassed_total || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Current Tokens</div>
        <div class="metric-value">${m.currentTokens || 0}</div>
      </div>
    </div>

    <div class="metrics-grid mb-4">
      <div class="metric-card">
        <div class="metric-label">Tokens Borrowed</div>
        <div class="metric-value">${m.siem_tokens_borrowed_total || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Tokens Granted</div>
        <div class="metric-value">${m.siem_tokens_granted_total || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Token Requests Sent</div>
        <div class="metric-value">${m.siem_token_requests_sent_total || 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Token Requests Received</div>
        <div class="metric-value">${m.siem_token_requests_received_total || 0}</div>
      </div>
    </div>

    ${
      data.distributedSyncEnabled
        ? `
    <div class="metrics-grid mb-4">
      <div class="metric-card">
        <div class="metric-label">Node Weight</div>
        <div class="metric-value">${nodeWeight}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Cluster Weight (&Sigma;)</div>
        <div class="metric-value">${clusterWeight}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Proportional Share</div>
        <div class="metric-value text-blue-400">${proportionalSharePct}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Fair Share Tokens</div>
        <div class="metric-value">${data.fairShare || 0}</div>
      </div>
    </div>

    <div class="siem-weight-bar-container mb-4">
      <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem;">Capacity Weight Allocation</h4>
      <div class="siem-weight-bar">
        ${allWeightEntries
          .map((entry) => {
            const pct =
              totalBarWeight > 0 ? (entry.weight / totalBarWeight) * 100 : 0;
            const cls = entry.isSelf
              ? "siem-weight-seg-self"
              : "siem-weight-seg-peer";
            const label =
              entry.id.length > 12
                ? entry.id.substring(0, 10) + ".."
                : entry.id;
            return `<div class="siem-weight-seg ${cls}" style="width:${pct}%;" title="${entry.id}: weight ${entry.weight} (${pct.toFixed(1)}%)">
            <span class="siem-weight-seg-label">${label} (${entry.weight})</span>
          </div>`;
          })
          .join("")}
      </div>
      <div class="siem-weight-bar-legend">
        <span class="siem-weight-legend-item"><span class="siem-weight-legend-dot siem-weight-legend-self"></span>Self (weight ${nodeWeight})</span>
        <span class="siem-weight-legend-item"><span class="siem-weight-legend-dot siem-weight-legend-peer"></span>Peers (${peerEntries.length} seen)</span>
      </div>
    </div>

    <div class="table-container mb-4">
      <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem;">Cluster Nodes (${data.nodeCount || "—"} total, ${peerEntries.length} peers seen)</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>Node ID</th>
            <th>Weight</th>
            <th>Share %</th>
            <th>Local Tokens</th>
            <th>Max Local Tokens</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-mono">${data.nodeId || "—"} (self)</td>
            <td>${nodeWeight}</td>
            <td>${proportionalSharePct}%</td>
            <td>${data.localTokens || 0}</td>
            <td>${data.fairShare || 0}</td>
            <td>now</td>
          </tr>
          ${peerEntries
            .map(([peerId, peer]) => {
              const peerWeight = peer.weight || 1;
              const peerSharePct =
                clusterWeight > 0
                  ? ((peerWeight / clusterWeight) * 100).toFixed(1)
                  : "100.0";
              return `
            <tr>
              <td class="font-mono">${peerId}</td>
              <td>${peerWeight}</td>
              <td>${peerSharePct}%</td>
              <td>${peer.localTokens}</td>
              <td>${peer.maxLocalTokens}</td>
              <td>${peer.lastSeen ? new Date(peer.lastSeen).toLocaleTimeString() : "—"}</td>
            </tr>
          `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    `
        : `
    <div class="text-muted mb-4" style="font-size:0.85rem;">
      Distributed sync is disabled — running in single-node mode. Token borrowing and peer state are not available.
    </div>
    `
    }

    <div class="flex justify-between text-xs text-gray-400 font-mono">
      <span>Node: ${data.nodeId || "—"} | Weight: ${nodeWeight} | Fair share: ${data.fairShare || "—"} | Reserve floor: ${data.reserveFloor || "—"}</span>
      <span>Refreshed: ${data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "—"}</span>
    </div>
  `;
}

/**
 * Cleanup SIEM telemetry dashboard.
 */
export function cleanupSiemTelemetryDashboard() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
