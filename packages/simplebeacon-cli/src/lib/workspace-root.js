/**
 * Resolve workspace root by walking up from a scan target (monorepo-aware).
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_MARKERS = [
    '.git',
    '.cursor/mcp.json',
    'AGENTS.md',
    '.simplebeacon/mcp-reference.json'
];

function findWorkspaceRoot(startDir, options = {}) {
    const markers = options.markers || DEFAULT_MARKERS;
    let dir = path.resolve(startDir || process.cwd());
    const root = path.parse(dir).root;
    let best = dir;

    while (dir && dir !== root) {
        for (const marker of markers) {
            const full = path.join(dir, marker);
            if (fs.existsSync(full)) {
                return dir;
            }
        }
        best = dir;
        dir = path.dirname(dir);
    }
    return best;
}

function resolveScanAndWorkspaceRoots(projectRoot, options = {}) {
    const scanRoot = path.resolve(projectRoot || process.cwd());
    const workspaceRoot = path.resolve(
        options.workspaceRoot || findWorkspaceRoot(scanRoot, options)
    );
    return { scanRoot, workspaceRoot };
}

module.exports = {
    DEFAULT_MARKERS,
    findWorkspaceRoot,
    resolveScanAndWorkspaceRoots
};
