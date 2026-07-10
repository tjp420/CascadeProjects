const fs = require('fs');
const path = 'c:/Users/Trevor/CascadeProjects/coming-soon/public/dashboard/js-es2018/components/ScanStatus.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update import
content = content.replace(
    "import { isLocalPath, probeAgent4000, scanViaAgent4000 } from '../services/localAgentService.js?v=20260710bridge1';",
    "import { isLocalPath, probeAgent4000, scanViaAgent4000, renderAgentCertificate } from '../services/localAgentService.js?v=20260710bridge1';"
);

// 2. Add results div after status
content = content.replace(
    `      <p id="agent-4000-status" class="agent-status"></p>\n    </div>`,
    `      <p id="agent-4000-status" class="agent-status"></p>\n      <div id="agent-4000-results"></div>\n    </div>`
);

// 3. Update runDashboardScanFromInput agent branch
const oldBranch = `                const result = await scanViaAgent4000(path);\n                const summary = result.summary || {};\n                const mb = (summary.totalSizeBytes || 0) / 1024 / 1024;\n                const message = \`Localhost:4000 scan complete — \${summary.fileCount || 0} files, \${summary.folderCount || 0} folders, \${mb.toFixed(2)} MB\`;\n                showToast(message, 'success');\n                const statusEl = document.getElementById('agent-4000-status');\n                if (statusEl) {\n                    statusEl.textContent = message;\n                    statusEl.classList.remove('unavailable');\n                    statusEl.classList.add('available');\n                }\n                if (onLocalScanResult) {\n                    onLocalScanResult({ projectPath: result.path, summary, source: 'agent4000' });\n                }\n                setLastProjectPath(result.path || path);`;
const newBranch = `                const result = await scanViaAgent4000(path);\n                const cert = result && result.certificate;\n                const fileCount = (result.files || []).length;\n                const message = cert\n                    ? \`Localhost:4000 scan complete — Grade \${cert.letterGrade} | \${fileCount} files | Liability \${cert.liabilityStr}\`\n                    : \`Localhost:4000 scan complete — \${fileCount} files\`;\n                showToast(message, 'success');\n                const statusEl = document.getElementById('agent-4000-status');\n                if (statusEl) {\n                    statusEl.textContent = message;\n                    statusEl.classList.remove('unavailable');\n                    statusEl.classList.add('available');\n                }\n                const resultsEl = document.getElementById('agent-4000-results');\n                renderAgentCertificate(result, resultsEl);\n                if (onLocalScanResult) {\n                    onLocalScanResult({ projectPath: result.verifiedAddress || result.path, summary: result.certificate, source: 'agent4000' });\n                }\n                setLastProjectPath(result.verifiedAddress || result.path || path);`;

if (!content.includes(oldBranch)) {
    throw new Error('agent branch not found');
}
content = content.replace(oldBranch, newBranch);

fs.writeFileSync(path, content);
console.log('updated');
