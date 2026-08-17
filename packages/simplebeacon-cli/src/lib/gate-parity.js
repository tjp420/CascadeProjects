/**
 * Shared gate semantics version tag for CLI, MCP, and browser worker parity checks.
 */

const ENGINE_VERSION = 'simplebeacon-gate-v1.3.0';

/**
 * Normalize blocking count from snippet scan findings (high + critical).
 * @param {Array<{severity?: string}>} findings
 * @returns {number}
 */
function blockingCountFromFindings(findings) {
    return (findings || []).filter(
        (f) => f.severity === 'high' || f.severity === 'critical'
    ).length;
}

/**
 * Attach engine metadata to scan payloads for cross-surface contract tests.
 * @param {object} payload
 * @param {{ gatePass?: boolean|null, blockingCount?: number }} gateInfo
 * @returns {object}
 */
function attachGateMetadata(payload, gateInfo = {}) {
    return {
        ...payload,
        engineVersion: ENGINE_VERSION,
        gatePass: gateInfo.gatePass ?? payload.gatePass ?? null,
        blockingCount: gateInfo.blockingCount ?? payload.blockingCount ?? blockingCountFromFindings(payload.findings)
    };
}

module.exports = {
    ENGINE_VERSION,
    blockingCountFromFindings,
    attachGateMetadata
};
