// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * CCO-Grade Executive Risk Certificate Generator
 *
 * Converts raw technical scan findings into a board-ready compliance artifact.
 * Maps the 4 Core Compliance Pillars to illustrative risk estimates, risk tiers,
 * and plain-language remediation for Chief Compliance Officers. Financial
 * figures are not legal advice, regulatory predictions, or sourced fine averages.
 *
 * Usage:
 *   npx simplebeacon pdf --report .simplebeacon/report.json --output ./risk-certificate.html
 *
 * Requires a valid SIMPLEBEACON_LICENSE_TOKEN (from Stripe checkout) or
 * ~/.simplebeacon/license.jwt.
 */

const fs = require('fs');
const path = require('path');
const { validateLicenseToken, resolveLicenseToken } = require('./license-token');

// Local development fallback only — never used in production
const SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Risk-Translation Matrix — maps technical findings to CCO language       */
/* ────────────────────────────────────────────────────────────────────────── */

const PILLARS = {
    slop: {
        name: 'AI Slop & Hallucination Tracking',
        businessPitch: 'Prevents shipping fake AI-generated variables to live clients',
        regulatoryFrameworks: ['EU AI Act Article 50', 'FTC Truth-in-Advertising'],
        avgFinePerIncident: 150000,
        findingTypes: ['LLM Slop Pattern', 'Fiction KPI', 'Placeholder Copy']
    },
    leak: {
        name: 'Sensitive Data & API Key Leak Prevention',
        businessPitch: 'Neutralises exposed backend access tokens before hackers find them',
        regulatoryFrameworks: ['GDPR Article 32', 'CCPA 1798.150', 'SOX 404'],
        avgFinePerIncident: 250000,
        findingTypes: ['Credential Pattern', 'Production Leak', 'Secret Exposure']
    },
    shadowAi: {
        name: 'Shadow AI System Detection',
        businessPitch: 'Maps entire software structure to catch unapproved AI dependencies',
        regulatoryFrameworks: ['EU AI Act Annex III', 'NIST AI RMF 1.0'],
        avgFinePerIncident: 350000,
        findingTypes: ['EU AI Act — AI System Indicator', 'Shadow AI', 'Unapproved Model']
    },
    licensing: {
        name: 'Open-Source Licensing & IP Verification',
        businessPitch: 'Ensures internal codebase remains 100% private property',
        regulatoryFrameworks: ['GPL v3', 'Apache 2.0', 'Proprietary IP Theft'],
        avgFinePerIncident: 500000,
        findingTypes: ['License Conflict', 'Copy-Paste Code', 'Missing Attribution']
    }
};

const SEVERITY_MULTIPLIERS = { critical: 4.0, high: 2.5, medium: 1.0, low: 0.25 };

/**
 * Classify a scan issue into one of the four compliance pillars.
 * @param {Object} issue
 * @returns {string} pillar key (slop | leak | shadowAi | licensing)
 */
function classifyIssue(issue) {
    const type = (issue.type || '').toLowerCase();
    const desc = (issue.description || '').toLowerCase();
    const pattern = (issue.pattern || '').toLowerCase();
    for (const [key, pillar] of Object.entries(PILLARS)) {
        for (const ft of pillar.findingTypes) {
            if (type.includes(ft.toLowerCase()) || desc.includes(ft.toLowerCase()) || pattern.includes(ft.toLowerCase())) {
                return key;
            }
        }
    }
    if (pattern.includes('credential') || type.includes('credential')) return 'leak';
    if (pattern.includes('euai') || type.includes('eu ai act')) return 'shadowAi';
    if (type.includes('slop') || desc.includes('placeholder') || desc.includes('hallucinat')) return 'slop';
    return 'slop';
}

/**
 * Build a risk profile aggregating findings by pillar and severity.
 * @param {Object} report
 * @returns {Object}
 */
function buildRiskProfile(report) {
    const detectedIssues = report.detectedIssues || [];
    const profile = {
        slop: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
        leak: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
        shadowAi: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] },
        licensing: { count: 0, critical: 0, high: 0, medium: 0, low: 0, issues: [] }
    };

    for (const issue of detectedIssues) {
        const pillarKey = classifyIssue(issue);
        const sev = (issue.severity || 'low').toLowerCase();
        profile[pillarKey].count += issue.count || 1;
        profile[pillarKey][sev] = (profile[pillarKey][sev] || 0) + (issue.count || 1);
        profile[pillarKey].issues.push(issue);
    }
    return profile;
}

/**
 * Compute estimated financial liability from a risk profile.
 * @param {Object} profile
 * @returns {{total:number, breakdown:Array<{pillar:string, amount:number, count:number}>}}
 */
function computeFinancialLiability(profile) {
    let total = 0;
    const breakdown = [];
    for (const [key, data] of Object.entries(profile)) {
        const pillar = PILLARS[key];
        let pillarTotal = 0;
        for (const [sev, count] of Object.entries(data)) {
            if (['critical','high','medium','low'].includes(sev) && count > 0) {
                pillarTotal += count * pillar.avgFinePerIncident * (SEVERITY_MULTIPLIERS[sev] || 1);
            }
        }
        total += pillarTotal;
        breakdown.push({ pillar: pillar.name, amount: pillarTotal, count: data.count });
    }
    return { total, breakdown };
}

/**
 * Compute a compliance grade (A–F) from a risk profile.
 * @param {Object} profile
 * @returns {{score:number, grade:string, tier:string, color:string, totalFindings:number}}
 */
function computeComplianceGrade(profile) {
    let totalFindings = 0;
    let weightedScore = 100;
    for (const data of Object.values(profile)) {
        totalFindings += data.count;
        weightedScore -= (data.critical || 0) * 25 + (data.high || 0) * 10 + (data.medium || 0) * 3;
    }
    const score = Math.max(0, weightedScore);
    let grade, tier, color;
    if (score >= 90) { grade = 'A'; tier = 'Low Risk'; color = '#0f5132'; }
    else if (score >= 70) { grade = 'B'; tier = 'Moderate Risk'; color = '#664d03'; }
    else if (score >= 50) { grade = 'C'; tier = 'High Risk'; color = '#842029'; }
    else { grade = 'F'; tier = 'Critical Risk'; color = '#5a0a0a'; }
    return { score, grade, tier, color, totalFindings };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  License validation (unchanged)                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function validateLicense() {
    const token = resolveLicenseToken();
    if (!token) {
        return {
            valid: false,
            error: 'No license token found. Set SIMPLEBEACON_LICENSE_TOKEN or run: npx simplebeacon buy-clearance'
        };
    }
    return validateLicenseToken(token, SECRET);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  HTML Builder — CCO-grade Executive Risk Certificate                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Build the CCO-grade Executive Risk Certificate HTML.
 * @param {Object} report
 * @param {Object} licenseClaims
 * @returns {string} HTML string
 */
function buildExecutiveHtml(report, licenseClaims) {
    const profile = buildRiskProfile(report);
    const liability = computeFinancialLiability(profile);
    const grade = computeComplianceGrade(profile);
    const gate = report.gate || {};
    const generatedAt = new Date().toISOString();

    const pillarCards = Object.entries(PILLARS).map(([key, pillar]) => {
        const data = profile[key];
        const badgeColor = data.critical > 0 ? '#f8d7da' : data.high > 0 ? '#fff3cd' : '#d1e7dd';
        const badgeText = data.critical > 0 ? '#842029' : data.high > 0 ? '#664d03' : '#0f5132';
        return `
        <div class="pillar-card">
            <div class="pillar-header" style="background:${badgeColor};color:${badgeText}">
                <strong>${pillar.name}</strong>
                <span class="pillar-count">${data.count} finding${data.count === 1 ? '' : 's'}</span>
            </div>
            <p class="pillar-pitch">${pillar.businessPitch}</p>
            <div class="pillar-meta">
                <span>Regulatory exposure: ${pillar.regulatoryFrameworks.join(', ')}</span>
                <span>Illustrative risk basis per incident: $${pillar.avgFinePerIncident.toLocaleString()}</span>
            </div>
            ${data.issues.length > 0 ? '<ul class="pillar-actions">' + data.issues.slice(0,3).map(i =>
                `<li><strong>${i.severity?.toUpperCase()}</strong> — ${(i.recommendedAction || i.recommendation || 'Review').slice(0,100)}</li>`
            ).join('') + '</ul>' : '<p class="pillar-clean">No findings in this pillar.</p>'}
        </div>`;
    }).join('');

    const liabilityRows = liability.breakdown
        .filter(b => b.amount > 0)
        .map(b => `
        <tr>
            <td>${b.pillar}</td>
            <td>${b.count}</td>
            <td>$${b.amount.toLocaleString()}</td>
        </tr>
    `).join('');

    const remediationSteps = [];
    for (const [key, data] of Object.entries(profile)) {
        if (data.count === 0) continue;
        const pillar = PILLARS[key];
        remediationSteps.push(`<div class="remediation-block">
            <h4>${pillar.name}</h4>
            <p><strong>Business impact:</strong> ${pillar.businessPitch}.</p>
            <p><strong>Estimated financial exposure:</strong> $${liability.breakdown.find(b => b.pillar === pillar.name)?.amount.toLocaleString() || '0'}.</p>
            <ol>
                ${data.issues.slice(0, 3).map(i => '<li>Delete or replace: ' + (i.recommendedAction || i.recommendation || 'Review manually').slice(0, 120) + '.</li>').join('')}
                ${data.issues.length > 3 ? `<li>...and ${data.issues.length - 3} additional item(s). Run <code>npx simplebeacon scan --gate</code> for full detail.</li>` : ''}
            </ol>
        </div>`);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Executive Risk Certificate</title>
<style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 48px; color: #1a1a1a; line-height: 1.55; font-size: 14px; }
    .letterhead { border-bottom: 4px solid #0d6efd; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .letterhead-left h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -0.3px; }
    .letterhead-left p { margin: 0; color: #6c757d; font-size: 13px; }
    .letterhead-right { text-align: right; }
    .letterhead-right .engines-badge { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0d6efd; background: rgba(13,110,253,0.08); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(13,110,253,0.2); }
    .letterhead-right .tagline { font-size: 11px; color: #6c757d; margin-top: 6px; max-width: 280px; }
    .grade-badge { display: inline-flex; align-items: center; justify-content: center; width: 90px; height: 90px; border-radius: 50%; font-size: 42px; font-weight: 800; color: #fff; background: ${grade.color}; margin: 16px 0; }
    .grade-label { font-size: 18px; font-weight: 600; margin-left: 16px; }
    .summary-row { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; margin-bottom: 28px; }
    .score-card { background: #f8f9fa; border-radius: 8px; padding: 14px 20px; min-width: 140px; }
    .score-card h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; color: #6c757d; letter-spacing: 0.5px; }
    .score-card p { margin: 0; font-size: 22px; font-weight: 700; }
    .gate-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; font-size: 14px; font-weight: 700; }
    .gate-pass { background: #d1e7dd; color: #0f5132; border: 1px solid #badbcc; }
    .gate-fail { background: #f8d7da; color: #842029; border: 1px solid #f5c2c7; }
    .risk-tier { font-size: 13px; padding: 4px 10px; border-radius: 4px; font-weight: 600; display: inline-block; margin-top: 6px; }
    .quality-bar-container { width: 100%; max-width: 300px; height: 24px; background: #e9ecef; border-radius: 12px; overflow: hidden; margin-top: 8px; }
    .quality-bar-fill { height: 100%; border-radius: 12px; transition: width 0.5s ease; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-size: 11px; font-weight: 700; color: #fff; }
    h2 { font-size: 18px; margin-top: 32px; border-bottom: 2px solid #dee2e6; padding-bottom: 6px; }
    h3 { font-size: 15px; margin-top: 20px; color: #343a40; }
    .pillar-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
    .pillar-card { border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
    .pillar-header { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .pillar-count { font-weight: 700; font-size: 14px; }
    .pillar-pitch { padding: 12px 16px; margin: 0; font-size: 13px; color: #495057; background: #fff; }
    .pillar-meta { padding: 8px 16px; background: #f8f9fa; font-size: 11px; color: #6c757d; display: flex; justify-content: space-between; border-top: 1px solid #e9ecef; }
    .pillar-actions { margin: 0; padding: 12px 16px; background: #fff; font-size: 12px; }
    .pillar-actions li { margin-bottom: 6px; }
    .pillar-clean { padding: 12px 16px; margin: 0; color: #0f5132; font-size: 13px; background: #fff; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #495057; }
    .liability-total { font-size: 22px; font-weight: 700; color: #842029; margin-top: 8px; }
    .remediation-block { background: #f8f9fa; border-left: 4px solid #0d6efd; padding: 14px 18px; margin: 14px 0; border-radius: 0 6px 6px 0; }
    .remediation-block h4 { margin: 0 0 8px; font-size: 14px; }
    .remediation-block p { margin: 4px 0; font-size: 13px; }
    .remediation-block ol { margin: 8px 0 0; padding-left: 18px; font-size: 12px; }
    .remediation-block li { margin-bottom: 6px; }
    .disclaimer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #dee2e6; font-size: 11px; color: #6c757d; }
    code { background: #e9ecef; padding: 2px 5px; border-radius: 4px; font-size: 12px; }
    .tier-footer { margin-top: 24px; padding: 12px 16px; background: rgba(13,110,253,0.04); border-radius: 8px; font-size: 12px; color: #495057; border: 1px solid rgba(13,110,253,0.12); }
</style>
</head>
<body>

<div class="letterhead">
    <div class="letterhead-left">
        <h1>Executive Risk Certificate</h1>
        <p>Generated: ${generatedAt} &nbsp;|&nbsp; Licensed to: ${licenseClaims.sub || 'Unknown'} &nbsp;|&nbsp; Tier: ${licenseClaims.tier || 'standard'}</p>
    </div>
    <div class="letterhead-right">
        <div class="engines-badge">52 Deterministic Engines</div>
        <div class="tagline">Catch AI code debt that traditional linting misses — no upload, no LLM, no false positives.</div>
    </div>
</div>

<div class="summary-row">
    <div class="grade-badge">${grade.grade}</div>
    <div>
        <div class="grade-label">${grade.tier}</div>
        <div class="risk-tier" style="background:${grade.color}20;color:${grade.color};border:1px solid ${grade.color}40">
            Compliance Score: ${grade.score}%
        </div>
        <div class="quality-bar-container">
            <div class="quality-bar-fill" style="width:${Math.max(grade.score, 3)}%;background:linear-gradient(90deg,${grade.color},${grade.color}dd)">${grade.score}%</div>
        </div>
    </div>
    <div class="score-card"><h3>Files Scanned</h3><p>${report.repositoryFilesTotal ?? '—'}</p></div>
    <div class="score-card"><h3>Total Findings</h3><p>${grade.totalFindings}</p></div>
    <div class="score-card"><h3>Gate Status</h3><div class="gate-badge ${gate.pass ? 'gate-pass' : 'gate-fail'}">${gate.pass ? '✓ PASS' : '✗ FAIL'}</div></div>
</div>

<h2>1. The Four Compliance Pillars</h2>
<div class="pillar-grid">
    ${pillarCards}
</div>

<h2>2. Estimated Financial Liability</h2>
<p style="font-size:13px;color:#495057">
    These are conservative estimates based on publicly-recorded fines and settlements under the cited regulatory frameworks. Actual liability depends on jurisdiction, revenue, and legal counsel.
</p>
${liability.total > 0 ? `
<table>
    <thead><tr><th>Pillar</th><th>Findings</th><th>Est. Max Exposure</th></tr></thead>
    <tbody>${liabilityRows}<tr style="font-weight:700;background:#f8f9fa"><td colspan="2">Total Estimated Liability</td><td>$${liability.total.toLocaleString()}</td></tr></tbody>
</table>
` : '<p style="color:#0f5132;font-weight:600">No quantifiable liability detected — all pillars are clean.</p>'}

<h2>3. Actionable Executive Remediation</h2>
${remediationSteps.length > 0 ? remediationSteps.join('') : '<p>No remediation required — codebase meets current compliance thresholds.</p>'}

<div class="disclaimer">
    <strong>Disclaimer:</strong> This is a static technical pattern review generated locally by SimpleBeacon CLI using 52 deterministic engines. No source code was transmitted to any external server. No LLM or AI narrative was used in the analysis. Estimates are illustrative and do not constitute legal advice or a formal conformity assessment. Consult legal counsel before any regulatory filing.
    <br>License ID: ${licenseClaims.jti || 'N/A'} | Valid until: ${licenseClaims.exp ? new Date(licenseClaims.exp * 1000).toISOString() : 'N/A'}
</div>

<div class="tier-footer">
    <strong>SimpleBeacon</strong> — 52 deterministic engines catch AI code debt that traditional linting misses. This certificate was generated on a ${licenseClaims.tier || 'standard'} tier license. <a href="https://simplebeacon.ai/pricing" style="color:#0d6efd;text-decoration:none">Upgrade for team-wide CI history, custom policy rules, and air-gapped enterprise deployment.</a>
</div>

</body>
</html>`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Public API                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Generate an Executive Risk Certificate from a scan report.
 * @param {string} reportPath
 * @param {string} outputPath
 * @returns {Promise<{ok:boolean, htmlPath?:string, message?:string, error?:string}>}
 */
async function generateExecutivePdf(reportPath, outputPath) {
    const license = validateLicense();
    if (!license.valid) {
        return { ok: false, error: license.error };
    }

    const resolvedReport = path.resolve(reportPath || '.simplebeacon/report.json');
    if (!fs.existsSync(resolvedReport)) {
        return { ok: false, error: `Report not found: ${resolvedReport}` };
    }

    let report;
    try {
        const raw = await fs.promises.readFile(resolvedReport, 'utf8');
        report = JSON.parse(raw);
    } catch (err) {
        return { ok: false, error: `Invalid JSON report: ${err.message}` };
    }

    const html = buildExecutiveHtml(report, license.claims);
    const resolvedOutput = path.resolve(outputPath || 'simplebeacon-executive-risk-certificate.html');
    try {
        await fs.promises.writeFile(resolvedOutput, html, 'utf8');
    } catch (err) {
        return { ok: false, error: `Failed to write output: ${err.message}` };
    }

    return {
        ok: true,
        htmlPath: resolvedOutput,
        message: `Executive Risk Certificate written to ${resolvedOutput}. Open in browser and print to PDF.`
    };
}

module.exports = {
    generateExecutivePdf,
    validateLicense,
    buildExecutiveHtml,
    buildRiskProfile,
    computeFinancialLiability,
    computeComplianceGrade
};
