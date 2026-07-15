const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Whitelist the deployed Render dashboard and common local dev origins.
// Add more origins here if you run the dashboard on a different domain.
const ALLOWED_ORIGINS = [
    'https://cascadeprojects-yzzd.onrender.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4000',
    'http://127.0.0.1:4000'
];

app.use(cors({
    origin: (origin, callback) => {
        // allow requests with no origin (e.g. curl, mobile wrappers)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept']
}));

app.use(express.json({ limit: '1mb' }));

// Heartbeat endpoint
app.get('/api/ping', (_req, res) => {
    res.json({ online: true });
});

// Core scanning and A-F grading endpoint
app.post('/api/analyze', (req, res) => {
    const targetPath = path.normalize(req.body && req.body.path ? String(req.body.path).trim() : '');

    if (!targetPath || !fs.existsSync(targetPath)) {
        return res.status(404).json({ success: false, error: 'Directory path does not exist on this machine.' });
    }

    try {
        const fileReport = [];
        const globalIssuesQueue = [];
        let highRiskCount = 0;
        let mediumRiskCount = 0;

        // SimpleBeacon heuristic patterns executed natively outside the browser sandbox
        const BS = String.fromCharCode(92);
        const BT = String.fromCharCode(96);
        const rules = [
            { id: 'SB-01', type: 'Exposed Credentials', severity: 'HIGH', regex: new RegExp('(sk_live_' + '[a-zA-Z0-9]{24,}' + '|' + 'AKIA[0-9A-Z]{16})', 'g'), msg: 'Hardcoded production API secret key leakage.' },
            { id: 'SB-02', type: 'Placeholder Debris', severity: 'MEDIUM', regex: new RegExp('(' + '/' + '/ Add your ' + 'logic ' + 'here' + '|' + '/' + '/' + BS + 's*TODO:' + BS + 's*AI' + BS + 's*generated)', 'gi'), msg: 'Unimplemented functional logic placeholder template.' },
            { id: 'SB-03', type: 'Markdown Fences', severity: 'MEDIUM', regex: new RegExp('(' + BT + BT + BT + 'javascript' + '|' + BT + BT + BT + 'json' + '|' + BT + BT + BT + 'html)', 'g'), msg: 'Raw markdown formatting left behind from an AI chat interaction wrapper.' }
        ];

        function countMatches(content, regex) {
            const matches = content.match(regex);
            return matches ? matches.length : 0;
        }

        function scanDirectory(currentDir) {
            let items;
            try {
                items = fs.readdirSync(currentDir);
            }
            catch {
                return; // Ignore folders with strict permissions
            }

            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isFile()) {
                        // Skip large compiled binaries (> 1.5MB) to keep parsing lightweight
                        if (stat.size > 1500000)
                            continue;

                        let content = '';
                        try {
                            content = fs.readFileSync(fullPath, 'utf8');
                        }
                        catch {
                            continue; // Binary or unreadable file
                        }

                        const fileIssues = [];

                        for (const rule of rules) {
                            const matchCount = countMatches(content, rule.regex);
                            if (matchCount > 0) {
                                if (rule.severity === 'HIGH')
                                    highRiskCount += matchCount;
                                if (rule.severity === 'MEDIUM')
                                    mediumRiskCount += matchCount;

                                fileIssues.push(`${rule.type} (${matchCount}x)`);
                                globalIssuesQueue.push({
                                    severity: rule.severity,
                                    filePath: fullPath,
                                    message: rule.msg
                                });
                            }
                        }

                        fileReport.push({
                            name: item,
                            absolutePath: fullPath,
                            size: stat.size,
                            status: fileIssues.length > 0 ? `Issues Flagged: ${fileIssues.join(', ')}` : 'Clean'
                        });
                    }
                    else if (stat.isDirectory()) {
                        // Skip heavy build/dependency folders
                        if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build')
                            continue;
                        scanDirectory(fullPath);
                    }
                }
                catch {
                    continue;
                }
            }
        }

        scanDirectory(targetPath);

        // Compute SimpleBeacon compliance score
        let score = 100 - (highRiskCount * 15) - (mediumRiskCount * 4);
        if (score < 0)
            score = 0;
        if (highRiskCount > 0)
            score = Math.min(score, 55); // Immediate F override for exposed live keys

        let letterGrade = 'F';
        let color = '#dc3545';
        if (score >= 90) { letterGrade = 'A'; color = '#28a745'; }
        else if (score >= 80) { letterGrade = 'B'; color = '#0366d6'; }
        else if (score >= 70) { letterGrade = 'C'; color = '#ffc107'; }
        else if (score >= 60) { letterGrade = 'D'; color = '#fd7e14'; }

        const estimatedLiability = (highRiskCount * 25000) + (mediumRiskCount * 1250);

        res.json({
            success: true,
            verifiedAddress: targetPath,
            files: fileReport,
            certificate: {
                score,
                letterGrade,
                badgeColor: color,
                highRiskCount,
                mediumRiskCount,
                liabilityStr: `$${estimatedLiability.toLocaleString()}`,
                complianceStatus: letterGrade === 'F' ? 'NON-COMPLIANT (CRITICAL DEBT)' : 'APPROVED FOR PRODUCTION RELEASE',
                logs: globalIssuesQueue
            }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    if (process.env.SB_DEBUG === '1') {
        console.log(`SimpleBeacon Native Scanning Agent active on http://localhost:${PORT}`);
    }
});
