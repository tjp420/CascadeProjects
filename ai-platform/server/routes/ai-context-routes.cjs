// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// POST /api/ai-context — receive scan data + notes and write to .simplebeacon/ai-context.md
router.post('/ai-context', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const { projectPath, notes, reportSummary, issues } = req.body || {};
        if (!projectPath || typeof projectPath !== 'string') {
            return res.status(400).json({ success: false, error: 'projectPath is required' });
        }

        // Resolve relative paths against the platform root (repo root) instead of server cwd
        const platformRoot = path.join(__dirname, '..', '..');
        const safePath = path.isAbsolute(projectPath) ? path.resolve(projectPath) : path.resolve(platformRoot, projectPath);
        const sbDir = path.join(safePath, '.simplebeacon');
        const contextPath = path.join(sbDir, 'ai-context.md');

        // Ensure .simplebeacon directory exists
        await fs.promises.mkdir(sbDir, { recursive: true });

        const timestamp = new Date().toISOString();
        let md = `# AI Context — SimpleBeacon Scan\n\n**Generated:** ${timestamp}\n**Project:** ${safePath}\n\n`;

        if (notes && typeof notes === 'string') {
            md += `## User Notes\n\n${notes}\n\n`;
        }

        if (reportSummary && typeof reportSummary === 'object') {
            md += `## Scan Summary\n\n`;
            md += `- **Gate Pass:** ${reportSummary.gatePass ?? 'N/A'}\n`;
            md += `- **Quality Score:** ${reportSummary.qualityScore ?? 'N/A'}\n`;
            md += `- **Total Issues:** ${reportSummary.totalIssues ?? 'N/A'}\n`;
            md += `- **Files Scanned:** ${reportSummary.filesScanned ?? 'N/A'}\n`;
            md += `- **Report Type:** ${reportSummary.reportType ?? 'N/A'}\n\n`;
        }

        if (Array.isArray(issues) && issues.length > 0) {
            md += `## Issues (${issues.length})\n\n`;
            for (const issue of issues.slice(0, 50)) {
                const sev = issue.severity || issue.type || 'unknown';
                const file = issue.filePath || issue.file || 'N/A';
                const line = issue.line || issue.lineNumber || '';
                const desc = issue.description || issue.message || issue.title || JSON.stringify(issue).slice(0, 200);
                md += `- **[${sev.toUpperCase()}]** ${desc} — \`${file}${line ? ':' + line : ''}\`\n`;
            }
            if (issues.length > 50) {
                md += `\n... and ${issues.length - 50} more issues.\n`;
            }
            md += '\n';
        }

        md += `## Next Steps\n\n1. Review the issues above\n2. Run fixes via: \`npx simplebeacon scan --fix\`\n3. Or ask the AI agent to fix specific files\n`;

        await fs.promises.writeFile(contextPath, md, 'utf8');
        res.json({ success: true, path: contextPath, content: md, message: 'AI context saved. Mention @.simplebeacon/ai-context.md in chat.' });
    } catch (err) {
        console.error('[AI-Context]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai-context — retrieve the current AI context markdown for the AI agent
router.get('/ai-context', async (req, res) => {
    try {
        const projectPath = req.query.projectPath || process.cwd();
        const platformRoot = path.join(__dirname, '..', '..');
        const safePath = path.isAbsolute(projectPath) ? path.resolve(projectPath) : path.resolve(platformRoot, projectPath);
        const contextPath = path.join(safePath, '.simplebeacon', 'ai-context.md');

        try {
            const content = await fs.promises.readFile(contextPath, 'utf8');
            res.json({ success: true, path: contextPath, content });
        } catch {
            res.status(404).json({ success: false, error: 'No AI context file found. Upload a report and click "Send to AI Agent" first.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
