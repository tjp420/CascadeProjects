    let currentReport=null,currentRoadmap=null;
    const dropzone=document.getElementById('dropzone'),fileInput=document.getElementById('fileInput'),app=document.getElementById('app'),emptyState=document.getElementById('emptyState');
    const scorecardsEl=document.getElementById('scorecards'),timelineEl=document.getElementById('timeline'),projectNameEl=document.getElementById('projectName'),scanDateEl=document.getElementById('scanDate'),jsonPreviewEl=document.getElementById('jsonPreview'),toastEl=document.getElementById('toast');

    dropzone.addEventListener('click',()=>fileInput.click());
    dropzone.addEventListener('dragover',e=>{e.preventDefault();dropzone.classList.add('dragover');});
    dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop',e=>{e.preventDefault();dropzone.classList.remove('dragover');const f=e.dataTransfer.files[0];if(f)loadFile(f);});
    fileInput.addEventListener('change',e=>{if(e.target.files[0])loadFile(e.target.files[0]);});

    // Address bar handlers
    const browseReportBtn=document.getElementById('browseReportBtn');
    const reportUrlInput=document.getElementById('reportUrlInput');
    const analyzeReportBtn=document.getElementById('analyzeReportBtn');
    if(browseReportBtn&&fileInput){
      browseReportBtn.addEventListener('click',()=>fileInput.click());
    }
    if(analyzeReportBtn&&reportUrlInput){
      analyzeReportBtn.addEventListener('click',async()=>{
        const url=reportUrlInput.value.trim();
        if(!url){showToast('Enter a URL or file path first','error');return;}
        try{
          let json;
          if(url.startsWith('http://')||url.startsWith('https://')){
            const res=await fetch(url);
            if(!res.ok){showToast('Failed to fetch: '+res.status,'error');return;}
            json=await res.json();
          }else{
            const res=await fetch('/api/file/read?path='+encodeURIComponent(url));
            const data=await res.json();
            if(!data.success){showToast('Failed to read file: '+(data.error||res.status),'error');return;}
            json=JSON.parse(data.content);
          }
          if(json&&json.type==='simplebeacon-report'){loadReport(json);}
          else{showToast('Invalid SimpleBeacon report format','error');}
        }catch(err){showToast('Error loading report: '+err.message,'error');}
      });
      reportUrlInput.addEventListener('keydown',e=>{if(e.key==='Enter')analyzeReportBtn.click();});
    }

    // Paste JSON handler
    const jsonPasteInput=document.getElementById('jsonPasteInput'),jsonPasteBtn=document.getElementById('jsonPasteBtn');
    if(jsonPasteInput){
      jsonPasteInput.addEventListener('keydown',e=>{
        if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){
          e.preventDefault();
          if(jsonPasteBtn)jsonPasteBtn.click();
        }
      });
    }
    if(jsonPasteBtn&&jsonPasteInput){
      jsonPasteBtn.addEventListener('click',()=>{
        const text=jsonPasteInput.value.trim();
        if(!text){showToast('Paste JSON content first','error');return;}
        try{const j=JSON.parse(text);loadReport(j);}catch(err){showToast('Invalid JSON: '+err.message,'error');}
      });
    }

    // Load test report button
    const loadTestReportBtn=document.getElementById('loadTestReportBtn');
    if(loadTestReportBtn){
      loadTestReportBtn.addEventListener('click',async()=>{
        try{
          const res=await fetch('test-report.json');
          if(!res.ok){showToast('Failed to load test-report.json: '+res.status,'error');return;}
          const j=await res.json();
          loadReport(j);
        }catch(err){showToast('Error loading test report: '+err.message,'error');}
      });
    }


    function showToast(msg,type='info'){toastEl.textContent=msg;toastEl.className='toast show toast-'+type;setTimeout(()=>toastEl.classList.remove('show'),3000);}
    async function loadFile(file){
      const name=file.name.toLowerCase();
      if(name.endsWith('.zip')){
        if(typeof JSZip==='undefined'){showToast('ZIP library not loaded. Refresh the page.','error');return;}
        try{
          const zip=await JSZip.loadAsync(file);
          let reportJson=null;
          zip.forEach((path,entry)=>{
            if(!reportJson&&path.endsWith('.json')&&!entry.dir){
              reportJson=entry.async('text');
            }
          });
          if(!reportJson){showToast('No JSON file found inside ZIP.','error');return;}
          const text=await reportJson;
          try{const j=JSON.parse(text);loadReport(j);}catch(err){showToast('Invalid JSON inside ZIP: '+err.message,'error');}
        }catch(err){showToast('ZIP read error: '+(err&&err.message?err.message:String(err)),'error');}
        return;
      }
      const r=new FileReader();
      r.onload=e=>{try{const j=JSON.parse(e.target.result);loadReport(j);}catch(err){showToast('Invalid JSON: '+err.message,'error');}};
      r.readAsText(file);
    }
    function loadReport(report){
      // Extract project name from various report structures (flat scan, all-reports wrapper, etc.)
      const src = report.sourceReport || report.results?.simplebeacon || report;
      // Stale-report guard: check top-level, sourceReport, and results.simplebeacon for metrics
      const qs=report.qualityScore!=null?report.qualityScore:src.qualityScore;
      const sc=report.schemaCompliance!=null?report.schemaCompliance:src.schemaCompliance;
      const cs=report.consistencyScore!=null?report.consistencyScore:src.consistencyScore;
      if(qs==null&&sc==null&&cs==null){
        showToast('Stale report detected — quality metrics missing. Re-run scan with updated scanner.','warning');
        if(location.hash.length>1){history.replaceState(null,'',location.pathname+location.search);}
        return;
      }
      const extractedName = src.projectRoot || src.projectPath || src.projectName || src.scanTargetRoot || report.metadata?.project || report.metadata?.projectName || 'Unknown';
      if(!report.projectName) report.projectName = extractedName;
      if(!report.projectRoot) report.projectRoot = extractedName;
      currentReport=report;
      currentRoadmap=generateRoadmap(report);
      renderDashboard(report,currentRoadmap);
      emptyState.style.display='none';
      app.style.display='block';
      showToast('Roadmap generated','success');
    }

    function getTaskKey(project,phaseId,taskIdx){return 'sbr_'+String(project).replace(/[^a-z0-9]/gi,'_')+'_'+phaseId+'_t'+taskIdx;}
    function loadTaskState(project,phaseId,taskIdx){try{return localStorage.getItem(getTaskKey(project,phaseId,taskIdx))==='1';}catch(e){return false;}}
    function saveTaskState(project,phaseId,taskIdx,done){try{localStorage.setItem(getTaskKey(project,phaseId,taskIdx),done?'1':'0');}catch(e){}}
    function getTimeKey(project,phaseId,taskIdx){return getTaskKey(project,phaseId,taskIdx)+'_time';}
    function loadTaskTime(project,phaseId,taskIdx){try{const v=localStorage.getItem(getTimeKey(project,phaseId,taskIdx));return v?parseInt(v,10):0;}catch(e){return 0;}}
    function saveTaskTime(project,phaseId,taskIdx,seconds){try{localStorage.setItem(getTimeKey(project,phaseId,taskIdx),String(seconds));}catch(e){}}
    function formatTime(sec){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return(h>0?h+'h ':'')+(m>0?m+'m ':'')+s+'s';}
    function escapeHtml(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
    function buildStructuredTaskHtml(task){
      const parts=[];
      if(task.type){
        const typeColors={
          review:{bg:'rgba(96,165,250,0.15)',color:'var(--info)'},
          audit:{bg:'rgba(245,158,11,0.15)',color:'var(--warn)'},
          fix:{bg:'rgba(16,185,129,0.15)',color:'var(--success)'},
          verify:{bg:'rgba(139,92,246,0.15)',color:'#A78BFA'},
          doc:{bg:'rgba(6,182,212,0.15)',color:'#22D3EE'}
        };
        const style=typeColors[task.type]||{bg:'rgba(100,116,139,0.15)',color:'var(--text-dim)'};
        parts.push(`<span class="task-type-badge" style="background:${style.bg};color:${style.color};">${escapeHtml(task.type)}</span>`);
      }
      parts.push(`<span class="task-desc">${escapeHtml(task.description||'')}</span>`);
      if(task.location){
        const shortLoc=String(task.location).split(/[\\/]/).slice(-2).join('/');
        parts.push(`<span class="task-loc-chip" title="${escapeHtml(task.location)}">📄 ${escapeHtml(shortLoc)}</span>`);
      }
      if(task.codeSnippet){
        const lines=task.codeSnippet.split('\n').length;
        const expandBtn=lines>3?'<span class="task-code-expand" title="Toggle expand">+more</span>':'';
        parts.push(`<div class="task-code-block"><code>${escapeHtml(task.codeSnippet)}</code>${expandBtn}<span class="task-code-copy" title="Copy command">📋</span></div>`);
      }
      if(task.patch){
        parts.push(`<div style="margin-top:4px;font-size:0.7rem;color:var(--text-dim);">🛠 Patch available</div>`);
      }
      return `<div class="task-structured">${parts.join('')}</div>`;
    }
    function buildPhaseTaskTypeBar(tasks){
      if(!Array.isArray(tasks)||tasks.length===0)return'';
      const counts={};
      tasks.forEach(t=>{
        if(typeof t==='object'&&t!=null&&t.type){
          counts[t.type]=(counts[t.type]||0)+1;
        }
      });
      const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
      if(entries.length===0)return'';
      const chips=entries.map(([type,count])=>`<span class="task-type-count ${escapeHtml(type)}">${escapeHtml(type)} ${count}</span>`);
      return `<div class="phase-task-types">${chips.join('')}</div>`;
    }

    /**
     * Build roadmap phases from aiContext.suggestedFixes for AI-agent-friendly output.
     * Groups fixes by type into phases, preserving currentCode, replacement, patch, context.
     */
    function buildPhasesFromAiContext(aiCtx, report) {
      const fixes = (aiCtx.suggestedFixes || []).filter(f => {
        const fp = f.file || '';
        return !/(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|frontend-build|simplebeacon-vscode-merged|ai-platform)\//i.test(fp) && !/(^|\/)vscode-extension\/out\//i.test(fp) && !/\.map$/i.test(fp);
      });
      if (!fixes.length) return [];
      const typeToPhaseId = {
        'Credential Pattern': 'security',
        'Sensitive Data Exposure': 'security',
        'Database Anti-Pattern': 'security',
        'Missing Security Header': 'security',
        'Configuration Drift': 'security',
        'Debug Artifact': 'cleanup',
        'AI Residue': 'cleanup',
        'Performance Anti-Pattern': 'performance',
        'Type Safety Gap': 'type-safety',
        'Documentation Gap': 'documentation',
        'Missing Test Coverage': 'test-coverage',
        'i18n Issue': 'i18n',
        'Framework Practice Issue': 'performance',
        'Workspace Health Issue': 'consistency',
        'Unused Dependency': 'cleanup',
        'API Contract Drift': 'consistency',
        'High Complexity': 'performance',
        'License/Governance Marker': 'compliance',
        'AI System Indicator': 'euaiact'
      };
      const typeToTitle = {
        'Credential Pattern': 'Security Hardening',
        'Sensitive Data Exposure': 'Security Hardening',
        'Database Anti-Pattern': 'Security Hardening',
        'Missing Security Header': 'Security Hardening',
        'Configuration Drift': 'Security Hardening',
        'Debug Artifact': 'Cleanup & Hygiene',
        'AI Residue': 'Cleanup & Hygiene',
        'Performance Anti-Pattern': 'Performance Optimization',
        'Type Safety Gap': 'Type Safety',
        'Documentation Gap': 'Documentation',
        'Missing Test Coverage': 'Test Coverage',
        'i18n Issue': 'Internationalization',
        'Framework Practice Issue': 'Performance Optimization',
        'Workspace Health Issue': 'Consistency & Deduplication',
        'Unused Dependency': 'Cleanup & Hygiene',
        'API Contract Drift': 'Consistency & Deduplication',
        'High Complexity': 'Performance Optimization',
        'License/Governance Marker': 'Governance & Compliance',
        'AI System Indicator': 'EU AI Act Compliance'
      };
      const groups = {};
      fixes.forEach(f => {
        const phaseId = typeToPhaseId[f.type] || 'optimization';
        if (!groups[phaseId]) {
          groups[phaseId] = {
            id: phaseId,
            title: typeToTitle[f.type] || 'Quality Optimization',
            severity: f.severity || 'low',
            effort: '1–3 days',
            description: '',
            tasks: [],
            progress: 0,
            status: 'pending',
            extraHtml: '',
            autoFixableCount: 0,
            verificationCommand: f.verificationCommand || ''
          };
        }
        const g = groups[phaseId];
        // Build rich task with code context
        const taskHtml = buildAiTaskHtml(f);
        g.tasks.push(taskHtml);
        if (f.autoFixable) g.autoFixableCount++;
        // Update severity to highest found
        const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if ((sevOrder[f.severity] || 99) < (sevOrder[g.severity] || 99)) g.severity = f.severity;
      });
      // Add completion criteria from aiContext
      const criteriaMap = (aiCtx.completionCriteria || []).reduce((m, c) => { m[c.phase] = c.criteria; return m; }, {});
      Object.values(groups).forEach(g => {
        const criteria = criteriaMap[g.id];
        if (criteria && criteria.length) {
          g.extraHtml += `<div class="phase-fix"><strong>Completion Criteria:</strong> ${escapeHtml(criteria.join('; '))}</div>`;
        }
        if (g.autoFixableCount > 0) {
          g.description = `${g.tasks.length} finding(s) — ${g.autoFixableCount} auto-fixable.`;
        } else {
          g.description = `${g.tasks.length} finding(s) requiring manual review.`;
        }
        // Compute progress from existing report data if available
        const moduleKey = g.id.replace(/-/g, '');
        const modData = report[moduleKey];
        if (modData && typeof modData === 'object') {
          const hits = modData[Object.keys(modData).find(k => /Hits$/.test(k))] || 0;
          g.progress = hits === 0 ? 100 : Math.max(5, Math.round(100 - hits * 5));
        }
        if (g.progress >= 95) g.status = 'completed';
        else if (g.progress > 0) g.status = 'in-progress';
      });
      const phases = Object.values(groups);
      // Re-apply dependency blocking
      const depMap = (aiCtx.moduleDependencies || []).reduce((m, d) => { m[d.id] = d.dependsOn; return m; }, {});
      phases.forEach(p => {
        p.dependsOn = depMap[p.id] || null;
        if (p.dependsOn) {
          const dep = phases.find(x => x.id === p.dependsOn);
          if (dep && dep.progress < 95) { p.status = 'blocked'; p.progress = Math.min(p.progress, dep.progress); }
        }
      });
      // Sort by severity then status
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const statusOrder = { blocked: 0, pending: 1, 'in-progress': 2, completed: 3 };
      phases.sort((a, b) => (sevOrder[a.severity] || 99) - (sevOrder[b.severity] || 99) || (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0));
      return phases;
    }

    function buildPatchDiffHtml(patchText) {
      if (!patchText) return '';
      const lines = patchText.split('\n');
      const oldLines = [];
      const newLines = [];
      let oldIdx = 0, newIdx = 0;
      for (const line of lines) {
        if (line.startsWith('@@')) {
          oldLines.push({ cls: 'ctx', text: line, gutter: '@@' });
          newLines.push({ cls: 'ctx', text: line, gutter: '@@' });
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          newLines.push({ cls: 'add', text: line.slice(1), gutter: '+' });
          oldLines.push({ cls: 'ctx', text: '', gutter: ' ' });
          newIdx++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          oldLines.push({ cls: 'del', text: line.slice(1), gutter: '-' });
          newLines.push({ cls: 'ctx', text: '', gutter: ' ' });
          oldIdx++;
        } else {
          oldLines.push({ cls: 'ctx', text: line.startsWith(' ') ? line.slice(1) : line, gutter: ' ' });
          newLines.push({ cls: 'ctx', text: line.startsWith(' ') ? line.slice(1) : line, gutter: ' ' });
          oldIdx++; newIdx++;
        }
      }
      const renderCol = (title, rows) => {
        const rowHtml = rows.map(r => `<div class="patch-diff-line ${r.cls}"><span class="diff-gutter">${escapeHtml(r.gutter)}</span>${escapeHtml(r.text)}</div>`).join('');
        return `<div class="patch-diff-col"><div class="patch-diff-header">${title}</div>${rowHtml}</div>`;
      };
      return `<div class="patch-diff-wrap">${renderCol('Before', oldLines)}${renderCol('After', newLines)}</div>`;
    }

    function buildAiTaskHtml(fix) {
      const parts = [];
      parts.push(`<span class="task-meta">${escapeHtml(fix.type)}</span>`);
      if (fix.autoFixable) parts.push(`<span class="task-meta" style="background:rgba(16,185,129,0.15);color:var(--success);">AUTO</span>`);
      parts.push(`<code class="task-snippet">${escapeHtml((fix.snippet || fix.currentCode || '').slice(0, 100))}</code>`);
      parts.push(`<span class="task-loc">${escapeHtml(fix.file)}:${fix.line}</span>`);
      if (fix.replacement) {
        parts.push(`<div style="margin:4px 0;padding:4px 8px;background:rgba(16,185,129,0.05);border-radius:4px;font-family:'SF Mono',monospace;font-size:0.7rem;color:var(--success);">→ ${escapeHtml(fix.replacement.slice(0, 100))}</div>`);
      }
      if (fix.context && fix.context.length) {
        const ctx = fix.context.map(c => escapeHtml(c.slice(0, 120))).join('<br>');
        parts.push(`<div style="margin:4px 0;padding:6px 10px;background:#0a0e17;border:1px solid var(--border);border-radius:4px;font-family:'SF Mono',monospace;font-size:0.7rem;color:var(--text-dim);line-height:1.4;">${ctx}</div>`);
      }
      if (fix.patch || fix.suggestedPatch) {
        parts.push(`<div style="margin:4px 0;font-size:0.7rem;color:var(--info);font-weight:600;">🔍 Patch Preview</div>`);
        parts.push(buildPatchDiffHtml(fix.patch || fix.suggestedPatch));
      }
      if (fix.verificationCommand) {
        parts.push(`<div style="margin:4px 0;font-size:0.7rem;color:var(--info);">Verify: <code style="background:#0a0e17;padding:2px 6px;border-radius:3px;">${escapeHtml(fix.verificationCommand)}</code></div>`);
      }
      return { html: parts.join(''), aiData: fix };
    }

    function generateRoadmap(report){
      // Sanitize old reports: strip findings from build artifacts (minified JS, source maps)
      const isBuildArtifactPath = (p) => p && (/(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|frontend-build)\//i.test(p) || /(^|\/)vscode-extension\/out\//i.test(p) || /\.map$/i.test(p));
      if (report.aiContext && Array.isArray(report.aiContext.suggestedFixes)) {
        report.aiContext.suggestedFixes = report.aiContext.suggestedFixes.filter(f => !isBuildArtifactPath(f.file));
      }
      if (Array.isArray(report.detectedIssues)) {
        report.detectedIssues = report.detectedIssues.map(issue => {
          const files = Array.isArray(issue.filePath) ? issue.filePath : (issue.filePath ? [issue.filePath] : []);
          const cleanFiles = files.filter(f => !isBuildArtifactPath(f));
          return { ...issue, filePath: cleanFiles };
        }).filter(issue => Array.isArray(issue.filePath) && issue.filePath.length > 0);
      }
      // Prefer server-computed remediationPhases when available (most accurate)
      if (Array.isArray(report.remediationPhases) && report.remediationPhases.length > 0) {
        const phases = report.remediationPhases.map(p => {
          const tasks = p.tasks || [];
          // Auto-mark verify/review tasks as done for clean phases (no real fix tasks)
          const hasFix = tasks.some(t => typeof t === 'object' && t && t.type === 'fix');
          if (!hasFix) {
            tasks.forEach(t => {
              if (typeof t === 'object' && t && (t.type === 'verify' || t.type === 'review')) {
                t.done = true;
              }
            });
          }
          const doneCount = tasks.filter(t => typeof t === 'object' && t && t.done).length;
          const total = tasks.length;
          const taskPercent = total ? Math.round((doneCount / total) * 100) : 100;
          const taskStatus = taskPercent >= 95 ? 'completed' : (taskPercent > 0 ? 'in-progress' : 'pending');
          return {
            id: p.id,
            title: p.title,
            severity: p.severity || 'medium',
            effort: p.effort || 'TBD',
            description: p.description || '',
            tasks,
            progress: taskPercent,
            status: taskStatus,
            extraHtml: ''
          };
        });
        // Re-apply dependency blocking logic
        phases.forEach(p => {
          if (!p.dependsOn || p.progress >= 100) return;
          const dep = phases.find(x => x.id === p.dependsOn);
          if (dep && dep.progress < 95) { p.status = 'blocked'; p.progress = Math.min(p.progress, dep.progress); }
        });
        return { phases, generatedAt: new Date().toISOString(), sourceReport: report.generatedAt };
      }
      // If aiContext.suggestedFixes exists, generate phases from AI-actionable data
      const aiCtx = report.aiContext || {};
      const aiFixes = Array.isArray(aiCtx.suggestedFixes) ? aiCtx.suggestedFixes : [];
      if (aiFixes.length > 0) {
        const phases = buildPhasesFromAiContext(aiCtx, report);
        if (phases.length > 0) {
          return { phases, generatedAt: new Date().toISOString(), sourceReport: report.generatedAt };
        }
      }
      const phases=[];
      // Use null for missing fields so we can distinguish "not measured" from "zero"
      const src = report.sourceReport || report.results?.simplebeacon || report;
      const qs=src.qualityScore!=null?Number(src.qualityScore):null;
      const issues=src.issueCount!=null?Number(src.issueCount):null;
      const invalidJson=src.invalidJson!=null?Number(src.invalidJson):null;
      const emptyFiles=src.emptyFiles!=null?Number(src.emptyFiles):(src.dataQuality?.emptyJsonCount!=null?Number(src.dataQuality.emptyJsonCount):null);
      const schemaComp=src.schemaCompliance!=null?Number(src.schemaCompliance):null;
      const schemaChecked=src.schemaChecked!=null?Number(src.schemaChecked):null;
      const schemaPassed=src.schemaPassed!=null?Number(src.schemaPassed):null;
      const dupes=src.duplicateGroups!=null?Number(src.duplicateGroups):(src.consolidation?.duplicateGroups!=null?Number(src.consolidation.duplicateGroups):null);
      const consistency=src.consistencyScore!=null?Number(src.consistencyScore):(src.consolidation?.duplicateGroups!=null?(src.consolidation.duplicateGroups===0?100:50):null);
      const consistencyChecked=src.consistencyChecked!=null?Number(src.consistencyChecked):null;
      const consistencyPassed=src.consistencyPassed!=null?Number(src.consistencyPassed):null;
      const credFindings=src.credentialFindings!=null?Number(src.credentialFindings):(src.gate?.blockingCount!=null?Number(src.gate.blockingCount):null);
      const leakFindings=src.productionLeakFindings!=null?Number(src.productionLeakFindings):null;
      const euAiAct=src.euAiActFindings!=null?Number(src.euAiActFindings):(src.euAiActSummary?.aiSystemIndicators!=null?Number(src.euAiActSummary.aiSystemIndicators):null);
      const todoMarkers=src.todoMarkerCount!=null?Number(src.todoMarkerCount):(src.roadmap?.todoCount!=null?Number(src.roadmap.todoCount):null);
      const issueCount=src.issueCount!=null?Number(src.issueCount):0;
      // Auto-complete helper: gate passed, quality 100, no issues = structural duplicates only
      const scanIsClean=qs===100&&(src.gate?.pass===true||src.gate?.blockingCount===0)&&issueCount===0;

      // --- Detailed findings analysis (when unredacted data is available) ---
      function isRestricted(str){return typeof str==='string'&&str.includes('***REDACTED***');}
      function anyRestricted(arr){return Array.isArray(arr)&&arr.some(f=>isRestricted(f.snippet)||isRestricted(f.text)||isRestricted(f.message));}
      function collectFindings(pathArr, snippetKey='snippet'){
        const out=[];
        if(!Array.isArray(pathArr))return out;
        for(const item of pathArr){
          if(typeof item==='string')out.push({file:item});
          else if(item&&typeof item==='object'){
            const file=item.file||item.path||item.filename||'';
            const line=item.line||item.lineNumber||'';
            const text=item[snippetKey]||item.text||item.message||item.reason||'';
            if(file)out.push({file,line,text});
          }
        }
        return out;
      }
      const gateFindings=collectFindings(report.gate?.blockingFindings||[]);
      const credDetail=gateFindings.filter(f=>/credential|secret|token|password|api_key|auth/i.test(f.text||''));
      const leakDetail=gateFindings.filter(f=>/production|prod|staging|deploy|\.env/i.test(f.text||''));
      const hasRestrictedCred=anyRestricted(src.gate?.blockingFindings);
      const emptyFileDetail=collectFindings(src.dataQuality?.emptyJsonFiles);
      const invalidJsonDetail=collectFindings(src.dataQuality?.invalidJsonFiles);
      const dupeDetail=collectFindings(src.consolidation?.duplicateGroups);
      // roadmap.todoFiles is array of path strings, not object findings
      const todoDetail=(src.roadmap?.todoFiles||[]).map(p=>typeof p==='string'?{file:p}:p);
      const debugDetail=collectFindings(src.cleanup?.debugFindings);
      const junkDetail=collectFindings(src.junkFiles?.findings||src.junkFiles?.files);
      const buildDetail=collectFindings(src.buildReadiness?.findings||src.buildReadiness?.issues);
      const vulnDetail=collectFindings(src.dependencyAudit?.vulnerabilities||src.dependencyAudit?.findings);
      // Per-phase detail gate: gate detail only when not redacted; other phases use their own data presence
      const useGateDetail=gateFindings.length>0&&!hasRestrictedCred;

      // Phase 1: Security — always show
      {
        const t=[];
        const blockingFindings=src.gate?.blockingFindings||[];
        if(blockingFindings.length>0&&!hasRestrictedCred){
          blockingFindings.forEach(bf=>{
            (bf.findings||[]).forEach(m=>{
              t.push({type:'review',location:bf.filePath,codeSnippet:m.snippet||'',isStructured:true});
            });
          });
        }else if((credFindings||0)>0){t.push({description:`Rotate ${credFindings} exposed credential(s)`,type:'fix',isStructured:true});}
        if((leakFindings||0)>0){t.push({description:`Review ${leakFindings} production leak(s)`,type:'review',isStructured:true});}
        const totalIssues=(credFindings||0)+(leakFindings||0);
        const secClean=totalIssues===0;
        if(t.length===0)t.push({description:'No security issues detected — credentials && secrets verified.',type:'verify',done:secClean,isStructured:true});
        t.push(
          { description: 'Add .env to .gitignore', type: 'fix', codeSnippet: 'echo ".env" >> .gitignore', done: secClean, isStructured: true },
          { description: 'Re-run gate scan', type: 'verify', codeSnippet: 'npx simplebeacon scan --gate', done: secClean, isStructured: true }
        );
        const progress=totalIssues===0?100:Math.max(5,Math.round((1-totalIssues/(totalIssues+3))*100));
        const status=progress>=95?'completed':(progress>0?'in-progress':'pending');
        const credIssue=src.detectedIssues?.find(i=>i.type==='Credential Pattern');
        const impactHtml=credIssue?.impact?`<div class="phase-impact">Impact: ${escapeHtml(credIssue.impact)}</div>`:'';
        const fixHtml=credIssue?.fix?`<div class="phase-fix">Fix: ${escapeHtml(credIssue.fix)}</div>`:'';
        phases.push({id:'security',title:'Security Hardening',severity:totalIssues===0?'low':'critical',effort:'1–2 days',description:totalIssues===0?'No security issues detected — credentials && secrets verified.':`Address ${credFindings||0} credential and ${leakFindings||0} production leak finding(s).`,tasks:t,progress,status,extraHtml:impactHtml+fixHtml});
      }

      // Phase 2: Data Integrity — always show
      {
        const allClean=(invalidJson===0||invalidJson==null)&&(emptyFiles===0||emptyFiles==null)&&(schemaComp===100||schemaComp==null)&&invalidJsonDetail.length===0&&emptyFileDetail.length===0;
        const t=[];
        if(invalidJsonDetail.length>0){
          invalidJsonDetail.forEach(f=>{t.push({description:`Fix invalid JSON: ${f.file}`,type:'fix',location:f.file,isStructured:true});});
        }else if(invalidJson>0){t.push({description:`Fix ${invalidJson} invalid JSON file(s)`,type:'fix',isStructured:true});}
        if(emptyFileDetail.length>0){
          emptyFileDetail.forEach(f=>{t.push({description:`Remove empty file: ${f.file}`,type:'fix',location:f.file,isStructured:true});});
        }else if(emptyFiles>0){t.push({description:`Remove ${emptyFiles} empty file(s)`,type:'fix',isStructured:true});}
        if(schemaComp!=null&&schemaComp<100&&schemaChecked!=null){const failed=schemaChecked-(schemaPassed||0);if(failed>0)t.push({description:`Fix ${failed} schema violation(s)`,type:'fix',isStructured:true});}
        if(schemaComp!=null&&schemaComp<100&&schemaChecked==null)t.push({description:'Review schema compliance failures',type:'review',isStructured:true});
        t.push(
          { description: 'Validate all JSON', type: 'verify', codeSnippet: 'npx simplebeacon scan --json', done: allClean, isStructured: true },
          { description: 'Re-run scan', type: 'verify', codeSnippet: 'npx simplebeacon scan', done: allClean, isStructured: true }
        );
        const sameEmptyCount = invalidJson === emptyFiles && invalidJson != null;
        const dirtyDesc = sameEmptyCount
          ? `Resolve structural issues: ${invalidJson} empty/invalid JSON file(s).`
          : `Resolve structural issues${invalidJson>0?': '+invalidJson+' invalid JSON':''}${emptyFiles>0?': '+emptyFiles+' empty files':''}${schemaComp!=null&&schemaComp<100?': '+schemaComp+'% schema compliance':''}.`;
        phases.push({id:'integrity',title:'Data Integrity',severity:(invalidJson>0||emptyFiles>0||invalidJsonDetail.length>0||emptyFileDetail.length>0)?'high':'low',effort:'2–4 days',description:allClean?'Data integrity verified — no structural issues detected.':dirtyDesc,tasks:t,progress:allClean?100:(schemaComp!=null?Math.round(schemaComp):0),status:allClean?'completed':'pending'});
      }

      // Phase 3: Consistency — always show
      {
        // Auto-complete if scan is otherwise clean (gate passed, qualityScore 100)
        // Duplicates in full-file scans are typically structural (node_modules, .git, Domain mirrors)
        const dupFiles=src.consolidation?.duplicateFiles||[];
        const isMirrorOnly=dupFiles.length>0&&dupFiles.every(g=>Array.isArray(g)&&g.every(f=>/^(coming-soon\/|Domain\/|packages\/|[^\/]+$)/.test(f)));
        const allClean=(dupes===0||dupes==null)&&(consistency===100||consistency==null)&&dupeDetail.length===0;
        const autoComplete=allClean||isMirrorOnly||(dupes<=1&&consistency>=95);
        const t=[];
        if(dupeDetail.length>0){
          dupeDetail.forEach(f=>{t.push({description:`Consolidate duplicate: ${f.file}`,type:'fix',location:f.file,isStructured:true});});
        }else if(dupes>0&&!autoComplete){t.push({description:`Consolidate ${dupes} duplicate group(s)`,type:'fix',isStructured:true});}
        if(consistency!=null&&consistency<100&&consistencyChecked!=null){const failed=consistencyChecked-(consistencyPassed||0);if(failed>0)t.push({description:`Resolve ${failed} consistency failure(s)`,type:'fix',isStructured:true});}
        if(consistency!=null&&consistency<100&&consistencyChecked==null)t.push({description:'Review consistency check failures',type:'review',isStructured:true});
        if(!autoComplete) t.push(
          { description: 'Standardize naming conventions', type: 'doc', done: autoComplete, isStructured: true },
          { description: 'Document canonical file locations', type: 'doc', done: autoComplete, isStructured: true }
        );
        if(autoComplete) t.push({ description: 'Verified — duplicates are structural/intentional', type: 'verify', done: autoComplete, isStructured: true });
        phases.push({id:'consistency',title:'Consistency & Deduplication',severity:(dupes>5||dupeDetail.length>5)&&!autoComplete?'high':'low',effort:autoComplete?'None':'3–5 days',description:autoComplete?'Consistency verified — structural duplicates only.':`Eliminate redundancy${dupes>0?': '+dupes+' duplicate group(s)':''}${dupeDetail.length>0?': '+dupeDetail.length+' duplicate file(s)':''}${consistency!=null&&consistency<100?': '+consistency+'% consistency':''}.`,tasks:t,progress:autoComplete?100:Math.round((consistency||0)+(dupes===0?100:50))/2,status:autoComplete?'completed':'pending'});
      }

      // Phase 3.5: Cleanup & Hygiene — always show
      const debugCount=report.cleanup?.debugArtifactCount||0;
      const bloatCount=report.cleanup?.bloatArtifactCount||0;
      {
        const dc=debugDetail.length||debugCount;
        const t=[];
        const debugFindings=(report.cleanup?.debugFindings||[]);
        if(debugFindings.length>0){
          const groups={};
          function classifyArtifact(s){
            if(/\bprint\s*\(/.test(s))return'Python print';
            if(/\bpprint\s*\(/.test(s))return'Python pprint';
            if(/\bbreakpoint\s*\(/.test(s))return'Python breakpoint';
            if(/\bDEBUG\s*=\s*True\b/.test(s))return'Flask DEBUG';
            if(/\bSystem\.(out|err)\.(print|println)/.test(s))return'Java sysout';
            if(/\be\.printStackTrace/.test(s))return'Java stacktrace';
            if(/\bconsole\.(log|warn|error|info|debug|table|trace|dir|group)/.test(s))return'console.log';
            if(/\bdebugger\b/.test(s))return'debugger';
            if(/\balert\s*\(/.test(s))return'alert()';
            if(/\bprompt\s*\(/.test(s))return'prompt()';
            return'debug artifact';
          }
          debugFindings.forEach(f=>{
            (f.matches||[]).forEach(m=>{
              const type=classifyArtifact(m.snippet||'');
              if(!groups[type])groups[type]=[];
              groups[type].push({file:f.file,line:m.line||'',snippet:m.snippet||''});
            });
          });
          Object.entries(groups).forEach(([type,items])=>{
            items.forEach(item=>{
              t.push({type:'fix',location:item.file,codeSnippet:item.snippet||'',isStructured:true});
            });
          });
        }else if(dc>0){t.push({ description: `Remove ${dc} debug artifact${dc===1?'':'s'} (console.log, debugger, alert)`, type: 'fix', isStructured: true });}
        if(bloatCount>0){
          const bloatFiles=(src.cleanup?.bloatArtifacts||[]).map(b=>b.file);
          bloatFiles.forEach(f=>t.push({ description: `Delete self-generated bloat: ${f}`, type: 'fix', location: f, isStructured: true }));
          t.push(
            { description: 'Add bloat patterns to .simplebeaconignore', type: 'fix', codeSnippet: 'echo "*.simplebeacon-backup.*" >> .simplebeaconignore', isStructured: true },
            { description: 'Purge old scan backups with retention policy', type: 'fix', codeSnippet: 'find .simplebeacon -name "*.simplebeacon-backup.*" -mtime +30 -delete', isStructured: true }
          );
        }
        if(dc>0) t.push(
          { description: 'Install eslint-plugin-no-console for CI', type: 'fix', codeSnippet: 'npm install eslint-plugin-no-console --save-dev', isStructured: true },
          { description: 'Add pre-commit hook to reject console.log', type: 'fix', codeSnippet: 'npx husky add .husky/pre-commit "npx eslint --rule \'no-console: error\' src/"', isStructured: true }
        );
        if(t.length===0)t.push({description:'No debug artifacts or bloat detected — codebase is clean.',type:'verify',done:true,isStructured:true});
        const totalCleanupItems=dc+bloatCount;
        const pk=(src.projectRoot||src.projectPath||src.projectName||report.projectRoot||report.projectPath||report.projectName||'project').replace(/[^a-z0-9]/gi,'_');
        const cleanupDoneCount=t.reduce((n,task,idx)=>n+((loadTaskState(pk,'cleanup',idx)||(typeof task==='object'&&task.done))?1:0),0);
        const cleanupProgress=totalCleanupItems===0?100:(t.length?Math.round((cleanupDoneCount/t.length)*100):100);
        const cleanupStatus=totalCleanupItems===0?'completed':(cleanupProgress>=95?'completed':(cleanupProgress>0?'in-progress':'pending'));
        const debugIssue=src.detectedIssues?.find(i=>i.type==='Debug Artifact');
        const impactHtml=debugIssue?.impact?`<div class="phase-impact">Impact: ${escapeHtml(debugIssue.impact)}</div>`:'';
        const fixHtml=debugIssue?.fix?`<div class="phase-fix">Fix: ${escapeHtml(debugIssue.fix)}</div>`:'';
        phases.push({id:'cleanup',title:'Cleanup & Hygiene',severity:(debugCount>50||bloatCount>0)?'high':'low',effort:'1–2 days',description:totalCleanupItems===0?'No debug artifacts or bloat detected — codebase is clean.':`${dc} debug artifact${dc===1?'':'s'}${bloatCount>0?` + ${bloatCount} bloat file(s)`:''} detected.`,tasks:t,progress:cleanupProgress,status:cleanupStatus,extraHtml:impactHtml+fixHtml});
      }

      // Phase 4: Governance & Compliance — always show
      const comp=src.compliance||{};
      const licenseCount=comp.licenseCount!=null?Number(comp.licenseCount):0;
      const securityCount=comp.securityCount!=null?Number(comp.securityCount):0;
      const govScore=comp.governanceScore!=null?Number(comp.governanceScore):null;
      const standardGovFiles=['LICENSE','SECURITY.md','CODE_OF_CONDUCT.md','CONTRIBUTING.md','CHANGELOG.md','PRIVACY.md','NOTICE'];
      const foundGovCount=(licenseCount||0)+(securityCount||0);
      {
        const t=[];
        const govFindings=(comp.govFindings||[]);
        if(govFindings.length>0){
          govFindings.forEach(gf=>{
            (gf.matches||[]).forEach(m=>{
              t.push({type:'review',location:gf.file,codeSnippet:m.snippet||'',isStructured:true});
            });
          });
        }
        const euDocs=report.euAiActSummary?.documentationArtifacts||0;
        const govClean=govScore!=null&&govScore>=2;
        const scanIsClean=src.gate?.pass===true&&(src.issueCount||0)===0;
        const hasGovDocs=govClean||euDocs>=2||foundGovCount>0||scanIsClean;
        if(licenseCount>0) t.push({ description: `Audit ${licenseCount} open-source license file(s)`, type: 'review', done: true, isStructured: true });
        else t.push({ description: 'Add LICENSE file to clarify distribution terms', type: 'fix', codeSnippet: 'touch LICENSE', done: hasGovDocs, isStructured: true });
        if(securityCount>0) t.push({ description: `Review ${securityCount} security/governance file(s)`, type: 'review', done: true, isStructured: true });
        else t.push({ description: 'Add SECURITY.md to disclose vulnerability reporting', type: 'fix', codeSnippet: 'touch SECURITY.md', done: hasGovDocs, isStructured: true });
        const missingGov=(comp.missingGovernanceFiles||[]).slice(0,3);
        if(missingGov.length>0)missingGov.forEach(f=>t.push({ description: `Add ${f}`, type: 'fix', codeSnippet: `touch ${f}`, done: false, isStructured: true }));
        t.push(
          { description: 'Verify license compatibility with distribution model', type: 'verify', codeSnippet: 'npx license-checker --summary', done: hasGovDocs, isStructured: true },
          { description: 'Document governance policies', type: 'doc', done: hasGovDocs, isStructured: true }
        );
        if(t.length===0)t.push({description:'Governance files verified — all standard policies present.',type:'verify',done:true,isStructured:true});
        const baseProgress=hasGovDocs?100:(govScore!=null?Math.min(100,Math.round((govScore/standardGovFiles.length)*100)):Math.min(100,Math.round((foundGovCount/standardGovFiles.length)*100)));
        const progress=baseProgress||0;
        const status=progress>=95?'completed':(progress>0?'in-progress':(foundGovCount>0?'in-progress':'pending'));
        const govIssue=src.detectedIssues?.find(i=>i.type==='License/Governance Marker');
        const impactHtml=govIssue?.impact?`<div class="phase-impact">Impact: ${escapeHtml(govIssue.impact)}</div>`:'';
        const fixHtml=govIssue?.fix?`<div class="phase-fix">Fix: ${escapeHtml(govIssue.fix)}</div>`:'';
        phases.push({id:'compliance',title:'Governance & Compliance',severity:'low',effort:'2–3 days',description:`${licenseCount} license file(s), ${securityCount} security file(s).${govScore!=null?' Governance score: '+govScore+'.':''}`,tasks:t,progress,status,extraHtml:impactHtml+fixHtml});
      }

      // Phase 5: EU AI Act — always show
      {
        const s=src.euAiActSummary||{},hr=Number(s.highRiskIndicators)||0,tg=Number(s.transparencyGaps)||0,ai=Number(s.aiSystemIndicators)||0,art=Number(s.documentationArtifacts)||0;
        const clean=hr===0&&tg===0&&ai===0;
        const t=[];
        if(hr>0)t.push({description:`Address ${hr} high-risk indicator(s)`,type:'fix',done:false,isStructured:true});
        if(tg>0)t.push({description:`Close ${tg} transparency gap(s)`,type:'fix',done:false,isStructured:true});
        if(ai>0)t.push({description:`Review ${ai} AI system indicator(s) (Art. 6)`,type:'review',done:false,isStructured:true});
        t.push(
          { description: 'Generate documentation artifacts', type: 'doc', done: clean, isStructured: true },
          { description: 'Review AI system classification (Art. 6)', type: 'review', done: clean, isStructured: true },
          { description: 'Schedule legal review', type: 'review', done: clean, isStructured: true }
        );
        const artifactBonus=art>0?Math.min(30,art*6):0;
        const penalty=hr*15+tg*10+ai*5;
        const progress=clean?100:Math.max(10,Math.min(100,50+artifactBonus-penalty));
        const status=progress>=95?'completed':(progress>0?'in-progress':'pending');
        if(t.length===0)t.push({description:'No AI system indicators detected — EU AI Act compliance verified.',type:'verify',isStructured:true});
        phases.push({id:'euaiact',title:'EU AI Act Compliance',severity:hr>0?'critical':(ai>0?'high':'low'),effort:'5–10 days',description:clean?'No AI system indicators detected — EU AI Act compliance verified.':`Regulatory readiness: ${ai} AI indicators, ${hr} high-risk, ${tg} transparency gaps, ${art} artifacts.`,tasks:t,progress,status});
      }

      // Phase 5.5: Mock Data Review — always show
      const mockCats=src.mockDataCategories||[];
      const mockTotal=src.mockSampleFiles??mockCats.reduce((a,c)=>a+(c.fileCount||0),0);
      // Check if all mock files are legitimate demo data or known false positives
      const mockAffected=mockCats.flatMap(c=>c.affectedFiles||[]);
      const isLegitimateDemo=mockAffected.length>0&&mockAffected.every(f=>/web\/data\/.*-sample\.json$/.test(f)||/Domain\/.*\/sample-/.test(f)||/docs\/SAMPLE_REPORT\.md$/.test(f)||/sample-report\.html$/.test(f)||/mock-data-(scanner|schema-validator|action-plan|report)\.c?js$/.test(f)||/page-sample-specs\.c?js$/.test(f)||/test-cert\//.test(f)||/\.sample\./.test(f)||/-sample\./.test(f)||/sample-\./.test(f));
      const mockAutoComplete=isLegitimateDemo||scanIsClean||mockTotal===0;
      {
        const t=[];
        if(mockCats.length>0){
          mockCats.forEach(c=>{t.push({description:`Review ${c.fileCount||0} ${c.category} file(s)`,type:'review',isStructured:true});});
        }else{t.push({description:`Review ${mockTotal} mock/fixture file(s)`,type:'review',isStructured:true});}
        if(!mockAutoComplete) t.push(
          { description: 'Add .simplebeaconignore patterns for fixtures', type: 'fix', codeSnippet: 'echo "*.fixture.*" >> .simplebeaconignore', isStructured: true },
          { description: 'Exclude test data from production builds', type: 'fix', isStructured: true }
        );
        if(mockAutoComplete) t.push({ description: 'Demo data verified — excluded from production builds', type: 'verify', done: mockAutoComplete, isStructured: true });
        const mockProgress=mockAutoComplete?100:Math.max(5,Math.min(100,Math.round(100-mockTotal*0.5)));
        const mockStatus=mockProgress>=95?'completed':'pending';
        phases.push({id:'mockdata',title:'Mock Data Review',severity:'low',effort:mockAutoComplete?'None':'1 day',description:mockAutoComplete?'No mock data issues — fixtures verified or none detected.':`${mockTotal} mock/fixture file(s) detected — verify excluded from production.`,tasks:t,progress:mockProgress,status:mockStatus});
      }

      // Phase 5.75: npm Audit — always show
      const npm=report.npmAudit||{};
      const pkgCount=npm.packageJsonCount!=null?Number(npm.packageJsonCount):0;
      const depCount=npm.dependencyCount!=null?Number(npm.dependencyCount):0;
      const outdatedCount=npm.outdatedCount!=null?Number(npm.outdatedCount):0;
      const missingLockfiles=npm.missingLockfiles!=null?Number(npm.missingLockfiles):0;
      const packages=(npm.packages||[]);
      {
        const t=[];
        // Per-package tasks with lockfile detail (prefer rich packages array over plain paths)
        const pkgList=packages.length>0?packages:(npm.packageJsonFiles||[]).map(f=>({path:f}));
        pkgList.forEach(p=>{
          const shortName=p.path?p.path.split('/').slice(-2).join('/'):String(p);
          const deps=p.depCount!=null?` — ${p.depCount} deps${p.devDepCount>0?' + '+p.devDepCount+' devDeps':''}`:'';
          const lock=p.hasLockfile?`, lockfile: ${p.lockfileType||'yes'}`:(p.hasLockfile===false?', **missing lockfile**':'');
          t.push({
            description: `Review ${shortName}${deps}${lock}`,
            type: 'review',
            location: p.path || shortName,
            isStructured: true
          });
        });
        const npmClean=pkgCount===0&&depCount===0;
        if(depCount>0) t.push({ description: `Audit ${depCount} total dependencies`, type: 'audit', codeSnippet: 'npm audit', done: false, isStructured: true });
        if(outdatedCount>0) t.push({ description: `Update ${outdatedCount} outdated package(s)`, type: 'fix', codeSnippet: 'npm update', done: false, isStructured: true });
        if(missingLockfiles>0) t.push({ description: `Add missing lockfiles (${missingLockfiles} package(s))`, type: 'fix', codeSnippet: 'npm install', location: pkgList.filter(p=>p.hasLockfile===false).map(p=>p.path||String(p)).join(', '), done: false, isStructured: true });
        t.push(
          { description: 'Run npm audit', type: 'audit', codeSnippet: 'npm audit', done: npmClean, isStructured: true },
          { description: 'Verify lockfile integrity', type: 'verify', codeSnippet: 'npm ci', done: npmClean, isStructured: true },
          { description: 'Review dependency update policy', type: 'review', done: npmClean, isStructured: true }
        );
        const pk2=(src.projectRoot||src.projectPath||src.projectName||report.projectRoot||report.projectPath||report.projectName||'project').replace(/[^a-z0-9]/gi,'_');
        const doneCount=t.reduce((n,task,idx)=>n+((loadTaskState(pk2,'npmaudit',idx)||(typeof task==='object'&&task.done))?1:0),0);
        const progress=pkgCount===0&&depCount===0?100:(t.length?Math.round((doneCount/t.length)*100):0);
        const status=pkgCount===0&&depCount===0?'completed':(progress>=95?'completed':(progress>0?'in-progress':'pending'));
        if(t.length===0)t.push({description:'Dependencies verified — no audit issues detected.',type:'verify',isStructured:true});
        phases.push({id:'npmaudit',title:'npm Audit',severity:(outdatedCount>0||missingLockfiles>0)?'medium':'low',effort:'1 day',description:pkgCount===0&&depCount===0?'No package.json detected — this project does not use npm dependencies.':`${pkgCount} package.json file(s), ${depCount} total dependencies${missingLockfiles>0?', '+missingLockfiles+' missing lockfile(s)':''}${outdatedCount>0?', '+outdatedCount+' outdated':''}.`,tasks:t,progress,status});
      }

      // Phase 6: Quality Optimization — always show
      {
        const t=[];
        if(todoDetail.length>0){
          todoDetail.forEach(f=>{t.push({ description: `Address TODO in ${f.file}${f.line?':'+f.line:''}`, type: 'fix', location: f.file, isStructured: true });});
        }else if(todoMarkers!=null&&todoMarkers>0){t.push({ description: `Address ${todoMarkers} TODO/FIXME marker(s) in source code`, type: 'fix', isStructured: true });}
        if(debugDetail.length>0){
          debugDetail.forEach(f=>{t.push({ description: `Remove debug artifact in ${f.file}${f.line?':'+f.line:''}`, type: 'fix', location: f.file, isStructured: true });});
        }
        if(qs<85) t.push({ description: 'Refactor low-quality modules (quality score < 85)', type: 'fix', done: false, isStructured: true });
        t.push(
          { description: 'Add test coverage for uncovered modules', type: 'fix', codeSnippet: 'npm test -- --coverage', done: qs>=90, isStructured: true },
          { description: 'Install pre-commit hooks for automated scanning', type: 'fix', codeSnippet: 'npx husky install', done: qs>=90, isStructured: true },
          { description: 'Schedule monthly quality gate reviews', type: 'review', done: qs>=90, isStructured: true }
        );
        const penalty=(todoDetail.length>0?Math.min(20,todoDetail.length*2):0)+(debugDetail.length>0?Math.min(20,debugDetail.length*3):0);
        const rawProgress=Math.round(qs||0);
        const progress=Math.max(0,Math.min(100,rawProgress-penalty));
        const status=progress>=90?'completed':(progress>0?'in-progress':'pending');
        const optDesc=qs>=90?`Maintain quality score at ${qs}/100 (currently above 90+).`:`Drive quality score from ${qs||0}/100 toward 90+.`;
        phases.push({id:'optimization',title:'Quality Optimization',severity:qs<70?'high':'low',effort:'Ongoing',description:optDesc+`${todoDetail.length>0?' '+todoDetail.length+' TODO marker(s).':''}${debugDetail.length>0?' '+debugDetail.length+' debug artifact(s).':''}`,tasks:t,progress,status});
      }

      // Phase 6: Junk & Temporary Files — always show
      {
        const jCount=junkDetail.length||Number(report.junkFiles?.count)||0;
        const t=[];
        if(junkDetail.length>0){
          junkDetail.forEach(f=>{t.push({ description: `Remove junk/temp file: ${f.file}`, type: 'fix', location: f.file, isStructured: true });});
        }else if(jCount>0){t.push({ description: `Remove ${jCount} junk / temporary file(s)`, type: 'fix', isStructured: true });}
        const junkClean=jCount===0;
        t.push(
          { description: 'Add .simplebeaconignore patterns for temp files', type: 'fix', codeSnippet: 'echo "*.tmp" >> .simplebeaconignore', done: junkClean, isStructured: true },
          { description: 'Schedule monthly cleanup sweep', type: 'review', done: junkClean, isStructured: true }
        );
        phases.push({id:'junkfiles',title:'Junk & Temporary Files',severity:'low',effort:'1 day',description:jCount===0?'No junk or temporary files detected.':`${jCount} junk / temporary file(s) detected.`,tasks:t,progress:jCount===0?100:Math.max(10,Math.round(100-jCount*2)),status:jCount===0?'completed':'pending'});
      }

      // Phase 7: Build Readiness — always show
      {
        const brScore=src.buildReadiness?.score!=null?Number(src.buildReadiness.score):null;
        const t=[];
        if(buildDetail.length>0){
          buildDetail.forEach(f=>{t.push({ description: `Fix build issue: ${f.text||f.file}`, type: 'fix', location: f.file, isStructured: true });});
        }else{const brClean=buildDetail.length===0;t.push(
          { description: 'Review build configuration', type: 'review', done: brClean, isStructured: true },
          { description: 'Verify CI/CD pipeline health', type: 'verify', done: brClean, isStructured: true },
          { description: 'Update build scripts', type: 'fix', done: brClean, isStructured: true }
        );}
        phases.push({id:'buildreadiness',title:'Build Readiness',severity:'medium',effort:'2–3 days',description:brScore!=null?`Build readiness: ${brScore}%.`:(buildDetail.length===0?'Build readiness verified — no issues detected.':`Build readiness — ${buildDetail.length} issue(s) detected.`),tasks:t,progress:brScore!=null?Math.min(100,Math.round(brScore)):(buildDetail.length===0?100:50),status:(brScore!=null&&brScore>=80)||buildDetail.length===0?'completed':'pending'});
      }

      // Phase 8: Dependency Vulnerability Audit — always show
      {
        const vCount=vulnDetail.length||Number(src.dependencyAudit?.vulnerabilityCount)||0;
        const t=[];
        if(vulnDetail.length>0){
          vulnDetail.forEach(f=>{t.push({description:`Patch vulnerability: ${f.text||f.file}`,type:'fix',location:f.file,isStructured:true});});
        }else if(vCount>0){t.push({description:`Patch ${vCount} vulnerable dependency(ies)`,type:'fix',isStructured:true});}
        const vulnClean=vCount===0;
        t.push(
          { description: 'Run npm audit fix', type: 'fix', codeSnippet: 'npm audit fix', done: vulnClean, isStructured: true },
          { description: 'Review dependency update policy', type: 'review', done: vulnClean, isStructured: true },
          { description: 'Enable Dependabot or Snyx', type: 'fix', codeSnippet: 'Enable Dependabot in repo settings', done: vulnClean, isStructured: true }
        );
        phases.push({id:'vulns',title:'Dependency Vulnerability Audit',severity:vCount>0?'high':'low',effort:'1–3 days',description:vCount===0?'No vulnerable dependencies detected.':`${vCount} vulnerable dependency(ies) detected.`,tasks:t,progress:vCount===0?100:Math.max(10,Math.round(100-vCount*15)),status:vCount===0?'completed':'pending'});
      }

      // Fallback: if no quality metrics were present at all
      if(phases.length===0){
        if(qs==null&&schemaComp==null&&consistency==null&&dupes==null&&credFindings==null){
          phases.push({id:'no-metrics',title:'Scan Complete — Quality Metrics Not Present',severity:'low',effort:'Review scan config',description:'This scan report does not contain data-quality metrics. The scanner may have run in a lightweight mode (e.g., gate scan only). Re-run with --complete or check that the report includes qualityScore, schemaCompliance, and consistencyScore fields.',tasks:[
            { description: 'Re-run scan with full analysis enabled', type: 'verify', codeSnippet: 'npx simplebeacon scan --complete', isStructured: true },
            { description: 'Verify scanner configuration includes data-quality analyzers', type: 'verify', isStructured: true },
            { description: 'Check that the report JSON includes qualityScore, schemaCompliance, consistencyScore', type: 'verify', isStructured: true }
          ],progress:0,status:'pending'});
        } else {
          phases.push({id:'perfect',title:'All Systems Green',severity:'low',effort:'None',description:'Excellent data quality — no actionable findings in any measured category.',tasks:[
            { description: 'Schedule next scan in 30 days', type: 'review', isStructured: true },
            { description: 'Document quality maintenance procedures', type: 'doc', isStructured: true }
          ],progress:100,status:'completed'});
        }
      }
      // Add dependency metadata — compliance work depends on EU AI Act review
      const euaiPhase = phases.find(p => p.id === 'euaiact');
      const depTarget = euaiPhase ? 'euaiact' : (phases.find(p => p.id === 'security') ? 'security' : null);
      phases.forEach(p => {
        if (['optimization','junkfiles','vulns'].includes(p.id)) {
          p.dependsOn = depTarget;
        }
      });
      // Enforce dependency blocking: if dependsOn phase is not complete, cap status to blocked
      phases.forEach(p=>{
        if(!p.dependsOn||p.progress>=100)return;
        const dep=phases.find(x=>x.id===p.dependsOn);
        if(dep&&dep.status==='blocked'){
          p.status='blocked';
          p.progress=Math.min(p.progress,dep.progress);
        }
      });
      // Auto-mark verify/review tasks as done when phase is clean (no real issues)
      phases.forEach(p=>{
        if(p.status==='completed'&&Array.isArray(p.tasks)){
          p.tasks.forEach(t=>{if(t&&(t.type==='verify'||t.type==='review'))t.done=true;});
        }
      });
      // Apply localStorage task states and recompute progress/status from actual task completion
      const projectKey=(src.projectRoot||src.projectPath||src.projectName||report.projectRoot||report.projectPath||report.projectName||'project').replace(/[^a-z0-9]/gi,'_');
      phases.forEach(p=>{
        if(!Array.isArray(p.tasks)||p.tasks.length===0)return;
        let doneCount=0;
        p.tasks.forEach((task,idx)=>{
          const lsDone=loadTaskState(projectKey,p.id,idx);
          if(typeof task==='object'&&task!=null){task.done=!!(task.done||lsDone);}
          if(task.done)doneCount++;
        });
        const taskPercent=p.tasks.length?Math.round((doneCount/p.tasks.length)*100):100;
        const taskStatus=taskPercent>=95?'completed':(taskPercent>0?'in-progress':'pending');
        // Only override if not already blocked by dependencies
        if(p.status!=='blocked'){p.status=taskStatus;p.progress=taskPercent;}
        // If blocked but progress should be 100, keep blocked (dependency not met)
      });
      // Sort phases by severity (critical first) then by completion status (incomplete first)
      const sevOrder={critical:0,high:1,medium:2,low:3};
      const statusOrder={blocked:0,pending:1,'in-progress':2,completed:3};
      phases.sort((a,b)=>{
        const sevDiff=(sevOrder[a.severity]||99)-(sevOrder[b.severity]||99);
        if(sevDiff!==0)return sevDiff;
        // Within same severity: blocked → pending → in-progress → completed
        return(statusOrder[a.status]||0)-(statusOrder[b.status]||0);
      });
      // Re-number phase titles to match new order
      phases.forEach((p,i)=>{p.title='Phase '+(i+1)+': '+p.title.replace(/^Phase \d+:\s*/,'');});
      return{phases,generatedAt:new Date().toISOString(),sourceReport:report.generatedAt};
    }

    function renderDashboard(report,roadmap){
      // Auto-mark verify/review tasks as done when phase has no real issues
      if(roadmap&&Array.isArray(roadmap.phases)){
        roadmap.phases.forEach(p=>{
          if((p.status==='completed'||p.progress>=95)&&Array.isArray(p.tasks)){
            p.tasks.forEach(t=>{if(t&&(t.type==='verify'||t.type==='review'))t.done=true;});
          }
        });
      }
      const src = report.sourceReport || report;
      const pn=src.projectRoot||src.projectPath||src.projectName||report.projectRoot||report.projectPath||report.projectName||'Unknown';
      const srcIssues = report.rawIssues || report.issues || report.detectedIssues || [];
      const isBuildArtifactPath = (p) => /(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|frontend-build|simplebeacon-vscode-merged|ai-platform)\//i.test(p) || /(^|\/)vscode-extension\/out\//i.test(p) || /\.map$/i.test(p);
      const allIssues = (Array.isArray(srcIssues) ? srcIssues : []).map(issue => {
        const sev = issue.severity || issue.severityBand || 'low';
        const type = issue.type || 'Unknown';
        const count = issue.count || 1;
        const files = (Array.isArray(issue.filePath) ? issue.filePath : (issue.filePath ? [issue.filePath] : [])).filter(f => !isBuildArtifactPath(f));
        return { sev, type, count, files, impact: issue.impact || '', fix: issue.fix || '', humanReadable: issue.humanReadable || '' };
      }).filter(issue => issue.files.length > 0 || !(Array.isArray(issue.filePath) ? issue.filePath : (issue.filePath ? [issue.filePath] : [])).some(isBuildArtifactPath));
      const projectKey=String(pn).replace(/[^a-z0-9]/gi,'_');
      projectNameEl.textContent='Project: '+pn;
      scanDateEl.textContent=report.generatedAt?new Date(report.generatedAt).toLocaleDateString():'—';
      const qs=src.qualityScore!=null?Number(src.qualityScore):null;
      const sc=src.schemaCompliance!=null?Number(src.schemaCompliance):null;
      const cs=src.consistencyScore!=null?Number(src.consistencyScore):null;
      const issues=allIssues.length;
      const dupes=src.duplicateGroups!=null?Number(src.duplicateGroups):null;
      const filesAnalyzed=src.filesAnalyzed!=null?Number(src.filesAnalyzed):(src.totalFiles!=null?Number(src.totalFiles):null);
      const cards=[
        qs!=null?{label:'Quality Score',value:qs+'/100',pct:qs,cls:qs>=85?'score-good':qs>=70?'score-warn':'score-bad'}:null,
        sc!=null?{label:'Schema Compliance',value:sc+'%',pct:sc,cls:sc===100?'score-good':sc>=80?'score-warn':'score-bad'}:null,
        cs!=null?{label:'Consistency',value:cs+'%',pct:cs,cls:cs===100?'score-good':cs>=80?'score-warn':'score-bad'}:null,
        issues!=null?{label:'Total Issues',value:String(issues),pct:Math.max(0,100-issues*3),cls:issues===0?'score-good':issues<10?'score-warn':'score-bad'}:null,
        dupes!=null?{label:'Duplicate Groups',value:String(dupes),pct:dupes===0?100:Math.max(0,100-dupes*10),cls:dupes===0?'score-good':dupes<5?'score-warn':'score-bad'}:null,
        filesAnalyzed!=null?{label:'Files Analyzed',value:String(filesAnalyzed),rawValue:String(filesAnalyzed)+(src.excludedCount!=null&&src.excludedCount>0?` <span style="font-size:0.7rem;color:var(--text-dim);">(${src.excludedCount} excluded)</span>`:''),pct:100,cls:'score-info'}:null
      ].filter(Boolean);
      scorecardsEl.innerHTML=cards.map(c=>`<div class="scorecard ${c.cls}"><div class="scorecard-label">${escapeHtml(c.label)}</div><div class="scorecard-value">${c.rawValue || escapeHtml(c.value)}</div><div class="scorecard-delta">${c.pct}% health</div><div class="scorecard-bar"><div class="scorecard-bar-fill" style="width:${c.pct}%"></div></div></div>`).join('');

      // Overall health ring
      const completedCount=roadmap.phases.filter(p=>p.status==='completed').length;
      const blockedCount=roadmap.phases.filter(p=>p.status==='pending'&&p.severity==='critical').length;
      const totalWeight=roadmap.phases.reduce((a,p)=>a+(p.status==='completed'?1:p.status==='in-progress'?0.5:0),0);
      const overallPct=roadmap.phases.length?Math.round((totalWeight/roadmap.phases.length)*100):0;
      const ringColor=overallPct>=85?'#10B981':(overallPct>=60?'#F59E0B':'#EF4444');
      const overallHealthEl=document.getElementById('overallHealth');
      if(overallHealthEl){
        const circumference=2*Math.PI*36;
        const offset=circumference-(overallPct/100)*circumference;
        overallHealthEl.innerHTML=`<div class="overall-health"><div class="health-ring"><svg viewBox="0 0 80 80"><circle class="health-ring-bg" cx="40" cy="40" r="36"/><circle class="health-ring-fill" cx="40" cy="40" r="36" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" style="stroke:${ringColor}"/></svg><div class="health-ring-text" style="color:${ringColor}">${overallPct}%</div></div><div class="health-details"><div class="health-title">Project Health</div><div class="health-subtitle">${completedCount} of ${roadmap.phases.length} phases completed${blockedCount>0?'; '+blockedCount+' blocked by critical issues':''}</div><div class="health-eta">Estimated completion: ${estimateEta(roadmap)}</div></div></div>`;
      }

      // Findings banner
      const bannerEl=document.getElementById('findingsBanner');
      if(bannerEl){
        const chips=[];
        const gate=report.gate||report.gateReport||{};
        const bc=gate.blockingCount||0;
        const wc=gate.warningCount||0;
        const cred=(report.issues||[]).filter(i=>/credential|secret|token/i.test(i.type||'')).reduce((a,i)=>a+(i.count||1),0);
        const debug=(report.cleanup?.debugArtifactCount)||0;
        const vuln=(report.dependencyAudit?.vulnerabilityCount)||0;
        if(bc>0)chips.push(`<div class="finding-chip critical">${bc} Blocking</div>`);
        if(cred>0)chips.push(`<div class="finding-chip high">${cred} Credential</div>`);
        if(vuln>0)chips.push(`<div class="finding-chip high">${vuln} Vuln</div>`);
        if(wc>0)chips.push(`<div class="finding-chip medium">${wc} Warning</div>`);
        if(debug>0)chips.push(`<div class="finding-chip low">${debug} Debug</div>`);
        bannerEl.innerHTML=chips.length?`<div class="findings-banner">${chips.join('')}</div>`:'';
      }

      // Global progress bar
      const globalProgressEl=document.getElementById('globalProgress');
      const globalProgressFill=document.getElementById('globalProgressFill');
      const globalProgressText=document.getElementById('globalProgressText');
      if(globalProgressEl&&globalProgressFill&&globalProgressText){
        const overallPct=roadmap.phases.length?Math.round((roadmap.phases.filter(p=>p.status==='completed').length/roadmap.phases.length)*100):0;
        globalProgressEl.style.display='block';
        globalProgressFill.style.width=overallPct+'%';
        globalProgressText.textContent=overallPct+'%';
      }

      // Render phases with interactive checkboxes and expand/collapse
      window._roadmapProjectKey=projectKey;
      window._currentRoadmap=roadmap;
      timelineEl.innerHTML=roadmap.phases.map((p,phaseIdx)=>{
        const sc=p.status==='completed'?'completed':p.status==='blocked'?'blocked':p.status==='in-progress'?'in-progress':'';
        const extraClass=p.status==='blocked'||(p.status==='pending'&&p.severity==='critical')?' blocked':'';
        const pt=p.status==='completed'?'Complete':p.status==='blocked'?'Blocked':p.status==='in-progress'?'In Progress':'Not Started';
        const collapsed=phaseIdx>0&&p.status==='completed'?' collapsed':'';
        const depBlock=p.dependsOn?`<div class="dep-line"><span class="dep-arrow">↳</span> Depends on <strong>${escapeHtml(roadmap.phases.find(x=>x.id===p.dependsOn)?.title||p.dependsOn)}</strong></div>`:'';
        const depClass=p.dependsOn?' depends-on-critical':'';
        const completedMark=p.status==='completed'?' <span style="color:var(--success);margin-left:4px;">✓</span>':'';
        const statusBadgeClass=p.status==='completed'?'complete':p.status==='blocked'?'blocked':p.status==='in-progress'?'in-progress':'incomplete';
        const statusBadgeText=p.status==='completed'?'COMPLETE':p.status==='blocked'?'BLOCKED':p.status==='in-progress'?'IN PROGRESS':'INCOMPLETE';
        const statusBadgeHtml='<span class="phase-status-badge '+statusBadgeClass+'">'+statusBadgeText+'</span>';
        const progressFillStyle=p.status==='completed'?'background:var(--success)':p.status==='blocked'?'background:var(--error)':'background:linear-gradient(90deg,var(--accent),var(--info))';
        const markAllBtn=p.status==='completed'?'':`<button class="phase-action-btn done" data-action="markall" data-phase="${p.id}">✓ Mark All Done</button>`;
        const taskTypeBar=buildPhaseTaskTypeBar(p.tasks);
        const TASK_OVERFLOW_LIMIT=10;
        const totalTasks=p.tasks.length;
        const hasOverflow=totalTasks>TASK_OVERFLOW_LIMIT;
        const taskItemsHtml=(()=>{return p.tasks.map((t,taskIdx)=>{const done=p.status==='completed'?true:(t&&t.done?true:loadTaskState(projectKey,p.id,taskIdx));if(p.status==='completed')saveTaskState(projectKey,p.id,taskIdx,true);if(typeof t==='object'&&t!=null)t.done=done;const timeSpent=loadTaskTime(projectKey,p.id,taskIdx);const taskText=typeof t==='object'&&t.html?t.html:(typeof t==='object'&&t!=null&&t.description?buildStructuredTaskHtml(t):escapeHtml(t));const copyBtn='<span class="task-copy" data-phase="'+p.id+'" data-task="'+taskIdx+'" title="Copy task">&#128203;</span>';const overflowClass=(hasOverflow&&taskIdx>=TASK_OVERFLOW_LIMIT)?' phase-task-overflow':'';return '<li tabindex="0" class="'+(done?'done ':'')+overflowClass+'" data-phase="'+p.id+'" data-task="'+taskIdx+'"><span class="task-check'+(done?' checked':'')+'"></span><span class="task-text">'+taskText+'</span>'+copyBtn+'<span class="task-timer" data-phase="'+p.id+'" data-task="'+taskIdx+'"><span class="timer-btn">&#9654;</span><span class="timer-display">'+formatTime(timeSpent)+'</span></span></li>';}).join('')+(hasOverflow?'<li class="phase-expand-li" style="list-style:none;padding-left:0;margin-left:-8px;border-bottom:none;"><button class="phase-action-btn phase-expand-btn" data-action="expand-tasks" data-phase="'+p.id+'">Show '+(totalTasks-TASK_OVERFLOW_LIMIT)+' more tasks</button></li>':'');})();
        return '<div class="timeline-phase '+sc+extraClass+depClass+'" data-status="'+p.status+'" data-phase="'+p.id+'"><div class="phase-card'+collapsed+'">'+depBlock+'<div class="phase-header"><div class="phase-title">'+escapeHtml(p.title)+completedMark+'</div><div class="phase-meta">'+statusBadgeHtml+'<span class="phase-badge badge-'+escapeHtml(p.severity)+'">'+escapeHtml(p.severity)+'</span><span class="phase-badge badge-effort">'+escapeHtml(p.effort)+'</span><span class="phase-toggle">▼</span></div></div><div class="phase-desc">'+escapeHtml(p.description)+'</div>'+(p.extraHtml||'')+taskTypeBar+'<ul class="phase-tasks">'+taskItemsHtml+'</ul><div class="phase-progress"><div class="phase-progress-label"><span>'+pt+'</span><span>'+p.progress+'%</span></div><div class="phase-progress-bar"><div class="phase-progress-fill" style="width:'+p.progress+'%;'+progressFillStyle+'"></div></div></div><div class="phase-actions">'+markAllBtn+'<button class="phase-action-btn" data-action="copy-phase" data-phase="'+p.id+'" title="Copy all tasks as markdown">&#128203; Copy Phase</button><button class="phase-action-btn" data-action="download-json" data-phase="'+p.id+'">Download JSON</button><button class="phase-action-btn" data-action="collapse" data-phase="'+p.id+'">Toggle Details</button></div></div></div>';
      }).join('');

      // Wire up interactivity
      wirePhaseInteractions(projectKey);
      wireSearchFilter();
      updateSprintTracker();
      applyPhaseFilter(currentFilter||'all');

      // All Issues section: render every raw issue from the report
      const allIssuesListEl=document.getElementById('allIssuesList');
      const issueSeverityFiltersEl=document.getElementById('issueSeverityFilters');
      const issueSearchInput=document.getElementById('issueSearch');
      const issueSearchHitsEl=document.getElementById('issueSearchHits');
      // allIssues already computed above for the scorecard
      const sevCounts = allIssues.reduce((acc, i) => { acc[i.sev] = (acc[i.sev] || 0) + 1; return acc; }, {});
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severities = Object.keys(sevCounts).sort((a, b) => (sevOrder[a] || 99) - (sevOrder[b] || 99));
      let activeIssueFilter = 'all';
      let activeIssueQuery = '';
      function renderIssues() {
        if (!allIssuesListEl) return;
        let filtered = allIssues.filter(i => activeIssueFilter === 'all' || i.sev === activeIssueFilter);
        if (activeIssueQuery) {
          const q = activeIssueQuery.toLowerCase();
          filtered = filtered.filter(i => i.type.toLowerCase().includes(q) || i.files.some(f => f.toLowerCase().includes(q)) || (i.impact && i.impact.toLowerCase().includes(q)) || (i.fix && i.fix.toLowerCase().includes(q)));
        }
        if (filtered.length === 0) {
          allIssuesListEl.innerHTML = '<div class="issue-empty">No issues match the current filter.</div>';
        } else {
          allIssuesListEl.innerHTML = filtered.map(issue => {
            const sevClass = issue.sev;
            const fileHtml = issue.files.slice(0, 5).map(f => `<code>${escapeHtml(f)}</code>`).join(', ') + (issue.files.length > 5 ? ` <span style="color:var(--text-dim);font-size:0.7rem;">+${issue.files.length - 5} more</span>` : '');
            const impactHtml = issue.impact ? `<div class="issue-impact">${escapeHtml(issue.impact)}</div>` : '';
            const fixHtml = issue.fix ? `<div class="issue-fix">${escapeHtml(issue.fix)}</div>` : '';
            return `<div class="issue-item" data-severity="${escapeHtml(issue.sev)}">
              <div class="issue-header">
                <span class="issue-severity ${sevClass}">${escapeHtml(issue.sev)}</span>
                <span class="issue-type">${escapeHtml(issue.type)}</span>
                <span class="issue-count">${issue.count} hit${issue.count === 1 ? '' : 's'}</span>
              </div>
              <div class="issue-files">Files: ${fileHtml || '<em>none</em>'}</div>
              ${impactHtml}${fixHtml}
            </div>`;
          }).join('');
        }
        if (issueSearchHitsEl) issueSearchHitsEl.textContent = `Showing ${filtered.length} of ${allIssues.length} issues`;
      }
      if (issueSeverityFiltersEl) {
        issueSeverityFiltersEl.innerHTML = '<button class="filter-btn active" data-sev="all">All (' + allIssues.length + ')</button>' + severities.map(s => `<button class="filter-btn" data-sev="${escapeHtml(s)}">${escapeHtml(s)} (${sevCounts[s]})</button>`).join('');
        issueSeverityFiltersEl.querySelectorAll('.filter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            issueSeverityFiltersEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeIssueFilter = btn.dataset.sev;
            renderIssues();
          });
        });
      }
      if (issueSearchInput) {
        issueSearchInput.addEventListener('input', () => {
          activeIssueQuery = issueSearchInput.value.trim();
          renderIssues();
        });
      }
      renderIssues();

      // Show All / Show Less toggle for issues list
      (function() {
        const toggleBtn = document.getElementById('toggleShowAllIssues');
        const listEl = document.getElementById('allIssuesList');
        if (!toggleBtn || !listEl) return;
        let expanded = false;
        toggleBtn.addEventListener('click', () => {
          expanded = !expanded;
          listEl.style.maxHeight = expanded ? 'none' : '600px';
          toggleBtn.textContent = expanded ? 'Show Less' : 'Show All';
        });
      })();

      // Show All / Collapse All toggle for timeline phases
      (function() {
        const toggleBtn = document.getElementById('toggleShowAllTimeline');
        if (!toggleBtn) return;
        let allExpanded = false;
        toggleBtn.addEventListener('click', () => {
          allExpanded = !allExpanded;
          document.querySelectorAll('.phase-card').forEach(card => {
            card.classList.toggle('collapsed', !allExpanded);
          });
          toggleBtn.textContent = allExpanded ? 'Collapse All' : 'Show All';
        });
      })();

      // Export filtered issues as JSON
      const exportIssuesBtn = document.getElementById('exportIssuesJsonBtn');
      if (exportIssuesBtn) {
        exportIssuesBtn.onclick = () => {
          let filtered = allIssues.filter(i => activeIssueFilter === 'all' || i.sev === activeIssueFilter);
          if (activeIssueQuery) {
            const q = activeIssueQuery.toLowerCase();
            filtered = filtered.filter(i => i.type.toLowerCase().includes(q) || i.files.some(f => f.toLowerCase().includes(q)) || (i.impact && i.impact.toLowerCase().includes(q)) || (i.fix && i.fix.toLowerCase().includes(q)));
          }
          const payload = {
            exportedAt: new Date().toISOString(),
            project: currentReport.projectName || currentReport.projectRoot || 'Unknown',
            filter: { severity: activeIssueFilter, query: activeIssueQuery },
            total: allIssues.length,
            count: filtered.length,
            issues: filtered
          };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'issues-' + (activeIssueFilter === 'all' ? 'all' : activeIssueFilter) + '-' + new Date().toISOString().slice(0, 10) + '.json';
          document.body.appendChild(a); a.click();
          setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 100);
          showToast(filtered.length + ' issue(s) exported', 'success');
        };
      }

      const preview=JSON.stringify(report,null,2);
      jsonPreviewEl.textContent=preview.length>4000?preview.slice(0,4000)+'\n\n... truncated ...':preview;

      // Show and wire download button
      const dlBtn=document.getElementById('downloadSourceReportBtn');
      if(dlBtn){
        dlBtn.style.display='inline-block';
        dlBtn.onclick=()=>{
          const blob=new Blob([preview],{type:'application/json'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url;
          a.download='simplebeacon-source-report.json';
          document.body.appendChild(a);a.click();
          setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},100);
        };
      }
    }

    let currentFilter='all';
    function estimateEta(roadmap){
      const pending=roadmap.phases.filter(p=>p.status!=='completed');
      if(!pending.length)return 'All done!';
      // Account for dependency chains: only count effort of root phases + longest chain
      const depMap=new Map(roadmap.phases.map(p=>[p.id,p]));
      function effortOf(p){const m=String(p.effort).match(/(\d+)/);return m?parseInt(m[1],10):1;}
      function chainDays(pid,seen=new Set()){
        if(seen.has(pid))return 0;seen.add(pid);
        const p=depMap.get(pid);if(!p)return 0;
        const own=effortOf(p);
        const depId=p.dependsOn;
        if(!depId)return own;
        return own+chainDays(depId,new Set(seen));
      }
      const rootPending=pending.filter(p=>!p.dependsOn||!depMap.get(p.dependsOn));
      const rootDays=rootPending.reduce((a,p)=>a+effortOf(p),0);
      const chainDaysMax=Math.max(0,...pending.map(p=>chainDays(p.id)));
      const days=Math.max(rootDays,chainDaysMax);
      const d=new Date();d.setDate(d.getDate()+days);
      return days+' day'+(days===1?'':'s')+' ('+d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+')';
    }
    function updatePhaseState(phaseId){
      if(!window._currentRoadmap)return;
      const phase=window._currentRoadmap.phases.find(p=>p.id===phaseId);
      if(!phase)return;
      const pk=window._roadmapProjectKey||'project';
      const card=document.querySelector('.timeline-phase[data-phase="'+phaseId+'"] .phase-card');
      if(!card)return;
      const tasks=card.querySelectorAll('.phase-tasks li');
      tasks.forEach((li,idx)=>{
        const isDone=li.classList.contains('done');
        if(phase.tasks[idx]){
          if(typeof phase.tasks[idx]==='object')phase.tasks[idx].done=isDone;
          else phase.tasks[idx]={description:phase.tasks[idx],done:isDone};
        }
        saveTaskState(pk,phaseId,idx,isDone);
      });
      const doneCount=Array.from(tasks).filter(li=>li.classList.contains('done')).length;
      phase.progress=tasks.length?Math.round((doneCount/tasks.length)*100):0;
      phase.status=phase.progress>=95?'completed':(phase.progress>0?'in-progress':'pending');
    }
    function updateOverallHealth(){
      if(!window._currentRoadmap)return;
      const rm=window._currentRoadmap;
      const pk=window._roadmapProjectKey||'project';
      const completedCount=rm.phases.filter(p=>p.status==='completed').length;
      const blockedCount=rm.phases.filter(p=>p.status==='blocked').length;
      // Recalculate task-based progress for each phase
      let totalWeight=0;
      rm.phases.forEach(p=>{
        const card=document.querySelector('.timeline-phase[data-phase="'+p.id+'"] .phase-card');
        if(card){
          const tasks=card.querySelectorAll('.phase-tasks li');
          const doneCount=card.querySelectorAll('.phase-tasks li.done').length;
          const pct=tasks.length?Math.round((doneCount/tasks.length)*100):0;
          totalWeight+=(pct>=95?1:pct>0?0.5:0);
        } else {
          totalWeight+=(p.status==='completed'?1:p.status==='in-progress'?0.5:0);
        }
      });
      const overallPct=rm.phases.length?Math.round((totalWeight/rm.phases.length)*100):0;
      const ringColor=overallPct>=85?'#10B981':(overallPct>=60?'#F59E0B':'#EF4444');
      const overallHealthEl=document.getElementById('overallHealth');
      if(overallHealthEl){
        const circumference=2*Math.PI*36;
        const offset=circumference-(overallPct/100)*circumference;
        overallHealthEl.innerHTML=`<div class="overall-health"><div class="health-ring"><svg viewBox="0 0 80 80"><circle class="health-ring-bg" cx="40" cy="40" r="36"/><circle class="health-ring-fill" cx="40" cy="40" r="36" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" style="stroke:${ringColor}"/></svg><div class="health-ring-text" style="color:${ringColor}">${overallPct}%</div></div><div class="health-details"><div class="health-title">Project Health</div><div class="health-subtitle">${completedCount} of ${rm.phases.length} phases completed${blockedCount>0?'; '+blockedCount+' blocked by critical issues':''}</div><div class="health-eta">Estimated completion: ${estimateEta(rm)}</div></div></div>`;
      }
      // Update global progress bar
      const globalProgressFill=document.getElementById('globalProgressFill');
      const globalProgressText=document.getElementById('globalProgressText');
      if(globalProgressFill&&globalProgressText){
        const pct=rm.phases.length?Math.round((completedCount/rm.phases.length)*100):0;
        globalProgressFill.style.width=pct+'%';
        globalProgressText.textContent=pct+'%';
      }
    }
    // Keyboard shortcuts
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        const searchEl=document.getElementById('taskSearch');
        if(searchEl&&searchEl.value){searchEl.value='';searchEl.dispatchEvent(new Event('input'));}
      }
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){
        e.preventDefault();
        const searchEl=document.getElementById('taskSearch');
        if(searchEl){searchEl.focus();searchEl.select();}
      }
    });
    function wireSearchFilter(){
      const searchEl=document.getElementById('taskSearch');
      const hitsEl=document.getElementById('searchHits');
      if(!searchEl)return;
      searchEl.addEventListener('input',()=>{
        const q=searchEl.value.trim().toLowerCase();
        if(!q){hitsEl.textContent='';document.querySelectorAll('.phase-tasks li').forEach(li=>li.style.display='');document.querySelectorAll('.timeline-phase').forEach(el=>el.style.display='');applyPhaseFilter(currentFilter||'all');return;}
        let hitCount=0;
        document.querySelectorAll('.phase-tasks li').forEach(li=>{
          const text=li.textContent.toLowerCase();
          const show=text.includes(q);
          li.style.display=show?'':'none';
          if(show)hitCount++;
        });
        document.querySelectorAll('.timeline-phase').forEach(el=>{
          const visibleTasks=el.querySelectorAll('.phase-tasks li:not([style*="display: none"])').length;
          el.style.display=visibleTasks>0?'block':'none';
        });
        hitsEl.textContent=hitCount+' task'+(hitCount===1?'':'s')+' matched';
      });
    }
    function computeSprintMetrics() {
      if (!window._currentRoadmap) return;
      const rm = window._currentRoadmap;
      const pk = window._roadmapProjectKey || 'project';
      let totalTasks = 0, doneTasks = 0, totalSeconds = 0;
      rm.phases.forEach(p => {
        if (!Array.isArray(p.tasks)) return;
        p.tasks.forEach((t, idx) => {
          totalTasks++;
          const lsDone = loadTaskState(pk, p.id, idx);
          if (lsDone) { doneTasks++; totalSeconds += loadTaskTime(pk, p.id, idx); }
        });
      });
      const remaining = totalTasks - doneTasks;
      const burnedMinutes = Math.round(totalSeconds / 60);
      // Velocity = tasks per hour (assume avg 5 min per task if no timer data)
      const velocity = totalSeconds > 0 ? Math.round((doneTasks / (totalSeconds / 3600)) * 10) / 10 : (doneTasks > 0 ? Math.round((doneTasks / (doneTasks * 5 / 60)) * 10) / 10 : 0);
      const etaHours = velocity > 0 ? Math.ceil(remaining / velocity) : 0;
      const etaDays = Math.ceil(etaHours / 8);
      return { totalTasks, doneTasks, remaining, burnedMinutes, velocity, etaHours, etaDays };
    }
    function updateSprintTracker() {
      const m = computeSprintMetrics();
      const velEl = document.getElementById('sprintVelocity');
      const burnedEl = document.getElementById('sprintBurned');
      const remEl = document.getElementById('sprintRemaining');
      const remBar = document.getElementById('sprintRemainingBar');
      const etaEl = document.getElementById('sprintEta');
      const etaLabel = document.getElementById('sprintEtaLabel');
      if (velEl) velEl.textContent = m.velocity;
      if (burnedEl) burnedEl.textContent = m.burnedMinutes + 'm';
      if (remEl) remEl.textContent = m.remaining;
      if (remBar) remBar.style.width = (m.totalTasks ? (m.remaining / m.totalTasks * 100) : 0) + '%';
      if (etaEl) {
        if (m.remaining === 0) { etaEl.textContent = 'Done'; etaLabel.textContent = 'all tasks complete'; }
        else if (m.velocity === 0) { etaEl.textContent = '—'; etaLabel.textContent = 'complete a task to estimate'; }
        else { etaEl.textContent = m.etaDays + 'd'; etaLabel.textContent = m.etaHours + ' hours at current velocity'; }
      }
    }

    function wirePhaseInteractions(projectKey){
      document.querySelectorAll('.phase-card').forEach(card=>{
        card.addEventListener('click',e=>{
          if(e.target.closest('.phase-tasks'))return;
          card.classList.toggle('collapsed');
        });
      });
      document.querySelectorAll('.phase-tasks li').forEach(li=>{
        li.addEventListener('click',e=>{
          if(e.target.closest('.task-timer'))return;
          e.stopPropagation();
          const phaseId=li.dataset.phase;
          const taskIdx=parseInt(li.dataset.task,10);
          const isDone=!li.classList.contains('done');
          li.classList.toggle('done',isDone);
          const check=li.querySelector('.task-check');
          if(check)check.classList.toggle('checked',isDone);
          saveTaskState(projectKey,phaseId,taskIdx,isDone);
          const card=li.closest('.phase-card');
          const tasks=card.querySelectorAll('.phase-tasks li');
          const doneCount=card.querySelectorAll('.phase-tasks li.done').length;
          const pct=Math.round((doneCount/tasks.length)*100);
          const fill=card.querySelector('.phase-progress-fill');
          const label=card.querySelector('.phase-progress-label span:last-child');
          if(fill)fill.style.width=pct+'%';
          if(label)label.textContent=pct+'%';
          // Update in-memory roadmap and overall health ring
          updatePhaseState(phaseId);
          updateOverallHealth();
          updateSprintTracker();
          // Completion flash when phase reaches 100%
          if(pct>=95){
            const phaseEl=li.closest('.timeline-phase');
            if(phaseEl){phaseEl.classList.add('phase-complete-flash');setTimeout(()=>phaseEl.classList.remove('phase-complete-flash'),900);}
          }
        });
      });
      document.querySelectorAll('.task-timer').forEach(timer=>{
        timer.addEventListener('click',e=>{
          e.stopPropagation();
          const phaseId=timer.dataset.phase;
          const taskIdx=parseInt(timer.dataset.task,10);
          const isRunning=timer.classList.contains('running');
          if(isRunning){
            timer.classList.remove('running');
            const start=parseInt(timer.dataset.startedAt,10);
            const elapsed=Math.floor((Date.now()-start)/1000);
            const prev=loadTaskTime(projectKey,phaseId,taskIdx);
            saveTaskTime(projectKey,phaseId,taskIdx,prev+elapsed);
            timer.querySelector('.timer-btn').innerHTML='&#9654;';
            const disp=timer.querySelector('.timer-display');
            if(disp)disp.textContent=formatTime(prev+elapsed);
            showToast('Timer stopped — '+formatTime(prev+elapsed)+' total','success');
          }else{
            document.querySelectorAll('.task-timer.running').forEach(t=>{
              const p=t.dataset.phase,idx=parseInt(t.dataset.task,10);
              const s=parseInt(t.dataset.startedAt,10);
              const el=Math.floor((Date.now()-s)/1000);
              const pr=loadTaskTime(projectKey,p,idx);
              saveTaskTime(projectKey,p,idx,pr+el);
              t.classList.remove('running');
              t.querySelector('.timer-btn').innerHTML='&#9654;';
              const disp=t.querySelector('.timer-display');
              if(disp)disp.textContent=formatTime(pr+el);
            });
            timer.classList.add('running');
            timer.dataset.startedAt=String(Date.now());
            timer.querySelector('.timer-btn').innerHTML='&#9632;';
            showToast('Timer started','success');
          }
        });
      });
      document.querySelectorAll('.task-copy').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.stopPropagation();
          const phaseId=btn.dataset.phase;
          const taskIdx=parseInt(btn.dataset.task,10);
          const phase=window._currentRoadmap.phases.find(p=>p.id===phaseId);
          if(!phase)return;
          const t=phase.tasks[taskIdx];
          let clean;
          if(typeof t==='object'&&t!=null&&t.description){
            clean=t.description+(t.location?' ['+t.location+']':'')+(t.codeSnippet?'\n'+t.codeSnippet:'');
          } else {
            const raw=typeof t==='string'?t:(t.html||t.text||'');
            clean=raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
          }
          navigator.clipboard.writeText(clean).then(()=>showToast('Task copied','success')).catch(()=>showToast('Clipboard unavailable','error'));
        });
      });
      document.querySelectorAll('.task-code-copy').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.stopPropagation();
          const code=btn.closest('.task-code-block')?.querySelector('code')?.textContent||'';
          if(!code)return;
          navigator.clipboard.writeText(code).then(()=>showToast('Command copied','success')).catch(()=>showToast('Clipboard unavailable','error'));
        });
      });
      document.querySelectorAll('.task-code-expand').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.stopPropagation();
          const block=btn.closest('.task-code-block');
          if(!block)return;
          const isExpanded=block.classList.toggle('expanded');
          btn.textContent=isExpanded?'−less':'+more';
        });
      });
      document.querySelectorAll('#phaseFilters .filter-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
          document.querySelectorAll('#phaseFilters .filter-btn').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          currentFilter=btn.dataset.filter;
          applyPhaseFilter(currentFilter);
        });
      });
      document.querySelectorAll('.phase-expand-btn').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.stopPropagation();
          const ul=btn.closest('.phase-tasks');
          if(ul) ul.classList.add('expanded');
        });
      });
      document.querySelectorAll('.phase-action-btn').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.stopPropagation();
          const phaseId=btn.dataset.phase;
          const action=btn.dataset.action;
          if(action==='markall'){
            const card=btn.closest('.phase-card');
            const tasks=card.querySelectorAll('.phase-tasks li');
            const allDone=Array.from(tasks).every(li=>li.classList.contains('done'));
            tasks.forEach((li,idx)=>{
              const isDone=!allDone;
              li.classList.toggle('done',isDone);
              const check=li.querySelector('.task-check');
              if(check)check.classList.toggle('checked',isDone);
              saveTaskState(projectKey,phaseId,parseInt(li.dataset.task,10),isDone);
            });
            const doneCount=card.querySelectorAll('.phase-tasks li.done').length;
            const pct=Math.round((doneCount/tasks.length)*100);
            const fill=card.querySelector('.phase-progress-fill');
            const label=card.querySelector('.phase-progress-label span:last-child');
            if(fill)fill.style.width=pct+'%';
            if(label)label.textContent=pct+'%';
            btn.textContent=allDone?'✓ Mark All Done':'↺ Undo All';
            updatePhaseState(phaseId);
            updateOverallHealth();
            updateSprintTracker();
            if(pct>=95){
              const phaseEl=card.closest('.timeline-phase');
              if(phaseEl){phaseEl.classList.add('phase-complete-flash');setTimeout(()=>phaseEl.classList.remove('phase-complete-flash'),900);}
            }
          } else if(action==='collapse'){
            const card=btn.closest('.phase-card');
            card.classList.toggle('collapsed');
          } else if(action==='download-json'){
            exportPhaseJson(phaseId);
          } else if(action==='copy-phase'){
            const phase=window._currentRoadmap.phases.find(p=>p.id===phaseId);
            if(!phase)return;
            const lines=phase.tasks.map((t,idx)=>{
              const done=loadTaskState(projectKey,phaseId,idx);
              let text='';
              if(typeof t==='object'&&t!=null&&t.description){
                text=t.description+(t.location?' ['+t.location+']':'');
              } else {
                const raw=typeof t==='string'?t:(t.html||t.text||'');
                text=raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
              }
              return (done?'[x]':'[ ]')+' '+text;
            });
            const md='## '+phase.title+'\n\n'+lines.join('\n')+'\n';
            navigator.clipboard.writeText(md).then(()=>showToast('Phase copied as markdown','success')).catch(()=>showToast('Clipboard unavailable','error'));
          }
        });
      });
      // Keyboard navigation for task items
      document.querySelectorAll('.phase-tasks li').forEach(li=>{
        li.addEventListener('keydown',e=>{
          const items=Array.from(document.querySelectorAll('.phase-tasks li')).filter(it=>it.offsetParent!==null);
          const idx=items.indexOf(li);
          if(e.key==='ArrowDown'){
            e.preventDefault();
            const next=items[idx+1];if(next){next.focus();next.scrollIntoView({block:'nearest'});}
          } else if(e.key==='ArrowUp'){
            e.preventDefault();
            const prev=items[idx-1];if(prev){prev.focus();prev.scrollIntoView({block:'nearest'});}
          } else if(e.key===' '||e.key==='Enter'){
            e.preventDefault();
            li.click();
          }
        });
      });
    }
    function applyPhaseFilter(filter){
      document.querySelectorAll('.timeline-phase').forEach(el=>{
        const status=el.dataset.status;
        const isBlocked=status==='blocked'||(status==='pending'&&el.querySelector('.badge-critical'));
        let show=false;
        if(filter==='all')show=true;
        else if(filter==='pending')show=status==='pending'||status==='in-progress';
        else if(filter==='completed')show=status==='completed';
        else if(filter==='blocked')show=!!isBlocked;
        el.style.display=show?'block':'none';
      });
    }

    function generatePdf(){
      if(!currentRoadmap){showToast('Load a report first','warning');return;}
      if(typeof html2pdf!=='function'){showToast('PDF library not loaded. Check your connection.','error');return;}
      const rawName=String(currentReport.projectRoot||currentReport.projectPath||currentReport.projectName||'Unknown');
      const baseName=rawName.split(/[\\/]/).pop();
      const pk=baseName.replace(/[^a-zA-Z0-9_-]/g,'_');
      const clone=document.getElementById('app').cloneNode(true);
      clone.style.display='block';
      clone.style.background='#fff';
      clone.style.color='#1f2937';
      clone.style.padding='24px';
      clone.style.maxWidth='100%';
      clone.querySelectorAll('.btn, .filter-bar, #phaseFilters, #taskSearch, .search-hits, .phase-action-btn, .task-timer').forEach(el=>el.style.display='none');
      clone.querySelectorAll('.phase-card').forEach(el=>{el.style.cursor='default';el.classList.remove('collapsed');});
      clone.querySelectorAll('.phase-tasks li').forEach(li=>{li.style.cursor='default';li.onmouseenter=null;li.onmouseleave=null;});
      const wrapper=document.createElement('div');
      wrapper.style.fontFamily="'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
      wrapper.style.background='#fff';
      wrapper.style.color='#1f2937';
      wrapper.style.padding='40px';
      wrapper.style.maxWidth='800px';
      wrapper.style.margin='0 auto';
      const header=document.createElement('div');
      header.style.textAlign='center';
      header.style.marginBottom='32px';
      header.style.borderBottom='2px solid #2563EB';
      header.style.paddingBottom='16px';
      header.innerHTML='<h1 style="font-size:1.6rem;font-weight:700;color:#111827;margin-bottom:4px;">SimpleBeacon Remediation Roadmap</h1>'+
        '<p style="font-size:0.85rem;color:#6b7280;margin:0;">Project: <strong>'+escapeHtml(pk)+'</strong> &middot; Generated '+new Date().toLocaleDateString()+'</p>';
      wrapper.appendChild(header);
      const summary=document.createElement('div');
      summary.style.marginBottom='24px';
      summary.style.padding='16px';
      summary.style.background='#f9fafb';
      summary.style.borderRadius='8px';
      summary.style.border='1px solid #e5e7eb';
      const stats=currentRoadmap.phases;
      const total=stats.length;
      const completed=stats.filter(p=>p.status==='completed').length;
      const blocked=stats.filter(p=>p.status==='blocked').length;
      const inProgress=stats.filter(p=>p.status==='in-progress').length;
      summary.innerHTML='<div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;">'+
        '<div style="text-align:center;"><div style="font-size:1.4rem;font-weight:700;color:#111827;">'+total+'</div><div style="font-size:0.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Phases</div></div>'+
        '<div style="text-align:center;"><div style="font-size:1.4rem;font-weight:700;color:#10b981;">'+completed+'</div><div style="font-size:0.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Completed</div></div>'+
        '<div style="text-align:center;"><div style="font-size:1.4rem;font-weight:700;color:#f59e0b;">'+inProgress+'</div><div style="font-size:0.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">In Progress</div></div>'+
        '<div style="text-align:center;"><div style="font-size:1.4rem;font-weight:700;color:#ef4444;">'+blocked+'</div><div style="font-size:0.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Blocked</div></div>'+
        '</div>';
      wrapper.appendChild(summary);
      // Comprehensive dark-theme to light-theme color remapping
      const darkToLight={
        '#0b0f19':'#fff','#0f1626':'#fff','#111827':'#fff','#1e293b':'#e5e7eb',
        '#f3f4f6':'#1f2937','#e5e7eb':'#1f2937','#d1d5db':'#374151',
        '#9ca3af':'#4b5563','#6b7280':'#4b5563'
      };
      clone.querySelectorAll('*').forEach(el=>{
        const s=window.getComputedStyle(el);
        const c=s.color, bg=s.backgroundColor, bc=s.borderColor;
        const fix=(val, map)=>{if(!val||val==='transparent'||val==='rgba(0, 0, 0, 0)')return;const rgb=val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(rgb){const hex='#'+[1,2,3].map(i=>('0'+parseInt(rgb[i]).toString(16)).slice(-2)).join('');if(map[hex]){el.style.color=map[hex];}}const short=Object.keys(map).find(k=>val.includes(k));if(short)el.style.color=map[short];};
        if(c)fix(c,darkToLight);
        if(bg&&darkToLight[bg])el.style.backgroundColor=darkToLight[bg];
        if(bc&&darkToLight[bc])el.style.borderColor=darkToLight[bc];
      });
      wrapper.appendChild(clone);
      const footer=document.createElement('div');
      footer.style.marginTop='32px';
      footer.style.paddingTop='16px';
      footer.style.borderTop='1px solid #e5e7eb';
      footer.style.textAlign='center';
      footer.style.fontSize='0.75rem';
      footer.style.color='#9ca3af';
      footer.innerHTML='Generated by SimpleBeacon &middot; simplebeacon.dev';
      wrapper.appendChild(footer);
      document.body.appendChild(wrapper);
      const opt={
        margin:[16,16,16,16],
        filename:'roadmap-'+pk+'-'+new Date().toISOString().slice(0,10)+'.pdf',
        image:{type:'png',quality:1.0},
        html2canvas:{scale:1.5,useCORS:true,backgroundColor:'#ffffff',logging:false},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
      };
      html2pdf().set(opt).from(wrapper).save().then(()=>{
        document.body.removeChild(wrapper);
        showToast('PDF downloaded','success');
      }).catch(err=>{
        if(wrapper.parentNode)document.body.removeChild(wrapper);
        console.error('PDF error:',err);
        showToast('PDF generation failed: '+(err&&err.message?err.message:'unknown'),'error');
      });
    }

    // Data is only generated when JSON is explicitly entered via dropzone or paste

    function sanitizeTaskLocation(t){
      const isBuildArtifactPath = (p) => p && (/(^|\/)(node_modules|\.git|dist|build|\.next|out|coverage|frontend-build)\//i.test(p) || /(^|\/)vscode-extension\/out\//i.test(p) || /\.map$/i.test(p));
      if(typeof t==='object'&&t!=null){
        if(isBuildArtifactPath(t.location)||isBuildArtifactPath(t.codeSnippet)) return null;
        if(t.description && /vscode-extension\/out\/extension\.js/.test(t.description)) return null;
      }
      if(typeof t==='string' && /vscode-extension\/out\/extension\.js/.test(t)) return null;
      return t;
    }
    function exportRoadmapJson(){
      if(!currentRoadmap)return;
      // Strip build-artifact tasks from cached phases before export
      currentRoadmap.phases.forEach(p => {
        p.tasks = p.tasks.map(t => sanitizeTaskLocation(t)).filter(Boolean);
      });
      const projectName=currentReport.projectRoot||currentReport.projectPath||currentReport.projectName||currentReport.scanTargetRoot||currentReport.metadata?.project||currentReport.summary?.project||(currentReport.sourceReport&&currentReport.sourceReport.projectRoot)||'Unknown';
      const pk=String(projectName).replace(/[^a-z0-9]/gi,'_');
      function normalizeTask(t,phaseId,idx,phaseStatus){
        const isObj=typeof t==='object'&&t!=null;
        const lsDone=loadTaskState(pk,phaseId,idx);
        const reportDone=isObj&&'done' in t?t.done:false;
        const done=reportDone||lsDone||(phaseStatus==='completed');
        // Prefer structured aiData for clean export descriptions
        if(isObj&&t.aiData){
          const ad=t.aiData;
          const action=ad.action||ad.type||'';
          const file=ad.file||'';
          const line=ad.line||'';
          const snippet=(ad.snippet||ad.currentCode||'').slice(0,80);
          const desc=snippet?`${action}: "${snippet}" in ${file}:${line}`:`${action} in ${file}:${line}`;
          return{
            description:desc,
            type:ad.type||null,
            codeSnippet:snippet||null,
            location:file&&line?`${file}:${line}`:file||null,
            done:!!done,
            isStructured:true
          };
        }
        if(isObj&&t.description){
          let location=t.location||null;
          if(location&&/trello-board-.*\.json|roadmap-.*\.json|github-issues-.*\.md|jira-.*\.csv/i.test(location))location=null;
          return{
            description:t.description,
            type:t.type||null,
            codeSnippet:t.codeSnippet||null,
            location,
            done:!!done,
            isStructured:true
          };
        }
        const raw=typeof t==='string'?t:(t.html||t.text||'');
        const typeMatch=raw.match(/<span class="task-meta">([^<]+)<\/span>/);
        const codeMatch=raw.match(/<code class="task-snippet">([\s\S]*?)<\/code>/);
        const locMatch=raw.match(/<span class="task-loc">([^<]+)<\/span>/);
        const hasHtml=/<[^>]+>/.test(raw);
        let cleanDesc=raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim();
        const type=typeMatch?typeMatch[1].trim():null;
        if(type&&cleanDesc.toLowerCase().startsWith(type.toLowerCase()+' ')){
          cleanDesc=cleanDesc.slice(type.length).trim();
        }
        cleanDesc=cleanDesc.replace(/^AUTO\s+/i,'').replace(/\s*Verify:\s*.+$/i,'').trim();
        let codeSnippet=codeMatch?codeMatch[1].replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim():null;
        let location=locMatch?locMatch[1].trim():null;
        if(location&&/trello-board-.*\.json|roadmap-.*\.json|github-issues-.*\.md|jira-.*\.csv/i.test(location)){
          location=null;
        }
        return{
          description:cleanDesc||raw,
          type,
          codeSnippet,
          location,
          done:!!done,
          isStructured:!!hasHtml
        };
      }
      const phasesWithState=currentRoadmap.phases.map(p=>{
        const tasks=p.tasks.map((t,idx)=>normalizeTask(t,p.id,idx,p.status));
        const doneCount=tasks.filter(t=>t.done).length;
        const todoCount=tasks.length-doneCount;
        // Parse extraHtml into structured impact/fix
        let impact=null,fix=null;
        if(p.extraHtml){
          const imp=p.extraHtml.match(/Impact:\s*([^<]+)/);
          const fx=p.extraHtml.match(/Fix:\s*([^<]+)/);
          if(imp)impact=imp[1].replace(/&amp;&amp;/g,'and').replace(/&amp;/g,'&').trim();
          if(fx)fix=fx[1].replace(/&amp;&amp;/g,'and').replace(/&amp;/g,'&').trim();
        }
        // Resolve human-readable dependsOn title
        let dependsOnTitle=null;
        if(p.dependsOn){
          const dep=currentRoadmap.phases.find(x=>x.id===p.dependsOn);
          if(dep)dependsOnTitle=dep.title;
        }
        const taskPercent=tasks.length?Math.round((doneCount/tasks.length)*100):100;
        const taskStatus=taskPercent>=95?'completed':(taskPercent>0?'in-progress':'pending');
        return{
          id:p.id,
          title:p.title,
          status:taskStatus,
          severity:p.severity,
          effort:p.effort,
          progress:taskPercent,
          description:p.description,
          dependsOn:p.dependsOn||null,
          dependsOnTitle,
          impact,
          fix,
          taskSummary:{total:tasks.length,done:doneCount,todo:todoCount,percent:taskPercent},
          tasks
        };
      });
      const totalTasks=phasesWithState.reduce((a,p)=>a+p.taskSummary.total,0);
      const completedTasks=phasesWithState.reduce((a,p)=>a+p.taskSummary.done,0);
      const sevWeights={critical:4,high:3,medium:2,low:1};
      const statusWeights={completed:1,'in-progress':0.5,pending:0,blocked:0};
      const pendingBonus={critical:0,high:0.1,medium:0.25,low:0.4};
      const maxWeight=phasesWithState.reduce((a,p)=>a+(sevWeights[p.severity]||1),0);
      const earnedWeight=phasesWithState.reduce((a,p)=>{
        const sw=sevWeights[p.severity]||1;
        const base=statusWeights[p.status]||0;
        const bonus=(p.status==='pending'||p.status==='blocked')?(pendingBonus[p.severity]||0):0;
        return a+(base+bonus)*sw;
      },0);
      const healthScore=maxWeight>0?Math.round((earnedWeight/maxWeight)*100):0;
      const summary={
        project:projectName,
        healthScore,
        exportedAt:new Date().toISOString(),
        generatedAt:currentRoadmap.generatedAt,
        sourceReport:currentRoadmap.sourceReport,
        phases:{total:phasesWithState.length,completed:phasesWithState.filter(p=>p.status==='completed').length,blocked:phasesWithState.filter(p=>p.status==='blocked').length,inProgress:phasesWithState.filter(p=>p.status==='in-progress').length,pending:phasesWithState.filter(p=>p.status==='pending').length},
        tasks:{total:totalTasks,completed:completedTasks,remaining:totalTasks-completedTasks},
        criticalPaths:phasesWithState.filter(p=>p.severity==='critical'&&p.status!=='completed').map(p=>({id:p.id,title:p.title,progress:p.progress,tasksRemaining:p.taskSummary.todo}))
      };
      const exportPayload={summary,phases:phasesWithState};
      const blob=new Blob([JSON.stringify(exportPayload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='roadmap-'+pk+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
      showToast('Roadmap JSON exported','success');
    }
    function exportPhaseJson(phaseId){
      if(!currentRoadmap||!currentReport)return;
      // Strip build-artifact tasks from cached phases before export
      currentRoadmap.phases.forEach(p => {
        p.tasks = p.tasks.map(t => sanitizeTaskLocation(t)).filter(Boolean);
      });
      const projectName=currentReport.projectRoot||currentReport.projectPath||currentReport.projectName||currentReport.scanTargetRoot||currentReport.metadata?.project||currentReport.summary?.project||(currentReport.sourceReport&&currentReport.sourceReport.projectRoot)||'Unknown';
      const pk=String(projectName).replace(/[^a-z0-9]/gi,'_');
      const p=currentRoadmap.phases.find(x=>x.id===phaseId);
      if(!p)return;
      function normalizeTask(t,idx,phaseStatus){
        const isObj=typeof t==='object'&&t!=null;
        const lsDone=loadTaskState(pk,phaseId,idx);
        const reportDone=isObj&&'done' in t?t.done:false;
        const done=reportDone||lsDone||(phaseStatus==='completed');
        if(isObj&&t.aiData){
          const ad=t.aiData;
          const action=ad.action||ad.type||'';
          const file=ad.file||'';
          const line=ad.line||'';
          const snippet=(ad.snippet||ad.currentCode||'').slice(0,80);
          const desc=snippet?`${action}: "${snippet}" in ${file}:${line}`:`${action} in ${file}:${line}`;
          return{
            description:desc,
            type:ad.type||null,
            codeSnippet:snippet||null,
            location:file&&line?`${file}:${line}`:file||null,
            done:!!done,
            isStructured:true
          };
        }
        if(isObj&&t.description){
          let location=t.location||null;
          if(location&&/trello-board-.*\.json|roadmap-.*\.json|github-issues-.*\.md|jira-.*\.csv/i.test(location))location=null;
          return{
            description:t.description,
            type:t.type||null,
            codeSnippet:t.codeSnippet||null,
            location,
            done:!!done,
            isStructured:true
          };
        }
        const raw=typeof t==='string'?t:(t.html||t.text||'');
        const typeMatch=raw.match(/<span class="task-meta">([^<]+)<\/span>/);
        const codeMatch=raw.match(/<code class="task-snippet">([\s\S]*?)<\/code>/);
        const locMatch=raw.match(/<span class="task-loc">([^<]+)<\/span>/);
        const hasHtml=/<[^>]+>/.test(raw);
        let cleanDesc=raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim();
        const type=typeMatch?typeMatch[1].trim():null;
        if(type&&cleanDesc.toLowerCase().startsWith(type.toLowerCase()+' ')){
          cleanDesc=cleanDesc.slice(type.length).trim();
        }
        cleanDesc=cleanDesc.replace(/^AUTO\s+/i,'').replace(/\s*Verify:\s*.+$/i,'').trim();
        let codeSnippet=codeMatch?codeMatch[1].replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim():null;
        let location=locMatch?locMatch[1].trim():null;
        if(location&&/trello-board-.*\.json|roadmap-.*\.json|github-issues-.*\.md|jira-.*\.csv/i.test(location)){
          location=null;
        }
        return{
          description:cleanDesc||raw,
          type,
          codeSnippet,
          location,
          done:!!done,
          isStructured:!!hasHtml
        };
      }
      const tasks=p.tasks.map((t,idx)=>normalizeTask(t,idx,p.status));
      const doneCount=tasks.filter(t=>t.done).length;
      let impact=null,fix=null;
      if(p.extraHtml){
        const imp=p.extraHtml.match(/Impact:\s*([^<]+)/);
        const fx=p.extraHtml.match(/Fix:\s*([^<]+)/);
        if(imp)impact=imp[1].replace(/&amp;&amp;/g,'and').replace(/&amp;/g,'&').trim();
        if(fx)fix=fx[1].replace(/&amp;&amp;/g,'and').replace(/&amp;/g,'&').trim();
      }
      let dependsOnTitle=null;
      if(p.dependsOn){
        const dep=currentRoadmap.phases.find(x=>x.id===p.dependsOn);
        if(dep)dependsOnTitle=dep.title;
      }
      const phasePayload={
        project:projectName,
        exportedAt:new Date().toISOString(),
        generatedAt:currentRoadmap.generatedAt,
        phase:{
          id:p.id,
          title:p.title,
          status:p.status,
          severity:p.severity,
          effort:p.effort,
          progress:p.progress,
          description:p.description,
          dependsOn:p.dependsOn||null,
          impact,
          fix,
          taskSummary:{total:tasks.length,done:doneCount,todo:tasks.length-doneCount,percent:tasks.length?Math.round((doneCount/tasks.length)*100):0},
          tasks
        }
      };
      const blob=new Blob([JSON.stringify(phasePayload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='phase-'+p.id+'-'+pk+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
      showToast('Phase JSON exported','success');
    }
    function importPhaseJson(file){
      const reader=new FileReader();
      reader.onload=function(e){
        try{
          const data=JSON.parse(e.target.result);

          // Detect full report format: {metadata, sourceReport, phases[]}
          const phases = Array.isArray(data.phases) ? data.phases : (data.roadmap && Array.isArray(data.roadmap.phases) ? data.roadmap.phases : null);
          if(phases){
            const rawProject = data.sourceReport && (data.sourceReport.projectRoot||data.sourceReport.projectPath||data.sourceReport.projectName) || data.metadata && data.metadata.project || data.summary && data.summary.project || data.roadmap && data.roadmap.summary && data.roadmap.summary.project || data.project || 'unknown';
            let projectName = String(rawProject);
            if(projectName.startsWith('.') && projectName.length < 12){
              const currentProject = currentReport && (currentReport.projectRoot||currentReport.projectPath||currentReport.projectName);
              if(currentProject){
                projectName = String(currentProject);
                showToast('Corrected project name from "'+rawProject+'" to "'+projectName+'"','info');
              }
            }
            const pk=projectName.replace(/[^a-z0-9]/gi,'_');
            let totalImported=0, totalPhases=0;
            phases.forEach(function(phase){
              if(!phase.id||!Array.isArray(phase.tasks)) return;
              phase.tasks.forEach(function(task,idx){
                const done=!!task.done;
                saveTaskState(pk,phase.id,idx,done);
                totalImported++;
              });
              const doneCount=phase.tasks.filter(function(t){return typeof t==='object'&&t!=null?!!t.done:loadTaskState(pk,phase.id,phase.tasks.indexOf(t));}).length;
              phase.progress=phase.tasks.length?Math.round((doneCount/phase.tasks.length)*100):100;
              phase.status=phase.progress>=95?'completed':(phase.progress>0?'in-progress':'pending');
              totalPhases++;
            });
            showToast('Imported '+totalImported+' task states across '+totalPhases+' phases for '+pk,'success');
            if(currentRoadmap&&currentReport){renderDashboard(currentReport,currentRoadmap);showToast('View refreshed','info');}
            return;
          }

          // Single-phase format: {project, phase, tasks}
          if(!data.project||!data.phase||!data.phase.id||!Array.isArray(data.phase.tasks)){
            showToast('Invalid phase JSON: missing project, phase.id, or tasks array','error');
            return;
          }
          let rawProject = String(data.project);
          // Hidden dirs like .husky, .git are subfolders, not project roots — correct them
          if(rawProject.startsWith('.') && rawProject.length < 12){
            const currentProject = currentReport && (currentReport.projectRoot||currentReport.projectPath||currentReport.projectName);
            if(currentProject){
              rawProject = String(currentProject);
              showToast('Corrected project name from "'+data.project+'" to "'+rawProject+'"','info');
            }
          }
          const pk=rawProject.replace(/[^a-z0-9]/gi,'_');
          const phaseId=data.phase.id;
          let imported=0;
          data.phase.tasks.forEach(function(task,idx){
            const done=!!task.done;
            saveTaskState(pk,phaseId,idx,done);
            imported++;
          });
          showToast('Imported '+imported+' task states for phase "'+data.phase.title+'" ('+pk+')','success');
          // Refresh current view if the loaded report matches
          if(currentRoadmap&&currentReport){renderDashboard(currentReport,currentRoadmap);showToast('View refreshed','info');}
        }catch(err){
          showToast('Failed to parse phase JSON: '+err.message,'error');
        }
      };
      reader.readAsText(file);
    }
    function exportAllReportsJson(){
      if(!currentRoadmap||!currentReport)return;
      const projectName=currentReport.projectRoot||currentReport.projectPath||currentReport.projectName||currentReport.scanTargetRoot||currentReport.metadata?.project||currentReport.summary?.project||(currentReport.sourceReport&&currentReport.sourceReport.projectRoot)||'Unknown';
      const pk=String(projectName).replace(/[^a-z0-9]/gi,'_');
      function normalizeTask(t,phaseId,idx,phaseStatus){
        const isObj=typeof t==='object'&&t!=null;
        const lsDone=loadTaskState(pk,phaseId,idx);
        const reportDone=isObj&&'done' in t?t.done:false;
        const done=reportDone||lsDone||(phaseStatus==='completed');
        if(isObj&&t.description){
          return{
            description:t.description,
            type:t.type||null,
            codeSnippet:t.codeSnippet||null,
            location:t.location||null,
            done:!!done,
            isStructured:true
          };
        }
        const raw=typeof t==='string'?t:(t.html||t.text||'');
        const typeMatch=raw.match(/<span class="task-meta">([^<]+)<\/span>/);
        const codeMatch=raw.match(/<code class="task-snippet">([^<]+)<\/code>/);
        const locMatch=raw.match(/<span class="task-loc">([^<]+)<\/span>/);
        const hasHtml=/<[^>]+>/.test(raw);
        const cleanDesc=raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim();
        return{
          description:cleanDesc||raw,
          type:typeMatch?typeMatch[1].trim():null,
          codeSnippet:codeMatch?codeMatch[1].replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&'):null,
          location:locMatch?locMatch[1].trim():null,
          done:!!done,
          isStructured:!!hasHtml
        };
      }
      const phasesWithState=currentRoadmap.phases.map(p=>{
        const tasks=p.tasks.map((t,idx)=>normalizeTask(t,p.id,idx,p.status));
        const doneCount=tasks.filter(t=>t.done).length;
        let impact=null,fix=null;
        if(p.extraHtml){
          const imp=p.extraHtml.match(/Impact:\s*([^<]+)/);
          const fx=p.extraHtml.match(/Fix:\s*([^<]+)/);
          if(imp)impact=imp[1].replace(/&amp;&amp;/g,'and').replace(/&amp;/g,'&').trim();
          if(fx)fix=fx[1].replace(/&amp;&amp;/g,'and').replace(/&amp;/g,'&').trim();
        }
        const taskPercent=tasks.length?Math.round((doneCount/tasks.length)*100):100;
        const taskStatus=taskPercent>=95?'completed':(taskPercent>0?'in-progress':'pending');
        return{
          id:p.id,
          title:p.title,
          status:taskStatus,
          severity:p.severity,
          effort:p.effort,
          progress:taskPercent,
          description:p.description,
          dependsOn:p.dependsOn||null,
          impact,
          fix,
          taskSummary:{total:tasks.length,done:doneCount,todo:tasks.length-doneCount,percent:taskPercent},
          tasks
        };
      });
      const totalTasks=phasesWithState.reduce((a,p)=>a+p.taskSummary.total,0);
      const completedTasks=phasesWithState.reduce((a,p)=>a+p.taskSummary.done,0);
      const sevWeights={critical:4,high:3,medium:2,low:1};
      const statusWeights={completed:1,'in-progress':0.5,pending:0,blocked:0};
      const pendingBonus={critical:0,high:0.1,medium:0.25,low:0.4};
      const maxWeight=phasesWithState.reduce((a,p)=>a+(sevWeights[p.severity]||1),0);
      const earnedWeight=phasesWithState.reduce((a,p)=>{
        const sw=sevWeights[p.severity]||1;
        const base=statusWeights[p.status]||0;
        const bonus=(p.status==='pending'||p.status==='blocked')?(pendingBonus[p.severity]||0):0;
        return a+(base+bonus)*sw;
      },0);
      const healthScore=maxWeight>0?Math.round((earnedWeight/maxWeight)*100):0;
      const allReportsPayload={
        metadata:{
          project:projectName,
          exportedAt:new Date().toISOString(),
          generatedAt:currentRoadmap.generatedAt,
          sourceReport:currentRoadmap.sourceReport,
          reportVersion:2,
          dataTypes:['sourceReport','roadmap','phases','detectedIssues','summary']
        },
        sourceReport:currentReport,
        roadmap:{
          summary:{
            project:projectName,
            healthScore,
            phases:{total:phasesWithState.length,completed:phasesWithState.filter(p=>p.status==='completed').length,blocked:phasesWithState.filter(p=>p.status==='blocked').length,inProgress:phasesWithState.filter(p=>p.status==='in-progress').length,pending:phasesWithState.filter(p=>p.status==='pending').length},
            tasks:{total:totalTasks,completed:completedTasks,remaining:totalTasks-completedTasks},
            criticalPaths:phasesWithState.filter(p=>p.severity==='critical'&&p.status!=='completed').map(p=>({id:p.id,title:p.title,progress:p.progress,tasksRemaining:p.taskSummary.todo}))
          },
          phases:phasesWithState
        },
        detectedIssues:currentReport.detectedIssues||[],
        aiContext:currentReport.aiContext||null
      };
      const blob=new Blob([JSON.stringify(allReportsPayload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='all-reports-'+pk+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
      showToast('All reports exported','success');
    }
    document.getElementById('exportJsonBtn').addEventListener('click',exportRoadmapJson);
    document.getElementById('exportRoadmapJsonBtn').addEventListener('click',exportRoadmapJson);
    document.getElementById('copyReportBtn').addEventListener('click',()=>{if(!currentRoadmap)return;const lines=['# Data Quality Roadmap','Generated '+new Date().toLocaleDateString(),''];const pk=String(currentReport.projectRoot||currentReport.projectPath||currentReport.projectName||'Unknown').replace(/[^a-z0-9]/gi,'_');currentRoadmap.phases.forEach(p=>{const statusIcon=p.status==='completed'?'✅':p.status==='in-progress'?'🟡':'⬜';lines.push(`## ${statusIcon} ${p.title}`);lines.push(`**Severity:** ${p.severity} | **Effort:** ${p.effort} | **Progress:** ${p.progress}%`);lines.push('');lines.push(p.description);lines.push('');lines.push('### Tasks');p.tasks.forEach((t,idx)=>{const done=loadTaskState(pk,p.id,idx);const taskStr=typeof t==='string'?t:(typeof t==='object'&&t!=null&&t.description?t.description:(t.html||t.text||''));lines.push(`- [${done?'x':' '}] ${taskStr}`);});if(p.dependsOn){const dep=currentRoadmap.phases.find(x=>x.id===p.dependsOn);if(dep)lines.push(`\n> ⛓️ Depends on: ${dep.title}`);}lines.push('');});if(!navigator.clipboard){showToast('Clipboard not available — use HTTPS or copy manually','error');return;}navigator.clipboard.writeText(lines.join('\n')).then(()=>showToast('Markdown summary copied','success')).catch(err=>{console.error('Clipboard error:',err);showToast('Clipboard failed — '+err.message,'error');});});
    document.getElementById('copySummaryBtn').addEventListener('click',()=>{if(!currentRoadmap||!currentReport){showToast('Load a report first','warning');return;}const pk=String(currentReport.projectRoot||currentReport.projectPath||currentReport.projectName||'Unknown').replace(/[^a-z0-9]/gi,'_');const total=currentRoadmap.phases.length;const completed=currentRoadmap.phases.filter(p=>p.status==='completed').length;const blocked=currentRoadmap.phases.filter(p=>p.status==='blocked').length;const inProgress=currentRoadmap.phases.filter(p=>p.status==='in-progress').length;const critical=currentRoadmap.phases.filter(p=>p.severity==='critical'&&p.status!=='completed').length;const lines=['SimpleBeacon Scan Summary','Project: '+pk,'Generated: '+new Date().toLocaleDateString(),'','Phases: '+total+' | Completed: '+completed+' | In Progress: '+inProgress+' | Blocked: '+blocked+' | Critical: '+critical,''];currentRoadmap.phases.forEach(p=>{const icon=p.status==='completed'?'✅':p.status==='blocked'?'🚫':p.status==='in-progress'?'🟡':'⬜';lines.push(icon+' '+p.title+' — '+p.status+' ('+p.progress+'%) — '+p.severity);if(p.tasks.length>0){const done=p.tasks.filter((t,idx)=>loadTaskState(pk,p.id,idx)).length;lines.push('   Tasks: '+done+'/'+p.tasks.length+' done');}});lines.push('','Overall Health: '+(currentRoadmap.phases.length?Math.round(currentRoadmap.phases.reduce((a,p)=>a+(p.status==='completed'?1:p.status==='in-progress'?0.5:0),0)/currentRoadmap.phases.length*100):0)+'%');if(!navigator.clipboard){showToast('Clipboard not available — use HTTPS or copy manually','error');return;}navigator.clipboard.writeText(lines.join('\n')).then(()=>showToast('Summary copied to clipboard','success')).catch(err=>{console.error('Clipboard error:',err);showToast('Clipboard failed — '+err.message,'error');});});
    document.getElementById('exportGitHubBtn').addEventListener('click',()=>{if(!currentRoadmap)return;const pk=String(currentReport.projectRoot||currentReport.projectPath||currentReport.projectName||'Unknown').replace(/[^a-z0-9]/gi,'_');let issueCount=0;const files=[];currentRoadmap.phases.forEach(p=>{if(p.status==='completed')return;p.tasks.forEach((t,taskIdx)=>{const done=loadTaskState(pk,p.id,taskIdx);if(done)return;const taskStr=typeof t==='string'?t:(typeof t==='object'&&t!=null&&t.description?t.description:(t.html||t.text||''));if(/^\.\.\.and\s+\d+\s+more/.test(taskStr))return;issueCount++;const shortTask=taskStr.length>80?taskStr.slice(0,77)+'...':taskStr;const title='['+p.title+'] '+shortTask;const bodyParts=['## Context','**Phase:** '+p.title,'**Severity:** '+p.severity,'**Effort:** '+p.effort,'**Progress:** '+p.progress+'%','',p.description];if(p.dependsOn){const depTitle=currentRoadmap.phases.find(x=>x.id===p.dependsOn)?.title||p.dependsOn;bodyParts.push('','> Depends on: '+depTitle);}bodyParts.push('','---','*Generated by SimpleBeacon Roadmap*');const body=bodyParts.join('\n');const safeTitle=title.replace(/"/g,'\\"');const labels='simplebeacon, '+p.severity+(p.dependsOn?', blocked':'');const frontMatter=['---','title: "'+safeTitle+'"','labels: '+labels,'---'].join('\n');const fileName='issue-'+String(issueCount).padStart(3,'0')+'-'+taskStr.replace(/[^a-z0-9]+/gi,'-').slice(0,40)+'.md';files.push({name:fileName,content:frontMatter+'\n\n'+body});});});if(files.length===0){showToast('No pending tasks to export','warning');return;}const zip=new Blob([files.map(f=>'=== '+f.name+' ===\n'+f.content).join('\n\n')],{type:'text/plain'});const url=URL.createObjectURL(zip);const a=document.createElement('a');a.href=url;a.download='github-issues-'+pk+'-'+new Date().toISOString().slice(0,10)+'.md';a.click();URL.revokeObjectURL(url);showToast(issueCount+' GitHub issue(s) exported','success');});
    document.getElementById('exportJiraBtn').addEventListener('click',()=>{if(!currentRoadmap)return;const pk=String(currentReport.projectRoot||currentReport.projectPath||currentReport.projectName||'Unknown').replace(/[^a-z0-9]/gi,'_');const lines=['Issue Type,Summary,Description,Priority,Status,Labels,Linked Issues'];currentRoadmap.phases.forEach(p=>{if(p.status==='completed')return;const jiraPriority=p.severity==='critical'?'Highest':p.severity==='high'?'High':p.severity==='medium'?'Medium':'Low';const jiraStatus=p.status==='blocked'?'Blocked':p.status==='in-progress'?'In Progress':'To Do';p.tasks.forEach((t,taskIdx)=>{const done=loadTaskState(pk,p.id,taskIdx);if(done)return;const taskStr=typeof t==='string'?t:(typeof t==='object'&&t!=null&&t.description?t.description:(t.html||t.text||''));if(/^\.\.\.and\s+\d+\s+more/.test(taskStr))return;const summary='['+p.title+'] '+taskStr;const desc=p.description+(p.dependsOn?' Depends on: '+p.dependsOn:'');const labels='simplebeacon '+p.severity;const linked=p.dependsOn||'';lines.push('Task,"'+summary.replace(/"/g,'""')+'","'+desc.replace(/"/g,'""')+'",'+jiraPriority+','+jiraStatus+','+labels+','+linked);});});if(lines.length===1){showToast('No pending tasks to export','warning');return;}const blob=new Blob([lines.join('\n')],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='jira-'+pk+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);showToast('Jira CSV exported','success');});
    document.getElementById('exportTrelloBtn').addEventListener('click',exportAllReportsJson);
    document.getElementById('newScanBtn').addEventListener('click',()=>{app.style.display='none';emptyState.style.display='block';currentReport=null;currentRoadmap=null;fileInput.value='';dropzone.scrollIntoView({behavior:'smooth'});});
    document.getElementById('exportPdfBtn').addEventListener('click', generatePdf);
    document.getElementById('importPhaseBtn').addEventListener('click',()=>document.getElementById('phaseImportInput').click());
    document.getElementById('phaseImportInput').addEventListener('change',e=>{if(e.target.files[0]){importPhaseJson(e.target.files[0]);e.target.value='';}});
    async function compressSharePayload(jsonStr) {
      try {
        const encoder = new TextEncoder();
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        writer.write(encoder.encode(jsonStr));
        writer.close();
        const reader = stream.readable.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const blob = new Blob(chunks);
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]); }
        return btoa(binary);
      } catch (e) {
        // Fallback to raw base64 if CompressionStream unsupported
        return btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g,(m,p)=>String.fromCharCode('0x'+p)));
      }
    }
    async function decompressSharePayload(b64) {
      try {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const reader = stream.readable.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const blob = new Blob(chunks);
        return await blob.text();
      } catch (e) {
        // Fallback to legacy decompression
        return decodeURIComponent(atob(b64).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      }
    }
    document.getElementById('shareUrlBtn').addEventListener('click',async ()=>{if(!currentReport){showToast('Load a report first','warning');return;}const json=JSON.stringify(currentReport);const compressed=await compressSharePayload(json);const q=new URLSearchParams(location.search);q.set('share','1');const url=location.protocol+'//'+location.host+location.pathname+'?'+q.toString()+'#'+compressed;navigator.clipboard.writeText(url).then(()=>{const saved=Math.round((1-compressed.length/(btoa(json).length))*100);showToast('Share URL copied — '+saved+'% smaller via gzip','success');});});
    (async function(){
      if(location.hash.length<=1)return;
      try{
        const payload=await decompressSharePayload(location.hash.slice(1));
        const report=JSON.parse(payload);
        const src=report.sourceReport||report;
        if(src.qualityScore==null&&src.schemaCompliance==null&&src.consistencyScore==null){history.replaceState(null,'',location.pathname+location.search);showToast('Cleared stale report — re-run scan with updated scanner.','warning');}else{loadReport(report);showToast('Roadmap restored from URL','success');}
      }catch(e){showToast('Invalid share URL','error');}
    })();

