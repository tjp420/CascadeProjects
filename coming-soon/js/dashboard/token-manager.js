// SimpleBeacon Token Manager
// Handles token parsing, tier logic, product UI, and scan profile filtering.

function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2 && parts.length !== 3) {

        return null;
    }
    const payloadBase64url = parts.length === 2 ? parts[0] : parts[1];
    if (!payloadBase64url) { return null; }
    const base64 = payloadBase64url.replace(/-/g, '+').replace(/_/g, '/');
    const rem = base64.length % 4;
    if (rem === 1) {

        return null;
    }
    const padded = base64 + '='.repeat((4 - rem) % 4);
    try {
        const binary = atob(padded);
        let decoded;
        if (typeof TextDecoder !== 'undefined') {
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            decoded = new TextDecoder().decode(bytes);
        } else {
            decoded = decodeURIComponent(escape(binary));
        }
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

const licenseInput = document.getElementById('licenseToken');
const browserScanProfile = document.getElementById('browserScanProfile');
const scanProfileHelp = document.getElementById('scanProfileHelp');
const analyzerCardGrid = document.getElementById('analyzerCardGrid');
const selectAllModules = document.getElementById('selectAllModules');
const selectAllCount = document.getElementById('selectAllCount');

const PRODUCT_CONFIG = (window.SIMPLEBEACON_SITE && window.SIMPLEBEACON_SITE.products) || {};
const TIER_PROFILES = (window.SIMPLEBEACON_SITE && window.SIMPLEBEACON_SITE.tierProfiles) || {
    locked: [],
    community: ['gate'],
    instant: ['gate', 'instant', 'mock-data'],
    executive: ['gate', 'codebase', 'compliance', 'hygiene', 'complete'],
    aislopcop: ['gate', 'aislopcop', 'complete'],
    euai: ['gate', 'codebase', 'euai', 'compliance', 'hygiene', 'complete'],
    euSprint: ['gate', 'codebase', 'euai', 'compliance', 'hygiene', 'complete'],
    universal: ['gate', 'codebase', 'euai', 'compliance', 'hygiene', 'complete'],
    admin: ['gate', 'codebase', 'euai', 'compliance', 'hygiene', 'complete']
};

const TIER_MODULE_MAP = {
    locked: [],
    community: ['gate'],
    starter: ['gate', 'llm-slop'],
    instant: ['gate', 'mock-data'],
    pro: ['gate', 'consolidation', 'mock-data', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup', 'npm-audit', 'compliance', 'eu-ai-act', 'dependency-vulns', 'build-readiness', 'ai-indicators', 'governance', 'junk-files', 'ai-residue', 'performance', 'type-safety', 'documentation', 'test-coverage', 'accessibility', 'i18n', 'sensitive-data', 'config-drift', 'security-headers', 'database-patterns', 'framework-practices', 'workspace-health', 'unused-deps', 'api-contract', 'complexity', 'fix-preview', 'llm-slop', 'token-bleed', 'production-leak', 'fiction-kpi', 'architecture-drift'],
    aislopcop: ['gate', 'llm-slop', 'token-bleed', 'production-leak', 'fiction-kpi', 'ai-residue'],
    team: ['gate', 'consolidation', 'mock-data', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup', 'npm-audit', 'compliance', 'eu-ai-act', 'dependency-vulns', 'build-readiness', 'ai-indicators', 'governance', 'junk-files', 'ai-residue', 'performance', 'type-safety', 'documentation', 'test-coverage', 'accessibility', 'i18n', 'sensitive-data', 'config-drift', 'security-headers', 'database-patterns', 'framework-practices', 'workspace-health', 'unused-deps', 'api-contract', 'complexity', 'fix-preview', 'llm-slop', 'token-bleed', 'production-leak', 'fiction-kpi', 'architecture-drift'],
    enterprise: ['gate', 'consolidation', 'mock-data', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup', 'npm-audit', 'compliance', 'eu-ai-act', 'dependency-vulns', 'build-readiness', 'ai-indicators', 'governance', 'junk-files', 'ai-residue', 'performance', 'type-safety', 'documentation', 'test-coverage', 'accessibility', 'i18n', 'sensitive-data', 'config-drift', 'security-headers', 'database-patterns', 'framework-practices', 'workspace-health', 'unused-deps', 'api-contract', 'complexity', 'fix-preview', 'llm-slop', 'token-bleed', 'production-leak', 'fiction-kpi', 'architecture-drift'],
    // Legacy tier aliases for backward compatibility
    executive: ['gate', 'consolidation', 'mock-data', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup', 'npm-audit', 'compliance', 'eu-ai-act', 'dependency-vulns', 'build-readiness', 'ai-indicators', 'governance', 'junk-files', 'ai-residue', 'performance', 'type-safety', 'documentation', 'test-coverage', 'accessibility', 'i18n', 'sensitive-data', 'config-drift', 'security-headers', 'database-patterns', 'framework-practices', 'workspace-health', 'unused-deps', 'api-contract', 'complexity', 'fix-preview'],
    euai: ['gate', 'consolidation', 'mock-data', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup', 'npm-audit', 'compliance', 'eu-ai-act', 'dependency-vulns', 'build-readiness', 'ai-indicators', 'governance', 'junk-files', 'ai-residue', 'performance', 'type-safety', 'documentation', 'test-coverage', 'accessibility', 'i18n', 'sensitive-data', 'config-drift', 'security-headers', 'database-patterns', 'framework-practices', 'workspace-health', 'unused-deps', 'api-contract', 'complexity', 'fix-preview'],
    euSprint: ['gate', 'consolidation', 'mock-data', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup', 'npm-audit', 'compliance', 'eu-ai-act', 'dependency-vulns', 'build-readiness', 'ai-indicators', 'governance', 'junk-files', 'ai-residue', 'performance', 'type-safety', 'documentation', 'test-coverage', 'accessibility', 'i18n', 'sensitive-data', 'config-drift', 'security-headers', 'database-patterns', 'framework-practices', 'workspace-health', 'unused-deps', 'api-contract', 'complexity', 'fix-preview'],
    universal: ['gate', 'consolidation', 'mock-data', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup', 'npm-audit', 'compliance', 'eu-ai-act', 'dependency-vulns', 'build-readiness', 'ai-indicators', 'governance', 'junk-files', 'ai-residue', 'performance', 'type-safety', 'documentation', 'test-coverage', 'accessibility', 'i18n', 'sensitive-data', 'config-drift', 'security-headers', 'database-patterns', 'framework-practices', 'workspace-health', 'unused-deps', 'api-contract', 'complexity', 'fix-preview', 'llm-slop', 'token-bleed', 'production-leak', 'fiction-kpi', 'architecture-drift', 'sync-io', 'eval-danger', 'inner-html-xss', 'prototype-pollution', 'unhandled-promise', 'magic-number', 'missing-strict-mode', 'uninitialized-read', 'unvalidated-redirect', 'missing-rate-limit', 'insecure-random', 'logging-secrets', 'hardcoded-confidence', 'hardcoded-completion', 'mock-path-leak', 'sample-json-ref', 'governance-marker', 'ai-placeholder-comment', 'ai-placeholder-block', 'markdown-fence-leak', 'empty-stub-function', 'arrow-stub', 'roadmap-marker'],
    admin: ['gate', 'consolidation', 'mock-data', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup', 'npm-audit', 'compliance', 'eu-ai-act', 'dependency-vulns', 'build-readiness', 'ai-indicators', 'governance', 'junk-files', 'ai-residue', 'performance', 'type-safety', 'documentation', 'test-coverage', 'accessibility', 'i18n', 'sensitive-data', 'config-drift', 'security-headers', 'database-patterns', 'framework-practices', 'workspace-health', 'unused-deps', 'api-contract', 'complexity', 'fix-preview', 'llm-slop', 'token-bleed', 'production-leak', 'fiction-kpi', 'architecture-drift', 'sync-io', 'eval-danger', 'inner-html-xss', 'prototype-pollution', 'unhandled-promise', 'magic-number', 'missing-strict-mode', 'uninitialized-read', 'unvalidated-redirect', 'missing-rate-limit', 'insecure-random', 'logging-secrets', 'hardcoded-confidence', 'hardcoded-completion', 'mock-path-leak', 'sample-json-ref', 'governance-marker', 'ai-placeholder-comment', 'ai-placeholder-block', 'markdown-fence-leak', 'empty-stub-function', 'arrow-stub', 'roadmap-marker']
};

const numToId = {
    '1':'gate','2':'consolidation','3':'mock-data','4':'roadmap','5':'codebase',
    '6':'file-reduction','7':'data-quality','8':'cleanup','9':'npm-audit',
    '10':'compliance','11':'eu-ai-act','12':'dependency-vulns','13':'build-readiness',
    '14':'ai-indicators','15':'governance','16':'junk-files','17':'ai-residue',
    '18':'performance','19':'type-safety','20':'documentation','21':'test-coverage',
    '22':'accessibility','23':'i18n','24':'sensitive-data','25':'config-drift',
    '26':'security-headers','27':'database-patterns','28':'framework-practices',
    '29':'workspace-health','30':'unused-deps','31':'api-contract','32':'complexity',
    '33':'llm-slop','34':'token-bleed','35':'production-leak','36':'fiction-kpi',
    '37':'architecture-drift','38':'fix-preview','39':'sync-io','40':'eval-danger',
    '41':'inner-html-xss','42':'prototype-pollution','43':'unhandled-promise',
    '44':'magic-number','45':'missing-strict-mode','46':'uninitialized-read',
    '47':'unvalidated-redirect','48':'missing-rate-limit','49':'insecure-random',
    '50':'logging-secrets','51':'hardcoded-confidence','52':'hardcoded-completion',
    '53':'mock-path-leak','54':'sample-json-ref','55':'governance-marker',
    '56':'ai-placeholder-comment','57':'ai-placeholder-block','58':'markdown-fence-leak',
    '59':'empty-stub-function','60':'arrow-stub','61':'roadmap-marker'
};

const selectedModules = new Set();

function hasValidToken() {
    const val = licenseInput.value.trim();
    return val.length > 20 && val.includes('.');
}

function updateDropzoneGate() {
    if (!browserFolderDropzone) return;
    const locked = !hasValidToken();
    browserFolderDropzone.classList.toggle('locked', locked);
    const overlay = document.getElementById('dropzoneGateOverlay');
    if (overlay) overlay.style.display = locked ? 'flex' : 'none';
}

function filterScanProfiles(tier) {
    const allowed = TIER_PROFILES[tier] || TIER_PROFILES.universal;
    let firstEnabled = null;
    if (browserScanProfile) {
        Array.from(browserScanProfile.options).forEach(opt => {
            const ok = allowed.includes(opt.value);
            opt.disabled = !ok;
            if (ok && !firstEnabled) firstEnabled = opt.value;
        });
    }
    if (analyzerCardGrid) {
        Array.from(analyzerCardGrid.children).forEach(card => {
            const ok = allowed.includes(card.dataset.value);
            card.classList.toggle('locked', !ok);
            if (ok && !firstEnabled) firstEnabled = card.dataset.value;
        });
    }
    if (firstEnabled && browserScanProfile && !allowed.includes(browserScanProfile.value)) {
        browserScanProfile.value = firstEnabled;
    }
}

function resetScanProfiles() {
    if (browserScanProfile) {
        Array.from(browserScanProfile.options).forEach(opt => {
            opt.disabled = false;
        });
    }
    if (analyzerCardGrid) {
        Array.from(analyzerCardGrid.children).forEach(card => {
            card.classList.remove('locked');
        });
    }
    updateDropzoneGate();
}

function renderAnalyzerCards() {
    if (!analyzerCardGrid) return;
    analyzerCardGrid.innerHTML = '';
    MODULE_CARDS.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'analyzer-card';
        card.dataset.value = mod.id;
        card.innerHTML = `
            <div class="card-check">&#10003;</div>
            <div class="card-icon">${mod.icon}</div>
            <div class="card-title">${mod.label}</div>
            <div class="card-desc">${mod.desc}</div>
        `;
        card.addEventListener('click', () => {
            if (card.classList.contains('locked')) {
                showToast('Upgrade your token to unlock this module.', 'warning');
                return;
            }
            toggleModuleSelection(mod.id, card);
        });
        analyzerCardGrid.appendChild(card);
    });
    syncModuleSelectionFromTier();
    if (selectAllModules) {
        selectAllModules.addEventListener('change', () => {
            const unlocked = Array.from(analyzerCardGrid.children).filter(c => !c.classList.contains('locked'));
            if (selectAllModules.checked) {
                unlocked.forEach(card => {
                    card.classList.add('selected');
                    selectedModules.add(card.dataset.value);
                });
            } else {
                unlocked.forEach(card => {
                    card.classList.remove('selected');
                    selectedModules.delete(card.dataset.value);
                });
            }
            updateSelectAllUI();
        });
    }
}

function toggleModuleSelection(id, card) {
    if (selectedModules.has(id)) {
        selectedModules.delete(id);
        card.classList.remove('selected');
    } else {
        selectedModules.add(id);
        card.classList.add('selected');
    }
    updateSelectAllUI();
}

function updateSelectAllUI() {
    if (!selectAllModules || !selectAllCount || !analyzerCardGrid) return;
    const unlocked = Array.from(analyzerCardGrid.children).filter(c => !c.classList.contains('locked'));
    const selectedUnlocked = unlocked.filter(c => c.classList.contains('selected'));
    selectAllModules.checked = unlocked.length > 0 && selectedUnlocked.length === unlocked.length;
    selectAllModules.indeterminate = selectedUnlocked.length > 0 && selectedUnlocked.length < unlocked.length;
    selectAllCount.textContent = `${selectedUnlocked.length}/${unlocked.length} selected`;
}

function syncModuleSelectionFromTier() {
    if (!analyzerCardGrid) return;
    const token = document.getElementById('licenseToken')?.value || '';
    let tier = 'locked';
    let allowed = null;
    if (token) {
        const json = decodeJwtPayload(token);
        if (json) {
            tier = json.tier || 'locked';
            const customModules = Array.isArray(json.features) ? json.features : (Array.isArray(json.modules) ? json.modules : null);
            if (customModules && customModules.length > 0) {
                const all = TIER_MODULE_MAP.universal || [];
                const numToId = {'1':'gate','2':'consolidation','3':'mock-data','4':'roadmap','5':'codebase','6':'file-reduction','7':'data-quality','8':'cleanup','9':'npm-audit','10':'compliance','11':'eu-ai-act','12':'dependency-vulns','13':'build-readiness','14':'ai-indicators','15':'governance','16':'junk-files','17':'ai-residue','18':'performance','19':'type-safety','20':'documentation','21':'test-coverage','22':'accessibility','23':'i18n','24':'sensitive-data','25':'config-drift','26':'security-headers','27':'database-patterns','28':'framework-practices','29':'workspace-health','30':'unused-deps','31':'api-contract','32':'complexity'};
                allowed = customModules.map(m => numToId[m] || m).filter(m => all.includes(m));
            }
        }
    }
    if (!allowed) allowed = TIER_MODULE_MAP[tier] || TIER_MODULE_MAP.locked;
    // console.log('[syncModuleSelectionFromTier] tier:', tier, 'allowed count:', allowed ? allowed.length : 0);
    selectedModules.clear();
    Array.from(analyzerCardGrid.children).forEach(card => {
        const ok = allowed.includes(card.dataset.value);
        card.classList.toggle('locked', !ok);
        if (ok) {
            selectedModules.add(card.dataset.value);
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    const first = Array.from(analyzerCardGrid.children).find(c => c.classList.contains('selected'));
    if (first && scanProfileHelp) {
        const mod = MODULE_CARDS.find(m => m.id === first.dataset.value);
        scanProfileHelp.textContent = mod ? mod.desc : 'Select modules to include in your ZIP report.';
    }
    updateSelectAllUI();
}

function renderTokenInspector(payload) {
    const panel = document.getElementById('tokenInspector');
    const tierBadge = document.getElementById('tiTierBadge');
    const expiry = document.getElementById('tiExpiry');
    const project = document.getElementById('tiProject');
    const moduleGrid = document.getElementById('tiModuleGrid');
    const cmdEl = document.getElementById('tiScanCommand');
    if (!panel) return;
    if (!payload) { panel.style.display = 'none'; return; }

    const tier = payload.tier || payload.product || 'community';
    const config = PRODUCT_CONFIG[tier] || PRODUCT_CONFIG.universal || {};
    const allModules = TIER_MODULE_MAP.universal || [];
    const customFeatures = Array.isArray(payload.features) ? payload.features : (Array.isArray(payload.modules) ? payload.modules : null);
    const numToId = {'1':'gate','2':'consolidation','3':'mock-data','4':'roadmap','5':'codebase','6':'file-reduction','7':'data-quality','8':'cleanup','9':'npm-audit','10':'compliance','11':'eu-ai-act','12':'dependency-vulns','13':'build-readiness','14':'ai-indicators','15':'governance','16':'junk-files','17':'ai-residue','18':'performance','19':'type-safety','20':'documentation','21':'test-coverage','22':'accessibility','23':'i18n','24':'sensitive-data','25':'config-drift','26':'security-headers','27':'database-patterns','28':'framework-practices','29':'workspace-health','30':'unused-deps','31':'api-contract','32':'complexity'};
    const allowed = (tier === 'custom' && customFeatures)
        ? customFeatures.map(m => numToId[m] || m).filter(m => allModules.includes(m))
        : (TIER_MODULE_MAP[tier] || TIER_MODULE_MAP.locked || []);

    // Tier badge
    tierBadge.textContent = config.label || tier;
    tierBadge.className = 'ti-badge tier-' + tier;

    // Expiry
    const totalDays = (tier === 'euai' || tier === 'euSprint') ? 30 : (tier === 'executive' ? 90 : (tier === 'instant' ? 7 : (tier === 'team' || tier === 'enterprise' ? 365 : 30)));
    let expiryText = '';
    let expiryClass = '';
    if (payload.exp) {
        const msRemaining = (payload.exp * 1000) - Date.now();
        const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
        if (daysRemaining === 0) {
            expiryText = 'EXPIRED';
            expiryClass = 'expired';
            tierBadge.className = 'ti-badge tier-expired';
        } else if (daysRemaining <= 7) {
            expiryText = daysRemaining + ' days left';
            expiryClass = 'warning';
        } else {
            expiryText = daysRemaining + ' days left';
            expiryClass = '';
        }
    } else {
        expiryText = 'No expiry';
        expiryClass = '';
    }
    expiry.textContent = expiryText;
    expiry.className = 'ti-expiry ' + expiryClass;

    // Project
    project.textContent = payload.projectName || payload.clientName || '';

    // Module grid
    const moduleLabels = {
        gate: 'Gate', consolidation: 'Consolidation', 'mock-data': 'Mock Data', roadmap: 'Roadmap',
        codebase: 'Codebase', 'file-reduction': 'File Reduction', 'data-quality': 'Data Quality',
        cleanup: 'Cleanup', 'npm-audit': 'npm Audit', compliance: 'Compliance', 'eu-ai-act': 'EU AI Act',
        'dependency-vulns': 'Dep Vulns', 'build-readiness': 'Build Ready', 'ai-indicators': 'AI Indicators',
        governance: 'Governance', 'junk-files': 'Junk Files', 'ai-residue': 'AI Residue',
        performance: 'Performance', 'type-safety': 'Type Safety', documentation: 'Documentation',
        'test-coverage': 'Test Coverage', accessibility: 'Accessibility', i18n: 'i18n',
        'sensitive-data': 'Sensitive Data', 'config-drift': 'Config Drift', 'security-headers': 'Security Headers',
        'database-patterns': 'Database Patterns', 'framework-practices': 'Framework Practices',
        'workspace-health': 'Workspace Health', 'unused-deps': 'Unused Deps', 'api-contract': 'API Contract',
        complexity: 'Complexity', 'fix-preview': 'Fix Preview'
    };
    moduleGrid.innerHTML = allModules.map(mod => {
        const isUnlocked = allowed.includes(mod);
        const label = moduleLabels[mod] || mod;
        return `<span class="ti-mod${isUnlocked ? '' : ' locked'}">${isUnlocked ? '&#10003;' : '&#10005;'} ${label}</span>`;
    }).join('');

    // Scan command
    const scanCmd = config.scanCommand || 'npx simplebeacon scan --gate --offline';
    cmdEl.textContent = scanCmd;

    panel.style.display = 'block';
}

function applyProductFromToken(token) {
    const banner = document.getElementById('sprintBanner');
    if (!token) {
        window._tokenPayload = null;
        if (banner) banner.style.display = 'none';
        filterScanProfiles('locked');
        syncModuleSelectionFromTier();
        updateDropzoneGate();
        const infoCard = document.getElementById('productInfoCard');
        if (infoCard) infoCard.style.display = 'none';
        document.getElementById('productLabel').textContent = '';
        document.getElementById('pageTitle').textContent = 'Upload Your Scan Report';
        document.getElementById('pageSubtitle').textContent = 'Generate an Executive Risk Certificate from your local SimpleBeacon scan.';
        document.getElementById('tokenHelp').textContent = 'Paste the license token from your payment confirmation email.';
        document.getElementById('submitBtn').style.display = '';
        renderTokenInspector(null);
        return;
    }
    const payload = decodeJwtPayload(token);
    if (!payload) {
        filterScanProfiles('locked');
        syncModuleSelectionFromTier();
        updateDropzoneGate();
        return;
    }
    window._tokenPayload = payload;
    const tier = payload.tier || payload.product || 'executive';
    const customFeatures = Array.isArray(payload.features) ? payload.features : (Array.isArray(payload.modules) ? payload.modules : null);
    if (customFeatures && tier === 'custom') {
        filterScanProfiles('custom');
        syncModuleSelectionFromTier();
    } else {
        filterScanProfiles(tier);
        syncModuleSelectionFromTier();
    }
    const config = PRODUCT_CONFIG[tier] || PRODUCT_CONFIG.universal;
    document.getElementById('productLabel').textContent = config.label;
    document.getElementById('pageTitle').textContent = config.title;
    document.getElementById('pageSubtitle').textContent = config.subtitle;
    document.getElementById('tokenHelp').textContent = config.tokenHelp;
    if (!config.showUpload) {
        document.getElementById('submitBtn').style.display = 'none';
    }
    if (config.scanCommand) {
        const helpTexts = document.querySelectorAll('.help-text');
        helpTexts.forEach(h => {
            if (h.textContent.includes('simplebeacon.js scan')) {
                h.innerHTML = `Generated by: <code>${config.scanCommand}</code>`;
            }
        });
    }
    renderTokenInspector(payload);
    const infoCard = document.getElementById('productInfoCard');
    if (infoCard) {
        infoCard.style.display = 'block';
        document.getElementById('productDetails').innerHTML = `
            <strong style="color:var(--text-main);font-size:1.1rem;">${config.label}</strong><br>
            <span style="color:var(--accent);font-weight:700;font-size:1.05rem;">${config.price || ''}</span><br>
            <span style="color:var(--text-muted);font-size:0.85rem;">${config.subtitle}</span>
        `;
    }
    if (banner && payload.exp && tier !== 'community') {
        const totalDays = (tier === 'euai' || tier === 'euSprint') ? 30 : (tier === 'executive' ? 90 : (tier === 'instant' ? 7 : (tier === 'team' || tier === 'enterprise' ? 365 : 30)));
        const msRemaining = (payload.exp * 1000) - Date.now();
        const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
        const isExpired = daysRemaining === 0;
        const pct = isExpired ? 0 : Math.max(0, Math.min(100, (msRemaining / (totalDays * 24 * 60 * 60 * 1000)) * 100));
        const daysEl = document.getElementById('sprintDays');
        const tierEl = document.getElementById('sprintTier');
        const projEl = document.getElementById('sprintProject');
        const fill = document.getElementById('sprintExpiryFill');
        if (isExpired) {
            daysEl.innerHTML = '<span style="color:#EF4444;font-weight:700;">EXPIRED</span>';
            tierEl.textContent = config.label;
            projEl.textContent = payload.projectName || 'default-project';
            fill.style.width = '0%';
            fill.style.background = 'linear-gradient(90deg,#EF4444,#991B1B)';
            banner.style.border = '1px solid rgba(239,68,68,0.4)';
            banner.style.background = 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(153,27,27,0.08))';
        } else {
            daysEl.textContent = daysRemaining;
            tierEl.textContent = config.label;
            projEl.textContent = payload.projectName || 'default-project';
            fill.style.width = pct + '%';
            if (pct < 15) fill.style.background = 'linear-gradient(90deg,#EF4444,#F59E0B)';
            else if (pct < 40) fill.style.background = 'linear-gradient(90deg,#F59E0B,#10B981)';
            else fill.style.background = 'linear-gradient(90deg,#2563EB,#10B981)';
            banner.style.border = '';
            banner.style.background = '';
        }
        banner.style.display = 'block';
    }
    updateDropzoneGate();
}

// Analyzer presets for quick module selection
const ANALYZER_PRESETS = [
    { id: 'essential', label: 'Essential', icon: '⚡', modules: ['gate','consolidation','mock-data','roadmap','codebase','file-reduction','data-quality','cleanup','npm-audit','compliance'] },
    { id: 'security', label: 'Security', icon: '🔒', modules: ['gate','consolidation','mock-data','roadmap','codebase','file-reduction','data-quality','cleanup','npm-audit','compliance','dependency-vulns','sensitive-data','security-headers','config-drift','eval-danger','inner-html-xss','prototype-pollution','unvalidated-redirect','missing-rate-limit','insecure-random','logging-secrets'] },
    { id: 'full', label: 'Full', icon: '🔬', modules: (typeof MODULE_CARDS !== 'undefined' ? MODULE_CARDS : []).map(m => m.id) },
    { id: 'custom', label: 'Custom', icon: '🔧', modules: [] }
];

function applyAnalyzerPreset(presetId) {
    const preset = ANALYZER_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    if (!analyzerCardGrid) return;
    const unlocked = Array.from(analyzerCardGrid.children).filter(c => !c.classList.contains('locked'));
    if (preset.id === 'custom') {
        unlocked.forEach(card => {
            card.classList.remove('selected');
            selectedModules.delete(card.dataset.value);
        });
    } else {
        unlocked.forEach(card => {
            const id = card.dataset.value;
            if (preset.modules.includes(id)) {
                card.classList.add('selected');
                selectedModules.add(id);
            } else {
                card.classList.remove('selected');
                selectedModules.delete(id);
            }
        });
    }
    updateSelectAllUI();
    updatePresetActiveState(presetId);
}

function updatePresetActiveState(activeId) {
    const container = document.getElementById('analyzerPresets');
    if (!container) return;
    container.querySelectorAll('.analyzer-preset-btn').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.preset === activeId);
    });
}

function bindPresetButtons() {
    const container = document.getElementById('analyzerPresets');
    if (!container) return;
    container.querySelectorAll('.analyzer-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyAnalyzerPreset(btn.dataset.preset));
    });
}

if (typeof window !== 'undefined') {
    window.decodeJwtPayload = decodeJwtPayload;
    window.hasValidToken = hasValidToken;
    window.filterScanProfiles = filterScanProfiles;
    window.renderAnalyzerCards = renderAnalyzerCards;
    window.toggleModuleSelection = toggleModuleSelection;
    window.updateSelectAllUI = updateSelectAllUI;
    window.syncModuleSelectionFromTier = syncModuleSelectionFromTier;
    window.renderTokenInspector = renderTokenInspector;
    window.applyProductFromToken = applyProductFromToken;
    window.applyAnalyzerPreset = applyAnalyzerPreset;
    window.bindPresetButtons = bindPresetButtons;
}
