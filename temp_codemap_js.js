
const GRAPH = JSON.parse(document.getElementById('graphData').textContent);
const CYCLES = JSON.parse(document.getElementById('cyclesData').textContent);
const ENTRIES = JSON.parse(document.getElementById('entriesData').textContent);
const LEAVES = JSON.parse(document.getElementById('leavesData').textContent);
const CONNECTED = JSON.parse(document.getElementById('connectedData').textContent);
let ANALYSIS = {};
try { ANALYSIS = JSON.parse(document.getElementById('analysisData')?.textContent || '{}'); } catch (e) {}
const nodeSeverity = {};
const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
const severityColor = { critical: '#ef4444', high: '#f59e0b', medium: '#22c55e', low: '#64748b' };
[...(ANALYSIS.issues || []), ...(ANALYSIS.improvements || [])].forEach(item => {
  (item.files || []).forEach(fp => {
    const rank = severityRank[item.severity] || 0;
    if (!nodeSeverity[fp] || rank > severityRank[nodeSeverity[fp]]) nodeSeverity[fp] = item.severity;
  });
});

// Tree interactions
document.getElementById('searchBox').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.tree-node').forEach(node => {
    const nameEl = node.querySelector('.node-name');
    if (!nameEl) return;
    const match = nameEl.textContent.toLowerCase().includes(q);
    node.style.display = match ? 'flex' : 'none';
    if (match && node.dataset.type === 'file') {
      let parent = node.parentElement;
      while (parent && parent.classList.contains('tree-children')) {
        parent.classList.remove('collapsed');
        parent.classList.add('expanded');
        const prev = parent.previousElementSibling;
        if (prev) { const t = prev.querySelector('.toggle'); if (t) t.textContent = '&#x25BC;'; }
        parent = parent.parentElement;
      }
    }
  });
});
document.addEventListener('click', function(e) {
  const el = e.target && e.target.closest && e.target.closest('.toggle');
  if (!el) return;
  const node = el.closest('.tree-node');
  const children = node && node.nextElementSibling;
  if (!children || !children.classList.contains('tree-children')) return;
  const isCollapsed = children.classList.contains('collapsed');
  children.classList.toggle('collapsed', !isCollapsed);
  children.classList.toggle('expanded', isCollapsed);
  el.textContent = isCollapsed ? '&#x25BC;' : '&#x25B6;';
});
document.addEventListener('click', function(e) {
  const el = e.target && e.target.closest && e.target.closest('.tree-node[data-type="file"]');
  if (!el) return;
  document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
  el.classList.add('selected');
  const path = el.querySelector('.node-name')?.getAttribute('title');
  if (!path) return;
  const n = allNodes.find(n => n.id === path || n.label === path || n.label.endsWith('/' + path) || path.endsWith('/' + n.label));
  if (n) { selectedNode = n; showNodeDetails(n); zoomToNode(n); }
});
document.addEventListener('dblclick', function(e) {
  const el = e.target && e.target.closest && e.target.closest('.tree-node[data-type="file"]');
  if (!el) return;
  document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
  el.classList.add('selected');
  const path = el.querySelector('.node-name')?.getAttribute('title');
  if (!path) return;
  const n = allNodes.find(n => n.id === path || n.label === path || n.label.endsWith('/' + path) || path.endsWith('/' + n.label));
  if (n) { selectedNode = n; showNodeDetails(n); zoomToNode(n); }
});
setTimeout(() => {
  document.querySelectorAll('.tree-children').forEach((el) => {
    const depth = el.parentElement.closest('.tree-children') ? 2 : 1;
    if (depth <= 2) {
      el.classList.remove('collapsed');
      el.classList.add('expanded');
      const prev = el.previousElementSibling;
      if (prev) { const t = prev.querySelector('.toggle'); if (t) t.textContent = '&#x25BC;'; }
    }
  });
}, 0);

// Dependency stats
const statsEl = document.getElementById('depStats');
if (statsEl) {
  statsEl.textContent = '';
  const sections = [
    { title: 'Circular Dependencies', count: CYCLES.length, items: CYCLES.slice(0, 5).map(c => c.slice(0, -1).map(x => x.split('/').pop()).join(' → ')) },
    { title: 'Entry Points', count: ENTRIES.length, items: ENTRIES.slice(0, 8) },
    { title: 'Leaf Modules', count: LEAVES.length, items: LEAVES.slice(0, 8) },
    { title: 'Most Connected', count: CONNECTED.length, items: CONNECTED.slice(0, 8).map(c => c.name + ' (' + c.count + ' conn)') }
  ];
  sections.forEach((section) => {
    if (section.count === 0) return;
    const card = document.createElement('div');
    card.className = 'dep-stat-card';
    const h4 = document.createElement('h4');
    h4.textContent = section.title;
    if (section.title === 'Circular Dependencies') {
      const badge = document.createElement('span');
      badge.className = 'cycle-badge';
      badge.textContent = String(section.count);
      h4.appendChild(badge);
    }
    card.appendChild(h4);
    const ul = document.createElement('ul');
    section.items.forEach((item) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = item;
      li.appendChild(span);
      ul.appendChild(li);
    });
    card.appendChild(ul);
    statsEl.appendChild(card);
  });
  const graphCard = document.createElement('div');
  graphCard.className = 'dep-stat-card';
  const graphTitle = document.createElement('h4');
  graphTitle.textContent = 'Graph Stats';
  graphCard.appendChild(graphTitle);
  const graphUl = document.createElement('ul');
  const nodesLi = document.createElement('li');
  const nodesLabel = document.createElement('span');
  nodesLabel.textContent = 'Nodes';
  const nodesVal = document.createElement('span');
  nodesVal.textContent = String(GRAPH.nodes.length);
  nodesLi.appendChild(nodesLabel);
  nodesLi.appendChild(nodesVal);
  const edgesLi = document.createElement('li');
  const edgesLabel = document.createElement('span');
  edgesLabel.textContent = 'Edges';
  const edgesVal = document.createElement('span');
  edgesVal.textContent = String(GRAPH.edges.length);
  edgesLi.appendChild(edgesLabel);
  edgesLi.appendChild(edgesVal);
  graphUl.appendChild(nodesLi);
  graphUl.appendChild(edgesLi);
  graphCard.appendChild(graphUl);
  statsEl.appendChild(graphCard);
  if (statsEl.children.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No dependency data available';
    statsEl.appendChild(empty);
  }
}

// Analysis renderer
(function(){
  const analysisEl = document.getElementById('analysisData');
  if (!analysisEl) return;
  try {
    const ANALYSIS = JSON.parse(analysisEl.textContent);
    const summaryEl = document.getElementById('analysisSummary');
    const gridEl = document.getElementById('analysisGrid');
    const scoreBoard = document.getElementById('scoreBoard');
    const metricsBoard = document.getElementById('metricsBoard');
    const archBoard = document.getElementById('archBoard');
    const recBoard = document.getElementById('recBoard');
    if (!gridEl) return;

    function makeRing(val, label, cls) {
      const r = 27;
      const c = 2 * Math.PI * r;
      const off = c - (val / 100) * c;
      return '<div class="score-ring"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="' + r + '" stroke="#1e293b" stroke-width="6" fill="none"/><circle cx="36" cy="36" r="' + r + '" class="' + cls + '" stroke-width="6" fill="none" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" stroke-linecap="round" transform="rotate(-90 36 36)"/></svg><span class="score-val">' + val + '</span><span class="score-label">' + label + '</span></div>';
    }

    if (scoreBoard && ANALYSIS.summary) {
      const s = ANALYSIS.summary;
      const cls = s.score >= 80 ? 'score-excellent' : s.score >= 60 ? 'score-good' : s.score >= 40 ? 'score-fair' : 'score-poor';
      scoreBoard.textContent = '';
      scoreBoard.insertAdjacentHTML('beforeend', makeRing(s.score, s.scoreLabel || 'Score', cls) +
        makeRing(s.architectureScore || 0, 'Arch', s.architectureScore >= 80 ? 'score-excellent' : s.architectureScore >= 60 ? 'score-good' : s.architectureScore >= 40 ? 'score-fair' : 'score-poor') +
        makeRing(s.couplingScore || 0, 'Coupling', s.couplingScore >= 80 ? 'score-excellent' : s.couplingScore >= 60 ? 'score-good' : s.couplingScore >= 40 ? 'score-fair' : 'score-poor') +
        makeRing(s.complexityScore || 0, 'Complexity', s.complexityScore >= 80 ? 'score-excellent' : s.complexityScore >= 60 ? 'score-good' : s.complexityScore >= 40 ? 'score-fair' : 'score-poor') +
        makeRing(s.testScore || 0, 'Tests', s.testScore >= 80 ? 'score-excellent' : s.testScore >= 60 ? 'score-good' : s.testScore >= 40 ? 'score-fair' : 'score-poor'));
    }

    if (summaryEl && ANALYSIS.summary) {
      const s = ANALYSIS.summary;
      const chips = [
        { label: 'Files', value: s.totalFiles || 0 },
        { label: 'Lines', value: (s.totalLines || 0).toLocaleString() },
        { label: 'Critical', value: s.criticalCount || 0 },
        { label: 'High Issues', value: s.highCount || 0 },
        { label: 'Improvements', value: s.improvementCount || 0 }
      ];
      chips.forEach(c => {
        const chip = document.createElement('div');
        chip.className = 'summary-chip';
        chip.textContent = '';
        chip.insertAdjacentHTML('beforeend', '<b>' + c.value + '</b>' + c.label);
        summaryEl.appendChild(chip);
      });
    }

    if (metricsBoard && ANALYSIS.metrics) {
      const m = ANALYSIS.metrics;
      let html = '<h4 style="margin:8px 0 4px;font-size:13px;color:#94a3b8">Metrics</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">';
      html += '<div class="analysis-card"><div style="color:#94a3b8;font-size:11px">Avg Lines / File</div><div style="font-size:18px;font-weight:700">' + (m.avgFileLines || 0) + '</div><div class="metric-bar"><div style="width:' + Math.min((m.avgFileLines || 0), 100) + '%"></div></div></div>';
      html += '<div class="analysis-card"><div style="color:#94a3b8;font-size:11px">Max Lines</div><div style="font-size:18px;font-weight:700">' + (m.maxFileLines || 0) + '</div></div>';
      html += '<div class="analysis-card"><div style="color:#94a3b8;font-size:11px">Test Ratio</div><div style="font-size:18px;font-weight:700">' + (m.testRatio || 0) + '%</div><div class="metric-bar"><div style="width:' + Math.min((m.testRatio || 0) * 2, 100) + '%"></div></div></div>';
      html += '<div class="analysis-card"><div style="color:#94a3b8;font-size:11px">Dependency Density</div><div style="font-size:18px;font-weight:700">' + (m.dependencyDensity || 0) + '%</div><div class="metric-bar"><div style="width:' + Math.min((m.dependencyDensity || 0) * 3, 100) + '%"></div></div></div>';
      html += '<div class="analysis-card"><div style="color:#94a3b8;font-size:11px">Orphan Files</div><div style="font-size:18px;font-weight:700">' + (m.orphanCount || 0) + '</div></div>';
      html += '<div class="analysis-card"><div style="color:#94a3b8;font-size:11px">Source / Test Files</div><div style="font-size:18px;font-weight:700">' + (m.sourceFileCount || 0) + ' / ' + (m.testFileCount || 0) + '</div></div>';
      if (m.languageDistribution && m.languageDistribution.length) {
        html += '<div class="analysis-card" style="grid-column:1 / -1"><div style="color:#94a3b8;font-size:11px;margin-bottom:6px">Language Distribution</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
        m.languageDistribution.forEach(l => {
          html += '<div class="lang-donut"><span class="dot" style="background:' + (window.EXT_COLORS && window.EXT_COLORS[l.language] ? window.EXT_COLORS[l.language] : '#64748b') + '"></span><span>' + l.language + ' ' + l.percentage + '%</span></div>';
        });
        html += '</div></div>';
      }
      html += '</div>';
      metricsBoard.textContent = '';
      metricsBoard.insertAdjacentHTML('beforeend', html);
    }

    if (archBoard && ANALYSIS.architecture) {
      const a = ANALYSIS.architecture;
      let html = '<h4 style="margin:8px 0 4px;font-size:13px;color:#94a3b8">Architecture</h4>';
      html += '<table class="arch-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>';
      html += '<tr><td>Max Depth</td><td>' + (a.maxDepth || 0) + '</td></tr>';
      html += '<tr><td>Avg Depth</td><td>' + (a.avgDepth || 0) + '</td></tr>';
      html += '<tr><td>Layers</td><td>' + (a.layerCount || 0) + '</td></tr>';
      html += '<tr><td>Isolated Clusters</td><td>' + (a.isolatedClusters || 0) + '</td></tr>';
      html += '<tr><td>Largest Cluster</td><td>' + (a.largestClusterSize || 0) + ' files</td></tr>';
      html += '<tr><td>Entry Points</td><td>' + (a.entryPoints ? a.entryPoints.length : 0) + '</td></tr>';
      html += '<tr><td>Leaf Modules</td><td>' + (a.leafModules ? a.leafModules.length : 0) + '</td></tr>';
      html += '<tr><td>Hub Files</td><td>' + (a.hubFiles ? a.hubFiles.length : 0) + '</td></tr>';
      html += '</tbody></table>';
      if (a.bidirectionalDeps && a.bidirectionalDeps.length) {
        html += '<div style="margin-top:8px;font-size:11px;color:#f59e0b">Bidirectional pairs: ' + a.bidirectionalDeps.slice(0, 5).map(b => (b.source.split('/').pop() || b.source) + ' &harr; ' + (b.target.split('/').pop() || b.target)).join(', ') + (a.bidirectionalDeps.length > 5 ? ' +' + (a.bidirectionalDeps.length - 5) + ' more' : '') + '</div>';
      }
      archBoard.textContent = '';
      archBoard.insertAdjacentHTML('beforeend', html);
    }

    if (recBoard && ANALYSIS.recommendations && ANALYSIS.recommendations.length) {
      const top3 = ANALYSIS.recommendations.slice().sort((a, b) => a.priority - b.priority).slice(0, 3);
      let html = '<h4 style="margin:8px 0 4px;font-size:13px;color:#ef4444">Top 3 Actionable Items</h4>';
      top3.forEach((r, i) => {
        const refactor = r.title.includes('circular') ? 'Extract shared interfaces into a new shared-utils module' :
          r.title.includes('large') ? 'Split by feature/domain — one exported class/function per file' :
          r.title.includes('coupl') ? 'Introduce event bus or dependency injection to decouple hubs' :
          r.title.includes('bidirectional') ? 'Move shared types to a common-types file both import' :
          r.title.includes('chain') ? 'Inline small intermediates or use facade pattern' :
          r.title.includes('test') ? 'Add unit tests for uncovered public APIs' : 'Review and refactor affected files';
        html += '<div class="recommendation-card" style="border-left:3px solid #ef4444"><div class="rec-header"><span class="rec-priority" style="background:#ef4444">#' + (i + 1) + '</span><b style="font-size:13px">' + r.title + '</b><span class="rec-effort">' + r.effort + '</span><span class="rec-impact">' + r.impact + '</span></div><div style="font-size:12px;color:#94a3b8">' + (r.description || '') + '</div><div style="font-size:11px;color:#22c55e;margin-top:4px">Suggested: ' + refactor + '</div></div>';
      });
      html += '<h4 style="margin:12px 0 4px;font-size:13px;color:#94a3b8">All Recommendations</h4>';
      ANALYSIS.recommendations.forEach(r => {
        html += '<div class="recommendation-card"><div class="rec-header"><span class="rec-priority">P' + (r.priority + 1) + '</span><b style="font-size:13px">' + r.title + '</b><span class="rec-effort">' + r.effort + '</span><span class="rec-impact">' + r.impact + '</span></div><div style="font-size:12px;color:#94a3b8">' + (r.description || '') + '</div></div>';
      });
      recBoard.textContent = '';
      recBoard.insertAdjacentHTML('beforeend', html);
    }

    const allItems = [
      ...(ANALYSIS.issues || []).map(i => ({ ...i, kind: 'issue' })),
      ...(ANALYSIS.improvements || []).map(i => ({ ...i, kind: 'improvement' }))
    ];
    if (allItems.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No analysis issues or improvements found';
      gridEl.appendChild(empty);
    } else {
      allItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'analysis-card';
        const h4 = document.createElement('h4');
        const badge = document.createElement('span');
        badge.className = 'sev-badge sev-' + item.severity;
        badge.textContent = item.severity.toUpperCase();
        h4.appendChild(badge);
        const titleSpan = document.createElement('span');
        titleSpan.textContent = item.title;
        h4.appendChild(titleSpan);
        card.appendChild(h4);
        if (item.files && item.files.length > 0) {
          const ul = document.createElement('ul');
          item.files.forEach(f => {
            const li = document.createElement('li');
            const name = document.createElement('span');
            name.textContent = f.split('/').pop() || f;
            name.title = f;
            li.appendChild(name);
            ul.appendChild(li);
          });
          card.appendChild(ul);
        }
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = item.description || '';
        card.appendChild(desc);
        gridEl.appendChild(card);
      });
    }
  } catch (e) { /* ignore analysis parse errors */ }
})();

// Sidebar toggle
(function(){
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.main');
  const btn = document.getElementById('toggleSidebarBtn');
  if (btn && sidebar && main) {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
      main.classList.toggle('full-width');
      setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 300);
    });
  }
})();

// Force-directed graph with full interactivity
(function(){
  const canvas = document.getElementById('graphCanvas');
  if (!canvas || GRAPH.nodes.length === 0) return;
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;
  const detailsPanel = document.getElementById('nodeDetailsPanel');
  const detailName = document.getElementById('nodeDetailName');
  const detailBody = document.getElementById('nodeDetailBody');
  const closeDetails = document.getElementById('closeNodeDetails');
  const searchInput = document.getElementById('graphSearch');
  const filterInputs = document.querySelectorAll('.ext-filter');

  function resize() { canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight; }
  resize(); window.addEventListener('resize', resize);

  const colors = {'.js':'#f7df1e','.ts':'#3178c6','.tsx':'#61dafb','.jsx':'#61dafb','.cjs':'#f0db4f','.mjs':'#f0db4f','.py':'#3776ab'};
  const W = () => canvas.width, H = () => canvas.height;
  const initRadius = Math.min(Math.min(W(),H())/2, Math.max(200, Math.sqrt(GRAPH.nodes.length)*16));
  const allNodes = GRAPH.nodes.map((n,i) => {
    const angle = (i / Math.max(1, GRAPH.nodes.length)) * Math.PI * 2 + (i * 0.7);
    const spread = initRadius * (0.3 + 0.7 * Math.sqrt(i / Math.max(1, GRAPH.nodes.length)));
    return {id:n.id,label:n.label,group:n.group,x:W()/2+Math.cos(angle)*spread,y:H()/2+Math.sin(angle)*spread,vx:0,vy:0,radius:Math.max(3,Math.min(14,3+Math.log10((n.size||1)+1))),color:colors[n.group]||'#64748b',visible:true,highlighted:false,connCount:0};
  });
  const allEdges = GRAPH.edges.map(e => ({source:e.source,target:e.target,visible:true}));
  const nodeMap = Object.fromEntries(allNodes.map(n=>[n.id,n]));
  const edges = allEdges.map(e => ({source:nodeMap[e.source],target:nodeMap[e.target]})).filter(e=>e.source&&e.target);
  edges.forEach(e => { if (e.source) e.source.connCount++; if (e.target) e.target.connCount++; });
  allNodes.forEach(n => { n.radius = Math.max(4, Math.min(20, 4 + Math.sqrt(n.connCount) * 2.5)); });

  let dragging = null, panning = false, panStart = {x:0,y:0}, hoverNode = null, selectedNode = null, dragMoved = false;
  let offset = {x:0,y:0}, scale = 1, pan = {x:0,y:0}, physicsPaused = false, searchQuery = '';
  let is3D = false, rotX = 0.6, rotY = 0, isRotating = false, rotStart = {x:0, y:0};
  let labelsVisible = false;
  let gridVisible = true;
  let focusMode = false;
  let starsVisible = true;
  const stars = Array.from({length: 200}, () => ({
    x: Math.random(), y: Math.random(),
    size: 0.5 + Math.random() * 1.5,
    alpha: 0.15 + Math.random() * 0.4,
    twinkle: Math.random() * Math.PI * 2
  }));
  let middlePanning = false, middlePanStart = {x:0,y:0,px:0,py:0};
  let isOrbiting = false, orbitStart = {x:0,y:0};
  let zoomDragging = false, zoomDragStartY = 0;
  let rightPanning = false, rightPanStart = {x:0,y:0}, rightClickStartScreen = {x:0,y:0}, rightDragged = false;
  const keysPressed = new Set();
  let autoRun = false;
  let cameraOffset = {x:0,y:0,z:700};
  let manualMouseLook = false;
  let lastMouseX = 0, lastMouseY = 0, mouseLookActive = false;

  function getFilteredNodes() { return allNodes.filter(n => n.visible); }
  function getFilteredEdges() { return edges.filter(e => e.source.visible && e.target.visible); }
  function getConnectedNodeIds(node) {
    const connected = new Set();
    if (!node) return connected;
    connected.add(node.id);
    edges.forEach(e => {
      if (e.source === node) connected.add(e.target.id);
      if (e.target === node) connected.add(e.source.id);
    });
    return connected;
  }

  function clientPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function worldPosFromClient(cp) {
    return { x: (cp.x - pan.x) / scale, y: (cp.y - pan.y) / scale };
  }
  function worldPos(e) {
    return worldPosFromClient(clientPos(e));
  }

  function nodeAt(wp) {
    for (const n of allNodes) {
      if (!n.visible) continue;
      const dx = wp.x - n.x, dy = wp.y - n.y;
      if (dx*dx + dy*dy < (n.radius+6)**2) return n;
    }
    return null;
  }

  function project3D(n) {
    const cx = W() / 2, cy = H() / 2;
    const focal = 2000;
    const x0 = n.x - cx - cameraOffset.x;
    const y0 = n.y - cy - cameraOffset.y;
    const z0 = cameraOffset.z - n.z;
    const x1 = x0 * Math.cos(rotY) - z0 * Math.sin(rotY);
    const z1 = x0 * Math.sin(rotY) + z0 * Math.cos(rotY);
    const y1 = y0 * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = y0 * Math.sin(rotX) + z1 * Math.cos(rotX);
    if (z2 < 0.1) return null;
    const depthScale = Math.max(0.001, Math.min(2.5, focal / (focal + z2)));
    return { x: cx + x1 * scale * depthScale + pan.x, y: cy + y1 * scale * depthScale + pan.y, depthScale, z2 };
  }

  function clampCameraDistance() {
    const dist = Math.sqrt(cameraOffset.x*cameraOffset.x + cameraOffset.y*cameraOffset.y + cameraOffset.z*cameraOffset.z);
    if (dist < 0.001) { cameraOffset = {x:0,y:0,z:700}; return; }
    const minDist = 50, maxDist = 200000;
    if (dist < minDist || dist > maxDist) {
      const clamped = Math.max(minDist, Math.min(maxDist, dist));
      const s = clamped / dist;
      cameraOffset.x *= s; cameraOffset.y *= s; cameraOffset.z *= s;
    }
  }
  function nodeAt3D(cp) {
    const vis = getFilteredNodes();
    let best = null, bestDist = Infinity;
    for (const n of vis) {
      const p = project3D(n);
      if (!p) continue;
      const r = n.radius * p.depthScale;
      const dx = cp.x - p.x, dy = cp.y - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < Math.max(r + 10, 18) && dist < bestDist) { best = n; bestDist = dist; }
    }
    return best;
  }

  // City-layout: classify files into architectural layers
  function classifyLayer(fp) {
    const p = String(fp).toLowerCase().replace(/\\/g, '/');
    const name = p.split('/').pop() || '';
    if (/(?:^|\/)(test|tests|__tests__|__mocks__|spec|e2e|cypress|playwright)(?:\/|$)/.test(p) || /\.(test|spec)\.(js|ts|jsx|tsx|py|go|rs)$/.test(name)) return 'tests';
    if (/^(index|main|app|server|cli|entry|bootstrap|start)\.(js|ts|cjs|mjs|py|go|rs|java)$/.test(name)) return 'entry';
    if (/(?:^|\/)(components?|ui|pages?|views?|templates?|widgets|screens|layouts?)(?:\/|$)/.test(p) || /\.(tsx|jsx|vue|svelte|html|css|scss|less)$/.test(name)) return 'ui';
    if (/(?:^|\/)(services?|controllers?|business|logic|api|routes?|handlers?|middleware|actions?)(?:\/|$)/.test(p) || /(service|controller|route|handler|middleware|action)\.(js|ts|cjs|mjs)$/.test(name)) return 'business';
    if (/(?:^|\/)(db|database|models?|repositories?|stores?|schemas?|migrations?|configs?|settings?|infra|docker|k8s|helm)(?:\/|$)/.test(p) || /(config|model|schema|repository|store|migration|docker|dockerfile|docker-compose|k8s|helm)\.(js|ts|json|yaml|yml|env)$/.test(name)) return 'data';
    if (/(?:^|\/)(utils?|helpers?|lib|common|shared|tools?|scripts?|packages?)(?:\/|$)/.test(p) || /(util|helper|common|shared|tool|lib)\.(js|ts|cjs|mjs)$/.test(name)) return 'utils';
    return 'other';
  }

  canvas.addEventListener('mousedown', e => {
    dragMoved = false;
    // Left = turn/rotate (always works in 3D, even with manualMouseLook/pointer-lock)
    if (e.button === 0) {
      e.preventDefault();
      if (is3D) { isRotating = true; rotStart = {x: e.clientX, y: e.clientY}; return; }
      isOrbiting = true; orbitStart = { x: e.clientX, y: e.clientY }; return;
    }
    if (document.pointerLockElement === canvas || manualMouseLook) {
      if (e.button !== 0) e.preventDefault();
      return;
    }
    // Middle = zoom control
    if (e.button === 1) {
      e.preventDefault();
      zoomDragging = true;
      zoomDragStartY = e.clientY;
      return;
    }
    // Right = grab/pan (context menu on simple click)
    if (e.button === 2) {
      e.preventDefault();
      rightPanning = true;
      const cp = clientPos(e);
      rightPanStart = cp;
      rightClickStartScreen = { x: e.clientX, y: e.clientY };
      rightDragged = false;
      return;
    }
  });
  canvas.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
      if (is3D) {
        rotY += e.movementX * 0.005;
        rotX += e.movementY * 0.005;
      } else {
        pan.x += e.movementX;
        pan.y += e.movementY;
      }
    }
    if (manualMouseLook && is3D) {
      rotY += (e.clientX - lastMouseX) * 0.008;
      rotX += (e.clientY - lastMouseY) * 0.008;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    const cp = clientPos(e);
    if (isRotating) {
      const dx = e.clientX - rotStart.x; const dy = e.clientY - rotStart.y;
      if (is3D) {
        // First-person look: yaw left/right, pitch up/down
        const sensitivity = 0.008;
        rotY += dx * sensitivity;
        rotX += dy * sensitivity;
      }
      rotStart = {x: e.clientX, y: e.clientY};
      canvas.style.cursor = 'move'; dragMoved = true; return;
    }
    if (zoomDragging) {
      const dy = e.clientY - zoomDragStartY;
      if (is3D) {
        cameraOffset.z += dy * 3;
        updateZoomDisplay();
      } else {
        const factor = Math.exp(-dy * 0.01);
        zoomAtCenter(factor);
      }
      zoomDragStartY = e.clientY;
      canvas.style.cursor = 'ns-resize'; dragMoved = true; return;
    }
    if (rightPanning) {
      const sdx = e.clientX - rightClickStartScreen.x;
      const sdy = e.clientY - rightClickStartScreen.y;
      if (Math.sqrt(sdx*sdx + sdy*sdy) > 5) rightDragged = true;
      pan.x += cp.x - rightPanStart.x;
      pan.y += cp.y - rightPanStart.y;
      rightPanStart = cp;
      canvas.style.cursor = 'grabbing'; dragMoved = true; return;
    }
    if (isOrbiting) {
      const dx = e.clientX - orbitStart.x;
      const dy = e.clientY - orbitStart.y;
      if (is3D) {
        const speed = e.altKey ? 0.002 : 0.005;
        pan.x += dx * speed * scale * 50;
        pan.y += dy * speed * scale * 50;
      } else {
        pan.x += dx;
        pan.y += dy;
      }
      orbitStart = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'all-scroll'; dragMoved = true; return;
    }
    if (is3D) { hoverNode = nodeAt3D(cp); canvas.style.cursor = hoverNode ? 'pointer' : 'move'; return; }
    const wp = worldPosFromClient(cp); hoverNode = nodeAt(wp);
    if (dragging) {
      dragging.x = wp.x - offset.x; dragging.y = wp.y - offset.y;
      canvas.style.cursor = 'grabbing'; dragMoved = true;
    } else {
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    }
  });
  canvas.addEventListener('mouseup', e => {
    if (e.button === 2 && rightPanning && !rightDragged) {
      if (document.pointerLockElement === canvas || manualMouseLook) {
        const center = { x: W() / 2, y: H() / 2 };
        const chNode = is3D ? nodeAt3D(center) : nodeAt(worldPosFromClient(center));
        if (chNode) { selectedNode = chNode; showNodeDetails(chNode); }
      } else {
        showContextMenu(e.clientX, e.clientY);
      }
    }
    dragging = null; panning = false; isRotating = false; zoomDragging = false; middlePanning = false; rightPanning = false; isOrbiting = false;
  });
  canvas.addEventListener('mouseleave', () => { dragging = null; panning = false; isRotating = false; zoomDragging = false; middlePanning = false; rightPanning = false; isOrbiting = false; });
  canvas.addEventListener('click', e => {
    if (dragMoved) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    if (is3D) {
      const cp = clientPos(e);
      const n = nodeAt3D(cp);
      if (n) { selectedNode = n; showNodeDetails(n); }
      else { selectedNode = null; if (detailsPanel) detailsPanel.classList.add('hidden'); }
      return;
    }
    const wp = worldPos(e); const n = nodeAt(wp);
    if (n) { selectedNode = n; showNodeDetails(n); }
    else { selectedNode = null; if (detailsPanel) detailsPanel.classList.add('hidden'); }
  });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); });
  function showContextMenu(cx, cy) {
    const cp = clientPos({ clientX: cx, clientY: cy });
    const n = is3D ? nodeAt3D(cp) : nodeAt(worldPosFromClient(cp));
    const menu = document.getElementById('contextMenu'); if (!menu) return;
    menu.style.display = 'block';
    menu.style.left = (cx + 10) + 'px';
    menu.style.top = (cy + 10) + 'px';
    const items = [];
    if (n) {
      items.push({ label: 'Zoom to Node', action: () => { zoomToNode(n); selectedNode = n; showNodeDetails(n); } });
      items.push({ label: 'View Details', action: () => { selectedNode = n; showNodeDetails(n); } });
    }
    items.push({ label: 'Fit to Screen', action: () => document.getElementById('fitScreenBtn')?.click() });
    items.push({ label: 'Reset View', action: () => document.getElementById('resetViewBtn')?.click() });
    items.push({ label: 'Toggle Sidebar', action: () => document.getElementById('toggleSidebarBtn')?.click() });
    items.push({ label: 'Toggle Labels', action: () => document.getElementById('toggleLabelsBtn')?.click() });
    menu.textContent = '';
    menu.insertAdjacentHTML('beforeend', items.map(it => '<div class="context-menu-item">' + it.label + '</div>').join(''));
    menu.querySelectorAll('.context-menu-item').forEach((el, i) => {
      el.addEventListener('click', () => { items[i].action(); menu.style.display = 'none'; });
    });
    const closeMenu = () => { menu.style.display = 'none'; document.removeEventListener('click', closeMenu); };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const speedMult = e.shiftKey ? 3 : 1;
    if (is3D) {
      // Zoom along camera-forward direction (toward/away from scene center)
      const dz = e.deltaY * 1.5 * speedMult;
      const sinY = Math.sin(rotY), cosY = Math.cos(rotY);
      const sinX = Math.sin(rotX), cosX = Math.cos(rotX);
      const move = dz * 2;
      cameraOffset.x -= move * sinY * cosX;
      cameraOffset.y -= move * sinX;
      cameraOffset.z += move * cosY * cosX;
      clampCameraDistance();
      updateZoomDisplay();
      return;
    }
    const cp = clientPos(e);
    const factor = Math.exp(-e.deltaY * 0.003 * speedMult);
    const newScale = Math.max(0.05, Math.min(20, scale * factor));
    const worldBefore = worldPosFromClient(cp);
    scale = newScale;
    pan.x = cp.x - worldBefore.x * scale;
    pan.y = cp.y - worldBefore.y * scale;
    updateZoomDisplay();
  }, {passive:false});
  // Double-click to zoom into a node
  canvas.addEventListener('dblclick', e => {
    if (is3D) {
      const cp = clientPos(e);
      const n = nodeAt3D(cp) || selectedNode;
      if (n) { zoomToNode(n); selectedNode = n; showNodeDetails(n); }
    } else {
      const n = nodeAt(worldPos(e)) || selectedNode;
      if (n) { zoomToNode(n); selectedNode = n; showNodeDetails(n); }
    }
  });

  function showNodeDetails(n) {
    if (!detailsPanel || !detailName || !detailBody) return;
    const incoming = allEdges.filter(e => e.target === n.id).map(e => nodeMap[e.source]?.label || e.source);
    const outgoing = allEdges.filter(e => e.source === n.id).map(e => nodeMap[e.target]?.label || e.target);
    const cycles = CYCLES.filter(c => c.includes(n.id)).length;
    const nodeSize = GRAPH.nodes.find(function(x){ return x.id === n.id; })?.size || '--';
    detailName.textContent = n.label;
    let html = '';
    html += '<div class="detail-row"><span class="detail-label">Path</span><span>' + n.id + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">Type</span><span>' + n.group + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">Lines</span><span>' + nodeSize + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">Incoming</span><span>' + incoming.length + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">Outgoing</span><span>' + outgoing.length + '</span></div>';
    html += '<div class="detail-row"><span class="detail-label">Cycles</span><span>' + cycles + '</span></div>';
    html += '<div style="margin-top:8px;"><button id="openInEditorBtn" style="background:#06b6d4;border:none;border-radius:6px;color:#0f172a;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;width:100%">Open in Editor</button></div>';
    if (incoming.length) {
      html += '<div style="margin-top:6px;color:#64748b;font-size:11px;">Imported by:</div>';
      html += '<div style="max-height:60px;overflow-y:auto;font-size:11px;">' + incoming.slice(0,5).join('<br>') + '</div>';
    }
    if (outgoing.length) {
      html += '<div style="margin-top:6px;color:#64748b;font-size:11px;">Imports:</div>';
      html += '<div style="max-height:60px;overflow-y:auto;font-size:11px;">' + outgoing.slice(0,5).join('<br>') + '</div>';
    }
    detailBody.textContent = '';
    detailBody.insertAdjacentHTML('beforeend', html);
    detailsPanel.classList.remove('hidden');
    const openBtn = document.getElementById('openInEditorBtn');
    if (openBtn) openBtn.addEventListener('click', () => {
      if (typeof acquireVsCodeApi !== 'undefined') {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ command: 'openFile', path: n.id });
      }
    });
  }
  if (closeDetails) closeDetails.addEventListener('click', () => { selectedNode = null; detailsPanel.classList.add('hidden'); });

  // Filters
  function applyFilters() {
    const active = new Set();
    filterInputs.forEach(cb => { if (cb.checked) active.add(cb.value); });
    allNodes.forEach(n => {
      const group = n.group;
      const known = ['.js','.ts','.tsx','.jsx','.cjs','.mjs','.py'];
      const key = known.includes(group) ? group : 'other';
      n.visible = active.has(key);
      if (n.visible && searchQuery) { n.visible = n.label.toLowerCase().includes(searchQuery) || n.id.toLowerCase().includes(searchQuery); }
    });
  }
  filterInputs.forEach(cb => cb.addEventListener('change', applyFilters));
  if (searchInput) searchInput.addEventListener('input', e => { searchQuery = e.target.value.toLowerCase(); applyFilters(); });

  // Zoom helpers
  const zoomDisplay = document.getElementById('zoomLevelDisplay');
  function updateZoomDisplay() {
    if (!zoomDisplay) return;
    if (is3D) {
      const dist = Math.abs(cameraOffset.z);
      const pct = Math.round(800 / (800 + dist) * 100);
      zoomDisplay.textContent = pct + '%';
    } else {
      zoomDisplay.textContent = Math.round(scale * 100) + '%';
    }
  }
  function zoomAtCenter(factor) {
    const rect = canvas.getBoundingClientRect();
    const cp = { x: rect.width / 2, y: rect.height / 2 };
    if (is3D) {
      const dz = (factor > 1 ? -200 : 200);
      cameraOffset.z += dz;
      updateZoomDisplay(); return;
    }
    const worldBefore = worldPosFromClient(cp);
    const newScale = Math.max(0.05, Math.min(20, scale * factor));
    scale = newScale;
    pan.x = cp.x - worldBefore.x * scale;
    pan.y = cp.y - worldBefore.y * scale;
    updateZoomDisplay();
  }
  function zoomToNode(n) {
    if (!n) return;
    if (is3D) {
      const layerZ = { entry: -2500, ui: -1200, business: 0, data: 1200, utils: -800, tests: 2500, other: 800 };
      const targetZ = layerZ[classifyLayer(n.label)] || 0;
      cameraOffset.x = -n.x;
      cameraOffset.y = -n.y;
      cameraOffset.z = targetZ - 1500;
      scale = 1.2; pan = {x:0,y:0}; rotX = 0.6; rotY = 0;
      updateZoomDisplay(); return;
    }
    scale = Math.min(12, Math.max(3, 40 / Math.max(4, n.radius)));
    pan.x = (W() / 2) - n.x * scale;
    pan.y = (H() / 2) - n.y * scale;
    updateZoomDisplay();
  }

  // Layouts
  function applyLayout(name) {
    const vis = getFilteredNodes();
    if (name === 'radial') {
      const cx = W() / 2, cy = H() / 2, radius = Math.min(W(), H()) / 3;
      vis.forEach((n, i) => {
        const angle = (i / vis.length) * Math.PI * 2;
        n.x = cx + Math.cos(angle) * radius;
        n.y = cy + Math.sin(angle) * radius;
        n.vx = 0; n.vy = 0;
      });
      physicsPaused = true;
      if (pauseBtn) { pauseBtn.textContent = '▶'; pauseBtn.title = 'Resume Physics'; pauseBtn.classList.add('active'); }
    } else if (name === 'grid') {
      const cols = Math.ceil(Math.sqrt(vis.length));
      const cell = Math.min(W(), H()) / (cols + 1);
      vis.forEach((n, i) => {
        n.x = ((i % cols) + 1) * cell;
        n.y = (Math.floor(i / cols) + 1) * cell;
        n.vx = 0; n.vy = 0;
      });
      physicsPaused = true;
      if (pauseBtn) { pauseBtn.textContent = '▶'; pauseBtn.title = 'Resume Physics'; pauseBtn.classList.add('active'); }
    } else if (name === 'tree') {
      const tree = {};
      vis.forEach(n => { tree[n.id] = { n, children: [], depth: 0 }; });
      const nodeEdgeMap = {};
      edges.forEach(e => { if (tree[e.source.id]) tree[e.source.id].children.push(e.target.id); });
      const roots = vis.filter(n => !edges.some(e => e.target === n)).map(n => n.id);
      if (roots.length === 0) vis.forEach(n => roots.push(n.id));
      function setDepth(id, d, visited) {
        if (visited.has(id)) return;
        visited.add(id);
        if (tree[id]) tree[id].depth = Math.max(tree[id].depth, d);
        tree[id].children.forEach(cid => setDepth(cid, d + 1, new Set(visited)));
      }
      roots.forEach(rid => setDepth(rid, 0, new Set()));
      const levels = [];
      vis.forEach(n => {
        const d = tree[n.id].depth;
        if (!levels[d]) levels[d] = [];
        levels[d].push(n);
      });
      const levelHeight = H() / (levels.length + 1);
      levels.forEach((levelNodes, level) => {
        const y = levelHeight * (level + 1);
        const gap = W() / (levelNodes.length + 1);
        levelNodes.forEach((n, i) => { n.x = gap * (i + 1); n.y = y; n.vx = 0; n.vy = 0; });
      });
      physicsPaused = true;
      if (pauseBtn) { pauseBtn.textContent = '▶'; pauseBtn.title = 'Resume Physics'; pauseBtn.classList.add('active'); }
    } else if (name === 'city') {
      const layerOrder = ['entry', 'ui', 'business', 'data', 'utils', 'tests', 'other'];
      const layerGroups = {};
      vis.forEach(n => {
        const layer = classifyLayer(n.id);
        (layerGroups[layer] = layerGroups[layer] || []).push(n);
      });
      const usableHeight = H() * 0.85;
      const layerHeight = usableHeight / layerOrder.length;
      const topOffset = H() * 0.08;
      layerOrder.forEach((layer, li) => {
        const nodes = layerGroups[layer] || [];
        const y = topOffset + layerHeight * li + layerHeight / 2;
        const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
        const cell = Math.min((W() - 80) / cols, 140);
        nodes.forEach((n, i) => {
          n.x = 40 + (i % cols) * cell;
          n.y = y;
          n.vx = 0; n.vy = 0;
        });
      });
      physicsPaused = true;
      if (pauseBtn) { pauseBtn.textContent = '▶'; pauseBtn.title = 'Resume Physics'; pauseBtn.classList.add('active'); }
    } else if (name === 'force') {
      physicsPaused = false;
      temperature = 1.0;
      if (pauseBtn) { pauseBtn.textContent = '⏸'; pauseBtn.title = 'Pause Physics'; pauseBtn.classList.remove('active'); }
    }
  }

  // Control buttons
  document.getElementById('zoomInBtn')?.addEventListener('click', () => zoomAtCenter(1.25));
  document.getElementById('zoomOutBtn')?.addEventListener('click', () => zoomAtCenter(1/1.25));
  document.getElementById('resetViewBtn')?.addEventListener('click', () => { scale = 1; pan = {x:0,y:0}; updateZoomDisplay(); });
  document.getElementById('fitScreenBtn')?.addEventListener('click', () => {
    if (is3D) { scale = 1.0; cameraOffset = {x:0,y:0,z:700}; pan = {x:0,y:0}; updateZoomDisplay(); return; }
    const vis = getFilteredNodes(); if (!vis.length) return;
    const minX = Math.min(...vis.map(n=>n.x-n.radius)), maxX = Math.max(...vis.map(n=>n.x+n.radius));
    const minY = Math.min(...vis.map(n=>n.y-n.radius)), maxY = Math.max(...vis.map(n=>n.y+n.radius));
    const pad = 40; const bw = maxX - minX + pad*2, bh = maxY - minY + pad*2;
    scale = Math.min(W()/bw, H()/bh, 20); pan = {x: (W() - bw*scale)/2 - minX*scale + pad*scale, y: (H() - bh*scale)/2 - minY*scale + pad*scale};
    updateZoomDisplay();
  });
  const pauseBtn = document.getElementById('pausePhysicsBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', () => { physicsPaused = !physicsPaused; pauseBtn.textContent = physicsPaused ? '▶' : '⏸'; pauseBtn.title = physicsPaused ? 'Resume Physics' : 'Pause Physics'; pauseBtn.classList.toggle('active', physicsPaused); });
  const toggle3DBtn = document.getElementById('toggle3DBtn');
  if (toggle3DBtn) toggle3DBtn.addEventListener('click', () => {
    is3D = !is3D;
    toggle3DBtn.classList.toggle('active', is3D);
    const layerZ = { entry: -2500, ui: -1200, business: 0, data: 1200, utils: -800, tests: 2500, other: 800 };
    function zHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return (h & 0x7fffffff) / 0x7fffffff; }
    if (is3D) {
      for (const n of allNodes) {
        const baseZ = layerZ[classifyLayer(n.label)] || 0;
        n.z = baseZ + (zHash(n.id) - 0.5) * 8000;
      }
      scale = 1.0; cameraOffset = {x:0,y:0,z:700}; rotX = 0.6; rotY = 0.4; pan = {x:0,y:0};
    } else {
      for (const n of allNodes) n.z = 0;
      scale = 1.0; cameraOffset = {x:0,y:0,z:0}; rotX = 0.6; rotY = 0; pan = {x:0,y:0};
    }
    updateZoomDisplay();
  });
  const toggleLabelsBtn = document.getElementById('toggleLabelsBtn');
  if (toggleLabelsBtn) toggleLabelsBtn.addEventListener('click', () => {
    labelsVisible = !labelsVisible;
    toggleLabelsBtn.classList.toggle('active', !labelsVisible);
    toggleLabelsBtn.title = labelsVisible ? 'Hide Labels' : 'Show Labels';
  });
  const toggleFocusBtn = document.getElementById('toggleFocusBtn');
  if (toggleFocusBtn) toggleFocusBtn.addEventListener('click', () => {
    focusMode = !focusMode;
    toggleFocusBtn.classList.toggle('active', focusMode);
    toggleFocusBtn.title = focusMode ? 'Exit Focus Mode' : 'Focus Mode';
  });
  const toggleGridBtn = document.getElementById('toggleGridBtn');
  if (toggleGridBtn) toggleGridBtn.addEventListener('click', () => {
    gridVisible = !gridVisible;
    toggleGridBtn.classList.toggle('active', !gridVisible);
    toggleGridBtn.title = gridVisible ? 'Hide Grid' : 'Show Grid';
  });
  const toggleStarsBtn = document.getElementById('toggleStarsBtn');
  if (toggleStarsBtn) {
    toggleStarsBtn.classList.toggle('active', starsVisible);
    toggleStarsBtn.addEventListener('click', () => {
      starsVisible = !starsVisible;
      toggleStarsBtn.classList.toggle('active', starsVisible);
      toggleStarsBtn.title = starsVisible ? 'Hide Stars' : 'Show Stars';
    });
  }
  // Mouse lock / pointer lock
  function toggleMouseLock() {
    if (manualMouseLook) {
      manualMouseLook = false;
      if (toggleMouseLockBtn) {
        toggleMouseLockBtn.classList.remove('active');
        toggleMouseLockBtn.title = 'Lock Mouse (M)';
      }
      canvas.style.cursor = '';
      return;
    }
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    } else {
      canvas.requestPointerLock();
    }
  }
  const toggleMouseLockBtn = document.getElementById('toggleMouseLockBtn');
  if (toggleMouseLockBtn) toggleMouseLockBtn.addEventListener('click', toggleMouseLock);
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (toggleMouseLockBtn) {
      toggleMouseLockBtn.classList.toggle('active', locked);
      toggleMouseLockBtn.title = locked ? 'Unlock Mouse (Esc)' : 'Lock Mouse (M)';
    }
  });
  document.addEventListener('pointerlockerror', () => {
    if (toggleMouseLockBtn) toggleMouseLockBtn.classList.remove('active');
    // Fallback for file:// URLs where Pointer Lock is blocked
    if (is3D) {
      manualMouseLook = true;
      lastMouseX = window.innerWidth / 2;
      lastMouseY = window.innerHeight / 2;
      if (toggleMouseLockBtn) {
        toggleMouseLockBtn.classList.add('active');
        toggleMouseLockBtn.title = 'Unlock Mouse (Esc or M)';
      }
      canvas.style.cursor = 'none';
    }
  });
  document.getElementById('exportGraphBtn')?.addEventListener('click', () => {
    let analysis = {};
    try { analysis = JSON.parse(document.getElementById('analysisData')?.textContent || '{}'); } catch (e) {}
    const allIssues = [...(analysis.issues || []), ...(analysis.improvements || [])];
    const top3 = (analysis.recommendations || []).slice().sort((a, b) => a.priority - b.priority).slice(0, 3);
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        project: document.querySelector('.subtitle')?.textContent || 'project',
        version: '3.0.315'
      },
      graph: { nodes: allNodes.map(n => ({ id: n.id, label: n.label, group: n.group, x: n.x, y: n.y, radius: n.radius })), edges: allEdges.map(e => ({ source: e.source, target: e.target })) },
      cycles: CYCLES, entryPoints: ENTRIES, leafModules: LEAVES, mostConnected: CONNECTED,
      analysis: {
        summary: analysis.summary || {},
        issues: analysis.issues || [],
        improvements: analysis.improvements || [],
        recommendations: analysis.recommendations || [],
        allIssues: allIssues,
        top3Actionable: top3
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const proj = (document.querySelector('.subtitle')?.textContent || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.download = proj + '-codemap-analysis-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Theme + layout selectors
  const themeSelect = document.getElementById('themeSelect');
  function applyTheme(val) {
    document.body.classList.remove('theme-light', 'theme-ocean', 'theme-black');
    if (val !== 'dark') document.body.classList.add('theme-' + val);
    try { localStorage.setItem('codemapTheme', val); } catch (e) {}
    if (themeSelect) themeSelect.value = val;
  }
  themeSelect?.addEventListener('change', e => { applyTheme(e.target.value); });
  // Restore saved theme on load
  (function() {
    try {
      const saved = localStorage.getItem('codemapTheme');
      if (saved && ['dark','light','ocean','black'].includes(saved)) applyTheme(saved);
    } catch (e) {}
  })();
  document.getElementById('layoutSelect')?.addEventListener('change', e => applyLayout(e.target.value));

  // Key bindings system
  const CONTROL_DEFS = [
    { id: 'moveForward', label: 'Move Forward / Zoom In (2D)', default: 'w' },
    { id: 'moveBackward', label: 'Move Backward / Zoom Out (2D)', default: 's' },
    { id: 'strafeLeft', label: 'Strafe Left / Pan Left (2D)', default: 'a' },
    { id: 'strafeRight', label: 'Strafe Right / Pan Right (2D)', default: 'd' },
    { id: 'rotateLeft', label: 'Rotate Left', default: 'q' },
    { id: 'rotateRight', label: 'Rotate Right', default: 'e' },
    { id: 'moveUp', label: 'Move Up', default: 'z' },
    { id: 'moveDown', label: 'Move Down', default: 'x' },
    { id: 'zoomIn', label: 'Zoom In (+)', default: '+' },
    { id: 'zoomOut', label: 'Zoom Out (-)', default: '-' },
    { id: 'resetView', label: 'Reset View', default: '0' },
    { id: 'fitScreen', label: 'Fit to Screen', default: 'f' },
    { id: 'toggle3D', label: 'Toggle 3D Mode', default: 'o' },
    { id: 'pausePhysics', label: 'Pause/Resume Physics', default: ' ' },
    { id: 'searchFocus', label: 'Focus Search', default: '/' },
    { id: 'saveNode', label: 'Save/Bookmark Node', default: 'b' },
    { id: 'toggleMouseLock', label: 'Toggle Mouse Lock', default: 'm' },
    { id: 'interact', label: 'Interact / Select Crosshair Node', default: ' ' },
  ];
  let keyBindings = {};
  function loadBindings() {
    try { const saved = localStorage.getItem('codemapKeyBindings'); if (saved) keyBindings = JSON.parse(saved); } catch (e) {}
    for (const def of CONTROL_DEFS) { if (!keyBindings[def.id]) keyBindings[def.id] = def.default; }
  }
  loadBindings();
  function getBoundKey(action) { return (keyBindings[action] || '').toLowerCase(); }

  // Controls modal — elements are defined AFTER this script in HTML, query lazily
  function getControlsModal() { return document.getElementById('controlsModal'); }
  let capturingFor = null;
  function buildControlsGrid() {
    const controlsGrid = document.getElementById('controlsGrid');
    if (!controlsGrid) return;
    controlsGrid.textContent = '';
    for (const def of CONTROL_DEFS) {
      const label = document.createElement('label');
      label.textContent = def.label;
      const box = document.createElement('div');
      box.className = 'key-box';
      const val = keyBindings[def.id] || def.default;
      box.textContent = val === ' ' ? 'Space' : val.toUpperCase();
      box.dataset.action = def.id;
      box.addEventListener('click', () => { capturingFor = { action: def.id, box }; box.classList.add('active'); box.textContent = 'Press key...'; });
      controlsGrid.appendChild(label);
      controlsGrid.appendChild(box);
    }
  }
  function stopCapture() {
    if (capturingFor) {
      capturingFor.box.classList.remove('active');
      const def = CONTROL_DEFS.find(d => d.id === capturingFor.action);
      const val = keyBindings[capturingFor.action] || def.default;
      capturingFor.box.textContent = val === ' ' ? 'Space' : val.toUpperCase();
      capturingFor = null;
    }
  }
  document.getElementById('controlsBtn')?.addEventListener('click', () => { buildControlsGrid(); const cm = getControlsModal(); if (cm) cm.classList.remove('hidden'); });
  // Modal buttons are rendered AFTER the script tag; use event delegation
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'closeControlsModal') { const cm = getControlsModal(); if (cm) cm.classList.add('hidden'); stopCapture(); }
    else if (t.id === 'resetControlsBtn') { keyBindings = {}; for (const def of CONTROL_DEFS) keyBindings[def.id] = def.default; buildControlsGrid(); }
    else if (t.id === 'saveControlsBtn') { try { localStorage.setItem('codemapKeyBindings', JSON.stringify(keyBindings)); } catch (e) {} const cm = getControlsModal(); if (cm) cm.classList.add('hidden'); stopCapture(); }
    else { const cm = getControlsModal(); if (cm && t === cm) { cm.classList.add('hidden'); stopCapture(); } }
  });
  document.addEventListener('keydown', e => {
    if (capturingFor) {
      e.preventDefault(); e.stopPropagation();
      const key = e.key.toLowerCase();
      if (key === 'control' || key === 'alt' || key === 'shift' || key === 'meta') return;
      const parts = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.metaKey) parts.push('meta');
      if (e.shiftKey && (e.ctrlKey || e.altKey || e.metaKey || key.length !== 1)) parts.push('shift');
      parts.push(key);
      const binding = parts.join('+');
      keyBindings[capturingFor.action] = binding;
      const controlsGrid = document.getElementById('controlsGrid');
      if (controlsGrid) {
        controlsGrid.querySelectorAll('.key-box').forEach(b => b.classList.remove('conflict'));
        for (const [action, boundKey] of Object.entries(keyBindings)) {
          if (action !== capturingFor.action && boundKey === binding) {
            const conflictBox = controlsGrid.querySelector('[data-action="' + action + '"]');
            if (conflictBox) conflictBox.classList.add('conflict');
          }
        }
      }
      stopCapture();
      return;
    }
  });

  // Keyboard controls
  function checkBinding(e, action) {
    const bound = getBoundKey(action);
    if (!bound) return false;
    if (bound.includes('+')) {
      const parts = bound.split('+');
      const key = parts.pop();
      if (e.key.toLowerCase() !== key) return false;
      if (parts.includes('ctrl') && !e.ctrlKey) return false;
      if (parts.includes('alt') && !e.altKey) return false;
      if (parts.includes('shift') && !e.shiftKey) return false;
      if (parts.includes('meta') && !e.metaKey) return false;
      return true;
    }
    return e.key.toLowerCase() === bound;
  }
  document.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keysPressed.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'capslock') { autoRun = !autoRun; e.preventDefault(); }
    const slow = e.altKey ? 0.25 : 1;
    const zoomFactor = 1 + (0.25 * slow);
    if (checkBinding(e, 'zoomIn')) { e.preventDefault(); zoomAtCenter(zoomFactor); }
    else if (checkBinding(e, 'zoomOut')) { e.preventDefault(); zoomAtCenter(1/zoomFactor); }
    else if (checkBinding(e, 'resetView')) { e.preventDefault(); scale = 1; pan = {x:0,y:0}; updateZoomDisplay(); }
    else if (checkBinding(e, 'fitScreen')) { e.preventDefault();
      if (is3D) { scale = 1.0; cameraOffset.z = 700; pan = {x:0,y:0}; updateZoomDisplay(); }
      else {
        const vis = getFilteredNodes(); if (!vis.length) return;
        const minX = Math.min(...vis.map(n=>n.x-n.radius)), maxX = Math.max(...vis.map(n=>n.x+n.radius));
        const minY = Math.min(...vis.map(n=>n.y-n.radius)), maxY = Math.max(...vis.map(n=>n.y+n.radius));
        const pad = 40; const bw = maxX - minX + pad*2, bh = maxY - minY + pad*2;
        scale = Math.min(W()/bw, H()/bh, 20); pan = {x: (W() - bw*scale)/2 - minX*scale + pad*scale, y: (H() - bh*scale)/2 - minY*scale + pad*scale};
        updateZoomDisplay();
      }
    }
    else if (e.key.toLowerCase() === 'r') { e.preventDefault(); scale = 1; pan = {x:0,y:0}; rotX = 0.6; rotY = 0; cameraOffset = {x:0,y:0,z:700}; updateZoomDisplay(); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); rotY = 0; if (is3D) { rotX = 0.6; cameraOffset.z = 700; } }
    else if (e.key.toLowerCase() === 'u') { e.preventDefault(); if (is3D) { scale = 1.0; cameraOffset.z = 700; rotX = 0.6; } else { scale = 1; pan = {x:0,y:0}; updateZoomDisplay(); } }
    else if (['moveForward','moveBackward','strafeRight','strafeLeft','moveUp','moveDown','rotateLeft','rotateRight'].some(id => checkBinding(e, id))) { e.preventDefault(); }
    else if (checkBinding(e, 'toggle3D')) { e.preventDefault(); document.getElementById('toggle3DBtn')?.click(); }
    else if (checkBinding(e, 'pausePhysics')) { e.preventDefault(); physicsPaused = !physicsPaused; const pb = document.getElementById('pausePhysicsBtn'); if (pb) { pb.textContent = physicsPaused ? '▶' : '⏸'; pb.title = physicsPaused ? 'Resume Physics' : 'Pause Physics'; pb.classList.toggle('active', physicsPaused); } }
    else if (checkBinding(e, 'searchFocus')) { e.preventDefault(); document.getElementById('graphSearch')?.focus(); }
    else if (checkBinding(e, 'saveNode')) { e.preventDefault(); saveCurrentNode(); }
    else if (checkBinding(e, 'toggleMouseLock')) { e.preventDefault(); toggleMouseLock(); }
    else if (e.key === 'Escape' && manualMouseLook) { e.preventDefault(); toggleMouseLock(); }
    else if (checkBinding(e, 'interact')) {
      e.preventDefault();
      if (document.pointerLockElement === canvas || manualMouseLook) {
        const center = { x: W() / 2, y: H() / 2 };
        const chNode = is3D ? nodeAt3D(center) : nodeAt(worldPosFromClient(center));
        if (chNode) { selectedNode = chNode; showNodeDetails(chNode); }
      }
    }
  });
  document.addEventListener('keyup', e => { keysPressed.delete(e.key.toLowerCase()); });

  // Saved / bookmarked nodes
  let savedNodes = new Set();
  function loadSavedNodes() {
    try { const saved = localStorage.getItem('codemapSavedNodes'); if (saved) savedNodes = new Set(JSON.parse(saved)); } catch (e) {}
  }
  loadSavedNodes();
  allNodes.forEach(n => { n.saved = savedNodes.has(n.id); });
  function saveCurrentNode() {
    const target = selectedNode || hoverNode;
    if (!target) return;
    if (savedNodes.has(target.id)) {
      savedNodes.delete(target.id);
      target.saved = false;
    } else {
      savedNodes.add(target.id);
      target.saved = true;
    }
    try { localStorage.setItem('codemapSavedNodes', JSON.stringify([...savedNodes])); } catch (e) {}
  }

  let temperature = 1.0;
  function step() {
    if (physicsPaused) return;
    const visNodes = getFilteredNodes();
    const visEdges = getFilteredEdges();
    // Adaptive temperature: cools down as graph settles, reheats on layout change
    const targetDist = Math.min(80, Math.max(30, Math.sqrt(visNodes.length) * 4));
    const repulsionStrength = 12 * temperature;
    const springStrength = 0.15 * temperature;
    const centerStrength = 0.006 * temperature;
    for (let i = 0; i < visNodes.length; i++) {
      for (let j = i+1; j < visNodes.length; j++) {
        const a = visNodes[i], b = visNodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dz = (b.z || 0) - (a.z || 0);
        let dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
        if (!is3D && dist > targetDist * 4) continue; // cutoff prevents islands from drifting apart in 2D
        const minDist = a.radius + b.radius + 8;
        dist = Math.max(dist, minDist);
        const force = repulsionStrength * targetDist * targetDist / (dist * dist);
        dx /= dist; dy /= dist; dz /= dist;
        a.vx -= dx * force; a.vy -= dy * force; a.vz = (a.vz || 0) - dz * force;
        b.vx += dx * force; b.vy += dy * force; b.vz = (b.vz || 0) + dz * force;
      }
    }
    for (const e of visEdges) {
      let dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
      let dz = (e.target.z || 0) - (e.source.z || 0);
      let dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
      const force = (dist - targetDist) * springStrength;
      dx /= dist; dy /= dist; dz /= dist;
      e.source.vx += dx * force; e.source.vy += dy * force; e.source.vz = (e.source.vz || 0) + dz * force;
      e.target.vx -= dx * force; e.target.vy -= dy * force; e.target.vz = (e.target.vz || 0) - dz * force;
    }
    // In 3D, pull nodes toward their architectural z-layer plane
    const layerZ = { entry: -2500, ui: -1200, business: 0, data: 1200, utils: -800, tests: 2500, other: 800 };
    for (const n of visNodes) {
      if (is3D) {
        const targetZ = layerZ[classifyLayer(n.label)] || 0;
        n.vz = (n.vz || 0) + (targetZ - (n.z || 0)) * 0.001;
        n.vz *= 0.88;
        n.z = (n.z || 0) + (n.vz || 0);
        // Center gravity weaker in 3D so layers spread horizontally
        n.vx += (W()/2 - n.x) * 0.00003;
        n.vy += (H()/2 - n.y) * 0.00003;
      } else {
        n.vx += (W()/2 - n.x) * centerStrength;
        n.vy += (H()/2 - n.y) * centerStrength;
      }
      n.vx *= 0.92; n.vy *= 0.92;
      n.x += n.vx; n.y += n.vy;
    }
    // Cool down over time so graph settles
    if (temperature > 0.15) temperature *= 0.9995;
  }

  function draw() {
    ctx.clearRect(0, 0, W(), H());
    const visEdges = getFilteredEdges();
    const visNodes = getFilteredNodes();
    const connectedIds = focusMode && selectedNode ? getConnectedNodeIds(selectedNode) : null;
    let crosshairNode = null;
    if (document.pointerLockElement === canvas || manualMouseLook) {
      const center = { x: W() / 2, y: H() / 2 };
      if (is3D) crosshairNode = nodeAt3D(center);
      else crosshairNode = nodeAt(worldPosFromClient(center));
    }
    if (is3D) {
      // 3D scene background for depth perception (theme-aware)
      if (document.body.classList.contains('theme-black')) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W(), H());
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H());
        if (document.body.classList.contains('theme-light')) {
          bgGrad.addColorStop(0, '#e2e8f0'); bgGrad.addColorStop(0.5, '#f1f5f9'); bgGrad.addColorStop(1, '#f8fafc');
        } else if (document.body.classList.contains('theme-ocean')) {
          bgGrad.addColorStop(0, '#0a1a2f'); bgGrad.addColorStop(0.5, '#112240'); bgGrad.addColorStop(1, '#1e3a5f');
        } else {
          bgGrad.addColorStop(0, '#0a0f1e'); bgGrad.addColorStop(0.5, '#0b1120'); bgGrad.addColorStop(1, '#0d1528');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W(), H());
      }
      // Draw stars on top of 3D background
      if (starsVisible) {
        const t = Date.now() * 0.001;
        for (const s of stars) {
          const sx = s.x * W(), sy = s.y * H();
          const tw = 0.5 + 0.5 * Math.sin(t + s.twinkle);
          ctx.beginPath(); ctx.arc(sx, sy, s.size, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(200,220,255,' + (s.alpha * tw) + ')'; ctx.fill();
        }
      }
      // Draw floor grid for spatial reference
      if (gridVisible) {
        const gridSize = 4000, gridStep = 400;
        ctx.strokeStyle = 'rgba(100,116,139,0.12)';
        ctx.lineWidth = 1;
        for (let x = -gridSize; x <= gridSize; x += gridStep) {
          const p1 = project3D({x: x, y: 0, z: -gridSize, radius: 0});
          const p2 = project3D({x: x, y: 0, z: gridSize, radius: 0});
          if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
        }
        for (let z = -gridSize; z <= gridSize; z += gridStep) {
          const p1 = project3D({x: -gridSize, y: 0, z: z, radius: 0});
          const p2 = project3D({x: gridSize, y: 0, z: z, radius: 0});
          if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
        }
      }
      // Project all nodes and edges with depth info
      const projected = visNodes.map(n => ({ n, p: project3D(n) })).filter(item => item.p !== null).sort((a, b) => b.p.z2 - a.p.z2);
      const projMap = new Map();
      projected.forEach(item => { if (item.p) projMap.set(item.n.id, item.p); });
      // Draw edges back-to-front with depth fog
      const edgeProjections = [];
      for (const e of visEdges) {
        const p1 = projMap.get(e.source.id), p2 = projMap.get(e.target.id);
        if (!p1 || !p2) continue;
        const avgZ = (p1.z2 + p2.z2) / 2;
        edgeProjections.push({ p1, p2, avgZ, edge: e });
      }
      edgeProjections.sort((a, b) => b.avgZ - a.avgZ);
      for (const { p1, p2, avgZ, edge } of edgeProjections) {
        const fog = Math.max(0.04, Math.min(0.9, 500 / (500 + avgZ * 0.5)));
        const isDimmed = focusMode && connectedIds && !connectedIds.has(edge.source.id) && !connectedIds.has(edge.target.id);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = isDimmed ? 'rgba(148,163,184,0.03)' : 'rgba(148,163,184,' + (fog * 0.22) + ')';
        ctx.lineWidth = Math.max(0.4, fog * 1.5); ctx.stroke();
      }
      // Draw nodes back-to-front with depth cues
      for (const { n, p } of projected) {
        if (!p) continue;
        const isDimmed = focusMode && connectedIds && !connectedIds.has(n.id);
        const r = Math.max(4, n.radius * p.depthScale);
        const depthAlpha = Math.max(0.55, Math.min(1, p.depthScale));
        const shadowOff = Math.max(1, 4 * p.depthScale);
        ctx.beginPath(); ctx.arc(p.x + shadowOff, p.y + shadowOff, r, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * depthAlpha * (isDimmed ? 0.2 : 1)) + ')'; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, r + Math.max(2, 5 * p.depthScale), 0, Math.PI*2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.85 * depthAlpha * (isDimmed ? 0.15 : 1); ctx.fill(); ctx.globalAlpha = 1;
        const sev = nodeSeverity[n.id];
        if (sev && !isDimmed) {
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 2, 0, Math.PI*2);
          ctx.strokeStyle = (severityColor[sev] || '#64748b'); ctx.lineWidth = 2; ctx.globalAlpha = depthAlpha; ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
        ctx.fillStyle = n.color; ctx.globalAlpha = depthAlpha * (isDimmed ? 0.2 : 1); ctx.fill(); ctx.globalAlpha = 1;
        if (n === hoverNode || n === selectedNode) {
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 2, 0, Math.PI*2);
          ctx.strokeStyle = n === selectedNode ? '#06b6d4' : '#fff';
          ctx.lineWidth = n === selectedNode ? 2 : 1.5; ctx.globalAlpha = depthAlpha; ctx.stroke(); ctx.globalAlpha = 1;
        }
        if (n.highlighted && !isDimmed) {
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(6,182,212,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        if ((n.saved || savedNodes.has(n.id)) && !isDimmed) {
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI*2);
          ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        if (n === crosshairNode) {
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(6,182,212,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
        }
      }
      // Labels: only show for selected / hovered / crosshair nodes
      for (const { n, p } of projected) {
        if (n !== hoverNode && n !== selectedNode && n !== crosshairNode) continue;
        const projectedR = Math.max(1, n.radius * p.depthScale);
        const isDimmed = focusMode && connectedIds && !connectedIds.has(n.id);
        const fontSize = Math.max(9, Math.min(12, 9 + projectedR * 0.4));
        ctx.fillStyle = isDimmed ? 'rgba(226,232,240,0.2)' : '#e2e8f0';
        ctx.font = (n === selectedNode ? 'bold ' : '') + fontSize + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label.split('/').pop() || n.label, p.x, p.y + projectedR + 12);
      }
      if (document.pointerLockElement === canvas || manualMouseLook) {
        const chx = W() / 2, chy = H() / 2;
        ctx.strokeStyle = 'rgba(6,182,212,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chx - 12, chy); ctx.lineTo(chx + 12, chy);
        ctx.moveTo(chx, chy - 12); ctx.lineTo(chx, chy + 12);
        ctx.stroke();
      }
    } else {
      // Draw stars behind 2D graph (screen space, not affected by pan/zoom)
      if (starsVisible) {
        const t = Date.now() * 0.001;
        for (const s of stars) {
          const sx = s.x * W(), sy = s.y * H();
          const tw = 0.5 + 0.5 * Math.sin(t + s.twinkle);
          ctx.beginPath(); ctx.arc(sx, sy, s.size, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(200,220,255,' + (s.alpha * tw) + ')'; ctx.fill();
        }
      }
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(scale, scale);
      for (const e of visEdges) {
        const isDimmed = focusMode && connectedIds && !connectedIds.has(e.source.id) && !connectedIds.has(e.target.id);
        ctx.beginPath(); ctx.moveTo(e.source.x, e.source.y); ctx.lineTo(e.target.x, e.target.y);
        ctx.strokeStyle = isDimmed ? 'rgba(148,163,184,0.03)' : 'rgba(148,163,184,0.15)';
        ctx.lineWidth = 1; ctx.stroke();
      }
      for (const n of visNodes) {
        const isDimmed = focusMode && connectedIds && !connectedIds.has(n.id);
        const sev = nodeSeverity[n.id];
        if (sev && !isDimmed) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 3, 0, Math.PI*2);
          ctx.strokeStyle = severityColor[sev] || '#64748b'; ctx.lineWidth = 2.5; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.radius, 0, Math.PI*2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = isDimmed ? 0.2 : 1;
        ctx.fill(); ctx.globalAlpha = 1;
        if (n === hoverNode || n === selectedNode) {
          ctx.strokeStyle = n === selectedNode ? '#06b6d4' : '#fff';
          ctx.lineWidth = n === selectedNode ? 3 : 2; ctx.stroke();
        }
        if (n.highlighted && !isDimmed) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 4, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(6,182,212,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        }
        if ((n.saved || savedNodes.has(n.id)) && !isDimmed) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI*2);
          ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
        }
        if (n === crosshairNode) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 8, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(6,182,212,0.9)'; ctx.lineWidth = 3; ctx.stroke();
        }
      }
      // Labels: only show for selected / hovered / crosshair nodes
      for (const n of visNodes) {
        if (n !== hoverNode && n !== selectedNode && n !== crosshairNode) continue;
        const isDimmed = focusMode && connectedIds && !connectedIds.has(n.id);
        const fontSize = Math.max(9, Math.min(12, 9 + n.radius * 0.3));
        ctx.fillStyle = isDimmed ? 'rgba(226,232,240,0.3)' : '#e2e8f0';
        ctx.font = (n === selectedNode ? 'bold ' : '') + fontSize + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label.split('/').pop() || n.label, n.x, n.y + n.radius + 12);
      }
      ctx.restore();
      if (document.pointerLockElement === canvas || manualMouseLook) {
        const chx = W() / 2, chy = H() / 2;
        ctx.strokeStyle = 'rgba(6,182,212,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chx - 12, chy); ctx.lineTo(chx + 12, chy);
        ctx.moveTo(chx, chy - 12); ctx.lineTo(chx, chy + 12);
        ctx.stroke();
      }
    }
  }
  function loop() {
    const moveSpeed = is3D ? 80 : 12;
    if (is3D) {
      const fwd = getBoundKey('moveForward'), bwd = getBoundKey('moveBackward');
      const rightKey = getBoundKey('strafeRight'), leftKey = getBoundKey('strafeLeft');
      const upKey = getBoundKey('moveUp'), downKey = getBoundKey('moveDown');
      const rotLeftKey = getBoundKey('rotateLeft'), rotRightKey = getBoundKey('rotateRight');
      const forward = (keysPressed.has(fwd) ? 1 : 0) - (keysPressed.has(bwd) ? 1 : 0);
      const right = (keysPressed.has(rightKey) ? 1 : 0) - (keysPressed.has(leftKey) ? 1 : 0);
      const up = (keysPressed.has(upKey) ? 1 : 0) - (keysPressed.has(downKey) ? 1 : 0);
      const rotation = (keysPressed.has(rotRightKey) ? 1 : 0) - (keysPressed.has(rotLeftKey) ? 1 : 0);
      const runMult = keysPressed.has('shift') ? 3 : (autoRun ? 2 : 1);
      const speed = moveSpeed * 2 * runMult;
      const sinY = Math.sin(rotY), cosY = Math.cos(rotY);
      const sinX = Math.sin(rotX), cosX = Math.cos(rotX);
      if (forward) {
        cameraOffset.x += forward * sinY * cosX * speed;
        cameraOffset.y += forward * sinX * speed;
        cameraOffset.z -= forward * cosY * cosX * speed;
      }
      if (right) {
        cameraOffset.x += right * cosY * speed;
        cameraOffset.z += right * sinY * speed;
      }
      if (up) {
        cameraOffset.y -= up * speed;
      }
      if (rotation) {
        // Orbit camera left/right around scene center (Q/E)
        const dist = Math.sqrt(cameraOffset.x*cameraOffset.x + cameraOffset.z*cameraOffset.z) || 1;
        const azim = Math.atan2(cameraOffset.x, cameraOffset.z);
        const newAzim = azim + rotation * speed * 0.0005;
        cameraOffset.x = dist * Math.sin(newAzim);
        cameraOffset.z = dist * Math.cos(newAzim);
        rotY = newAzim + Math.PI;
      }
    } else {
      const fwd = getBoundKey('moveForward'), bwd = getBoundKey('moveBackward');
      const leftKey = getBoundKey('strafeLeft'), rightKey = getBoundKey('strafeRight');
      if (keysPressed.has(fwd)) zoomAtCenter(1.02);
      if (keysPressed.has(bwd)) zoomAtCenter(1/1.02);
      if (keysPressed.has(leftKey)) pan.x += moveSpeed * 2;
      if (keysPressed.has(rightKey)) pan.x -= moveSpeed * 2;
    }
    if (is3D) clampCameraDistance();
    scale = Math.max(0.05, Math.min(20, scale));
    for (let i = 0; i < 3; i++) step();
    draw();
    requestAnimationFrame(loop);
  }
  // VS Code webview message bridge
  if (typeof acquireVsCodeApi !== 'undefined') {
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg && msg.command === 'highlightNode') {
        const target = allNodes.find(n => n.id === msg.path);
        if (target) {
          selectedNode = target;
          pan.x = W() / 2 - target.x * scale;
          pan.y = H() / 2 - target.y * scale;
        }
      }
    });
  }
  // Auto-fit on first load so the graph is visible
  setTimeout(() => {
    const vis = getFilteredNodes();
    if (vis.length > 0) {
      const minX = Math.min(...vis.map(n=>n.x-n.radius)), maxX = Math.max(...vis.map(n=>n.x+n.radius));
      const minY = Math.min(...vis.map(n=>n.y-n.radius)), maxY = Math.max(...vis.map(n=>n.y+n.radius));
      const pad = 40; const bw = maxX - minX + pad*2, bh = maxY - minY + pad*2;
      scale = Math.min(W()/bw, H()/bh, 20);
      pan = {x: (W() - bw*scale)/2 - minX*scale + pad*scale, y: (H() - bh*scale)/2 - minY*scale + pad*scale};
      updateZoomDisplay();
    }
  }, 100);

  loop();
})();
