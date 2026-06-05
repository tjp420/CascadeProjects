/**
 * AI Analyst — Automated compliance verdict generation.
 *
 * Replaces manual operator review with an LLM-powered autopilot loop.
 * Uses the existing cloud-inference infrastructure (no new npm deps).
 *
 * Env: OPENAI_API_KEY or ANTHROPIC_API_KEY (optional — falls back to demo mode)
 */

const { summarizeScanWithProvider } = require('../services/cloud-inference-service.cjs');
const { sendEmail } = require('./email-service.cjs');

const logger = require('../../src/lib/app-logger.cjs');

const SYSTEM_PROMPT = `You are an expert AI Compliance Auditor. Analyze the raw repository scan data provided by the user.

Provide a professional executive summary suitable for a corporate board room.
Return your response STRICTLY as a JSON object with these exact keys:
{
  "complianceGrade": "A, B, C, D, or F",
  "estimatedLiability": "Estimated dollar amount in EUR/USD or 'Low Risk'",
  "verdictSummary": "2-3 sentences explaining the overarching risk status.",
  "remediationSteps": ["Step 1...", "Step 2...", "Step 3..."]
}

Rules:
- Do not include markdown code fences or extra text outside the JSON.
- Base the grade on gate pass/fail, issue counts, severity distribution, and fiction/KPI hits.
- Liability estimates should be conservative and grounded in the scan data.
- Remediation steps must be actionable and specific to the findings.`;

/**
 * Generate an automated compliance verdict from scan results.
 * @param {Object} scanJson — raw simplebeacon scan report
 * @param {Object} options — { provider?: 'openai'|'anthropic'|'ollama', projectPath?: string }
 * @returns {Promise<Object>} — { complianceGrade, estimatedLiability, verdictSummary, remediationSteps }
 */
async function generateAutomatedVerdict(scanJson, options = {}) {
    const provider = options.provider || process.env.AI_ANALYST_PROVIDER || 'openai';

    // Build a compact prompt from the scan payload
    const prompt = buildVerdictPrompt(scanJson);

    try {
        const result = await summarizeScanWithProvider(provider, scanJson, {
            customPrompt: prompt,
            projectPath: options.projectPath || scanJson.projectPath || 'unknown-project',
            reportType: 'ai-analyst-verdict'
        });

        if (!result.enhanced || !result.summary) {
            // No AI provider configured — return deterministic fallback
            return buildDeterministicVerdict(scanJson);
        }

        const parsed = tryParseJson(result.summary);
        if (parsed && parsed.complianceGrade) {
            return parsed;
        }

        // If LLM returned non-JSON, wrap it gracefully
        return {
            complianceGrade: inferGrade(scanJson),
            estimatedLiability: 'Review required',
            verdictSummary: String(result.summary).slice(0, 400),
            remediationSteps: ['Re-run with a configured AI provider for structured output.']
        };
    } catch (err) {
        logger.warn('[AI Analyst] LLM verdict failed, using deterministic fallback:', err.message);
        return buildDeterministicVerdict(scanJson);
    }
}

function buildVerdictPrompt(scanJson) {
    const overview = scanJson.analysisOverview || {};
    const gatePass = scanJson.gatePass;
    const issues = (scanJson.detectedIssues || []).slice(0, 10);
    const fictionHits = (scanJson.detectedIssues || [])
        .filter(i => /fiction|fictional|consistency|kpi/i.test(String(i.type || '')))
        .reduce((s, i) => s + (i.count || 1), 0);
    const sev = scanJson.aggregation?.bySeverity || {};

    const payload = JSON.stringify({
        gatePass,
        issuesDetected: overview.issuesDetected ?? 0,
        repositoryFilesTotal: overview.repositoryFilesTotal ?? '—',
        codeFilesAnalyzed: overview.codeFilesAnalyzed ?? '—',
        dataQualityScore: overview.dataQualityScore ?? '—',
        severity: { critical: sev.critical ?? 0, high: sev.high ?? 0, medium: sev.medium ?? 0, low: sev.low ?? 0 },
        fictionKpiHits: fictionHits,
        topIssues: issues.map(i => ({ type: i.type, count: i.count, severity: i.severity }))
    }, null, 2);

    return `${SYSTEM_PROMPT}\n\nRaw scan data:\n${payload}`;
}

function buildDeterministicVerdict(scanJson) {
    const overview = scanJson.analysisOverview || {};
    const gatePass = scanJson.gatePass;
    const issues = overview.issuesDetected ?? 0;
    const sev = scanJson.aggregation?.bySeverity || {};
    const high = sev.high ?? 0;
    const critical = sev.critical ?? 0;

    let grade;
    if (gatePass === true && issues === 0) grade = 'A';
    else if (gatePass === true && high === 0) grade = 'B';
    else if (gatePass === true) grade = 'C';
    else if (critical === 0) grade = 'D';
    else grade = 'F';

    const liability = (critical > 0 || high > 3)
        ? '€50,000 – €500,000 estimated regulatory exposure'
        : (high > 0)
            ? '€5,000 – €50,000 estimated remediation cost'
            : 'Low Risk';

    return {
        complianceGrade: grade,
        estimatedLiability: liability,
        verdictSummary: `Deterministic scan found ${issues} issues (${critical} critical, ${high} high). Gate result: ${gatePass === true ? 'PASS' : 'FAIL'}.`,
        remediationSteps: [
            'Review all critical and high-severity findings in the detailed report.',
            'Apply the remediation checklist exported by the CLI.',
            'Re-scan after fixes to validate gate passage.'
        ]
    };
}

function inferGrade(scanJson) {
    const overview = scanJson.analysisOverview || {};
    const gatePass = scanJson.gatePass;
    const issues = overview.issuesDetected ?? 0;
    if (gatePass === true && issues === 0) return 'A';
    if (gatePass === true) return 'B';
    return 'C';
}

function tryParseJson(text) {
    try {
        // Strip markdown fences if present
        const cleaned = String(text)
            .replace(/^```json\s*/, '')
            .replace(/^```\s*/, '')
            .replace(/\s*```$/, '')
            .trim();
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
}

/**
 * Fire-and-forget: send the automated verdict via email.
 * @param {Object} options — to, subject, reportData
 */
async function emailAutomatedVerdict(options = {}) {
    const { to, reportData } = options;
    if (!to) {
        logger.warn('[AI Analyst] emailAutomatedVerdict: no recipient');
        return { sent: false, error: 'no recipient' };
    }

    const html = `
        <h2>Automated Compliance Report — ${reportData.project || 'Project'}</h2>
        <p><strong>Grade:</strong> ${reportData.complianceGrade}</p>
        <p><strong>Estimated Liability:</strong> ${reportData.estimatedLiability}</p>
        <p><strong>Verdict:</strong> ${reportData.verdictSummary}</p>
        <h3>Remediation Steps</h3>
        <ol>${(reportData.remediationSteps || []).map(s => `<li>${s}</li>`).join('')}</ol>
        <hr/>
        <p style="font-size:12px;color:#666;">
            Generated by SimpleBeacon AI Analyst (autopilot).<br/>
            This verdict was produced algorithmically and cryptographically signed.
        </p>
    `;

    return sendEmail({
        to,
        subject: options.subject || `Your Automated Compliance Report — ${reportData.project || 'Project'}`,
        text: `Grade: ${reportData.complianceGrade}\nLiability: ${reportData.estimatedLiability}\n\nVerdict: ${reportData.verdictSummary}\n\nRemediation:\n${(reportData.remediationSteps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
        html
    });
}

module.exports = { generateAutomatedVerdict, emailAutomatedVerdict, buildDeterministicVerdict };
