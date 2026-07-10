const fs = require('fs');
const path = 'c:/Users/Trevor/CascadeProjects/coming-soon/public/dashboard/js-es2018/views/AnalyzeView.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update import
content = content.replace(
    "import { probeAgent, scanViaAgent, shouldUseAgent, isLocalPath, formatAgentStatus, getAgentDownloadUrl, detectPlatform, getPlatformLabel, getInstallInstructions, getAgentFallbackMessage, probeAgent4000, scanViaAgent4000 } from '../services/localAgentService.js?v=20260710bridge1';",
    "import { probeAgent, scanViaAgent, shouldUseAgent, isLocalPath, formatAgentStatus, getAgentDownloadUrl, detectPlatform, getPlatformLabel, getInstallInstructions, getAgentFallbackMessage, probeAgent4000, scanViaAgent4000, renderAgentCertificate } from '../services/localAgentService.js?v=20260710bridge1';"
);

// 2. Add results div after status
content = content.replace(
    `              <p id="fingerprint-status" class="fingerprint-status"></p>\n              <p id="agent-status" class="agent-status"></p>\n              <p id="agent-4000-status" class="agent-status"></p>\n              <p id="agent-download-cta" class="agent-download-cta"></p>`,
    `              <p id="fingerprint-status" class="fingerprint-status"></p>\n              <p id="agent-status" class="agent-status"></p>\n              <p id="agent-4000-status" class="agent-status"></p>\n              <div id="agent-4000-results"></div>\n              <p id="agent-download-cta" class="agent-download-cta"></p>`
);

// 3. Update runAgent4000Scan body
const oldBody = `            const result = await scanViaAgent4000(projectPath);\n            const summary = result.summary || {};\n            const mb = (summary.totalSizeBytes || 0) / 1024 / 1024;\n            const message = \`Localhost:4000 scan complete — \${summary.fileCount || 0} files, \${summary.folderCount || 0} folders, \${mb.toFixed(2)} MB\`;\n            showToast(message, 'success');\n            const statusEl = this._root && this._root.querySelector('#agent-4000-status');\n            if (statusEl) {\n                statusEl.textContent = message;\n                statusEl.classList.remove('unavailable');\n                statusEl.classList.add('available');\n            }`;
const newBody = `            const result = await scanViaAgent4000(projectPath);\n            const cert = result && result.certificate;\n            const fileCount = (result.files || []).length;\n            const message = cert\n                ? \`Localhost:4000 scan complete — Grade \${cert.letterGrade} | \${fileCount} files | Liability \${cert.liabilityStr}\`\n                : \`Localhost:4000 scan complete — \${fileCount} files\`;\n            showToast(message, 'success');\n            const statusEl = this._root && this._root.querySelector('#agent-4000-status');\n            if (statusEl) {\n                statusEl.textContent = message;\n                statusEl.classList.remove('unavailable');\n                statusEl.classList.add('available');\n            }\n            const resultsEl = this._root && this._root.querySelector('#agent-4000-results');\n            renderAgentCertificate(result, resultsEl);`;

if (!content.includes(oldBody)) {
    throw new Error('runAgent4000Scan body not found');
}
content = content.replace(oldBody, newBody);

fs.writeFileSync(path, content);
console.log('updated');
