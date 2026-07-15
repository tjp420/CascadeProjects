// simplebeacon-ignore: debugArtifacts
// SPDX-License-Identifier: MIT
/**
 * SimpleBeacon Report → AI Agent Bridge
 * Reads a SimpleBeacon scan report, builds a remediation prompt,
 * and runs it through the local 2B-parameter agent.
 *
 * Usage: node report-analyzer.cjs <path-to-report.json>
 */

const fs = require('fs');
const path = require('path');
const { runLocalAgent } = require('./orchestrator.cjs');

function buildPrompt(report) { // simplebeacon-ignore debug-artifact — legitimate function name, not a debug stub
    const gate = report.gate || {};
    const sev = report.severityCounts || {};
    const issues = report.detectedIssues || report.rawIssues || [];

    const topIssues = issues
        .filter(i => (i.severity || 'low') !== 'low')
        .slice(0, 10)
        .map(i => `- [${i.severity?.toUpperCase() || 'MEDIUM'}] ${i.type || i.rule || 'Finding'}: ${i.description || i.message || ''} (${i.file || i.filePath || ''}${i.line ? ':' + i.line : ''})`)
        .join('\n');

    const prompt = `You are a code hygiene expert. Analyze this SimpleBeacon scan report and propose specific, safe remediation steps.

SCAN SUMMARY
- Gate: ${gate.pass ? 'PASS' : 'FAIL'}
- Critical: ${sev.critical || 0}, High: ${sev.high || 0}, Medium: ${sev.medium || 0}, Low: ${sev.low || 0}

TOP ISSUES
${topIssues || 'No medium+ issues found.'}

INSTRUCTIONS
1. For each issue, propose a concrete code change or deletion.
2. Only touch files that exist; never invent paths.
3. Prefer single-line fixes over rewrites.
4. If an issue is a false positive, mark it as such.
5. Return your analysis as a JSON array of actions with shape:
   { "op": "read_file", "path": "<relative-path>" }
   { "op": "patch_file", "path": "<relative-path>", "search": "<exact-string>", "replace": "<exact-string>" }
   { "op": "run_tests" }

Output ONLY the JSON array. No explanations outside the JSON.`;

    return prompt;
}

async function main() {
    const reportPath = process.argv[2];
    if (!reportPath) {
        console.error('Usage: node report-analyzer.cjs <path-to-report.json>'); // simplebeacon-ignore debug-artifact — CLI usage message
        process.exit(1);
    }

    if (!fs.existsSync(reportPath)) {
        console.error(`Report not found: ${reportPath}`); // simplebeacon-ignore debug-artifact — CLI error message
        process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const prompt = buildPrompt(report); // simplebeacon-ignore debug-artifact — core analysis logic, not a debug stub

    const outDir = path.join(path.dirname(reportPath), 'ai-analysis');
    fs.mkdirSync(outDir, { recursive: true });

    const promptPath = path.join(outDir, 'prompt.txt');
    fs.writeFileSync(promptPath, prompt, 'utf8');

    const result = await runLocalAgent(prompt);

    const analysisPath = path.join(outDir, 'analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify({
        success: result.success,
        steps: result.steps || 0,
        error: result.error || null,
        raw: result.raw || null,
        generatedAt: new Date().toISOString()
    }, null, 2));
    console.log(`Analysis saved to ${analysisPath}`); // simplebeacon-ignore debug-artifact — CLI output
}

if (require.main === module) {
    main().catch(e => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = { buildPrompt };
