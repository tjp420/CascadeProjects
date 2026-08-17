/**
 * Careful trim suggestions — prioritized actions from file-reduction analysis.
 * Combines byte reclaim (logs, dupes) with symbol-level dead-code findings.
 */

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };

function rankConfidence(value) {
    return CONFIDENCE_RANK[value] || 1;
}

function buildLogTrimItems(reviewLogs = []) {
    return reviewLogs.map((entry) => ({
        phase: 'deleteLogs',
        action: 'delete-file',
        path: entry.path,
        bytes: entry.bytes || 0,
        confidence: 'medium',
        reason: 'Regenerable log file — review for audit history before delete',
        codeChange: false
    }));
}

function buildDeadExportItems(deadCodeFindings = []) {
    return deadCodeFindings
        .filter((f) => f.type === 'dead-export' && f.confidence !== 'low')
        .slice(0, 40)
        .map((finding) => ({
            phase: 'removeDeadExport',
            action: finding.action || 'remove-dead-export',
            path: finding.path,
            symbol: finding.metadata?.symbol || null,
            confidence: finding.confidence || 'medium',
            reason: finding.reason || 'Export never imported or used internally',
            codeChange: true
        }));
}

function buildOrphanExportItems(deadCodeFindings = []) {
    return deadCodeFindings
        .filter((f) => f.type === 'orphaned-export')
        .slice(0, 20)
        .map((finding) => ({
            phase: 'unexportSymbol',
            action: finding.action || 'consider-unexporting',
            path: finding.path,
            symbol: finding.metadata?.symbol || null,
            confidence: finding.confidence || 'low',
            reason: finding.reason || 'Used internally only — consider removing export keyword',
            codeChange: true
        }));
}

function buildDuplicateTrimItems(topGroups = []) {
    return topGroups.slice(0, 8).map((group) => ({
        phase: 'consolidateDuplicate',
        action: 'keep-canonical-delete-duplicates',
        path: group.keeper,
        duplicatePaths: group.duplicates || [],
        bytes: group.reclaimableBytes || 0,
        confidence: 'high',
        reason: 'Hash-identical asset — update references to keeper path',
        codeChange: true
    }));
}

function buildUnusedFileHints(unusedFiles = [], limit = 12) {
    return unusedFiles.slice(0, limit).map((finding) => ({
        phase: 'investigateUnusedFile',
        action: 'verify-before-delete',
        path: finding.path,
        confidence: finding.confidence || 'low',
        reason: finding.reason || 'No static import references — verify dynamic/runtime usage',
        codeChange: false
    }));
}

/**
 * Build prioritized trim suggestions from a data-cleanup report (+ optional plan).
 * @param {object} report
 * @param {object} [plan]
 * @returns {object}
 */
function buildTrimSuggestions(report, plan) {
    const filePlan = plan || report.fileReductionPlan || {};
    const review = filePlan.reviewBeforeDelete || {};
    const deadCode = report.findings?.deadCode || [];
    const unusedFiles = report.findings?.unusedFiles || [];
    const duplicateGroups = filePlan.duplicateAssets?.topGroups || [];

    const deleteLogs = buildLogTrimItems(review.logs || []);
    const removeDeadExports = buildDeadExportItems(deadCode);
    const unexportSymbols = buildOrphanExportItems(deadCode);
    const consolidateDuplicates = buildDuplicateTrimItems(duplicateGroups);
    const investigateUnused = buildUnusedFileHints(unusedFiles);

    const topActions = [
        ...deleteLogs,
        ...consolidateDuplicates,
        ...removeDeadExports,
        ...unexportSymbols,
        ...investigateUnused
    ]
        .sort((a, b) => {
            const conf = rankConfidence(b.confidence) - rankConfidence(a.confidence);
            if (conf !== 0) return conf;
            return (b.bytes || 0) - (a.bytes || 0);
        })
        .slice(0, 24);

    const logBytes = deleteLogs.reduce((sum, item) => sum + (item.bytes || 0), 0);

    return {
        schemaVersion: '1.0',
        generatedAt: report.generatedAt || new Date().toISOString(),
        analysisNote: 'Suggestions combine static import graph, export analysis, and artifact scanners. Verify dynamic imports and test before applying code trims.',
        phases: {
            deleteLogs: {
                count: deleteLogs.length,
                bytes: logBytes,
                confidence: 'medium',
                items: deleteLogs.slice(0, 15)
            },
            removeDeadExports: {
                count: removeDeadExports.length,
                confidence: 'medium',
                items: removeDeadExports.slice(0, 15)
            },
            unexportSymbols: {
                count: unexportSymbols.length,
                confidence: 'low',
                items: unexportSymbols.slice(0, 10)
            },
            consolidateDuplicates: {
                count: consolidateDuplicates.length,
                bytes: consolidateDuplicates.reduce((s, i) => s + (i.bytes || 0), 0),
                confidence: 'high',
                items: consolidateDuplicates
            },
            investigateUnusedFiles: {
                count: filePlan.unusedFiles?.candidates ?? unusedFiles.length,
                confidence: 'low',
                items: investigateUnused.slice(0, 10)
            }
        },
        topActions,
        agentPrompt: buildTrimAgentPrompt(topActions, logBytes, removeDeadExports.length)
    };
}

function buildTrimAgentPrompt(topActions, logBytes, deadExportCount) {
    const lines = [
        'Apply trim suggestions in phase order. Dry-run only until I confirm each batch.',
        '',
        `Phase 1 — Logs (~${Math.round(logBytes / 1024)} KB): delete listed .log files if no audit need.`,
        `Phase 2 — Dead exports (${deadExportCount}): remove unused export keywords or delete unreachable symbols.`,
        'Phase 3 — Duplicate assets: keep canonical path, update imports, delete dupes.',
        'Phase 4 — Unused files: investigate only — do not bulk delete.',
        '',
        'Never delete protected paths (web/data, .git, .simplebeacon). Run tests after code trims.'
    ];
    if (topActions.length) {
        lines.push('', 'Top actions:');
        for (const action of topActions.slice(0, 8)) {
            const label = action.symbol
                ? `${action.path} → ${action.symbol}`
                : action.path;
            lines.push(`- [${action.confidence}] ${action.phase}: ${label}`);
        }
    }
    return lines.join('\n');
}

function formatTrimSuggestionsMarkdown(suggestions) {
    if (!suggestions || typeof suggestions !== 'object') return '';
    const lines = [
        '# SimpleBeacon trim suggestions',
        '',
        suggestions.analysisNote || '',
        '',
        '## Summary',
        ''
    ];
    const phases = suggestions.phases || {};
    if (phases.deleteLogs?.count) {
        lines.push(`- **Delete logs:** ${phases.deleteLogs.count} files (~${Math.round((phases.deleteLogs.bytes || 0) / 1024)} KB)`);
    }
    if (phases.removeDeadExports?.count) {
        lines.push(`- **Remove dead exports:** ${phases.removeDeadExports.count} symbol(s)`);
    }
    if (phases.unexportSymbols?.count) {
        lines.push(`- **Unexport orphaned symbols:** ${phases.unexportSymbols.count}`);
    }
    if (phases.consolidateDuplicates?.count) {
        lines.push(`- **Consolidate duplicates:** ${phases.consolidateDuplicates.count} group(s)`);
    }
    if (phases.investigateUnusedFiles?.count) {
        lines.push(`- **Investigate unused files:** ${phases.investigateUnusedFiles.count} candidate(s)`);
    }
    lines.push('');
    if ((suggestions.topActions || []).length) {
        lines.push('## Top actions');
        lines.push('');
        for (const action of suggestions.topActions) {
            const extra = action.symbol ? ` \`${action.symbol}\`` : '';
            const size = action.bytes ? ` (${Math.round(action.bytes / 1024)} KB)` : '';
            lines.push(`- **[${action.confidence}]** ${action.phase}: \`${action.path}\`${extra}${size} — ${action.reason}`);
        }
        lines.push('');
    }
    if (suggestions.agentPrompt) {
        lines.push('## Agent prompt');
        lines.push('');
        lines.push(suggestions.agentPrompt);
        lines.push('');
    }
    return lines.join('\n');
}

module.exports = {
    buildTrimSuggestions,
    formatTrimSuggestionsMarkdown,
    buildTrimAgentPrompt
};
