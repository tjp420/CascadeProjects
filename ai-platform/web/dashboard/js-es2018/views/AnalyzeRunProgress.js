import { formatNumber } from '../utils.js';
import { COMPLETE_STEPS, COMPLETE_ENGINE_ORDER } from './AnalyzeEngineGrid.js';

/**
 * Complete step label.
 * @param {number} index
 * @param {string} text
 * @param {Array} totalSteps
 * @returns {any}
 */
export function completeStepLabel(index, text, totalSteps = COMPLETE_ENGINE_ORDER.length) {
    return `${index + 1}/${totalSteps} ${text}`;
}

/**
 * Resolve complete scan counts.
 * @param {string} lastResult
 * @returns {any}
 */
export function resolveCompleteScanCounts(lastResult) {
    var _a, _b, _c;
    const steps = (lastResult === null || lastResult === void 0 ? void 0 : lastResult.steps) || [];
    const enginesRun = ((_a = lastResult === null || lastResult === void 0 ? void 0 : lastResult.enginesRun) === null || _a === void 0 ? void 0 : _a.length)
        ? lastResult.enginesRun
        : ((_c = (_b = lastResult === null || lastResult === void 0 ? void 0 : lastResult.analysisConfig) === null || _b === void 0 ? void 0 : _b.enginesRun) === null || _c === void 0 ? void 0 : _c.length)
            ? lastResult.analysisConfig.enginesRun
            : steps.map((step) => step.id);
    const planned = enginesRun.length || steps.length || COMPLETE_STEPS.length;
    const succeeded = steps.length;
    return {
        enginesRun,
        planned,
        succeeded,
        failed: Math.max(0, planned - succeeded)
    };
}

/**
 * Format scan progress details.
 * @param {any} sp
 * @param {Object} options
 * @returns {any}
 */
export function formatScanProgressDetails(sp, options = {}) {
    if (!sp || sp.active === false)
        return { counter: '', scopeNote: '' };
    const processed = sp.processed != null ? Number(sp.processed) : null;
    const total = sp.total != null ? Number(sp.total) : null;
    const phase = String(sp.phase || '');
    const label = String(sp.label || sp.fileKind || '');
    const folderLabel = options.scanPathLabel ? String(options.scanPathLabel).trim() : '';
    const fullTree = Boolean(options.fullDirectoryScan || phase === 'full-tree');
    let unit = 'files';
    let phaseLabel = label || 'Scanning';
    if (fullTree || sp.fileKind === 'full-tree' || (sp.fileKind === 'scan-scoped' && options.fullDirectoryScan)) {
        phaseLabel = 'Full-tree gate walk';
    }
    else if (sp.fileKind === 'scan-scoped') {
        phaseLabel = 'Gate walk';
    }
    else if (phase === 'codebase' || sp.fileKind === 'code') {
        phaseLabel = /eslint/i.test(label) ? 'ESLint' : 'Code analysis';
        unit = /eslint/i.test(label) ? 'lint targets' : 'code files';
    }
    else if (phase === 'gate') {
        phaseLabel = 'Simplebeacon gate';
    }
    let counter = '';
    if (processed != null && total != null) {
        counter = `${phaseLabel} · ${formatNumber(processed)} / ${formatNumber(total)} ${unit}`;
    }
    else if (phaseLabel) {
        counter = phaseLabel;
    }
    const scopeParts = [];
    if (folderLabel) {
        scopeParts.push(`Folder: ${folderLabel}.`);
    }
    const explorer = options.explorerInventory;
    if (fullTree && total != null) {
        const skipped = Array.isArray(sp.skipDirs) ? sp.skipDirs : [];
        const includesNodeModules = skipped.length > 0 && !skipped.includes('node_modules');
        scopeParts.push(includesNodeModules
            ? 'Every file under the selected path is included (node_modules, etc.) — skips .git, .github-sync CLI mirror, and github-cache benchmark clones only.'
            : `This step scans ${formatNumber(total)} files after skipping ${skipped.length ? skipped.join(', ') : 'node_modules, .git, and build artifacts'}.`);
        if ((explorer === null || explorer === void 0 ? void 0 : explorer.totalFiles) != null && Math.abs(explorer.totalFiles - total) > 50) {
            const folderPart = explorer.totalFolders != null
                ? ` / ${formatNumber(explorer.totalFolders)} folders`
                : '';
            scopeParts.push(`Repository inventory for the same path: ${formatNumber(explorer.totalFiles)} files${folderPart}.`);
        }
    }
    else if (phase === 'codebase' || sp.fileKind === 'code') {
        scopeParts.push('Source-code extensions only (.js, .ts, .py, …) — not images, JSON, or other assets.');
        if ((explorer === null || explorer === void 0 ? void 0 : explorer.totalFiles) != null && total != null && explorer.totalFiles !== total) {
            scopeParts.push(`Folder holds ${formatNumber(explorer.totalFiles)} files total; this step covers ${formatNumber(total)} ${unit}.`);
        }
    }
    else if ((explorer === null || explorer === void 0 ? void 0 : explorer.totalFiles) != null && total != null && explorer.totalFiles !== total) {
        scopeParts.push(`Folder inventory: ${formatNumber(explorer.totalFiles)} files${explorer.totalFolders != null ? `, ${formatNumber(explorer.totalFolders)} folders` : ''}; active scan: ${formatNumber(total)} ${unit}.`);
    }
    else if (sp.repositoryAuditFiles != null && total != null && sp.repositoryAuditFiles !== total) {
        scopeParts.push(`${formatNumber(sp.repositoryAuditFiles)} audit-scoped repo files (skips node_modules, github-cache, etc.).`);
    }
    return { counter, scopeNote: scopeParts.join(' ').trim() };
}
