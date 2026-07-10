const fs = require('fs');
const path = 'c:/Users/Trevor/CascadeProjects/coming-soon/public/dashboard/js-es2018/services/localAgentService.js';
let content = fs.readFileSync(path, 'utf8');
if (content.includes('renderAgentCertificate')) {
    console.log('already added');
    process.exit(0);
}
const insertAfter = `export async function scanViaAgent4000(projectPath, origin = AGENT_4000_ORIGIN) {\n    const response = await agentFetchWithTimeout(\`\${origin}/api/analyze\`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },\n        body: JSON.stringify({ path: projectPath })\n    });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok || !data.success) {\n        throw new Error(data.error || \`Agent scan failed (\${response.status})\`);\n    }\n    return data;\n}`;
const idx = content.indexOf(insertAfter);
if (idx === -1) throw new Error('scanViaAgent4000 anchor not found');
const helper = `
/**
 * Render the A-F compliance certificate from the localhost:4000 agent into a container.
 * Uses DOM APIs instead of innerHTML to avoid XSS vectors from local path/file names.
 * @param {Object} report
 * @param {HTMLElement} [container]
 */
export function renderAgentCertificate(report, container) {
    if (!container)
        return;
    container.replaceChildren();
    const cert = report && report.certificate;
    if (!cert)
        return;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = \`border:2px solid \${cert.badgeColor}; padding:16px; border-radius:6px; background:#fff; margin-bottom:16px;\`;
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;';
    const titleBlock = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = 'SIMPLEBEACON COMPLIANCE REPORT';
    title.style.cssText = 'margin:0 0 4px 0; font-size:1.1rem;';
    const status = document.createElement('span');
    status.textContent = cert.complianceStatus || '';
    status.style.cssText = \`font-weight:600; color:\${cert.badgeColor};\`;
    titleBlock.appendChild(title);
    titleBlock.appendChild(status);
    const badge = document.createElement('div');
    badge.textContent = cert.letterGrade;
    badge.style.cssText = \`background:\${cert.badgeColor}; color:#fff; width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:bold;\`;
    header.appendChild(titleBlock);
    header.appendChild(badge);
    wrapper.appendChild(header);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px;';
    function makePair(labelText, valueText, valueColor) {
        const p = document.createElement('p');
        p.style.margin = '0 0 4px 0';
        const label = document.createElement('b');
        label.textContent = labelText;
        const value = document.createElement('span');
        value.textContent = \` \${valueText}\`;
        if (valueColor)
            value.style.color = valueColor;
        p.appendChild(label);
        p.appendChild(value);
        return p;
    }
    const left = document.createElement('div');
    left.appendChild(makePair('Scanned Absolute Path:', report.verifiedAddress || report.path || '', null));
    left.appendChild(makePair('Total Files Handled:', String((report.files || []).length), null));
    const right = document.createElement('div');
    right.appendChild(makePair('Heuristic Score:', \`\${cert.score || 0}/100\`, null));
    right.appendChild(makePair('Estimated Risk Liability:', cert.liabilityStr || '$0', '#dc3545'));
    grid.appendChild(left);
    grid.appendChild(right);
    wrapper.appendChild(grid);
    container.appendChild(wrapper);
    const filesHeading = document.createElement('h4');
    filesHeading.textContent = 'Mapped System File Trees:';
    filesHeading.style.cssText = 'margin:12px 0 8px 0; font-size:14px;';
    container.appendChild(filesHeading);
    const filesBox = document.createElement('div');
    filesBox.style.cssText = 'max-height:260px; overflow-y:auto; background:#1e1e1e; color:#abb2bf; padding:12px; font-family:monospace; font-size:12px; border-radius:4px;';
    const files = report.files || [];
    if (!files.length) {
        const empty = document.createElement('div');
        empty.textContent = 'No files returned.';
        filesBox.appendChild(empty);
    }
    else {
        files.forEach((f) => {
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom:4px; white-space:nowrap;';
            row.textContent = \`[\${f.status || 'Clean'}] - \${f.absolutePath || f.name} (\${f.size || 0} bytes)\`;
            filesBox.appendChild(row);
        });
    }
    container.appendChild(filesBox);
}`;
content = content.slice(0, idx + insertAfter.length) + helper + content.slice(idx + insertAfter.length);
fs.writeFileSync(path, content);
console.log('added');
