import { authService } from './authService.js?v=20260725apifix1';
import { apiBaseUrl } from '../utils-lib/url.js';

function apiPrefix() {
    const base = apiBaseUrl();
    // apiBaseUrl returns '/' for relative root when running locally
    return (base && base !== '/') ? base : '';
}

let _cliApiKeyPromise = null;
export async function fetchCliApiKey(options = {}) {
    if (!options.refresh && _cliApiKeyPromise) {
        return _cliApiKeyPromise;
    }
    _cliApiKeyPromise = fetch(`${apiPrefix()}/api/user/api-key`, {
        headers: authService.getAuthHeaders()
    })
        .then(async (res) => {
        if (!res.ok)
            throw new Error('Could not retrieve CLI token');
        const data = await res.json();
        if (!data.success)
            throw new Error(data.error || 'Token unavailable');
        return data.apiKey;
    })
        .catch((err) => {
        _cliApiKeyPromise = null;
        throw err;
    });
    return _cliApiKeyPromise;
}

export async function fetchCliHistory(apiKey) {
    const res = await fetch(`${apiPrefix()}/api/simplebeacon/history`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) throw new Error('Could not fetch CLI history');
    const data = await res.json();
    return data.history || [];
}

export async function fetchCliReport(reportId, apiKey) {
    const res = await fetch(`${apiPrefix()}/api/simplebeacon/report/${reportId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) throw new Error('Could not fetch report');
    const data = await res.json();
    return data.report || null;
}

export function buildCliCommand(path, apiKey) {
    return `npx simplebeacon-cli upload --path "${path || 'C:\\\\Projects'}" --api-token "${apiKey || ''}"`;
}

function setText(el, text) {
    el.textContent = text;
}

export function renderCliUploadCard(container, apiKey) {
    if (!container) return;
    container.replaceChildren();
    const card = document.createElement('div');
    card.className = 'cli-integration-card';
    card.style.cssText = 'background:var(--surface); color:var(--text-primary); padding:16px; border-radius:var(--radius-lg); border:1px solid var(--border); margin-bottom:20px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';
    const title = document.createElement('h4');
    setText(title, '💻 Analyze via SimpleBeacon CLI');
    title.style.cssText = 'margin:0; color:var(--primary);';
    const badge = document.createElement('span');
    setText(badge, 'BEST FOR MONOREPOS');
    badge.style.cssText = 'background:var(--success); font-size:11px; padding:2px 6px; border-radius:4px; font-weight:bold; color:var(--text-inverse);';
    header.appendChild(title);
    header.appendChild(badge);

    const desc = document.createElement('p');
    setText(desc, 'Bypass browser sandboxes. Scan large codebases, external drives, or any folder directly from your terminal.');
    desc.style.cssText = 'font-size:13px; color:var(--text-secondary); margin:10px 0;';

    const codeBox = document.createElement('div');
    codeBox.style.cssText = 'background:var(--background); padding:12px 70px 12px 12px; border-radius:var(--radius-md); font-family:monospace; font-size:12px; border:1px solid var(--border); position:relative; overflow-x:auto;';
    const code = document.createElement('code');
    code.id = 'cli-command-string';
    setText(code, buildCliCommand('C:\\\\Projects', apiKey));
    code.style.cssText = 'color:var(--text-primary);';
    const copyBtn = document.createElement('button');
    copyBtn.id = 'cli-copy-btn';
    setText(copyBtn, 'Copy');
    copyBtn.style.cssText = 'position:absolute; right:10px; top:8px; background:var(--surface); border:1px solid var(--border); color:var(--text-secondary); font-size:11px; padding:3px 8px; border-radius:var(--radius-md); cursor:pointer;';
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(code.textContent);
        setText(copyBtn, 'Copied!');
        setTimeout(() => setText(copyBtn, 'Copy'), 1500);
    });
    codeBox.appendChild(code);
    codeBox.appendChild(copyBtn);

    const slot = document.createElement('div');
    slot.id = 'cli-report-slot';
    slot.style.marginTop = '12px';

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(codeBox);
    card.appendChild(slot);
    container.appendChild(card);
}

export function renderCliReport(report, container) {
    if (!container || !report) return;
    container.replaceChildren();
    const summary = report.summary || {};
    const score = summary.qualityScore ?? report.qualityScore ?? 0;
    const high = summary.highIssues ?? report.highSeverityCount ?? 0;
    const medium = summary.mediumIssues ?? report.mediumSeverityCount ?? 0;
    const low = summary.lowIssues ?? report.lowSeverityCount ?? 0;
    const total = summary.totalFiles ?? report.totalFiles ?? 0;
    const scannedPath = report.projectPath || report.projectRoot || report.scannedPath || 'unknown';
    let grade = 'A';
    if (score < 60) grade = 'F';
    else if (score < 70) grade = 'D';
    else if (score < 80) grade = 'C';
    else if (score < 90) grade = 'B';
    const badgeColor = score >= 90 ? '#28a745' : score >= 70 ? '#ffc107' : '#dc3545';

    const card = document.createElement('div');
    card.style.cssText = `border:2px solid ${badgeColor}; padding:12px; border-radius:6px; background:var(--card-bg,#1e1e1e); color:var(--text-color,#e0e0e0); margin-bottom:12px;`;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom:1px solid #444; padding-bottom:8px; margin-bottom:8px;';
    const titleBlock = document.createElement('div');
    const h3 = document.createElement('h3');
    setText(h3, '🛡️ LIVE CLI REPORT SYNCED');
    h3.style.cssText = 'margin:0 0 4px 0; font-size:1.1rem;';
    const status = document.createElement('span');
    setText(status, `Grade ${grade}`);
    status.style.cssText = `font-weight:600; color:${badgeColor};`;
    titleBlock.appendChild(h3);
    titleBlock.appendChild(status);
    const gradeBadge = document.createElement('div');
    setText(gradeBadge, grade);
    gradeBadge.style.cssText = `background:${badgeColor}; color:#fff; width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:bold;`;
    header.appendChild(titleBlock);
    header.appendChild(gradeBadge);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px; font-size:13px;';
    const left = document.createElement('div');
    const p1 = document.createElement('p');
    p1.style.margin = '0 0 4px 0';
    const b1 = document.createElement('b');
    setText(b1, 'Scanned Path: ');
    const v1 = document.createElement('span');
    setText(v1, scannedPath);
    p1.appendChild(b1);
    p1.appendChild(v1);
    const p2 = document.createElement('p');
    p2.style.margin = '0 0 4px 0';
    const b2 = document.createElement('b');
    setText(b2, 'Files: ');
    const v2 = document.createElement('span');
    setText(v2, String(total));
    p2.appendChild(b2);
    p2.appendChild(v2);
    left.appendChild(p1);
    left.appendChild(p2);
    const right = document.createElement('div');
    const p3 = document.createElement('p');
    p3.style.margin = '0 0 4px 0';
    const b3 = document.createElement('b');
    setText(b3, 'Score: ');
    const v3 = document.createElement('span');
    setText(v3, `${score}/100`);
    p3.appendChild(b3);
    p3.appendChild(v3);
    const p4 = document.createElement('p');
    p4.style.margin = '0 0 4px 0';
    const b4 = document.createElement('b');
    setText(b4, 'Issues: ');
    const v4 = document.createElement('span');
    setText(v4, `${high} high / ${medium} medium / ${low} low`);
    p4.appendChild(b4);
    p4.appendChild(v4);
    right.appendChild(p3);
    right.appendChild(p4);
    grid.appendChild(left);
    grid.appendChild(right);

    card.appendChild(header);
    card.appendChild(grid);
    container.appendChild(card);
}
