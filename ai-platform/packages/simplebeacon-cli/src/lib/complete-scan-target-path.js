/**
 * Resolve the target path for a complete-scan export.
 * Keeps benchmark/github-cache clone scope; redirects monorepo parent to platform root.
 */

const path = require('path');

function resolveCompleteScanTargetPath(targetPath, priorSteps = []) {
    const normalized = String(targetPath || '').replace(/\\/g, '/');
    const simplebeaconStep = priorSteps.find((s) => s.id === 'simplebeacon');
    const report = simplebeaconStep?.report || {};
    const platformRoot = String(report.platformRoot || '').replace(/\\/g, '/');
    const projectRoot = String(report.projectRoot || '').replace(/\\/g, '/');
    const scanTargetRoot = String(report.scanTargetRoot || '').replace(/\\/g, '/');

    // Keep external benchmark clones with explicit scanTargetRoot
    if (scanTargetRoot && scanTargetRoot === normalized) {
        return targetPath;
    }

    // Keep github-cache clone scope
    if (/github-cache\//.test(normalized)) {
        return targetPath;
    }

    // Redirect monorepo parent to platform root when platformRoot is absolute
    if (platformRoot && platformRoot.includes('/') && normalized !== platformRoot) {
        const parent = path.dirname(platformRoot).replace(/\\/g, '/');
        if (normalized === parent || normalized.startsWith(parent + '/')) {
            return platformRoot;
        }
    }

    return targetPath;
}

module.exports = { resolveCompleteScanTargetPath };
