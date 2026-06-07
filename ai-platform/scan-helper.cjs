/**
 * AI Assistant Scan Helper — Run before committing changes
 * Uses SimpleBeacon programmatically to catch issues early
 */
const { runScan } = require('../packages/simplebeacon-cli/src/scan');
const path = require('path');

async function scanForAiAssistant(targetPath, options = {}) {
    const scanRoot = path.resolve(targetPath);
    
    const report = await runScan(scanRoot, {
        config: {
            profile: 'cascade',
            gate: { failOn: ['high', 'critical'] },
            fullDirectoryScan: options.full || false
        },
        verbose: false
    });
    
    // Extract only actionable items for an AI assistant
    const actionable = {
        gatePass: report.gate?.pass ?? true,
        qualityScore: report.qualityScore ?? 100,
        blockingCount: report.gate?.blockingCount ?? 0,
        topIssues: [],
        quickWins: [],
        securityRisks: [],
        deployBlockers: []
    };
    
    const issues = report.detectedIssues || [];
    
    for (const issue of issues) {
        const item = {
            severity: issue.severity,
            type: issue.type,
            description: issue.description || issue.patternDescription || '',
            files: Array.isArray(issue.filePath) ? issue.filePath : [issue.filePath],
            count: issue.count || 1
        };
        
        if (issue.severity === 'high' || issue.severity === 'critical') {
            actionable.topIssues.push(item);
        }
        
        if (issue.type?.toLowerCase().includes('credential') || 
            issue.type?.toLowerCase().includes('secret') ||
            issue.type?.toLowerCase().includes('token')) {
            actionable.securityRisks.push(item);
        }
        
        if (issue.type?.toLowerCase().includes('deploy') ||
            issue.description?.toLowerCase().includes('localhost') ||
            issue.description?.toLowerCase().includes('staging')) {
            actionable.deployBlockers.push(item);
        }
        
        if (issue.severity === 'low' && (issue.count || 0) > 5) {
            actionable.quickWins.push(item);
        }
    }
    
    return actionable;
}

function formatAiReport(actionable) {
    const lines = [];
    
    lines.push(`╔══════════════════════════════════════════╗`);
    lines.push(`║     AI ASSISTANT PRE-COMMIT SCAN         ║`);
    lines.push(`╚══════════════════════════════════════════╝`);
    lines.push('');
    
    const emoji = actionable.gatePass ? '✅' : '❌';
    lines.push(`${emoji} Gate: ${actionable.gatePass ? 'PASS' : 'FAIL'}  |  Quality: ${actionable.qualityScore}/100  |  Blocking: ${actionable.blockingCount}`);
    lines.push('');
    
    if (actionable.securityRisks.length > 0) {
        lines.push(`🔐 SECURITY RISKS (${actionable.securityRisks.length})`);
        for (const r of actionable.securityRisks.slice(0, 3)) {
            lines.push(`   • [${r.severity}] ${r.type}: ${r.description.slice(0, 80)}`);
        }
        lines.push('');
    }
    
    if (actionable.deployBlockers.length > 0) {
        lines.push(`🚀 DEPLOY BLOCKERS (${actionable.deployBlockers.length})`);
        for (const d of actionable.deployBlockers.slice(0, 3)) {
            lines.push(`   • ${d.description.slice(0, 80)}`);
        }
        lines.push('');
    }
    
    if (actionable.topIssues.length > 0) {
        lines.push(`🚨 TOP ISSUES (${actionable.topIssues.length})`);
        for (const i of actionable.topIssues.slice(0, 5)) {
            lines.push(`   • [${i.severity}] ${i.type} (${i.count}x)`);
            if (i.files && i.files[0]) {
                lines.push(`     └─ ${path.basename(i.files[0])}`);
            }
        }
        lines.push('');
    }
    
    if (actionable.quickWins.length > 0) {
        lines.push(`⚡ QUICK WINS (${actionable.quickWins.length})`);
        for (const q of actionable.quickWins.slice(0, 3)) {
            lines.push(`   • Fix ${q.count} ${q.type} issues in bulk`);
        }
        lines.push('');
    }
    
    if (actionable.gatePass && actionable.topIssues.length === 0) {
        lines.push('🎉 All clear! No blocking issues found.');
    } else if (!actionable.gatePass) {
        lines.push('⚠️  Fix blocking issues before proceeding.');
    }
    
    return lines.join('\n');
}

// CLI usage
if (require.main === module) {
    const target = process.argv[2] || process.cwd();
    scanForAiAssistant(target, { full: process.argv.includes('--full') })
        .then(r => {
            console.log(formatAiReport(r));
            process.exit(r.gatePass ? 0 : 1);
        })
        .catch(err => {
            console.error('Scan failed:', err.message);
            process.exit(1);
        });
}

module.exports = { scanForAiAssistant, formatAiReport };
