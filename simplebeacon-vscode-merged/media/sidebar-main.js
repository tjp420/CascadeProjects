
(function(){
  window._sidebarMainLoaded = true;
  if (typeof window._displayMode === 'undefined') window._displayMode = 'sidebar';
  if (!window.vscode && typeof acquireVsCodeApi === 'function') { window.vscode = acquireVsCodeApi(); }
  const vscode = window.vscode || null;
  if (vscode) window.vscode = vscode;
  // Report uncaught errors to the extension so they appear in the output channel instead of the hidden webview console
  window.addEventListener('error', function(e) {
    if (vscode) { try { vscode.postMessage({ command: 'sidebarError', message: e.message, file: e.filename, line: e.lineno, col: e.colno, stack: e.error && e.error.stack ? e.error.stack : '' }); } catch(_) {} }
  });
  window.addEventListener('unhandledrejection', function(e) {
    if (vscode) { try { vscode.postMessage({ command: 'sidebarError', message: String(e.reason), file: '', line: 0, col: 0, stack: e.reason && e.reason.stack ? e.reason.stack : '' }); } catch(_) {} }
  });
  // Direct server sign-out fallback: clears the browser session even if the extension message is dropped
  function _callServerSignout() {
    try {
      const base = window.__SB_DATA_SERVER_URL__ || '';
      if (!base) return;
      fetch(base + '/api/auth/signout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(function() {});
    } catch (e) {}
  }
  // Immediate local sign-out: clears the webview's stored tokens and updates the button so the UI responds right away
  function _clearSidebarAuthLocally() {
    try {
      ['cascadeAuthToken','access_token','token','authToken','simplebeacon_token'].forEach(function(k) {
        localStorage.removeItem(k);
      });
      sessionStorage.removeItem('sb_sidebar_auth_ts');
    } catch (e) {}
    try { _updateSidebarAuthState(false); } catch (e) {}
  }
  function _bindViewReportBtn(id, command) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', function() {
      if (window.vscode) window.vscode.postMessage({ command: command });
    });
  }
  // Append a downloaded file entry to the sidebar Downloads list
  function _appendDownloadedFile(name, filePath, time, fullPath) {
    const actionPath = fullPath || filePath || '';
    const displayPath = filePath || (actionPath.startsWith('browser://') ? '' : actionPath);
    const dlList = document.getElementById('dlList');
    if (!dlList) {
      if (vscode) { try { vscode.postMessage({ command: 'sidebarError', message: 'Downloads list (#dlList) missing from sidebar DOM' }); } catch(_) {} }
      return;
    }
    const dlEmpty = dlList.querySelector('.dl-empty');
    if (dlEmpty) { dlEmpty.remove(); }
    const item = document.createElement('div');
    item.className = 'dl-item';
    item.dataset.filePath = actionPath;
    item.dataset.fileName = name || '';
    const dlWrap = document.createElement('div');
    dlWrap.style.overflow = 'hidden';
    const dlName = document.createElement('div');
    dlName.className = 'dl-item-name';
    dlName.textContent = name || 'File';
    const dlPath = document.createElement('div');
    dlPath.className = 'dl-item-path';
    dlPath.textContent = displayPath || name || '';
    dlWrap.appendChild(dlName);
    dlWrap.appendChild(dlPath);
    const dlActs = document.createElement('div');
    dlActs.className = 'dl-actions';
    const dlBtnOpen = document.createElement('button');
    dlBtnOpen.className = 'dl-btn dl-open';
    dlBtnOpen.textContent = 'Open';
    const dlBtnCopy = document.createElement('button');
    dlBtnCopy.className = 'dl-btn dl-copy';
    dlBtnCopy.textContent = 'Copy';
    dlActs.appendChild(dlBtnOpen);
    dlActs.appendChild(dlBtnCopy);
    item.appendChild(dlWrap);
    item.appendChild(dlActs);
    dlList.insertBefore(item, dlList.firstChild);
    dlBtnOpen.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!vscode) return;
      vscode.postMessage({ command: 'openFile', path: actionPath, file: actionPath, name: name || '' });
    });
    dlBtnCopy.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!vscode) return;
      const copyVal = (actionPath && !actionPath.startsWith('browser://')) ? actionPath : (name || '');
      vscode.postMessage({ command: 'copyPath', path: copyVal, name: name || '' });
    });
    // Clicking the row itself asks the extension to load the report back into the dashboard
    item.addEventListener('click', function(e) {
      if (e.target.closest('.dl-btn')) return;
      if (vscode) { vscode.postMessage({ command: 'loadReportFile', path: actionPath, name: name || '' }); }
    });
  }
  // Generic dropdown toggle: works for every .settings-dropdown-header including duplicates
  document.addEventListener('click', function(e) {
    let header = e.target.closest('.settings-dropdown-header, .menu-list-item');
    if (!header) return;
    let body = header.nextElementSibling;
    if (body && body.classList.contains('settings-dropdown-body')) {
      let isOpen = body.classList.contains('open');
      document.querySelectorAll('.settings-dropdown-body.open').forEach(function(b){b.classList.remove('open');});
      document.querySelectorAll('.settings-dropdown-header.open').forEach(function(h){h.classList.remove('open');});
      if (!isOpen) {
        body.classList.add('open');
        header.classList.add('open');
      }
      e.stopPropagation();
    }
  }, true);
  // Safety net: ensure only one sidebar detail panel is open at a time
  let HEADER_TO_MAIN_WINDOW_COMMAND = {
    'scanDropdownHeader': 'openDiagnose',
    'analyzeDropdownHeader': 'analyze',
    'securityDropdownHeader': 'openSecurity',
    'qualityDropdownHeader': 'openQuality',
    'trustDropdownHeader': 'openTrust',
    'assessmentsDropdownHeader': 'openAssessments',
    'certificateDropdownHeader': 'openCertificate',
    'repoHealthDropdownHeader': 'openRepoHealth',
    'analyticsDropdownHeader': 'openAnalytics',
    'platformDropdownHeader': 'openPlatform',
    'profileDropdownHeader': 'openProfile',
    'teamDropdownHeader': 'team',
    'roadmapDropdownHeader': 'openRoadmap',
    'complianceDropdownHeader': 'openCompliance',
    'codeMapDropdownHeader': 'openCodeMap',
    'contextDropdownHeader': 'openContext',
    'uploadDropdownHeader': 'openUpload',
    'auditDropdownHeader': 'openAudit'
  };
  document.addEventListener('click', function(e) {
    let header = e.target.closest('.settings-btn-card, .settings-dropdown-header, .menu-list-item');
    if (!header) return;
    let id = header.id;
    if (!id) return;
    let mainCommand = HEADER_TO_MAIN_WINDOW_COMMAND[id];
    if (window._displayMode === 'mainWindow' && mainCommand && window.vscode) {
      window.vscode.postMessage({command: mainCommand});
      return;
    }
    let detailId = null;
    if (id.indexOf('DropdownHeader') > -1) detailId = id.replace('DropdownHeader', 'DetailPanel');
    if (!detailId) return;
    let detail = document.getElementById(detailId);
    if (!detail) return;
    _closeDetailPanels();
    header.style.display = 'none';
    detail.classList.remove('hidden');
    detail.classList.add('detail-active');
    detail.style.display = 'block';
    document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');});
    document.body.classList.add('detail-panel-open');
  }, true);
  // Website-sync grouped nav items: post data-command directly to the extension
  document.addEventListener('click', function(e) {
    let item = e.target.closest('.sb-nav-item');
    if (!item) return;
    let cmd = item.getAttribute('data-command');
    if (!cmd) return;
    if (window.vscode) { window.vscode.postMessage({ command: cmd }); }
  }, true);
  function _closeDetailPanels(){
    document.body.classList.remove('detail-panel-open');
    document.querySelectorAll('[id$="DetailPanel"]').forEach(function(el){el.style.display='none'; el.classList.remove('detail-active');});
    let analyzeBtn=document.getElementById('analyzeDropdownHeader'); if(analyzeBtn){analyzeBtn.style.display='block';}
    let analyzeDetail=document.getElementById('analyzeDetailPanel'); if(analyzeDetail){analyzeDetail.style.display='none';}
    let auditBtn=document.getElementById('auditDropdownHeader'); if(auditBtn){auditBtn.style.display='block';}
    let auditDetail=document.getElementById('auditDetailPanel'); if(auditDetail){auditDetail.style.display='none';}
    let securityBtn=document.getElementById('securityDropdownHeader'); if(securityBtn){securityBtn.style.display='block';}
    let securityDetail=document.getElementById('securityDetailPanel'); if(securityDetail){securityDetail.style.display='none';}
    let qualityBtn=document.getElementById('qualityDropdownHeader'); if(qualityBtn){qualityBtn.style.display='block';}
    let qualityDetail=document.getElementById('qualityDetailPanel'); if(qualityDetail){qualityDetail.style.display='none';}
    let trustBtn=document.getElementById('trustDropdownHeader'); if(trustBtn){trustBtn.style.display='block';}
    let trustDetail=document.getElementById('trustDetailPanel'); if(trustDetail){trustDetail.style.display='none';}
    let assessmentsBtn=document.getElementById('assessmentsDropdownHeader'); if(assessmentsBtn){assessmentsBtn.style.display='block';}
    let assessmentsDetail=document.getElementById('assessmentsDetailPanel'); if(assessmentsDetail){assessmentsDetail.style.display='none';}
    let scanBtn=document.getElementById('scanDropdownHeader'); if(scanBtn){scanBtn.style.display='block';}
    let scanDetail=document.getElementById('scanDetailPanel'); if(scanDetail){scanDetail.style.display='none';}
    let aiContextBtn=document.getElementById('aiContextDropdownHeader'); if(aiContextBtn){aiContextBtn.style.display='block';}
    let aiContextDetail=document.getElementById('aiContextDetailPanel'); if(aiContextDetail){aiContextDetail.style.display='none';}
    let uploadBtn=document.getElementById('uploadDropdownHeader'); if(uploadBtn){uploadBtn.style.display='block';}
    let uploadDetail=document.getElementById('uploadDetailPanel'); if(uploadDetail){uploadDetail.style.display='none';}
    let repoHealthBtn=document.getElementById('repoHealthDropdownHeader'); if(repoHealthBtn){repoHealthBtn.style.display='block';}
    let repoHealthDetail=document.getElementById('repoHealthDetailPanel'); if(repoHealthDetail){repoHealthDetail.style.display='none';}
    let analyticsBtn=document.getElementById('analyticsDropdownHeader'); if(analyticsBtn){analyticsBtn.style.display='block';}
    let analyticsDetail=document.getElementById('analyticsDetailPanel'); if(analyticsDetail){analyticsDetail.style.display='none';}
    let platformBtn=document.getElementById('platformDropdownHeader'); if(platformBtn){platformBtn.style.display='block';}
    let platformDetail=document.getElementById('platformDetailPanel'); if(platformDetail){platformDetail.style.display='none';}
    let certBtn=document.getElementById('certificateDropdownHeader'); if(certBtn){certBtn.style.display='block';}
    let certDetail=document.getElementById('certificateDetailPanel'); if(certDetail){certDetail.style.display='none';}
    let codeMapBtn=document.getElementById('codeMapDropdownHeader'); if(codeMapBtn){codeMapBtn.style.display='block';}
    let codeMapDetail=document.getElementById('codeMapDetailPanel'); if(codeMapDetail){codeMapDetail.style.display='none';}
    let roadmapBtn=document.getElementById('roadmapDropdownHeader'); if(roadmapBtn){roadmapBtn.style.display='block';}
    let roadmapDetail=document.getElementById('roadmapDetailPanel'); if(roadmapDetail){roadmapDetail.style.display='none';}
    let profileBtn=document.getElementById('profileDropdownHeader'); if(profileBtn){profileBtn.style.display='block';}
    let profileDetail=document.getElementById('profileDetailPanel'); if(profileDetail){profileDetail.style.display='none';}
    let complianceBtn=document.getElementById('complianceDropdownHeader'); if(complianceBtn){complianceBtn.style.display='block';}
    let complianceDetail=document.getElementById('complianceDetailPanel'); if(complianceDetail){complianceDetail.style.display='none';}
    let teamBtn=document.getElementById('teamDropdownHeader'); if(teamBtn){teamBtn.style.display='block';}
    let teamDetail=document.getElementById('teamDetailPanel'); if(teamDetail){teamDetail.style.display='none';}
    let settingsMenu=document.getElementById('settingsMenuTab'); if(settingsMenu){settingsMenu.style.display='block';}
    let settingsDetail=document.getElementById('settingsDetailPanelTab'); if(settingsDetail){settingsDetail.style.display='none';}
    let diagnoseBtn=document.getElementById('openDiagnoseFromSettingsTab'); if(diagnoseBtn){diagnoseBtn.style.display='block';}
    let diagnoseDetail=document.getElementById('diagnoseDetailPanel'); if(diagnoseDetail){diagnoseDetail.style.display='none';}
    let activeTab=document.body.getAttribute('data-active-tab') || 'dashboard';
    let activePane=document.getElementById('tab'+activeTab.charAt(0).toUpperCase()+activeTab.slice(1));
    if(activePane){activePane.classList.add('active');activePane.classList.remove('hidden');}
    let dashboardPane=document.getElementById('tabDashboard'); if(dashboardPane && activeTab !== 'dashboard'){dashboardPane.classList.remove('active');dashboardPane.classList.add('hidden');}
  }
  function _openSidebarMenu(containerId, detailPanelId, mainWindowCommand){
    if (mainWindowCommand && window._displayMode === 'mainWindow' && window.vscode) {
      window.vscode.postMessage({command: mainWindowCommand});
      return;
    }
    _closeDetailPanels();
    if(containerId){let container=document.getElementById(containerId); if(container){container.style.display='none';}}
    let detail=document.getElementById(detailPanelId);
    if(detail){detail.classList.remove('hidden'); detail.classList.add('detail-active'); detail.style.display='block';}
    document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');});
    document.body.classList.add('detail-panel-open');
  }
  // Sidebar tab switching
  function _switchSidebarTab(tab) {
    _closeDetailPanels();
    document.querySelectorAll('#sidebarTabBar .sidebar-tab-item').forEach(function(t){t.classList.toggle('active', t.getAttribute('data-tab') === tab);});
    document.querySelectorAll('#mainTabBar .tab-item').forEach(function(t){t.classList.toggle('active', t.getAttribute('data-tab') === tab);});
    document.querySelectorAll('[data-sidebar-tab]').forEach(function(el){let match=el.getAttribute('data-sidebar-tab')===tab; if(match){el.classList.remove('hidden');} else {el.classList.add('hidden');} });
    document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');});
    let pane=document.getElementById('tab'+tab.charAt(0).toUpperCase()+tab.slice(1)); if(pane){ pane.classList.add('active'); pane.classList.remove('hidden'); }
    document.body.setAttribute('data-active-tab', tab);
    let td=document.getElementById('tabDashboard'); if(td){ if(tab==='dashboard'){ td.classList.add('active'); td.classList.remove('hidden'); } else { td.classList.remove('active'); td.classList.add('hidden'); } }
    if (tab === 'settings') {
      let setHeader=document.getElementById('settingsDropdownHeader'); if(setHeader){setHeader.classList.add('hidden');}
      let setBody=document.getElementById('settingsDropdownBody'); if(setBody){setBody.classList.add('hidden');}
    }
    _hideDiagnoseResults();
    document.querySelectorAll('[id$="DetailPanel"]').forEach(function(el){el.classList.add('hidden');el.style.display='none';el.classList.remove('detail-active');});
    let settingsDetailPanelTabEl=document.getElementById('settingsDetailPanelTab'); if(settingsDetailPanelTabEl){settingsDetailPanelTabEl.classList.add('hidden');settingsDetailPanelTabEl.style.display='none';settingsDetailPanelTabEl.classList.remove('detail-active');}
    let settingsMenuTabEl=document.getElementById('settingsMenuTab'); if(settingsMenuTabEl && tab!=='settings'){settingsMenuTabEl.classList.add('hidden');}
    if(tab==='settings'){let sm=document.getElementById('settingsMenuTab'); if(sm){sm.classList.remove('hidden');sm.style.display='block';}}
  }
  document.querySelectorAll('#sidebarTabBar .sidebar-tab-item').forEach(function(t){t.addEventListener('click', function(){_switchSidebarTab(t.getAttribute('data-tab'));});});
  let _statusCard=document.getElementById('statusCard');if(_statusCard){_statusCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'diagnose'}); });}
  let _serverCard=document.getElementById('serverCard');if(_serverCard){_serverCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCloudInBrowser'}); });}
  let _analyzeDropdownHeader=document.getElementById('analyzeDropdownHeader');if(_analyzeDropdownHeader){_analyzeDropdownHeader.addEventListener('click', function() { const header=document.getElementById('analyzeDropdownHeader'); const detail=document.getElementById('analyzeDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); });}
  let _analyzeDetailBackBtn=document.getElementById('analyzeDetailBackBtn');if(_analyzeDetailBackBtn){_analyzeDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _runAnalysisBtn=document.getElementById('runAnalysisBtn');if(_runAnalysisBtn){_runAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'scan', mode: 'workspace'}); });}
  let _openAnalyzeInMainWindowBtn=document.getElementById('openAnalyzeInMainWindowBtn');if(_openAnalyzeInMainWindowBtn){_openAnalyzeInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAnalyze'}); });}
  let _scanWorkspaceBtn=document.getElementById('scanWorkspaceBtn');if(_scanWorkspaceBtn){_scanWorkspaceBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openEnhancedAnalysis'}); });}
  let _exportJsonBtn=document.getElementById('exportJsonBtn');if(_exportJsonBtn){_exportJsonBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _sidebarAnalyzeBrowseBtn=document.getElementById('sidebarAnalyzeBrowseBtn');if(_sidebarAnalyzeBrowseBtn){_sidebarAnalyzeBrowseBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'browseSidebarScanPath'}); });}
  let _sidebarAnalyzeDetectBtn=document.getElementById('sidebarAnalyzeDetectBtn');if(_sidebarAnalyzeDetectBtn){_sidebarAnalyzeDetectBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'detectSidebarScanPath'}); });}
  let _sidebarAnalyzePathInput=document.getElementById('sidebarAnalyzePathInput');if(_sidebarAnalyzePathInput){_sidebarAnalyzePathInput.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateSidebarScanPath', path: this.value}); });}
  let _enhancedAnalysisBtn=document.getElementById('enhancedAnalysisBtn');if(_enhancedAnalysisBtn){_enhancedAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openEnhancedAnalysis'}); });}
  let _realtimeAnalysisBtn=document.getElementById('realtimeAnalysisBtn');if(_realtimeAnalysisBtn){_realtimeAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRealtimeAnalysis'}); });}
  let _patternDetectionBtn=document.getElementById('patternDetectionBtn');if(_patternDetectionBtn){_patternDetectionBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPatternDetection'}); });}
  let _modelHealthBtn=document.getElementById('modelHealthBtn');if(_modelHealthBtn){_modelHealthBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openModelHealth'}); });}
  let _toggleMonitorBtn=document.getElementById('toggleMonitorBtn');if(_toggleMonitorBtn){_toggleMonitorBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openToggleMonitor'}); });}
  let _openDashboardBtn=document.getElementById('openDashboardBtn');if(_openDashboardBtn){_openDashboardBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openDashboard'}); });}
  let _openReportBtn=document.getElementById('openReportBtn');if(_openReportBtn){_openReportBtn.addEventListener('click', function() { _switchSidebarTab('report'); });}
  let _openCertificateBtn=document.getElementById('openCertificateBtn');if(_openCertificateBtn){_openCertificateBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCertificate'}); });}
  let _openCodeMapBtn=document.getElementById('openCodeMapBtn');if(_openCodeMapBtn){_openCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  let _openRoadmapBtn=document.getElementById('openRoadmapBtn');if(_openRoadmapBtn){_openRoadmapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRoadmap'}); });}
  let _openContextBtn=document.getElementById('openContextBtn');if(_openContextBtn){_openContextBtn.addEventListener('click', function() { _switchSidebarTab('context'); });}
  let _openUploadBtn=document.getElementById('openUploadBtn');if(_openUploadBtn){_openUploadBtn.addEventListener('click', function() { _switchSidebarTab('upload'); });}
  let _openPlatformBtnMain=document.getElementById('openPlatformBtnMain');if(_openPlatformBtnMain){_openPlatformBtnMain.addEventListener('click', function() { _switchSidebarTab('platform'); });}
  let _openAuditBtnMain=document.getElementById('openAuditBtnMain');if(_openAuditBtnMain){_openAuditBtnMain.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAudit'}); });}
  let _openTeamBtnMain=document.getElementById('openTeamBtnMain');if(_openTeamBtnMain){_openTeamBtnMain.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTeam'}); });}
  let _openSecurityBtnMain=document.getElementById('openSecurityBtnMain');if(_openSecurityBtnMain){_openSecurityBtnMain.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSecurity'}); });}
  let _openTrustBtn=document.getElementById('openTrustBtn');if(_openTrustBtn){_openTrustBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  let _openQualityBtn=document.getElementById('openQualityBtn');if(_openQualityBtn){_openQualityBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openQuality'}); });}
  let _openAssessmentsBtn=document.getElementById('openAssessmentsBtn');if(_openAssessmentsBtn){_openAssessmentsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  let _openPlatformBtn=document.getElementById('openPlatformBtn');if(_openPlatformBtn){_openPlatformBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  let _openProfileBtn=document.getElementById('openProfileBtn');if(_openProfileBtn){_openProfileBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  let _openProfileInMainWindowBtn=document.getElementById('openProfileInMainWindowBtn');if(_openProfileInMainWindowBtn){_openProfileInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  let _openComplianceBtn=document.getElementById('openComplianceBtn');if(_openComplianceBtn){_openComplianceBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  let _openRepoHealthBtn=document.getElementById('openRepoHealthBtn');if(_openRepoHealthBtn){_openRepoHealthBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  let _openRepoHealthInMainWindowBtn=document.getElementById('openRepoHealthInMainWindowBtn');if(_openRepoHealthInMainWindowBtn){_openRepoHealthInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  let _openAnalyticsBtn=document.getElementById('openAnalyticsBtn');if(_openAnalyticsBtn){_openAnalyticsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAnalytics'}); });}
  let _openAnalyticsInMainWindowBtn=document.getElementById('openAnalyticsInMainWindowBtn');if(_openAnalyticsInMainWindowBtn){_openAnalyticsInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAnalytics'}); });}
  let _openScanBtn=document.getElementById('openScanBtn');if(_openScanBtn){_openScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openScan'}); });}
  let _reportNewScanBtn=document.getElementById('reportNewScanBtn');if(_reportNewScanBtn){_reportNewScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'scan', mode: 'workspace'}); });}
  let _reportTopBackBtn=document.getElementById('reportTopBackBtn');if(_reportTopBackBtn){_reportTopBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _openReportInMainWindowBtn=document.getElementById('openReportInMainWindowBtn');if(_openReportInMainWindowBtn){_openReportInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openReportHtml'}); });}
  let _reportViewFullBtn=document.getElementById('reportViewFullBtn');if(_reportViewFullBtn){_reportViewFullBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openReport'}); });}
  let _reportExportJsonBtn=document.getElementById('reportExportJsonBtn');if(_reportExportJsonBtn){_reportExportJsonBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _roadmapBackBtn=document.getElementById('roadmapBackBtn');if(_roadmapBackBtn){_roadmapBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _openRoadmapInMainWindowBtn=document.getElementById('openRoadmapInMainWindowBtn');if(_openRoadmapInMainWindowBtn){_openRoadmapInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRoadmap'}); });}
  let _openRoadmapBtn2=document.getElementById('openRoadmapBtn2');if(_openRoadmapBtn2){_openRoadmapBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRoadmapHtml'}); });}
  let _openRoadmapInMainWindowBtn2=document.getElementById('openRoadmapInMainWindowBtn2');if(_openRoadmapInMainWindowBtn2){_openRoadmapInMainWindowBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRoadmap'}); });}
  let _contextBackBtn=document.getElementById('contextBackBtn');if(_contextBackBtn){_contextBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _openContextInMainWindowBtn=document.getElementById('openContextInMainWindowBtn');if(_openContextInMainWindowBtn){_openContextInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openContext'}); });}
  let _openAiContextInMainWindowBtn=document.getElementById('openAiContextInMainWindowBtn');if(_openAiContextInMainWindowBtn){_openAiContextInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAiContext'}); });}
  let _openAiContextInMainWindowBtn2=document.getElementById('openAiContextInMainWindowBtn2');if(_openAiContextInMainWindowBtn2){_openAiContextInMainWindowBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAiContext'}); });}
  let _openUploadTabInMainWindowBtn=document.getElementById('openUploadTabInMainWindowBtn');if(_openUploadTabInMainWindowBtn){_openUploadTabInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openUpload'}); });}
  let _openCodeMapTabInMainWindowBtn=document.getElementById('openCodeMapTabInMainWindowBtn');if(_openCodeMapTabInMainWindowBtn){_openCodeMapTabInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  let _openComplianceTabInMainWindowBtn=document.getElementById('openComplianceTabInMainWindowBtn');if(_openComplianceTabInMainWindowBtn){_openComplianceTabInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  let _openAuditTabInMainWindowBtn=document.getElementById('openAuditTabInMainWindowBtn');if(_openAuditTabInMainWindowBtn){_openAuditTabInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAudit'}); });}
  let _openTrustTabInMainWindowBtn=document.getElementById('openTrustTabInMainWindowBtn');if(_openTrustTabInMainWindowBtn){_openTrustTabInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  let _openAssessmentsTabInMainWindowBtn=document.getElementById('openAssessmentsTabInMainWindowBtn');if(_openAssessmentsTabInMainWindowBtn){_openAssessmentsTabInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  let _openPlatformTabInMainWindowBtn=document.getElementById('openPlatformTabInMainWindowBtn');if(_openPlatformTabInMainWindowBtn){_openPlatformTabInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  let _openPreviewBtn=document.getElementById('openPreviewBtn');if(_openPreviewBtn){_openPreviewBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreview'}); });}
  let _scanStartBtn=document.getElementById('scanStartBtn');if(_scanStartBtn){_scanStartBtn.addEventListener('click', function() { let toggle=document.getElementById('sidebarScanWorkspaceToggle'); let pathInput=document.getElementById('sidebarScanPathInput'); let isWorkspace=toggle?toggle.checked:true; let path=pathInput?pathInput.value:''; if (window.vscode) window.vscode.postMessage({command: 'scan', mode: isWorkspace?'workspace':'custom', path: isWorkspace?'':path}); });}
  let _openToggleMonitorBtn=document.getElementById('openToggleMonitorBtn');if(_openToggleMonitorBtn){_openToggleMonitorBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openToggleMonitor'}); });}
  let _openEnhancedAnalysisBtn=document.getElementById('openEnhancedAnalysisBtn');if(_openEnhancedAnalysisBtn){_openEnhancedAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openEnhancedAnalysis'}); });}
  let _openRealtimeAnalysisBtn=document.getElementById('openRealtimeAnalysisBtn');if(_openRealtimeAnalysisBtn){_openRealtimeAnalysisBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRealtimeAnalysis'}); });}
  let _openPatternDetectionBtn=document.getElementById('openPatternDetectionBtn');if(_openPatternDetectionBtn){_openPatternDetectionBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPatternDetection'}); });}
  let _openModelHealthBtn=document.getElementById('openModelHealthBtn');if(_openModelHealthBtn){_openModelHealthBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openModelHealth'}); });}
  let _openTeamDashboardBtnMain=document.getElementById('openTeamDashboardBtnMain');if(_openTeamDashboardBtnMain){_openTeamDashboardBtnMain.addEventListener('click', function() { if(window.vscode) window.vscode.postMessage({command:'openTeamDashboard'}); });}
  function _tdBind(id,cmd){let el=document.getElementById(id);if(el){el.addEventListener('click',function(){if(cmd==='openSigninScreen'||cmd==='signIn'){_openSigninWithClear();return;}if(window.vscode)window.vscode.postMessage({command:cmd});});}}
  function _tdBindUrl(id,cmd,url){let el=document.getElementById(id);if(el){el.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:cmd,url:url});});}}
  _tdBindUrl('tdRoadmapSidebar','openRoadmapUrl','https://simplebeacon.ai/roadmap');
  _tdBindUrl('tdAuditSidebar','openAuditUrl','https://simplebeacon.ai/audit');
  _tdBindUrl('tdPricingSidebar','openPricingUrl','https://simplebeacon.ai/pricing');
  _tdBind('tdSignInSidebar','signIn');
  _tdBind('tdDashboardSidebar','navDashboard');
  _tdBind('tdAnalyzeSidebar','navAnalyze');
  _tdBind('tdResultsSidebar','navResults');
  _tdBind('tdRepoHealthSidebar','navRepoHealth');
  _tdBind('tdSecuritySidebar','navSecurity');
  _tdBind('tdQualitySidebar','navQuality');
  _tdBind('tdTrustSidebar','navTrust');
  _tdBind('tdAuditReportSidebar','navAudit');
  _tdBind('tdAssessmentsSidebar','navAssessments');
  _tdBind('tdRemediationSidebar','navRoadmap');
  _tdBind('tdPlatformSidebar','navPlatform');
  _tdBind('tdProfileSidebar','navProfile');
  _tdBind('tdToolsSidebar','navTools');
  _tdBind('tdSettingsSidebar','navSettings');
  _tdBind('tdHelpSidebar','navHelp');
  _tdBind('tdChatbotSidebar','navChatbot');
  _tdBind('tdAboutSidebar','navAbout');
  _tdBind('tdGitHubSidebar','openGitHub');
  _tdBind('tdDocsSidebar','openDocs');
  // Analyze, Roadmap, and AI Context buttons already send open* commands above; do not switch sidebar tabs.
  let _openSettingsBtn=document.getElementById('openSettingsBtn');if(_openSettingsBtn){_openSettingsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  let _uploadDropzone=document.getElementById('uploadDropzone');let _uploadFileInput=document.getElementById('uploadFileInput');let _uploadList=document.getElementById('uploadList');let _uploadStatPending=document.getElementById('uploadStatPending');let _uploadStatValid=document.getElementById('uploadStatValid');let _uploadStatInvalid=document.getElementById('uploadStatInvalid');let _uploadValidateBtn=document.getElementById('uploadValidateBtn');let _uploadClearBtn=document.getElementById('uploadClearBtn');let _uploadProgress=document.getElementById('uploadProgress');let _uploadProgressFill=document.getElementById('uploadProgressFill');let _uploadProgressText=document.getElementById('uploadProgressText');let _uploadDetail=document.getElementById('uploadDetail');let _uploadDetailList=document.getElementById('uploadDetailList');let _uploadResultBox=document.getElementById('uploadResultBox');let _uploadResultTitle=document.getElementById('uploadResultTitle');let _uploadResultList=document.getElementById('uploadResultList');
  let _uploadFiles=[];
  let _uploadBase64={};
  function _uploadFormatSize(b){if(b<1024)return b+' B';if(b<1024*1024)return (b/1024).toFixed(1)+' KB';return (b/(1024*1024)).toFixed(1)+' MB';}
  function _uploadAllowedExt(name){let ext=(name.split('.').pop()||'').toLowerCase();return ['zip','js','ts','json','md','txt','csv','xml','html','css','yml','yaml'].indexOf(ext)>=0;}
  function _uploadFileDetail(f){let details=[];if(!_uploadAllowedExt(f.name)){details.push({ok:false,text:'Unsupported file extension'});}else{details.push({ok:true,text:'Supported file type'});}if(f.size>50*1024*1024){details.push({ok:false,text:'File exceeds 50 MB limit'});}else if(f.size>5*1024*1024){details.push({ok:false,text:'Large file (>5 MB), may be slow'});}else{details.push({ok:true,text:'Size OK'});}return details;}
  function _uploadRender(){if(!_uploadList)return;while(_uploadList.firstChild){_uploadList.removeChild(_uploadList.firstChild);}if(_uploadFiles.length===0){let empty=document.createElement('div');empty.className='upload-empty';empty.textContent='No files selected. Drop files above or click to browse.';_uploadList.appendChild(empty);}else{_uploadFiles.forEach(function(f,index){let iconClass=f.status==='invalid'?'err':f.status==='valid'?'':'warn';let statusClass=f.status==='valid'?'valid':f.status==='invalid'?'invalid':'ready';let statusText=f.status==='valid'?'Valid':f.status==='invalid'?'Invalid':'Ready';let item=document.createElement('div');item.className='upload-item';let icon=document.createElement('div');icon.className='upload-item-icon '+iconClass;icon.textContent='📄';let text=document.createElement('div');text.className='upload-item-text';let name=document.createElement('div');name.className='upload-item-name';name.textContent=f.name;let meta=document.createElement('div');meta.className='upload-item-meta';meta.textContent=_uploadFormatSize(f.size);text.appendChild(name);text.appendChild(meta);let actions=document.createElement('div');actions.className='upload-item-actions';let statusBadge=document.createElement('div');statusBadge.className='upload-item-status '+statusClass;statusBadge.textContent=statusText;actions.appendChild(statusBadge);let removeBtn=document.createElement('button');removeBtn.className='upload-item-action';removeBtn.textContent='✕';removeBtn.title='Remove';removeBtn.addEventListener('click',function(e){e.stopPropagation();_uploadFiles.splice(index,1);delete _uploadBase64[f.name];_uploadRender();});actions.appendChild(removeBtn);item.appendChild(icon);item.appendChild(text);item.appendChild(actions);_uploadList.appendChild(item);});}let v=_uploadFiles.filter(function(f){return f.status==='valid';}).length;let iv=_uploadFiles.filter(function(f){return f.status==='invalid';}).length;let p=_uploadFiles.length-v-iv;if(_uploadStatPending)_uploadStatPending.textContent=p;if(_uploadStatValid)_uploadStatValid.textContent=v;if(_uploadStatInvalid)_uploadStatInvalid.textContent=iv;}
  function _uploadSetProgress(pct,text){if(!_uploadProgress||!_uploadProgressFill||!_uploadProgressText)return;_uploadProgress.style.display='block';_uploadProgressFill.style.width=pct+'%';_uploadProgressText.textContent=text||pct+'%';}
  function _uploadHideProgress(){if(_uploadProgress)_uploadProgress.style.display='none';}
  function _uploadShowDetails(){if(!_uploadDetail||!_uploadDetailList)return;_uploadDetail.style.display='block';while(_uploadDetailList.firstChild){_uploadDetailList.removeChild(_uploadDetailList.firstChild);}_uploadFiles.forEach(function(f){let details=_uploadFileDetail(f);let fileRow=document.createElement('div');fileRow.style.marginBottom='8px';let fileName=document.createElement('div');fileName.style.fontWeight='600';fileName.style.marginBottom='2px';fileName.textContent=f.name;fileRow.appendChild(fileName);details.forEach(function(d){let row=document.createElement('div');row.className='upload-detail-item '+(d.ok?'ok':'err');row.textContent=(d.ok?'✓ ':'✗ ')+d.text;fileRow.appendChild(row);});_uploadDetailList.appendChild(fileRow);});}
  function _uploadShowResult(){if(!_uploadResultBox||!_uploadResultTitle||!_uploadResultList)return;let validCount=_uploadFiles.filter(function(f){return f.status==='valid';}).length;let invalidCount=_uploadFiles.filter(function(f){return f.status==='invalid';}).length;_uploadResultBox.style.display='block';if(invalidCount===0){_uploadResultTitle.className='upload-result-title ok';_uploadResultTitle.textContent='✓ All files passed validation';}else{_uploadResultTitle.className='upload-result-title err';_uploadResultTitle.textContent='✗ '+invalidCount+' file'+(invalidCount===1?'':'s')+' failed validation';}let list=[];if(validCount>0)list.push(validCount+' ready for upload');if(invalidCount>0)list.push(invalidCount+' need fixing');_uploadResultList.textContent=list.join(' • ')||'No files selected';}
  function _uploadReadFile(file){return new Promise(function(resolve){let reader=new FileReader();reader.onload=function(e){resolve({name:file.name,size:file.size,data:e.target.result.split(',')[1]});};reader.readAsDataURL(file);});}
  function _uploadValidateAll(){if(_uploadFiles.length===0){_uploadShowResult();return;}_uploadFiles.forEach(function(f){f.status=_uploadAllowedExt(f.name)?'valid':'invalid';});_uploadRender();_uploadShowDetails();_uploadShowResult();let validFiles=_uploadFiles.filter(function(f){return f.status==='valid';});if(validFiles.length===0){return;}_uploadSetProgress(0,'Reading files...');let done=0;let payloads=[];function onDone(){done++;let pct=Math.round((done/validFiles.length)*50);_uploadSetProgress(pct,'Reading files...');if(done===validFiles.length){_uploadSetProgress(75,'Sending to extension...');if(window.vscode)window.vscode.postMessage({command:'validateUpload',files:payloads});_uploadSetProgress(100,'Done');setTimeout(_uploadHideProgress,800);}}validFiles.forEach(function(f){_uploadReadFile(f).then(function(payload){payloads.push(payload);_uploadBase64[f.name]=payload.data;onDone();});});}
  function _uploadAddFiles(fileList){if(!fileList)return;for(let i=0;i<fileList.length;i++){let file=fileList[i];_uploadFiles.push({name:file.name,size:file.size,status:'ready'});}_uploadRender();}
  if(_uploadDropzone&&_uploadFileInput){_uploadDropzone.addEventListener('click',function(){_uploadFileInput.click();});_uploadDropzone.addEventListener('dragover',function(e){e.preventDefault();_uploadDropzone.classList.add('dragover');});_uploadDropzone.addEventListener('dragleave',function(e){e.preventDefault();_uploadDropzone.classList.remove('dragover');});_uploadDropzone.addEventListener('drop',function(e){e.preventDefault();_uploadDropzone.classList.remove('dragover');_uploadAddFiles(e.dataTransfer.files);});_uploadFileInput.addEventListener('change',function(){_uploadAddFiles(_uploadFileInput.files);_uploadFileInput.value='';});}
  if(_uploadValidateBtn){_uploadValidateBtn.addEventListener('click',function(){_uploadValidateAll();});}
  if(_uploadClearBtn){_uploadClearBtn.addEventListener('click',function(){_uploadFiles=[];_uploadBase64={};_uploadRender();if(_uploadDetail)_uploadDetail.style.display='none';if(_uploadResultBox)_uploadResultBox.style.display='none';_uploadHideProgress();});}
  _uploadRender();
  let _tabAuditRunBtn=document.getElementById('tabAuditRunBtn');if(_tabAuditRunBtn){_tabAuditRunBtn.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'runAudit'});});}
  let _tabAuditExportBtn=document.getElementById('tabAuditExportBtn');if(_tabAuditExportBtn){_tabAuditExportBtn.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'exportReport'});});}
  let _tabAuditViewBtn=document.getElementById('tabAuditViewBtn');if(_tabAuditViewBtn){_tabAuditViewBtn.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'openAudit'});});}
  let _tabAuditSettingsBtn=document.getElementById('tabAuditSettingsBtn');if(_tabAuditSettingsBtn){_tabAuditSettingsBtn.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'settings'});});}
  let _tabUploadDropzone=document.getElementById('tabUploadDropzone');let _tabUploadFileInput=document.getElementById('tabUploadFileInput');let _tabUploadFiles=[];
  function _tabUploadFormatSize(b){if(b<1024)return b+' B';if(b<1024*1024)return (b/1024).toFixed(1)+' KB';return (b/(1024*1024)).toFixed(1)+' MB';}
  function _tabUploadRender(){let list=document.getElementById('tabUploadFileList');if(!list)return;while(list.firstChild){list.removeChild(list.firstChild);}if(_tabUploadFiles.length===0){let empty=document.createElement('div');empty.className='upload-empty';empty.textContent='No files selected. Drop files above or click to browse.';list.appendChild(empty);}else{_tabUploadFiles.forEach(function(f,index){let item=document.createElement('div');item.className='upload-item';let icon=document.createElement('div');icon.className='upload-item-icon';icon.textContent='📄';let text=document.createElement('div');text.className='upload-item-text';let name=document.createElement('div');name.className='upload-item-name';name.textContent=f.name;let meta=document.createElement('div');meta.className='upload-item-meta';meta.textContent=_tabUploadFormatSize(f.size);text.appendChild(name);text.appendChild(meta);let actions=document.createElement('div');actions.className='upload-item-actions';let removeBtn=document.createElement('button');removeBtn.className='upload-item-action';removeBtn.textContent='✕';removeBtn.title='Remove';removeBtn.addEventListener('click',function(e){e.stopPropagation();_tabUploadFiles.splice(index,1);_tabUploadRender();});actions.appendChild(removeBtn);item.appendChild(icon);item.appendChild(text);item.appendChild(actions);list.appendChild(item);});}let total=document.getElementById('tabUploadTotal');if(total)total.textContent=_tabUploadFiles.length;let valid=document.getElementById('tabUploadValid');let err=document.getElementById('tabUploadErrors');if(valid&&err){let v=_tabUploadFiles.filter(function(f){return f.status==='valid';}).length;let iv=_tabUploadFiles.filter(function(f){return f.status==='invalid';}).length;valid.textContent=v;err.textContent=iv;}}
  function _tabUploadAddFiles(fileList){if(!fileList)return;for(let i=0;i<fileList.length;i++){let file=fileList[i];_tabUploadFiles.push({name:file.name,size:file.size,status:'ready'});}_tabUploadRender();}
  if(_tabUploadDropzone&&_tabUploadFileInput){_tabUploadDropzone.addEventListener('click',function(){_tabUploadFileInput.click();});_tabUploadDropzone.addEventListener('dragover',function(e){e.preventDefault();_tabUploadDropzone.classList.add('dragover');});_tabUploadDropzone.addEventListener('dragleave',function(e){e.preventDefault();_tabUploadDropzone.classList.remove('dragover');});_tabUploadDropzone.addEventListener('drop',function(e){e.preventDefault();_tabUploadDropzone.classList.remove('dragover');_tabUploadAddFiles(e.dataTransfer.files);});_tabUploadFileInput.addEventListener('change',function(){_tabUploadAddFiles(_tabUploadFileInput.files);_tabUploadFileInput.value='';});}
  let _tabUploadValidateBtn=document.getElementById('tabUploadValidateBtn');if(_tabUploadValidateBtn){_tabUploadValidateBtn.addEventListener('click',function(){let allowed=['zip','js','ts','json','md','txt','csv','xml','html','css','yml','yaml'];_tabUploadFiles.forEach(function(f){let ext=(f.name.split('.').pop()||'').toLowerCase();f.status=allowed.indexOf(ext)>=0?'valid':'invalid';});_tabUploadRender();});}
  let _tabUploadScanBtn=document.getElementById('tabUploadScanBtn');if(_tabUploadScanBtn){_tabUploadScanBtn.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'scan'});});}
  let _tabUploadClearBtn=document.getElementById('tabUploadClearBtn');if(_tabUploadClearBtn){_tabUploadClearBtn.addEventListener('click',function(){_tabUploadFiles=[];_tabUploadRender();});}
  let _sidebarUploadDropzone=document.getElementById('sidebarUploadDropzone');let _sidebarUploadFileInput=document.getElementById('sidebarUploadFileInput');let _sidebarUploadFiles=[];
  function _sidebarUploadFormatSize(b){if(b<1024)return b+' B';if(b<1024*1024)return (b/1024).toFixed(1)+' KB';return (b/(1024*1024)).toFixed(1)+' MB';}
  function _sidebarUploadAllowedExt(name){let ext=(name.split('.').pop()||'').toLowerCase();return ['zip','js','ts','json','md','txt','csv','xml','html','css','yml','yaml'].indexOf(ext)>=0;}
  function _sidebarUploadRender(){let list=document.getElementById('sidebarUploadList');if(!list)return;while(list.firstChild){list.removeChild(list.firstChild);}if(_sidebarUploadFiles.length===0){let empty=document.createElement('div');empty.className='upload-empty';empty.style.color='var(--vscode-descriptionForeground,#999)';empty.style.fontSize='12px';empty.style.textAlign='center';empty.style.padding='12px';empty.textContent='No files selected. Drop files above or click to browse.';list.appendChild(empty);}else{_sidebarUploadFiles.forEach(function(f,index){let item=document.createElement('div');item.className='upload-item';item.style.display='flex';item.style.alignItems='center';item.style.justifyContent='space-between';item.style.padding='8px 10px';item.style.borderRadius='6px';item.style.background='rgba(255,255,255,0.03)';item.style.border='1px solid rgba(255,255,255,0.06)';let left=document.createElement('div');left.style.display='flex';left.style.alignItems='center';left.style.gap='8px';let icon=document.createElement('div');icon.textContent='📄';let info=document.createElement('div');let name=document.createElement('div');name.className='upload-item-name';name.style.fontSize='12px';name.style.fontWeight='500';name.textContent=f.name;let meta=document.createElement('div');meta.className='upload-item-meta';meta.style.fontSize='10px';meta.style.color='var(--vscode-descriptionForeground,#999)';meta.textContent=_sidebarUploadFormatSize(f.size);info.appendChild(name);info.appendChild(meta);left.appendChild(icon);left.appendChild(info);let right=document.createElement('div');right.style.display='flex';right.style.alignItems='center';right.style.gap='6px';let statusBadge=document.createElement('span');statusBadge.style.fontSize='10px';statusBadge.style.padding='2px 6px';statusBadge.style.borderRadius='4px';statusBadge.style.fontWeight='600';if(f.status==='valid'){statusBadge.style.background='rgba(34,197,94,0.15)';statusBadge.style.color='#4ade80';statusBadge.textContent='Valid';}else if(f.status==='invalid'){statusBadge.style.background='rgba(239,68,68,0.15)';statusBadge.style.color='#f87171';statusBadge.textContent='Invalid';}else{statusBadge.style.background='rgba(156,163,175,0.15)';statusBadge.style.color='#9ca3af';statusBadge.textContent='Ready';}let removeBtn=document.createElement('button');removeBtn.style.background='transparent';removeBtn.style.border='none';removeBtn.style.color='var(--vscode-descriptionForeground,#999)';removeBtn.style.cursor='pointer';removeBtn.style.fontSize='12px';removeBtn.textContent='✕';removeBtn.title='Remove';removeBtn.addEventListener('click',function(e){e.stopPropagation();_sidebarUploadFiles.splice(index,1);_sidebarUploadRender();});right.appendChild(statusBadge);right.appendChild(removeBtn);item.appendChild(left);item.appendChild(right);list.appendChild(item);});}let total=document.getElementById('uploadTotalFiles');if(total)total.textContent=_sidebarUploadFiles.length;let valid=document.getElementById('uploadValid');let err=document.getElementById('uploadErrors');let score=document.getElementById('uploadScore');if(valid&&err){let v=_sidebarUploadFiles.filter(function(f){return f.status==='valid';}).length;let iv=_sidebarUploadFiles.filter(function(f){return f.status==='invalid';}).length;valid.textContent=v;err.textContent=iv;if(score){let pct=_sidebarUploadFiles.length===0?'--':Math.round((v/_sidebarUploadFiles.length)*100);score.textContent=pct==='--'?'--':pct;}}}
  function _sidebarUploadAddFiles(fileList){if(!fileList)return;for(let i=0;i<fileList.length;i++){let file=fileList[i];_sidebarUploadFiles.push({name:file.name,size:file.size,status:'ready'});}_sidebarUploadRender();}
  function _sidebarUploadValidate(){if(_sidebarUploadFiles.length===0){let box=document.getElementById('sidebarUploadResultBox');let title=document.getElementById('sidebarUploadResultTitle');let list=document.getElementById('sidebarUploadResultList');if(box&&title&&list){box.style.display='block';title.className='upload-result-title err';title.textContent='✗ No files selected';list.textContent='Browse or drop files to validate';}return;}_sidebarUploadFiles.forEach(function(f){f.status=_sidebarUploadAllowedExt(f.name)?'valid':'invalid';});_sidebarUploadRender();let box=document.getElementById('sidebarUploadResultBox');let title=document.getElementById('sidebarUploadResultTitle');let list=document.getElementById('sidebarUploadResultList');if(!box||!title||!list)return;box.style.display='block';let validCount=_sidebarUploadFiles.filter(function(f){return f.status==='valid';}).length;let invalidCount=_sidebarUploadFiles.filter(function(f){return f.status==='invalid';}).length;if(invalidCount===0){title.className='upload-result-title ok';title.textContent='✓ All files passed validation';}else{title.className='upload-result-title err';title.textContent='✗ '+invalidCount+' file'+(invalidCount===1?'':'s')+' failed validation';}let items=[];if(validCount>0)items.push(validCount+' ready for upload');if(invalidCount>0)items.push(invalidCount+' need fixing');list.textContent=items.join(' • ');}
  if(_sidebarUploadDropzone&&_sidebarUploadFileInput){_sidebarUploadDropzone.addEventListener('click',function(){_sidebarUploadFileInput.click();});_sidebarUploadDropzone.addEventListener('dragover',function(e){e.preventDefault();_sidebarUploadDropzone.classList.add('dragover');});_sidebarUploadDropzone.addEventListener('dragleave',function(e){e.preventDefault();_sidebarUploadDropzone.classList.remove('dragover');});_sidebarUploadDropzone.addEventListener('drop',function(e){e.preventDefault();_sidebarUploadDropzone.classList.remove('dragover');_sidebarUploadAddFiles(e.dataTransfer.files);});_sidebarUploadFileInput.addEventListener('change',function(){_sidebarUploadAddFiles(_sidebarUploadFileInput.files);_sidebarUploadFileInput.value='';});}
  let _sidebarUploadBrowseBtn=document.getElementById('sidebarUploadBrowseBtn');if(_sidebarUploadBrowseBtn){_sidebarUploadBrowseBtn.addEventListener('click',function(){if(_sidebarUploadFileInput)_sidebarUploadFileInput.click();});}
  let _sidebarUploadValidateBtn=document.getElementById('sidebarUploadValidateBtn');if(_sidebarUploadValidateBtn){_sidebarUploadValidateBtn.addEventListener('click',function(){_sidebarUploadValidate();});}
  let _sidebarUploadClearBtn=document.getElementById('sidebarUploadClearBtn');if(_sidebarUploadClearBtn){_sidebarUploadClearBtn.addEventListener('click',function(){_sidebarUploadFiles=[];let box=document.getElementById('sidebarUploadResultBox');if(box)box.style.display='none';_sidebarUploadRender();});}
  let _sidebarUploadScanBtn=document.getElementById('sidebarUploadScanBtn');if(_sidebarUploadScanBtn){_sidebarUploadScanBtn.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'scan'});});}
  _sidebarUploadRender();
  _bindViewReportBtn('dashboardViewReportBtn', 'openDashboard');
  _bindViewReportBtn('analyzeViewReportBtn', 'openAnalyze');
  _bindViewReportBtn('codeMapViewReportBtn', 'openCodeMap');
  _bindViewReportBtn('roadmapViewReportBtn', 'openRoadmap');
  _bindViewReportBtn('uploadViewReportBtn', 'openUpload');
  _bindViewReportBtn('platformViewReportBtn', 'openPlatform');
  _bindViewReportBtn('profileViewReportBtn', 'openProfile');
  _bindViewReportBtn('settingsViewReportBtn', 'openSettings');
  let _analyzeRunCard=document.getElementById('analyzeRunCard');if(_analyzeRunCard){_analyzeRunCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'scan', mode: 'workspace'}); });}
  let _analyzeScanWorkspaceCard=document.getElementById('analyzeScanWorkspaceCard');if(_analyzeScanWorkspaceCard){_analyzeScanWorkspaceCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openEnhancedAnalysis'}); });}
  let _analyzeExportJsonCard=document.getElementById('analyzeExportJsonCard');if(_analyzeExportJsonCard){_analyzeExportJsonCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _repoHealthDropdownHeader=document.getElementById('repoHealthDropdownHeader');if(_repoHealthDropdownHeader){_repoHealthDropdownHeader.addEventListener('click', function() { const header=document.getElementById('repoHealthDropdownHeader'); const detail=document.getElementById('repoHealthDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _repoHealthDetailBackBtn=document.getElementById('repoHealthDetailBackBtn');if(_repoHealthDetailBackBtn){_repoHealthDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _repoHealthCard=document.getElementById('repoHealthCard');if(_repoHealthCard){_repoHealthCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  let _assessmentsCard=document.getElementById('assessmentsCard');if(_assessmentsCard){_assessmentsCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  let _platformDropdownHeader=document.getElementById('platformDropdownHeader');if(_platformDropdownHeader){_platformDropdownHeader.addEventListener('click', function() { const header=document.getElementById('platformDropdownHeader'); const detail=document.getElementById('platformDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); });}
  let _platformCard=document.getElementById('platformCard');if(_platformCard){_platformCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  let _profileDropdownHeader=document.getElementById('profileDropdownHeader');if(_profileDropdownHeader){_profileDropdownHeader.addEventListener('click', function() { const header=document.getElementById('profileDropdownHeader'); const detail=document.getElementById('profileDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _profileDetailBackBtn=document.getElementById('profileDetailBackBtn');if(_profileDetailBackBtn){_profileDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _openProfileDetailInMainWindowBtn=document.getElementById('openProfileDetailInMainWindowBtn');if(_openProfileDetailInMainWindowBtn){_openProfileDetailInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  let _profileSaveBtn=document.getElementById('profileSaveBtn');if(_profileSaveBtn){_profileSaveBtn.addEventListener('click', function() { const displayName=document.getElementById('profileDisplayName'); const email=document.getElementById('profileEmail'); const role=document.getElementById('profileRole'); const organization=document.getElementById('profileOrganization'); const autoScan=document.getElementById('profileAutoScan'); const notifications=document.getElementById('profileNotifications'); const darkMode=document.getElementById('profileDarkMode'); if (window.vscode) window.vscode.postMessage({command: 'saveProfile', profile: { displayName: displayName ? displayName.value : '', email: email ? email.value : '', role: role ? role.value : '', organization: organization ? organization.value : '', autoScan: autoScan ? autoScan.checked : false, notifications: notifications ? notifications.checked : false, darkMode: darkMode ? darkMode.checked : false }}); });}
  let _profileClearBtn=document.getElementById('profileClearBtn');if(_profileClearBtn){_profileClearBtn.addEventListener('click', function() { const displayName=document.getElementById('profileDisplayName'); const email=document.getElementById('profileEmail'); const role=document.getElementById('profileRole'); const organization=document.getElementById('profileOrganization'); const autoScan=document.getElementById('profileAutoScan'); const notifications=document.getElementById('profileNotifications'); const darkMode=document.getElementById('profileDarkMode'); if(displayName) displayName.value=''; if(email) email.value=''; if(role) role.value=''; if(organization) organization.value=''; if(autoScan) autoScan.checked=false; if(notifications) notifications.checked=false; if(darkMode) darkMode.checked=true; });}
  let _profileCard=document.getElementById('profileCard');if(_profileCard){_profileCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  let _reportDropdownHeader=document.getElementById('reportDropdownHeader');if(_reportDropdownHeader){_reportDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _certificateDropdownHeader=document.getElementById('certificateDropdownHeader');if(_certificateDropdownHeader){_certificateDropdownHeader.addEventListener('click', function() { const header=document.getElementById('certificateDropdownHeader'); const detail=document.getElementById('certificateDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _certificateDetailBackBtn=document.getElementById('certificateDetailBackBtn');if(_certificateDetailBackBtn){_certificateDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _generateCertificateBtn=document.getElementById('generateCertificateBtn');if(_generateCertificateBtn){_generateCertificateBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateCertificate'}); });}
  let _exportCertificatePdfBtn=document.getElementById('exportCertificatePdfBtn');if(_exportCertificatePdfBtn){_exportCertificatePdfBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportCertificatePdf'}); });}
  let _viewCertificateReportBtn=document.getElementById('viewCertificateReportBtn');if(_viewCertificateReportBtn){_viewCertificateReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCertificate'}); });}
  let _openCertificateInMainWindowBtn=document.getElementById('openCertificateInMainWindowBtn');if(_openCertificateInMainWindowBtn){_openCertificateInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCertificateHtml'}); });}
  let _codeMapDropdownHeader=document.getElementById('codeMapDropdownHeader');if(_codeMapDropdownHeader){_codeMapDropdownHeader.addEventListener('click', function() { const header=document.getElementById('codeMapDropdownHeader'); const detail=document.getElementById('codeMapDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getCodeMap'}); });}
  let _codeMapDetailBackBtn=document.getElementById('codeMapDetailBackBtn');if(_codeMapDetailBackBtn){_codeMapDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _generateCodeMapBtn=document.getElementById('generateCodeMapBtn');if(_generateCodeMapBtn){_generateCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateCodeMap'}); });}
  let _openCodeMapHtmlBtn=document.getElementById('openCodeMapHtmlBtn');if(_openCodeMapHtmlBtn){_openCodeMapHtmlBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMapHtml'}); });}
  let _exportCodeMapBtn=document.getElementById('exportCodeMapBtn');if(_exportCodeMapBtn){_exportCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportCodeMap'}); });}
  let _refreshCodeMapBtn=document.getElementById('refreshCodeMapBtn');if(_refreshCodeMapBtn){_refreshCodeMapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateCodeMap'}); });}
  let _openCodeMapInMainWindowBtn=document.getElementById('openCodeMapInMainWindowBtn');if(_openCodeMapInMainWindowBtn){_openCodeMapInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  let _roadmapDropdownHeader=document.getElementById('roadmapDropdownHeader');if(_roadmapDropdownHeader){_roadmapDropdownHeader.addEventListener('click', function() { const header=document.getElementById('roadmapDropdownHeader'); const detail=document.getElementById('roadmapDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) { window.vscode.postMessage({command: 'getAuditData'}); window.vscode.postMessage({command: 'getRoadmapData'}); } });}
  let _roadmapDetailBackBtn=document.getElementById('roadmapDetailBackBtn');if(_roadmapDetailBackBtn){_roadmapDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _generateRoadmapBtn=document.getElementById('generateRoadmapBtn');if(_generateRoadmapBtn){_generateRoadmapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'generateRoadmap'}); });}
  let _exportRoadmapBtn=document.getElementById('exportRoadmapBtn');if(_exportRoadmapBtn){_exportRoadmapBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportRoadmap'}); });}
  let _aiContextDropdownHeader=document.getElementById('aiContextDropdownHeader');if(_aiContextDropdownHeader){_aiContextDropdownHeader.addEventListener('click', function() { const header=document.getElementById('aiContextDropdownHeader'); const detail=document.getElementById('aiContextDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _aiContextDetailBackBtn=document.getElementById('aiContextDetailBackBtn');if(_aiContextDetailBackBtn){_aiContextDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _scanAiContextBtn=document.getElementById('scanAiContextBtn');if(_scanAiContextBtn){_scanAiContextBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'scan', mode: 'workspace'}); });}
  let _exportAiContextBtn=document.getElementById('exportAiContextBtn');if(_exportAiContextBtn){_exportAiContextBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _viewAiContextReportBtn=document.getElementById('viewAiContextReportBtn');if(_viewAiContextReportBtn){_viewAiContextReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAiContext'}); });}
  let _openContextInMainWindowBtn2=document.getElementById('openContextInMainWindowBtn2');if(_openContextInMainWindowBtn2){_openContextInMainWindowBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openContext'}); });}
  let _uploadDropdownHeader=document.getElementById('uploadDropdownHeader');if(_uploadDropdownHeader){_uploadDropdownHeader.addEventListener('click', function() { const header=document.getElementById('uploadDropdownHeader'); const detail=document.getElementById('uploadDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _uploadDetailBackBtn=document.getElementById('uploadDetailBackBtn');if(_uploadDetailBackBtn){_uploadDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _auditDropdownHeader=document.getElementById('auditDropdownHeader');if(_auditDropdownHeader){_auditDropdownHeader.addEventListener('click', function() { _switchSidebarTab('report'); });}
  let _auditDetailBackBtn=document.getElementById('auditDetailBackBtn');if(_auditDetailBackBtn){_auditDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _openAuditBtn2=document.getElementById('openAuditBtn2');if(_openAuditBtn2){_openAuditBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runAudit'}); });}
  let _openAuditReportBtn2=document.getElementById('openAuditReportBtn2');if(_openAuditReportBtn2){_openAuditReportBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAuditReport'}); });}
  let _openAuditInMainWindowBtn=document.getElementById('openAuditInMainWindowBtn');if(_openAuditInMainWindowBtn){_openAuditInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAudit'}); });}
  let _securityDropdownHeader=document.getElementById('securityDropdownHeader');if(_securityDropdownHeader){_securityDropdownHeader.addEventListener('click', function() { const header=document.getElementById('securityDropdownHeader'); const detail=document.getElementById('securityDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _securityDetailBackBtn=document.getElementById('securityDetailBackBtn');if(_securityDetailBackBtn){_securityDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('scan'); });}
  let _runSecurityScanBtn=document.getElementById('runSecurityScanBtn');if(_runSecurityScanBtn){_runSecurityScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runSecurity'}); });}
  let _openSecurityReportBtn=document.getElementById('openSecurityReportBtn');if(_openSecurityReportBtn){_openSecurityReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSecurity'}); });}
  let _openSecurityInMainWindowBtn=document.getElementById('openSecurityInMainWindowBtn');if(_openSecurityInMainWindowBtn){_openSecurityInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSecurity'}); });}
  let _trustDropdownHeader=document.getElementById('trustDropdownHeader');if(_trustDropdownHeader){_trustDropdownHeader.addEventListener('click', function() { const header=document.getElementById('trustDropdownHeader'); const detail=document.getElementById('trustDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _trustDetailBackBtn=document.getElementById('trustDetailBackBtn');if(_trustDetailBackBtn){_trustDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('scan'); });}
  let _verifyTrustBtn=document.getElementById('verifyTrustBtn');if(_verifyTrustBtn){_verifyTrustBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runTrust'}); });}
  let _openTrustReportBtn=document.getElementById('openTrustReportBtn');if(_openTrustReportBtn){_openTrustReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  let _openTrustInMainWindowBtn=document.getElementById('openTrustInMainWindowBtn');if(_openTrustInMainWindowBtn){_openTrustInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  let _qualityDropdownHeader=document.getElementById('qualityDropdownHeader');if(_qualityDropdownHeader){_qualityDropdownHeader.addEventListener('click', function() { const header=document.getElementById('qualityDropdownHeader'); const detail=document.getElementById('qualityDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _qualityDetailBackBtn=document.getElementById('qualityDetailBackBtn');if(_qualityDetailBackBtn){_qualityDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('scan'); });}
  let _runQualityBtn=document.getElementById('runQualityBtn');if(_runQualityBtn){_runQualityBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runQuality'}); });}
  let _exportQualityBtn=document.getElementById('exportQualityBtn');if(_exportQualityBtn){_exportQualityBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _viewQualityReportBtn=document.getElementById('viewQualityReportBtn');if(_viewQualityReportBtn){_viewQualityReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openQuality'}); });}
  let _openQualityInMainWindowBtn=document.getElementById('openQualityInMainWindowBtn');if(_openQualityInMainWindowBtn){_openQualityInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openQuality'}); });}
  let _assessmentsDropdownHeader=document.getElementById('assessmentsDropdownHeader');if(_assessmentsDropdownHeader){_assessmentsDropdownHeader.addEventListener('click', function() { const header=document.getElementById('assessmentsDropdownHeader'); const detail=document.getElementById('assessmentsDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _assessmentsDetailBackBtn=document.getElementById('assessmentsDetailBackBtn');if(_assessmentsDetailBackBtn){_assessmentsDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('scan'); });}
  let _runAssessmentsBtn=document.getElementById('runAssessmentsBtn');if(_runAssessmentsBtn){_runAssessmentsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  let _exportAssessmentsBtn=document.getElementById('exportAssessmentsBtn');if(_exportAssessmentsBtn){_exportAssessmentsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _viewAssessmentsReportBtn=document.getElementById('viewAssessmentsReportBtn');if(_viewAssessmentsReportBtn){_viewAssessmentsReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  let _openAssessmentsInMainWindowBtn=document.getElementById('openAssessmentsInMainWindowBtn');if(_openAssessmentsInMainWindowBtn){_openAssessmentsInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  let _platformDetailBackBtn=document.getElementById('platformDetailBackBtn');if(_platformDetailBackBtn){_platformDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('settings'); });}
  let _diagnoseDetailBackBtn=document.getElementById('diagnoseDetailBackBtn');if(_diagnoseDetailBackBtn){_diagnoseDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('settings'); });}
  let _platformRefreshBtn=document.getElementById('platformRefreshBtn');if(_platformRefreshBtn){_platformRefreshBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _platformExportBtn=document.getElementById('platformExportBtn');if(_platformExportBtn){_platformExportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _platformDocsBtn=document.getElementById('platformDocsBtn');if(_platformDocsBtn){_platformDocsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openDocs'}); });}
  let _platformSettingsBtn=document.getElementById('platformSettingsBtn');if(_platformSettingsBtn){_platformSettingsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  let _openPlatformInMainWindowBtn=document.getElementById('openPlatformInMainWindowBtn');if(_openPlatformInMainWindowBtn){_openPlatformInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  let _complianceDropdownHeader=document.getElementById('complianceDropdownHeader');if(_complianceDropdownHeader){_complianceDropdownHeader.addEventListener('click', function() { const header=document.getElementById('complianceDropdownHeader'); const detail=document.getElementById('complianceDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _complianceDetailBackBtn=document.getElementById('complianceDetailBackBtn');if(_complianceDetailBackBtn){_complianceDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('scan'); });}
  let _runComplianceBtn=document.getElementById('runComplianceBtn');if(_runComplianceBtn){_runComplianceBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'scan', mode: 'workspace'}); });}
  let _exportComplianceBtn=document.getElementById('exportComplianceBtn');if(_exportComplianceBtn){_exportComplianceBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _viewComplianceReportBtn=document.getElementById('viewComplianceReportBtn');if(_viewComplianceReportBtn){_viewComplianceReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  let _openComplianceInMainWindowBtn=document.getElementById('openComplianceInMainWindowBtn');if(_openComplianceInMainWindowBtn){_openComplianceInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  let _repoHealthRunScanBtn=document.getElementById('repoHealthRunScanBtn');if(_repoHealthRunScanBtn){_repoHealthRunScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runAudit'}); });}
  let _repoHealthExportBtn=document.getElementById('repoHealthExportBtn');if(_repoHealthExportBtn){_repoHealthExportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _repoHealthViewReportBtn=document.getElementById('repoHealthViewReportBtn');if(_repoHealthViewReportBtn){_repoHealthViewReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  let _repoHealthSettingsBtn=document.getElementById('repoHealthSettingsBtn');if(_repoHealthSettingsBtn){_repoHealthSettingsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  let _analyticsDropdownHeader=document.getElementById('analyticsDropdownHeader');if(_analyticsDropdownHeader){_analyticsDropdownHeader.addEventListener('click', function() { const header=document.getElementById('analyticsDropdownHeader'); const detail=document.getElementById('analyticsDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _analyticsDetailBackBtn=document.getElementById('analyticsDetailBackBtn');if(_analyticsDetailBackBtn){_analyticsDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _analyticsRefreshBtn=document.getElementById('analyticsRefreshBtn');if(_analyticsRefreshBtn){_analyticsRefreshBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _analyticsExportBtn=document.getElementById('analyticsExportBtn');if(_analyticsExportBtn){_analyticsExportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _analyticsViewReportBtn=document.getElementById('analyticsViewReportBtn');if(_analyticsViewReportBtn){_analyticsViewReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAnalytics'}); });}
  let _analyticsSettingsBtn=document.getElementById('analyticsSettingsBtn');if(_analyticsSettingsBtn){_analyticsSettingsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  let _teamDropdownHeader=document.getElementById('teamDropdownHeader');if(_teamDropdownHeader){_teamDropdownHeader.addEventListener('click', function() { const header=document.getElementById('teamDropdownHeader'); const detail=document.getElementById('teamDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _teamDetailBackBtn=document.getElementById('teamDetailBackBtn');if(_teamDetailBackBtn){_teamDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('advanced'); });}
  let _teamInviteBtn=document.getElementById('teamInviteBtn');if(_teamInviteBtn){_teamInviteBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTeamDashboard'}); });}
  let _teamExportBtn2=document.getElementById('teamExportBtn');if(_teamExportBtn2){_teamExportBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _teamViewReportBtn2=document.getElementById('teamViewReportBtn');if(_teamViewReportBtn2){_teamViewReportBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTeam'}); });}
  let _teamSettingsBtn2=document.getElementById('teamSettingsBtn');if(_teamSettingsBtn2){_teamSettingsBtn2.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openSettings'}); });}
  let _openTeamInMainWindowBtn=document.getElementById('openTeamInMainWindowBtn');if(_openTeamInMainWindowBtn){_openTeamInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTeamDashboard'}); });}
  let _scanDropdownHeader=document.getElementById('scanDropdownHeader');if(_scanDropdownHeader){_scanDropdownHeader.addEventListener('click', function() { const header=document.getElementById('scanDropdownHeader'); const detail=document.getElementById('scanDetailPanel'); _closeDetailPanels(); if(header){header.style.display='none';} if(detail){detail.classList.remove('hidden');detail.classList.add('detail-active');detail.style.display='block';} document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');}); document.body.classList.add('detail-panel-open'); if (window.vscode) window.vscode.postMessage({command: 'getAuditData'}); });}
  let _scanDetailBackBtn=document.getElementById('scanDetailBackBtn');if(_scanDetailBackBtn){_scanDetailBackBtn.addEventListener('click', function() { _switchSidebarTab('scan'); });}
  let _runScanBtn=document.getElementById('runScanBtn');if(_runScanBtn){_runScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'runAudit'}); });}
  let _exportScanBtn=document.getElementById('exportScanBtn');if(_exportScanBtn){_exportScanBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _viewScanReportBtn=document.getElementById('viewScanReportBtn');if(_viewScanReportBtn){_viewScanReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openScan'}); });}
  let _openScanInMainWindowBtn=document.getElementById('openScanInMainWindowBtn');if(_openScanInMainWindowBtn){_openScanInMainWindowBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openScan'}); });}
  let _previewDropdownHeader=document.getElementById('previewDropdownHeader');if(_previewDropdownHeader){_previewDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreview'}); });}
  let _toggleMonitorSidebarBtn=document.getElementById('toggleMonitorSidebarBtn');if(_toggleMonitorSidebarBtn){_toggleMonitorSidebarBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openToggleMonitor'}); });}
  let _browserDropdownHeader=document.getElementById('browserDropdownHeader');if(_browserDropdownHeader){_browserDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openBrowser'}); });}
  let _scanWorkspaceDropdownHeader=document.getElementById('scanWorkspaceDropdownHeader');if(_scanWorkspaceDropdownHeader){_scanWorkspaceDropdownHeader.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'scan', mode: 'workspace'}); });}
  function _tdBind2(id,cmd){let el=document.getElementById(id);if(el){el.addEventListener('click',function(){if(window.vscode){window.vscode.postMessage({command:cmd});} if(cmd==='signOut'){_clearSidebarAuthLocally();_callServerSignout();}});}}
  function _openSigninWithClear(){const base=window.__SB_DATA_SERVER_URL__||'';function _post(){if(window.vscode){try{window.vscode.postMessage({command:'openSigninPanel'});}catch(e){}}} if(base){fetch(base+'/api/auth/signout',{method:'POST',headers:{'Content-Type':'application/json'}}).finally(_post).catch(_post);}else{_post();}}
  _tdBind('tdOpenSiteSidebar','openTeamDashboard');
  _tdBind2('tdThemeToggleSidebar','toggleTheme');
  // Website / localhost mode toggle
  function _applyDashboardMode(mode) {
    const el = document.getElementById('tdOfflineToggleSidebar');
    if (!el) return;
    const nameSpan = el.querySelector('.tc-list-name');
    const iconSpan = el.querySelector('.icon');
    const activeMode = mode === 'localhost' ? 'localhost' : 'website';
    if (nameSpan) { nameSpan.textContent = activeMode === 'website' ? 'Website' : 'Local host'; }
    if (iconSpan) { iconSpan.textContent = activeMode === 'website' ? '\u{1F310}' : '\u{1F3E0}'; }
    try { localStorage.setItem('sb_dashboard_mode', activeMode); } catch (e) {}
  }
  function _setDashboardMode(mode) {
    const activeMode = mode === 'localhost' ? 'localhost' : 'website';
    _applyDashboardMode(activeMode);
    if (window.vscode) {
      try { window.vscode.postMessage({ command: 'setDashboardMode', mode: activeMode }); } catch (e) {}
    }
  }
  function _toggleDashboardMode() {
    const current = (function(){ try { return localStorage.getItem('sb_dashboard_mode'); } catch(e){ return null; } })() || 'localhost';
    const next = current === 'website' ? 'localhost' : 'website';
    _setDashboardMode(next);
  }
  const _offlineToggleEl = document.getElementById('tdOfflineToggleSidebar');
  if (_offlineToggleEl) {
    _offlineToggleEl.addEventListener('click', _toggleDashboardMode);
    const stored = (function(){ try { return localStorage.getItem('sb_dashboard_mode'); } catch(e){ return null; } })() || 'localhost';
    _setDashboardMode(stored === 'website' ? 'website' : 'localhost');
  }
  window.addEventListener('message', function(ev) {
    if (ev && ev.data && ev.data.command === 'dashboardModeChanged') {
      _applyDashboardMode(ev.data.mode || 'localhost');
    }
  });
  _tdBind2('tdSignOutSidebar','signOut');
  let _tdSignInSidebarEl=document.getElementById('tdSignInSidebar');if(_tdSignInSidebarEl){_tdSignInSidebarEl.addEventListener('click',function(){_openSigninWithClear();});}
  let _sidebarSignInLink=document.getElementById('sidebarSignInLink');if(_sidebarSignInLink){_sidebarSignInLink.addEventListener('click',function(){_openSigninWithClear();});}
  let _sidebarSignOutLink=document.getElementById('sidebarSignOutLink');if(_sidebarSignOutLink){_sidebarSignOutLink.addEventListener('click',function(){_clearSidebarAuthLocally(); if(window.vscode){window.vscode.postMessage({command:'signOut'});} _callServerSignout();});}
  let _headerSignInBtn=document.getElementById('headerSignInBtn');if(_headerSignInBtn){_headerSignInBtn.addEventListener('click',function(){_openSigninWithClear();});}
  let _headerSignOutBtn=document.getElementById('headerSignOutBtn');if(_headerSignOutBtn){_headerSignOutBtn.addEventListener('click',function(){_clearSidebarAuthLocally(); if(window.vscode){window.vscode.postMessage({command:'signOut'});} _callServerSignout();});}
  let _tdSignOutSidebarEl=document.getElementById('tdSignOutSidebar');if(_tdSignOutSidebarEl){_tdSignOutSidebarEl.addEventListener('click',function(){_clearSidebarAuthLocally(); if(window.vscode){window.vscode.postMessage({command:'signOut'});} _callServerSignout();});}
  _tdBind2('tdGitHubSidebar','openGitHub');
  let _tokenManagementCard=document.getElementById('tokenManagementCard');if(_tokenManagementCard){_tokenManagementCard.addEventListener('click',function(){if(window.vscode)window.vscode.postMessage({command:'openTokenReplacementPanel'});});}
  _tdBind2('tdDocsSidebar','openDocs');
  // Quick Links
  _tdBindUrl('tdRoadmapSidebar','openRoadmapUrl','https://simplebeacon.ai/roadmap');
  _tdBindUrl('tdAuditSidebar','openAuditUrl','https://simplebeacon.ai/audit');
  _tdBindUrl('tdPricingSidebar','openPricingUrl','https://simplebeacon.ai/pricing');
  _tdBind('tdSignInSidebar','signIn');
  // Navigation
  _tdBind('tdDashboardSidebar','navDashboard');
  _tdBind('tdAnalyzeSidebar','navAnalyze');
  _tdBind('tdResultsSidebar','navResults');
  _tdBind('tdRepoHealthSidebar','navRepoHealth');
  _tdBind('tdSecuritySidebar','navSecurity');
  _tdBind('tdQualitySidebar','navQuality');
  _tdBind('tdTrustSidebar','navTrust');
  _tdBind('tdAuditReportSidebar','navAudit');
  _tdBind('tdAssessmentsSidebar','navAssessments');
  _tdBind('tdRemediationSidebar','navRoadmap');
  _tdBind('tdPlatformSidebar','navPlatform');
  _tdBind('tdProfileSidebar','navProfile');
  _tdBind('tdToolsSidebar','navTools');
  _tdBind('tdSettingsSidebar','navSettings');
  _tdBind('tdHelpSidebar','navHelp');
  _tdBind('tdChatbotSidebar','navChatbot');
  _tdBind('tdAboutSidebar','navAbout');
  let _dbExportBtn=document.getElementById('dbExportBtn');if(_dbExportBtn){_dbExportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _dbSigninBtn=document.getElementById('dbSigninBtn');if(_dbSigninBtn){_dbSigninBtn.addEventListener('click', function() { _openSigninWithClear(); });}
  let _dbSignoutBtn=document.getElementById('dbSignoutBtn');if(_dbSignoutBtn){_dbSignoutBtn.addEventListener('click', function() { _clearSidebarAuthLocally(); if (window.vscode) { window.vscode.postMessage({command: 'signOut'}); } _callServerSignout(); });}
  let _dashPreviewBtn=document.getElementById('dashPreviewBtn');if(_dashPreviewBtn){_dashPreviewBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreviewInBrowser'}); });}
  let _dashBrowserBtn=document.getElementById('dashBrowserBtn');if(_dashBrowserBtn){_dashBrowserBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openBrowser'}); });}
  let _dashExportReportBtn=document.getElementById('dashExportReportBtn');if(_dashExportReportBtn){_dashExportReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'exportReport'}); });}
  let _dashClearResultsBtn=document.getElementById('dashClearResultsBtn');if(_dashClearResultsBtn){_dashClearResultsBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openClear'}); });}
  let _sidebarScanBrowseBtn=document.getElementById('sidebarScanBrowseBtn');if(_sidebarScanBrowseBtn){_sidebarScanBrowseBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'browseSidebarScanPath'}); });}
  let _sidebarScanDetectBtn=document.getElementById('sidebarScanDetectBtn');if(_sidebarScanDetectBtn){_sidebarScanDetectBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'detectSidebarScanPath'}); });}
  let _sidebarScanPathInput=document.getElementById('sidebarScanPathInput');if(_sidebarScanPathInput){_sidebarScanPathInput.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateSidebarScanPath', path: this.value}); });}
  let _sidebarScanWorkspaceToggle=document.getElementById('sidebarScanWorkspaceToggle');if(_sidebarScanWorkspaceToggle){_sidebarScanWorkspaceToggle.addEventListener('change', function() { let label=document.getElementById('sidebarScanToggleLabel'); let wrap=document.getElementById('sidebarScanCustomWrap'); let actionRow=document.getElementById('scanActionRow'); let isWorkspace=this.checked; if(label){label.textContent=isWorkspace?'Current Workspace':'Custom Location';} if(wrap){wrap.style.display=isWorkspace?'none':'flex';} if(actionRow){actionRow.style.display=isWorkspace?'none':'flex';} if(window.vscode)window.vscode.postMessage({command:'updateSidebarScanMode',mode:isWorkspace?'workspace':'custom'}); });}
  let _dlClearBtn=document.getElementById('dlClearBtn');if(_dlClearBtn){_dlClearBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'clearDownloads'}); });}
  let _qlDashboardBtn=document.getElementById('qlDashboardBtn');if(_qlDashboardBtn){_qlDashboardBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openDashboard'}); });}
  let _qlReportBtn=document.getElementById('qlReportBtn');if(_qlReportBtn){_qlReportBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'report'}); });}
  let _qlBrowserBtn=document.getElementById('qlBrowserBtn');if(_qlBrowserBtn){_qlBrowserBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openBrowser'}); });}
  let _qlPreviewBtn=document.getElementById('qlPreviewBtn');if(_qlPreviewBtn){_qlPreviewBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreviewInBrowser'}); });}
  let _teamDashboardBtn=document.getElementById('teamDashboardBtn');if(_teamDashboardBtn){_teamDashboardBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTeamDashboard'}); });}
  let _previewBtn=document.getElementById('previewBtn');if(_previewBtn){_previewBtn.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPreviewInBrowser'}); });}
  let _openCodeMapFromTools=document.getElementById('openCodeMapFromTools');if(_openCodeMapFromTools){_openCodeMapFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCodeMap'}); });}
  let _openRepoHealthFromTools=document.getElementById('openRepoHealthFromTools');if(_openRepoHealthFromTools){_openRepoHealthFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRepoHealth'}); });}
  let _openTeamFromTools=document.getElementById('openTeamFromTools');if(_openTeamFromTools){_openTeamFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTeam'}); });}
  let _openTrustFromTools=document.getElementById('openTrustFromTools');if(_openTrustFromTools){_openTrustFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openTrust'}); });}
  let _openAssessmentsFromTools=document.getElementById('openAssessmentsFromTools');if(_openAssessmentsFromTools){_openAssessmentsFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openAssessments'}); });}
  let _openPlatformFromTools=document.getElementById('openPlatformFromTools');if(_openPlatformFromTools){_openPlatformFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openPlatform'}); });}
  let _openComplianceFromTools=document.getElementById('openComplianceFromTools');if(_openComplianceFromTools){_openComplianceFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openCompliance'}); });}
  let _openProfileFromTools=document.getElementById('openProfileFromTools');if(_openProfileFromTools){_openProfileFromTools.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openProfile'}); });}
  let _openSettingsFromSettings=document.getElementById('openSettingsFromSettings');if(_openSettingsFromSettings){_openSettingsFromSettings.addEventListener('click', function() { _switchSidebarTab('settings'); _openSidebarMenu('settingsMenuTab', 'settingsDetailPanelTab', 'settings'); });}
  let _openDiagnoseFromSettingsTab=document.getElementById('openDiagnoseFromSettingsTab');if(_openDiagnoseFromSettingsTab){_openDiagnoseFromSettingsTab.addEventListener('click', function() { if (window._displayMode === 'mainWindow' && window.vscode) { window.vscode.postMessage({command: 'diagnose'}); return; } _openSidebarMenu('settingsMenuTab', 'diagnoseDetailPanel', null); if (window.vscode) window.vscode.postMessage({command: 'diagnose'}); });}
  let _openRefreshRelayFromSettingsTab=document.getElementById('openRefreshRelayFromSettingsTab');if(_openRefreshRelayFromSettingsTab){_openRefreshRelayFromSettingsTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRefreshRelayPort'}); });}
  let _openSettingsFromSettingsTab=document.getElementById('openSettingsFromSettingsTab');if(_openSettingsFromSettingsTab){_openSettingsFromSettingsTab.addEventListener('click', function() { _openSidebarMenu('settingsMenuTab', 'settingsDetailPanelTab', 'settings'); });}
  let _openPlatformFromSettingsTab=document.getElementById('openPlatformFromSettingsTab');if(_openPlatformFromSettingsTab){_openPlatformFromSettingsTab.addEventListener('click', function() { _openSidebarMenu('settingsMenuTab', 'platformDetailPanel', 'openPlatform'); });}
  let _settingsDetailBackBtnTab=document.getElementById('settingsDetailBackBtnTab');if(_settingsDetailBackBtnTab){_settingsDetailBackBtnTab.addEventListener('click', function() { _closeDetailPanels(); });}
  let _openSettingsInMainWindowBtnTab=document.getElementById('openSettingsInMainWindowBtnTab');if(_openSettingsInMainWindowBtnTab){_openSettingsInMainWindowBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'settings'}); });}
  let _refreshSettingsBtnTab=document.getElementById('refreshSettingsBtnTab');if(_refreshSettingsBtnTab){_refreshSettingsBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'refreshSettings'}); });}
  let _tabItems=document.querySelectorAll('.tab-item');
  function _hideDiagnoseResults(){
    let container=document.getElementById('diagnoseResultsContainer');
    if(container){container.style.display='none';container.dataset.wasOpen='false';}
    let mainContent=document.getElementById('mainContent')||document.querySelector('.content');
    if(mainContent){mainContent.style.display='';}
    if(container&&container.parentNode){
      let siblings=container.parentNode.children;
      for(let i=0;i<siblings.length;i++){if(siblings[i]===container)continue;if(siblings[i].classList.contains('header'))continue;siblings[i].style.display='';}
    }
    document.body.classList.remove('detail-panel-open');
  }
  _tabItems.forEach(function(item){item.addEventListener('click',function(){let tab=item.getAttribute('data-tab');_switchSidebarTab(tab);});});
  let _settingsDropdownHeader=document.getElementById('settingsDropdownHeader');if(_settingsDropdownHeader){_settingsDropdownHeader.addEventListener('click', function() { let body=document.getElementById('settingsDropdownBody'); if(body){body.classList.toggle('open'); _settingsDropdownHeader.classList.toggle('open');} });}
  let _dashGateCard=document.getElementById('dashGateCard');if(_dashGateCard){_dashGateCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'dashboard'}); });}
  let _dashIssuesCard=document.getElementById('dashIssuesCard');if(_dashIssuesCard){_dashIssuesCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'dashboard'}); });}
  let _dashScoreCard=document.getElementById('dashScoreCard');if(_dashScoreCard){_dashScoreCard.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'dashboard'}); });}
  let _displayMode=document.getElementById('displayMode');if(_displayMode){_displayMode.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateDisplayMode', value: this.value}); });}
  let _showWelcome=document.getElementById('showWelcome');if(_showWelcome){_showWelcome.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateShowWelcome', value: this.checked}); });}
  let _autoScan=document.getElementById('autoScan');if(_autoScan){_autoScan.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateAutoScan', value: this.checked}); });}
  let _apiUrl=document.getElementById('apiUrl');if(_apiUrl){_apiUrl.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: this.value}); });}
  let _toggleAutoScanTab=document.getElementById('toggleAutoScanTab');if(_toggleAutoScanTab){_toggleAutoScanTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateAutoScan', value: this.checked}); });}
  let _toggleDisplayModeTab=document.getElementById('toggleDisplayModeTab');if(_toggleDisplayModeTab){_toggleDisplayModeTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateDisplayMode', value: this.checked ? 'mainWindow' : 'sidebar'}); });}
  let _displayModeSelectTab=document.getElementById('displayModeSelectTab');if(_displayModeSelectTab){_displayModeSelectTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateDisplayMode', value: this.value}); });}
  let _toggleBrowserModeTab=document.getElementById('toggleBrowserModeTab');if(_toggleBrowserModeTab){_toggleBrowserModeTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateBrowserMode', value: this.checked}); });}
  let _toggleNotifyScanTab=document.getElementById('toggleNotifyScanTab');if(_toggleNotifyScanTab){_toggleNotifyScanTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateNotifyScan', value: this.checked}); });}
  let _toggleNotifyGateTab=document.getElementById('toggleNotifyGateTab');if(_toggleNotifyGateTab){_toggleNotifyGateTab.addEventListener('change', function() { if (window.vscode) window.vscode.postMessage({command: 'updateNotifyGate', value: this.checked}); });}
  let _settingsSaveBtnTab=document.getElementById('settingsSaveBtnTab');if(_settingsSaveBtnTab){_settingsSaveBtnTab.addEventListener('click', function() { let val=document.getElementById('settingsApiInputTab'); if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: val ? val.value : ''}); let badge=document.getElementById('settingsSavedBadgeTab'); if(badge){badge.style.display='inline-flex'; setTimeout(function(){badge.style.display='none';}, 2000);} });}
  let _apiPresetLocal=document.getElementById('apiPresetLocal');if(_apiPresetLocal){_apiPresetLocal.addEventListener('click', function() { let input=document.getElementById('settingsApiInputTab'); if(input){input.value='http://127.0.0.1:54358';} if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: 'http://127.0.0.1:54358'}); });}
  let _apiPresetSlopCop=document.getElementById('apiPresetSlopCop');if(_apiPresetSlopCop){_apiPresetSlopCop.addEventListener('click', function() { let input=document.getElementById('settingsApiInputTab'); if(input){input.value='http://127.0.0.1:3004/';} if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: 'http://127.0.0.1:3004/'}); });}
  let _apiPresetRemote=document.getElementById('apiPresetRemote');if(_apiPresetRemote){_apiPresetRemote.addEventListener('click', function() { let input=document.getElementById('settingsApiInputTab'); if(input){input.value='http://127.0.0.1:30011/';} if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: 'http://127.0.0.1:30011/'}); });}
  let _settingsTestBtnTab=document.getElementById('settingsTestBtnTab');if(_settingsTestBtnTab){_settingsTestBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'testConnection'}); });}
  let _settingsApiInputTab=document.getElementById('settingsApiInputTab');if(_settingsApiInputTab){_settingsApiInputTab.addEventListener('keydown', function(e) { if(e.key==='Enter'){ let badge=document.getElementById('settingsSavedBadgeTab'); if(badge){badge.style.display='inline-flex'; setTimeout(function(){badge.style.display='none';}, 2000);} if(window.vscode) window.vscode.postMessage({command: 'updateApiUrl', value: this.value}); } });}
  let _openDiagnoseBtnTab=document.getElementById('openDiagnoseBtnTab');if(_openDiagnoseBtnTab){_openDiagnoseBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'diagnose'}); });}
  let _openRefreshRelayPortBtnTab=document.getElementById('openRefreshRelayPortBtnTab');if(_openRefreshRelayPortBtnTab){_openRefreshRelayPortBtnTab.addEventListener('click', function() { if (window.vscode) window.vscode.postMessage({command: 'openRefreshRelayPort'}); });}
  let _dashboardBackBtn=document.getElementById('dashboardBackBtn');if(_dashboardBackBtn){_dashboardBackBtn.addEventListener('click', function() { document.body.classList.remove('sidebar-dashboard-mode'); let bb=document.getElementById('dashboardBackBtn'); if(bb) bb.style.display='none'; let td=document.getElementById('tabDashboard'); if(td){ td.classList.remove('active'); td.classList.add('hidden'); } });}
  function _updateSidebarScanPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const issues = data.issues || data.totalIssues || data.detectedIssues || (crit + high + med + low);
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const totalScans = data.totalScans || data.scans || 0;
    const fixed = data.fixed || 0;
    const status = data.status || 'complete';
    const statusText = status === 'scanning' ? 'Scanning' : status === 'complete' ? 'Complete' : (status === 'error' ? 'Error' : 'Ready');
    const statusMeta = status === 'complete' ? 'Scan complete' : (status === 'scanning' ? 'In progress' : 'Ready');
    const badge = document.getElementById('scanStatusBadge'); if (badge) { badge.textContent = status === 'complete' ? 'COMPLETE' : status === 'scanning' ? 'RUNNING' : status === 'error' ? 'ERROR' : 'READY'; badge.style.background = status === 'complete' ? 'rgba(34,197,94,0.18)' : status === 'scanning' ? 'rgba(59,130,246,0.18)' : status === 'error' ? 'rgba(239,68,68,0.18)' : 'rgba(100,116,139,0.18)'; badge.style.color = status === 'complete' ? '#4ade80' : status === 'scanning' ? '#60a5fa' : status === 'error' ? '#f87171' : '#94a3b8'; }
    const dot = document.getElementById('scanStatusDot'); if (dot) { dot.className = 'tc-list-dot ' + (status === 'complete' ? 'green' : status === 'scanning' ? 'blue' : status === 'error' ? 'red' : 'gray'); }
    const stText = document.getElementById('scanStatusText'); if (stText) stText.textContent = statusText;
    const stMeta = document.getElementById('scanStatusMeta'); if (stMeta) stMeta.textContent = statusMeta;
    const totalScansEl = document.getElementById('scanTotalScans'); if (totalScansEl) totalScansEl.textContent = totalScans;
    const issuesEl = document.getElementById('scanIssues'); if (issuesEl) issuesEl.textContent = issues;
    const fixedEl = document.getElementById('scanFixed'); if (fixedEl) fixedEl.textContent = fixed;
    const scoreEl = document.getElementById('scanScore'); if (scoreEl) scoreEl.textContent = score;
    const cEl = document.getElementById('scanCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('scanHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('scanMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('scanLow'); if (lEl) lEl.textContent = low;
    const list = document.getElementById('scanResultsList'); if (list) {
      list.replaceChildren();
      const findings = Array.isArray(data.findings) ? data.findings.slice(0, 5) : (Array.isArray(data.issuesList) ? data.issuesList.slice(0, 5) : []);
      if (findings.length === 0) {
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot green';
        const noResultsText = 'No results yet';
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = noResultsText;
        const dashText = '--';
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = dashText;
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); list.appendChild(row);
      } else {
        findings.forEach(function(f){
          const row = document.createElement('div'); row.className = 'scan-result-row';
          const left = document.createElement('div'); left.style.display = 'flex'; left.style.flexDirection = 'column'; left.style.gap = '2px'; left.style.minWidth = '0';
          const title = document.createElement('div'); title.className = 'scan-result-title'; title.textContent = f.title || f.type || 'Finding'; title.style.overflow = 'hidden'; title.style.textOverflow = 'ellipsis'; title.style.whiteSpace = 'nowrap';
          const file = document.createElement('div'); file.className = 'scan-result-file'; file.textContent = f.file || f.path || '--'; file.style.overflow = 'hidden'; file.style.textOverflow = 'ellipsis'; file.style.whiteSpace = 'nowrap';
          left.appendChild(title); left.appendChild(file);
          const sevBadge = document.createElement('span'); sevBadge.className = 'scan-result-severity ' + (f.severity || 'low'); sevBadge.textContent = (f.severity || 'low').toUpperCase();
          row.appendChild(left); row.appendChild(sevBadge); list.appendChild(row);
        });
      }
    }
  }
  function _updateSidebarAiContextPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const issues = data.aiIssues || data.aiContextIssues || (crit + high + med + low);
    const models = data.modelsDetected || data.detectedModels || 0;
    const score = data.contextScore || data.qualityScore || data.score || 100;
    const files = data.totalFiles || data.filesAnalyzed || data.filesScanned || data.ruleScopedFilesAnalyzed || 0;
    const badge = document.getElementById('aiContextBadge'); if (badge) { badge.textContent = issues === 0 ? 'CLEAR' : (crit > 0 || high > 0 ? 'ISSUES' : 'OK'); badge.style.background = issues === 0 ? 'rgba(34,197,94,0.18)' : (crit > 0 || high > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'); badge.style.color = issues === 0 ? '#4ade80' : (crit > 0 || high > 0 ? '#f87171' : '#fbbf24'); }
    const modelsEl = document.getElementById('aiContextModels'); if (modelsEl) modelsEl.textContent = models;
    const issuesEl = document.getElementById('aiContextIssues'); if (issuesEl) issuesEl.textContent = issues;
    const scoreEl = document.getElementById('aiContextScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.style.color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'; }
    const filesEl = document.getElementById('aiContextFiles'); if (filesEl) filesEl.textContent = files;
    const cEl = document.getElementById('aiContextCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('aiContextHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('aiContextMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('aiContextLow'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('aiContextCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('aiContextHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('aiContextMedium2'); if (mEl2) mEl2.textContent = med;
    const lEl2 = document.getElementById('aiContextLow2'); if (lEl2) lEl2.textContent = low;
  }
  function _updateSidebarUploadPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalFiles = data.totalFiles || data.filesAnalyzed || data.filesScanned || data.ruleScopedFilesAnalyzed || 0;
    const errors = crit + high;
    const valid = Math.max(0, totalFiles - errors);
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const autoScan = data.autoScan === true || data.autoScan === 'On' ? 'On' : 'Off';
    const totalFilesEl = document.getElementById('uploadTotalFiles'); if (totalFilesEl) totalFilesEl.textContent = totalFiles;
    const validEl = document.getElementById('uploadValid'); if (validEl) validEl.textContent = valid;
    const errorsEl = document.getElementById('uploadErrors'); if (errorsEl) errorsEl.textContent = errors;
    const scoreEl = document.getElementById('uploadScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.className = 'settings-kpi-value ' + (typeof score === 'number' && score >= 80 ? 'green' : typeof score === 'number' && score >= 50 ? 'amber' : 'red'); }
    const autoScanEl = document.getElementById('uploadAutoScan'); if (autoScanEl) autoScanEl.textContent = autoScan;
    const badge = document.getElementById('uploadStatusBadge'); if (badge) { badge.textContent = errors === 0 ? 'READY' : 'ISSUES'; badge.style.background = errors === 0 ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'; badge.style.color = errors === 0 ? '#4ade80' : '#f87171'; }
  }
  function _updateSidebarRepoHealthPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    let score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    score = typeof score === 'string' ? parseInt(score, 10) : score;
    score = typeof score === 'number' && !isNaN(score) ? score : '--';
    let files = data.totalFiles || data.filesScanned || data.filesAnalyzed || data.ruleScopedFilesAnalyzed || 0;
    files = typeof files === 'string' ? parseInt(files, 10) || 0 : files;
    const gate = data.gate;
    const gatePass = typeof gate === 'string' ? gate === 'PASS' || gate === 'Pass' : (gate && gate.pass != null ? gate.pass : true);
    const scoreEl = document.getElementById('repoHealthScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.className = 'settings-kpi-value ' + (typeof score === 'number' && score >= 80 ? 'green' : typeof score === 'number' && score >= 50 ? 'amber' : 'red'); }
    const gateEl = document.getElementById('repoHealthGate'); if (gateEl) { gateEl.textContent = gatePass ? 'PASS' : 'FAIL'; gateEl.className = 'settings-kpi-value ' + (gatePass ? 'green' : 'red'); }
    const issuesEl = document.getElementById('repoHealthTotalIssues'); if (issuesEl) { issuesEl.textContent = totalIssues; issuesEl.className = 'settings-kpi-value ' + (totalIssues === 0 ? 'green' : totalIssues < 10 ? 'amber' : 'red'); }
    const filesEl = document.getElementById('repoHealthFilesScanned'); if (filesEl) filesEl.textContent = files;
    const critEl = document.getElementById('repoHealthCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('repoHealthHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('repoHealthMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('repoHealthLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const badge = document.getElementById('repoHealthStatusBadge'); if (badge) { const ok = totalIssues === 0; badge.textContent = ok ? 'Ready' : (crit > 0 ? 'Critical' : 'Needs Attention'); badge.style.background = ok ? 'rgba(34,197,94,0.18)' : (crit > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'); badge.style.color = ok ? '#4ade80' : (crit > 0 ? '#f87171' : '#fbbf24'); }
    // Compute health metrics from score and severity counts
    var maintainability, reliability, complexity, duplication;
    if (typeof score === 'number') {
      maintainability = Math.max(0, Math.min(100, score - crit * 5 - high * 2));
      reliability = Math.max(0, Math.min(100, score - high * 3 - med));
      complexity = Math.max(0, Math.min(100, score - (totalIssues > 50 ? 20 : totalIssues > 20 ? 10 : 0)));
      duplication = Math.max(0, Math.min(100, score - low));
    }
    const maintainabilityEl = document.getElementById('repoHealthMaintainability'); if (maintainabilityEl) { maintainabilityEl.textContent = typeof maintainability === 'number' ? (maintainability >= 80 ? 'Good' : maintainability >= 50 ? 'Fair' : 'Poor') : '--'; maintainabilityEl.style.color = typeof maintainability === 'number' && maintainability >= 80 ? '#4ade80' : typeof maintainability === 'number' && maintainability >= 50 ? '#fbbf24' : '#f87171'; }
    const reliabilityEl = document.getElementById('repoHealthReliability'); if (reliabilityEl) { reliabilityEl.textContent = typeof reliability === 'number' ? (reliability >= 80 ? 'Stable' : reliability >= 50 ? 'Moderate' : 'At Risk') : '--'; reliabilityEl.style.color = typeof reliability === 'number' && reliability >= 80 ? '#4ade80' : typeof reliability === 'number' && reliability >= 50 ? '#fbbf24' : '#f87171'; }
    const complexityEl = document.getElementById('repoHealthComplexity'); if (complexityEl) { complexityEl.textContent = typeof complexity === 'number' ? (complexity >= 80 ? 'Low' : complexity >= 50 ? 'Moderate' : 'High') : '--'; complexityEl.style.color = typeof complexity === 'number' && complexity >= 80 ? '#4ade80' : typeof complexity === 'number' && complexity >= 50 ? '#fbbf24' : '#f87171'; }
    const duplicationEl = document.getElementById('repoHealthDuplication'); if (duplicationEl) { duplicationEl.textContent = typeof duplication === 'number' ? (duplication >= 80 ? 'Low' : duplication >= 50 ? 'Moderate' : 'High') : '--'; duplicationEl.style.color = typeof duplication === 'number' && duplication >= 80 ? '#4ade80' : typeof duplication === 'number' && duplication >= 50 ? '#fbbf24' : '#f87171'; }
    const findingsEl = document.getElementById('repoHealthFindings'); if (findingsEl) { while (findingsEl.firstChild) { findingsEl.removeChild(findingsEl.firstChild); } const row = document.createElement('div'); row.className = 'tc-list-item'; const span = document.createElement('span'); span.className = 'tc-list-name'; const healthyMsg = 'No issues detected. Repository looks healthy.'; const issuesMsg = crit + ' Critical, ' + high + ' High, ' + med + ' Medium, ' + low + ' Low issues detected.'; if (totalIssues === 0) { span.style.color = 'var(--vscode-descriptionForeground)'; span.textContent = healthyMsg; } else { span.textContent = issuesMsg; } row.appendChild(span); findingsEl.appendChild(row); }
    const recEl = document.getElementById('repoHealthRecommendations'); if (recEl) { recEl.textContent = totalIssues === 0 ? 'No action needed. Keep monitoring repository health.' : 'Review ' + totalIssues + ' issue' + (totalIssues === 1 ? '' : 's') + ' to improve repository health.'; }
  }
  function _updateSidebarAnalyticsPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = Number(sev.critical != null ? sev.critical : sev.Critical) || 0;
    const high = Number(sev.high != null ? sev.high : sev.High) || 0;
    const med = Number(sev.medium != null ? sev.medium : (sev.Medium != null ? sev.Medium : sev.med)) || 0;
    const low = Number(sev.low != null ? sev.low : sev.Low) || 0;
    const totalIssues = crit + high + med + low;
    const rawScore = [data.qualityScore, data.score, data.summary && data.summary.qualityScore, data.summary && data.summary.score].find(function (v) {
      return v != null && String(v).toLowerCase() !== '--' && !isNaN(Number(v));
    });
    const avgScore = rawScore !== undefined ? Number(rawScore) : '--';
    const rawFiles = [data.totalFiles, data.filesScanned, data.filesAnalyzed, data.ruleScopedFilesAnalyzed, data.repositoryFilesTotal, data.repositoryInventory && data.repositoryInventory.totalFiles, Array.isArray(data.files) ? data.files.length : null].find(function (v) {
      return v != null && String(v).toLowerCase() !== '--' && !isNaN(Number(v));
    });
    const files = Number(rawFiles) || 0;
    const rawScans = [data.scans, data.scanCount, data.totalScans].find(function (v) {
      return v != null && String(v).toLowerCase() !== '--' && !isNaN(Number(v));
    });
    const scans = Math.max(1, Number(rawScans) || 0);
    let last = data.lastScan || data.lastAudit || data.date || '--';
    if (last === '--' && data.generatedAt) {
      try { last = new Date(data.generatedAt).toLocaleString(); } catch (e) { last = '--'; }
    }
    const issuesFound = totalIssues || Number(data.issues) || data.issueCount || data.totalIssues || 0;
    const totalScansEl = document.getElementById('analyticsTotalScans'); if (totalScansEl) totalScansEl.textContent = String(scans);
    const issuesFoundEl = document.getElementById('analyticsIssuesFound'); if (issuesFoundEl) { issuesFoundEl.textContent = String(issuesFound); issuesFoundEl.className = 'settings-kpi-value ' + (issuesFound === 0 ? 'green' : issuesFound < 10 ? 'amber' : 'red'); }
    const avgScoreEl = document.getElementById('analyticsAvgScore'); if (avgScoreEl) { avgScoreEl.textContent = String(avgScore); avgScoreEl.className = 'settings-kpi-value ' + (typeof avgScore === 'number' && avgScore >= 80 ? 'green' : typeof avgScore === 'number' && avgScore >= 50 ? 'amber' : 'red'); }
    const filesScannedEl = document.getElementById('analyticsFilesScanned'); if (filesScannedEl) { filesScannedEl.textContent = String(files); filesScannedEl.className = 'settings-kpi-value ' + (files > 0 ? 'amber' : ''); }
    const lastScanEl = document.getElementById('analyticsLastScan'); if (lastScanEl) lastScanEl.textContent = last;
    const badge = document.getElementById('analyticsStatusBadge'); if (badge) { badge.textContent = totalIssues === 0 ? 'Ready' : 'Needs Review'; badge.style.background = totalIssues === 0 ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'; badge.style.color = totalIssues === 0 ? '#4ade80' : '#f87171'; }
    const critEl = document.getElementById('analyticsCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('analyticsHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('analyticsMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('analyticsLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const sevTotalEl = document.getElementById('analyticsSeverityTotal'); if (sevTotalEl) sevTotalEl.textContent = String(totalIssues);
    const stackCrit = document.getElementById('analyticsStackCritical'); if (stackCrit) stackCrit.style.width = totalIssues === 0 ? '0%' : ((crit / totalIssues) * 100) + '%';
    const stackHigh = document.getElementById('analyticsStackHigh'); if (stackHigh) stackHigh.style.width = totalIssues === 0 ? '0%' : ((high / totalIssues) * 100) + '%';
    const stackMed = document.getElementById('analyticsStackMedium'); if (stackMed) stackMed.style.width = totalIssues === 0 ? '0%' : ((med / totalIssues) * 100) + '%';
    const stackLow = document.getElementById('analyticsStackLow'); if (stackLow) stackLow.style.width = totalIssues === 0 ? '0%' : ((low / totalIssues) * 100) + '%';
    const sumFiles = document.getElementById('analyticsSummaryFilesScanned'); if (sumFiles) sumFiles.textContent = String(files);
    const sumAvg = document.getElementById('analyticsSummaryAvgScore'); if (sumAvg) sumAvg.textContent = String(avgScore);
  }
  function _updateSidebarTeamPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const gate = data.gate;
    const gatePass = typeof gate === 'string' ? gate === 'PASS' : (gate && gate.pass != null ? gate.pass : true);
    const scans = data.scans != null ? data.scans : (data.scanCount != null ? data.scanCount : 1);
    const members = data.members != null ? data.members : 1;
    const resolved = data.resolved != null ? data.resolved : 0;
    const teamScore = typeof score === 'number' ? score : 100;
    const membersEl = document.getElementById('teamMembers'); if (membersEl) membersEl.textContent = members;
    const scansEl = document.getElementById('teamScans'); if (scansEl) scansEl.textContent = scans;
    const resolvedEl = document.getElementById('teamResolved'); if (resolvedEl) { resolvedEl.textContent = resolved; resolvedEl.className = 'settings-kpi-value ' + (resolved > 0 ? 'green' : 'green'); }
    const teamScoreEl = document.getElementById('teamScore'); if (teamScoreEl) { teamScoreEl.textContent = teamScore; teamScoreEl.className = 'settings-kpi-value ' + (teamScore >= 80 ? 'green' : teamScore >= 50 ? 'amber' : 'red'); }
    const badge = document.getElementById('teamStatusBadge'); if (badge) { const activeText = 'Active'; badge.textContent = activeText; badge.style.background = 'rgba(34,197,94,0.18)'; badge.style.color = '#4ade80'; }
    const critEl = document.getElementById('teamCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('teamHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('teamMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('teamLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const qualityScore = document.getElementById('teamQualityScore'); if (qualityScore) qualityScore.textContent = teamScore;
    const totalIssuesEl = document.getElementById('teamTotalIssues'); if (totalIssuesEl) totalIssuesEl.textContent = totalIssues;
    const gateEl = document.getElementById('teamGateStatus'); if (gateEl) { gateEl.textContent = gatePass ? 'PASS' : 'FAIL'; gateEl.style.color = gatePass ? '#4ade80' : '#f87171'; }
    const list = document.getElementById('teamMembersList'); if (list) { while (list.firstChild) { list.removeChild(list.firstChild); } const memberList = Array.isArray(data.teamMembers) ? data.teamMembers : [{ name: 'Admin', role: 'Project Owner', status: 'Active', initial: 'A' }]; memberList.forEach(function(m) { const row = document.createElement('div'); row.className = 'tc-list-item'; const avatar = document.createElement('div'); avatar.className = 'tc-list-avatar'; avatar.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#0ea5e9;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:13px;'; avatar.textContent = (m.initial || m.name.charAt(0).toUpperCase()); row.appendChild(avatar); const left = document.createElement('div'); left.className = 'tc-list-item-left'; const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = m.name; const sub = document.createElement('span'); sub.className = 'tc-list-sub'; sub.style.color = 'var(--vscode-descriptionForeground)'; sub.textContent = m.role; left.appendChild(name); left.appendChild(sub); row.appendChild(left); const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.style.color = m.status === 'Active' ? '#4ade80' : 'var(--vscode-descriptionForeground)'; meta.textContent = m.status; row.appendChild(meta); list.appendChild(row); }); }
  }
  function _updateSidebarPlatformPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const gate = data.gate;
    const gatePass = typeof gate === 'string' ? gate === 'PASS' : (gate && gate.pass != null ? gate.pass : true);
    const platformData = data.platform || {};
    const version = platformData.version || data.extensionVersion || '3.0.309';
    const engine = platformData.engine || 'VS Code';
    const uptime = platformData.uptime || 'Active';
    const status = platformData.status || 'Connected';
    const os = platformData.os || 'win32';
    const node = platformData.node || 'v22.21.1';
    const workspace = platformData.workspace || data.workspacePath || 'c:\Users\Trevor\CascadeProjects';
    const versionEl = document.getElementById('platformVersion'); if (versionEl) versionEl.textContent = version;
    const engineEl = document.getElementById('platformEngine'); if (engineEl) engineEl.textContent = engine;
    const uptimeEl = document.getElementById('platformUptime'); if (uptimeEl) uptimeEl.textContent = uptime;
    const statusEl = document.getElementById('platformStatus'); if (statusEl) statusEl.textContent = status;
    const badge = document.getElementById('platformStatusBadge'); if (badge) { badge.textContent = status === 'Connected' ? 'Online' : status; badge.style.background = status === 'Connected' ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = status === 'Connected' ? '#4ade80' : '#fbbf24'; }
    const critEl = document.getElementById('platformCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('platformHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('platformMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('platformLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const qualityScore = document.getElementById('platformQualityScore'); if (qualityScore) qualityScore.textContent = score;
    const totalIssuesEl = document.getElementById('platformTotalIssues'); if (totalIssuesEl) totalIssuesEl.textContent = totalIssues;
    const gateEl = document.getElementById('platformGateStatus'); if (gateEl) { gateEl.textContent = gatePass ? 'PASS' : 'FAIL'; gateEl.style.color = gatePass ? '#4ade80' : '#f87171'; }
    const osEl = document.getElementById('platformOs'); if (osEl) osEl.textContent = os;
    const nodeEl = document.getElementById('platformNode'); if (nodeEl) nodeEl.textContent = node;
    const extEl = document.getElementById('platformExtension'); if (extEl) extEl.textContent = version;
    const wsEl = document.getElementById('platformWorkspace'); if (wsEl) wsEl.textContent = workspace;
  }
  function _updateSidebarCertificatePanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gate = data.gate;
    const gatePass = typeof gate === 'string' ? gate === 'PASS' : (gate && gate.pass != null ? gate.pass : true);
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const files = data.totalFiles || data.filesScanned || data.filesAnalyzed || data.ruleScopedFilesAnalyzed || 0;
    const modules = data.modulesPassed || data.certModulesPassed || 0;
    const lastAudit = data.lastAudit || data.lastScan || data.date || '--';
    const expiry = data.expiryDate || data.certificateExpiry || '--';
    const badge = document.getElementById('certificateBadge'); if (badge) { badge.textContent = gatePass ? 'PASS' : 'FAIL'; badge.style.background = gatePass ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'; badge.style.color = gatePass ? '#4ade80' : '#f87171'; }
    const scoreEl = document.getElementById('certificateComplianceScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.className = 'settings-kpi-value ' + (score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red'); }
    const modulesEl = document.getElementById('certificateModulesPassed'); if (modulesEl) modulesEl.textContent = modules;
    const lastAuditEl = document.getElementById('certificateLastAudit'); if (lastAuditEl) lastAuditEl.textContent = lastAudit;
    const expiryEl = document.getElementById('certificateExpiryDate'); if (expiryEl) expiryEl.textContent = expiry;
    const cEl = document.getElementById('certificateCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('certificateHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('certificateMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('certificateLow'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('certificateCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('certificateHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('certificateMedium2'); if (mEl2) mEl2.textContent = med;
    const lEl2 = document.getElementById('certificateLow2'); if (lEl2) lEl2.textContent = low;
    const filesEl = document.getElementById('certificateRepoFiles'); if (filesEl) filesEl.textContent = files;
    const gateEl = document.getElementById('certificateGateChecked'); if (gateEl) gateEl.textContent = gatePass ? 'PASS' : 'FAIL';
    const lastScanEl = document.getElementById('certificateLastScan'); if (lastScanEl) lastScanEl.textContent = lastAudit;
  }
  function _updateSidebarCodeMapPanel(data) {
    const files = data.totalFiles || data.filesScanned || data.filesAnalyzed || data.ruleScopedFilesAnalyzed || 0;
    const modules = data.totalModules || data.modules || 0;
    const lines = data.totalLines || data.lines || 0;
    const lastScan = data.lastScan || data.date || '--';
    const generated = data.codeMapGenerated || data.generated || false;
    const status = generated ? 'GENERATED' : (files > 0 ? 'PENDING' : 'NOT GENERATED');
    const badge = document.getElementById('codeMapStatusBadge'); if (badge) { badge.textContent = status; badge.style.background = generated ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = generated ? '#4ade80' : '#fbbf24'; }
    const filesEl = document.getElementById('codeMapFiles'); if (filesEl) filesEl.textContent = files;
    const modulesEl = document.getElementById('codeMapModules'); if (modulesEl) modulesEl.textContent = modules;
    const linesEl = document.getElementById('codeMapTotalLines'); if (linesEl) linesEl.textContent = lines;
    const linesEl2 = document.getElementById('codeMapTotalLines2'); if (linesEl2) linesEl2.textContent = lines;
    const lastScanEl = document.getElementById('codeMapLastScan'); if (lastScanEl) lastScanEl.textContent = lastScan;
    const lastScanEl2 = document.getElementById('codeMapLastScan2'); if (lastScanEl2) lastScanEl2.textContent = lastScan;
    const repoFilesEl = document.getElementById('codeMapRepoFiles'); if (repoFilesEl) repoFilesEl.textContent = files;
    const isPaid = data.isPaidTier === true || _isAdminAccount() || !_isFreeTier();
    const detailSections = document.querySelectorAll('.code-map-detail-section');
    detailSections.forEach(function(s) { s.style.display = isPaid ? '' : 'none'; });
    if (!isPaid) return;
    const list = document.getElementById('codeMapLanguagesList');
    if (list && data.languages) {
      const langs = Array.isArray(data.languages) ? data.languages : Object.entries(data.languages).map(function(e) { return { name: e[0], count: typeof e[1] === 'number' ? e[1] : e[1].count || 0 }; });
      const max = Math.max(1, langs.reduce(function(m, l) { return Math.max(m, l.count || 0); }, 0));
      const colors = ['#4ade80','#60a5fa','#a78bfa','#f87171','#fbbf24','#22d3ee','#f472b6','#fb923c'];
      list.replaceChildren();
      langs.forEach(function(l, i) {
        const pct = Math.round((l.count / max) * 100);
        const color = colors[i % colors.length];
        const row = document.createElement('div'); row.className = 'code-map-lang-row';
        const name = document.createElement('span'); name.className = 'code-map-lang-name'; name.textContent = l.name;
        const bar = document.createElement('div'); bar.className = 'code-map-lang-bar';
        const fill = document.createElement('div'); fill.className = 'code-map-lang-fill'; fill.style.width = pct + '%'; fill.style.background = color;
        bar.appendChild(fill);
        const count = document.createElement('span'); count.className = 'code-map-lang-count'; count.textContent = l.count;
        row.appendChild(name); row.appendChild(bar); row.appendChild(count);
        list.appendChild(row);
      });
    }
  }
  function _updateSidebarRoadmapPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const openVulns = data.openVulnerabilities != null ? data.openVulnerabilities : (data.issues != null ? data.issues : (crit + high + med + low)) || 0;
    const riskScore = data.riskScore != null ? data.riskScore : (data.risk != null ? data.risk : (data.healthScore != null ? data.healthScore : 0));
    const completed = data.completedTasks != null ? data.completedTasks : (data.completed != null ? data.completed : 0);
    const targetDate = data.targetDate || data.target || '7/26/2026';
    const openVulnsEl = document.getElementById('roadmapOpenVulns'); if (openVulnsEl) openVulnsEl.textContent = openVulns;
    const riskScoreEl = document.getElementById('roadmapRiskScore'); if (riskScoreEl) riskScoreEl.textContent = riskScore;
    const completedEl = document.getElementById('roadmapCompleted'); if (completedEl) completedEl.textContent = completed;
    const targetDateEl = document.getElementById('roadmapTargetDate'); if (targetDateEl) targetDateEl.textContent = targetDate;
    const critEl = document.getElementById('roadmapCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('roadmapHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('roadmapMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('roadmapLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const phaseList = document.getElementById('roadmapPhasesList');
    if (!phaseList) return;
    let phases = data.phases;
    if (!phases || !Array.isArray(phases) || phases.length === 0) {
      phases = [
        { name: 'Phase 1: Triage & Assessment', completed: 0, total: 0 },
        { name: 'Phase 2: Short-Term Fixes', completed: 0, total: 0 },
        { name: 'Phase 3: Long-Term Architecture', completed: 0, total: 50 }
      ];
    }
    phaseList.textContent = '';
    phases.forEach(function(p) {
      let completed = 0, total = 0, name = '';
      if (p.taskSummary) {
        completed = p.taskSummary.done || 0;
        total = p.taskSummary.total || 0;
      } else {
        completed = p.completed != null ? p.completed : 0;
        total = p.total != null ? p.total : 0;
      }
      name = p.name || p.title || p.label || 'Phase';
      const row = document.createElement('div');
      row.className = 'roadmap-phase-row';
      const dot = document.createElement('span');
      dot.className = 'roadmap-phase-dot';
      const nameEl = document.createElement('span');
      nameEl.className = 'roadmap-phase-name';
      nameEl.textContent = name;
      const tasksEl = document.createElement('span');
      tasksEl.className = 'roadmap-phase-tasks';
      tasksEl.textContent = completed + ' / ' + total + ' tasks';
      row.appendChild(dot);
      row.appendChild(nameEl);
      row.appendChild(tasksEl);
      phaseList.appendChild(row);
    });
  }
  function _updateSidebarProfilePanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const scans = data.scans || data.totalScans || 1;
    const reports = data.reports || data.totalReports || 1;
    const avgScore = data.avgScore || score;
    const critEl = document.getElementById('profileCritical'); if (critEl) critEl.textContent = crit + ' Critical';
    const highEl = document.getElementById('profileHigh'); if (highEl) highEl.textContent = high + ' High';
    const medEl = document.getElementById('profileMedium'); if (medEl) medEl.textContent = med + ' Med';
    const lowEl = document.getElementById('profileLow'); if (lowEl) lowEl.textContent = low + ' Low';
    const critCountEl = document.getElementById('profileCritCount'); if (critCountEl) critCountEl.textContent = crit;
    const highCountEl = document.getElementById('profileHighCount'); if (highCountEl) highCountEl.textContent = high;
    const medCountEl = document.getElementById('profileMedCount'); if (medCountEl) medCountEl.textContent = med;
    const lowCountEl = document.getElementById('profileLowCount'); if (lowCountEl) lowCountEl.textContent = low;
    const qualityScoreEl = document.getElementById('profileQualityScore'); if (qualityScoreEl) qualityScoreEl.textContent = score;
    const issuesFoundEl = document.getElementById('profileIssuesFound'); if (issuesFoundEl) issuesFoundEl.textContent = totalIssues;
    const gateStatusEl = document.getElementById('profileGateStatus'); if (gateStatusEl) { gateStatusEl.textContent = gate; gateStatusEl.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const scansRunEl = document.getElementById('profileScansRun'); if (scansRunEl) scansRunEl.textContent = scans;
    const reportsEl = document.getElementById('profileReports'); if (reportsEl) reportsEl.textContent = reports;
    const activityIssuesEl = document.getElementById('profileActivityIssues'); if (activityIssuesEl) activityIssuesEl.textContent = totalIssues;
    const avgScoreEl = document.getElementById('profileAvgScore'); if (avgScoreEl) avgScoreEl.textContent = avgScore;
  }
  function _updateSidebarAuditPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const badge = document.getElementById('auditPassBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const vuln = document.getElementById('auditVulnerabilities'); if (vuln) vuln.textContent = crit + high + med + low;
    const secrets = document.getElementById('auditSecrets'); if (secrets) secrets.textContent='0';
    const checks = document.getElementById('auditChecksPassed'); if (checks) checks.textContent = gate === 'PASS' ? '100' : gate === 'FAIL' ? '0' : '--';
    const auditScore = document.getElementById('auditScore'); if (auditScore) auditScore.textContent = score;
    const cEl = document.getElementById('auditCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('auditHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('auditMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('auditLow'); if (lEl) lEl.textContent = low;
    const findingsList = document.getElementById('auditFindingsList'); if (findingsList) {
      findingsList.textContent='';
      const findings = data.detectedIssues || data.findings || [];
      if (findings.length === 0) {
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot green';
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent='No new findings';
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent='0';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); findingsList.appendChild(row);
      } else {
        findings.slice(0,5).forEach(function(f){
          const row = document.createElement('div'); row.className = 'tc-list-item';
          const left = document.createElement('div'); left.className = 'tc-list-item-left';
          const dot = document.createElement('span'); dot.className = 'tc-list-dot ' + (f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'amber' : f.severity === 'medium' ? 'blue' : 'green');
          const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = f.title || f.type || 'Finding';
          const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = f.severity || 'low';
          left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); findingsList.appendChild(row);
        });
      }
    }
  }
  function _updateSidebarTrustPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const badge = document.getElementById('trustVerifiedBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'VERIFIED' : gate === 'FAIL' ? 'FAILED' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const scoreEl = document.getElementById('trustScore'); if (scoreEl) scoreEl.textContent = score;
    const verifiedEl = document.getElementById('trustVerified'); if (verifiedEl) verifiedEl.textContent = gate === 'PASS' ? 'Yes' : 'No';
    const warningsEl = document.getElementById('trustWarnings'); if (warningsEl) warningsEl.textContent = crit + high + med;
    const lastAuditEl = document.getElementById('trustLastAudit'); if (lastAuditEl) { const now = new Date(); lastAuditEl.textContent = (now.getMonth()+1) + '/' + now.getDate() + '/' + now.getFullYear(); }
    const cEl = document.getElementById('trustCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('trustHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('trustMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('trustLow'); if (lEl) lEl.textContent = low;
    const statusList = document.getElementById('trustStatusList'); if (statusList) {
      statusList.textContent='';
      const findings = data.detectedIssues || data.findings || [];
      if (findings.length === 0) {
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot green';
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent='All checks passed';
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent='OK';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); statusList.appendChild(row);
      } else {
        findings.slice(0,5).forEach(function(f){
          const row = document.createElement('div'); row.className = 'tc-list-item';
          const left = document.createElement('div'); left.className = 'tc-list-item-left';
          const dot = document.createElement('span'); dot.className = 'tc-list-dot ' + (f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'amber' : f.severity === 'medium' ? 'blue' : 'green');
          const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = f.title || f.type || 'Check';
          const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = f.severity || 'low';
          left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); statusList.appendChild(row);
        });
      }
    }
  }
  function _updateSidebarCompliancePanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const badge = document.getElementById('complianceBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const passed = (crit + high + med === 0 ? 5 : Math.max(0, 5 - (crit + high)));
    const failed = 5 - passed;
    const progress = passed === 5 ? '100%' : (passed * 20) + '%';
    const passedEl = document.getElementById('compliancePassed'); if (passedEl) passedEl.textContent = passed;
    const failedEl = document.getElementById('complianceFailed'); if (failedEl) failedEl.textContent = failed;
    const progressEl = document.getElementById('complianceProgress'); if (progressEl) progressEl.textContent = progress;
    const totalEl = document.getElementById('complianceTotalRules'); if (totalEl) totalEl.textContent='5';
    const cEl = document.getElementById('complianceCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('complianceHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('complianceMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('complianceLow'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('complianceCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('complianceHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('complianceMedium2'); if (mEl2) mEl2.textContent = med;
    const lEl2 = document.getElementById('complianceLow2'); if (lEl2) lEl2.textContent = low;
    const requirements = [
      { name: 'No sensitive data in logs', severity: crit > 0 ? 'critical' : 'green' },
      { name: 'Dependency compliance', severity: med > 0 ? 'medium' : 'green' },
      { name: 'Code of conduct present', severity: 'green' },
      { name: 'Security policy defined', severity: high > 0 ? 'high' : 'green' },
      { name: 'Contributing guidelines', severity: 'green' }
    ];
    const list = document.getElementById('complianceRequirementsList'); if (list) {
      list.textContent='';
      requirements.forEach(function(r){
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot ' + (r.severity === 'critical' ? 'red' : r.severity === 'high' ? 'amber' : r.severity === 'medium' ? 'blue' : 'green');
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = r.name;
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = r.severity === 'green' ? 'Pass' : 'Pending';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); list.appendChild(row);
      });
    }
  }
  function _updateSidebarQualityPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const issues = crit + high + med + low;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : 100);
    const badge = document.getElementById('qualityBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const scoreEl = document.getElementById('qualityScore'); if (scoreEl) { scoreEl.textContent = score; scoreEl.style.color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'; }
    const progress = document.getElementById('qualityScoreProgress'); if (progress) { const color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171'; const offset = 264 - ((score / 100) * 264); progress.style.stroke = color; progress.style.strokeDashoffset = offset; }
    const issuesEl = document.getElementById('qualityIssues'); if (issuesEl) { issuesEl.textContent = issues; issuesEl.className = 'settings-kpi-value ' + (issues === 0 ? 'green' : issues < 10 ? 'amber' : 'red'); }
    const filesEl = document.getElementById('qualityFiles'); if (filesEl) { filesEl.textContent = data.totalFiles || data.filesAnalyzed || data.ruleScopedFilesAnalyzed || 0; filesEl.className = 'settings-kpi-value blue'; }
    const sevTotalEl = document.getElementById('qualitySeverityTotal'); if (sevTotalEl) sevTotalEl.textContent = issues;
    const stackCrit = document.getElementById('qualityStackCritical'); if (stackCrit) stackCrit.style.width = issues === 0 ? '0%' : ((crit / issues) * 100) + '%';
    const stackHigh = document.getElementById('qualityStackHigh'); if (stackHigh) stackHigh.style.width = issues === 0 ? '0%' : ((high / issues) * 100) + '%';
    const stackMed = document.getElementById('qualityStackMedium'); if (stackMed) stackMed.style.width = issues === 0 ? '0%' : ((med / issues) * 100) + '%';
    const stackLow = document.getElementById('qualityStackLow'); if (stackLow) stackLow.style.width = issues === 0 ? '0%' : ((low / issues) * 100) + '%';
    const cEl = document.getElementById('qualityCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('qualityHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('qualityMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('qualityLow'); if (lEl) lEl.textContent = low;
    const dims = [
      { name: 'Maintainability', score: score, id: 'Maintainability' },
      { name: 'Reliability', score: score >= 80 ? Math.max(80, score - 5) : score, id: 'Reliability' },
      { name: 'Complexity', score: score >= 80 ? Math.max(80, score - 2) : score, id: 'Complexity' },
      { name: 'Duplication', score: score >= 80 ? Math.max(80, score - 5) : score, id: 'Duplication' }
    ];
    dims.forEach(function(d){
      const scoreE = document.getElementById('quality' + d.id); if (scoreE) { scoreE.textContent = d.score; scoreE.className = 'quality-dim-score ' + (d.score >= 80 ? 'green' : d.score >= 50 ? 'amber' : 'red'); }
      const barE = document.getElementById('quality' + d.id + 'Bar'); if (barE) { barE.style.width = d.score + '%'; barE.style.background = d.score >= 80 ? '#4ade80' : d.score >= 50 ? '#fbbf24' : '#f87171'; }
    });
  }
  function _updateSidebarAssessmentsPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    const score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    const badge = document.getElementById('assessmentsBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const completed = (gate === 'PASS' ? 2 : 0);
    const pending = (gate === 'PASS' ? 0 : 2);
    const total = 2;
    const progress = gate === 'PASS' ? total : 0;
    const completedEl = document.getElementById('assessmentsCompleted'); if (completedEl) completedEl.textContent = completed;
    const pendingEl = document.getElementById('assessmentsPending'); if (pendingEl) pendingEl.textContent = pending;
    const progressEl = document.getElementById('assessmentsProgress'); if (progressEl) progressEl.textContent = progress;
    const totalEl = document.getElementById('assessmentsTotalChecks'); if (totalEl) totalEl.textContent = total;
    const cEl = document.getElementById('assessmentsCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('assessmentsHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('assessmentsMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('assessmentsLow'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('assessmentsCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('assessmentsHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('assessmentsMedium2'); if (mEl2) mEl2.textContent = med;
    const lEl2 = document.getElementById('assessmentsLow2'); if (lEl2) lEl2.textContent = low;
    const completionEl = document.getElementById('assessmentsCompletion'); if (completionEl) completionEl.textContent = (gate === 'PASS' ? '100' : '0') + '%';
    const checklist = document.getElementById('assessmentsChecklist'); if (checklist) {
      checklist.textContent='';
      const qualityRow = document.createElement('div'); qualityRow.className = 'tc-list-item';
      const qualityLeft = document.createElement('div'); qualityLeft.className = 'tc-list-item-left';
      const qualityDot = document.createElement('span'); qualityDot.className = 'tc-list-dot ' + (gate === 'PASS' ? 'green' : 'amber');
      const qualityName = document.createElement('span'); qualityName.className = 'tc-list-name'; qualityName.textContent='Code quality gate passed';
      const qualityMeta = document.createElement('span'); qualityMeta.className = 'tc-list-meta'; qualityMeta.textContent = gate === 'PASS' ? 'Done' : 'Pending';
      qualityLeft.appendChild(qualityDot); qualityLeft.appendChild(qualityName); qualityRow.appendChild(qualityLeft); qualityRow.appendChild(qualityMeta); checklist.appendChild(qualityRow);
      const securityRow = document.createElement('div'); securityRow.className = 'tc-list-item';
      const securityLeft = document.createElement('div'); securityLeft.className = 'tc-list-item-left';
      const securityDot = document.createElement('span'); securityDot.className = 'tc-list-dot ' + (crit + high + med === 0 ? 'green' : 'amber');
      const securityName = document.createElement('span'); securityName.className = 'tc-list-name'; securityName.textContent='Security scan completed';
      const securityMeta = document.createElement('span'); securityMeta.className = 'tc-list-meta'; securityMeta.textContent = crit + high + med === 0 ? 'Done' : 'Pending';
      securityLeft.appendChild(securityDot); securityLeft.appendChild(securityName); securityRow.appendChild(securityLeft); securityRow.appendChild(securityMeta); checklist.appendChild(securityRow);
    }
  }
  function _updateSidebarSecurityPanel(data) {
    const sev = data.severity || data.severityCounts || {};
    const crit = sev.critical || sev.Critical || 0;
    const high = sev.high || sev.High || 0;
    const med = sev.medium || sev.Medium || sev.med || 0;
    const low = sev.low || sev.Low || 0;
    const totalIssues = crit + high + med + low;
    const gateRaw = data.gate;
    const gate = typeof gateRaw === 'string' ? gateRaw : (gateRaw && gateRaw.pass != null ? (gateRaw.pass ? 'PASS' : 'FAIL') : 'Pending');
    let score = data.qualityScore != null ? data.qualityScore : (data.score != null ? data.score : '--');
    score = typeof score === 'string' ? parseInt(score, 10) : score;
    score = typeof score === 'number' && !isNaN(score) ? score : '--';
    const badge = document.getElementById('securityPassBadge'); if (badge) { badge.textContent = gate === 'PASS' ? 'PASS' : gate === 'FAIL' ? 'FAIL' : 'PENDING'; badge.style.background = gate === 'PASS' ? 'rgba(34,197,94,0.18)' : gate === 'FAIL' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'; badge.style.color = gate === 'PASS' ? '#4ade80' : gate === 'FAIL' ? '#f87171' : '#fbbf24'; }
    const cEl = document.getElementById('securityCritical'); if (cEl) cEl.textContent = crit;
    const hEl = document.getElementById('securityHigh'); if (hEl) hEl.textContent = high;
    const mEl = document.getElementById('securityMedium'); if (mEl) mEl.textContent = med;
    const lEl = document.getElementById('securityLow2'); if (lEl) lEl.textContent = low;
    const cEl2 = document.getElementById('securityCritical2'); if (cEl2) cEl2.textContent = crit;
    const hEl2 = document.getElementById('securityHigh2'); if (hEl2) hEl2.textContent = high;
    const mEl2 = document.getElementById('securityMedium2'); if (mEl2) mEl2.textContent = med;
    const securityScore = document.getElementById('securityScore'); if (securityScore) { securityScore.textContent = score; securityScore.className = 'settings-kpi-value ' + (typeof score === 'number' && score >= 80 ? 'green' : typeof score === 'number' && score >= 50 ? 'amber' : 'red'); }
    const sevTotalEl = document.getElementById('securitySeverityTotal'); if (sevTotalEl) sevTotalEl.textContent = totalIssues;
    const stackCrit = document.getElementById('securityStackCritical'); if (stackCrit) stackCrit.style.width = totalIssues === 0 ? '0%' : ((crit / totalIssues) * 100) + '%';
    const stackHigh = document.getElementById('securityStackHigh'); if (stackHigh) stackHigh.style.width = totalIssues === 0 ? '0%' : ((high / totalIssues) * 100) + '%';
    const stackMed = document.getElementById('securityStackMedium'); if (stackMed) stackMed.style.width = totalIssues === 0 ? '0%' : ((med / totalIssues) * 100) + '%';
    const stackLow = document.getElementById('securityStackLow'); if (stackLow) stackLow.style.width = totalIssues === 0 ? '0%' : ((low / totalIssues) * 100) + '%';
    const threatsList = document.getElementById('securityThreatsList'); if (threatsList) {
      threatsList.textContent='';
      const findings = data.detectedIssues || data.findings || [];
      if (findings.length === 0) {
        const row = document.createElement('div'); row.className = 'tc-list-item';
        const left = document.createElement('div'); left.className = 'tc-list-item-left';
        const dot = document.createElement('span'); dot.className = 'tc-list-dot green';
        const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent='No threats detected';
        const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent='0';
        left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); threatsList.appendChild(row);
      } else {
        findings.slice(0,5).forEach(function(f){
          const row = document.createElement('div'); row.className = 'tc-list-item';
          const left = document.createElement('div'); left.className = 'tc-list-item-left';
          const dot = document.createElement('span'); dot.className = 'tc-list-dot ' + (f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'amber' : f.severity === 'medium' ? 'blue' : 'green');
          const name = document.createElement('span'); name.className = 'tc-list-name'; name.textContent = f.title || f.type || 'Threat';
          const meta = document.createElement('span'); meta.className = 'tc-list-meta'; meta.textContent = f.severity || 'low';
          left.appendChild(dot); left.appendChild(name); row.appendChild(left); row.appendChild(meta); threatsList.appendChild(row);
        });
      }
    }
  }
  window.addEventListener('message', function(e) {
    const msg = e.data; if (!msg) return;
    if (msg.command === 'updateStatus') {
      const st = document.getElementById('statusText');
      const ic = document.getElementById('statusIcon');
      const bar = document.getElementById('scanProgressBar');
      const pct = document.getElementById('scanProgressPct');
      if (st) st.textContent = msg.text || 'Ready';
      if (ic) { ic.className = 'card-icon ' + (msg.status === 'error' ? 'error' : msg.status === 'scanning' ? 'scanning' : 'ok'); ic.textContent = msg.status === 'error' ? '✖' : msg.status === 'scanning' ? '⚠' : '✔'; }
      if (bar) {
        if (msg.status === 'scanning') { bar.classList.add('indeterminate'); }
        else { bar.classList.remove('indeterminate'); bar.style.width = '0%'; }
      }
      if (pct) { if (msg.status !== 'scanning') pct.textContent='0%'; }
    }
    if (msg.command === 'scanProgress') {
      const bar = document.getElementById('scanProgressBar');
      const pct = document.getElementById('scanProgressPct');
      const val = Math.max(0, Math.min(100, msg.percentage || 0));
      if (bar) { bar.classList.remove('indeterminate'); bar.style.width = val + '%'; }
      if (pct) pct.textContent = val + '%';
    }
    if (msg.command === 'updateAuditData') {
      _updateSidebarAuditPanel(msg);
      _updateSidebarSecurityPanel(msg);
      _updateSidebarTrustPanel(msg);
      _updateSidebarQualityPanel(msg);
      _updateSidebarAssessmentsPanel(msg);
      _updateSidebarCompliancePanel(msg);
      _updateSidebarScanPanel(msg);
      _updateSidebarAiContextPanel(msg);
      _updateSidebarCertificatePanel(msg);
      _updateSidebarProfilePanel(msg);
      _updateSidebarUploadPanel(msg);
      _updateSidebarRepoHealthPanel(msg);
      _updateSidebarAnalyticsPanel(msg);
      _updateSidebarTeamPanel(msg);
      _updateSidebarPlatformPanel(msg);
    }
    if (msg.command === 'updateCodeMap') {
      _updateSidebarCodeMapPanel(msg);
    }
    if (msg.command === 'updateAnalytics') {
      _updateSidebarAnalyticsPanel(msg);
    }
    if (msg.command === 'updateRoadmap') {
      _updateSidebarRoadmapPanel(msg);
    }
    if (msg.command === 'updateServerUrl') { const el = document.getElementById('serverUrlText'); if (el) el.textContent = msg.url || 'http://127.0.0.1:55000'; const setEl = document.getElementById('settingsServerUrl'); if (setEl) setEl.textContent = msg.url || 'http://127.0.0.1:55000'; const settingsDropdownUrl = document.getElementById('settingsServerUrlText'); if (settingsDropdownUrl) settingsDropdownUrl.textContent = msg.url || 'http://127.0.0.1:55000'; const settingsApiInputTab = document.getElementById('settingsApiInputTab'); if (settingsApiInputTab) settingsApiInputTab.value = msg.url || 'http://127.0.0.1:55000'; } // simplebeacon-ignore config-drift — fallback to default if not set
    if (msg.command === 'updateDashboard') {
      const gateEl = document.getElementById('dashGateText');
      const issuesEl = document.getElementById('dashIssuesText');
      const scoreEl = document.getElementById('dashScoreText');
      const sidebarRepoFilesEl = document.getElementById('sidebarRepoFiles');
      if (gateEl) gateEl.textContent = msg.gate || 'Pending';
      if (issuesEl) issuesEl.textContent = msg.issues || '0';
      if (scoreEl) scoreEl.textContent = msg.score || '--';
      if (sidebarRepoFilesEl) sidebarRepoFilesEl.textContent = msg.repoFiles || '--';
      const dbGate = document.getElementById('dbGateVal');
      const dbScore = document.getElementById('dbScoreVal');
      const dbIssues = document.getElementById('dbIssuesVal');
      const dbCrit = document.getElementById('dbCritCount');
      const dbHigh = document.getElementById('dbHighCount');
      const dbMed = document.getElementById('dbMedCount');
      const dbLow = document.getElementById('dbLowCount');
      if (dbGate) dbGate.textContent = msg.gate || 'Pending';
      if (dbScore) dbScore.textContent = msg.score || '--';
      if (dbIssues) dbIssues.textContent = msg.issues || '0';
      if (dbCrit) { dbCrit.textContent = msg.critical || '0'; document.getElementById('dbCritLabel').textContent = (msg.critical || '0') + ' Critical'; }
      if (dbHigh) { dbHigh.textContent = msg.high || '0'; document.getElementById('dbHighLabel').textContent = (msg.high || '0') + ' High'; }
      if (dbMed) { dbMed.textContent = msg.medium || '0'; document.getElementById('dbMedLabel').textContent = (msg.medium || '0') + ' Med'; }
      if (dbLow) { dbLow.textContent = msg.low || '0'; document.getElementById('dbLowLabel').textContent = (msg.low || '0') + ' Low'; }
    }
    if (msg.command === 'updateReport' && !msg.report) {
      const dbGate = document.getElementById('dbGateVal');
      const dbScore = document.getElementById('dbScoreVal');
      const dbIssues = document.getElementById('dbIssuesVal');
      const dbCrit = document.getElementById('dbCritCount');
      const dbHigh = document.getElementById('dbHighCount');
      const dbMed = document.getElementById('dbMedCount');
      const dbLow = document.getElementById('dbLowCount');
      const dbRepo = document.getElementById('dbRepoFiles');
      const dbGateChk = document.getElementById('dbGateChecked');
      if (dbGate) dbGate.textContent='Pending';
      if (dbScore) dbScore.textContent='--';
      if (dbIssues) dbIssues.textContent='0';
      if (dbCrit) { dbCrit.textContent='0'; document.getElementById('dbCritLabel').textContent='0 Critical'; }
      if (dbHigh) { dbHigh.textContent='0'; document.getElementById('dbHighLabel').textContent='0 High'; }
      if (dbMed) { dbMed.textContent='0'; document.getElementById('dbMedLabel').textContent='0 Med'; }
      if (dbLow) { dbLow.textContent='0'; document.getElementById('dbLowLabel').textContent='0 Low'; }
      if (dbRepo) dbRepo.textContent='--';
      if (dbGateChk) dbGateChk.textContent='--';
      const dashGate = document.getElementById('dashGateText');
      const dashIssues = document.getElementById('dashIssuesText');
      const dashScore = document.getElementById('dashScoreText');
      if (dashGate) dashGate.textContent='Pending';
      if (dashIssues) dashIssues.textContent='0';
      if (dashScore) dashScore.textContent='--';
      const sidebarRepoFiles = document.getElementById('sidebarRepoFiles');
      if (sidebarRepoFiles) sidebarRepoFiles.textContent='--';
      const aScoreClr = document.getElementById('analyzeScoreCard');
      const aGateClr = document.getElementById('analyzeGateCard');
      const aIssuesClr = document.getElementById('analyzeIssuesCard');
      const aFilesClr = document.getElementById('analyzeFilesCard');
      if (aScoreClr) aScoreClr.textContent='--';
      if (aGateClr) aGateClr.textContent='--';
      if (aIssuesClr) aIssuesClr.textContent='--';
      if (aFilesClr) aFilesClr.textContent='--';
      const rScoreClr = document.getElementById('reportScoreCard');
      const rGateClr = document.getElementById('reportGateCard');
      const rIssuesClr = document.getElementById('reportIssuesCard');
      const rFilesClr = document.getElementById('reportFilesCard');
      if (rScoreClr) rScoreClr.textContent='--';
      if (rGateClr) rGateClr.textContent='--';
      if (rIssuesClr) rIssuesClr.textContent='--';
      if (rFilesClr) rFilesClr.textContent='--';
      const rCritBar = document.getElementById('reportCritBar'); if (rCritBar) rCritBar.style.width = '0%';
      const rHighBar = document.getElementById('reportHighBar'); if (rHighBar) rHighBar.style.width = '0%';
      const rMedBar = document.getElementById('reportMedBar'); if (rMedBar) rMedBar.style.width = '0%';
      const rLowBar = document.getElementById('reportLowBar'); if (rLowBar) rLowBar.style.width = '0%';
      const rCritVal = document.getElementById('reportCritVal'); if (rCritVal) rCritVal.textContent='0';
      const rHighVal = document.getElementById('reportHighVal'); if (rHighVal) rHighVal.textContent='0';
      const rMedVal = document.getElementById('reportMedVal'); if (rMedVal) rMedVal.textContent='0';
      const rLowVal = document.getElementById('reportLowVal'); if (rLowVal) rLowVal.textContent='0';
      const rLastScan = document.getElementById('reportLastScan'); if (rLastScan) rLastScan.textContent='--';
      const rDuration = document.getElementById('reportDuration'); if (rDuration) rDuration.textContent='--';
    }
    if (msg.command === 'updateReport' && msg.report) {
      const r = msg.report;
      const dbScore = document.getElementById('dbScoreVal');
      const dbIssues = document.getElementById('dbIssuesVal');
      const dbGate = document.getElementById('dbGateVal');
      const dbCrit = document.getElementById('dbCritCount');
      const dbHigh = document.getElementById('dbHighCount');
      const dbMed = document.getElementById('dbMedCount');
      const dbLow = document.getElementById('dbLowCount');
      const dbRepo = document.getElementById('dbRepoFiles');
      const dbGateChk = document.getElementById('dbGateChecked');
      if (dbScore) dbScore.textContent = (r.qualityScore != null ? r.qualityScore : r.score != null ? r.score : '--') + '';
      const issueCount = (() => {
        if (r.issueCount != null) return r.issueCount;
        if (r.totalIssues != null) return r.totalIssues;
        if (r.issues != null) {
          if (typeof r.issues === 'number') return r.issues;
          if (typeof r.issues === 'string' && r.issues !== '') return parseInt(r.issues, 10) || 0;
          if (Array.isArray(r.issues)) return r.issues.length;
        }
        if (r.detectedIssues) return r.detectedIssues.length;
        return '0';
      })();
      if (dbIssues) dbIssues.textContent = issueCount + '';
      if (dbGate) dbGate.textContent = typeof r.gate === 'string' ? r.gate : (r.gate && r.gate.pass != null ? (r.gate.pass ? 'PASS' : 'FAIL') : 'Pending');
      const sev = r.severityCounts || {};
      if (dbCrit) { dbCrit.textContent = (sev.critical || sev.Critical || 0) + ''; document.getElementById('dbCritLabel').textContent = (sev.critical || sev.Critical || 0) + ' Critical'; }
      if (dbHigh) { dbHigh.textContent = (sev.high || sev.High || 0) + ''; document.getElementById('dbHighLabel').textContent = (sev.high || sev.High || 0) + ' High'; }
      if (dbMed) { dbMed.textContent = (sev.medium || sev.Medium || sev.med || 0) + ''; document.getElementById('dbMedLabel').textContent = (sev.medium || sev.Medium || sev.med || 0) + ' Med'; }
      if (dbLow) { dbLow.textContent = (sev.low || sev.Low || 0) + ''; document.getElementById('dbLowLabel').textContent = (sev.low || sev.Low || 0) + ' Low'; }
      if (dbRepo) dbRepo.textContent = (r.totalFiles || r.filesAnalyzed || r.ruleScopedFilesAnalyzed || '--') + '';
      if (dbGateChk) dbGateChk.textContent = (r.totalFiles || r.filesAnalyzed || r.ruleScopedFilesAnalyzed || '--') + '';
      // Populate new tab panes
      const score = r.qualityScore != null ? r.qualityScore : r.score != null ? r.score : null;
      // Analyze tab KPI cards
      const aScore = document.getElementById('analyzeScoreCard');
      const aGate = document.getElementById('analyzeGateCard');
      const aIssues = document.getElementById('analyzeIssuesCard');
      const aFiles = document.getElementById('analyzeFilesCard');
      if (aScore) aScore.textContent = score != null ? score + '' : '--';
      if (aGate) aGate.textContent = typeof r.gate === 'string' ? r.gate : 'Pending';
      if (aIssues) aIssues.textContent = issueCount + '';
      const files = r.totalFiles || r.filesAnalyzed || r.ruleScopedFilesAnalyzed || r.repositoryFilesTotal || '--';
      if (aFiles) aFiles.textContent = files + '';
      // Analyze sidebar detail panel KPI cards
      const saScore = document.getElementById('sidebarAnalyzeScore');
      const saGate = document.getElementById('sidebarAnalyzeGate');
      const saIssues = document.getElementById('sidebarAnalyzeIssues');
      const saFiles = document.getElementById('sidebarAnalyzeFiles');
      const saBadge = document.getElementById('analyzeBadge');
      if (saScore) saScore.textContent = score != null ? score + '' : '--';
      if (saGate) saGate.textContent = typeof r.gate === 'string' ? r.gate : (r.gate && r.gate.pass != null ? (r.gate.pass ? 'PASS' : 'FAIL') : 'Pending');
      if (saIssues) saIssues.textContent = issueCount + '';
      if (saFiles) saFiles.textContent = files + '';
      if (saBadge) {
        const gatePass = typeof r.gate === 'string' ? r.gate === 'PASS' : (r.gate && r.gate.pass != null ? r.gate.pass : false);
        saBadge.textContent = gatePass ? 'PASS' : 'FAIL';
        saBadge.style.background = gatePass ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)';
        saBadge.style.color = gatePass ? '#4ade80' : '#f87171';
      }
      // Report tab KPI cards
      const rScore = document.getElementById('reportScoreCard');
      const rGate = document.getElementById('reportGateCard');
      const rIssues = document.getElementById('reportIssuesCard');
      const rFiles = document.getElementById('reportFilesCard');
      if (rScore) rScore.textContent = score != null ? score + '' : '--';
      if (rGate) rGate.textContent = typeof r.gate === 'string' ? r.gate : 'Pending';
      if (rIssues) rIssues.textContent = issueCount + '';
      if (rFiles) rFiles.textContent = files + '';
      // Report tab severity bars
      const sevCounts = r.severityCounts || {};
      const crit = sevCounts.critical || sevCounts.Critical || 0;
      const high = sevCounts.high || sevCounts.High || 0;
      const med = sevCounts.medium || sevCounts.Medium || 0;
      const low = sevCounts.low || sevCounts.Low || 0;
      const totalSev = crit + high + med + low || 1;
      const rCritBar = document.getElementById('reportCritBar'); if (rCritBar) rCritBar.style.width = Math.min(100, (crit / totalSev) * 100) + '%';
      const rHighBar = document.getElementById('reportHighBar'); if (rHighBar) rHighBar.style.width = Math.min(100, (high / totalSev) * 100) + '%';
      const rMedBar = document.getElementById('reportMedBar'); if (rMedBar) rMedBar.style.width = Math.min(100, (med / totalSev) * 100) + '%';
      const rLowBar = document.getElementById('reportLowBar'); if (rLowBar) rLowBar.style.width = Math.min(100, (low / totalSev) * 100) + '%';
      const rCritVal = document.getElementById('reportCritVal'); if (rCritVal) rCritVal.textContent = crit + '';
      const rHighVal = document.getElementById('reportHighVal'); if (rHighVal) rHighVal.textContent = high + '';
      const rMedVal = document.getElementById('reportMedVal'); if (rMedVal) rMedVal.textContent = med + '';
      const rLowVal = document.getElementById('reportLowVal'); if (rLowVal) rLowVal.textContent = low + '';
      const rLastScan = document.getElementById('reportLastScan'); if (rLastScan) rLastScan.textContent = r.lastScanTime ? new Date(r.lastScanTime).toLocaleString() : 'Just now';
      const rDuration = document.getElementById('reportDuration'); if (rDuration) rDuration.textContent = r.scanDuration ? r.scanDuration + 's' : '--';
      // Repo Health
      const rhScore = document.getElementById('rhScore');
      const rhFiles = document.getElementById('rhFiles');
      const rhStatus = document.getElementById('rhStatusBadge');
      if (rhScore) rhScore.textContent = score != null ? score + '' : '--';
      if (rhFiles) rhFiles.textContent = files + '';
      if (rhStatus) { rhStatus.textContent = score != null && score >= 80 ? 'Healthy' : score != null && score >= 50 ? 'Needs Attention' : 'Critical'; rhStatus.className = 'tc-status-badge' + (score != null && score >= 80 ? '' : score != null && score >= 50 ? ' amber' : ' red'); }
      // Analytics
      const anScore = document.getElementById('anScore');
      const anTrend = document.getElementById('anTrend');
      const anCrit = document.getElementById('anCrit');
      const anHigh = document.getElementById('anHigh');
      const anMed = document.getElementById('anMed');
      if (anScore) anScore.textContent = score != null ? score + '' : '--';
      if (anTrend) anTrend.textContent = score != null && score >= 80 ? 'Good' : score != null && score >= 50 ? 'Fair' : 'Poor';
      if (anCrit) anCrit.textContent = crit + '';
      if (anHigh) anHigh.textContent = high + '';
      if (anMed) anMed.textContent = med + '';
      // Trust
      const trScore = document.getElementById('trScore');
      const trAlerts = document.getElementById('trAlerts');
      if (trScore) trScore.textContent = score != null ? score + '' : '--';
      if (trAlerts) trAlerts.textContent = (crit + high) + '';
      // Assessments
      const asPass = document.getElementById('asPass');
      const asFail = document.getElementById('asFail');
      const totalIssues = r.issueCount || r.totalIssues || (r.detectedIssues ? r.detectedIssues.length : 0);
      if (asPass) asPass.textContent = score != null && score >= 50 ? (totalIssues > 0 ? Math.max(0, totalIssues - crit - high) : 0) + '' : '0';
      if (asFail) asFail.textContent = (crit + high) + '';
      // Compliance
      const cpScore = document.getElementById('cpScore');
      const cpPending = document.getElementById('cpPending');
      if (cpScore) cpScore.textContent = score != null ? score + '' : '--';
      if (cpPending) cpPending.textContent = (crit + high) + '';
      // Profile
      const prScore = document.getElementById('prScore');
      const prScans = document.getElementById('prScans');
      if (prScore) prScore.textContent = score != null ? score + '' : '--';
      if (prScans) prScans.textContent='1';
      _updateSidebarAuditPanel(r);
      _updateSidebarSecurityPanel(r);
      _updateSidebarTrustPanel(r);
      _updateSidebarQualityPanel(r);
      _updateSidebarAssessmentsPanel(r);
      _updateSidebarCompliancePanel(r);
      _updateSidebarScanPanel(r);
      _updateSidebarAiContextPanel(r);
      _updateSidebarCertificatePanel(r);
      _updateSidebarProfilePanel(r);
      _updateSidebarUploadPanel(r);
      _updateSidebarRepoHealthPanel(r);
      _updateSidebarAnalyticsPanel(r);
      _updateSidebarTeamPanel(r);
      _updateSidebarPlatformPanel(r);
    }
    if (msg.command === 'setShowWelcome') {
      const el = document.getElementById('showWelcome');
      if (el) el.checked = !!msg.value;
    }
    if (msg.command === 'setAutoScan') {
      const el = document.getElementById('autoScan');
      const toggleEl = document.getElementById('toggleAutoScan');
      const tabEl = document.getElementById('toggleAutoScanTab');
      if (el) el.checked = !!msg.value;
      if (toggleEl) toggleEl.checked = !!msg.value;
      if (tabEl) tabEl.checked = !!msg.value;
    }
    if (msg.command === 'setBrowserMode') {
      const el = document.getElementById('toggleBrowserMode');
      const tabEl = document.getElementById('toggleBrowserModeTab');
      if (el) el.checked = !!msg.value;
      if (tabEl) tabEl.checked = !!msg.value;
    }
    if (msg.command === 'addDownloadedFile') {
      // simplebeacon-ignore console-log — diagnostic visibility while debugging sidebar download relay
      console.log('[Sidebar] addDownloadedFile received:', msg.name, msg.path);
      _appendDownloadedFile(msg.name, msg.path, msg.time, msg.fullPath);
    }
    if (msg.command === 'clearDownloadedFiles') {
      const dlList = document.getElementById('dlList');
      if (dlList) { dlList.textContent=''; const emptyDiv = document.createElement('div'); emptyDiv.className = 'dl-empty'; emptyDiv.textContent='No downloads yet'; dlList.appendChild(emptyDiv); }
    }
    if (msg.command === 'diagnoseResult') {
      const detailPanel = document.getElementById('diagnoseDetailPanel');
      const detailResults = document.getElementById('diagnoseDetailResults');
      const detailBadge = document.getElementById('diagnoseDetailBadge');
      const detailRelay = document.getElementById('diagnoseDetailRelay');
      const detailServer = document.getElementById('diagnoseDetailServer');
      const detailApi = document.getElementById('diagnoseDetailApi');
      const detailSidebar = document.getElementById('diagnoseDetailSidebar');
      if (detailPanel) {
        detailPanel.classList.remove('hidden');
        detailPanel.classList.add('detail-active');
        detailPanel.style.display = 'block';
      }
      document.body.classList.add('detail-panel-open');
      const hasErr = msg.lines && msg.lines.some(function(l){ return /FAIL|ERROR|UNREACHABLE|MISSING|TIMEOUT/.test(String(l)); });
      const hasWarn = msg.lines && msg.lines.some(function(l){ return /WARN|PENDING|UNKNOWN/.test(String(l)); });
      if (detailBadge) {
        if (hasErr) { detailBadge.style.background = 'rgba(239,68,68,0.18)'; detailBadge.style.color = '#f87171'; detailBadge.textContent='Issues Found'; }
        else if (hasWarn) { detailBadge.style.background = 'rgba(245,158,11,0.18)'; detailBadge.style.color = '#fbbf24'; detailBadge.textContent='Warnings'; }
        else { detailBadge.style.background = 'rgba(34,197,94,0.18)'; detailBadge.style.color = '#4ade80'; detailBadge.textContent='All Clear'; }
      }
      function setKpi(el, line, pattern) { if (!el || !line) return; const val = String(line).replace(pattern, '').trim(); el.textContent = val || '--'; if (/FAIL|ERROR|UNREACHABLE|MISSING|TIMEOUT/.test(val)) el.className = 'settings-kpi-value red'; else if (/WARN|PENDING|UNKNOWN/.test(val)) el.className = 'settings-kpi-value amber'; else el.className = 'settings-kpi-value green'; }
      if (msg.lines && Array.isArray(msg.lines)) {
        const relayLine = msg.lines.find(function(l){ return /Relay port:/i.test(String(l)); });
        const serverLine = msg.lines.find(function(l){ return /Data server:/i.test(String(l)); });
        const apiLine = msg.lines.find(function(l){ return /API status:/i.test(String(l)); });
        const dashHtmlLine = msg.lines.find(function(l){ return /Dashboard HTML:/i.test(String(l)); });
        const sideHtmlLine = msg.lines.find(function(l){ return /Sidebar HTML:/i.test(String(l)); });
        setKpi(detailRelay, relayLine, /^Relay port:s*/i);
        setKpi(detailServer, serverLine, /^Data server:s*/i);
        setKpi(detailApi, apiLine, /^API status:s*/i);
        setKpi(detailSidebar, sideHtmlLine, /^Sidebar HTML:s*/i);
        if (!sideHtmlLine && dashHtmlLine) setKpi(detailSidebar, dashHtmlLine, /^Dashboard HTML:s*/i);
      }
      if (detailResults) {
        detailResults.textContent='';
        if (msg.lines && Array.isArray(msg.lines)) {
          msg.lines.forEach(function(line) {
            const text = String(line);
            const colonIdx = text.indexOf(':');
            const label = colonIdx > 0 ? text.slice(0, colonIdx).trim() : '';
            const value = colonIdx > 0 ? text.slice(colonIdx + 1).trim() : text;
            const card = document.createElement('div');
            card.className = 'diag-card';
            if (text.indexOf('OK') !== -1 || text.indexOf('PASS') !== -1 || text.indexOf('YES') !== -1 || text.indexOf('ACTIVE') !== -1 || text.indexOf('LOADED') !== -1) {
              card.className += ' ok';
            } else if (text.indexOf('FAIL') !== -1 || text.indexOf('ERROR') !== -1 || text.indexOf('UNREACHABLE') !== -1 || text.indexOf('MISSING') !== -1 || text.indexOf('NOT') !== -1 || text.indexOf('TIMEOUT') !== -1) {
              card.className += ' err';
            } else if (text.indexOf('WARN') !== -1 || text.indexOf('UNKNOWN') !== -1 || text.indexOf('PENDING') !== -1) {
              card.className += ' warn';
            }
            if (label) {
              const lbl = document.createElement('div');
              lbl.className = 'diag-card-label';
              lbl.textContent = label;
              card.appendChild(lbl);
            }
            const val = document.createElement('div');
            val.className = 'diag-card-value';
            val.textContent = value;
            card.appendChild(val);
            detailResults.appendChild(card);
          });
        } else if (msg.text) {
          const card = document.createElement('div');
          card.className = 'diag-card';
          const val = document.createElement('div');
          val.className = 'diag-card-value';
          val.textContent = String(msg.text);
          card.appendChild(val);
          detailResults.appendChild(card);
        }
      }
    }
    if (msg.command === 'showDashboard') {
      // Show dashboard inline without fullscreen mode
      let backBtn = document.getElementById('dashboardBackBtn');
      if (backBtn) backBtn.style.display = 'none';
      let td = document.getElementById('tabDashboard');
      if (td) { td.classList.remove('hidden'); td.classList.add('active'); }
      document.querySelectorAll('.tab-pane').forEach(function(p) { if (p.id !== 'tabDashboard') p.classList.remove('active'); });
    }
    if (msg.command === 'hideDashboard') {
      document.body.classList.remove('sidebar-dashboard-mode');
      let backBtn2 = document.getElementById('dashboardBackBtn');
      if (backBtn2) backBtn2.style.display = 'none';
      let td2 = document.getElementById('tabDashboard');
      if (td2) { td2.classList.remove('active'); td2.classList.add('hidden'); }
    }
    if (msg.command === 'setDisplayMode') {
      window._displayMode = msg.value || 'sidebar';
      const toggleDisplay = document.getElementById('toggleDisplayMode');
      const toggleDisplayTab = document.getElementById('toggleDisplayModeTab');
      const displayModeSelectTab = document.getElementById('displayModeSelectTab');
      if (toggleDisplay) toggleDisplay.checked = msg.value === 'mainWindow';
      if (toggleDisplayTab) toggleDisplayTab.checked = msg.value === 'mainWindow';
      if (displayModeSelectTab) displayModeSelectTab.value = msg.value;
      const isSidebar = msg.value === 'sidebar';
      const sidebarTabBar = document.getElementById('sidebarTabBar');
      if (sidebarTabBar) { sidebarTabBar.classList.toggle('hidden', !isSidebar); }
      const mainTabBar = document.getElementById('mainTabBar');
      if (mainTabBar) { mainTabBar.classList.toggle('hidden', isSidebar); }
      const prDisplay=document.getElementById('prDisplay');if(prDisplay){prDisplay.textContent=isSidebar?'Sidebar':'Main Window';}
      if (isSidebar) {
        _switchSidebarTab('dashboard');
      } else {
        let activeTabItem = document.querySelector('.tab-item.active');
        if (activeTabItem) {
          let activeTab = activeTabItem.getAttribute('data-tab');
          if (activeTab) {
            document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.add('hidden');p.classList.remove('active');});
            let pane = document.getElementById('tab'+activeTab.charAt(0).toUpperCase()+activeTab.slice(1));
            if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
          }
        }
      }
    }
    if (msg.command === 'switchSidebarTab' && msg.tab) {
      _switchSidebarTab(msg.tab);
    }
  });
  function _decodeJwtPayload(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - base64.length % 4) % 4);
      return JSON.parse(atob(base64 + pad));
    } catch { return null; }
  }
  let _lastSidebarSignedIn = false;
  let _serverTier = '';
  let _serverIsAdmin = false;
  function _getTokenTier() {
    if (_serverTier) return _serverTier;
    try {
      let token = localStorage.getItem('cascadeAuthToken');
      if (!token) { token = localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('simplebeacon_token'); }
      if (!token) return null;
      const payload = _decodeJwtPayload(token);
      return payload?.tier || payload?.plan || payload?.product || null;
    } catch (e) {
      return null;
    }
  }
  function _isAdminAccount() {
    if (_serverIsAdmin) return true;
    try {
      let token = localStorage.getItem('cascadeAuthToken');
      if (!token) { token = localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('simplebeacon_token'); }
      const payload = token ? _decodeJwtPayload(token) : null;
      const email = String(payload?.email || payload?.sub || payload?.username || '').toLowerCase();
      return email === 'admin@simplebeacon.ai' || payload?.isAdmin === true || payload?.role === 'admin';
    } catch (e) {
      return false;
    }
  }
  function _isFreeTier() {
    if (_isAdminAccount()) return false;
    const tier = _getTokenTier();
    if (!tier) return false;
    const freeTiers = ['guest', 'community', 'developer', 'sandbox', 'instant', 'free', 'solo', ''];
    return freeTiers.includes(String(tier).toLowerCase());
  }
  function _applySbTheme(theme) {
    if (!theme) return;
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    const palette = isDark ? {
      '--vscode-editor-background': '#252526',
      '--vscode-sideBar-background': '#252526',
      '--vscode-sideBar-foreground': '#cccccc',
      '--vscode-foreground': '#cccccc',
      '--vscode-descriptionForeground': '#858585',
      '--vscode-panel-border': '#3c3c3c',
      '--vscode-input-background': '#3c3c3c',
      '--vscode-list-hoverBackground': '#2a2d2e',
      '--vscode-button-secondaryBackground': '#3c3c3c'
    } : {
      '--vscode-editor-background': '#f3f3f3',
      '--vscode-sideBar-background': '#f3f3f3',
      '--vscode-sideBar-foreground': '#333333',
      '--vscode-foreground': '#333333',
      '--vscode-descriptionForeground': '#6c6c6c',
      '--vscode-panel-border': '#e0e0e0',
      '--vscode-input-background': '#ffffff',
      '--vscode-list-hoverBackground': '#e8e8e8',
      '--vscode-button-secondaryBackground': '#e8e8e8'
    };
    Object.keys(palette).forEach(function(k) {
      document.documentElement.style.setProperty(k, palette[k]);
    });
  }
  function _updateSidebarAuthState(signedIn, tier) {
    try {
      if (_lastSidebarSignedIn === signedIn && !tier) return;
      _lastSidebarSignedIn = signedIn;
      if (tier) _serverTier = tier;
      const effectiveTier = tier || _getTokenTier() || 'Unknown';
      let signIn = document.getElementById('tdSignInSidebar');
      let signOut = document.getElementById('tdSignOutSidebar');
      let signOutMenu = document.getElementById('tdSignOut');
      let pricing = document.getElementById('tdPricingSidebar');
      let pricingMenu = document.getElementById('tdPricing');
      let websiteToggle = document.getElementById('tdOfflineToggleSidebar');
      if (signIn) signIn.style.display = signedIn ? 'none' : 'flex';
      if (signOut) signOut.style.display = signedIn ? 'flex' : 'none';
      if (signOutMenu) signOutMenu.style.display = signedIn ? 'flex' : 'none';
      if (pricing) pricing.style.display = signedIn ? 'none' : 'flex';
      if (pricingMenu) pricingMenu.style.display = signedIn ? 'none' : 'flex';
      if (websiteToggle) websiteToggle.style.display = 'flex';
      let tokenMgmt = document.getElementById('tokenManagementTier');
      if (tokenMgmt) {
        tokenMgmt.textContent = signedIn ? ('Tier: ' + effectiveTier) : 'No token — Sign In';
      }
      let dbSigninBtn = document.getElementById('dbSigninBtn');
      if (dbSigninBtn) dbSigninBtn.style.display = signedIn ? 'none' : 'inline-flex';
      let dbSignoutBtn = document.getElementById('dbSignoutBtn');
      if (dbSignoutBtn) dbSignoutBtn.style.display = signedIn ? 'inline-flex' : 'none';
      let sidebarSignInLink = document.getElementById('sidebarSignInLink');
      if (sidebarSignInLink) sidebarSignInLink.style.display = signedIn ? 'none' : 'flex';
      let sidebarSignOutLink = document.getElementById('sidebarSignOutLink');
      if (sidebarSignOutLink) sidebarSignOutLink.style.display = signedIn ? 'flex' : 'none';
      let headerSignInBtn = document.getElementById('headerSignInBtn');
      if (headerSignInBtn) headerSignInBtn.style.display = signedIn ? 'none' : 'inline-flex';
      let headerSignOutBtn = document.getElementById('headerSignOutBtn');
      if (headerSignOutBtn) headerSignOutBtn.style.display = signedIn ? 'inline-flex' : 'none';
      // Website/Localhost buttons are toggled above based on signed-in state.
    } catch (e) {
      if (window.vscode) { try { window.vscode.postMessage({ command: 'sidebarError', message: String(e && e.message || e), stack: e && e.stack ? e.stack : '' }); } catch(_) {} }
    }
  }
  window.addEventListener('message', function(e) {
    let msg = e.data; if (!msg) return;
    if (msg.command === 'setAuthState') {
      if (!msg.signedIn) {
        // Only accept signed-out state if the webview has no independent token
        // and the extension hasn't recently confirmed sign-in (prevents race with
        // periodic auth polls that can't see web-app session tokens).
        // When the source is explicitly signOut, always accept it.
        if (msg.source !== 'signOut' && msg.source !== 'websitePanel') {
          const hasToken = !!(localStorage.getItem('cascadeAuthToken') || localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('simplebeacon_token'));
          if (hasToken) {
            return;
          }
          const lastAuthTs = parseInt(sessionStorage.getItem('sb_sidebar_auth_ts') || '0', 10);
          if (Date.now() - lastAuthTs < 30000) {
            return;
          }
        }
        try {
          ['cascadeAuthToken','access_token','token','authToken','simplebeacon_token'].forEach(function(k) {
            localStorage.removeItem(k);
          });
          sessionStorage.removeItem('sb_sidebar_auth_ts');
        } catch(e) {}
      } else if (msg.token) {
        try { localStorage.setItem('cascadeAuthToken', msg.token); } catch(e) {}
      }
      if (msg.signedIn) {
        try { sessionStorage.setItem('sb_sidebar_auth_ts', String(Date.now())); } catch(e) {}
      }
      if (typeof msg.isAdmin === 'boolean') { _serverIsAdmin = msg.isAdmin; }
      _updateSidebarAuthState(msg.signedIn, msg.tier);
      // Diagnostic log
      try {
        const debugLog = document.getElementById('sbAuthDebugLog');
        if (debugLog) {
          const tokenCheck = localStorage.getItem('cascadeAuthToken') || localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('simplebeacon_token');
          debugLog.textContent = 'setAuthState: signedIn=' + msg.signedIn + ' tier=' + msg.tier + ' hasToken=' + (tokenCheck ? 'yes(' + tokenCheck.length + ')' : 'no') + ' at ' + new Date().toLocaleTimeString();
        }
      } catch(e) {}
    }
    if (msg.command === 'rehydrateCachedSession') {
      if (msg.token) {
        try { localStorage.setItem('cascadeAuthToken', msg.token); } catch(e) {}
      }
      _updateSidebarAuthState(true);
    }
    if (msg.command === 'setSidebarScanPath') {
      let input = document.getElementById('sidebarScanPathInput');
      if (input && msg.path) input.value = msg.path;
      // Auto-switch to custom mode when a path is set via browse/detect
      let toggle = document.getElementById('sidebarScanWorkspaceToggle');
      if (toggle) { toggle.checked = false; }
      let label = document.getElementById('sidebarScanToggleLabel');
      let wrap = document.getElementById('sidebarScanCustomWrap');
      let actionRow = document.getElementById('scanActionRow');
      if (label) { label.textContent='Custom Location'; }
      if (wrap) { wrap.style.display = 'flex'; }
      if (actionRow) { actionRow.style.display = 'flex'; }
      if (window.vscode) window.vscode.postMessage({ command: 'updateSidebarScanMode', mode: 'custom' });
    }
    if (msg.command === 'setScanMode') {
      let toggle = document.getElementById('sidebarScanWorkspaceToggle');
      let label = document.getElementById('sidebarScanToggleLabel');
      let wrap = document.getElementById('sidebarScanCustomWrap');
      let actionRow = document.getElementById('scanActionRow');
      let isWorkspace = msg.mode === 'workspace';
      if (toggle) { toggle.checked = isWorkspace; }
      if (label) { label.textContent = isWorkspace ? 'Current Workspace' : 'Custom Location'; }
      if (wrap) { wrap.style.display = isWorkspace ? 'none' : 'flex'; }
      if (actionRow) { actionRow.style.display = isWorkspace ? 'none' : 'flex'; }
    }
    if (msg.command === 'setTheme' && msg.theme) {
      _applySbTheme(msg.theme);
    }
    if (msg.command === 'getAuthState') {
      if (vscode) { try { vscode.postMessage({ command: 'getAuthState' }); } catch (e) {} }
    }
  });
  _applySbTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  // Check localStorage for existing token to set initial auth UI state before extension responds
  (function checkInitialAuth() {
    const hasToken = !!(localStorage.getItem('cascadeAuthToken') || localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('simplebeacon_token'));
    if (hasToken) { _updateSidebarAuthState(true); }
  })();
  // Listen for storage changes from other tabs/iframes (e.g. sign-in panel)
  window.addEventListener('storage', function(e) {
    const tokenKeys = ['cascadeAuthToken','access_token','token','authToken','simplebeacon_token'];
    if (tokenKeys.includes(e.key)) {
      const hasToken = !!(localStorage.getItem('cascadeAuthToken') || localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('simplebeacon_token'));
      _updateSidebarAuthState(hasToken);
    }
  });
  // Bind top tab bar (mainWindow display mode) as well as the compact sidebar tab bar
  document.querySelectorAll('#mainTabBar .tab-item').forEach(function(t){
    t.addEventListener('click', function(){ _switchSidebarTab(t.getAttribute('data-tab')); });
  });
  // Request auth state from extension once on boot, with a single retry if still unsigned-in.
  (function requestAuthState(attempt) {
    if (window.vscode) { window.vscode.postMessage({command: 'getAuthState'}); }
    if (attempt < 1) {
      setTimeout(function() {
        let signOut = document.getElementById('tdSignOutSidebar');
        if (signOut && signOut.style.display === 'none') {
          requestAuthState(attempt + 1);
        }
      }, 1500);
    }
  })(0);

})();
