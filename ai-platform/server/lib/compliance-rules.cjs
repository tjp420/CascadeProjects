// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * EU AI Act Article 14 — Human Oversight Compliance Evaluator.
 *
 * Automated regulatory audit that scans incoming repositories for
 * human-in-the-loop safeguards, mimicking a seasoned compliance auditor.
 *
 * Uses existing cloud-inference infrastructure (no new npm deps).
 * Env: OPENAI_API_KEY or ANTHROPIC_API_KEY (optional — deterministic fallback)
 */

const { summarizeScanWithProvider } = require('../services/cloud-inference-service.cjs');
const logger = require('../../src/lib/app-logger.cjs');

const SYSTEM_PROMPT = `You are an automated regulatory compliance auditor checking code repositories against the EU AI Act Article 14 (Human Oversight Enforcements).

Analyze the repository data below for these four Human Oversight criteria:
1. AUTOMATION BIAS PREVENTION: Are there UI or API markers showing prediction uncertainty (confidence scores, probability margins, model uncertainty) to the end-user? Are AI outputs presented as absolute truth without qualification?
2. INTERVENTION & KILL-SWITCH: Is there a programmable mechanism (abort, terminate, cancel, emergency_stop) that safely halts running AI tasks asynchronously?
3. EXPLAINABILITY & INTERPRETABILITY: Does the code log decision metadata, feature importance, or inference variables so a human can understand *why* the AI made a decision?
4. DATA HYGIENE & INPUT SCRUBBING: Are there strict input-validation layers, sanitization wrappers, regex filters, or prompt-injection guards at API entry points?

Return STRICT JSON with these exact keys:
{
  "automationBiasScore": "PASS or FAIL",
  "killSwitchDetected": true or false,
  "explainabilityStatus": "COMPLIANT, PARTIAL, or NON_COMPLIANT",
  "dataHygieneStatus": "COMPLIANT, PARTIAL, or NON_COMPLIANT",
  "findings": [
    { "severity": "HIGH|MEDIUM|LOW", "pillar": "Name of Pillar", "description": "Specific deficiency or strength found." }
  ],
  "humanRemediationPlan": "2 sentences describing exactly how the developer can add missing human-in-the-loop safeguards.",
  "overallScore": "A, B, C, D, or F"
}

Rules:
- Do not include markdown code fences or extra text outside the JSON.
- If no evidence exists for a pillar, mark it FAIL / NON_COMPLIANT and describe what is missing.
- Base the overallScore on: PASS+A = A, PASS+B = B, partial = C, most FAIL = D, all FAIL = F.`;

/**
 * Evaluate a repository for EU AI Act Article 14 Human Oversight compliance.
 * @param {Object} scanJson — raw simplebeacon scan report
 * @param {Object} options — { provider?: 'openai'|'anthropic'|'ollama', projectPath?: string }
 * @returns {Promise<Object>} — structured compliance evaluation
 */
async function evaluateHumanOversightCompliance(scanJson, options = {}) {
    const provider = options.provider || process.env.COMPLIANCE_PROVIDER || 'openai';

    const prompt = buildHumanOversightPrompt(scanJson);

    try {
        const result = await summarizeScanWithProvider(provider, scanJson, {
            customPrompt: prompt,
            projectPath: options.projectPath || scanJson.projectPath || 'unknown-project',
            reportType: 'eu-ai-act-article14-human-oversight'
        });

        if (!result.enhanced || !result.summary) {
            return buildDeterministicEvaluation(scanJson);
        }

        const parsed = tryParseJson(result.summary);
        if (parsed && parsed.automationBiasScore) {
            return parsed;
        }

        return {
            automationBiasScore: 'FAIL',
            killSwitchDetected: false,
            explainabilityStatus: 'NON_COMPLIANT',
            dataHygieneStatus: 'NON_COMPLIANT',
            findings: [
                { severity: 'HIGH', pillar: 'LLM Output Parsing', description: 'AI provider returned unstructured output — manual review required.' }
            ],
            humanRemediationPlan: 'Re-run with a configured AI provider to receive structured compliance scoring.',
            overallScore: 'D'
        };
    } catch (err) {
        logger.warn('[Compliance Rules] LLM evaluation failed, using deterministic fallback:', err.message);
        return buildDeterministicEvaluation(scanJson);
    }
}

/**
 * Build human oversight prompt.
 * @param {any} scanJson
 * @returns {any}
 */
function buildHumanOversightPrompt(scanJson) {
    const overview = scanJson.analysisOverview || {};
    const issues = (scanJson.detectedIssues || []).slice(0, 12);
    const repoInv = scanJson.repositoryInventory || {};

    // Extract file paths by category for targeted scanning
    const allPaths = (scanJson.detectedIssues || [])
        .map(i => i.filePath || i.path || '')
        .filter(Boolean);
    const htmlPaths = allPaths.filter(p => /\.(html|htm)$/i.test(p));
    const jsPaths = allPaths.filter(p => /\.(js|cjs|mjs|ts|tsx)$/i.test(p));
    const apiPaths = allPaths.filter(p => /(api|route|server|handler)/i.test(p));
    const logPaths = allPaths.filter(p => /(log|audit|event)/i.test(p));

    const payload = JSON.stringify({
        repositoryFilesTotal: overview.repositoryFilesTotal ?? repoInv.totalFiles ?? '—',
        codeFilesAnalyzed: overview.codeFilesAnalyzed ?? '—',
        detectedIssues: issues.map(i => ({ type: i.type, severity: i.severity, filePath: i.filePath })),
        filePathHints: {
            uiFiles: htmlPaths.length,
            logicFiles: jsPaths.length,
            apiEntryPoints: apiPaths.length,
            loggingTargets: logPaths.length
        }
    }, null, 2);

    return `${SYSTEM_PROMPT}\n\nRepository data:\n${payload}`;
}

/**
 * Build deterministic evaluation.
 * @param {any} scanJson
 * @returns {any}
 */
function buildDeterministicEvaluation(scanJson) {
    const overview = scanJson.analysisOverview || {};
    const issues = scanJson.detectedIssues || [];
    const repoInv = scanJson.repositoryInventory || {};
    const totalFiles = overview.repositoryFilesTotal ?? repoInv.totalFiles ?? 0;

    // Heuristic: look for signal words in file paths and issue descriptions
    const allText = issues.map(i => `${i.type || ''} ${i.description || ''} ${i.filePath || ''}`).join(' ').toLowerCase();

    const hasConfidence = /confidence|probability|uncertainty|score/i.test(allText);
    const hasAbort = /abort|kill|terminate|cancel|stop|emergency/i.test(allText);
    const hasExplain = /log|audit|metadata|explain|feature|weight|attribution/i.test(allText);
    const hasSanitize = /sanit|validat|regex|filter|inject|scrub|clean/i.test(allText);

    const findings = [];
    if (hasConfidence) findings.push({ severity: 'LOW', pillar: 'Automation Bias Prevention', description: 'Repository contains references to confidence scoring or uncertainty metrics.' });
    else findings.push({ severity: 'HIGH', pillar: 'Automation Bias Prevention', description: 'No confidence-score or uncertainty UI indicators detected in scanned files.' });

    if (hasAbort) findings.push({ severity: 'LOW', pillar: 'Intervention & Kill-Switch', description: 'Abort, terminate, or stop hooks detected in source.' });
    else findings.push({ severity: 'HIGH', pillar: 'Intervention & Kill-Switch', description: 'No cancellation tokens, abort handlers, or emergency-stop functions detected.' });

    if (hasExplain) findings.push({ severity: 'LOW', pillar: 'Explainability & Interpretability', description: 'Logging or metadata exports found that could support human review.' });
    else findings.push({ severity: 'HIGH', pillar: 'Explainability & Interpretability', description: 'No decision-metadata, feature-importance, or inference-telemetry logging detected.' });

    if (hasSanitize) findings.push({ severity: 'LOW', pillar: 'Data Hygiene & Input Scrubbing', description: 'Input-validation or sanitization patterns found in codebase.' });
    else findings.push({ severity: 'HIGH', pillar: 'Data Hygiene & Input Scrubbing', description: 'No strict input-validation, regex filters, or prompt-injection guards detected at API boundaries.' });

    const passCount = [hasConfidence, hasAbort, hasExplain, hasSanitize].filter(Boolean).length;
    let overallScore;
    if (passCount === 4) overallScore = 'A';
    else if (passCount === 3) overallScore = 'B';
    else if (passCount === 2) overallScore = 'C';
    else if (passCount === 1) overallScore = 'D';
    else overallScore = 'F';

    return {
        automationBiasScore: hasConfidence ? 'PASS' : 'FAIL',
        killSwitchDetected: hasAbort,
        explainabilityStatus: hasExplain ? 'COMPLIANT' : 'NON_COMPLIANT',
        dataHygieneStatus: hasSanitize ? 'COMPLIANT' : 'NON_COMPLIANT',
        findings,
        humanRemediationPlan: passCount === 4
            ? 'All four Article 14 pillars are present. Maintain current practices and add quarterly regression tests.'
            : `Add missing safeguards: ${[!hasConfidence && 'confidence UI', !hasAbort && 'kill-switch hooks', !hasExplain && 'explainability logs', !hasSanitize && 'input sanitization'].filter(Boolean).join(', ')}.`,
        overallScore,
        _deterministic: true,
        _filesAnalyzed: totalFiles
    };
}

/**
 * Try parse json.
 * @param {string} text
 * @returns {any}
 */
function tryParseJson(text) {
    try {
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

module.exports = { evaluateHumanOversightCompliance };
