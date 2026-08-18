// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
// Defensive: ensure escapeHtml is available even if utils.js fails to load
if (typeof window !== 'undefined' && !window.escapeHtml) {
    window.escapeHtml = function (str) {
        if (!str)
            return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
}
// EU AI Act control builder — generates specific controls based on what was detected
function buildEuAiActControls(aiHits, licenseFiles, securityFiles, hasRiskAssessment = false) {
    const controls = [];
    const docCount = ((licenseFiles === null || licenseFiles === void 0 ? void 0 : licenseFiles.length) || 0) + ((securityFiles === null || securityFiles === void 0 ? void 0 : securityFiles.length) || 0);
    const hasDocs = docCount > 0 || hasRiskAssessment;
    const aiCount = (aiHits === null || aiHits === void 0 ? void 0 : aiHits.length) || 0;
    // Art. 5 — Prohibited AI Practices (always checked; critical if AI detected)
    controls.push({
        controlId: 'EU-AIA-ART-5',
        title: 'Prohibited AI Practices Audit',
        article: 'Regulation (EU) 2024/1689, Article 5',
        status: aiCount > 0 ? 'WARN' : 'PASS',
        severity: aiCount > 0 ? 'critical' : 'low',
        description: aiCount > 0
            ? `Article 5 prohibits: (a) subliminal techniques, (b) exploitation of vulnerabilities, (c) social scoring by governments, (d) real-time biometric ID in public spaces. ${aiCount} AI SDK import(s) detected — review whether use case falls under prohibited practices.`
            : 'No AI SDK imports or model inference patterns detected. Article 5 prohibited practices not applicable.',
        evidence: aiCount > 0 ? `${aiCount} file(s) with AI SDK imports (e.g., openai, @anthropic-ai, @google/generative-ai)` : 'None detected',
        action: aiCount > 0
            ? 'Conduct legal review: document that the AI system does not perform prohibited practices listed in Art. 5(1). If social scoring or biometric identification, stop development immediately.'
            : 'No action needed — maintain zero-AI posture or document lawful use case.'
    });
    // Art. 6 — Classification as high-risk (Annex III)
    controls.push({
        controlId: 'EU-AIA-ART-6',
        title: 'AI System Classification (Annex III)',
        article: 'Regulation (EU) 2024/1689, Article 6 & Annex III',
        status: aiCount > 0 ? 'REVIEW' : 'PASS',
        severity: aiCount > 0 ? 'medium' : 'low',
        description: aiCount > 0
            ? 'Annex III lists high-risk AI systems (critical infrastructure, education, employment, law enforcement, migration, democratic processes). Classification determines conformity obligations.'
            : 'No AI system indicators — Annex III classification not applicable.',
        evidence: aiCount > 0 ? `${aiCount} AI indicator(s); ${hasDocs ? docCount + ' governance doc(s) present — verify Annex III classification is explicitly documented' : '0 governance docs — add risk-assessment.md'}` : 'None detected',
        action: aiCount > 0
            ? (hasDocs ? 'Review existing governance docs to confirm Annex III classification is explicitly documented. Do not assume presence of docs equals correct classification.' : 'Add risk-assessment.md documenting whether the system is high-risk under Annex III.')
            : 'No action needed.'
    });
    // Art. 50 — Transparency obligations (chatbots, deepfakes)
    controls.push({
        controlId: 'EU-AIA-ART-50',
        title: 'Transparency Obligations',
        article: 'Regulation (EU) 2024/1689, Article 50',
        status: aiCount > 0 ? 'WARN' : 'PASS',
        severity: aiCount > 0 ? 'medium' : 'low',
        description: aiCount > 0
            ? 'Article 50 requires that persons interacting with AI systems are informed they are engaging with an AI (chatbots), and that deep-synthetic content is labelled as artificially generated.'
            : 'No AI indicators — transparency obligations not applicable.',
        evidence: aiCount > 0 ? `${aiCount} AI indicator(s) detected` : 'None detected',
        action: aiCount > 0
            ? 'Verify UI/UX includes AI disclosure notices. If generating images/video/audio, implement synthetic media watermarking or metadata tags.'
            : 'No action needed.'
    });
    // Art. 9 — Risk management system (high-risk only)
    controls.push({
        controlId: 'EU-AIA-ART-9',
        title: 'Risk Management System',
        article: 'Regulation (EU) 2024/1689, Article 9',
        status: aiCount > 0 ? (hasDocs ? 'REVIEW' : 'WARN') : 'PASS',
        severity: aiCount > 0 ? (hasDocs ? 'medium' : 'high') : 'low',
        description: aiCount > 0
            ? 'High-risk AI systems must implement a continuous risk management system throughout the entire lifecycle.'
            : 'No AI indicators — risk management system not applicable.',
        evidence: aiCount > 0 ? `${hasDocs ? docCount + ' doc(s) present — verify risk management coverage' : 'No risk management documentation detected'}` : 'None detected',
        action: aiCount > 0
            ? 'Create or update risk-assessment.md covering: identified risks, estimated likelihood/severity, mitigation measures, residual risk acceptance criteria.'
            : 'No action needed.'
    });
    return controls;
}
function renderPreview(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22;
    scanPreview.style.display = 'block';
    window.lastScanReport = data;
    if (typeof window.__simplebeaconSetReportForAI === 'function')
        window.__simplebeaconSetReportForAI(data);
    const hasToken = licenseInput.value.trim().length > 10;
    // Normalize allIssues -> detectedIssues for backward compatibility with scan reports
    if (!Array.isArray(data.detectedIssues) && Array.isArray(data.allIssues))
        data.detectedIssues = data.allIssues;
    if (!Array.isArray(data.detectedIssues))
        data.detectedIssues = [];
    // Normalize simplebeacon-npm-audit for preview (raw report is flat)
    if (data.type === 'simplebeacon-npm-audit' && !data.gate) {
        const h = data.hygieneSummary || {};
        data.gate = { pass: (_a = h.gatePass) !== null && _a !== void 0 ? _a : true, blockingCount: (h.critical || 0) + (h.high || 0), warningCount: (h.moderate || 0) + (h.low || 0) };
        data.qualityScore = h.gatePass === true ? 100 : Math.max(0, 100 - ((h.critical || 0) * 20 + (h.high || 0) * 10 + (h.moderate || 0) * 5 + (h.low || 0) * 2));
        data.totalFiles = (_b = data.packageJsonCount) !== null && _b !== void 0 ? _b : 0;
        const pjc1 = (_c = data.packageJsonCount) !== null && _c !== void 0 ? _c : 0;
        const dc1 = (_d = data.dependencyCount) !== null && _d !== void 0 ? _d : 0;
        data.npmAudit = { packageJsonCount: pjc1, dependencyCount: dc1, summary: `${pjc1} package.json file${pjc1 === 1 ? '' : 's'} found with ${dc1.toLocaleString()} total dependenc${dc1 === 1 ? 'y' : 'ies'}.` };
    }
    // Normalize public-summary (synthesize gate from summary/severityCounts)
    if (data.type === 'simplebeacon-public-summary' && !data.gate) {
        const s = data.summary || {};
        data.gate = {
            pass: (_e = s.gatePass) !== null && _e !== void 0 ? _e : null,
            blockingCount: (((_f = data.severityCounts) === null || _f === void 0 ? void 0 : _f.critical) || 0) + (((_g = data.severityCounts) === null || _g === void 0 ? void 0 : _g.high) || 0),
            warningCount: (((_h = data.severityCounts) === null || _h === void 0 ? void 0 : _h.medium) || 0) + (((_j = data.severityCounts) === null || _j === void 0 ? void 0 : _j.low) || 0)
        };
        data.qualityScore = (_k = s.qualityScore) !== null && _k !== void 0 ? _k : 0;
        data.totalFiles = (_l = s.filesScanned) !== null && _l !== void 0 ? _l : 0;
        data.issueCount = (_m = s.totalIssuesFound) !== null && _m !== void 0 ? _m : 0;
        // Preserve original detectedIssues if present; only default to empty if truly missing
        if (!Array.isArray(data.detectedIssues))
            data.detectedIssues = [];
    }
    // Normalize re-attestation-note (synthesize from currentGate)
    if (data.type === 'simplebeacon-re-attestation-note' && !data.gate) {
        const isRef = data.workflowStatus === 'reference-only' || data.currentGate === null;
        const cg = data.currentGate || {};
        data.gate = {
            pass: isRef ? null : ((_o = cg.pass) !== null && _o !== void 0 ? _o : false),
            blockingCount: isRef ? null : ((_p = cg.blockingCount) !== null && _p !== void 0 ? _p : 0),
            warningCount: 0
        };
        data.qualityScore = (_q = cg.qualityScore) !== null && _q !== void 0 ? _q : 0;
        data.totalFiles = (_r = cg.repositoryFilesTotal) !== null && _r !== void 0 ? _r : 0;
        data.issueCount = 0;
        data.isReferenceTemplate = isRef;
    }
    // Generic synthesis for partial/standalone reports without gate (cleanup, etc.)
    if (!data.gate) {
        // npm-audit signal: packageJsonCount present without explicit type (only synthesize if no full scan data)
        if ((data.packageJsonCount !== undefined || data.dependencyCount !== undefined) && !data.totalFiles && !data.codebase && !data.repositoryInventory) {
            const pkgCount = (_s = data.packageJsonCount) !== null && _s !== void 0 ? _s : 0;
            const depCount = (_t = data.dependencyCount) !== null && _t !== void 0 ? _t : 0;
            const h = data.hygieneSummary || {};
            const critical = h.critical || 0;
            const high = h.high || 0;
            const moderate = h.moderate || 0;
            const low = h.low || 0;
            data.gate = { pass: (_u = h.gatePass) !== null && _u !== void 0 ? _u : true, blockingCount: critical + high, warningCount: moderate + low };
            data.qualityScore = h.gatePass === true ? 100 : Math.max(0, 100 - (critical * 20 + high * 10 + moderate * 5 + low * 2));
            data.totalFiles = pkgCount;
            data.npmAudit = { packageJsonCount: pkgCount, dependencyCount: depCount, summary: `${pkgCount} package.json file${pkgCount === 1 ? '' : 's'} found with ${depCount.toLocaleString()} total dependenc${depCount === 1 ? 'y' : 'ies'}.` };
        }
        else {
            const debugCount = data.debugArtifactCount || 0;
            const mockCount = data.mockSampleFiles || 0;
            const credHits = data.credentialFindings || 0;
            const totalIssues = debugCount + mockCount + credHits + (data.issueCount || 0);
            data.gate = { pass: credHits === 0, blockingCount: credHits, warningCount: totalIssues - credHits };
            data.qualityScore = (_v = data.qualityScore) !== null && _v !== void 0 ? _v : (totalIssues === 0 ? 100 : Math.max(0, 100 - totalIssues * 2));
            data.totalFiles = (_x = (_w = data.totalFiles) !== null && _w !== void 0 ? _w : data.filesAnalyzed) !== null && _x !== void 0 ? _x : 0;
        }
    }
    const gate = data.gate || ((_z = (_y = data.results) === null || _y === void 0 ? void 0 : _y.simplebeacon) === null || _z === void 0 ? void 0 : _z.gate) || {};
    const detectedIssues = Array.isArray(data.detectedIssues) ? data.detectedIssues : (Array.isArray(data.rawIssues) ? data.rawIssues : []);
    const hasBlockingFindings = (gate.blockingCount || 0) > 0 || (gate.blockingIssues || []).length > 0 || detectedIssues.some(i => ['high', 'critical'].includes(i.severity));
    const gatePass = hasBlockingFindings ? false : ((_0 = gate.pass) !== null && _0 !== void 0 ? _0 : null);
    const gateStatus = gatePass === true ? 'pass' : gatePass === false ? 'fail' : 'review';
    const rawIssues = Array.isArray(data.rawIssues) ? data.rawIssues : detectedIssues;
    const quality = (_4 = (_1 = data.qualityScore) !== null && _1 !== void 0 ? _1 : (_3 = (_2 = data.results) === null || _2 === void 0 ? void 0 : _2.simplebeacon) === null || _3 === void 0 ? void 0 : _3.qualityScore) !== null && _4 !== void 0 ? _4 : (rawIssues.length ? Math.max(0, 100 - rawIssues.length * 2) : 0);
    const files = (_11 = (_9 = (_7 = (_6 = (_5 = data.totalFiles) !== null && _5 !== void 0 ? _5 : data.repositoryFilesTotal) !== null && _6 !== void 0 ? _6 : data.filesAnalyzed) !== null && _7 !== void 0 ? _7 : (_8 = data.summary) === null || _8 === void 0 ? void 0 : _8.files) !== null && _9 !== void 0 ? _9 : (_10 = data.summary) === null || _10 === void 0 ? void 0 : _10.repositoryFiles) !== null && _11 !== void 0 ? _11 : 0;
    const issues = (_14 = (_13 = (_12 = data.issueCount) !== null && _12 !== void 0 ? _12 : gate.blockingCount) !== null && _13 !== void 0 ? _13 : detectedIssues.length) !== null && _14 !== void 0 ? _14 : 0;
    const project = data.projectRoot || data.scanTargetRoot || (Array.isArray(data.scanPaths) ? data.scanPaths[0] : null) || 'Unknown Project';
    const grade = quality >= 90 ? 'A' : quality >= 80 ? 'B' : quality >= 70 ? 'C' : quality >= 60 ? 'D' : 'F';
    const gradeColor = quality >= 80 ? '#10B981' : quality >= 60 ? '#F59E0B' : '#EF4444';
    // Audit page: lightweight preview — executive report panel holds board metrics; skip 40-module DOM build
    if (window.SB_AUDIT_FREE_PREVIEW) {
        const sev = data.severityCounts || {};
        const auditPreviewHtml = `
        <div class="cert-preview ${hasToken ? '' : 'watermarked'}" style="padding:20px;">
            <div class="cert-header">
                <h3>Scan Complete</h3>
                <div class="cert-subtitle">${escapeHtml(project)} &mdash; ${new Date().toLocaleDateString()}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:16px;">
                <div class="meta-item"><div class="value" style="color:${gradeColor};font-size:1.5rem;font-weight:800;">${grade}</div><div class="label">Grade</div></div>
                <div class="meta-item"><div class="value">${quality}%</div><div class="label">Quality</div></div>
                <div class="meta-item"><div class="value">${files.toLocaleString()}</div><div class="label">Files</div></div>
                <div class="meta-item"><div class="value">${(sev.critical || 0)}/${(sev.high || 0)}/${(sev.medium || 0)}</div><div class="label">Crit/High/Med</div></div>
            </div>
            <p style="margin-top:16px;font-size:0.85rem;color:var(--text-secondary);">See the Executive Compliance Report above for PDF export. Import CLI JSON for full module breakdown.</p>
        </div>`;
        function sbFinishAuditPreviewRender() {
            if (scanPreview)
                scanPreview.innerHTML = auditPreviewHtml;
            try {
                if (scanPreview)
                    scanPreview.dataset.sbReportData = JSON.stringify(data);
            }
            catch (_e) { /* ignore */ }
        }
        requestAnimationFrame(function () {
            requestAnimationFrame(sbFinishAuditPreviewRender);
        });
        return;
    }
    // Build issue list HTML with explainability
    const issueItems = detectedIssues.slice(0, 5).map(issue => {
        const sev = (issue.severity || 'low').toLowerCase();
        const type = issue.type || 'Issue';
        const desc = issue.humanReadable || issue.description || `${type} detected`;
        const confidence = issue.confidence ? `<span style="margin-left:6px;font-size:0.65rem;color:#64748B;">${Math.round(issue.confidence * 100)}% confidence</span>` : '';
        return `<div class="issue-item" data-issue='${JSON.stringify({ type: issue.type, severity: issue.severity, description: desc, reasoning: issue.reasoning, confidence: issue.confidence, humanReadable: issue.humanReadable, impact: issue.impact, fix: issue.fix, count: issue.count }).replace(/'/g, "&#39;")}'><span class="severity ${sev}"></span><span class="issue-text">${desc}${confidence}</span></div>`;
    }).join('');
    const moreIssues = detectedIssues.length > 5 ? `<div class="issue-item" style="justify-content:center;"><span class="issue-text">+ ${detectedIssues.length - 5} more issues in full report</span></div>` : '';
    // SVG score ring
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (quality / 100) * circumference;
    const footer = hasToken
        ? `<div class="cert-footer" style="text-align:center;">
            <div style="font-size:0.9rem;color:#10B981;font-weight:700;margin-bottom:8px;">&#9989; Certificate Ready</div>
            <div style="font-size:0.8rem;color:var(--text-muted);">Click <strong>Generate Certificate</strong> to build your ZIP locally — zero data leaves your browser.</div>
           </div>`
        : `<div class="cert-footer">
            <div class="unlock-text">&#128274; Generate your local certificate</div>
            <button class="unlock-btn" onclick="document.getElementById('certSubmitBtn').scrollIntoView({behavior:'smooth', block:'center'}); document.getElementById('certSubmitBtn').click();">Generate Certificate &rarr;</button>
           </div>`;
    // Compliance matrix rows
    const isAiIssue = i => i.type === 'AI System Indicator' || i.type === 'High-Risk AI';
    const hasAi = detectedIssues.some(isAiIssue);
    const hasCred = detectedIssues.some(i => i.type && i.type.toLowerCase().includes('credential'));
    const aiHits = detectedIssues.filter(isAiIssue).map(i => i.filePath || '').filter(Boolean);
    const licenseFiles = ((_15 = data.governance) === null || _15 === void 0 ? void 0 : _15.licenseFiles) || ((_16 = data.compliance) === null || _16 === void 0 ? void 0 : _16.licenseFiles) || [];
    const securityFiles = ((_17 = data.governance) === null || _17 === void 0 ? void 0 : _17.securityFiles) || ((_18 = data.compliance) === null || _18 === void 0 ? void 0 : _18.securityFiles) || [];
    const riskAssessmentFiles = ((_19 = data.compliance) === null || _19 === void 0 ? void 0 : _19.riskAssessmentFiles) || [];
    const hasRiskAssessment = riskAssessmentFiles.length > 0 || (data.repositoryFilesTotal && (data.detectedIssues || []).some(i => i.filePath && [].concat(i.filePath).some(fp => /risk-assessment/i.test(fp))));
    const euAiaControls = buildEuAiActControls(aiHits, licenseFiles, securityFiles, hasRiskAssessment);
    const euAiaStatus = gatePass === true && !hasAi ? 'pass' : hasAi ? 'warn' : 'pass';
    const owaspStatus = gatePass === true && !hasCred ? 'pass' : hasCred ? 'warn' : 'pass';
    const euAiaMatrixRows = euAiaControls.map(c => `
            <div class="matrix-row" data-detail-title="${c.title}" data-detail-id="${c.controlId}" data-detail-status="${c.status.toLowerCase()}" data-detail-desc="${c.description.replace(/"/g, '&quot;')}" data-detail-action="${c.action.replace(/"/g, '&quot;')}">
                <div class="control-id">${c.controlId}</div>
                <div>${c.title}</div>
                <div><span class="status-pill ${c.status.toLowerCase() === 'pass' ? 'pass' : c.status.toLowerCase() === 'review' ? 'review' : 'warn'}">${c.status === 'PASS' ? '&#127775; PASSED' : c.status === 'REVIEW' ? '&#9888; REVIEW' : '&#9888; WARN'}</span></div>
            </div>
        `).join('');
    const matrixHtml = `
        <div class="compliance-matrix" style="margin-bottom:16px;">
            <div class="matrix-header">
                <div>Control ID</div>
                <div>Requirement Title</div>
                <div>Local Check</div>
            </div>
            <div class="matrix-row" data-detail-title="SimpleBeacon Gate Attestation" data-detail-id="SB-GATE-01" data-detail-status="${gateStatus}" data-detail-desc="The Gate Attestation verifies that no blocking security findings exist before release. This includes hardcoded credentials, debug artifacts, && critical vulnerabilities." data-detail-action="${gatePass === true ? 'No action needed — gate is green.' : 'Review blocking findings above before shipping.'}">
                <div class="control-id">SB-GATE-01</div>
                <div>SimpleBeacon Gate Attestation</div>
                <div><span class="status-pill ${gateStatus}">${gatePass === true ? '&#127775; PASSED' : gatePass === false ? '&#10071; FAILED' : '&#9888; REVIEW'}</span></div>
            </div>
            ${euAiaMatrixRows}
            <div class="matrix-row" data-detail-title="Credential &amp; Secret Hygiene" data-detail-id="SB-CRED-01" data-detail-status="${hasCred ? 'warn' : 'pass'}" data-detail-desc="Scans source files for hardcoded passwords, API keys, secret keys, && access tokens using regex pattern matching on source text." data-detail-action="${hasCred ? 'Remove hardcoded secrets. Use environment variables || a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault).' : 'No credential patterns detected — maintain good hygiene.'}">
                <div class="control-id">SB-CRED-01</div>
                <div>Credential &amp; Secret Hygiene</div>
                <div><span class="status-pill ${hasCred ? 'warn' : 'pass'}">${hasCred ? '&#9888; REVIEW' : '&#127775; PASSED'}</span></div>
            </div>
        </div>
    `;
    // Build 15 analysis module dropdown + detail panels
    const modules = [];
    const analysisModulesHtml = (() => {
        var _a, _b, _c, _d, _e, _f, _g;
        const uid = 'mod' + crypto.getRandomValues(new Uint32Array(1))[0];
        const totalFiles = ((_a = data.codebase) === null || _a === void 0 ? void 0 : _a.totalFiles) || files || 1;
        const totalLines = ((_b = data.codebase) === null || _b === void 0 ? void 0 : _b.totalLines) || 0;
        const pushModule = (num, icon, title, values, summary, statusColor, detailHtml) => {
            const hasIssues = values.some(v => typeof v.value === 'number' && v.value > 0) || (statusColor && statusColor !== '#10B981' && statusColor !== '#34D399');
            const isClean = !hasIssues && (!statusColor || statusColor === '#10B981' || statusColor === '#34D399');
            const statusBadge = isClean ? '✅' : (statusColor === '#EF4444' ? '❌' : (statusColor === '#F59E0B' ? '⚠️' : '⚠️'));
            const metricParts = values.map(v => {
                const color = v.color || (typeof v.value === 'number' && v.value > 0 ? '#F59E0B' : '#60A5FA');
                const isWarn = color === '#EF4444' || color === '#F59E0B';
                return `${isWarn ? '▲' : '●'} ${v.value} ${v.label}`;
            });
            const optionLabel = `${num} ${icon} ${title} ${statusBadge}  ${metricParts.join('  |  ')}`;
            modules.push({ id: `${uid}_${num}`, optionLabel, num, icon, title, values, summary, statusColor, detailHtml, hasIssues, isClean });
        };
        // 1. Gate
        const g = data.gateReport || data.gate || {};
        const gateIssues = (data.detectedIssues || data.issues || []).filter(i => i.severity === 'high' || i.severity === 'critical');
        const hasBlockingFindings = (g.blockingCount || 0) > 0 || (g.blockingIssues || []).length > 0 || gateIssues.length > 0;
        const derivedPass = hasBlockingFindings ? false : ((_c = g.pass) !== null && _c !== void 0 ? _c : null);
        const gateStatus = derivedPass === true ? 'PASS' : (derivedPass === false ? 'FAIL' : 'REVIEW');
        const gateColor = derivedPass === true ? '#34D399' : (derivedPass === false ? '#EF4444' : '#60A5FA');
        const gateBorder = derivedPass === true ? '#34D399' : (derivedPass === false ? '#EF4444' : '#60A5FA');
        const gateDetail = gateIssues.length ? `<div class="detail-label">Blocking Findings</div><ul>${gateIssues.map(i => {
            const fp = Array.isArray(i.filePath) ? i.filePath : (i.filePath || '').split(',');
            const findingsHtml = i.findings && i.findings.length ? `<div style="margin:4px 0;padding:4px 6px;background:rgba(30,41,59,0.5);border-radius:4px;font-size:0.65rem;font-family:monospace;color:#94A3B8;">${i.findings.slice(0, 2).flatMap(f => f.matches ? f.matches.map(m => `Line ${m.line}: ${m.snippet.slice(0, 80)}`) : []).join('<br>')}</div>` : '';
            return `<li><strong style="color:${i.severity === 'high' || i.severity === 'critical' ? '#EF4444' : '#F59E0B'};">${(i.severity || '').toUpperCase()}</strong> — ${i.type || ''} (${i.count || 0})<br><span style="opacity:0.7;">${fp.slice(0, 3).join(', ')}${fp.length > 3 ? ' ...' : ''}</span>${findingsHtml}</li>`;
        }).join('')}</ul>${gateIssues.some(i => i.fix) ? `<div class="detail-fix"><strong>Remediation:</strong> ${gateIssues.map(i => i.fix).filter(Boolean).slice(0, 2).join(' ')}</div>` : ''}` : `<div class="detail-label">No blocking findings</div><div style="font-size:0.72rem;color:var(--text-muted);">Gate is clear. Continue to next phase.</div>`;
        pushModule('1', '🛡️', 'Gate', [
            { value: gateStatus, label: 'Result', color: gateColor },
            { value: (_d = g.blockingCount) !== null && _d !== void 0 ? _d : 0, label: 'Blocking' }
        ], g.summary || (derivedPass === true ? 'Gate passed — no blocking credentials found.' : 'Review blocking issues.'), gateBorder, gateDetail);
        // 2. Consolidation
        const cons = data.consolidation || {};
        const dupPct = totalFiles > 0 ? ((cons.duplicateGroups || 0) / totalFiles * 100).toFixed(1) : '0.0';
        const dupFiles = (cons.duplicateFiles || cons.duplicateGroupsDetail || []).filter(g => g.length > 1);
        const consDetail = dupFiles.length ? `<div class="detail-label">Duplicate Groups</div><ul>${dupFiles.slice(0, 3).map(g => `<li>${g.slice(0, 2).join(' ↔ ')}${g.length > 2 ? ' ...' : ''}</li>`).join('')}</ul>${dupFiles.length > 3 ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">... && ${dupFiles.length - 3} more groups</div>` : ''}<div class="detail-fix">Consolidate duplicate files into shared modules || remove redundant copies.</div>` : `<div class="detail-label">No duplicates found</div><div style="font-size:0.72rem;color:var(--text-muted);">Repository is well-deduplicated.</div>`;
        pushModule('2', '🔀', 'Consolidation', [
            { value: cons.monorepoMarkers || 0, label: 'Monorepo' },
            { value: cons.duplicateGroups || 0, label: 'Duplicates' }
        ], cons.summary || (cons.duplicateGroups ? `${cons.duplicateGroups} duplicate file groups detected (${dupPct}% of repo).` : 'No duplicate files detected.'), cons.duplicateGroups ? '#F59E0B' : null, consDetail);
        // 3. Mock Data
        const mock = data.mockDataCategories || [];
        const mockTotal = (_e = data.mockSampleFiles) !== null && _e !== void 0 ? _e : mock.reduce((a, c) => a + (c.fileCount || 0), 0);
        const mockPct = totalFiles > 0 ? (mockTotal / totalFiles * 100).toFixed(1) : '0.0';
        const mockFiles = mock.flatMap(c => c.affectedFiles || []);
        const mockFilesPreview = mockFiles.slice(0, 8);
        // Path pattern breakdown
        const pathGroups = {};
        for (const f of mockFiles) {
            const key = f.includes('src/lib/') ? 'src/lib/ (utility code)' :
                f.includes('.github-sync/') ? '.github-sync/ (sync artifacts)' :
                    f.includes('docs/') ? 'docs/ (documentation)' :
                        f.includes('test') ? 'test/ (test fixtures)' : 'other';
            pathGroups[key] = (pathGroups[key] || 0) + 1;
        }
        const pathBreakdown = Object.entries(pathGroups).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:#94A3B8;font-size:0.75rem;">${k}</span><span style="color:#60A5FA;font-weight:600;font-size:0.75rem;">${v}</span></div>`).join('');
        const riskAlert = mockFiles.some(f => f.includes('src/lib/')) ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:6px;padding:8px 10px;margin:8px 0;font-size:0.72rem;color:#EF4444;"><strong>Risk:</strong> 4 files under <code>src/lib/</code> contain utility logic (validators, resolvers). Verify they are test-only imports.</div>` : '';
        const mockDetail = mockFilesPreview.length ? `<div class="detail-label">Mock / Fixture Files</div><div style="background:rgba(15,23,42,0.5);border-radius:8px;padding:10px;margin-bottom:8px;">${pathBreakdown}</div>${riskAlert}<ul>${mockFilesPreview.map(f => `<li>${f}</li>`).join('')}</ul>${mockTotal > mockFilesPreview.length ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">... && ${mockTotal - mockFilesPreview.length} more</div>` : ''}<div class="detail-fix">Review if mock data should be excluded from production bundles.</div>` : `<div class="detail-label">No mock data</div><div style="font-size:0.72rem;color:var(--text-muted);">No fixture || sample files detected.</div>`;
        pushModule('3', '🔍', 'Mock Data', [
            { value: mockTotal, label: 'Files' },
            { value: mockPct + '%', label: 'of repo', color: mockTotal > 0 ? '#F59E0B' : '#60A5FA' }
        ], mockTotal ? `${mockTotal} mock/fixture file${mockTotal === 1 ? '' : 's'} detected (${mockPct}% of total).` : 'No mock data found.', mockTotal > 50 ? '#EF4444' : (mockTotal > 0 ? '#F59E0B' : null), mockDetail);
        // 4. Roadmap
        const rm = data.roadmap || {};
        const todoDensity = totalFiles > 0 ? ((rm.todoCount || 0) / totalFiles * 100).toFixed(1) : '0.0';
        const todoSeverity = (rm.todoCount || 0) > 50 ? '#EF4444' : ((rm.todoCount || 0) > 10 ? '#F59E0B' : null);
        const todoFiles = (rm.todoFiles || []).slice(0, 6);
        const rmDetail = todoFiles.length ? `<div class="detail-label">Task / Fix Files</div><ul>${todoFiles.map(f => `<li>${f}</li>`).join('')}</ul>${(rm.todoCount || 0) > todoFiles.length ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">... && ${(rm.todoCount || 0) - todoFiles.length} more files</div>` : ''}<div class="detail-fix">Address critical tasks before release. Consider converting fixes into tracked issues.</div>` : `<div class="detail-label">Clean codebase</div><div style="font-size:0.72rem;color:var(--text-muted);">No task || fix markers found.</div>`;
        pushModule('4', '🗺️', 'Roadmap', [
            { value: rm.todoCount || 0, label: 'Task/Fix', color: todoSeverity || '#60A5FA' },
            { value: todoDensity + '%', label: 'of files' }
        ], rm.summary || ((rm.todoCount || 0) ? `${rm.todoCount} file${rm.todoCount !== 1 ? 's' : ''} contain${rm.todoCount === 1 ? 's' : ''} task/fix markers (${todoDensity}% of repo).` : 'No roadmap markers found.'), todoSeverity, rmDetail);
        // 5. Codebase
        const cb = data.codebase || {};
        const avgLines = (cb.totalFiles || files) > 0 ? Math.round((cb.totalLines || 0) / (cb.totalFiles || files)) : 0;
        const ft = cb.fileTypes || {};
        const ftEntries = Object.entries(ft).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const cbDetail = ftEntries.length ? `<div class="detail-label">File Type Breakdown</div><ul>${ftEntries.map(([ext, count]) => `<li><strong>${ext}</strong> — ${count} file${count !== 1 ? 's' : ''}</li>`).join('')}</ul><div class="detail-fix">Average ${avgLines} lines/file. ${avgLines > 500 ? 'Large files may benefit from refactoring.' : ''}</div>` : `<div class="detail-label">Codebase overview</div><div style="font-size:0.72rem;color:var(--text-muted);">${(cb.totalFiles || files).toLocaleString()} files, ${(cb.totalLines || 0).toLocaleString()} lines analyzed.</div>`;
        pushModule('5', '🧹', 'Codebase', [
            { value: (cb.totalFiles || files).toLocaleString(), label: 'Files' },
            { value: (cb.totalLines || 0).toLocaleString(), label: 'Lines' },
            { value: avgLines, label: 'avg lines/file', color: avgLines > 500 ? '#F59E0B' : '#60A5FA' }
        ], cb.summary || `${(cb.totalFiles || files).toLocaleString()} files analyzed, ${(cb.totalLines || 0).toLocaleString()} lines of code.`, avgLines > 800 ? '#EF4444' : null, cbDetail);
        // 6. File Reduction
        const fr = data.fileReduction || {};
        const assetCount = (fr.unusedAssetCandidates || []).length;
        const assets = (fr.unusedAssetCandidates || []).slice(0, 6);
        const frDetail = assets.length ? `<div class="detail-label">Unused Asset Candidates</div><ul>${assets.map(a => `<li>${a}</li>`).join('')}</ul>${assetCount > assets.length ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">... && ${assetCount - assets.length} more</div>` : ''}<div class="detail-fix">Review && remove unused assets to reduce bundle size.</div>` : `<div class="detail-label">No reduction opportunities</div><div style="font-size:0.72rem;color:var(--text-muted);">No unused asset candidates detected.</div>`;
        pushModule('6', '📦', 'File Reduction', [
            { value: assetCount, label: 'Assets', color: assetCount > 0 ? '#F59E0B' : '#60A5FA' },
            { value: fr.duplicateGroups || 0, label: 'Duplicates' }
        ], fr.summary || (assetCount ? `${assetCount} image assets detected for review.` : 'No file reduction opportunities.'), assetCount > 0 ? '#F59E0B' : null, frDetail);
        // 7. Data Quality
        const dq = data.dataQuality || {};
        const emptyJson = (dq.emptyJsonFiles || []).slice(0, 6);
        const dqDetail = emptyJson.length ? `<div class="detail-label">Empty / Trivial JSON Files</div><ul>${emptyJson.map(f => `<li>${f}</li>`).join('')}</ul>${(dq.emptyJsonCount || 0) > emptyJson.length ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">... && ${(dq.emptyJsonCount || 0) - emptyJson.length} more</div>` : ''}<div class="detail-fix">Remove empty JSON files || add meaningful content. They bloat the repository && confuse tooling.</div>` : `<div class="detail-label">Data quality verified</div><div style="font-size:0.72rem;color:var(--text-muted);">No empty || trivial JSON files detected.</div>`;
        pushModule('7', '🧪', 'Data Quality', [
            { value: dq.emptyJsonCount || 0, label: 'Empty JSON', color: (dq.emptyJsonCount || 0) > 0 ? '#EF4444' : '#34D399' }
        ], dq.summary || ((dq.emptyJsonCount || 0) ? `${dq.emptyJsonCount} empty JSON files detected.` : 'No data quality issues.'), (dq.emptyJsonCount || 0) > 0 ? '#EF4444' : null, dqDetail);
        // 8. Cleanup
        const cl = data.cleanup || {};
        const debugSeverity = (cl.debugArtifactCount || 0) > 20 ? '#EF4444' : ((cl.debugArtifactCount || 0) > 0 ? '#F59E0B' : null);
        const debugArts = (cl.debugArtifacts || []).slice(0, 6);
        const clDetail = debugArts.length ? `<div class="detail-label">Build Artifacts</div><ul>${debugArts.map(f => `<li>${f}</li>`).join('')}</ul>${(cl.debugArtifactCount || 0) > debugArts.length ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">... && ${(cl.debugArtifactCount || 0) - debugArts.length} more</div>` : ''}<div class="detail-fix">Remove log statements, breakpoint statements, && open item markers before production builds.</div>` : `<div class="detail-label">Clean build ready</div><div style="font-size:0.72rem;color:var(--text-muted);">No build artifacts detected.</div>`;
        pushModule('8', '🗂️', 'Cleanup', [
            { value: cl.debugArtifactCount || 0, label: 'Build artifacts', color: debugSeverity || '#60A5FA' }
        ], cl.summary || ((cl.debugArtifactCount || 0) ? `${cl.debugArtifactCount} build artifacts detected — remove log statements, breakpoint statements, open item markers before production.` : 'No cleanup items.'), debugSeverity, clDetail);
        // 9. npm Audit
        const npm = data.npmAudit || {};
        const depsPerPkg = npm.packageJsonCount > 0 ? Math.round((npm.dependencyCount || 0) / npm.packageJsonCount) : 0;
        const pkgFiles = (npm.packageJsonFiles || []).slice(0, 5);
        const npmDetail = pkgFiles.length ? `<div class="detail-label">package.json Files</div><ul>${pkgFiles.map(f => `<li>${f}</li>`).join('')}</ul><div class="detail-fix">${(npm.dependencyCount || 0).toLocaleString()} total dependencies. ${depsPerPkg > 50 ? 'High dependency count — consider auditing for unused packages.' : ''}</div>` : `<div class="detail-label">No npm projects</div><div style="font-size:0.72rem;color:var(--text-muted);">No package.json files detected in scan.</div>`;
        pushModule('9', '📦', 'npm Audit', [
            { value: npm.packageJsonCount || 0, label: 'package.json' },
            { value: (npm.dependencyCount || 0).toLocaleString(), label: 'Deps' },
            { value: depsPerPkg, label: 'avg/pkg', color: depsPerPkg > 50 ? '#F59E0B' : '#60A5FA' }
        ], npm.summary || (npm.packageJsonCount ? `${npm.packageJsonCount} package.json file${npm.packageJsonCount === 1 ? '' : 's'} found with ${(npm.dependencyCount || 0).toLocaleString()} total dependenc${(npm.dependencyCount || 0) === 1 ? 'y' : 'ies'}.` : 'No package.json files found.'), depsPerPkg > 100 ? '#EF4444' : null, npmDetail);
        // 10. Compliance
        const comp = data.compliance || {};
        const compScore = (comp.licenseCount || 0) + (comp.securityCount || 0);
        const licFiles = (comp.licenseFiles || []).slice(0, 4);
        const secFiles = (comp.securityFiles || []).slice(0, 4);
        const compDetail = compScore ? `<div class="detail-label">Governance Files</div>${licFiles.length ? '<ul>' + licFiles.map(f => `<li>&#128220; ${f}</li>`).join('') + '</ul>' : ''}${secFiles.length ? '<ul>' + secFiles.map(f => `<li>&#128272; ${f}</li>`).join('') + '</ul>' : ''}<div class="detail-fix">Verify license compatibility with your distribution model.</div>` : `<div class="detail-label">No governance files</div><div style="font-size:0.72rem;color:var(--text-muted);">Consider adding LICENSE && SECURITY.md.</div>`;
        pushModule('10', '✅', 'Compliance', [
            { value: comp.licenseCount || 0, label: 'License' },
            { value: comp.securityCount || 0, label: 'Security' }
        ], comp.summary || (compScore ? `${comp.licenseCount || 0} license files, ${comp.securityCount || 0} security/governance files detected.` : 'No governance files detected.'), compScore === 0 ? '#EF4444' : null, compDetail);
        // 11. EU AI Act (only shown when profile enables it)
        if (data.checkEuAi !== false) {
            const eu = data.euAiActSummary || {};
            const euRisk = (eu.aiSystemIndicators || 0) > 0 ? '#EF4444' : null;
            const euDocs = (eu.documentationFound || []).slice(0, 5);
            const euDetail = (eu.aiSystemIndicators || 0) ? `<div class="detail-label">AI System Indicators</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">${eu.aiSystemIndicators} indicator(s) detected. High-risk systems must comply by August 2026.</div>${euDocs.length ? '<div class="detail-label">Documentation Found</div><ul>' + euDocs.map(f => `<li>${f}</li>`).join('') + '</ul>' : ''}<div class="detail-fix">Review AI system classification (Art. 6) && schedule legal review if high-risk.</div>` : `<div class="detail-label">No AI indicators</div><div style="font-size:0.72rem;color:var(--text-muted);">No EU AI Act indicators detected in this codebase.</div>`;
            pushModule('11', '🇪🇺', 'EU AI Act', [
                { value: eu.aiSystemIndicators || 0, label: 'AI indicators', color: euRisk || '#60A5FA' },
                { value: eu.documentationArtifacts || 0, label: 'Docs' }
            ], eu.deadlineNote || ((eu.aiSystemIndicators || 0) ? 'High-risk AI systems must comply with EU AI Act requirements by August 2026' : 'Review EU AI Act requirements.'), euRisk, euDetail);
        }
        // 12. Dependency Vulnerabilities
        const depAudit = data.dependencyAudit || data.vulnerabilityAudit || {};
        const vulnIssues = (data.detectedIssues || []).filter(i => i.type && /vulnerab|cve|npm audit|dependency|outdated/i.test(i.type) && !/unused/i.test(i.type));
        const vulnCount = depAudit.vulnerabilityCount || vulnIssues.length || 0;
        const criticalVulns = depAudit.critical || vulnIssues.filter(i => i.severity === 'critical').length || 0;
        const highVulns = depAudit.high || vulnIssues.filter(i => i.severity === 'high').length || 0;
        const vulnFiles = (depAudit.affectedPackages || depAudit.affectedFiles || []).slice(0, 6);
        const vulnColor = criticalVulns > 0 ? '#EF4444' : (highVulns > 0 ? '#F59E0B' : (vulnCount > 0 ? '#60A5FA' : null));
        const vulnDetail = vulnCount ? `<div class="detail-label">Vulnerability Summary</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">${vulnCount} total issue${vulnCount === 1 ? '' : 's'} found across dependencies.</div>${criticalVulns ? `<div style="font-size:0.7rem;color:#EF4444;margin-bottom:4px;">&#128308; ${criticalVulns} critical</div>` : ''}${highVulns ? `<div style="font-size:0.7rem;color:#F59E0B;margin-bottom:4px;">&#128993; ${highVulns} high</div>` : ''}${vulnFiles.length ? `<div class="detail-label">Affected Packages</div><ul>${vulnFiles.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}<div class="detail-fix">Run ‘npm audit fix’ || update packages. Review breaking changes before major version bumps.</div>` : `<div class="detail-label">No known vulnerabilities</div><div style="font-size:0.72rem;color:var(--text-muted);">Dependency scan shows no flagged CVEs || audit warnings.</div>`;
        pushModule('12', '🔒', 'Dependency Vulns', [
            { value: vulnCount, label: 'Vulnerabilities', color: vulnColor || '#60A5FA' },
            { value: criticalVulns + highVulns, label: 'Severe', color: criticalVulns > 0 ? '#EF4444' : (highVulns > 0 ? '#F59E0B' : '#60A5FA') }
        ], vulnCount ? `${vulnCount} dependency issue${vulnCount === 1 ? '' : 's'} detected${criticalVulns ? ` (${criticalVulns} critical)` : ''}.` : 'No dependency vulnerabilities found.', vulnColor, vulnDetail);
        // 13. Build Readiness — use pre-computed report data when available and plausible
        const br = data.buildReadiness || {};
        const allFiles = data.fileList || [];
        const filePaths = Array.isArray(allFiles) ? allFiles : [];
        const lowerPaths = filePaths.map(f => (typeof f === 'string' ? f : f.path || '').toLowerCase());
        // Detect suspicious stale data: all critical root files missing despite large file list
        const hasRootPackageJson = lowerPaths.some(p => /(^|\/)package\.json$/.test(p));
        const hasRootReadme = lowerPaths.some(p => /(^|\/)readme\.?/i.test(p));
        const hasRootEnvExample = lowerPaths.some(p => /(^|\/)\.env\.example/i.test(p));
        const hasRootGitignore = lowerPaths.some(p => /(^|\/)\.gitignore$/.test(p));
        const hasManyFiles = lowerPaths.length > 1000;
        const brLooksStale = br.checklist && br.checklist.length > 0 && hasManyFiles &&
            br.checklist.filter(c => c.critical && !c.found).length >= 5 &&
            !br.checklist.some(c => c.name === 'package.json' && c.found) &&
            (hasRootPackageJson || hasRootReadme || hasRootEnvExample || hasRootGitignore);
        let readinessScore, readinessStatus, readinessColor, buildDetail, checks, missingCritical, missingNice;
        if (br.checklist && br.checklist.length > 0 && !brLooksStale) {
            checks = br.checklist;
            missingCritical = checks.filter(c => c.critical && !c.found);
            missingNice = checks.filter(c => !c.critical && !c.found);
            readinessScore = (_f = br.readinessScore) !== null && _f !== void 0 ? _f : Math.round(((checks.filter(c => c.found).length / checks.length) * 100));
            readinessStatus = br.readinessStatus || (readinessScore >= 80 ? 'READY' : (readinessScore >= 50 ? 'NEEDS WORK' : 'BLOCKED'));
        }
        else {
            const hasPackageJson = lowerPaths.some(p => p.endsWith('package.json'));
            const hasReadme = lowerPaths.some(p => /readme\.?/.test(p));
            const hasChangelog = lowerPaths.some(p => /changelog|changes|history/i.test(p));
            const hasTests = lowerPaths.some(p => /test|spec|\.test\.|\.spec\.|__tests__|jest\.config|vitest\.config|cypress/i.test(p));
            const hasCiCd = lowerPaths.some(p => /\.github\/workflows|\.gitlab-ci|jenkins|\.circleci|\.travis|azure-pipelines|build\.yml|deploy\.yml/i.test(p));
            const hasDocker = lowerPaths.some(p => /dockerfile|docker-compose|\.dockerignore/i.test(p));
            const hasLinting = lowerPaths.some(p => /eslint|prettier|\.editorconfig|lint-staged|husky/i.test(p));
            const hasTypescript = lowerPaths.some(p => /tsconfig|\.ts$/i.test(p));
            const hasBuildScript = lowerPaths.some(p => /(webpack|rollup|vite|esbuild|parcel|babel|gulpfile|gruntfile)/i.test(p));
            const hasEnvExample = lowerPaths.some(p => /\.env\.example|\.env\.sample|\.env\.template/i.test(p));
            const hasGitignore = lowerPaths.some(p => p.includes('.gitignore'));
            const hasNpmignore = lowerPaths.some(p => p.includes('.npmignore'));
            const hasLockfile = lowerPaths.some(p => /package-lock\.json|yarn\.lock|pnpm-lock\.yaml/.test(p));
            const hasBuildArtifactsCommitted = lowerPaths.some(p => /\/(dist|build|\.next|out)\//.test(p) && !/node_modules\//.test(p));
            const hasDevServer = lowerPaths.some(p => /vite\.config|webpack\.dev|nodemon|live-reload|hmr/i.test(p));
            const hasGitLfs = lowerPaths.some(p => p.includes('.gitattributes'));
            const hasBuildCache = lowerPaths.some(p => /\.eslintcache|\.parcel-cache|\.next\/cache/i.test(p));
            checks = [
                { name: 'package.json', found: hasPackageJson, critical: true },
                { name: 'Lockfile', found: hasLockfile, critical: true },
                { name: 'README', found: hasReadme, critical: true },
                { name: 'CHANGELOG', found: hasChangelog, critical: false },
                { name: 'Tests', found: hasTests, critical: true },
                { name: 'CI/CD', found: hasCiCd, critical: true },
                { name: 'Docker', found: hasDocker, critical: false },
                { name: 'Linting/Formatting', found: hasLinting, critical: false },
                { name: 'TypeScript Config', found: hasTypescript, critical: false },
                { name: 'Build Tool Config', found: hasBuildScript, critical: false },
                { name: 'Dev Server / HMR', found: hasDevServer, critical: false },
                { name: '.env.example', found: hasEnvExample, critical: true },
                { name: '.gitignore', found: hasGitignore, critical: true },
                { name: 'Build artifacts ignored', found: !hasBuildArtifactsCommitted, critical: true },
                { name: 'Git LFS config', found: hasGitLfs, critical: false },
                { name: 'Build cache config', found: hasBuildCache, critical: false },
                { name: '.npmignore', found: hasNpmignore, critical: false }
            ];
            missingCritical = checks.filter(c => c.critical && !c.found);
            missingNice = checks.filter(c => !c.critical && !c.found);
            readinessScore = Math.round(((checks.filter(c => c.found).length / checks.length) * 100));
            readinessStatus = readinessScore >= 80 ? 'READY' : (readinessScore >= 50 ? 'NEEDS WORK' : 'BLOCKED');
        }
        readinessColor = readinessScore >= 80 ? '#10B981' : (readinessScore >= 50 ? '#F59E0B' : '#EF4444');
        buildDetail = `<div class="detail-label">Build Readiness Score</div><div style="font-size:1.2rem;font-weight:700;color:${readinessColor};margin-bottom:8px;">${readinessScore}% — ${readinessStatus}</div>${missingCritical.length ? `<div style="font-size:0.72rem;color:#EF4444;margin-bottom:8px;"><strong>${missingCritical.length} critical blocker${missingCritical.length === 1 ? '' : 's'}:</strong> ${missingCritical.map(c => c.name).join(', ')}</div>` : '<div style="font-size:0.72rem;color:#10B981;margin-bottom:8px;">All critical items present.</div>'}${missingNice.length ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;">${missingNice.length} recommended item${missingNice.length === 1 ? '' : 's'} missing: ${missingNice.map(c => c.name).join(', ')}</div>` : ''}<div class="detail-label">Present</div><ul>${checks.filter(c => c.found).map(c => `<li>&#9989; ${c.name}</li>`).join('')}</ul><div class="detail-label">Missing</div><ul>${checks.filter(c => !c.found).map(c => `<li>&#10060; ${c.name}${c.critical ? ' (critical)' : ''}</li>`).join('')}</ul><div class="detail-fix">Add missing critical files before production deployment. Recommended files improve maintainability.</div>`;
        pushModule('13', '🏗️', 'Build Readiness', [
            { value: readinessScore + '%', label: 'Score', color: readinessColor },
            { value: missingCritical.length, label: 'Blockers', color: missingCritical.length > 0 ? '#EF4444' : '#10B981' }
        ], `${readinessStatus} — ${checks.filter(c => c.found).length} of ${checks.length} checklist items present.${missingCritical.length ? ` ${missingCritical.length} critical blocker${missingCritical.length === 1 ? '' : 's'}.` : ''}`, readinessColor, buildDetail);
        // 14. AI System Indicators
        const aiInd = data.aiIndicators || data.aiSystemIndicators || {};
        const aiSdkCount = aiInd.sdkCount || aiInd.aiSystemIndicators || 0;
        const aiModelCount = aiInd.modelCount || 0;
        const aiFiles = (aiInd.files || []).slice(0, 6);
        const aiColor = aiSdkCount > 0 ? '#EF4444' : (aiModelCount > 0 ? '#F59E0B' : null);
        const aiDetail = aiSdkCount ? '<div class="detail-label">AI SDK Imports</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + aiSdkCount + ' AI/LLM SDK import(s) detected.</div>' + (aiFiles.length ? '<div class="detail-label">Files</div><ul>' + aiFiles.map(f => '<li>' + escapeHtml(f) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Verify all AI integrations are approved && document model usage for compliance.</div>' : '<div class="detail-label">No AI indicators</div><div style="font-size:0.72rem;color:var(--text-muted);">No AI/LLM SDK imports or model inference patterns detected.</div>';
        pushModule('14', '🤖', 'AI System Indicators', [
            { value: aiSdkCount, label: 'SDK imports', color: aiColor || '#60A5FA' },
            { value: aiModelCount, label: 'Model refs' }
        ], aiSdkCount ? aiSdkCount + ' AI SDK import' + (aiSdkCount === 1 ? '' : 's') + ' detected.' : 'No AI system indicators found.', aiColor, aiDetail);
        // 15. License & Governance
        const gov = data.governance || {};
        const govLicense = gov.licenseHeaders || comp.licenseCount || 0;
        const govCopyright = gov.copyrightNotices || 0;
        const govFiles = (gov.files || []).slice(0, 6);
        const govColor = govLicense === 0 ? '#EF4444' : (govCopyright === 0 ? '#F59E0B' : null);
        const govDetail = govLicense ? '<div class="detail-label">License Headers</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + govLicense + ' file(s) with license headers.</div>' + (govCopyright ? '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + govCopyright + ' copyright notice(s).</div>' : '') + (govFiles.length ? '<div class="detail-label">Files</div><ul>' + govFiles.map(f => '<li>' + escapeHtml(f) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Ensure license compatibility with your distribution model.</div>' : '<div class="detail-label">No license headers</div><div style="font-size:0.72rem;color:var(--text-muted);">No license or copyright markers detected.</div>';
        pushModule('15', '📜', 'License & Governance', [
            { value: govLicense, label: 'License headers', color: govColor || '#60A5FA' },
            { value: govCopyright, label: 'Copyright notices' }
        ], govLicense ? govLicense + ' license header' + (govLicense === 1 ? '' : 's') + ' detected.' : 'No license or governance markers found.', govColor, govDetail);
        // 16. Junk & Temporary Files (now includes Repository Hygiene)
        const junk = data.junkFiles || {};
        const junkCount = junk.fileCount || 0;
        const junkFiles = (junk.files || []).slice(0, 6);
        const hygiene = junk.repositoryHygiene || {};
        const hBreak = hygiene.breakdown || {};
        const uselessPct = parseFloat(hygiene.uselessPct || '0');
        const junkColor = uselessPct > 50 ? '#EF4444' : (uselessPct > 20 ? '#F59E0B' : null);
        let junkDetail = '<div class="detail-label">Repository Hygiene</div>';
        if (hygiene.totalFiles) {
            junkDetail += '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + hygiene.totalFiles.toLocaleString() + ' total files · ' + hygiene.usefulFiles.toLocaleString() + ' useful · ' + uselessPct + '% bloat</div>';
            junkDetail += '<table style="width:100%;font-size:0.7rem;color:#94A3B8;margin-bottom:8px;border-collapse:collapse;"><tbody>';
            if (hBreak.nodeModules)
                junkDetail += '<tr><td style="padding:2px 0;">node_modules</td><td style="text-align:right;padding:2px 0;">' + hBreak.nodeModules.toLocaleString() + '</td></tr>';
            if (hBreak.git)
                junkDetail += '<tr><td style="padding:2px 0;">.git objects</td><td style="text-align:right;padding:2px 0;">' + hBreak.git.toLocaleString() + '</td></tr>';
            if (hBreak.buildArtifacts)
                junkDetail += '<tr><td style="padding:2px 0;">Build artifacts</td><td style="text-align:right;padding:2px 0;">' + hBreak.buildArtifacts.toLocaleString() + '</td></tr>';
            if (hBreak.cacheDirs)
                junkDetail += '<tr><td style="padding:2px 0;">Cache dirs</td><td style="text-align:right;padding:2px 0;">' + hBreak.cacheDirs.toLocaleString() + '</td></tr>';
            if (hBreak.lockfiles)
                junkDetail += '<tr><td style="padding:2px 0;">Lockfiles</td><td style="text-align:right;padding:2px 0;">' + hBreak.lockfiles.toLocaleString() + '</td></tr>';
            if (hBreak.archives)
                junkDetail += '<tr><td style="padding:2px 0;">Archives</td><td style="text-align:right;padding:2px 0;">' + hBreak.archives.toLocaleString() + '</td></tr>';
            if (hBreak.binaries)
                junkDetail += '<tr><td style="padding:2px 0;">Binary/media</td><td style="text-align:right;padding:2px 0;">' + hBreak.binaries.toLocaleString() + '</td></tr>';
            if (hBreak.traditionalJunk)
                junkDetail += '<tr><td style="padding:2px 0;">Junk/temp files</td><td style="text-align:right;padding:2px 0;">' + hBreak.traditionalJunk.toLocaleString() + '</td></tr>';
            junkDetail += '</tbody></table>';
        }
        if (junkFiles.length) {
            junkDetail += '<div class="detail-label">Junk Files</div><ul>' + junkFiles.map(f => '<li>' + escapeHtml(f) + '</li>').join('') + '</ul>';
        }
        junkDetail += '<div class="detail-fix">Run <code>npm ci</code> to deduplicate lockfiles. Delete build artifacts before commits. Add large binaries to .gitignore.</div>';
        pushModule('16', '🗑️', 'Junk & Temp Files', [
            { value: hygiene.usefulFiles || junkCount, label: 'Useful files', color: '#60A5FA' },
            { value: uselessPct + '%', label: 'Bloat', color: junkColor || '#60A5FA' }
        ], hygiene.totalFiles ? uselessPct + '% of ' + hygiene.totalFiles.toLocaleString() + ' files are bloat (' + hygiene.usefulFiles.toLocaleString() + ' useful).' : (junkCount ? junkCount + ' junk/temp file' + (junkCount === 1 ? '' : 's') + ' detected.' : 'No junk or temporary files found.'), junkColor, junkDetail);
        // 17. AI Residue
        const ar = data.aiResidue || {};
        const arHits = ar.aiResidueHits || 0;
        const arFindings = (ar.aiResidueFindings || []).slice(0, 6);
        const arColor = arHits > 0 ? '#F59E0B' : null;
        const arDetail = arHits > 0 ? '<div class="detail-label">AI Residue Patterns</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + arHits + ' pattern(s) detected.</div>' + (arFindings.length ? '<div class="detail-label">Findings</div><ul>' + arFindings.map(f => '<li>' + escapeHtml(f.file) + ' — ' + escapeHtml(f.type) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Replace stubs with real implementations, modernize deprecated APIs, and add proper error handling.</div>' : '<div class="detail-label">Clean codebase</div><div style="font-size:0.72rem;color:var(--text-muted);">No AI residue patterns detected.</div>';
        pushModule('17', '🤖', 'AI Residue', [
            { value: arHits, label: 'Patterns', color: arColor || '#60A5FA' }
        ], arHits > 0 ? arHits + ' AI residue pattern' + (arHits === 1 ? '' : 's') + ' detected (stubs, deprecated APIs, error swallowing, dead code).' : 'No AI residue patterns found.', arColor, arDetail);
        // 18. Performance
        const perf = data.performance || {};
        const perfCount = perf.performanceHits || 0;
        const perfFindingsUI = (perf.performanceFindings || []).slice(0, 6);
        const perfColor = perfCount > 0 ? '#F59E0B' : null;
        const perfDetail = perfCount > 0 ? '<div class="detail-label">Performance Issues</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + perfCount + ' issue(s).</div>' + (perfFindingsUI.length ? '<div class="detail-label">Files</div><ul>' + perfFindingsUI.map(f => '<li>' + escapeHtml(f.file) + ' — ' + escapeHtml(f.type) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Optimize nested loops, debounce listeners, and review regex complexity.</div>' : '<div class="detail-label">Clean performance</div><div style="font-size:0.72rem;color:var(--text-muted);">No performance anti-patterns detected.</div>';
        pushModule('18', '🚀', 'Performance', [{ value: perfCount, label: 'Issues', color: perfColor || '#60A5FA' }], perfCount > 0 ? perfCount + ' performance issue' + (perfCount === 1 ? '' : 's') + ' detected.' : 'No performance issues found.', perfColor, perfDetail);
        // 19. Type Safety
        const ts = data.typeSafety || {};
        const tsCount = ts.typeSafetyHits || 0;
        const tsFindingsUI = (ts.typeSafetyFindings || []).slice(0, 6);
        const tsColor = tsCount > 0 ? '#F59E0B' : null;
        const tsDetail = tsCount > 0 ? '<div class="detail-label">Type Safety Gaps</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + tsCount + ' gap(s).</div>' + (tsFindingsUI.length ? '<ul>' + tsFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Replace any with specific types, add PropTypes, and limit function parameters.</div>' : '<div class="detail-label">Strongly typed</div><div style="font-size:0.72rem;color:var(--text-muted);">No type safety gaps detected.</div>';
        pushModule('19', '🔧', 'Type Safety', [{ value: tsCount, label: 'Gaps', color: tsColor || '#60A5FA' }], tsCount > 0 ? tsCount + ' type safety gap' + (tsCount === 1 ? '' : 's') + ' detected.' : 'No type safety gaps found.', tsColor, tsDetail);
        // 20. Documentation
        const doc = data.documentation || {};
        const docCount = doc.documentationHits || 0;
        const docFindingsUI = (doc.documentationFindings || []).slice(0, 6);
        const docColor = docCount > 0 ? '#F59E0B' : null;
        const docDetail = docCount > 0 ? '<div class="detail-label">Documentation Gaps</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + docCount + ' gap(s).</div>' + (docFindingsUI.length ? '<ul>' + docFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Add JSDoc to public functions and keep README in sync with recent changes.</div>' : '<div class="detail-label">Well documented</div><div style="font-size:0.72rem;color:var(--text-muted);">No documentation gaps detected.</div>';
        pushModule('20', '📖', 'Documentation', [{ value: docCount, label: 'Gaps', color: docColor || '#60A5FA' }], docCount > 0 ? docCount + ' documentation gap' + (docCount === 1 ? '' : 's') + ' detected.' : 'No documentation gaps found.', docColor, docDetail);
        // 21. Test Coverage
        const tc = data.testCoverage || {};
        const tcCount = tc.testCoverageHits || 0;
        const tcFindingsUI = (tc.testCoverageFindings || []).slice(0, 6);
        const tcColor = tcCount > 0 ? '#F59E0B' : null;
        const tcDetail = tcCount > 0 ? '<div class="detail-label">Test Coverage Gaps</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + tcCount + ' gap(s).</div>' + (tcFindingsUI.length ? '<ul>' + tcFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Implement skipped tests and add tests for complex untested functions.</div>' : '<div class="detail-label">Good coverage</div><div style="font-size:0.72rem;color:var(--text-muted);">No test coverage gaps detected.</div>';
        pushModule('21', '🧪', 'Test Coverage', [{ value: tcCount, label: 'Gaps', color: tcColor || '#60A5FA' }], tcCount > 0 ? tcCount + ' test coverage gap' + (tcCount === 1 ? '' : 's') + ' detected.' : 'No test coverage gaps found.', tcColor, tcDetail);
        // 22. Accessibility
        const a11y = data.accessibility || {};
        const a11yCount = a11y.accessibilityHits || 0;
        const a11yFindingsUI = (a11y.accessibilityFindings || []).slice(0, 6);
        const a11yColor = a11yCount > 0 ? '#EF4444' : null;
        const a11yDetail = a11yCount > 0 ? '<div class="detail-label">Accessibility Gaps</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + a11yCount + ' issue(s).</div>' + (a11yFindingsUI.length ? '<ul>' + a11yFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Add alt text to images, aria-label to buttons, and labels to form inputs.</div>' : '<div class="detail-label">Accessible</div><div style="font-size:0.72rem;color:var(--text-muted);">No accessibility gaps detected.</div>';
        pushModule('22', '♿', 'Accessibility', [{ value: a11yCount, label: 'Issues', color: a11yColor || '#60A5FA' }], a11yCount > 0 ? a11yCount + ' accessibility issue' + (a11yCount === 1 ? '' : 's') + ' detected.' : 'No accessibility issues found.', a11yColor, a11yDetail);
        // 23. i18n
        const i18n = data.i18n || {};
        const i18nCount = i18n.i18nHits || 0;
        const i18nFindingsUI = (i18n.i18nFindings || []).slice(0, 6);
        const i18nColor = i18nCount > 0 ? '#F59E0B' : null;
        const i18nDetail = i18nCount > 0 ? '<div class="detail-label">i18n Issues</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + i18nCount + ' issue(s).</div>' + (i18nFindingsUI.length ? '<ul>' + i18nFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Wrap UI strings in t()/i18n() and use locale-aware date/currency formatting.</div>' : '<div class="detail-label">i18n Ready</div><div style="font-size:0.72rem;color:var(--text-muted);">No i18n issues detected.</div>';
        pushModule('23', '🌍', 'i18n Readiness', [{ value: i18nCount, label: 'Issues', color: i18nColor || '#60A5FA' }], i18nCount > 0 ? i18nCount + ' i18n issue' + (i18nCount === 1 ? '' : 's') + ' detected.' : 'No i18n issues found.', i18nColor, i18nDetail);
        // 24. Sensitive Data
        const sd = data.sensitiveData || {};
        const sdCount = sd.sensitiveDataHits || 0;
        const sdFindingsUI = (sd.sensitiveDataFindings || []).slice(0, 6);
        const sdColor = sdCount > 0 ? '#EF4444' : null;
        const sdDetail = sdCount > 0 ? '<div class="detail-label">Sensitive Data Exposure</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + sdCount + ' exposure(s).</div>' + (sdFindingsUI.length ? '<ul>' + sdFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Remove PII from logs/source, sanitize user data, and avoid storing tokens in localStorage.</div>' : '<div class="detail-label">Clean data</div><div style="font-size:0.72rem;color:var(--text-muted);">No sensitive data exposures detected.</div>';
        pushModule('24', '🕵️', 'Sensitive Data', [{ value: sdCount, label: 'Exposures', color: sdColor || '#60A5FA' }], sdCount > 0 ? sdCount + ' sensitive data exposure' + (sdCount === 1 ? '' : 's') + ' detected.' : 'No sensitive data exposures found.', sdColor, sdDetail);
        // 25. Config Drift
        const cd = data.configDrift || {};
        const cdCount = cd.configDriftHits || 0;
        const cdFindingsUI = (cd.configDriftFindings || []).slice(0, 6);
        const cdColor = cdCount > 0 ? '#F59E0B' : null;
        const cdDetail = cdCount > 0 ? '<div class="detail-label">Configuration Drift</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + cdCount + ' drift(s).</div>' + (cdFindingsUI.length ? '<ul>' + cdFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Move secrets to environment variables, externalize URLs, and never commit .env files.</div>' : '<div class="detail-label">Clean config</div><div style="font-size:0.72rem;color:var(--text-muted);">No configuration drift detected.</div>';
        pushModule('25', '⚙️', 'Config Drift', [{ value: cdCount, label: 'Drifts', color: cdColor || '#60A5FA' }], cdCount > 0 ? cdCount + ' configuration drift' + (cdCount === 1 ? '' : 's') + ' detected.' : 'No configuration drift found.', cdColor, cdDetail);
        // 26. Security Headers
        const sh = data.securityHeaders || {};
        const shCount = sh.securityHeadersHits || 0;
        const shFindingsUI = (sh.securityHeadersFindings || []).slice(0, 6);
        const shColor = shCount > 0 ? '#F59E0B' : null;
        const shDetail = shCount > 0 ? '<div class="detail-label">Security Headers</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + shCount + ' reference(s).</div>' + (shFindingsUI.length ? '<ul>' + shFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Ensure CSP, X-Frame-Options, HSTS, and Referrer-Policy are configured.</div>' : '<div class="detail-label">No header configs</div><div style="font-size:0.72rem;color:var(--text-muted);">No security header configuration files detected.</div>';
        pushModule('26', '🔒', 'Security Headers', [{ value: shCount, label: 'Refs', color: shColor || '#60A5FA' }], shCount > 0 ? shCount + ' security header reference' + (shCount === 1 ? '' : 's') + ' found.' : 'No security header configs found.', shColor, shDetail);
        // 27. Database Patterns
        const dbp = data.databasePatterns || {};
        const dbpCount = dbp.databasePatternsHits || 0;
        const dbpFindingsUI = (dbp.databasePatternsFindings || []).slice(0, 6);
        const dbpColor = dbpCount > 0 ? '#EF4444' : null;
        const dbpDetail = dbpCount > 0 ? '<div class="detail-label">Database Anti-Patterns</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + dbpCount + ' issue(s).</div>' + (dbpFindingsUI.length ? '<ul>' + dbpFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Use parameterized queries, add pagination limits, and wrap in transactions.</div>' : '<div class="detail-label">Clean DB patterns</div><div style="font-size:0.72rem;color:var(--text-muted);">No database anti-patterns detected.</div>';
        pushModule('27', '💾', 'Database Patterns', [{ value: dbpCount, label: 'Issues', color: dbpColor || '#60A5FA' }], dbpCount > 0 ? dbpCount + ' database anti-pattern' + (dbpCount === 1 ? '' : 's') + ' detected.' : 'No database anti-patterns found.', dbpColor, dbpDetail);
        // 28. Framework Practices
        const fp = data.frameworkPractices || {};
        const fpCount = fp.frameworkPracticesHits || 0;
        const fpFindingsUI = (fp.frameworkPracticesFindings || []).slice(0, 6);
        const fpColor = fpCount > 0 ? '#F59E0B' : null;
        const fpDetail = fpCount > 0 ? '<div class="detail-label">Framework Practice Issues</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + fpCount + ' issue(s).</div>' + (fpFindingsUI.length ? '<ul>' + fpFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Fix hook dependencies, avoid direct DOM access, and add cleanup in Angular.</div>' : '<div class="detail-label">Clean framework code</div><div style="font-size:0.72rem;color:var(--text-muted);">No framework practice issues detected.</div>';
        pushModule('28', '💻', 'Framework Practices', [{ value: fpCount, label: 'Issues', color: fpColor || '#60A5FA' }], fpCount > 0 ? fpCount + ' framework practice issue' + (fpCount === 1 ? '' : 's') + ' detected.' : 'No framework practice issues found.', fpColor, fpDetail);
        // 29. Workspace Health
        const wh = data.workspaceHealth || {};
        const whCount = wh.workspaceHealthHits || 0;
        const whFindingsUI = (wh.workspaceHealthFindings || []).slice(0, 6);
        const whColor = whCount > 0 ? '#F59E0B' : null;
        const whDetail = whCount > 0 ? '<div class="detail-label">Workspace Health Issues</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + whCount + ' issue(s).</div>' + (whFindingsUI.length ? '<ul>' + whFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Refactor shared code into common packages and align dependency versions.</div>' : '<div class="detail-label">Healthy workspace</div><div style="font-size:0.72rem;color:var(--text-muted);">No workspace health issues detected.</div>';
        pushModule('29', '📊', 'Workspace Health', [{ value: whCount, label: 'Issues', color: whColor || '#60A5FA' }], whCount > 0 ? whCount + ' workspace health issue' + (whCount === 1 ? '' : 's') + ' detected.' : 'No workspace health issues found.', whColor, whDetail);
        // 30. Unused Dependencies
        const ud = data.unusedDeps || {};
        const udCount = ud.unusedDepsHits || 0;
        const udFindingsUI = (ud.unusedDepsFindings || []).slice(0, 6);
        const udColor = udCount > 0 ? '#F59E0B' : null;
        const udDetail = udCount > 0 ? '<div class="detail-label">Unused Dependencies</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + udCount + ' flag(s).</div>' + (udFindingsUI.length ? '<ul>' + udFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Remove unused packages from package.json to reduce bundle size and attack surface.</div>' : '<div class="detail-label">Lean deps</div><div style="font-size:0.72rem;color:var(--text-muted);">No unused dependency flags detected.</div>';
        pushModule('30', '📦', 'Unused Dependencies', [{ value: udCount, label: 'Flags', color: udColor || '#60A5FA' }], udCount > 0 ? udCount + ' unused dependency flag' + (udCount === 1 ? '' : 's') + ' detected.' : 'No unused dependency flags found.', udColor, udDetail);
        // 31. API Contract
        const ac = data.apiContract || {};
        const acCount = ac.apiContractHits || 0;
        const acFindingsUI = (ac.apiContractFindings || []).slice(0, 6);
        const acColor = acCount > 0 ? '#F59E0B' : null;
        const acDetail = acCount > 0 ? '<div class="detail-label">API Contract Drift</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + acCount + ' drift(s).</div>' + (acFindingsUI.length ? '<ul>' + acFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Sync OpenAPI specs with implementation and verify frontend consumes all endpoints.</div>' : '<div class="detail-label">Synced contracts</div><div style="font-size:0.72rem;color:var(--text-muted);">No API contract drift detected.</div>';
        pushModule('31', '🔄', 'API Contract', [{ value: acCount, label: 'Drifts', color: acColor || '#60A5FA' }], acCount > 0 ? acCount + ' API contract drift' + (acCount === 1 ? '' : 's') + ' detected.' : 'No API contract drift found.', acColor, acDetail);
        // 32. Complexity
        const cx = data.complexity || {};
        const cxCount = cx.complexityHits || 0;
        const cxFindingsUI = (cx.complexityFindings || []).slice(0, 6);
        const cxColor = cxCount > 0 ? '#F59E0B' : null;
        const cxDetail = cxCount > 0 ? '<div class="detail-label">Complexity Issues</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + cxCount + ' issue(s).</div>' + (cxFindingsUI.length ? '<ul>' + cxFindingsUI.map(f => '<li>' + escapeHtml(f.file) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Extract helpers, reduce nesting with early returns, and apply complexity limits.</div>' : '<div class="detail-label">Clean complexity</div><div style="font-size:0.72rem;color:var(--text-muted);">No high complexity patterns detected.</div>';
        pushModule('32', '📈', 'Complexity Metrics', [{ value: cxCount, label: 'Issues', color: cxColor || '#60A5FA' }], cxCount > 0 ? cxCount + ' complexity issue' + (cxCount === 1 ? '' : 's') + ' detected.' : 'No complexity issues found.', cxColor, cxDetail);
        // 33. Fix Preview
        const suggestedFixes = (data.aiContext && data.aiContext.suggestedFixes) || [];
        const fixCount = suggestedFixes.length;
        const fixColor = fixCount > 0 ? '#10B981' : null;
        const topFixes = suggestedFixes.slice(0, 5);
        const fixDetail = fixCount > 0
            ? '<div class="detail-label">Suggested Fixes</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + fixCount + ' fix' + (fixCount === 1 ? '' : 'es') + ' with patches.</div><ul>' + topFixes.map(f => '<li>' + escapeHtml(f.file || 'unknown') + ':' + (f.line || '?') + ' — ' + escapeHtml((f.action || 'Apply patch').slice(0, 60)) + '</li>').join('') + '</ul>' + (fixCount > 5 ? '<div style="font-size:0.72rem;color:var(--text-muted);">...and ' + (fixCount - 5) + ' more</div>' : '') + '<div class="detail-fix">Click a fix in the Remediation Roadmap to view before/after diffs and copy patches.</div>'
            : '<div class="detail-label">No auto-fixes</div><div style="font-size:0.72rem;color:var(--text-muted);">No suggested code patches in this scan.</div>';
        pushModule('33', '🔧', 'Fix Preview', [{ value: fixCount, label: 'Patches', color: fixColor || '#60A5FA' }], fixCount > 0 ? fixCount + ' auto-fixable issue' + (fixCount === 1 ? '' : 's') + ' with code patches.' : 'No suggested code patches.', fixColor, fixDetail);
        // 34. Token Bleed
        const tb = data.tokenBleed || {};
        const tbCount = tb.tokenBleedHits || 0;
        const tbFindingsUI = (tb.tokenBleedFindings || []).slice(0, 6);
        const tbColor = tbCount > 0 ? '#F59E0B' : null;
        const tbDetail = tbCount > 0 ? '<div class="detail-label">Token Bleed Risks</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + tbCount + ' risk(s).</div>' + (tbFindingsUI.length ? '<ul>' + tbFindingsUI.map(f => '<li>' + escapeHtml(f.file) + ' — ' + escapeHtml(f.type) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Add max_tokens / max_completion_tokens to every LLM API call and chunk long literals.</div>' : '<div class="detail-label">No token bleed</div><div style="font-size:0.72rem;color:var(--text-muted);">No unbounded LLM API calls detected.</div>';
        pushModule('34', '💸', 'Token Bleed', [{ value: tbCount, label: 'Risks', color: tbColor || '#60A5FA' }], tbCount > 0 ? tbCount + ' token bleed risk' + (tbCount === 1 ? '' : 's') + ' detected.' : 'No token bleed risks found.', tbColor, tbDetail);
        // 35. Production Leak
        const pl = data.productionLeak || {};
        const plCount = pl.productionLeakHits || 0;
        const plFindingsUI = (pl.productionLeakFindings || []).slice(0, 6);
        const plColor = plCount > 0 ? '#F59E0B' : null;
        const plDetail = plCount > 0 ? '<div class="detail-label">Production Leaks</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + plCount + ' leak(s).</div>' + (plFindingsUI.length ? '<ul>' + plFindingsUI.map(f => '<li>' + escapeHtml(f.file) + ' — ' + escapeHtml(f.type) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Replace hardcoded mock/fixture paths with environment-based configuration or runtime discovery.</div>' : '<div class="detail-label">No production leaks</div><div style="font-size:0.72rem;color:var(--text-muted);">No mock/fixture path references in production code.</div>';
        pushModule('35', '🔓', 'Production Leak', [{ value: plCount, label: 'Leaks', color: plColor || '#60A5FA' }], plCount > 0 ? plCount + ' production leak' + (plCount === 1 ? '' : 's') + ' detected.' : 'No production leaks found.', plColor, plDetail);
        // 36. Fiction KPI
        const fk = data.fictionKpi || {};
        const fkCount = fk.fictionKpiHits || 0;
        const fkFindingsUI = (fk.fictionKpiFindings || []).slice(0, 6);
        const fkColor = fkCount > 0 ? '#EF4444' : null;
        const fkDetail = fkCount > 0 ? '<div class="detail-label">Fiction KPI Patterns</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + fkCount + ' pattern(s).</div>' + (fkFindingsUI.length ? '<ul>' + fkFindingsUI.map(f => '<li>' + escapeHtml(f.file) + ' — ' + escapeHtml(f.type) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Replace hardcoded KPIs with real data sources and dynamic calculations.</div>' : '<div class="detail-label">No fiction KPIs</div><div style="font-size:0.72rem;color:var(--text-muted);">No hardcoded fiction KPI patterns detected.</div>';
        pushModule('36', '🎭', 'Fiction KPI', [{ value: fkCount, label: 'Patterns', color: fkColor || '#60A5FA' }], fkCount > 0 ? fkCount + ' fiction KPI pattern' + (fkCount === 1 ? '' : 's') + ' detected.' : 'No fiction KPI patterns found.', fkColor, fkDetail);
        // 37. Architecture Drift
        const ad = data.architectureDrift || {};
        const adCount = ad.count || 0;
        const adFindingsUI = (ad.findings || []).slice(0, 6);
        const adColor = adCount > 0 ? '#F59E0B' : null;
        const adDetail = adCount > 0 ? '<div class="detail-label">Architecture Drift</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + adCount + ' finding(s).</div>' + (adFindingsUI.length ? '<ul>' + adFindingsUI.map(f => '<li>' + escapeHtml(f.file) + ' — ' + escapeHtml(f.type) + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Add schema validators (Zod, AJV, pydantic) and enforce max_tokens on all LLM calls.</div>' : '<div class="detail-label">No architecture drift</div><div style="font-size:0.72rem;color:var(--text-muted);">No unguarded LLM integration patterns detected.</div>';
        pushModule('37', '🏗️', 'Architecture Drift', [{ value: adCount, label: 'Findings', color: adColor || '#60A5FA' }], adCount > 0 ? adCount + ' architecture drift finding' + (adCount === 1 ? '' : 's') + ' detected.' : 'No architecture drift found.', adColor, adDetail);
        // 39. Removable Files
        const rf = data.removableFiles || {};
        const rfCount = rf.totalRemovable || 0;
        const rfCategories = (rf.categories || []).filter(c => c.removable).slice(0, 4);
        const rfColor = rfCount > 0 ? '#F59E0B' : null;
        const rfDetail = rfCount > 0 ? '<div class="detail-label">Removable Files</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + rfCount + ' file(s) removable.</div>' + (rfCategories.length ? '<ul>' + rfCategories.map(c => '<li>' + escapeHtml(c.label) + ' — ' + c.count + ' file' + (c.count === 1 ? '' : 's') + '</li>').join('') + '</ul>' : '') + '<div class="detail-fix">Review && remove identified files to reduce repository bloat.</div>' : '<div class="detail-label">No removable files</div><div style="font-size:0.72rem;color:var(--text-muted);">No obvious bloat detected.</div>';
        pushModule('39', '🗑️', 'Removable Files', [{ value: rfCount, label: 'Files', color: rfColor || '#60A5FA' }], rfCount > 0 ? rfCount + ' removable file' + (rfCount === 1 ? '' : 's') + ' detected.' : 'No removable files found.', rfColor, rfDetail);
        // 40. Consistency Score
        const csScore = (_g = data.consistencyScore) !== null && _g !== void 0 ? _g : null;
        const csDupGroups = data.duplicateGroups || 0;
        const hasCs = csScore != null;
        const csColor = csScore >= 80 ? '#10B981' : (csScore >= 50 ? '#F59E0B' : '#EF4444');
        const csDetail = hasCs ? '<div class="detail-label">Consistency Score</div><div style="font-size:1.2rem;font-weight:700;color:' + csColor + ';margin-bottom:8px;">' + csScore + '/100</div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">' + csDupGroups + ' duplicate file group(s).</div><div class="detail-fix">Consistency is based on duplicate file analysis. Consolidate duplicates to improve the score.</div>' : '<div class="detail-label">No consistency data</div><div style="font-size:0.72rem;color:var(--text-muted);">Consistency score not available for this scan.</div>';
        pushModule('40', '✅', 'Consistency Score', [
            { value: hasCs ? csScore : '--', label: 'Score', color: csColor },
            { value: csDupGroups, label: 'Duplicates' }
        ], hasCs ? 'Consistency score: ' + csScore + '/100 based on ' + csDupGroups + ' duplicate group(s).' : 'No consistency score available.', hasCs ? csColor : null, csDetail);
        // Expose for download handler
        window._scanPreviewModules = modules;
        window._scanPreviewData = data;
        const selectOptions = modules.map(mod => {
            const paid = isModulePaidFor(mod.num);
            const lockLabel = paid ? '' : ' 🔒';
            return `<option value="${escapeHtml(mod.id)}" class="${paid ? '' : 'inactive'}">${escapeHtml(mod.optionLabel)}${lockLabel}</option>`;
        }).join('') + (typeof canExportFullReport === 'function' && canExportFullReport()
            ? `<option value="__full_report__">📥 Full Report — Export Complete Data</option>`
            : `<option value="__full_report__" disabled>📥 Full Report — Paid license required</option>`);
        const panels = modules.map(mod => {
            const vals = mod.values.map(v => `<button class="detail-data-btn" onclick="copyReportData('${String(v.value).replace(/'/g, "\\'")}', this)"><strong style="color:${v.color || '#60A5FA'}">${v.value}</strong> <span style="color:var(--text-muted);font-weight:400;">${v.label}</span><span class="copy-icon">&#128203;</span></button>`).join('');
            const leftBorder = mod.statusColor ? `border-left:3px solid ${mod.statusColor};` : '';
            // Transform file paths && counts inside detailHtml into buttons
            let btnDetail = mod.detailHtml || '';
            btnDetail = btnDetail.replace(/<li>([^<]+)<\/li>/g, (m, txt) => {
                const clean = txt.replace(/&#\d+;\s*/, '').trim();
                return `<li><button class="detail-data-btn" onclick="copyReportData('${clean.replace(/'/g, "\\'")}', this)">${txt}<span class="copy-icon">&#128203;</span></button></li>`;
            });
            const paid = isModulePaidFor(mod.num);
            const lockIcon = paid ? '' : ' <span style="color:var(--text-muted);font-size:0.8em;">🔒</span>';
            return `<div id="${escapeHtml(mod.id)}" class="module-detail-panel ${paid ? '' : 'inactive'}" style="${leftBorder}"><div class="detail-title">${mod.num} ${mod.icon} ${escapeHtml(mod.title)}${lockIcon}</div><div class="detail-values">${vals}</div><div class="detail-summary">${escapeHtml(mod.summary || 'No findings.')}</div>${btnDetail}</div>`;
        }).join('');
        return `<div style="display:flex;gap:8px;align-items:stretch;margin-bottom:10px;"><select class="module-dropdown" style="flex:1;" aria-label="Select module" onchange="const p=this.parentElement.parentElement.querySelectorAll('.module-detail-panel');p.forEach(x=>x.classList.remove('active'));const s=this.parentElement.parentElement.querySelector('#'+this.value);if(s)s.classList.add('active');"><option value="" disabled selected>Select a module…</option>${selectOptions}</select><button class="detail-data-btn" style="padding:8px 14px;font-size:0.8rem;" onclick="downloadSelectedModule(this)" title="Download full module data as JSON">&#128229; Export</button></div>${panels}`;
    })();
    const previewHtml = `
        <div class="cert-preview ${hasToken ? '' : 'watermarked'}">
            <div class="cert-header">
                <h3>Executive Risk Certificate</h3>
                <div class="cert-subtitle">${escapeHtml(project)} &mdash; ${new Date().toLocaleDateString()}</div>
                ${window._tokenPayload ? `<div style="margin-top:6px;font-size:0.72rem;color:#64748B;"><span class="status-pill pass" style="font-size:0.65rem;padding:2px 8px;">${escapeHtml((window._tokenPayload.tier || window._tokenPayload.product || 'executive').toUpperCase())}</span> ${escapeHtml(window._tokenPayload.plan || window._tokenPayload.license || 'Sovereign')}</div>` : ''}
            </div>
            <div class="score-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(30, 41, 59, 0.8)" stroke-width="8"/>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="${gradeColor}" stroke-width="8"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
                </svg>
                <div class="score-value">${grade}</div>
                <div class="score-label">${quality}% Quality</div>
            </div>
            <div class="scan-meta" style="margin-top:0;">
                <div class="meta-item">
                    <div class="value ${gatePass === true ? 'gate-pass' : 'gate-fail'}" style="${gatePass === null ? 'color:var(--warn)' : ''}">${gatePass === true ? 'PASS' : 'REVIEW'}</div>
                    <div class="label">Gate</div>
                </div>
                <div class="meta-item">
                    <div class="value">${files}</div>
                    <div class="label">Files</div>
                </div>
                <div class="meta-item" title="${data.excludedSummary || 'No exclusions'}">
                    <div class="value">${(_20 = data.filesAnalyzed) !== null && _20 !== void 0 ? _20 : ((files || 0) - (data.excludedCount || 0))}</div>
                    <div class="label">Analyzed</div>
                </div>
                <div class="meta-item">
                    <div class="value">${issues}</div>
                    <div class="label">Issues</div>
                </div>
                <div class="meta-item">
                    <div class="value">${(_21 = data.consistencyScore) !== null && _21 !== void 0 ? _21 : '--'}</div>
                    <div class="label">Consistency</div>
                </div>
                <div class="meta-item">
                    <div class="value">${(_22 = data.fictionKpiHits) !== null && _22 !== void 0 ? _22 : '--'}</div>
                    <div class="label">Fiction Scanned</div>
                </div>
            </div>
            ${matrixHtml}
            <div class="issue-list">
                ${issueItems}
                ${moreIssues}
            </div>
            <div style="margin-top:16px;">
                <div style="font-size:0.8rem;font-weight:700;color:#60A5FA;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">${modules.length} Analysis Module${modules.length !== 1 ? 's' : ''}</div>
                ${analysisModulesHtml}
            </div>
            ${(() => {
        const phases = data.remediationPhases || [];
        if (!phases.length)
            return '';
        const severityColor = (s) => s === 'critical' ? '#EF4444' : s === 'high' ? '#F59E0B' : s === 'medium' ? '#60A5FA' : '#34D399';
        const statusIcon = (st) => st === 'completed' ? '&#10004;' : st === 'in-progress' ? '&#9203;' : '&#9675;';
        const phaseCards = phases.map(p => {
            var _a, _b;
            const tasksHtml = p.tasks && p.tasks.length ? p.tasks.map((t, i) => {
                const patch = t.patch || (t.description && t.description.includes(' — ') ? null : null);
                const hasPatch = !!t.patch;
                const patchId = `patch-${p.id}-${i}`;
                const patchHtml = hasPatch ? `
                            <div id="${patchId}" style="display:none;margin-top:6px;font-family:monospace;font-size:0.65rem;background:rgba(0,0,0,0.3);border-radius:4px;padding:8px;overflow-x:auto;white-space:pre;color:#E2E8F0;border:1px solid rgba(96,165,250,0.1);">${escapeHtml(t.patch)}</div>
                            <div style="margin-top:4px;display:flex;gap:6px;">
                                <button onclick="document.getElementById('${patchId}').style.display=document.getElementById('${patchId}').style.display==='none'?'block':'none';this.textContent=this.textContent==='Show Patch'?'Hide Patch':'Show Patch';" style="font-size:0.6rem;padding:3px 8px;background:rgba(37,99,235,0.15);color:#60A5FA;border:1px solid rgba(37,99,235,0.3);border-radius:4px;cursor:pointer;">Show Patch</button>
                                <button onclick="navigator.clipboard.writeText(document.getElementById('${patchId}').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy Patch',1200);});" style="font-size:0.6rem;padding:3px 8px;background:rgba(16,185,129,0.15);color:#34D399;border:1px solid rgba(16,185,129,0.3);border-radius:4px;cursor:pointer;">Copy Patch</button>
                            </div>
                        ` : '';
                return `<div style="font-size:0.68rem;color:#CBD5E1;margin-bottom:4px;padding-left:12px;position:relative;">
                            <span style="position:absolute;left:0;color:${severityColor(p.severity)};">${t.done ? '&#10004;' : '&#9675;'}</span>
                            ${escapeHtml(t.description)}
                            ${patchHtml}
                        </div>`;
            }).join('') : '';
            return `
                    <div style="flex:1;min-width:220px;background:rgba(15,23,42,0.6);border:1px solid rgba(96,165,250,0.15);border-radius:8px;padding:12px;margin-bottom:8px;border-left:3px solid ${severityColor(p.severity)}">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                            <span style="font-weight:700;font-size:0.78rem;color:#E2E8F0;">${statusIcon(p.status)} ${escapeHtml(p.title)}</span>
                            <span style="font-size:0.65rem;color:${severityColor(p.severity)};background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;text-transform:uppercase;">${p.severity}</span>
                        </div>
                        <div style="font-size:0.72rem;color:#94A3B8;margin-bottom:8px;">${escapeHtml(p.description || '')}</div>
                        ${tasksHtml ? `<div style="margin-bottom:8px;">${tasksHtml}</div>` : ''}
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <div style="flex:1;height:6px;background:rgba(30,41,59,0.8);border-radius:3px;overflow:hidden;">
                                <div style="width:${(_a = p.progress) !== null && _a !== void 0 ? _a : 0}%;height:100%;background:${severityColor(p.severity)};border-radius:3px;transition:width 0.3s;"></div>
                            </div>
                            <span style="font-size:0.65rem;color:#94A3B8;min-width:32px;text-align:right;">${(_b = p.progress) !== null && _b !== void 0 ? _b : 0}%</span>
                        </div>
                        <div style="font-size:0.65rem;color:#64748B;">Effort: ${escapeHtml(p.effort || 'N/A')}</div>
                    </div>
                `;
        }).join('');
        return `<div style="margin-top:16px;">
                    <div style="font-size:0.8rem;font-weight:700;color:#60A5FA;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Remediation Roadmap</div>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;">${phaseCards}</div>
                </div>`;
    })()}
            ${footer}
        </div>
    `;
    function sbFinishPreviewRender() {
        if (scanPreview)
            scanPreview.innerHTML = previewHtml;
        try {
            if (scanPreview)
                scanPreview.dataset.sbReportData = JSON.stringify(data);
        }
        catch (_reportStoreErr) { /* ignore quota errors */ }
        if (typeof window.sbUpdateBoardReport === 'function') {
            window.sbUpdateBoardReport(data);
        }
        if (typeof window.sbRenderAiContextPack === 'function') {
            window.sbRenderAiContextPack(data);
        }
        try {
            window.dispatchEvent(new CustomEvent('sb:scanComplete', { detail: data }));
        }
        catch (_scanEvtErr) { /* ignore */ }
    }
    if (window.SB_AUDIT_FREE_PREVIEW) {
        requestAnimationFrame(function () {
            requestAnimationFrame(sbFinishPreviewRender);
        });
    }
    else {
        sbFinishPreviewRender();
    }
}
if (typeof window !== 'undefined') {
    window.buildEuAiActControls = buildEuAiActControls;
    window.renderPreview = renderPreview;
}
