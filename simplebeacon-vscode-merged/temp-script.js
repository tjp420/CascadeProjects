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
  const allNodes = GRAPH.nodes.map((n,i) => ({id:n.id,label:n.label,group:n.group,x:W()/2+Math.cos(i*2.4)*150,y:H()/2+Math.sin(i*2.4)*150,vx:0,vy:0,radius:Math.max(4,Math.min(14,Math.sqrt(n.size||1)*0.6)),color:colors[n.group]||'#64748b',visible:true,highlighted:false}));
  const allEdges = GRAPH.edges.map(e => ({source:e.source,target:e.target,visible:true}));
  const nodeMap = Object.fromEntries(allNodes.map(n=>[n.id,n]));
  const edges = allEdges.map(e => ({source:nodeMap[e.source],target:nodeMap[e.target]})).filter(e=>e.source&&e.target);

  let dragging = null, panning = false, panStart = {x:0,y:0}, hoverNode = null, selectedNode = null, dragMoved = false;
  let offset = {x:0,y:0}, scale = 1, pan = {x:0,y:0}, physicsPaused = false, searchQuery = '';
  let is3D = false, rotX = 0.6, rotY = 0, isRotating = false, rotStart = {x:0, y:0};
  let labelsVisible = true;
  let zoomDragging = false, zoomStartY = 0, zoomStartScale = 1;
  let middlePanning = false, middlePanStart = {x:0,y:0,px:0,py:0};
  let isOrbiting = false, orbitStart = {x:0,y:0};

  function getFilteredNodes() { return allNodes.filter(n => n.visible); }
  function getFilteredEdges() { return edges.filter(e => e.source.visible && e.target.visible); }

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
    const focal = 800;
    const x0 = n.x - cx;
    const y0 = n.y - cy;
    const z0 = n.z;
    const x1 = x0 * Math.cos(rotY) - z0 * Math.sin(rotY);
    const z1 = x0 * Math.sin(rotY) + z0 * Math.cos(rotY);
    const y1 = y0 * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = y0 * Math.sin(rotX) + z1 * Math.cos(rotX);
    const depthScale = focal / (focal + z2);
    return { x: cx + x1 * scale * depthScale, y: cy + y1 * scale * depthScale, depthScale, z2 };
  }

  function nodeAt3D(cp) {
    const vis = getFilteredNodes();
    let best = null, bestDist = Infinity;
    for (const n of vis) {
      const p = project3D(n);
      const r = n.radius * p.depthScale;
      const dx = cp.x - p.x, dy = cp.y - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < r + 6 && dist < bestDist) { best = n; bestDist = dist; }
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
    if (e.button === 1) {
      e.preventDefault();
      middlePanning = true;
      const cp = clientPos(e);
      middlePanStart = { x: cp.x, y: cp.y, px: pan.x, py: pan.y };
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      if (is3D) { isRotating = true; rotStart = {x: e.clientX, y: e.clientY}; return; }
      zoomDragging = true;
      zoomStartY = e.clientY;
      zoomStartScale = scale;
      return;
    }
    if (is3D) { isRotating = true; rotStart = {x: e.clientX, y: e.clientY}; return; }
    if (e.ctrlKey || e.altKey) {
      isOrbiting = true;
      orbitStart = { x: e.clientX, y: e.clientY };
      return;
    }
    const cp = clientPos(e); panning = true; panStart = cp;
  });
  canvas.addEventListener('mousemove', e => {
    const cp = clientPos(e);
    if (isRotating) {
      const dx = e.clientX - rotStart.x; const dy = e.clientY - rotStart.y;
      rotY += dx * 0.01; rotX += dy * 0.01; rotStart = {x: e.clientX, y: e.clientY};
      canvas.style.cursor = 'move'; return;
    }
    if (zoomDragging) {
      const dy = zoomStartY - e.clientY;
      const factor = Math.exp(dy * 0.005);
      const newScale = Math.max(0.05, Math.min(100, zoomStartScale * factor));
      if (!is3D) {
        const rect = canvas.getBoundingClientRect();
        const center = { x: rect.width / 2, y: rect.height / 2 };
        const worldBefore = worldPosFromClient(center);
        scale = newScale;
        pan.x = center.x - worldBefore.x * scale;
        pan.y = center.y - worldBefore.y * scale;
      } else {
        scale = newScale;
      }
      updateZoomDisplay();
      canvas.style.cursor = 'ns-resize'; return;
    }
    if (middlePanning) {
      pan.x = middlePanStart.px + (cp.x - middlePanStart.x);
      pan.y = middlePanStart.py + (cp.y - middlePanStart.y);
      canvas.style.cursor = 'grabbing'; dragMoved = true; return;
    }
    if (isOrbiting) {
      const dx = e.clientX - orbitStart.x;
      const dy = e.clientY - orbitStart.y;
      const speed = e.altKey ? 0.002 : 0.005;
      pan.x += dx * speed * scale * 50;
      pan.y += dy * speed * scale * 50;
      orbitStart = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'all-scroll'; return;
    }
    if (is3D) { hoverNode = nodeAt3D(cp); canvas.style.cursor = hoverNode ? 'pointer' : 'move'; return; }
    const wp = worldPosFromClient(cp); hoverNode = nodeAt(wp);
    if (dragging) {
      dragging.x = wp.x - offset.x; dragging.y = wp.y - offset.y;
      canvas.style.cursor = 'grabbing'; dragMoved = true;
    } else if (panning) {
      pan.x += cp.x - panStart.x; pan.y += cp.y - panStart.y; panStart = cp;
      canvas.style.cursor = 'grabbing'; dragMoved = true;
    } else {
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    }
  });
  canvas.addEventListener('mouseup', () => { dragging = null; panning = false; isRotating = false; zoomDragging = false; middlePanning = false; isOrbiting = false; });
  canvas.addEventListener('mouseleave', () => { dragging = null; panning = false; isRotating = false; zoomDragging = false; middlePanning = false; isOrbiting = false; });
  canvas.addEventListener('click', e => {
    if (dragMoved) return;
    if (is3D) {
      const cp = clientPos(e); const n = nodeAt3D(cp);
      if (n) { selectedNode = n; showNodeDetails(n); }
      else { selectedNode = null; if (detailsPanel) detailsPanel.classList.add('hidden'); }
      return;
    }
    const wp = worldPos(e); const n = nodeAt(wp);
    if (n) { selectedNode = n; showNodeDetails(n); }
    else { selectedNode = null; if (detailsPanel) detailsPanel.classList.add('hidden'); }
  });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const cp = clientPos(e); const wp = worldPosFromClient(cp); const n = nodeAt(wp);
    const menu = document.getElementById('contextMenu'); if (!menu) return;
    menu.style.display = 'block';
    menu.style.left = (e.clientX + 10) + 'px';
    menu.style.top = (e.clientY + 10) + 'px';
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
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const cp = clientPos(e);
    const speedMult = e.shiftKey ? 3 : 1;
    const factor = Math.exp(-e.deltaY * 0.003 * speedMult);
    const newScale = Math.max(0.05, Math.min(100, scale * factor));
    if (!is3D) {
      const worldBefore = worldPosFromClient(cp);
      scale = newScale;
      pan.x = cp.x - worldBefore.x * scale;
      pan.y = cp.y - worldBefore.y * scale;
    } else {
      scale = newScale;
    }
    updateZoomDisplay();
  }, {passive:false});
  // Double-click to zoom into a node
  canvas.addEventListener('dblclick', e => {
    const wp = worldPos(e);
    const n = nodeAt(wp);
    if (n) { zoomToNode(n); selectedNode = n; showNodeDetails(n); }
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
    if (zoomDisplay) zoomDisplay.textContent = Math.round(scale * 100) + '%';
  }
  function zoomAtCenter(factor) {
    const rect = canvas.getBoundingClientRect();
    const cp = { x: rect.width / 2, y: rect.height / 2 };
    const worldBefore = worldPosFromClient(cp);
    const newScale = Math.max(0.05, Math.min(100, scale * factor));
    scale = newScale;
    pan.x = cp.x - worldBefore.x * scale;
    pan.y = cp.y - worldBefore.y * scale;
    updateZoomDisplay();
  }
  function zoomToNode(n) {
    if (!n) return;
    if (is3D) { scale = 1.5; pan = {x:0,y:0}; updateZoomDisplay(); return; }
    scale = Math.min(80, Math.max(5, 40));
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
      if (pauseBtn) { pauseBtn.textContent = '⏸'; pauseBtn.title = 'Pause Physics'; pauseBtn.classList.remove('active'); }
    }
  }

  // Control buttons
  document.getElementById('zoomInBtn')?.addEventListener('click', () => zoomAtCenter(1.25));
  document.getElementById('zoomOutBtn')?.addEventListener('click', () => zoomAtCenter(1/1.25));
  document.getElementById('resetViewBtn')?.addEventListener('click', () => { scale = 1; pan = {x:0,y:0}; updateZoomDisplay(); });
  document.getElementById('fitScreenBtn')?.addEventListener('click', () => {
    if (is3D) { scale = 1.2; pan = {x:0,y:0}; updateZoomDisplay(); return; }
    const vis = getFilteredNodes(); if (!vis.length) return;
    const minX = Math.min(...vis.map(n=>n.x-n.radius)), maxX = Math.max(...vis.map(n=>n.x+n.radius));
    const minY = Math.min(...vis.map(n=>n.y-n.radius)), maxY = Math.max(...vis.map(n=>n.y+n.radius));
    const pad = 40; const bw = maxX - minX + pad*2, bh = maxY - minY + pad*2;
    scale = Math.min(W()/bw, H()/bh, 100); pan = {x: (W() - bw*scale)/2 - minX*scale + pad*scale, y: (H() - bh*scale)/2 - minY*scale + pad*scale};
    updateZoomDisplay();
  });
  const pauseBtn = document.getElementById('pausePhysicsBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', () => { physicsPaused = !physicsPaused; pauseBtn.textContent = physicsPaused ? '▶' : '⏸'; pauseBtn.title = physicsPaused ? 'Resume Physics' : 'Pause Physics'; pauseBtn.classList.toggle('active', physicsPaused); });
  const toggle3DBtn = document.getElementById('toggle3DBtn');
  if (toggle3DBtn) toggle3DBtn.addEventListener('click', () => {
    is3D = !is3D;
    toggle3DBtn.classList.toggle('active', is3D);
    const layerZ = { entry: -300, ui: -150, business: 0, data: 150, utils: -100, tests: 200, other: 100 };
    if (is3D) {
      for (const n of allNodes) n.z = layerZ[classifyLayer(n.label)] || 0;
      scale = Math.max(0.5, Math.min(100, scale));
    } else {
      for (const n of allNodes) n.z = 0;
      rotX = 0.6; rotY = 0;
    }
    updateZoomDisplay();
  });
  const toggleLabelsBtn = document.getElementById('toggleLabelsBtn');
  if (toggleLabelsBtn) toggleLabelsBtn.addEventListener('click', () => {
    labelsVisible = !labelsVisible;
    toggleLabelsBtn.classList.toggle('active', !labelsVisible);
    toggleLabelsBtn.title = labelsVisible ? 'Hide Labels' : 'Show Labels';
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
  document.getElementById('themeSelect')?.addEventListener('change', e => {
    document.body.classList.remove('theme-light', 'theme-ocean');
    const val = e.target.value;
    if (val !== 'dark') document.body.classList.add('theme-' + val);
  });
  document.getElementById('layoutSelect')?.addEventListener('change', e => applyLayout(e.target.value));

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const slow = e.altKey ? 0.25 : 1;
    const panStep = 40 * slow;
    const zoomFactor = 1 + (0.25 * slow);
    switch (e.key) {
      case '+': case '=': e.preventDefault(); zoomAtCenter(zoomFactor); break;
      case '-': case '_': e.preventDefault(); zoomAtCenter(1/zoomFactor); break;
      case '0': e.preventDefault(); scale = 1; pan = {x:0,y:0}; updateZoomDisplay(); break;
      case 'f': case 'F': e.preventDefault();
        if (is3D) { scale = 1.2; pan = {x:0,y:0}; updateZoomDisplay(); break; }
        const vis = getFilteredNodes(); if (!vis.length) return;
        const minX = Math.min(...vis.map(n=>n.x-n.radius)), maxX = Math.max(...vis.map(n=>n.x+n.radius));
        const minY = Math.min(...vis.map(n=>n.y-n.radius)), maxY = Math.max(...vis.map(n=>n.y+n.radius));
        const pad = 40; const bw = maxX - minX + pad*2, bh = maxY - minY + pad*2;
        scale = Math.min(W()/bw, H()/bh, 100); pan = {x: (W() - bw*scale)/2 - minX*scale + pad*scale, y: (H() - bh*scale)/2 - minY*scale + pad*scale};
        updateZoomDisplay(); break;
      case 'ArrowUp': e.preventDefault(); pan.y += panStep; break;
      case 'ArrowDown': e.preventDefault(); pan.y -= panStep; break;
      case 'ArrowLeft': e.preventDefault(); pan.x += panStep; break;
      case 'ArrowRight': e.preventDefault(); pan.x -= panStep; break;
      case 'w': case 'W': e.preventDefault(); pan.y += panStep; break;
      case 's': case 'S': e.preventDefault(); pan.y -= panStep; break;
      case 'a': case 'A': e.preventDefault(); pan.x += panStep; break;
      case 'd': case 'D': e.preventDefault(); pan.x -= panStep; break;
      case 'PageUp': e.preventDefault(); zoomAtCenter(zoomFactor); break;
      case 'PageDown': e.preventDefault(); zoomAtCenter(1/zoomFactor); break;
      case 'r': case 'R': e.preventDefault(); scale = 1; pan = {x:0,y:0}; rotX = 0.6; rotY = 0; updateZoomDisplay(); break;
      case 'n': case 'N': e.preventDefault(); rotY = 0; if (is3D) rotX = 0.6; break;
      case 'u': case 'U': e.preventDefault(); if (is3D) { rotX = 0.6; } else { scale = 1; pan = {x:0,y:0}; updateZoomDisplay(); } break;
      case 'o': case 'O': e.preventDefault(); document.getElementById('toggle3DBtn')?.click(); break;
      case ' ': e.preventDefault(); physicsPaused = !physicsPaused; const pb = document.getElementById('pausePhysicsBtn'); if (pb) { pb.textContent = physicsPaused ? '▶' : '⏸'; pb.title = physicsPaused ? 'Resume Physics' : 'Pause Physics'; pb.classList.toggle('active', physicsPaused); } break;
      case '/': e.preventDefault(); document.getElementById('graphSearch')?.focus(); break;
    }
  });

  function step() {
    if (physicsPaused) return;
    const visNodes = getFilteredNodes();
    const visEdges = getFilteredEdges();
    for (let i = 0; i < visNodes.length; i++) {
      for (let j = i+1; j < visNodes.length; j++) {
        const a = visNodes[i], b = visNodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const force = 8000 / (dist * dist);
        dx /= dist; dy /= dist;
        a.vx -= dx * force; a.vy -= dy * force;
        b.vx += dx * force; b.vy += dy * force;
      }
    }
    for (const e of visEdges) {
      let dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
      let dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const force = dist * 0.003;
      dx /= dist; dy /= dist;
      e.source.vx += dx * force; e.source.vy += dy * force;
      e.target.vx -= dx * force; e.target.vy -= dy * force;
    }
    for (const n of visNodes) {
      n.vx += (W()/2 - n.x) * 0.0003;
      n.vy += (H()/2 - n.y) * 0.0003;
      n.vx *= 0.92; n.vy *= 0.92;
      n.x += n.vx; n.y += n.vy;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W(), H());
    const visEdges = getFilteredEdges();
    const visNodes = getFilteredNodes();
    if (is3D) {
      const projected = visNodes.map(n => ({ n, p: project3D(n) })).sort((a, b) => b.p.z2 - a.p.z2);
      for (const e of visEdges) {
        const p1 = project3D(e.source), p2 = project3D(e.target);
        const avgZ = (p1.z2 + p2.z2) / 2;
        const edgeScale = Math.max(0.2, Math.min(1.5, 800 / (800 + avgZ)));
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = 'rgba(148,163,184,' + (0.05 + 0.12 * edgeScale) + ')'; ctx.lineWidth = Math.max(0.3, 0.5 * edgeScale); ctx.stroke();
      }
      for (const { n, p } of projected) {
        const r = Math.max(1, n.radius * p.depthScale);
        const sev = nodeSeverity[n.id];
        if (sev) {
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, Math.PI*2);
          ctx.strokeStyle = (severityColor[sev] || '#64748b'); ctx.lineWidth = 2.5; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
        ctx.fillStyle = n.color; ctx.globalAlpha = Math.max(0.4, Math.min(1, p.depthScale)); ctx.fill(); ctx.globalAlpha = 1;
        if (n === hoverNode || n === selectedNode) {
          ctx.strokeStyle = n === selectedNode ? '#06b6d4' : '#fff';
          ctx.lineWidth = n === selectedNode ? 3 : 2; ctx.stroke();
        }
        if (n.highlighted) {
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(6,182,212,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      if (labelsVisible) {
        for (const { n, p } of projected) {
          if (n.radius > 7 || n === hoverNode || n === selectedNode) {
            ctx.fillStyle = '#e2e8f0'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(n.label, p.x, p.y + Math.max(1, n.radius * p.depthScale) + 12);
          }
        }
      }
    } else {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(scale, scale);
      for (const e of visEdges) {
        ctx.beginPath(); ctx.moveTo(e.source.x, e.source.y); ctx.lineTo(e.target.x, e.target.y);
        ctx.strokeStyle = 'rgba(148,163,184,0.15)'; ctx.lineWidth = 1; ctx.stroke();
      }
      for (const n of visNodes) {
        const sev = nodeSeverity[n.id];
        if (sev) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 3, 0, Math.PI*2);
          ctx.strokeStyle = severityColor[sev] || '#64748b'; ctx.lineWidth = 2.5; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.radius, 0, Math.PI*2);
        ctx.fillStyle = n.color; ctx.fill();
        if (n === hoverNode || n === selectedNode) {
          ctx.strokeStyle = n === selectedNode ? '#06b6d4' : '#fff';
          ctx.lineWidth = n === selectedNode ? 3 : 2; ctx.stroke();
        }
        if (n.highlighted) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 4, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(6,182,212,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      if (labelsVisible) {
        for (const n of visNodes) {
          if (n.radius > 7 || n === hoverNode || n === selectedNode) {
            ctx.fillStyle = '#e2e8f0'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(n.label, n.x, n.y + n.radius + 12);
          }
        }
      }
      ctx.restore();
    }
  }
  function loop() { for (let i = 0; i < 3; i++) step(); draw(); requestAnimationFrame(loop); }
  loop();
})();