import { fetchPathHealthMetrics } from '../services/pathHealthService.js';

let refreshInterval = null;
let isRefreshing = false;

export function renderPathHealthDashboard() {
  const container = document.createElement('div');
  container.className = 'card';
  container.id = 'path-health-dashboard';
  
  container.innerHTML = `
    <div class="card-header">
      <div class="flex items-center gap-3">
        <span class="card-title">System Path Health</span>
        <button id="path-health-refresh" class="btn btn-sm btn-ghost" disabled>
          Refresh
        </button>
      </div>
      <span id="path-health-gate" class="badge badge-success">Loading...</span>
    </div>
    <div class="card-body">
      <div id="path-health-content">
        <div class="text-gray-500">Loading system metrics...</div>
      </div>
    </div>
  `;
  
  bindPathHealthDashboard(container);
  return container;
}

function bindPathHealthDashboard(container) {
  const refreshBtn = container.querySelector('#path-health-refresh');
  
  refreshBtn.addEventListener('click', () => {
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

async function loadPathHealthData(container, isInitial = false) {
  const content = container.querySelector('#path-health-content');
  const gateBadge = container.querySelector('#path-health-gate');
  const refreshBtn = container.querySelector('#path-health-refresh');
  
  if (isInitial) {
    content.innerHTML = '<div class="text-gray-500">Loading system metrics...</div>';
  } else {
    isRefreshing = true;
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
  }
  
  try {
    const data = await fetchPathHealthMetrics();
    
    if (data.status === 'success') {
      renderPathHealthContent(content, data);
      
      // Update gate badge
      const gateClass = data.summary.globalGate === 'PASS' ? 'badge-success' : 'badge-danger';
      gateBadge.className = `badge ${gateClass}`;
      gateBadge.textContent = `Gate: ${data.summary.globalGate}`;
    } else {
      content.innerHTML = '<div class="text-red-500">Failed to load metrics.</div>';
    }
  } catch (error) {
    console.error('Error fetching path health metrics:', error);
    content.innerHTML = '<div class="text-red-500">Failed to load metrics.</div>';
  } finally {
    isRefreshing = false;
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh';
  }
}

function renderPathHealthContent(container, data) {
  const summary = data.summary;
  const directories = data.directories;
  const engine = data.engine;
  
  container.innerHTML = `
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
          ${directories.map(dir => `
            <tr>
              <td class="font-mono">${dir.path}</td>
              <td><span class="text-success font-semibold">${dir.status}</span></td>
              <td>${dir.findings}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="flex justify-between text-xs text-gray-400 font-mono">
      <span>Engine: v${engine.version} (${engine.suppressedFalsePositives} Suppressed FP)</span>
      <span>Refreshed: ${new Date(data.timestamp).toLocaleTimeString()}</span>
    </div>
  `;
}

export function cleanupPathHealthDashboard() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
