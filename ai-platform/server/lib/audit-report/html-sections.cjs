// simplebeacon-ignore test-coverage
/**
 * HTML section builders for the audit report.
 */

const { escapeHtml } = require('../code-roadmap-export.cjs');

/**
 * Build executive dashboard banner.
 * @param {any} model
 * @returns {any}
 */
function buildExecutiveDashboardBanner(model) {
    const tier = model.exportTier || { tier: 'handoff' };
    const s = model.summary;
    const gatePass = s.gatePass === true;
    const gateLabel = gatePass ? 'PASS' : s.gatePass === false ? 'FAIL' : 'NOT EVALUATED';
    const stepKey = tier.stepKey || s.scanKind || null;
    const scopeNote = '<p class="meta" style="margin-top:10px">Gate attestation not included in this export — run Simplebeacon gate or Complete scan, or attach a gate PDF separately.</p>';

    if (tier.tier === 'handoff' || tier.tier === 'gate-only') {
        const gateClass = gatePass ? 'pass' : s.gatePass === false ? 'fail' : '';
        return `<div class="gate-banner ${gateClass}">
        <div class="gate-banner-label">Overall gate result</div>
        <div class="gate-banner-value">${escapeHtml(gateLabel)}</div>
      </div>`;
    }

    if (tier.tier === 'codebase-only') {
        const health = s.codebaseHealth != null ? `${s.codebaseHealth}%` : '—';
        const files = s.codeFilesAnalyzed != null ? Number(s.codeFilesAnalyzed).toLocaleString() : '—';
        const prodFindings = s.productionFindings ?? 0;
        return `<div class="gate-banner pass">
        <div class="gate-banner-label">Codebase deep scan</div>
        <div class="gate-banner-value gate-banner-compact">${escapeHtml(files)} files · ${escapeHtml(health)} health</div>
        <p class="meta" style="margin-top:10px">${Number(prodFindings).toLocaleString()} production-path finding(s) · gate attestation not in this export</p>
      </div>`;
    }

    let bannerLabel = tier.label || 'Supplementary scan';
    let bannerValue = 'See metrics below';
    let bannerClass = 'pass';

    switch (stepKey) {
        case 'data-quality':
            bannerLabel = 'Data quality scan';
            bannerValue = `${Number(s.dataQualityFindings ?? 0).toLocaleString()} finding(s)`;
            break;
        case 'file-reduction':
            bannerLabel = 'File reduction scan';
            bannerValue = `${Number(s.fileReductionFindings ?? 0).toLocaleString()} finding(s)`;
            break;
        case 'consolidation':
            bannerLabel = 'Data consolidation scan';
            bannerValue = `${Number(s.duplicateGroups ?? 0).toLocaleString()} duplicate group(s)`;
            break;
        case 'roadmap':
            bannerLabel = 'Roadmap analysis';
            bannerValue = s.roadmapCompletion != null
                ? `${s.roadmapCompletion}% complete · ${s.roadmapSprints ?? '—'} sprints`
                : `${s.roadmapFiles != null ? Number(s.roadmapFiles).toLocaleString() : '—'} files scanned`;
            break;
        case 'cleanup-assistant':
            bannerLabel = 'Cleanup assistant';
            bannerValue = s.cleanupSafeFiles != null
                ? `${Number(s.cleanupSafeFiles).toLocaleString()} tier-1 safe file(s)`
                : 'Tiered cleanup plan';
            break;
        case 'mock-scan':
            bannerLabel = 'Fiction and KPI digest';
            bannerValue = `${Number(s.fictionKpiHits ?? 0).toLocaleString()} hit(s)`;
            break;
        default:
            bannerClass = 'fail';
            break;
    }

    return `<div class="gate-banner ${bannerClass}">
        <div class="gate-banner-label">${escapeHtml(bannerLabel)}</div>
        <div class="gate-banner-value gate-banner-compact">${escapeHtml(bannerValue)}</div>
        ${scopeNote}
      </div>`;
}

/**
 * Build executive kpi strip.
 * @param {any} model
 * @returns {any}
 */
function buildExecutiveKpiStrip(model) {
    const s = model.summary;
    const tier = model.exportTier?.tier || 'handoff';
    const stepKey = model.exportTier?.stepKey || s.scanKind || null;
    const codeHealthSuffix = s.codebaseHealth != null ? '%' : '';
    const kpis = [];

/**
 * Push kpi.
 * @param {any} value
 * @param {any} label
 * @returns {any}
 */
    const pushKpi = (value, label) => {
        kpis.push(`<div class="kpi"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`);
    };

    if (tier === 'handoff' || tier.tier === 'gate-only') {
        pushKpi(s.simplebeaconIssues ?? 0, 'Gate issues');
        pushKpi(s.productionFindings ?? 0, 'Runtime findings');
        pushKpi(s.documentationFindings ?? 0, 'Doc-tier (info)');
        pushKpi(`${s.codebaseHealth ?? '—'}${codeHealthSuffix}`, 'Code health');
        pushKpi(s.codeFilesAnalyzed ?? '—', 'Files deep-scanned');
    } else if (tier === 'codebase-only') {
        pushKpi(s.codeFilesAnalyzed ?? '—', 'Files deep-scanned');
        pushKpi(`${s.codebaseHealth ?? '—'}${codeHealthSuffix}`, 'Code health');
        pushKpi(s.productionFindings ?? 0, 'Production findings');
        pushKpi(s.documentationFindings ?? 0, 'Doc-tier (info)');
        pushKpi('N/A', 'Gate (not scanned)');
    } else {
        switch (stepKey) {
            case 'data-quality':
                pushKpi(s.dataQualityFindings ?? 0, 'DQ findings');
                pushKpi(s.orphanedDataFiles ?? '—', 'Orphaned data');
                pushKpi(s.repositoryFiles ?? '—', 'Repo files');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                break;
            case 'file-reduction':
                pushKpi(s.fileReductionFindings ?? 0, 'FR findings');
                pushKpi(s.fileReductionReclaimableBytes != null ? `${Math.round(s.fileReductionReclaimableBytes / 1024 / 1024)} MB` : '—', 'Reclaimable');
                pushKpi(s.repositoryFiles ?? '—', 'Repo files');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                break;
            case 'consolidation':
                pushKpi(s.duplicateGroups ?? 0, 'Dup groups');
                pushKpi(s.repositoryFiles ?? '—', 'Repo files');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                pushKpi('N/A', 'Code health');
                break;
            case 'roadmap':
                pushKpi(s.roadmapSprints ?? '—', 'Sprints');
                pushKpi(s.roadmapCompletion != null ? `${s.roadmapCompletion}%` : '—', 'Complete');
                pushKpi(s.roadmapFiles ?? '—', 'Files scanned');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                break;
            case 'cleanup-assistant':
                pushKpi(s.cleanupSafeFiles ?? '—', 'Safe-delete files');
                pushKpi(s.dataQualityFindings ?? '—', 'DQ findings');
                pushKpi(s.fileReductionFindings ?? '—', 'FR findings');
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi('N/A', 'Deep scan');
                break;
            case 'mock-scan':
                pushKpi(s.fictionKpiHits ?? 0, 'Fiction/KPI hits');
                pushKpi(s.simplebeaconIssues ?? 0, 'Gate issues');
                pushKpi('N/A', 'Deep scan');
                pushKpi('N/A', 'Code health');
                pushKpi('N/A', 'Production findings');
                break;
            default:
                pushKpi('N/A', 'Gate (not scanned)');
                pushKpi(s.productionFindings ?? 0, 'Runtime findings');
                pushKpi(s.dataQualityFindings ?? '—', 'DQ findings');
                pushKpi(s.codeFilesAnalyzed ?? '—', 'Files deep-scanned');
                pushKpi(`${s.codebaseHealth ?? '—'}${codeHealthSuffix}`, 'Code health');
                break;
        }
    }

    while (kpis.length < 5) {
        pushKpi('—', 'N/A');
    }

    return kpis.slice(0, 5).join('\n        ');
}

/**
 * Build cover presentation.
 * @param {any} model
 * @returns {any}
 */
function buildCoverPresentation(model) {
    const tier = model.exportTier || { tier: 'handoff', showReadinessScore: true, showSignOffBlock: true, label: 'Pre-launch security audit' };
    const s = model.summary;
    const gatePass = s.gatePass === true;
    const gateLabel = gatePass ? 'PASS' : s.gatePass === false ? 'FAIL' : 'NOT EVALUATED';
    const readiness = model.readiness;

    let kicker;
    let subtitle;
    if (tier.tier === 'handoff') {
        kicker = 'Simplebeacon · Pre-Launch Security Audit';
        subtitle = 'Formal static assessment for vendor security questionnaires, client handoff packages, and production readiness sign-off.';
    } else {
        kicker = `Simplebeacon · Supplementary — ${tier.label}`;
        subtitle = `Supplementary scan deliverable — not a standalone pre-launch security handoff. ${tier.handoffHint || ''}`.trim();
    }

    let badges = '<span class="badge badge-gold">CONFIDENTIAL</span>';
    if (tier.tier === 'handoff') {
        badges += `<span class="badge ${gatePass ? 'badge-pass' : 'badge-blocked'}">GATE ${escapeHtml(gateLabel)}</span>`;
        badges += `<span class="badge badge-gold">READINESS ${Math.round(readiness.score)}/100</span>`;
    } else if (tier.tier === 'gate-only') {
        badges += `<span class="badge ${gatePass ? 'badge-pass' : 'badge-blocked'}">GATE ${escapeHtml(gateLabel)}</span>`;
        badges += '<span class="badge badge-gold">SUPPLEMENTARY</span>';
    } else {
        badges += '<span class="badge badge-gold">SUPPLEMENTARY</span>';
        if (tier.readinessDisplay) {
            badges += `<span class="badge badge-blocked">${escapeHtml(tier.readinessDisplay)}</span>`;
        }
    }

    const supplementaryCallout = tier.tier !== 'handoff' && tier.missingForHandoff?.length
        ? `<div class="callout"><strong>Not a full handoff bundle.</strong> Missing for vendor sign-off: ${escapeHtml(tier.missingForHandoff.join(' · '))}.</div>`
        : '';

    const pageTitle = tier.tier === 'handoff'
        ? `Pre-Launch Code Audit — ${model.client}`
        : `Supplementary Audit — ${tier.label} — ${model.client}`;

    return { kicker, subtitle, badges, supplementaryCallout, pageTitle, tier };
}

module.exports = {
    buildExecutiveDashboardBanner,
    buildExecutiveKpiStrip,
    buildCoverPresentation
};
